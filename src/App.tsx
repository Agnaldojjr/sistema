/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Eye, Hammer, Sparkles, BookOpen, Layers, CheckCircle2, Calendar, Info, Coins, ExternalLink, LogIn, User as UserIcon } from 'lucide-react';
import BrandHeader from './components/BrandHeader';
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

const INITIAL_SECTIONS: PhotoSection[] = [
  {
    id: 'panoramic',
    title: 'Radiografia Panorâmica',
    subtitle: 'Planejamento de Implantes e Diagnósticos Gerais',
    image: null,
    markers: [],
  },
  {
    id: 'upper',
    title: 'Arcada Superior',
    subtitle: 'Dentes Posteriores e Anteriores Superiores',
    image: null,
    markers: [],
  },
  {
    id: 'lower',
    title: 'Arcada Inferior',
    subtitle: 'Dentes Posteriores e Anteriores Inferiores',
    image: null,
    markers: [],
  },
  {
    id: 'smile',
    title: 'Estética do Sorriso',
    subtitle: 'Mapeamento de Dentes Anteriores e Estética',
    image: null,
    markers: [],
  },
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

  const [sections, setSections] = useState<PhotoSection[]>(() => {
    return INITIAL_SECTIONS;
  });

  const [proposal, setProposal] = useState<TreatmentProposal>(() => {
    const cached = localStorage.getItem('agnaldo_dent_proposal');
    const base = cached ? JSON.parse(cached) : INITIAL_PROPOSAL;
    return { ...base, patientName: '' };
  });

  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(() => {
    const cached = localStorage.getItem('agnaldo_dent_clinic_settings');
    return cached ? JSON.parse(cached) : DEFAULT_CLINIC_SETTINGS;
  });

  // Current sub-tab being edited/displayed to the dentist (hides on printing)
  const [activeTab, setActiveTab] = useState<'registration' | 'editor' | 'negotiation' | 'documents'>('registration');
  const [showPatientsModal, setShowPatientsModal] = useState(false);
  const [currentAppView, setCurrentAppView] = useState<'dashboard' | 'calendar' | 'planning' | 'crm'>('dashboard');
  const [appointmentPatientName, setAppointmentPatientName] = useState<string | undefined>(undefined);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);

  const [isMobileOptimized, setIsMobileOptimized] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('agnaldo_dent_mobile_opt');
      if (stored) return stored === 'true';
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('agnaldo_dent_mobile_opt', isMobileOptimized.toString());
  }, [isMobileOptimized]);

  // --- EFFECTS ---
  useEffect(() => {
    const unsubscribe = initAuth(
      (usr, token) => {
        setUser(usr);
        setNeedsAuth(false);
      },
      () => setNeedsAuth(true)
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('agnaldo_dent_procedures', JSON.stringify(procedures));
  }, [procedures]);

  useEffect(() => {
    localStorage.setItem('agnaldo_dent_sections', JSON.stringify(sections));
  }, [sections]);

  useEffect(() => {
    localStorage.setItem('agnaldo_dent_proposal', JSON.stringify(proposal));
  }, [proposal]);

  useEffect(() => {
    localStorage.setItem('agnaldo_dent_clinic_settings', JSON.stringify(clinicSettings));
  }, [clinicSettings]);

  // --- AUTOSAVE TO DRIVE ---
  const [isAutosaving, setIsAutosaving] = useState(false);
  // Deactivated automatic background saving to prevent unrequested budget creations.
  // Budgets will now only be synchronized to Google Drive when the user explicitly clicks save.

  // --- ACTIONS ---
  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user') {
        console.log('Login cancelado pelo usuário.');
      } else {
        console.error('Login failed:', err);
      }
      // Let user retry on error
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setNeedsAuth(true);
      setUser(null);
    } catch (err) {
      console.error('Logout failed:', err);
    }
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
      const merged = INITIAL_SECTIONS.map(initSec => {
        const existing = data.sections.find((s: PhotoSection) => s.id === initSec.id);
        return existing || initSec;
      });
      setSections(merged);
    }
    if (data.proposal) setProposal(data.proposal);
    if (data.__fileId) setCurrentFileId(data.__fileId);
    // Note: simulations and selectedPlanIndex are also saved, but let's just focus on the core data
    if (data.selectedPlanIndex !== undefined) {
        localStorage.setItem('ag_neg_selected_plan', data.selectedPlanIndex.toString());
    }
    setCurrentAppView('planning');
    setActiveTab('editor');
    setShowPatientsModal(false);
  };

  // --- RENDERING ---

  // Check if we are in "patient mode" from URL params
  if (urlMode === 'patient_mapping') {
    return <PatientScreen hideSimulation={false} />;
  } else if (urlMode === 'patient') {
    return <PatientScreen hideSimulation={false} />;
  }

  // If requires auth (dentist view), show login screen
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-[#E6DEC9] p-8 text-center space-y-8 animate-fade-in">
          <picture className="mx-auto w-16 h-16 rounded-full bg-[#4E1119] border-2 border-[#C09553] flex items-center justify-center text-[#B48C4D] font-bold text-xs shadow-xs">
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#FAF8F5] fill-current">
              <path d="M 32 75 L 45 35 Q 50 20 52 35 L 61 65" stroke="#C09553" strokeWidth="4.5" fill="none"/>
              <path d="M 42 55 L 56 55" stroke="#C09553" strokeWidth="4.5" fill="none"/>
              <path d="M 52 35 L 68 75" stroke="#FAF8F5" strokeWidth="5" fill="none"/>
            </svg>
          </picture>
          <div className="space-y-2">
            <h1 className="text-2xl font-serif text-[#4E1119] font-bold uppercase tracking-tight">Portal do Dentista</h1>
            <p className="text-zinc-500 text-sm">Faça login com sua conta Google para acessar o sistema e salvar orçamentos no Drive.</p>
          </div>

          <button
            onClick={handleLogin}
            disabled={isLoggingIn}
            className="w-full flex items-center justify-center gap-3 bg-white border border-zinc-300 rounded-xl px-4 py-3 shadow-sm hover:bg-zinc-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
            <span className="font-semibold text-zinc-700">
              {isLoggingIn ? 'Entrando...' : 'Entrar com Google'}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // Pre-load the exact values and dots matching Dr. Agnaldo's PDF sheet!
  const handleLoadSamplePlan = () => {
    // 1. Check procedures exist, reset to default standard first so IDs match properly
    setProcedures(DEFAULT_PROCEDURES);

    // 2. Mock patient information matching exactly their patient screenshot
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

    // 3. Pre-position white circles + procedure colored dots matching the PDF
    const mockSections: PhotoSection[] = [
      {
        id: 'upper',
        title: 'Arcada Superior',
        subtitle: 'Dentes Posteriores e Anteriores Superiores',
        image: DEMO_SVG_PLACEHOLDERS.upper,
        markers: [
          { id: 'upper-14', toothNumber: 14, x: 50.5, y: 25.5, procedures: ['p2'] }, // Resina 2 faces (R$220)
          { id: 'upper-15', toothNumber: 15, x: 53.5, y: 35.5, procedures: ['p2'] }, // Resina 2 faces (R$220)
          { id: 'upper-16', toothNumber: 16, x: 54.8, y: 46.5, procedures: ['p4'] }, // Reconstrução (R$300)
          { id: 'upper-17', toothNumber: 17, x: 58.5, y: 56.5, procedures: ['p5'] }, // Pino + Coroa (R$1800)
          { id: 'upper-24', toothNumber: 24, x: 30.2, y: 26.5, procedures: ['p2'] }, // Resina 2 faces (R$220)
          { id: 'upper-26', toothNumber: 26, x: 23.5, y: 52.5, procedures: ['p5'] }, // Pino + Coroa (R$1800)
        ],
      },
      {
        id: 'lower',
        title: 'Arcada Inferior',
        subtitle: 'Dentes Posteriores e Anteriores Inferiores',
        image: DEMO_SVG_PLACEHOLDERS.lower,
        markers: [
          { id: 'lower-47', toothNumber: 47, x: 34.5, y: 28.5, procedures: ['p1'] }, // Resina 1 face (R$200)
          { id: 'lower-45', toothNumber: 45, x: 41.5, y: 42.5, procedures: ['p2'] }, // Resina 2 faces (R$220)
          { id: 'lower-44', toothNumber: 44, x: 43.5, y: 49.5, procedures: ['p4'] }, // Reconstrução (R$300)
          { id: 'lower-34', toothNumber: 34, x: 58.5, y: 49.5, procedures: ['p5'] }, // Pino + Coroa (R$1800)
          { id: 'lower-35', toothNumber: 35, x: 60.5, y: 42.5, procedures: ['p5'] }, // Pino + Coroa (R$1800)
          { id: 'lower-37', toothNumber: 37, x: 64.5, y: 28.5, procedures: ['p5'] }, // Pino + Coroa (R$1800)
        ],
      },
      {
        id: 'smile',
        title: 'Estética do Sorriso',
        subtitle: 'Mapeamento de Dentes Anteriores e Estética',
        image: DEMO_SVG_PLACEHOLDERS.smile,
        markers: [
          { id: 'smile-12', toothNumber: 12, x: 27.2, y: 26.5, procedures: ['p1'] }, // Resina 1 face
          { id: 'smile-11', toothNumber: 11, x: 32.5, y: 27.0, procedures: ['p1'] }, // Resina 1 face
          { id: 'smile-21', toothNumber: 21, x: 37.2, y: 27.0, procedures: ['p1'] }, // Resina 1 face
          { id: 'smile-22', toothNumber: 22, x: 42.0, y: 26.5, procedures: ['p1'] }, // Resina 1 face
          { id: 'smile-23', toothNumber: 23, x: 45.8, y: 26.0, procedures: ['p1', 'p5'] }, // Resina 1 face + Pino/Coroa
          { id: 'smile-43', toothNumber: 43, x: 27.2, y: 32.5, procedures: ['p1'] }, // Resina 1 face
          { id: 'smile-42', toothNumber: 42, x: 30.5, y: 32.5, procedures: ['p1'] }, // Resina 1 face
          { id: 'smile-41', toothNumber: 41, x: 34.5, y: 32.5, procedures: ['p1'] }, // Resina 1 face
          { id: 'smile-31', toothNumber: 31, x: 38.5, y: 32.5, procedures: ['p1'] }, // Resina 1 face
        ],
      },
    ];

    setSections(mockSections);
    setActiveTab('negotiation'); // switch tab to instantly show the finished beautiful card overview
  };

  // Is there any active dental marker in place? Used for tab reminders
  const hasAnyMarkers = sections.some((s) => s.markers.length > 0);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-zinc-800 font-sans flex flex-col selection:bg-[#4E1119] selection:text-white">
      
      {/* Clinica Header Logo Monogram Block */}
      <BrandHeader
        currentView={currentAppView}
        onChangeView={setCurrentAppView}
        proposal={proposal}
        setProposal={setProposal}
        onResetAll={handleResetAll}
        onLoadSamplePlan={handleLoadSamplePlan}
        onOpenPatientsModal={() => setCurrentAppView('crm')}
        onLogout={handleLogout}
        isAutosaving={isAutosaving}
        clinicSettings={clinicSettings}
        isMobileOptimized={isMobileOptimized}
        setIsMobileOptimized={setIsMobileOptimized}
        activeTab={activeTab}
      />

      {/* Main clinical workstation space */}
      {isMobileOptimized ? (
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
      ) : currentAppView === 'calendar' ? (
        <main className="flex-1 mx-auto p-4 sm:p-6 lg:p-8 w-full h-[calc(100vh-100px)] transition-all duration-300 max-w-7xl">
          <CalendarView 
            onNewPatient={() => {
              handleResetAll();
              setCurrentAppView('planning');
            }}
            initialPatientName={appointmentPatientName}
            onClearInitialPatient={() => setAppointmentPatientName(undefined)}
          />
        </main>
      ) : currentAppView === 'dashboard' ? (
        <main className={`flex-1 mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full transition-all duration-300 ${isMobileOptimized ? 'max-w-md ring-8 ring-zinc-100/50 rounded-2xl bg-white shadow-xl my-4 overflow-y-auto' : 'max-w-7xl'}`}>
          <DashboardView
            clinicSettings={clinicSettings}
            proposal={proposal}
            onNavigateToPlanning={(patientName, status) => {
              if (patientName) {
                setProposal(prev => ({
                  ...prev,
                  patientName,
                  status: (status || 'Em Andamento') as any,
                }));
              }
              setCurrentAppView('planning');
              setActiveTab('negotiation');
            }}
            onOpenRegistry={() => {
              setCurrentAppView('planning');
              setActiveTab('registration');
            }}
            onOpenPatientsList={() => {
              setCurrentAppView('crm');
            }}
          />
        </main>
      ) : currentAppView === 'crm' ? (
        <main className={`flex-1 mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full transition-all duration-300 ${isMobileOptimized ? 'max-w-md ring-8 ring-zinc-100/50 rounded-2xl bg-white shadow-xl my-4 overflow-y-auto' : 'max-w-7xl'}`}>
          <DentalCRMView 
            onLoadPatientData={handleLoadPatientData}
            onNewProposal={handleNewProposalForPatient}
            onChangeView={setCurrentAppView}
            clinicSettings={clinicSettings}
          />
        </main>
      ) : (
      <main className={`flex-1 mx-auto px-4 py-8 sm:px-6 lg:px-8 w-full transition-all duration-300 ${isMobileOptimized ? 'max-w-md ring-8 ring-zinc-100/50 rounded-2xl bg-white shadow-xl my-4 overflow-y-auto min-h-[calc(100vh-200px)]' : 'max-w-7xl'}`}>
        
        {/* Navigation Mode Tabs (Screen Only - Hides on Print) */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center bg-white border border-[#E6DEC9] p-2.5 rounded-xl shadow-xs mb-8 gap-4 print:hidden">
          <div className="flex flex-wrap gap-2">
            <button
              id="tab-btn-registration"
              onClick={() => setActiveTab('registration')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'registration'
                  ? 'bg-[#4E1119] text-[#FAF8F5] shadow-xs'
                  : 'text-zinc-500 hover:text-[#4E1119] hover:bg-zinc-50'
              }`}
            >
              <UserIcon className="w-4 h-4" />
              <span>1. Cadastro</span>
            </button>
            <button
              id="tab-btn-editor"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'editor'
                  ? 'bg-[#4E1119] text-[#FAF8F5] shadow-xs'
                  : 'text-zinc-500 hover:text-[#4E1119] hover:bg-zinc-50'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>2. Mapeamento Clínico</span>
            </button>
            <button
              id="tab-btn-negotiation"
              onClick={() => setActiveTab('negotiation')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'negotiation'
                  ? 'bg-[#4E1119] text-[#FAF8F5] shadow-xs'
                  : 'text-zinc-500 hover:text-[#4E1119] hover:bg-zinc-50'
              }`}
            >
              <Coins className="w-4 h-4" />
              <span>3. Orçamento & Negociação</span>
              {hasAnyMarkers && (
                <span className="w-2.5 h-2.5 rounded-full bg-[#C09553] animate-pulse ml-0.5" />
              )}
            </button>
            <button
              id="tab-btn-documents"
              onClick={() => setActiveTab('documents')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-semibold uppercase tracking-wider rounded-lg transition-all ${
                activeTab === 'documents'
                  ? 'bg-[#4E1119] text-[#FAF8F5] shadow-xs'
                  : 'text-zinc-500 hover:text-[#4E1119] hover:bg-zinc-50'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>4. Documentos</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-semibold text-[#B48C4D]">
            <BookOpen className="w-3.5 h-3.5" />
            <span>METODOLOGIA DIDÁTICA DE ATENDIMENTO</span>
          </div>
        </div>

        {/* WORK tab content flow switchers */}
        <div className={`${activeTab === 'registration' ? 'block' : 'hidden'} print:hidden`}>
          <PatientRegistrationTab proposal={proposal} setProposal={setProposal} />
        </div>

        <div className={activeTab === 'documents' ? 'block print:block' : 'hidden'}>
          <PatientDocumentsTab 
            proposal={proposal} 
            clinicSettings={clinicSettings}
            setClinicSettings={setClinicSettings}
          />
        </div>

        <div className={`${activeTab === 'editor' ? 'block' : 'hidden'} print:hidden`}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* LHS column: Photo sections list (Slot 7) */}
            <div className="lg:col-span-8 space-y-8">
              
              <div className="flex flex-col sm:flex-row justify-between items-center bg-white border border-[#E6DEC9] p-4.5 rounded-xl shadow-xs gap-4">
                 <div>
                    <h4 className="text-sm font-bold text-[#4E1119] uppercase tracking-wide">Apresentação para o Paciente</h4>
                    <p className="text-[11.5px] text-zinc-500 mt-1">
                      Abra um pop-up apenas com o resumo dos serviços selecionados para mostrar no segundo monitor.
                    </p>
                 </div>
                 <button
                   type="button"
                   onClick={() => {
                     window.open(window.location.href.split('?')[0] + '?mode=patient_mapping', '_blank', 'width=1100,height=800');
                   }}
                   className="flex items-center justify-center gap-2 bg-[#FAF8F5] text-[#4E1119] border-2 border-[#C09553] font-bold text-xs px-5 py-3 rounded-xl transition-all shadow-md hover:bg-[#F3EFE9] cursor-pointer select-none active:scale-95 flex-shrink-0"
                 >
                   <ExternalLink className="w-4 h-4" />
                   <span>Pop-up do Paciente</span>
                 </button>
              </div>

              {/* Informative didactic assistance card */}
              <div className="bg-[#4E1119]/5 border border-[#C09553]/30 p-4.5 rounded-xl flex items-start gap-3">
                <div className="p-1 px-2.5 rounded-md bg-[#4E1119] text-[#FAF8F5] font-serif font-bold text-sm">
                  1
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#4E1119] uppercase tracking-wide">
                    Como construir o plano de tratamento com o paciente
                  </h4>
                  <p className="text-[11.5px] text-zinc-600 leading-relaxed">
                    Carregue as fotos reais da arcada do seu paciente usando os slots em cada quadrante. Em seguida, selecione os dentes numerados que necessitam de intervenção clínica. Uma vez colocados na foto, selecione os dentes para preencher os procedimentos correspondentes com auxílio do painel interativo.
                  </p>
                </div>
              </div>

              {/* Dynamic control for tooth marker sizes */}
              <div className="bg-white border border-[#E6DEC9] p-4.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#4E1119] uppercase tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#B48C4D] inline-block" />
                    Tamanho das Bolinhas dos Dentes
                  </h4>
                  <p className="text-[11px] text-zinc-500 leading-normal">
                    Arraste o controle para ajustar o tamanho ideal das bolinhas e evitar que fiquem sobrepostas.
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-[#FAF8F5] border border-[#D5CBB3] rounded-lg px-4 py-1.5 min-w-[240px] md:min-w-[280px]">
                  <input
                    id="map-marker-size"
                    type="range"
                    min="18"
                    max="42"
                    step="1"
                    value={proposal.markerSize || 26}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 26;
                      setProposal((prev) => ({
                        ...prev,
                        markerSize: val
                      }));
                    }}
                    className="w-full h-1 bg-[#E6DEC9] rounded-lg appearance-none cursor-pointer accent-[#4E1119]"
                  />
                  <span className="text-xs font-mono font-bold text-[#4E1119] min-w-[36px] text-right">
                    {proposal.markerSize || 26}px
                  </span>
                </div>
              </div>

              {/* Photos quadrants mapping list */}
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

              {/* Dynamic clinical procedures and attendance manager */}
              <ClinicalAttendanceManager
                sections={sections}
                procedures={procedures}
                onUpdateSections={setSections}
                proposal={proposal}
                setProposal={setProposal}
              />

              {/* Helpful CTA to view proposal once mapped */}
              {hasAnyMarkers && (
                <div className="bg-gradient-to-r from-[#FAF8F5] to-[#F3EFE9] border border-[#E6DEC9] p-5 rounded-xl flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="text-xs font-bold text-[#4E1119] uppercase tracking-wide">
                      Mapeamento Concluído!
                    </p>
                    <p className="text-xs text-zinc-500">
                      Você mapeou diagnósticos nos dentes. Vamos ver o orçamento consolidado?
                    </p>
                  </div>
                  <button
                    id="btn-goto-negotiation"
                    type="button"
                    onClick={() => setActiveTab('negotiation')}
                    className="px-5 py-2.5 bg-[#4E1119] hover:bg-[#6c1b26] text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer shadow-xs whitespace-nowrap"
                  >
                    Ir para Orçamento & Negociação
                  </button>
                </div>
              )}

            </div>

            {/* RHS column: Procedure Pricing Management (Slot 4) */}
            <div className="lg:col-span-4 lg:sticky lg:top-8">
              <ProcedureManager
                procedures={procedures}
                setProcedures={setProcedures}
                onResetProcedures={handleResetProcedures}
              />
            </div>

          </div>
        </div>

        {/* Tab 2: Comparative Negotiation Calculator & Orçamento (Full column width) */}
        <div className={activeTab === 'negotiation' ? 'block print:block' : 'hidden'}>
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

      {/* Persistent Visual Footer */}
      <footer className="bg-white border-t border-[#E6DEC9] py-8 px-4 text-center mt-12 print:hidden select-none">
        <picture className="mx-auto w-12 h-12 rounded-full bg-[#4E1119] border-2 border-[#C09553] flex items-center justify-center text-[#B48C4D] font-bold text-xs shadow-xs mb-3">
          <svg viewBox="0 0 100 100" className="w-8 h-8 text-[#FAF8F5] fill-current">
            <path d="M 32 75 L 45 35 Q 50 20 52 35 L 61 65" stroke="#C09553" strokeWidth="4.5" fill="none"/>
            <path d="M 42 55 L 56 55" stroke="#C09553" strokeWidth="4.5" fill="none"/>
            <path d="M 52 35 L 68 75" stroke="#FAF8F5" strokeWidth="5" fill="none"/>
          </svg>
        </picture>
        <p className="text-xs font-serif font-bold text-[#4E1119] tracking-wider uppercase">
          DR. AGNALDO FERREIRA
        </p>
        <p className="text-[10px] text-zinc-400 font-mono tracking-widest mt-0.5">
          ODONTOLOGIA RESTAURADORA & ESTÉTICA AVANÇADA
        </p>
      </footer>

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
