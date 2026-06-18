import React from 'react';
import { TreatmentProposal, PatientData } from '../types';
import { User, HeartPulse, MapPin, Building2, Save } from 'lucide-react';

interface PatientRegistrationTabProps {
  proposal: TreatmentProposal;
  setProposal: React.Dispatch<React.SetStateAction<TreatmentProposal>>;
}

export default function PatientRegistrationTab({ proposal, setProposal }: PatientRegistrationTabProps) {
  const pd = proposal.patientData || {};

  const handleUpdate = (field: keyof PatientData, value: string) => {
    setProposal(prev => ({
      ...prev,
      patientData: {
        ...(prev.patientData || {}),
        [field]: value
      }
    }));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProposal(prev => ({ ...prev, patientName: e.target.value.toUpperCase() }));
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden font-sans">
      
      {/* 1. Dados Cadastrais */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <User className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Dados cadastrais</h3>
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-zinc-500 font-semibold mb-1">Nome do paciente *</label>
              <input type="text" value={proposal.patientName} onChange={handleNameChange} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Nascimento</label>
              <input type="date" value={pd.birthDate || ''} onChange={e => handleUpdate('birthDate', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-zinc-500 font-semibold mb-1">Sexo</label>
                <select value={pd.gender || ''} onChange={e => handleUpdate('gender', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                  <option value=""></option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-zinc-500 font-semibold mb-1">Situação</label>
                <select value={pd.status || 'ATIVO'} onChange={e => handleUpdate('status', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Estado civil</label>
              <select value={pd.maritalStatus || ''} onChange={e => handleUpdate('maritalStatus', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                <option value=""></option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">CPF</label>
              <input type="text" placeholder="000.000.000-00" value={pd.cpf || ''} onChange={e => handleUpdate('cpf', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">RG</label>
              <input type="text" value={pd.rg || ''} onChange={e => handleUpdate('rg', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Órgão emissor/UF</label>
              <input type="text" value={pd.rgIssuer || ''} onChange={e => handleUpdate('rgIssuer', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Prontuário</label>
              <input type="text" value={pd.medicalRecord || ''} onChange={e => handleUpdate('medicalRecord', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Como conheceu a clínica?</label>
              <select value={pd.howKnewClinic || ''} onChange={e => handleUpdate('howKnewClinic', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                <option value="">Selecione</option>
                <option value="Indicação">Indicação</option>
                <option value="Redes Sociais">Redes Sociais</option>
                <option value="Google">Google</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Telefone</label>
              <input type="text" value={pd.phone || ''} onChange={e => handleUpdate('phone', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Celular</label>
              <input type="text" placeholder="(00) 00000-0000" value={pd.mobile || ''} onChange={e => handleUpdate('mobile', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-zinc-500 font-semibold mb-1">E-mail</label>
              <input type="email" value={pd.email || ''} onChange={e => handleUpdate('email', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-zinc-500 font-semibold mb-1">Observações</label>
            <textarea rows={3} value={pd.observations || ''} onChange={e => handleUpdate('observations', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none resize-y"></textarea>
          </div>

        </div>
      </div>

      {/* 2. Dados do Responsável */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <HeartPulse className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Dados do responsável</h3>
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-1">
              <label className="block text-zinc-500 font-semibold mb-1">Nome</label>
              <input type="text" value={pd.respName || ''} onChange={e => handleUpdate('respName', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Nascimento</label>
              <input type="date" value={pd.respBirthDate || ''} onChange={e => handleUpdate('respBirthDate', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Telefone</label>
              <input type="text" value={pd.respPhone || ''} onChange={e => handleUpdate('respPhone', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Celular</label>
              <input type="text" value={pd.respMobile || ''} onChange={e => handleUpdate('respMobile', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Estado civil</label>
              <select value={pd.respMaritalStatus || ''} onChange={e => handleUpdate('respMaritalStatus', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                <option value=""></option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">CPF</label>
              <input type="text" value={pd.respCpf || ''} onChange={e => handleUpdate('respCpf', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">RG</label>
              <input type="text" value={pd.respRg || ''} onChange={e => handleUpdate('respRg', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Órgão emissor/UF</label>
              <input type="text" value={pd.respRgIssuer || ''} onChange={e => handleUpdate('respRgIssuer', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Profissão</label>
              <input type="text" value={pd.respProfession || ''} onChange={e => handleUpdate('respProfession', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

        </div>
      </div>

      {/* 3. Endereço */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <MapPin className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Endereço</h3>
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">CEP</label>
              <input type="text" value={pd.cep || ''} onChange={e => handleUpdate('cep', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-zinc-500 font-semibold mb-1">Logradouro</label>
              <input type="text" value={pd.street || ''} onChange={e => handleUpdate('street', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Número</label>
              <input type="text" value={pd.number || ''} onChange={e => handleUpdate('number', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-zinc-500 font-semibold mb-1">Complemento</label>
              <input type="text" value={pd.complement || ''} onChange={e => handleUpdate('complement', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-zinc-500 font-semibold mb-1">Bairro</label>
              <input type="text" value={pd.neighborhood || ''} onChange={e => handleUpdate('neighborhood', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Cidade</label>
              <input type="text" value={pd.city || ''} onChange={e => handleUpdate('city', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Estado</label>
              <input type="text" value={pd.state || ''} onChange={e => handleUpdate('state', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

        </div>
      </div>

      {/* 4. Convênio */}
      <div className="border-b border-zinc-200">
        <div className="bg-[#8B0000] text-white px-4 py-2.5 flex items-center gap-2 border-b border-[#C09553]/30">
          <Building2 className="w-4 h-4 text-[#C09553]" />
          <h3 className="font-serif font-bold text-sm tracking-wide uppercase">Convênio</h3>
        </div>
        <div className="p-4 space-y-4 text-xs bg-[#FAF8F5]/30">
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Convênio *</label>
              <select value={pd.healthInsurance || 'PARTICULAR'} onChange={e => handleUpdate('healthInsurance', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none">
                <option value="PARTICULAR">PARTICULAR</option>
                <option value="BRADESCO">BRADESCO SAÚDE</option>
                <option value="SULAMERICA">SULAMÉRICA</option>
                <option value="AMIL">AMIL</option>
                <option value="UNIMED">UNIMED</option>
                <option value="OUTRO">OUTRO</option>
              </select>
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Carteira</label>
              <input type="text" value={pd.healthInsuranceCard || ''} onChange={e => handleUpdate('healthInsuranceCard', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
            <div>
              <label className="block text-zinc-500 font-semibold mb-1">Validade</label>
              <input type="text" placeholder="MM/AAAA" value={pd.healthInsuranceValidity || ''} onChange={e => handleUpdate('healthInsuranceValidity', e.target.value)} className="w-full border border-zinc-300 rounded p-2 focus:border-[#C09553] focus:ring-1 focus:ring-[#C09553] focus:outline-none" />
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
