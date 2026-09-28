'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SetupPage() {
  const router = useRouter();
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/setup/status')
      .then((r) => r.json())
      .then((data) => setInitialized(Boolean(data.initialized)))
      .catch(() => setInitialized(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/setup/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form.entries())),
    });
    setSending(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo inicializar la aplicación.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  if (initialized === null) return <main className="formShell"><p>Comprobando instalación…</p></main>;

  if (initialized) {
    return (
      <main className="formShell narrow">
        <div className="successBox">
          <h1>La instalación ya está configurada</h1>
          <p>El asistente de primer acceso queda bloqueado tras crear el primer administrador.</p>
          <a className="primaryButton" href="/login">Ir al acceso</a>
        </div>
      </main>
    );
  }

  return (
    <main className="formShell narrow">
      <div className="formIntro">
        <p className="eyebrow">Primera instalación</p>
        <h1>Configurar CÍCLOPE FP</h1>
        <p>Esta operación crea el centro y la primera cuenta administradora.</p>
      </div>
      <form className="actionForm" onSubmit={submit}>
        <fieldset>
          <legend>Centro educativo</legend>
          <label>Nombre del centro<input name="centerName" required minLength={3} /></label>
          <label>Código del centro<input name="centerCode" required minLength={3} /></label>
        </fieldset>
        <fieldset>
          <legend>Administrador inicial</legend>
          <div className="twoColumns">
            <label>Nombre<input name="firstName" required /></label>
            <label>Apellidos<input name="lastName" required /></label>
          </div>
          <label>Correo electrónico<input type="email" name="email" required /></label>
          <label>Contraseña
            <input type="password" name="password" minLength={12} required />
            <span className="hint">Mínimo 12 caracteres, con mayúscula, minúscula y número.</span>
          </label>
        </fieldset>
        {error && <p className="errorBox">{error}</p>}
        <button className="primaryButton" disabled={sending}>{sending ? 'Configurando…' : 'Crear instalación'}</button>
      </form>
    </main>
  );
}
