'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string };

export default function NewStaffRequestPage() {
  const router = useRouter();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/networks').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) throw new Error();
      setNetworks(await response.json());
    }).catch(() => setError('No se pudieron cargar las redes.'));
  }, [router]);

  function toggle(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) return;
    setSending(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/staff-requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        category: form.get('category'),
        subject: form.get('subject'),
        body: form.get('body'),
        networkIds: selected,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo enviar.');
      return;
    }
    router.push(`/buzon/${body.id}`);
  }

  return (
    <main className="formShell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Buzón CÍCLOPE</p>
          <h1>Nueva consulta o propuesta</h1>
          <p className="lead">Selecciona una o varias redes. La petición llegará automáticamente a las coordinaciones correspondientes.</p>
        </div>
        <a className="secondaryButton" href="/buzon">Cancelar</a>
      </div>

      {error && <div className="errorBox">{error}</div>}

      <form className="actionForm" onSubmit={submit}>
        <fieldset>
          <legend>1. Tipo</legend>
          <label>Categoría
            <select name="category" required defaultValue="">
              <option value="" disabled>Selecciona</option>
              <option value="Consulta">Consulta</option>
              <option value="Propuesta">Propuesta</option>
              <option value="Necesidad">Necesidad detectada</option>
              <option value="Colaboración">Oferta de colaboración</option>
              <option value="Idea">Idea / buena práctica</option>
              <option value="Otra">Otra</option>
            </select>
          </label>
          <label>Asunto<input name="subject" maxLength={180} required /></label>
          <label>Mensaje<textarea name="body" rows={8} maxLength={6000} required /></label>
        </fieldset>

        <fieldset>
          <legend>2. Redes destinatarias</legend>
          <p className="hint">Puedes seleccionar más de una si el asunto es transversal.</p>
          <div className="checks">
            {networks.map((network) => (
              <label className="checkCard" key={network.id}>
                <input type="checkbox" checked={selected.includes(network.id)} onChange={() => toggle(network.id)} />
                <span>{network.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button className="primaryButton" disabled={sending || selected.length === 0}>
          {sending ? 'Enviando…' : 'Enviar al buzón'}
        </button>
      </form>
    </main>
  );
}
