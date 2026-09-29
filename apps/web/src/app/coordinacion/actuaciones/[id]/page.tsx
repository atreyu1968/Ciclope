'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type HistoryEvent = {
  id: string;
  action: string;
  createdAt: string;
  actor?: { id?: string; firstName: string; lastName: string; email: string } | null;
  details?: Record<string, unknown> | null;
  synthetic?: boolean;
};

type HistoryData = {
  action: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    submittedByName: string;
    submittedByEmail: string;
    returnedReason?: string | null;
    networks: Array<{ network: { id: string; name: string } }>;
  };
  events: HistoryEvent[];
};

const labels: Record<string, string> = {
  ACTION_CREATED: 'Actuación registrada',
  ACTION_UPDATED: 'Actuación editada',
  ACTION_RESUBMITTED: 'Actuación reenviada',
  ACTION_VALIDATED: 'Actuación validada',
  ACTION_RETURNED: 'Devuelta para corrección',
};

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_VALIDATION: 'Pendiente de validación',
  VALIDATED: 'Validada',
  RETURNED: 'Devuelta',
  ARCHIVED: 'Archivada',
};

export default function ActionHistoryPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!params.id) return;
    fetch('/api/actions/' + params.id + '/history').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (response.status === 403) {
        router.push('/acceso-denegado');
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo cargar el historial.');
        return;
      }
      setData(body);
    }).catch(() => setError('No se pudo cargar el historial.'));
  }, [params.id, router]);

  if (error) return <main className="shell"><div className="errorBox">{error}</div></main>;
  if (!data) return (
    <main className="shell">
      <div className="loadingState" role="status" aria-live="polite">
        <span className="loadingSpinner" aria-hidden="true" />
        <strong>Cargando historial de validación…</strong>
      </div>
    </main>
  );

  return (
    <main className="shell conversationShell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Trazabilidad de validación</p>
          <h1>{data.action.title}</h1>
          <p className="lead">
            Estado actual: <strong>{statusLabels[data.action.status] || data.action.status}</strong>.
            {' '}El historial conserva las transiciones registradas por coordinación.
          </p>
          <div className="chipRow">
            {data.action.networks.map(({ network }) => <span className="chip" key={network.id}>{network.name}</span>)}
          </div>
        </div>
        <a className="secondaryButton" href="/coordinacion/actuaciones">Volver a la bandeja</a>
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Historial de estados</p>
            <h2>{data.events.length} eventos registrados</h2>
          </div>
        </div>

        <div className="statusTimeline">
          {!data.events.length && (
            <div className="emptyState">
              <h3>Sin eventos de validación registrados</h3>
              <p>Los cambios de estado aparecerán aquí cuando la actuación avance por el flujo de revisión.</p>
            </div>
          )}
          {data.events.map((event) => {
            const reason = typeof event.details?.reason === 'string' ? event.details.reason : '';
            const eventStatus = typeof event.details?.status === 'string' ? event.details.status : '';
            return (
              <article className="statusTimelineItem" key={event.id}>
                <div className="statusTimelineMarker" />
                <div className="statusTimelineCard">
                  <div className="panelHeader">
                    <div>
                      <strong>{labels[event.action] || event.action}</strong>
                      <span className="hint">
                        {new Date(event.createdAt).toLocaleString('es-ES', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                    </div>
                    {event.synthetic && <span className="badge">Reconstruido</span>}
                  </div>
                  <p>
                    {event.actor
                      ? 'Por ' + [event.actor.firstName, event.actor.lastName].filter(Boolean).join(' ') + ' · ' + event.actor.email
                      : 'Evento del sistema'}
                  </p>
                  {eventStatus && <p className="hint">Estado: {statusLabels[eventStatus] || eventStatus}</p>}
                  {reason && (
                    <div className="responseBox">
                      <strong>Motivo de devolución</strong>
                      <p>{reason}</p>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <h2>Origen del registro</h2>
        <p>
          Registrada por <strong>{data.action.submittedByName}</strong> · {data.action.submittedByEmail}
          {' '}el {new Date(data.action.createdAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}.
        </p>
        <p className="reportNote">
          Los eventos anteriores a la activación del historial se reconstruyen cuando existen marcas de fecha fiables en la actuación.
        </p>
      </section>
    </main>
  );
}
