'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('passwordReset') === '1') {
      setNotice('Contraseña restablecida. Ya puedes iniciar sesión.');
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError('');
    setNotice('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: form.get('email'),
        password: form.get('password'),
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSending(false);

    if (!response.ok) {
      setError(Array.isArray(body?.message)
        ? body.message.join(' ')
        : body?.message || 'No se ha podido iniciar sesión. Revisa tus credenciales.');
      return;
    }

    if (body.mustChangePassword) {
      router.push('/cuenta/cambiar-contrasena');
    } else {
      router.push('/');
    }
    router.refresh();
  }

  return (
    <main className="formShell narrow">
      <div className="formIntro">
        <p className="eyebrow">Acceso</p>
        <h1>CÍCLOPE FP</h1>
        <p>Identifícate para acceder a tu espacio de trabajo y a las coordinaciones asignadas durante el curso.</p>
      </div>

      {notice && <div className="successBox">{notice}</div>}
      {error && <p className="errorBox">{error}</p>}

      <form className="actionForm" onSubmit={submit}>
        <fieldset>
          <legend>Credenciales</legend>
          <label>Correo electrónico<input type="email" name="email" autoComplete="email" required /></label>
          <label>Contraseña<input type="password" name="password" autoComplete="current-password" required /></label>
        </fieldset>
        <button className="primaryButton" disabled={sending}>{sending ? 'Accediendo…' : 'Entrar'}</button>
      </form>

      <div className="rowActions">
        <a className="secondaryLink" href="/recuperar-contrasena">He olvidado mi contraseña</a>
        <a className="secondaryLink" href="/configuracion-inicial">Configuración inicial</a>
      </div>
    </main>
  );
}
