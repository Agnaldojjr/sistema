/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  ClipboardEdit,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Layers,
  BookOpen,
  Coins,
  User as UserIcon,
  ExternalLink,
  Smartphone,
  Monitor,
} from 'lucide-react';
import ProcedureManager from './components/ProcedureManager';
import PhotoEditor from './components/PhotoEditor';
import NegotiationTab from './components/NegotiationTab';
import PatientScreen from './components/PatientScreen';
import PatientsModal from './components/PatientsModal';
import CalendarView from './components/CalendarView';
import PatientRegistrationTab from './components/PatientRegistrationTab';
import PatientDocumentsTab from './components/PatientDocumentsTab';
import DashboardView from './components/DashboardView';
import ClinicalAttendanceManager from './components/ClinicalAttendanceManager';
import MobileWorkspace from './components/MobileWorkspace';
import DentalCRMView from './components/DentalCRMView';
import { PhotoSection, Procedure, TreatmentProposal, ClinicSettings } from './types';
import { DEFAULT_PROCEDURES, DEMO_SVG_PLACEHOLDERS, DEFAULT_CLINIC_SETTINGS } from './constants';
import { initAuth, googleSignIn, logout } from './firebase';
import { saveTreatmentPlanToDrive } from './lib/drive';
import type { User } from 'firebase/auth';

// ─── Logo SVG (AF Monogram matching the brand identity) ─────────────────────
const AFLogoSVG = ({ className = '', light = false }: { className?: string; light?: boolean }) => (
  <svg viewBox="0 0 120 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* A letter - left stroke */}
    <path d="M 28 88 L 48 30" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    {/* A letter - right stroke */}
    <path d="M 48 30 L 68 88" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    {/* A crossbar */}
    <path d="M 36 62 L 60 62" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" />
    {/* F top bar */}
    <path d="M 48 30 L 82 30" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" />
    {/* F middle bar */}
    <path d="M 58 50 L 76 50" stroke={light ? '#FAF8F5' : '#8B0000'} strokeWidth="7" strokeLinecap="round" />
    {/* Dental arch (smile) */}
    <path d="M 26 72 Q 48 98 70 72" stroke={light ? '#C09553' : '#C09553'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// ─── Initial State ─────────────────────────────────────────────────────────
const INITIAL_SECTIONS: PhotoSection[] = [
  { id: 'panoramic', title: 'Radiografia Panorâmica', subtitle: 'Planejamento de Implantes e Diagnósticos Gerais', image: null, markers: [] },
  { id: 'upper', title: 'Arcada Superior', subtitle: 'Dentes Posteriores e Anteriores Superiores', image: null, markers: [] },
  { id: 'lower', title: 'Arcada Inferior', subtitle: 'Dentes Posteriores e Anteriores Inferiores', image: null, markers: [] },
  { id: 'smile', title: 'Estética do Sorriso', subtitle: 'Mapeamento de Dentes Anteriores e Estética', image: null, markers: [] },
];

const INITIAL_PROPOSAL: TreatmentProposal = {
  patientName: '',
  status: 'Aberto (paciente não pagou)',
  notes: 'Orçamento feito sem radiografia atual pós trat. de canal, podendo haver alterações posteriores.',
  discountPercent: 5,
  pixDiscountLabel: '5% DESCONTO NO PIX',
  installments: 12,
  installmentsLabel: 'Parcelamento em até 12x (com taxas).',
  customDiscountAmount: 0,
  showTotalBySection: true,
  markerSize: 26,
};

// ─── Navigation Config ──────────────────────────────────────────────────────
type AppView = 'dashboard' | 'calendar' | 'planning' | 'crm';

const NAV_ITEMS = [
  { id: 'dashboard' as AppView, label: 'Painel', icon: LayoutDashboard, section: 'principal' },
  { id: 'crm'       as AppView, label: 'Pacientes', icon: Users,           section: 'principal' },
  { id: 'calendar'  as AppView, label: 'Agenda',    icon: Calendar,        section: 'principal' },
  { id: 'planning'  as AppView, label: 'Planejamento', icon: ClipboardEdit, section: 'clinica' },
];

// ─── Sidebar ────────────────────────────────────────────────────────────────
interface SidebarProps {
  currentView: AppView;
  onChangeView: (v: AppView) => void;
  onLogout: () => void;
  clinicSettings: ClinicSettings;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function Sidebar({
  currentView, onChangeView, onLogout, clinicSettings,
  collapsed, onToggleCollapse, mobileOpen, onCloseMobile,
}: SidebarProps) {
  const handleNav = (v: AppView) => {
    onChangeView(v);
    onCloseMobile();
  };

  const sidebarCls = [
    'sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={onCloseMobile}
      />

      <aside className={sidebarCls} aria-label="Navegação principal">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-white/10 border border-white/20">
              <AFLogoSVG className="w-7 h-7" light />
            </div>
            {!collapsed && (
              <div className="overflow-hidden animate-fade-in">
                <p className="text-white font-bold text-[13px] leading-tight tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Dr. Agnaldo Ferreira
                </p>
                <p className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#C09553' }}>
                  Odontologia Restauradora
                </p>
              </div>
            )}
          </div>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex mt-4 w-full items-center justify-center gap-1.5 text-white/40 hover:text-white/80 text-[10px] font-medium transition-colors"
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
            {!collapsed && <span>Recolher</span>}
          </button>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {!collapsed && (
            <p className="nav-section-label">Módulos</p>
          )}
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`nav-item w-full ${isActive ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="nav-item-icon flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          {!collapsed ? (
            <div className="mb-3 px-2">
              <p className="text-[10px] text-white/30 uppercase tracking-widest font-semibold mb-1">Conectado como</p>
              <p className="text-[12px] text-white/70 font-medium truncate">{clinicSettings.doctorName}</p>
              <p className="text-[10px] text-white/40 truncate">{clinicSettings.cro}</p>
            </div>
          ) : null}
          <button
            onClick={onLogout}
            className={`nav-item w-full text-red-300/70 hover:text-red-200 hover:bg-red-900/30 ${collapsed ? 'justify-center px-0' : ''}`}
            title="Sair"
          >
            <LogOut className="nav-item-icon flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>
    </>
  );
}

// ─── TopBar ─────────────────────────────────────────────────────────────────
interface TopBarProps {
  currentView: AppView;
  proposal: TreatmentProposal;
  activeTab: string;
  onOpenMobileMenu: () => void;
  isMobileOptimized: boolean;
  setIsMobileOptimized: (v: boolean) => void;
}

function TopBar({ currentView, proposal, activeTab, onOpenMobileMenu, isMobileOptimized, setIsMobileOptimized }: TopBarProps) {
  const VIEW_LABELS: Record<AppView, string> = {
    dashboard: 'Painel Geral',
    crm: 'Gestão de Pacientes',
    calendar: 'Agenda',
    planning: 'Planejamento Clínico',
  };

  return (
    <header className="topbar print:hidden">
      {/* Mobile menu toggle */}
      <button
        onClick={onOpenMobileMenu}
        className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-zinc-100 transition-colors text-zinc-600"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Page title */}
      <div className="flex-1 min-w-0">
        <h2 className="text-[15px] font-semibold text-zinc-800 truncate">
          {VIEW_LABELS[currentView]}
        </h2>
        {currentView === 'planning' && proposal.patientName && (
          <p className="text-[11px] text-zinc-500 truncate mt-0.5">
            Paciente: <span className="font-semibold text-[#8B0000]">{proposal.patientName}</span>
            {proposal.status && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold"
                style={{
                  background: (proposal.status === 'Aprovado (paciente pagou)' || proposal.status === 'Concluído') ? '#DCFCE7' : '#FEE2E2',
                  color: (proposal.status === 'Aprovado (paciente pagou)' || proposal.status === 'Concluído') ? '#166534' : '#991B1B',
                }}>
                {proposal.status}
              </span>
            )}
          </p>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => setIsMobileOptimized(!isMobileOptimized)}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 transition-colors"
          title={isMobileOptimized ? 'Modo Desktop' : 'Modo Celular'}
        >
          {isMobileOptimized ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
          {isMobileOptimized ? 'Desktop' : 'Celular'}
        </button>

        {currentView === 'planning' && (
          <button
            type="button"
            onClick={() => window.open(window.location.href.split('?')[0] + '?mode=patient_mapping', '_blank', 'width=1100,height=800')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-lg border-2 text-[#8B0000] border-[#C09553] bg-white hover:bg-[#FAF8F5] transition-colors"
            title="Pop-up do Paciente"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Pop-up Paciente</span>
          </button>
        )}
      </div>
    </header>
  );
}

// ─── Planning Tabs Bar ────────────────────────────────────────────────────────
interface PlanningTabsProps {
  activeTab: 'registration' | 'editor' | 'negotiation' | 'documents';
  setActiveTab: (t: 'registration' | 'editor' | 'negotiation' | 'documents') => void;
  hasMarkers: boolean;
  proposal: TreatmentProposal;
  setProposal: React.Dispatch<React.SetStateAction<TreatmentProposal>>;
}

function PlanningTabs({ activeTab, setActiveTab, hasMarkers, proposal, setProposal }: PlanningTabsProps) {
  const tabs = [
    { id: 'registration' as const, label: 'Cadastro', icon: UserIcon, shortLabel: '1.' },
    { id: 'editor'       as const, label: 'Mapeamento', icon: Layers, shortLabel: '2.' },
    { id: 'negotiation'  as const, label: 'Orçamento', icon: Coins,  shortLabel: '3.' },
    { id: 'documents'    as const, label: 'Documentos', icon: BookOpen, shortLabel: '4.' },
  ];

  return (
    <div className="print:hidden">
      {/* Tab row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 justify-between bg-white border border-[#E6DEC9] p-2.5 rounded-2xl shadow-sm mb-6">
        <div className="tab-bar w-full sm:w-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                id={`tab-btn-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel} {tab.label}</span>
                {tab.id === 'negotiation' && hasMarkers && (
                  <span className="w-2 h-2 rounded-full bg-[#C09553] animate-pulse" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active patient controls (inline) */}
        {proposal.patientName && (
          <div className="hidden lg:flex items-center gap-3 px-3">
            <div className="h-5 w-px bg-[#E6DEC9]" />
            <select
              id="panel-proposal-status"
              value={proposal.status || 'Aberto (paciente não pagou)'}
              onChange={(e) => setProposal((prev) => ({ ...prev, status: e.target.value as any }))}
              className="text-[11px] font-bold rounded-lg px-2 py-1 border focus:outline-none transition-colors"
              style={{
                background: (proposal.status === 'Aprovado (paciente pagou)' || proposal.status === 'Concluído') ? '#DCFCE7' : '#FEF9F9',
                color: (proposal.status === 'Aprovado (paciente pagou)' || proposal.status === 'Concluído') ? '#166534' : '#991B1B',
                borderColor: (proposal.status === 'Aprovado (paciente pagou)' || proposal.status === 'Concluído') ? '#86EFAC' : '#FECACA',
              }}
            >
              <option value="Aberto (paciente não pagou)">🔴 Aberto</option>
              <option value="Aprovado (paciente pagou)">🟢 Aprovado</option>
              <option value="Aguardando Aprovação">⏳ Aguardando</option>
              <option value="Em Andamento">🔄 Em Andamento</option>
              <option value="Concluído">✅ Concluído</option>
              <option value="Arquivado">📁 Arquivado</option>
            </select>
          </div>
        )}
      </div>

      {/* Patient name + notes (compact) */}
      {(activeTab === 'editor' || activeTab === 'negotiation') && (
        <div className="bg-white border border-[#E6DEC9] rounded-xl p-4 shadow-sm mb-6 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="field-label">Nome do Paciente</label>
              <input
                id="input-patient-name"
                type="text"
                placeholder="Ex: VALDERMON DA SILVA LOPES"
                value={proposal.patientName}
                onChange={(e) => setProposal((prev) => ({ ...prev, patientName: e.target.value.toUpperCase() }))}
                className="field-input"
              />
            </div>
            <div>
              <label className="field-label">Observações do Orçamento</label>
              <input
                id="input-notes"
                type="text"
                placeholder="Ex: Orçamento feito sem radiografia..."
                value={proposal.notes}
                onChange={(e) => setProposal((prev) => ({ ...prev, notes: e.target.value }))}
                className="field-input"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, isLoggingIn }: { onLogin: () => void; isLoggingIn: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #5C0000 0%, #8B0000 50%, #3D0000 100%)' }}>
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10"
          style={{ background: '#C09553', filter: 'blur(80px)' }} />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full opacity-10"
          style={{ background: '#C09553', filter: 'blur(60px)' }} />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Top band */}
          <div className="px-8 pt-10 pb-8 text-center"
            style={{ background: 'linear-gradient(180deg, #8B0000 0%, #6B0000 100%)' }}>
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center animate-pulse-gold">
              <AFLogoSVG className="w-13 h-13" light />
            </div>
            <h1 className="text-white text-xl font-bold tracking-tight" style={{ fontFamily: 'Playfair Display, serif' }}>
              Dr. Agnaldo Ferreira
            </h1>
            <p className="text-[11px] font-semibold tracking-widest uppercase mt-1" style={{ color: '#C09553' }}>
              Odontologia Restauradora
            </p>
          </div>

          <div className="px-8 py-8 space-y-6">
            <div className="text-center">
              <h2 className="text-zinc-800 font-bold text-base">Portal Clínico</h2>
              <p className="text-zinc-500 text-sm mt-1">Faça login com sua conta Google para acessar o sistema.</p>
            </div>

            <button
              onClick={onLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-zinc-200 rounded-xl px-4 py-3.5 shadow-sm hover:bg-zinc-50 hover:border-zinc-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="none" d="M0 0h48v48H0z"/>
              </svg>
              <span className="font-semibold text-zinc-700">
                {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
              </span>
            </button>

            <p className="text-center text-[10px] text-zinc-400">
              Seus dados são salvos no Google Drive de forma privada e segura.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  // --- AUTH STATE ---
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  // --- URL PARAMS ---
  const urlMode = new URLSearchParams(window.location.search).get('mode');

  // --- APP STATE ---
  const [procedures, setProcedures] = useState<Procedure[]>(() => {
    const cached = localStorage.getItem('agnaldo_dent_procedures');
    return cached ? JSON.parse(cached) : DEFAULT_PROCEDURES;
  });

  const [sections, setSections] = useState<PhotoSection[]>(() => INITIAL_SECTIONS);

  const [proposal, setProposal] = useState<TreatmentProposal>(() => {
    const cached = localStorage.getItem('agnaldo_dent_proposal');
    const base = cached ? JSON.parse(cached) : INITIAL_PROPOSAL;
    return { ...base, patientName: '' };
  });

  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(() => {
    const cached = localStorage.getItem('agnaldo_dent_clinic_settings');
    return cached ? JSON.parse(cached) : DEFAULT_CLINIC_SETTINGS;
  });

  const [activeTab, setActiveTab] = useState<'registration' | 'editor' | 'negotiation' | 'documents'>('registration');
  const [showPatientsModal, setShowPatientsModal] = useState(false);
  const [currentAppView, setCurrentAppView] = useState<AppView>('dashboard');
  const [appointmentPatientName, setAppointmentPatientName] = useState<string | undefined>(undefined);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const [isMobileOptimized, setIsMobileOptimized] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('agnaldo_dent_mobile_opt');
      if (stored) return stored === 'true';
      return window.innerWidth < 1024;
    }
    return false;
  });

  const [isAutosaving] = useState(false);

  // --- EFFECTS ---
  useEffect(() => {
    const unsubscribe = initAuth(
      (usr) => { setUser(usr); setNeedsAuth(false); },
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => { localStorage.setItem('agnaldo_dent_procedures', JSON.stringify(procedures)); }, [procedures]);
  useEffect(() => { localStorage.setItem('agnaldo_dent_sections', JSON.stringify(sections)); }, [sections]);
  useEffect(() => { localStorage.setItem('agnaldo_dent_proposal', JSON.stringify(proposal)); }, [proposal]);
  useEffect(() => { localStorage.setItem('agnaldo_dent_clinic_settings', JSON.stringify(clinicSettings)); }, [clinicSettings]);
  useEffect(() => { localStorage.setItem('agnaldo_dent_mobile_opt', isMobileOptimized.toString()); }, [isMobileOptimized]);

  // --- ACTIONS ---
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) { setUser(result.user); setNeedsAuth(false); }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') console.error('Login failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try { await logout(); setNeedsAuth(true); setUser(null); }
    catch (err) { console.error('Logout failed:', err); }
  };

  const handleUpdateSection = (updated: PhotoSection) => {
    setSections((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleResetProcedures = () => {
    if (confirm('Deseja restaurar a tabela de termos e valores para as definições originais do sistema?')) {
      setProcedures(DEFAULT_PROCEDURES);
    }
  };

  const handleResetAll = () => {
    setSections(INITIAL_SECTIONS);
    setProposal(INITIAL_PROPOSAL);
    setCurrentFileId(null);
    setActiveTab('editor');
  };

  const handleNewProposalForPatient = (patientName: string) => {
    setSections(INITIAL_SECTIONS);
    setProposal({ ...INITIAL_PROPOSAL, patientName });
    setCurrentFileId('NEW_FILE');
    setCurrentAppView('planning');
    setActiveTab('registration');
    setShowPatientsModal(false);
  };

  const handleLoadPatientData = (data: any) => {
    if (data.procedures) setProcedures(data.procedures);
    if (data.sections) {
      const merged = INITIAL_SECTIONS.map((initSec) => {
        const existing = data.sections.find((s: PhotoSection) => s.id === initSec.id);
        return existing || initSec;
      });
      setSections(merged);
    }
    if (data.proposal) setProposal(data.proposal);
    if (data.__fileId) setCurrentFileId(data.__fileId);
    if (data.selectedPlanIndex !== undefined) {
      localStorage.setItem('ag_neg_selected_plan', data.selectedPlanIndex.toString());
    }
    setCurrentAppView('planning');
    setActiveTab('editor');
    setShowPatientsModal(false);
  };

  const handleLoadSamplePlan = () => {
    setProcedures(DEFAULT_PROCEDURES);
    setProposal({
      patientName: 'VALDERMON DA SILVA LOPES',
      notes: 'Orçamento feito sem radiografia atual pós trat. de canal, podendo haver alterações posteriores.',
      discountPercent: 5,
      pixDiscountLabel: '5% DESCONTO NO PIX',
      installments: 12,
      installmentsLabel: 'Parcelamento em até 12x (com taxas).',
      customDiscountAmount: 0,
      showTotalBySection: true,
      markerSize: 26,
    });
    const mockSections: PhotoSection[] = [
      { id: 'upper', title: 'Arcada Superior', subtitle: 'Dentes Posteriores e Anteriores Superiores', image: DEMO_SVG_PLACEHOLDERS.upper, markers: [
        { id: 'upper-14', toothNumber: 14, x: 50.5, y: 25.5, procedures: ['p2'] },
        { id: 'upper-15', toothNumber: 15, x: 53.5, y: 35.5, procedures: ['p2'] },
        { id: 'upper-16', toothNumber: 16, x: 54.8, y: 46.5, procedures: ['p4'] },
        { id: 'upper-17', toothNumber: 17, x: 58.5, y: 56.5, procedures: ['p5'] },
        { id: 'upper-24', toothNumber: 24, x: 30.2, y: 26.5, procedures: ['p2'] },
        { id: 'upper-26', toothNumber: 26, x: 23.5, y: 52.5, procedures: ['p5'] },
      ]},
      { id: 'lower', title: 'Arcada Inferior', subtitle: 'Dentes Posteriores e Anteriores Inferiores', image: DEMO_SVG_PLACEHOLDERS.lower, markers: [
        { id: 'lower-47', toothNumber: 47, x: 34.5, y: 28.5, procedures: ['p1'] },
        { id: 'lower-45', toothNumber: 45, x: 41.5, y: 42.5, procedures: ['p2'] },
        { id: 'lower-44', toothNumber: 44, x: 43.5, y: 49.5, procedures: ['p4'] },
        { id: 'lower-34', toothNumber: 34, x: 58.5, y: 49.5, procedures: ['p5'] },
        { id: 'lower-35', toothNumber: 35, x: 60.5, y: 42.5, procedures: ['p5'] },
        { id: 'lower-37', toothNumber: 37, x: 64.5, y: 28.5, procedures: ['p5'] },
      ]},
      { id: 'smile', title: 'Estética do Sorriso', subtitle: 'Mapeamento de Dentes Anteriores e Estética', image: DEMO_SVG_PLACEHOLDERS.smile, markers: [
        { id: 'smile-12', toothNumber: 12, x: 27.2, y: 26.5, procedures: ['p1'] },
        { id: 'smile-11', toothNumber: 11, x: 32.5, y: 27.0, procedures: ['p1'] },
        { id: 'smile-21', toothNumber: 21, x: 37.2, y: 27.0, procedures: ['p1'] },
        { id: 'smile-22', toothNumber: 22, x: 42.0, y: 26.5, procedures: ['p1'] },
        { id: 'smile-23', toothNumber: 23, x: 45.8, y: 26.0, procedures: ['p1', 'p5'] },
        { id: 'smile-43', toothNumber: 43, x: 27.2, y: 32.5, procedures: ['p1'] },
        { id: 'smile-42', toothNumber: 42, x: 30.5, y: 32.5, procedures: ['p1'] },
        { id: 'smile-41', toothNumber: 41, x: 34.5, y: 32.5, procedures: ['p1'] },
        { id: 'smile-31', toothNumber: 31, x: 38.5, y: 32.5, procedures: ['p1'] },
      ]},
    ];
    setSections(mockSections);
    setActiveTab('negotiation');
  };

  const hasAnyMarkers = sections.some((s) => s.markers.length > 0);

  // --- RENDER: Special URL modes ---
  if (urlMode === 'patient_mapping' || urlMode === 'patient') {
    return <PatientScreen hideSimulation={false} />;
  }

  // --- RENDER: Login Screen ---
  if (needsAuth) {
    return <LoginScreen onLogin={handleLogin} isLoggingIn={isLoggingIn} />;
  }

  // --- RENDER: Mobile-optimized workspace ---
  if (isMobileOptimized) {
    return (
      <div className="app-shell">
        <Sidebar
          currentView={currentAppView}
          onChangeView={setCurrentAppView}
          onLogout={handleLogout}
          clinicSettings={clinicSettings}
          collapsed={false}
          onToggleCollapse={() => {}}
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />
        <div className="main-content">
          <TopBar
            currentView={currentAppView}
            proposal={proposal}
            activeTab={activeTab}
            onOpenMobileMenu={() => setMobileSidebarOpen(true)}
            isMobileOptimized={isMobileOptimized}
            setIsMobileOptimized={setIsMobileOptimized}
          />
          <main className="flex-1 mx-auto w-full max-w-md px-2 py-4">
            <MobileWorkspace
              sections={sections}
              onUpdateSection={handleUpdateSection}
              procedures={procedures}
              proposal={proposal}
              setProposal={setProposal}
              clinicSettings={clinicSettings}
              onExitMobile={() => setIsMobileOptimized(false)}
              onNewProposalForPatient={handleNewProposalForPatient}
            />
          </main>
        </div>
      </div>
    );
  }

  // --- RENDER: Main Desktop App ---
  return (
    <div className="app-shell">
      <Sidebar
        currentView={currentAppView}
        onChangeView={setCurrentAppView}
        onLogout={handleLogout}
        clinicSettings={clinicSettings}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <TopBar
          currentView={currentAppView}
          proposal={proposal}
          activeTab={activeTab}
          onOpenMobileMenu={() => setMobileSidebarOpen(true)}
          isMobileOptimized={isMobileOptimized}
          setIsMobileOptimized={setIsMobileOptimized}
        />

        {/* ── Dashboard ───────────────────────────────────────── */}
        {currentAppView === 'dashboard' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 max-w-7xl w-full mx-auto animate-fade-in-up">
            <DashboardView
              clinicSettings={clinicSettings}
              proposal={proposal}
              onNavigateToPlanning={(patientName, status) => {
                if (patientName) {
                  setProposal((prev) => ({ ...prev, patientName, status: (status || 'Em Andamento') as any }));
                }
                setCurrentAppView('planning');
                setActiveTab('negotiation');
              }}
              onOpenRegistry={() => { setCurrentAppView('planning'); setActiveTab('registration'); }}
              onOpenPatientsList={() => { setCurrentAppView('crm'); }}
            />
          </main>
        )}

        {/* ── CRM ─────────────────────────────────────────────── */}
        {currentAppView === 'crm' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 max-w-7xl w-full mx-auto animate-fade-in-up">
            <DentalCRMView
              onLoadPatientData={handleLoadPatientData}
              onNewProposal={handleNewProposalForPatient}
              onChangeView={setCurrentAppView}
              clinicSettings={clinicSettings}
            />
          </main>
        )}

        {/* ── Calendar ─────────────────────────────────────────── */}
        {currentAppView === 'calendar' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 w-full h-[calc(100vh-60px)] animate-fade-in-up">
            <CalendarView
              onNewPatient={() => { handleResetAll(); setCurrentAppView('planning'); }}
              initialPatientName={appointmentPatientName}
              onClearInitialPatient={() => setAppointmentPatientName(undefined)}
            />
          </main>
        )}

        {/* ── Planning ─────────────────────────────────────────── */}
        {currentAppView === 'planning' && (
          <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8 max-w-7xl w-full mx-auto">

            <PlanningTabs
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              hasMarkers={hasAnyMarkers}
              proposal={proposal}
              setProposal={setProposal}
            />

            {/* Tab: Cadastro */}
            <div className={`${activeTab === 'registration' ? 'block animate-fade-in-up' : 'hidden'} print:hidden`}>
              <PatientRegistrationTab proposal={proposal} setProposal={setProposal} />
            </div>

            {/* Tab: Documentos */}
            <div className={activeTab === 'documents' ? 'block print:block animate-fade-in-up' : 'hidden'}>
              <PatientDocumentsTab
                proposal={proposal}
                clinicSettings={clinicSettings}
                setClinicSettings={setClinicSettings}
              />
            </div>

            {/* Tab: Mapeamento Clínico */}
            <div className={`${activeTab === 'editor' ? 'block animate-fade-in-up' : 'hidden'} print:hidden`}>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-8 space-y-6">

                  {/* Instructional card */}
                  <div className="bg-[#8B0000]/5 border border-[#C09553]/30 p-4 rounded-xl flex items-start gap-3">
                    <div className="px-2.5 py-0.5 rounded-md bg-[#8B0000] text-white font-bold text-sm flex-shrink-0">1</div>
                    <div>
                      <h4 className="text-xs font-bold text-[#8B0000] uppercase tracking-wide">Como construir o plano de tratamento</h4>
                      <p className="text-[11.5px] text-zinc-600 mt-1 leading-relaxed">
                        Carregue as fotos reais da arcada do seu paciente usando os slots em cada quadrante. Selecione os dentes e preencha os procedimentos correspondentes.
                      </p>
                    </div>
                  </div>

                  {/* Marker size */}
                  <div className="bg-white border border-[#E6DEC9] p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div>
                      <h4 className="text-xs font-bold text-[#8B0000] uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#C09553] inline-block" />
                        Tamanho das Marcações
                      </h4>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Ajuste o tamanho das bolinhas nos dentes.</p>
                    </div>
                    <div className="flex items-center gap-3 bg-[#FAF8F5] border border-[#D5CBB3] rounded-lg px-4 py-1.5 min-w-[240px]">
                      <input
                        id="map-marker-size"
                        type="range"
                        min="18" max="42" step="1"
                        value={proposal.markerSize || 26}
                        onChange={(e) => setProposal((prev) => ({ ...prev, markerSize: parseInt(e.target.value) || 26 }))}
                        className="w-full h-1 bg-[#E6DEC9] rounded-lg appearance-none cursor-pointer accent-[#8B0000]"
                      />
                      <span className="text-xs font-mono font-bold text-[#8B0000] min-w-[36px] text-right">{proposal.markerSize || 26}px</span>
                    </div>
                  </div>

                  {sections.map((sec) => (
                    <PhotoEditor
                      key={sec.id}
                      section={sec}
                      procedures={procedures}
                      onUpdateSection={handleUpdateSection}
                      markerSize={proposal.markerSize || 26}
                      patientName={proposal.patientName}
                    />
                  ))}

                  <ClinicalAttendanceManager
                    sections={sections}
                    procedures={procedures}
                    onUpdateSections={setSections}
                    proposal={proposal}
                    setProposal={setProposal}
                  />

                  {hasAnyMarkers && (
                    <div className="bg-gradient-to-r from-[#FAF8F5] to-[#F3EFE9] border border-[#E6DEC9] p-5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div>
                        <p className="text-xs font-bold text-[#8B0000] uppercase tracking-wide">Mapeamento Concluído!</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Mapeamento feito. Veja o orçamento consolidado?</p>
                      </div>
                      <button
                        id="btn-goto-negotiation"
                        onClick={() => setActiveTab('negotiation')}
                        className="btn-primary whitespace-nowrap"
                      >
                        Ver Orçamento & Negociação
                      </button>
                    </div>
                  )}
                </div>

                <div className="lg:col-span-4 lg:sticky lg:top-8">
                  <ProcedureManager
                    procedures={procedures}
                    setProcedures={setProcedures}
                    onResetProcedures={handleResetProcedures}
                  />
                </div>
              </div>
            </div>

            {/* Tab: Negociação */}
            <div className={activeTab === 'negotiation' ? 'block print:block animate-fade-in-up' : 'hidden'}>
              <NegotiationTab
                sections={sections}
                procedures={procedures}
                proposal={proposal}
                setProposal={setProposal}
                clinicSettings={clinicSettings}
                currentFileId={currentFileId}
                setCurrentFileId={setCurrentFileId}
              />
            </div>
          </main>
        )}

        {/* Footer */}
        <footer className="bg-white border-t border-[#E6DEC9] py-4 px-6 print:hidden mt-auto">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-2">
              <AFLogoSVG className="w-6 h-6" />
              <div>
                <p className="text-[11px] font-bold text-[#8B0000] tracking-wider uppercase" style={{ fontFamily: 'Playfair Display, serif' }}>
                  Dr. Agnaldo Ferreira
                </p>
                <p className="text-[9px] text-zinc-400 font-mono tracking-widest">
                  ODONTOLOGIA RESTAURADORA
                </p>
              </div>
            </div>
            <p className="text-[10px] text-zinc-400">
              {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </footer>
      </div>

      {showPatientsModal && (
        <PatientsModal
          onClose={() => setShowPatientsModal(false)}
          onLoadPatient={handleLoadPatientData}
          onNewProposal={handleNewProposalForPatient}
          clinicSettings={clinicSettings}
          onNewAppointment={(patientName) => {
            setShowPatientsModal(false);
            setAppointmentPatientName(patientName);
            setCurrentAppView('calendar');
          }}
        />
      )}
    </div>
  );
}
