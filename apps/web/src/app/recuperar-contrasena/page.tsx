'use client';

import { FormEvent, useState } from 'react';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    const form = new FormData(event.currentTarget);
    await fetch('/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: form.get('email') }),
    }).catch(() => undefined);
    setSending(false);
    setSent(true);
  }

  return (
    <main className="formShell narrow">
      <div className="formIntro">
        <p className="eyebrow">Acceso</p>
        <h1>Recuperar contraseña</h1>
        <p>Introduce tu correo. Si existe una cuenta activa y el centro tiene Resend configurado, recibirás un enlace válido durante 60 minutos.</p>
      </div>
      {sent ? (
        <div className="successBox">
          <strong>Solicitud registrada</strong>
          <p>Si la cuenta existe, recibirás las instrucciones por correo. Por seguridad no confirmamos si una dirección está registrada.</p>
          <a className="secondaryButton" href="/login">Volver al acceso</a>
        </div>
      ) : (
        <form className="actionForm" onSubmit={submit}>
          <fieldset>
            <legend>Cuenta</legend>
            <label>Correo electrónico<input type="email" name="email" autoComplete="email" required /></label>
          </fieldset>
          <button className="primaryButton" disabled={sending}>{sending ? 'Enviando…' : 'Solicitar enlace'}</button>
        </form>
      )}
    </main>
  );
}
