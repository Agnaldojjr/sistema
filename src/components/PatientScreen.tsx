import React, { useState, useEffect, useMemo } from 'react';
import { Coins, TrendingUp, CheckCircle2 } from 'lucide-react';
import { PhotoSection, Procedure, TreatmentProposal } from '../types';
import { TON_RATES } from './NegotiationTab';

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);
};

// Custom hook to reactively track localStorage
function useReactiveLocalStorage<T>(key: string, defaultValue: T): T {
  const [value, setValue] = useState<T>(() => {
    const cached = localStorage.getItem(key);
    if (!cached) return defaultValue;
    try { return JSON.parse(cached); } catch { return cached as any; }
  });

  useEffect(() => {
    // Keep track of the last processed string representation to prevent unnecessary state resets
    let lastRawValue = localStorage.getItem(key);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        lastRawValue = e.newValue;
        try { setValue(JSON.parse(e.newValue)); } catch { setValue(e.newValue as any); }
      } else if (e.key === null) {
        const cached = localStorage.getItem(key);
        lastRawValue = cached;
        if (cached) {
          try { setValue(JSON.parse(cached)); } catch { setValue(cached as any); }
        } else {
          setValue(defaultValue);
        }
      }
    };

    window.addEventListener('storage', handleStorage);

    // Fast polling interval (200ms) to ensure instant updates in iframe/sandbox environments
    // where storage events might be restricted or blocked by security policies
    const pollInterval = setInterval(() => {
      const currentRawValue = localStorage.getItem(key);
      if (currentRawValue !== lastRawValue) {
        lastRawValue = currentRawValue;
        if (currentRawValue) {
          try {
            setValue(JSON.parse(currentRawValue));
          } catch {
            setValue(currentRawValue as any);
          }
        } else {
          setValue(defaultValue);
        }
      }
    }, 200);

    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(pollInterval);
    };
  }, [key, defaultValue]);

  return value;
}

export default function PatientScreen({ hideSimulation = false, hideProcedures = false }: { hideSimulation?: boolean, hideProcedures?: boolean }) {
  const sections = useReactiveLocalStorage<PhotoSection[]>('agnaldo_dent_sections', []);
  const procedures = useReactiveLocalStorage<Procedure[]>('agnaldo_dent_procedures', []);
  const proposal = useReactiveLocalStorage<TreatmentProposal>('agnaldo_dent_proposal', {} as any);

  const salesVolume = useReactiveLocalStorage<'under_3' | 'between_3_6'>('ag_neg_sales_volume', 'under_3');
  const cardBrand = useReactiveLocalStorage<'visa_master' | 'elo_amex'>('ag_neg_card_brand', 'visa_master');
  const installments = useReactiveLocalStorage<number>('ag_neg_installments', 12);
  const percentSim1 = useReactiveLocalStorage<number>('ag_neg_pct_sim1', 30);
  const percentSim2 = useReactiveLocalStorage<number>('ag_neg_pct_sim2', 50);
  const patientOfferInput = useReactiveLocalStorage<number>('ag_neg_offer_input', 500);
  const selectedPlanIndex = useReactiveLocalStorage<number>('ag_neg_selected_plan', 1);
  const showInPatientScreen = useReactiveLocalStorage<boolean[]>('ag_neg_show_patient_sims', [false, true, false, false]);
  const customNetDesiredRaw = useReactiveLocalStorage<string | null>('ag_neg_custom_net', null);
  const customNetDesired = customNetDesiredRaw !== null ? parseFloat(customNetDesiredRaw as string) : null;

  // Calculate gross total
  const calculatedGrossTotal = useMemo(() => {
    return sections.reduce((secSum, sec) => {
      return secSum + sec.markers.reduce((markSum, marker) => {
        if (marker.procedureInstances && marker.procedureInstances.length > 0) {
          return markSum + marker.procedureInstances.reduce((procSum, inst) => {
            return procSum + (inst.includeFinancial !== false ? inst.price : 0);
          }, 0);
        }
        return markSum + marker.procedures.reduce((procSum, pid) => {
          const proc = procedures.find((p) => p.id === pid);
          return procSum + (proc ? proc.price : 0);
        }, 0);
      }, 0);
    }, 0);
  }, [sections, procedures]);

  const desiredNet = customNetDesired !== null && !isNaN(customNetDesired) ? customNetDesired : calculatedGrossTotal;

  // Compute machine fee percentage for current selection
  const machineFeePercent = useMemo(() => {
    if (!TON_RATES[salesVolume]) return 0;
    const activeRates = TON_RATES[salesVolume][cardBrand];
    const index = Math.min(11, Math.max(0, installments - 1));
    return activeRates[index];
  }, [salesVolume, cardBrand, installments]);

  const machineFeeDecimal = machineFeePercent / 100;

  // Max allowed installments by rule
  const maxInstallmentsRule = useMemo(() => {
    let baseMax = 6;
    if (desiredNet <= 500) baseMax = 1;
    else if (desiredNet <= 1000) baseMax = 3;
    else if (desiredNet <= 2000) baseMax = 4;
    
    if (!TON_RATES[salesVolume]) return baseMax;
    const activeRates = TON_RATES[salesVolume][cardBrand];
    let maxInstallmentsByRate = 12;
    for (let i = 0; i < 12; i++) {
      if (activeRates[i] > 14) {
        maxInstallmentsByRate = i > 0 ? i : 1;
        break;
      }
    }

    return Math.min(baseMax, maxInstallmentsByRate);
  }, [desiredNet, salesVolume, cardBrand]);

  // Compile calculations for each of the 4 columns
  const simulations = useMemo(() => {
    const isExceeded = installments > maxInstallmentsRule;
    const effectiveFeeDecimal = isExceeded ? machineFeeDecimal : 0;

    const e0 = 0;
    const r0 = desiredNet;
    const ch0 = r0 / (1 - effectiveFeeDecimal);
    const inst0 = ch0 / installments;
    const t0 = e0 + ch0;

    const e1 = (desiredNet * percentSim1) / 100;
    const r1 = desiredNet - e1;
    const ch1 = r1 / (1 - effectiveFeeDecimal);
    const inst1 = ch1 / installments;
    const t1 = e1 + ch1;

    const e2 = (desiredNet * percentSim2) / 100;
    const r2 = desiredNet - e2;
    const ch2 = r2 / (1 - effectiveFeeDecimal);
    const inst2 = ch2 / installments;
    const t2 = e2 + ch2;

    const e3 = Math.min(desiredNet, Math.max(0, patientOfferInput));
    const r3 = desiredNet - e3;
    const ch3 = r3 / (1 - effectiveFeeDecimal);
    const inst3 = ch3 / installments;
    const t3 = e3 + ch3;

    return [
      {
        name: '100% no Cartão',
        label: 'Sem Entrada',
        entrada: e0,
        cobradoCard: ch0,
        valorParcela: inst0,
        custoTotal: t0,
        economia: 0,
      },
      {
        name: 'Simulação 1',
        label: `Entrada (${percentSim1}%)`,
        entrada: e1,
        cobradoCard: ch1,
        valorParcela: inst1,
        custoTotal: t1,
        economia: Math.max(0, t0 - t1),
      },
      {
        name: 'Simulação 2',
        label: `Entrada (${percentSim2}%)`,
        entrada: e2,
        cobradoCard: ch2,
        valorParcela: inst2,
        custoTotal: t2,
        economia: Math.max(0, t0 - t2),
      },
      {
        name: 'Oferta Paciente',
        label: 'Entrada Customizada',
        entrada: e3,
        cobradoCard: ch3,
        valorParcela: inst3,
        custoTotal: t3,
        economia: Math.max(0, t0 - t3),
      }
    ];
  }, [desiredNet, machineFeeDecimal, installments, percentSim1, percentSim2, patientOfferInput, maxInstallmentsRule]);

  const visibleSimulationsCount = useMemo(() => {
    const array = Array.isArray(showInPatientScreen) ? showInPatientScreen : [false, true, false, false];
    const checkedCount = array.filter(Boolean).length;
    return checkedCount === 0 ? 1 : checkedCount;
  }, [showInPatientScreen]);

  const isSimVisible = (index: number) => {
    const array = Array.isArray(showInPatientScreen) ? showInPatientScreen : [false, true, false, false];
    const noneChecked = array.every(v => !v);
    if (noneChecked) {
      return index === selectedPlanIndex;
    }
    return !!array[index];
  };

  const proceduresListOnMapeamento = useMemo(() => {
    const list: Array<{
      id: string;
      toothNumber: number;
      procedureName: string;
      price: number;
    }> = [];

    sections.forEach((sec) => {
      sec.markers.forEach((marker) => {
        if (marker.procedureInstances && marker.procedureInstances.length > 0) {
          marker.procedureInstances.forEach((inst) => {
            if (inst.includeFinancial !== false) {
              list.push({
                id: inst.id,
                toothNumber: marker.toothNumber,
                procedureName: inst.name,
                price: inst.price,
              });
            }
          });
        } else {
          marker.procedures.forEach((pid) => {
            const proc = procedures.find((p) => p.id === pid);
            if (proc) {
              list.push({
                id: `${sec.id}-${marker.id}-${pid}`,
                toothNumber: marker.toothNumber,
                procedureName: proc.name,
                price: proc.price,
              });
            }
          });
        }
      });
    });

    return list;
  }, [sections, procedures]);

  // View Helpers
  const getSectionProceduresUsed = (section: PhotoSection) => {
    return procedures.filter((p) =>
      section.markers.some((m) => {
        if (m.procedureInstances && m.procedureInstances.length > 0) {
          return m.procedureInstances.some((inst) => inst.procedureId === p.id);
        }
        return m.procedures.includes(p.id);
      })
    );
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-zinc-800 font-sans p-6 selection:bg-[#4E1119] selection:text-white">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Clinica Logo and Monogram Header Block */}
        <div className="border-b border-[#C09553]/40 pb-6 mb-6 text-center sm:text-left flex flex-col sm:flex-row justify-between items-center sm:items-start gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold text-[#B48C4D] tracking-widest uppercase">
              DR. AGNALDO FERREIRA — ODONTOLOGIA AVANÇADA
            </span>
            <h2 className="text-2xl font-serif text-[#4E1119] font-bold uppercase tracking-tight leading-tight">
              Plano de Tratamento
            </h2>
            <div className="text-sm text-zinc-600 font-sans mt-0.5">
              Paciente: <strong className="text-zinc-800">{proposal.patientName || 'Não Informado'}</strong>
            </div>
          </div>
          
          <div className="w-16 h-16 rounded-full bg-[#4E1119] flex items-center justify-center border-2 border-[#C09553]/30 flex-shrink-0 shadow-sm">
            <svg viewBox="0 0 100 100" className="w-10 h-10 text-[#FAF8F5]">
              <path d="M 36 75 L 49 31" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M 50 34 L 64 75" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M 48 31 L 67 31" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M 53 49 L 63 49" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M 34 55 Q 50 78 67 55" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
        </div>

        {/* Dynamic List of Active Mapped Quadrants */}
        <div className="space-y-12">
          {sections.map((section) => {
            const hasImg = !!section.image;
            const markers = section.markers;
            const usedProcs = getSectionProceduresUsed(section);

            // Skip rendering if no mapping nor image exists (clean output)
            if (!hasImg && markers.length === 0) return null;

            return (
              <div
                key={section.id}
                className="bg-white border border-[#E6DEC9] rounded-2xl p-6 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-8 items-start"
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

                        {/* Flat tooth markers overlay */}
                        {markers.map((marker) => {
                          const size = proposal.markerSize || 26;
                          const markerProcs = (marker.procedureInstances && marker.procedureInstances.length > 0)
                            ? marker.procedureInstances.map((inst) => inst.procedureId)
                            : marker.procedures;
                          const hasP21 = markerProcs.includes('p_21');

                          return (
                            <div
                              key={marker.id}
                              style={{
                                left: `${marker.x}%`,
                                top: `${marker.y}%`,
                                width: `${size}px`,
                                height: `${size}px`,
                                fontSize: hasP21 ? `${Math.max(8, Math.round(size * 0.35))}px` : `${Math.max(9, Math.round(size * 0.42))}px`,
                                transform: 'translate(-50%, -50%)',
                              }}
                              className="absolute rounded-full border border-zinc-200 bg-white shadow-md flex items-center justify-center font-bold text-zinc-950 select-none z-10"
                            >
                              {hasP21 ? (
                                <div className="flex flex-col items-center justify-center -mt-1">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-teal-600" style={{ width: `${size * 0.55}px`, height: `${size * 0.55}px` }}>
                                    <path d="M7 5h10M9 9h6M10 13h4M11 17h2M8 5v14a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V5M12 2v3" />
                                  </svg>
                                  <span className="absolute -bottom-2.5 bg-white border border-teal-600 text-teal-700 px-1 rounded-sm shadow-sm leading-none" style={{ fontSize: `${Math.max(8, Math.round(size * 0.3))}px` }}>
                                    {marker.toothNumber}
                                  </span>
                                </div>
                              ) : (
                                <span>{marker.toothNumber}</span>
                              )}

                              {/* Little color dot badges right on the edge */}
                              {markerProcs.length > 0 && (
                                <div 
                                  className="absolute flex gap-0.5 justify-end"
                                  style={{
                                    bottom: `-${Math.round(size * 0.1)}px`,
                                    right: `-${Math.round(size * 0.1)}px`,
                                    maxWidth: `${size * 1.5}px`,
                                  }}
                                >
                                  {markerProcs.map((procId, idx) => {
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

                {/* Legend Side (Col Span 6) */}
                <div className="md:col-span-6 space-y-4">
                  <div>
                    <h3 className="text-base font-serif font-semibold text-[#4E1119] tracking-tight uppercase">
                      {section.title}
                    </h3>
                    <p className="text-[11px] text-[#B48C4D] uppercase tracking-wider font-semibold font-sans mb-3">
                      Gabarito de Procedimentos
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

                </div>
              </div>
            );
          })}
        </div>

        {/* Procedures Table */}
        {!hideProcedures && (
          <div className="bg-white border border-[#E6DEC9] rounded-2xl p-6 shadow-sm">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-3 mb-4">
              <h4 className="text-sm font-bold text-[#4E1119] uppercase tracking-wider">
                Diagnóstico de Mapeamento Clínico
              </h4>
              <span className="text-xs font-mono text-zinc-500 font-bold">
                Total Mapeado: {proceduresListOnMapeamento.length} itens
              </span>
            </div>

            {proceduresListOnMapeamento.length === 0 ? (
              <div className="py-6 text-center text-zinc-400 italic text-sm">
                Nenhum procedimento foi mapeado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-sm">
                  <thead>
                    <tr className="border-b border-[#E6DEC9]/40 bg-[#FAF8F5] text-[#4E1119]">
                      <th className="py-2.5 px-3 font-bold text-xs uppercase w-20">Dente</th>
                      <th className="py-2.5 px-3 font-bold text-xs uppercase">Procedimento</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {proceduresListOnMapeamento.map((item, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="py-2.5 px-3 font-mono text-xs text-zinc-900 font-bold">
                          Dente {item.toothNumber}
                        </td>
                        <td className="py-2.5 px-3 text-zinc-700 font-medium">
                          {item.procedureName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SIMULATION CALCULATOR GRID */}
        {!hideSimulation && (
          <div className="bg-white border border-[#E6DEC9] rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h4 className="font-serif font-bold text-[#4E1119] text-base tracking-tight uppercase flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#B48C4D]" />
                Simulador de Condições de Pagamento
              </h4>
              <p className="text-sm text-zinc-500 leading-normal mt-1">
                Opções de parcelamento facilitado em até {installments} vezes na maquininha.
              </p>
            </div>

            <div className={`grid gap-6 ${
              visibleSimulationsCount === 1 
                ? 'grid-cols-1 max-w-md mx-auto' 
                : visibleSimulationsCount === 2 
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto' 
                  : visibleSimulationsCount === 3 
                    ? 'grid-cols-1 sm:grid-cols-3 max-w-4xl mx-auto' 
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}>
              {simulations.map((sim, index) => {
                if (!isSimVisible(index)) return null;
                const isSelected = selectedPlanIndex === index;
                return (
                  <div
                    key={index}
                    className={`border-2 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 relative ${
                      isSelected
                        ? 'border-[#C09553] bg-[#FAF8F5] shadow-lg scale-105 z-10'
                        : 'border-zinc-200 bg-white opacity-80 scale-95'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#C09553] text-[#FAF8F5] text-[9px] font-extrabold tracking-widest px-3 py-1 rounded-full uppercase flex items-center gap-1 shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                        Proposta Oficial
                      </span>
                    )}

                    <div className="space-y-4">
                      <div className="text-center font-sans border-b border-zinc-100 pb-3">
                        <span className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase block">{sim.label}</span>
                        <strong className="text-base font-serif text-[#4E1119] block mt-1">{sim.name}</strong>
                      </div>

                      <div className="divide-y divide-zinc-100 font-sans text-sm">
                        <div className="py-2 flex justify-between items-center">
                          <span className="text-zinc-500 font-medium text-xs">Entrada (PIX/Dinheiro):</span>
                          <strong className="text-[#896A39] font-mono font-bold text-sm bg-[#FAF8F5] border border-[#E6DEC9] px-2 py-0.5 rounded-md">{formatCurrency(sim.entrada)}</strong>
                        </div>

                        <div className="py-3 text-center bg-zinc-50 border border-zinc-100 rounded-xl my-2">
                          <span className="text-xs text-zinc-400 uppercase tracking-wide block font-semibold mb-1">Restante na Maquininha</span>
                          <strong className="text-lg font-bold text-[#4E1119] block font-mono">
                            {installments}x de <span className="text-[#B48C4D]">{formatCurrency(sim.valorParcela)}</span>
                          </strong>
                        </div>

                        <div className="py-2.5 flex justify-between items-center bg-[#F5EFE3]/50 px-2 rounded-lg mt-2">
                          <span className="text-[#4E1119] font-bold text-xs uppercase tracking-wide">CUSTO TOTAL:</span>
                          <strong className="text-zinc-900 font-mono font-bold text-[15px]">{formatCurrency(sim.custoTotal)}</strong>
                        </div>

                        {sim.economia > 0 && (
                          <div className="py-2.5 flex justify-between items-center text-green-700 font-sans font-bold">
                            <span className="text-[11px] uppercase tracking-wide flex items-center gap-1">
                              <TrendingUp className="w-3.5 h-3.5 text-green-500" /> Economia:
                            </span>
                            <span className="font-mono text-xs bg-green-50 border border-green-200 px-2 py-1 rounded-md">
                              {formatCurrency(sim.economia)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
