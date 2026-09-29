'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type InboxItem = {
  readAt?: string | null;
  respondedAt?: string | null;
  responseText?: string | null;
  communication: {
    id: string;
    title: string;
    body: string;
    responseRequired: boolean;
    deadline?: string | null;
    publishedAt?: string | null;
    originNetwork?: { name: string } | null;
    author?: { firstName: string; lastName: string } | null;
    attachments: Array<{
      id: string;
      originalName: string;
      mimeType: string;
      sizeBytes: number;
      createdAt: string;
    }>;
  };
};

export default function CommunicationsInboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/communications/inbox');
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setMessage('No se pudo cargar la bandeja.');
        return;
      }
      setMessage('');
      setItems(await response.json());
    } catch {
      setMessage('No se pudo cargar la bandeja.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function read(id: string) {
    await fetch(`/api/communications/${id}/read`, { method: 'PATCH' });
    await load();
  }

  async function respond(id: string) {
    const responseText = window.prompt('Escribe tu respuesta:');
    if (!responseText) return;
    const response = await fetch(`/api/communications/${id}/respond`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ response: responseText }),
    });
    if (response.ok) await load();
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Portal FP</p>
          <h1>Comunicaciones</h1>
          <p className="lead">Toda la información de las Redes en una única bandeja, independientemente del turno.</p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/coordinacion/comunicaciones">Enviadas</a>
          <a className="primaryButton" href="/comunicaciones/nueva">Nueva comunicación</a>
        </div>
      </div>
      {message && <div className="errorBox">{message}</div>}
      {loading && !message && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando comunicaciones…</strong>
        </div>
      )}
      <div className="actionQueue">
        {items.map((item) => {
          const communication = item.communication;
          return (
            <article className={`queueCard ${item.readAt ? '' : 'unread'}`} key={communication.id}>
              <div className="queueMain">
                <div className="queueMeta">
                  <span>{communication.originNetwork?.name || 'CÍCLOPE'}</span>
                  {communication.publishedAt && <span>{new Date(communication.publishedAt).toLocaleString('es-ES')}</span>}
                  {!item.readAt && <span>Nueva</span>}
                </div>
                <h2>{communication.title}</h2>
                <p className="preLine">{communication.body}</p>
                <p className="submitter">
                  {communication.author ? `${communication.author.firstName} ${communication.author.lastName}` : 'Coordinación'}
                </p>
                {communication.deadline && <p className="hint">Fecha límite: {new Date(communication.deadline).toLocaleString('es-ES')}</p>}
                {communication.attachments.length > 0 && (
                  <div className="communicationAttachments">
                    <strong>Adjuntos</strong>
                    <div>
                      {communication.attachments.map((attachment) => (
                        <a
                          className="attachmentLink"
                          key={attachment.id}
                          href={`/api/communications/${communication.id}/attachments/${attachment.id}/download`}
                        >
                          <span>{attachment.originalName}</span>
                          <small>{Math.max(1, Math.round(attachment.sizeBytes / 1024))} KB</small>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
                {item.responseText && <div className="responseBox"><strong>Tu respuesta</strong><p>{item.responseText}</p></div>}
              </div>
              <div className="queueActions">
                {!item.readAt && <button className="secondaryButton" onClick={() => read(communication.id)}>Marcar leída</button>}
                {communication.responseRequired && !item.respondedAt && <button className="primaryButton" onClick={() => respond(communication.id)}>Responder</button>}
              </div>
            </article>
          );
        })}
        {!loading && !items.length && !message && (
          <div className="emptyState">
            <h2>No hay comunicaciones en tu bandeja</h2>
            <p>Las comunicaciones dirigidas a ti aparecerán aquí. Puedes usar el buzón CÍCLOPE para enviar una consulta a las coordinaciones.</p>
            <div className="rowActions"><a className="secondaryButton" href="/buzon/nueva">Enviar una consulta</a></div>
          </div>
        )}
      </div>
    </main>
  );
}
