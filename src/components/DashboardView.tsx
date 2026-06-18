import React, { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  MessageSquare, 
  UserPlus, 
  Activity, 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  X, 
  Plus, 
  Settings, 
  Sparkles, 
  Smile, 
  ChevronRight, 
  ChevronLeft,
  ArrowUpRight, 
  Phone, 
  Send,
  Loader2
} from 'lucide-react';
import { motion } from 'motion/react';
import { ClinicSettings, TreatmentProposal } from '../types';
import { listCalendarEvents } from '../lib/calendar';
import { listPatientsFromDrive } from '../lib/drive';
import { addDays, subDays, format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardViewProps {
  clinicSettings: ClinicSettings;
  proposal: TreatmentProposal;
  onNavigateToPlanning: (patientName?: string, status?: string) => void;
  onOpenRegistry: () => void;
  onOpenPatientsList: () => void;
}

// Beautiful simulated mock list of appointments today representing a fully-populated workspace
interface Appointment {
  id: string;
  patientName: string;
  time: string;
  service: string;
  status: 'Confirmado' | 'Pendente' | 'Cancelado' | 'Falta';
  phone: string;
  proposalTotal?: number;
}

interface ReturnControl {
  id: string;
  patientName: string;
  lastVisit: string;
  nextRecallDate: string;
  status: 'Agendado' | 'Lembrete Enviado' | 'Confirmado' | 'Falta Registrada';
  phone: string;
}

export default function DashboardView({
  clinicSettings,
  proposal,
  onNavigateToPlanning,
  onOpenRegistry,
  onOpenPatientsList,
}: DashboardViewProps) {
  
  // Real-time local date details
  const todayDateStr = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Synchronized Appointments and Returns lists from real Drive & Calendar APIs
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [returns, setReturns] = useState<ReturnControl[]>([]);
  const [realPatients, setRealPatients] = useState<any[]>([]);
  const [loadingRealData, setLoadingRealData] = useState(false);
  const [selectedAgendaDate, setSelectedAgendaDate] = useState<Date>(new Date());
  const [loadingAgenda, setLoadingAgenda] = useState(false);

  useEffect(() => {
    const loadRealDashboardData = async () => {
      setLoadingRealData(true);
      
      try {
        // Fetch patients folders list from Google Drive
        const drivePatients = await listPatientsFromDrive();
        
        const { loadPatientFromDrive } = await import('../lib/drive');
        const enriched = await Promise.all((drivePatients || []).map(async (p: any) => {
          let totalVal = parseFloat(p.appProperties?.total || "0");
          
          if (isNaN(totalVal) || totalVal === 0) {
            try {
                const data = await loadPatientFromDrive(p.id);
                if (data?.simulations?.length > 0) {
                  totalVal = data.simulations[data.selectedPlanIndex || 0]?.custoTotal || data.simulations[0]?.custoTotal || 0;
                }
            } catch(e) {
                // Ignore if doesn't resolve
            }
          }
          
          return { ...p, extractedTotal: totalVal };
        }));
        
        setRealPatients(enriched);
      } catch (err) {
        console.warn('Dashboard Patient folders load skipped:', err);
        setRealPatients([]);
      } finally {
        setLoadingRealData(false);
      }
    };

    loadRealDashboardData();
  }, []);

  useEffect(() => {
    const fetchAgenda = async () => {
      setLoadingAgenda(true);
      try {
        // Fetch appointments for selected date from Google Calendar
        const startOfDay = new Date(selectedAgendaDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedAgendaDate);
        endOfDay.setHours(23, 59, 59, 999);

        const calData = await listCalendarEvents(startOfDay, endOfDay);
        if (calData && calData.items) {
          const appts: Appointment[] = calData.items.map((item: any, idx: number) => {
            const startDateTime = item.start.dateTime || item.start.date;
            let timeStr = 'Dia Todo';
            if (item.start.dateTime) {
              const dt = new Date(startDateTime);
              timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            }
            return {
              id: item.id || `c-${idx}`,
              patientName: item.summary || 'Consulta Sem Nome',
              time: timeStr,
              service: item.description || 'Consulta Clínica',
              status: 'Confirmado',
              phone: ''
            };
          });
          setAppointments(appts);
        } else {
          setAppointments([]);
        }
      } catch (err) {
        console.warn('Dashboard Calendar load skipped:', err);
        setAppointments([]);
      } finally {
        setLoadingAgenda(false);
      }
    };

    fetchAgenda();
  }, [selectedAgendaDate]);

  // Stat Indicators derived dynamically with beautiful, real business ratios
  const stats = useMemo(() => {
    let approvedSum = 0;
    let pendingNegotiationSum = 0;
    let convertedTreatments = 0;
    let totalConsults = realPatients.length;

    realPatients.forEach((p) => {
      const status = p.appProperties?.status || 'Em Andamento';
      const amt = p.extractedTotal || 0;

      if (status === 'Concluído' || status === 'Em Andamento') {
        approvedSum += amt;
        convertedTreatments += 1;
      } else if (status === 'Aguardando Aprovação') {
        pendingNegotiationSum += amt;
      }
    });

    let conversionRate = totalConsults > 0 ? Math.round((convertedTreatments / totalConsults) * 100) : 0;

    return {
      approvedSum,
      pendingNegotiationSum,
      totalConsults,
      convertedTreatments,
      conversionRate
    };
  }, [realPatients]);

  // Quick WhatsApp templates for action triggers
  const sendWhatsAppConfirmation = (appt: Appointment) => {
    const message = `Olá, ${appt.patientName}! Gostaríamos de confirmar a sua consulta de *${appt.service}* agendada para hoje às *${appt.time}* com o *${clinicSettings.doctorName}*.\n\n📍 Endereço: ${clinicSettings.address}\n(Ref: ${clinicSettings.referencePoint})\n\nPor favor, responda confirmando sua presença. Ficamos no aguardo!`;
    const cleanPhone = appt.phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    
    // Mark appointment as confirmed on click
    setAppointments(prev => prev.map(a => a.id === appt.id ? { ...a, status: 'Confirmado' } : a));
  };

  const sendWhatsAppRecall = (ret: ReturnControl) => {
    const message = `Olá, ${ret.patientName}! Tudo bem? Passando para lembrá-la(o) que está na hora de realizar a sua consulta clínica de retorno odontológico periódico (limpeza/controle geral).\n\nSua última visita foi em ${ret.lastVisit}. Que tal agendarmos o seu check-up para os próximos dias?\n\nFicamos no aguardo para cuidar do seu sorriso! ✨`;
    const cleanPhone = ret.phone.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    setReturns(prev => prev.map(r => r.id === ret.id ? { ...r, status: 'Lembrete Enviado' } : r));
  };

  const toggleAppointmentStatus = (id: string) => {
    setAppointments(prev => prev.map(a => {
      if (a.id !== id) return a;
      const nextStatusMap: Record<Appointment['status'], Appointment['status']> = {
        'Confirmado': 'Falta',
        'Falta': 'Pendente',
        'Pendente': 'Confirmado',
        'Cancelado': 'Pendente'
      };
      return { ...a, status: nextStatusMap[a.status] };
    }));
  };

  return (
    <div className="space-y-8 font-sans print:hidden">
      
      {/* ================= HERO GREETING BLOCK ================= */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#8B0000] to-[#5C0000] border border-[#C09553]/40 rounded-3xl p-6 sm:p-8 text-[#FAF8F5] shadow-xl">
        {/* Abstract background graphics with branding patterns */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-[#C09553]/10 to-transparent rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-gradient-to-tr from-[#C09553]/5 to-transparent rounded-full blur-2xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#E1CDAC]">
                SISTEMA PREMIUM DE GESTÃO CLÍNICA
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">
              Olá, {clinicSettings.doctorName}
            </h1>
            <p className="text-sm text-[#FAF8F5]/80 max-w-xl font-medium">
              Acompanhe as métricas do dia, os orçamentos em negociação e gerencie o fluxo de retorno periódico para manter a clínica altamente rentável.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            <button
              id="btn-dash-new-planning"
              onClick={onOpenRegistry}
              className="flex items-center justify-center gap-2 bg-[#C09553] hover:bg-[#A97E3B] text-white font-bold text-xs px-5 py-3.5 rounded-xl transition-all shadow-md cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Cadastrar Novo Paciente
            </button>
            <button
              id="btn-dash-patients"
              onClick={onOpenPatientsList}
              className="flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-[#FAF8F5] font-bold text-xs px-5 py-3.5 rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <Users className="w-4 h-4" />
              Biblioteca de Pacientes
            </button>
          </div>
        </div>

        {/* Floating current date indicator */}
        <div className="mt-6 pt-5 border-t border-[#FAF8F5]/10 flex flex-wrap gap-4 items-center justify-between text-xs text-[#FAF8F5]/60 font-mono">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#C09553]" />
            <span className="capitalize font-semibold text-zinc-100">{todayDateStr}</span>
          </div>
          <span className="bg-[#FAF8F5]/5 px-3 py-1 rounded-full border border-white/10 hidden sm:inline">
            Foco Máximo em Conversão de Pacientes: {stats.conversionRate}%
          </span>
        </div>
      </div>

      {/* ================= METRICS METRICS bento grid ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* STAT 1: CONVERSION RATE WITH RADIAL ring */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 transition-shadow hover:shadow-md cursor-default"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Taxa de Conversão</span>
            <span className="text-2xl font-serif font-bold text-[#8B0000] block">{stats.conversionRate}%</span>
            <span className="text-[10.5px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              Meta Recomendada: 75%
            </span>
          </div>
          <div className="relative w-14 h-14 flex items-center justify-center flex-shrink-0">
            {/* Visual SVG Progress Ring */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.915" fill="none" stroke="#F5F1E9" strokeWidth="3" />
              <circle 
                cx="18" 
                cy="18" 
                r="15.915" 
                fill="none" 
                stroke="#C09553" 
                strokeWidth="3.5" 
                strokeDasharray={`${stats.conversionRate} ${100 - stats.conversionRate}`} 
                strokeLinecap="round"
              />
            </svg>
            <Smile className="w-5 h-5 absolute text-[#B48C4D]" />
          </div>
        </motion.div>

        {/* STAT 2: APPROVED BUDGET VOLUME */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 transition-shadow hover:shadow-md cursor-default"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Faturamento Estimado</span>
            <span className="text-2xl font-serif font-bold text-emerald-700 block">
              {stats.approvedSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[10px] text-zinc-400 font-medium tracking-normal block">Contratos fechados este mês</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center flex-shrink-0 shadow-inner">
            <DollarSign className="w-6 h-6" />
          </div>
        </motion.div>

        {/* STAT 3: BUDGETS PENDING NEGOTIATION */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 transition-shadow hover:shadow-md cursor-default"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Orçamentos Pendentes</span>
            <span className="text-2xl font-serif font-bold text-amber-700 block">
              {stats.pendingNegotiationSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
            <span className="text-[10.5px] text-amber-600 font-bold flex items-center gap-0.5">
              <Clock className="w-3.5 h-3.5" /> Aguardando aprovação
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center flex-shrink-0 shadow-inner">
            <FileText className="w-6 h-6" />
          </div>
        </motion.div>

        {/* STAT 4: TOTAL RECALLS / RETORNOS */}
        <motion.div 
          whileHover={{ y: -4 }}
          className="bg-white border border-[#E6DEC9] rounded-2xl p-5 shadow-xs flex items-center justify-between gap-4 transition-shadow hover:shadow-md cursor-default"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Retornos do Mês</span>
            <span className="text-2xl font-serif font-bold text-blue-700 block">
              {returns.length} Pacientes
            </span>
            <span className="text-[10.5px] text-[#8B0000] font-semibold">Prevenção / Recalls agendados</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0 shadow-inner">
            <Activity className="w-6 h-6" />
          </div>
        </motion.div>

      </div>

      {/* ================= WORKFLOW COHESIVE DIAGRAM INDICATOR ================= */}
      <div className="bg-[#FAF8F5] border border-[#E6DEC9] rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-2xs">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#C09553]" />
          <span className="text-xs font-bold text-[#8B0000] uppercase tracking-wide">
            Seu Fluxo de Trabalho Integrado:
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 md:gap-3 text-[10px] sm:text-[11px] font-bold text-zinc-400 overflow-x-auto w-full md:w-auto justify-start md:justify-end py-1">
          <span className="text-[#8B0000] bg-[#8B0000]/5 px-2 py-0.5 rounded border border-[#8B0000]/10">Cadastro</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#C09553]" />
          <span className="text-[#8B0000] bg-[#8B0000]/5 px-2 py-0.5 rounded border border-[#8B0000]/10">Consulta</span>
          <ChevronRight className="w-3.5 h-3.5 text-[#C09553]" />
          <span className="text-zinc-600">Mapeamento</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">Fotos Antes/Depois</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">Negociação</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">WhatsApp</span>
          <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-zinc-600">Retorno</span>
        </div>
      </div>

      {/* ================= ROWS ROW 1: AGENDA vs RETORNOS FIDELIDADE ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMN 1: CLIENT AGENDA OF THE DAY (Left Side) */}
        <div className="lg:col-span-7 bg-white border border-[#E6DEC9] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#B48C4D]" />
              <h3 className="font-serif font-bold text-[#8B0000] text-base leading-none">
                Agenda {isToday(selectedAgendaDate) ? 'do Dia' : format(selectedAgendaDate, "dd 'de' MMM", { locale: ptBR })}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSelectedAgendaDate(subDays(selectedAgendaDate, 1))}
                className="p-1 hover:bg-[#FAF8F5] rounded-lg transition-colors border border-transparent hover:border-[#E6DEC9]"
              >
                <ChevronLeft className="w-4 h-4 text-zinc-500 hover:text-[#8B0000]" />
              </button>
              <button 
                onClick={() => setSelectedAgendaDate(addDays(selectedAgendaDate, 1))}
                className="p-1 hover:bg-[#FAF8F5] rounded-lg transition-colors border border-transparent hover:border-[#E6DEC9]"
              >
                <ChevronRight className="w-4 h-4 text-zinc-500 hover:text-[#8B0000]" />
              </button>
              <span className="text-[10px] font-bold text-rose-800 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-100 uppercase ml-2">
                {appointments.length} Consultas
              </span>
            </div>
          </div>

          <div className="divide-y divide-zinc-100 flex-1 overflow-x-auto">
            <table className="w-full text-left font-sans text-xs min-w-[500px]">
              <thead>
                <tr className="text-zinc-400 uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5">Horário</th>
                  <th className="py-2.5">Paciente</th>
                  <th className="py-2.5">Procedimento / Motivo</th>
                  <th className="py-2.5 text-center">Comparecimento</th>
                  <th className="py-2.5 text-right">A ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loadingAgenda ? (
                  <tr>
                    <td colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Loader2 className="w-8 h-8 text-[#C09553] animate-spin mb-3" />
                        <p className="text-zinc-600 font-semibold mb-1">Carregando agendamentos...</p>
                      </div>
                    </td>
                  </tr>
                ) : appointments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 bg-[#FAF8F5] rounded-full flex items-center justify-center mb-3">
                          <Calendar className="w-6 h-6 text-zinc-300" />
                        </div>
                        <p className="text-zinc-600 font-semibold mb-1">Nenhum agendamento para {isToday(selectedAgendaDate) ? 'hoje' : 'esta data'}</p>
                        <p className="text-zinc-400 text-[11px] max-w-xs">Os eventos do Google Calendar aparecerão automaticamente aqui.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  appointments.map((appt) => {
                    return (
                      <tr key={appt.id} className="hover:bg-[#FAF8F5]/40 transition-all group">
                        {/* Time */}
                        <td className="py-3.5 font-bold font-mono text-[#8B0000] text-sm">
                          {appt.time}
                        </td>
                        
                        {/* Patient detail */}
                        <td className="py-3.5">
                          <div className="font-bold text-zinc-800 uppercase">{appt.patientName}</div>
                          <div className="text-[10px] text-zinc-400 font-mono mt-0.5">{appt.phone}</div>
                        </td>
                        
                        {/* Service detail */}
                        <td className="py-3.5 font-medium text-zinc-600">
                          {appt.service}
                        </td>

                        {/* Comparecimento state toggle */}
                        <td className="py-3.5 text-center">
                          <button
                            onClick={() => toggleAppointmentStatus(appt.id)}
                            className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-bold border cursor-pointer transition-colors shadow-2xs ${
                              appt.status === 'Confirmado'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                : appt.status === 'Falta'
                                ? 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                            }`}
                            title="Clique para alternar o status de comparecimento"
                          >
                            {appt.status}
                          </button>
                        </td>

                        {/* Actions column */}
                        <td className="py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => sendWhatsAppConfirmation(appt)}
                              className="p-1 px-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg border border-green-200 hover:border-green-300 transition-colors flex items-center justify-center"
                              title="Confirmar via WhatsApp"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => onNavigateToPlanning(appt.patientName)}
                              className="px-2.5 py-1 bg-[#8B0000] text-white hover:bg-[#6c1b26] transition-colors font-bold text-[10px] rounded"
                              title="Abrir Planejamento de Tratamento"
                            >
                              Atender
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* NEW REGISTRATION QUICK SHORTCUT MODULE */}
        <div className="lg:col-span-5 bg-[#FAF8F5] border-2 border-dashed border-[#E6DEC9] rounded-2xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <h4 className="font-serif font-bold text-[#8B0000] text-base leading-none">
              Cadastro Rápido & Consulta Inicial
            </h4>
            <p className="text-xs text-zinc-500 leading-relaxed">
              O paciente acabou de chegar no consultório? Inicie o cadastro rápido passo-a-passo e junte fotos iniciais num só clique para abrir o odontograma interativo.
            </p>
          </div>

          <div className="space-y-3.5 pt-2">
            <div className="bg-white border border-zinc-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-[#8B0000]/5 text-[#8B0000] flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <p className="font-bold text-zinc-700">Etapa 1: Cadastro & Documentos</p>
                <p className="text-zinc-500 text-[10.5px]">Identifique documento CPF, convênio ou responsável.</p>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 rounded-xl p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-50 text-[#B48C4D] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <p className="font-bold text-zinc-700">Etapa 2: Mapeamento dos Dentes</p>
                <p className="text-zinc-500 text-[10.5px]">Configure os procedimentos em cada arcada do paciente.</p>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenRegistry}
            className="w-full mt-2 bg-[#8B0000] hover:bg-[#6c1b26] text-white text-xs font-bold py-3.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4 h-4 text-[#C09553]" />
            <span>Preencher Cadastro Inicial</span>
          </button>
        </div>

      </div>

      {/* ================= ROWS ROW 2: PENDING PROPOSALS & NEGOTIATIONS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUMN 2: FIDELIZATION & RETURN RECALL CONTROL (Right Side) */}
        <div className="lg:col-span-5 bg-white border border-[#E6DEC9] rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#B48C4D]" />
              <h3 className="font-serif font-bold text-[#8B0000] text-base leading-none">
                Retorno & Recalls Periódicos
              </h3>
            </div>
            <span className="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase">
              Fidelização
            </span>
          </div>

          <p className="text-[11.5px] text-zinc-500 leading-normal">
            Pacientes que realizaram procedimentos há mais de 6 meses e necessitam de agendamento de retorno preventivo.
          </p>

          <div className="divide-y divide-zinc-100 space-y-3 flex-1">
            {returns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center h-full">
                <div className="w-12 h-12 bg-[#FAF8F5] rounded-full flex items-center justify-center mb-3">
                  <Activity className="w-6 h-6 text-zinc-300" />
                </div>
                <p className="text-zinc-600 font-semibold mb-1 xs">Agenda de Recall em Dia</p>
                <p className="text-zinc-400 text-[11px] max-w-[200px]">Nenhum paciente pendente para retorno de rotina no momento.</p>
              </div>
            ) : (
              returns.map((ret) => {
                return (
                  <div key={ret.id} className="pt-3 first:pt-0 flex justify-between items-start gap-4 text-xs font-sans">
                    <div className="space-y-0.5">
                      <div className="font-bold text-zinc-800 uppercase text-xs truncate max-w-[200px]">
                        {ret.patientName}
                      </div>
                      <div className="text-[10px] text-zinc-400 font-mono">
                        Última Visita: <strong className="text-zinc-600">{ret.lastVisit}</strong>
                      </div>
                      <div className="text-[10px] font-semibold text-[#B48C4D]">
                        Retorno Previsto: {ret.nextRecallDate}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                        ret.status === 'Confirmado' 
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                          : ret.status === 'Falta Registrada' 
                          ? 'bg-red-50 text-[#8B0000] border-red-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}>
                        {ret.status}
                      </span>
                      
                      <button
                        onClick={() => sendWhatsAppRecall(ret)}
                        className="mt-1 flex items-center gap-1 px-2.5 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                      >
                        <Send className="w-2.5 h-2.5" />
                        <span>Lembrar WhatsApp</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ACTIVE NEGOTIATIONS SECTION */}
        <div className="lg:col-span-7 bg-white border border-[#E6DEC9] rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#B48C4D]" />
              <h3 className="font-serif font-bold text-[#8B0000] text-base leading-none">
                Negociações de Orçamento Ativas
              </h3>
            </div>
            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 rounded-full uppercase font-semibold">
              Pendentes
            </span>
          </div>

          <div className="space-y-3.5 divide-y divide-zinc-100">
            {loadingRealData ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-[#B48C4D]" />
                <span className="font-semibold text-zinc-600">Sincronizando...</span>
                <span className="text-[10px] text-zinc-400">Puxando dados do Google Drive</span>
              </div>
            ) : realPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-[#FAF8F5] rounded-full flex items-center justify-center mb-3">
                  <FileText className="w-6 h-6 text-zinc-300" />
                </div>
                <p className="text-zinc-600 font-semibold mb-1 text-sm">Nenhum orçamento encontrado</p>
                <p className="text-zinc-400 text-[11px] max-w-sm">Os orçamentos salvos aparecerão aqui. Clique em "Preencher Cadastro Inicial" para começar.</p>
              </div>
            ) : (
              realPatients.slice(0, 5).map((patient) => {
                const status = patient.appProperties?.status || 'Em Andamento';
                const statusColors: Record<string, string> = {
                  'Concluído': 'bg-green-500',
                  'Aguardando Aprovação': 'bg-amber-500',
                  'Arquivado': 'bg-zinc-500',
                  'Em Andamento': 'bg-blue-500',
                };
                const color = statusColors[status] || 'bg-blue-500';

                return (
                  <div key={patient.id} className="pt-3.5 first:pt-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs font-sans">
                    <div className="space-y-0.5">
                      <div className="font-bold text-zinc-800 uppercase flex items-center gap-1.5">
                        {patient.name}
                        <span className={`w-1.5 h-1.5 rounded-full ${color} shadow-sm`} />
                      </div>
                      <div className="text-[10.5px] text-zinc-500 leading-normal font-medium">
                        Etapa Atual: <strong className="text-zinc-700">{status}</strong>
                      </div>
                      {patient.createdTime && (
                        <div className="text-[10px] text-zinc-400 font-mono">
                          Criado em: {new Date(patient.createdTime).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 justify-between sm:justify-end">
                      <div className="text-right">
                        <p className="text-[10px] text-zinc-400 font-bold uppercase">VALOR LÍQUIDO</p>
                        <p className="font-bold text-[#8B0000] text-sm font-mono leading-none">
                          {patient.extractedTotal ? patient.extractedTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}
                        </p>
                      </div>
                      <button
                        onClick={() => onNavigateToPlanning(patient.name, status)}
                        className="p-2 border border-zinc-200 hover:border-[#8B0000] rounded-xl hover:bg-[#FAF8F5] transition-all flex items-center gap-1 text-[10.5px] text-[#8B0000] font-bold"
                      >
                        Abrir Orçamento
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
