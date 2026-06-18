import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { listCalendarEvents } from '../lib/calendar';
import EventModal from './EventModal';
import { Loader2, Plus, Users, RefreshCcw } from 'lucide-react';
import { addMonths, subMonths } from 'date-fns';

interface CalendarViewProps {
  onNewPatient: () => void;
  initialPatientName?: string;
  onClearInitialPatient?: () => void;
}

export default function CalendarView({ onNewPatient, initialPatientName, onClearInitialPatient }: CalendarViewProps) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState<any[]>([]);
  
  const [iframeKey, setIframeKey] = useState(Date.now());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  // Auto-open modal if initialPatientName is passed
  useEffect(() => {
    if (initialPatientName) {
      setSelectedDate(new Date());
      setSelectedEvent(null);
      setIsModalOpen(true);
    }
  }, [initialPatientName]);

  const fetchEvents = async (start: Date, end: Date) => {
    setLoading(true);
    setError('');
    try {
      const data = await listCalendarEvents(start, end);
      console.log('Total events fetched:', data.items?.length);
      
      // Store debug info
      if (data.debugInfo) {
         setDebugInfo(data.debugInfo);
      }

      const formattedEvents = (data.items || [])
        .filter((item: any) => item.status !== 'cancelled' && (item.start?.dateTime || item.start?.date))
        .map((item: any) => ({
        id: item.id,
        title: item.summary,
        start: item.start?.dateTime || item.start?.date,
        end: item.end?.dateTime || item.end?.date,
        backgroundColor: item.calendarColor || '#43a047', 
        borderColor: item.calendarColor || '#2e7d32',
        extendedProps: item
      }));
      setEvents(formattedEvents);
    } catch (err: any) {
      console.warn('Calendar list error:', err);
      if (err.message?.startsWith('API_NOT_ENABLED|')) {
        setError(err.message); // Stored as "API_NOT_ENABLED|url"
      } else {
        setError(err.message || 'Falha ao conectar com o Google Calendar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    const now = new Date();
    fetchEvents(subMonths(now, 1), addMonths(now, 2));
  };

  useEffect(() => {
    // Initial fetch for a wide range (prev, curr, next month)
    handleRefresh();
    
    // Auto-refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleDateClick = (arg: any) => {
    setSelectedDate(arg.date);
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleEventClick = (arg: any) => {
    setSelectedEvent(arg.event.extendedProps);
    setSelectedDate(undefined);
    setIsModalOpen(true);
  };

  return (
    <div className="h-full w-full flex flex-col bg-white overflow-hidden p-6 relative">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          onClick={() => setIframeKey(Date.now())}
          className="flex items-center gap-1.5 px-3 py-2 bg-white text-zinc-600 hover:text-[#8B0000] border border-zinc-200 hover:bg-[#FAF8F5] text-sm font-medium rounded-lg transition-all duration-200 shadow-sm"
          title="Atualizar agenda manualmente"
        >
          <RefreshCcw className="w-4 h-4" />
          <span>Atualizar Agenda</span>
        </button>
        <button
          onClick={() => {
            setSelectedDate(new Date());
            setSelectedEvent(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#8B0000] text-[#FAF8F5] hover:bg-[#6c1b26] border border-[#8B0000] text-sm font-medium rounded-lg transition-all duration-200 shadow-sm"
          title="Agendar nova consulta na agenda"
        >
          <Plus className="w-4 h-4" />
          Novo Agendamento
        </button>
        <button
          onClick={() => window.open('https://calendar.google.com/', '_blank')}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 hover:bg-red-50 border border-red-200 text-sm font-medium rounded-lg transition-all duration-200 shadow-sm"
          title="Acessar o Google Agenda para excluir ou gerenciar eventos"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          Excluir Agendamentos
        </button>
      </div>
      
      {error && (
        <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 text-sm whitespace-pre-wrap">
          {error.startsWith('API_NOT_ENABLED|') ? (
            <div>
              <p className="font-bold text-base mb-2">Ação Necessária: Ativar a API do Google Calendar</p>
              <p className="mb-2">A API do Google Calendar ainda não foi ativada neste projeto do Google Cloud. Como estamos rodando em uma automação, é necessário ativar a API manualmente no seu Cloud Console. Para resolver, siga os seguintes passos:</p>
              <ol className="list-decimal ml-5 mb-4 space-y-1">
                <li>Clique no link abaixo para abrir o console de desenvolvedores do Google.</li>
                <li>Clique no botão <b>"Ativar"</b> (ou Enable).</li>
                <li>Aguarde cerca de 2 minutos para que a alteração seja propagada.</li>
                <li>Volte aqui e clique no botão "Atualizar" acima.</li>
              </ol>
              <a 
                href={error.split('|')[1]} 
                target="_blank" 
                rel="noreferrer" 
                className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors break-all shadow-sm"
              >
                Abrir Painel de Ativação
              </a>
            </div>
          ) : (
            error
          )}
        </div>
      )}

      <div className="flex-1 w-full flex flex-col bg-white border-2 border-[#E6DEC9] rounded-2xl overflow-hidden shadow-sm">
        <iframe 
          key={iframeKey}
          src="https://calendar.google.com/calendar/embed?src=dragnaldof%40gmail.com&ctz=America%2FSao_Paulo" 
          style={{ border: 0, width: '100%', height: '100%', minHeight: '800px' }} 
          frameBorder="0" 
          scrolling="no"
          className="flex-1 rounded-xl"
        ></iframe>
      </div>

      {isModalOpen && (
        <EventModal
          selectedDate={selectedDate}
          existingEvent={selectedEvent}
          initialPatientName={initialPatientName}
          onClose={() => {
            setIsModalOpen(false);
            if (onClearInitialPatient) onClearInitialPatient();
          }}
          onSaved={() => {
            setIsModalOpen(false);
            if (onClearInitialPatient) onClearInitialPatient();
            const now = new Date();
            fetchEvents(subMonths(now, 1), addMonths(now, 2));
          }}
          onDeleted={() => {
            setIsModalOpen(false);
            if (onClearInitialPatient) onClearInitialPatient();
            const now = new Date();
            fetchEvents(subMonths(now, 1), addMonths(now, 2));
          }}
        />
      )}
    </div>
  );
}
