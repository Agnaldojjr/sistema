/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  Search, 
  User, 
  Calendar, 
  ClipboardList, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Loader2, 
  ShieldAlert, 
  ArrowRight, 
  Download, 
  Filter, 
  Sparkles, 
  RefreshCw,
  Plus,
  Save,
  Trash2,
  FileText,
  Camera,
  FolderOpen,
  X,
  Pencil,
  Check
} from 'lucide-react';
import { getGoogleDriveCRMDatabase, saveGoogleDriveCRMDatabase } from '../lib/driveCrm';
import * as XLSX from 'xlsx';
import { CRMPatient, CRMAppointment, CRMClinicalHistory, CRMCommunication } from '../types';
import { z } from 'zod';
import {
  listPatientsFromDrive,
  loadPatientFromDrive,
  listPatientImagesFromDrive,
  deletePatientFolderFromDrive,
  deleteDummyPatientsFromDrive,
  listPatientProposalsFromDrive,
  getOrCreatePatientFolderByName,
  renameFileInDrive,
  uploadPatientImageToDrive,
  deleteFileFromDrive
} from '../lib/drive';

// --- ZOD SCHEMAS FOR HISTORICAL IMPORT CONTENT VALIDATION ---
const lenientString = z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable();

const PatientContactSchema = z.object({
  telefone_1: lenientString,
  telefone_2: lenientString,
  telefone_3: lenientString,
  email: lenientString,
}).partial().optional().nullable();

const PatientAddressSchema = z.object({
  logradouro: lenientString,
  numero: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
  bairro: lenientString,
  cidade: lenientString,
  uf: lenientString,
  cep: lenientString,
}).partial().optional().nullable();

const PatientInfoSchema = z.object({
  nome_completo: z.string().min(3, "O nome do paciente é obrigatório e deve conter no mínimo 3 caracteres."),
  codigo_cliente: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
  codigo_paciente: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
  data_nascimento: lenientString,
  sexo: lenientString,
  estado_civil: lenientString,
  convenio: lenientString,
  plano: lenientString,
  prontuario: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
  n_prontuario: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
  observacoes: lenientString,
  obs: lenientString,
  contatos: PatientContactSchema,
  endereco: PatientAddressSchema,
});

const PatientInfoWithAliasSchema = z.preprocess((val: any) => {
  if (typeof val === 'object' && val !== null) {
    const nome_completo = val.nome_completo || val.nome || val.nome_paciente || '';
    return {
      ...val,
      nome_completo,
    };
  }
  return val;
}, PatientInfoSchema);

const AppointmentSchema = z.object({
  data_agendamento: lenientString,
  data: lenientString,
  hora_agendamento: lenientString,
  hora: lenientString,
  dentista: lenientString,
  status: lenientString,
  especialidade: lenientString,
  observacao: lenientString,
}).partial();

const AnamneseSchema = z.object({
  pergunta: lenientString,
  resposta: lenientString,
}).partial();

const AlertaSchema = z.object({
  titulo: lenientString,
  conteudo: lenientString,
  data_criacao: lenientString,
}).partial();

const DocumentSchema = z.object({
  tipo_documento: lenientString,
  conteudo: lenientString,
  data_documento: lenientString,
}).partial();

const GallerySchema = z.object({
  url_arquivo: lenientString,
  descricao: lenientString,
  data_envio: lenientString,
}).partial();

const ClinicalHistorySchema = z.object({
  descricao_procedimento: lenientString,
  codigo_dente: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
  acao: lenientString,
  data_criacao: lenientString,
}).partial();

const OdontogramaSchema = z.object({
  descricao_procedimento: lenientString,
  codigo_dente: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
  situacao: lenientString,
  valor: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
}).partial();

const PaymentSchema = z.object({
  forma_pagamento: lenientString,
  descricao: lenientString,
  valor: z.preprocess((val) => (val !== undefined && val !== null) ? String(val) : val, z.string()).optional().nullable(),
  data_pagamento: lenientString,
}).partial();

const TreatmentPlanSchema = z.object({
  nome_treatmento: lenientString,
  nome_tratamento: lenientString,
  data_inicio: lenientString,
  status: lenientString,
  observacao: lenientString,
}).partial();

const PatientRecordSchema = z.object({
  paciente: PatientInfoWithAliasSchema,
  agendamentos: z.array(AppointmentSchema).optional().nullable().default([]).transform(val => val ?? []),
  anamnese: z.array(AnamneseSchema).optional().nullable().default([]).transform(val => val ?? []),
  avisos: z.array(AlertaSchema).optional().nullable().default([]).transform(val => val ?? []),
  documentos: z.array(DocumentSchema).optional().nullable().default([]).transform(val => val ?? []),
  galeria: z.array(GallerySchema).optional().nullable().default([]).transform(val => val ?? []),
  historico: z.array(ClinicalHistorySchema).optional().nullable().default([]).transform(val => val ?? []),
  odontograma: z.array(OdontogramaSchema).optional().nullable().default([]).transform(val => val ?? []),
  pagamentos: z.array(PaymentSchema).optional().nullable().default([]).transform(val => val ?? []),
  tratamentos: z.array(TreatmentPlanSchema).optional().nullable().default([]).transform(val => val ?? []),
});

const ImportPayloadSchema = z.union([
  z.array(PatientRecordSchema),
  z.object({
    acao: z.string().optional().nullable(),
    dados: z.union([z.array(PatientRecordSchema), PatientRecordSchema])
  }),
  z.object({
    dados: z.union([z.array(PatientRecordSchema), PatientRecordSchema])
  }),
  PatientRecordSchema
]);

export default function DentalCRMView({
  onLoadPatientData,
  onNewProposal,
  onChangeView,
  clinicSettings
}: {
  onLoadPatientData?: (data: any) => void;
  onNewProposal?: (patientName: string) => void;
  onChangeView?: (view: any) => void;
  clinicSettings?: any;
} = {}) {
  // Navigation
  const [activeSubTab, setActiveSubTab] = useState<'import' | 'crm'>('crm'); // Default directly to CRM for quick review!
  
  // CRM Patients state
  const [patients, setPatients] = useState<CRMPatient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<CRMPatient | null>(null);
  
  // CRM sub-modules state for selected patient
  const [appointments, setAppointments] = useState<CRMAppointment[]>([]);
  const [clinicalHistory, setClinicalHistory] = useState<CRMClinicalHistory[]>([]);
  const [communications, setCommunications] = useState<CRMCommunication[]>([]);
  
  // Custom deep modular components state for JSON payload support and detailed view panels
  const [anamneseList, setAnamneseList] = useState<any[]>([]);
  const [avisosList, setAvisosList] = useState<any[]>([]);
  const [documentosList, setDocumentosList] = useState<any[]>([]);
  const [galeriaList, setGaleriaList] = useState<any[]>([]);
  const [pagamentosList, setPagamentosList] = useState<any[]>([]);
  const [tratamentosList, setTratamentosList] = useState<any[]>([]);
  const [odontogramaList, setOdontogramaList] = useState<any[]>([]);
  const [activeDetailTab, setActiveDetailTab] = useState<'info' | 'appointments' | 'anamnesis' | 'clinical' | 'communication' | 'financial' | 'docs_gallery' | 'drive_records'>('info');

  // Google Drive integration states
  const [driveFolderId, setDriveFolderId] = useState<string | null>(null);
  const [driveProposals, setDriveProposals] = useState<any[]>([]);
  const [isLoadingDriveProposals, setIsLoadingDriveProposals] = useState(false);
  const [driveImages, setDriveImages] = useState<any[]>([]);
  const [isLoadingDriveImages, setIsLoadingDriveImages] = useState(false);
  const [isDriveUploading, setIsDriveUploading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [editingProposalId, setEditingProposalId] = useState<string | null>(null);
  const [editingProposalName, setEditingProposalName] = useState<string>('');
  const [isLoadingProposalAction, setIsLoadingProposalAction] = useState<string | null>(null);

  // HTML5 Webcam and snapshot states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStreamRef = useRef<MediaStream | null>(null);

  // Global search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [insuranceFilter, setInsuranceFilter] = useState('ALL');
  const [isLoadingCRM, setIsLoadingCRM] = useState(false);
  
  // File upload states
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSummary, setImportSummary] = useState<{
    patientsCreated: number;
    patientsUpdated: number;
    appointmentsLinked: number;
    clinicalsLinked: number;
    communicationsLinked: number;
    totalRows: number;
  } | null>(null);

  // Mapeamento e parse do Excel
  const [importStatus, setImportStatus] = useState<'idle' | 'loaded'>('idle');
  const [rawData, setRawData] = useState<any[][]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [mappings, setMappings] = useState({ name: -1, phone: -1, code: -1, date: -1, procedure: -1, value: -1 });

  // Filter and search states for the detailed clinical log viewer
  const [logFilter, setLogFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'FORMAT'>('ALL');
  const [logSearch, setLogSearch] = useState('');

  // Quick manually added entry states (for demo or instant updates)
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [newPatientData, setNewPatientData] = useState<Partial<CRMPatient>>({
    name: '',
    codigo_paciente: '',
    phone: '',
    mobile: '',
    healthInsurance: 'PARTICULAR',
    medicalRecord: '',
    observations: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load patient directory on mount or tab change
  useEffect(() => {
    loadPatientsFromFirestore();
  }, []);

  // Sync related lists when selected patient changes
  useEffect(() => {
    if (selectedPatient) {
      loadPatientSubModules(selectedPatient.id);
      syncGoogleDriveDataForPatient(selectedPatient.name);
    } else {
      setAppointments([]);
      setClinicalHistory([]);
      setCommunications([]);
      setAnamneseList([]);
      setAvisosList([]);
      setDocumentosList([]);
      setGaleriaList([]);
      setPagamentosList([]);
      setTratamentosList([]);
      setOdontogramaList([]);
      setDriveFolderId(null);
      setDriveProposals([]);
      setDriveImages([]);
      setDriveError(null);
      setIsCameraActive(false);
      stopCameraStream();
      setActiveDetailTab('info');
    }
    return () => {
      stopCameraStream();
    };
  }, [selectedPatient]);

  const syncGoogleDriveDataForPatient = async (patientName: string) => {
    setDriveError(null);
    setDriveFolderId(null);
    setDriveProposals([]);
    setDriveImages([]);
    
    try {
      setIsLoadingDriveProposals(true);
      setIsLoadingDriveImages(true);
      
      const folderId = await getOrCreatePatientFolderByName(patientName);
      setDriveFolderId(folderId);
      
      // Load proposals
      try {
        const proposals = await listPatientProposalsFromDrive(folderId);
        setDriveProposals(proposals || []);
      } catch (err: any) {
        console.warn("Failed to load proposals for folder:", folderId, err);
      } finally {
        setIsLoadingDriveProposals(false);
      }

      // Load images
      try {
        const images = await listPatientImagesFromDrive(folderId);
        setDriveImages(images || []);
      } catch (err: any) {
        console.warn("Failed to load images for folder:", folderId, err);
      } finally {
        setIsLoadingDriveImages(false);
      }
    } catch (err: any) {
      console.warn("Drive folder sync failed", err);
      setDriveError("Não foi possível conectar com o Google Drive para este paciente.");
      setIsLoadingDriveProposals(false);
      setIsLoadingDriveImages(false);
    }
  };

  const uploadDriveFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!driveFolderId || !e.target.files || e.target.files.length === 0) return;
    try {
      setIsDriveUploading(true);
      const file = e.target.files[0];
      const name = file.name;
      await uploadPatientImageToDrive(driveFolderId, file, name);
      // Refresh
      const images = await listPatientImagesFromDrive(driveFolderId);
      setDriveImages(images || []);
    } catch (err: any) {
      alert("Erro ao enviar imagem ao Drive: " + err.message);
    } finally {
      setIsDriveUploading(false);
    }
  };

  const deleteDriveFile = async (fileId: string) => {
    if (!window.confirm("Deseja realmente excluir este arquivo do Google Drive?")) return;
    try {
      setIsDriveUploading(true);
      await deleteFileFromDrive(fileId);
      if (driveFolderId) {
        const images = await listPatientImagesFromDrive(driveFolderId);
        setDriveImages(images || []);
      }
    } catch (err: any) {
      alert("Erro ao excluir arquivo: " + err.message);
    } finally {
      setIsDriveUploading(false);
    }
  };

  const deleteDriveProposalFile = async (fileId: string) => {
    if (!window.confirm("Deseja realmente excluir este orçamento/projeto do Google Drive?")) return;
    try {
      setIsLoadingDriveProposals(true);
      await deleteFileFromDrive(fileId);
      if (driveFolderId) {
        const proposals = await listPatientProposalsFromDrive(driveFolderId);
        setDriveProposals(proposals || []);
      }
    } catch (err: any) {
      alert("Erro ao excluir orçamento: " + err.message);
    } finally {
      setIsLoadingDriveProposals(false);
    }
  };

  const renameDriveProposalFile = async (fileId: string, currentName: string) => {
    const newName = window.prompt("Digite o novo nome para o arquivo (com extensão .json):", currentName);
    if (!newName || newName.trim() === '' || newName === currentName) return;
    try {
      setIsLoadingDriveProposals(true);
      await renameFileInDrive(fileId, newName.trim());
      if (driveFolderId) {
        const proposals = await listPatientProposalsFromDrive(driveFolderId);
        setDriveProposals(proposals || []);
      }
    } catch (err: any) {
      alert("Erro ao renomear orçamento: " + err.message);
    } finally {
      setIsLoadingDriveProposals(false);
    }
  };

  const handleLoadProposalIntoWorkspace = async (fileId: string) => {
    if (!onLoadPatientData) return;
    try {
      setIsLoadingProposalAction(fileId);
      const data = await loadPatientFromDrive(fileId);
      onLoadPatientData(data);
      if (onChangeView) {
        onChangeView('planning');
      }
    } catch (err: any) {
      alert("Erro ao carregar planejamento no espaço de trabalho: " + err.message);
    } finally {
      setIsLoadingProposalAction(null);
    }
  };

  // HTML5 Camera controls
  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facingMode }
      });
      activeStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Camera access error", err);
      setCameraError("Não foi possível acessar a câmera do dispositivo.");
    }
  };

  const stopCameraStream = () => {
    if (activeStreamRef.current) {
      activeStreamRef.current.getTracks().forEach((track) => track.stop());
      activeStreamRef.current = null;
    }
  };

  const toggleCameraFacingMode = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    stopCameraStream();
    // Restart stream
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: nextMode }
        });
        activeStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (err) {
        setCameraError("Falha ao inverter câmera");
      }
    }, 100);
  };

  const captureCameraSnapshot = async () => {
    if (!videoRef.current || !canvasRef.current || !driveFolderId) return;
    try {
      setIsDriveUploading(true);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Simple scale horizontal flip for user preview correctness
        ctx.scale(-1, 1);
        ctx.drawImage(video, -width, 0, width, height);
      }
      
      const blob: Blob = await new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
      });
      
      const filename = `snapshot_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '_')}.jpg`;
      const file = new File([blob], filename, { type: 'image/jpeg' });
      await uploadPatientImageToDrive(driveFolderId, file, filename);
      
      // Refresh list
      const images = await listPatientImagesFromDrive(driveFolderId);
      setDriveImages(images || []);
      
      setIsCameraActive(false);
      stopCameraStream();
    } catch (err: any) {
      alert("Erro ao salvar foto: " + err.message);
    } finally {
      setIsDriveUploading(false);
    }
  };

  const loadPatientsFromFirestore = async () => {
    setIsLoadingCRM(true);
    try {
      const dbData = await getGoogleDriveCRMDatabase();
      const list = dbData.patients || [];
      // Sort patients alphabetically
      list.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setPatients(list);
    } catch (err) {
      console.error('Error fetching CRM patients:', err);
    } finally {
      setIsLoadingCRM(false);
    }
  };

  const loadPatientSubModules = async (patientId: string) => {
    try {
      const dbData = await getGoogleDriveCRMDatabase();

      // 1. Appointments
      const appList = (dbData.appointments || []).filter((d: any) => d.patientId === patientId);
      appList.sort((a: any, b: any) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
      setAppointments(appList);

      // 2. Clinical History
      const clinList = (dbData.clinical_history || []).filter((d: any) => d.patientId === patientId);
      clinList.sort((a: any, b: any) => b.date.localeCompare(a.date));
      setClinicalHistory(clinList);

      // 3. Communications
      const commList = (dbData.communications || []).filter((d: any) => d.patientId === patientId);
      commList.sort((a: any, b: any) => b.date.localeCompare(a.date));
      setCommunications(commList);

      // 4. Anamnese questions/answers
      setAnamneseList((dbData.anamnese || []).filter((d: any) => d.patientId === patientId));

      // 5. Avisos / Clinica notifications
      setAvisosList((dbData.avisos || []).filter((d: any) => d.patientId === patientId));

      // 6. Clinical Documents / PDFs
      setDocumentosList((dbData.documentos || []).filter((d: any) => d.patientId === patientId));

      // 7. Photo Gallery
      setGaleriaList((dbData.galeria || []).filter((d: any) => d.patientId === patientId));

      // 8. Financial Receipts
      setPagamentosList((dbData.pagamentos || []).filter((d: any) => d.patientId === patientId));

      // 9. Treatment Workflows
      setTratamentosList((dbData.tratamentos || []).filter((d: any) => d.patientId === patientId));

      // 10. Dental Teeth Marks
      setOdontogramaList((dbData.odontograma_history || []).filter((d: any) => d.patientId === patientId));

    } catch (err) {
      console.error('Error loading patient details:', err);
    }
  };

  // Drag-and-drop mechanics
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const runPromisesInChunks = async (tasks: (() => Promise<any>)[], chunkSize = 10, onChunkComplete?: (completedCount: number) => void) => {
    let completed = 0;
    console.log(`[Import] Iniciando execução de ${tasks.length} escritas em lotes de ${chunkSize}...`);
    for (let i = 0; i < tasks.length; i += chunkSize) {
      const chunk = tasks.slice(i, i + chunkSize);
      try {
        await Promise.all(chunk.map(task => task()));
      } catch (err) {
        console.error(`[Import Batch Error] Falha de gravação de chunk:`, err);
      }
      completed += chunk.length;
      if (onChunkComplete) {
        onChunkComplete(completed);
      }
      // Pequeno respiro para diminuir conexões pendentes simultâneas no navegador
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    console.log(`[Import] Execução de ${tasks.length} escritas de Firestore concluída!`);
  };

  const importJSONData = async (payload: any) => {
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

        const fileLabel = `Upload JSON Paciente ${index + 1}`;

        if (!nome) {
          errors.push(`[${fileLabel}] Falha Crítica: Campo 'nome_completo' ou 'nome_paciente' ausente.`);
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
        const patientCodeStr = codigo ? String(codigo) : (existingData ? existingData.codigo_paciente : `COD-${Math.floor(1000 + Math.random() * 9000)}`);

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
          patientId = `pat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
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
          const hId = `${idPrefix}_${patientId}_${hashCode(JSON.stringify(itemObj))}`;
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
      setImportErrors(prev => [...prev, `Falha crítica durante importação dos dados estruturados: ${err.message || err}`]);
      setImporting(false);
    }
  };

  const initializeMappingsFromRows = (raw: any[][]) => {
    if (!raw || raw.length === 0) return;
    const h = raw[0].map(c => String(c || '').trim());
    setSheetHeaders(h);
    setRawData(raw);
    
    let nameIdx = -1; let phoneIdx = -1; let codeIdx = -1; let dateIdx = -1; let procedureIdx = -1; let valueIdx = -1;
    
    h.forEach((header, idx) => {
      const lower = header.toLowerCase();
      if (nameIdx === -1 && (lower.includes('nome') || lower.includes('paciente') || lower.includes('cliente'))) nameIdx = idx;
      if (phoneIdx === -1 && (lower.includes('telefone') || lower.includes('cel') || lower.includes('whatsapp'))) phoneIdx = idx;
      if (codeIdx === -1 && (lower.includes('codigo') || lower.includes('cod') || lower.includes('id') || lower.includes('prontuario'))) codeIdx = idx;
      if (dateIdx === -1 && (lower.includes('data') || lower.includes('criacao'))) dateIdx = idx;
      if (procedureIdx === -1 && (lower.includes('procedimento') || lower.includes('descricao') || lower.includes('servico') || lower.includes('tratamento'))) procedureIdx = idx;
      if (valueIdx === -1 && (lower.includes('valor') || lower.includes('preco') || lower.includes('custo'))) valueIdx = idx;
    });

    setMappings({ name: nameIdx, phone: phoneIdx, code: codeIdx, date: dateIdx, procedure: procedureIdx, value: valueIdx });
    setImportStatus('loaded');
    setImporting(false);
  };

  const handleMappingChange = (field: string, value: number) => {
    setMappings(prev => ({ ...prev, [field]: value }));
  };

  const handleExecuteMappedImport = async () => {
    if (mappings.name === -1) {
      alert("Por favor, selecione a coluna de Nome do Paciente.");
      return;
    }
    
    const dataRows = rawData.slice(1).filter(row => row.length > 0 && String(row[mappings.name] || '').trim() !== '');
    if (dataRows.length === 0) {
      alert("Nenhum dado encontrado na planilha com a coluna selecionada.");
      return;
    }

    setImporting(true);
    setImportStatus('idle'); // Hide mapping UI and return to loading mode
    setImportProgress(20);

    const objs = dataRows.map((row, idx) => {
      return {
        _originalLineNumber: idx + 2,
        _sourceType: 'Planilha CRM',
        nome_paciente: row[mappings.name],
        codigo_cliente: mappings.code !== -1 ? row[mappings.code] : '',
        telefone_1: mappings.phone !== -1 ? row[mappings.phone] : '',
        data_realizado: mappings.date !== -1 ? row[mappings.date] : '',
        descricao_procedimento: mappings.procedure !== -1 ? row[mappings.procedure] : '',
        valor: mappings.value !== -1 ? row[mappings.value] : ''
      };
    });

    await importDataRows(objs);
  };

  // Excel / CSV / MD File Parsing & Smart Column Mapping Engine
  const processFile = async (file: File) => {
    setImporting(true);
    setImportProgress(10);
    setImportErrors([]);
    setImportSummary(null);

    const isJson = file.name.endsWith('.json');
    const isPdf = file.name.endsWith('.pdf');
    const isText = file.name.endsWith('.md') || file.name.endsWith('.txt') || file.name.endsWith('.csv');

    // -- For JSON --
    if (isJson) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = String(e.target?.result);
          const parsed = JSON.parse(text);
          setImportProgress(40);
          await importJSONData(parsed);
        } catch (err: any) {
          setImportErrors([`Falha ao ler JSON: ${err.message || err}`]);
          setImporting(false);
        }
      };
      reader.onerror = () => {
        setImportErrors(["Erro ao ler JSON no navegador"]);
        setImporting(false);
      };
      reader.readAsText(file, "UTF-8");
      return;
    }

    // -- For Advanced PDF/Text/Excel --
    const convertArraysToObjects = (rawArrays: any[][]) => {
      // Assumes first array is header
      if (!rawArrays || rawArrays.length < 2) return [];
      const headers = rawArrays[0].map(h => String(h || '').trim());
      const objs: any[] = [];
      for (let i = 1; i < rawArrays.length; i++) {
        const row = rawArrays[i];
        const obj: any = { _originalLineNumber: i + 1, _sourceType: 'Planilha/Documento' };
        let hasData = false;
        headers.forEach((h, idx) => {
          if (row[idx] !== undefined && row[idx] !== '') {
            obj[h] = row[idx];
            hasData = true;
          }
        });
        if (hasData) objs.push(obj);
      }
      return objs;
    };

    if (isPdf) {
      setImportProgress(25);
      // Fallback simple message for PDF since PDFjs is too complex to inline in this function 
      // without large helper dependencies. But the user can upload textual files.
      // A full AI extraction workflow would parse PDF strings.
      setImportErrors(["PDF precisa ser importado em formato de Texto, CSV ou Excel para o CRM."]);
      setImporting(false);
      return;
    }

    if (isText) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const text = String(event.target?.result || '');
          // Basic CSV/TSV extraction
          const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
          const rawArrays = lines.map(l => l.split(/[,;\t|]/).map(c => c.trim()));
          if (rawArrays.length < 2) throw new Error("Documento CSV vazio ou sem colunas.");
          initializeMappingsFromRows(rawArrays);
        } catch (err: any) {
          setImportErrors([`Falha ao mapear TXT/CSV: ${err.message || err}`]);
          setImporting(false);
        }
      };
      reader.readAsText(file, "UTF-8");
      return;
    }

    // -- For Modern Excel (XLSX, XLS) --
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        setImportProgress(25);
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Obtains array of arrays
        const rawArrays = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
        
        if (!rawArrays || rawArrays.length < 2) {
          throw new Error("A planilha não parece ter dados ou cabeçalhos válidos.");
        }

        initializeMappingsFromRows(rawArrays);
      } catch (err: any) {
        setImportErrors([`Falha ao processar Planilha: ${err.message || err}`]);
        setImporting(false);
      }
    };
    reader.onerror = () => {
      setImportErrors(["Erro ao carregar o arquivo."]);
      setImporting(false);
    };
    reader.readAsArrayBuffer(file);
  };

  // Core Import CRM Intelligence: normalization, matching, grouping & idempotent sync
  const importDataRows = async (rows: any[]) => {
    let pCreated = 0;
    let pUpdated = 0;
    let appsLinked = 0;
    let clinLinked = 0;
    let commsLinked = 0;
    const errors: string[] = [];
    const total = rows.length;

    setImportProgress(20);
    
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

    setImportProgress(35);

    const patientGroups: { [key: string]: any[] } = {};

    rows.forEach((row, index) => {
      const cleanRow: any = {};
      Object.keys(row).forEach(k => {
        const cleanK = k.replace(/\\/g, ''); 
        const normalizedKey = cleanK.toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9_]/g, "_")
          .replace(/_+/g, "_"); 
        cleanRow[normalizedKey] = row[k];
      });

      const lineNum = row._originalLineNumber || (index + 2);
      const isMd = row._sourceType === 'MD';
      const fileLabel = isMd ? `Markdown Linha ${lineNum}` : `Linha ${lineNum}`;

      const codigo = cleanRow.codigo_cliente || cleanRow.codigo_paciente || cleanRow.id_paciente || cleanRow.codigo || cleanRow.cod_cli || '';
      const nomeRaw = cleanRow.nome_paciente || cleanRow.paciente || cleanRow.nome || cleanRow.cliente || cleanRow.nome_completo || '';
      const nome = String(nomeRaw).trim().toUpperCase();

      if (!nome || nome === 'NAN' || nome === '') {
        errors.push(`[${fileLabel}] Falha Crítica: Campo 'nome_paciente' ou 'paciente' ausente. Linha ignorada.`);
        return;
      }

      if (nome.length < 3) {
        errors.push(`[${fileLabel}] Erro: Nome do paciente "${nome}" é muito curto para ser válido.`);
        return;
      }

      if (!codigo || String(codigo).toLowerCase() === 'nan' || String(codigo).trim() === '') {
        errors.push(`[${fileLabel}] Aviso: Campo de Código Único do Cliente (codigo_cliente) ausente ou inválido (NaN). CRM agrupará pelo Nome.`);
      }

      let appDateRaw = '';
      const possibleDates = [
        cleanRow.data_realizado,
        cleanRow.created_at,
        cleanRow.data_criacao_odontograma,
        cleanRow.data,
        cleanRow.data_consulta,
        cleanRow.data_agendamento,
        cleanRow.data_atendimento
      ];
      for (const pd of possibleDates) {
        if (pd && String(pd).trim() !== '' && String(pd).toLowerCase() !== 'nan') {
          appDateRaw = String(pd);
          break;
        }
      }

      const procedureName = cleanRow.descricao_procedimento || cleanRow.procedimento || cleanRow.tratamento || cleanRow.servico || cleanRow.procedimento_realizado || '';
      const hasProcedure = procedureName && String(procedureName).trim().toLowerCase() !== 'nan';

      if (!appDateRaw || appDateRaw.toLowerCase() === 'nan') {
        if (hasProcedure) {
          errors.push(`[${fileLabel}] Aviso: Data de realização do procedimento ("${procedureName}") está ausente ou corrompida (NaN). Usando data atual.`);
        }
      } else {
        const normalized = normalizeDate(appDateRaw);
        if (normalized === appDateRaw && !appDateRaw.match(/^\d{4}-\d{2}-\d{2}/) && !appDateRaw.includes('/')) {
          errors.push(`[${fileLabel}] Formato Inválido: Data "${appDateRaw}" possui representação incompatível. Formatos ideais: YYYY-MM-DD ou DD/MM/YYYY.`);
        }
      }

      const valorRaw = cleanRow.valor || cleanRow.custo || cleanRow.preco || '';
      if (valorRaw && String(valorRaw).toLowerCase() !== 'nan') {
        const numVal = parseFloat(String(valorRaw));
        if (isNaN(numVal)) {
          errors.push(`[${fileLabel}] Formato Inválido: Campo de valor remunerado ("${valorRaw}") não pôde ser convertido.`);
        } else if (numVal < 0) {
          errors.push(`[${fileLabel}] Aviso: Preço ou custo negativo identificado para procedimento (${numVal}).`);
        }
      }

      const key = codigo && String(codigo).toLowerCase() !== 'nan' && String(codigo).trim() !== ''
        ? `CODE_${codigo}`
        : `NAME_${nome.replace(/\s+/g, '_')}`;

      if (!patientGroups[key]) {
        patientGroups[key] = [];
      }
      patientGroups[key].push({ cleanRow, originalRow: row, nome, codigo, lineNum, fileLabel, appDateRaw, valorRaw });
    });

    const patientKeys = Object.keys(patientGroups);
    const totalPatients = patientKeys.length;
    let currentPatIdx = 0;

    for (const patKey of patientKeys) {
      currentPatIdx++;
      const groupRows = patientGroups[patKey];
      const representative = groupRows[0];
      
      const { nome, codigo } = representative;
      const patientCodeStr = codigo && String(codigo).toLowerCase() !== 'nan' && String(codigo).trim() !== ''
        ? String(codigo)
        : `COD-${Math.floor(1000 + Math.random() * 9000)}`;

      let phone = '';
      let mobile = '';
      let healthInsurance = 'PARTICULAR';
      let medicalRecord = '';
      let observations = '';
      
      let cep = '';
      let street = '';
      let number = '';
      let complement = '';
      let neighborhood = '';
      let city = 'Salgado';
      let state = 'SE'; 

      groupRows.forEach(item => {
        const r = item.cleanRow;
        
        const possiblePhone = r.telefone || r.tel || r.fone || r.telefone_fixo || '';
        if (possiblePhone && !phone) phone = String(possiblePhone).trim();

        const possibleMobile = r.celular || r.mobile || r.whats || r.whatsapp || r.tel_celular || '';
        if (possibleMobile && !mobile) mobile = String(possibleMobile).trim();

        const possibleInsurance = r.convenio || r.plano || r.operadora || r.convenio_paciente || '';
        if (possibleInsurance) healthInsurance = String(possibleInsurance).trim().toUpperCase();

        const possibleMR = r.prontuario || r.n_prontuario || r.ficha || '';
        if (possibleMR) medicalRecord = String(possibleMR).trim();

        const possibleObs = r.observacoes || r.obs || r.observacao || r.historico_clinico || '';
        if (possibleObs) observations = (observations ? observations + ' | ' : '') + String(possibleObs).trim();

        if (r.cep) cep = String(r.cep);
        if (r.rua || r.endereco || r.logradouro) street = String(r.rua || r.endereco || r.logradouro);
        if (r.numero || r.num) number = String(r.numero || r.num);
        if (r.complemento) complement = String(r.complemento);
        if (r.bairro) neighborhood = String(r.bairro);
        if (r.cidade) city = String(r.cidade);
        if (r.estado || r.uf) state = String(r.estado || r.uf);
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

      const existingData = existingDocSnap ? existingDocSnap.data : null;

      const patData: Partial<CRMPatient> = {
        name: nome,
        codigo_paciente: patientCodeStr,
        phone: phone || (existingData ? existingData.phone : ''),
        mobile: mobile || (existingData ? existingData.mobile : ''),
        healthInsurance: healthInsurance || (existingData ? existingData.healthInsurance : 'PARTICULAR'),
        medicalRecord: medicalRecord || (existingData ? existingData.medicalRecord : ''),
        observations: observations || (existingData ? existingData.observations : ''),
        cep,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        updatedAt: new Date().toISOString()
      };

      if (isNew) {
        patData.createdAt = new Date().toISOString();
        patientId = `pat_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        patData.id = patientId;
        crmData.patients.push(patData);
        pCreated++;
      } else {
        const idx = crmData.patients.findIndex((p:any) => p.id === patientId);
        if (idx >= 0) crmData.patients[idx] = { ...crmData.patients[idx], ...patData };
        pUpdated++;
      }

      const cacheRef = { id: patientId, data: patData };
      if (patientCodeStr) {
        patientsMapByCode[patientCodeStr] = cacheRef;
      }
      patientsMapByName[nome] = cacheRef;

      for (const groupItem of groupRows) {
        const { cleanRow, appDateRaw, valorRaw } = groupItem;

        if (appDateRaw) {
          const appDate = normalizeDate(appDateRaw);
          
          let appTime = cleanRow.hora || cleanRow.horario || cleanRow.hora_consulta || '';
          if ((!appTime || String(appTime).toLowerCase() === 'nan') && appDateRaw.includes(' ')) {
            const timePart = appDateRaw.split(' ')[1];
            if (timePart) {
              appTime = timePart.substring(0, 5); 
            }
          }
          if (!appTime || String(appTime).toLowerCase() === 'nan') {
            appTime = '09:00';
          }

          const dentist = cleanRow.nome_dentista || cleanRow.dentista || cleanRow.profissional || cleanRow.medico || 'Dr. Agnaldo Ferreira';
          let dentistVal = String(dentist).trim();
          if (!dentistVal || dentistVal.toLowerCase() === 'nan') {
            dentistVal = 'Dr. Agnaldo Ferreira';
          }

          const specialty = cleanRow.especialidade || cleanRow.clinico || 'Odontologia';
          let specialtyVal = String(specialty).trim();
          if (!specialtyVal || specialtyVal.toLowerCase() === 'nan') {
            specialtyVal = 'Odontologia';
          }
          
          const statusText = cleanRow.descricao_situacao || cleanRow.status || cleanRow.situacao || cleanRow.estado || 'Atendido';
          let statusVal = String(statusText).trim();
          if (!statusVal || statusVal.toLowerCase() === 'nan') {
            statusVal = 'Atendido';
          }
          const status = mapAppointmentStatus(statusVal);
          
          const room = cleanRow.sala || cleanRow.consultorio || cleanRow.gabinete || '';
          const roomVal = String(room).toLowerCase() === 'nan' ? '' : String(room);

          const clinic = cleanRow.clinica || cleanRow.filial || 'Consultório Dr. Agnaldo';
          const clinicVal = String(clinic).toLowerCase() === 'nan' ? 'Consultório Dr. Agnaldo' : String(clinic);

          const appObs = cleanRow.observacoes_agenda || cleanRow.observacoes || cleanRow.observacao || cleanRow.motivo || '';
          const appObsVal = String(appObs).toLowerCase() === 'nan' ? '' : String(appObs);

          const appHashId = `${patientId}_${appDate}_${String(appTime).replace(':', '')}`;
          const existingAppIdx = crmData.appointments.findIndex((a:any) => a.id === appHashId);
          
          const appData = {
            id: appHashId,
            patientId,
            patientName: nome,
            date: appDate,
            time: String(appTime),
            dentist: dentistVal,
            specialty: specialtyVal,
            status,
            room: roomVal,
            clinic: clinicVal,
            observations: appObsVal,
            createdAt: new Date().toISOString()
          };
          if (existingAppIdx >= 0) crmData.appointments[existingAppIdx] = { ...crmData.appointments[existingAppIdx], ...appData };
          else crmData.appointments.push(appData);
          appsLinked++;
        }

        const procedureName = cleanRow.descricao_procedimento || cleanRow.procedimento || cleanRow.tratamento || cleanRow.servico || cleanRow.procedimento_realizado || '';
        let procVal = String(procedureName).trim();
        if (procVal.toLowerCase() === 'nan') procVal = '';

        const evolution = cleanRow.evolucao || cleanRow.evolucao_tratamento || cleanRow.diagnostico || cleanRow.nota_clinica || cleanRow.observacao || '';
        let evoVal = String(evolution).trim();
        if (evoVal.toLowerCase() === 'nan') evoVal = '';

        const returns = cleanRow.retorno || cleanRow.data_retorno || cleanRow.retornos || '';
        let retVal = String(returns).trim();
        if (retVal.toLowerCase() === 'nan') retVal = '';

        if (procVal || evoVal || retVal) {
          const clinDate = appDateRaw ? normalizeDate(appDateRaw) : new Date().toISOString().split('T')[0];
          const clinHashId = `clin_${patientId}_${clinDate}_${hashCode(procVal + evoVal)}`;
          
          const clinData = {
            id: clinHashId,
            patientId,
            date: clinDate,
            proceduresPerformed: procVal,
            treatmentEvolution: evoVal,
            recalls: retVal,
            value: valorRaw,
            observations: cleanRow.observacoes_clinicas || cleanRow.observacoes || cleanRow.observacao || '',
            createdAt: new Date().toISOString()
          };
          const existingClinIdx = crmData.clinical_history.findIndex((a:any) => a.id === clinHashId);
          if (existingClinIdx >= 0) crmData.clinical_history[existingClinIdx] = { ...crmData.clinical_history[existingClinIdx], ...clinData };
          else crmData.clinical_history.push(clinData);
          clinLinked++;
        }

        const isReminder = cleanRow.lembrete || cleanRow.mensagem || cleanRow.tipo_contato || '';
        const hasToken = cleanRow.token || cleanRow.token_confirmacao || cleanRow.chave_token || '';
        const contactsHist = cleanRow.historico_contatos || cleanRow.observacoes_contato || cleanRow.contatos || '';

        if (isReminder || hasToken || contactsHist) {
          const commDateRaw = cleanRow.data_envio || cleanRow.data || cleanRow.data_consulta || '';
          const commDate = commDateRaw ? normalizeDate(commDateRaw) : new Date().toISOString().split('T')[0];
          
          const commType = isReminder ? 'Lembrete' : 'Confirmação';
          const commStatus = cleanRow.status_contato || cleanRow.confirmou || cleanRow.resposta || 'Enviado';
          const commHashId = `comm_${patientId}_${commDate}_${hashCode(String(hasToken))}`;
          
          const commData = {
            id: commHashId,
            patientId,
            type: commType,
            date: commDate,
            message: cleanRow.mensagem_envio || cleanRow.texto || `Envio de ${commType} para consulta médica.`,
            token: String(hasToken),
            status: String(commStatus),
            contactsHistory: String(contactsHist),
            createdAt: new Date().toISOString()
          };
          const existingCommIdx = crmData.communications.findIndex((a:any) => a.id === commHashId);
          if (existingCommIdx >= 0) crmData.communications[existingCommIdx] = { ...crmData.communications[existingCommIdx], ...commData };
          else crmData.communications.push(commData);
          commsLinked++;
        }
      }
    }

    setImportProgress(60);
    console.log("Saving generated CRM Database to Drive...");

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
      clinicalsLinked: clinLinked,
      communicationsLinked: commsLinked,
      totalRows: total
    });
    setImportErrors(errors);

    setImporting(false);
    await loadPatientsFromFirestore();
  };

  // Helper date normalizer parsing Excel dates or general dd/mm/yyyy
  const normalizeDate = (val: any): string => {
    if (!val) return new Date().toISOString().split('T')[0];
    
    // Excel numerical serial representation check
    if (typeof val === 'number') {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const targetDate = new Date(excelEpoch.getTime() + val * 24 * 60 * 60 * 1000);
      return targetDate.toISOString().split('T')[0];
    }

    const str = String(val).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return `${year}-${month}-${day}`;
      }
    }
    
    // Return custom clean ISO split
    if (str.match(/^\d{4}-\d{2}-\d{2}/)) {
      return str.split('T')[0];
    }
    return str;
  };

  const mapAppointmentStatus = (val: any): 'Agendado' | 'Confirmado' | 'Atendido' | 'Faltou' | 'Cancelado' => {
    const s = String(val).trim().toLowerCase();
    if (s.includes('realizar')) return 'Agendado';
    if (s.includes('confirm') || s.includes('sim') || s.includes('ok')) return 'Confirmado';
    if (s.includes('atend') || s.includes('realiz') || s.includes('concl')) return 'Atendido';
    if (s.includes('falt') || s.includes('ausente') || s.includes('nao comparece')) return 'Faltou';
    if (s.includes('cancel') || s.includes('excl') || s.includes('desist')) return 'Cancelado';
    return 'Agendado';
  };

  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; 
    }
    return Math.abs(hash).toString(36);
  };

  const handleSaveDocNewPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientData.name) return;

    try {
      const crmData = await getGoogleDriveCRMDatabase();
      if (!crmData.patients) crmData.patients = [];
      
      const code = newPatientData.codigo_paciente || `COD-${Math.floor(1000 + Math.random() * 9000)}`;
      const pId = `pat_${Date.now()}`;
      const payload = {
        id: pId,
        name: newPatientData.name.trim().toUpperCase(),
        codigo_paciente: String(code),
        phone: newPatientData.phone || '',
        mobile: newPatientData.mobile || '',
        healthInsurance: newPatientData.healthInsurance?.toUpperCase() || 'PARTICULAR',
        medicalRecord: newPatientData.medicalRecord || '',
        observations: newPatientData.observations || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      crmData.patients.push(payload);
      await saveGoogleDriveCRMDatabase(crmData);
      
      setNewPatientData({
        name: '',
        codigo_paciente: '',
        phone: '',
        mobile: '',
        healthInsurance: 'PARTICULAR',
        medicalRecord: '',
        observations: ''
      });
      setIsAddingPatient(false);
      await loadPatientsFromFirestore();
    } catch (err: any) {
      alert('Erro ao criar paciente manualmente: ' + err.message);
    }
  };

  const handleDeletePatient = async (pId: string) => {
    if (!confirm("Aviso crítico: isto apagará o prontuário e histórico completo deste paciente permanentemente. Deseja continuar?")) {
      return;
    }

    try {
      const crmData = await getGoogleDriveCRMDatabase();
      crmData.patients = (crmData.patients || []).filter((p: any) => p.id !== pId);
      crmData.appointments = (crmData.appointments || []).filter((p: any) => p.patientId !== pId);
      crmData.clinical_history = (crmData.clinical_history || []).filter((p: any) => p.patientId !== pId);
      crmData.communications = (crmData.communications || []).filter((p: any) => p.patientId !== pId);
      await saveGoogleDriveCRMDatabase(crmData);

      setSelectedPatient(null);
      await loadPatientsFromFirestore();
    } catch (err: any) {
      alert("Erro ao deletar paciente: " + err.message);
    }
  };

  // Filter and search computation
  const filteredPatients = patients.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.codigo_paciente && p.codigo_paciente.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (p.mobile && p.mobile.includes(searchQuery)) ||
                          (p.phone && p.phone.includes(searchQuery));
    
    if (insuranceFilter === 'ALL') return matchesSearch;
    return matchesSearch && (p.healthInsurance || '').toUpperCase() === insuranceFilter.toUpperCase();
  });

  const getInsurancesList = () => {
    const list = new Set<string>();
    patients.forEach(p => {
      if (p.healthInsurance) list.add(p.healthInsurance.toUpperCase());
    });
    return Array.from(list);
  };

  return (
    <div className="space-y-6 animate-fade-in-up text-zinc-800">

      {/* ── CRM Header Bar ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-zinc-800 flex items-center gap-2" style={{ fontFamily: 'Playfair Display, serif' }}>
            <span className="w-8 h-8 rounded-lg bg-[#8B0000] flex items-center justify-center flex-shrink-0">
              <ClipboardList className="w-4.5 h-4.5 text-white" />
            </span>
            Gestão de Pacientes
          </h2>
          <p className="text-sm text-zinc-500 mt-1 ml-10">
            {patients.length} paciente{patients.length !== 1 ? 's' : ''} cadastrado{patients.length !== 1 ? 's' : ''} · Sincronizado com Google Drive
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setActiveSubTab(activeSubTab === 'import' ? 'crm' : 'import')}
            className={`flex items-center gap-2 px-4 py-2 text-[12px] font-semibold rounded-xl border transition-all ${
              activeSubTab === 'import'
                ? 'bg-[#8B0000] text-white border-[#8B0000] shadow-md'
                : 'bg-white text-zinc-600 border-zinc-200 hover:border-[#8B0000] hover:text-[#8B0000]'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            {activeSubTab === 'import' ? 'Ver CRM' : 'Importar Dados'}
          </button>
          <button
            onClick={() => setIsAddingPatient(true)}
            className="flex items-center gap-2 px-4 py-2 text-[12px] font-semibold rounded-xl bg-[#C09553] text-white border border-[#C09553] shadow-md hover:bg-[#A97E3B] transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Novo Paciente
          </button>
        </div>
      </div>

      {/* -------------------- TAB 1: IMPORT FILES ZONE -------------------- */}
      {activeSubTab === 'import' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left side column: Drag & Drop Import form */}
            <div className="lg:col-span-7 space-y-6">
              
              {importStatus === 'idle' && (
                <div className="bg-white border-2 border-dashed border-[#C09553]/40 rounded-2xl p-8 hover:border-[#8B0000]/60 transition-all bg-radial-gradient">
                  <div 
                    className={`flex flex-col items-center justify-center p-6 text-center select-none rounded-xl relative ${
                      dragActive ? 'bg-[#FAF8F5] scale-102 border-[#8B0000]' : ''
                    }`}
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileChange}
                      disabled={importing}
                    />

                    <div className="w-16 h-16 rounded-full bg-[#FAF8F5] border border-[#E6DEC9] flex items-center justify-center text-[#B48C4D] mb-4">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>

                    <h3 className="font-serif font-bold text-base text-[#8B0000]">Importar Novo Arquivo (Planilha de Pacientes)</h3>
                    <p className="text-xs text-zinc-400 max-w-sm mt-1 mx-auto leading-relaxed">
                      Arraste e solte seu arquivo <b>XLSX, XLS ou CSV</b> aqui, ou clique abaixo para procurar no computador.
                    </p>

                    <div className="flex gap-3 justify-center mt-6">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importing}
                        className="px-5 py-2.5 bg-[#8B0000] hover:bg-[#a32c3d] text-[#FAF8F5] text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm hover:-translate-y-0.5 disabled:opacity-50 flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Procurar Arquivo
                      </button>
                    </div>

                    <div className="mt-6 flex flex-wrap justify-center gap-4 text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                      <span>• Excel (XLSX, XLS)</span>
                      <span>• CSV</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Mapeamento de Colunas */}
              {importStatus === 'loaded' && (
                <div className="bg-white border border-[#E6DEC9] rounded-2xl p-6 shadow-sm space-y-6 animate-fade-in">
                  <div>
                    <h3 className="text-[#8B0000] font-serif font-bold text-lg mb-1">Mapeamento de Colunas</h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">Para salvar os dados perfeitamente no CRM, indique qual coluna da sua planilha corresponde a cada campo do sistema.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Campo Nome */}
                    <div>
                      <label className="block text-[#8B0000] text-sm font-bold mb-1.5">
                        1. Nome do Paciente <span className="text-red-500">*</span>
                      </label>
                      <select 
                        value={mappings.name} 
                        onChange={(e) => handleMappingChange('name', parseInt(e.target.value))}
                        className={`w-full border p-2.5 text-sm rounded-lg focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] outline-none transition-all ${mappings.name === -1 ? 'border-red-300 bg-red-50/10' : 'border-[#E6DEC9] bg-white'}`}
                      >
                        <option value={-1}>-- Selecionar Coluna --</option>
                        {sheetHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campo Código */}
                    <div>
                      <label className="block text-zinc-700 text-sm font-bold mb-1.5">2. Código / ID do Cliente</label>
                      <select 
                        value={mappings.code} 
                        onChange={(e) => handleMappingChange('code', parseInt(e.target.value))}
                        className="w-full border border-[#E6DEC9] bg-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] transition-all"
                      >
                        <option value={-1}>-- Ignorar / Gerar Automaticamente --</option>
                        {sheetHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campo Telefone */}
                    <div>
                      <label className="block text-zinc-700 text-sm font-bold mb-1.5">3. Celular / WhatsApp</label>
                      <select 
                        value={mappings.phone} 
                        onChange={(e) => handleMappingChange('phone', parseInt(e.target.value))}
                        className="w-full border border-[#E6DEC9] bg-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] transition-all"
                      >
                        <option value={-1}>-- Ignorar --</option>
                        {sheetHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campo Data */}
                    <div>
                      <label className="block text-zinc-700 text-sm font-bold mb-1.5">4. Data de Cadastro / Procedimento</label>
                      <select 
                        value={mappings.date} 
                        onChange={(e) => handleMappingChange('date', parseInt(e.target.value))}
                        className="w-full border border-[#E6DEC9] bg-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#C09553] transition-all"
                      >
                        <option value={-1}>-- Ignorar --</option>
                        {sheetHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campo Procedimento */}
                    <div>
                      <label className="block text-zinc-700 text-sm font-bold mb-1.5">5. Tratamento / Procedimento</label>
                      <select 
                        value={mappings.procedure} 
                        onChange={(e) => handleMappingChange('procedure', parseInt(e.target.value))}
                        className="w-full border border-[#E6DEC9] bg-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#C09553] transition-all"
                      >
                        <option value={-1}>-- Ignorar --</option>
                        {sheetHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campo Valor */}
                    <div>
                      <label className="block text-zinc-700 text-sm font-bold mb-1.5">6. Valor (R$)</label>
                      <select 
                        value={mappings.value} 
                        onChange={(e) => handleMappingChange('value', parseInt(e.target.value))}
                        className="w-full border border-[#E6DEC9] bg-white rounded-lg p-2.5 text-sm focus:outline-none focus:border-[#C09553] transition-all"
                      >
                        <option value={-1}>-- Ignorar --</option>
                        {sheetHeaders.map((h, i) => (
                          <option key={i} value={i}>{h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end gap-3 border-t border-zinc-100">
                    <button
                      onClick={() => setImportStatus('idle')}
                      className="px-4 py-2 border border-zinc-300 text-zinc-600 font-bold text-sm rounded-lg hover:bg-zinc-50"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleExecuteMappedImport}
                      className="px-5 py-2 bg-[#C09553] hover:bg-[#B48C4D] text-white text-sm font-bold rounded-lg transition-all shadow-sm flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Salvar Cadastro e Históricos no CRM
                    </button>
                  </div>
                </div>
              )}

              {/* Progress and indicators */}
              {importing && (
                <div className="bg-white border border-[#E6DEC9] p-5 rounded-xl shadow-xs space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-[#8B0000] flex items-center gap-1.5 uppercase tracking-wide">
                      <Loader2 className="w-4 h-4 text-[#C09553] animate-spin" />
                      Processando e Consolidando Arquivo...
                    </span>
                    <span className="text-xs font-mono font-bold text-[#C09553]">{importProgress}%</span>
                  </div>
                  <div className="w-full bg-zinc-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-gradient-to-r from-[#8B0000] to-[#C09553] h-full transition-all duration-300" 
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-normal">
                    O robô do CRM está analisando cada linha, reconhecendo colunas (nome, código, convênio, telefones, prontuário), agrupando por paciente para evitar duplicidade, e conectando históricos de consultas, evolução e comunicações na nuvem.
                  </p>
                </div>
              )}

              {/* Import Results Summary Panel */}
              {importSummary && (
                <div className="bg-white border-2 border-emerald-500/20 bg-emerald-50/20 p-6 rounded-2xl shadow-sm space-y-4 animate-fadeIn">
                  <div className="flex items-center gap-2 pb-3 border-b border-emerald-500/10">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    <div>
                      <h4 className="font-serif font-bold text-sm text-[#8B0000]">Importação Concluída com Sucesso!</h4>
                      <p className="text-[10px] text-zinc-400 uppercase font-semibold">Os dados já foram salvos estruturadamente</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div className="bg-white border border-[#E6DEC9] p-3 rounded-xl shadow-2xs">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Linhas Lidas</span>
                      <span className="text-base font-serif font-bold text-zinc-800">{importSummary.totalRows}</span>
                    </div>
                    <div className="bg-white border border-emerald-200 p-3 rounded-xl shadow-2xs">
                      <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest block">Novos Pacientes</span>
                      <span className="text-base font-serif font-bold text-emerald-700">+{importSummary.patientsCreated}</span>
                    </div>
                    <div className="bg-white border border-[#E6DEC9] p-3 rounded-xl shadow-2xs">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Registros Atualizados</span>
                      <span className="text-base font-serif font-bold text-zinc-800">{importSummary.patientsUpdated}</span>
                    </div>
                    <div className="bg-white border border-[#E6DEC9] p-3 rounded-xl shadow-2xs">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Consultas Vinculadas</span>
                      <span className="text-base font-serif font-bold text-[#8B0000]">{importSummary.appointmentsLinked}</span>
                    </div>
                    <div className="bg-white border border-[#E6DEC9] p-3 rounded-xl shadow-2xs">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Históricos Clínicos</span>
                      <span className="text-base font-serif font-bold text-[#8B0000]">{importSummary.clinicalsLinked}</span>
                    </div>
                    <div className="bg-white border border-[#E6DEC9] p-3 rounded-xl shadow-2xs">
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Comunicações</span>
                      <span className="text-base font-serif font-bold text-[#8B0000]">{importSummary.communicationsLinked}</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('crm')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      Ver no CRM
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Interactive Log Console & Import Audit Viewer */}
              {importErrors.length > 0 && (() => {
                const filteredLogs = importErrors.filter(err => {
                  const queryMatches = logSearch ? err.toLowerCase().includes(logSearch.toLowerCase()) : true;
                  if (!queryMatches) return false;

                  if (logFilter === 'CRITICAL') return err.includes('Falha Crítica');
                  if (logFilter === 'WARNING') return err.includes('Aviso') || err.includes('Erro:');
                  if (logFilter === 'FORMAT') return err.includes('Formato Inválido');
                  return true;
                });

                return (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden mt-6 animate-fadeIn">
                    
                    {/* Console Header Bar */}
                    <div className="bg-zinc-950 p-4 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {/* Terminal Dots */}
                        <div className="flex gap-1.5 shrink-0">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block" />
                        </div>
                        <div className="ml-2">
                          <h4 className="font-mono text-[11px] font-bold text-zinc-200 flex items-center gap-1.5 uppercase tracking-wider">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 animate-pulse" />
                            Console de Auditoria de Importação
                          </h4>
                          <p className="text-[9px] font-mono text-zinc-400 uppercase">
                            Registrados {importErrors.length} avisos ou incidentes no arquivo
                          </p>
                        </div>
                      </div>

                      {/* Log Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Filtro (ex: Linha, Campo)..."
                          value={logSearch}
                          onChange={(e) => setLogSearch(e.target.value)}
                          className="w-full text-zinc-150 pl-3 pr-3 py-1 bg-zinc-900 text-[10px] border border-zinc-700 rounded focus:outline-hidden focus:border-[#C09553] font-mono text-zinc-300"
                        />
                      </div>
                    </div>

                    {/* Filter Tabs */}
                    <div className="bg-zinc-900/60 p-2 border-b border-zinc-800 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => setLogFilter('ALL')}
                        className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-xs transition-all cursor-pointer ${
                          logFilter === 'ALL'
                            ? 'bg-[#C09553] text-[#8B0000] shadow-inner'
                            : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Todos ({importErrors.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogFilter('CRITICAL')}
                        className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-xs transition-all cursor-pointer ${
                          logFilter === 'CRITICAL'
                            ? 'bg-rose-600 text-white shadow-inner'
                            : 'bg-zinc-800 text-rose-450 hover:text-rose-350'
                        }`}
                      >
                        Falhas Críticas ❌ ({importErrors.filter(e => e.includes('Falha Crítica')).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogFilter('WARNING')}
                        className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-xs transition-all cursor-pointer ${
                          logFilter === 'WARNING'
                            ? 'bg-amber-500 text-zinc-950 shadow-inner'
                            : 'bg-zinc-800 text-amber-450 hover:text-amber-350'
                        }`}
                      >
                        Avisos/Ajustes ⚠️ ({importErrors.filter(e => e.includes('Aviso') || e.includes('Erro:')).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogFilter('FORMAT')}
                        className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-xs transition-all cursor-pointer ${
                          logFilter === 'FORMAT'
                            ? 'bg-sky-500 text-zinc-950 shadow-inner'
                            : 'bg-zinc-800 text-sky-400 hover:text-sky-350'
                        }`}
                      >
                        Formatos Rejeitados 📋 ({importErrors.filter(e => e.includes('Formato Inválido')).length})
                      </button>
                    </div>

                    {/* Console Logs Panel */}
                    <div className="bg-zinc-950 p-4 font-mono text-[11px] overflow-y-auto max-h-60 border border-zinc-900 rounded-b-2xl space-y-1 text-left">
                      {filteredLogs.length === 0 ? (
                        <div className="text-zinc-500 text-center py-6">
                          Nenhum evento localizado com os filtros ativos.
                        </div>
                      ) : (
                        filteredLogs.map((err, idx) => {
                          const isCritical = err.includes('Falha Crítica');
                          const isFormat = err.includes('Formato Inválido');

                          // Extract file layout label: "[Markdown Linha XX]" etc
                          const labelMatch = err.match(/^\[(.*?)\]/);
                          const label = labelMatch ? labelMatch[1] : '';
                          const restMessage = labelMatch ? err.substring(labelMatch[0].length).trim() : err;

                          return (
                            <div key={idx} className="flex flex-col sm:flex-row sm:items-start gap-1 pb-1 border-b border-zinc-900/30">
                              
                              {/* Source/Line Flag */}
                              {label && (
                                <span className={`shrink-0 px-1 py-0.2 rounded text-[9px] font-bold ${
                                  isCritical 
                                    ? 'bg-rose-500/10 text-rose-450 border border-rose-500/25' 
                                    : isFormat
                                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/25'
                                    : 'bg-amber-500/10 text-amber-450 border border-amber-550/25'
                                }`}>
                                  {label}
                                </span>
                              )}

                              {/* Error Message with specific color tags */}
                              <div className="flex-1">
                                <span className={
                                  isCritical 
                                    ? 'text-rose-400 font-semibold' 
                                    : isFormat
                                    ? 'text-sky-300'
                                    : 'text-zinc-300'
                                }>
                                  {restMessage}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Right side column: Guidance explaining automatic data mappings */}
            <div className="lg:col-span-5 bg-white border border-[#E6DEC9] p-6 rounded-2xl shadow-sm space-y-5">
              <h4 className="font-serif font-bold text-sm text-[#8B0000] uppercase tracking-wide flex items-center gap-2 border-b border-[#FAF8F5] pb-2">
                <Sparkles className="w-4 h-4 text-[#B48C4D]" />
                Guia de Mapeamento de Colunas
              </h4>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Nosso algoritmo inteligente mapeia automaticamente as colunas da sua planilha, mesmo com nomes de cabeçalhos variados. Veja como as informações são separadas no prontuário do paciente:
              </p>

              <div className="space-y-4 text-xs">
                
                {/* Modulo Paciente */}
                <div className="space-y-1">
                  <span className="font-bold text-[#8B0000] flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-[#C09553]" />
                    Módulo Paciente (Ficha Cadastral)
                  </span>
                  <p className="text-[10px] text-zinc-400">
                    Mapeia o Código do Paciente (<code>codigo_cliente</code>, <code>codigo</code>), Nome, Telefones (<code>celular</code>, <code>telefone</code>), Convênios (<code>convenio</code>, <code>plano</code>) e Observações gerais.
                  </p>
                </div>

                {/* Modulo Agenda */}
                <div className="space-y-1">
                  <span className="font-bold text-[#8B0000] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[#C09553]" />
                    Histórico de Agendamento
                  </span>
                  <p className="text-[10px] text-zinc-400">
                    Organiza as datas de consultas, horas, dentista (<code>dentista</code> ou <code>profissional</code>), especialidade, sala de atendimento, filial da clínica e estados da agenda.
                  </p>
                </div>

                {/* Modulo Clinico */}
                <div className="space-y-1">
                  <span className="font-bold text-[#8B0000] flex items-center gap-1">
                    <ClipboardList className="w-3.5 h-3.5 text-[#C09553]" />
                    Histórico Clínico & Evolução
                  </span>
                  <p className="text-[10px] text-zinc-400">
                    Armazena o registro de procedimentos já realizados no dente, notas de evolução do tratamento, histórico de retornos (<code>retorno</code>) e dados de diagnóstico.
                  </p>
                </div>

                {/* Modulo Comunicacao */}
                <div className="space-y-1">
                  <span className="font-bold text-[#8B0000] flex items-center gap-1">
                    <MessageSquare className="w-3.5 h-3.5 text-[#C09553]" />
                    Comunicação & Mensagens
                  </span>
                  <p className="text-[10px] text-zinc-400">
                    Acompanha as confirmações de consulta automáticas por SMS/WhatsApp, lembretes de exames, tokens de confirmação de segurança e logs de contato anteriores.
                  </p>
                </div>

              </div>

              {/* Sample Download Tool */}
              <div className="bg-[#FAF8F5] border border-[#E6DEC9] p-4 rounded-xl space-y-3 text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider block">Precisa de um modelo estruturado?</span>
                <p className="text-[11px] text-zinc-550 leading-relaxed">Você pode importar arquivos gerados pelo seu sistema ou com a formatação abaixo:</p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const ws = XLSX.utils.json_to_sheet([
                        {
                          codigo_cliente: "1025",
                          paciente: "VALDERMON DA SILVA LOPES",
                          tel_celular: "79999887766",
                          convenio_paciente: "Amil Dental",
                          data_consulta: "2026-06-18",
                          hora: "14:30",
                          profissional: "Dr. Agnaldo Ferreira",
                          status: "Confirmado",
                          procedimento: "Pino + Coroa Reforçada",
                          evolucao_tratamento: "Instalação de pino de fibra de vidro concluída com sucesso.",
                          token_confirmacao: "token_abc_123"
                        },
                        {
                          codigo_cliente: "1025",
                          paciente: "VALDERMON DA SILVA LOPES",
                          tel_celular: "79999887766",
                          convenio_paciente: "Amil Dental",
                          data_consulta: "2026-05-10",
                          hora: "09:00",
                          profissional: "Dra. Ana",
                          status: "Atendido",
                          procedimento: "Limpeza Profilaxia",
                          evolucao_tratamento: "Remoção de tártaro nos quadrantes inferiores.",
                          token_confirmacao: "token_xyz"
                        }
                      ]);
                      const wb = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(wb, ws, "CRM_Dentista_Modelo");
                      XLSX.writeFile(wb, "CRM_Dentista_Modelo.xlsx");
                    }}
                    className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#8B0000] hover:text-[#a32c3d] cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Modelo Planilha (XLSX)</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* -------------------- TAB 2: GENERAL DENTAL CRM VIEW -------------------- */}
      {activeSubTab === 'crm' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Patients Listing column (LHS) */}
          <div className="lg:col-span-4 space-y-4">
            
            <div className="bg-white border border-[#E6DEC9] p-4 rounded-xl shadow-xs space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Pesquisar paciente por nome, celular..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#FAF8F5] border border-zinc-200 focus:border-[#8B0000] rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none transition-all"
                  />
                </div>
                
                {/* Advanced filter select */}
                <select
                  value={insuranceFilter}
                  onChange={(e) => setInsuranceFilter(e.target.value)}
                  className="bg-[#FAF8F5] border border-zinc-200 rounded-lg text-xs px-2 focus:outline-none"
                >
                  <option value="ALL">Convênios</option>
                  <option value="PARTICULAR">Particular</option>
                  {getInsurancesList().map(ins => (
                    ins !== 'PARTICULAR' && <option key={ins} value={ins}>{ins}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-zinc-100">
                <span className="text-[10px] text-zinc-400 font-bold uppercase">Encontrados: {filteredPatients.length} pacientes</span>
                <button
                  type="button"
                  onClick={() => setIsAddingPatient(true)}
                  className="text-[10px] font-bold text-[#8B0000] hover:text-[#a32c3d] flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Novo Cadastro</span>
                </button>
              </div>
            </div>

            {/* Patients dynamic scroll list */}
            <div className="bg-white border border-[#E6DEC9] rounded-xl overflow-hidden max-h-[60vh] overflow-y-auto divide-y divide-zinc-100">
              {isLoadingCRM ? (
                <div className="p-8 text-center space-y-2">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-[#C09553]" />
                  <p className="text-xs text-zinc-400">Carregando CRM...</p>
                </div>
              ) : filteredPatients.length === 0 ? (
                <div className="p-8 text-center text-zinc-450 text-xs">
                  Nenhum paciente cadastrado com os critérios informados. Importe uma planilha ou cadastre acima!
                </div>
              ) : (
                filteredPatients.map((p) => {
                  const isSelected = selectedPatient?.id === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => setSelectedPatient(p)}
                      className={`p-3.5 text-left cursor-pointer transition-colors ${
                        isSelected ? 'bg-[#8B0000]/5 border-l-4 border-l-[#8B0000]' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-serif font-bold text-xs text-zinc-900 line-clamp-1">{p.name}</h4>
                          <span className="text-[9px] font-mono text-zinc-400">Código: {p.codigo_paciente || 'N/D'}</span>
                        </div>
                        <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full ${
                          (p.healthInsurance || '').toUpperCase() === 'PARTICULAR' 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-indigo-100 text-[#4285F4]'
                        }`}>
                          {p.healthInsurance || 'PARTICULAR'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-1 mt-2 text-[10px] text-zinc-500">
                        {p.mobile && <span className="truncate">📱 {p.mobile}</span>}
                        {p.phone && <span className="truncate">📞 {p.phone}</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Quick manual modal overlay */}
            {isAddingPatient && (
              <div className="fixed inset-0 z-[130] bg-black/50 flex items-center justify-center p-4">
                <form onSubmit={handleSaveDocNewPatient} className="bg-white rounded-2xl w-full max-w-md overflow-hidden text-left shadow-xl border border-zinc-200">
                  <div className="bg-[#8B0000] text-white p-4 font-serif font-bold text-sm">
                    Novo Cadastro de Paciente
                  </div>
                  <div className="p-5 space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-500 uppercase tracking-widest text-[9px]">Nome Completo</label>
                      <input
                        type="text"
                        required
                        value={newPatientData.name}
                        onChange={(e) => setNewPatientData({ ...newPatientData, name: e.target.value.toUpperCase() })}
                        className="w-full bg-[#FAF8F5] border border-zinc-200 rounded-lg px-3 py-2 outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-zinc-500 uppercase tracking-widest text-[9px]">Código do Paciente</label>
                        <input
                          type="text"
                          placeholder="Gerado automático se vazio"
                          value={newPatientData.codigo_paciente}
                          onChange={(e) => setNewPatientData({ ...newPatientData, codigo_paciente: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-zinc-200 rounded-lg px-3 py-2 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-zinc-500 uppercase tracking-widest text-[9px]">Convênio</label>
                        <input
                          type="text"
                          value={newPatientData.healthInsurance}
                          onChange={(e) => setNewPatientData({ ...newPatientData, healthInsurance: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-zinc-200 rounded-lg px-3 py-2 outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-bold text-zinc-500 uppercase tracking-widest text-[9px]">WhatsApp</label>
                        <input
                          type="text"
                          value={newPatientData.mobile}
                          onChange={(e) => setNewPatientData({ ...newPatientData, mobile: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-zinc-200 rounded-lg px-3 py-2 outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-bold text-zinc-500 uppercase tracking-widest text-[9px]">Fixo</label>
                        <input
                          type="text"
                          value={newPatientData.phone}
                          onChange={(e) => setNewPatientData({ ...newPatientData, phone: e.target.value })}
                          className="w-full bg-[#FAF8F5] border border-zinc-200 rounded-lg px-3 py-2 outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-zinc-500 uppercase tracking-widest text-[9px]">Histórico Médico / Observações</label>
                      <textarea
                        rows={2}
                        value={newPatientData.observations}
                        onChange={(e) => setNewPatientData({ ...newPatientData, observations: e.target.value })}
                        className="w-full bg-[#FAF8F5] border border-zinc-200 rounded-lg px-3 py-2 outline-none resize-none"
                      />
                    </div>
                  </div>
                  <div className="bg-zinc-50 p-4 border-t border-zinc-100 flex justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsAddingPatient(false)}
                      className="px-3 py-1.5 border border-zinc-250 text-zinc-500 text-xs rounded-lg uppercase font-bold"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded-lg uppercase font-bold"
                    >
                      Cadastrar Paciente
                    </button>
                  </div>
                </form>
              </div>
            )}

          </div>

          {/* Consolidated Patient File Panels (RHS Column) */}
          <div className="lg:col-span-8">
            {selectedPatient ? (
              <div className="bg-white border border-[#E6DEC9] rounded-2xl shadow-sm overflow-hidden text-left flex flex-col min-h-[50vh]">
                
                {/* File Header */}
                <div className="bg-[#8B0000] text-[#FAF8F5] p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-[#FAF8F5]/10 border border-[#FAF8F5]/20 flex items-center justify-center text-[#B48C4D]">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base uppercase leading-tight">{selectedPatient.name}</h3>
                      <p className="text-[10px] text-[#E1CDAC] uppercase tracking-widest font-semibold flex items-center gap-2 mt-0.5">
                        <span>Código: {selectedPatient.codigo_paciente || 'N/D'}</span>
                        <span>•</span>
                        <span>Convênio: {selectedPatient.healthInsurance || 'PARTICULAR'}</span>
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeletePatient(selectedPatient.id)}
                    className="p-2 hover:bg-rose-900 border border-transparent hover:border-rose-700 rounded-lg text-rose-300 transition-colors cursor-pointer self-end sm:self-auto"
                    title="Remover Prontuário"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Sub-Tabs Grid Layout */}
                <div className="border-b border-zinc-200 bg-[#FAF8F5] flex overflow-x-auto divide-x divide-zinc-200 no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('info')}
                    className={`px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus:outline-none cursor-pointer transition-all ${
                      activeDetailTab === 'info'
                        ? 'bg-[#8B0000] text-[#FAF8F5]'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    📇 Cadastro Completo
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('appointments')}
                    className={`px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus:outline-none cursor-pointer transition-all ${
                      activeDetailTab === 'appointments'
                        ? 'bg-[#8B0000] text-[#FAF8F5]'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    📅 Agenda ({appointments.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('anamnesis')}
                    className={`px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus:outline-none cursor-pointer transition-all ${
                      activeDetailTab === 'anamnesis'
                        ? 'bg-[#8B0000] text-[#FAF8F5]'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    📋 Anamnese ({anamneseList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('clinical')}
                    className={`px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus:outline-none cursor-pointer transition-all ${
                      activeDetailTab === 'clinical'
                        ? 'bg-[#8B0000] text-[#FAF8F5]'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    🦷 Evolução & Odontograma ({clinicalHistory.length + odontogramaList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('communication')}
                    className={`px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus:outline-none cursor-pointer transition-all ${
                      activeDetailTab === 'communication'
                        ? 'bg-[#8B0000] text-[#FAF8F5]'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    💬 Comunicações ({communications.length + avisosList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('financial')}
                    className={`px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus:outline-none cursor-pointer transition-all ${
                      activeDetailTab === 'financial'
                        ? 'bg-[#8B0000] text-[#FAF8F5]'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    💰 Financeiro ({pagamentosList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('docs_gallery')}
                    className={`px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus:outline-none cursor-pointer transition-all ${
                      activeDetailTab === 'docs_gallery'
                        ? 'bg-[#8B0000] text-[#FAF8F5]'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                    }`}
                  >
                    📂 Arquivos FIRESTORE ({documentosList.length + galeriaList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTab('drive_records')}
                    className={`px-4 py-3 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider whitespace-nowrap focus:outline-none cursor-pointer transition-all ${
                      activeDetailTab === 'drive_records'
                        ? 'bg-[#8B0000] text-[#FAF8F5]'
                        : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 bg-amber-500/5 text-amber-900 font-semibold border-l'
                    }`}
                  >
                    ☁️ Biblioteca & Orçamentos (DRIVE) ({isLoadingDriveProposals || isLoadingDriveImages ? '...' : driveProposals.length + driveImages.length})
                  </button>
                </div>

                {/* Sub Tab View Panels */}
                <div className="p-6 space-y-6 flex-1 bg-white">

                  {/* Panel A: Demographics and Core Patient Data */}
                  {activeDetailTab === 'info' && (
                    <div className="space-y-6">
                      <div className="border-b border-zinc-100 pb-3">
                        <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">DADOS DO PACIENTE</span>
                        <h4 className="font-serif font-bold text-lg text-[#8B0000] mt-0.5">Ficha Cadastral Geral consolidada</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-zinc-600">
                        <div className="space-y-3 bg-[#FAF8F5] p-4 rounded-xl border border-[#E6DEC9]/45">
                          <h5 className="font-bold text-zinc-800 uppercase tracking-wide text-[9px] border-b pb-1">Identificação Pessoal</h5>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-zinc-400">CPF:</span>
                            <span className="font-mono text-zinc-800 font-semibold">{selectedPatient.cpf || 'Não registrado'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-zinc-400">Data de Nascimento:</span>
                            <span className="font-mono text-zinc-850 font-semibold">{normalizeDateDisplay(selectedPatient.birthDate || '') || 'Não informada'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-zinc-400">Sexo:</span>
                            <span className="font-semibold text-zinc-800">{selectedPatient.gender || 'Não informado'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-zinc-400">Estado Civil:</span>
                            <span className="font-semibold text-zinc-800">{selectedPatient.maritalStatus || 'Não informado'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-zinc-400">Prontuário Médico Nº:</span>
                            <span className="font-mono bg-[#8B0000]/5 px-2 py-0.5 rounded text-[#8B0000] font-bold">{selectedPatient.medicalRecord || 'Gerado Manual'}</span>
                          </div>
                        </div>

                        <div className="space-y-3 bg-[#FAF8F5] p-4 rounded-xl border border-[#E6DEC9]/45">
                          <h5 className="font-bold text-zinc-800 uppercase tracking-wide text-[9px] border-b pb-1">Canais de Contato</h5>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-zinc-400">WhatsApp / Celular:</span>
                            <span className="text-emerald-700 font-bold">{selectedPatient.mobile || 'Não informado'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-zinc-400">Telefone Fixo:</span>
                            <span className="font-semibold text-zinc-800">{selectedPatient.phone || 'Não informado'}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="font-semibold text-zinc-400">E-mail pessoal:</span>
                            <span className="font-semibold text-zinc-800 truncate max-w-[150px]">{selectedPatient.email || 'Não informado'}</span>
                          </div>
                          <div className="flex justify-between items-start">
                            <span className="font-semibold text-zinc-400 shrink-0">Localidade:</span>
                            <span className="font-semibold text-zinc-850 text-right ml-4">
                              {selectedPatient.street
                                ? `${selectedPatient.street}, Nº ${selectedPatient.number || 'S/N'}${selectedPatient.neighborhood ? ` - Bairro ${selectedPatient.neighborhood}` : ''}, ${selectedPatient.city || 'Salgado'}/${selectedPatient.state || 'SE'}`
                                : 'Sem endereço registrado'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Observations Alert */}
                      <div className="bg-[#FAF8F5]/80 border-2 border-dashed border-[#C09553]/35 p-5 rounded-xl space-y-2">
                        <span className="text-[10px] font-bold text-[#8B0000] uppercase tracking-widest flex items-center gap-1.5">
                          <FileText className="w-4 h-4 text-[#C09553]" />
                          Observações Diagnósticas e Recomendação Geral
                        </span>
                        <p className="text-xs text-zinc-600 leading-relaxed italic font-medium">
                          {selectedPatient.observations ? `"${selectedPatient.observations}"` : 'Tudo limpo no cadastro. Nenhuma recomendação médica de alergia ou restrição cardíaca anexada ao paciente.'}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Panel B: Appointments list */}
                  {activeDetailTab === 'appointments' && (
                    <div className="space-y-4">
                      <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">DURANTE TODA A HISTÓRIA</span>
                          <h4 className="font-serif font-bold text-lg text-[#8B0000]">Histórico de Consultas e Agendamentos</h4>
                        </div>
                        <span className="bg-[#8B0000] text-[#FAF8F5] px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase">{appointments.length} Sessões</span>
                      </div>

                      {appointments.length === 0 ? (
                        <div className="p-10 text-center border-2 border-dashed border-zinc-200 rounded-xl">
                          <p className="text-xs text-zinc-400 italic">Nenhum evento registrado no histórico da agenda deste paciente.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-zinc-150 rounded-xl">
                          <table className="w-full text-left text-[11px] font-sans">
                            <thead className="bg-[#FAF8F5] text-zinc-500 font-bold uppercase text-[9px] tracking-wider border-b border-zinc-200">
                              <tr>
                                <th className="p-2.5">Data/Horário</th>
                                <th className="p-2.5">Dentista / Especialidade</th>
                                <th className="p-2.5">Sala/Clinica</th>
                                <th className="p-2.5">Situação</th>
                                <th className="p-2.5">Notas do dia</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-zinc-700">
                              {appointments.map((a) => (
                                <tr key={a.id} className="hover:bg-zinc-50/50">
                                  <td className="p-2.5 whitespace-nowrap">
                                    <div className="font-semibold font-mono text-zinc-900">{normalizeDateDisplay(a.date)}</div>
                                    <div className="text-[9px] text-zinc-400 font-semibold flex items-center gap-0.5"><Clock className="w-3 h-3" /> {a.time}</div>
                                  </td>
                                  <td className="p-2.5 md:max-w-[150px] truncate">
                                    <div className="font-bold text-zinc-800">{a.dentist}</div>
                                    <div className="text-[9px] text-amber-700 font-medium">{a.specialty}</div>
                                  </td>
                                  <td className="p-2.5">
                                    <div>{a.clinic || 'Clínica Principal'}</div>
                                    {a.room && <div className="text-[9px] text-zinc-400">Consultório {a.room}</div>}
                                  </td>
                                  <td className="p-2.5">
                                    <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full uppercase ${
                                      a.status === 'Confirmado' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                      a.status === 'Atendido' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                      a.status === 'Faltou' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                      a.status === 'Cancelado' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                                      'bg-zinc-100 text-zinc-600'
                                    }`}>
                                      {a.status}
                                    </span>
                                  </td>
                                  <td className="p-2.5 max-w-[180px] break-words whitespace-normal text-zinc-500" title={a.observations}>
                                    {a.observations || <span className="text-zinc-300">-</span>}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Panel C: Anamnesis details */}
                  {activeDetailTab === 'anamnesis' && (
                    <div className="space-y-4">
                      <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">AVALIAÇÃO DE RISCO MÉDICO</span>
                          <h4 className="font-serif font-bold text-lg text-[#8B0000]">Questionário Médico de Anamnese</h4>
                        </div>
                        <span className="bg-[#8B0000] text-[#FAF8F5] px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase">{anamneseList.length} Perguntas</span>
                      </div>

                      {anamneseList.length === 0 ? (
                        <div className="p-10 text-center border-2 border-dashed border-zinc-200 rounded-xl bg-[#FAF8F5]">
                          <p className="text-xs text-zinc-400 italic">Nenhum check clínico de anamnese registrado. Envie arquivos ou preencha a ficha do paciente para popular.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {anamneseList.map((a) => (
                            <div key={a.id} className="bg-[#FAF8F5] border border-[#E6DEC9]/65 p-4 rounded-xl space-y-2 relative overflow-hidden">
                              <div className="absolute right-2 top-2 bg-amber-50 rounded text-[8px] font-mono p-1 text-amber-800 font-bold">Q&A Check</div>
                              <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Pergunta Clínica:</span>
                              <p className="font-serif font-bold text-xs text-zinc-900 leading-snug">{a.question}</p>
                              <div className="bg-white border text-xs text-zinc-700 p-2.5 rounded-md font-semibold font-mono flex items-start gap-1">
                                <span className="text-emerald-700">➜ Resposta:</span>
                                <span>{a.answer || 'Não informada'}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Panel D: Clinical and Odontograma */}
                  {activeDetailTab === 'clinical' && (
                    <div className="space-y-6">
                      
                      {/* Clinical Evolutions (Evolução Tratamento) */}
                      <div className="space-y-4">
                        <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">DIÁRIO MÉDICO</span>
                            <h4 className="font-serif font-bold text-md text-[#8B0000] uppercase">Histórico e Evoluções Clínicas</h4>
                          </div>
                          <span className="bg-[#C09553]/20 text-zinc-800 px-2.5 py-0.5 rounded-full text-[10px] font-semibold">{clinicalHistory.length} registros</span>
                        </div>

                        {clinicalHistory.length === 0 ? (
                          <p className="text-[11px] text-zinc-400 italic">Nenhum evento de evolução médica associado.</p>
                        ) : (
                          <div className="space-y-3">
                            {clinicalHistory.map((ch) => (
                              <div key={ch.id} className="bg-[#FAF8F5]/50 border border-[#E6DEC9]/60 p-4 rounded-xl text-xs space-y-2">
                                <div className="flex justify-between items-center bg-white border border-[#E6DEC9]/30 px-2 py-1 rounded-md text-[10px] font-bold font-mono">
                                  <span className="text-[#8B0000]">📅 {normalizeDateDisplay(ch.date)}</span>
                                  {ch.recalls && <span className="text-amber-805 uppercase tracking-wide">🔁 Retorno em: {ch.recalls}</span>}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-1">
                                  {ch.proceduresPerformed && (
                                    <div className="md:col-span-5">
                                      <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Procedimento Realizado</span>
                                      <span className="font-semibold text-zinc-900 text-xs">{ch.proceduresPerformed}</span>
                                    </div>
                                  )}
                                  <div className="md:col-span-7">
                                    <span className="text-[9px] uppercase font-bold text-zinc-400 tracking-wider block">Evolução do Caso / Observações</span>
                                    <p className="text-zinc-600 leading-relaxed font-sans italic text-xs">
                                      {ch.treatmentEvolution || "Não informado"}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Odontograma Diagnóstico */}
                      <div className="space-y-4 pt-4 border-t border-zinc-100">
                        <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">ODONTOGRAMA COMPLETO</span>
                            <h4 className="font-serif font-bold text-md text-[#8B0000] uppercase">Mapeamento Clínico por Elemento Dentário</h4>
                          </div>
                          <span className="bg-[#8B0000]/80 text-[#FAF8F5] px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold">{odontogramaList.length} Dentes Mapeados</span>
                        </div>

                        {odontogramaList.length === 0 ? (
                          <div className="p-8 text-center bg-[#FAF8F5] rounded-xl border border-dashed border-zinc-200">
                            <p className="text-xs text-zinc-400 italic">Nenhum mapeamento de odontograma associado no histórico importado.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {odontogramaList.map((od) => (
                              <div key={od.id} className="bg-white border rounded-xl p-3 flex justify-between items-center gap-2 border-[#E6DEC9]">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-[#8B0000] text-[#FAF8F5] flex items-center justify-center font-mono font-bold text-xs shrink-0 select-all" title="Dente número">
                                    🦷 {od.tooth || 'E'}
                                  </div>
                                  <div>
                                    <h5 className="font-bold text-xs text-zinc-850 truncate max-w-[160px]">{od.procedure}</h5>
                                    <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-400">{od.situation || 'Diagnóstico'}</span>
                                  </div>
                                </div>
                                {od.value && (
                                  <div className="text-right shrink-0">
                                    <span className="text-[9px] uppercase text-zinc-400 font-bold block">Investimento</span>
                                    <span className="font-mono text-xs font-bold text-[#8B0000]">{String(od.value).startsWith('R$') ? od.value : `R$ ${od.value}`}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Tratamentos e Fases Ativas */}
                      <div className="space-y-4 pt-4 border-t border-zinc-100">
                        <div className="border-b border-zinc-100 pb-3">
                          <h4 className="font-serif font-bold text-md text-[#8B0000] uppercase">Planejamento e Fases de Tratamentos Orçados</h4>
                        </div>
                        {tratamentosList.length === 0 ? (
                          <p className="text-[11px] text-zinc-400 italic">Nenhum plano de etapas estruturadas foi informado ou orçado.</p>
                        ) : (
                          <div className="overflow-x-auto border rounded-xl">
                            <table className="w-full text-left text-[11px] font-sans">
                              <thead className="bg-[#FAF8F5] text-zinc-500 font-bold uppercase text-[9px] border-b">
                                <tr>
                                  <th className="p-2.5">Tratamento</th>
                                  <th className="p-2.5">Início do plano</th>
                                  <th className="p-2.5">Status</th>
                                  <th className="p-2.5">Observações da Fase</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 text-zinc-700">
                                {tratamentosList.map((tr) => (
                                  <tr key={tr.id}>
                                    <td className="p-2.5 font-bold text-zinc-800">{tr.name}</td>
                                    <td className="p-2.5 font-mono">{normalizeDateDisplay(tr.date)}</td>
                                    <td className="p-2.5">
                                      <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full uppercase ${
                                        (tr.status || '').toLowerCase().includes('concl') ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' : 'bg-blue-50 text-blue-700'
                                      }`}>
                                        {tr.status}
                                      </span>
                                    </td>
                                    <td className="p-2.5 text-zinc-550 break-words whitespace-normal font-sans text-xs italic">{tr.observations || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* Panel E: Communications and warning logs */}
                  {activeDetailTab === 'communication' && (
                    <div className="space-y-6">
                      
                      {/* Envio de WhatsApp e Confirmador */}
                      <div className="space-y-4">
                        <div className="border-b border-zinc-100 pb-3">
                          <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">REGISTROS DE CONTATOS</span>
                          <h4 className="font-serif font-bold text-lg text-[#8B0000]">Confirmações e Lembretes Enviados</h4>
                        </div>
                        {communications.length === 0 ? (
                          <p className="text-[11px] text-zinc-400 italic">Nenhum log de disparo de mensagens enviado a este número.</p>
                        ) : (
                          <div className="overflow-x-auto border border-zinc-150 rounded-xl">
                            <table className="w-full text-left text-[11px] font-sans">
                              <thead className="bg-[#FAF8F5] text-zinc-500 font-bold uppercase text-[9px] tracking-wider border-b border-zinc-200">
                                <tr>
                                  <th className="p-2.5">Data Envio</th>
                                  <th className="p-2.5">Canal</th>
                                  <th className="p-2.5">Mensagem Disparada</th>
                                  <th className="p-2.5">Token de Validação CRM</th>
                                  <th className="p-2.5">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 text-zinc-600">
                                {communications.map((c) => (
                                  <tr key={c.id}>
                                    <td className="p-2.5 font-mono whitespace-nowrap">{normalizeDateDisplay(c.date)}</td>
                                    <td className="p-2.5 font-bold uppercase text-zinc-700 text-[10px]">{c.type}</td>
                                    <td className="p-2.5 max-w-[200px] truncate" title={c.message}>{c.message}</td>
                                    <td className="p-2.5 font-mono text-zinc-400 select-all font-bold">{c.token || <span className="text-zinc-300">-</span>}</td>
                                    <td className="p-2.5">
                                      <span className={`px-2 py-0.5 text-[8px] font-bold rounded-full uppercase ${
                                        c.status.toLowerCase().includes('respond') || c.status.toLowerCase().includes('confirm')
                                          ? 'bg-emerald-100 text-emerald-800' 
                                          : 'bg-zinc-100 text-zinc-500'
                                      }`}>
                                        {c.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Notificações e Alertas Importados */}
                      <div className="space-y-4 pt-4 border-t border-zinc-100">
                        <div className="border-b border-zinc-100 pb-3">
                          <h4 className="font-serif font-bold text-md text-[#8B0000] uppercase">Alertas e Avisos do Sistema Cadastrados</h4>
                        </div>
                        {avisosList.length === 0 ? (
                          <p className="text-[11px] text-zinc-400 italic">Nenhum aviso emitido para o prontuário deste paciente.</p>
                        ) : (
                          <div className="space-y-2.5">
                            {avisosList.map((avi) => (
                              <div key={avi.id} className="bg-amber-50/40 border border-amber-200/60 p-4 rounded-xl flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-zinc-800 text-xs">{avi.title}</h5>
                                    <span className="text-[9px] font-mono font-bold text-amber-800">{normalizeDateDisplay(avi.date)}</span>
                                  </div>
                                  <p className="text-zinc-600 leading-normal font-sans">{avi.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* Panel F: Financial state and billing receipts */}
                  {activeDetailTab === 'financial' && (
                    <div className="space-y-6">
                      <div className="border-b border-zinc-100 pb-3 flex justify-between items-center">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">FINANCEIRO INTEGRADO</span>
                          <h4 className="font-serif font-bold text-lg text-[#8B0000]">Controle de Pagamentos, Recibos e Cobrança</h4>
                        </div>
                      </div>

                      {/* Statistics cards */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl text-left space-y-1">
                          <span className="text-[10px] font-bold tracking-widest uppercase text-emerald-800 block">Total Faturado & Pago</span>
                          <span className="text-2xl font-mono font-black text-emerald-900 leading-none">
                            R$ {pagamentosList.reduce((acc, pay) => {
                              const v = Number(String(pay.value || '0').replace(/[^\d.,]/g, '').replace(',', '.'));
                              return acc + (isNaN(v) ? 0 : v);
                            }, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="bg-zinc-50 border p-4 rounded-xl text-left space-y-1">
                          <span className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 block">Recibos Emitidos</span>
                          <span className="text-2xl font-mono font-black text-zinc-800 leading-none">{pagamentosList.length} transações</span>
                        </div>
                      </div>

                      {pagamentosList.length === 0 ? (
                        <div className="p-8 text-center bg-[#FAF8F5] border border-dashed rounded-xl border-zinc-200">
                          <p className="text-xs text-zinc-400 italic">Sem histórico de faturamento para este paciente.</p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto border border-zinc-150 rounded-xl">
                          <table className="w-full text-left text-[11px] font-sans">
                            <thead className="bg-[#FAF8F5] text-zinc-500 font-bold uppercase text-[9px] border-b">
                              <tr>
                                <th className="p-2.5">Data Movimento</th>
                                <th className="p-2.5">Forma de Pagamento</th>
                                <th className="p-2.5">Descrição do Item</th>
                                <th className="p-2.5 text-right">Valor Final</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 text-zinc-700">
                              {pagamentosList.map((pay) => (
                                <tr key={pay.id} className="hover:bg-zinc-50/50">
                                  <td className="p-2.5 font-mono">{normalizeDateDisplay(pay.date)}</td>
                                  <td className="p-2.5">
                                    <span className="px-2 py-0.5 bg-zinc-100 rounded text-[9px] font-mono font-bold uppercase text-zinc-700">
                                      {pay.method || 'PIX'}
                                    </span>
                                  </td>
                                  <td className="p-2.5 font-bold uppercase tracking-wide text-zinc-800">{pay.description}</td>
                                  <td className="p-2.5 font-mono text-zinc-900 font-bold text-right">
                                    {String(pay.value).startsWith('R$') ? pay.value : `R$ ${Math.abs(Number(pay.value)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Panel G: Documents and Photo Gallery */}
                  {activeDetailTab === 'docs_gallery' && (
                    <div className="space-y-6">
                      
                      {/* Documents block */}
                      <div className="space-y-4">
                        <div className="border-b border-zinc-100 pb-3">
                          <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">DADOS MÉDICOS DIGITALIZADOS</span>
                          <h4 className="font-serif font-bold text-lg text-[#8B0000]">Anexos, Laudos e Atestados Clínicos</h4>
                        </div>

                        {documentosList.length === 0 ? (
                          <p className="text-[11px] text-zinc-400 italic">Nenhum documento anexado digitalmente a esta conta.</p>
                        ) : (
                          <div className="space-y-3.5">
                            {documentosList.map((d) => (
                              <div key={d.id} className="bg-white border rounded-xl p-4 border-[#E6DEC9] shadow-2xs space-y-2 text-left">
                                <div className="flex justify-between items-center text-[10px] font-bold font-mono text-[#8B0000]">
                                  <span>📄 Atas de Exame / {d.type}</span>
                                  <span>📅 {normalizeDateDisplay(d.date)}</span>
                                </div>
                                <div className="text-zinc-700 font-sans text-xs bg-[#FAF8F5] p-3 rounded-md italic space-y-1 max-h-40 overflow-y-auto">
                                  <p className="whitespace-pre-line leading-relaxed font-semibold">{d.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Photo Library Gallery */}
                      <div className="space-y-4 pt-4 border-t border-zinc-100">
                        <div className="border-b border-zinc-100 pb-3">
                          <h4 className="font-serif font-bold text-md text-[#8B0000] uppercase">Galeria de Imagens de Implantes e Raio-X</h4>
                        </div>

                        {galeriaList.length === 0 ? (
                          <div className="p-8 text-center bg-[#FAF8F5] border border-dashed rounded-xl border-zinc-200">
                            <p className="text-xs text-zinc-400 italic">Nenhuma imagem clínica adicionada ao acervo do paciente.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {galeriaList.map((g) => (
                              <div key={g.id} className="bg-[#FAF8F5] border border-zinc-200 rounded-xl overflow-hidden shadow-2xs relative group">
                                <div className="aspect-square bg-zinc-200/90 relative flex items-center justify-center overflow-hidden">
                                  {g.url && (g.url.startsWith('http') || g.url.startsWith('data:')) ? (
                                    <img 
                                      src={g.url} 
                                      alt={g.description || 'Clinical snapshot'} 
                                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    // Beautiful fallback card
                                    <div className="flex flex-col items-center justify-center text-center p-4 text-zinc-400 space-y-1">
                                      <span className="text-3xl">🦷</span>
                                      <span className="text-[10px] font-mono uppercase bg-[#8B0000]/5 px-2 py-0.5 rounded text-[#8B0000] font-bold">Imagem de Exame</span>
                                    </div>
                                  )}
                                  <div className="absolute right-2 top-2 bg-zinc-950/70 text-white text-[8px] font-mono px-1.5 py-0.5 rounded uppercase font-bold">
                                    {normalizeDateDisplay(g.date)}
                                  </div>
                                </div>
                                <div className="p-3 bg-white text-xs space-y-1 border-t">
                                  <p className="font-semibold text-zinc-800 line-clamp-2 leading-snug">{g.description || 'Imagem sem descrição'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                  {/* Panel H: Google Drive Unified Cloud Library & Proposals */}
                  {activeDetailTab === 'drive_records' && (
                    <div className="space-y-6">
                      
                      {/* Connection status card */}
                      <div className="p-4 bg-amber-500/5 rounded-xl border border-[#E6DEC9] text-left space-y-1.5 flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-bold text-[#8B0000] flex items-center gap-1.5 uppercase font-mono">
                            <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping inline-block" />
                            Pasta do Paciente Ativa no Google Drive
                          </p>
                          <p className="text-xs text-zinc-650 mt-0.5">
                            Diretório: <span className="font-mono font-semibold bg-[#FAF8F5] px-1.5 py-0.5 border rounded text-[#8B0000]">/Planejador Odontológico/{selectedPatient ? selectedPatient.name.replace(/[^a-zA-Z0-9 ]/g, '').trim() : ''}</span>
                          </p>
                        </div>
                        {driveFolderId && (
                          <span className="text-[10px] font-mono font-semibold text-[#C09553] uppercase border border-[#C09553]/40 px-2 py-0.5 rounded-md bg-white">
                            ID: {driveFolderId}
                          </span>
                        )}
                      </div>

                      {/* Part 1: Propostas e Orçamentos Clinicos */}
                      <div className="space-y-4">
                        <div className="border-b border-zinc-100 pb-3 flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">WORKSPACE DE ORÇAMENTOS (DRIVE)</span>
                            <h4 className="font-serif font-bold text-lg text-[#8B0000]">Planejamentos de Tratamento Gravados</h4>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              if (onNewProposal && selectedPatient) {
                                onNewProposal(selectedPatient.name);
                              }
                            }}
                            className="px-3.5 py-2 bg-[#C09553] hover:bg-[#A97E3B] text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Novo Plano / Orçamento
                          </button>
                        </div>

                        {isLoadingDriveProposals ? (
                          <div className="flex justify-center p-8 bg-[#FAF8F5] border border-dashed rounded-xl">
                            <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs">
                              <Loader2 className="w-4 h-4 animate-spin text-[#C09553]" />
                              <span>Lendo arquivos de projeto no Google Drive...</span>
                            </div>
                          </div>
                        ) : driveProposals.length === 0 ? (
                          <div className="p-10 text-center bg-[#FAF8F5] border border-dashed rounded-xl border-zinc-200">
                            <p className="text-xs text-zinc-450 italic">Nenhum plano ou orçamento .json ativo localizado na pasta eletrônica deste paciente.</p>
                            <p className="text-[10px] text-zinc-400 mt-1 max-w-md mx-auto">Clique no botão "+ Novo Plano / Orçamento" acima para inicializar a modelagem de dentes 3D e dentes perdidos.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {driveProposals.map((prop) => (
                              <div key={prop.id} className="bg-white border rounded-xl p-4 border-[#E6DEC9] shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between text-left relative">
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-8 h-8 rounded-full bg-[#FAF8F5] border flex items-center justify-center text-[#C09553]">
                                        <FileText className="w-4 h-4" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-zinc-800 truncate" title={prop.name}>
                                          {prop.name.replace('.json', '')}
                                        </p>
                                        <p className="text-[9px] text-zinc-500 font-mono">
                                          Atualizado em: {new Date(prop.modifiedTime || prop.createdTime).toLocaleDateString('pt-BR')} às {new Date(prop.modifiedTime || prop.createdTime).toLocaleTimeString('pt-BR')}
                                        </p>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2 pt-1">
                                    {/* Status details */}
                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${getStatusColor(prop.appProperties?.status || 'Aberto')}`}>
                                      <span className={`w-1 h-1 rounded-full ${
                                        (prop.appProperties?.status?.includes('Aprovado') || prop.appProperties?.status?.includes('Concluído')) ? 'bg-emerald-500' :
                                        (prop.appProperties?.status?.includes('Aberto') || !prop.appProperties?.status) ? 'bg-rose-500' :
                                        (prop.appProperties?.status?.includes('Aguardando')) ? 'bg-orange-500' : 'bg-blue-500'
                                      }`} />
                                      {prop.appProperties?.status || 'Em Aberto'}
                                    </span>

                                    {prop.appProperties?.total && (
                                      <span className="text-[10px] bg-zinc-50 border border-zinc-200 text-zinc-800 font-mono font-bold px-2 py-0.5 rounded">
                                        {formatBRL(prop.appProperties.total)}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-1.5 mt-4 pt-3 border-t border-zinc-100">
                                  <button
                                    type="button"
                                    onClick={() => renameDriveProposalFile(prop.id, prop.name)}
                                    className="p-1 px-2 text-[10px] font-bold hover:bg-zinc-100 border rounded text-zinc-650 transition-colors cursor-pointer flex items-center gap-1"
                                    title="Renomear arquivo"
                                  >
                                    <Pencil className="w-3 h-3" />
                                    Renomear
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => deleteDriveProposalFile(prop.id)}
                                    className="p-1 px-2 text-[10px] font-bold hover:bg-[#FAF8F5] border rounded text-[#8B0000] border-transparent hover:border-[#E6DEC9] transition-colors cursor-pointer flex items-center gap-1"
                                    title="Excluir arquivo do Drive"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    Excluir
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isLoadingProposalAction !== null}
                                    onClick={() => handleLoadProposalIntoWorkspace(prop.id)}
                                    className="p-1.5 px-3 bg-[#8B0000] hover:bg-[#a32c3d] text-[#FAF8F5] text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                                  >
                                    {isLoadingProposalAction === prop.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <FolderOpen className="w-3 h-3" />
                                    )}
                                    Abrir no Planejador
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Part 2: Imagens e Fotos do Paciente */}
                      <div className="space-y-4 pt-6 border-t border-zinc-200">
                        <div className="border-b border-zinc-100 pb-3 flex justify-between items-center flex-wrap gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider font-mono">BIBLIOTECA DE IMAGENS NA NUVEM (DRIVE)</span>
                            <h4 className="font-serif font-bold text-lg text-[#8B0000]">Raio-X, Tomografias e Fotos Clínicas</h4>
                          </div>

                          <div className="flex gap-2">
                            {/* Standard file selector input */}
                            <label className="px-3.5 py-2 bg-white hover:bg-zinc-100 text-zinc-700 font-bold text-[10px] uppercase tracking-wider rounded-xl border border-zinc-300 transition-all flex items-center gap-1 cursor-pointer active:scale-95">
                              <Upload className="w-3.5 h-3.5 text-[#B48C4D]" />
                              Upar Foto
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={uploadDriveFile} 
                                disabled={isDriveUploading} 
                              />
                            </label>

                            <button
                              type="button"
                              onClick={isCameraActive ? () => { setIsCameraActive(false); stopCameraStream(); } : startCamera}
                              className="px-3.5 py-2 bg-[#8B0000] hover:bg-[#a32c3d] text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                            >
                              <Camera className="w-3.5 h-3.5" />
                              {isCameraActive ? 'Desligar Câmera' : 'Adquirir via Webcam'}
                            </button>
                          </div>
                        </div>

                        {/* Webcam Capture Card Component inside tab */}
                        {isCameraActive && (
                          <div className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 space-y-4 max-w-xl mx-auto relative text-center">
                            <button 
                              type="button" 
                              onClick={() => { setIsCameraActive(false); stopCameraStream(); }}
                              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
                            >
                              <X className="w-5 h-5" />
                            </button>
                            
                            <div>
                              <span className="text-[9px] uppercase font-bold text-amber-500 tracking-wider font-mono">CAPTURA CLÍNICA DE FOTO</span>
                              <h5 className="font-serif font-bold text-sm text-[#FAF8F5]">Câmera Digital Integrada</h5>
                            </div>

                            <div className="relative aspect-video bg-black rounded-xl overflow-hidden ring-1 ring-white/15">
                              <video 
                                ref={videoRef} 
                                className="w-full h-full object-cover transform scale-x-[-1]" 
                                playsInline 
                                muted
                              />
                              <canvas ref={canvasRef} className="hidden" />
                            </div>

                            {cameraError && (
                              <p className="text-[11px] text-rose-450 font-semibold">{cameraError}</p>
                            )}

                            <div className="flex justify-center gap-3.5">
                              <button
                                type="button"
                                onClick={toggleCameraFacingMode}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold uppercase rounded-lg transition-colors cursor-pointer"
                              >
                                Inverter Câmera
                              </button>
                              <button
                                type="button"
                                onClick={captureCameraSnapshot}
                                disabled={isDriveUploading}
                                className="px-5 py-2.5 bg-[#C09553] hover:bg-amber-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer shadow-md flex items-center gap-2"
                              >
                                {isDriveUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                                Capturar e Salvar no Drive
                              </button>
                            </div>
                          </div>
                        )}

                        {isLoadingDriveImages ? (
                          <div className="flex justify-center p-8 bg-[#FAF8F5] border border-dashed rounded-xl">
                            <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs">
                              <Loader2 className="w-4 h-4 animate-spin text-[#C09553]" />
                              <span>Lendo fotos clínicas da pasta no Google Drive...</span>
                            </div>
                          </div>
                        ) : driveImages.length === 0 ? (
                          <div className="p-10 text-center bg-[#FAF8F5] border border-dashed rounded-xl border-zinc-200">
                            <p className="text-xs text-zinc-450 italic">Nenhuma imagem clínica localizada na pasta do Drive.</p>
                            <p className="text-[10px] text-zinc-450 mt-1 max-w-md mx-auto">Use os botões de envio acima para anexar tomografias ou raios-x corporativos.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                            {driveImages.map((img) => (
                              <div key={img.id} className="bg-white border rounded-xl overflow-hidden border-[#E6DEC9] shadow-2xs hover:shadow-xs transition-all group text-left relative flex flex-col justify-between">
                                <div className="aspect-square bg-zinc-200 relative flex items-center justify-center overflow-hidden">
                                  {img.thumbnailLink ? (
                                    <img 
                                      src={img.thumbnailLink.replace('=s220', '=s600')} 
                                      alt={img.name} 
                                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                                      referrerPolicy="no-referrer"
                                    />
                                  ) : (
                                    <div className="flex flex-col items-center justify-center p-4 text-zinc-400 space-y-2">
                                      <span className="text-3xl">🩻</span>
                                      <span className="text-[9px] font-mono uppercase bg-zinc-100 px-2 py-0.5 rounded text-zinc-650 font-bold">Imagem Clínica</span>
                                    </div>
                                  )}

                                  <div className="absolute right-2 top-2 bg-zinc-950/75 text-[#FAF8F5] text-[8px] font-mono px-1.5 py-0.5 rounded-md font-bold shadow-sm uppercase">
                                    {normalizeDateDisplay(img.createdTime)}
                                  </div>
                                </div>

                                <div className="p-3.5 space-y-1.5">
                                  <p className="text-xs font-semibold text-zinc-800 line-clamp-2 leading-relaxed font-sans" title={img.name}>
                                    {img.name}
                                  </p>
                                </div>

                                <div className="p-2 border-t bg-[#FAF8F5] flex justify-between items-center gap-1.5">
                                  {img.webViewLink && (
                                    <a 
                                      href={img.webViewLink} 
                                      target="_blank" 
                                      rel="noreferrer"
                                      className="text-[9px] uppercase font-bold text-[#C09553] hover:text-amber-700 tracking-wider flex items-center gap-1 px-2 py-1 hover:bg-zinc-100 rounded-md"
                                    >
                                      Visualizar Original
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => deleteDriveFile(img.id)}
                                    className="p-1 px-1.5 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded text-rose-500 transition-colors cursor-pointer"
                                    title="Remover"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>

              </div>
            ) : (
              <div className="bg-[#FAF8F5] border-2 border-dashed border-[#C09553]/30 p-16 rounded-2xl text-center shadow-xs text-zinc-450 text-xs">
                Selecione um paciente na lista de CRM à esquerda para carregar o prontuário completo, detalhes cadastrais e as abas de evolução históricas consolidadas.
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}

// Simple display date formats
function normalizeDateDisplay(isoString: string): string {
  if (!isoString) return '';
  const cleanStr = isoString.split('T')[0];
  const parts = cleanStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return cleanStr;
}

function formatBRL(value: any): string {
  const num = Number(value);
  if (isNaN(num)) return `R$ 0,00`;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function getStatusColor(status: string): string {
  const norm = String(status || '').toLowerCase();
  if (norm.includes('aprovado') || norm.includes('pago') || norm.includes('concluido')) {
    return 'bg-emerald-50 border-emerald-200 text-emerald-800';
  }
  if (norm.includes('aberto') || norm.includes('não pago') || norm.includes('cancelado')) {
    return 'bg-rose-50 border-rose-200 text-rose-800';
  }
  if (norm.includes('aguardando') || norm.includes('pendente')) {
    return 'bg-orange-50 border-orange-200 text-orange-900';
  }
  if (norm.includes('andamento')) {
    return 'bg-blue-50 border-blue-205 text-blue-800';
  }
  return 'bg-zinc-50 border-zinc-200 text-zinc-700';
}
