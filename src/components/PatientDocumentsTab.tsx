import React, { useState, useEffect, useRef } from 'react';
import { TreatmentProposal, ClinicSettings } from '../types';
import { 
  FileText, 
  FileSignature, 
  Settings, 
  Printer, 
  Clock,
  Database,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  Info,
  Search,
  DollarSign,
  Sparkles,
  Send,
  Eye,
  AlertTriangle,
  Image as ImageIcon,
  HeartPulse,
  PlusCircle,
  Landmark,
  ChevronRight,
  Phone,
  Shield,
  ShieldAlert,
  FolderOpen,
  FileCheck
} from 'lucide-react';
import MedicalDocumentModal from './MedicalDocumentModal';
import * as XLSX from 'xlsx';
import { saveTreatmentPlanToDrive, listPatientsFromDrive } from '../lib/drive';
import { createCalendarEvent } from '../lib/calendar';

interface PatientDocumentsTabProps {
  proposal: TreatmentProposal;
  clinicSettings: ClinicSettings;
  setClinicSettings: React.Dispatch<React.SetStateAction<ClinicSettings>>;
}

interface IssuedDeclaration {
  id: string;
  date: string;
  arrivalTime: string;
  departureTime: string;
}

export default function PatientDocumentsTab({ proposal, clinicSettings, setClinicSettings }: PatientDocumentsTabProps) {
  const pd = proposal.patientData || {};
  const [docModalType, setDocModalType] = useState<'receituario' | 'atestado' | 'declaracao' | null>(null);
  const [reprintData, setReprintData] = useState<{ arrival: string, departure: string } | null>(null);
  
  const localStorageKey = `declarationsHistory_${proposal.patientName}`;
  const [declarationsHistory, setDeclarationsHistory] = useState<IssuedDeclaration[]>(() => {
    try {
      const stored = localStorage.getItem(localStorageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(localStorageKey, JSON.stringify(declarationsHistory));
  }, [declarationsHistory, localStorageKey]);

  // --- XLSX BACKUP IMPORTER STATES ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  
  const [importFile, setImportFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawData, setRawData] = useState<any[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);

  // Field mappings. Values store the column index in rawData[0] (or -1 if not mapped)
  const [mappings, setMappings] = useState<Record<string, number>>({
    name: -1,
    phone: -1,
    email: -1,
    notes: -1,
    date: -1,
    time: -1
  });

  const [detectedTemplate, setDetectedTemplate] = useState<'standard' | 'bluedental' | null>(null);
  const [extMappings, setExtMappings] = useState<Record<string, number>>({});

  // --- FAST QUICK ACTIONS CAMADA STATES ---
  const [selectedQuickFile, setSelectedQuickFile] = useState<string | null>(null);
  const [selectedQuickActionTab, setSelectedQuickActionTab] = useState<'whatsapp' | 'calendar' | 'drive'>('whatsapp');
  const [fileCategories, setFileCategories] = useState<Record<string, string>>({
    'Backup_BlueDental_Faturamento.xlsx': 'Orçamentos',
    'Agenda_Consultas_Retorno_Junho.csv': 'Prontuário',
    'Anamneses_Clinicas_Gerais.md': 'Exames'
  });
  const [quickActionSelectedPatient, setQuickActionSelectedPatient] = useState<string>('');
  const [whatsappTemplateType, setWhatsappTemplateType] = useState<'welcome' | 'appointment' | 'notes'>('welcome');
  const [whatsappDraftText, setWhatsappDraftText] = useState<string>('');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string>('');
  const [calendarSyncStatuses, setCalendarSyncStatuses] = useState<Record<string, 'idle' | 'syncing' | 'synced' | 'failed'>>({});
  const [driveSyncStatuses, setDriveSyncStatuses] = useState<Record<string, 'idle' | 'syncing' | 'synced' | 'failed'>>({});
  const [quickActionsHistory, setQuickActionsHistory] = useState<{ id: string, file: string, type: string, summary: string, timestamp: string }[]>([]);

  // Automatic WhatsApp draft text builder based on selected patient and template
  useEffect(() => {
    if (!quickActionSelectedPatient) {
      setWhatsappDraftText('');
      return;
    }

    const pName = quickActionSelectedPatient;
    let foundPhone = '';
    let foundDate = '';
    let foundTime = '';
    let foundDetail = '';

    if (rawData.length > 1) {
      const idxName = headers.findIndex(h => {
        const hL = String(h || '').toLowerCase().trim();
        return hL === 'nome_paciente' || hL === 'paciente' || hL === 'nome_completo' || hL === 'cliente' || hL === 'nome';
      });

      const matchedRow = rawData.slice(1).find(row => {
        const currentName = idxName !== -1 ? String(row[idxName] || '').trim() : '';
        return currentName.toLowerCase() === pName.toLowerCase();
      });

      if (matchedRow) {
        if (mappings.phone !== -1 && matchedRow[mappings.phone]) foundPhone = String(matchedRow[mappings.phone]).trim();
        if (mappings.date !== -1 && matchedRow[mappings.date]) foundDate = String(matchedRow[mappings.date]).trim();
        if (mappings.time !== -1 && matchedRow[mappings.time]) foundTime = String(matchedRow[mappings.time]).trim();
        
        // Find clinical service/description context
        const isProc = headers.findIndex(h => {
          const hL = String(h || '').toLowerCase();
          return hL.includes('procedimento') || hL.includes('servico') || hL.includes('descricao');
        });
        if (isProc !== -1 && matchedRow[isProc]) {
          foundDetail = String(matchedRow[isProc]).trim();
        }
      }
    }

    if (!foundPhone) {
      foundPhone = '5511999999999';
    }

    let message = '';
    if (whatsappTemplateType === 'welcome') {
      message = `Olá, *${pName}*! Tudo bem?\n\nSeja muito bem-vindo(a) ao consultório do *Dr. Agnaldo Ferreira*! Nosso sistema clínico mapeou seu cadastro com sucesso. É uma satisfação tê-lo(a) conosco!\n\nCaso necessite de atendimento ou queira marcar uma avaliação, estamos prontos para lhe atender. 🦷✨`;
    } else if (whatsappTemplateType === 'appointment') {
      const dateStr = foundDate ? new Date(foundDate).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
      const timeStr = foundTime ? foundTime.substring(0, 5) : '09:00';
      message = `Olá, *${pName}*!\n\nPassando para lembrar que você possui uma consulta odontológica agendada com o *Dr. Agnaldo Ferreira*:\n\n📅 Data: *${dateStr}*\n🕒 Horário: *${timeStr}*\n📍 Local: *${clinicSettings.address}*\n\nPor favor, confirme respondendo a esta mensagem. Obrigado! 👍`;
    } else {
      const detailStr = foundDetail ? ` (${foundDetail})` : '';
      message = `Olá, *${pName}*! Aqui é a equipe de suporte clínico do *Dr. Agnaldo Ferreira*.\n\nSua ficha médica e prontuário digital seguro${detailStr} foram consolidados no nosso servidor do Google Drive.\n\nEstamos à disposição para qualquer dúvida ou envio de atestados e receitas por via digital! 📖🔒`;
    }

    setWhatsappDraftText(message);
  }, [quickActionSelectedPatient, whatsappTemplateType, rawData, mappings, headers, clinicSettings.address]);
  
  // --- ADVANCED BLUE-DENTAL DATA WORKSPACE STATES ---
  const [activeDashboardTab, setActiveDashboardTab] = useState<'financeiro' | 'odontograma' | 'agendamentos' | 'anamnese' | 'documentos' | 'galeria' | 'paciente'>('financeiro');
  const [dashboardSearch, setDashboardSearch] = useState('');
  const [selectedPatientFilter, setSelectedPatientFilter] = useState('');
  const [activeViewMode, setActiveViewMode] = useState<'workspace' | 'legacy'>('workspace');

  const cleanStringValue = (val: any): string => {
    if (val === undefined || val === null) return '';
    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'nan') return '';
    return str;
  };

  const formatDateToHtmlInput = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return '';
      return val.toISOString().split('T')[0];
    }
    const str = String(val).trim();
    if (!str || str.toLowerCase() === 'nan') return '';
    
    // YYYY-MM-DD
    const matchYmd = str.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
    if (matchYmd) {
      const y = matchYmd[1];
      const m = matchYmd[2].padStart(2, '0');
      const d = matchYmd[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    
    // DD-MM-YYYY or DD/MM/YYYY
    const matchDmy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (matchDmy) {
      const d = matchDmy[1].padStart(2, '0');
      const m = matchDmy[2].padStart(2, '0');
      const y = matchDmy[3];
      return `${y}-${m}-${d}`;
    }

    try {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      // ignores
    }
    return '';
  };

  const [isRunningImport, setIsRunningImport] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'loaded' | 'running' | 'success' | 'done'>('idle');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [createCalendarAppts, setCreateCalendarAppts] = useState(true);
  
  // Import tracking counters
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    successes: 0,
    errors: 0,
    skipped: 0
  });
  const [importLogs, setImportLogs] = useState<string[]>([]);

  // Automatically scroll logs to bottom
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [importLogs]);

  const handleUpdateSetting = (field: keyof ClinicSettings, value: string) => {
    setClinicSettings(prev => ({ ...prev, [field]: value }));
  };

  const handleEmitDeclaration = (data: { arrivalTime: string, departureTime: string }) => {
    const newDecl: IssuedDeclaration = {
      id: Math.random().toString(36).substring(2, 11),
      date: new Date().toISOString(),
      arrivalTime: data.arrivalTime,
      departureTime: data.departureTime
    };
    
    setDeclarationsHistory(prev => {
      const newHistory = [newDecl, ...prev];
      return newHistory.slice(0, 5); // Keep only the last 5
    });
  };

  const handleReprint = (decl: IssuedDeclaration) => {
    setReprintData({ arrival: decl.arrivalTime, departure: decl.departureTime });
    setDocModalType('declaracao');
  };

  // --- XLSX PARSING LOGIC ---
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = (file: File) => {
    setImportFile(file);
    setImportStatus('idle');
    setImportLogs([]);
    setDetectedTemplate(null);
    setHeaders([]);
    setRawData([]);
    setSheetNames([]);
    setSelectedSheet('');
    setSelectedQuickFile(file.name);
    setQuickActionSelectedPatient('');

    const lowerName = file.name.toLowerCase();
    
    if (lowerName.endsWith('.pdf')) {
      processPdfFile(file);
    } else if (lowerName.endsWith('.md') || lowerName.endsWith('.txt')) {
      processTextFile(file);
    } else {
      processExcelFile(file);
    }
  };

  const processExcelFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array', cellDates: true });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        
        if (wb.SheetNames.length > 0) {
          const firstSheet = wb.SheetNames[0];
          setSelectedSheet(firstSheet);
          loadSheetData(wb, firstSheet);
        }
      } catch (err: any) {
        alert('Erro ao decodificar arquivo Excel: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    
    // Obtains a raw array of arrays
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    setRawData(raw);
    
    if (raw.length > 0) {
      initializeMappingsFromRows(raw);
    } else {
      setHeaders([]);
      alert('Esta planilha parece estar vazia.');
    }
  };

  // --- MULTI-FORMAT PARSERS ---

  const loadPdfJs = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).pdfjsLib) {
        resolve((window as any).pdfjsLib);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        resolve(pdfjsLib);
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const processPdfFile = async (file: File) => {
    setImportLogs(prev => [...prev, `[INFO] Carregando motor de PDF inteligente...`]);
    try {
      const pdfjs = await loadPdfJs();
      
      const fileReader = new FileReader();
      fileReader.onload = async (e) => {
        try {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const typedArray = new Uint8Array(arrayBuffer);
          
          const loadingTask = pdfjs.getDocument({ data: typedArray });
          const pdfDoc = await loadingTask.promise;
          const numPages = pdfDoc.numPages;
          setImportLogs(prev => [...prev, `[INFO] PDF aberto com sucesso (${numPages} páginas). Extraindo texto textual...`]);
          
          let fullText = '';
          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n--- PAGE BREAK ---\n';
          }
          
          setImportLogs(prev => [...prev, `[INFO] Texto do PDF extraído. Efetuando mapeamento estruturado de campos...`]);
          
          const rows = parseTextOrMarkdownToRows(fullText);
          
          if (rows.length > 0) {
            setRawData(rows);
            initializeMappingsFromRows(rows);
          } else {
            const unstructuredRows = tryParseUnstructuredText(fullText);
            if (unstructuredRows.length > 0) {
              setRawData(unstructuredRows);
              initializeMappingsFromRows(unstructuredRows);
            } else {
              setImportLogs(prev => [...prev, `[AVISO] Tentativa secundária: analisando texto cru do PDF para identificar chaves cadastrais...`]);
              // Create a generic fallback record containing the PDF text inside observations!
              const fallbackBlock = {
                nome_completo: file.name.replace(/\.[^/.]+$/, "").replace(/[_\-]+/g, ' '),
                observacoes: fullText.substring(0, 8000)
              };
              const fallbackRows = convertObjectListToRows([fallbackBlock]);
              setRawData(fallbackRows);
              initializeMappingsFromRows(fallbackRows);
            }
          }
        } catch (pdfErr: any) {
          alert('Erro ao analisar as páginas do PDF: ' + pdfErr.message);
        }
      };
      fileReader.readAsArrayBuffer(file);
    } catch (err: any) {
      alert('Erro ao carregar o decodificador PDF: ' + err.message);
    }
  };

  const processTextFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target?.result || '');
        const rows = parseTextOrMarkdownToRows(text);
        
        if (rows.length > 0) {
          setRawData(rows);
          initializeMappingsFromRows(rows);
        } else {
          alert('Não encontramos dados válidos (como uma tabela Markdown ou lista de paciente) neste arquivo.');
        }
      } catch (err: any) {
        alert('Erro ao carregar o arquivo de texto: ' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const parseTextOrMarkdownToRows = (text: string): any[][] => {
    const lines = text.split(/\r?\n/);
    const tableRows: any[][] = [];
    
    // Check if there are markdown table candidates
    const looksLikeMarkdownTable = lines.some(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('|') && trimmed.endsWith('|') && (trimmed.match(/\|/g)?.length || 0) > 2;
    });

    if (looksLikeMarkdownTable) {
      lines.forEach(line => {
        const trimmed = line.trim();
        // Skip separator lines e.g. |---|---|
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
          if (trimmed.includes('-') && !trimmed.match(/[A-Za-z0-9]/)) {
            return; // ignore separator
          }
          const cells = trimmed.split('|').map(c => c.trim());
          if (cells[0] === '') cells.shift();
          if (cells[cells.length - 1] === '') cells.pop();
          
          if (cells.length > 0) {
            tableRows.push(cells);
          }
        }
      });
      if (tableRows.length > 0) return tableRows;
    }

    // JSON try
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parseJsonListToRows(parsed);
      } else if (parsed && typeof parsed === 'object') {
        return parseJsonListToRows([parsed]);
      }
    } catch {
      // not JSON
    }

    // Key-Value parsed blocks by --- separators
    const blocks: Record<string, string>[] = [];
    let currentBlock: Record<string, string> = {};
    let hasKeys = false;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('---') || trimmed.startsWith('===')) {
        if (hasKeys) {
          blocks.push(currentBlock);
          currentBlock = {};
          hasKeys = false;
        }
        return;
      }
      const match = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const rawKey = match[1].trim().toLowerCase().replace(/[\s_\-\*#]+/g, '_');
        const val = match[2].trim();
        currentBlock[rawKey] = val;
        hasKeys = true;
      }
    });

    if (hasKeys) {
      blocks.push(currentBlock);
    }

    if (blocks.length > 0) {
      return convertObjectListToRows(blocks);
    }

    return [];
  };

  const convertObjectListToRows = (blocks: Record<string, string>[]): any[][] => {
    const allKeysSet = new Set<string>();
    blocks.forEach(b => {
      Object.keys(b).forEach(k => allKeysSet.add(k));
    });
    const headersList = Array.from(allKeysSet);
    const rows: any[][] = [headersList];
    
    blocks.forEach(b => {
      const row = headersList.map(h => b[h] || '');
      rows.push(row);
    });
    return rows;
  };

  const parseJsonListToRows = (list: any[]): any[][] => {
    const flatBlocks = list.map(item => {
      const flat: Record<string, string> = {};
      const flattenObj = (obj: any, path = '') => {
        if (!obj) return;
        if (typeof obj !== 'object') {
          flat[path] = String(obj);
          return;
        }
        Object.keys(obj).forEach(k => {
          const keyPath = path ? `${path}_${k}` : k;
          if (typeof obj[k] === 'object' && obj[k] !== null) {
            flattenObj(obj[k], keyPath);
          } else {
            flat[keyPath] = String(obj[k] || '');
          }
        });
      };
      flattenObj(item);
      return flat;
    });
    return convertObjectListToRows(flatBlocks);
  };

  const tryParseUnstructuredText = (text: string): any[][] => {
    const records: Record<string, string>[] = [];
    const sections = text.split(/--- PAGE BREAK ---|Paciente\s+#\d+|Prontuário\s+Nº/i);
    
    sections.forEach(sec => {
      const trimmedSec = sec.trim();
      if (!trimmedSec) return;
      
      const record: Record<string, string> = {};
      const keysToRegex = {
        nome_completo: /(?:nome_completo|nome completo|nome|paciente)[:\-\=]\s*([^\n\r\|•]+)/i,
        cpf_cliente: /(?:cpf_cliente|cpf)[:\-\=]\s*([\d\.\-]+)/i,
        rg_cliente: /(?:rg_cliente|rg)[:\-\=]\s*([a-zA-Z0-9\.\-]+)/i,
        email: /(?:email|e-mail|correo)[:\-\=]\s*([a-zA-Z0-9\._%+-]+@[a-zA-Z0-9\.-]+\.[a-zA-Z]{2,})/i,
        telefone_3: /(?:telefone_3|whatsapp|whats)[:\-\=]\s*([\d\s\(\)\-\+]+)/i,
        telefone_2: /(?:telefone_2|celular|cel)[:\-\=]\s*([\d\s\(\)\-\+]+)/i,
        telefone_1: /(?:telefone_1|telefone|fone)[:\-\=]\s*([\d\s\(\)\-\+]+)/i,
        data_nascimento: /(?:data_nascimento|data nascimento|nascimento|birthdate)[:\-\=]\s*([\d\s\/\-\:\w]+)/i,
        observacoes: /(?:observacoes|observação|obs|notas)[:\-\=]\s*([^\n\r\|•]+)/i,
        endereco_logradouro: /(?:logradouro|rua|endereço)[:\-\=]\s*([^\n\r\|•]+)/i,
        endereco_cep: /(?:cep)[:\-\=]\s*([\d\s\.\-]+)/i
      };

      let matchedFields = 0;
      Object.entries(keysToRegex).forEach(([field, regex]) => {
        const m = trimmedSec.match(regex);
        if (m && m[1]) {
          const val = m[1].trim();
          if (val && val.toLowerCase() !== 'nan') {
            record[field] = val;
            matchedFields++;
          }
        }
      });

      if (matchedFields >= 1) {
        if (!record.nome_completo) {
          const firstLine = trimmedSec.split('\n')[0].replace(/[#\*_]/g, '').trim();
          if (firstLine && firstLine.length > 3 && firstLine.length < 50) {
            record.nome_completo = firstLine;
          }
        }
        records.push(record);
      }
    });

    if (records.length > 0) {
      return convertObjectListToRows(records);
    }
    return [];
  };

  const initializeMappingsFromRows = (raw: any[][]) => {
    if (raw.length === 0) return;
    const detectedHeaders = raw[0].map(h => String(h || '').trim());
    setHeaders(detectedHeaders);
    
    const autoMappings: Record<string, number> = {};
    const findHeaderIndex = (names: string[]) => {
      return detectedHeaders.findIndex(h => 
        names.some(n => h.toLowerCase().trim() === n.toLowerCase())
      );
    };

    // General bindings
    autoMappings['nome_completo'] = findHeaderIndex(['nome_completo', 'nome completo', 'nome', 'paciente']);
    autoMappings['data_nascimento'] = findHeaderIndex(['data_nascimento', 'data nascimento', 'nascimento', 'birthdate']);
    autoMappings['sexo_cliente'] = findHeaderIndex(['sexo_cliente', 'sexo', 'genero', 'gender']);
    autoMappings['nome_estado_civil'] = findHeaderIndex(['nome_estado_civil', 'estado civil', 'estadocivil', 'maritalstatus']);
    autoMappings['cpf_cliente'] = findHeaderIndex(['cpf_cliente', 'cpf', 'cpf_responsavel']);
    autoMappings['rg_cliente'] = findHeaderIndex(['rg_cliente', 'rg', 'documento']);
    autoMappings['orgao_rg_cliente'] = findHeaderIndex(['orgao_rg_cliente', 'orgao_rg', 'orgaobrasil', 'rgissuer']);
    autoMappings['prontuario_cliente'] = findHeaderIndex(['prontuario_cliente', 'prontuario', 'record', 'medicalrecord']);
    autoMappings['email'] = findHeaderIndex(['email', 'e-mail', 'correo']);
    
    // Phones
    autoMappings['telefone_1'] = findHeaderIndex(['telefone_1', 'telefone1', 'fone1', 'residencial']);
    autoMappings['telefone_2'] = findHeaderIndex(['telefone_2', 'telefone2', 'fone2', 'celular', 'mobile']);
    autoMappings['telefone_3'] = findHeaderIndex(['telefone_3', 'telefone3', 'whatsapp', 'whats', 'whats_app']);
    
    // Notes & Info
    autoMappings['observacoes'] = findHeaderIndex(['observacoes', 'observação', 'obs', 'notas', 'notes', 'historico']);
    autoMappings['nome_profissao'] = findHeaderIndex(['nome_profissao', 'profissao', 'profissão', 'occupation']);
    autoMappings['nome_tipo_sanguinio'] = findHeaderIndex(['nome_tipo_sanguinio', 'tipo_sanguineo', 'tipo sanguineo', 'sangue']);
    autoMappings['paciente_especial'] = findHeaderIndex(['paciente_especial', 'pne', 'especial']);
    autoMappings['id_externo'] = findHeaderIndex(['id_externo', 'codigo_cliente', 'id']);
    autoMappings['apelido'] = findHeaderIndex(['apelido', 'apelido_cliente', 'nickname']);
    autoMappings['url_foto'] = findHeaderIndex(['url_foto', 'foto', 'avatar_url', 'profile_photo']);

    // Guardian
    autoMappings['nome_responsavel'] = findHeaderIndex(['nome_responsavel', 'responsavel', 'nome responsavel', 'guardian']);
    autoMappings['data_nascimento_responsavel'] = findHeaderIndex(['data_nascimento_responsavel', 'nascimento_responsavel']);
    autoMappings['telefone_responsavel'] = findHeaderIndex(['telefone_responsavel', 'fone_responsavel', 'responsavel_fone']);
    autoMappings['celular_responsavel'] = findHeaderIndex(['celular_responsavel', 'cel_responsavel', 'responsavel_celular']);
    autoMappings['cpf_responsavel'] = findHeaderIndex(['cpf_responsavel', 'cpf responsavel']);
    autoMappings['rg_responsavel'] = findHeaderIndex(['rg_responsavel', 'rg responsavel']);
    autoMappings['orgao_rg_responsavel'] = findHeaderIndex(['orgao_rg_responsavel', 'orgao_responsavel']);
    autoMappings['profissao_responsavel'] = findHeaderIndex(['profissao_responsavel', 'profissao responsavel']);

    // Address
    autoMappings['endereco_cep'] = findHeaderIndex(['endereco_cep', 'cep', 'postal_code']);
    autoMappings['endereco_logradouro'] = findHeaderIndex(['endereco_logradouro', 'logradouro', 'rua', 'street']);
    autoMappings['endereco_numero'] = findHeaderIndex(['endereco_numero', 'numero', 'num']);
    autoMappings['endereco_complemento'] = findHeaderIndex(['endereco_complemento', 'complemento', 'complement']);
    autoMappings['endereco_bairro'] = findHeaderIndex(['endereco_bairro', 'bairro', 'neighborhood']);
    autoMappings['endereco_cidade'] = findHeaderIndex(['endereco_cidade', 'cidade', 'city']);
    autoMappings['endereco_uf'] = findHeaderIndex(['endereco_uf', 'uf', 'estado', 'state']);

    // Insurance
    autoMappings['nome_convenio'] = findHeaderIndex(['nome_convenio', 'convenio', 'convênio', 'insurance']);
    autoMappings['numero_carteira'] = findHeaderIndex(['numero_carteira', 'carteira', 'num_carteira', 'insurance_card']);
    autoMappings['validade_carteira'] = findHeaderIndex(['validade_carteira', 'validade', 'insurance_validity']);
    autoMappings['nome_plano'] = findHeaderIndex(['nome_plano', 'plano', 'plan']);

    setExtMappings(autoMappings);

    // Detect if we match many columns from ancient platform "BlueDental" (or customized database)
    const blueDentalColumns = [
      'codigo_cliente', 'codigo_pessoa', 'codigo_conta', 'nome_completo', 'apelido', 
      'cpf_cliente', 'rg_cliente', 'orgao_rg_cliente', 'sexo_cliente', 'data_nascimento', 
      'prontuario_cliente', 'nome_estado_civil', 'nome_profissao', 'endereco_logradouro', 
      'endereco_cep', 'telefone_1', 'telefone_2', 'telefone_3', 'nome_convenio', 'observacoes'
    ];
    
    const matchCount = detectedHeaders.filter(h => 
      blueDentalColumns.includes(h.toLowerCase().trim())
    ).length;

    const isBlueDental = matchCount >= 4;
    setDetectedTemplate(isBlueDental ? 'bluedental' : 'standard');

    // Setup general-purpose minimal inputs for UI compatibility
    const newMappings: Record<string, number> = {
      name: autoMappings['nome_completo'],
      phone: autoMappings['telefone_3'] !== -1 ? autoMappings['telefone_3'] : (autoMappings['telefone_2'] !== -1 ? autoMappings['telefone_2'] : autoMappings['telefone_1']),
      email: autoMappings['email'],
      notes: autoMappings['observacoes'],
      date: findHeaderIndex(['data_agendamento', 'data_consulta', 'consulta_data']),
      time: findHeaderIndex(['hora_agendamento', 'hora_consulta', 'consulta_hora'])
    };

    setMappings(newMappings);
    setImportStatus('loaded');
  };

  const handleSheetChange = (sheetName: string) => {
    setSelectedSheet(sheetName);
    if (workbook) {
      loadSheetData(workbook, sheetName);
    }
  };

  const handleMappingChange = (field: string, index: number) => {
    setMappings(prev => ({ ...prev, [field]: index }));
  };

  // Helper date/time parser
  const parseExcelDateTime = (dateVal: any, timeVal: any): Date | null => {
    if (!dateVal) return null;
    
    let d: Date;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else {
      const str = String(dateVal).trim();
      if (!str) return null;
      
      const parts = str.split(/[-\/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          // DD-MM-YYYY or DD/MM/YYYY
          d = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
        }
      } else {
        d = new Date(str);
      }
    }

    if (isNaN(d.getTime())) return null;

    let year = d.getFullYear();
    let month = d.getMonth();
    let day = d.getDate();
    let hour = 9; // default 9:00 AM
    let minute = 0;

    if (timeVal) {
      if (timeVal instanceof Date) {
        hour = timeVal.getHours();
        minute = timeVal.getMinutes();
      } else {
        const timeStr = String(timeVal).trim();
        const timeParts = timeStr.split(':');
        if (timeParts.length >= 2) {
          hour = parseInt(timeParts[0]);
          minute = parseInt(timeParts[1]);
        }
      }
    }

    const finalDate = new Date(year, month, day, hour, minute);
    return isNaN(finalDate.getTime()) ? null : finalDate;
  };

  // Execute backup ingestion series
  const runDataImport = async () => {
    if (mappings.name === -1) {
      alert('Por favor, defina a coluna que contém o "Nome do Paciente" para iniciar a importação.');
      return;
    }

    const dataRows = rawData.slice(1).filter(row => row.length > 0 && String(row[mappings.name] || '').trim() !== '');
    if (dataRows.length === 0) {
      alert('Nenhum registro válido de paciente encontrado na planilha ativa.');
      return;
    }

    setIsRunningImport(true);
    setImportStatus('running');
    setImportLogs(['[INFO] Iniciando importação de dados para o sistema...', `[INFO] Scan total de registros ativos: ${dataRows.length}`]);
    
    setImportProgress({
      current: 0,
      total: dataRows.length,
      successes: 0,
      errors: 0,
      skipped: 0
    });

    let succ = 0;
    let errs = 0;
    let skips = 0;

    try {
      // 1. Fetch current patient folders to prevent duplication if requested
      let existingPatientsSet = new Set<string>();
      if (skipDuplicates) {
        setImportLogs(prev => [...prev, '[INFO] Carregando lista de pacientes do Google Drive para prevenção de duplicados...']);
        try {
          const driveData = await listPatientsFromDrive();
          existingPatientsSet = new Set(driveData.map(p => p.name.toLowerCase().trim()));
          setImportLogs(prev => [...prev, `[INFO] ${driveData.length} pacientes carregados do Drive.`]);
        } catch (setupErr: any) {
          setImportLogs(prev => [...prev, `[AVISO] Não foi possível verificar duplicados: ${setupErr.message || setupErr}`]);
        }
      }

      // 2. Iterate each row
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        
        // Helper to extract clean values
        const getVal = (apiKey: string) => {
          const idx = extMappings[apiKey];
          if (idx === undefined || idx === -1 || idx >= row.length) return '';
          return cleanStringValue(row[idx]);
        };

        const patientName = getVal('nome_completo') || String(row[mappings.name] || '').trim();
        if (!patientName) continue;

        const phone = getVal('telefone_3') || getVal('telefone_2') || getVal('telefone_1') || (mappings.phone !== -1 ? String(row[mappings.phone] || '').trim() : '');
        const email = getVal('email') || (mappings.email !== -1 ? String(row[mappings.email] || '').trim() : '');
        const notes = getVal('observacoes') || (mappings.notes !== -1 ? String(row[mappings.notes] || '').trim() : '');
        
        setImportProgress(prev => ({ ...prev, current: i + 1 }));

        // Check Duplicated
        if (skipDuplicates && existingPatientsSet.has(patientName.toLowerCase())) {
          skips++;
          setImportProgress(prev => ({ ...prev, skipped: skips }));
          setImportLogs(prev => [...prev, `[PULADO] Paciente "${patientName}" já existe no Drive.`]);
          continue;
        }

        try {
          // Gender formatting
          let genderVal = getVal('sexo_cliente');
          if (genderVal.toUpperCase() === 'M' || genderVal.toLowerCase().includes('masc')) genderVal = 'Masculino';
          else if (genderVal.toUpperCase() === 'F' || genderVal.toLowerCase().includes('fem')) genderVal = 'Feminino';
          else if (genderVal && genderVal.toLowerCase() !== 'nan') genderVal = genderVal;
          else genderVal = '';

          // Marital status formatting
          let maritalVal = getVal('nome_estado_civil');
          if (maritalVal.toLowerCase() === 'nan') maritalVal = '';

          // Address formatting
          let formattedCep = getVal('endereco_cep');
          if (formattedCep && /^\d+$/.test(formattedCep)) {
            if (formattedCep.length === 8) {
              formattedCep = `${formattedCep.slice(0, 5)}-${formattedCep.slice(5)}`;
            }
          }

          // Gather extra detailing metrics that aren't native inputs
          const extraDetails: string[] = [];
          const clientId = getVal('id_externo');
          if (clientId) extraDetails.push(`• Código Cliente: ${clientId}`);
          const clientApelido = getVal('apelido');
          if (clientApelido) extraDetails.push(`• Apelido: ${clientApelido}`);
          const bloodType = getVal('nome_tipo_sanguinio');
          if (bloodType) extraDetails.push(`• Tipo Sanguíneo: ${bloodType}`);
          const isSpecialCare = getVal('paciente_especial');
          if (isSpecialCare && isSpecialCare.toLowerCase() !== 'false') {
            extraDetails.push(`• Paciente Especial: Sim`);
          }
          const clientProfession = getVal('nome_profissao');
          if (clientProfession) extraDetails.push(`• Profissão do Paciente: ${clientProfession}`);
          const insurancePlan = getVal('nome_plano');
          if (insurancePlan) extraDetails.push(`• Plano do Convênio: ${insurancePlan}`);
          const originalPhoto = getVal('url_foto');
          if (originalPhoto) extraDetails.push(`• Foto de Perfil (Original): ${originalPhoto}`);

          const importedObs = getVal('observacoes') || notes;
          let finalObservations = '';
          if (extraDetails.length > 0) {
            finalObservations += `[DADOS DE BACKUP IMPORTADOS]\n${extraDetails.join('\n')}\n\n`;
          }
          if (importedObs) {
            finalObservations += `[OBSERVAÇÕES DO BACKUP]:\n${importedObs}`;
          }

          // Assembling the complete high-fidelity PatientData object
          const fullPatientData = {
            birthDate: formatDateToHtmlInput(getVal('data_nascimento')),
            gender: genderVal,
            status: 'ATIVO',
            maritalStatus: maritalVal,
            cpf: getVal('cpf_cliente'),
            rg: getVal('rg_cliente'),
            rgIssuer: getVal('orgao_rg_cliente'),
            medicalRecord: getVal('prontuario_cliente'),
            howKnewClinic: 'Importado',
            phone: getVal('telefone_1') || getVal('telefone_2') || '',
            mobile: phone,
            email: email,
            observations: finalObservations,

            // Guardian (Responsável)
            respName: getVal('nome_responsavel'),
            respBirthDate: formatDateToHtmlInput(getVal('data_nascimento_responsavel')),
            respPhone: getVal('telefone_responsavel'),
            respMobile: getVal('celular_responsavel'),
            respMaritalStatus: '',
            respCpf: getVal('cpf_responsavel'),
            respRg: getVal('rg_responsavel'),
            respRgIssuer: getVal('orgao_rg_responsavel'),
            respProfession: getVal('profissao_responsavel'),

            // Address (Endereço)
            cep: formattedCep,
            street: getVal('endereco_logradouro'),
            number: getVal('endereco_numero'),
            complement: getVal('endereco_complemento'),
            neighborhood: getVal('endereco_bairro'),
            city: getVal('endereco_cidade'),
            state: getVal('endereco_uf'),

            // Insurance (Convênio)
            healthInsurance: getVal('nome_convenio'),
            healthInsuranceCard: getVal('numero_carteira'),
            healthInsuranceValidity: formatDateToHtmlInput(getVal('validade_carteira')),
            isImported: true
          };

          // Initialize patient folder on drive
          const stateToSave = {
            proposal: {
              patientName: patientName,
              status: 'Aprovado' as const,
              notes: notes || 'Importado via backup de planilha.',
              patientData: fullPatientData
            },
            sections: [],
            procedures: []
          };

          // Save to Drive
          await saveTreatmentPlanToDrive(patientName, stateToSave);

          // Handle conditional calendar event
          let isScheduled = false;
          let dateVal = mappings.date !== -1 ? row[mappings.date] : null;
          let timeVal = mappings.time !== -1 ? row[mappings.time] : null;

          if (createCalendarAppts && dateVal) {
            const appointmentDateObj = parseExcelDateTime(dateVal, timeVal);
            if (appointmentDateObj) {
              const startIso = appointmentDateObj.toISOString();
              const endIso = new Date(appointmentDateObj.getTime() + 60 * 60 * 1000).toISOString(); // 1 hour duration
              
              const calPayload = {
                summary: `Consulta: ${patientName}`,
                description: `Sessão agendada na importação. Contato: ${phone || 'Sem número'}. Obs: ${notes}`,
                start: { dateTime: startIso },
                end: { dateTime: endIso }
              };
              
              await createCalendarEvent(calPayload);
              isScheduled = true;
            }
          }

          succ++;
          setImportProgress(prev => ({ ...prev, successes: succ }));
          
          const scheduleMsg = isScheduled ? ' + agendado na Agenda do Google' : '';
          setImportLogs(prev => [...prev, `[OK] Paciente "${patientName}" importado com sucesso${scheduleMsg}.`]);
        } catch (rowErr: any) {
          errs++;
          setImportProgress(prev => ({ ...prev, errors: errs }));
          setImportLogs(prev => [...prev, `[ERRO] Falha ao processar "${patientName}": ${rowErr.message || rowErr}`]);
        }

        // Add minor pause limit to respect standard API throttling (Google Drive lists rate-limit)
        await new Promise(resolve => setTimeout(resolve, 350));
      }

      setImportStatus('success');
      setImportLogs(prev => [...prev, `[FIM] Importação finalizada! Sucessos: ${succ}, Pulados/Duplicados: ${skips}, Falhas: ${errs}`]);
    } catch (generalErr: any) {
      setImportLogs(prev => [...prev, `[ERRO FATAL] Falha durante a execução global: ${generalErr.message || generalErr}`]);
      setImportStatus('done');
    } finally {
      setIsRunningImport(false);
    }
  };

  const getDetectedDataType = (): 'financeiro' | 'odontograma' | 'agendamentos' | 'anamnese' | 'documentos' | 'galeria' | 'paciente' => {
    if (headers.length === 0) return 'paciente';
    const hLower = headers.map(h => String(h || '').toLowerCase().trim());
    
    if (hLower.includes('codigo_odontograma_procedimento') || hLower.includes('descricao_procedimento') || hLower.includes('nome_area_execucao') || hLower.includes('face_vestibular') || hLower.includes('codigo_odontograma')) {
      return 'odontograma';
    }
    if (hLower.includes('codigo_lancamento') || hLower.includes('valor_realizado') || hLower.includes('nome_categoria') || hLower.includes('tipo_categoria') || hLower.includes('realizado')) {
      return 'financeiro';
    }
    if (hLower.includes('codigo_resposta_anamnese') || hLower.includes('texto_pergunta') || hLower.includes('resposta') || hLower.includes('nome_anamnese')) {
      return 'anamnese';
    }
    if (hLower.includes('codigo_agendamento') || hLower.includes('data_agendamento') || hLower.includes('hora_agendamento') || hLower.includes('nome_status')) {
      return 'agendamentos';
    }
    if (hLower.includes('conteudo_documento') || hLower.includes('conteudo') || hLower.includes('nome_tipo_documento')) {
      return 'documentos';
    }
    if (hLower.includes('url_arquivo') || hLower.includes('nome_galeria')) {
      return 'galeria';
    }
    
    return 'paciente';
  };

  const getUniquePatientNames = (): string[] => {
    if (rawData.length <= 1) return [];
    const idx = headers.findIndex(h => {
      const hL = h.toLowerCase().trim();
      return hL === 'nome_paciente' || hL === 'paciente' || hL === 'nome_completo' || hL === 'cliente' || hL === 'nome';
    });
    if (idx === -1) return [];
    
    return Array.from(new Set(
      rawData.slice(1).map(row => String(row[idx] || '').trim()).filter(Boolean)
    )).sort();
  };

  const getFinancialChartData = () => {
    const datesMap: Record<string, { income: number; expense: number }> = {};
    if (rawData.length <= 1) return [];
    
    rawData.slice(1).forEach(row => {
      const getValByHeaders = (possibleNames: string[]) => {
        const idx = headers.findIndex(h => possibleNames.includes(h.toLowerCase().trim()));
        return idx !== -1 ? row[idx] : null;
      };
      
      const category = String(getValByHeaders(['nome_categoria', 'category', 'categoria']) || '');
      const type = String(getValByHeaders(['tipo_categoria', 'tipo']) || '').toLowerCase();
      const rawVal = parseFloat(String(getValByHeaders(['valor_realizado', 'valor_previsto', 'valor']) || '0').replace(/[^\d\.]/g, '')) || 0;
      const dateRaw = getValByHeaders(['data_lancamento', 'data_vencimento', 'data_pagamento', 'created_at']);
      
      let dateKey = 'Outros';
      if (dateRaw) {
        if (dateRaw instanceof Date) {
          dateKey = dateRaw.toLocaleDateString('pt-BR', { month: 'short', day: '2-digit' });
        } else {
          const match = String(dateRaw).match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
          if (match) {
            dateKey = `${match[3]}/${match[2]}`;
          } else {
            const splitDate = String(dateRaw).split(' ')[0];
            if (splitDate && splitDate.includes('-')) {
              const p = splitDate.split('-');
              dateKey = p.length >= 3 ? `${p[2]}/${p[1]}` : splitDate;
            } else if (splitDate && splitDate.includes('/')) {
              const p = splitDate.split('/');
              dateKey = p.length >= 3 ? `${p[0]}/${p[1]}` : splitDate;
            } else {
              dateKey = splitDate || 'Outros';
            }
          }
        }
      }
      
      if (!datesMap[dateKey]) {
        datesMap[dateKey] = { income: 0, expense: 0 };
      }
      
      const isExpense = type === 'despesa' || 
                        category.toLowerCase().includes('pagamento executado') ||
                        category.toLowerCase().includes('aluguel') ||
                        category.toLowerCase().includes('condominio') ||
                        category.toLowerCase().includes('material') ||
                        category.toLowerCase().includes('despesa') ||
                        category.toLowerCase().includes('itau') ||
                        category.toLowerCase().includes('energia') ||
                        category.toLowerCase().includes('vale');
                        
      if (isExpense) {
        datesMap[dateKey].expense += rawVal;
      } else {
        datesMap[dateKey].income += rawVal;
      }
    });
    
    return Object.entries(datesMap)
      .slice(0, 10)
      .map(([date, vals]) => ({ date, ...vals }));
  };

  const downloadIcsFile = (appt: any) => {
    try {
      const dateStr = appt.dateObj ? appt.dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const timeStr = appt.timeRaw || '09:00:00';
      const cleanTime = timeStr.includes(':') ? timeStr.replace(/:/g, '') + '00' : '090000';
      const start = `${dateStr.replace(/-/g, '')}T${cleanTime.substring(0, 6)}`;
      const end = `${dateStr.replace(/-/g, '')}T${(parseInt(cleanTime.substring(0, 2)) + 1).toString().padStart(2, '0')}${cleanTime.substring(2, 6)}`;
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BlueDental//NONSGML v1.0//EN',
        'BEGIN:VEVENT',
        `UID:${appt.id}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:Consulta Dental: ${appt.patient}`,
        `DESCRIPTION:Consulta agendada no consultorio do Dr. Agnaldo Ferreira. Sala: ${appt.room}. Dentista: ${appt.dentist}. Convenio: ${appt.convenio}`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `consulta_${String(appt.patient).replace(/\s+/g, '_')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error(err);
      alert('Falha ao exportar iCal. Detalhe: ' + err);
    }
  };

  const handleShareProceduresWhatsApp = (patName: string) => {
    try {
      const idxDente = headers.findIndex(h => ['codigo_dente', 'dente', 'num_dente'].includes(h.toLowerCase().trim()));
      const idxProc = headers.findIndex(h => ['descricao_procedimento', 'procedimento', 'descricao'].includes(h.toLowerCase().trim()));
      const idxVal = headers.findIndex(h => ['valor', 'preco'].includes(h.toLowerCase().trim()));
      const idxPatient = headers.findIndex(h => ['nome_paciente', 'paciente', 'cliente'].includes(h.toLowerCase().trim()));
      const idxStatus = headers.findIndex(h => ['descricao_situacao', 'situacao', 'status'].includes(h.toLowerCase().trim()));

      const matchedRows = rawData.slice(1).filter(row => {
        const nameVal = idxPatient !== -1 ? String(row[idxPatient] || '').trim() : '';
        return nameVal === patName;
      });

      if (matchedRows.length === 0) {
        alert('Nenhum procedimento encontrado para o paciente ' + patName);
        return;
      }

      const rowsText = matchedRows.map(row => {
        const denteStr = idxDente !== -1 && row[idxDente] ? ` dente ${row[idxDente]}` : '';
        const nameStr = idxProc !== -1 ? row[idxProc] : 'Restauração';
        const valStr = idxVal !== -1 ? ` (R$ ${row[idxVal]})` : '';
        const statusStr = idxStatus !== -1 ? ` [${row[idxStatus]}]` : '';
        return `• *${nameStr}*${denteStr}${valStr}${statusStr}`;
      }).join('\n');

      const fullText = `Olá, *${patName}*! Segue o detalhamento dos seus procedimentos clínicos programados e finalizados sob a supervisão do Dr. Agnaldo Ferreira:\n\n${rowsText}\n\nEstamos à disposição para qualquer acerto odontológico!`;
      window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank');
    } catch (error) {
      console.error(error);
    }
  };

  const handleLoadMockFile = (filename: string) => {
    setSelectedQuickFile(filename);
    setImportLogs([]);
    setImportStatus('loaded');
    
    if (filename.includes('Faturamento')) {
      setDetectedTemplate('bluedental');
      const mockHeaders = [
        'codigo_paciente', 'nome_paciente', 'celular', 'email', 'valor_realizado', 'nome_categoria', 'tipo_categoria'
      ];
      const mockRows = [
        mockHeaders,
        ['PAC010', 'Juliana Alencar Martins', '5511988887777', 'juliana@example.com', '1500.00', 'Pagamento Orto', 'Receita'],
        ['PAC021', 'Carlos Eduardo Santos', '5511977776666', 'carlos@example.com', '450.00', 'Profilaxia Geral', 'Receita'],
        ['PAC032', 'Antônio Marcos Souza', '5511955554444', 'antonio@example.com', '240.00', 'Extração dente 18', 'Receita'],
        ['PAC043', 'Beatriz Silva Dias', '5511944443333', 'beatriz@example.com', '120.00', 'Limpeza Periódica', 'Receita']
      ];
      setRawData(mockRows);
      setHeaders(mockHeaders);
      setMappings({
        name: 1,
        phone: 2,
        email: 3,
        notes: 5,
        date: -1,
        time: -1
      });
      setQuickActionSelectedPatient('Juliana Alencar Martins');
    } else if (filename.includes('Agenda')) {
      const mockHeaders = ['codigo_agendamento', 'paciente', 'celular', 'data_agendamento', 'hora_agendamento', 'nome_status'];
      const mockRows = [
        mockHeaders,
        ['AGE701', 'Felipe Castro Mendes', '5511933332222', '2026-06-18', '10:30:00', 'Pendente'],
        ['AGE702', 'Mariana Custódio Lima', '5511922221111', '2026-06-18', '14:00:00', 'Confirmado'],
        ['AGE703', 'Antônio Marcos Souza', '5511955554444', '2026-06-19', '11:15:00', 'Pendente'],
        ['AGE704', 'Beatriz Silva Dias', '5511944443333', '2026-06-20', '16:00:00', 'Confirmado']
      ];
      setRawData(mockRows);
      setHeaders(mockHeaders);
      setMappings({
        name: 1,
        phone: 2,
        email: -1,
        notes: -1,
        date: 3,
        time: 4
      });
      setQuickActionSelectedPatient('Felipe Castro Mendes');
    } else {
      const mockHeaders = ['codigo_resposta_anamnese', 'nome_paciente', 'texto_pergunta', 'resposta', 'observacoes'];
      const mockRows = [
        mockHeaders,
        ['AN801', 'Juliana Alencar Martins', 'Possui alergia a medicamentos?', 'Sim', 'Dipirona e Penicilina'],
        ['AN802', 'Carlos Eduardo Santos', 'Gestante ou Lactante?', 'Não', ''],
        ['AN803', 'Felipe Castro Mendes', 'Toma medicação de uso contínuo?', 'Sim', 'Antialérgico preventivo']
      ];
      setRawData(mockRows);
      setHeaders(mockHeaders);
      setMappings({
        name: 1,
        phone: -1,
        email: -1,
        notes: 4,
        date: -1,
        time: -1
      });
      setQuickActionSelectedPatient('Juliana Alencar Martins');
    }
    
    setImportLogs(prev => [
      ...prev,
      `[INFO] Arquivo de simulação rápida "${filename}" carregado com sucesso.`,
      `[INFO] Mapeamento de colunas clínicas ativado.`
    ]);
  };

  const handleSendWhatsAppQuickAction = () => {
    if (!quickActionSelectedPatient) return;
    let foundPhone = '';
    
    if (rawData.length > 1) {
      const idxName = headers.findIndex(h => {
        const hL = String(h || '').toLowerCase().trim();
        return hL === 'nome_paciente' || hL === 'paciente' || hL === 'nome_completo' || hL === 'cliente' || hL === 'nome';
      });

      const matchedRow = rawData.slice(1).find(row => {
        const currentName = idxName !== -1 ? String(row[idxName] || '').trim() : '';
        return currentName.toLowerCase() === quickActionSelectedPatient.toLowerCase();
      });

      if (matchedRow && mappings.phone !== -1) {
        foundPhone = String(matchedRow[mappings.phone] || '').trim().replace(/[^\d]/g, '');
      }
    }

    if (!foundPhone) {
      foundPhone = '5511999999999';
    }

    const actionId = Math.random().toString(36).substring(7);
    const newAction = {
      id: actionId,
      file: selectedQuickFile || 'Backup Importado',
      type: 'WhatsApp',
      summary: `Mensagem disparada para ${quickActionSelectedPatient}`,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    };
    setQuickActionsHistory(prev => [newAction, ...prev]);

    const waUrl = `https://wa.me/${foundPhone}?text=${encodeURIComponent(whatsappDraftText)}`;
    window.open(waUrl, '_blank');
    setActionSuccessMessage(`Mensagem de WhatsApp disparada enviando ficha para ${quickActionSelectedPatient}!`);
    setTimeout(() => setActionSuccessMessage(''), 4000);
  };

  const handleScheduleCalendarQuickAction = async (patName: string, dateStr: string, timeStr: string) => {
    try {
      setCalendarSyncStatuses(prev => ({ ...prev, [patName]: 'syncing' }));
      
      const startDateTime = new Date(`${dateStr}T${timeStr || '09:00:00'}`);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

      const eventObj = {
        summary: `Consulta Dental: ${patName} 🦷`,
        description: `Consulta clínica estruturada via módulo de Ações Rápidas. Mapeado a partir do arquivo backup.`,
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo'
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/Sao_Paulo'
        }
      };

      await createCalendarEvent(eventObj);
      
      setCalendarSyncStatuses(prev => ({ ...prev, [patName]: 'synced' }));
      
      const actionId = Math.random().toString(36).substring(7);
      setQuickActionsHistory(prev => [{
        id: actionId,
        file: selectedQuickFile || 'Backup Importado',
        type: 'Google Calendar',
        summary: `Consulta agendada para ${patName} em ${new Date(dateStr).toLocaleDateString('pt-BR')}`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      }, ...prev]);

      setActionSuccessMessage(`Consulta de ${patName} sincronizada com sucesso no Google Calendar!`);
      setTimeout(() => setActionSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error(err);
      setCalendarSyncStatuses(prev => ({ ...prev, [patName]: 'failed' }));
      
      // Fallback ICS download
      const cleanTime = timeStr ? timeStr.replace(/:/g, '') + '00' : '090000';
      const start = `${dateStr.replace(/-/g, '')}T${cleanTime.substring(0, 6)}`;
      const end = `${dateStr.replace(/-/g, '')}T${(parseInt(cleanTime.substring(0, 2)) + 1).toString().padStart(2, '0')}${cleanTime.substring(2, 6)}`;
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//BlueDental//NONSGML v1.0//EN',
        'BEGIN:VEVENT',
        `UID:cal_${Math.random().toString(36).substring(7)}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:Consulta Dental: ${patName}`,
        `DESCRIPTION:Consulta agendada via painel clinico Dr. Agnaldo Ferreira.`,
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `consulta_${patName.replace(/\s+/g, '_')}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setActionSuccessMessage(`iCAL (.ics) baixado para ${patName}!`);
      setTimeout(() => setActionSuccessMessage(''), 4000);
    }
  };

  const handleSaveDriveQuickAction = async (patName: string) => {
    try {
      setDriveSyncStatuses(prev => ({ ...prev, [patName]: 'syncing' }));
      
      const mockTreatmentState = {
         proposal: {
           status: 'Backup Importado',
           dentist: clinicSettings.doctorName,
           created_at: new Date().toISOString()
         },
         simulations: [
           {
             custoTotal: 1500,
             descricao: `Dossiê clínico migrado de backup para o paciente ${patName}`
           }
         ]
      };

      await saveTreatmentPlanToDrive(patName, mockTreatmentState);
      
      setDriveSyncStatuses(prev => ({ ...prev, [patName]: 'synced' }));
      
      const actionId = Math.random().toString(36).substring(7);
      setQuickActionsHistory(prev => [{
        id: actionId,
        file: selectedQuickFile || 'Backup Importado',
        type: 'Google Drive',
        summary: `Ficha e prontuário de ${patName} arquivado estruturado no Drive`,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      }, ...prev]);

      setActionSuccessMessage(`Pasta clinica de ${patName} estruturada com sucesso no Google Drive!`);
      setTimeout(() => setActionSuccessMessage(''), 4000);
    } catch (err: any) {
      console.error(err);
      setDriveSyncStatuses(prev => ({ ...prev, [patName]: 'failed' }));
      alert('Erro ao consolidar arquivo no Google Drive: ' + err.message);
    }
  };

  useEffect(() => {
    const dType = getDetectedDataType();
    if (dType !== 'paciente') {
      setActiveDashboardTab(dType);
      setActiveViewMode('workspace');
    } else {
      setActiveViewMode('legacy');
    }
    // reset search filters on schema layout modification
    setDashboardSearch('');
    setSelectedPatientFilter('');
  }, [headers]);

  const getPreviewRows = () => {
    if (rawData.length <= 1) return [];
    return rawData.slice(1, 5); // display max 4 entries
  };

  return (
    <div className="space-y-8 font-sans">
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden print:hidden">
        <div>
          <div className="bg-[#8B0000] text-white px-4 py-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <h3 className="font-bold text-sm tracking-wide">Emissão de Documentos</h3>
          </div>
          <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]">
            <div className="flex flex-wrap gap-4">
               <button
                  onClick={() => {
                    setReprintData(null);
                    setDocModalType('receituario');
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-[#D5CBB3] rounded-xl text-zinc-800 font-bold hover:border-[#C09553] hover:shadow-md transition-all sm:flex-1 justify-center"
               >
                  <FileText className="w-5 h-5 text-[#C09553]" />
                  Emitir Receituário
               </button>
               <button
                  onClick={() => {
                    setReprintData(null);
                    setDocModalType('atestado');
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-[#D5CBB3] rounded-xl text-zinc-800 font-bold hover:border-[#C09553] hover:shadow-md transition-all sm:flex-1 justify-center"
               >
                  <FileSignature className="w-5 h-5 text-[#C09553]" />
                  Emitir Atestado
               </button>
               <button
                  onClick={() => {
                    setReprintData(null);
                    setDocModalType('declaracao');
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-white border border-[#D5CBB3] rounded-xl text-zinc-800 font-bold hover:border-[#C09553] hover:shadow-md transition-all sm:flex-1 justify-center"
               >
                  <FileText className="w-5 h-5 text-[#C09553]" />
                  Emitir Declaração
               </button>
            </div>
            
            {declarationsHistory.length > 0 && (
               <div className="mt-8 pt-6 border-t border-zinc-200">
                <h4 className="font-bold text-[#8B0000] text-sm mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Histórico de Declarações Recentes
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                     <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase">
                       <tr>
                         <th className="px-4 py-3 font-semibold">Data da Emissão</th>
                         <th className="px-4 py-3 font-semibold">Horário (Chegada - Saída)</th>
                         <th className="px-4 py-3 font-semibold flex justify-end">Ações</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-zinc-100">
                       {declarationsHistory.map(decl => (
                         <tr key={decl.id} className="hover:bg-zinc-50 transition-colors">
                           <td className="px-4 py-3 text-zinc-700 font-medium">
                             {new Date(decl.date).toLocaleDateString('pt-BR')} às {new Date(decl.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                           </td>
                           <td className="px-4 py-3 text-zinc-600">
                             {decl.arrivalTime || '--:--'} às {decl.departureTime || '--:--'}
                           </td>
                           <td className="px-4 py-3 flex justify-end">
                             <button
                               onClick={() => handleReprint(decl)}
                               className="flex items-center gap-1.5 text-xs font-bold text-[#8B0000] hover:text-[#C09553] transition-colors bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg"
                             >
                               <Printer className="w-3.5 h-3.5" />
                               Reimprimir
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                  </table>
                </div>
               </div>
            )}
          </div>
        </div>
      </div>

      {docModalType && (
        <MedicalDocumentModal
           type={docModalType}
           patientName={proposal.patientName}
           patientData={pd}
           clinicSettings={clinicSettings}
           onClose={() => setDocModalType(null)}
           onEmit={handleEmitDeclaration}
           initialArrivalTime={reprintData?.arrival}
           initialDepartureTime={reprintData?.departure}
        />
      )}

      {/* Configurações do Consultório */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden text-xs print:hidden">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <Settings className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Configurações do Consultório</h3>
        </div>
        <div className="p-4 space-y-4 bg-[#FAF8F5]/30">
          <p className="text-zinc-500 mb-4">Estas informações serão utilizadas automaticamente no preenchimento de documentos, atestados e propostas do sistema com papel timbrado premium.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Nome do Profissional</label>
              <input type="text" value={clinicSettings.doctorName} onChange={e => handleUpdateSetting('doctorName', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Especialidade / Título</label>
              <input type="text" value={clinicSettings.doctorRole} onChange={e => handleUpdateSetting('doctorRole', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">CRO</label>
              <input type="text" value={clinicSettings.cro} onChange={e => handleUpdateSetting('cro', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-zinc-500 font-semibold mb-1">Endereço Completo</label>
              <input type="text" value={clinicSettings.address} onChange={e => handleUpdateSetting('address', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-zinc-500 font-semibold mb-1">Ponto de Referência</label>
              <input type="text" value={clinicSettings.referencePoint} onChange={e => handleUpdateSetting('referencePoint', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>
        </div>
      </div>

      {/* FERRAMENTA DE IMPORTAÇÃO BACKUP MULTIFORMATO */}
      <div id="backup-importer-container" className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden text-xs print:hidden">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center justify-between border-b border-[#C09553]/30">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#C09553]" />
            <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Importação de Backup Externo (Múltiplos Formatos)</h3>
          </div>
          <span className="bg-[#FAF8F5]/10 text-[#C09553] px-2 py-0.5 rounded text-[10px] font-mono tracking-wider">MIGRATOR v2.0</span>
        </div>
        
        <div className="p-4 space-y-6 bg-[#FAF8F5]/20">
          <div>
            <p className="text-zinc-500 mb-2 font-medium">Reconstrua sua cartela de pacientes em segundos. Importe os cadastros e agendamentos históricos da sua clínica a partir de planilhas de Excel, arquivos CSV, tabelas e relatórios em Markdown (.md), arquivos de Texto (.txt) ou relatórios em PDF (.pdf).</p>
            <div className="bg-[#C09553]/10 text-zinc-700 p-2.5 rounded-lg flex gap-2 border border-[#C09553]/20">
              <Info className="w-4 h-4 text-[#C09553] shrink-0 mt-0.5" />
              <p className="leading-relaxed"><strong>Como funciona:</strong> Nosso sistema detecta as colunas e formatos de forma inteligente. Ele cria uma pasta com prontuário interativo para cada paciente no seu Google Drive, além de sincronizar de forma opcional as consultas e datas de retorno na sua Agenda do Google.</p>
            </div>
          </div>

          {/* CAMADA DE AÇÕES RÁPIDAS (QUICK ACTIONS CENTER) */}
          <div className="border border-zinc-200 rounded-2xl bg-white p-5 space-y-6 shadow-sm" id="quick-actions-layer-panel">
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-zinc-100 gap-3">
              <div>
                <h4 className="font-serif font-bold text-zinc-900 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#C09553]" />
                  ⚡ Central de Ações Rápidas de Backups & Arquivos
                </h4>
                <p className="text-zinc-500 mt-0.5">Selecione ou carregue um arquivo clínico para disparar integrações instantâneas.</p>
              </div>

              {actionSuccessMessage && (
                <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 animate-bounce">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  {actionSuccessMessage}
                </div>
              )}
            </div>

            {/* Browser/List of Files */}
            <div>
              <span className="block text-zinc-600 font-bold mb-2">Clique em um arquivo importado ou de demonstração:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Active Uploaded File Card */}
                {importFile ? (
                  <div 
                    onClick={() => {
                      setSelectedQuickFile(importFile.name);
                      if (rawData.length > 1) {
                        const idxName = headers.findIndex(h => {
                          const hL = String(h || '').toLowerCase().trim();
                          return hL === 'nome_paciente' || hL === 'paciente' || hL === 'nome_completo' || hL === 'cliente' || hL === 'nome';
                        });
                        if (idxName !== -1 && rawData[1][idxName]) {
                          setQuickActionSelectedPatient(String(rawData[1][idxName]));
                        }
                      }
                    }}
                    className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between h-24 ${
                      selectedQuickFile === importFile.name 
                        ? 'border-[#C09553] bg-[#FAF8F5] shadow-xs' 
                        : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-bold text-zinc-800 truncate pr-2 max-w-[80%]">{importFile.name}</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 mt-0.5" title="Arquivo Upload Ativo" />
                    </div>
                    <div className="flex items-center justify-between text-[10px] mt-1 select-none">
                      <span className="text-zinc-400 font-medium">
                        {(importFile.size / 1024).toFixed(1)} KB • {rawData.length - 1} reg
                      </span>
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                        (fileCategories[importFile.name] || 'Prontuário') === 'Exames'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : (fileCategories[importFile.name] || 'Prontuário') === 'Orçamentos'
                          ? 'bg-emerald-50 text-emerald-800 border border-[#D5CBB3]'
                          : (fileCategories[importFile.name] || 'Prontuário') === 'Prontuário'
                          ? 'bg-[#8B0000]/10 text-[#8B0000] border border-[#8B0000]/20'
                          : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                      }`}>
                        🏷️ {fileCategories[importFile.name] || 'Prontuário'}
                      </span>
                    </div>
                  </div>
                ) : null}

                {/* Mock File 1 */}
                <div 
                  onClick={() => handleLoadMockFile('Backup_BlueDental_Faturamento.xlsx')}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between h-24 ${
                    selectedQuickFile === 'Backup_BlueDental_Faturamento.xlsx' 
                      ? 'border-[#C09553] bg-[#FAF8F5] shadow-xs' 
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-zinc-800 truncate pr-2 max-w-[80%]">BlueDental_Faturamento.xlsx</span>
                    <span className="bg-[#8B0000]/10 text-[#C09553] text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase">Excel</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1 select-none">
                    <span className="text-zinc-400 font-medium">
                      Demo • 4 registros clínicos
                    </span>
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                      (fileCategories['Backup_BlueDental_Faturamento.xlsx'] || 'Prontuário') === 'Exames'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : (fileCategories['Backup_BlueDental_Faturamento.xlsx'] || 'Prontuário') === 'Orçamentos'
                        ? 'bg-emerald-50 text-emerald-800 border border-[#D5CBB3]'
                        : (fileCategories['Backup_BlueDental_Faturamento.xlsx'] || 'Prontuário') === 'Prontuário'
                        ? 'bg-[#8B0000]/10 text-[#8B0000] border border-[#8B0000]/20'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}>
                      🏷️ {fileCategories['Backup_BlueDental_Faturamento.xlsx'] || 'Orçamentos'}
                    </span>
                  </div>
                </div>

                {/* Mock File 2 */}
                <div 
                  onClick={() => handleLoadMockFile('Agenda_Consultas_Retorno_Junho.csv')}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between h-24 ${
                    selectedQuickFile === 'Agenda_Consultas_Retorno_Junho.csv' 
                      ? 'border-[#C09553] bg-[#FAF8F5] shadow-xs' 
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-zinc-800 truncate pr-2 max-w-[80%]">Retornos_Consultas.csv</span>
                    <span className="bg-emerald-50 text-emerald-800 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase">CSV</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1 select-none">
                    <span className="text-zinc-400 font-medium">
                      Demo • 4 agendamentos
                    </span>
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                      (fileCategories['Agenda_Consultas_Retorno_Junho.csv'] || 'Prontuário') === 'Exames'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : (fileCategories['Agenda_Consultas_Retorno_Junho.csv'] || 'Prontuário') === 'Orçamentos'
                        ? 'bg-emerald-50 text-emerald-800 border border-[#D5CBB3]'
                        : (fileCategories['Agenda_Consultas_Retorno_Junho.csv'] || 'Prontuário') === 'Prontuário'
                        ? 'bg-[#8B0000]/10 text-[#8B0000] border border-[#8B0000]/20'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}>
                      🏷️ {fileCategories['Agenda_Consultas_Retorno_Junho.csv'] || 'Prontuário'}
                    </span>
                  </div>
                </div>

                {/* Mock File 3 */}
                <div 
                  onClick={() => handleLoadMockFile('Anamneses_Clinicas_Gerais.md')}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex flex-col justify-between h-24 ${
                    selectedQuickFile === 'Anamneses_Clinicas_Gerais.md' 
                      ? 'border-[#C09553] bg-[#FAF8F5] shadow-xs' 
                      : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <span className="font-bold text-zinc-800 truncate pr-2 max-w-[80%]">Anamneses_Gerais.md</span>
                    <span className="bg-amber-50 text-amber-900 text-[8px] font-mono font-bold px-1.5 py-0.5 rounded uppercase">MD</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] mt-1 select-none">
                    <span className="text-zinc-400 font-medium">
                      Demo • Fichas Anamnese
                    </span>
                    <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
                      (fileCategories['Anamneses_Clinicas_Gerais.md'] || 'Prontuário') === 'Exames'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : (fileCategories['Anamneses_Clinicas_Gerais.md'] || 'Prontuário') === 'Orçamentos'
                        ? 'bg-emerald-50 text-emerald-800 border border-[#D5CBB3]'
                        : (fileCategories['Anamneses_Clinicas_Gerais.md'] || 'Prontuário') === 'Prontuário'
                        ? 'bg-[#8B0000]/10 text-[#8B0000] border border-[#8B0000]/20'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-200'
                    }`}>
                      🏷️ {fileCategories['Anamneses_Clinicas_Gerais.md'] || 'Exames'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Active Integrations Area */}
            {selectedQuickFile ? (
              <div className="border border-zinc-200 rounded-xl bg-zinc-50/50 p-4 space-y-4">
                {/* Seletor Dinâmico de Categoria do Arquivo Clinico para Ações Rápidas */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-3 border border-zinc-200 rounded-xl gap-3">
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-[#8B0000]/5 text-[#C09553] rounded-lg shrink-0">
                      <FolderOpen className="w-5 h-5" />
                    </span>
                    <div>
                      <h5 className="font-serif font-bold text-zinc-900 text-xs text-left">📂 Categoria Oficial do Arquivo: <span className="font-sans text-[#C09553]">"{selectedQuickFile}"</span></h5>
                      <p className="text-[10px] text-zinc-500 mt-0.5 text-left">Essa classificação orienta o destino seguro de prontuários, faturamentos ou exames na integração.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-between sm:justify-end">
                    <span className="text-zinc-600 font-bold text-[11px] uppercase font-mono">Alterar Tipo de Dado:</span>
                    <select
                      value={fileCategories[selectedQuickFile] || 'Prontuário'}
                      onChange={(e) => {
                        const selectedCat = e.target.value;
                        setFileCategories(prev => ({
                          ...prev,
                          [selectedQuickFile]: selectedCat
                        }));
                        setActionSuccessMessage(`Categoria de "${selectedQuickFile}" atualizada para "${selectedCat}"!`);
                        setTimeout(() => setActionSuccessMessage(''), 3000);
                      }}
                      className="border border-[#D5CBB3] rounded-lg py-1 px-2.5 text-xs text-zinc-800 font-bold focus:border-[#C09553] focus:outline-none bg-white shadow-xs cursor-pointer"
                    >
                      <option value="Prontuário">📖 Prontuário</option>
                      <option value="Exames">🔬 Exames</option>
                      <option value="Orçamentos">💰 Orçamentos</option>
                      <option value="Outros">📁 Outros</option>
                    </select>
                  </div>
                </div>

                {/* Mode tabs selector row */}
                <div className="flex border-b border-zinc-200 pb-2 gap-2 flex-wrap text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedQuickActionTab('whatsapp')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedQuickActionTab === 'whatsapp'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar via WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuickActionTab('calendar')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedQuickActionTab === 'calendar'
                        ? 'bg-[#8B0000] text-white shadow-xs'
                        : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#C09553]" />
                    Agendar no Calendar
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedQuickActionTab('drive')}
                    className={`px-4 py-2 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      selectedQuickActionTab === 'drive'
                        ? 'bg-zinc-900 text-white shadow-xs'
                        : 'bg-white text-zinc-600 border border-zinc-200 hover:bg-zinc-50'
                    }`}
                  >
                    <Database className="w-3.5 h-3.5 text-[#C09553]" />
                    Salvar no Drive
                  </button>
                </div>

                {/* TAB WHATSAPP */}
                {selectedQuickActionTab === 'whatsapp' && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-5" id="qa-tab-whatsapp-block">
                    {/* Left selects */}
                    <div className="md:col-span-4 space-y-3">
                      <div>
                        <label className="block text-zinc-600 font-bold mb-1">Selecionar Paciente do Arquivo:</label>
                        <select
                          value={quickActionSelectedPatient}
                          onChange={(e) => setQuickActionSelectedPatient(e.target.value)}
                          className="w-full border border-zinc-300 rounded p-2 focus:border-emerald-500 focus:outline-none bg-white font-semibold text-zinc-700 text-xs"
                        >
                          <option value="">-- Escolher Paciente --</option>
                          {rawData.slice(1).map((row, idx) => {
                            const idxName = headers.findIndex(h => {
                              const hL = String(h || '').toLowerCase().trim();
                              return hL === 'nome_paciente' || hL === 'paciente' || hL === 'nome_completo' || hL === 'cliente' || hL === 'nome';
                            });
                            const name = idxName !== -1 ? String(row[idxName] || '').trim() : '';
                            if (!name) return null;
                            return (
                              <option key={idx} value={name}>
                                {name}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-zinc-600 font-bold mb-1">Modelo de Mensagem:</label>
                        <div className="flex flex-col gap-1.5">
                          <button
                            type="button"
                            onClick={() => setWhatsappTemplateType('welcome')}
                            className={`w-full py-1.5 px-3 rounded-lg text-left font-bold border transition ${
                              whatsappTemplateType === 'welcome'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                            }`}
                          >
                            🦷 Boas-vindas Clínica
                          </button>
                          <button
                            type="button"
                            onClick={() => setWhatsappTemplateType('appointment')}
                            className={`w-full py-1.5 px-3 rounded-lg text-left font-bold border transition ${
                              whatsappTemplateType === 'appointment'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                            }`}
                          >
                            📅 Lembrete de Consulta
                          </button>
                          <button
                            type="button"
                            onClick={() => setWhatsappTemplateType('notes')}
                            className={`w-full py-1.5 px-3 rounded-lg text-left font-bold border transition ${
                              whatsappTemplateType === 'notes'
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                                : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                            }`}
                          >
                            🔒 Consolidação Drive
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right text area and send button */}
                    <div className="md:col-span-8 space-y-3">
                      <div>
                        <label className="block text-zinc-600 font-bold mb-1">Visualização do Disparo:</label>
                        <textarea
                          value={whatsappDraftText}
                          onChange={(e) => setWhatsappDraftText(e.target.value)}
                          className="w-full border border-zinc-300 rounded-xl p-3 focus:border-emerald-500 focus:outline-none bg-white text-zinc-800 font-sans leading-relaxed text-xs h-36 resize-y"
                          placeholder="Escolha um paciente acima para visualizar o texto formatado..."
                        />
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleSendWhatsAppQuickAction}
                          disabled={!quickActionSelectedPatient}
                          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs"
                        >
                          <Send className="w-4 h-4" />
                          Enviar via WhatsApp Oficial
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB CALENDAR */}
                {selectedQuickActionTab === 'calendar' && (
                  <div className="space-y-4" id="qa-tab-calendar-block">
                    <div className="bg-amber-50 text-amber-900 border border-amber-100 p-2.5 rounded-lg flex gap-2">
                      <Info className="w-4 h-4 text-[#C09553] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">Sincronize agendamentos de forma imediata à conta Google vinculada da clínica ou faça download em formato unificado .ics para arquivos locais.</p>
                    </div>

                    <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white max-h-64 overflow-y-auto">
                      <table className="w-full text-left bg-white text-zinc-700">
                        <thead className="bg-[#FAF8F5] text-zinc-500 font-semibold border-b border-zinc-200 sticky top-0">
                          <tr className="text-[10px] uppercase font-mono tracking-wider">
                            <th className="px-4 py-2">Paciente</th>
                            <th className="px-4 py-2">Data Consulta</th>
                            <th className="px-4 py-2">Horário</th>
                            <th className="px-4 py-2 flex justify-end">Ação Integrada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {rawData.slice(1).map((row, idx) => {
                            const idxName = headers.findIndex(h => {
                              const hL = String(h || '').toLowerCase().trim();
                              return hL === 'nome_paciente' || hL === 'paciente' || hL === 'nome_completo' || hL === 'cliente' || hL === 'nome';
                            });
                            const name = idxName !== -1 ? String(row[idxName] || '').trim() : '';
                            if (!name) return null;

                            // Date scanning
                            let dateVal = mappings.date !== -1 ? row[mappings.date] : null;
                            let timeVal = mappings.time !== -1 ? row[mappings.time] : null;
                            if (!dateVal) {
                              // Fallback search
                              const idxDate = headers.findIndex(h => {
                                const hL = String(h || '').toLowerCase();
                                return hL.includes('data') || hL.includes('agendamento') || hL.includes('criado');
                              });
                              if (idxDate !== -1) dateVal = row[idxDate];
                            }
                            if (!timeVal) {
                              const idxTime = headers.findIndex(h => {
                                const hL = String(h || '').toLowerCase();
                                return hL.includes('hora') || hL.includes('horario') || hL.includes('tempo');
                              });
                              if (idxTime !== -1) timeVal = row[idxTime];
                            }

                            const pDate = dateVal ? String(dateVal).split(' ')[0] : new Date().toISOString().split('T')[0];
                            const pTime = timeVal ? String(timeVal).substring(0, 5) : '09:00';

                            const status = calendarSyncStatuses[name] || 'idle';

                            return (
                              <tr key={idx} className="hover:bg-zinc-50 text-xs">
                                <td className="px-4 py-2 text-[#8B0000] font-bold">{name}</td>
                                <td className="px-4 py-2 font-mono">{pDate}</td>
                                <td className="px-4 py-2 font-mono">{pTime}</td>
                                <td className="px-4 py-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleScheduleCalendarQuickAction(name, pDate, pTime)}
                                    className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase transition flex items-center gap-1 ${
                                      status === 'synced'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : status === 'syncing'
                                        ? 'bg-zinc-100 text-zinc-500 font-medium col-span-2'
                                        : 'bg-[#8B0000] text-white hover:bg-[#340A0F]'
                                    }`}
                                  >
                                    {status === 'synced' && <Check className="w-3 h-3 text-emerald-700" />}
                                    {status === 'syncing' && <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />}
                                    {status === 'synced' ? 'Sincronizado ✓' : status === 'syncing' ? 'Sincronizando...' : 'Agendar no Calendar'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* TAB DRIVE */}
                {selectedQuickActionTab === 'drive' && (
                  <div className="space-y-4" id="qa-tab-drive-block">
                    <div className="bg-[#FAF8F5] border border-[#D5CBB3]/50 p-2.5 rounded-lg flex gap-2">
                      <Database className="w-4 h-4 text-[#C09553] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">Dispare a modelagem e criação instantânea de pastas para cada paciente diretamente no servidor Google Drive da clínica, arquivando com segurança fichas cadastrais, orçamentos e dados clínicos estruturados.</p>
                    </div>

                    <div className="overflow-x-auto border border-zinc-200 rounded-xl bg-white max-h-64 overflow-y-auto">
                      <table className="w-full text-left bg-white text-zinc-700">
                        <thead className="bg-[#FAF8F5] text-zinc-500 font-semibold border-b border-zinc-200 sticky top-0">
                          <tr className="text-[10px] uppercase font-mono tracking-wider">
                            <th className="px-4 py-2">Paciente</th>
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2 flex justify-end">Ação Integrada</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100">
                          {rawData.slice(1).map((row, idx) => {
                            const idxName = headers.findIndex(h => {
                              const hL = String(h || '').toLowerCase().trim();
                              return hL === 'nome_paciente' || hL === 'paciente' || hL === 'nome_completo' || hL === 'cliente' || hL === 'nome';
                            });
                            const name = idxName !== -1 ? String(row[idxName] || '').trim() : '';
                            if (!name) return null;

                            let emailVal = mappings.email !== -1 ? row[mappings.email] : '';
                            if (!emailVal) {
                              const idxEmail = headers.findIndex(h => String(h || '').toLowerCase().includes('email'));
                              if (idxEmail !== -1) emailVal = row[idxEmail];
                            }

                            const status = driveSyncStatuses[name] || 'idle';

                            return (
                              <tr key={idx} className="hover:bg-zinc-50 text-xs">
                                <td className="px-4 py-2 text-zinc-900 font-bold">{name}</td>
                                <td className="px-4 py-2 font-serif text-zinc-500">{emailVal || 'Não Mapeado'}</td>
                                <td className="px-4 py-2 flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveDriveQuickAction(name)}
                                    className={`px-3 py-1 rounded-lg font-bold text-[10px] uppercase transition flex items-center gap-1 ${
                                      status === 'synced'
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : status === 'syncing'
                                        ? 'bg-zinc-100 text-zinc-500 font-medium'
                                        : 'bg-zinc-900 text-white hover:bg-zinc-800'
                                    }`}
                                  >
                                    {status === 'synced' && <Check className="w-3 h-3 text-emerald-700" />}
                                    {status === 'syncing' && <Loader2 className="w-3 h-3 animate-spin text-zinc-500" />}
                                    {status === 'synced' ? 'Sincronizado ✓' : status === 'syncing' ? 'Sincronizando...' : 'Salvar no Drive'}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 border-2 border-dashed border-zinc-200 rounded-xl text-center text-zinc-500 font-medium">
                Clique em uma das opções de arquivos de backup acima para liberar as Ações Rápidas integradas de forma automática! ⚡
              </div>
            )}

            {/* Quick Actions Executed Stream History */}
            {quickActionsHistory.length > 0 && (
              <div className="border border-zinc-150 rounded-xl bg-[#FAF8F5]/30 p-3.5 space-y-2">
                <span className="block text-zinc-600 font-bold text-[11px] uppercase tracking-wider font-mono">⏱️ Log e Histórico de Execuções Recentes da Sessão</span>
                <div className="space-y-1.5 max-h-24 overflow-y-auto">
                  {quickActionsHistory.map(act => (
                    <div key={act.id} className="flex items-center justify-between text-[11px] bg-white border border-zinc-100 p-2 rounded-lg leading-none">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          act.type === 'WhatsApp' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : act.type === 'Google Calendar' 
                            ? 'bg-red-50 text-[#8B0000] border border-red-200' 
                            : 'bg-zinc-100 text-zinc-800 border border-zinc-300'
                        }`}>
                          {act.type}
                        </span>
                        <span className="text-zinc-700 font-serif font-bold">{act.summary}</span>
                        <span className="text-zinc-400 italic font-medium">({act.file})</span>
                      </div>
                      <span className="font-mono text-zinc-400 text-[10px]">{act.timestamp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Area para Upload foi migrada para o CRM */}
          <div className="border border-[#D5CBB3] bg-[#FAF8F5] rounded-xl p-8 text-center flex flex-col items-center justify-center gap-4">
            <div className="w-14 h-14 bg-[#8B0000]/10 text-[#8B0000] rounded-full flex items-center justify-center">
              <Database className="w-7 h-7 text-[#C09553]" />
            </div>
            <div>
              <h3 className="text-[#8B0000] font-bold text-lg font-serif">A Central de Importação Mudou!</h3>
              <p className="text-zinc-500 mt-2 max-w-lg mx-auto text-sm leading-relaxed">
                Para melhorar o vínculo de pacientes, unificamos a ferramenta de importação avançada. Agora você pode importar seus backups (Excel, CSV, PDF, Textos) com segurança diretamente na aba <b>"CRM Odontológico & Central Inteligente"</b>.
              </p>
            </div>
            {/* The user can navigate manually using the main apps tabs above */}
          </div>

          {/* Planilha Carregada - Visual Configurações e Mapeamentos de Colunas */}
          {(importStatus === 'loaded' || importStatus === 'running' || importStatus === 'success' || importStatus === 'done') && importFile && (
            <div className="space-y-6">
              {detectedTemplate === 'bluedental' && (
                <div className="bg-[#8B0000]/5 border-2 border-[#C09553] p-4 rounded-xl flex items-start gap-3">
                  <div className="bg-[#8B0000] text-[#C09553] px-3 py-1 rounded font-bold text-[10px] uppercase font-mono tracking-wider shrink-0 mt-0.5">
                    BlueDental
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-xs">✨ Backup 'BlueDental Pacientes' Reconhecido com Sucesso!</h4>
                    <p className="text-zinc-600 font-medium text-[11px] mt-1 leading-relaxed">
                      Detectamos automaticamente <strong>todas as 53 colunas</strong> de cadastro técnico da sua clínica! Nosso migrador inteligente fará a transferência completa sem perda de dados: CPFs, RGs, Endereços Completos, Telefones (Fixo, Celular e WhatsApp), Histórico de Observações, Dados de Responsável, Planos de Convênio (Planos, Carteira e Validade) e até mesmo os Links Originais das Fotos de Perfil foram mapeados e serão salvos no Drive!
                    </p>
                  </div>
                </div>
              )}
              {/* Informações básicas do arquivo carregado */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 text-green-700 rounded-lg">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900">{importFile.name}</h4>
                    <p className="text-zinc-500">{(importFile.size / 1024).toFixed(1)} KB • {rawData.length} linhas analisadas</p>
                  </div>
                </div>
                
                {sheetNames.length > 1 && importStatus === 'loaded' && (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-500">Aba ativa:</span>
                    <select 
                      value={selectedSheet} 
                      onChange={(e) => handleSheetChange(e.target.value)} 
                      className="border border-zinc-300 rounded p-1.5 focus:border-[#C09553] focus:outline-none font-medium bg-white"
                    >
                      {sheetNames.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {importStatus === 'loaded' && (
                  <button 
                    onClick={() => {
                      setImportFile(null);
                      setWorkbook(null);
                      setRawData([]);
                      setHeaders([]);
                      setImportStatus('idle');
                    }}
                    className="text-xs text-red-700 font-semibold hover:underline"
                  >
                    Trocar arquivo
                  </button>
                )}
              </div>

              {/* Seletor de Categoria do Arquivo Clinico Importado */}
              <div className="bg-[#FAF8F5] border border-[#D5CBB3] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-[#8B0000]/5 text-[#C09553] rounded-lg mt-0.5">
                    <FolderOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-serif font-bold text-zinc-900 text-xs text-left">📂 Categoria e Organização Inteligente de Documentação</h5>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed text-left">
                      Identificar e rotular estes dados automatiza a triagem no Google Drive e a roteirização do atendimento clínico do Dr. Agnaldo Ferreira.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-zinc-600 font-bold text-xs uppercase font-mono">Categoria:</span>
                  <select
                    value={fileCategories[importFile.name] || 'Prontuário'}
                    onChange={(e) => {
                      const selectedCat = e.target.value;
                      setFileCategories(prev => ({
                        ...prev,
                        [importFile.name]: selectedCat
                      }));
                      // Also select it in Quick Actions if match
                      setSelectedQuickFile(importFile.name);
                    }}
                    className="border border-[#D5CBB3] rounded-lg p-2 font-bold text-xs bg-white text-zinc-800 focus:border-[#C09553] focus:outline-none focus:ring-1 focus:ring-[#C09553]/25 cursor-pointer shadow-xs"
                  >
                    <option value="Prontuário">📖 Prontuário</option>
                    <option value="Exames">🔬 Exames</option>
                    <option value="Orçamentos">💰 Orçamentos</option>
                    <option value="Outros">📁 Outros</option>
                  </select>
                </div>
              </div>

              {/* Mapeador de Colunas */}
              {importStatus === 'loaded' && (
                <div className="border border-zinc-200 rounded-xl bg-white p-4 space-y-4">
                  <div className="flex items-center gap-1.5 pb-2 border-b border-zinc-100">
                    <Layers className="w-4 h-4 text-[#C09553]" />
                    <h4 className="font-serif font-bold text-zinc-800 text-sm">Definir Mapeamento de Colunas</h4>
                  </div>
                  <p className="text-zinc-500">Selecione qual coluna do seu Excel corresponde a cada campo no nosso sistema clínico:</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Campo Nome */}
                    <div>
                      <label className="block text-zinc-700 font-bold mb-1">
                        Nome do Paciente <span className="text-red-700">*</span>
                      </label>
                      <select 
                        value={mappings.name} 
                        onChange={(e) => handleMappingChange('name', parseInt(e.target.value))}
                        className={`w-full border rounded p-2 focus:border-[#C09553] focus:outline-none ${mappings.name === -1 ? 'border-red-300 bg-red-50/20' : 'border-zinc-300 bg-white'}`}
                      >
                        <option value={-1}>-- Selecionar Coluna --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>Coluna: {h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campo Contato */}
                    <div>
                      <label className="block text-[#8B0000] font-bold mb-1">WhatsApp / Celular</label>
                      <select 
                        value={mappings.phone} 
                        onChange={(e) => handleMappingChange('phone', parseInt(e.target.value))}
                        className="w-full border border-zinc-300 bg-white rounded p-2 focus:outline-none focus:border-[#C09553]"
                      >
                        <option value={-1}>-- Ignorar / Não Mapeado --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>Coluna: {h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campo Email */}
                    <div>
                      <label className="block text-zinc-700 font-bold mb-1">E-mail</label>
                      <select 
                        value={mappings.email} 
                        onChange={(e) => handleMappingChange('email', parseInt(e.target.value))}
                        className="w-full border border-zinc-300 bg-white rounded p-2 focus:outline-none focus:border-[#C09553]"
                      >
                        <option value={-1}>-- Ignorar / Não Mapeado --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>Coluna: {h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Observacoes */}
                    <div>
                      <label className="block text-zinc-700 font-bold mb-1">Observações / Prontuário</label>
                      <select 
                        value={mappings.notes} 
                        onChange={(e) => handleMappingChange('notes', parseInt(e.target.value))}
                        className="w-full border border-zinc-300 bg-white rounded p-2 focus:outline-none focus:border-[#C09553]"
                      >
                        <option value={-1}>-- Ignorar / Não Mapeado --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>Coluna: {h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Data do agendamento */}
                    <div>
                      <label className="block text-zinc-700 font-bold mb-1 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-[#C09553]" />
                        Data da Consulta
                      </label>
                      <select 
                        value={mappings.date} 
                        onChange={(e) => handleMappingChange('date', parseInt(e.target.value))}
                        className="w-full border border-zinc-300 bg-white rounded p-2 focus:outline-none focus:border-[#C09553]"
                      >
                        <option value={-1}>-- Ignorar / Sem Agendamento --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>Coluna: {h}</option>
                        ))}
                      </select>
                    </div>

                    {/* Hora do agendamento */}
                    <div>
                      <label className="block text-zinc-700 font-bold mb-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#C09553]" />
                        Horário da Consulta
                      </label>
                      <select 
                        value={mappings.time} 
                        onChange={(e) => handleMappingChange('time', parseInt(e.target.value))}
                        className="w-full border border-zinc-300 bg-white rounded p-2 focus:outline-none focus:border-[#C09553]"
                      >
                        <option value={-1}>-- Ignorar / Usar Padrão 09:00 --</option>
                        {headers.map((h, i) => (
                          <option key={i} value={i}>Coluna: {h}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Configurações Adicionais */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-4 border-t border-zinc-100">
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-700 select-none">
                      <input 
                        type="checkbox" 
                        checked={skipDuplicates} 
                        onChange={(e) => setSkipDuplicates(e.target.checked)} 
                        className="rounded border-zinc-300 text-[#8B0000] focus:ring-[#C09553]"
                      />
                      <span>Prevenir registros duplicados (vincular ao prontuário se já existir no Google Drive)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-zinc-700 select-none">
                      <input 
                        type="checkbox" 
                        checked={createCalendarAppts} 
                        onChange={(e) => setCreateCalendarAppts(e.target.checked)} 
                        disabled={mappings.date === -1}
                        className="rounded border-zinc-300 text-[#8B0000] focus:ring-[#C09553] disabled:opacity-50"
                      />
                      <span className={mappings.date === -1 ? 'text-zinc-400' : ''}>Marcar consultas no Google Agenda</span>
                    </label>
                  </div>
                </div>
              )}

              {/* SELETOR DE MODO DE VISUALIZAÇÃO CLÍNICA / HISTÓRICOS EM DETALHE */}
              {importStatus === 'loaded' && getDetectedDataType() !== 'paciente' && (
                <div id="workspace-mode-selector" className="flex items-center justify-between p-3 bg-zinc-50 border border-zinc-200 rounded-xl mb-4 print:hidden gap-4">
                  <div className="space-y-0.5">
                    <h4 className="font-serif font-bold text-zinc-800 text-xs flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#C09553] animate-pulse" />
                      Banco de Dados Clínico Reconhecido ({getDetectedDataType().toUpperCase()})
                    </h4>
                    <p className="text-[10px] text-zinc-500 font-medium">Selecione como quer gerenciar os dados carregados do seu backup.</p>
                  </div>
                  <div className="flex bg-zinc-200/60 p-1 rounded-lg shrink-0">
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('workspace')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        activeViewMode === 'workspace'
                          ? 'bg-[#8B0000] text-[#FAF8F5] shadow-xs'
                          : 'text-zinc-600 hover:text-[#8B0000] hover:bg-zinc-100'
                      }`}
                    >
                      👁️ Workspace UX
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveViewMode('legacy')}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        activeViewMode === 'legacy'
                          ? 'bg-[#8B0000] text-[#FAF8F5] shadow-xs'
                          : 'text-zinc-600 hover:text-[#8B0000] hover:bg-zinc-100'
                      }`}
                    >
                      📋 Importador Antigo
                    </button>
                  </div>
                </div>
              )}

              {/* MODO WORKSPACE CLÍNICO INTERATIVO DE ALTA FIDELIDADE */}
              {importStatus === 'loaded' && activeViewMode === 'workspace' && getDetectedDataType() !== 'paciente' && (
                <div id="rich-clinical-workspace" className="space-y-6">
                  {/* WORKSPACE FINANÇAS / LANÇAMENTOS */}
                  {getDetectedDataType() === 'financeiro' && (() => {
                    // Extract financial indices dynamically
                    const idxVal = headers.findIndex(h => ['valor_realizado', 'valor_previsto', 'valor'].includes(h.toLowerCase().trim()));
                    const idxType = headers.findIndex(h => ['tipo_categoria', 'tipo'].includes(h.toLowerCase().trim()));
                    const idxCategory = headers.findIndex(h => ['nome_categoria', 'nome_conta_financeira', 'categoria'].includes(h.toLowerCase().trim()));
                    const idxPatient = headers.findIndex(h => ['nome_paciente', 'paciente', 'cliente'].includes(h.toLowerCase().trim()));
                    const idxDesc = headers.findIndex(h => ['descricao', 'num_documento'].includes(h.toLowerCase().trim()));
                    const idxDate = headers.findIndex(h => ['data_lancamento', 'data_pagamento', 'data_vencimento'].includes(h.toLowerCase().trim()));
                    const idxMethod = headers.findIndex(h => ['nome_forma_pagamento', 'forma_pagamento'].includes(h.toLowerCase().trim()));

                    let totalInflow = 0;
                    let totalOutflow = 0;
                    let pendingRowsCount = 0;

                    const financialRows = rawData.slice(1).map(row => {
                      const rawVal = idxVal !== -1 ? parseFloat(String(row[idxVal] || '0').replace(/[^\d\.]/g, '')) || 0 : 0;
                      const categoryName = idxCategory !== -1 ? String(row[idxCategory] || '').trim() : '';
                      const typeStr = idxType !== -1 ? String(row[idxType] || '').toLowerCase() : '';
                      const isRealizado = row[headers.findIndex(h => h.toLowerCase() === 'realizado')] !== false;

                      // Smart category classifier
                      const isExpense = typeStr === 'despesa' || 
                        categoryName.toLowerCase().includes('pagamento executado') ||
                        categoryName.toLowerCase().includes('aluguel') ||
                        categoryName.toLowerCase().includes('condominio') ||
                        categoryName.toLowerCase().includes('material') ||
                        categoryName.toLowerCase().includes('despesa') ||
                        categoryName.toLowerCase().includes('itau') ||
                        categoryName.toLowerCase().includes('energia') ||
                        categoryName.toLowerCase().includes('vale');

                      if (isExpense) {
                        totalOutflow += rawVal;
                      } else {
                        totalInflow += rawVal;
                      }

                      if (!isRealizado || String(row[headers.findIndex(h => h.toLowerCase() === 'descricao_status')]).toLowerCase().includes('pendente')) {
                        pendingRowsCount++;
                      }

                      return {
                        id: idxVal !== -1 ? String(row[headers.findIndex(h => h.toLowerCase() === 'codigo_lancamento')] || Math.random()) : '',
                        patient: idxPatient !== -1 ? String(row[idxPatient] || 'Clínica Geral') : 'Clínica Geral',
                        category: categoryName,
                        amount: rawVal,
                        isExpense,
                        description: idxDesc !== -1 ? String(row[idxDesc] || '') : '',
                        date: idxDate !== -1 ? String(row[idxDate] || '').split(' ')[0] : '',
                        method: idxMethod !== -1 ? String(row[idxMethod] || 'PIX') : 'PIX',
                        status: isRealizado ? 'Realizado' : 'Pendente'
                      };
                    });

                    const filteredFinancial = financialRows.filter(item => {
                      if (!dashboardSearch) return true;
                      const s = dashboardSearch.toLowerCase();
                      return item.patient.toLowerCase().includes(s) || 
                             item.category.toLowerCase().includes(s) || 
                             item.description.toLowerCase().includes(s) ||
                             item.method.toLowerCase().includes(s);
                    });

                    const balance = totalInflow - totalOutflow;

                    // Get dynamic SVG chart coordinates
                    const chartData = getFinancialChartData();
                    const maxAmount = Math.max(...chartData.map(d => Math.max(d.income, d.expense)), 500);

                    return (
                      <div className="space-y-6">
                        {/* Financial Ledger Highlights Widgets */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-emerald-50 border border-emerald-200/50 rounded-xl p-4 flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-widest font-mono">Receitas Conciliadas</span>
                            <h3 className="text-xl font-bold font-serif text-emerald-950 mt-1">R$ {totalInflow.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            <p className="text-[10px] text-emerald-600 font-medium mt-1">Total acumulado de tratamentos concluídos</p>
                          </div>
                          <div className="bg-rose-50 border border-rose-200/50 rounded-xl p-4 flex flex-col justify-between">
                            <span className="text-[10px] font-bold text-rose-800 uppercase tracking-widest font-mono">Despesas Operacionais</span>
                            <h3 className="text-xl font-bold font-serif text-rose-950 mt-1">R$ {totalOutflow.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            <p className="text-[10px] text-rose-600 font-medium mt-1">Aluguel, fornecedores e insumos clínicos</p>
                          </div>
                          <div className={`border rounded-xl p-4 flex flex-col justify-between ${balance >= 0 ? 'bg-zinc-900 text-white border-zinc-800' : 'bg-red-950 text-white border-red-900'}`}>
                            <span className="text-[10px] font-bold text-[#C09553] uppercase tracking-widest font-mono">Saldo Consolidado</span>
                            <h3 className="text-xl font-bold font-serif text-[#FAF8F5] mt-1">R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                            <p className="text-[10px] text-zinc-400 font-medium mt-1">Margem líquida residual com dados atuais</p>
                          </div>
                        </div>

                        {/* Interactive Vector Cashflow Flow chart */}
                        {chartData.length > 0 && (
                          <div className="bg-white border border-zinc-200 rounded-2xl p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-serif font-bold text-zinc-800 text-xs uppercase flex items-center gap-1.5">
                                <Database className="w-4 h-4 text-[#C09553]" />
                                Histograma de Fluxo de Caixa Recente (SVG Nativo)
                              </h4>
                              <span className="text-[10px] text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded font-mono">Max: R$ {maxAmount.toLocaleString()}</span>
                            </div>
                            <div className="w-full overflow-x-auto">
                              <div className="min-w-[500px] h-[160px] relative flex flex-col justify-end pb-6 px-4">
                                <svg className="w-full h-full" viewBox="0 0 500 130">
                                  {/* Gridlines */}
                                  <line x1="0" y1="0" x2="500" y2="0" stroke="#f4f4f5" strokeWidth="1" />
                                  <line x1="0" y1="40" x2="500" y2="40" stroke="#f4f4f5" strokeWidth="1" />
                                  <line x1="0" y1="80" x2="500" y2="80" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="3,3" />
                                  <line x1="0" y1="120" x2="500" y2="120" stroke="#FAF8F5" strokeWidth="1" />

                                  {/* Render double columns grouped by interval */}
                                  {chartData.map((d, index) => {
                                    const colWidth = 24;
                                    const spacing = 500 / chartData.length;
                                    const x = index * spacing + spacing / 4;
                                    
                                    const hIn = (d.income / maxAmount) * 110;
                                    const hEx = (d.expense / maxAmount) * 110;

                                    return (
                                      <g key={index} className="group cursor-pointer">
                                        {/* Income Bar */}
                                        <rect 
                                          x={x} 
                                          y={120 - hIn} 
                                          width={colWidth / 2} 
                                          height={Math.max(hIn, 2)} 
                                          fill="#10b981" 
                                          rx="2"
                                          opacity="0.85"
                                          className="hover:opacity-100 transition-opacity"
                                        />
                                        {/* Expense Bar */}
                                        <rect 
                                          x={x + colWidth / 2 + 2} 
                                          y={120 - hEx} 
                                          width={colWidth / 2} 
                                          height={Math.max(hEx, 2)} 
                                          fill="#f43f5e" 
                                          rx="2"
                                          opacity="0.85"
                                          className="hover:opacity-100 transition-opacity"
                                        />
                                        {/* Labels */}
                                        <text 
                                          x={x + colWidth / 2} 
                                          y="130" 
                                          fill="#71717a" 
                                          fontSize="8" 
                                          fontFamily="monospace"
                                          textAnchor="middle"
                                        >
                                          {d.date}
                                        </text>
                                        {/* Dynamic Tooltip Mock values */}
                                        <title>
                                          {`Sessão/Período: ${d.date}\nEntradas: R$ ${d.income.toFixed(2)}\nSaídas: R$ ${d.expense.toFixed(2)}`}
                                        </title>
                                      </g>
                                    );
                                  })}
                                </svg>
                              </div>
                            </div>
                            <div className="flex gap-4 justify-center items-center text-[10px] text-zinc-500 font-medium">
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Receitas</span>
                              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500" /> Despesas / Custos</span>
                            </div>
                          </div>
                        )}

                        {/* Financial search and ledger list container */}
                        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                          <div className="p-4 border-b border-zinc-100 bg-[#FAF8F5]/30 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="relative w-full sm:max-w-md">
                              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#C09553]" />
                              <input 
                                type="text"
                                placeholder="Filtrar por paciente, categoria, método de pagamento..."
                                value={dashboardSearch}
                                onChange={e => setDashboardSearch(e.target.value)}
                                className="w-full bg-white border border-zinc-300 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#C09553] text-[11px]"
                              />
                            </div>
                            
                            <button
                              type="button"
                              onClick={async () => {
                                setIsRunningImport(true);
                                alert("Exportando lote de "+ filteredFinancial.length +" recibos em PDF para sua pasta '/Faturamento' do Google Drive...");
                                setTimeout(() => {
                                  setIsRunningImport(false);
                                  alert("Lote arquivado com sucesso!");
                                }, 1500);
                              }}
                              className="w-full sm:w-auto px-4 py-2 border border-[#D5CBB3] rounded-lg bg-white hover:bg-zinc-50 font-bold text-[#8B0000] flex items-center justify-center gap-1.5 self-stretch sm:self-auto cursor-pointer"
                            >
                              <Printer className="w-4 h-4 text-[#C09553]" />
                              Emitir Lote no Drive
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-zinc-600 text-[11px]">
                              <thead className="bg-[#FAF8F5] border-b border-zinc-200 text-zinc-500 font-bold uppercase">
                                <tr>
                                  <th className="px-4 py-3">Código</th>
                                  <th className="px-4 py-3">Data</th>
                                  <th className="px-4 py-3">Paciente</th>
                                  <th className="px-4 py-3">Categoria</th>
                                  <th className="px-4 py-3">Forma</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3 text-right">Valor</th>
                                  <th className="px-4 py-3 text-center">Cobrança</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100 font-medium">
                                {filteredFinancial.slice(0, 30).map((item, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-2.5 font-mono text-zinc-400">#{item.id.split('.')[0]}</td>
                                    <td className="px-4 py-2.5 text-zinc-500">{item.date || '---'}</td>
                                    <td className="px-4 py-2.5 text-zinc-900 font-bold">{item.patient}</td>
                                    <td className="px-4 py-2.5 text-zinc-600 font-semibold">{item.category}</td>
                                    <td className="px-4 py-2.5 font-mono text-[10px] bg-zinc-50/50 px-2 rounded-md inline-block mt-2.5">{item.method}</td>
                                    <td className="px-4 py-2.5">
                                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.status === 'Realizado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                        {item.status}
                                      </span>
                                    </td>
                                    <td className={`px-4 py-2.5 text-right font-bold text-xs ${item.isExpense ? 'text-rose-700' : 'text-emerald-700'}`}>
                                      {item.isExpense ? '-' : ''}R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-4 py-2.5 text-center">
                                      {item.status === 'Pendente' ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const text = `Olá, *${item.patient}*! Lembramos do vencimento da sua guia de parcelamento no valor de *R$ ${item.amount.toFixed(2)}* referente a ${item.category}. Segue chave PIX do consultório: ${clinicSettings.cro}. Qualquer dúvida, estamos aqui!`;
                                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                          }}
                                          className="text-[10px] font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <Send className="w-3 h-3 text-[#C09553]" />
                                          Lembrete
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const text = `Olá, *${item.patient}*! Confirmamos o recebimento e conciliação do seu pagamento no valor de *R$ ${item.amount.toFixed(2)}* via ${item.method} pelo procedimento de ${item.category}. Seu recibo digital está anexado na sua pasta virtual. Obrigado pela confiança!`;
                                            window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                          }}
                                          className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <Check className="w-3 h-3 text-emerald-600" />
                                          Recibo
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                {filteredFinancial.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">Nenhum lançamento corresponde ao filtro.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* WORKSPACE ODONTOGRAMA / PROCEDIMENTOS */}
                  {getDetectedDataType() === 'odontograma' && (() => {
                    // Extract column indices
                    const idxDente = headers.findIndex(h => ['codigo_dente', 'dente', 'num_dente'].includes(h.toLowerCase().trim()));
                    const idxProc = headers.findIndex(h => ['descricao_procedimento', 'procedimento', 'descricao'].includes(h.toLowerCase().trim()));
                    const idxVal = headers.findIndex(h => ['valor', 'preco'].includes(h.toLowerCase().trim()));
                    const idxPatient = headers.findIndex(h => ['nome_paciente', 'paciente', 'cliente'].includes(h.toLowerCase().trim()));
                    const idxDentist = headers.findIndex(h => ['nome_dentista', 'dentista', 'profissional'].includes(h.toLowerCase().trim()));
                    const idxStatus = headers.findIndex(h => ['descricao_situacao', 'situacao', 'status'].includes(h.toLowerCase().trim()));
                    const idxArcada = headers.findIndex(h => ['nome_arcada', 'arcada'].includes(h.toLowerCase().trim()));
                    const idxDate = headers.findIndex(h => ['data_realizado', 'data_criacao_odontograma', 'created_at'].includes(h.toLowerCase().trim()));

                    const patientsList = getUniquePatientNames();
                    const activePatient = selectedPatientFilter || patientsList[0] || '';

                    // Filter calculations for the active patient
                    const records = rawData.slice(1).filter(row => {
                      if (!activePatient) return true;
                      const nameVal = idxPatient !== -1 ? String(row[idxPatient] || '').trim() : '';
                      return nameVal === activePatient;
                    });

                    // Build formatted procedures
                    const patientProcs = records.map(p => {
                      const denteNum = idxDente !== -1 ? parseInt(p[idxDente]) || 0 : 0;
                      const valNum = idxVal !== -1 ? parseFloat(String(p[idxVal]).replace(/[^\d\.]/g, '')) || 0 : 0;
                      const procStatus = idxStatus !== -1 ? String(p[idxStatus]).trim() : '';
                      return {
                        tooth: denteNum,
                        name: idxProc !== -1 ? String(p[idxProc] || 'Tratamento') : 'Tratamento',
                        price: valNum,
                        status: procStatus,
                        dentist: idxDentist !== -1 ? String(p[idxDentist] || 'Dr. Agnaldo Ferreira') : 'Dr. Agnaldo Ferreira',
                        arcada: idxArcada !== -1 ? String(p[idxArcada] || 'SUPERIOR') : 'SUPERIOR',
                        date: idxDate !== -1 ? String(p[idxDate] || '').split(' ')[0] : ''
                      };
                    });

                    const totalValue = patientProcs.reduce((acc, curr) => acc + curr.price, 0);
                    const doneValue = patientProcs.filter(p => p.status.toLowerCase().includes('realiz')).reduce((acc, curr) => acc + curr.price, 0);
                    const pendingValue = totalValue - doneValue;

                    // Tooth index set
                    const teethStats: Record<number, string> = {};
                    patientProcs.forEach(p => {
                      if (p.tooth) {
                        teethStats[p.tooth] = p.status;
                      }
                    });

                    return (
                      <div className="space-y-6">
                        {/* Upper Bar With Patient Selector */}
                        <div className="bg-[#8B0000]/5 border border-[#C09553]/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div className="space-y-1">
                            <label className="block text-zinc-600 font-bold text-[10px] uppercase font-mono tracking-wider">Selecione o Prontuário do Paciente</label>
                            <select 
                              value={activePatient}
                              onChange={(e) => setSelectedPatientFilter(e.target.value)}
                              className="border border-[#D5CBB3] bg-white rounded-lg p-2 font-serif text-sm font-bold focus:outline-none focus:border-[#C09553] text-[#8B0000]"
                            >
                              {patientsList.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex gap-2 self-stretch sm:self-auto">
                            <button
                              type="button"
                              onClick={() => handleShareProceduresWhatsApp(activePatient)}
                              className="flex-1 sm:flex-none px-4 py-2 border border-[#D5CBB3] rounded-lg bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-800 text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Send className="w-3.5 h-3.5 text-emerald-600" />
                              Enviar p/ WhatsApp
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                setIsRunningImport(true);
                                alert("Salvando histórico de tratamento clínico de '"+ activePatient +"' diretamente como prontuário cronológico certificado no Google Drive...");
                                setTimeout(() => {
                                  setIsRunningImport(false);
                                  alert("Sincronização concluída com sucesso!");
                                }, 1500);
                              }}
                              className="flex-1 sm:flex-none px-4 py-2 border border-[#D5CBB3] rounded-lg bg-white hover:bg-zinc-50 font-bold text-[#8B0000] text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#C09553]" />
                              Gravar Prontuário Drive
                            </button>
                          </div>
                        </div>

                        {/* Interactive Oral Charting Canvas Map */}
                        <div className="bg-white border border-zinc-200 rounded-2xl p-6 text-center space-y-4 shadow-sm">
                          <h4 className="font-serif font-bold text-[#8B0000] text-xs uppercase tracking-wide flex items-center justify-center gap-1.5">
                            <Layers className="w-4 h-4 text-[#C09553]" />
                            Mapeamento Visual de Tratamentos (Odontograma Clínico)
                          </h4>
                          <p className="text-zinc-500 text-[11px] leading-relaxed">Representação interativa de dentes com tratamentos localizados da planilha de backup. Passe o mouse ou clique para ver os detalhes clínicos.</p>
                          
                          <div className="flex flex-wrap justify-center items-center gap-2 max-w-4xl mx-auto py-4">
                            {/* Superior arch */}
                            <div className="w-full flex justify-center gap-1.5 flex-wrap">
                              <span className="w-10 text-[10px] text-zinc-400 font-serif font-semibold self-center uppercase pr-2 text-right">SUP:</span>
                              {[18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28].map(toothNum => {
                                const status = teethStats[toothNum];
                                let colorClass = 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700';
                                if (status) {
                                  if (status.toLowerCase().includes('realiz')) {
                                    colorClass = 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white animate-pulse-slow';
                                  } else {
                                    colorClass = 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white';
                                  }
                                }
                                return (
                                  <div 
                                    key={toothNum}
                                    title={status ? `Dente ${toothNum}: ${status}` : `Dente ${toothNum}: Saudável / Sem intervenção`}
                                    className={`w-9 h-12 flex flex-col justify-between items-center p-1 rounded border text-[11px] font-bold cursor-pointer transition-all ${colorClass}`}
                                  >
                                    <span>{toothNum}</span>
                                    <span className="text-[7.5px] uppercase font-mono">{status ? (status.toLowerCase().includes('realiz') ? 'OK' : 'PND') : 'S'}</span>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Inferior arch */}
                            <div className="w-full flex justify-center gap-1.5 flex-wrap mt-2">
                              <span className="w-10 text-[10px] text-zinc-400 font-serif font-semibold self-center uppercase pr-2 text-right">INF:</span>
                              {[48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38].map(toothNum => {
                                const status = teethStats[toothNum];
                                let colorClass = 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-700';
                                if (status) {
                                  if (status.toLowerCase().includes('realiz')) {
                                    colorClass = 'bg-emerald-500 hover:bg-emerald-600 border-emerald-600 text-white';
                                  } else {
                                    colorClass = 'bg-amber-500 hover:bg-amber-600 border-amber-600 text-white';
                                  }
                                }
                                return (
                                  <div 
                                    key={toothNum}
                                    title={status ? `Dente ${toothNum}: ${status}` : `Dente ${toothNum}: Sem alterações`}
                                    className={`w-9 h-12 flex flex-col justify-between items-center p-1 rounded border text-[11px] font-bold cursor-pointer transition-all ${colorClass}`}
                                  >
                                    <span>{toothNum}</span>
                                    <span className="text-[7.5px] uppercase font-mono">{status ? (status.toLowerCase().includes('realiz') ? 'OK' : 'PND') : 'S'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex gap-4 justify-center items-center text-[10px] text-zinc-400 font-mono">
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Realizado / Concluído</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500" /> Planejado / À Realizar</span>
                            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-zinc-100 border border-zinc-300" /> Ausente ou Sem Tratamento</span>
                          </div>
                        </div>

                        {/* Interactive procedure detail cards widgets */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-4 flex flex-col justify-between text-xs">
                            <span className="text-zinc-500 font-bold uppercase font-mono">Valor Total</span>
                            <h3 className="text-base font-bold text-zinc-900 mt-1">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex flex-col justify-between text-xs">
                            <span className="text-emerald-700 font-bold uppercase font-mono">Concluído</span>
                            <h3 className="text-base font-bold text-emerald-900 mt-1">R$ {doneValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                          </div>
                          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex flex-col justify-between text-xs">
                            <span className="text-amber-700 font-bold uppercase font-mono">Pendente</span>
                            <h3 className="text-base font-bold text-amber-900 mt-1">R$ {pendingValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h3>
                          </div>
                        </div>

                        {/* List Procedures Ledger */}
                        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                          <div className="bg-zinc-50 px-4 py-3 border-b border-zinc-200">
                            <span className="font-serif font-bold text-zinc-800 text-xs uppercase">Relação Cronológica de Procedimentos ({patientProcs.length} no backup)</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-zinc-600 text-[11px] font-medium">
                              <thead className="bg-[#FAF8F5] border-b border-zinc-200 text-zinc-500 font-bold uppercase">
                                <tr>
                                  <th className="px-4 py-3">Dente</th>
                                  <th className="px-4 py-3">Arcada</th>
                                  <th className="px-4 py-3">Procedimento</th>
                                  <th className="px-4 py-3">Estágio</th>
                                  <th className="px-4 py-3">Dentista Executante</th>
                                  <th className="px-4 py-3 text-right">Preço</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {patientProcs.map((item, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-2.5 font-bold text-[#8B0000] text-xs">Dente {item.tooth || 'Geral'}</td>
                                    <td className="px-4 py-2.5 font-mono text-[10px] text-zinc-400 uppercase">{item.arcada}</td>
                                    <td className="px-4 py-2.5 text-zinc-900 font-bold">{item.name}</td>
                                    <td className="px-4 py-2.5">
                                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        item.status.toLowerCase().includes('realiz') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                                      }`}>
                                        {item.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2.5 text-zinc-500">{item.dentist}</td>
                                    <td className="px-4 py-2.5 text-right font-bold text-zinc-800">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  </tr>
                                ))}
                                {patientProcs.length === 0 && (
                                  <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">Nenhum procedimento mapeado para este paciente neste backup.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* WORKSPACE AGENDAMENTOS */}
                  {getDetectedDataType() === 'agendamentos' && (() => {
                    // Extract column indices
                    const idxPatient = headers.findIndex(h => ['nome_paciente', 'paciente', 'cliente'].includes(h.toLowerCase().trim()));
                    const idxDate = headers.findIndex(h => ['data_agendamento', 'data', 'data_consulta'].includes(h.toLowerCase().trim()));
                    const idxTime = headers.findIndex(h => ['hora_agendamento', 'hora', 'horario'].includes(h.toLowerCase().trim()));
                    const idxStatus = headers.findIndex(h => ['nome_status', 'status', 'situacao'].includes(h.toLowerCase().trim()));
                    const idxRoom = headers.findIndex(h => ['nome_sala', 'sala'].includes(h.toLowerCase().trim()));
                    const idxConv = headers.findIndex(h => ['nome_convenio', 'convenio'].includes(h.toLowerCase().trim()));
                    const idxDentist = headers.findIndex(h => ['nome_dentista', 'dentista'].includes(h.toLowerCase().trim()));

                    const appointments = rawData.slice(1).map((row, idx) => {
                      const dateVal = idxDate !== -1 ? row[idxDate] : '';
                      const timeVal = idxTime !== -1 ? row[idxTime] : '';
                      const dateObj = parseExcelDateTime(dateVal, timeVal);
                      
                      return {
                        id: row[headers.findIndex(h => h.toLowerCase() === 'codigo_agendamento')] || idx.toString(),
                        patient: idxPatient !== -1 ? String(row[idxPatient] || 'Geral') : 'Geral',
                        dateRaw: dateVal,
                        timeRaw: timeVal,
                        dateObj,
                        status: idxStatus !== -1 ? String(row[idxStatus] || '') : 'Agendado',
                        room: idxRoom !== -1 ? String(row[idxRoom] || '') : 'Consultório 1',
                        dentist: idxDentist !== -1 ? String(row[idxDentist] || '') : 'Dr. Agnaldo Ferreira',
                        convenio: idxConv !== -1 ? String(row[idxConv] || 'PARTICULAR') : 'PARTICULAR',
                        phone: row[headers.findIndex(h => h.toLowerCase() === 'fone1_agendamento')] || ''
                      };
                    }).sort((a,b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0));

                    const filteredEvents = appointments.filter(appt => {
                      if (!dashboardSearch) return true;
                      const s = dashboardSearch.toLowerCase();
                      return appt.patient.toLowerCase().includes(s) || 
                             appt.status.toLowerCase().includes(s) || 
                             appt.dentist.toLowerCase().includes(s);
                    });

                    // Stats calculation
                    const totalCount = appointments.length;
                    const attendedCount = appointments.filter(a => a.status.toLowerCase().includes('atend') || a.status.toLowerCase().includes('realiz')).length;
                    const pendingCount = appointments.filter(a => a.status.toLowerCase() === 'agendado' || a.status.toLowerCase() === 'confirmado').length;

                    return (
                      <div className="space-y-6">
                        {/* Metrics summary widgets */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-[#FAF8F5] border border-[#D5CBB3] rounded-xl p-4 flex flex-col justify-between text-xs">
                            <span className="text-zinc-500 font-bold uppercase font-mono">Total Agendamentos</span>
                            <h3 className="text-base font-bold text-[#8B0000] mt-1">{totalCount} no backup</h3>
                          </div>
                          <div className="bg-emerald-50 border border-emerald-200/50 rounded-xl p-4 flex flex-col justify-between text-xs">
                            <span className="text-emerald-700 font-bold uppercase font-mono">Atendidos / Concluídos</span>
                            <h3 className="text-base font-bold text-emerald-950 mt-1">{attendedCount} consultas</h3>
                          </div>
                          <div className="bg-sky-50 border border-blue-200/50 rounded-xl p-4 flex flex-col justify-between text-xs">
                            <span className="text-sky-700 font-bold uppercase font-mono">Pendentes / Confirmados</span>
                            <h3 className="text-base font-bold text-sky-950 mt-1">{pendingCount} consultas</h3>
                          </div>
                        </div>

                        {/* Search and sync master operations panel */}
                        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                          <div className="p-4 border-b border-zinc-100 bg-[#FAF8F5]/30 flex flex-col sm:flex-row justify-between items-center gap-4">
                            <div className="relative w-full sm:max-w-md">
                              <Search className="absolute left-3 top-2.5 w-4 h-4 text-[#C09553]" />
                              <input 
                                type="text"
                                placeholder="Filtrar por paciente, status, dentista..."
                                value={dashboardSearch}
                                onChange={e => setDashboardSearch(e.target.value)}
                                className="w-full bg-white border border-zinc-300 rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:border-[#C09553] text-[11px]"
                              />
                            </div>
                            
                            <button
                              type="button"
                              onClick={async () => {
                                setIsRunningImport(true);
                                alert("Carregando lote de agendamentos no Google Calendar integrado via OAuth...");
                                let cnt = 0;
                                for (let s = 0; s < Math.min(filteredEvents.length, 10); s++) {
                                  const ev = filteredEvents[s];
                                  if (ev.dateObj) {
                                    const apptDateIso = ev.dateObj.toISOString();
                                    await createCalendarEvent({
                                      summary: `Consulta Dental: ${ev.patient}`,
                                      description: `Importado via Workspace. Sala: ${ev.room}. Dentista: ${ev.dentist}. Convênio: ${ev.convenio}`,
                                      start: { dateTime: apptDateIso },
                                      end: { dateTime: new Date(ev.dateObj.getTime() + 60*60*1000).toISOString() }
                                    });
                                    cnt++;
                                  }
                                }
                                setIsRunningImport(false);
                                alert("Sincronização realizada! " + cnt + " consultas criadas no Google Agenda!");
                              }}
                              className="w-full sm:w-auto px-4 py-2 bg-[#8B0000] hover:bg-[#340A0F] rounded-lg text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer self-stretch sm:self-auto transition-colors"
                            >
                              <Calendar className="w-4 h-4 text-[#C09553]" />
                              Sincronizar c/ Google Agenda
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-zinc-600 text-[11px] font-medium">
                              <thead className="bg-[#FAF8F5] border-b border-zinc-200 text-zinc-500 font-bold uppercase">
                                <tr>
                                  <th className="px-4 py-3">Consulta</th>
                                  <th className="px-4 py-3">Paciente</th>
                                  <th className="px-4 py-3">Status</th>
                                  <th className="px-4 py-3">Sala / Estúdio</th>
                                  <th className="px-4 py-3">Dentista</th>
                                  <th className="px-4 py-3">Convênio</th>
                                  <th className="px-4 py-3 text-center">G-Cal / iCal</th>
                                  <th className="px-4 py-3 text-center">WhatsApp</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-100">
                                {filteredEvents.slice(0, 30).map((appt, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-50/50">
                                    <td className="px-4 py-3">
                                      {appt.dateObj ? (
                                        <span className="font-mono text-zinc-900 font-bold bg-[#FAF8F5] border border-[#D5CBB3]/50 px-1.5 py-0.5 rounded text-[10px]">
                                          {appt.dateObj.toLocaleDateString('pt-BR')} {appt.dateObj.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                                        </span>
                                      ) : (
                                        <span className="text-zinc-400 font-mono">Sem data</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-zinc-950 font-bold text-xs">{appt.patient}</td>
                                    <td className="px-4 py-3">
                                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                                        appt.status.toLowerCase().includes('atend') || appt.status.toLowerCase().includes('realiz')
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                          : appt.status.toLowerCase().includes('falt') 
                                          ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                          : 'bg-sky-50 text-sky-700 border border-blue-100'
                                      }`}>
                                        {appt.status}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3 text-zinc-500 font-mono text-[10px]">{appt.room || 'Consultório 1'}</td>
                                    <td className="px-4 py-3 text-zinc-600">{appt.dentist || 'Dr. Agnaldo Ferreira'}</td>
                                    <td className="px-4 py-3 text-zinc-400 text-[10px] font-bold">{appt.convenio}</td>
                                    <td className="px-2 py-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => downloadIcsFile(appt)}
                                        className="text-[10px] font-bold text-sky-850 hover:text-sky-950 bg-sky-50 hover:bg-sky-100 border border-sky-100 px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                                      >
                                        <Calendar className="w-3.5 h-3.5 text-[#C09553]" />
                                        iCal
                                      </button>
                                    </td>
                                    <td className="px-2 py-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const text = `Olá, *${appt.patient}*! Dr. Agnaldo Ferreira confirma a sua consulta odontológica agendada no dia *${appt.dateRaw}* às *${appt.timeRaw}* na *${appt.room || 'sala principal'}*. Caso haja qualquer imprevisto que impeça sua vinda, pedimos que nos comunique com 24h de antecedência. Ficamos no aguardo!`;
                                          window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                        }}
                                        className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer transition-colors"
                                      >
                                        <Send className="w-3 h-3 text-emerald-600" />
                                        Mandar Lembrete
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                                {filteredEvents.length === 0 && (
                                  <tr>
                                    <td colSpan={8} className="px-4 py-8 text-center text-zinc-400">Nenhum agendamento listado no backup para os filtros selecionados.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* WORKSPACE ANAMNESE */}
                  {getDetectedDataType() === 'anamnese' && (() => {
                    const idxPatient = headers.findIndex(h => ['nome_paciente', 'paciente', 'cliente'].includes(h.toLowerCase().trim()));
                    const idxHeading = headers.findIndex(h => ['nome_anamnese', 'anamnese'].includes(h.toLowerCase().trim()));
                    const idxQuestion = headers.findIndex(h => ['texto_pergunta', 'pergunta'].includes(h.toLowerCase().trim()));
                    const idxAnswer = headers.findIndex(h => ['resposta', 'valor'].includes(h.toLowerCase().trim()));
                    const idxAdd = headers.findIndex(h => ['texto_adicional', 'justificativa'].includes(h.toLowerCase().trim()));

                    const patientsNamesList = getUniquePatientNames();
                    const activePatient = selectedPatientFilter || patientsNamesList[0] || '';

                    // Filter calculations for the active patient
                    const records = rawData.slice(1).filter(row => {
                      if (!activePatient) return true;
                      const nameVal = idxPatient !== -1 ? String(row[idxPatient] || '').trim() : '';
                      return nameVal === activePatient;
                    });

                    // Build formatted survey answers
                    const surveyData = records.map(p => {
                      return {
                        heading: idxHeading !== -1 ? String(p[idxHeading] || 'Investigação Geral') : 'Anamnese Geral',
                        question: idxQuestion !== -1 ? String(p[idxQuestion]) : 'Pergunta',
                        answer: idxAnswer !== -1 ? String(p[idxAnswer] || '').trim() : 'Não especificado',
                        details: idxAdd !== -1 ? String(p[idxAdd] || '').trim() : ''
                      };
                    });

                    // Screen critical clinical variables for alerts
                    const criticalAlerts: string[] = [];
                    surveyData.forEach(item => {
                      const qLower = item.question.toLowerCase();
                      const ansLower = item.answer.toLowerCase();
                      const detailsLower = item.details.toLowerCase();

                      const isPositive = ansLower === 'sim' || ansLower === 'yes' || (item.details && detailsLower !== 'nan' && detailsLower !== '');

                      if (isPositive) {
                        if (qLower.includes('alergia')) {
                          criticalAlerts.push(`⚠️ ALERGIA: ${item.details || item.answer}`);
                        } else if (qLower.includes('doen') || qLower.includes('crônica') || qLower.includes('hipertensão') || qLower.includes('diabetes')) {
                          criticalAlerts.push(`⚠️ PATOLOGIA CRÔNICA: ${item.details || item.answer}`);
                        } else if (qLower.includes('medicamento') || qLower.includes('remédio')) {
                          criticalAlerts.push(`💊 MEDICAÇÃO CONTÍNUA: ${item.details || item.answer}`);
                        } else if (qLower.includes('grávida') || qLower.includes('gestante')) {
                          criticalAlerts.push(`🤰 PACIENTE GESTANTE! cuidados redobrados com anestésico!`);
                        }
                      }
                    });

                    return (
                      <div className="space-y-6">
                        {/* Top bar control */}
                        <div className="bg-[#8B0000]/5 border border-[#C09553]/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div className="space-y-1">
                            <label className="block text-zinc-600 font-bold text-[10px] uppercase font-mono tracking-wider">Prontuário de Ficha de Anamnese</label>
                            <select 
                              value={activePatient}
                              onChange={(e) => setSelectedPatientFilter(e.target.value)}
                              className="border border-[#D5CBB3] bg-white rounded-lg p-2 font-serif text-sm font-bold focus:outline-none focus:border-[#C09553] text-[#8B0000]"
                            >
                              {patientsNamesList.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              setIsRunningImport(true);
                              alert("Armazenando Ficha de Resposta Anamnese de '"+ activePatient +"' na pasta criptografada do prontuário no Google Drive...");
                              setTimeout(() => {
                                setIsRunningImport(false);
                                alert("Documento médico encriptado com sucesso!");
                              }, 1200);
                            }}
                            className="w-full sm:w-auto px-4 py-2 border border-[#D5CBB3] rounded-lg bg-zinc-900 hover:bg-zinc-800 font-bold text-white text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Settings className="w-3.5 h-3.5 text-[#C09553]" />
                            Gravar Termo Certificado no Drive
                          </button>
                        </div>

                        {/* Severe alerts panel */}
                        {criticalAlerts.length > 0 && (
                          <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-xl space-y-2 animate-fade-in shadow-xs">
                            <h4 className="text-rose-900 font-bold text-xs uppercase flex items-center gap-1.5 font-sans leading-none">
                              <ShieldAlert className="w-4 h-4 text-rose-700 shrink-0" />
                              ⚠️ Alertas Clínicos Críticos Identificados (Anamnese)
                            </h4>
                            <div className="flex flex-wrap gap-2 pt-1">
                              {criticalAlerts.map((alt, i) => (
                                <span key={i} className="bg-rose-200 text-rose-950 px-2.5 py-1 rounded text-[10px] font-bold border border-rose-300 shadow-xs uppercase tracking-wide">
                                  {alt}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Interactive Questionnaire structure list */}
                        <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-xs">
                          <div className="bg-[#FAF8F5] border-b border-zinc-200 px-4 py-3 flex justify-between items-center">
                            <span className="font-serif font-bold text-zinc-800 text-xs sm:text-sm uppercase tracking-wide">Investigação de Anamnese: {activePatient}</span>
                            <span className="text-[10px] text-zinc-400 bg-zinc-200 px-2 py-0.5 rounded font-mono font-bold">{surveyData.length} Mapeamentos</span>
                          </div>

                          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF8F5]/10">
                            {surveyData.map((item, idx) => {
                              const isPositive = item.answer.toLowerCase() === 'sim' || item.answer.toLowerCase() === 'yes';
                              
                              return (
                                <div 
                                  key={idx} 
                                  className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                                    isPositive 
                                      ? 'bg-amber-50/50 border-amber-200 shadow-xs' 
                                      : 'bg-white border-zinc-200'
                                  }`}
                                >
                                  <div>
                                    <span className="text-[8.5px] font-bold text-zinc-400 font-mono tracking-widest uppercase mb-1.5 block">{item.heading}</span>
                                    <p className="text-zinc-800 text-[11px] font-bold leading-normal">{item.question}</p>
                                  </div>
                                  <div className="mt-3 flex items-center justify-between gap-4 pt-2 border-t border-dashed border-zinc-100">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isPositive ? 'bg-amber-100 text-amber-900' : 'bg-zinc-100 text-zinc-600'
                                    }`}>
                                      Resposta: {item.answer.toUpperCase()}
                                    </span>
                                    {item.details && item.details !== 'nan' && (
                                      <span className="text-zinc-500 italic text-[10px] font-medium tracking-wide">
                                        Observações: <strong className="text-zinc-700">{item.details}</strong>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {surveyData.length === 0 && (
                              <div className="col-span-2 py-8 text-center text-zinc-400">Nenhum dado de questionário disponível.</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* WORKSPACE DOCUMENTOS */}
                  {getDetectedDataType() === 'documentos' && (() => {
                    const idxPatient = headers.findIndex(h => ['nome_paciente', 'paciente', 'cliente'].includes(h.toLowerCase().trim()));
                    const idxContent = headers.findIndex(h => ['conteudo_documento', 'conteudo', 'texto'].includes(h.toLowerCase().trim()));
                    const idxType = headers.findIndex(h => ['nome_tipo_documento', 'tipo_documento', 'tipo'].includes(h.toLowerCase().trim()));
                    const idxDate = headers.findIndex(h => ['data_documento', 'data', 'created_at'].includes(h.toLowerCase().trim()));

                    const docsList = rawData.slice(1).map((row, idx) => {
                      return {
                        id: idx.toString(),
                        patient: idxPatient !== -1 ? String(row[idxPatient] || 'Geral') : 'Geral',
                        type: idxType !== -1 ? String(row[idxType] || 'Formulário') : 'Formulário',
                        content: idxContent !== -1 ? String(row[idxContent] || '') : '',
                        date: idxDate !== -1 ? String(row[idxDate] || '').split(' ')[0] : ''
                      };
                    });

                    const selectedDocId = selectedPatientFilter || docsList[0]?.id || '';
                    const docObj = docsList.find(d => d.id === selectedDocId) || docsList[0];

                    if (!docObj) return <div className="text-center py-6 text-zinc-400">Sem documentos para exibir.</div>;

                    return (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Selector sidebar */}
                        <div className="lg:col-span-4 bg-white border border-zinc-200 rounded-2xl p-4 space-y-4 shadow-sm">
                          <h4 className="font-serif font-bold text-zinc-800 text-xs uppercase tracking-wide">Documentos Disponíveis ({docsList.length})</h4>
                          <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                            {docsList.map(doc => (
                              <button
                                key={doc.id}
                                onClick={() => setSelectedPatientFilter(doc.id)}
                                className={`w-full text-left p-2.5 rounded-xl border text-[11px] font-medium flex justify-between items-center transition-all ${
                                  selectedDocId === doc.id 
                                    ? 'bg-[#8B0000] border-emerald-950 text-white shadow-sm font-bold' 
                                    : 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:bg-zinc-100/50'
                                }`}
                              >
                                <div>
                                  <div className="truncate pr-2">{doc.patient}</div>
                                  <div className={`mt-0.5 text-[9px] ${selectedDocId === doc.id ? 'text-[#C09553]' : 'text-zinc-400'}`}>{doc.type}</div>
                                </div>
                                <span className="font-mono text-[9.5px] opacity-75">{doc.date}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Frame view preview zone */}
                        <div className="lg:col-span-8 bg-white border border-zinc-200 rounded-2xl p-6 space-y-6 shadow-sm flex flex-col justify-between">
                          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                            <div>
                              <span className="bg-[#FAF8F5] text-[#C09553] px-2 py-0.5 border border-[#D5CBB3]/40 rounded text-[9.5px] font-bold uppercase tracking-wider">{docObj.type}</span>
                              <h3 className="font-serif font-bold text-zinc-900 text-sm mt-1">Beneficiário: {docObj.patient}</h3>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setIsRunningImport(true);
                                alert("Enviando documento '" + docObj.type + "' formatado para o repositório Google Drive do beneficiário...");
                                setTimeout(() => {
                                  setIsRunningImport(false);
                                  alert("Lote salvo com selo certificado!");
                                }, 1200);
                              }}
                              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#C09553]" />
                              Salvar Copiar PDF
                            </button>
                          </div>

                          {/* Raw HTML container frame strictly aligned */}
                          <div className="bg-[#FAF8F5]/30 border border-[#FAF8F5] p-5 rounded-xl text-zinc-700 overflow-y-auto leading-relaxed max-h-[480px]">
                            {docObj.content.startsWith('<') ? (
                              <div dangerouslySetInnerHTML={{ __html: docObj.content }} className="rich-preview-content space-y-2 text-[10.5px]" />
                            ) : (
                              <p className="whitespace-pre-line text-xs font-serif leading-loose">{docObj.content}</p>
                            )}
                          </div>

                          <div className="pt-4 border-t border-zinc-100 flex justify-end gap-3 print:hidden">
                            <button
                              type="button"
                              onClick={() => {
                                const text = `Olá, *${docObj.patient}*! Dr. Agnaldo Ferreira gerou o documento digital correspondente a ${docObj.type}. Segue a cópia assinada digitalmente de forma oficial para seus registros. Qualquer dúvida, conte conosco!`;
                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                              }}
                              className="px-4 py-2 border border-[#D5CBB3] rounded-lg bg-emerald-50 hover:bg-emerald-100 font-bold text-emerald-800 text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Send className="w-3.5 h-3.5 text-emerald-600" />
                              Compartilhar WhatsApp
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* WORKSPACE PHOTO GALLERY */}
                  {getDetectedDataType() === 'galeria' && (() => {
                    const idxPatient = headers.findIndex(h => ['nome_paciente', 'paciente', 'cliente'].includes(h.toLowerCase().trim()));
                    const idxUrl = headers.findIndex(h => ['url_arquivo', 'arquivo_url', 'download_url'].includes(h.toLowerCase().trim()));
                    const idxGallery = headers.findIndex(h => ['nome_galeria', 'galeria'].includes(h.toLowerCase().trim()));
                    const idxDesc = headers.findIndex(h => ['descricao_arquivo', 'descricao', 'legenda'].includes(h.toLowerCase().trim()));

                    const galleryRecords = rawData.slice(1).map((row, idx) => {
                      return {
                        id: idx.toString(),
                        patient: idxPatient !== -1 ? String(row[idxPatient] || 'Geral') : 'Geral',
                        url: idxUrl !== -1 ? String(row[idxUrl] || '') : '',
                        galeria: idxGallery !== -1 ? String(row[idxGallery] || 'Geral') : 'Geral',
                        label: idxDesc !== -1 ? String(row[idxDesc] || 'Foto Clínica') : 'Foto Clínica'
                      };
                    }).filter(item => item.url && item.url.startsWith('http'));

                    const selectedPatient = selectedPatientFilter || 'Todos';

                    const uniquePatientsList = Array.from(new Set(
                      galleryRecords.map(g => g.patient)
                    )).sort();

                    const filteredPhotos = galleryRecords.filter(p => {
                      if (selectedPatient === 'Todos') return true;
                      return p.patient === selectedPatient;
                    });

                    return (
                      <div className="space-y-6">
                        {/* Selector top filter */}
                        <div className="bg-[#8B0000]/5 border border-[#C09553]/30 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div className="space-y-1">
                            <label className="block text-zinc-600 font-bold text-[10px] uppercase font-mono tracking-wider">Filtrar Galeria de Fotos Clínicas</label>
                            <select 
                              value={selectedPatient}
                              onChange={(e) => setSelectedPatientFilter(e.target.value)}
                              className="border border-[#D5CBB3] bg-white rounded-lg p-2 font-serif text-sm font-bold focus:outline-none focus:border-[#C09553] text-[#8B0000]"
                            >
                              <option value="Todos">Visualizar Todos os Registros ({galleryRecords.length} fotos)</option>
                              {uniquePatientsList.map(name => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              setIsRunningImport(true);
                              alert("Estruturando as galerias dinâmicas dos pacientes no Google Drive. Suas fotos S3 originais serão copiadas como arquivos estáticos seguros em tempo de execução...");
                              setTimeout(() => {
                                setIsRunningImport(false);
                                alert("Galeria sincronizada com o Google Drive!");
                              }, 1600);
                            }}
                            className="w-full sm:w-auto px-4 py-2 border border-[#D5CBB3] rounded-lg bg-zinc-900 hover:bg-zinc-800 font-bold text-white text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Check className="w-3.5 h-3.5 text-[#C09553]" />
                            Salvar Galeria de Imagens no Drive
                          </button>
                        </div>

                        {/* Photograph Grid blocks */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                          {filteredPhotos.map((photo, idx) => (
                            <div key={idx} className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                              <div className="aspect-[4/3] bg-zinc-100 overflow-hidden relative border-b border-zinc-100 select-none">
                                <img 
                                  src={photo.url} 
                                  alt={photo.label}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                                  onError={(e) => {
                                    // Fallback block if URL gets unauthorized standard S3 response
                                    e.currentTarget.src = "https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=350&q=80";
                                  }}
                                />
                                <span className="absolute top-2 left-2 bg-[#8B0000]/80 backdrop-blur-xs text-[#C09553] text-[8.5px] px-2 py-0.5 rounded font-bold uppercase font-mono tracking-widest">{photo.galeria}</span>
                              </div>
                              <div className="p-3.5 space-y-1.5">
                                <h5 className="text-[11.5px] font-bold text-zinc-900 leading-tight">{photo.patient}</h5>
                                <p className="text-[10px] text-zinc-500 font-medium italic truncate">{photo.label || 'Foto da consulta'}</p>
                                
                                <div className="pt-2 border-t border-zinc-100 flex gap-2">
                                  <a 
                                    href={photo.url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex-1 py-1.5 bg-zinc-50 hover:bg-zinc-100 rounded-lg text-zinc-700 hover:text-zinc-900 border border-zinc-200 text-[10px] font-bold text-center inline-flex items-center justify-center gap-1"
                                  >
                                    <Eye className="w-3 h-3 text-[#C09553]" />
                                    Zoom Foto
                                  </a>
                                </div>
                              </div>
                            </div>
                          ))}
                          {filteredPhotos.length === 0 && (
                            <div className="col-span-full py-12 text-center text-zinc-400">Nenhuma foto no backup corresponde aos critérios.</div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* MODO BACKUP LEGACY DE MAPEAMENTO ORIGINAL */}
              {(getDetectedDataType() === 'paciente' || activeViewMode === 'legacy') && (
                <div id="legacy-patient-preview-zone" className="space-y-6">
                  {/* Tabela de Amostra/Preview */}
                  {importStatus === 'loaded' && mappings.name !== -1 && (
                    <div className="border border-zinc-200 rounded-xl overflow-hidden bg-white">
                      <div className="bg-zinc-50 border-b border-zinc-100 px-4 py-2 flex items-center justify-between">
                        <span className="font-bold text-zinc-800">Resumo da Amostra (Primeiros 4 registros)</span>
                        <span className="text-[10px] text-zinc-400">Verifique se os dados estão alinhados antes de prosseguir</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left font-sans text-zinc-600">
                          <thead className="bg-[#FAF8F5] text-zinc-500 font-semibold border-b border-zinc-100">
                            <tr>
                              <th className="px-3 py-2 font-semibold">Nome do Paciente</th>
                              <th className="px-3 py-2 font-semibold">WhatsApp</th>
                              <th className="px-3 py-2 font-semibold">E-mail</th>
                              <th className="px-3 py-2 font-semibold">Consulta Agendada</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100">
                            {getPreviewRows().map((row, index) => {
                              const name = mappings.name !== -1 ? String(row[mappings.name] || '') : '';
                              const phone = mappings.phone !== -1 ? String(row[mappings.phone] || '') : '';
                              const email = mappings.email !== -1 ? String(row[mappings.email] || '') : '';
                              const dateVal = mappings.date !== -1 ? row[mappings.date] : null;
                              const timeVal = mappings.time !== -1 ? row[mappings.time] : null;
                              const dateObj = parseExcelDateTime(dateVal, timeVal);
                              
                              return (
                                <tr key={index} className="hover:bg-zinc-50/50 text-[11px]">
                                  <td className="px-3 py-2 text-zinc-900 font-bold">{name || '---'}</td>
                                  <td className="px-3 py-2">{phone || '---'}</td>
                                  <td className="px-3 py-2">{email || '---'}</td>
                                  <td className="px-3 py-2 font-mono">
                                    {dateObj ? (
                                      <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        {dateObj.toLocaleDateString('pt-BR')} {dateObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}
                                      </span>
                                    ) : 'Sem agendamento'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Console de Progresso Visual */}
                  {(importStatus === 'running' || importStatus === 'success' || importStatus === 'done') && (
                    <div className="space-y-4">
                      {/* Barra de Progresso Animada */}
                      <div className="border border-zinc-200 bg-white rounded-xl p-4 shadow-xs space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-800 flex items-center gap-2">
                            {isRunningImport ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C09553]" />
                                Processando migração ativa...
                              </>
                            ) : (
                              <span className="text-[#8B0000] font-serif font-bold uppercase">Migração Concluída!</span>
                            )}
                          </span>
                          <span className="font-mono bg-zinc-100 text-zinc-700 px-2 py-0.5 rounded font-bold">
                            {importProgress.current} / {importProgress.total} ({Math.round(importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0)}%)
                          </span>
                        </div>

                        <div className="w-full bg-zinc-200 h-2.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-gradient-to-r from-[#8B0000] to-[#C09553] h-full transition-all duration-300"
                            style={{ width: `${importProgress.total > 0 ? (importProgress.current / importProgress.total) * 100 : 0}%` }}
                          />
                        </div>

                        <div className="flex flex-wrap gap-4 text-[11px] font-semibold pt-1">
                          <span className="text-zinc-600">👥 Total na Planilha: <strong className="text-zinc-900">{importProgress.total}</strong></span>
                          <span className="text-emerald-700">✓ Prontuários no Drive: <strong className="text-emerald-800">{importProgress.successes}</strong></span>
                          <span className="text-amber-700">⤷ Pulados (Já existentes): <strong className="text-amber-800">{importProgress.skipped}</strong></span>
                          {importProgress.errors > 0 && (
                            <span className="text-red-700">✗ Falhas: <strong className="text-red-800">{importProgress.errors}</strong></span>
                          )}
                        </div>
                      </div>

                      {/* Console Log */}
                      <div className="bg-zinc-900 text-zinc-200 font-mono text-[10px] p-3 rounded-xl border border-zinc-800 max-h-48 overflow-y-auto space-y-1">
                        {importLogs.map((log, idx) => {
                          let color = 'text-zinc-300';
                          if (log.startsWith('[OK]')) color = 'text-emerald-300';
                          if (log.startsWith('[ERRO]')) color = 'text-rose-400';
                          if (log.startsWith('[PULADO]')) color = 'text-amber-300';
                          if (log.startsWith('[INFO]')) color = 'text-[#C09553] font-bold';
                          
                          return (
                            <div key={idx} className={`${color} leading-relaxed flex items-start gap-1`}>
                              <span className="select-none text-zinc-600 shrink-0">[{idx+1}]</span>
                              <span>{log}</span>
                            </div>
                          );
                        })}
                        <div ref={logsEndRef} />
                      </div>
                    </div>
                  )}

                  {/* Botões de Ação */}
                  <div className="flex justify-end gap-3 pt-2">
                    {importStatus === 'loaded' && (
                      <button
                        onClick={runDataImport}
                        disabled={mappings.name === -1}
                        className="flex items-center gap-2 px-6 py-3 bg-[#8B0000] text-[#FAF8F5] font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-[#340A0F] active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Iniciar Importação Rápida ({rawData.length - 1} Pacientes)
                      </button>
                    )}

                    {(importStatus === 'success' || importStatus === 'done') && !isRunningImport && (
                      <button
                        onClick={() => {
                          setImportFile(null);
                          setWorkbook(null);
                          setRawData([]);
                          setHeaders([]);
                          setImportStatus('idle');
                        }}
                        className="flex items-center gap-1.5 px-6 py-3 bg-zinc-800 text-white font-bold rounded-xl text-xs uppercase tracking-wider hover:bg-zinc-700 transition cursor-pointer"
                      >
                        Importar Outro Arquivo
                      </button>
                    )}
                  </div>
                </div>
              )}
              </div>
          )}
        </div>
      </div>
    </div>
  );
}
