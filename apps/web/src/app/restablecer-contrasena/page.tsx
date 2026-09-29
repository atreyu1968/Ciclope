'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') || '');
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setSaving(true);
    const response = await fetch('/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, newPassword }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'No se pudo restablecer la contraseña.');
      return;
    }

    router.push('/login?passwordReset=1');
  }

  return (
    <main className="formShell narrow">
      <div className="formIntro">
        <p className="eyebrow">Acceso</p>
        <h1>Restablecer contraseña</h1>
        <p>Define una nueva contraseña de al menos 12 caracteres.</p>
      </div>
      {!token && <div className="errorBox">El enlace no contiene un token de recuperación válido.</div>}
      {error && <div className="errorBox">{error}</div>}
      {token && (
        <form className="actionForm" onSubmit={submit}>
          <fieldset>
            <legend>Nueva contraseña</legend>
            <label>Contraseña<input type="password" name="newPassword" minLength={12} autoComplete="new-password" required /></label>
            <label>Repite la contraseña<input type="password" name="confirmPassword" minLength={12} autoComplete="new-password" required /></label>
          </fieldset>
          <button className="primaryButton" disabled={saving}>{saving ? 'Guardando…' : 'Guardar nueva contraseña'}</button>
        </form>
      )}
    </main>
  );
}
