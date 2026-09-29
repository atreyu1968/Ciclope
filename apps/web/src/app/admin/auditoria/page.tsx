'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
  actor?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
};

const labels: Record<string, string> = {
  USER_CREATED: 'Cuenta creada',
  USER_UPDATED: 'Cuenta actualizada',
  USER_DEACTIVATED: 'Cuenta desactivada',
  USER_REACTIVATED: 'Cuenta reactivada',
  USER_PASSWORD_RESET_BY_ADMIN: 'Contraseña restablecida por administración',
  USERS_IMPORTED: 'Importación de profesorado',
  PASSWORD_CHANGED: 'Contraseña cambiada',
  PASSWORD_RESET_REQUESTED: 'Recuperación de contraseña solicitada',
  PASSWORD_RESET_COMPLETED: 'Recuperación de contraseña completada',
};

export default function AuditPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/audit').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const body = await response.json().catch(() => ([]));
      if (!response.ok) {
        setError('No se pudo cargar el registro de auditoría.');
        return;
      }
      setEntries(body);
    }).catch(() => setError('No se pudo cargar el registro de auditoría.'))
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración · Seguridad</p>
          <h1>Registro de auditoría</h1>
          <p className="lead">
            Trazabilidad de operaciones sensibles. Los registros se conservan en base de datos y no pueden editarse desde esta pantalla.
          </p>
        </div>
        <a className="secondaryButton" href="/admin">Administración</a>
      </div>

      {error && <div className="errorBox" role="alert">{error}</div>}
      {loading && !error && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando registro de auditoría…</strong>
        </div>
      )}

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Últimos movimientos</p>
            <h2>{entries.length} registros mostrados</h2>
          </div>
        </div>

        <div className="assignmentList">
          {entries.length === 0 && !error && !loading && (
            <div className="emptyState">
              <h3>Todavía no existen operaciones auditadas</h3>
              <p>Las operaciones sensibles aparecerán aquí automáticamente cuando se produzcan.</p>
            </div>
          )}
          {entries.map((entry) => (
            <div className="assignmentRow" key={entry.id}>
              <div>
                <strong>{labels[entry.action] || entry.action}</strong>
                <span>
                  {new Date(entry.createdAt).toLocaleString('es-ES')} · {' '}
                  {entry.actor
                    ? `${entry.actor.firstName} ${entry.actor.lastName} (${entry.actor.email})`
                    : 'Sistema / usuario no disponible'}
                </span>
                <div className="chipRow">
                  <span className="chip">{entry.entityType}</span>
                  {entry.entityId && <span className="badge">{entry.entityId}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
