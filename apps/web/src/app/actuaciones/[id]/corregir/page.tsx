'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type Network = { id: string; name: string };
type Group = {
  id: string;
  name: string;
  studentCount?: number | null;
  professionalFamily: { name: string };
};
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
  networks: Array<{ network: Network }>;
  groups: Array<{ teachingGroup: Group }>;
};

export default function CorrectActionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [action, setAction] = useState<Action | null>(null);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/actions/${params.id}`),
      fetch('/api/networks'),
      fetch('/api/structure/groups'),
    ]).then(async ([actionResponse, networksResponse, groupsResponse]) => {
      if (actionResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!actionResponse.ok || !networksResponse.ok || !groupsResponse.ok) {
        setMessage('No se pudo cargar la actuación.');
        return;
      }
      const loadedAction: Action = await actionResponse.json();
      setAction(loadedAction);
      setNetworks(await networksResponse.json());
      setGroups(await groupsResponse.json());
      setSelectedNetworks(loadedAction.networks.map((item) => item.network.id));
      setSelectedGroups(loadedAction.groups.map((item) => item.teachingGroup.id));
    });
  }, [params.id, router]);

  const inferredStudents = useMemo(() => groups
    .filter((group) => selectedGroups.includes(group.id))
    .reduce((sum, group) => sum + (group.studentCount ?? 0), 0), [groups, selectedGroups]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setMessage('');
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/actions/${params.id}/resubmit`, {
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
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setMessage(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo reenviar.');
      return;
    }
    router.push('/actuaciones/mis-actuaciones');
    router.refresh();
  }

  if (!action) return <main className="formShell"><p>{message || 'Cargando actuación…'}</p></main>;

  if (action.status !== 'RETURNED') {
    return (
      <main className="formShell">
        <div className="notice">Esta actuación ya no está pendiente de corrección.</div>
        <a className="secondaryButton" href="/actuaciones/mis-actuaciones">Volver</a>
      </main>
    );
  }

  return (
    <main className="formShell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Corrección</p>
          <h1>Revisar actuación</h1>
          <p className="lead">Corrige lo indicado por coordinación y vuelve a enviarla a validación.</p>
        </div>
        <a className="secondaryButton" href="/actuaciones/mis-actuaciones">Cancelar</a>
      </div>

      {action.returnedReason && (
        <div className="errorBox">
          <strong>Corrección solicitada</strong>
          <p>{action.returnedReason}</p>
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
                  onChange={() => setSelectedNetworks((current) => current.includes(network.id)
                    ? current.filter((item) => item !== network.id)
                    : [...current, network.id])}
                />
                <span>{network.name}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <button className="primaryButton" disabled={sending || selectedNetworks.length === 0}>
          {sending ? 'Reenviando…' : 'Reenviar a coordinación'}
        </button>
      </form>
    </main>
  );
}
