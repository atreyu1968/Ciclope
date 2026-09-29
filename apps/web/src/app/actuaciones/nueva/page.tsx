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
type Objective = {
  id: string;
  title: string;
  description?: string | null;
  plan: { networkId: string; network: { id: string; name: string } };
};
type FormField = {
  key: string;
  label: string;
  type: 'select' | 'boolean' | 'text';
  help?: string;
  options?: Array<{ value: string; label: string }>;
};
type FormConfig = Record<string, FormField[]>;

export default function NewActionPage() {
  const router = useRouter();
  const [networks, setNetworks] = useState<Network[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [formConfig, setFormConfig] = useState<FormConfig>({});
  const [networkDetails, setNetworkDetails] = useState<Record<string, Record<string, string | boolean>>>({});
  const [me, setMe] = useState<Me | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [state, setState] = useState<'loading'|'idle'|'sending'|'sent'|'error'>('loading');
  const [createdActionId, setCreatedActionId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me'),
      fetch('/api/networks'),
      fetch('/api/structure/groups'),
      fetch('/api/plans/available-objectives'),
      fetch('/api/actions/form-config'),
    ]).then(async ([meResponse, networksResponse, groupsResponse, objectivesResponse, configResponse]) => {
      if (meResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!meResponse.ok || !networksResponse.ok || !groupsResponse.ok || !objectivesResponse.ok || !configResponse.ok) throw new Error();
      setMe(await meResponse.json());
      setNetworks(await networksResponse.json());
      setGroups(await groupsResponse.json());
      setObjectives(await objectivesResponse.json());
      setFormConfig(await configResponse.json());
      setState('idle');
    }).catch(() => setState('error'));
  }, [router]);

  const visibleObjectives = useMemo(
    () => objectives.filter((objective) => selected.includes(objective.plan.networkId)),
    [objectives, selected],
  );

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
        objectiveIds: selectedObjectives.filter((id) =>
          objectives.some((objective) => objective.id === id && selected.includes(objective.plan.networkId)),
        ),
        networkDetails: Object.fromEntries(
          networks
            .filter((network) => selected.includes(network.id))
            .map((network) => [network.code, networkDetails[network.code] || {}]),
        ),
      }),
    });
    if (response.ok) {
      const created = await response.json();
      setCreatedActionId(created.id);
      setState('sent');
      event.currentTarget.reset();
    } else {
      setState('error');
    }
  }

  function toggleNetwork(id: string) {
    const network = networks.find((item) => item.id === id);
    setSelected((current) => {
      if (!current.includes(id)) return [...current, id];
      if (network) {
        setNetworkDetails((details) => {
          const next = { ...details };
          delete next[network.code];
          return next;
        });
      }
      setSelectedObjectives((items) => items.filter((objectiveId) =>
        objectives.some((objective) => objective.id === objectiveId && objective.plan.networkId !== id),
      ));
      return current.filter((item) => item !== id);
    });
  }

  function setNetworkDetail(code: string, key: string, value: string | boolean | undefined) {
    setNetworkDetails((current) => {
      const next = { ...current, [code]: { ...(current[code] || {}) } };
      if (value === undefined || value === '') {
        delete next[code][key];
      } else {
        next[code][key] = value;
      }
      return next;
    });
  }

  function toggleGroup(id: string) {
    setSelectedGroups((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleObjective(id: string) {
    setSelectedObjectives((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
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
          <div className="rowActions">
            {createdActionId && <a className="primaryButton" href={`/actuaciones/${createdActionId}/evidencias`}>Añadir evidencias</a>}
            <button className="secondaryButton" onClick={() => { setState('idle'); setSelected([]); setSelectedGroups([]); setSelectedObjectives([]); setNetworkDetails({}); setCreatedActionId(null); }}>Registrar otra</button>
          </div>
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

          {selected.length > 0 && (
            <fieldset>
              <legend>4. Datos útiles para la red <span className="hint">(opcional)</span></legend>
              <p className="hint">
                Solo se muestran los datos que después sirven para indicadores y memoria. Si no conoces alguno, déjalo sin indicar.
              </p>
              <div className="networkDetailGrid">
                {networks.filter((network) => selected.includes(network.id)).map((network) => {
                  const fields = formConfig[network.code] || [];
                  if (!fields.length) return null;
                  return (
                    <div className="networkDetailCard" key={network.id}>
                      <h3>{network.name}</h3>
                      {fields.map((field) => {
                        const current = networkDetails[network.code]?.[field.key];
                        if (field.type === 'boolean') {
                          return (
                            <label key={field.key}>{field.label}
                              <select
                                value={current === true ? 'true' : current === false ? 'false' : ''}
                                onChange={(event) => setNetworkDetail(
                                  network.code,
                                  field.key,
                                  event.target.value === '' ? undefined : event.target.value === 'true',
                                )}
                              >
                                <option value="">No indicado</option>
                                <option value="true">Sí</option>
                                <option value="false">No</option>
                              </select>
                              {field.help && <span className="hint">{field.help}</span>}
                            </label>
                          );
                        }
                        if (field.type === 'select') {
                          return (
                            <label key={field.key}>{field.label}
                              <select
                                value={typeof current === 'string' ? current : ''}
                                onChange={(event) => setNetworkDetail(network.code, field.key, event.target.value || undefined)}
                              >
                                <option value="">No indicado</option>
                                {field.options?.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>
                              {field.help && <span className="hint">{field.help}</span>}
                            </label>
                          );
                        }
                        return (
                          <label key={field.key}>{field.label}
                            <input
                              value={typeof current === 'string' ? current : ''}
                              onChange={(event) => setNetworkDetail(network.code, field.key, event.target.value || undefined)}
                            />
                            {field.help && <span className="hint">{field.help}</span>}
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          )}

          {selected.length > 0 && (
            <fieldset>
              <legend>5. Objetivos del plan anual</legend>
              {visibleObjectives.length ? (
                <>
                  <p className="hint">Opcional. Marca los objetivos a los que contribuye esta actuación. El progreso del plan se actualizará cuando coordinación la valide.</p>
                  <div className="groupChecks">
                    {visibleObjectives.map((objective) => (
                      <label className="checkCard" key={objective.id}>
                        <input type="checkbox" checked={selectedObjectives.includes(objective.id)} onChange={() => toggleObjective(objective.id)} />
                        <span>
                          <strong>{objective.title}</strong>
                          <small>{objective.plan.network.name}{objective.description ? ` · ${objective.description}` : ''}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <p className="hint">No hay objetivos activos del plan anual para las redes seleccionadas.</p>
              )}
            </fieldset>
          )}

          {state === 'error' && <p className="errorBox">No se pudo registrar la actuación. Revisa los datos o vuelve a iniciar sesión.</p>}
          <button className="primaryButton" disabled={state === 'sending' || selected.length === 0}>
            {state === 'sending' ? 'Enviando…' : 'Enviar actuación'}
          </button>
        </form>
      )}
    </main>
  );
}
