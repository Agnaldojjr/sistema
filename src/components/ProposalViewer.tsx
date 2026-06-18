/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useMemo } from 'react';
import { FileDown, Printer, Receipt, Percent, CreditCard, ChevronRight, MessageSquareCode, X, ExternalLink, AlertCircle } from 'lucide-react';
import { PhotoSection, Procedure, TreatmentProposal, ClinicSettings } from '../types';
import PrintableLetterhead from './PrintableLetterhead';

interface ProposalViewerProps {
  sections: PhotoSection[];
  procedures: Procedure[];
  proposal: TreatmentProposal;
  setProposal: React.Dispatch<React.SetStateAction<TreatmentProposal>>;
  clinicSettings: ClinicSettings;
}

export default function ProposalViewer({
  sections,
  procedures,
  proposal,
  setProposal,
  clinicSettings,
}: ProposalViewerProps) {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [showIframePrintHelp, setShowIframePrintHelp] = useState(false);

  // Detect if the app is rendered inside an iframe, which blocks native window.print() API
  const isInsideIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  // Compute the procedures used on a per-section basis for the legends
  const getSectionProceduresUsed = (section: PhotoSection) => {
    const procedureIds = new Set<string>();
    section.markers.forEach((marker) => {
      marker.procedures.forEach((pid) => procedureIds.add(pid));
    });

    return Array.from(procedureIds)
      .map((pid) => procedures.find((p) => p.id === pid))
      .filter((p): p is Procedure => !!p);
  };

  // Compute subtotals
  const calculateSectionSubtotal = (section: PhotoSection) => {
    return section.markers.reduce((sum, marker) => {
      if (marker.procedureInstances && marker.procedureInstances.length > 0) {
        const markerSum = marker.procedureInstances.reduce((pSum, inst) => {
          return pSum + (inst.includeFinancial !== false ? inst.price : 0);
        }, 0);
        return sum + markerSum;
      }
      const markerSum = marker.procedures.reduce((pSum, pid) => {
        const proc = procedures.find((p) => p.id === pid);
        return pSum + (proc ? proc.price : 0);
      }, 0);
      return sum + markerSum;
    }, 0);
  };

  // Global calculations
  const grossTotal = sections.reduce((sum, s) => sum + calculateSectionSubtotal(s), 0);
  
  // PIX calculations
  const discountMultiplier = (100 - proposal.discountPercent) / 100;
  const totalWithPixDiscount = grossTotal * discountMultiplier;

  // Custom discount if they override
  const finalTotalCard = Math.max(0, grossTotal - proposal.customDiscountAmount);

  const handlePrint = () => {
    if (isInsideIframe) {
      setShowIframePrintHelp(true);
    }
    try {
      window.print();
    } catch (err) {
      console.warn("window.print() was blocked or errored inside the current frame context:", err);
    }
  };

  const activeSections = sections.filter((s) => s.markers.length > 0 || !!s.image);

  return (
    <div className="space-y-8">
      
      {/* 🌟 Premium Header with primary "Exportar Plano" Button at the Top */}
      <div className="bg-gradient-to-r from-[#4E1119] to-[#2D060B] border border-[#C09553]/40 rounded-xl p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div className="space-y-1">
          <span className="text-[10px] font-extrabold text-[#C09553] tracking-widest uppercase block">
            Painel de Exportação e Finalização
          </span>
          <h2 className="text-lg font-serif text-[#FAF8F5] font-semibold leading-tight">
            Orçamento Co-Participativo & Planejamento
          </h2>
          <p className="text-xs text-rose-200/70 max-w-xl leading-normal">
            Revise as condições comerciais, ajuste as frações do paciente e gere o documento PDF oficial com o mapa clínico interativo do tratamento.
          </p>
        </div>
        
        <button
          id="btn-export-plan-top"
          type="button"
          onClick={handlePrint}
          className="flex items-center justify-center gap-2.5 bg-[#C09553] hover:bg-[#A97E3B] text-[#FAF8F5] font-bold text-sm px-6 py-3 rounded-xl transition-all duration-200 shadow-lg cursor-pointer select-none group flex-shrink-0 active:scale-[0.98]"
        >
          <FileDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
          <span>Exportar Plano em PDF</span>
        </button>
      </div>

      {/* ⚙️ Financial Settings Box (Hides on Printing) */}
      <div className="bg-white border border-[#E6DEC9] rounded-xl p-5 shadow-sm space-y-4 print:hidden">
        <div>
          <h3 className="text-sm font-semibold text-[#4E1119] uppercase tracking-wider">
            Condições Comerciais e Descontos
          </h3>
          <p className="text-xs text-zinc-400">
            Customize as taxas, regras de desconto e parcelas exibidas no orçamento do paciente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Desconto PIX percentage */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
              <Percent className="w-3.5 h-3.5 text-[#B48C4D]" />
              % Desconto à Vista (PIX)
            </label>
            <div className="relative">
              <input
                id="prop-discount-pct"
                type="number"
                min="0"
                max="100"
                value={proposal.discountPercent}
                onChange={(e) => {
                  const val = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                  setProposal((prev) => ({
                    ...prev,
                    discountPercent: val,
                    pixDiscountLabel: `${val}% DESCONTO NO PIX`
                  }));
                }}
                className="w-full bg-[#FAF8F5] border border-[#D5CBB3] rounded-lg px-3 py-2 text-sm text-zinc-800 font-medium focus:outline-none focus:border-[#4E1119]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">%</span>
            </div>
          </div>

          {/* Parcelas */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-[#B48C4D]" />
              Limite de Parcelamento (Cartão)
            </label>
            <div className="relative">
              <input
                id="prop-installments"
                type="number"
                min="1"
                max="48"
                value={proposal.installments}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 12);
                  setProposal((prev) => ({
                    ...prev,
                    installments: val,
                    installmentsLabel: `Parcelamento em até ${val}x (com taxas).`
                  }));
                }}
                className="w-full bg-[#FAF8F5] border border-[#D5CBB3] rounded-lg px-3 py-2 text-sm text-zinc-800 font-medium focus:outline-none focus:border-[#4E1119]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">Vezes</span>
            </div>
          </div>

          {/* Desconto Manual Nominal */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wide flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-[#B48C4D]" />
              Abatimento / Desconto em Reais
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">R$</span>
              <input
                id="prop-manual-discount"
                type="number"
                min="0"
                value={proposal.customDiscountAmount}
                onChange={(e) => {
                  const val = Math.max(0, parseFloat(e.target.value) || 0);
                  setProposal((prev) => ({
                    ...prev,
                    customDiscountAmount: val
                  }));
                }}
                className="w-full bg-[#FAF8F5] border border-[#D5CBB3] pl-8 pr-3 py-2 text-sm text-zinc-800 font-medium rounded-lg focus:outline-none focus:border-[#4E1119]"
              />
            </div>
          </div>
        </div>

        {/* Action Button to Print */}
        <div className="pt-2 flex justify-end">
          <button
            id="btn-print-prop"
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#4E1119] hover:bg-[#6c1b26] text-[#FAF8F5] font-semibold text-sm px-6 py-2.5 rounded-lg transition-colors shadow-md cursor-pointer select-none"
          >
            <Printer className="w-4 h-4" />
            <span>Gerar PDF / Imprimir Orçamento</span>
          </button>
        </div>
      </div>

      {/* ========================================== */}
      {/* 📄 THE PRINTABLE DOCUMENT AREA            */}
      {/* ========================================== */}
      <div 
        id="printable-document-root" 
        ref={printAreaRef}
        className="w-full bg-[#FAF8F5] border border-[#E6DEC9] rounded-2xl shadow-lg relative font-sans text-zinc-800 max-w-5xl mx-auto overflow-hidden print:border-none print:shadow-none print:bg-white print:m-0"
      >
        {/* We use standard styling for screen and let the Letterhead naturally act as the envelope */}
        <PrintableLetterhead clinicSettings={clinicSettings}>
          {/* Internal Title specific to Proposal */}
          <div className="mb-8 mt-2 text-center sm:text-left border-b border-[#C09553]/40 pb-4">
            <h2 className="text-xl sm:text-2xl font-serif text-[#4E1119] font-medium uppercase tracking-tight">
              Orçamento de Tratamento Clínico {proposal.patientName ? `para ${proposal.patientName}` : ''}
            </h2>
            {proposal.notes && (
              <p className="text-xs text-rose-800 font-medium italic mt-2 font-serif">
                * {proposal.notes}
              </p>
            )}
          </div>

        {/* Empty layout prompt if no quadrants are active at all */}
        {activeSections.length === 0 && (
          <div className="py-16 text-center text-zinc-400 space-y-2">
            <p className="text-sm font-bold">Nenhum quadrant foi configurado.</p>
            <p className="text-xs">Utilize o painel acima para carregar uma simulação ou fazer upload de fotos da arcada do paciente para desenhar o plano didático.</p>
          </div>
        )}

        {/* Dynamic List of Active Mapped Quadrants */}
        <div className="space-y-12">
          {sections.map((section) => {
            const hasImg = !!section.image;
            const markers = section.markers;
            const usedProcs = getSectionProceduresUsed(section);
            const sectionTotal = calculateSectionSubtotal(section);

            // Skip rendering if no mapping nor image exists (clean output)
            if (!hasImg && markers.length === 0) return null;

            return (
              <div
                key={section.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center border-b border-[#E6DEC9]/60 pb-10 last:border-0"
              >
                
                {/* Visual Quad Representation (Col Span 6) */}
                <div className="md:col-span-6 space-y-2">
                  <span className="text-[11px] font-bold text-[#B48C4D] uppercase tracking-wider block font-sans">
                    FOTO: {section.title}
                  </span>
                  
                  {/* Absolute visual representation layer matching editor */}
                  <div className="relative w-full aspect-video sm:aspect-[4/3] rounded-2xl overflow-hidden shadow-md border border-[#E6DEC9] bg-zinc-950">
                    {hasImg ? (
                      <>
                        <img
                          src={section.image!}
                          alt={section.title}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />

                        {/* Flat tooth markers overlay matching screenshot */}
                        {markers.map((marker) => {
                          const size = proposal.markerSize || 26;
                          return (
                            <div
                              key={marker.id}
                              style={{
                                left: `${marker.x}%`,
                                top: `${marker.y}%`,
                                width: `${size}px`,
                                height: `${size}px`,
                                fontSize: `${Math.max(9, Math.round(size * 0.42))}px`,
                                transform: 'translate(-50%, -50%)',
                              }}
                              className="absolute rounded-full border border-zinc-200 bg-white shadow-md flex items-center justify-center font-bold text-zinc-950 select-none z-10"
                            >
                              <span>{marker.toothNumber}</span>

                              {/* Little color dot badges right on the edge */}
                              {marker.procedures.length > 0 && (
                                <div 
                                  className="absolute flex gap-0.5 justify-end"
                                  style={{
                                    bottom: `-${Math.round(size * 0.1)}px`,
                                    right: `-${Math.round(size * 0.1)}px`,
                                    maxWidth: `${size * 1.5}px`,
                                  }}
                                >
                                  {marker.procedures.map((procId, idx) => {
                                    const proc = procedures.find((p) => p.id === procId);
                                    if (!proc) return null;
                                    const dotSize = Math.max(5, Math.round(size * 0.3));
                                    return (
                                      <span
                                        key={`${procId}-${idx}`}
                                        className="rounded-full border border-white block"
                                        style={{ 
                                          backgroundColor: proc.color,
                                          width: `${dotSize}px`,
                                          height: `${dotSize}px`,
                                        }}
                                      />
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400 italic">
                        Ilustração não carregada
                      </div>
                    )}
                  </div>
                </div>

                {/* Subtotal & Legend Side (Col Span 6) */}
                <div className="md:col-span-6 space-y-4">
                  <div>
                    <h3 className="text-base font-serif font-semibold text-[#4E1119] tracking-tight uppercase">
                      {section.title}
                    </h3>
                    <p className="text-[11px] text-[#B48C4D] uppercase tracking-wider font-semibold font-sans mb-3">
                      DENTES POSTERIORES / ANTERIORES
                    </p>
                    <div className="h-[1px] bg-gradient-to-r from-[#C29D64] to-transparent w-full" />
                  </div>

                  {/* Legends list matching the original clinical record */}
                  <div className="space-y-2.5">
                    {usedProcs.length === 0 ? (
                      <p className="text-xs text-zinc-400 italic py-2">
                        Nenhum procedimento selecionado neste quadrante.
                      </p>
                    ) : (
                      usedProcs.map((proc) => {
                        // Count how many teeth have this clinical procedure
                        const teethWithThisProc = markers
                          .filter((m) => m.procedures.includes(proc.id))
                          .map((m) => m.toothNumber);

                        return (
                          <div key={proc.id} className="flex justify-between items-start gap-4 text-xs">
                            <div className="flex items-start gap-2.5 truncate">
                              {/* Representative Circle */}
                              <span
                                className="w-3.5 h-3.5 rounded-full mt-0.5 flex-shrink-0"
                                style={{ backgroundColor: proc.color }}
                              />
                              <div className="truncate">
                                <span className="font-medium text-zinc-800">{proc.name} </span>
                                {teethWithThisProc.length > 0 && (
                                  <span className="text-[10px] font-semibold text-[#B48C4D] bg-[#FAF8F5] border border-[#E6DEC9] px-1 py-0.2 rounded-sm font-mono whitespace-nowrap">
                                    Dente(s): {teethWithThisProc.join(', ')}
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <span className="font-mono text-zinc-700 text-right flex-shrink-0">
                              R$ {proc.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Observações de cada dente selecionado */}
                  {(() => {
                    const markersWithNotes = markers.filter((m) => m.notes && m.notes.trim() !== '');
                    if (markersWithNotes.length === 0) return null;
                    return (
                      <div className="pt-2 border-t border-[#E6DEC9]/60 space-y-1.5">
                        <span className="text-[10px] font-bold text-[#B48C4D] uppercase tracking-wider block font-sans">
                          Observações por Dente:
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {markersWithNotes.map((m) => (
                            <div key={m.id} className="text-xs bg-white border border-[#E6DEC9]/60 p-2 rounded-lg flex items-start gap-2 shadow-2xs">
                              <span className="bg-[#4E1119] text-[#FAF8F5] text-[9px] font-extrabold font-mono w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                {m.toothNumber}
                              </span>
                              <div className="space-y-0.5 leading-normal">
                                <span className="font-bold text-zinc-700 block text-[10.5px]">Dente {m.toothNumber}</span>
                                <p className="text-zinc-600 italic text-[11px]">"{m.notes}"</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Calculations card box for this quadrant */}
                  {sectionTotal > 0 && (
                    <div className="bg-[#FAF8F5] border border-[#E6DEC9] p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs font-bold text-[#4E1119] uppercase tracking-wide">
                          Subtotal do Quadrante:
                        </span>
                        <span className="font-mono font-bold text-base text-[#4E1119]">
                          R$ {sectionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      
                      <div className="h-[1px] bg-zinc-200/50 my-1 pb-1 border-b border-dashed border-zinc-200"/>
                      
                      <div className="space-y-0.5 text-[10.5px] text-zinc-500 font-medium">
                        <div className="flex justify-between">
                          <span className="text-rose-800 font-semibold">{proposal.pixDiscountLabel}:</span>
                          <span className="font-mono text-rose-800 font-semibold">
                            R$ {(sectionTotal * discountMultiplier).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-zinc-400">
                          <span>Cartão de Crédito:</span>
                          <span>{proposal.installmentsLabel}</span>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

              </div>
            );
          })}
        </div>

        {/* Global Summary Grand Total Panel (A4 document foot) */}
        {grossTotal > 0 && (
          <div className="mt-12 bg-white border-2 border-[#C09553] p-6 sm:p-8 rounded-2xl shadow-sm space-y-5">
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-zinc-100 pb-4 gap-4">
              <div>
                <h3 className="font-serif text-lg font-bold text-[#4E1119]">
                  PLANEJAMENTO INTEGRAL CONSOLIDADO
                </h3>
                <p className="text-xs text-zinc-400">
                  Resumo de todas as arcadas e planos integrados
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 font-extrabold uppercase tracking-widest block">
                  Valor Integral de Tabela
                </span>
                <span className="text-xl font-bold font-mono text-zinc-500 line-through">
                  R$ {grossTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Sub-item calculations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Option A: PIX discount */}
              <div className="bg-[#FAF8F5] border border-green-200/60 p-4.5 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-green-800 font-extrabold text-xs uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 block animate-pulse"/>
                  <span>Opção A: Desconto Especial à Vista</span>
                </div>
                
                <div className="pt-2">
                  <span className="text-[10px] text-zinc-500 block">PIX ou Transferência Direta ({proposal.discountPercent}% Off)</span>
                  <span className="text-2xl font-bold font-mono text-green-700 block">
                    R$ {totalWithPixDiscount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                
                <p className="text-[10px] text-zinc-400">
                  * Condição válida exclusivamente para pagamento e fechamento do contrato no ato da consulta clínica.
                </p>
              </div>

              {/* Option B: Credit card installment */}
              <div className="bg-[#FAF8F5] border border-[#E6DEC9] p-4.5 rounded-xl space-y-2">
                <div className="flex items-center gap-1.5 text-[#4E1119] font-extrabold text-xs uppercase tracking-wider">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#4E1119] block"/>
                  <span>Opção B: Financiamento no Cartão</span>
                </div>

                <div className="pt-2">
                  <span className="text-[10px] text-zinc-500 block">
                    Parcelamento em {proposal.installments} parcelas mensais de
                  </span>
                  <span className="text-2xl font-bold font-mono text-zinc-800 block">
                    R$ {(grossTotal / proposal.installments).toLocaleString('pt-BR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>

                <p className="text-[10px] text-zinc-400">
                  {proposal.installmentsLabel} Consulte tarifas detalhadas com nossa recepção administrativa.
                </p>
              </div>

            </div>

            {/* Custom discount check */}
            {proposal.customDiscountAmount > 0 && (
              <div className="bg-amber-50/40 border border-amber-300/40 p-4 rounded-xl text-xs flex justify-between items-center text-[#B48C4D]">
                <div>
                  <span className="font-bold uppercase tracking-wider block">Desconto Nominal Negociado</span>
                  <p className="text-zinc-500">Abatimento de crédito estabelecido pelo profissional</p>
                </div>
                <span className="text-lg font-bold font-mono">
                  - R$ {proposal.customDiscountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            {/* Signature Area (Visible when printed out on page floor) */}
            <div className="hidden print:flex flex-col sm:flex-row justify-between items-end pt-12 text-center text-xs text-zinc-400">
              <div className="space-y-1 w-full sm:w-auto text-left">
                <p className="text-zinc-400">Data de emissão: {new Date().toLocaleDateString('pt-BR')}</p>
                <p className="text-zinc-300">Documento impresso diretamente via Portal Restaura</p>
              </div>
              <div className="border-t border-[#C09553] pt-2 px-8 w-64 text-center mt-12 sm:mt-0 font-medium">
                <p className="text-[#4E1119]">{clinicSettings.doctorName}</p>
                <p className="text-zinc-400 text-[10px] uppercase">{clinicSettings.doctorRole}</p>
              </div>
            </div>

          </div>
        )}

        {/* Brand foot labels */}
        <div className="mt-10 border-t border-zinc-100 pt-5 text-center text-[10px] text-zinc-400 font-mono select-none flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>PORTAL DE TRATAMENTO INTERATIVO - REABILITAÇÃO CLÍNICA</span>
          <span>DR. AGNALDO FERREIRA - ODONTOLOGIA RESTAURADORA</span>
        </div>

        </PrintableLetterhead>
      </div>

      {/* ⚠️ Assistente de Impressão no Iframe */}
      {showIframePrintHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-xs animate-fade-in print:hidden">
          <div className="bg-[#FAF8F5] border-2 border-[#C09553] rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#4E1119] to-[#2D060B] text-white p-5 flex justify-between items-center border-b border-[#C09553]/30">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-[#C09553]" />
                <h3 className="font-serif font-semibold text-sm tracking-wide uppercase">Como Exportar o PDF Correto</h3>
              </div>
              <button 
                type="button"
                onClick={() => setShowIframePrintHelp(false)}
                className="text-zinc-300 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-4 text-zinc-700 leading-relaxed text-sm">
              <p className="text-zinc-600 font-medium">
                Detectamos que você está utilizando o app dentro do <strong className="text-[#4E1119]">painel interno de preview do editor</strong>. Por segurança, os navegadores impedem a geração de PDF diretamente de quadros incorporados (iframes).
              </p>

              <div className="bg-[#F5EFE3] border border-[#D5CBB3] p-4 rounded-xl space-y-3">
                <span className="font-bold text-xs text-[#4E1119] uppercase tracking-wide block">
                  Siga estes passos simples:
                </span>
                <ol className="list-decimal pl-5 space-y-2 text-xs md:text-sm text-zinc-700 font-medium font-sans">
                  <li>
                    Clique no botão <span className="bg-white border border-[#D5CBB3] px-1.5 py-0.5 rounded-md font-bold text-xs inline-flex items-center gap-1 shadow-2xs text-[#4E1119]">Abrir em Nova Aba <ExternalLink className="w-3 h-3" /></span> localizado no <strong>topo superior direito da tela de preview</strong> do AI Studio.
                  </li>
                  <li>
                    Na nova aba aberta que exibe seu aplicativo em tela cheia, clique novamente no botão <strong className="text-[#4E1119]">Exportar Plano em PDF</strong>.
                  </li>
                  <li>
                    No assistente de impressão do seu navegador, escolha a opção <strong className="text-[#4E1119]">"Salvar como PDF"</strong> o ou selecione a sua impressora física.
                  </li>
                  <li>
                    <strong className="text-[#C09553]">Dica Importante:</strong> Certifique-se de ativar a caixa <strong className="text-[#4E1119]">"Gráficos de plano de fundo" (Background graphics)</strong> nas configurações para que as fotos dos dentes e as bolinhas coloridas apareçam no documento final!
                  </li>
                </ol>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-[#F5EFE3] px-6 py-4 flex flex-col sm:flex-row gap-2 justify-end border-t border-[#E6DEC9] font-sans">
              <button
                type="button"
                onClick={() => {
                  try {
                    window.print();
                  } catch (e) {}
                }}
                className="order-2 sm:order-1 px-4 py-2 text-xs font-bold text-zinc-500 hover:text-zinc-700 transition-colors cursor-pointer"
              >
                Tentar imprimir mesmo assim
              </button>
              <button
                type="button"
                onClick={() => setShowIframePrintHelp(false)}
                className="order-1 sm:order-2 bg-[#4E1119] hover:bg-[#6c1b26] text-white font-bold text-xs px-6 py-2.5 rounded-lg transition-colors shadow-md cursor-pointer text-center"
              >
                Entendi, vou para a nova aba!
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
