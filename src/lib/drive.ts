import { getAccessToken } from '../firebase';

export async function saveTreatmentPlanToDrive(
  patientName: string,
  stateToSave: any,
  fileId?: string
) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  const status = stateToSave?.proposal?.status || 'Em Andamento';
  let totalNum = 0;
  if (stateToSave?.simulations && typeof stateToSave.selectedPlanIndex === 'number') {
    totalNum = stateToSave.simulations[stateToSave.selectedPlanIndex]?.custoTotal || 0;
  } else if (stateToSave?.simulations && stateToSave.simulations.length > 0) {
    totalNum = stateToSave.simulations[0]?.custoTotal || 0;
  }
  const total = totalNum.toString();

  // 1. Find or create root folder "Planejador Odontológico"
  let rootFolderId = await getFolderId(token, 'Planejador Odontológico');
  if (!rootFolderId) {
    rootFolderId = await createFolder(token, 'Planejador Odontológico');
  }

  // 2. Find or Create Patient folder
  const safeName = (patientName || 'Anonimo').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const childFolderName = safeName;
  let folderId = await getFolderId(token, childFolderName, rootFolderId);
  if (!folderId) {
    folderId = await createFolder(token, childFolderName, rootFolderId, { status, total });
  } else {
    await updateFolderAppProperties(token, folderId, { status, total });
  }

  // 3. Upload JSON file inside patient folder
  let tratamentosFolderId = await getFolderId(token, 'Tratamentos', folderId);
  if (!tratamentosFolderId) tratamentosFolderId = await createFolder(token, 'Tratamentos', folderId);

  let documentosFolderId = await getFolderId(token, 'Documentos', folderId);
  if (!documentosFolderId) documentosFolderId = await createFolder(token, 'Documentos', folderId);

  let imagensFolderId = await getFolderId(token, 'Imagens', folderId);
  if (!imagensFolderId) imagensFolderId = await createFolder(token, 'Imagens', folderId);

  let fileIdToUpdate = fileId === 'NEW_FILE' ? null : fileId || null;
  
  if (!fileIdToUpdate && fileId !== 'NEW_FILE') {
    // legacy support: try to find 'orcamento.json' if no fileId is passed BUT it's the very first time
    const qStr = `'${tratamentosFolderId}' in parents and name='orcamento.json' and trashed=false`;
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(qStr)}&spaces=drive`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        fileIdToUpdate = searchData.files[0].id;
      }
    }
  }

  const jsonBlob = new Blob([JSON.stringify(stateToSave, null, 2)], { type: 'application/json' });
  
  if (fileIdToUpdate) {
    // Update existing file
    const uploadRes = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileIdToUpdate}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: jsonBlob
    });
    
    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      console.error('Save to drive error', errorText);
      throw new Error('Falha ao atualizar arquivo no drive: ' + errorText);
    }
    const result = await uploadRes.json();

    // Set status and total appProperties directly on the file element
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${fileIdToUpdate}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appProperties: { status, total }
        })
      });
    } catch (metadataErr) {
      console.warn('Erro ao atualizar metadados do arquivo (status/total):', metadataErr);
    }

    return { ...result, id: fileIdToUpdate };
  }

  // Create new file
  const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  const metadata = {
    name: `orcamento-${dateStr}.json`,
    parents: [tratamentosFolderId],
    appProperties: { status, total }
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', jsonBlob);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error('Save to drive error', errorText);
    throw new Error('Falha ao upar arquivo no drive: ' + errorText);
  }

  return uploadRes.json();
}

export async function listPatientsFromDrive() {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');
  
  const rootFolderId = await getFolderId(token, 'Planejador Odontológico');
  if (!rootFolderId) return [];

  const q = `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime,webViewLink,appProperties)&orderBy=createdTime desc&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Falha ao listar pacientes');
  const data = await res.json();
  return data.files || [];
}

export async function listPatientProposalsFromDrive(patientFolderId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  const tratamentosFolderId = await getFolderId(token, 'Tratamentos', patientFolderId);
  if (!tratamentosFolderId) return [];

  const q = `'${tratamentosFolderId}' in parents and mimeType='application/json' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime,modifiedTime,appProperties)&orderBy=modifiedTime desc&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error('Falha ao listar orçamentos');
  
  const data = await res.json();
  return data.files || [];
}

export async function loadPatientFromDrive(folderId: string, fileId?: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  // Try to find Tratamentos folder first
  const tratamentosFolderId = await getFolderId(token, 'Tratamentos', folderId);
  const targetFolderId = tratamentosFolderId || folderId;

  let finalFileId = fileId;

  if (!finalFileId) {
    const recentQ = `'${targetFolderId}' in parents and mimeType='application/json' and trashed=false`;
    const recentRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(recentQ)}&orderBy=modifiedTime desc&spaces=drive`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!recentRes.ok) throw new Error('Falha ao buscar json');
    const recentData = await recentRes.json();
    if (!recentData.files || recentData.files.length === 0) {
      throw new Error('Nenhum arquivo de orçamento encontrado nesta pasta');
    }
    finalFileId = recentData.files[0].id;
  }

  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${finalFileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!fileRes.ok) throw new Error('Falha ao baixar o orçamento');
  const result = await fileRes.json();
  return { ...result, __fileId: finalFileId };
}

async function getFolderId(token: string, folderName: string, parentId?: string): Promise<string | null> {
  let q = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
}

async function createFolder(token: string, folderName: string, parentId?: string, appProperties?: Record<string, string>): Promise<string> {
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }
  if (appProperties) {
    metadata.appProperties = appProperties;
  }
  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata)
  });
  
  if (!res.ok) {
    throw new Error('Falha ao criar pasta ' + folderName);
  }
  
  const data = await res.json();
  return data.id;
}

async function updateFolderAppProperties(token: string, folderId: string, appProperties: Record<string, string>) {
  await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ appProperties })
  });
}

export async function listPatientImagesFromDrive(patientFolderId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  // Tries to get the "Imagens" folder. If it doesn't exist, search within root patient folder
  let targetFolderId = await getFolderId(token, 'Imagens', patientFolderId);
  if (!targetFolderId) {
    targetFolderId = patientFolderId;
  }

  const q = `'${targetFolderId}' in parents and mimeType contains 'image/' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime,thumbnailLink,webContentLink,webViewLink)&orderBy=createdTime desc&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error('Falha ao listar imagens');
  
  const data = await res.json();
  return data.files || [];
}

export async function deleteDummyPatientsFromDrive() {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  const rootFolderId = await getFolderId(token, 'Planejador Odontológico');
  if (!rootFolderId) return 0;

  const q = `'${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,createdTime)&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error('Falha ao listar pacientes para exclusão');
  const data = await res.json();
  const patients = data.files || [];

  const dummyKeywords = ['exemplo', 'teste', 'fictício', 'ficticio'];
  const dummies = patients.filter((p: any) => {
    const nameStr = p.name.toLowerCase();
    return dummyKeywords.some(kw => nameStr.includes(kw));
  });

  let deletedCount = 0;
  for (const dummy of dummies) {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${dummy.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`Excluindo pasta de paciente fictício: ${dummy.name}`);
      deletedCount++;
    } catch (e) {
      console.error('Erro ao excluir paciente fictício do Drive:', dummy.name, e);
    }
  }

  return deletedCount;
}

export async function deletePatientFolderFromDrive(folderId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Delete from drive error', errorText);
    throw new Error('Falha ao excluir pasta do paciente no drive: ' + errorText);
  }
}

export async function deleteFileFromDrive(fileId: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Delete file from drive error', errorText);
    throw new Error('Falha ao excluir o arquivo no drive: ' + errorText);
  }
}

export async function renameFileInDrive(fileId: string, newName: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  let finalName = newName.trim();
  if (!finalName.toLowerCase().endsWith('.json')) {
    finalName += '.json';
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name: finalName })
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error('Rename file in drive error', errorText);
    throw new Error('Falha ao renomear arquivo no drive: ' + errorText);
  }

  return res.json();
}

export async function uploadPatientImageToDrive(patientFolderId: string, imageBlob: Blob, filename: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  let targetFolderId = await getFolderId(token, 'Imagens', patientFolderId);
  if (!targetFolderId) {
    targetFolderId = await createFolder(token, 'Imagens', patientFolderId);
  }

  const metadata = {
    name: filename,
    parents: [targetFolderId]
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', imageBlob);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error('Save image to drive error', errorText);
    throw new Error('Falha ao upar imagem no drive: ' + errorText);
  }

  return uploadRes.json();
}

export async function listPatientImagesByName(patientName: string) {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  // 1. Find root folder "Planejador Odontológico"
  const rootFolderId = await getFolderId(token, 'Planejador Odontológico');
  if (!rootFolderId) return [];

  // 2. Find Patient folder
  const safeName = (patientName || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  if (!safeName) return [];

  const folderId = await getFolderId(token, safeName, rootFolderId);
  if (!folderId) return [];

  // 3. List images
  return listPatientImagesFromDrive(folderId);
}

export async function downloadFileAsDataUrl(fileId: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) throw new Error('Falha ao baixar imagem');

  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function saveTreatmentPdfToDrive(
  patientName: string,
  pdfBlob: Blob,
  filename: string
): Promise<{ id: string; webViewLink: string; webContentLink: string }> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  // 1. Find or create root folder "Planejador Odontológico"
  let rootFolderId = await getFolderId(token, 'Planejador Odontológico');
  if (!rootFolderId) {
    rootFolderId = await createFolder(token, 'Planejador Odontológico');
  }

  // 2. Find or Create Patient folder
  const safeName = (patientName || 'Anonimo').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  let folderId = await getFolderId(token, safeName, rootFolderId);
  if (!folderId) {
    folderId = await createFolder(token, safeName, rootFolderId);
  }

  // 3. Find or Create Documentos folder inside patient folder
  let documentosFolderId = await getFolderId(token, 'Documentos', folderId);
  if (!documentosFolderId) {
    documentosFolderId = await createFolder(token, 'Documentos', folderId);
  }

  // 4. Upload PDF inside Documentos folder
  const metadata = {
    name: filename,
    parents: [documentosFolderId],
    mimeType: 'application/pdf'
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', pdfBlob);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: formData
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    console.error('Save PDF to drive error', errorText);
    throw new Error('Falha ao upar PDF no Drive: ' + errorText);
  }

  const fileData = await uploadRes.json();
  const fileId = fileData.id;

  // 5. Share with anyone who has the link (read-only)
  try {
    const permissionRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });
    if (!permissionRes.ok) {
      console.warn('Falha ao definir permissão pública do PDF:', await permissionRes.text());
    }
  } catch (permissionErr) {
    console.error('Erro de permissão no Drive:', permissionErr);
  }

  // 6. Fetch full fields webViewLink, webContentLink if not returned directly
  let webViewLink = fileData.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=drivesdk`;
  let webContentLink = fileData.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`;

  try {
    const detailRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink,webContentLink`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (detailRes.ok) {
      const detailData = await detailRes.json();
      if (detailData.webViewLink) webViewLink = detailData.webViewLink;
      if (detailData.webContentLink) webContentLink = detailData.webContentLink;
    }
  } catch (err) {
    console.warn('Erro ao obter links detalhados do arquivo:', err);
  }

  return { id: fileId, webViewLink, webContentLink };
}

export async function getOrCreatePatientFolderByName(patientName: string): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error('Não autenticado no Google Drive');

  let rootFolderId = await getFolderId(token, 'Planejador Odontológico');
  if (!rootFolderId) {
    rootFolderId = await createFolder(token, 'Planejador Odontológico');
  }

  const safeName = (patientName || 'Anonimo').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  let folderId = await getFolderId(token, safeName, rootFolderId);
  if (!folderId) {
    folderId = await createFolder(token, safeName, rootFolderId, { status: 'Em Andamento', total: '0' });
  }
  return folderId;
}



