'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type DashboardData = {
  activeYear: { id: string; name: string } | null;
  coordinationNetworks: Array<{ id: string; name: string }>;
  pendingActions: number;
  stalePendingActions: number;
  validatedWithoutEvidence: number;
  overduePlanTasks: number;
  priorityPlanTasks: Array<{
    id: string;
    title: string;
    dueDate?: string | null;
    official: boolean;
    status: string;
    plan: { network: { id: string; name: string } };
  }>;
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
  const [taskMessage, setTaskMessage] = useState('');
  const [taskError, setTaskError] = useState('');
  const [taskBusy, setTaskBusy] = useState('');

  const loadDashboard = useCallback(async () => {
    const response = await fetch('/api/dashboard/me');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (!response.ok) {
      setError('No se pudo cargar el panel.');
      return;
    }
    setError('');
    setData(await response.json());
  }, [router]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  async function updatePlanTask(taskId: string, action: 'done' | 'postpone') {
    setTaskBusy(taskId + ':' + action);
    setTaskMessage('');
    setTaskError('');
    const response = await fetch(
      action === 'done' ? '/api/plans/task/' + taskId + '/status' : '/api/plans/task/' + taskId + '/postpone',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'done' ? { status: 'DONE' } : { days: 7 }),
      },
    );
    const body = await response.json().catch(() => ({}));
    setTaskBusy('');
    if (!response.ok) {
      setTaskError(
        Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo actualizar la tarea.',
      );
      return;
    }
    setTaskMessage(action === 'done' ? 'Tarea marcada como hecha.' : 'Tarea pospuesta siete días.');
    await loadDashboard();
  }

  if (error) return <main className="shell"><div className="errorBox">{error}</div></main>;
  if (!data) return (
    <main className="shell">
      <div className="loadingState" role="status" aria-live="polite">
        <span className="loadingSpinner" aria-hidden="true" />
        <strong>Preparando tu hora de coordinación…</strong>
      </div>
    </main>
  );

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

      {taskMessage && <div className="notice">{taskMessage}</div>}
      {taskError && <div className="errorBox">{taskError}</div>}

      {data.priorityPlanTasks.length > 0 && (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Acciones rápidas</p>
              <h2>Tareas próximas del plan</h2>
            </div>
            <a className="textButton" href="/coordinacion/planes">Abrir planificación completa</a>
          </div>
          <div className="assignmentList">
            {data.priorityPlanTasks.map((task) => {
              const overdue = Boolean(task.dueDate && new Date(task.dueDate) < new Date());
              return (
                <div className="assignmentRow" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <span>
                      {task.plan.network.name}
                      {task.dueDate ? ' · ' + new Date(task.dueDate).toLocaleDateString('es-ES') : ' · sin fecha'}
                      {task.official ? ' · hito oficial' : ''}
                    </span>
                  </div>
                  <div className="rowActions">
                    {overdue && <span className="badge dangerBadge">Vencida</span>}
                    <button
                      className="secondaryButton"
                      type="button"
                      disabled={Boolean(taskBusy)}
                      onClick={() => void updatePlanTask(task.id, 'done')}
                    >
                      {taskBusy === task.id + ':done' ? 'Guardando…' : 'Marcar hecha'}
                    </button>
                    {!task.official && (
                      <button
                        className="textButton"
                        type="button"
                        disabled={Boolean(taskBusy)}
                        onClick={() => void updatePlanTask(task.id, 'postpone')}
                      >
                        {taskBusy === task.id + ':postpone' ? 'Posponiendo…' : 'Posponer 7 días'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="reportNote">Los hitos oficiales pueden completarse desde aquí, pero su fecha no se puede desplazar.</p>
        </section>
      )}

      <section className="statsGrid">
        <article className="statCard"><strong>{data.pendingActions}</strong><span>actuaciones por validar</span></article>
        <article className="statCard"><strong>{data.stalePendingActions}</strong><span>pendientes desde hace más de 7 días</span></article>
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
        <a className="secondaryButton" href="/coordinacion/calendario">Calendario</a>
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
