'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type RequestItem = {
  id: string;
  category: string;
  subject: string;
  status: string;
  updatedAt: string;
  networks: Array<{ network: { id: string; name: string } }>;
  messages: Array<{ body: string; createdAt: string }>;
};

const STATUS: Record<string, string> = {
  NEW: 'Nueva',
  IN_PROGRESS: 'En curso',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
};

export default function StaffInboxPage() {
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/staff-requests/mine').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setError('No se pudo cargar el buzón.');
        return;
      }
      setItems(await response.json());
    }).catch(() => {
      setError('No se pudo cargar el buzón.');
    }).finally(() => {
      setLoading(false);
    });
  }, [router]);

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Buzón CÍCLOPE</p>
          <h1>Mis consultas y propuestas</h1>
          <p className="lead">Contacta con las coordinaciones sin depender del turno ni de localizar personalmente a quien coordina.</p>
        </div>
        <div className="rowActions">
          <a className="primaryButton" href="/buzon/nueva">Nueva consulta</a>
          <a className="secondaryButton" href="/">Inicio</a>
        </div>
      </div>

      {error && <div className="errorBox">{error}</div>}
      {loading && !error && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando tu buzón…</strong>
        </div>
      )}

      <div className="actionQueue">
        {items.map((item) => (
          <a className="queueCard inboxRequestCard" href={`/buzon/${item.id}`} key={item.id}>
            <div className="queueMain">
              <div className="queueMeta">
                <span>{item.category}</span>
                <span>{STATUS[item.status] ?? item.status}</span>
                <span>{new Date(item.updatedAt).toLocaleString('es-ES')}</span>
              </div>
              <h2>{item.subject}</h2>
              <div className="chipRow">
                {item.networks.map(({ network }) => <span className="chip" key={network.id}>{network.name}</span>)}
              </div>
              {item.messages[0] && <p className="requestPreview">{item.messages[0].body}</p>}
            </div>
            <span className="requestOpen">Abrir →</span>
          </a>
        ))}
        {!loading && !items.length && !error && (
          <div className="emptyState">
            <h2>Tu buzón está vacío</h2>
            <p>Envía una consulta, propuesta o incidencia y podrás seguir toda la conversación desde este espacio.</p>
            <div className="rowActions"><a className="primaryButton" href="/buzon/nueva">Crear la primera consulta</a></div>
          </div>
        )}
      </div>
    </main>
  );
}
