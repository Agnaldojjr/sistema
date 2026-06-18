import fs from 'fs';

let content = fs.readFileSync('src/components/DentalCRMView.tsx', 'utf-8');

const regex = /const importJSONData = async \(payload: any\) => \{[\s\S]*?setImporting\(false\);\n    \}\n  \};/m;

const replacement = `const importJSONData = async (payload: any) => {
    let pCreated = 0;
    let pUpdated = 0;
    let appsLinked = 0;
    let clinLinked = 0;
    let commsLinked = 0;
    let anaLinked = 0;
    let aviLinked = 0;
    let docLinked = 0;
    let galLinked = 0;
    let payLinked = 0;
    let tratLinked = 0;
    let odoLinked = 0;
    const errors: string[] = [];

    try {
      const validationResult = ImportPayloadSchema.safeParse(payload);
      if (!validationResult.success) {
        throw new Error("Formato de JSON invalido");
      }

      let items: any[] = [];
      if (Array.isArray(payload)) {
        items = payload;
      } else if (payload && payload.acao === "importar_dados_pacientes" && payload.dados) {
        items = Array.isArray(payload.dados) ? payload.dados : [payload.dados];
      } else if (payload && payload.dados) {
        items = Array.isArray(payload.dados) ? payload.dados : [payload.dados];
      } else if (payload) {
        items = [payload];
      }

      setImportProgress(10);
      const totalItems = items.length;

      let crmData: any;
      try {
        crmData = await getGoogleDriveCRMDatabase();
      } catch (err: any) {
        setImportErrors(["Falha ao carregar banco de dados base do Google Drive. Verifique autenticação."]);
        setImporting(false);
        return;
      }

      if (!crmData.patients) crmData.patients = [];
      if (!crmData.appointments) crmData.appointments = [];
      if (!crmData.clinical_history) crmData.clinical_history = [];
      if (!crmData.communications) crmData.communications = [];
      if (!crmData.anamnese) crmData.anamnese = [];
      if (!crmData.avisos) crmData.avisos = [];
      if (!crmData.documentos) crmData.documentos = [];
      if (!crmData.galeria) crmData.galeria = [];
      if (!crmData.odontograma_history) crmData.odontograma_history = [];
      if (!crmData.pagamentos) crmData.pagamentos = [];
      if (!crmData.tratamentos) crmData.tratamentos = [];

      const patientsMapByCode: { [key: string]: any } = {};
      const patientsMapByName: { [key: string]: any } = {};
      crmData.patients.forEach((docSnap: any) => {
        const data = docSnap;
        const id = docSnap.id;
        if (data.codigo_paciente) {
          patientsMapByCode[String(data.codigo_paciente)] = { id, data };
        }
        if (data.name) {
          patientsMapByName[String(data.name).trim().toUpperCase()] = { id, data };
        }
      });

      setImportProgress(25);

      for (let index = 0; index < totalItems; index++) {
        const item = items[index];
        const pInfo = item.paciente || {};
        const nomeRaw = pInfo.nome_completo || pInfo.nome || '';
        const nome = String(nomeRaw).trim().toUpperCase();

        const fileLabel = \`Upload JSON Paciente \${index + 1}\`;

        if (!nome) {
          errors.push(\`[\${fileLabel}] Falha Crítica: Campo 'nome_completo' ou 'nome_paciente' ausente.\`);
          continue;
        }

        const codigo = pInfo.codigo_cliente || pInfo.codigo_paciente || '';

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

        const existingData = existingDocSnap ? existingDocSnap.data : null;
        const patientCodeStr = codigo ? String(codigo) : (existingData ? existingData.codigo_paciente : \`COD-\${Math.floor(1000 + Math.random() * 9000)}\`);

        const contatos = pInfo.contatos || {};
        const java_endereco = pInfo.endereco || {};

        const phone = contatos.telefone_1 || contatos.telefone_2 || (existingData ? existingData.phone : '');
        const mobile = contatos.telefone_3 || contatos.telefone_2 || contatos.telefone_1 || (existingData ? existingData.mobile : '');
        const email = contatos.email || (existingData ? existingData.email : '');

        const street = java_endereco.logradouro || (existingData ? existingData.street : '');
        const number = java_endereco.numero || (existingData ? existingData.number : '');
        const neighborhood = java_endereco.bairro || (existingData ? existingData.neighborhood : '');
        const city = java_endereco.cidade || (existingData ? existingData.city : 'Salgado');
        const state = java_endereco.uf || (existingData ? existingData.state : 'SE');
        const cep = java_endereco.cep || (existingData ? existingData.cep : '');

        const birthDate = pInfo.data_nascimento ? normalizeDate(pInfo.data_nascimento) : (existingData ? existingData.birthDate : '');
        const gender = pInfo.sexo ? String(pInfo.sexo).trim().toUpperCase() : (existingData ? existingData.gender : '');
        const maritalStatus = pInfo.estado_civil ? String(pInfo.estado_civil).trim().toUpperCase() : (existingData ? existingData.maritalStatus : '');

        const healthInsurance = pInfo.convenio || pInfo.plano || (existingData ? existingData.healthInsurance : 'PARTICULAR');
        const medicalRecord = pInfo.prontuario || pInfo.n_prontuario || (existingData ? existingData.medicalRecord : '');
        const observations = pInfo.observacoes || pInfo.obs || (existingData ? existingData.observations : '');

        const patData: any = {
          name: nome,
          codigo_paciente: patientCodeStr,
          phone,
          mobile,
          email,
          birthDate,
          gender,
          maritalStatus,
          street,
          number,
          neighborhood,
          city,
          state,
          cep,
          healthInsurance,
          medicalRecord,
          observations,
          updatedAt: new Date().toISOString()
        };

        if (isNew) {
          patData.createdAt = new Date().toISOString();
          patientId = \`pat_\${Date.now()}_\${Math.floor(Math.random() * 1000)}\`;
          patData.id = patientId;
          crmData.patients.push(patData);
          pCreated++;
        } else {
          const idx = crmData.patients.findIndex((p:any) => p.id === patientId);
          if (idx >= 0) crmData.patients[idx] = { ...crmData.patients[idx], ...patData };
          pUpdated++;
        }

        const cacheRef = { id: patientId, data: patData };
        if (patientCodeStr) patientsMapByCode[patientCodeStr] = cacheRef;
        patientsMapByName[nome] = cacheRef;

        const pushToArr = (arrName: string, idPrefix: string, itemObj: any) => {
          const hId = \`\${idPrefix}_\${patientId}_\${hashCode(JSON.stringify(itemObj))}\`;
          const crmArr = crmData[arrName];
          const exists = crmArr.findIndex((a:any) => a.id === hId);
          itemObj.id = hId;
          itemObj.patientId = patientId;
          if (exists >= 0) { crmArr[exists] = {...crmArr[exists], ...itemObj}; }
          else { crmArr.push(itemObj); }
        };

        (item.agendamentos || []).forEach((a:any) => {
            pushToArr('appointments', 'app', { ...a, date: normalizeDate(a.data_agendamento || a.data || '')  });
            appsLinked++;
        });
        (item.anamnese || []).forEach((a:any) => { pushToArr('anamnese', 'ana', a); anaLinked++; });
        (item.avisos || []).forEach((a:any) => { pushToArr('avisos', 'avi', { ...a, date: normalizeDate(a.data_criacao || '') }); aviLinked++; });
        (item.documentos || []).forEach((a:any) => { pushToArr('documentos', 'doc', { ...a, date: normalizeDate(a.data_documento || '') }); docLinked++; });
        (item.galeria || []).forEach((a:any) => { pushToArr('galeria', 'gal', { ...a, date: normalizeDate(a.data_envio || '') }); galLinked++; });
        (item.historico || []).forEach((a:any) => { pushToArr('clinical_history', 'hist', { ...a, date: normalizeDate(a.data_criacao || ''), proceduresPerformed: a.descricao_procedimento, treatmentEvolution: a.acao }); clinLinked++; });
        (item.odontograma || []).forEach((a:any) => { pushToArr('odontograma_history', 'odo', a); odoLinked++; });
        (item.pagamentos || []).forEach((a:any) => { pushToArr('pagamentos', 'pay', { ...a, date: normalizeDate(a.data_pagamento || '') }); payLinked++; });
        (item.tratamentos || []).forEach((a:any) => { pushToArr('tratamentos', 'trat', { ...a, date: normalizeDate(a.data_inicio || '') }); tratLinked++; });
      }

      setImportProgress(60);
      try {
        await saveGoogleDriveCRMDatabase(crmData);
      } catch (err: any) {
        errors.push("Erro crítico: Falha ao salvar banco de dados do CRM no Drive: " + err.message);
      }

      setImportProgress(100);
      setImportSummary({
        patientsCreated: pCreated,
        patientsUpdated: pUpdated,
        appointmentsLinked: appsLinked,
        clinicalsLinked: clinLinked + odoLinked,
        communicationsLinked: commsLinked + aviLinked,
        totalRows: totalItems
      });
      setImportErrors(errors);
      setImporting(false);
      await loadPatientsFromFirestore();

    } catch (err: any) {
      setImportErrors(prev => [...prev, \`Falha crítica durante importação dos dados estruturados: \${err.message || err}\`]);
      setImporting(false);
    }
  };`;

content = content.replace(regex, replacement);

fs.writeFileSync('src/components/DentalCRMView.tsx', content, 'utf-8');
console.log('Script ran!');
