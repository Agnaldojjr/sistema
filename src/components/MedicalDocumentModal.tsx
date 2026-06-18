import React, { useState } from 'react';
import { X, FileText, Smartphone, Download, Loader2, Sparkles, ChevronRight, Plus } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { PatientData, ClinicSettings } from '../types';

interface MedicalDocumentModalProps {
  type: 'receituario' | 'atestado' | 'declaracao';
  patientName: string;
  patientData: PatientData;
  clinicSettings: ClinicSettings;
  onClose: () => void;
  onEmit?: (data: { arrivalTime: string, departureTime: string }) => void;
  initialArrivalTime?: string;
  initialDepartureTime?: string;
}

const DRUGS = [
  { class: 'Analgésicos', name: 'Dipirona Sódica 500mg', posology: 'Tomar 1 comprimido de 6 em 6 horas se houver dor.' },
  { class: 'Analgésicos', name: 'Dipirona Sódica 1g', posology: 'Tomar 1 comprimido de 6 em 6 horas se houver dor forte.' },
  { class: 'Analgésicos', name: 'Paracetamol 750mg', posology: 'Tomar 1 comprimido de 6 em 6 horas se houver dor.' },
  { class: 'AINEs', name: 'Ibuprofeno 400mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 3 dias.' },
  { class: 'AINEs', name: 'Ibuprofeno 600mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 3 dias.' },
  { class: 'AINEs', name: 'Nimesulida 100mg', posology: 'Tomar 1 comprimido de 12 em 12 horas por 3 a 5 dias.' },
  { class: 'Corticosteroides', name: 'Dexametasona 4mg', posology: 'Tomar 1 comprimido a cada 12 horas, nas primeiras 24 a 48 horas.' },
  { class: 'Antibióticos', name: 'Amoxicilina 500mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 7 dias.' },
  { class: 'Antibióticos', name: 'Amoxicilina+Clavulanato 875/125mg', posology: 'Tomar 1 comprimido de 8 em 8 horas por 7 a 10 dias.' },
  { class: 'Antibióticos', name: 'Azitromicina 500mg', posology: 'Tomar 1 comprimido ao dia por 3 a 5 dias.' },
  { class: 'Analgésicos Opioides', name: 'Tramadol 50mg', posology: 'Tomar 1 comprimido de 6 em 6 horas em caso de dor intratável.' },
  { class: 'Analgésicos Opioides', name: 'Paracetamol + Codeína', posology: 'Tomar 1 comprimido de 6 em 6 horas.' },
  { class: 'Uso Externo', name: 'Digluconato de Clorexidina 0,12%', posology: 'Bochechar 15 mL por 1 minuto, 2 vezes ao dia (após 24h).' },
  { class: 'Lesões Orais', name: 'Triancinolona Acetonida 1 mg/g', posology: 'Aplicar pequena quantidade (6 mm) sobre a lesão, sem esfregar. 2 a 3x ao dia, preferencialmente após as refeições e à noite. Evitar comer/beber por 30 min após (máx 7 dias).' },
  { class: 'Lesões Orais', name: 'Pomada Orabase (Gingilone)', posology: 'Friccionar uma pequena quantidade no local afetado, 3 a 6 vezes ao dia até alívio dos sintomas (até 1 semana).' },
  { class: 'Enxaguatórios', name: 'Fluoreto de Sódio 0,05% (Diário)', posology: 'Bochechar 10 a 20 mL por 1 minuto, 1 a 2x ao dia. Não engolir, não enxaguar com água e evitar comer/beber por 30 min.' },
  { class: 'Enxaguatórios', name: 'Fluoreto de Sódio 0,2% (Semanal)', posology: 'Bochechar 10 a 20 mL por 1 minuto, 1 vez na semana. Não engolir, não enxaguar com água e evitar comer/beber por 30 min.' },
  { class: 'Prevenção', name: 'Creme Dental 5000 ppm Flúor', posology: 'Aplicar tamanho de ervilha na escova. Escovar 1x ao dia (à noite) por 2 min. Apenas cuspir excesso, não enxaguar com água. Uso por 20 a 30 dias.' }
];

const PROTOCOLS = [
  {
    name: 'Extração Simples (Rotina)',
    items: [
      'Uso Interno:',
      '1. Ibuprofeno 400mg - Tomar 1 comprimido de 8 em 8 horas, por 3 dias.',
      '2. Dipirona Sódica 500mg - Tomar 1 comprimido de 6 em 6 horas nas primeiras 48h. Após, usar apenas se dor.'
    ]
  },
  {
    name: 'Extração de Siso Incluso e Cirurgias Complexas',
    items: [
      'Uso Interno:',
      '1. Dexametasona 4mg - Tomar 1 comprimido a cada 12 horas, nas primeiras 24 a 48 horas.',
      '2. Nimesulida 100mg - Tomar 1 comprimido a cada 12 horas, durante 3 a 5 dias.',
      '3. Dipirona Sódica 1g - Tomar 1 comprimido de 6 em 6 horas contínuas pelas primeiras 72 horas.',
      '\nUso Externo:',
      '4. Digluconato de Clorexidina 0,12% - Bochechar 15 mL por 1 minuto, a cada 12 horas. (Iniciar modo passivo após o 1º dia)'
    ]
  },
  {
    name: 'Implante Unitário Regular (Profilaxia)',
    items: [
      'Uso Interno (Ataque):',
      '1. Amoxicilina 500mg - Tomar 4 comprimidos (2g) em dose única, 1 hora antes do procedimento.',
      '\nPós-operatório Mínimo:',
      '2. Paracetamol 750mg - Tomar 1 comprimido a cada 6 horas.',
      '3. Dexametasona 4mg - Tomar 1 comprimido 1 hora antes do procedimento.',
      '\nUso Externo:',
      '4. Digluconato de Clorexidina 0,12% - Bochechar 15 mL duas vezes ao dia por até 14 dias.'
    ]
  },
  {
    name: 'Implante (Alérgicos a Penicilina)',
    items: [
      'Uso Interno (Ataque):',
      '1. Azitromicina 500mg - Tomar 1 comprimido 1 hora antes do procedimento.'
    ]
  },
  {
    name: 'Restauração Profunda (Sensibilidade)',
    items: [
      'Uso Interno:',
      '1. Ibuprofeno 600mg - Tomar 1 comprimido a cada 12 horas.',
      '2. Dipirona Sódica 500mg - Tomar 1 comprimido a cada 6 horas.'
    ]
  },
  {
    name: 'Dor de Pulpite Irreversível (Urgência)',
    items: [
      'Uso Interno:',
      '1. Paracetamol 500mg + Fosfato de Codeína 30mg - Tomar 1 comprimido a cada 6 horas para dor aguda.'
    ]
  },
  {
    name: 'Abscesso Periapical Agudo',
    items: [
      'Uso Interno:',
      '1. Amoxicilina + Clavulanato 875/125mg - Tomar 1 comprimido a cada 8 horas, por 7 a 10 dias.',
      '2. Dipirona Sódica 1g - Tomar 1 comprimido a cada 6 horas, suporte analgésico.',
      '3. Ibuprofeno 600mg - Tomar 1 comprimido a cada 8 horas, anti-inflamatório.'
    ]
  }
];

export default function MedicalDocumentModal({
  type,
  patientName,
  patientData,
  clinicSettings,
  onClose,
  onEmit,
  initialArrivalTime,
  initialDepartureTime
}: MedicalDocumentModalProps) {
  const [content, setContent] = useState('');
  const [daysOfRest, setDaysOfRest] = useState('1');
  const [atestadoOptions, setAtestadoOptions] = useState({
    retornarAtividades: false,
    repousoHoje: false,
    repousoDias: true,
    acompanhante: false
  });
  const [cid, setCid] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [procedureInput, setProcedureInput] = useState('');
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiError, setAiError] = useState('');
  const [arrivalTime, setArrivalTime] = useState(initialArrivalTime || '');
  const [departureTime, setDepartureTime] = useState(initialDepartureTime || '');

  const handleSuggestPrescription = async () => {
    if (!procedureInput) return;
    setIsSuggesting(true);
    setAiError('');
    try {
      const resp = await fetch("/api/suggest-prescription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ procedure: procedureInput })
      });
      const data = await resp.json();
      if (data.suggestion) {
        setContent(data.suggestion);
      } else {
        setAiError(data.error || "Falha ao gerar sugestão.");
      }
    } catch (err) {
      console.error(err);
      setAiError("Erro ao conectar com a IA. Tente novamente mais tarde.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const generatePDF = async () => {
    setIsGenerating(true);
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4'
      });

      // 1. Draw the AF logo (SVG -> PNG -> jsPDF)
      const afSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="300">
        <path d="M50 10 L20 80 L35 80 L50 40 L65 80 L80 80 Z M30 65 L70 65" stroke="#8A1F27" stroke-width="4" fill="none" />
        <path d="M50 10 L50 90 M50 50 L75 50 M50 25 L70 25" stroke="#8A1F27" stroke-width="4" fill="none" />
      </svg>`;
      const svgBase64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(afSvg)));
      
      const imgData = await new Promise<string>((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 300;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, 300, 300);
            resolve(canvas.toDataURL('image/png'));
          } else {
            resolve('');
          }
        };
        img.onerror = () => resolve('');
        img.src = svgBase64;
      });

      if (imgData) {
        doc.addImage(imgData, 'PNG', 85, 10, 40, 40); // centered top
        
        // Draw the watermarks on the right edge
        doc.setGState(new (doc as any).GState({ opacity: 0.1 }));
        for (let i = 0; i < 12; i++) {
          doc.addImage(imgData, 'PNG', 190, 10 + (i * 22), 10, 10);
        }
        doc.setGState(new (doc as any).GState({ opacity: 1.0 }));
      }

      // 2. Main Title (DR. AGNALDO FERREIRA)
      doc.setTextColor(138, 31, 39); // #8A1F27
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      const docName = clinicSettings.doctorName || 'DR. AGNALDO FERREIRA';
      doc.text(docName.toUpperCase(), 105, 55, { align: 'center', charSpace: 1.5 });
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text((clinicSettings.doctorRole || 'CIRURGIÃO DENTISTA').toUpperCase(), 105, 60, { align: 'center', charSpace: 1 });
      doc.text(clinicSettings.cro || 'CRO-MG 58714', 105, 64, { align: 'center', charSpace: 1 });

      // 3. Document Type & Body
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0); // Black
      if (type === 'atestado') {
        doc.text('ATESTADO', 105, 80, { align: 'center', charSpace: 2 });
      } else if (type === 'declaracao') {
        doc.setFontSize(15);
        doc.text('DECLARAÇÃO DE COMPARECIMENTO', 105, 80, { align: 'center', charSpace: 1 });
      } else {
        doc.text('RECEITUÁRIO', 105, 80, { align: 'center', charSpace: 2 });
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");

      if (type === 'atestado' || type === 'declaracao') {
         const prefix = type === 'atestado' ? 'Atesto que o(a) paciente ' : 'Declaro que o(a) paciente ';
         const today = new Date().toLocaleDateString('pt-BR');
         const paragraphText = `${prefix}${patientName || '__________________________________________'}, esteve neste consultório recebendo atendimento odontológico no período das ${arrivalTime || '___:___'} às ${departureTime || '___:___'} horas, do dia ${today}${type === 'declaracao' ? ' devendo retornar as suas atividades normais.' : '.'}`;
         
         const splitParagraph = doc.splitTextToSize(paragraphText, 170);
         doc.text(splitParagraph, 20, 100);

         if (type === 'atestado') {
           // Checkboxes
           const boxYStart = 125 + (splitParagraph.length * 6);
           const boxSize = 3;
           
           doc.setLineWidth(0.3);
           
           // Retornar as atividades normais.
           if (atestadoOptions.retornarAtividades) {
               doc.setFillColor(0, 0, 0);
               doc.rect(20, boxYStart, boxSize, boxSize, 'F');
           } else {
               doc.rect(20, boxYStart, boxSize, boxSize);
           }
           doc.text('Retornar as atividades normais.', 25, boxYStart + 2.5);
           
           // Permanecer em repouso hoje.
           if (atestadoOptions.repousoHoje) {
               doc.setFillColor(0, 0, 0);
               doc.rect(20, boxYStart + 10, boxSize, boxSize, 'F');
           } else {
               doc.rect(20, boxYStart + 10, boxSize, boxSize);
           }
           doc.text('Permanecer em repouso hoje.', 25, boxYStart + 12.5);
           
           // Permanecer em repouso ___ dias
           if (atestadoOptions.repousoDias) {
               doc.setFillColor(0, 0, 0);
               doc.rect(20, boxYStart + 20, boxSize, boxSize, 'F');
           } else {
               doc.rect(20, boxYStart + 20, boxSize, boxSize);
           }
           const parsedDays = parseInt(daysOfRest) || 0;
           doc.text(`Permanecer em repouso ${parsedDays > 0 ? parsedDays : '___'} dias a partir desta data.`, 25, boxYStart + 22.5);
           
           // Acompanhante.
           if (atestadoOptions.acompanhante) {
               doc.setFillColor(0, 0, 0);
               doc.rect(20, boxYStart + 30, boxSize, boxSize, 'F');
           } else {
               doc.rect(20, boxYStart + 30, boxSize, boxSize);
           }
           doc.text('Acompanhante.', 25, boxYStart + 32.5);
  
           doc.text(`CID: ${cid || '________________'}`, 20, boxYStart + 50);
         }

      } else {
         const splitContent = doc.splitTextToSize(content, 170);
         doc.text(splitContent, 20, 100);
      }

      // 4. Signature
      const bottomY = 240;
      doc.setLineWidth(0.5);
      doc.line(65, bottomY, 145, bottomY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Assinatura", 105, bottomY + 5, { align: 'center' });

      // 5. Footer (Red contact line)
      doc.setTextColor(138, 31, 39); // #8A1F27
      doc.setFontSize(9);
      doc.text(clinicSettings.address, 105, 275, { align: 'center' });
      
      const phoneLine = `(31) 98513-1303   dragnaldof@gmail.com   @dr.agnaldoferreira`;
      doc.text(phoneLine, 105, 280, { align: 'center' });

      // Output Blob
      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const filename = `${type === 'receituario' ? 'Receituario' : type === 'atestado' ? 'Atestado' : 'Declaracao'}_${patientName.replace(/\s+/g, '_')}.pdf`;

      return { blob: pdfBlob, url, filename };

    } catch (err) {
      console.error("PDF Gen Error:", err);
      throw err;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    const { url, filename } = await generatePDF();
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (type === 'declaracao' && onEmit) {
      onEmit({ arrivalTime, departureTime });
    }
  };

  const handleSendWhatsApp = async () => {
    const { url, filename, blob } = await generatePDF();
    
    if (type === 'declaracao' && onEmit) {
      onEmit({ arrivalTime, departureTime });
    }

    const docDesc = type === 'receituario' ? 'receituário' : type === 'atestado' ? 'atestado' : 'declaração de comparecimento';

    // Attempt Web Share api on Mobile
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], filename, { type: 'application/pdf' })] })) {
      try {
        await navigator.share({
          title: `Documento Odontológico - ${patientName}`,
          text: `Segue sua ${docDesc}.`,
          files: [new File([blob], filename, { type: 'application/pdf' })]
        });
        return;
      } catch (err) {
        console.error("Share failed", err);
      }
    }

    // Fallback: Download and open WhatsApp Web with text
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // After triggering download, open whatsapp
    const cleanNumber = (patientData.mobile || patientData.phone || '').replace(/\D/g, '');
    const message = `Olá ${patientName}, segue seu/sua ${docDesc} em anexo! (Envie o arquivo PDF baixado)`;
    const waUrl = cleanNumber && cleanNumber.length >= 10
      ? `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    setTimeout(() => {
       window.open(waUrl, '_blank');
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-xs">
      <div className={`bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden font-sans border border-zinc-200 w-full ${type === 'receituario' ? 'max-w-6xl h-[90vh]' : 'max-w-2xl max-h-[90vh]'}`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-[#FAF8F5]">
          <h2 className="text-xl font-bold text-[#4E1119] flex items-center gap-2">
            <FileText className="w-5 h-5" />
            {type === 'receituario' ? 'Emitir Receituário' : type === 'atestado' ? 'Emitir Atestado' : 'Emitir Declaração'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className={`flex-1 ${type === 'receituario' ? 'overflow-hidden' : 'overflow-y-auto'} p-6 space-y-6 flex flex-col min-h-0`}>
          <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 shrink-0">
             <p className="text-sm font-semibold text-zinc-700">Paciente: <span className="font-bold text-[#4E1119]">{patientName || 'NÃO INFORMADO'}</span></p>
             <p className="text-xs text-zinc-500 mt-1">
               Contato: {patientData.mobile || patientData.phone || 'Nenhum contato salvo'}
             </p>
          </div>

          {type === 'atestado' || type === 'declaracao' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Horário de Chegada</label>
                  <input
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Horário de Saída</label>
                  <input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
                  />
                </div>
              </div>

              {type === 'atestado' && (
                <>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Dias de Repouso</label>
                      <input
                        type="number"
                        min="0"
                        value={daysOfRest}
                        onChange={(e) => setDaysOfRest(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">CID (Opcional)</label>
                      <input
                        type="text"
                        placeholder="Ex: K04.0"
                        value={cid}
                        onChange={(e) => setCid(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200 mt-4">
                     <label className="block text-xs font-bold text-zinc-500 uppercase mb-3">Opções do Atestado</label>
                     <div className="space-y-3">
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input type="checkbox" checked={atestadoOptions.retornarAtividades} onChange={e => setAtestadoOptions(prev => ({...prev, retornarAtividades: e.target.checked}))} className="w-5 h-5 text-[#C09553] rounded focus:ring-[#C09553]" />
                         <span className="text-sm font-medium text-zinc-700">Retornar as atividades normais.</span>
                       </label>
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input type="checkbox" checked={atestadoOptions.repousoHoje} onChange={e => setAtestadoOptions(prev => ({...prev, repousoHoje: e.target.checked}))} className="w-5 h-5 text-[#C09553] rounded focus:ring-[#C09553]" />
                         <span className="text-sm font-medium text-zinc-700">Permanecer em repouso hoje.</span>
                       </label>
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input type="checkbox" checked={atestadoOptions.repousoDias} onChange={e => setAtestadoOptions(prev => ({...prev, repousoDias: e.target.checked}))} className="w-5 h-5 text-[#C09553] rounded focus:ring-[#C09553]" />
                         <span className="text-sm font-medium text-zinc-700">Permanecer em repouso ({daysOfRest}) dias a partir desta data.</span>
                       </label>
                       <label className="flex items-center gap-3 cursor-pointer">
                         <input type="checkbox" checked={atestadoOptions.acompanhante} onChange={e => setAtestadoOptions(prev => ({...prev, acompanhante: e.target.checked}))} className="w-5 h-5 text-[#C09553] rounded focus:ring-[#C09553]" />
                         <span className="text-sm font-medium text-zinc-700">Acompanhante.</span>
                       </label>
                     </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6 h-full flex-1 min-h-0 overflow-hidden">
              {/* Left Panel - Protocolos e Fármacos */}
              <div className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto pr-2">
                <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-bold text-[#4E1119] uppercase mb-3">Protocolos Clínicos</h3>
                  <div className="space-y-2">
                    {PROTOCOLS.map((prot, idx) => (
                      <button
                        key={idx}
                        onClick={() => setContent(prev => prev + (prev ? '\n\n' : '') + prot.items.join('\n'))}
                        className="w-full text-left p-2.5 rounded-lg border border-zinc-200 hover:border-[#C09553] hover:bg-[#FAF8F5] transition-all group flex items-start justify-between"
                      >
                        <span className="text-[11px] font-bold text-zinc-700">{prot.name}</span>
                        <Plus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#C09553]" />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm">
                  <h3 className="text-xs font-bold text-[#4E1119] uppercase mb-3">Adicionar Fármaco</h3>
                  <div className="space-y-2">
                    {DRUGS.map((drug, idx) => (
                      <button
                        key={'d'+idx}
                        onClick={() => {
                           const drugLine = `${drug.name} --------------------------- 1 cx\n${drug.posology}`;
                           setContent(prev => prev + (prev ? '\n\n' : '') + drugLine);
                        }}
                        className="w-full relative text-left p-2.5 rounded-lg border border-zinc-200 hover:border-[#C09553] hover:bg-[#FAF8F5] transition-all flex flex-col gap-1 group"
                      >
                        <div className="flex items-start justify-between w-full">
                           <span className="text-[11px] font-bold text-zinc-800">{drug.name}</span>
                           <Plus className="w-3.5 h-3.5 text-zinc-400 group-hover:text-[#C09553] flex-shrink-0" />
                        </div>
                        <span className="text-[9px] font-semibold text-zinc-400 uppercase">{drug.class}</span>
                        <span className="text-[10px] text-zinc-500 leading-tight">{drug.posology}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="bg-[#FAF8F5] p-4 rounded-xl border border-[#C09553]/30 flex flex-col gap-3">
                  <label className="block text-xs font-bold text-[#4E1119] uppercase">Gerar com IA</label>
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      placeholder="Ex: Extração siso inferior direito"
                      value={procedureInput}
                      onChange={(e) => setProcedureInput(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-300 focus:border-[#C09553] focus:ring focus:ring-[#C09553]/20"
                    />
                    <button
                      onClick={handleSuggestPrescription}
                      disabled={isSuggesting || !procedureInput}
                      className="px-3 py-2 w-full bg-[#4E1119] text-white text-xs font-bold rounded-lg hover:bg-[#3a0c12] transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSuggesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      Sugerir
                    </button>
                  </div>
                  {aiError && (
                    <p className="text-red-600 text-xs font-medium">{aiError}</p>
                  )}
                </div>
              </div>

              {/* Right Panel - Receita Viewer */}
              <div className="w-full lg:w-2/3 flex flex-col h-full bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200">
                <div className="bg-zinc-200 py-2 px-4 shadow-inner border-b border-zinc-300 flex items-center justify-between z-10">
                   <span className="text-[10px] font-bold text-zinc-500 uppercase">Visualização da Receita</span>
                   <button onClick={() => setContent('')} className="text-[10px] font-bold text-red-600 hover:underline">Limpar</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 flex justify-center">
                  <div className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-md relative group p-6 sm:p-10" style={{aspectRatio: '210/297'}}>
                     <div className="flex flex-col h-full">
                       {/* Header Paper */}
                       <div className="text-center mb-10 pb-4 border-b border-[#8A1F27]/30">
                          <h1 className="text-2xl font-bold text-[#8A1F27] tracking-wider mb-1">{clinicSettings.doctorName || 'DR. AGNALDO FERREIRA'}</h1>
                          <p className="text-[11px] uppercase tracking-widest text-[#8A1F27]">{clinicSettings.doctorRole || 'CIRURGIÃO DENTISTA'}</p>
                          <p className="text-[10px] text-zinc-500 mt-1">{clinicSettings.cro || 'CRO-MG 58714'}</p>
                       </div>
                       
                       <h2 className="text-xl font-bold text-center tracking-widest mb-6">RECEITUÁRIO</h2>
                       
                       <div className="flex-1">
                         <div className="font-semibold text-sm mb-4">Para: <span className="font-bold underline italic ml-1">{patientName || '________________________'}</span></div>
                         
                         <textarea
                           className="w-full h-[60%] resize-none border-none focus:ring-0 bg-transparent py-0 px-0 mt-2 text-sm leading-relaxed"
                           placeholder="Selecione um protocolo ou fármaco à esquerda, ou digite livremente aqui..."
                           value={content}
                           onChange={(e) => setContent(e.target.value)}
                         />
                       </div>

                       {/* Footer Paper */}
                       <div className="mt-10 pt-4 border-t border-[#8A1F27]/30 text-center">
                         <div className="w-1/2 mx-auto border-b border-zinc-800 mb-2"></div>
                         <p className="text-[10px] text-zinc-600 mb-4">Assinatura do Profissional</p>
                         
                         <p className="text-[9px] text-[#8A1F27] font-semibold">{clinicSettings.address}</p>
                         <p className="text-[9px] text-[#8A1F27]">dragnaldof@gmail.com | @dr.agnaldoferreira</p>
                       </div>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-100 bg-zinc-50 flex flex-col sm:flex-row items-center gap-3 justify-end shrink-0">
          <button
            onClick={handleDownload}
              disabled={isGenerating}
              className="w-full sm:w-auto px-5 py-2.5 bg-zinc-100 text-zinc-800 font-bold rounded-xl hover:bg-zinc-200 border border-zinc-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Baixar PDF
            </button>

            <button
              onClick={handleSendWhatsApp}
              disabled={isGenerating}
              className="w-full sm:w-auto px-5 py-2.5 bg-[#25D366] text-white font-bold rounded-xl hover:bg-[#128C7E] transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
              Baixar e Enviar WhatsApp
            </button>
          </div>
      </div>
    </div>
  );
}
