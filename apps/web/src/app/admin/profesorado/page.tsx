'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string };
type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  networkCoordinations: Array<{ id: string; network: Network }>;
  ciclopeCoordinations: Array<{ id: string }>;
};

export default function FacultyAdminPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [message, setMessage] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');

  async function load() {
    const response = await fetch('/api/users');
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (!response.ok) {
      setMessage('No se pudo cargar el profesorado.');
      return;
    }
    setUsers(await response.json());
  }

  useEffect(() => { void load(); }, []);

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setTemporaryPassword('');
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
      setMessage(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo crear la cuenta.');
      return;
    }

    setTemporaryPassword(body.temporaryPassword);
    setMessage('Cuenta creada correctamente.');
    event.currentTarget.reset();
    await load();
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Profesorado de FP</h1>
          <p className="lead">Una única cuenta por docente. Las coordinaciones se añaden después por curso académico y pueden ser múltiples.</p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/admin/profesorado/importar">Importar CSV</a>
          <a className="secondaryButton" href="/admin/estructura">Familias y grupos</a>
          <a className="secondaryButton" href="/admin/cursos">Cursos y coordinaciones</a>
          <a className="secondaryButton" href="/">Volver</a>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}
      {temporaryPassword && (
        <div className="successBox">
          <strong>Contraseña temporal</strong>
          <p><code>{temporaryPassword}</code></p>
          <p className="hint">Se muestra para facilitar el primer acceso del docente. No se almacena en texto plano.</p>
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
              <input type="text" name="temporaryPassword" minLength={10} placeholder="Opcional: se genera automáticamente" />
            </label>
            <button className="primaryButton">Crear cuenta</button>
          </form>
        </article>

        <article className="panel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Directorio</p>
              <h2>{users.length} docentes activos</h2>
            </div>
          </div>
          <div className="assignmentList">
            {users.map((user) => (
              <div className="assignmentRow" key={user.id}>
                <div>
                  <strong>{user.lastName}, {user.firstName}</strong>
                  <span>{user.email}</span>
                  <div className="chipRow">
                    {user.networkCoordinations.map((assignment) => (
                      <span className="chip" key={assignment.id}>{assignment.network.name}</span>
                    ))}
                    {user.ciclopeCoordinations.length > 0 && <span className="chip">CÍCLOPE</span>}
                    {user.networkCoordinations.length === 0 && user.ciclopeCoordinations.length === 0 && (
                      <span className="badge">Sin coordinación en el curso activo</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
