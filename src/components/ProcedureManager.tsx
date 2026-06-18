/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Check, DollarSign, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Procedure } from '../types';
import { DEFAULT_PROCEDURES } from '../constants';

interface ProcedureManagerProps {
  procedures: Procedure[];
  setProcedures: React.Dispatch<React.SetStateAction<Procedure[]>>;
  onResetProcedures: () => void;
}

// Beautiful clinical color choices for dental procedures
const PRESET_COLORS = [
  '#22C55E', // Green
  '#A855F7', // Purple
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#F97316', // Orange
  '#EAB308', // Yellow
  '#06B6D4', // Cyan/Teal
  '#EF4444', // Red
];

export default function ProcedureManager({
  procedures,
  setProcedures,
  onResetProcedures,
}: ProcedureManagerProps) {
  const [newNombre, setNewNombre] = useState('');
  const [newValor, setNewValor] = useState<number | string>('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  // Track which procedure is being edited inline (null if none)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editValor, setEditValor] = useState<number>(0);
  const [editColor, setEditColor] = useState('#000000');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNombre.trim()) return;

    const parsedPrice = typeof newValor === 'number' ? newValor : parseFloat(newValor) || 0;

    const newProc: Procedure = {
      id: 'p-' + Date.now().toString(),
      name: newNombre.trim(),
      price: Math.max(0, parsedPrice),
      color: newColor,
    };

    setProcedures((prev) => [...prev, newProc]);
    setNewNombre('');
    setNewValor('');
    // Select the next color from preset for variety
    const nextColorIndex = (PRESET_COLORS.indexOf(newColor) + 1) % PRESET_COLORS.length;
    setNewColor(PRESET_COLORS[nextColorIndex]);
  };

  const handleDelete = (id: string) => {
    if (procedures.length <= 1) {
      alert("É necessário ter pelo menos um procedimento cadastrado para associar aos dentes.");
      return;
    }
    if (confirm("Tem certeza que deseja remover este procedimento? Ele será desvinculado dos dentes já marcados.")) {
      setProcedures((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const startEdit = (proc: Procedure) => {
    setEditingId(proc.id);
    setEditNombre(proc.name);
    setEditValor(proc.price);
    setEditColor(proc.color);
  };

  const saveEdit = (id: string) => {
    if (!editNombre.trim()) return;
    setProcedures((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, name: editNombre.trim(), price: Math.max(0, editValor), color: editColor }
          : p
      )
    );
    setEditingId(null);
  };

  return (
    <div className="bg-white border border-[#E6DEC9] rounded-xl overflow-hidden shadow-sm flex flex-col h-full">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-[#FAF8F5] to-[#F3EFE9] border-b border-[#E6DEC9] px-5 py-4 flex justify-between items-center select-none">
        <div>
          <h2 className="text-sm font-semibold text-[#8B0000] tracking-wider uppercase">
            Catálogo de Procedimentos
          </h2>
          <p className="text-[11px] text-[#B48C4D] font-medium">
            Gerencie itens, cores e valores de tabela
          </p>
        </div>
        <button
          id="btn-reset-procedures"
          onClick={onResetProcedures}
          className="flex items-center gap-1 text-[11px] font-medium text-[#B48C4D] hover:text-[#8B0000] transition-colors"
          title="Restaurar tabela padrão original"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Restaurar Padrão</span>
        </button>
      </div>

      {/* Main Body */}
      <div className="p-5 flex-1 flex flex-col space-y-5 overflow-y-auto max-h-[500px]">
        
        {/* Form to add new procedure */}
        <form onSubmit={handleAdd} className="bg-[#FAF8F5] border border-[#E6DEC9] p-4 rounded-xl space-y-3.5">
          <h3 className="text-xs font-bold text-zinc-600 uppercase tracking-wide">
            Novo Procedimento / Terapêutica
          </h3>

          <div className="space-y-3">
            {/* Procedure Name */}
            <div>
              <input
                id="add-proc-name"
                type="text"
                required
                placeholder="Ex: Restauração Resina 1 Face"
                value={newNombre}
                onChange={(e) => setNewNombre(e.target.value)}
                className="w-full bg-white border border-zinc-200 focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] rounded-lg px-3 py-1.5 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none transition-all"
              />
            </div>

            {/* Price and Color */}
            <div className="grid grid-cols-12 gap-2.5 items-center">
              {/* Price */}
              <div className="col-span-7 relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">R$</span>
                <input
                  id="add-proc-price"
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="Valor (R$)"
                  value={newValor}
                  onChange={(e) => setNewValor(e.target.value)}
                  className="w-full bg-white border border-zinc-200 focus:border-[#8B0000] focus:ring-1 focus:ring-[#8B0000] rounded-lg pl-8 pr-2.5 py-1.5 text-xs font-mono text-zinc-800 focus:outline-none transition-all"
                />
              </div>

              {/* Color Button Selector */}
              <div className="col-span-5 flex justify-end gap-1 overflow-x-auto py-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className={`w-5 h-5 rounded-full flex-shrink-0 border-2 transition-transform ${
                      newColor === color ? 'border-[#8B0000] scale-125 shadow-sm' : 'border-transparent hover:scale-110'
                    }`}
                    style={{ backgroundColor: color }}
                    title={`Cor ${color}`}
                  />
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              id="btn-submit-proc"
              type="submit"
              className="w-full bg-[#8B0000] hover:bg-[#6c1b26] text-white text-xs font-semibold py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar ao Catálogo</span>
            </button>
          </div>
        </form>

        {/* Existing procedure rows list */}
        <div className="space-y-2">
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
            Procedimentos Disponíveis ({procedures.length})
          </span>

          <div className="divide-y divide-zinc-100 border border-zinc-100 rounded-xl overflow-hidden bg-white">
            <AnimatePresence initial={false}>
              {procedures.map((proc) => {
                const isEditing = editingId === proc.id;

                return (
                  <motion.div
                    key={proc.id}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ opacity: { duration: 0.2 } }}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2.5 transition-colors overflow-hidden ${
                      isEditing ? 'bg-amber-50/40' : 'hover:bg-zinc-50'
                    }`}
                  >
                    {isEditing ? (
                      /* Inline Edit view */
                      <div className="w-full space-y-2.5">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editNombre}
                            onChange={(e) => setEditNombre(e.target.value)}
                            className="flex-1 bg-white border border-amber-300 focus:border-[#8B0000] rounded px-2 py-1 text-xs"
                          />
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-zinc-500 font-mono">R$</span>
                            <input
                              type="number"
                              value={editValor}
                              onChange={(e) => setEditValor(parseFloat(e.target.value) || 0)}
                              className="w-24 bg-white border border-amber-300 focus:border-[#8B0000] rounded px-2 py-1 text-xs font-mono"
                            />
                          </div>
                          {/* Inline color editor presets */}
                          <div className="flex gap-0.5">
                            {PRESET_COLORS.map((col) => (
                              <button
                                key={col}
                                type="button"
                                onClick={() => setEditColor(col)}
                                className={`w-4 h-4 rounded-full border ${editColor === col ? 'border-zinc-900 scale-125' : 'border-transparent'}`}
                                style={{ backgroundColor: col }}
                              />
                            ))}
                          </div>
                          {/* Save / Cancel buttons */}
                          <div className="flex gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => saveEdit(proc.id)}
                              className="p-1 text-green-700 hover:bg-green-100 rounded"
                              title="Salvar alterações"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Read-only view */
                      <>
                        <div className="flex items-start gap-2.5 max-w-[70%]">
                          {/* Procedure Color dot indicator */}
                          <span
                            className="w-3.5 h-3.5 rounded-full flex-shrink-0 mt-0.5 shadow-xs"
                            style={{ backgroundColor: proc.color }}
                          />
                          <div className="space-y-0.5">
                            <p className="text-xs font-semibold text-zinc-800 leading-tight">
                              {proc.name}
                            </p>
                            <span className="text-[10px] font-bold text-[#B48C4D] bg-[#FAF8F5] border border-[#E6DEC9]/40 rounded-sm px-1.5 py-0.5 inline-block font-mono">
                              R$ {proc.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Edit / Delete actions */}
                        <div className="flex items-center gap-1 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => startEdit(proc)}
                            className="p-1 px-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
                            title="Editar procedimento e valor"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(proc.id)}
                            className="p-1 px-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Excluir do catálogo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

      </div>
      
    </div>
  );
}
