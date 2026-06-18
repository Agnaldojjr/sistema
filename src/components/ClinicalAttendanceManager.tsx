/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Lock, 
  Unlock, 
  Trash2, 
  Edit, 
  User, 
  Calendar as CalendarIcon, 
  DollarSign, 
  Check, 
  Clock, 
  X, 
  AlertCircle, 
  ClipboardList, 
  Plus, 
  ShieldAlert, 
  Bookmark, 
  UserCheck 
} from 'lucide-react';
import { PhotoSection, ToothMarker, Procedure, TreatmentProposal } from '../types';

interface ClinicalAttendanceManagerProps {
  sections: PhotoSection[];
  procedures: Procedure[];
  onUpdateSections: (updatedSections: PhotoSection[]) => void;
  proposal: TreatmentProposal;
  setProposal: React.Dispatch<React.SetStateAction<TreatmentProposal>>;
}

// Interfaces for our normalized instances
export interface ProcedureInstance {
  id: string; // unique instance ID
  sectionId: string;
  sectionTitle: string;
  markerId: string;
  toothNumber: number;
  procedureId: string;
  name: string;
  price: number;
  includeFinancial: boolean;
  status: 'A realizar' | 'Realizado' | 'Em andamento' | 'Cancelado';
  date: string;
  dentist: string;
  faces: string[];
  observation: string;
}

const PRESET_DENTISTS = [
  'Dr. Agnaldo',
  'Dra. Ana',
  'Dr. Carlos',
  'Dra. Beatriz'
];

const PRESET_FACES = [
  'LINGUAL',
  'PALATINA',
  'DISTAL',
  'MESIAL',
  'INCISAL',
  'VESTIBULAR'
];

export default function ClinicalAttendanceManager({
  sections,
  procedures,
  onUpdateSections,
  proposal,
  setProposal,
}: ClinicalAttendanceManagerProps) {
  
  // Modal editor states
  const [editingInstance, setEditingInstance] = useState<ProcedureInstance | null>(null);
  const [lockedPrices, setLockedPrices] = useState<{ [instanceId: string]: boolean }>({});
  const [customDentist, setCustomDentist] = useState('');
  const [showCustomDentistInput, setShowCustomDentistInput] = useState(false);

  // Derive and normalize all procedure instances across all sections and markers
  const allInstances = useMemo(() => {
    const list: ProcedureInstance[] = [];
    
    sections.forEach((sec) => {
      sec.markers.forEach((marker) => {
        // If marker has explicit procedureInstances, use them
        if (marker.procedureInstances && marker.procedureInstances.length > 0) {
          marker.procedureInstances.forEach((inst) => {
            list.push({
              id: inst.id,
              sectionId: sec.id,
              sectionTitle: sec.title,
              markerId: marker.id,
              toothNumber: marker.toothNumber,
              procedureId: inst.procedureId,
              name: inst.name,
              price: inst.price,
              includeFinancial: inst.includeFinancial !== false,
              status: inst.status || 'A realizar',
              date: inst.date || '',
              dentist: inst.dentist || '',
              faces: inst.faces || [],
              observation: inst.observation || '',
            });
          });
        } else {
          // Fallback legacy synchronization: map from procedures ID list
          marker.procedures.forEach((pid, idx) => {
            const proc = procedures.find((p) => p.id === pid);
            if (proc) {
              list.push({
                id: `${marker.id}-${pid}-${idx}`,
                sectionId: sec.id,
                sectionTitle: sec.title,
                markerId: marker.id,
                toothNumber: marker.toothNumber,
                procedureId: pid,
                name: proc.name,
                price: proc.price,
                includeFinancial: true,
                status: 'A realizar',
                date: '',
                dentist: '',
                faces: [],
                observation: '',
              });
            }
          });
        }
      });
    });

    return list;
  }, [sections, procedures]);

  // Update a specific instance attributes back to sections state
  const handleUpdateInstance = (instanceId: string, updates: Partial<ProcedureInstance>) => {
    const target = allInstances.find((inst) => inst.id === instanceId);
    if (!target) return;

    const updatedSections = sections.map((sec) => {
      if (sec.id !== target.sectionId) return sec;

      return {
        ...sec,
        markers: sec.markers.map((marker) => {
          if (marker.id !== target.markerId) return marker;

          // Get current instances or build from legacy procedures list
          let currentInstances = marker.procedureInstances;
          if (!currentInstances || currentInstances.length === 0) {
            currentInstances = marker.procedures.map((pid, idx) => {
              const proc = procedures.find((p) => p.id === pid);
              return {
                id: `${marker.id}-${pid}-${idx}`,
                procedureId: pid,
                name: proc ? proc.name : 'Procedimento',
                price: proc ? proc.price : 0,
                includeFinancial: true,
                status: 'A realizar',
                date: '',
                dentist: '',
                faces: [],
                observation: '',
              };
            });
          }

          // Apply updates to target instance
          const updatedInstances = currentInstances.map((inst) => {
            if (inst.id === instanceId) {
              return {
                ...inst,
                ...updates,
              };
            }
            return inst;
          });

          // Keep markers.procedures in sync with index mappings
          const updatedProceduresList = updatedInstances.map((inst) => inst.procedureId);

          return {
            ...marker,
            procedures: updatedProceduresList,
            procedureInstances: updatedInstances,
          };
        }),
      };
    });

     onUpdateSections(updatedSections);
  };

  // Delete/Remove procedure instance
  const handleDeleteInstance = (instanceId: string) => {
    const target = allInstances.find((inst) => inst.id === instanceId);
    if (!target) return;

    const updatedSections = sections.map((sec) => {
      if (sec.id !== target.sectionId) return sec;

      return {
        ...sec,
        markers: sec.markers.map((marker) => {
          if (marker.id !== target.markerId) return marker;

          let currentInstances = marker.procedureInstances;
          if (!currentInstances || currentInstances.length === 0) {
            currentInstances = marker.procedures.map((pid, idx) => {
              const proc = procedures.find((p) => p.id === pid);
              return {
                id: `${marker.id}-${pid}-${idx}`,
                procedureId: pid,
                name: proc ? proc.name : 'Procedimento',
                price: proc ? proc.price : 0,
                includeFinancial: true,
                status: 'A realizar',
                date: '',
                dentist: '',
                faces: [],
                observation: '',
              };
            });
          }

          const updatedInstances = currentInstances.filter((inst) => inst.id !== instanceId);
          const updatedProceduresList = updatedInstances.map((inst) => inst.procedureId);

          // If no instances/procedures are left on this marker, do we keep the marker?
          // We can keep the marker or clear it. Let's keep it but without procedures.
          return {
            ...marker,
            procedures: updatedProceduresList,
            procedureInstances: updatedInstances,
          };
        }),
      };
    });

    onUpdateSections(updatedSections);
  };

  // Setup edit modal fields
  const openEditModal = (inst: ProcedureInstance) => {
    setEditingInstance({ ...inst });
    if (inst.dentist && !PRESET_DENTISTS.includes(inst.dentist)) {
      setCustomDentist(inst.dentist);
      setShowCustomDentistInput(true);
    } else {
      setCustomDentist('');
      setShowCustomDentistInput(false);
    }
  };

  const handleSaveModal = () => {
    if (!editingInstance) return;

    const finalDentist = showCustomDentistInput ? customDentist : editingInstance.dentist;
    
    handleUpdateInstance(editingInstance.id, {
      name: editingInstance.name,
      toothNumber: editingInstance.toothNumber,
      price: editingInstance.price,
      status: editingInstance.status,
      date: editingInstance.status === 'Realizado' ? (editingInstance.date || new Date().toISOString().split('T')[0]) : '',
      dentist: finalDentist,
      faces: editingInstance.faces,
      observation: editingInstance.observation,
    });

    // If teeth number was changed inside edit modal, reorganise marker section structure
    if (editingInstance.toothNumber !== allInstances.find((i) => i.id === editingInstance.id)?.toothNumber) {
      handleChangeToothNumber(editingInstance.id, editingInstance.toothNumber);
    }

    setEditingInstance(null);
  };

  const handleChangeToothNumber = (instanceId: string, newToothNum: number) => {
    // Relocate this procedure instance to the correct tooth marker (or create it if not active)
    const target = allInstances.find((inst) => inst.id === instanceId);
    if (!target) return;

    // Detect which quadrant/section has the incoming tooth
    // Standard logic in PhotoEditor lists 18-11 & 21-28 for upper, 31-38 & 41-48 for lower
    const isUpper = (newToothNum >= 11 && newToothNum <= 28) || (newToothNum >= 51 && newToothNum <= 65);
    const targetSectionId = isUpper ? 'upper' : 'lower';

    const updatedSections = sections.map((sec) => {
      // Step 1: Remove from old marker
      if (sec.id === target.sectionId) {
        sec.markers = sec.markers.map((marker) => {
          if (marker.id !== target.markerId) return marker;
          const remainingInsts = (marker.procedureInstances || []).filter((i) => i.id !== instanceId);
          return {
            ...marker,
            procedures: remainingInsts.map((i) => i.procedureId),
            procedureInstances: remainingInsts,
          };
        });
      }

      // Step 2: Add into target marker (find existing or create one)
      if (sec.id === targetSectionId) {
        let existingMarker = sec.markers.find((m) => m.toothNumber === newToothNum);
        
        if (existingMarker) {
          sec.markers = sec.markers.map((marker) => {
            if (marker.toothNumber !== newToothNum) return marker;
            
            const currentInsts = marker.procedureInstances || [];
            const originalInst = allInstances.find((i) => i.id === instanceId);
            if (!originalInst) return marker;

            const updatedInsts = [
              ...currentInsts,
              {
                id: originalInst.id,
                procedureId: originalInst.procedureId,
                name: originalInst.name,
                price: originalInst.price,
                includeFinancial: originalInst.includeFinancial,
                status: originalInst.status,
                date: originalInst.date,
                dentist: originalInst.dentist,
                faces: originalInst.faces,
                observation: originalInst.observation,
              }
            ];

            return {
              ...marker,
              procedures: updatedInsts.map((i) => i.procedureId),
              procedureInstances: updatedInsts,
            };
          });
        } else {
          // Create new marker at center of grid
          const originalInst = allInstances.find((i) => i.id === instanceId);
          if (originalInst) {
            const newMarker: ToothMarker = {
              id: `m-${Date.now()}-${newToothNum}`,
              toothNumber: newToothNum,
              x: 50,
              y: 50,
              procedures: [originalInst.procedureId],
              procedureInstances: [
                {
                  id: originalInst.id,
                  procedureId: originalInst.procedureId,
                  name: originalInst.name,
                  price: originalInst.price,
                  includeFinancial: originalInst.includeFinancial,
                  status: originalInst.status,
                  date: originalInst.date,
                  dentist: originalInst.dentist,
                  faces: originalInst.faces,
                  observation: originalInst.observation,
                }
              ]
            };
            sec.markers = [...sec.markers, newMarker];
          }
        }
      }

      // Clean empty markers
      sec.markers = sec.markers.filter((m) => m.procedures.length > 0 || (m.procedureInstances && m.procedureInstances.length > 0));
      return sec;
    });

    onUpdateSections(updatedSections);
  };

  const getToothArcada = (num: number) => {
    const isUpper = (num >= 11 && num <= 28) || (num >= 51 && num <= 65);
    return isUpper ? 'Arcada Superior' : 'Arcada Inferior';
  };

  const handleToggleFace = (face: string) => {
    if (!editingInstance) return;
    const currentFaces = editingInstance.faces || [];
    const hasFace = currentFaces.includes(face);
    const updatedFaces = hasFace 
      ? currentFaces.filter((f) => f !== face) 
      : [...currentFaces, face];
    
    setEditingInstance({
      ...editingInstance,
      faces: updatedFaces,
    });
  };

  // Calculated subtotals for admin header status
  const summaryRealized = useMemo(() => {
    return allInstances.filter((i) => i.status === 'Realizado').length;
  }, [allInstances]);

  const summaryFinancialTotal = useMemo(() => {
    return allInstances
      .filter((i) => i.includeFinancial)
      .reduce((sum, i) => sum + i.price, 0);
  }, [allInstances]);

  return (
    <div id="clinical-attendance-manager-container" className="bg-[#FAF8F5] border-2 border-[#C09553]/30 rounded-2xl p-5 md:p-6 shadow-sm space-y-6">
      
      {/* Header and status banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#E6DEC9]/60 pb-5">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#8B0000] flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-[#C09553]" />
            <span>Administrar Atendimentos de cada Procedimento</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            Lance datas de consultas, selecione as faces tratadas, defina profissionais e controle a situação de cada dente.
          </p>
        </div>

        {/* Mini stats balloons */}
        <div className="flex flex-wrap gap-2">
          {/* Status do Orçamento */}
          <div className="bg-white border border-[#E6DEC9] p-2.5 rounded-xl flex items-center gap-3 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Status:</span>
            <select
              value={proposal.status || 'Aberto (paciente não pagou)'}
              onChange={(e) => setProposal((prev) => ({ ...prev, status: e.target.value as any }))}
              className={`text-xs font-bold px-2.5 py-1 rounded-full cursor-pointer border focus:outline-none transition-colors ${
                (proposal.status === 'Aprovado (paciente pagou)' || proposal.status === 'Concluído')
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              <option value="Aberto (paciente não pagou)">🔴 Aberto (paciente nao pagou)</option>
              <option value="Aprovado (paciente pagou)">🟢 Aprovado (paciente pagou)</option>
              <option value="Aguardando Aprovação">⏳ Aguardando Aprovação</option>
              <option value="Em Andamento">🔄 Em Andamento</option>
              <option value="Concluído">✅ Concluído</option>
              <option value="Arquivado">📁 Arquivado</option>
            </select>
          </div>

          <div className="bg-white border border-[#E6DEC9] px-3 py-2 rounded-xl text-center shadow-2xs">
            <div className="text-[9px] uppercase font-bold text-zinc-400">Total</div>
            <div className="text-xs font-bold text-[#8B0000]">{allInstances.length} procs</div>
          </div>

          <div className="bg-white border border-[#E6DEC9] px-3 py-2 rounded-xl text-center shadow-2xs">
            <div className="text-[9px] uppercase font-bold text-zinc-400">Realizados</div>
            <div className="text-xs font-bold text-emerald-700">{summaryRealized} / {allInstances.length}</div>
          </div>
        </div>
      </div>

      {allInstances.length === 0 ? (
        <div className="text-center py-12 px-4 border border-dashed border-[#D5CBB3] rounded-xl bg-white space-y-2">
          <AlertCircle className="w-8 h-8 text-[#B48C4D] mx-auto animate-pulse" />
          <h4 className="font-serif font-bold text-[#8B0000] text-sm">Nenhum procedimento mapeado</h4>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Por favor, selecione dentes no odontograma acima e associe procedimentos clínicos para habilitar o controle de atendimentos.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white border border-[#E6DEC9] rounded-xl shadow-xs">
          <table className="w-full text-left border-collapse font-sans text-xs">
            <thead className="bg-[#FAF8F5] border-b border-[#E6DEC9] text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Detalhes</th>
                <th className="py-3 px-4">Procedimento</th>
                <th className="py-3 px-4 text-center">Incluir financeiro</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-150 text-zinc-700">
              {allInstances.map((inst) => {
                const isPriceLocked = lockedPrices[inst.id] !== false;
                return (
                  <tr key={inst.id} className="hover:bg-[#FAF8F5]/30 transition-colors">
                    {/* Detalhes Dente/Regiao */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-900 flex flex-col gap-0.5">
                        <span className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-600 border border-zinc-200 font-bold inline-block w-fit">
                          Dente {inst.toothNumber}
                        </span>
                        {inst.faces.length > 0 && (
                          <span className="text-[9px] text-rose-700 font-bold tracking-wider">
                            {inst.faces.join(' • ')}
                          </span>
                        )}
                        <span className="text-[9px] text-zinc-400">{inst.sectionTitle}</span>
                      </div>
                    </td>

                    {/* Procedimento */}
                    <td className="py-3.5 px-4 font-medium text-zinc-800">
                      <div>
                        <p>{inst.name}</p>
                        {inst.observation && (
                          <p className="text-[10px] text-zinc-400 italic max-w-xs truncate" title={inst.observation}>
                            "{inst.observation}"
                          </p>
                        )}
                        {inst.dentist && (
                          <p className="text-[9px] mt-0.5 text-zinc-500 font-medium flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-[#B48C4D]" /> {inst.dentist}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Incluir Financeiro */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleUpdateInstance(inst.id, { includeFinancial: !inst.includeFinancial })}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg cursor-pointer transition-colors ${
                          inst.includeFinancial
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 line-through'
                        }`}
                      >
                        {inst.includeFinancial ? 'Sim' : 'Não'}
                      </button>
                    </td>

                    {/* Valor */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 max-w-[120px]">
                        <span className="text-zinc-400 text-[11px]">R$</span>
                        <input
                          type="number"
                          disabled={isPriceLocked}
                          value={inst.price}
                          onChange={(e) => handleUpdateInstance(inst.id, { price: parseFloat(e.target.value) || 0 })}
                          className={`w-20 px-1.5 py-1 text-xs rounded border text-right font-semibold font-mono focus:outline-none transition-all ${
                            isPriceLocked 
                              ? 'bg-zinc-50 border-transparent text-zinc-600 select-none' 
                              : 'bg-white border-[#C09553] text-[#8B0000] ring-1 ring-[#C09553]/20'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setLockedPrices((prev) => ({ ...prev, [inst.id]: !isPriceLocked }))}
                          className="p-1 hover:bg-zinc-100 rounded text-zinc-400 hover:text-zinc-600 transition-colors"
                          title={isPriceLocked ? 'Desbloquear edição de preço' : 'Bloquear edição de preço'}
                        >
                          {isPriceLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3 text-[#B48C4D]" />}
                        </button>
                      </div>
                    </td>

                    {/* Status do Atendimento */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <select
                          value={inst.status}
                          onChange={(e) => {
                            const newStatus = e.target.value as any;
                            handleUpdateInstance(inst.id, { 
                              status: newStatus,
                              date: newStatus === 'Realizado' ? new Date().toISOString().split('T')[0] : ''
                            });
                          }}
                          className={`text-xs font-bold rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer transition-colors border ${
                            inst.status === 'Realizado'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : inst.status === 'Em andamento'
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : inst.status === 'Cancelado'
                              ? 'bg-zinc-100 text-zinc-500 border-zinc-200 line-through'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          <option value="A realizar">A realizar</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Realizado">Realizado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                        {inst.status === 'Realizado' && inst.date && (
                          <span className="text-[10px] text-zinc-500 font-medium font-mono whitespace-nowrap">
                            {new Date(inst.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditModal(inst)}
                        className="p-1.5 hover:bg-zinc-105 rounded-lg border border-zinc-200 hover:border-[#C09553]/70 hover:text-[#8B0000] transition-all bg-white text-zinc-600 inline-flex items-center justify-center cursor-pointer"
                        title="Editar detalhes completos"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteInstance(inst.id)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg border border-zinc-200 hover:border-rose-300 hover:text-rose-600 transition-all bg-white text-zinc-600 inline-flex items-center justify-center cursor-pointer"
                        title="Excluir procedimento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Full edit custom modal */}
      {editingInstance && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col text-left border border-zinc-150 max-h-[90vh]">
            {/* Modal Header */}
            <div className="bg-[#8B0000] text-[#FAF8F5] p-5 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-[#C09553]" />
                <div>
                  <h3 className="font-serif font-bold text-base">Editar procedimento</h3>
                  <p className="text-[10px] text-[#E1CDAC] uppercase tracking-wider font-semibold">
                    Dente correspondente e detalhes de atendimento
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingInstance(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              
              {/* Descrição */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Descrição</label>
                <input
                  type="text"
                  value={editingInstance.name}
                  onChange={(e) => setEditingInstance({ ...editingInstance, name: e.target.value })}
                  className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none transition-all"
                />
              </div>

              {/* Row Grid: Dente, Arcada, Valor, Situação */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Dente */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Dente</label>
                  <select
                    value={editingInstance.toothNumber}
                    onChange={(e) => {
                      const num = parseInt(e.target.value) || 11;
                      setEditingInstance({ ...editingInstance, toothNumber: num });
                    }}
                    className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                  >
                    {/* Generate all standard tooth numbers */}
                    {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28,48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map((t) => (
                      <option key={t} value={t}>Dente {t}</option>
                    ))}
                  </select>
                </div>

                {/* Arcada (Automatically derived field) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Arcada</label>
                  <div className="w-full bg-zinc-100 border border-zinc-200 text-zinc-600 rounded-lg px-3 py-2 text-xs font-bold leading-normal truncate">
                    {getToothArcada(editingInstance.toothNumber)}
                  </div>
                </div>

                {/* Valor */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Valor</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">R$</span>
                    <input
                      type="number"
                      value={editingInstance.price}
                      onChange={(e) => setEditingInstance({ ...editingInstance, price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-lg pl-8 pr-3 py-2 text-xs font-semibold font-mono focus:outline-none"
                    />
                  </div>
                </div>

                {/* Situation / Status */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Situação</label>
                  <select
                    value={editingInstance.status}
                    onChange={(e) => setEditingInstance({ ...editingInstance, status: e.target.value as any })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-lg px-3 py-2 text-xs font-bold focus:outline-none"
                  >
                    <option value="A realizar">A realizar</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Realizado">Realizado</option>
                    <option value="Cancelado">Cancelado</option>
                  </select>
                </div>

              </div>

              {/* Realization Date & Responsible Doctor */}
              <div className="grid grid-cols-2 gap-4">
                
                {/* Data Realizado */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Data Realizado</label>
                  <input
                    type="date"
                    disabled={editingInstance.status !== 'Realizado'}
                    value={editingInstance.date || ''}
                    onChange={(e) => setEditingInstance({ ...editingInstance, date: e.target.value })}
                    className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] disabled:bg-zinc-100 disabled:text-zinc-400 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                  />
                </div>

                {/* Dentista que realizou */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Dentista que realizou</label>
                  {!showCustomDentistInput ? (
                    <select
                      value={editingInstance.dentist}
                      onChange={(e) => {
                        if (e.target.value === 'custom') {
                          setShowCustomDentistInput(true);
                        } else {
                          setEditingInstance({ ...editingInstance, dentist: e.target.value });
                        }
                      }}
                      className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                    >
                      <option value="">Selecione um dentista...</option>
                      {PRESET_DENTISTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      <option value="custom">+ Outro...</option>
                    </select>
                  ) : (
                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        placeholder="Nome do Dentista"
                        value={customDentist}
                        onChange={(e) => setCustomDentist(e.target.value)}
                        className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowCustomDentistInput(false);
                          setCustomDentist('');
                        }}
                        className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-600 transition-colors"
                        title="Voltar para seleção"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* Faces / Regiões do Dente */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide block mb-1">
                  Faces / Regiões do dente (Múltipla Seleção)
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_FACES.map((face) => {
                    const isSelected = (editingInstance.faces || []).includes(face);
                    return (
                      <button
                        key={face}
                        type="button"
                        onClick={() => handleToggleFace(face)}
                        className={`px-3 py-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-rose-600 border-rose-600 text-white shadow-xs scale-105'
                            : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'
                        }`}
                      >
                        {face}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Observação / Notas */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Observação</label>
                <textarea
                  rows={2}
                  value={editingInstance.observation || ''}
                  onChange={(e) => setEditingInstance({ ...editingInstance, observation: e.target.value })}
                  placeholder="Observação ou evolução clínica..."
                  className="w-full bg-[#FAF8F5] border border-[#D5CBB3] focus:border-[#8B0000] rounded-lg px-3 py-2 text-xs font-medium placeholder-zinc-400 focus:outline-none resize-none"
                />
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-[#FAF8F5] border-t border-[#E6DEC9] p-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEditingInstance(null)}
                className="px-4 py-2 border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                onClick={handleSaveModal}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Confirmar</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
