'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string; code: string };
type User = {
  id: string; firstName: string; lastName: string; email: string;
  networkCoordinations: Array<{ id: string; network: Network }>;
  ciclopeCoordinations: Array<{ id: string }>;
};
type Coordinator = {
  id: string; isPrimary: boolean;
  network: Network;
  user: { id: string; firstName: string; lastName: string; email: string };
};
type CiclopeCoordinator = {
  id: string; isPrimary: boolean;
  user: { id: string; firstName: string; lastName: string; email: string };
};
type Year = {
  id: string; name: string; startsAt: string; endsAt: string; isActive: boolean; closedAt?: string | null;
  networkCoordinators: Coordinator[];
  ciclopeCoordinators: CiclopeCoordinator[];
  _count: { actions: number; communications: number };
};

export default function AcademicYearsPage() {
  const router = useRouter();
  const [years, setYears] = useState<Year[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [userId, setUserId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [yearsResponse, usersResponse, networksResponse] = await Promise.all([
      fetch('/api/academic-years'), fetch('/api/users'), fetch('/api/networks'),
    ]);
    if (yearsResponse.status === 401) {
      router.push('/login');
      return;
    }
    if (!yearsResponse.ok || !usersResponse.ok || !networksResponse.ok) {
      setMessage('No se pudieron cargar los datos administrativos.');
      return;
    }
    const [yearData, userData, networkData] = await Promise.all([
      yearsResponse.json(), usersResponse.json(), networksResponse.json(),
    ]);
    setYears(yearData);
    setUsers(userData);
    setNetworks(networkData);
    if (!selectedYear) {
      const active = yearData.find((item: Year) => item.isActive) ?? yearData[0];
      setSelectedYear(active?.id ?? '');
    }
  }

  useEffect(() => { void load(); }, []);

  const year = useMemo(() => years.find((item) => item.id === selectedYear), [years, selectedYear]);

  async function createYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/academic-years', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    setMessage(response.ok ? 'Curso académico creado.' : 'No se pudo crear el curso académico.');
    if (response.ok) { event.currentTarget.reset(); await load(); }
  }

  async function activate(id: string) {
    const response = await fetch(`/api/academic-years/${id}/activate`, { method: 'PATCH' });
    setMessage(response.ok ? 'Curso académico activado.' : 'No se pudo activar el curso.');
    if (response.ok) await load();
  }

  async function assignNetwork() {
    if (!selectedYear || !userId || !networkId) return;
    const response = await fetch(`/api/academic-years/${selectedYear}/network-coordinators`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, networkId, isPrimary: true }),
    });
    setMessage(response.ok ? 'Coordinación asignada.' : 'No se pudo asignar la coordinación.');
    if (response.ok) await load();
  }

  async function assignCiclope() {
    if (!selectedYear || !userId) return;
    const response = await fetch(`/api/academic-years/${selectedYear}/ciclope-coordinators`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, isPrimary: true }),
    });
    setMessage(response.ok ? 'Coordinación CÍCLOPE asignada.' : 'No se pudo asignar CÍCLOPE.');
    if (response.ok) await load();
  }

  async function removeNetwork(id: string) {
    const response = await fetch(`/api/academic-years/network-coordinators/${id}`, { method: 'DELETE' });
    if (response.ok) await load();
  }

  async function removeCiclope(id: string) {
    const response = await fetch(`/api/academic-years/ciclope-coordinators/${id}`, { method: 'DELETE' });
    if (response.ok) await load();
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Cursos académicos y coordinaciones</h1>
          <p className="lead">Las responsabilidades se asignan por curso. Un mismo docente puede coordinar varias redes simultáneamente.</p>
        </div>
        <a className="secondaryButton" href="/">Volver</a>
      </div>

      {message && <div className="notice">{message}</div>}

      <section className="adminGrid">
        <article className="panel">
          <h2>Cursos académicos</h2>
          <div className="yearList">
            {years.map((item) => (
              <button className={`yearRow ${selectedYear === item.id ? 'selected' : ''}`} key={item.id} onClick={() => setSelectedYear(item.id)}>
                <span><strong>{item.name}</strong><small>{item._count.actions} actuaciones · {item._count.communications} comunicaciones</small></span>
                <span className={item.isActive ? 'badge success' : 'badge'}>{item.isActive ? 'Activo' : 'Histórico'}</span>
              </button>
            ))}
          </div>
          <form className="compactForm" onSubmit={createYear}>
            <h3>Nuevo curso</h3>
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
            <div><p className="eyebrow">Curso seleccionado</p><h2>{year?.name ?? '—'}</h2></div>
            {year && !year.isActive && <button className="secondaryButton" onClick={() => activate(year.id)}>Activar curso</button>}
          </div>

          <h3>Asignar coordinación</h3>
          <div className="assignmentControls">
            <select value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">Selecciona docente</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.lastName}, {user.firstName} · {user.email}</option>)}
            </select>
            <select value={networkId} onChange={(e) => setNetworkId(e.target.value)}>
              <option value="">Selecciona red</option>
              {networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
            </select>
            <button className="primaryButton" type="button" onClick={assignNetwork}>Añadir red</button>
            <button className="secondaryButton" type="button" onClick={assignCiclope}>Añadir CÍCLOPE</button>
          </div>

          <div className="assignmentList">
            <h3>Coordinaciones de redes</h3>
            {!year?.networkCoordinators.length && <p className="empty">Todavía no hay coordinaciones asignadas.</p>}
            {year?.networkCoordinators.map((assignment) => (
              <div className="assignmentRow" key={assignment.id}>
                <div>
                  <strong>{assignment.network.name}</strong>
                  <span>{assignment.user.firstName} {assignment.user.lastName} · {assignment.user.email}</span>
                </div>
                <div className="rowActions">
                  {assignment.isPrimary && <span className="badge success">Principal</span>}
                  <button className="textButton dangerText" onClick={() => removeNetwork(assignment.id)}>Quitar</button>
                </div>
              </div>
            ))}

            <h3>CÍCLOPE</h3>
            {!year?.ciclopeCoordinators.length && <p className="empty">Sin coordinación CÍCLOPE asignada.</p>}
            {year?.ciclopeCoordinators.map((assignment) => (
              <div className="assignmentRow" key={assignment.id}>
                <div>
                  <strong>Coordinación CÍCLOPE</strong>
                  <span>{assignment.user.firstName} {assignment.user.lastName} · {assignment.user.email}</span>
                </div>
                <div className="rowActions">
                  {assignment.isPrimary && <span className="badge success">Principal</span>}
                  <button className="textButton dangerText" onClick={() => removeCiclope(assignment.id)}>Quitar</button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
