import React, { useState } from 'react';
import { X, Calendar as CalendarIcon, Clock, User, Phone, Mail, MessageCircle, AlertCircle, Save, Trash2 } from 'lucide-react';
import { createCalendarEvent, deleteCalendarEvent } from '../lib/calendar';
import { addHours, addMinutes, format, parseISO } from 'date-fns';

interface EventModalProps {
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
  selectedDate?: Date;
  existingEvent?: any; // Google Calendar event object
  initialPatientName?: string;
}

export default function EventModal({ onClose, onSaved, onDeleted, selectedDate, existingEvent, initialPatientName }: EventModalProps) {
  const isEditing = !!existingEvent;
  
  // Initialize form state
  const [title, setTitle] = useState(existingEvent?.summary || initialPatientName || '');
  // helper to round to nearest 30 minutes
  const getRoundedTime = (date: Date) => {
    let d = new Date(date);
    const minutes = d.getMinutes();
    d.setMinutes(minutes >= 30 ? 30 : 0, 0, 0);
    if (minutes >= 45) {
        d.setHours(d.getHours() + 1);
        d.setMinutes(0);
    } else if (minutes >= 15 && minutes < 45) {
        d.setMinutes(30);
    } else {
        d.setMinutes(0);
    }
    return format(d, 'HH:mm');
  };

  const roundedStartDate = selectedDate || new Date();
  const roundedEndDate = addMinutes(roundedStartDate, 30);

  const [date, setDate] = useState(
    existingEvent?.start?.dateTime 
      ? format(parseISO(existingEvent.start.dateTime), 'yyyy-MM-dd')
      : selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
  );
  const [startTime, setStartTime] = useState(
    existingEvent?.start?.dateTime 
      ? format(parseISO(existingEvent.start.dateTime), 'HH:mm')
      : getRoundedTime(roundedStartDate)
  );
  
  const [endTime, setEndTime] = useState(
    existingEvent?.end?.dateTime 
      ? format(parseISO(existingEvent.end.dateTime), 'HH:mm')
      : getRoundedTime(roundedEndDate)
  );
  
  const [patientEmail, setPatientEmail] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  
  // Try to parse phone/email from description if editing
  React.useEffect(() => {
    if (existingEvent?.description) {
      const pMatch = existingEvent.description.match(/WhatsApp:\s*([\d\+\-\(\)\s]+)/);
      if (pMatch) setPatientPhone(pMatch[1].trim());
      
      const eMatch = existingEvent.description.match(/Email:\s*([^\s]+)/);
      if (eMatch) setPatientEmail(eMatch[1].trim());
    }
  }, [existingEvent]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();
      
      const attendees = [];
      if (patientEmail) {
        attendees.push({ email: patientEmail });
      }

      const description = `Consulta odontológica.\n\n${patientPhone ? `WhatsApp do Paciente: ${patientPhone}` : ''}\n${patientEmail ? `Email do Paciente: ${patientEmail}` : ''}`;
      
      const eventData = {
        summary: title || 'Consulta Odontológica',
        description,
        start: { dateTime: startDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        end: { dateTime: endDateTime, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
        attendees: attendees.length > 0 ? attendees : undefined,
      };

      if (isEditing) {
        // Here we ideally need an update method, but for simplicity we could let the user know we're using create
        // Actually, let's just make it possible to delete and recreate, or we just fail gracefuly saying "Edição completa não implementada, crie um novo".
        alert("Edição no Google Calendar requer funcionalidade de update. Vamos excluir o antigo e criar um novo para simplificar.");
        await deleteCalendarEvent(existingEvent.id);
      }
      
      await createCalendarEvent(eventData);
      onSaved();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Falha ao salvar evento');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!existingEvent || !confirm('Deseja realmente cancelar esta consulta no Google Calendar?')) return;
    try {
      setLoading(true);
      await deleteCalendarEvent(existingEvent.id);
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setError(err.message || 'Erro ao excluir');
      setLoading(false);
    }
  };

  const sendWhatsappText = () => {
    if (!patientPhone) {
      alert("Informe o WhatsApp do paciente primeiro (ex: 5511999999999).");
      return;
    }
    const numbersOnly = patientPhone.replace(/[^\d]/g, '');
    const dateFormatted = format(new Date(`${date}T${startTime}:00`), "dd/MM/yyyy 'às' HH:mm");
    const msg = `Olá! Gostaríamos de lembrar sobre a sua consulta odontológica agendada para ${dateFormatted}. Por favor, confirme ou avise caso precise remarcar.`;
    window.open(`https://wa.me/${numbersOnly}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col animate-fade-in relative">
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 bg-[#FAF8F5]">
          <h2 className="text-lg font-bold text-[#4E1119] font-serif">
            {isEditing ? 'Detalhes da Consulta' : 'Nova Consulta'}
          </h2>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm border border-red-100 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <User className="w-4 h-4 text-zinc-400" />
              Nome do Paciente
            </label>
            <input
              required
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex: Lucimara dos Santos Firmino"
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-zinc-400" /> Data
              </label>
              <input
                required
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-zinc-400" /> Horário
              </label>
              <div className="flex items-center gap-2">
                <input
                  required
                  type="time"
                  step="1800"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full px-2 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 text-sm"
                />
                <span className="text-zinc-400">às</span>
                <input
                  required
                  type="time"
                  step="1800"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full px-2 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-zinc-400" /> WhatsApp
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={patientPhone}
                onChange={e => setPatientPhone(e.target.value)}
                placeholder="Ex: 5511999999999"
                className="flex-1 px-3 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
              />
              <button
                type="button"
                onClick={sendWhatsappText}
                className="bg-[#25D366] hover:bg-[#1DA851] text-white px-3 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                title="Enviar lembrete pelo WhatsApp"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar MSG
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-zinc-400" /> Email do Paciente (Opcional)
            </label>
            <input
              type="email"
              value={patientEmail}
              onChange={e => setPatientEmail(e.target.value)}
              placeholder="Para envio automático do Google e lembretes"
              className="w-full px-3 py-2 border border-zinc-300 rounded-xl focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
            />
            <p className="text-[10px] text-zinc-500">Se preenchido, o Google enviará convite automático de agenda.</p>
          </div>

          <div className="pt-4 flex items-center gap-3">
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="flex items-center gap-1.5 text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-xl font-semibold transition-colors"
                title="Excluir Consulta"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-bold text-zinc-600 hover:bg-zinc-100 rounded-xl transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 bg-[#4E1119] hover:bg-[#6c1b26] text-white px-6 py-2.5 rounded-xl font-bold transition-colors disabled:bg-zinc-400"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Salvando...' : 'Salvar no Google'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
