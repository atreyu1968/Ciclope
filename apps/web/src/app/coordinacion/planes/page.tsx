'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string };
type User = { id: string; firstName: string; lastName: string; email: string };
type PlanListItem = {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  network: Network;
  academicYear: { id: string; name: string; isActive: boolean };
  _count: { objectives: number; tasks: number };
};
type Objective = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  metric?: string | null;
  targetValue?: number | null;
  currentValue?: number | null;
  progressPercent?: number | null;
  linkedValidatedActions: number;
};
type Task = {
  id: string;
  title: string;
  description?: string | null;
  dueDate?: string | null;
  status: string;
  official?: boolean;
  completedAt?: string | null;
  owner?: User | null;
  objective?: { id: string; title: string } | null;
};
type PlanDetail = {
  id: string;
  title: string;
  summary?: string | null;
  status: string;
  network: Network;
  academicYear: { id: string; name: string; isActive: boolean };
  objectives: Objective[];
  tasks: Task[];
};

const metricLabels: Record<string, string> = {
  ACTIONS: 'Actuaciones validadas',
  PARTICIPATIONS: 'Participaciones de alumnado',
  HOURS: 'Horas registradas',
  EVIDENCE: 'Evidencias',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  ACTIVE: 'Activo',
  CLOSED: 'Cerrado',
  PLANNED: 'Planificado',
  IN_PROGRESS: 'En curso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
  TODO: 'Pendiente',
  DONE: 'Hecha',
};

function messageFrom(body: any, fallback: string) {
  return Array.isArray(body?.message) ? body.message.join(' ') : body?.message || fallback;
}

export default function AnnualPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function refreshPlans(preferredId?: string) {
    const response = await fetch('/api/plans');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    const body = await response.json().catch(() => ([]));
    if (!response.ok) throw new Error(messageFrom(body, 'No se pudieron cargar los planes.'));
    const loaded = body as PlanListItem[];
    setPlans(loaded);
    setSelectedId((current) => {
      const wanted = preferredId || current;
      return wanted && loaded.some((item) => item.id === wanted) ? wanted : loaded[0]?.id || '';
    });
  }

  async function loadBase() {
    setLoading(true);
    setError('');
    try {
      const [plansResponse, usersResponse, dashboardResponse] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/users'),
        fetch('/api/dashboard/me'),
      ]);
      if ([plansResponse, usersResponse, dashboardResponse].some((response) => response.status === 401)) {
        router.push('/login');
        return;
      }
      const [planBody, userBody, dashboardBody] = await Promise.all([
        plansResponse.json().catch(() => ([])),
        usersResponse.json().catch(() => ([])),
        dashboardResponse.json().catch(() => ({})),
      ]);
      if (!plansResponse.ok) throw new Error(messageFrom(planBody, 'No se pudieron cargar los planes.'));
      if (!usersResponse.ok) throw new Error(messageFrom(userBody, 'No se pudo cargar el profesorado.'));
      if (!dashboardResponse.ok) throw new Error(messageFrom(dashboardBody, 'No se pudieron cargar tus coordinaciones.'));

      const loadedPlans = planBody as PlanListItem[];
      setPlans(loadedPlans);
      setUsers(userBody as User[]);
      setNetworks((dashboardBody.coordinationNetworks || []) as Network[]);
      setSelectedId((current) =>
        current && loadedPlans.some((item) => item.id === current) ? current : loadedPlans[0]?.id || '',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la planificación.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadBase(); }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetch('/api/plans/' + selectedId).then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(messageFrom(body, 'No se pudo cargar el plan.'));
        return;
      }
      setDetail(body);
    });
  }, [selectedId, router]);

  const availableNetworks = useMemo(
    () => networks.filter((network) => !plans.some((plan) => plan.network.id === network.id)),
    [networks, plans],
  );

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch('/api/plans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        networkId: data.get('networkId'),
        title: data.get('title') || undefined,
        summary: data.get('summary') || undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo crear el plan.'));
      return;
    }
    form.reset();
    setMessage('Plan anual creado.');
    await refreshPlans(body.id);
  }

  async function updatePlanStatus(status: string) {
    if (!detail) return;
    const response = await fetch('/api/plans/' + detail.id + '/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo cambiar el estado del plan.'));
      return;
    }
    setMessage('Estado del plan actualizado.');
    await refreshPlans(detail.id);
  }

  async function createObjective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setMessage('');
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const metric = String(data.get('metric') || '');
    const targetRaw = String(data.get('targetValue') || '');
    const response = await fetch('/api/plans/' + detail.id + '/objectives', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: data.get('title'),
        description: data.get('description') || undefined,
        metric: metric || undefined,
        targetValue: metric && targetRaw ? Number(targetRaw) : undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo crear el objetivo.'));
      return;
    }
    form.reset();
    setMessage('Objetivo añadido al plan.');
    setSelectedId('');
    queueMicrotask(() => setSelectedId(detail.id));
    await refreshPlans(detail.id);
  }

  async function updateObjectiveStatus(id: string, status: string) {
    const response = await fetch('/api/plans/objective/' + id + '/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo actualizar el objetivo.'));
      return;
    }
    if (detail) {
      const idToReload = detail.id;
      setSelectedId('');
      queueMicrotask(() => setSelectedId(idToReload));
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail) return;
    setMessage('');
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch('/api/plans/' + detail.id + '/tasks', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: data.get('title'),
        description: data.get('description') || undefined,
        objectiveId: data.get('objectiveId') || undefined,
        ownerId: data.get('ownerId') || undefined,
        dueDate: data.get('dueDate') || undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo crear la tarea.'));
      return;
    }
    form.reset();
    setMessage('Tarea añadida al plan.');
    const idToReload = detail.id;
    setSelectedId('');
    queueMicrotask(() => setSelectedId(idToReload));
    await refreshPlans(idToReload);
  }

  async function updateTaskStatus(id: string, status: string) {
    const response = await fetch('/api/plans/task/' + id + '/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo actualizar la tarea.'));
      return;
    }
    if (detail) {
      const idToReload = detail.id;
      setSelectedId('');
      queueMicrotask(() => setSelectedId(idToReload));
    }
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Planificación anual</p>
          <h1>Planes de las redes</h1>
          <p className="lead">
            Define objetivos y tareas una sola vez. CÍclope calcula el avance a partir de las actuaciones validadas y sus evidencias.
          </p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/informes">Ver indicadores</a>
          <a className="secondaryButton" href="/coordinacion">Volver</a>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}
      {error && <div className="errorBox">{error}</div>}

      <section className="planLayout">
        <aside className="panel">
          <div className="panelHeader">
            <div><p className="eyebrow">Curso activo</p><h2>Planes</h2></div>
          </div>
          <div className="planList">
            {plans.map((plan) => (
              <button
                type="button"
                className={'planRow ' + (selectedId === plan.id ? 'selected' : '')}
                key={plan.id}
                onClick={() => setSelectedId(plan.id)}
              >
                <span><strong>{plan.network.name}</strong><small>{plan.title}</small></span>
                <span className="badge">{statusLabels[plan.status] || plan.status}</span>
              </button>
            ))}
            {!plans.length && !loading && <p className="empty">Todavía no hay planes creados.</p>}
          </div>

          {availableNetworks.length > 0 && (
            <form className="compactForm" onSubmit={createPlan}>
              <h3>Crear plan</h3>
              <label>Red
                <select name="networkId" required defaultValue="">
                  <option value="" disabled>Selecciona una red</option>
                  {availableNetworks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
                </select>
              </label>
              <label>Título<input name="title" placeholder="Opcional: se genera automáticamente" /></label>
              <label>Resumen<textarea name="summary" rows={4} placeholder="Prioridades y alcance del plan" /></label>
              <button className="primaryButton">Crear plan anual</button>
            </form>
          )}
        </aside>

        <section className="planMain">
          {loading && <div className="panel"><p>Cargando planificación…</p></div>}
          {!loading && !detail && <div className="panel"><p className="empty">Selecciona o crea un plan para comenzar.</p></div>}

          {detail && (
            <>
              <article className="panel">
                <div className="panelHeader">
                  <div>
                    <p className="eyebrow">{detail.network.name} · {detail.academicYear.name}</p>
                    <h2>{detail.title}</h2>
                    {detail.summary && <p className="lead preLine">{detail.summary}</p>}
                  </div>
                  <label className="statusControl">Estado
                    <select value={detail.status} onChange={(event) => void updatePlanStatus(event.target.value)}>
                      <option value="DRAFT">Borrador</option>
                      <option value="ACTIVE">Activo</option>
                      <option value="CLOSED">Cerrado</option>
                    </select>
                  </label>
                </div>
              </article>

              <article className="panel">
                <div className="panelHeader">
                  <div><p className="eyebrow">Resultados</p><h2>Objetivos</h2></div>
                  <span className="badge">{detail.objectives.length} objetivos</span>
                </div>
                <div className="objectiveList">
                  {detail.objectives.map((objective) => (
                    <div className="objectiveCard" key={objective.id}>
                      <div className="panelHeader">
                        <div>
                          <strong>{objective.title}</strong>
                          {objective.description && <p className="hint preLine">{objective.description}</p>}
                        </div>
                        <select value={objective.status} onChange={(event) => void updateObjectiveStatus(objective.id, event.target.value)}>
                          <option value="PLANNED">Planificado</option>
                          <option value="IN_PROGRESS">En curso</option>
                          <option value="COMPLETED">Completado</option>
                          <option value="CANCELLED">Cancelado</option>
                        </select>
                      </div>
                      {objective.metric ? (
                        <div className="objectiveMetric">
                          <div>
                            <span>{metricLabels[objective.metric] || objective.metric}</span>
                            <strong>{objective.currentValue ?? 0} / {objective.targetValue ?? '—'}</strong>
                          </div>
                          <div className="progressTrack">
                            <div className="progressValue" style={{ width: (objective.progressPercent ?? 0) + '%' }} />
                          </div>
                          <span>{objective.progressPercent ?? 0}% · {objective.linkedValidatedActions} actuaciones vinculadas</span>
                        </div>
                      ) : (
                        <p className="hint">{objective.linkedValidatedActions} actuaciones validadas vinculadas. Objetivo sin métrica automática.</p>
                      )}
                    </div>
                  ))}
                  {!detail.objectives.length && <p className="empty">Añade el primer objetivo del plan.</p>}
                </div>

                <form className="compactForm planForm" onSubmit={createObjective}>
                  <h3>Nuevo objetivo</h3>
                  <label>Objetivo<input name="title" required maxLength={240} /></label>
                  <label>Descripción<textarea name="description" rows={3} /></label>
                  <div className="twoColumns">
                    <label>Métrica automática
                      <select name="metric" defaultValue="">
                        <option value="">Sin métrica</option>
                        <option value="ACTIONS">Actuaciones validadas</option>
                        <option value="PARTICIPATIONS">Participaciones de alumnado</option>
                        <option value="HOURS">Horas registradas</option>
                        <option value="EVIDENCE">Evidencias</option>
                      </select>
                    </label>
                    <label>Meta<input name="targetValue" type="number" min="0" step="0.1" placeholder="Solo si eliges métrica" /></label>
                  </div>
                  <button className="secondaryButton">Añadir objetivo</button>
                </form>
              </article>

              <article className="panel">
                <div className="panelHeader">
                  <div><p className="eyebrow">Ejecución</p><h2>Tareas</h2></div>
                  <span className="badge">{detail.tasks.length} tareas</span>
                </div>
                <div className="taskList">
                  {detail.tasks.map((task) => {
                    const overdue = task.dueDate && new Date(task.dueDate) < new Date() && !['DONE', 'CANCELLED'].includes(task.status);
                    return (
                      <div className={'taskRow ' + (overdue ? 'overdue' : '')} key={task.id}>
                        <div>
                          <div className="rowActions">
                            <strong>{task.title}</strong>
                            {task.official && <span className="badge success">Hito oficial</span>}
                          </div>
                          <span>
                            {task.owner ? task.owner.firstName + ' ' + task.owner.lastName : 'Sin responsable'}
                            {task.objective ? ' · ' + task.objective.title : ''}
                            {task.dueDate ? ' · ' + new Date(task.dueDate).toLocaleDateString('es-ES') : ''}
                          </span>
                        </div>
                        <select value={task.status} onChange={(event) => void updateTaskStatus(task.id, event.target.value)}>
                          <option value="TODO">Pendiente</option>
                          <option value="IN_PROGRESS">En curso</option>
                          <option value="DONE">Hecha</option>
                          <option value="CANCELLED">Cancelada</option>
                        </select>
                      </div>
                    );
                  })}
                  {!detail.tasks.length && <p className="empty">No hay tareas registradas.</p>}
                </div>

                <form className="compactForm planForm" onSubmit={createTask}>
                  <h3>Nueva tarea</h3>
                  <label>Tarea<input name="title" required maxLength={240} /></label>
                  <label>Descripción<textarea name="description" rows={3} /></label>
                  <div className="twoColumns">
                    <label>Objetivo
                      <select name="objectiveId" defaultValue="">
                        <option value="">Sin vincular a objetivo</option>
                        {detail.objectives.map((objective) => <option key={objective.id} value={objective.id}>{objective.title}</option>)}
                      </select>
                    </label>
                    <label>Responsable
                      <select name="ownerId" defaultValue="">
                        <option value="">Sin asignar</option>
                        {users.map((user) => <option key={user.id} value={user.id}>{user.lastName}, {user.firstName}</option>)}
                      </select>
                    </label>
                  </div>
                  <label>Fecha límite<input name="dueDate" type="date" /></label>
                  <button className="secondaryButton">Añadir tarea</button>
                </form>
              </article>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
