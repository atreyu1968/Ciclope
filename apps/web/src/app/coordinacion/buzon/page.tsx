'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type RequestItem = {
  id: string;
  category: string;
  subject: string;
  status: string;
  updatedAt: string;
  submittedBy: { firstName: string; lastName: string; email: string };
  networks: Array<{ network: { id: string; name: string } }>;
  messages: Array<{ body: string; createdAt: string }>;
};

const STATUS: Record<string, string> = {
  NEW: 'Nueva',
  IN_PROGRESS: 'En curso',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
};

export default function CoordinationStaffInboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [aiSummary, setAiSummary] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  async function load(status = filter) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await fetch(`/api/staff-requests/coordination${query}`);
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (response.status === 403) {
      setError('No tienes una coordinación asignada en el curso activo.');
      return;
    }
    if (!response.ok) {
      setError('No se pudo cargar el buzón de coordinación.');
      return;
    }
    setItems(await response.json());
  }

  useEffect(() => { void load(); }, []);

  async function summarizeInbox() {
    setAiBusy(true);
    setAiSummary('');
    setAiError('');
    const response = await fetch('/api/assistant/inbox-summary', { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    setAiBusy(false);
    if (!response.ok) {
      setAiError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo resumir el buzón.');
      return;
    }
    setAiSummary(body.text || '');
  }

  async function changeFilter(value: string) {
    setFilter(value);
    await load(value);
  }

  async function setStatus(id: string, status: string) {
    const response = await fetch(`/api/staff-requests/${id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (response.ok) await load();
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Coordinación</p>
          <h1>Buzón del claustro FP</h1>
          <p className="lead">Consultas, propuestas y necesidades dirigidas a las redes que coordinas.</p>
        </div>
        <a className="secondaryButton" href="/coordinacion">Mi hora</a>
      </div>

      <section className="panel aiAssistBox">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Asistente de IA</p>
            <h2>Resumen del buzón abierto</h2>
          </div>
          <span className="badge warningChip">Requiere revisión humana</span>
        </div>
        <p className="hint">
          Resume consultas nuevas y en curso de las redes que coordinas. El contexto enviado a la IA omite nombres y correos.
        </p>
        <button className="secondaryButton" type="button" disabled={aiBusy} onClick={() => void summarizeInbox()}>
          {aiBusy ? 'Analizando…' : 'Resumir asuntos pendientes'}
        </button>
        {aiError && <div className="errorBox">{aiError}</div>}
        {aiSummary && (
          <div className="aiResult">
            <pre>{aiSummary}</pre>
            <p className="aiReviewNotice">Resumen generado con IA. Contrasta cada asunto con la consulta original antes de tomar decisiones.</p>
          </div>
        )}
      </section>

      <div className="filterBar">
        {[
          ['', 'Todas'],
          ['NEW', 'Nuevas'],
          ['IN_PROGRESS', 'En curso'],
          ['RESOLVED', 'Resueltas'],
          ['CLOSED', 'Cerradas'],
        ].map(([value, label]) => (
          <button
            key={value || 'all'}
            className={filter === value ? 'filterChip active' : 'filterChip'}
            onClick={() => changeFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <div className="errorBox">{error}</div>}

      <div className="actionQueue">
        {items.map((item) => (
          <article className="queueCard" key={item.id}>
            <div className="queueMain">
              <div className="queueMeta">
                <span>{item.category}</span>
                <span>{STATUS[item.status] ?? item.status}</span>
                <span>{new Date(item.updatedAt).toLocaleString('es-ES')}</span>
              </div>
              <h2>{item.subject}</h2>
              <p className="submitter">Enviada por <strong>{item.submittedBy.firstName} {item.submittedBy.lastName}</strong> · {item.submittedBy.email}</p>
              <div className="chipRow">
                {item.networks.map(({ network }) => <span className="chip" key={network.id}>{network.name}</span>)}
              </div>
              {item.messages[0] && <p className="requestPreview">{item.messages[0].body}</p>}
            </div>
            <div className="queueActions">
              <a className="primaryButton" href={`/buzon/${item.id}`}>Abrir</a>
              {item.status === 'NEW' && <button className="secondaryButton" onClick={() => setStatus(item.id, 'IN_PROGRESS')}>En curso</button>}
              {item.status !== 'RESOLVED' && item.status !== 'CLOSED' && <button className="secondaryButton" onClick={() => setStatus(item.id, 'RESOLVED')}>Resolver</button>}
              {item.status === 'RESOLVED' && <button className="secondaryButton" onClick={() => setStatus(item.id, 'CLOSED')}>Cerrar</button>}
            </div>
          </article>
        ))}
        {!items.length && !error && <div className="panel"><h2>Sin asuntos pendientes</h2><p className="empty">No hay consultas en esta vista.</p></div>}
      </div>
    </main>
  );
}
