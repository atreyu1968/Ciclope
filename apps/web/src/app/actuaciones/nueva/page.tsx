'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string; code: string };
type Me = { firstName: string; lastName: string; email: string; academicYearId?: string };
type Group = {
  id: string;
  name: string;
  shift: string;
  studentCount?: number | null;
  professionalFamily: { id: string; name: string };
};

export default function NewActionPage() {
  const router = useRouter();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [state, setState] = useState<'loading'|'idle'|'sending'|'sent'|'error'>('loading');

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/networks'),
      fetch('/api/structure/groups'),
    ]).then(async ([meResponse, networksResponse, groupsResponse]) => {
      if (meResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!meResponse.ok || !networksResponse.ok || !groupsResponse.ok) throw new Error();
      setMe(await meResponse.json());
      setNetworks(await networksResponse.json());
      setGroups(await groupsResponse.json());
      setState('idle');
    }).catch(() => setState('error'));
  }, [router]);

  const inferredStudents = useMemo(() => groups
    .filter((group) => selectedGroups.includes(group.id))
    .reduce((sum, group) => sum + (group.studentCount ?? 0), 0), [groups, selectedGroups]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected.length) return;
    setState('sending');
    const form = new FormData(event.currentTarget);
    const manualStudents = Number(form.get('studentCount') || 0) || undefined;
    const response = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        description: form.get('description'),
        type: form.get('type'),
        activityDate: form.get('activityDate'),
        durationMinutes: Number(form.get('durationMinutes') || 0) || undefined,
        studentCount: manualStudents,
        networkIds: selected,
        teachingGroupIds: selectedGroups,
      }),
    });
    setState(response.ok ? 'sent' : 'error');
    if (response.ok) event.currentTarget.reset();
  }

  function toggleNetwork(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleGroup(id: string) {
    setSelectedGroups((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  if (state === 'loading') return <main className="formShell"><p>Cargando…</p></main>;

  return (
    <main className="formShell">
      <a className="backLink" href="/">← Volver al inicio</a>
      <div className="formIntro">
        <p className="eyebrow">Profesorado FP</p>
        <h1>Registrar actuación</h1>
        <p>
          {me ? `Registras como ${me.firstName} ${me.lastName} · ${me.email}. ` : ''}
          Tu identidad y el curso académico se incorporan automáticamente.
        </p>
      </div>

      {!me?.academicYearId ? (
        <div className="errorBox">No hay un curso académico activo. La administración debe activarlo antes de registrar actuaciones.</div>
      ) : state === 'sent' ? (
        <div className="successBox">
          <h2>Actuación enviada</h2>
          <p>Ha quedado registrada y pendiente de validación por la coordinación correspondiente.</p>
          <button className="primaryButton" onClick={() => { setState('idle'); setSelected([]); setSelectedGroups([]); }}>Registrar otra</button>
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
            <legend>2. Grupos participantes</legend>
            {groups.length ? (
              <>
                <p className="hint">Selecciona los grupos. Si tienen matrícula configurada, CÍCLOPE calculará automáticamente el número de alumnos.</p>
                <div className="groupChecks">
                  {groups.map((group) => (
                    <label className="checkCard" key={group.id}>
                      <input type="checkbox" checked={selectedGroups.includes(group.id)} onChange={() => toggleGroup(group.id)} />
                      <span>
                        <strong>{group.name}</strong>
                        <small>{group.professionalFamily.name} · {group.studentCount ?? '—'} alumnos</small>
                      </span>
                    </label>
                  ))}
                </div>
                {selectedGroups.length > 0 && <p className="autoCount">Alumnado calculado: <strong>{inferredStudents}</strong></p>}
              </>
            ) : (
              <p className="hint">Aún no hay grupos configurados para el curso activo. Puedes indicar el número manualmente.</p>
            )}
            <div className="twoColumns">
              <label>N.º de alumnos
                <input type="number" name="studentCount" min="0" placeholder={selectedGroups.length ? `Automático: ${inferredStudents}` : ''} />
              </label>
              <label>Duración (minutos)<input type="number" name="durationMinutes" min="0" /></label>
            </div>
          </fieldset>

          <fieldset>
            <legend>3. Redes relacionadas</legend>
            <p className="hint">Puedes seleccionar una o varias redes. Una única actuación puede alimentar varias memorias.</p>
            <div className="checks">
              {networks.map((network) => (
                <label className="checkCard" key={network.id}>
                  <input type="checkbox" checked={selected.includes(network.id)} onChange={() => toggleNetwork(network.id)} />
                  <span>{network.name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {state === 'error' && <p className="errorBox">No se pudo registrar la actuación. Revisa los datos o vuelve a iniciar sesión.</p>}
          <button className="primaryButton" disabled={state === 'sending' || selected.length === 0}>
            {state === 'sending' ? 'Enviando…' : 'Enviar actuación'}
          </button>
        </form>
      )}
    </main>
  );
}
