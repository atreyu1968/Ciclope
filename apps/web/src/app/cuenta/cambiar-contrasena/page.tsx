'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get('newPassword') || '');
    const confirmPassword = String(form.get('confirmPassword') || '');

    if (newPassword !== confirmPassword) {
      setSaving(false);
      setError('Las nuevas contraseñas no coinciden.');
      return;
    }

    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        currentPassword: form.get('currentPassword'),
        newPassword,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(false);

    if (!response.ok) {
      setError(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'No se pudo cambiar la contraseña.');
      return;
    }

    setMessage('Contraseña actualizada correctamente.');
    event.currentTarget.reset();
    setTimeout(() => {
      router.push('/');
      router.refresh();
    }, 500);
  }

  return (
    <main className="formShell narrow">
      <div className="formIntro">
        <p className="eyebrow">Cuenta</p>
        <h1>Cambiar contraseña</h1>
        <p>Utiliza una contraseña nueva de al menos 12 caracteres. Si accediste con una contraseña temporal, debes cambiarla antes de continuar.</p>
      </div>
      {message && <div className="successBox">{message}</div>}
      {error && <div className="errorBox">{error}</div>}
      <form className="actionForm" onSubmit={submit}>
        <fieldset>
          <legend>Seguridad</legend>
          <label>Contraseña actual<input type="password" name="currentPassword" autoComplete="current-password" required /></label>
          <label>Nueva contraseña<input type="password" name="newPassword" minLength={12} autoComplete="new-password" required /></label>
          <label>Repite la nueva contraseña<input type="password" name="confirmPassword" minLength={12} autoComplete="new-password" required /></label>
        </fieldset>
        <button className="primaryButton" disabled={saving}>{saving ? 'Guardando…' : 'Cambiar contraseña'}</button>
      </form>
    </main>
  );
}
