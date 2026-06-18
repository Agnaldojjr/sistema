/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Procedure, ClinicSettings } from './types';

export const DEFAULT_CLINIC_SETTINGS: ClinicSettings = {
  doctorName: "Dr. Agnaldo Ferreira",
  doctorRole: "Cirurgião-Dentista Clínico Geral",
  cro: "CROMG 58714",
  address: "Rua dos Goitacazes, 375, Sala 1001 - Centro, Belo Horizonte",
  referencePoint: "Em frente ao estacionamento do Shopping Cidade",
};

export const DEFAULT_PROCEDURES: Procedure[] = [
  { id: 'p_1', name: 'Profilaxia (Limpeza)', price: 200, color: '#06b6d4' }, // cyan
  { id: 'p_2', name: 'Remoção de aparelho', price: 150, color: '#64748b' }, // slate
  { id: 'p_3', name: 'Resina 1 face', price: 200, color: '#22c55e' }, // green
  { id: 'p_4', name: 'Resina 2 faces', price: 220, color: '#84cc16' }, // lime
  { id: 'p_5', name: 'Resina 3 faces', price: 250, color: '#10b981' }, // emerald
  { id: 'p_6', name: 'Provisório', price: 200, color: '#f59e0b' }, // amber
  { id: 'p_7', name: 'Exodontia simples', price: 250, color: '#ef4444' }, // red
  { id: 'p_8', name: 'Pino de fibra', price: 250, color: '#6366f1' }, // indigo
  { id: 'p_9', name: 'Reconstrução', price: 300, color: '#3b82f6' }, // blue
  { id: 'p_10', name: 'Siso simples', price: 350, color: '#f43f5e' }, // rose
  { id: 'p_11', name: 'Faceta', price: 350, color: '#ec4899' }, // pink
  { id: 'p_12', name: 'Siso semi', price: 450, color: '#e11d48' }, // rose-600
  { id: 'p_13', name: 'Siso impactado', price: 500, color: '#be123c' }, // rose-700
  { id: 'p_14', name: 'Canal incisivo', price: 600, color: '#a855f7' }, // purple
  { id: 'p_15', name: 'Canal pré-molar', price: 700, color: '#9333ea' }, // purple-600
  { id: 'p_16', name: 'Combo Clareamento', price: 700, color: '#0ea5e9' }, // sky
  { id: 'p_17', name: 'Botox', price: 700, color: '#d946ef' }, // fuchsia
  { id: 'p_18', name: 'Clareamento', price: 800, color: '#38bdf8' }, // sky-400
  { id: 'p_19', name: 'Canal molar', price: 900, color: '#7e22ce' }, // purple-700
  { id: 'p_20', name: 'Coroa emax', price: 1500, color: '#f97316' }, // orange
  { id: 'p_21', name: 'Implante', price: 1600, color: '#14b8a6' }, // teal
  { id: 'p_22', name: 'Roach', price: 1600, color: '#a3a3a3' }, // neutral
  { id: 'p_23', name: 'Pino + provisório + coroa', price: 1800, color: '#ea580c' }, // orange-600
  { id: 'p_24', name: 'Coroa sobre implante', price: 1800, color: '#0d9488' }, // teal-600
  { id: 'p_25', name: 'Prótese total', price: 1800, color: '#737373' }, // neutral-500
];

export const TEETH_BY_SECTION = {
  panoramic: {
    title: 'Radiografia Panorâmica',
    subtitle: 'Planejamento de Implantes e Diagnóstico Geral',
    defaultTeeth: [
      18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
      48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
    ],
    commonTeeth: [],
  },
  upper: {
    title: 'Arcada Superior',
    subtitle: 'Dentes Posteriores e Anteriores Superiores',
    defaultTeeth: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
    commonTeeth: [17, 16, 15, 14, 24, 25, 26, 27], // posterior
  },
  lower: {
    title: 'Arcada Inferior',
    subtitle: 'Dentes Posteriores e Anteriores Inferiores',
    defaultTeeth: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
    commonTeeth: [47, 46, 45, 44, 34, 35, 36, 37], // posterior
  },
  smile: {
    title: 'Sorriso',
    subtitle: 'Dentes Anteriores Visíveis',
    defaultTeeth: [13, 12, 11, 21, 22, 23, 43, 42, 41, 31, 32, 33],
    commonTeeth: [12, 11, 21, 22, 23, 43, 42, 41, 31], // anterior
  },
};

// Elegant base64 SVG illustrations of teeth to serve as placeholders
// This ensures that even before they upload a real photo, they see beautiful high-quality
// stylized diagrams and can test drag-and-drop right away!
export const DEMO_SVG_PLACEHOLDERS = {
  panoramic: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%23111317;">
    <path d="M 50 300 Q 400 500 750 300 Q 400 100 50 300 Z" fill="%231a1a24" stroke="%233f2024" stroke-width="3" opacity="0.4"/>
    <text x="400" y="500" fill="%23c5a880" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="2">DEMONSTRAÇÃO: RADIOGRAFIA PANORÂMICA</text>
    <text x="400" y="530" fill="%236b7280" font-family="sans-serif" font-size="12" text-anchor="middle">Planejamento de implantes e visão geral</text>
  </svg>`,
  upper: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%23111317;">
    <!-- Dark elegant background with abstract mouth shape -->
    <path d="M 120 450 Q 400 50 680 450 Q 400 550 120 450 Z" fill="%231a1a24" stroke="%233f2024" stroke-width="3" opacity="0.4"/>
    <path d="M 200 400 Q 400 120 600 400" fill="none" stroke="%232b1317" stroke-width="40" stroke-linecap="round" opacity="0.6"/>
    <!-- Tooth representations -->
    <!-- Arcada superior teeth -->
    <g fill="%23fcf9f2" stroke="%238a7251" stroke-width="2">
      <!-- Molar Right -->
      <rect x="220" y="360" rx="15" ry="15" width="40" height="40" transform="rotate(-30, 240, 380)" />
      <rect x="260" y="300" rx="12" ry="12" width="38" height="38" transform="rotate(-20, 280, 320)" />
      <!-- Premolars Right -->
      <circle cx="310" cy="250" r="16" />
      <circle cx="340" cy="210" r="15" />
      <!-- Canine Right -->
      <path d="M363,180 Q375,155 385,180 Z" />
      <!-- Incisores -->
      <path d="M388,175 Q400,150 412,175 Z" />
      <path d="M415,175 Q427,150 439,175 Z" />
      <!-- Canine Left -->
      <path d="M442,180 Q452,155 464,180 Z" />
      <!-- Premolars Left -->
      <circle cx="487" cy="210" r="15" />
      <circle cx="517" cy="250" r="16" />
      <!-- Molars Left -->
      <rect x="527" y="290" rx="12" ry="12" width="38" height="38" transform="rotate(20, 546, 310)" />
      <rect x="567" y="345" rx="15" ry="15" width="40" height="40" transform="rotate(30, 587, 365)" />
    </g>
    <!-- Gums accent color -->
    <path d="M 210 395 Q 400 100 590 395" fill="none" stroke="%23e11d48" stroke-width="4" opacity="0.2"/>
    <text x="400" y="500" fill="%23c5a880" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="2">DEMONSTRAÇÃO: ARCADA SUPERIOR</text>
    <text x="400" y="530" fill="%236b7280" font-family="sans-serif" font-size="12" text-anchor="middle">Arraste os dentes para seus lugares reais</text>
  </svg>`,

  lower: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%23111317;">
    <!-- Arcada inferior curved path -->
    <path d="M 120 150 Q 400 550 680 150 Q 400 50 120 150 Z" fill="%231a1a24" stroke="%233f2024" stroke-width="3" opacity="0.4"/>
    <path d="M 200 200 Q 400 480 600 200" fill="none" stroke="%232b1317" stroke-width="40" stroke-linecap="round" opacity="0.6"/>
    <!-- Tooth representations -->
    <g fill="%23fcf9f2" stroke="%238a7251" stroke-width="2">
      <!-- Molar Right -->
      <rect x="220" y="200" rx="15" ry="15" width="40" height="40" transform="rotate(30, 240, 220)" />
      <rect x="260" y="260" rx="12" ry="12" width="38" height="38" transform="rotate(20, 280, 280)" />
      <!-- Premolars Right -->
      <circle cx="310" cy="320" r="15" />
      <circle cx="340" cy="360" r="14" />
      <!-- Canine Right -->
      <path d="M363,380 Q375,405 385,380 Z" />
      <!-- Incisores -->
      <path d="M388,385 Q400,410 412,385 Z" />
      <path d="M415,385 Q427,410 439,385 Z" />
      <!-- Canine Left -->
      <path d="M442,380 Q452,405 464,380 Z" />
      <!-- Premolars Left -->
      <circle cx="487" cy="360" r="14" />
      <circle cx="517" cy="320" r="15" />
      <!-- Molars Left -->
      <rect x="527" y="260" rx="12" ry="12" width="38" height="38" transform="rotate(-20, 546, 280)" />
      <rect x="567" y="200" rx="15" ry="15" width="40" height="40" transform="rotate(-30, 587, 220)" />
    </g>
    <!-- Tongue representation in center -->
    <path d="M 320 280 Q 400 380 480 280 C 470 200 330 200 320 280 Z" fill="%23b91c1c" opacity="0.3"/>
    <text x="400" y="500" fill="%23c5a880" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="2">DEMONSTRAÇÃO: ARCADA INFERIOR</text>
    <text x="400" y="530" fill="%236b7280" font-family="sans-serif" font-size="12" text-anchor="middle">Ideal para mapear procedimentos posteriores</text>
  </svg>`,

  smile: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" style="background:%23111317;">
    <!-- Smile outline lips -->
    <path d="M 150 280 Q 400 450 650 280 Q 400 360 150 280 Z" fill="%231a1a24" stroke="%233f2024" stroke-width="3" opacity="0.3"/>
    <!-- Lips outer shadow -->
    <path d="M 130 270 Q 400 490 670 270 Q 400 320 130 270 Z" fill="%23ef4444" opacity="0.15"/>
    <!-- Elegant Front teeth arch -->
    <!-- Gums Upper -->
    <rect x="180" y="210" width="440" height="40" rx="10" fill="%23db2777" opacity="0.35" />
    <g fill="%23ffffff" stroke="%239a7b56" stroke-width="2">
      <!-- Upper Teeth: Canine R, Lateral R, Central R, Central L, Lateral L, Canine L -->
      <path d="M220,240 L250,240 L245,280 L225,275 Z" />
      <rect x="252" y="240" rx="3" ry="3" width="40" height="52" />
      <rect x="295" y="240" rx="3" ry="3" width="50" height="60" />
      <rect x="347" y="240" rx="3" ry="3" width="50" height="60" />
      <rect x="400" y="240" rx="3" ry="3" width="40" height="52" />
      <path d="M443,240 L473,240 L468,275 L448,280 Z" />

      <!-- Lower Teeth: slightly lower down, narrower -->
      <rect x="255" y="305" rx="2" ry="2" width="32" height="42" />
      <rect x="290" y="305" rx="2" ry="2" width="35" height="45" />
      <rect x="328" y="305" rx="2" ry="2" width="35" height="45" />
      <rect x="366" y="305" rx="2" ry="2" width="35" height="45" />
      <rect x="404" y="305" rx="2" ry="2" width="35" height="45" />
      <rect x="442" y="305" rx="2" ry="2" width="32" height="42" />
    </g>
    <!-- Lip Outline -->
    <path d="M 130 270 Q 400 180 670 270 Q 500 295 400 295 Q 300 295 130 270 Z" fill="%23991b1b" opacity="0.3"/>
    <path d="M 130 270 Q 400 480 670 270 Q 400 370 130 270 Z" fill="%23be123c" opacity="0.4" stroke="%239f1239" stroke-width="3"/>
    <text x="400" y="130" fill="%23c5a880" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" letter-spacing="2">DEMONSTRAÇÃO: VISÃO DO SORRISO</text>
    <text x="400" y="160" fill="%236b7280" font-family="sans-serif" font-size="12" text-anchor="middle">Perfeito para dentes anteriores e planejamento estético</text>
  </svg>`,
};
