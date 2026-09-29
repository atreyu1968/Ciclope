'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Network = { id: string; name: string; code: string };
type Group = {
  id: string;
  name: string;
  studentCount?: number | null;
  professionalFamily: { name: string };
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
type Action = {
  id: string;
  title: string;
  description: string;
  type: string;
  activityDate: string;
  durationMinutes?: number | null;
  studentCount?: number | null;
  status: string;
  returnedReason?: string | null;
  networkDetails?: Record<string, Record<string, string | boolean>> | null;
  networks: Array<{ network: Network }>;
  groups: Array<{ teachingGroup: Group }>;
  objectives: Array<{ objective: { id: string; title: string; plan: { networkId: string; network: Network } } }>;
};

export default function EditActionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [formConfig, setFormConfig] = useState<FormConfig>({});
  const [networkDetails, setNetworkDetails] = useState<Record<string, Record<string, string | boolean>>>({});
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const intentRef = useRef<'draft' | 'submit'>('submit');

  useEffect(() => {
    Promise.all([
      fetch(`/api/actions/${params.id}`),
      fetch('/api/networks'),
      fetch('/api/structure/groups'),
      fetch('/api/plans/available-objectives'),
      fetch('/api/actions/form-config'),
    ]).then(async ([actionResponse, networksResponse, groupsResponse, objectivesResponse, configResponse]) => {
      if (actionResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!actionResponse.ok || !networksResponse.ok || !groupsResponse.ok || !objectivesResponse.ok || !configResponse.ok) {
        setMessage('No se pudo cargar la actuación.');
        return;
      }
      const loadedAction: Action = await actionResponse.json();
      setAction(loadedAction);
      setNetworks(await networksResponse.json());
      setGroups(await groupsResponse.json());
      setObjectives(await objectivesResponse.json());
      setFormConfig(await configResponse.json());
      setNetworkDetails(loadedAction.networkDetails || {});
      setSelectedNetworks(loadedAction.networks.map((item) => item.network.id));
      setSelectedGroups(loadedAction.groups.map((item) => item.teachingGroup.id));
      setSelectedObjectives(loadedAction.objectives.map((item) => item.objective.id));
    });
  }, [params.id, router]);

  const visibleObjectives = useMemo(
    () => objectives.filter((objective) => selectedNetworks.includes(objective.plan.networkId)),
    [objectives, selectedNetworks],
  );

  const inferredStudents = useMemo(() => groups
    .filter((group) => selectedGroups.includes(group.id))
    .reduce((sum, group) => sum + (group.studentCount ?? 0), 0), [groups, selectedGroups]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/actions/${params.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        description: form.get('description'),
        type: form.get('type'),
        activityDate: form.get('activityDate'),
        durationMinutes: Number(form.get('durationMinutes') || 0) || undefined,
        studentCount: Number(form.get('studentCount') || 0) || undefined,
        networkIds: selectedNetworks,
        teachingGroupIds: selectedGroups,
        objectiveIds: selectedObjectives.filter((id) =>
          objectives.some((objective) => objective.id === id && selectedNetworks.includes(objective.plan.networkId)),
        ),
        networkDetails: Object.fromEntries(
          networks
            .filter((network) => selectedNetworks.includes(network.id))
            .map((network) => [network.code, networkDetails[network.code] || {}]),
        ),
        saveAsDraft: intentRef.current === 'draft',
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setMessage(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo guardar la actuación.');
      return;
    }
    router.push('/actuaciones/mis-actuaciones');
    router.refresh();
  }

  function toggleNetwork(id: string) {
    const network = networks.find((item) => item.id === id);
    setSelectedNetworks((current) => {
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

  if (!action) return <main className="formShell"><p>{message || 'Cargando actuación…'}</p></main>;

  if (!['DRAFT', 'PENDING_VALIDATION'].includes(action.status)) {
    return (
      <main className="formShell">
        <div className="notice">Esta actuación ya no puede editarse porque ha sido validada o devuelta para corrección.</div>
        <a className="secondaryButton" href="/actuaciones/mis-actuaciones">Volver</a>
      </main>
    );
  }

  return (
    <main className="formShell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Profesorado FP</p>
          <h1>Editar actuación</h1>
          <p className="lead">Puedes guardar como borrador o dejar la versión actual pendiente de validación.</p>
        </div>
        <a className="secondaryButton" href="/actuaciones/mis-actuaciones">Cancelar</a>
      </div>

      {action.status === 'PENDING_VALIDATION' && (
        <div className="notice">
          Esta actuación está pendiente de coordinación. Si la guardas como borrador, dejará de aparecer en la bandeja de validación hasta que vuelvas a enviarla.
        </div>
      )}
      {message && <div className="errorBox">{message}</div>}

      <form className="actionForm" onSubmit={submit}>
        <fieldset>
          <legend>Actuación</legend>
          <label>Título<input name="title" defaultValue={action.title} required /></label>
          <label>Descripción<textarea name="description" rows={6} defaultValue={action.description} required /></label>
          <div className="twoColumns">
            <label>Tipo<input name="type" defaultValue={action.type} required /></label>
            <label>Fecha<input type="date" name="activityDate" defaultValue={action.activityDate.slice(0, 10)} required /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Grupos</legend>
          <div className="groupChecks">
            {groups.map((group) => (
              <label className="checkCard" key={group.id}>
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(group.id)}
                  onChange={() => setSelectedGroups((current) => current.includes(group.id)
                    ? current.filter((item) => item !== group.id)
                    : [...current, group.id])}
                />
                <span><strong>{group.name}</strong><small>{group.professionalFamily.name} · {group.studentCount ?? '—'} alumnos</small></span>
              </label>
            ))}
          </div>
          {selectedGroups.length > 0 && <p className="autoCount">Alumnado calculado: <strong>{inferredStudents}</strong></p>}
          <div className="twoColumns">
            <label>N.º de alumnos<input type="number" name="studentCount" min="0" defaultValue={action.studentCount ?? ''} /></label>
            <label>Duración (minutos)<input type="number" name="durationMinutes" min="0" defaultValue={action.durationMinutes ?? ''} /></label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Redes relacionadas</legend>
          <div className="checks">
            {networks.map((network) => (
              <label className="checkCard" key={network.id}>
                <input
                  type="checkbox"
                  checked={selectedNetworks.includes(network.id)}
                  onChange={() => toggleNetwork(network.id)}
                />
                <span>{network.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {selectedNetworks.length > 0 && (
          <fieldset>
            <legend>Datos útiles para la red <span className="hint">(opcional)</span></legend>
            <p className="hint">Estos campos alimentan indicadores y memoria sin pedir una segunda ficha.</p>
            <div className="networkDetailGrid">
              {networks.filter((network) => selectedNetworks.includes(network.id)).map((network) => {
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

        {selectedNetworks.length > 0 && (
          <fieldset>
            <legend>Objetivos del plan anual</legend>
            {visibleObjectives.length ? (
              <div className="groupChecks">
                {visibleObjectives.map((objective) => (
                  <label className="checkCard" key={objective.id}>
                    <input
                      type="checkbox"
                      checked={selectedObjectives.includes(objective.id)}
                      onChange={() => setSelectedObjectives((current) => current.includes(objective.id)
                        ? current.filter((item) => item !== objective.id)
                        : [...current, objective.id])}
                    />
                    <span><strong>{objective.title}</strong><small>{objective.plan.network.name}</small></span>
                  </label>
                ))}
              </div>
            ) : <p className="hint">No hay objetivos activos para las redes seleccionadas.</p>}
          </fieldset>
        )}

        <div className="rowActions">
          <button
            className="secondaryButton"
            type="submit"
            disabled={sending || selectedNetworks.length === 0}
            onClick={() => { intentRef.current = 'draft'; }}
          >
            {sending ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <button
            className="primaryButton"
            type="submit"
            disabled={sending || selectedNetworks.length === 0}
            onClick={() => { intentRef.current = 'submit'; }}
          >
            {sending ? 'Guardando…' : 'Guardar y enviar a coordinación'}
          </button>
        </div>
      </form>
    </main>
  );
}
