import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Check, 
  Loader2, 
  Calendar, 
  User, 
  Plus, 
  Clock, 
  Phone, 
  ArrowRight, 
  Upload, 
  Trash2, 
  SwitchCamera, 
  Zap, 
  Sparkles, 
  ChevronRight, 
  ImageIcon, 
  Smartphone, 
  MessageCircle,
  FileText,
  BookmarkCheck,
  AlertCircle,
  Scissors
} from 'lucide-react';
import { createCalendarEvent } from '../lib/calendar';
import { saveTreatmentPlanToDrive, uploadPatientImageToDrive } from '../lib/drive';
import { PhotoSection, Procedure, TreatmentProposal, ClinicSettings } from '../types';
import { format, parseISO, addMinutes } from 'date-fns';

interface MobileWorkspaceProps {
  sections: PhotoSection[];
  onUpdateSection: (updated: PhotoSection) => void;
  procedures: Procedure[];
  proposal: TreatmentProposal;
  setProposal: React.Dispatch<React.SetStateAction<TreatmentProposal>>;
  clinicSettings: ClinicSettings;
  onExitMobile: () => void;
  onNewProposalForPatient: (name: string) => void;
}

interface QuickLead {
  id: string;
  name: string;
  phone: string;
  date: string;
  time: string;
  status: 'Pendente' | 'Criado';
  createdTime: number;
}

export default function MobileWorkspace({
  sections,
  onUpdateSection,
  procedures,
  proposal,
  setProposal,
  clinicSettings,
  onExitMobile,
  onNewProposalForPatient,
}: MobileWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'leads' | 'camera'>('leads');

  // --- TAB 1: QUICK LEAD / REGISTER FORM ---
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadDate, setLeadDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [leadTime, setLeadTime] = useState(format(new Date(), 'HH:mm'));
  const [leadNotes, setLeadNotes] = useState('Consulta de avaliação clínica rápida realizada via Celular.');
  const [isSubmitingLead, setIsSubmitingLead] = useState(false);
  const [successLeadMsg, setSuccessLeadMsg] = useState<string | null>(null);
  const [lastCreatedWhatsAppUrl, setLastCreatedWhatsAppUrl] = useState<string | null>(null);

  // Local list of quick leads (persisted in localStorage for convenience)
  const [quickLeads, setQuickLeads] = useState<QuickLead[]>(() => {
    const cached = localStorage.getItem('ag_dent_quick_leads');
    return cached ? JSON.parse(cached) : [];
  });

  useEffect(() => {
    localStorage.setItem('ag_dent_quick_leads', JSON.stringify(quickLeads));
  }, [quickLeads]);

  const handleQuickLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName.trim()) return;

    setIsSubmitingLead(true);
    setSuccessLeadMsg(null);
    setLastCreatedWhatsAppUrl(null);

    const formattedName = leadName.trim().toUpperCase();
    const phoneClean = leadPhone.replace(/[^\d]/g, '');

    try {
      // 1. Create Google Calendar event
      const startDateTime = new Date(`${leadDate}T${leadTime}:00`).toISOString();
      const endDateTime = new Date(`${leadDate}T${leadTime}:00`);
      endDateTime.setMinutes(endDateTime.getMinutes() + 30);
      
      const calendarDescription = `Consulta agendada pelo WhatsApp (via Mobile rápido).\n\nWhatsApp: ${leadPhone}\nNotas: ${leadNotes}`;
      
      await createCalendarEvent({
        summary: `📍 [CELULAR] ${formattedName}`,
        description: calendarDescription,
        start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endDateTime.toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });

      // 2. Initialize Patient Profile in Google Drive to auto-create folder structure
      const stateToSave = {
        proposal: {
          ...proposal,
          patientName: formattedName,
          notes: leadNotes
        },
        sections,
        procedures
      };
      
      await saveTreatmentPlanToDrive(formattedName, stateToSave);

      // 3. Set active patient in flow
      setProposal(prev => ({
        ...prev,
        patientName: formattedName,
        notes: leadNotes
      }));

      // 4. Generate WhatsApp Confirm URL
      const dateFormatted = format(new Date(`${leadDate}T${leadTime}:00`), "dd/MM/yyyy 'às' HH:mm");
      const msg = `Olá, ${formattedName}! Confirmamos o seu agendamento no consultório do ${clinicSettings.doctorName} para o dia ${dateFormatted}.\n\n📍 Local: ${clinicSettings.address}\n\nFicamos no aguardo de sua confirmação!`;
      const waUrl = `https://wa.me/${phoneClean ? phoneClean : '55'}?text=${encodeURIComponent(msg)}`;
      setLastCreatedWhatsAppUrl(waUrl);

      // Save to local leads list
      const newLead: QuickLead = {
        id: `lead-${Date.now()}`,
        name: formattedName,
        phone: leadPhone,
        date: leadDate,
        time: leadTime,
        status: 'Criado',
        createdTime: Date.now()
      };
      setQuickLeads(prev => [newLead, ...prev]);

      // Reset form fields
      setLeadName('');
      setLeadPhone('');
      setSuccessLeadMsg(`Paciente ${formattedName} cadastrado com sucesso! Pasta criada no Google Drive e agendamento salvo.`);

    } catch (err: any) {
      console.error(err);
      alert('Erro ao processar cadastro rápido: ' + err.message);
    } finally {
      setIsSubmitingLead(false);
    }
  };

  const handleApplyPresetTime = (minutesOffset: number) => {
    const target = new Date();
    target.setMinutes(target.getMinutes() + minutesOffset);
    setLeadDate(format(target, 'yyyy-MM-dd'));
    setLeadTime(format(target, 'HH:mm'));
  };

  // --- TAB 2: EXCLUSIVE LIVE SCAN CAMERA OVERLAY ---
  const [activeCameraSection, setActiveCameraSection] = useState<'upper' | 'smile' | 'lower'>('upper');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  // Refs for tracking streams
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startLiveCamera = async (mode = facingMode) => {
    setCameraError(null);
    setIsCameraActive(true);
    setTorchOn(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err: any) {
        console.error(err);
        setCameraError('Permissão para utilizar câmera foi negada ou não disponível.');
      }
    }, 200);
  };

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const handleToggleTorch = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      const nextTorch = !torchOn;
      try {
        await track.applyConstraints({
          advanced: [{ torch: nextTorch }]
        } as any);
        setTorchOn(nextTorch);
      } catch (e) {
        console.warn('Torch not supported on this lens or browser:', e);
      }
    }
  };

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      if (video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Mirror frame if user camera is active
          if (facingMode === 'user') {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          
          // Locate section and update image
          const targetSectionId = activeCameraSection === 'smile' ? 'smile' : activeCameraSection;
          const targetSection = sections.find((s) => s.id === targetSectionId);
          if (targetSection) {
            onUpdateSection({
              ...targetSection,
              image: dataUrl,
              markers: [] // Reset markers for new placement
            });
          }

          stopLiveCamera();
          setCapturing(true);
          setTimeout(() => setCapturing(false), 800);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const targetSectionId = activeCameraSection === 'smile' ? 'smile' : activeCameraSection;
        const targetSection = sections.find((s) => s.id === targetSectionId);
        if (targetSection) {
          onUpdateSection({
            ...targetSection,
            image: dataUrl,
            markers: []
          });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const [syncsLoading, setSyncsLoading] = useState<Record<string, boolean>>({});
  const [syncsSuccess, setSyncsSuccess] = useState<Record<string, boolean>>({});

  const handleUploadToDrive = async (sectionId: string) => {
    const pName = proposal.patientName;
    if (!pName || pName.trim() === '') {
      alert('Você precisa definir um paciente ativo para enviar imagens ao Google Drive. Utilize o formulário de Cadastro Rápido.');
      return;
    }

    const sec = sections.find(s => s.id === sectionId);
    if (!sec || !sec.image) return;

    setSyncsLoading(prev => ({ ...prev, [sectionId]: true }));
    try {
      // 1. Get or create patient folder
      const dummyProps = { proposal, sections, procedures };
      const folders = await saveTreatmentPlanToDrive(pName, dummyProps);
      
      // 2. Convert DataUrl to Blob
      const arr = sec.image.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      const blob = new Blob([u8arr], { type: mime });

      // 3. Upload to Drive
      const d = format(new Date(), 'yyyy-MM-dd_HH-mm');
      const filename = `${sectionId}_capture_${d}.jpeg`;
      await uploadPatientImageToDrive(folders.id, blob, filename);

      setSyncsSuccess(prev => ({ ...prev, [sectionId]: true }));
      setTimeout(() => {
        setSyncsSuccess(prev => ({ ...prev, [sectionId]: false }));
      }, 3000);
    } catch (err: any) {
      console.error(err);
      alert('Erro ao enviar imagem ao Drive: ' + err.message);
    } finally {
      setSyncsLoading(prev => ({ ...prev, [sectionId]: false }));
    }
  };

  const handleRemovePhoto = (sectionId: string) => {
    const targetSection = sections.find(s => s.id === sectionId);
    if (targetSection) {
      onUpdateSection({
        ...targetSection,
        image: null,
        markers: []
      });
    }
  };

  return (
    <div className="w-full bg-[#FAF8F5] pb-24 font-sans animate-fade-in text-zinc-800">
      
      {/* EXCLUSIVE MOBILE WORKSPACE HEADER */}
      <div className="bg-[#8B0000] text-[#FAF8F5] p-5 shadow-lg border-b border-[#C09553]/30 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FAF8F5]/10 flex items-center justify-center border border-[#C09553]/30">
              <Smartphone className="w-5 h-5 text-[#C09553]" />
            </div>
            <div>
              <h1 className="text-base font-serif font-bold text-[#FAF8F5] tracking-wide">AVALIAÇÃO RÁPIDA MOBILE</h1>
              <p className="text-[10px] text-zinc-300 tracking-wider">MODO CONSULTÓRIO PORTÁTIL</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onExitMobile}
            className="text-xs bg-[#FAF8F5] text-[#8B0000] font-bold px-3 py-1.5 rounded-lg border border-[#C09553] hover:bg-[#F3EFE9] transition-all cursor-pointer shadow-sm active:scale-95"
          >
            Sair do Celular
          </button>
        </div>

        {proposal.patientName ? (
          <div className="mt-4 bg-[#FAF8F5]/10 border border-[#C09553]/20 rounded-xl p-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[10px] text-[#C09553] font-bold tracking-wider uppercase">Paciente Ativo no Celular</p>
              <p className="text-xs font-bold text-white tracking-tight">{proposal.patientName}</p>
            </div>
            <button 
              onClick={() => onNewProposalForPatient('')}
              className="text-[10px] text-zinc-300 hover:text-white underline cursor-pointer"
            >
              Trocar
            </button>
          </div>
        ) : (
          <div className="mt-4 bg-[#FAF8F5]/5 border border-dashed border-[#C09553]/30 rounded-xl p-3 text-center">
            <p className="text-[11px] text-[#C09553] font-medium">Nenhum paciente selecionado. Use o formulário abaixo!</p>
          </div>
        )}
      </div>

      {/* MOBILE NAV TABS */}
      <div className="grid grid-cols-2 bg-white border-b border-[#E6DEC9] sticky top-0 z-40 shadow-xs">
        <button
          onClick={() => {
            stopLiveCamera();
            setActiveTab('leads');
          }}
          className={`py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2 ${
            activeTab === 'leads'
              ? 'border-[#8B0000] text-[#8B0000] bg-[#FAF8F5]/50'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <Calendar className="w-4 h-4 text-[#C09553]" />
          <span>Agendar & Cadastrar</span>
        </button>
        <button
          onClick={() => {
            setActiveTab('camera');
          }}
          className={`py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex items-center justify-center gap-2 ${
            activeTab === 'camera'
              ? 'border-[#8B0000] text-[#8B0000] bg-[#FAF8F5]/50'
              : 'border-transparent text-zinc-400 hover:text-zinc-600'
          }`}
        >
          <Camera className="w-4 h-4 text-[#C09553]" />
          <span>📸 Câmera da Arcada</span>
        </button>
      </div>

      <div className="max-w-md mx-auto p-4 space-y-6">

        {/* CONTAINER TAB 1: QUICK LEAD REGISTRATION & WHATSAPP APPOINTMENT */}
        {activeTab === 'leads' && (
          <div className="space-y-6">
            
            <div className="bg-[#8B0000]/5 border border-[#C09553]/20 p-4 rounded-xl flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#C09553] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-[#8B0000] uppercase tracking-wide">Cadastro Exclusivo via WhatsApp</p>
                <p className="text-[11.5px] text-zinc-600 leading-relaxed mt-0.5">
                  Recebeu um lead ou contato no WhatsApp e precisa salvar agora? Digite o nome, escolha o horário e gere o lembrete de confirmação de forma ultra rápida.
                </p>
              </div>
            </div>

            {successLeadMsg && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-800 space-y-3 shadow-xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold">{successLeadMsg}</span>
                </div>
                {lastCreatedWhatsAppUrl && (
                  <a
                    href={lastCreatedWhatsAppUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-2.5 px-4 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm text-center"
                  >
                    <MessageCircle className="w-4.5 h-4.5 fill-current" />
                    <span>Enviar Lembrete no WhatsApp</span>
                  </a>
                )}
              </div>
            )}

            {/* QUICK LEAD FORM */}
            <form onSubmit={handleQuickLeadSubmit} className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-sm space-y-4">
              <h2 className="text-sm font-bold text-[#8B0000] uppercase tracking-wide border-b border-[#FAF8F5] pb-2 flex items-center gap-2">
                <User className="w-4 h-4 text-[#C09553]" />
                Ficha de Cadastro Rápido
              </h2>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Nome Completo</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="Ex: AGNALDO FERREIRA FILHO"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value.toUpperCase())}
                    className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] rounded-xl pl-10 pr-3.5 py-3 text-sm font-medium focus:outline-none transition-all placeholder:text-zinc-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">WhatsApp com DDD (Ex: 11999998888)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    placeholder="Ex: 5511999998888"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] rounded-xl pl-10 pr-3.5 py-3 text-sm focus:outline-none transition-all placeholder:text-zinc-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C09553] pointer-events-none">
                      <Calendar className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="date"
                      required
                      value={leadDate}
                      onChange={(e) => setLeadDate(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-xl pl-8 pr-2 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Horário</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#C09553] pointer-events-none">
                      <Clock className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type="time"
                      required
                      value={leadTime}
                      onChange={(e) => setLeadTime(e.target.value)}
                      className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-xl pl-8 pr-2 py-2.5 text-xs focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* QUICK TIMES PRESET BUTTONS */}
              <div className="space-y-1">
                <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Atalhos rápidos de horário</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTime(0)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-[10px] font-semibold rounded-md text-zinc-600"
                  >
                    Agora Mesmo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTime(30)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-[10px] font-semibold rounded-md text-zinc-600"
                  >
                    Em 30 min
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPresetTime(60)}
                    className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 text-[10px] font-semibold rounded-md text-zinc-600"
                  >
                    Em 1 hora
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Observações / Anotação de Triagem</label>
                <textarea
                  rows={2}
                  value={leadNotes}
                  onChange={(e) => setLeadNotes(e.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-xl p-3 text-xs focus:outline-none font-medium text-zinc-600"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitingLead}
                className="w-full flex items-center justify-center gap-2 bg-[#8B0000] text-white font-bold py-3 px-4 rounded-xl shadow-md cursor-pointer transition-colors hover:bg-[#6c1b26] disabled:opacity-50 text-sm mt-3"
              >
                {isSubmitingLead ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Salvando dados...</span>
                  </>
                ) : (
                  <>
                    <BookmarkCheck className="w-4 h-4" />
                    <span>Agendar e Criar Pasta</span>
                  </>
                )}
              </button>
            </form>

            {/* RECENT LEADS HISTORY */}
            {quickLeads.length > 0 && (
              <div className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-[#FAF8F5] pb-2">
                  <h3 className="text-xs font-bold text-[#8B0000] uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#C09553]" />
                    Leads Recorrentes / Recentes
                  </h3>
                  <button
                    onClick={() => {
                      if (confirm('Deseja limpar histórico local de leads rápida?')) setQuickLeads([]);
                    }}
                    className="text-[9px] hover:text-rose-600 text-zinc-400 font-semibold uppercase tracking-wider"
                  >
                    Limpar
                  </button>
                </div>

                <div className="divide-y divide-zinc-50 max-h-60 overflow-y-auto pr-1 space-y-2">
                  {quickLeads.map((item) => {
                    const waNumClean = item.phone.replace(/[^\d]/g, '');
                    const dFormat = item.date.split('-').reverse().join('/');
                    const waRemUrl = `https://wa.me/${waNumClean ? waNumClean : '55'}?text=${encodeURIComponent(`Olá ${item.name}! Lembramos da sua consulta agendada para ${dFormat} às ${item.time}. Ficamos no aguardo!`)}`;

                    return (
                      <div key={item.id} className="pt-2 flex items-center justify-between text-xs gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-zinc-800 truncate">{item.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                            <span className="flex items-center gap-0.5">
                              <Calendar className="w-3 h-3 text-[#C09553]" />
                              {dFormat}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3 text-[#C09553]" />
                              {item.time}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => {
                              onNewProposalForPatient(item.name);
                              setActiveTab('camera');
                            }}
                            className="bg-[#FAF8F5] text-zinc-700 hover:text-[#8B0000] border border-zinc-200 p-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
                            title="Tirar foto para este paciente"
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                          {item.phone && (
                            <a
                              href={waRemUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[#FAF8F5] text-zinc-600 hover:text-emerald-600 border border-zinc-200 p-1.5 rounded-lg active:scale-95 transition-all text-center inline-flex"
                              title="Enviar convite"
                            >
                              <MessageCircle className="w-3.5 h-3.5 fill-current text-emerald-600" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* CONTAINER TAB 2: Live camera photo capture and evaluation templates */}
        {activeTab === 'camera' && (
          <div className="space-y-6">

            <div className="bg-white border border-[#E6DEC9] rounded-2xl p-4 shadow-sm">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">Filtro de Arcada para Fotos</h3>
              <div className="grid grid-cols-3 gap-1.5 mt-3">
                <button
                  onClick={() => {
                    stopLiveCamera();
                    setActiveCameraSection('upper');
                  }}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider text-center transition-all cursor-pointer ${
                    activeCameraSection === 'upper'
                      ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-xs'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                  }`}
                >
                  Superior
                </button>
                <button
                  onClick={() => {
                    stopLiveCamera();
                    setActiveCameraSection('smile');
                  }}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider text-center transition-all cursor-pointer ${
                    activeCameraSection === 'smile'
                      ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-xs'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                  }`}
                >
                  Anterior
                </button>
                <button
                  onClick={() => {
                    stopLiveCamera();
                    setActiveCameraSection('lower');
                  }}
                  className={`py-2 px-1 text-[10px] font-bold rounded-lg border uppercase tracking-wider text-center transition-all cursor-pointer ${
                    activeCameraSection === 'lower'
                      ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-xs'
                      : 'bg-zinc-50 text-zinc-600 border-zinc-200'
                  }`}
                >
                  Inferior
                </button>
              </div>
            </div>

            {/* LIVE CAMERA OVERVIEW OR SLOT PREVIEW */}
            <div className="relative bg-zinc-900 aspect-video rounded-3xl overflow-hidden border border-[#E6DEC9] shadow-inner flex flex-col justify-center items-center">
              
              {isCameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* HIGH VALUE CUSTOM AUXILIARY CENTER LINES FOR DENTAL ALIGNMENT */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    {/* Elliptical ring representing dental arch outline */}
                    <div className="w-[80%] h-[75%] border-2 border-dashed border-[#FAF8F5]/35 rounded-[50%] flex items-center justify-center shadow-xs">
                      <div className="text-[9px] text-[#FAF8F5]/50 bg-zinc-900/50 px-2 py-0.5 rounded-full font-mono tracking-widest uppercase">
                        Enquadrar Arcada
                      </div>
                    </div>
                    {/* Horizontal center notch */}
                    <div className="absolute left-0 right-0 h-[1px] bg-red-400/25" />
                    {/* Vertical center notch */}
                    <div className="absolute top-0 bottom-0 w-[1px] bg-red-400/25" />
                  </div>

                  {/* Camera overlay tools panel */}
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={handleToggleTorch}
                      className={`w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900/60 shadow-lg text-white border border-[#EAE4D9]/20 transition-all ${torchOn ? 'text-amber-400 bg-zinc-950/95' : 'text-zinc-200'}`}
                      title="Ativar Lanterna Flash"
                    >
                      <Zap className={`w-5 h-5 ${torchOn ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const nextMod = facingMode === 'environment' ? 'user' : 'environment';
                        setFacingMode(nextMod);
                        startLiveCamera(nextMod);
                      }}
                      className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900/60 shadow-lg text-white border border-[#EAE4D9]/20 transition-all"
                      title="Inverter Letes"
                    >
                      <SwitchCamera className="w-5 h-5" />
                    </button>
                  </div>

                  {/* BOTTOM ACTION RAIL */}
                  <div className="absolute bottom-4 left-0 right-0 flex justify-between px-6 items-center">
                    <button
                      type="button"
                      onClick={stopLiveCamera}
                      className="text-xs font-bold text-white bg-zinc-950/60 transition-all border border-zinc-200/20 px-3 py-1.5 rounded-full active:scale-95 cursor-pointer"
                    >
                      Voltar
                    </button>

                    <button
                      type="button"
                      onClick={handleCapturePhoto}
                      className="w-16 h-16 rounded-full border-4 border-white bg-white/45 flex justify-center items-center active:scale-95 transition-all shadow-md cursor-pointer"
                      title="Capturar snap!"
                    >
                      <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
                        <Camera className="w-6 h-6 text-[#8B0000]" />
                      </div>
                    </button>

                    <div className="w-14" /> {/* spacer for symmetry */}
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 bg-zinc-950/30 text-center text-white space-y-3">
                  {(() => {
                    const sec = sections.find(s => s.id === (activeCameraSection === 'smile' ? 'smile' : activeCameraSection));
                    if (sec && sec.image) {
                      return (
                        <>
                          <img src={sec.image} alt="Live snap" className="w-full h-full object-cover absolute inset-0 rounded-2xl" referrerPolicy="no-referrer" />
                          <div className="absolute top-3 left-3 bg-zinc-950/70 border border-[#C09553]/35 text-[#FAF8F5] text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-md">
                            💡 Foto Atual Capturada
                          </div>
                          
                          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2 px-4">
                            <button
                              onClick={() => startLiveCamera()}
                              className="bg-[#8B0000] hover:bg-[#6c1b26] border border-[#C09553] text-[#FAF8F5] text-[11px] font-bold px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              <span>Deletar e Refazer</span>
                            </button>
                            <button
                              onClick={() => handleRemovePhoto(sec.id)}
                              className="bg-zinc-950/90 text-zinc-300 hover:text-rose-400 border border-zinc-700 text-[11px] font-semibold px-3 py-2 rounded-xl flex items-center gap-1.5 shadow-lg active:scale-95 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </>
                      );
                    } else {
                      return (
                        <div className="space-y-4 animate-fade-in">
                          <picture className="w-14 h-14 rounded-full bg-[#8B0000] text-white flex items-center justify-center mx-auto border border-[#C09553]/40 shadow-md">
                            <Camera className="w-6 h-6 text-[#C09553]" />
                          </picture>
                          <div>
                            <p className="text-sm font-semibold uppercase tracking-wider text-[#FAF8F5]">
                              Slot: {activeCameraSection === 'upper' ? 'Arcada Superior' : activeCameraSection === 'lower' ? 'Arcada Inferior' : 'Estética / Anterior'}
                            </p>
                            <p className="text-[10px] text-zinc-300 max-w-xs mt-1">
                              Foque os dentes e aperte abaixo para disparar o obturador ou escolha uma imagem da galeria local.
                            </p>
                          </div>

                          <div className="flex justify-center gap-2 pt-2">
                            <button
                              onClick={() => startLiveCamera()}
                              className="bg-[#8B0000] hover:bg-[#6c1b26] border border-[#C09553] text-white font-bold py-2.5 px-5 text-xs rounded-xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer shadow-md"
                            >
                              <Camera className="w-4 h-4 text-[#C09553]" />
                              <span>Iniciar Câmera</span>
                            </button>
                            <label className="bg-zinc-950 text-zinc-200 border border-zinc-700 font-bold py-2.5 px-4 text-xs rounded-xl flex items-center gap-2 cursor-pointer hover:bg-zinc-800 transition-colors">
                              <Upload className="w-4 h-4" />
                              <span>Arquivo</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
              {/* Dummy absolute hidden canvas for snapping */}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* SYNC TO GOOGLE DRIVE STATUS PANEL */}
            {(() => {
              const secId = activeCameraSection === 'smile' ? 'smile' : activeCameraSection;
              const hasImg = !!sections.find(s => s.id === secId)?.image;
              
              if (hasImg) {
                const isLoading = syncsLoading[secId];
                const isSuccess = syncsSuccess[secId];

                return (
                  <div className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-sm space-y-3 animate-fade-in">
                    <h4 className="text-xs font-bold text-[#8B0000] uppercase tracking-wider flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-[#C09553]" />
                      Sincronização com Prontuário do Paciente
                    </h4>
                    
                    {proposal.patientName ? (
                      <div className="space-y-3">
                        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl text-[11px] leading-relaxed text-zinc-600">
                          Dispositivo pronto para enviar esta captura para a subpasta <b>"Imagens"</b> de <b>{proposal.patientName}</b> no Google Drive.
                        </div>

                        <button
                          onClick={() => handleUploadToDrive(secId)}
                          disabled={isLoading}
                          className="w-full py-3 bg-[#FAF8F5] text-[#8B0000] border-2 border-[#C09553] hover:bg-[#F3EFE9] text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer flex justify-center items-center gap-2"
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Enviando para o Drive...</span>
                            </>
                          ) : isSuccess ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-600" />
                              <span className="text-emerald-700">Enviada com sucesso!</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 text-[#C09553]" />
                              <span>Enviar para a Pasta do Drive</span>
                            </>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 text-xs text-rose-800 space-y-2">
                        <p className="font-bold flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          Paciente Ativo Ausente
                        </p>
                        <p className="leading-relaxed text-[11px]">
                          Para salvar essa foto diretamente no Google Drive do paciente, registre ou selecione ele primeiro na aba <b>"Agendar & Cadastrar"</b>.
                        </p>
                      </div>
                    )}
                  </div>
                );
              }
              return null;
            })()}

            {/* DENTAL ARCH STATUS GRID */}
            <div className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-xs font-bold text-[#8B0000] uppercase tracking-wider pb-2 border-b border-[#FAF8F5]">
                Galeria Clínica Atual do Tratamento
              </h3>
              
              <div className="grid grid-cols-3 gap-3">
                {sections.filter(s => s.id !== 'panoramic').map((sec) => {
                  return (
                    <button
                      key={sec.id}
                      onClick={() => {
                        stopLiveCamera();
                        setActiveCameraSection(sec.id === 'smile' ? 'smile' : sec.id as any);
                      }}
                      className={`relative flex flex-col items-center justify-center aspect-square p-2 border-2 rounded-xl transition-all ${
                        activeCameraSection === (sec.id === 'smile' ? 'smile' : sec.id) 
                          ? 'border-[#C09553] bg-[#FAF8F5]' 
                          : 'border-zinc-200 hover:border-zinc-300'
                      }`}
                    >
                      {sec.image ? (
                        <img src={sec.image} alt={sec.title} className="w-full h-full object-cover rounded-lg absolute inset-0 p-1" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center space-y-1">
                          <ImageIcon className="w-5 h-5 text-zinc-300" />
                          <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest leading-none">Vazio</span>
                        </div>
                      )}
                      
                      <div className="absolute bottom-1 right-1">
                        {sec.image ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-zinc-300" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
