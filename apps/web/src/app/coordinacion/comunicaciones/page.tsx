'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type SentCommunication = {
  id: string;
  title: string;
  publishedAt?: string | null;
  responseRequired: boolean;
  originNetwork?: { name: string } | null;
  _count: { recipients: number };
  recipients: Array<{ userId: string; readAt?: string | null; respondedAt?: string | null }>;
  attachments: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
  }>;
};

type MailJob = {
  id: string;
  communicationId?: string | null;
  recipientEmail: string;
  subject: string;
  status: 'QUEUED' | 'PROCESSING' | 'SENT' | 'FAILED';
  attempts: number;
  lastError?: string | null;
  sentAt?: string | null;
  createdAt: string;
  communication?: {
    id: string;
    title: string;
    originNetwork?: { id: string; name: string } | null;
  } | null;
};

export default function SentCommunicationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<SentCommunication[]>([]);
  const [mailJobs, setMailJobs] = useState<MailJob[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [workingId, setWorkingId] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [communicationsResponse, jobsResponse] = await Promise.all([
        fetch('/api/communications/sent'),
        fetch('/api/communications/mail-jobs'),
      ]);
      if (communicationsResponse.status === 401 || jobsResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!communicationsResponse.ok || !jobsResponse.ok) {
        setError('No se pudieron cargar las comunicaciones o el estado de los correos.');
        return;
      }
      setError('');
      setItems(await communicationsResponse.json());
      setMailJobs(await jobsResponse.json());
    } catch {
      setError('No se pudieron cargar las comunicaciones o el estado de los correos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [router]);

  const mailByCommunication = useMemo(() => {
    const result: Record<string, { sent: number; queued: number; failed: number }> = {};
    for (const job of mailJobs) {
      if (!job.communicationId) continue;
      result[job.communicationId] ??= { sent: 0, queued: 0, failed: 0 };
      if (job.status === 'SENT') result[job.communicationId].sent += 1;
      if (job.status === 'QUEUED' || job.status === 'PROCESSING') result[job.communicationId].queued += 1;
      if (job.status === 'FAILED') result[job.communicationId].failed += 1;
    }
    return result;
  }, [mailJobs]);

  const failedJobs = mailJobs.filter((job) => job.status === 'FAILED');

  async function remindPending(id: string) {
    setWorkingId('remind:' + id);
    setMessage('');
    setError('');
    const response = await fetch(`/api/communications/${id}/remind-pending`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setWorkingId('');
      setError(body.message || 'No se pudo preparar el recordatorio.');
      return;
    }
    setMessage(body.queued
      ? `Recordatorio preparado para ${body.queued} personas pendientes.`
      : body.message || 'No hay personas pendientes.');
    await load();
    setWorkingId('');
  }

  async function retry(job: MailJob) {
    setWorkingId(job.id);
    setMessage('');
    setError('');
    const response = await fetch(`/api/communications/mail-jobs/${job.id}/retry`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    setWorkingId('');
    if (!response.ok) {
      setError(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'No se pudo reintentar el envío.');
      return;
    }
    setMessage(`Reintento preparado para ${job.recipientEmail}.`);
    await load();
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Coordinación</p>
          <h1>Comunicaciones enviadas</h1>
          <p className="lead">
            Consulta alcance, lectura, respuesta y entrega por correo. Los fallos definitivos pueden reintentarse sin duplicar las comunicaciones.
          </p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/comunicaciones">Bandeja</a>
          <a className="primaryButton" href="/comunicaciones/nueva">Nueva comunicación</a>
        </div>
      </div>

      {error && <div className="errorBox">{error}</div>}
      {message && <div className="notice">{message}</div>}
      {loading && !error && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando comunicaciones enviadas…</strong>
        </div>
      )}

      <div className="actionQueue">
        {items.map((item) => {
          const total = item._count.recipients;
          const read = item.recipients.filter((recipient) => recipient.readAt).length;
          const responded = item.recipients.filter((recipient) => recipient.respondedAt).length;
          const delivery = mailByCommunication[item.id] ?? { sent: 0, queued: 0, failed: 0 };
          return (
            <article className="queueCard" key={item.id}>
              <div className="queueMain">
                <div className="queueMeta">
                  <span>{item.originNetwork?.name || 'CÍCLOPE'}</span>
                  {item.publishedAt && <span>{new Date(item.publishedAt).toLocaleString('es-ES')}</span>}
                </div>
                <h2>{item.title}</h2>
                <div className="statsRow">
                  <div><strong>{total}</strong><span>destinatarios</span></div>
                  <div><strong>{read}</strong><span>leídas</span></div>
                  <div><strong>{responded}</strong><span>respondidas</span></div>
                  <div><strong>{item.responseRequired ? Math.max(total - responded, 0) : Math.max(total - read, 0)}</strong><span>pendientes</span></div>
                </div>
                <div className="chipRow">
                  <span className="chip">Correo enviado: {delivery.sent}</span>
                  {delivery.queued > 0 && <span className="chip">En cola: {delivery.queued}</span>}
                  {delivery.failed > 0 && <span className="badge dangerBadge">Fallidos: {delivery.failed}</span>}
                </div>
                {item.attachments.length > 0 && (
                  <div className="communicationAttachments">
                    <strong>{item.attachments.length} adjunto{item.attachments.length === 1 ? '' : 's'}</strong>
                    <div>
                      {item.attachments.map((attachment) => (
                        <a
                          className="attachmentLink"
                          key={attachment.id}
                          href={`/api/communications/${item.id}/attachments/${attachment.id}/download`}
                        >
                          <span>{attachment.originalName}</span>
                          <small>{Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB</small>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="queueActions">
                <button className="secondaryButton" disabled={Boolean(workingId)} onClick={() => void remindPending(item.id)}>
                  {workingId === 'remind:' + item.id ? 'Preparando…' : 'Recordar a pendientes'}
                </button>
              </div>
            </article>
          );
        })}
        {!loading && !items.length && !error && (
          <div className="emptyState">
            <h2>Aún no hay comunicaciones enviadas</h2>
            <p>Publica una comunicación para informar al claustro de FP y poder seguir su lectura, respuestas y entrega por correo.</p>
            <div className="rowActions"><a className="primaryButton" href="/comunicaciones/nueva">Crear comunicación</a></div>
          </div>
        )}
      </div>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Correo transaccional</p>
            <h2>Incidencias de entrega</h2>
          </div>
          <span className={failedJobs.length ? 'badge dangerBadge' : 'badge success'}>
            {failedJobs.length ? `${failedJobs.length} fallos` : 'Sin fallos definitivos'}
          </span>
        </div>

        {failedJobs.length ? (
          <div className="assignmentList">
            {failedJobs.map((job) => (
              <div className="assignmentRow" key={job.id}>
                <div>
                  <strong>{job.recipientEmail}</strong>
                  <span>{job.communication?.title || job.subject} · {job.attempts} intentos</span>
                  {job.lastError && <span className="hint">{job.lastError}</span>}
                </div>
                <button
                  className="secondaryButton"
                  type="button"
                  disabled={Boolean(workingId)}
                  onClick={() => void retry(job)}
                >
                  {workingId === job.id ? 'Preparando…' : 'Reintentar'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="emptyState">
            <h3>Sin incidencias definitivas de entrega</h3>
            <p>La cola no registra correos que hayan agotado todos sus intentos automáticos.</p>
          </div>
        )}
      </section>
    </main>
  );
}
