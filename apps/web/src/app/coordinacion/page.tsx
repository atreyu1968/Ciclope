'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type DashboardData = {
  activeYear: { id: string; name: string } | null;
  coordinationNetworks: Array<{ id: string; name: string }>;
  pendingActions: number;
  validatedWithoutEvidence: number;
  overduePlanTasks: number;
  openStaffRequests: number;
  returnedOwnActions: number;
  unreadCommunications: number;
  communicationFollowups: number;
  savedReportSnapshots: number;
  estimatedMinutes: number;
  focus: Array<{ key: string; priority: string; title: string; href: string }>;
};

export default function CoordinationDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard/me').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setError('No se pudo cargar el panel.');
        return;
      }
      setData(await response.json());
    });
  }, [router]);

  if (error) return <main className="shell"><div className="errorBox">{error}</div></main>;
  if (!data) return <main className="shell"><p>Cargando panel…</p></main>;

  const progress = Math.min((data.estimatedMinutes / 60) * 100, 100);

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Coordinación</p>
          <h1>Mi hora de coordinación</h1>
          <p className="lead">
            {data.activeYear ? `Curso ${data.activeYear.name}. ` : ''}
            Solo se muestran asuntos que requieren tu intervención.
          </p>
          <div className="chipRow">
            {data.coordinationNetworks.map((network) => <span className="chip" key={network.id}>{network.name}</span>)}
          </div>
        </div>
        <a className="secondaryButton" href="/">Inicio</a>
      </div>

      <section className="coordinationTime">
        <div>
          <p className="eyebrow">Carga orientativa</p>
          <strong>{data.estimatedMinutes} min</strong>
          <span>para los asuntos actualmente pendientes</span>
        </div>
        <div className="timeTrack"><div className="timeFill" style={{ width: `${progress}%` }} /></div>
        <span className={data.estimatedMinutes <= 60 ? 'badge success' : 'badge dangerBadge'}>
          {data.estimatedMinutes <= 60 ? 'Dentro de la hora semanal' : 'Carga superior a una hora'}
        </span>
      </section>

      <section className="statsGrid">
        <article className="statCard"><strong>{data.pendingActions}</strong><span>actuaciones por validar</span></article>
        <article className="statCard"><strong>{data.validatedWithoutEvidence}</strong><span>validadas sin evidencia</span></article>
        <article className="statCard"><strong>{data.overduePlanTasks}</strong><span>tareas del plan vencidas</span></article>
        <article className="statCard"><strong>{data.openStaffRequests}</strong><span>consultas del claustro abiertas</span></article>
        <article className="statCard"><strong>{data.communicationFollowups}</strong><span>comunicaciones con pendientes</span></article>
        <article className="statCard"><strong>{data.savedReportSnapshots}</strong><span>informes guardados sin entregar</span></article>
        <article className="statCard"><strong>{data.unreadCommunications}</strong><span>mensajes sin leer</span></article>
        <article className="statCard"><strong>{data.returnedOwnActions}</strong><span>actuaciones tuyas devueltas</span></article>
      </section>

      <section className="panel focusPanel">
        <div className="panelHeader">
          <div><p className="eyebrow">Prioridades</p><h2>Requiere tu atención</h2></div>
        </div>
        {data.focus.length ? (
          <div className="focusList">
            {data.focus.map((item) => (
              <a className="focusRow" key={item.key} href={item.href}>
                <span className={`priorityDot ${item.priority}`} />
                <strong>{item.title}</strong>
                <span>Revisar →</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="successBox">
            <h3>Todo al día</h3>
            <p>No hay asuntos que requieran intervención en este momento.</p>
          </div>
        )}
      </section>

      <section className="quickLinks">
        <a className="secondaryButton" href="/coordinacion/actuaciones">Actuaciones</a>
        <a className="secondaryButton" href="/coordinacion/planes">Planes anuales</a>
        <a className="secondaryButton" href="/coordinacion/comunicaciones">Comunicaciones enviadas</a>
        <a className="secondaryButton" href="/coordinacion/automatizaciones">Automatizaciones</a>
        <a className="secondaryButton" href="/coordinacion/buzon">Buzón del claustro</a>
        <a className="secondaryButton" href="/comunicaciones/nueva">Publicar comunicación</a>
        <a className="secondaryButton" href="/actuaciones/nueva">Registrar actuación</a>
        <a className="secondaryButton" href="/informes">Indicadores e informes</a>
        <a className="secondaryButton" href="/informes/historico">Histórico de informes</a>
      </section>
    </main>
  );
}
