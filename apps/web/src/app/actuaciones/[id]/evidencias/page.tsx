'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Action = {
  id: string;
  title: string;
  status: string;
};

type Evidence = {
  id: string;
  kind: string;
  title?: string | null;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  createdAt: string;
};

export default function ActionEvidencePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [items, setItems] = useState<Evidence[]>([]);
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const [workingId, setWorkingId] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [actionResponse, evidenceResponse] = await Promise.all([
        fetch(`/api/actions/${params.id}`),
        fetch(`/api/evidence/action/${params.id}`),
      ]);
      if (actionResponse.status === 401 || evidenceResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!actionResponse.ok || !evidenceResponse.ok) {
        setMessage('No se pudieron cargar las evidencias.');
        return;
      }
      setAction(await actionResponse.json());
      setItems(await evidenceResponse.json());
    } catch {
      setMessage('No se pudieron cargar las evidencias.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [params.id]);

  async function uploadFile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/evidence/action/${params.id}/file`, {
      method: 'POST',
      body: form,
    });
    const body = await response.json().catch(() => ({}));
    setUploading(false);
    if (!response.ok) {
      setMessage(body.message || 'No se pudo subir el archivo.');
      return;
    }
    event.currentTarget.reset();
    setMessage('Evidencia añadida.');
    await load();
  }

  async function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/evidence/action/${params.id}/link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title') || undefined,
        url: form.get('url'),
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo añadir el enlace.');
      return;
    }
    event.currentTarget.reset();
    setMessage('Enlace añadido.');
    await load();
  }

  async function removeEvidence(item: Evidence) {
    if (!window.confirm(`¿Eliminar la evidencia “${item.title || 'sin título'}”? Esta operación no puede deshacerse.`)) {
      return;
    }
    setWorkingId(item.id);
    setMessage('');
    const response = await fetch(`/api/evidence/${item.id}`, { method: 'DELETE' });
    const body = await response.json().catch(() => ({}));
    setWorkingId('');
    if (!response.ok) {
      setMessage(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'No se pudo eliminar la evidencia.');
      return;
    }
    setMessage('Evidencia eliminada.');
    await load();
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Evidencias</p>
          <h1>{action?.title || 'Actuación'}</h1>
          <p className="lead">Todo lo que subas queda asociado a esta actuación, al curso académico y a sus redes.</p>
        </div>
        <a className="secondaryButton" href="/actuaciones/mis-actuaciones">Mis actuaciones</a>
      </div>

      {message && <div className="notice">{message}</div>}
      {loading && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando evidencias…</strong>
        </div>
      )}

      <section className="adminGrid">
        <article className="panel">
          <h2>Subir archivo</h2>
          <form className="compactForm" onSubmit={uploadFile}>
            <label>
              Archivo
              <input
                type="file"
                name="file"
                required
                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4"
              />
            </label>
            <p className="hint">Máximo 25 MB. Imágenes, PDF, Office y vídeo MP4.</p>
            <button className="primaryButton" disabled={uploading}>{uploading ? 'Subiendo…' : 'Añadir archivo'}</button>
          </form>

          <h2 className="spacedHeading">Añadir enlace</h2>
          <form className="compactForm" onSubmit={addLink}>
            <label>Título<input name="title" placeholder="Opcional" /></label>
            <label>URL<input type="url" name="url" placeholder="https://…" required /></label>
            <button className="secondaryButton">Añadir enlace</button>
          </form>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div><p className="eyebrow">Repositorio</p><h2>{items.length} evidencias</h2></div>
          </div>
          <div className="evidenceList">
            {items.map((item) => (
              <div className="evidenceRow" key={item.id}>
                <div>
                  <strong>{item.title || (item.kind === 'LINK' ? 'Enlace' : 'Archivo')}</strong>
                  <span>
                    {item.kind === 'FILE' ? item.mimeType || 'Archivo' : 'Enlace'}
                    {' · '}
                    {new Date(item.createdAt).toLocaleString('es-ES')}
                  </span>
                </div>
                <div className="rowActions">
                  {item.kind === 'LINK' && item.url ? (
                    <a className="secondaryButton" href={item.url} target="_blank" rel="noreferrer">Abrir</a>
                  ) : (
                    <>
                      {(item.mimeType?.startsWith('image/') || item.mimeType === 'application/pdf' || item.mimeType === 'video/mp4') && (
                        <a className="secondaryButton" href={`/api/evidence/${item.id}/view`} target="_blank" rel="noreferrer">Vista previa</a>
                      )}
                      <a className="secondaryButton" href={`/api/evidence/${item.id}/download`}>Descargar</a>
                    </>
                  )}
                  {action && !['VALIDATED', 'ARCHIVED'].includes(action.status) && (
                    <button
                      className="textButton dangerText"
                      type="button"
                      disabled={workingId === item.id}
                      onClick={() => void removeEvidence(item)}
                    >
                      {workingId === item.id ? 'Eliminando…' : 'Eliminar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!loading && !items.length && (
              <div className="emptyState">
                <h3>Aún no hay evidencias asociadas</h3>
                <p>Sube un archivo o añade un enlace para documentar la actuación y mejorar la cobertura de evidencias de la memoria.</p>
              </div>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
