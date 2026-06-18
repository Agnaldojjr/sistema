import { getAccessToken } from '../firebase';

export async function listCalendarEvents(start: Date, end: Date) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado');

  const timeMin = start.toISOString();
  const timeMax = end.toISOString();

  // 1. Get calendar list
  let calListRes;
  try {
    calListRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (err: any) {
    throw new Error(`Falha de rede ao buscar lista de calendários: ${err.message}`);
  }

  if (!calListRes.ok) {
    if (calListRes.status === 401 || calListRes.status === 403) {
      throw new Error('Sem permissão (403/401). O token expirou ou faltam permissões. Por favor, clique em "Sair" acima e faça o login novamente para re-autorizar.');
    }
    
    let errorData;
    try {
      errorData = await calListRes.json();
    } catch(e) {
      // ignore
    }
    
    if (errorData?.error?.message?.includes('Google Calendar API has not been used')) {
      const urlMatch = errorData.error.message.match(/https:\/\/console\.developers\.google\.com[^\s]*/);
      if (urlMatch) {
         throw new Error(`API_NOT_ENABLED|${urlMatch[0]}`);
      }
    }
    
    throw new Error('Falha ao buscar lista de calendários');
  }

  const calListData = await calListRes.json();
  const calendars = calListData.items || [];
  console.log("Found calendars:", calendars.map((c: any) => c.summary));
  
  // 2. Fetch events from all calendars
  let allEvents: any[] = [];
  const debugInfo: any[] = [];
  
  const fetchPromises = calendars.map(async (calendar: any) => {
    const info = { id: calendar.id, summary: calendar.summary, eventCount: 0, error: null as null | string };
    try {
      let res;
      try {
        res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=2500`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e: any) {
         console.warn(`Fetch threw for ${calendar.summary}:`, e);
         info.error = e.message;
         debugInfo.push(info);
         return [];
      }
      if (res.ok) {
        const data = await res.json();
        const items = data.items || [];
        console.log(`Fetched ${items.length} events from ${calendar.summary}`);
        info.eventCount = items.length;
        // Inject calendar info so we can render with correct color or know source
        items.forEach((item: any) => {
          item.calendarId = calendar.id;
          item.calendarColor = calendar.backgroundColor;
          item.calendarSummary = calendar.summary;
        });
        debugInfo.push(info);
        return items;
      } else {
        const errText = await res.text();
        console.warn(`Failed to fetch events for ${calendar.summary}:`, errText);
        info.error = `Bad status: ${res.status}`;
        debugInfo.push(info);
      }
    } catch (e: any) {
      console.warn(`Error fetching events for ${calendar.summary}:`, e);
      info.error = e.message;
      debugInfo.push(info);
      // Ignore errors for individual calendars
    }
    return [];
  });

  const results = await Promise.all(fetchPromises);
  results.forEach(items => {
    allEvents = allEvents.concat(items);
  });

  return { items: allEvents, debugInfo };
}

export async function createCalendarEvent(eventData: any) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado');

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=all', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(eventData)
  });

  if (!res.ok) throw new Error('Falha ao criar evento no calendário');
  return res.json();
}

export async function deleteCalendarEvent(eventId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado');

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error('Falha ao excluir evento');
  return true;
}
