'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type AutomationStatus = {
  enabled: boolean;
  running: boolean;
  intervalMinutes: number;
  lastRunAt?: string | null;
  lastCompletedAt?: string | null;
  lastQueued: number;
  lastError?: string | null;
  weeklySummaryWeekday: string;
  counters: {
    overdueTasks: number;
    upcomingMilestones: number;
    failedMail: number;
    queuedMail: number;
  };
};

const WEEKDAYS: Record<string, string> = {
  MON: 'lunes',
  TUE: 'martes',
  WED: 'miércoles',
  THU: 'jueves',
  FRI: 'viernes',
  SAT: 'sábado',
  SUN: 'domingo',
};

export default function AutomationsStatusPage() {
  const router = useRouter();
  const [data, setData] = useState<AutomationStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/automations/status').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setError('No se pudo consultar el estado de las automatizaciones.');
        return;
      }
      setData(await response.json());
    }).catch(() => setError('No se pudo consultar el estado de las automatizaciones.'));
  }, [router]);

  if (error) return <main className="shell"><div className="errorBox">{error}</div></main>;
  if (!data) return <main className="shell"><p>Cargando automatizaciones…</p></main>;

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Coordinación · Automatizaciones</p>
          <h1>Estado de automatizaciones</h1>
          <p className="lead">
            Supervisión de los avisos que CÍCLOPE ejecuta automáticamente para reducir comprobaciones manuales.
          </p>
        </div>
        <a className="secondaryButton" href="/coordinacion">Mi hora de coordinación</a>
      </div>

      {data.lastError && <div className="errorBox"><strong>Último error</strong><p>{data.lastError}</p></div>}

      <section className="statsGrid">
        <article className="statCard">
          <strong>{data.enabled ? 'ON' : 'OFF'}</strong>
          <span>motor automático</span>
        </article>
        <article className="statCard">
          <strong>{data.intervalMinutes} min</strong>
          <span>intervalo de revisión</span>
        </article>
        <article className="statCard">
          <strong>{data.lastQueued}</strong>
          <span>avisos en la última pasada</span>
        </article>
        <article className="statCard">
          <strong>{data.running ? 'Sí' : 'No'}</strong>
          <span>ejecutándose ahora</span>
        </article>
      </section>

      <section className="adminGrid">
        <article className="panel">
          <p className="eyebrow">Situación actual</p>
          <h2>Elementos que requieren seguimiento</h2>
          <div className="statsRow">
            <div><strong>{data.counters.overdueTasks}</strong><span>tareas vencidas</span></div>
            <div><strong>{data.counters.upcomingMilestones}</strong><span>hitos próximos</span></div>
            <div><strong>{data.counters.queuedMail}</strong><span>correos en cola</span></div>
            <div><strong>{data.counters.failedMail}</strong><span>correos fallidos</span></div>
          </div>
          <div className="rowActions">
            <a className="secondaryButton" href="/coordinacion/planes">Abrir planes</a>
            <a className="secondaryButton" href="/coordinacion/comunicaciones">Revisar correo</a>
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Ejecución</p>
          <h2>Última actividad</h2>
          <p>
            Último inicio: <strong>{data.lastRunAt ? new Date(data.lastRunAt).toLocaleString('es-ES') : 'Aún no registrado'}</strong>
          </p>
          <p>
            Última finalización: <strong>{data.lastCompletedAt ? new Date(data.lastCompletedAt).toLocaleString('es-ES') : 'Aún no registrada'}</strong>
          </p>
          <p>
            Resumen semanal: <strong>{WEEKDAYS[data.weeklySummaryWeekday] || data.weeklySummaryWeekday}</strong>.
          </p>
          <p className="hint">
            Los recordatorios utilizan claves de deduplicación, por lo que una ejecución repetida no genera el mismo aviso varias veces.
          </p>
        </article>
      </section>

      <section className="panel">
        <p className="eyebrow">Automatizaciones activas</p>
        <h2>Qué hace CÍCLOPE sin intervención manual</h2>
        <div className="assignmentList">
          <div className="assignmentRow"><div><strong>Tareas del plan</strong><span>Avisa antes del vencimiento y cuando una tarea asignada queda vencida.</span></div></div>
          <div className="assignmentRow"><div><strong>Comunicaciones</strong><span>Recuerda respuestas pendientes antes y después del plazo.</span></div></div>
          <div className="assignmentRow"><div><strong>Hitos del curso</strong><span>Avisa a coordinadores de hitos comunes próximos.</span></div></div>
          <div className="assignmentRow"><div><strong>Resumen semanal</strong><span>Envía a cada coordinador solo los asuntos que afectan a sus redes o a CÍCLOPE.</span></div></div>
        </div>
      </section>
    </main>
  );
}
