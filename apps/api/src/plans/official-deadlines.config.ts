export type OfficialPlanDeadline = {
  key: string;
  title: string;
  description: string;
  dueDate: string;
};

const OFFICIAL_DEADLINES: Record<string, OfficialPlanDeadline[]> = {
  '2026-2027': [
    {
      key: 'ACTION_PLAN',
      title: 'Presentar el Plan de Acción de la red',
      description: 'Hito oficial del proyecto de Redes de las Enseñanzas Profesionales. Revisar el plan, completar objetivos y presentar la documentación requerida por la DGFPERE.',
      dueDate: '2026-10-30T23:59:00+01:00',
    },
    {
      key: 'FINAL_MEMORY',
      title: 'Presentar la memoria final del Plan de Acción',
      description: 'Hito oficial del proyecto de Redes de las Enseñanzas Profesionales. Generar la memoria final a partir de las actuaciones, evidencias e indicadores consolidados.',
      dueDate: '2027-06-18T23:59:00+01:00',
    },
  ],
};

export function officialPlanDeadlines(academicYearName: string) {
  return OFFICIAL_DEADLINES[academicYearName] ?? [];
}
