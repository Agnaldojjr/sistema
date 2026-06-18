import { getAccessToken } from '../firebase';

export async function getGoogleDriveCRMDatabase() {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  // Find root folder
  const rootRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and name='Planejador Odontológico' and trashed=false&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rootData = await rootRes.json();
  if (!rootData.files || rootData.files.length === 0) return { patients: [], appointments: [], clinical_history: [], communications: [] };
  const rootFolderId = rootData.files[0].id;

  // Find crm_database.json
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${rootFolderId}' in parents and name='crm_database.json' and trashed=false&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const fileData = await fileRes.json();
  if (!fileData.files || fileData.files.length === 0) return { patients: [], appointments: [], clinical_history: [], communications: [] };
  const fileId = fileData.files[0].id;

  const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!contentRes.ok) return { patients: [], appointments: [], clinical_history: [], communications: [] };
  return await contentRes.json();
}

export async function saveGoogleDriveCRMDatabase(dataToSave: any) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  // Find root folder
  let rootFolderId;
  const rootRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=mimeType='application/vnd.google-apps.folder' and name='Planejador Odontológico' and trashed=false&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const rootData = await rootRes.json();
  
  if (!rootData.files || rootData.files.length === 0) {
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Planejador Odontológico', mimeType: 'application/vnd.google-apps.folder' })
    });
    const created = await createRes.json();
    rootFolderId = created.id;
  } else {
    rootFolderId = rootData.files[0].id;
  }

  // Find crm_database.json
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files?q='${rootFolderId}' in parents and name='crm_database.json' and trashed=false&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const fileData = await fileRes.json();
  
  const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
  const metadata = { name: 'crm_database.json', parents: [rootFolderId] };

  if (!fileData.files || fileData.files.length === 0) {
    // Create new
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);
    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
  } else {
    const fileId = fileData.files[0].id;
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: blob
    });
  }
}
