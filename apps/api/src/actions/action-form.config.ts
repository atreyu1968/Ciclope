import { NetworkCode } from '../generated/prisma/client';

export type NetworkFieldDefinition = {
  key: string;
  label: string;
  type: 'select' | 'boolean' | 'text';
  help?: string;
  options?: Array<{ value: string; label: string }>;
};

export const ACTION_NETWORK_FIELDS: Record<NetworkCode, NetworkFieldDefinition[]> = {
  [NetworkCode.INNOVATION]: [
    {
      key: 'focus',
      label: 'Enfoque principal',
      type: 'select',
      options: [
        { value: 'ACTIVE_METHODOLOGIES', label: 'Metodologías activas' },
        { value: 'TECHNOLOGY', label: 'Tecnología / digitalización' },
        { value: 'APPLIED_RESEARCH', label: 'Investigación aplicada' },
        { value: 'TRANSFER', label: 'Transferencia de conocimiento' },
        { value: 'OTHER', label: 'Otro' },
      ],
    },
    {
      key: 'transferable',
      label: '¿Puede transferirse o replicarse como buena práctica?',
      type: 'boolean',
      help: 'Ayuda a identificar actuaciones reutilizables por otros equipos o centros.',
    },
    {
      key: 'externalCollaboration',
      label: '¿Ha existido colaboración externa?',
      type: 'boolean',
    },
  ],
  [NetworkCode.ENTREPRENEURSHIP]: [
    {
      key: 'focus',
      label: 'Enfoque principal',
      type: 'select',
      options: [
        { value: 'ENTREPRENEURIAL_CULTURE', label: 'Cultura emprendedora' },
        { value: 'CHALLENGE', label: 'Reto / desafío' },
        { value: 'PROJECT', label: 'Proyecto emprendedor' },
        { value: 'MENTORING', label: 'Mentorización' },
        { value: 'PRODUCTIVE_ENVIRONMENT', label: 'Conexión con entorno productivo' },
        { value: 'OTHER', label: 'Otro' },
      ],
    },
    {
      key: 'externalCollaboration',
      label: '¿Participa una empresa, profesional o entidad externa?',
      type: 'boolean',
    },
    {
      key: 'result',
      label: 'Resultado generado',
      type: 'select',
      options: [
        { value: 'IDEA', label: 'Idea / propuesta' },
        { value: 'PROTOTYPE', label: 'Prototipo' },
        { value: 'BUSINESS_MODEL', label: 'Modelo de negocio' },
        { value: 'PRESENTATION', label: 'Presentación / pitch' },
        { value: 'OTHER', label: 'Otro resultado' },
      ],
    },
  ],
  [NetworkCode.GUIDANCE]: [
    {
      key: 'focus',
      label: 'Ámbito de orientación',
      type: 'select',
      options: [
        { value: 'FP_OFFER', label: 'Oferta de Formación Profesional' },
        { value: 'TRAINING_PATHS', label: 'Itinerarios formativos' },
        { value: 'EMPLOYABILITY', label: 'Empleabilidad e inserción' },
        { value: 'CAREER_DECISION', label: 'Toma de decisiones vocacionales' },
        { value: 'SKILLS_ACCREDITATION', label: 'Acreditación de competencias' },
        { value: 'OTHER', label: 'Otro' },
      ],
    },
    {
      key: 'audience',
      label: 'Destinatario principal',
      type: 'select',
      options: [
        { value: 'STUDENTS', label: 'Alumnado' },
        { value: 'FAMILIES', label: 'Familias' },
        { value: 'TEACHERS', label: 'Profesorado' },
        { value: 'CITIZENS', label: 'Ciudadanía / agentes sociales' },
      ],
    },
    {
      key: 'externalCollaboration',
      label: '¿Ha participado una entidad o agente externo?',
      type: 'boolean',
    },
  ],
  [NetworkCode.QUALITY]: [
    {
      key: 'focus',
      label: 'Ámbito de mejora',
      type: 'select',
      options: [
        { value: 'SELF_EVALUATION', label: 'Autoevaluación' },
        { value: 'INDICATORS', label: 'Indicadores' },
        { value: 'PROCESS', label: 'Mejora de procesos' },
        { value: 'SATISFACTION', label: 'Satisfacción / percepción' },
        { value: 'EARLY_LEAVING', label: 'Prevención del abandono' },
        { value: 'EQAVET', label: 'Marco EQAVET' },
        { value: 'OTHER', label: 'Otro' },
      ],
    },
    {
      key: 'eqavetPhase',
      label: 'Fase de mejora continua',
      type: 'select',
      options: [
        { value: 'PLANNING', label: 'Planificación' },
        { value: 'IMPLEMENTATION', label: 'Implementación' },
        { value: 'EVALUATION', label: 'Evaluación' },
        { value: 'REVIEW', label: 'Revisión' },
      ],
    },
    {
      key: 'improvementGenerated',
      label: '¿Genera una acción concreta de mejora?',
      type: 'boolean',
    },
  ],
};

export function publicActionNetworkFields() {
  return Object.fromEntries(
    Object.entries(ACTION_NETWORK_FIELDS).map(([code, fields]) => [code, fields]),
  );
}
