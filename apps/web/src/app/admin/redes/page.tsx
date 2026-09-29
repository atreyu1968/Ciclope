'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  institutionalObjectives?: string[];
  institutionalConfigured?: boolean;
};

type Draft = {
  description: string;
  objectives: string;
};

function messageFrom(body: any, fallback: string) {
  return Array.isArray(body?.message) ? body.message.join(' ') : body?.message || fallback;
}

export default function NetworkInstitutionalAdminPage() {
  const router = useRouter();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const response = await fetch('/api/networks');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (response.status === 403) {
      router.push('/acceso-denegado');
      return;
    }
    const body = await response.json().catch(() => ([]));
    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo cargar la configuración de redes.'));
      setLoading(false);
      return;
    }

    setError('');
    const loaded = body as Network[];
    setNetworks(loaded);
    setDrafts(Object.fromEntries(loaded.map((network) => [
      network.id,
      {
        description: network.description || '',
        objectives: (network.institutionalObjectives || []).join('\n'),
      },
    ])));
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function save(event: FormEvent<HTMLFormElement>, network: Network) {
    event.preventDefault();
    const draft = drafts[network.id];
    if (!draft) return;

    setBusy(network.id);
    setMessage('');
    setError('');

    const objectives = draft.objectives
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);

    const response = await fetch('/api/networks/' + network.id + '/institutional', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        description: draft.description,
        institutionalObjectives: objectives,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy('');

    if (!response.ok) {
      setError(messageFrom(body, 'No se pudo guardar la configuración de la red.'));
      return;
    }

    setMessage('Configuración institucional de ' + network.name + ' guardada.');
    await load();
  }

  function updateDraft(id: string, field: keyof Draft, value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || { description: '', objectives: '' }),
        [field]: value,
      },
    }));
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración · Redes</p>
          <h1>Textos y objetivos institucionales</h1>
          <p className="lead">
            Personaliza para este centro la descripción y las líneas de referencia de cada red sin modificar código.
          </p>
        </div>
        <a className="secondaryButton" href="/admin">Volver a Administración</a>
      </div>

      {message && <div className="notice" role="status" aria-live="polite">{message}</div>}
      {error && <div className="errorBox" role="alert">{error}</div>}
      {loading && !error && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando configuración institucional de las redes…</strong>
        </div>
      )}

      <section className="networkAdminGrid">
        {networks.map((network) => {
          const draft = drafts[network.id] || { description: '', objectives: '' };
          return (
            <form className="panel networkAdminCard" key={network.id} onSubmit={(event) => void save(event, network)}>
              <div className="panelHeader">
                <div>
                  <p className="eyebrow">{network.code}</p>
                  <h2>{network.name}</h2>
                </div>
                <span className={network.institutionalConfigured ? 'badge success' : 'badge'}>
                  {network.institutionalConfigured ? 'Personalizada' : 'Base'}
                </span>
              </div>

              <label>Descripción institucional
                <textarea
                  rows={6}
                  maxLength={5000}
                  value={draft.description}
                  onChange={(event) => updateDraft(network.id, 'description', event.target.value)}
                  placeholder="Finalidad, alcance y orientación de esta red en el centro."
                />
              </label>

              <label>Objetivos o líneas de referencia
                <textarea
                  rows={10}
                  maxLength={15000}
                  value={draft.objectives}
                  onChange={(event) => updateDraft(network.id, 'objectives', event.target.value)}
                  placeholder={'Escribe un objetivo por línea.\nEj.: Incrementar la participación del profesorado en proyectos colaborativos.'}
                />
              </label>
              <p className="hint">
                Un objetivo por línea. Se admiten hasta 30 objetivos de 500 caracteres como máximo.
              </p>

              <button className="primaryButton" disabled={Boolean(busy)}>
                {busy === network.id ? 'Guardando…' : 'Guardar configuración'}
              </button>
            </form>
          );
        })}
      </section>

      {!loading && !networks.length && !error && (
        <section className="emptyState">
          <h2>No hay redes activas disponibles</h2>
          <p>La configuración institucional aparecerá aquí cuando existan redes habilitadas para el centro.</p>
        </section>
      )}
    </main>
  );
}
