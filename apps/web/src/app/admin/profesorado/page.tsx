'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string };
type Family = { id: string; name: string };
type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  shift: string;
  active: boolean;
  mustChangePassword: boolean;
  professionalFamilies: Array<{ professionalFamily: Family }>;
  networkCoordinations: Array<{ id: string; network: Network }>;
  ciclopeCoordinations: Array<{ id: string }>;
};

function errorMessage(body: any, fallback: string) {
  return Array.isArray(body?.message) ? body.message.join(' ') : body?.message || fallback;
}

export default function FacultyAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [temporaryPasswordFor, setTemporaryPasswordFor] = useState('');
  const [workingId, setWorkingId] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [usersResponse, familiesResponse] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/structure/families'),
      ]);
      if (usersResponse.status === 401 || familiesResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!usersResponse.ok || !familiesResponse.ok) {
        setError('No se pudo cargar el profesorado o las familias profesionales.');
        return;
      }
      setError('');
      setUsers(await usersResponse.json());
      setFamilies(await familiesResponse.json());
    } catch {
      setError('No se pudo cargar el profesorado o las familias profesionales.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorkingId('new');
    setMessage('');
    setError('');
    setTemporaryPassword('');
    setTemporaryPasswordFor('');
    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      email: form.get('email'),
      temporaryPassword: form.get('temporaryPassword') || undefined,
    };
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setWorkingId('');
      setError(errorMessage(body, 'No se pudo crear la cuenta.'));
      return;
    }

    setTemporaryPassword(body.temporaryPassword);
    setTemporaryPasswordFor(`${body.user.firstName} ${body.user.lastName}`);
    setMessage('Cuenta creada correctamente. El docente deberá cambiar la contraseña temporal en el primer acceso.');
    event.currentTarget.reset();
    await load();
    setWorkingId('');
  }

  async function updateUser(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setWorkingId(userId);
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const user = users.find((item) => item.id === userId);
    const willDeactivate = Boolean(user?.active && form.get('active') !== 'on');
    if (willDeactivate && !window.confirm(
      `¿Desactivar la cuenta de ${user?.firstName} ${user?.lastName}? Se revocarán sus sesiones y no podrá acceder hasta que se reactive.`,
    )) {
      setWorkingId('');
      return;
    }
    const response = await fetch('/api/users/' + userId, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: form.get('firstName'),
        lastName: form.get('lastName'),
        email: form.get('email'),
        shift: form.get('shift'),
        active: form.get('active') === 'on',
        familyIds: form.getAll('familyIds'),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setWorkingId('');
    if (!response.ok) {
      setError(errorMessage(body, 'No se pudo actualizar la cuenta.'));
      return;
    }
    setMessage('Ficha del docente actualizada.');
    await load();
  }

  async function resetPassword(user: User) {
    if (!window.confirm(`Se revocarán las sesiones de ${user.firstName} ${user.lastName} y se generará una nueva contraseña temporal. ¿Continuar?`)) {
      return;
    }
    setWorkingId(user.id);
    setMessage('');
    setError('');
    setTemporaryPassword('');
    setTemporaryPasswordFor('');
    const response = await fetch('/api/users/' + user.id + '/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    const body = await response.json().catch(() => ({}));
    setWorkingId('');
    if (!response.ok) {
      setError(errorMessage(body, 'No se pudo restablecer la contraseña.'));
      return;
    }
    setTemporaryPassword(body.temporaryPassword);
    setTemporaryPasswordFor(`${user.firstName} ${user.lastName}`);
    setMessage('Contraseña restablecida. El usuario deberá cambiarla en el siguiente acceso.');
    await load();
  }

  const activeCount = users.filter((user) => user.active).length;
  const inactiveCount = users.length - activeCount;

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Profesorado de FP</h1>
          <p className="lead">
            Una única cuenta por docente. La desactivación conserva el histórico y revoca las sesiones; las coordinaciones siguen vinculadas al curso académico.
          </p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/api/users/export.csv">Exportar CSV</a>
          <a className="secondaryButton" href="/admin/profesorado/importar">Importar CSV</a>
          <a className="secondaryButton" href="/admin/estructura">Familias y grupos</a>
          <a className="secondaryButton" href="/admin/cursos">Cursos y coordinaciones</a>
          <a className="secondaryButton" href="/admin">Administración</a>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}
      {error && <div className="errorBox">{error}</div>}
      {loading && !error && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando directorio de profesorado…</strong>
        </div>
      )}
      {temporaryPassword && (
        <div className="successBox">
          <strong>Contraseña temporal de {temporaryPasswordFor}</strong>
          <p><code>{temporaryPassword}</code></p>
          <p className="hint">
            Se muestra una sola vez para que puedas comunicarla al docente. No se almacena en texto plano y deberá cambiarse en el primer acceso.
          </p>
        </div>
      )}

      <section className="adminGrid">
        <article className="panel">
          <h2>Alta de docente</h2>
          <form className="compactForm" onSubmit={createUser}>
            <div className="twoColumns">
              <label>Nombre<input name="firstName" required /></label>
              <label>Apellidos<input name="lastName" required /></label>
            </div>
            <label>Correo electrónico<input type="email" name="email" required /></label>
            <label>
              Contraseña temporal
              <input type="text" name="temporaryPassword" minLength={12} placeholder="Opcional: se genera automáticamente" />
            </label>
            <button className="primaryButton" disabled={Boolean(workingId)}>
              {workingId === 'new' ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        </article>

        <article className="panel">
          <p className="eyebrow">Directorio</p>
          <h2>{activeCount} activos · {inactiveCount} inactivos</h2>
          <p className="hint">Abre una ficha para editarla. Las cuentas inactivas permanecen en el histórico pero no pueden iniciar sesión.</p>
        </article>
      </section>

      <section className="panel">
        <div className="assignmentList">
          {!loading && !users.length && !error && (
            <div className="emptyState">
              <h2>No hay profesorado registrado</h2>
              <p>Puedes crear la primera cuenta manualmente o importar el directorio desde un CSV.</p>
              <div className="rowActions"><a className="secondaryButton" href="/admin/profesorado/importar">Importar CSV</a></div>
            </div>
          )}
          {users.map((user) => {
            const assignedFamilies = new Set(user.professionalFamilies.map((item) => item.professionalFamily.id));
            return (
              <details className="assignmentRow" key={user.id}>
                <summary>
                  <div>
                    <strong>{user.lastName}, {user.firstName}</strong>
                    <span>{user.email} · {user.shift}</span>
                    <div className="chipRow">
                      <span className={user.active ? 'badge success' : 'badge'}>
                        {user.active ? 'Activo' : 'Inactivo'}
                      </span>
                      {user.mustChangePassword && <span className="badge">Cambio de contraseña pendiente</span>}
                      {user.networkCoordinations.map((assignment) => (
                        <span className="chip" key={assignment.id}>{assignment.network.name}</span>
                      ))}
                      {user.ciclopeCoordinations.length > 0 && <span className="chip">CÍCLOPE</span>}
                    </div>
                  </div>
                </summary>

                <form className="compactForm" onSubmit={(event) => void updateUser(event, user.id)}>
                  <div className="twoColumns">
                    <label>Nombre<input name="firstName" required defaultValue={user.firstName} /></label>
                    <label>Apellidos<input name="lastName" required defaultValue={user.lastName} /></label>
                  </div>
                  <label>Correo electrónico<input type="email" name="email" required defaultValue={user.email} /></label>
                  <label>Turno
                    <select name="shift" defaultValue={user.shift}>
                      <option value="MORNING">Mañana</option>
                      <option value="AFTERNOON">Tarde</option>
                      <option value="BOTH">Ambos</option>
                      <option value="UNSPECIFIED">Sin especificar</option>
                    </select>
                  </label>

                  <fieldset>
                    <legend>Familias profesionales</legend>
                    <div className="chipRow">
                      {families.map((family) => (
                        <label className="checkCard" key={family.id}>
                          <input
                            type="checkbox"
                            name="familyIds"
                            value={family.id}
                            defaultChecked={assignedFamilies.has(family.id)}
                          />
                          <span>{family.name}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="checkCard">
                    <input type="checkbox" name="active" defaultChecked={user.active} />
                    <span>Cuenta activa</span>
                  </label>

                  <div className="rowActions">
                    <button className="primaryButton" disabled={workingId === user.id}>
                      {workingId === user.id ? 'Guardando…' : 'Guardar ficha'}
                    </button>
                    <button
                      className="secondaryButton"
                      type="button"
                      disabled={workingId === user.id}
                      onClick={() => void resetPassword(user)}
                    >
                      Restablecer contraseña
                    </button>
                  </div>
                </form>
              </details>
            );
          })}
        </div>
      </section>
    </main>
  );
}
