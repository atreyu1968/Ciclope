'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

type FrozenReport = {
  center: { name: string; code?: string | null };
  academicYear: { id: string; name: string };
  network?: { id: string; name: string } | null;
  period: { from: string; to: string; filtered: boolean };
  totals: {
    validatedActions: number;
    pendingActions: number;
    returnedActions: number;
    teachers: number;
    studentParticipations: number;
    totalHours: number;
    evidence: number;
    evidenceCoveragePercent: number;
    actionsWithoutEvidence: number;
  };
  byNetwork: Array<{ id: string; name: string; actions: number; participants: number; evidence: number }>;
  byType: Array<{ type: string; actions: number; participants: number }>;
  byFamily: Array<{ id: string; name: string; actions: number; participants: number }>;
  byMonth: Array<{ month: string; actions: number; participants: number }>;
  networkInsights: Array<{
    id: string;
    name: string;
    fields: Array<{
      key: string;
      label: string;
      values: Array<{ value: string; label: string; count: number }>;
    }>;
  }>;
  alerts?: Array<{ key: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; title: string; detail: string }>;
  planProgress: Array<{
    id: string;
    title: string;
    network: { id: string; name: string };
    averageProgressPercent?: number | null;
    taskSummary?: {
      total: number;
      done: number;
      pending: number;
      overdue: number;
      officialMilestones: Array<{ id: string; title: string; status: string; dueDate?: string | null }>;
    };
    objectives: Array<{
      id: string;
      title: string;
      status: string;
      currentValue?: number | null;
      targetValue?: number | null;
      progressPercent?: number | null;
    }>;
  }>;
  generatedAt: string;
};

type Snapshot = {
  id: string;
  title: string;
  status: 'SAVED' | 'SUBMITTED';
  periodStart: string;
  periodEnd: string;
  narrative?: string | null;
  submittedAt?: string | null;
  createdAt: string;
  data: FrozenReport;
  academicYear: { id: string; name: string };
  network?: { id: string; name: string } | null;
  createdBy?: { id: string; firstName: string; lastName: string } | null;
};

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
}

export default function HistoricalReportDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [narrativeDraft, setNarrativeDraft] = useState('');
  const [savingNarrative, setSavingNarrative] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);

  useEffect(() => {
    fetch('/api/reports/snapshots/' + params.id).then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo abrir el corte histórico.');
        return;
      }
      setSnapshot(body);
      setNarrativeDraft(body.narrative || '');
    });
  }, [params.id, router]);

  const maxMonthly = useMemo(
    () => Math.max(1, ...(snapshot?.data.byMonth?.map((item) => item.actions) ?? [1])),
    [snapshot],
  );

  async function saveNarrative() {
    if (!snapshot) return;
    setSavingNarrative(true);
    setMessage('');
    setError('');
    const response = await fetch('/api/reports/snapshots/' + snapshot.id + '/narrative', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ narrative: narrativeDraft }),
    });
    const body = await response.json().catch(() => ({}));
    setSavingNarrative(false);
    if (!response.ok) {
      setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo guardar la narrativa.');
      return;
    }
    setSnapshot((current) => current ? { ...current, ...body } : current);
    setNarrativeDraft(body.narrative || '');
    setMessage('Narrativa del corte actualizada.');
  }

  async function changeStatus(status: 'SAVED' | 'SUBMITTED') {
    if (!snapshot) return;
    setChangingStatus(true);
    setMessage('');
    setError('');
    const response = await fetch('/api/reports/snapshots/' + snapshot.id + '/status', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setChangingStatus(false);
      setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo actualizar el estado.');
      return;
    }
    setSnapshot((current) => current ? { ...current, ...body } : current);
    setMessage(status === 'SUBMITTED' ? 'Corte marcado como entregado.' : 'Corte reabierto.');
    setChangingStatus(false);
  }

  if (error) {
    return (
      <main className="shell">
        <div className="errorBox" role="alert">{error}</div>
        <a className="secondaryButton" href="/informes/historico">Volver al histórico</a>
      </main>
    );
  }

  if (!snapshot) return (
    <main className="shell">
      <div className="loadingState" role="status" aria-live="polite">
        <span className="loadingSpinner" aria-hidden="true" />
        <strong>Cargando corte histórico…</strong>
      </div>
    </main>
  );

  const report = snapshot.data;

  return (
    <main className="shell reportShell">
      <div className="pageHeader noPrint">
        <div>
          <p className="eyebrow">Corte histórico</p>
          <h1>{snapshot.title}</h1>
          <p className="lead">Esta vista utiliza los datos congelados al guardar el corte; no recalcula indicadores actuales.</p>
        </div>
        <div className="rowActions">
          {snapshot.status === 'SAVED' ? (
            <button className="secondaryButton" disabled={changingStatus || savingNarrative} onClick={() => void changeStatus('SUBMITTED')}>
              {changingStatus ? 'Actualizando…' : 'Marcar entregado'}
            </button>
          ) : (
            <button className="secondaryButton" disabled={changingStatus || savingNarrative} onClick={() => void changeStatus('SAVED')}>
              {changingStatus ? 'Actualizando…' : 'Reabrir'}
            </button>
          )}
          <button className="primaryButton" onClick={() => window.print()}>Imprimir / guardar PDF</button>
          <a className="secondaryButton" href="/informes/historico">Volver</a>
        </div>
      </div>

      {message && <div className="notice noPrint">{message}</div>}

      <article className="reportDocument">
        <header className="reportHeader">
          <p className="eyebrow">CÍCLOPE FP · Corte histórico</p>
          <div className="snapshotTitleRow">
            <h1>{snapshot.title}</h1>
            <span className={snapshot.status === 'SUBMITTED' ? 'badge success' : 'badge'}>
              {snapshot.status === 'SUBMITTED' ? 'Entregado' : 'Guardado'}
            </span>
          </div>
          <p>{report.center.name}{report.center.code ? ' · ' + report.center.code : ''}</p>
          <p>{snapshot.network?.name || 'Redes de Enseñanzas Profesionales'} · Curso {snapshot.academicYear.name}</p>
          <p>
            Periodo: {new Date(snapshot.periodStart).toLocaleDateString('es-ES')} – {new Date(snapshot.periodEnd).toLocaleDateString('es-ES')}
          </p>
          <p>
            Corte guardado: {new Date(snapshot.createdAt).toLocaleString('es-ES')}
            {snapshot.createdBy ? ' · ' + snapshot.createdBy.firstName + ' ' + snapshot.createdBy.lastName : ''}
          </p>
          {snapshot.submittedAt && <p>Marcado como entregado: {new Date(snapshot.submittedAt).toLocaleString('es-ES')}</p>}
        </header>

        <section className="reportKpis">
          <div><strong>{report.totals.validatedActions}</strong><span>actuaciones validadas</span></div>
          <div><strong>{report.totals.teachers}</strong><span>docentes participantes</span></div>
          <div><strong>{report.totals.studentParticipations}</strong><span>participaciones alumnado</span></div>
          <div><strong>{report.totals.totalHours}</strong><span>horas registradas</span></div>
          <div><strong>{report.totals.evidence}</strong><span>evidencias</span></div>
          <div><strong>{report.totals.evidenceCoveragePercent}%</strong><span>cobertura documental</span></div>
        </section>

        {report.alerts && report.alerts.length > 0 && (
          <section className="reportSection">
            <h2>Alertas conservadas en el corte</h2>
            <div className="assignmentList">
              {report.alerts.map((alert) => (
                <div className="assignmentRow" key={alert.key}>
                  <div><strong>{alert.title}</strong><span>{alert.detail}</span></div>
                  <span className={alert.severity === 'CRITICAL' ? 'badge dangerBadge' : 'badge warningChip'}>
                    {alert.severity === 'CRITICAL' ? 'Crítica' : 'Revisar'}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {(snapshot.narrative || snapshot.status === 'SAVED') && (
          <section className="reportSection aiInterpretation">
            <h2>Narrativa conservada con el corte</h2>
            {snapshot.status === 'SAVED' ? (
              <div className="noPrint">
                <label>
                  Texto editable
                  <textarea
                    rows={18}
                    maxLength={60000}
                    value={narrativeDraft}
                    onChange={(event) => setNarrativeDraft(event.target.value)}
                    placeholder="Puedes pegar aquí una memoria revisada o editar el texto generado con IA."
                  />
                </label>
                <div className="rowActions">
                  <button
                    className="secondaryButton"
                    type="button"
                    disabled={savingNarrative}
                    onClick={() => void saveNarrative()}
                  >
                    {savingNarrative ? 'Guardando…' : 'Guardar narrativa'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="preLine">{snapshot.narrative}</p>
            )}
            {snapshot.status === 'SAVED' && narrativeDraft && <p className="preLine printOnly">{narrativeDraft}</p>}
          </section>
        )}

        {report.planProgress?.length > 0 && (
          <section className="reportSection">
            <h2>Seguimiento de planes en el momento del corte</h2>
            {report.planProgress.map((plan) => (
              <div className="planReportBlock" key={plan.id}>
                <div className="panelHeader">
                  <div><p className="eyebrow">{plan.network.name}</p><h3>{plan.title}</h3></div>
                  <span className="badge">
                    {plan.averageProgressPercent == null ? 'Sin métricas' : plan.averageProgressPercent + '% medio'}
                  </span>
                </div>
                {plan.taskSummary && (
                  <div className="pendingSummary">
                    <span>{plan.taskSummary.done}/{plan.taskSummary.total} tareas completadas</span>
                    <span>{plan.taskSummary.pending} pendientes</span>
                    {plan.taskSummary.overdue > 0 && <span>{plan.taskSummary.overdue} fuera de plazo</span>}
                  </div>
                )}
                {plan.objectives?.length > 0 && (
                  <div className="tableWrap">
                    <table>
                      <thead><tr><th>Objetivo</th><th>Estado</th><th>Resultado</th><th>Meta</th><th>Avance</th></tr></thead>
                      <tbody>
                        {plan.objectives.map((objective) => (
                          <tr key={objective.id}>
                            <td>{objective.title}</td>
                            <td>{objective.status}</td>
                            <td>{objective.currentValue ?? '—'}</td>
                            <td>{objective.targetValue ?? '—'}</td>
                            <td>{objective.progressPercent == null ? '—' : objective.progressPercent + '%'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {report.networkInsights?.length > 0 && (
          <section className="reportSection">
            <h2>Indicadores específicos de red</h2>
            {report.networkInsights.map((network) => (
              <div className="planReportBlock" key={network.id}>
                <p className="eyebrow">{network.name}</p>
                <div className="insightGrid">
                  {network.fields.map((field) => (
                    <div className="insightField" key={field.key}>
                      <strong>{field.label}</strong>
                      <div className="insightValues">
                        {field.values.map((value) => <span key={value.value}>{value.label} · {value.count}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </section>
        )}

        {report.byNetwork?.length > 0 && (
          <section className="reportSection">
            <h2>Resultados por red</h2>
            <div className="tableWrap">
              <table>
                <thead><tr><th>Red</th><th>Actuaciones</th><th>Participaciones</th><th>Evidencias</th></tr></thead>
                <tbody>
                  {report.byNetwork.map((item) => (
                    <tr key={item.id}><td>{item.name}</td><td>{item.actions}</td><td>{item.participants}</td><td>{item.evidence}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {report.byMonth?.length > 0 && (
          <section className="reportSection">
            <h2>Evolución temporal</h2>
            <div className="monthChart">
              {report.byMonth.map((item) => (
                <div className="monthRow" key={item.month}>
                  <span>{monthLabel(item.month)}</span>
                  <div className="monthTrack">
                    <div className="monthBar" style={{ width: Math.max(4, (item.actions / maxMonthly) * 100) + '%' }} />
                  </div>
                  <strong>{item.actions}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="reportColumns">
          <div className="reportSection">
            <h2>Por tipo de actuación</h2>
            <div className="tableWrap">
              <table>
                <thead><tr><th>Tipo</th><th>Act.</th><th>Particip.</th></tr></thead>
                <tbody>
                  {report.byType?.map((item) => <tr key={item.type}><td>{item.type}</td><td>{item.actions}</td><td>{item.participants}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
          <div className="reportSection">
            <h2>Por familia profesional</h2>
            <div className="tableWrap">
              <table>
                <thead><tr><th>Familia</th><th>Act.</th><th>Particip.</th></tr></thead>
                <tbody>
                  {report.byFamily?.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.actions}</td><td>{item.participants}</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <footer className="reportFooter">
          <span>Datos congelados por CÍCLOPE FP</span>
          <span>Informe original: {new Date(report.generatedAt).toLocaleString('es-ES')}</span>
        </footer>
      </article>
    </main>
  );
}
