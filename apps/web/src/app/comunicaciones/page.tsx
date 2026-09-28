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
  };
};

export default function CommunicationsInboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [message, setMessage] = useState('');

  async function load() {
    const response = await fetch('/api/communications/inbox');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (!response.ok) {
      setMessage('No se pudo cargar la bandeja.');
      return;
    }
    setItems(await response.json());
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
                {item.responseText && <div className="responseBox"><strong>Tu respuesta</strong><p>{item.responseText}</p></div>}
              </div>
              <div className="queueActions">
                {!item.readAt && <button className="secondaryButton" onClick={() => read(communication.id)}>Marcar leída</button>}
                {communication.responseRequired && !item.respondedAt && <button className="primaryButton" onClick={() => respond(communication.id)}>Responder</button>}
              </div>
            </article>
          );
        })}
        {!items.length && !message && <div className="panel"><h2>Sin comunicaciones</h2><p className="empty">No tienes mensajes pendientes en el curso activo.</p></div>}
      </div>
    </main>
  );
}
