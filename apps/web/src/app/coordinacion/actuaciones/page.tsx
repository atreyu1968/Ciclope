'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string };
type Action = {
  id: string; title: string; description: string; type: string; status: string;
  activityDate: string; studentCount?: number | null; submittedByName: string; submittedByEmail: string;
  networks: Array<{ network: Network }>;
};

export default function CoordinationActionsPage() {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const response = await fetch('/api/actions?status=PENDING_VALIDATION');
    if (response.status === 401) { router.push('/login'); return; }
    if (response.status === 403) { setError('Tu cuenta no tiene una coordinación asignada en el curso activo.'); return; }
    if (!response.ok) { setError('No se pudo cargar la bandeja.'); return; }
    setActions(await response.json());
    setSelected([]);
  }

  useEffect(() => { void load(); }, []);

  function toggle(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function validateSelected() {
    if (!selected.length) return;
    const response = await fetch('/api/actions/validate-batch', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: selected }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.message || 'No se pudieron validar las actuaciones.');
      return;
    }
    setMessage(`${body.validated} actuaciones validadas.`);
    await load();
  }

  async function validate(id: string) {
    const response = await fetch(`/api/actions/${id}/validate`, { method: 'PATCH' });
    if (response.ok) await load();
  }

  async function returnAction(id: string) {
    const reason = window.prompt('Indica qué debe corregir el profesor:');
    if (!reason) return;
    const response = await fetch(`/api/actions/${id}/return`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reason }),
    });
    if (response.ok) await load();
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Coordinación</p>
          <h1>Actuaciones pendientes</h1>
          <p className="lead">Solo aparecen las actuaciones del curso activo y de las redes que tienes asignadas.</p>
        </div>
        <a className="secondaryButton" href="/">Volver</a>
      </div>
      {error && <div className="errorBox">{error}</div>}
      {message && <div className="notice">{message}</div>}
      {!error && actions.length > 0 && (
        <div className="bulkBar">
          <span>{selected.length} seleccionadas</span>
          <button className="primaryButton" disabled={!selected.length} onClick={validateSelected}>Validar seleccionadas</button>
        </div>
      )}
      {!error && actions.length === 0 && <div className="panel"><h2>Todo al día</h2><p className="empty">No hay actuaciones pendientes de validar.</p></div>}
      <div className="actionQueue">
        {actions.map((action) => (
          <article className={`queueCard ${selected.includes(action.id) ? 'selectedCard' : ''}`} key={action.id}>
            <div className="queueSelect">
              <input type="checkbox" aria-label={`Seleccionar ${action.title}`} checked={selected.includes(action.id)} onChange={() => toggle(action.id)} />
            </div>
            <div className="queueMain">
              <div className="queueMeta">
                <span>{new Date(action.activityDate).toLocaleDateString('es-ES')}</span>
                <span>{action.type}</span>
                {action.studentCount != null && <span>{action.studentCount} alumnos</span>}
              </div>
              <h2>{action.title}</h2>
              <p>{action.description}</p>
              <div className="chipRow">{action.networks.map(({ network }) => <span className="chip" key={network.id}>{network.name}</span>)}</div>
              <p className="submitter">Registrada por <strong>{action.submittedByName}</strong> · {action.submittedByEmail}</p>
            </div>
            <div className="queueActions">
              <button className="primaryButton" onClick={() => validate(action.id)}>Validar</button>
              <button className="secondaryButton" onClick={() => returnAction(action.id)}>Devolver</button>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
