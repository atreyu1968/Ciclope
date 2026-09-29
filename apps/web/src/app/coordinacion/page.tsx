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
  inactiveNetworks: Array<{ id: string; name: string }>;
  inactiveObjectives: Array<{ id: string; title: string; network: { id: string; name: string } }>;
  estimatedMinutes: number;
  agendaMinutes: number;
  deferredPriorityCount: number;
  agenda: Array<{
    key: string;
    priority: string;
    title: string;
    href: string;
    reason: string;
    estimatedMinutes: number;
    allocatedMinutes: number;
    order: number;
  }>;
  focus: Array<{
    key: string;
    priority: string;
    title: string;
    href: string;
    reason: string;
    estimatedMinutes: number;
  }>;
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

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Agenda priorizada</p>
            <h2>Plan recomendado para tu hora semanal</h2>
          </div>
          <span className="badge success">{data.agendaMinutes} min planificados</span>
        </div>
        {data.agenda.length ? (
          <>
            <div className="assignmentList">
              {data.agenda.map((item) => (
                <a className="assignmentRow" key={item.key} href={item.href}>
                  <div>
                    <strong>{item.order}. {item.title}</strong>
                    <span>{item.reason}</span>
                  </div>
                  <span className={item.priority === 'high' ? 'badge dangerBadge' : item.priority === 'medium' ? 'badge warningChip' : 'badge'}>
                    {item.allocatedMinutes} min
                  </span>
                </a>
              ))}
            </div>
            {data.deferredPriorityCount > 0 && (
              <p className="reportNote">
                Quedan {data.deferredPriorityCount} asuntos de menor prioridad fuera de esta hora. Se mantienen visibles en «Requiere tu atención» para la siguiente sesión o para un hueco adicional.
              </p>
            )}
          </>
        ) : (
          <div className="successBox">
            <h3>No necesitas consumir la hora completa</h3>
            <p>No hay asuntos pendientes que requieran intervención en este momento.</p>
          </div>
        )}
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
        <article className="statCard"><strong>{data.inactiveNetworks.length}</strong><span>redes sin actividad reciente</span></article>
        <article className="statCard"><strong>{data.inactiveObjectives.length}</strong><span>objetivos sin actividad reciente</span></article>
      </section>

      {(data.inactiveNetworks.length > 0 || data.inactiveObjectives.length > 0) && (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Seguimiento preventivo</p>
              <h2>Actividad de los últimos 30 días</h2>
            </div>
          </div>
          <div className="twoColumns">
            <div>
              <h3>Redes sin actuaciones validadas recientes</h3>
              {data.inactiveNetworks.length ? (
                <div className="chipRow">
                  {data.inactiveNetworks.map((network) => <span className="chip" key={network.id}>{network.name}</span>)}
                </div>
              ) : <p className="empty">Todas las redes coordinadas tienen actividad reciente.</p>}
            </div>
            <div>
              <h3>Objetivos abiertos sin actividad vinculada reciente</h3>
              {data.inactiveObjectives.length ? (
                <div className="assignmentList">
                  {data.inactiveObjectives.map((objective) => (
                    <div className="assignmentRow" key={objective.id}>
                      <div>
                        <strong>{objective.title}</strong>
                        <span>{objective.network.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="empty">No se detectan objetivos abiertos sin actividad reciente.</p>}
            </div>
          </div>
        </section>
      )}

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
