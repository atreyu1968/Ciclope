'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string; code: string };
type Family = { id: string; name: string };
type Me = {
  roles: string[];
  coordinatorNetworkIds: string[];
};

const GLOBAL_ROLES = ['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION', 'COORDINADOR_CICLOPE'];

export default function NewCommunicationPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([]);
  const [allFp, setAllFp] = useState(true);
  const [morning, setMorning] = useState(false);
  const [afternoon, setAfternoon] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [resendConfigured, setSmtpConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/networks'),
      fetch('/api/structure/families'),
      fetch('/api/communications/mail-status'),
    ]).then(async ([meResponse, networksResponse, familiesResponse, mailResponse]) => {
      if (meResponse.status === 401) {
        router.push('/login');
        return;
      }
      setMe(await meResponse.json());
      setNetworks(await networksResponse.json());
      setFamilies(await familiesResponse.json());
      if (mailResponse.ok) {
        const mail = await mailResponse.json();
        setSmtpConfigured(Boolean(mail.configured));
      }
    }).catch(() => setMessage('No se pudieron cargar los datos.'));
  }, [router]);

  const availableNetworks = useMemo(() => {
    if (!me) return [];
    if (GLOBAL_ROLES.some((role) => me.roles.includes(role))) return networks;
    return networks.filter((network) => me.coordinatorNetworkIds.includes(network.id));
  }, [me, networks]);

  function toggleFamily(id: string) {
    setSelectedFamilies((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const shifts = [
      ...(morning ? ['MORNING'] : []),
      ...(afternoon ? ['AFTERNOON'] : []),
    ];
    const response = await fetch('/api/communications', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        body: form.get('body'),
        originNetworkId: form.get('originNetworkId') || undefined,
        responseRequired: form.get('responseRequired') === 'on',
        deadline: form.get('deadline') || undefined,
        targetAllFp: allFp,
        professionalFamilyIds: allFp ? [] : selectedFamilies,
        shifts: allFp ? [] : shifts,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setMessage(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo publicar.');
      return;
    }
    setMessage(`Comunicación publicada para ${body._count?.recipients ?? 0} destinatarios.`);
    event.currentTarget.reset();
    setSelectedFamilies([]);
    setAllFp(true);
    setMorning(false);
    setAfternoon(false);
  }

  return (
    <main className="formShell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Comunicación</p>
          <h1>Nueva comunicación</h1>
          <p className="lead">Publica una sola vez y deja que CÍCLOPE calcule los destinatarios.</p>
        </div>
        <a className="secondaryButton" href="/comunicaciones">Bandeja</a>
      </div>

      {message && <div className="notice">{message}</div>}
      {resendConfigured === false && (
        <div className="notice">
          Resend todavía no está configurado o activado. La comunicación se publicará en CÍCLOPE, pero no se enviará por correo hasta configurarlo en Administración → Integraciones.
        </div>
      )}

      <form className="actionForm" onSubmit={submit}>
        <fieldset>
          <legend>1. Mensaje</legend>
          <label>Origen
            <select name="originNetworkId" defaultValue="">
              <option value="">CÍCLOPE / comunicación general</option>
              {availableNetworks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
            </select>
          </label>
          <label>Título<input name="title" maxLength={180} required /></label>
          <label>Mensaje<textarea name="body" rows={8} maxLength={12000} required /></label>
        </fieldset>

        <fieldset>
          <legend>2. Destinatarios</legend>
          <label className="checkCard">
            <input type="checkbox" checked={allFp} onChange={(e) => setAllFp(e.target.checked)} />
            <span>Todo el profesorado de FP</span>
          </label>

          {!allFp && (
            <>
              <p className="hint">Si marcas familia y turno, se enviará al profesorado que cumpla ambos criterios.</p>
              <h3>Familias profesionales</h3>
              <div className="checks">
                {families.map((family) => (
                  <label className="checkCard" key={family.id}>
                    <input type="checkbox" checked={selectedFamilies.includes(family.id)} onChange={() => toggleFamily(family.id)} />
                    <span>{family.name}</span>
                  </label>
                ))}
              </div>
              <h3>Turno</h3>
              <div className="checks">
                <label className="checkCard"><input type="checkbox" checked={morning} onChange={(e) => setMorning(e.target.checked)} /><span>Mañana</span></label>
                <label className="checkCard"><input type="checkbox" checked={afternoon} onChange={(e) => setAfternoon(e.target.checked)} /><span>Tarde</span></label>
              </div>
            </>
          )}
        </fieldset>

        <fieldset>
          <legend>3. Seguimiento</legend>
          <label className="checkCard">
            <input type="checkbox" name="responseRequired" />
            <span>Solicitar respuesta</span>
          </label>
          <label>Fecha límite<input type="datetime-local" name="deadline" /></label>
        </fieldset>

        <button className="primaryButton" disabled={sending}>{sending ? 'Publicando…' : 'Publicar comunicación'}</button>
      </form>
    </main>
  );
}
