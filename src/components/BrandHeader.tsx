/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Calendar, User, FileText, Trash2, Heart, Calendar as CalendarIcon, ClipboardEdit, LogOut, LayoutDashboard } from 'lucide-react';
import { TreatmentProposal, ClinicSettings } from '../types';

interface BrandHeaderProps {
  currentView: 'dashboard' | 'calendar' | 'planning' | 'crm';
  onChangeView: (view: 'dashboard' | 'calendar' | 'planning' | 'crm') => void;
  proposal: TreatmentProposal;
  setProposal: React.Dispatch<React.SetStateAction<TreatmentProposal>>;
  onResetAll: () => void;
  onLoadSamplePlan: () => void;
  onOpenPatientsModal: () => void;
  onLogout: () => void;
  isAutosaving?: boolean;
  clinicSettings: ClinicSettings;
  isMobileOptimized?: boolean;
  setIsMobileOptimized?: (val: boolean) => void;
  activeTab?: 'registration' | 'editor' | 'negotiation' | 'documents';
}

export default function BrandHeader({
  currentView,
  onChangeView,
  proposal,
  setProposal,
  onResetAll,
  onLoadSamplePlan,
  onOpenPatientsModal,
  onLogout,
  isAutosaving,
  clinicSettings,
  isMobileOptimized,
  setIsMobileOptimized,
  activeTab
}: BrandHeaderProps) {
  return (
    <header className="overflow-hidden bg-[#FAF8F5] border-b border-[#E6DEC9] shadow-sm print:hidden">
      {/* Top micro-bar */}
      <div className="bg-[#4E1119] text-[#F3EFE9] text-xs py-2 px-4 flex justify-between items-center select-none">
        <div className="flex items-center gap-1.5 font-medium tracking-wide">
          <Heart className="w-3.5 h-3.5 text-[#C09553] fill-[#C09553]" />
          <span>PORTAL DE SUPORTE CLÍNICO AO PACIENTE</span>
        </div>
        
        <div className="flex bg-[#a32c3d]/40 rounded-full p-0.5 border border-[#a32c3d] h-8">
             <button
               onClick={() => onChangeView('dashboard')}
               className={`flex items-center justify-center px-3 rounded-full transition-all text-xs font-semibold ${
                 currentView === 'dashboard' ? 'bg-white text-[#4E1119] shadow-md' : 'text-zinc-200 hover:text-white hover:bg-white/10'
               }`}
             >
               <LayoutDashboard className="w-3.5 h-3.5 mr-1" />
               Painel
             </button>
             <button
               onClick={() => onChangeView('crm')}
               className={`flex items-center justify-center px-3 rounded-full transition-all text-xs font-semibold ${
                 currentView === 'crm' ? 'bg-white text-[#4E1119] shadow-md' : 'text-zinc-200 hover:text-white hover:bg-white/10'
               }`}
               title="CRM e Importações de Planilhas"
             >
               <User className="w-3.5 h-3.5 mr-1" />
               CRM/Biblioteca
             </button>
             <button
               onClick={() => onChangeView('calendar')}
               className={`flex items-center justify-center px-3 rounded-full transition-all text-xs font-semibold ${
                 currentView === 'calendar' ? 'bg-white text-[#4E1119] shadow-md' : 'text-zinc-200 hover:text-white hover:bg-white/10'
               }`}
             >
               <CalendarIcon className="w-3.5 h-3.5 mr-1" />
               Agenda
             </button>
             <button
               onClick={() => onChangeView('planning')}
               className={`flex items-center justify-center px-3 rounded-full transition-all text-xs font-semibold ${
                 currentView === 'planning' ? 'bg-white text-[#4E1119] shadow-md' : 'text-zinc-200 hover:text-white hover:bg-white/10'
               }`}
             >
               <ClipboardEdit className="w-3.5 h-3.5 mr-1" />
               Planejamento
             </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono text-[#EAE4D9]/80 hidden md:flex">
          <span>{new Date().toLocaleDateString('pt-BR')}</span>
          <span className="hidden sm:inline">| {clinicSettings.doctorName}</span>
        </div>
      </div>

      {/* Main Brand Section */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          
          {/* Logo & Clinical Title */}
          <div className="flex items-center gap-4">
            {/* Elegant Monogram Monolith matching uploaded AF Logo */}
            <div className="w-16 h-16 rounded-full bg-[#4E1119] flex items-center justify-center shadow-lg border border-[#C09553]/30 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-11 h-11 text-[#FAF8F5]">
                {/* Left Diagonal of A */}
                <path d="M 36 75 L 49 31" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Right Diagonal of A */}
                <path d="M 50 34 L 64 75" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Top bar of F */}
                <path d="M 48 31 L 67 31" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Middle bar of F */}
                <path d="M 53 49 L 63 49" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                {/* Curved dental smile arch / crossbar */}
                <path d="M 34 55 Q 50 78 67 55" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>
            
            <div>
              <h1 className="text-2xl font-serif text-[#4E1119] font-semibold tracking-tight">
                DR. AGNALDO FERREIRA
              </h1>
              <p className="text-xs font-sans tracking-widest text-[#B48C4D] uppercase font-semibold">
                ODONTOLOGIA RESTAURADORA
              </p>
              <div className="h-[2px] bg-gradient-to-r from-[#C29D64] via-[#E1CDAC] to-transparent mt-1.5 w-32" />
            </div>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex justify-end mr-2">
              {isAutosaving && (
                <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 animate-pulse bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></div>
                  Salvando no Drive...
                </div>
              )}
            </div>
            {setIsMobileOptimized && (
              <button
                onClick={() => setIsMobileOptimized(!isMobileOptimized)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm border ${
                  isMobileOptimized 
                    ? 'bg-zinc-800 text-white border-zinc-900 hover:bg-zinc-700' 
                    : 'bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50'
                }`}
                title="Alternar Modo Celular"
              >
                {isMobileOptimized ? (
                  <>
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Modo Desktop</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                    <span>Modo Celular</span>
                  </>
                )}
              </button>
            )}
            <button
              id="btn-logout"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-4 py-2 bg-white text-zinc-500 hover:text-red-700 border border-zinc-200 hover:bg-zinc-50 text-sm font-medium rounded-lg transition-all duration-200"
              title="Sair (Logout)"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>

        {/* Dynamic Patient Information Intake Card */}
        {currentView === 'planning' && activeTab === 'editor' && (
          <div className="mt-8 bg-white border border-[#E6DEC9] rounded-xl p-5 shadow-sm max-w-4xl animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-end">
              
              {/* Patient Name field */}
              <div className="md:col-span-5 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-[#B48C4D]" />
                  Nome do Paciente / Orçamento
                </label>
                <input
                  id="input-patient-name"
                  type="text"
                  placeholder="Ex: VALDERMON DA SILVA LOPES"
                  value={proposal.patientName}
                  onChange={(e) => setProposal((prev) => ({ ...prev, patientName: e.target.value.toUpperCase() }))}
                  className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#4E1119] focus:ring-1 focus:ring-[#4E1119] rounded-lg px-3.5 py-2 text-zinc-800 font-medium placeholder-zinc-400 focus:outline-none transition-all text-xs"
                />
              </div>

              {/* Notes / Caveats Field */}
              <div className="md:col-span-4 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-[#B48C4D]" />
                  Observações do Orçamento (Exibido no PDF)
                </label>
                <input
                  id="input-notes"
                  type="text"
                  placeholder="Ex: Orçamento feito sem radiografia..."
                  value={proposal.notes}
                  onChange={(e) => setProposal((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#4E1119] focus:ring-1 focus:ring-[#4E1119] rounded-lg px-3.5 py-2 text-zinc-700 text-xs placeholder-zinc-400 focus:outline-none transition-all"
                />
              </div>

              {/* Status do Orçamento (Balão) Column */}
              <div className="md:col-span-3 space-y-1.5">
                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B48C4D] inline-block" />
                  Status do Orçamento (Balão)
                </label>
                <select
                  id="panel-proposal-status"
                  value={proposal.status || 'Aberto (paciente não pagou)'}
                  onChange={(e) => setProposal((prev) => ({ ...prev, status: e.target.value as any }))}
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-bold focus:outline-none transition-colors ${
                    (proposal.status === 'Aprovado (paciente pagou)' || proposal.status === 'Concluído')
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                      : 'bg-rose-50 text-rose-800 border-rose-200 focus:border-rose-500 focus:ring-1 focus:ring-rose-500'
                  }`}
                >
                  <option value="Aberto (paciente não pagou)" className="bg-white text-rose-800 font-bold">🔴 Aberto (paciente nao pagou)</option>
                  <option value="Aprovado (paciente pagou)" className="bg-white text-emerald-800 font-bold">🟢 Aprovado (paciente pagou)</option>
                  <option value="Aguardando Aprovação" className="bg-white text-zinc-700">⏳ Aguardando Aprovação</option>
                  <option value="Em Andamento" className="bg-white text-zinc-700">🔄 Em Andamento</option>
                  <option value="Concluído" className="bg-white text-zinc-700">✅ Concluído</option>
                  <option value="Arquivado" className="bg-white text-zinc-700">📁 Arquivado</option>
                </select>
              </div>

            </div>
          </div>
        )}
      </div>
    </header>
  );
}
