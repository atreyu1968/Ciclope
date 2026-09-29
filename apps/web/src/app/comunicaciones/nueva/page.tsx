'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
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
  const [aiBrief, setAiBrief] = useState('');
  const [aiDraft, setAiDraft] = useState('');
  const [aiError, setAiError] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

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

  async function generateDraft() {
    if (!aiBrief.trim() || !formRef.current) return;
    setAiBusy(true);
    setAiDraft('');
    setAiError('');
    const current = new FormData(formRef.current);
    const audience = allFp
      ? 'Todo el profesorado de FP'
      : [
          selectedFamilies.length ? 'Familias seleccionadas: ' + selectedFamilies.length : '',
          morning ? 'turno de mañana' : '',
          afternoon ? 'turno de tarde' : '',
        ].filter(Boolean).join(' · ');
    const response = await fetch('/api/assistant/communication-draft', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        brief: aiBrief.trim(),
        title: current.get('title') || undefined,
        currentBody: current.get('body') || undefined,
        audience,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setAiBusy(false);
    if (!response.ok) {
      setAiError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo generar el borrador.');
      return;
    }
    setAiDraft(body.text || '');
  }

  function applyDraft() {
    if (!formRef.current || !aiDraft) return;
    const titleInput = formRef.current.elements.namedItem('title') as HTMLInputElement | null;
    const bodyInput = formRef.current.elements.namedItem('body') as HTMLTextAreaElement | null;
    const lines = aiDraft.split('\n');
    const titleLine = lines.find((line) => /^TÍTULO\s*:/i.test(line));
    const titleIndex = titleLine ? lines.indexOf(titleLine) : -1;
    if (titleInput && titleLine) {
      titleInput.value = titleLine.replace(/^TÍTULO\s*:/i, '').trim().slice(0, 180);
    }
    if (bodyInput) {
      bodyInput.value = lines
        .filter((_, index) => index !== titleIndex)
        .join('\n')
        .trim()
        .slice(0, 12000);
    }
    setMessage('Borrador de IA aplicado al formulario. Revísalo antes de publicar.');
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
    if (!response.ok) {
      setSending(false);
      setMessage(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo publicar.');
      return;
    }

    let uploaded = 0;
    let failed = 0;
    for (const file of attachmentFiles) {
      const attachment = new FormData();
      attachment.append('file', file);
      const uploadResponse = await fetch(`/api/communications/${body.id}/attachments`, {
        method: 'POST',
        body: attachment,
      });
      if (uploadResponse.ok) uploaded += 1;
      else failed += 1;
    }

    setSending(false);
    setMessage(
      failed
        ? `Comunicación publicada para ${body._count?.recipients ?? 0} destinatarios. Adjuntos: ${uploaded} subidos y ${failed} con error.`
        : `Comunicación publicada para ${body._count?.recipients ?? 0} destinatarios${uploaded ? ` con ${uploaded} adjunto${uploaded === 1 ? '' : 's'}` : ''}.`,
    );
    event.currentTarget.reset();
    setAttachmentFiles([]);
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

      <section className="panel aiAssistBox">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Asistente de IA</p>
            <h2>Preparar un borrador</h2>
          </div>
          <span className="badge warningChip">Requiere revisión humana</span>
        </div>
        <p className="hint">Describe qué necesitas comunicar. La IA propondrá un texto, pero no publicará ni enviará nada.</p>
        <label>Instrucciones para el borrador
          <textarea
            rows={4}
            maxLength={4000}
            value={aiBrief}
            onChange={(event) => setAiBrief(event.target.value)}
            placeholder="Ej.: Convocar al profesorado de FP a una reunión el jueves, explicando el objetivo y pidiendo confirmación."
          />
        </label>
        <div className="rowActions">
          <button className="secondaryButton" type="button" disabled={aiBusy || aiBrief.trim().length < 3} onClick={() => void generateDraft()}>
            {aiBusy ? 'Generando…' : 'Generar borrador con IA'}
          </button>
        </div>
        {aiError && <div className="errorBox">{aiError}</div>}
        {aiDraft && (
          <div className="aiResult">
            <strong>Borrador generado</strong>
            <pre>{aiDraft}</pre>
            <p className="aiReviewNotice">Texto generado con IA. Comprueba fechas, destinatarios, compromisos y cualquier dato antes de utilizarlo.</p>
            <button className="primaryButton" type="button" onClick={applyDraft}>Aplicar al formulario</button>
          </div>
        )}
      </section>

      <form ref={formRef} className="actionForm" onSubmit={submit}>
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
          <legend>3. Adjuntos <span className="hint">(opcional)</span></legend>
          <p className="hint">
            Hasta 10 ficheros. Tamaño máximo por fichero: 15 MB. Se almacenan en CÍCLOPE y solo pueden descargarlos destinatarios y coordinaciones autorizadas.
          </p>
          <label>Ficheros
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                const files = Array.from(event.target.files || []).slice(0, 10);
                setAttachmentFiles(files);
              }}
            />
          </label>
          {attachmentFiles.length > 0 && (
            <div className="attachmentDraftList">
              {attachmentFiles.map((file, index) => (
                <div key={file.name + ':' + index}>
                  <span>{file.name}</span>
                  <small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend>4. Seguimiento</legend>
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
