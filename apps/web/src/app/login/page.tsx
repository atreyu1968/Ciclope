'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    setSending(false);
    if (!response.ok) {
      setError('No se ha podido iniciar sesión. Revisa tus credenciales.');
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <main className="formShell narrow">
      <div className="formIntro">
        <p className="eyebrow">Acceso</p>
        <h1>CÍCLOPE FP</h1>
        <p>Identifícate para acceder a tu espacio de trabajo y a las coordinaciones asignadas durante el curso.</p>
      </div>
      <form className="actionForm" onSubmit={submit}>
        <fieldset>
          <legend>Credenciales</legend>
          <label>Correo electrónico<input type="email" name="email" autoComplete="email" required /></label>
          <label>Contraseña<input type="password" name="password" autoComplete="current-password" required /></label>
        </fieldset>
        {error && <p className="errorBox">{error}</p>}
        <button className="primaryButton" disabled={sending}>{sending ? 'Accediendo…' : 'Entrar'}</button>
      </form>
      <p className="hint">Si es la primera instalación, utiliza el asistente de configuración inicial.</p>
      <a className="secondaryLink" href="/configuracion-inicial">Configuración inicial</a>
    </main>
  );
}
