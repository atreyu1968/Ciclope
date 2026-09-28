'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type SentCommunication = {
  id: string;
  title: string;
  publishedAt?: string | null;
  responseRequired: boolean;
  originNetwork?: { name: string } | null;
  _count: { recipients: number };
  recipients: Array<{ userId: string; readAt?: string | null; respondedAt?: string | null }>;
};

export default function SentCommunicationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<SentCommunication[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/communications/sent').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setError('No se pudieron cargar las comunicaciones enviadas.');
        return;
      }
      setItems(await response.json());
    });
  }, [router]);

  async function remindPending(id: string) {
    setMessage('');
    const response = await fetch(`/api/communications/${id}/remind-pending`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.message || 'No se pudo preparar el recordatorio.');
      return;
    }
    setMessage(body.queued
      ? `Recordatorio preparado para ${body.queued} personas pendientes.`
      : body.message || 'No hay personas pendientes.');
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Coordinación</p>
          <h1>Comunicaciones enviadas</h1>
          <p className="lead">Consulta alcance, lectura y respuesta sin perseguir manualmente al profesorado.</p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/comunicaciones">Bandeja</a>
          <a className="primaryButton" href="/comunicaciones/nueva">Nueva comunicación</a>
        </div>
      </div>
      {error && <div className="errorBox">{error}</div>}
      {message && <div className="notice">{message}</div>}
      <div className="actionQueue">
        {items.map((item) => {
          const total = item._count.recipients;
          const read = item.recipients.filter((recipient) => recipient.readAt).length;
          const responded = item.recipients.filter((recipient) => recipient.respondedAt).length;
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
              </div>
              <div className="queueActions">
                <button className="secondaryButton" onClick={() => remindPending(item.id)}>Recordar a pendientes</button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
