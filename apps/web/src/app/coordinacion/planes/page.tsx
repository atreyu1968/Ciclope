'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = {
  id: string;
  name: string;
  description?: string | null;
  institutionalObjectives?: string[];
};
type User = { id: string; firstName: string; lastName: string; email: string };
type Me = { roles: string[] };
type Milestone = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  official: boolean;
};
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

const GLOBAL_ROLES = ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE'];

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
  const [me, setMe] = useState<Me | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<PlanDetail | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiPlanDraft, setAiPlanDraft] = useState('');
  const [aiPlanError, setAiPlanError] = useState('');
  const [aiPlanBusy, setAiPlanBusy] = useState(false);

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

  async function refreshMilestones() {
    const response = await fetch('/api/plans/milestones');
    if (!response.ok) return;
    setMilestones(await response.json());
  }

  async function loadBase() {
    setLoading(true);
    setError('');
    try {
      const [plansResponse, usersResponse, dashboardResponse, meResponse, milestonesResponse, networksResponse] = await Promise.all([
        fetch('/api/plans'),
        fetch('/api/users'),
        fetch('/api/dashboard/me'),
        fetch('/api/auth/me'),
        fetch('/api/plans/milestones'),
        fetch('/api/networks'),
      ]);
      if ([plansResponse, usersResponse, dashboardResponse, meResponse, milestonesResponse, networksResponse].some((response) => response.status === 401)) {
        router.push('/login');
        return;
      }
      const [planBody, userBody, dashboardBody, meBody, milestoneBody, networkBody] = await Promise.all([
        plansResponse.json().catch(() => ([])),
        usersResponse.json().catch(() => ([])),
        dashboardResponse.json().catch(() => ({})),
        meResponse.json().catch(() => ({})),
        milestonesResponse.json().catch(() => ([])),
        networksResponse.json().catch(() => ([])),
      ]);
      if (!plansResponse.ok) throw new Error(messageFrom(planBody, 'No se pudieron cargar los planes.'));
      if (!usersResponse.ok) throw new Error(messageFrom(userBody, 'No se pudo cargar el profesorado.'));
      if (!dashboardResponse.ok) throw new Error(messageFrom(dashboardBody, 'No se pudieron cargar tus coordinaciones.'));
      if (!meResponse.ok) throw new Error(messageFrom(meBody, 'No se pudo cargar tu sesión.'));
      if (!milestonesResponse.ok) throw new Error(messageFrom(milestoneBody, 'No se pudieron cargar los hitos del curso.'));
      if (!networksResponse.ok) throw new Error(messageFrom(networkBody, 'No se pudo cargar la configuración institucional de las redes.'));

      const loadedPlans = planBody as PlanListItem[];
      setPlans(loadedPlans);
      setUsers(userBody as User[]);
      setMe(meBody as Me);
      setMilestones(milestoneBody as Milestone[]);
      const configuredNetworks = networkBody as Network[];
      const configuredById = new Map(configuredNetworks.map((network) => [network.id, network]));
      setNetworks(
        ((dashboardBody.coordinationNetworks || []) as Network[]).map((network) => ({
          ...network,
          ...(configuredById.get(network.id) || {}),
        })),
      );
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

  const canManageCommonMilestones = Boolean(
    me && GLOBAL_ROLES.some((role) => me.roles.includes(role)),
  );

  const availableNetworks = useMemo(
    () => networks.filter((network) => !plans.some((plan) => plan.network.id === network.id)),
    [networks, plans],
  );

  const institutionalNetwork = detail
    ? networks.find((network) => network.id === detail.network.id)
    : undefined;

  async function proposePlanWork() {
    if (!detail) return;
    setAiPlanBusy(true);
    setAiPlanDraft('');
    setAiPlanError('');
    const response = await fetch('/api/assistant/plan-suggestions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ planId: detail.id }),
    });
    const body = await response.json().catch(() => ({}));
    setAiPlanBusy(false);
    if (!response.ok) {
      setAiPlanError(messageFrom(body, 'No se pudieron generar propuestas para el plan.'));
      return;
    }
    setAiPlanDraft(body.text || '');
  }

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

  async function createCommonMilestone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch('/api/plans/milestones', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: data.get('title'),
        description: data.get('description') || undefined,
        dueDate: data.get('dueDate'),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo crear el hito común.'));
      return;
    }

    form.reset();
    setMessage(`Hito distribuido a ${body.distributedToPlans ?? 0} planes.`);
    await Promise.all([refreshMilestones(), refreshPlans(selectedId || undefined)]);
    if (selectedId) {
      const idToReload = selectedId;
      setSelectedId('');
      queueMicrotask(() => setSelectedId(idToReload));
    }
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
          <a className="secondaryButton" href="/coordinacion/calendario">Calendario</a>
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
            {!plans.length && !loading && (
              <div className="emptyState">
                <h3>Todavía no hay planes creados</h3>
                <p>Crea un plan para una de tus redes y úsalo como base de objetivos, tareas, hitos e indicadores.</p>
              </div>
            )}
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

          {milestones.length > 0 && (
            <div className="compactForm">
              <h3>Hitos comunes del curso</h3>
              <div className="milestoneMiniList">
                {milestones.map((milestone) => (
                  <div key={milestone.id}>
                    <strong>{milestone.title}</strong>
                    <span>{new Date(milestone.dueDate).toLocaleDateString('es-ES')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canManageCommonMilestones && (
            <form className="compactForm" onSubmit={createCommonMilestone}>
              <h3>Añadir hito común</h3>
              <p className="hint">Se añadirá a todos los planes del curso y también a los que se creen después.</p>
              <label>Título<input name="title" required maxLength={240} placeholder="Ej.: Entregar informe del primer trimestre" /></label>
              <label>Fecha límite<input name="dueDate" type="date" required /></label>
              <label>Descripción<textarea name="description" rows={3} /></label>
              <button className="secondaryButton">Distribuir a todas las redes</button>
            </form>
          )}
        </aside>

        <section className="planMain">
          {loading && (
            <div className="loadingState" role="status" aria-live="polite">
              <span className="loadingSpinner" aria-hidden="true" />
              <strong>Cargando planificación…</strong>
            </div>
          )}
          {!loading && !detail && (
            <div className="emptyState">
              <h2>Selecciona o crea un plan</h2>
              <p>El panel de detalle mostrará aquí los objetivos, tareas, progreso e hitos de la red seleccionada.</p>
            </div>
          )}

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

              {institutionalNetwork && (
                institutionalNetwork.description ||
                (institutionalNetwork.institutionalObjectives?.length ?? 0) > 0
              ) && (
                <article className="panel institutionalReference">
                  <div className="panelHeader">
                    <div>
                      <p className="eyebrow">Referencia institucional del centro</p>
                      <h2>Marco de {detail.network.name}</h2>
                    </div>
                  </div>
                  {institutionalNetwork.description && (
                    <p className="preLine">{institutionalNetwork.description}</p>
                  )}
                  {(institutionalNetwork.institutionalObjectives?.length ?? 0) > 0 && (
                    <div className="institutionalObjectives">
                      <strong>Objetivos y líneas de referencia</strong>
                      <ul>
                        {institutionalNetwork.institutionalObjectives!.map((objective, index) => (
                          <li key={index}>{objective}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="reportNote">
                    Estas líneas son orientativas para redactar el plan. Los objetivos operativos del curso se crean y evalúan de forma independiente.
                  </p>
                </article>
              )}

              <article className="panel aiAssistBox">
                <div className="panelHeader">
                  <div>
                    <p className="eyebrow">Asistente de IA</p>
                    <h2>Proponer objetivos y tareas</h2>
                  </div>
                  <span className="badge warningChip">Requiere revisión humana</span>
                </div>
                <p className="hint">
                  La propuesta se genera a partir del plan actual y evita, en lo posible, duplicar lo que ya existe. No se modifica ningún dato automáticamente.
                </p>
                <button className="secondaryButton" type="button" disabled={aiPlanBusy} onClick={() => void proposePlanWork()}>
                  {aiPlanBusy ? 'Analizando el plan…' : 'Generar propuestas'}
                </button>
                {aiPlanError && <div className="errorBox">{aiPlanError}</div>}
                {aiPlanDraft && (
                  <div className="aiResult">
                    <pre>{aiPlanDraft}</pre>
                    <p className="aiReviewNotice">
                      Propuesta generada con IA. Valora su adecuación al plan, a las instrucciones institucionales y a la realidad del centro antes de crear objetivos o tareas.
                    </p>
                  </div>
                )}
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
                  {!detail.objectives.length && (
                    <div className="emptyState">
                      <h3>El plan todavía no tiene objetivos</h3>
                      <p>Añade el primer objetivo operativo para poder medir el avance y vincular actuaciones.</p>
                    </div>
                  )}
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
