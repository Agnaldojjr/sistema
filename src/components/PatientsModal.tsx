import React, { useState, useEffect, useRef } from 'react';
import { X, Search, FileText, Loader2, CalendarPlus, FolderOpen, ChevronLeft, ImageIcon, MessageCircle, Phone, Trash2, ShieldAlert, Pencil, Check, User, Camera, Upload, RefreshCw } from 'lucide-react';
import { listPatientsFromDrive, loadPatientFromDrive, listPatientImagesFromDrive, deletePatientFolderFromDrive, deleteDummyPatientsFromDrive, listPatientProposalsFromDrive, renameFileInDrive, uploadPatientImageToDrive, deleteFileFromDrive } from '../lib/drive';
import { ClinicSettings } from '../types';

function dataURLtoBlob(dataUrl: string) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

function formatBRL(val: number | string) {
  const num = typeof val === 'number' ? val : parseFloat(val) || 0;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(num);
}

interface PatientsModalProps {
  onClose: () => void;
  onLoadPatient: (data: any) => void;
  onNewAppointment: (patientName: string) => void;
  clinicSettings: ClinicSettings;
  onNewProposal: (patientName: string) => void;
}

export default function PatientsModal({ onClose, onLoadPatient, onNewAppointment, clinicSettings, onNewProposal }: PatientsModalProps) {
  const [patients, setPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Todos');
  
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [patientToDelete, setPatientToDelete] = useState<any | null>(null);
  const [isCleaningDummies, setIsCleaningDummies] = useState(false);
  const [patientImages, setPatientImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loadingProposals, setLoadingProposals] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');

  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [editingProposalName, setEditingProposalName] = useState<string>('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [patientTab, setPatientTab] = useState<'perfil' | 'tratamentos' | 'galeria'>('tratamentos');

  const [confirmDeleteProposalId, setConfirmDeleteProposalId] = useState<string | null>(null);
  const [confirmDeleteImageId, setConfirmDeleteImageId] = useState<string | null>(null);
  const [isDeletingImage, setIsDeletingImage] = useState(false);

  // Camera states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const startCamera = async (mode = facingMode) => {
    setCameraError(null);
    setIsCameraActive(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
        activeStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        console.error(err);
        setCameraError('Não foi possível acessar a câmera do aparelho. Verifique as permissões de câmera.');
      }
    }, 100);
  };

  const stopCamera = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach(t => t.stop());
      activeStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    if (isCameraActive) {
      stopCamera();
      startCamera(newMode);
    }
  };

  const handleCapturePhoto = async () => {
    if (videoRef.current && canvasRef.current && selectedPatient) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
          stopCamera();
          
          try {
            setIsUploading(true);
            const blob = dataURLtoBlob(dataUrl);
            const filename = `foto-${new Date().getTime()}.jpg`;
            await uploadPatientImageToDrive(selectedPatient.id, blob, filename);
            
            // Refresh patient images list
            const updatedImages = await listPatientImagesFromDrive(selectedPatient.id);
            setPatientImages(updatedImages);
          } catch (err: any) {
            alert('Erro ao enviar foto para o Google Drive: ' + err.message);
          } finally {
            setIsUploading(false);
          }
        }
      }
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !selectedPatient) return;
    const file = files[0];
    
    try {
      setIsUploading(true);
      await uploadPatientImageToDrive(selectedPatient.id, file, file.name);
      
      // Refresh patient images list
      const updatedImages = await listPatientImagesFromDrive(selectedPatient.id);
      setPatientImages(updatedImages);
    } catch (err: any) {
      alert('Erro ao fazer upload da imagem: ' + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleStartRename = (prop: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProposalId(prop.id);
    setEditingProposalName(prop.name.replace('.json', ''));
  };

  const handleRenameProposal = async (proposalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingProposalName.trim()) return;
    try {
      setRenamingId(proposalId);
      await renameFileInDrive(proposalId, editingProposalName.trim());
      setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          const finalName = editingProposalName.trim();
          return { ...p, name: finalName.endsWith('.json') ? finalName : finalName + '.json' };
        }
        return p;
      }));
      setEditingProposalId(null);
    } catch (err: any) {
      alert('Erro ao renomear orçamento: ' + err.message);
    } finally {
      setRenamingId(null);
    }
  };

  const handleDeleteProposal = async (proposalId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoadingId(proposalId);
      await deleteFileFromDrive(proposalId);
      setProposals(prev => prev.filter(p => p.id !== proposalId));
      setConfirmDeleteProposalId(null);
    } catch (err: any) {
      alert('Erro ao excluir orçamento: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDeleteImage = async (imageId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      setIsDeletingImage(true);
      await deleteFileFromDrive(imageId);
      setPatientImages(prev => prev.filter(img => img.id !== imageId));
      setConfirmDeleteImageId(null);
    } catch (err: any) {
      alert('Erro ao excluir imagem: ' + err.message);
    } finally {
      setIsDeletingImage(false);
    }
  };


  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        setError(null);
        let data = await listPatientsFromDrive();
        setPatients(data);
      } catch (err: any) {
        console.error('List errors', err);
        setError(err.message || 'Falha ao carregar pacientes');
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, []);

  useEffect(() => {
    stopCamera();
    if (selectedPatient) {
      setWhatsappMessage(`Olá, ${selectedPatient.name}. Gostaríamos de confirmar sua próxima consulta com ${clinicSettings.doctorName} às [HORÁRIO].\n\n📍 Nosso endereço é: ${clinicSettings.address}.\n(Ref: ${clinicSettings.referencePoint})\n\nPor favor, confirme sua presença respondendo esta mensagem. Qualquer dúvida, estamos à disposição.`);
      
      setLoadingImages(true);
      listPatientImagesFromDrive(selectedPatient.id)
        .then(data => setPatientImages(data))
        .catch(err => console.error("Error loading images", err))
        .finally(() => setLoadingImages(false));

      setLoadingProposals(true);
      listPatientProposalsFromDrive(selectedPatient.id)
        .then(data => setProposals(data))
        .catch(err => console.error("Error loading proposals", err))
        .finally(() => setLoadingProposals(false));
    } else {
      setPatientImages([]);
      setProposals([]);
    }
  }, [selectedPatient]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleLoad = async (folderId: string, fileId?: string) => {
    try {
      setLoadingId(fileId || folderId);
      setError(null);
      const data = await loadPatientFromDrive(folderId, fileId);
      onLoadPatient(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao carregar arquivo de orçamento');
      setLoadingId(null);
    }
  };

  const handleDeletePatient = async (patient: any) => {
    try {
      setDeletingId(patient.id);
      setError(null);
      await deletePatientFolderFromDrive(patient.id);
      
      // Remove from state list
      setPatients(prev => prev.filter(p => p.id !== patient.id));
      
      // Close detail view if currently open
      setSelectedPatient(null);
      setPatientToDelete(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao excluir paciente do Google Drive');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCleanDummies = async () => {
    if (!window.confirm("Isso irá apagar todos os cadastros no Drive cujos nomes contenham 'exemplo', 'teste' ou 'fictício'. Continuar?")) return;
    
    try {
      setIsCleaningDummies(true);
      setError(null);
      const deletedCount = await deleteDummyPatientsFromDrive();
      
      if (deletedCount > 0) {
        alert(`O processo foi concluído. ${deletedCount} pacientes fictícios foram excluídos.`);
        // Refresh list
        let data = await listPatientsFromDrive();
        setPatients(data);
      } else {
        alert('Nenhum paciente fictício encontrado para exclusão.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao limpar pacientes fictícios');
    } finally {
      setIsCleaningDummies(false);
    }
  };

  const filteredPatients = patients.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || (p.appProperties?.status || 'Aberto (paciente não pagou)') === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'Aprovado (paciente pagou)': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Aberto (paciente não pagou)': return 'bg-rose-100 text-rose-800 border-rose-200';
      case 'Concluído': return 'bg-green-100 text-green-800 border-green-200';
      case 'Aguardando Aprovação': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Arquivado': return 'bg-zinc-100 text-zinc-600 border-zinc-200';
      case 'Em Andamento':
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col min-h-[400px] max-h-[85vh] relative">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 relative">
          {selectedPatient ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setSelectedPatient(null)} className="p-2 -ml-2 text-zinc-400 hover:text-[#4E1119] hover:bg-zinc-100 rounded-full transition-colors mr-2">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-[#4E1119] font-serif uppercase tracking-tight">{selectedPatient.name}</h2>
                <p className="text-xs text-zinc-500 font-sans mt-0.5">Perfil do Paciente e Opções</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#E6DEC9] flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#B48C4D]" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[#4E1119] font-serif">Biblioteca de Pacientes</h2>
                <p className="text-xs text-zinc-500 font-sans">Busque e gerencie o perfil de seus pacientes</p>
              </div>
            </div>
          )}
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {selectedPatient ? (
          /* Patient Profile Details View with Sub-tabs */
          <>
            <div className="flex border-b border-zinc-200 bg-white px-5 select-none font-sans flex-shrink-0">
              <button
                type="button"
                onClick={() => setPatientTab('perfil')}
                className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  patientTab === 'perfil'
                    ? 'border-[#4E1119] text-[#4E1119]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700'
                }`}
              >
                <User className="w-4 h-4" />
                <span>Perfil</span>
              </button>
              <button
                type="button"
                onClick={() => setPatientTab('tratamentos')}
                className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  patientTab === 'tratamentos'
                    ? 'border-[#4E1119] text-[#4E1119]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Tratamentos</span>
              </button>
              <button
                type="button"
                onClick={() => setPatientTab('galeria')}
                className={`flex items-center gap-2 py-3 px-3 sm:px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                  patientTab === 'galeria'
                    ? 'border-[#4E1119] text-[#4E1119]'
                    : 'border-transparent text-zinc-400 hover:text-zinc-700'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Galeria</span>
              </button>
            </div>

            <div className="flex-1 p-6 bg-zinc-50 overflow-y-auto">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-4 border border-red-100">
                  {error}
                </div>
              )}
              
              {patientTab === 'perfil' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={() => onNewProposal(selectedPatient.name)}
                      className="flex items-start gap-4 p-5 bg-[#C09553]/10 border border-[#C09553] hover:bg-[#C09553]/20 hover:shadow-md rounded-2xl transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-white border border-[#C09553] flex items-center justify-center flex-shrink-0">
                         <FileText className="w-5 h-5 text-[#C09553]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-[#4E1119] text-sm">Cadastrar Novo Orçamento</h3>
                        <p className="text-xs text-zinc-600 mt-1 leading-relaxed">Iniciar um novo orçamento/prontuário do zero para este paciente.</p>
                      </div>
                    </button>
                    
                    <button 
                      onClick={() => onNewAppointment(selectedPatient.name)}
                      className="flex items-start gap-4 p-5 bg-white border border-zinc-200 hover:border-[#4E1119] hover:shadow-md rounded-2xl transition-all text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                         <CalendarPlus className="w-5 h-5 text-[#4E1119]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-800 text-sm">Agendar Consulta</h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Criar novo evento na agenda Google para este paciente.</p>
                      </div>
                    </button>
                    
                    <a 
                      href={selectedPatient.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-4 p-5 bg-[#FAF8F5]/35 border border-[#E6DEC9] hover:border-[#C09553] hover:shadow-md rounded-2xl transition-all text-left col-span-1"
                    >
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                         <FolderOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-bold text-zinc-800 text-sm">Pasta na Nuvem (Drive)</h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Abrir o diretório exclusivo do paciente no Google Drive.</p>
                      </div>
                    </a>

                    <button 
                      onClick={() => setPatientToDelete(selectedPatient)}
                      className="flex items-start gap-4 p-5 bg-white border border-red-200 hover:border-red-600 hover:shadow-md hover:bg-red-50/10 rounded-2xl transition-all text-left col-span-1"
                    >
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-red-600">
                         <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-red-800 text-sm">Excluir Cadastro</h3>
                        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">Remover permanentemente a pasta do paciente no Google Drive.</p>
                      </div>
                    </button>
                  </div>

                  {/* WhatsApp Reminder section */}
                  <div className="mt-8 border-t border-zinc-100 pt-6">
                    <h3 className="font-bold text-[#4E1119] font-serif text-lg mb-4 flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-green-600" />
                      Lembrete WhatsApp
                    </h3>
                    <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                           <label className="text-xs font-bold text-zinc-500 uppercase">Número (opcional)</label>
                           <div className="relative">
                             <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                             <input
                               type="text"
                               placeholder="Ex: 5511999999999"
                               value={whatsappNumber}
                               onChange={(e) => setWhatsappNumber(e.target.value)}
                               className="w-full pl-9 pr-3 py-2 rounded-xl border border-zinc-300 focus:border-green-500 focus:ring focus:ring-green-500/20 text-sm"
                             />
                           </div>
                           <p className="text-[10px] text-zinc-400">Com DDD. Se vazio, você pode escolher o contato no app.</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                         <label className="text-xs font-bold text-zinc-500 uppercase">Mensagem</label>
                         <textarea
                           value={whatsappMessage}
                           onChange={(e) => setWhatsappMessage(e.target.value)}
                           className="w-full p-3 rounded-xl border border-zinc-300 focus:border-green-500 focus:ring focus:ring-green-500/20 text-sm min-h-[120px]"
                         />
                      </div>
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            const cleanNumber = whatsappNumber.replace(/\D/g, '');
                            const encodedMessage = encodeURIComponent(whatsappMessage);
                            const url = cleanNumber ? `https://wa.me/${cleanNumber}?text=${encodedMessage}` : `https://wa.me/?text=${encodedMessage}`;
                            window.open(url, '_blank');
                          }}
                          className="w-full sm:w-auto px-6 py-2.5 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="w-5 h-5" />
                          Enviar Mensagem
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {patientTab === 'tratamentos' && (
                <div className="space-y-6">
                  {/* Option to Open Last Budget directly */}
                  <button 
                    disabled={loadingId === selectedPatient.id || (proposals.length === 0 && !loadingProposals)}
                    onClick={() => handleLoad(selectedPatient.id)}
                    className="flex items-start gap-4 p-5 bg-[#4E1119] hover:bg-[#6c1b26] rounded-2xl transition-all text-left shadow-md disabled:opacity-50 disabled:cursor-not-allowed w-full"
                  >
                    <div className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 font-sans">
                       {loadingId === selectedPatient.id || loadingProposals ? <Loader2 className="w-5 h-5 animate-spin text-[#C09553]" /> : <FileText className="w-5 h-5 text-white" />}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm">Abrir Último Orçamento</h3>
                      <p className="text-xs text-zinc-300 mt-1 leading-relaxed">
                        {loadingProposals ? "Verificando..." : proposals.length > 0 ? "Carregar o orçamento mais recente salvo e continuar a edição." : "Nenhum orçamento salvo."}
                      </p>
                    </div>
                  </button>

                  {/* Cataloged Budgets list */}
                  <div className="mt-8 border-t border-zinc-100 pt-6">
                    <h3 className="font-bold text-[#4E1119] font-serif text-lg mb-4 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#B48C4D]" />
                      Histórico de Orçamentos
                    </h3>
                    {loadingProposals ? (
                      <div className="flex justify-center p-8">
                        <Loader2 className="w-6 h-6 animate-spin text-[#C09553]" />
                      </div>
                    ) : proposals.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center p-8 bg-zinc-100/50 rounded-xl border border-dashed border-zinc-200">
                        Nenhum orçamento salvo para este paciente.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {proposals.map(prop => (
                          <div key={prop.id} className="relative">
                            {editingProposalId === prop.id ? (
                              <div className="flex items-center gap-2 p-4 bg-zinc-50 border border-zinc-300 rounded-xl w-full" onClick={(e) => e.stopPropagation()}>
                                <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#E6DEC9] flex items-center justify-center flex-shrink-0">
                                  {renamingId === prop.id ? <Loader2 className="w-5 h-5 animate-spin text-[#B48C4D]" /> : <FileText className="w-5 h-5 text-[#B48C4D]" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <input
                                    type="text"
                                    className="w-full px-3 py-1.5 text-sm border border-zinc-300 rounded-xl focus:border-[#C09553] focus:outline-none"
                                    value={editingProposalName}
                                    onChange={(e) => setEditingProposalName(e.target.value)}
                                    disabled={renamingId === prop.id}
                                    autoFocus
                                  />
                                </div>
                                <button
                                  onClick={(e) => handleRenameProposal(prop.id, e)}
                                  disabled={renamingId === prop.id || !editingProposalName.trim()}
                                  className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                  title="Salvar nome"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProposalId(null);
                                  }}
                                  disabled={renamingId === prop.id}
                                  className="p-2 bg-zinc-200 hover:bg-zinc-300 text-zinc-600 rounded-lg transition-colors cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  if (loadingId !== prop.id) {
                                    handleLoad(selectedPatient.id, prop.id);
                                  }
                                }}
                                className={`flex items-center justify-between p-4 bg-white border border-zinc-200 hover:border-[#C09553] rounded-xl transition-all text-left group w-full cursor-pointer ${
                                  loadingId === prop.id ? 'opacity-50 pointer-events-none' : ''
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-[#FAF8F5] border border-[#E6DEC9] flex items-center justify-center flex-shrink-0">
                                    {loadingId === prop.id ? <Loader2 className="w-5 h-5 animate-spin text-[#B48C4D]" /> : <FileText className="w-5 h-5 text-[#B48C4D]" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-bold text-zinc-800">{prop.name.replace('.json', '')}</p>
                                      
                                      {/* Status Badge */}
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(prop.appProperties?.status || 'Aberto (paciente não pagou)')}`}>
                                        <span className={`w-1 h-1 rounded-full ${
                                          (prop.appProperties?.status === 'Aprovado (paciente pagou)' || prop.appProperties?.status === 'Concluído') ? 'bg-emerald-500' :
                                          (prop.appProperties?.status === 'Aberto (paciente não pagou)' || !prop.appProperties?.status) ? 'bg-rose-500' :
                                          (prop.appProperties?.status === 'Aguardando Aprovação') ? 'bg-orange-500' :
                                          (prop.appProperties?.status === 'Em Andamento') ? 'bg-blue-500' : 'bg-zinc-400'
                                        }`} />
                                        {prop.appProperties?.status || 'Aberto'}
                                      </span>

                                      {/* Total Price if present */}
                                      {prop.appProperties?.total && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-zinc-50 text-zinc-700 border border-zinc-200">
                                          {formatBRL(prop.appProperties.total)}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">Última alteração: {new Date(prop.modifiedTime).toLocaleDateString('pt-BR')} às {new Date(prop.modifiedTime).toLocaleTimeString('pt-BR')}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                  {confirmDeleteProposalId === prop.id ? (
                                    <div className="flex items-center gap-1 bg-red-50 border border-red-200/60 p-1 rounded-xl">
                                      <span className="text-[10px] font-bold text-red-700 px-1.5">Excluir?</span>
                                      <button
                                        onClick={(e) => handleDeleteProposal(prop.id, e)}
                                        className="px-2 py-1 bg-red-600 text-white font-bold rounded-lg text-[10px] hover:bg-red-700 transition-colors cursor-pointer"
                                      >
                                        Sim
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteProposalId(null);
                                        }}
                                        className="px-2 py-1 bg-zinc-200 text-zinc-700 font-bold rounded-lg text-[10px] hover:bg-zinc-300 transition-colors cursor-pointer"
                                      >
                                        Não
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <button
                                        onClick={(e) => handleStartRename(prop, e)}
                                        className="p-1.5 hover:bg-zinc-100 text-zinc-400 hover:text-[#C09553] rounded-lg transition-colors cursor-pointer"
                                        title="Editar nome"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setConfirmDeleteProposalId(prop.id);
                                        }}
                                        className="p-1.5 hover:bg-red-50 text-zinc-400 hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                                        title="Excluir orçamento"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                      <span 
                                        onClick={() => handleLoad(selectedPatient.id, prop.id)}
                                        className="text-xs font-bold text-[#C09553] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pl-1.5"
                                      >
                                        Abrir Orçamento →
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {patientTab === 'galeria' && (
                <div className="space-y-6 animate-fadeIn">
                  {/* Hidden Canvas used for taking photo */}
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Timeline Gallery Header and Actions */}
                  <div className="border-b border-zinc-100 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-[#4E1119] font-serif text-lg mb-2 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-[#B48C4D]" />
                        Linha do Tempo
                      </h3>
                      <p className="text-xs text-zinc-500">Fotos diagnósticas e clínicas anexadas a este paciente.</p>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (isCameraActive) {
                            stopCamera();
                          } else {
                            startCamera();
                          }
                        }}
                        disabled={isUploading}
                        className={`px-4 py-2 bg-[#4E1119] text-white font-bold rounded-xl text-xs hover:bg-[#6c1b26] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50`}
                      >
                        <Camera className="w-4 h-4 text-[#C09553]" />
                        Tirar Foto
                      </button>

                      <label className={`px-4 py-2 bg-[#C09553] text-white font-bold rounded-xl text-xs hover:bg-[#b58b4a] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Upload className="w-4 h-4 text-[#4E1119]" />
                        Upload Foto
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleUploadFile}
                          disabled={isUploading}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Camera Viewport Section */}
                  {isCameraActive && (
                    <div className="bg-zinc-950 p-4 rounded-2xl relative shadow-inner flex flex-col items-center">
                      <div className="relative w-full max-w-md aspect-[4/3] bg-zinc-900 rounded-xl overflow-hidden flex items-center justify-center border border-zinc-800">
                        {cameraError ? (
                          <p className="text-red-400 text-xs text-center p-6">{cameraError}</p>
                        ) : (
                          <video
                            ref={videoRef}
                            className="w-full h-full object-cover"
                            playsInline
                            muted
                          />
                        )}
                        
                        <div className="absolute top-3 left-3 bg-zinc-900/80 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] text-zinc-400 font-mono tracking-wider uppercase flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          Modo Câmera ({facingMode === 'environment' ? 'Traseira' : 'Frontal'})
                        </div>
                      </div>

                      {/* Camera Controls */}
                      <div className="flex items-center justify-center gap-4 mt-4 w-full">
                        <button
                          onClick={stopCamera}
                          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl text-xs transition-all cursor-pointer"
                        >
                          Cancelar
                        </button>
                        
                        {!cameraError && (
                          <button
                            onClick={handleCapturePhoto}
                            className="w-12 h-12 bg-red-600 hover:bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:shadow-red-500/20 active:scale-95 transition-all text-white border-4 border-white cursor-pointer"
                            title="Tirar Foto"
                          >
                            <span className="sr-only">Capturar</span>
                          </button>
                        )}

                        <button
                          onClick={switchCamera}
                          className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all cursor-pointer"
                          title="Alternar Câmera"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Uploading loading state */}
                  {isUploading && (
                    <div className="bg-zinc-100 border border-zinc-200/60 p-4 rounded-xl flex items-center justify-center gap-3 animate-pulse">
                      <Loader2 className="w-5 h-5 animate-spin text-[#C09553]" />
                      <span className="text-xs text-zinc-700 font-medium">Sincronizando imagem com o Google Drive, por favor aguarde...</span>
                    </div>
                  )}

                  {/* Gallery Grid */}
                  {loadingImages ? (
                    <div className="flex justify-center p-8">
                      <Loader2 className="w-6 h-6 animate-spin text-[#C09553]" />
                    </div>
                  ) : patientImages.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center p-8 bg-zinc-100/50 rounded-xl border border-dashed border-zinc-200">
                      Nenhuma imagem foi sincronizada no Google Drive deste paciente ainda.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {patientImages.map(img => (
                        <div key={img.id} className="block group relative">
                          <a href={img.webViewLink} target="_blank" rel="noreferrer" className="block focus:outline-none">
                            <div className="aspect-square bg-zinc-200 rounded-xl overflow-hidden relative border border-zinc-200">
                              {img.thumbnailLink ? (
                                <img src={img.thumbnailLink} alt={img.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="flex items-center justify-center h-full w-full bg-zinc-100 text-zinc-400">
                                  Sem miniatura
                                </div>
                              )}
                            </div>
                            <div className="mt-2 text-center">
                              <p className="text-[11px] font-bold text-zinc-800 truncate px-1">{img.name}</p>
                              <p className="text-[10px] text-zinc-500">{new Date(img.createdTime).toLocaleDateString('pt-BR')}</p>
                            </div>
                          </a>

                          {/* Delete Photo Button Overlay */}
                          <div className="absolute top-2 right-2 z-10">
                            {confirmDeleteImageId === img.id ? (
                              <div className="bg-red-600/95 backdrop-blur-md text-white border border-red-500 rounded-xl p-1.5 flex flex-col items-center gap-1 shadow-lg animate-fadeIn text-[10px] font-bold max-w-[100px]">
                                <span className="text-center text-[10px] text-white">Excluir foto?</span>
                                <div className="flex gap-1 justify-center w-full">
                                  <button
                                    onClick={(e) => handleDeleteImage(img.id, e)}
                                    disabled={isDeletingImage}
                                    className="px-2 py-0.5 bg-white text-red-600 rounded font-black hover:bg-zinc-100 transition-all text-[9.5px] cursor-pointer"
                                  >
                                    Sim
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      setConfirmDeleteImageId(null);
                                    }}
                                    className="px-2 py-0.5 bg-red-800 text-white rounded font-black hover:bg-red-900 transition-all text-[9.5px] cursor-pointer"
                                  >
                                    Não
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  setConfirmDeleteImageId(img.id);
                                }}
                                className="w-8 h-8 rounded-xl bg-white/95 text-zinc-400 hover:text-red-500 flex items-center justify-center shadow-md transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 cursor-pointer border border-zinc-200/80"
                                title="Excluir imagem"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          /* List View */
          <>
            {/* Search */}
            <div className="p-4 border-b border-zinc-100 bg-[#FAF8F5] space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Buscar paciente pelo nome..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 transition-colors text-sm font-sans"
                  />
                </div>
                <button
                  onClick={handleCleanDummies}
                  disabled={isCleaningDummies}
                  className="px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 flex-shrink-0 disabled:opacity-50"
                  title="Remove do Drive todos os pacientes de teste"
                >
                  {isCleaningDummies ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                  Limpar Fictícios
                </button>
              </div>

              <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
                {['Todos', 'Aberto (paciente não pagou)', 'Aprovado (paciente pagou)', 'Em Andamento', 'Aguardando Aprovação', 'Concluído', 'Arquivado'].map(status => (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      statusFilter === status 
                        ? 'bg-[#4E1119] text-white' 
                        : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-zinc-50">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm mb-4 border border-red-100">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-4">
                  <Loader2 className="w-8 h-8 animate-spin text-[#C09553]" />
                  <p className="text-sm">Buscando pastas no Drive...</p>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="text-center py-12 text-zinc-500">
                  <p className="text-sm">Nenhum paciente encontrado. Novos pacientes serão exibidos aqui ao salvar ou carregar seus primeiros planejamentos.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="bg-white border border-zinc-200 rounded-xl p-4 flex items-center justify-between hover:border-[#C09553] hover:shadow-md transition-all group cursor-pointer"
                      onClick={() => setSelectedPatient(patient)}
                    >
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                           <span className="font-bold text-zinc-800 font-sans">{patient.name}</span>
                           <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getStatusColor(patient.appProperties?.status)}`}>
                             {patient.appProperties?.status || 'Aberto (paciente não pagou)'}
                           </span>
                        </div>
                        {patient.createdTime && (
                          <span className="text-xs text-zinc-500 font-sans mt-0.5">
                            Adicionado em: {new Date(patient.createdTime).toLocaleDateString('pt-BR')}  {new Date(patient.createdTime).toLocaleTimeString('pt-BR')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setSelectedPatient(patient)}
                          className="px-4 py-2 bg-[#FAF8F5] text-[#4E1119] text-xs font-bold rounded-lg border border-[#E6DEC9] hover:bg-[#4E1119] hover:text-[#FAF8F5] transition-colors flex items-center gap-1.5"
                        >
                          Ver Perfil
                        </button>
                        <button
                          onClick={() => setPatientToDelete(patient)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-all"
                          title="Excluir paciente"
                        >
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Deletion Confirmation Modal Overlay */}
        {patientToDelete && (
          <div className="absolute inset-0 z-[60] bg-zinc-950/80 backdrop-blur-xs flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white rounded-2xl border border-zinc-100 shadow-2xl max-w-sm w-full p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto text-red-600">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-lg text-[#4E1119]">Confirmar Exclusão</h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Deseja mesmo excluir o cadastro de <strong className="text-zinc-800">{patientToDelete.name}</strong>?
                </p>
                <p className="text-[11px] text-red-600 font-semibold bg-red-50 p-2.5 rounded-lg mt-2">
                  Atenção: Isso deletará permanentemente a pasta do paciente no Google Drive, incluindo todas as fotos, documentos e orçamentos associados!
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPatientToDelete(null)}
                  disabled={deletingId !== null}
                  className="flex-1 py-2 bg-zinc-100 border border-zinc-200 text-zinc-700 text-xs font-bold rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDeletePatient(patientToDelete)}
                  disabled={deletingId !== null}
                  className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {deletingId ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      Sim, Excluir
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
