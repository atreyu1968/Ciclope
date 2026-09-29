'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Action = {
  id: string;
  title: string;
  description: string;
  status: string;
  activityDate: string;
  returnedReason?: string | null;
  networks: Array<{ network: { id: string; name: string } }>;
  groups: Array<{ teachingGroup: { id: string; name: string; professionalFamily: { name: string } } }>;
};

const LABELS: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_VALIDATION: 'Pendiente de validación',
  VALIDATED: 'Validada',
  RETURNED: 'Devuelta para corrección',
  ARCHIVED: 'Archivada',
};

export default function MyActionsPage() {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [workingId, setWorkingId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/actions/mine').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setError('No se pudieron cargar tus actuaciones.');
        return;
      }
      setActions(await response.json());
    }).catch(() => {
      setError('No se pudieron cargar tus actuaciones.');
    }).finally(() => {
      setLoading(false);
    });
  }, [router]);

  async function duplicate(id: string) {
    setWorkingId(id);
    setMessage('');
    setError('');
    const response = await fetch(`/api/actions/${id}/duplicate`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    setWorkingId('');
    if (!response.ok) {
      setError(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'No se pudo duplicar la actuación.');
      return;
    }
    setMessage('Copia creada como borrador. Puedes revisarla antes de enviarla.');
    router.push(`/actuaciones/${body.id}/editar`);
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Profesorado FP</p>
          <h1>Mis actuaciones</h1>
          <p className="lead">Seguimiento del curso activo y de las correcciones solicitadas por coordinación.</p>
        </div>
        <div className="rowActions">
          <a className="primaryButton" href="/actuaciones/nueva">Registrar actuación</a>
          <a className="secondaryButton" href="/">Inicio</a>
        </div>
      </div>

      {message && <div className="notice" role="status" aria-live="polite">{message}</div>}
      {error && <div className="errorBox" role="alert">{error}</div>}

      {loading && !error && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando tus actuaciones…</strong>
        </div>
      )}

      <div className="actionQueue">
        {actions.map((action) => (
          <article className="queueCard" key={action.id}>
            <div className="queueMain">
              <div className="queueMeta">
                <span>{new Date(action.activityDate).toLocaleDateString('es-ES')}</span>
                <span>{LABELS[action.status] ?? action.status}</span>
              </div>
              <h2>{action.title}</h2>
              <p className="hint">Referencia: {action.id.slice(-8).toUpperCase()}</p>
              <p>{action.description}</p>
              <div className="chipRow">
                {action.networks.map(({ network }) => <span className="chip" key={network.id}>{network.name}</span>)}
                {action.groups.map(({ teachingGroup }) => <span className="chip" key={teachingGroup.id}>{teachingGroup.name}</span>)}
              </div>
              {action.status === 'RETURNED' && action.returnedReason && (
                <div className="errorBox correctionBox">
                  <strong>Corrección solicitada</strong>
                  <p>{action.returnedReason}</p>
                </div>
              )}
            </div>
            <div className="queueActions">
              <a className="secondaryButton" href={`/actuaciones/${action.id}/evidencias`}>Evidencias</a>
              {['DRAFT', 'PENDING_VALIDATION'].includes(action.status) && (
                <a className="secondaryButton" href={`/actuaciones/${action.id}/editar`}>Editar</a>
              )}
              {action.status === 'RETURNED' && (
                <a className="primaryButton" href={`/actuaciones/${action.id}/corregir`}>Corregir y reenviar</a>
              )}
              <button
                className="secondaryButton"
                type="button"
                disabled={workingId === action.id}
                onClick={() => void duplicate(action.id)}
              >
                {workingId === action.id ? 'Duplicando…' : 'Duplicar'}
              </button>
            </div>
          </article>
        ))}
        {!loading && !actions.length && !error && (
          <div className="emptyState">
            <h2>Aún no has registrado actuaciones</h2>
            <p>Cuando registres una actividad de cualquiera de las redes aparecerá aquí con su estado de validación y sus evidencias.</p>
            <div className="rowActions"><a className="primaryButton" href="/actuaciones/nueva">Registrar la primera actuación</a></div>
          </div>
        )}
      </div>
    </main>
  );
}
