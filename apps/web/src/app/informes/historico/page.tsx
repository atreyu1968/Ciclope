'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Year = { id: string; name: string; isActive: boolean };
type Snapshot = {
  id: string;
  title: string;
  status: 'SAVED' | 'SUBMITTED';
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  submittedAt?: string | null;
  narrative?: string | null;
  academicYear: { id: string; name: string };
  network?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
};

function bodyMessage(body: any, fallback: string) {
  return Array.isArray(body?.message) ? body.message.join(' ') : body?.message || fallback;
}

export default function HistoricalReportsPage() {
  const router = useRouter();
  const [years, setYears] = useState<Year[]>([]);
  const [yearId, setYearId] = useState('');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState('');

  useEffect(() => {
    fetch('/api/academic-years').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const body = await response.json().catch(() => ([]));
      if (!response.ok) {
        setError(bodyMessage(body, 'No se pudieron cargar los cursos.'));
        setLoading(false);
        return;
      }
      const loaded = body as Year[];
      setYears(loaded);
      const active = loaded.find((year) => year.isActive) ?? loaded[0];
      setYearId(active?.id || '');
    });
  }, [router]);

  async function loadSnapshots(targetYearId: string) {
    if (!targetYearId) return;
    setLoading(true);
    setError('');
    const response = await fetch('/api/reports/snapshots?academicYearId=' + encodeURIComponent(targetYearId));
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    const body = await response.json().catch(() => ([]));
    setLoading(false);
    if (!response.ok) {
      setError(bodyMessage(body, 'No se pudo cargar el histórico.'));
      return;
    }
    setSnapshots(body);
  }

  useEffect(() => {
    void loadSnapshots(yearId);
  }, [yearId]);

  async function changeStatus(id: string, status: 'SAVED' | 'SUBMITTED') {
    setWorkingId(id);
    setMessage('');
    setError('');
    const response = await fetch('/api/reports/snapshots/' + id + '/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setWorkingId('');
      setError(bodyMessage(body, 'No se pudo cambiar el estado del corte.'));
      return;
    }
    setMessage(status === 'SUBMITTED' ? 'Informe marcado como entregado.' : 'Informe devuelto a estado guardado.');
    await loadSnapshots(yearId);
    setWorkingId('');
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Informes</p>
          <h1>Histórico de cortes</h1>
          <p className="lead">
            Cada corte conserva exactamente los indicadores y el texto guardados en ese momento, aunque los datos vivos cambien después.
          </p>
        </div>
        <div className="rowActions">
          <a className="primaryButton" href="/informes">Nuevo informe</a>
          <a className="secondaryButton" href="/coordinacion">Volver</a>
        </div>
      </div>

      {message && <div className="notice" role="status" aria-live="polite">{message}</div>}
      {error && <div className="errorBox" role="alert">{error}</div>}

      <section className="panel reportFilters">
        <label>Curso académico
          <select value={yearId} onChange={(event) => setYearId(event.target.value)}>
            {years.map((year) => (
              <option key={year.id} value={year.id}>
                {year.name}{year.isActive ? ' · activo' : ''}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando histórico de informes…</strong>
        </div>
      )}
      {!loading && !snapshots.length && !error && (
        <div className="emptyState">
          <h2>Sin cortes guardados</h2>
          <p>Genera un informe y pulsa «Guardar corte» para conservar sus cifras y su narrativa exactamente como estaban en ese momento.</p>
          <div className="rowActions"><a className="primaryButton" href="/informes">Generar un informe</a></div>
        </div>
      )}

      <div className="snapshotList">
        {snapshots.map((snapshot) => (
          <article className="snapshotCard" key={snapshot.id}>
            <div className="snapshotMain">
              <div className="queueMeta">
                <span>{snapshot.network?.name || 'Todas las redes autorizadas'}</span>
                <span>{snapshot.academicYear.name}</span>
                <span>
                  {new Date(snapshot.periodStart).toLocaleDateString('es-ES')} – {new Date(snapshot.periodEnd).toLocaleDateString('es-ES')}
                </span>
              </div>
              <h2>{snapshot.title}</h2>
              <p className="hint">
                Guardado el {new Date(snapshot.createdAt).toLocaleString('es-ES')}
                {snapshot.createdBy ? ' por ' + snapshot.createdBy.firstName + ' ' + snapshot.createdBy.lastName : ''}
                {snapshot.narrative ? ' · incluye texto asistido' : ''}
              </p>
            </div>
            <div className="snapshotActions">
              <span className={snapshot.status === 'SUBMITTED' ? 'badge success' : 'badge'}>
                {snapshot.status === 'SUBMITTED' ? 'Entregado' : 'Guardado'}
              </span>
              <a className="primaryButton" href={'/informes/historico/' + snapshot.id}>Abrir</a>
              {snapshot.status === 'SAVED' ? (
                <button className="secondaryButton" disabled={Boolean(workingId)} onClick={() => void changeStatus(snapshot.id, 'SUBMITTED')}>
                  {workingId === snapshot.id ? 'Actualizando…' : 'Marcar entregado'}
                </button>
              ) : (
                <button className="textButton" disabled={Boolean(workingId)} onClick={() => void changeStatus(snapshot.id, 'SAVED')}>
                  {workingId === snapshot.id ? 'Actualizando…' : 'Reabrir'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
