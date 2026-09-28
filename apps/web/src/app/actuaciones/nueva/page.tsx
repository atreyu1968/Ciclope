'use client';

import { FormEvent, useEffect, useState } from 'react';
type Network = { id: string; name: string; code: string };

export default function NewActionPage() {
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<'idle'|'sending'|'sent'|'error'>('idle');

  useEffect(() => {
    fetch('/api/networks').then((r) => r.json()).then(setNetworks).catch(() => setNetworks([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) return;
    setState('sending');
    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get('title'),
      description: form.get('description'),
      type: form.get('type'),
      activityDate: form.get('activityDate'),
      durationMinutes: Number(form.get('durationMinutes') || 0) || undefined,
      studentCount: Number(form.get('studentCount') || 0) || undefined,
      submittedByName: form.get('submittedByName'),
      submittedByEmail: form.get('submittedByEmail'),
      networkIds: selected,
    };
    const response = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setState(response.ok ? 'sent' : 'error');
    if (response.ok) event.currentTarget.reset();
  }

  function toggleNetwork(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  return (
    <main className="formShell">
      <a className="backLink" href="/">← Volver al inicio</a>
      <div className="formIntro">
        <p className="eyebrow">Profesorado FP</p>
        <h1>Registrar actuación</h1>
        <p>Un formulario breve. La coordinación no tendrá que volver a introducir estos datos.</p>
      </div>
      {state === 'sent' ? (
        <div className="successBox">
          <h2>Actuación enviada</h2>
          <p>Ha quedado registrada y pendiente de validación por la coordinación correspondiente.</p>
          <button className="primaryButton" onClick={() => { setState('idle'); setSelected([]); }}>Registrar otra</button>
        </div>
      ) : (
        <form className="actionForm" onSubmit={submit}>
          <fieldset>
            <legend>1. ¿Qué has hecho?</legend>
            <label>Título<input name="title" maxLength={180} required /></label>
            <label>Descripción<textarea name="description" rows={5} maxLength={4000} required /></label>
            <div className="twoColumns">
              <label>Tipo<select name="type" required defaultValue="">
                <option value="" disabled>Selecciona</option>
                <option>Actividad con alumnado</option><option>Visita</option><option>Taller</option>
                <option>Charla</option><option>Proyecto</option><option>Formación</option>
                <option>Actividad con empresa</option><option>Concurso</option><option>Jornada</option>
                <option>Difusión</option><option>Buena práctica</option><option>Otra</option>
              </select></label>
              <label>Fecha<input type="date" name="activityDate" required /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>2. Participación</legend>
            <div className="twoColumns">
              <label>N.º de alumnos<input type="number" name="studentCount" min="0" /></label>
              <label>Duración (minutos)<input type="number" name="durationMinutes" min="0" /></label>
            </div>
          </fieldset>
          <fieldset>
            <legend>3. ¿Con qué redes se relaciona?</legend>
            <p className="hint">Puedes seleccionar más de una.</p>
            <div className="checks">
              {networks.map((network) => (
                <label className="checkCard" key={network.id}>
                  <input type="checkbox" checked={selected.includes(network.id)} onChange={() => toggleNetwork(network.id)} />
                  <span>{network.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>4. Tus datos</legend>
            <p className="hint">Al activar el acceso institucional estos campos se completarán automáticamente.</p>
            <div className="twoColumns">
              <label>Nombre y apellidos<input name="submittedByName" maxLength={160} required /></label>
              <label>Correo<input type="email" name="submittedByEmail" maxLength={254} required /></label>
            </div>
          </fieldset>
          {state === 'error' && <p className="errorBox">No se pudo registrar la actuación. Revisa los datos e inténtalo de nuevo.</p>}
          <button className="primaryButton" disabled={state === 'sending' || selected.length === 0}>
            {state === 'sending' ? 'Enviando…' : 'Enviar actuación'}
          </button>
        </form>
      )}
    </main>
  );
}
