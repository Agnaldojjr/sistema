const fs = require('fs');

let content = fs.readFileSync('src/components/DentalCRMView.tsx', 'utf-8');

// Replace imports
content = content.replace(/import \{ collection, doc, setDoc, getDocs, deleteDoc, updateDoc, query, where, orderBy \} from 'firebase\/firestore';/, 
  "import { getGoogleDriveCRMDatabase, saveGoogleDriveCRMDatabase } from '../lib/driveCrm';");
content = content.replace(/import \{ db \} from '\.\.\/firebase';\n/, "");
content = content.replace(/import \{ CRMPatient \} from '\.\.\/types';/g, "import { CRMPatient, CRMAppointment, CRMClinicalHistory, CRMCommunication } from '../types';");

// Rewrite loadPatientsFromFirestore -> loadPatientsFromDrive
const loadPatientsRegex = /const loadPatientsFromFirestore = async \(\) => \{[\s\S]*?finally \{\s*setIsLoadingCRM\(false\);\s*\}\s*\};/;
content = content.replace(loadPatientsRegex, `const loadPatientsFromFirestore = async () => {
    setIsLoadingCRM(true);
    try {
      const data = await getGoogleDriveCRMDatabase();
      const list = data.patients || [];
      list.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setPatients(list);
    } catch (err) {
      console.error('Error fetching CRM patients:', err);
    } finally {
      setIsLoadingCRM(false);
    }
  };`);

// Rewrite loadPatientSubModules
const loadSubModulesRegex = /const loadPatientSubModules = async \(patientId: string\) => \{[\s\S]*?console\.error\('Error loading patient details:', err\);\s*\}\s*\};/;
content = content.replace(loadSubModulesRegex, `const loadPatientSubModules = async (patientId: string) => {
    try {
      const data = await getGoogleDriveCRMDatabase();
      
      const appList = (data.appointments || []).filter((a: any) => a.patientId === patientId);
      appList.sort((a: any, b: any) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
      setAppointments(appList);

      const clinList = (data.clinical_history || []).filter((c: any) => c.patientId === patientId);
      clinList.sort((a: any, b: any) => b.date.localeCompare(a.date));
      setClinicalHistory(clinList);

      const commList = (data.communications || []).filter((c: any) => c.patientId === patientId);
      commList.sort((a: any, b: any) => b.date.localeCompare(a.date));
      setCommunications(commList);

      setAnamneseList((data.anamnese || []).filter((a: any) => a.patientId === patientId));
      setAvisosList((data.avisos || []).filter((a: any) => a.patientId === patientId));
      setDocumentosList((data.documentos || []).filter((a: any) => a.patientId === patientId));
      setGaleriaList((data.galeria || []).filter((a: any) => a.patientId === patientId));
      setPagamentosList((data.pagamentos || []).filter((a: any) => a.patientId === patientId));
      setTratamentosList((data.tratamentos || []).filter((a: any) => a.patientId === patientId));
      setOdontogramaList((data.odontograma_history || []).filter((a: any) => a.patientId === patientId));
    } catch (err) {
      console.error('Error loading patient details:', err);
    }
  };`);

// Delete handleSavePatients direct setDoc calls and handleDeletePatient direct delete calls
const savePatRegex = /const handleSavePatient = async \(payload: Partial<CRMPatient>\) => \{[\s\S]*?setIsAddingPatient\(false\);\s*\}\s*\};/;
content = content.replace(savePatRegex, `const handleSavePatient = async (payload: Partial<CRMPatient>) => {
    try {
      const crmData = await getGoogleDriveCRMDatabase();
      if (!crmData.patients) crmData.patients = [];
      const pId = payload.id || \`pat_\$\{Date.now()\}\`;
      const existingIdx = crmData.patients.findIndex((p: any) => p.id === pId);
      const newPayload = { ...payload, id: pId };
      if (existingIdx >= 0) {
        crmData.patients[existingIdx] = newPayload;
      } else {
        crmData.patients.push(newPayload);
      }
      await saveGoogleDriveCRMDatabase(crmData);
      await loadPatientsFromFirestore();
      setIsAddingPatient(false);
    } catch (err: any) {
      alert('Erro ao salvar paciente: ' + err.message);
    }
  };`);

const delPatRegex = /const handleDeletePatient = async \(pId: string\) => \{[\s\S]*?alert\('Erro ao excluir: ' \+ err\.message\);\s*\}\s*\};/;
content = content.replace(delPatRegex, `const handleDeletePatient = async (pId: string) => {
    if (!window.confirm("Deseja realmente apagar o cadastro deste paciente e todo o seu histórico clínico permanentemente?")) return;
    try {
      const crmData = await getGoogleDriveCRMDatabase();
      crmData.patients = (crmData.patients || []).filter((p: any) => p.id !== pId);
      crmData.appointments = (crmData.appointments || []).filter((p: any) => p.patientId !== pId);
      crmData.clinical_history = (crmData.clinical_history || []).filter((p: any) => p.patientId !== pId);
      crmData.communications = (crmData.communications || []).filter((p: any) => p.patientId !== pId);
      await saveGoogleDriveCRMDatabase(crmData);

      if (selectedPatient?.id === pId) {
        setSelectedPatient(null);
      }
      await loadPatientsFromFirestore();
    } catch (err: any) {
      alert('Erro ao excluir: ' + err.message);
    }
  };`);

// We overwrite the entire importDataRows
const importDataRegex = /const importDataRows = async \(rows: any\[\]\) => \{[\s\S]*?loadPatientsFromFirestore\(\);\s*\};/m;
content = content.replace(importDataRegex, `const importDataRows = async (rows: any[]) => {
    let pCreated = 0;
    let pUpdated = 0;
    let appsLinked = 0;
    let clinLinked = 0;
    let commsLinked = 0;
    const errors: string[] = [];
    const total = rows.length;
    
    setImportProgress(20);
    console.log("[Import] Baixando CRM_Database do Google Drive...");
    let crmData: any;
    try {
      crmData = await getGoogleDriveCRMDatabase();
    } catch (err: any) {
      setImportErrors(["Falha ao carregar banco de dados base do Google Drive."]);
      setImporting(false);
      return;
    }
    
    if (!crmData.patients) crmData.patients = [];
    if (!crmData.appointments) crmData.appointments = [];
    if (!crmData.clinical_history) crmData.clinical_history = [];
    if (!crmData.communications) crmData.communications = [];

    const patientsMapByCode: { [key: string]: any } = {};
    const patientsMapByName: { [key: string]: any } = {};
    crmData.patients.forEach((docSnap: any) => {
      const data = docSnap;
      const id = docSnap.id;
      if (data.codigo_paciente) patientsMapByCode[String(data.codigo_paciente)] = { id, data };
      if (data.name) patientsMapByName[String(data.name).trim().toUpperCase()] = { id, data };
    });

    setImportProgress(35);

    // Grouping by patient to enforce single unique registration consolidating histories
    const patientGroups: { [key: string]: any[] } = {};
    rows.forEach((row, index) => {
      const cleanRow: any = {};
      Object.keys(row).forEach(k => {
        const normalizedKey = k.replace(/\\\\/g, '').toLowerCase().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_");
        cleanRow[normalizedKey] = row[k];
      });

      const lineNum = row._originalLineNumber || (index + 2);
      const isMd = row._sourceType === 'MD';
      const fileLabel = isMd ? \`Markdown Linha \${lineNum}\` : \`Linha \${lineNum}\`;

      const codigo = cleanRow.codigo_cliente || cleanRow.codigo_paciente || cleanRow.id_paciente || cleanRow.codigo || cleanRow.cod_cli || '';
      const nomeRaw = cleanRow.nome_paciente || cleanRow.paciente || cleanRow.nome || cleanRow.cliente || cleanRow.nome_completo || '';
      const nome = String(nomeRaw).trim().toUpperCase();

      if (!nome || nome === 'NAN' || nome === '') {
        errors.push(\`[\${fileLabel}] Falha Crítica: Campo 'nome_paciente' ausente.\`);
        return;
      }

      let appDateRaw = '';
      const possibleDates = [cleanRow.data_realizado, cleanRow.created_at, cleanRow.data, cleanRow.data_consulta, cleanRow.data_agendamento];
      for (const pd of possibleDates) {
        if (pd && String(pd).trim() !== '' && String(pd).toLowerCase() !== 'nan') { appDateRaw = String(pd); break; }
      }

      const key = codigo && String(codigo).toLowerCase() !== 'nan' && String(codigo).trim() !== ''
        ? \`CODE_\${codigo}\`
        : \`NAME_\${nome.replace(/\\s+/g, '_')}\`;

      if (!patientGroups[key]) patientGroups[key] = [];
      patientGroups[key].push({ cleanRow, originalRow: row, nome, codigo, lineNum, fileLabel, appDateRaw });
    });

    const patientKeys = Object.keys(patientGroups);

    for (const patKey of patientKeys) {
      const groupRows = patientGroups[patKey];
      const representative = groupRows[0];
      const { nome, codigo } = representative;
      const patientCodeStr = codigo && String(codigo).toLowerCase() !== 'nan' && String(codigo).trim() !== '' ? String(codigo) : \`COD-\${Math.floor(1000 + Math.random() * 9000)}\`;

      let phone = ''; let mobile = ''; let medicalRecord = '';
      groupRows.forEach(item => {
        const r = item.cleanRow;
        if (!phone) phone = String(r.telefone || r.tel || r.fone || '').trim();
        if (!mobile) mobile = String(r.celular || r.mobile || r.whats || r.whatsapp || '').trim();
        if (!medicalRecord) medicalRecord = String(r.prontuario || r.n_prontuario || r.ficha || '').trim();
      });

      let patientId = '';
      let isNew = true;
      let existingDocSnap: any = null;

      if (codigo && patientsMapByCode[String(codigo)]) {
        existingDocSnap = patientsMapByCode[String(codigo)];
        patientId = existingDocSnap.id;
        isNew = false;
      } else if (patientsMapByName[nome]) {
        existingDocSnap = patientsMapByName[nome];
        patientId = existingDocSnap.id;
        isNew = false;
      }

      if (isNew) {
        patientId = \`pat_\$\{Date.now()\}_\$\{Math.floor(Math.random() * 1000)}\`;
        const patData: Partial<CRMPatient> = { id: patientId, name: nome, codigo_paciente: patientCodeStr, phone, mobile, medicalRecord, createdAt: new Date().toISOString() };
        crmData.patients.push(patData);
        patientsMapByName[nome] = { id: patientId, data: patData };
        pCreated++;
      } else {
        pUpdated++;
      }

      for (const groupItem of groupRows) {
        const { cleanRow, appDateRaw } = groupItem;
        const appDate = appDateRaw ? normalizeDate(appDateRaw) : new Date().toISOString().split('T')[0];
        
        const procVal = String(cleanRow.descricao_procedimento || cleanRow.procedimento || '').trim();
        const evoVal = String(cleanRow.evolucao || '').trim();
        const valVal = cleanRow.valor || '';
        
        if (procVal || evoVal) {
          crmData.clinical_history.push({
            id: \`clin_\$\{patientId\}_\$\{Date.now()\}_\$\{Math.floor(Math.random() * 9000)}\`,
            patientId,
            date: appDate,
            proceduresPerformed: procVal,
            treatmentEvolution: evoVal,
            value: valVal,
            createdAt: new Date().toISOString()
          });
          clinLinked++;
        }
      }
    }

    setImportProgress(60);
    console.log("Saving full DB to Google Drive...");
    
    try {
      await saveGoogleDriveCRMDatabase(crmData);
    } catch(err: any) {
      errors.push("Falha ao re-uploadar banco de dados para o Drive: " + (err.message || err));
    }
    
    setImportProgress(100);
    setImportSummary({ patientsCreated: pCreated, patientsUpdated: pUpdated, appointmentsLinked: appsLinked, clinicalsLinked: clinLinked, communicationsLinked: commsLinked, totalRows: total });
    setImportErrors(errors);
    setImporting(false);
    await loadPatientsFromFirestore();
  };`);

fs.writeFileSync('src/components/DentalCRMView.tsx', content, 'utf-8');
console.log("Rewrite applied");
