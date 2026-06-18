import React from 'react';
import { ClinicSettings } from '../types';

interface PrintableLetterheadProps {
  children: React.ReactNode;
  clinicSettings: ClinicSettings;
}

export default function PrintableLetterhead({ children, clinicSettings }: PrintableLetterheadProps) {
  return (
    <div className="w-full bg-white text-zinc-900 font-sans print:bg-white print:p-0">
      {/* Header */}
      <div className="flex flex-col items-center justify-center pt-8 pb-12">
        {/* Logo AF */}
        <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="w-full h-full text-[#8A1F27] fill-current">
            <path d="M50 10 L20 80 L35 80 L50 40 L65 80 L80 80 Z M30 65 L70 65" strokeWidth="4" stroke="currentColor" fill="none" />
            <path d="M50 10 L50 90 M50 50 L75 50 M50 25 L70 25" strokeWidth="4" stroke="currentColor" fill="none" />
          </svg>
        </div>
        <h1 className="text-2xl tracking-[0.2em] font-medium text-[#8A1F27] uppercase">
          {clinicSettings.doctorName || 'DR. AGNALDO FERREIRA'}
        </h1>
        <p className="text-sm tracking-[0.1em] text-[#8A1F27] uppercase mt-2">
          {clinicSettings.doctorRole || 'CIRURGIÃO DENTISTA'}
        </p>
        <p className="text-xs tracking-widest text-[#8A1F27] uppercase mt-1">
          {clinicSettings.cro || 'CRO-MG 58714'}
        </p>
      </div>

      {/* Main Content */}
      <div className="min-h-[500px] px-8 sm:px-16 py-8 relative">
        {children}

        {/* Right border pattern (watermarks) */}
        <div className="absolute top-0 right-4 h-full w-8 flex flex-col justify-between opacity-10 pointer-events-none hidden print:flex">
          {Array.from({ length: 15 }).map((_, i) => (
            <svg key={i} viewBox="0 0 100 100" className="w-6 h-6 text-[#8A1F27] my-2">
               <path d="M50 10 L20 80 L35 80 L50 40 L65 80 L80 80 Z M30 65 L70 65" strokeWidth="4" stroke="currentColor" fill="none" />
               <path d="M50 10 L50 90 M50 50 L75 50 M50 25 L70 25" strokeWidth="4" stroke="currentColor" fill="none" />
            </svg>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex flex-col items-start px-8 sm:px-16 pt-12 pb-8 border-t-0">
        <h3 className="text-[#8A1F27] font-bold text-lg">Consultório Odontológico</h3>
        <h2 className="text-[#8A1F27] font-black text-2xl mb-2">{clinicSettings.doctorName}</h2>
        <p className="text-[#8A1F27] text-sm">{clinicSettings.address}</p>
        
        <div className="flex items-center gap-4 mt-2 text-[#8A1F27] text-sm font-medium">
           <span className="flex items-center gap-1">
             <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
             (31) 98513-1303
           </span>
           <span className="flex items-center gap-1">
             <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
             dragnaldof@gmail.com
           </span>
           <span className="flex items-center gap-1">
             <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
             @dr.agnaldoferreira
           </span>
        </div>
      </div>
    </div>
  );
}
