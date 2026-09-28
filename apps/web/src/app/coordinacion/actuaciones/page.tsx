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
  const [error, setError] = useState('');

  async function load() {
    const response = await fetch('/api/actions?status=PENDING_VALIDATION');
    if (response.status === 401) { router.push('/login'); return; }
    if (response.status === 403) { setError('Tu cuenta no tiene una coordinación asignada en el curso activo.'); return; }
    if (!response.ok) { setError('No se pudo cargar la bandeja.'); return; }
    setActions(await response.json());
  }

  useEffect(() => { void load(); }, []);

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
      {!error && actions.length === 0 && <div className="panel"><h2>Todo al día</h2><p className="empty">No hay actuaciones pendientes de validar.</p></div>}
      <div className="actionQueue">
        {actions.map((action) => (
          <article className="queueCard" key={action.id}>
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
