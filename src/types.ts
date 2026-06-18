/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Procedure {
  id: string;
  name: string;
  price: number;
  color: string; // Hex color code
}

export interface ToothMarker {
  id: string; // Unique GUID or composite ID, e.g. 'upper-14'
  toothNumber: number; // e.g. 14, 21
  x: number; // Horizontal position in percentage (0 to 100)
  y: number; // Vertical position in percentage (0 to 100)
  procedures: string[]; // List of Procedure IDs applied to this tooth
  notes?: string; // Optional specific clinical observations/notes for this tooth
  procedureInstances?: {
    id: string;
    procedureId: string;
    name: string;
    price: number;
    includeFinancial: boolean;
    status: 'A realizar' | 'Realizado' | 'Em andamento' | 'Cancelado';
    date: string;
    dentist: string;
    faces?: string[];
    observation?: string;
  }[];
}

export interface PhotoSection {
  id: 'upper' | 'lower' | 'smile' | 'panoramic';
  title: string;
  subtitle: string;
  image: string | null; // Data URL or reference image path
  markers: ToothMarker[];
}

export interface ClinicSettings {
  doctorName: string;
  doctorRole: string;
  cro: string;
  address: string;
  referencePoint: string;
}

export interface PatientData {
  // Dados Cadastrais
  birthDate?: string;
  gender?: string;
  status?: string;
  maritalStatus?: string;
  cpf?: string;
  rg?: string;
  rgIssuer?: string;
  medicalRecord?: string;
  howKnewClinic?: string;
  phone?: string;
  mobile?: string;
  email?: string;
  observations?: string;

  // Dados do responsável
  respName?: string;
  respBirthDate?: string;
  respPhone?: string;
  respMobile?: string;
  respMaritalStatus?: string;
  respCpf?: string;
  respRg?: string;
  respRgIssuer?: string;
  respProfession?: string;

  // Endereço
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;

  // Convênio
  healthInsurance?: string;
  healthInsuranceCard?: string;
  healthInsuranceValidity?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CRMPatient extends PatientData {
  id: string; // unique ID
  codigo_paciente?: string; // e.g. codigo_cliente
  name: string;
}

export interface CRMAppointment {
  id: string;
  patientId: string;
  patientName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  dentist: string;
  specialty: string;
  status: 'Agendado' | 'Confirmado' | 'Atendido' | 'Faltou' | 'Cancelado';
  room?: string;
  clinic?: string;
  observations?: string;
}

export interface CRMClinicalHistory {
  id: string;
  patientId: string;
  date: string; // YYYY-MM-DD
  proceduresPerformed: string;
  treatmentEvolution: string;
  recalls?: string;
  observations?: string;
}

export interface CRMCommunication {
  id: string;
  patientId: string;
  type: string; // 'Confirmação' | 'Lembrete' | 'Outro'
  date: string;
  message: string;
  token?: string; // confirmation token
  status: string; // 'Enviado' | 'Respondido' | 'Confirmado'
  contactsHistory?: string;
}

export interface TreatmentProposal {
  patientName: string;
  patientData?: PatientData;
  status?: 'Aberto (paciente não pagou)' | 'Aprovado (paciente pagou)' | 'Aguardando Aprovação' | 'Em Andamento' | 'Concluído' | 'Arquivado';
  notes: string;
  discountPercent: number; // e.g. 5
  pixDiscountLabel: string; // e.g. "5% DESCONTO NO PIX"
  installments: number; // e.g. 12
  installmentsLabel: string; // e.g. "Parcelamento em até 12x (com taxas)"
  customDiscountAmount: number; // manual discount over total if they want
  showTotalBySection: boolean; // if we want to show totals for Upper/Lower/Smile separately
  markerSize?: number; // customizable circle marker size in pixels
}
