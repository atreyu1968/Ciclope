'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string; code: string };
type User = {
  id: string; firstName: string; lastName: string; email: string; active: boolean;
  networkCoordinations: Array<{ id: string; network: Network }>;
  ciclopeCoordinations: Array<{ id: string }>;
};
type Coordinator = {
  id: string; isPrimary: boolean;
  network: Network;
  user: { id: string; firstName: string; lastName: string; email: string; active?: boolean };
};
type CiclopeCoordinator = {
  id: string; isPrimary: boolean;
  user: { id: string; firstName: string; lastName: string; email: string; active?: boolean };
};
type Year = {
  id: string; name: string; startsAt: string; endsAt: string; isActive: boolean; closedAt?: string | null;
  networkCoordinators: Coordinator[];
  ciclopeCoordinators: CiclopeCoordinator[];
  _count: { actions: number; communications: number; groups: number };
};

function messageFrom(body: any, fallback: string) {
  return Array.isArray(body?.message) ? body.message.join(' ') : body?.message || fallback;
}

export default function AcademicYearsPage() {
  const router = useRouter();
  const [years, setYears] = useState<Year[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [userId, setUserId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [yearsResponse, usersResponse, networksResponse] = await Promise.all([
        fetch('/api/academic-years'), fetch('/api/users'), fetch('/api/networks'),
      ]);
      if (yearsResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!yearsResponse.ok || !usersResponse.ok || !networksResponse.ok) {
        setError('No se pudieron cargar los datos administrativos.');
        return;
      }
      const [yearData, userData, networkData] = await Promise.all([
        yearsResponse.json(), usersResponse.json(), networksResponse.json(),
      ]);
      setError('');
      setYears(yearData);
      setUsers(userData);
      setNetworks(networkData);
      if (!selectedYear) {
        const active = yearData.find((item: Year) => item.isActive) ?? yearData[0];
        setSelectedYear(active?.id ?? '');
      }
    } catch {
      setError('No se pudieron cargar los datos administrativos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const year = useMemo(() => years.find((item) => item.id === selectedYear), [years, selectedYear]);
  const activeUsers = users.filter((user) => user.active);

  async function createYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/academic-years', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo crear el curso académico.'));
      return;
    }
    setMessage('Curso académico creado. Debes asignar las coordinaciones antes de activarlo.');
    event.currentTarget.reset();
    await load();
    setSelectedYear(body.id);
  }

  async function activate(id: string) {
    setWorking(true);
    setMessage('');
    setError('');
    const response = await fetch(`/api/academic-years/${id}/activate`, { method: 'PATCH' });
    const body = await response.json().catch(() => ({}));
    setWorking(false);
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo activar el curso.'));
      return;
    }
    setMessage('Curso académico activado.');
    await load();
  }

  async function closeYear(id: string) {
    setWorking(true);
    setMessage('');
    setError('');
    const checkResponse = await fetch(`/api/academic-years/${id}/close-check`);
    const check = await checkResponse.json().catch(() => ({}));

    if (!checkResponse.ok) {
      setWorking(false);
      setError(messageFrom(check, 'No se pudo comprobar el cierre del curso.'));
      return;
    }

    if (!check.canClose) {
      setWorking(false);
      setError(
        `No se puede cerrar todavía: ${check.blockers.pendingActions} actuaciones pendientes/devueltas y ${check.blockers.draftCommunications} comunicaciones en borrador.`,
      );
      return;
    }

    const warning = check.warnings.openTasks
      ? ` Quedan ${check.warnings.openTasks} tareas del plan sin cerrar; se conservarán en el histórico.`
      : '';
    if (!window.confirm(`Se cerrará definitivamente el curso ${check.year.name}.${warning} ¿Continuar?`)) {
      setWorking(false);
      return;
    }

    const response = await fetch(`/api/academic-years/${id}/close`, { method: 'PATCH' });
    const body = await response.json().catch(() => ({}));
    setWorking(false);
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo cerrar el curso.'));
      return;
    }
    setMessage('Curso cerrado. Ya puedes activar el curso siguiente.');
    await load();
  }

  async function rollover(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!year) return;
    setWorking(true);
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/academic-years/${year.id}/rollover`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        startsAt: form.get('startsAt'),
        endsAt: form.get('endsAt'),
        copyGroups: form.get('copyGroups') === 'on',
        copyCoordinators: form.get('copyCoordinators') === 'on',
      }),
    });
    const body = await response.json().catch(() => ({}));
    setWorking(false);
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo preparar el curso siguiente.'));
      return;
    }
    setMessage('Curso siguiente preparado sin copiar actuaciones ni comunicaciones.');
    event.currentTarget.reset();
    await load();
    setSelectedYear(body.id);
  }

  async function assignNetwork() {
    if (!selectedYear || !userId || !networkId) return;
    setError('');
    const response = await fetch(`/api/academic-years/${selectedYear}/network-coordinators`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, networkId, isPrimary: true }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo asignar la coordinación.'));
      return;
    }
    setMessage('Coordinación asignada.');
    await load();
  }

  async function assignCiclope() {
    if (!selectedYear || !userId) return;
    setError('');
    const response = await fetch(`/api/academic-years/${selectedYear}/ciclope-coordinators`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, isPrimary: true }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo asignar CÍCLOPE.'));
      return;
    }
    setMessage('Coordinación CÍCLOPE asignada.');
    await load();
  }

  async function removeNetwork(id: string) {
    const assignment = year?.networkCoordinators.find((item) => item.id === id);
    const label = assignment
      ? `${assignment.network.name} de ${assignment.user.firstName} ${assignment.user.lastName}`
      : 'esta coordinación';
    if (!window.confirm(`¿Quitar ${label}? El histórico del curso se conservará, pero la persona perderá esta responsabilidad activa.`)) return;
    setWorking(true);
    const response = await fetch(`/api/academic-years/network-coordinators/${id}`, { method: 'DELETE' });
    setWorking(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(messageFrom(body, 'No se pudo quitar la coordinación.'));
      return;
    }
    setMessage('Coordinación retirada.');
    await load();
  }

  async function removeCiclope(id: string) {
    const assignment = year?.ciclopeCoordinators.find((item) => item.id === id);
    const label = assignment
      ? `${assignment.user.firstName} ${assignment.user.lastName}`
      : 'la persona seleccionada';
    if (!window.confirm(`¿Quitar la coordinación CÍCLOPE de ${label}? El histórico del curso se conservará.`)) return;
    setWorking(true);
    const response = await fetch(`/api/academic-years/ciclope-coordinators/${id}`, { method: 'DELETE' });
    setWorking(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(messageFrom(body, 'No se pudo quitar la coordinación CÍCLOPE.'));
      return;
    }
    setMessage('Coordinación CÍCLOPE retirada.');
    await load();
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Cursos académicos y coordinaciones</h1>
          <p className="lead">
            Las responsabilidades se asignan por curso. Un mismo docente puede coordinar varias redes simultáneamente y el histórico se conserva al cerrar cada curso.
          </p>
        </div>
        <a className="secondaryButton" href="/admin">Administración</a>
      </div>

      {message && <div className="notice">{message}</div>}
      {error && <div className="errorBox">{error}</div>}
      {loading && !error && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando cursos y coordinaciones…</strong>
        </div>
      )}

      <section className="adminGrid">
        <article className="panel">
          <h2>Cursos académicos</h2>
          <div className="yearList">
            {!loading && !years.length && !error && (
              <div className="emptyState">
                <h3>No hay cursos académicos configurados</h3>
                <p>Crea el primer curso y asigna sus coordinaciones antes de activarlo.</p>
              </div>
            )}
            {years.map((item) => (
              <button className={`yearRow ${selectedYear === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelectedYear(item.id)}>
                <span>
                  <strong>{item.name}</strong>
                  <small>{item._count.actions} actuaciones · {item._count.communications} comunicaciones · {item._count.groups} grupos</small>
                </span>
                <span className={item.isActive ? 'badge success' : 'badge'}>
                  {item.isActive ? 'Activo' : item.closedAt ? 'Cerrado' : 'Preparación'}
                </span>
              </button>
            ))}
          </div>

          <form className="compactForm" onSubmit={createYear}>
            <h3>Crear curso vacío</h3>
            <label>Nombre<input name="name" placeholder="2027-2028" required /></label>
            <div className="twoColumns">
              <label>Inicio<input type="date" name="startsAt" required /></label>
              <label>Fin<input type="date" name="endsAt" required /></label>
            </div>
            <button className="secondaryButton">Crear curso</button>
          </form>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Curso seleccionado</p>
              <h2>{year?.name ?? '—'}</h2>
            </div>
            {year && (
              <div className="rowActions">
                {!year.isActive && !year.closedAt && (
                  <button className="secondaryButton" disabled={working} onClick={() => void activate(year.id)}>
                    Activar curso
                  </button>
                )}
                {year.isActive && (
                  <button className="secondaryButton" disabled={working} onClick={() => void closeYear(year.id)}>
                    Cerrar curso
                  </button>
                )}
              </div>
            )}
          </div>

          {year?.closedAt && (
            <div className="notice">
              Curso cerrado el {new Date(year.closedAt).toLocaleDateString('es-ES')}. Sus coordinaciones se muestran en modo histórico.
            </div>
          )}

          <h3>Asignar coordinación</h3>
          <div className="assignmentControls">
            <select value={userId} onChange={(e) => setUserId(e.target.value)} disabled={Boolean(year?.closedAt)}>
              <option value="">Selecciona docente activo</option>
              {activeUsers.map((user) => <option key={user.id} value={user.id}>{user.lastName}, {user.firstName} · {user.email}</option>)}
            </select>
            <select value={networkId} onChange={(e) => setNetworkId(e.target.value)} disabled={Boolean(year?.closedAt)}>
              <option value="">Selecciona red</option>
              {networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
            </select>
            <button className="primaryButton" type="button" disabled={Boolean(year?.closedAt)} onClick={() => void assignNetwork()}>Añadir red</button>
            <button className="secondaryButton" type="button" disabled={Boolean(year?.closedAt)} onClick={() => void assignCiclope()}>Añadir CÍCLOPE</button>
          </div>

          <div className="assignmentList">
            <h3>Coordinaciones de redes</h3>
            {!year?.networkCoordinators.length && <p className="empty">Todavía no hay coordinaciones asignadas.</p>}
            {year?.networkCoordinators.map((assignment) => (
              <div className="assignmentRow" key={assignment.id}>
                <div>
                  <strong>{assignment.network.name}</strong>
                  <span>
                    {assignment.user.firstName} {assignment.user.lastName} · {assignment.user.email}
                    {assignment.user.active === false ? ' · cuenta inactiva' : ''}
                  </span>
                </div>
                <div className="rowActions">
                  {assignment.isPrimary && <span className="badge success">Principal</span>}
                  {!year.closedAt && <button className="textButton dangerText" disabled={working} onClick={() => void removeNetwork(assignment.id)}>Quitar</button>}
                </div>
              </div>
            ))}

            <h3>CÍCLOPE</h3>
            {!year?.ciclopeCoordinators.length && <p className="empty">Sin coordinación CÍCLOPE asignada.</p>}
            {year?.ciclopeCoordinators.map((assignment) => (
              <div className="assignmentRow" key={assignment.id}>
                <div>
                  <strong>Coordinación CÍCLOPE</strong>
                  <span>
                    {assignment.user.firstName} {assignment.user.lastName} · {assignment.user.email}
                    {assignment.user.active === false ? ' · cuenta inactiva' : ''}
                  </span>
                </div>
                <div className="rowActions">
                  {assignment.isPrimary && <span className="badge success">Principal</span>}
                  {!year.closedAt && <button className="textButton dangerText" disabled={working} onClick={() => void removeCiclope(assignment.id)}>Quitar</button>}
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      {year && (
        <section className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Transición anual</p>
              <h2>Preparar el curso siguiente desde {year.name}</h2>
            </div>
          </div>
          <p className="hint">
            Se crea un curso nuevo en estado de preparación. Nunca se copian actuaciones, comunicaciones, informes ni resultados. Puedes reutilizar grupos y coordinaciones para ahorrar trabajo.
          </p>
          <form className="compactForm" onSubmit={rollover}>
            <div className="twoColumns">
              <label>Nuevo curso<input name="name" placeholder="2027-2028" required /></label>
              <span />
              <label>Inicio<input type="date" name="startsAt" required /></label>
              <label>Fin<input type="date" name="endsAt" required /></label>
            </div>
            <label className="checkCard">
              <input type="checkbox" name="copyGroups" defaultChecked />
              <span>Copiar nombres de grupos, familias y turnos; dejar el número de alumnado sin completar.</span>
            </label>
            <label className="checkCard">
              <input type="checkbox" name="copyCoordinators" defaultChecked />
              <span>Copiar coordinaciones actuales siempre que las cuentas sigan activas.</span>
            </label>
            <button className="primaryButton" disabled={working}>{working ? 'Procesando…' : 'Preparar curso siguiente'}</button>
          </form>
        </section>
      )}
    </main>
  );
}
