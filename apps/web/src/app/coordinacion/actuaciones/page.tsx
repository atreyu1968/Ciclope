'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Network = { id: string; name: string; code: string };
type Family = { id: string; name: string };
type Teacher = { id: string; firstName: string; lastName: string; email: string; active?: boolean };
type Action = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  activityDate: string;
  createdAt: string;
  studentCount?: number | null;
  submittedByName: string;
  submittedByEmail: string;
  submittedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  networkDetails?: Record<string, Record<string, string | boolean>> | null;
  evidence: Array<{ id: string }>;
  networks: Array<{ network: Network }>;
  groups: Array<{ teachingGroup: { id: string; name: string; professionalFamily: Family } }>;
};
type FormField = {
  key: string;
  label: string;
  type: 'select' | 'boolean' | 'text';
  options?: Array<{ value: string; label: string }>;
};
type FormConfig = Record<string, FormField[]>;

const statusLabels: Record<string, string> = {
  DRAFT: 'Borrador',
  PENDING_VALIDATION: 'Pendiente de validación',
  VALIDATED: 'Validada',
  RETURNED: 'Devuelta',
  ARCHIVED: 'Archivada',
};

export default function CoordinationActionsPage() {
  const router = useRouter();
  const [actions, setActions] = useState<Action[]>([]);
  const [formConfig, setFormConfig] = useState<FormConfig>({});
  const [networks, setNetworks] = useState<Network[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState('PENDING_VALIDATION');
  const [networkId, setNetworkId] = useState('');
  const [familyId, setFamilyId] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError('');
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (networkId) params.set('networkId', networkId);
    if (familyId) params.set('familyId', familyId);
    if (teacherId) params.set('teacherId', teacherId);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);

    const [response, configResponse, networksResponse, familiesResponse, usersResponse] = await Promise.all([
      fetch('/api/actions?' + params.toString()),
      fetch('/api/actions/form-config'),
      fetch('/api/networks'),
      fetch('/api/structure/families'),
      fetch('/api/users'),
    ]);

    if ([response, configResponse, networksResponse, familiesResponse, usersResponse].some((item) => item.status === 401)) {
      router.push('/login');
      return;
    }
    if (response.status === 403) {
      setError('Tu cuenta no tiene una coordinación asignada para ese ámbito en el curso activo.');
      setLoading(false);
      return;
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok || !configResponse.ok || !networksResponse.ok || !familiesResponse.ok || !usersResponse.ok) {
      setError(
        Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo cargar la bandeja.',
      );
      setLoading(false);
      return;
    }

    setActions(body as Action[]);
    setFormConfig(await configResponse.json());
    setNetworks(await networksResponse.json());
    setFamilies(await familiesResponse.json());
    setTeachers(await usersResponse.json());
    setSelected([]);
    setLoading(false);
  }

  function detailLabel(network: Network, key: string, value: string | boolean) {
    const field = (formConfig[network.code] || []).find((item) => item.key === key);
    if (!field) return null;
    const rendered = typeof value === 'boolean'
      ? (value ? 'Sí' : 'No')
      : field.options?.find((option) => option.value === value)?.label ?? value;
    return `${field.label}: ${rendered}`;
  }

  useEffect(() => { void load(); }, []);

  function toggle(id: string) {
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  function clearFilters() {
    setStatus('PENDING_VALIDATION');
    setNetworkId('');
    setFamilyId('');
    setTeacherId('');
    setFromDate('');
    setToDate('');
    queueMicrotask(() => {
      const params = new URLSearchParams({ status: 'PENDING_VALIDATION' });
      setLoading(true);
      fetch('/api/actions?' + params.toString())
        .then(async (response) => {
          if (!response.ok) throw new Error();
          setActions(await response.json());
          setSelected([]);
        })
        .catch(() => setError('No se pudo restablecer la bandeja.'))
        .finally(() => setLoading(false));
    });
  }

  async function validateSelected() {
    if (!selected.length) return;
    const response = await fetch('/api/actions/validate-batch', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: selected }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.message || 'No se pudieron validar las actuaciones.');
      return;
    }
    setMessage(`${body.validated} actuaciones validadas.`);
    await load();
  }

  async function validate(id: string) {
    const response = await fetch(`/api/actions/${id}/validate`, { method: 'PATCH' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo validar la actuación.');
      return;
    }
    await load();
  }

  async function returnAction(id: string) {
    const reason = window.prompt('Indica qué debe corregir el profesor:');
    if (!reason) return;
    const response = await fetch(`/api/actions/${id}/return`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo devolver la actuación.');
      return;
    }
    await load();
  }

  const stalePending = actions.filter((action) => {
    if (action.status !== 'PENDING_VALIDATION') return false;
    return Date.now() - new Date(action.createdAt).getTime() >= 7 * 24 * 60 * 60_000;
  }).length;

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Coordinación</p>
          <h1>Bandeja de actuaciones</h1>
          <p className="lead">Filtra y valida las actuaciones del curso activo dentro de las redes que tienes asignadas.</p>
        </div>
        <a className="secondaryButton" href="/coordinacion">Volver</a>
      </div>

      <section className="panel reportFilters">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Filtros avanzados</p>
            <h2>Acotar la bandeja</h2>
          </div>
          <button className="textButton" type="button" onClick={clearFilters}>Restablecer</button>
        </div>
        <div className="validationFilterGrid">
          <label>Estado
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="PENDING_VALIDATION">Pendientes</option>
              <option value="RETURNED">Devueltas</option>
              <option value="VALIDATED">Validadas</option>
              <option value="DRAFT">Borradores</option>
              <option value="ARCHIVED">Archivadas</option>
            </select>
          </label>
          <label>Red
            <select value={networkId} onChange={(event) => setNetworkId(event.target.value)}>
              <option value="">Todas las redes autorizadas</option>
              {networks.map((network) => <option value={network.id} key={network.id}>{network.name}</option>)}
            </select>
          </label>
          <label>Familia profesional
            <select value={familyId} onChange={(event) => setFamilyId(event.target.value)}>
              <option value="">Todas las familias</option>
              {families.map((family) => <option value={family.id} key={family.id}>{family.name}</option>)}
            </select>
          </label>
          <label>Docente
            <select value={teacherId} onChange={(event) => setTeacherId(event.target.value)}>
              <option value="">Todo el profesorado</option>
              {teachers.filter((teacher) => teacher.active !== false).map((teacher) => (
                <option value={teacher.id} key={teacher.id}>{teacher.lastName}, {teacher.firstName}</option>
              ))}
            </select>
          </label>
          <label>Desde
            <input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label>Hasta
            <input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} />
          </label>
        </div>
        <div className="rowActions">
          <button className="primaryButton" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Aplicando…' : 'Aplicar filtros'}
          </button>
          <span className="hint">{actions.length} actuaciones en la vista actual</span>
        </div>
      </section>

      {stalePending > 0 && (
        <div className="notice validationAgingNotice">
          <strong>{stalePending} actuaciones llevan 7 días o más pendientes.</strong>
          <span> Se muestran con aviso de antigüedad para priorizar su revisión.</span>
        </div>
      )}

      {error && <div className="errorBox">{error}</div>}
      {message && <div className="notice">{message}</div>}
      {loading && !error && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando actuaciones y filtros…</strong>
        </div>
      )}

      {!error && actions.some((action) => action.status === 'PENDING_VALIDATION') && (
        <div className="bulkBar">
          <span>{selected.length} seleccionadas</span>
          <button className="primaryButton" disabled={!selected.length} onClick={() => void validateSelected()}>
            Validar seleccionadas
          </button>
        </div>
      )}

      {!error && !loading && actions.length === 0 && (
        <div className="emptyState">
          <h2>Sin actuaciones en esta vista</h2>
          <p>No hay actuaciones que coincidan con los filtros seleccionados. Puedes restablecerlos para volver a la bandeja habitual.</p>
          <div className="rowActions"><button className="secondaryButton" type="button" onClick={clearFilters}>Restablecer filtros</button></div>
        </div>
      )}

      <div className="actionQueue">
        {actions.map((action) => {
          const pendingDays = action.status === 'PENDING_VALIDATION'
            ? Math.max(0, Math.floor((Date.now() - new Date(action.createdAt).getTime()) / (24 * 60 * 60_000)))
            : 0;
          const stale = pendingDays >= 7;
          return (
            <article className={`queueCard selectionQueue ${selected.includes(action.id) ? 'selectedCard' : ''} ${stale ? 'staleValidationCard' : ''}`} key={action.id}>
              <div className="queueSelect">
                {action.status === 'PENDING_VALIDATION' ? (
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${action.title}`}
                    checked={selected.includes(action.id)}
                    onChange={() => toggle(action.id)}
                  />
                ) : <span className="badge">{statusLabels[action.status] || action.status}</span>}
              </div>
              <div className="queueMain">
                <div className="queueMeta">
                  <span>{new Date(action.activityDate).toLocaleDateString('es-ES')}</span>
                  <span>{action.type}</span>
                  <span>{statusLabels[action.status] || action.status}</span>
                  {action.studentCount != null && <span>{action.studentCount} alumnos</span>}
                  {stale && <span className="warningChip">Pendiente desde hace {pendingDays} días</span>}
                </div>
                <h2>{action.title}</h2>
                <p>{action.description}</p>
                <div className="chipRow">
                  {action.networks.map(({ network }) => <span className="chip" key={network.id}>{network.name}</span>)}
                  {action.groups.map(({ teachingGroup }) => (
                    <span className="chip" key={teachingGroup.id}>{teachingGroup.professionalFamily.name} · {teachingGroup.name}</span>
                  ))}
                  <span className={action.evidence.length ? 'chip' : 'chip warningChip'}>
                    {action.evidence.length ? `${action.evidence.length} evidencias` : 'Sin evidencia'}
                  </span>
                </div>
                {action.networks.map(({ network }) => {
                  const values = action.networkDetails?.[network.code];
                  if (!values || !Object.keys(values).length) return null;
                  return (
                    <div className="validationDetails" key={network.id}>
                      <strong>{network.name}</strong>
                      <div className="chipRow">
                        {Object.entries(values).map(([key, value]) => {
                          const label = detailLabel(network, key, value);
                          return label ? <span className="chip" key={key}>{label}</span> : null;
                        })}
                      </div>
                    </div>
                  );
                })}
                <p className="submitter">Registrada por <strong>{action.submittedByName}</strong> · {action.submittedByEmail}</p>
              </div>
              <div className="queueActions">
                <a className="secondaryButton" href={`/coordinacion/actuaciones/${action.id}`}>Ver historial</a>
                {action.status === 'PENDING_VALIDATION' && (
                  <>
                    <button className="primaryButton" onClick={() => void validate(action.id)}>Validar</button>
                    <button className="secondaryButton" onClick={() => void returnAction(action.id)}>Devolver</button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
