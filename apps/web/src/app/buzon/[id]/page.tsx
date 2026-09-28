'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Me = { id: string };
type RequestDetail = {
  id: string;
  category: string;
  subject: string;
  status: string;
  createdAt: string;
  resolvedAt?: string | null;
  submittedBy: { id: string; firstName: string; lastName: string; email: string };
  networks: Array<{ network: { id: string; name: string } }>;
  messages: Array<{
    id: string;
    body: string;
    createdAt: string;
    author: { id: string; firstName: string; lastName: string; email: string };
  }>;
};

const STATUS: Record<string, string> = {
  NEW: 'Nueva',
  IN_PROGRESS: 'En curso',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
};

export default function StaffRequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function load() {
    const [meResponse, requestResponse] = await Promise.all([
      fetch('/api/auth/me'),
      fetch(`/api/staff-requests/${params.id}`),
    ]);
    if (meResponse.status === 401 || requestResponse.status === 401) {
      router.push('/login');
      return;
    }
    if (!meResponse.ok || !requestResponse.ok) {
      setError('No se pudo cargar la conversación.');
      return;
    }
    setMe(await meResponse.json());
    setRequest(await requestResponse.json());
  }

  useEffect(() => { void load(); }, [params.id]);

  async function reply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/staff-requests/${params.id}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: form.get('body') }),
    });
    setSending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.message || 'No se pudo enviar la respuesta.');
      return;
    }
    event.currentTarget.reset();
    await load();
  }

  if (!request) return <main className="shell"><p>{error || 'Cargando conversación…'}</p></main>;

  return (
    <main className="shell conversationShell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">{request.category} · {STATUS[request.status] ?? request.status}</p>
          <h1>{request.subject}</h1>
          <div className="chipRow">
            {request.networks.map(({ network }) => <span className="chip" key={network.id}>{network.name}</span>)}
          </div>
        </div>
        <a className="secondaryButton" href={request.submittedBy.id === me?.id ? '/buzon' : '/coordinacion/buzon'}>Volver</a>
      </div>

      {error && <div className="errorBox">{error}</div>}

      <section className="conversation">
        {request.messages.map((message) => {
          const mine = message.author.id === me?.id;
          return (
            <article className={`messageBubble ${mine ? 'mine' : ''}`} key={message.id}>
              <div className="messageAuthor">
                <strong>{message.author.firstName} {message.author.lastName}</strong>
                <span>{new Date(message.createdAt).toLocaleString('es-ES')}</span>
              </div>
              <p>{message.body}</p>
            </article>
          );
        })}
      </section>

      {request.status !== 'CLOSED' && (
        <form className="replyBox" onSubmit={reply}>
          <label>Responder<textarea name="body" rows={5} maxLength={6000} required /></label>
          <button className="primaryButton" disabled={sending}>{sending ? 'Enviando…' : 'Enviar respuesta'}</button>
        </form>
      )}
    </main>
  );
}
