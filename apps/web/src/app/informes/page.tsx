'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Year = { id: string; name: string; startsAt: string; endsAt: string; isActive: boolean };
type Network = { id: string; name: string };
type Summary = {
  center: { name: string; code?: string | null };
  academicYear: { id: string; name: string; startsAt: string; endsAt: string; isActive: boolean };
  network?: { id: string; name: string } | null;
  period: { from: string; to: string; filtered: boolean };
  totals: {
    validatedActions: number;
    pendingActions: number;
    returnedActions: number;
    teachers: number;
    studentParticipations: number;
    totalMinutes: number;
    totalHours: number;
    evidence: number;
    evidenceFiles: number;
    evidenceLinks: number;
    actionsWithEvidence: number;
    actionsWithoutEvidence: number;
    evidenceCoveragePercent: number;
  };
  networkInsights: Array<{
    id: string;
    name: string;
    code: string;
    fields: Array<{
      key: string;
      label: string;
      values: Array<{ value: string; label: string; count: number }>;
    }>;
  }>;
  alerts: Array<{ key: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; title: string; detail: string }>;
  planProgress: Array<{
    id: string;
    title: string;
    status: string;
    network: { id: string; name: string };
    measurableObjectives: number;
    averageProgressPercent: number | null;
    taskSummary: {
      total: number;
      done: number;
      pending: number;
      overdue: number;
      officialMilestones: Array<{
        id: string;
        title: string;
        status: string;
        dueDate?: string | null;
      }>;
    };
    objectives: Array<{
      id: string;
      title: string;
      status: string;
      metric?: string | null;
      targetValue?: number | null;
      currentValue?: number | null;
      progressPercent?: number | null;
      linkedValidatedActions: number;
    }>;
  }>;
  transversalOverview?: {
    networkCount: number;
    networksWithActivity: number;
    networksWithoutActivity: number;
    plansConfigured: number;
    averagePlanProgressPercent: number | null;
    networksWithOverdueTasks: number;
    rows: Array<{
      id: string;
      code: string;
      name: string;
      actions: number;
      participants: number;
      evidence: number;
      planConfigured: boolean;
      planProgressPercent: number | null;
      objectives: number;
      measurableObjectives: number;
      tasksTotal: number;
      tasksDone: number;
      tasksPending: number;
      tasksOverdue: number;
    }>;
  } | null;
  byNetwork: Array<{ id: string; name: string; actions: number; participants: number; evidence: number }>;
  byFamily: Array<{ id: string; name: string; actions: number; participants: number }>;
  byType: Array<{ type: string; actions: number; participants: number }>;
  byMonth: Array<{ month: string; actions: number; participants: number }>;
  teachers: Array<{ id: string; name: string }>;
  generatedAt: string;
};

function monthLabel(value: string) {
  const [year, month] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1, 1));
}

export default function ReportsPage() {
  const router = useRouter();
  const [years, setYears] = useState<Year[]>([]);
  const [networks, setNetworks] = useState<Network[]>([]);
  const [yearId, setYearId] = useState('');
  const [networkId, setNetworkId] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [aiText, setAiText] = useState('');
  const [aiMode, setAiMode] = useState<'interpretation'|'draft'>('interpretation');
  const [aiError, setAiError] = useState('');
  const [aiLoading, setAiLoading] = useState<'interpretation'|'draft'|''>('');
  const [snapshotMessage, setSnapshotMessage] = useState('');
  const [snapshotError, setSnapshotError] = useState('');
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [compareYearId, setCompareYearId] = useState('');
  const [compareFromDate, setCompareFromDate] = useState('');
  const [compareToDate, setCompareToDate] = useState('');
  const [comparison, setComparison] = useState<Summary | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch('/api/academic-years'),
      fetch('/api/networks'),
    ]).then(async ([yearsResponse, networksResponse]) => {
      if (yearsResponse.status === 401 || networksResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!yearsResponse.ok || !networksResponse.ok) throw new Error();
      const loadedYears: Year[] = await yearsResponse.json();
      const loadedNetworks: Network[] = await networksResponse.json();
      setYears(loadedYears);
      setNetworks(loadedNetworks);
      const active = loadedYears.find((item) => item.isActive) ?? loadedYears[0];
      setYearId(active?.id ?? '');
    }).catch(() => {
      setError('No se pudieron cargar los datos para informes.');
      setLoading(false);
    });
  }, [router]);

  useEffect(() => {
    if (!yearId) return;
    setLoading(true);
    setError('');
    setAiText('');
    setAiError('');
    setSnapshotMessage('');
    setSnapshotError('');
    setComparison(null);
    setComparisonError('');
    const params = new URLSearchParams({ academicYearId: yearId });
    if (networkId) params.set('networkId', networkId);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);

    fetch(`/api/reports/summary?${params.toString()}`).then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo generar el informe.');
        setSummary(null);
        return;
      }
      setSummary(body);
    }).finally(() => setLoading(false));
  }, [yearId, networkId, fromDate, toDate, router]);

  const selectedYear = useMemo(
    () => years.find((year) => year.id === yearId),
    [years, yearId],
  );

  const selectedCompareYear = useMemo(
    () => years.find((year) => year.id === compareYearId),
    [years, compareYearId],
  );

  const maxMonthly = useMemo(
    () => Math.max(1, ...(summary?.byMonth.map((item) => item.actions) ?? [1])),
    [summary],
  );

  function csvHref() {
    const params = new URLSearchParams({ academicYearId: yearId });
    if (networkId) params.set('networkId', networkId);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    return `/api/reports/actions.csv?${params.toString()}`;
  }

  async function processWithAi(mode: 'interpretation'|'draft') {
    if (!yearId) return;
    setAiLoading(mode);
    setAiError('');
    const params = new URLSearchParams({ academicYearId: yearId, mode });
    if (networkId) params.set('networkId', networkId);
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const response = await fetch(`/api/reports/interpret?${params.toString()}`, { method: 'POST' });
    const body = await response.json().catch(() => ({}));
    setAiLoading('');
    if (!response.ok) {
      setAiError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo procesar el informe con IA.');
      return;
    }
    setAiMode(mode);
    setAiText(body.text || '');
  }

  async function saveSnapshot() {
    if (!yearId || !summary) return;
    setSavingSnapshot(true);
    setSnapshotMessage('');
    setSnapshotError('');

    const response = await fetch('/api/reports/snapshots', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        academicYearId: yearId,
        networkId: networkId || undefined,
        from: fromDate || undefined,
        to: toDate || undefined,
        narrative: aiText || undefined,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSavingSnapshot(false);

    if (!response.ok) {
      setSnapshotError(
        Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo guardar el corte histórico.',
      );
      return;
    }

    setSnapshotMessage('Corte histórico guardado. Sus cifras ya no cambiarán aunque se registren o validen datos después.');
  }

  async function compareReport() {
    if (!compareYearId) {
      setComparisonError('Selecciona un curso de referencia.');
      return;
    }
    setComparisonLoading(true);
    setComparisonError('');
    const params = new URLSearchParams({ academicYearId: compareYearId });
    if (networkId) params.set('networkId', networkId);
    if (compareFromDate) params.set('from', compareFromDate);
    if (compareToDate) params.set('to', compareToDate);
    const response = await fetch(`/api/reports/summary?${params.toString()}`);
    const body = await response.json().catch(() => ({}));
    setComparisonLoading(false);
    if (!response.ok) {
      setComparison(null);
      setComparisonError(
        Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'No se pudo generar la comparación.',
      );
      return;
    }
    setComparison(body);
  }

  function delta(currentValue: number, referenceValue: number, suffix = '') {
    const value = Math.round((currentValue - referenceValue) * 10) / 10;
    return `${value > 0 ? '+' : ''}${value}${suffix}`;
  }

  return (
    <main className="shell reportShell">
      <div className="pageHeader noPrint">
        <div>
          <p className="eyebrow">Informes automáticos</p>
          <h1>Indicadores y memoria</h1>
          <p className="lead">Las cifras se recalculan a partir de actuaciones validadas, sin transcribir datos.</p>
        </div>
        <div className="rowActions">
          <button className="secondaryButton" onClick={() => void saveSnapshot()} disabled={savingSnapshot || loading || !summary}>
            {savingSnapshot ? 'Guardando…' : 'Guardar corte'}
          </button>
          <a className="secondaryButton" href="/informes/historico">Histórico</a>
          <button className="secondaryButton" onClick={() => void processWithAi('interpretation')} disabled={Boolean(aiLoading) || loading || !summary}>
            {aiLoading === 'interpretation' ? 'Interpretando…' : 'Interpretar con IA'}
          </button>
          <button className="secondaryButton" onClick={() => void processWithAi('draft')} disabled={Boolean(aiLoading) || loading || !summary}>
            {aiLoading === 'draft' ? 'Redactando…' : 'Redactar memoria con IA'}
          </button>
          <a className="secondaryButton" href={csvHref()}>Exportar CSV</a>
          <button className="primaryButton" onClick={() => window.print()}>Imprimir / guardar PDF</button>
          <a className="secondaryButton" href="/coordinacion">Volver</a>
        </div>
      </div>

      <section className="panel reportFilters noPrint">
        <div className="twoColumns">
          <label>Curso académico
            <select value={yearId} onChange={(e) => {
              setYearId(e.target.value);
              setFromDate('');
              setToDate('');
            }}>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}{year.isActive ? ' · activo' : ''}</option>)}
            </select>
          </label>
          <label>Red
            <select value={networkId} onChange={(e) => setNetworkId(e.target.value)}>
              <option value="">Todas las redes autorizadas</option>
              {networks.map((network) => <option key={network.id} value={network.id}>{network.name}</option>)}
            </select>
          </label>
        </div>
        <div className="twoColumns reportPeriodRow">
          <label>Desde
            <input
              type="date"
              value={fromDate}
              min={selectedYear?.startsAt?.slice(0, 10)}
              max={toDate || selectedYear?.endsAt?.slice(0, 10)}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </label>
          <label>Hasta
            <input
              type="date"
              value={toDate}
              min={fromDate || selectedYear?.startsAt?.slice(0, 10)}
              max={selectedYear?.endsAt?.slice(0, 10)}
              onChange={(e) => setToDate(e.target.value)}
            />
          </label>
        </div>
        {(fromDate || toDate) && (
          <div className="rowActions reportPeriodActions">
            <span className="hint">El periodo se aplica al informe, CSV y herramientas de IA.</span>
            <button className="textButton" type="button" onClick={() => { setFromDate(''); setToDate(''); }}>
              Ver curso completo
            </button>
          </div>
        )}
      </section>

      <section className="panel reportFilters noPrint">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Comparativa</p>
            <h2>Comparar con otro periodo o curso</h2>
          </div>
          {comparison && (
            <button className="textButton" type="button" onClick={() => setComparison(null)}>Quitar comparativa</button>
          )}
        </div>
        <div className="twoColumns">
          <label>Curso de referencia
            <select value={compareYearId} onChange={(event) => {
              setCompareYearId(event.target.value);
              setCompareFromDate('');
              setCompareToDate('');
              setComparison(null);
            }}>
              <option value="">Selecciona curso</option>
              {years.map((year) => <option key={year.id} value={year.id}>{year.name}</option>)}
            </select>
          </label>
          <label>Ámbito
            <input
              value={networkId ? networks.find((item) => item.id === networkId)?.name || 'Red seleccionada' : 'Todas las redes autorizadas'}
              readOnly
            />
          </label>
        </div>
        {compareYearId && (
          <div className="twoColumns reportPeriodRow">
            <label>Desde referencia
              <input
                type="date"
                value={compareFromDate}
                min={selectedCompareYear?.startsAt?.slice(0, 10)}
                max={compareToDate || selectedCompareYear?.endsAt?.slice(0, 10)}
                onChange={(event) => setCompareFromDate(event.target.value)}
              />
            </label>
            <label>Hasta referencia
              <input
                type="date"
                value={compareToDate}
                min={compareFromDate || selectedCompareYear?.startsAt?.slice(0, 10)}
                max={selectedCompareYear?.endsAt?.slice(0, 10)}
                onChange={(event) => setCompareToDate(event.target.value)}
              />
            </label>
          </div>
        )}
        <div className="rowActions">
          <button
            className="secondaryButton"
            type="button"
            disabled={!compareYearId || comparisonLoading}
            onClick={() => void compareReport()}
          >
            {comparisonLoading ? 'Comparando…' : 'Generar comparativa'}
          </button>
          <span className="hint">
            Selecciona el mismo curso para comparar dos periodos o un curso distinto para una comparativa interanual.
          </span>
        </div>
        {comparisonError && <div className="errorBox">{comparisonError}</div>}
      </section>

      {snapshotMessage && <div className="notice noPrint">{snapshotMessage}</div>}
      {snapshotError && <div className="errorBox noPrint">{snapshotError}</div>}
      {error && <div className="errorBox noPrint">{error}</div>}
      {aiError && <div className="errorBox noPrint">{aiError}</div>}
      {loading && <div className="panel noPrint"><p>Generando informe…</p></div>}

      {summary && !loading && (
        <article className="reportDocument">
          <header className="reportHeader">
            <p className="eyebrow">CÍCLOPE FP · Memoria automática</p>
            <h1>{summary.network?.name || 'Redes de Enseñanzas Profesionales'}</h1>
            <p>{summary.center.name}{summary.center.code ? ` · ${summary.center.code}` : ''}</p>
            <p>Curso académico {summary.academicYear.name}</p>
            {summary.period.filtered && (
              <p>
                Periodo: {new Date(summary.period.from).toLocaleDateString('es-ES')} – {new Date(summary.period.to).toLocaleDateString('es-ES')}
              </p>
            )}
          </header>

          <section className="reportSection">
            <h2>Resumen ejecutivo</h2>
            <p>
              {summary.period.filtered ? 'Durante el periodo seleccionado' : `Durante el curso ${summary.academicYear.name}`} se han validado <strong>{summary.totals.validatedActions}</strong> actuaciones
              {summary.network ? ` vinculadas a la red de ${summary.network.name}` : ' dentro del ámbito consultado'}.
              Han participado <strong>{summary.totals.teachers}</strong> docentes y se han registrado
              <strong> {summary.totals.studentParticipations}</strong> participaciones de alumnado. Las actuaciones acumulan
              <strong> {summary.totals.totalHours}</strong> horas registradas y <strong>{summary.totals.evidence}</strong> evidencias.
            </p>
            <p className="reportNote">
              “Participaciones de alumnado” suma las participaciones declaradas en las actuaciones; no equivale necesariamente a alumnado único.
            </p>
          </section>

          {summary.transversalOverview && (
            <section className="reportSection">
              <h2>Informe ejecutivo conjunto de las cuatro redes</h2>
              <p className="reportNote">
                Lectura transversal de la actividad y del avance de los planes de las redes autorizadas. Las actuaciones vinculadas a varias redes se contabilizan en cada una de ellas.
              </p>
              <section className="reportKpis">
                <div>
                  <strong>{summary.transversalOverview.networksWithActivity}/{summary.transversalOverview.networkCount}</strong>
                  <span>redes con actividad validada</span>
                </div>
                <div>
                  <strong>{summary.transversalOverview.plansConfigured}/{summary.transversalOverview.networkCount}</strong>
                  <span>planes anuales configurados</span>
                </div>
                <div>
                  <strong>{summary.transversalOverview.averagePlanProgressPercent === null ? '—' : summary.transversalOverview.averagePlanProgressPercent + '%'}</strong>
                  <span>avance medio de planes medibles</span>
                </div>
                <div>
                  <strong>{summary.transversalOverview.networksWithOverdueTasks}</strong>
                  <span>redes con tareas vencidas</span>
                </div>
              </section>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>Red</th>
                      <th>Actuaciones</th>
                      <th>Participaciones</th>
                      <th>Evidencias</th>
                      <th>Avance plan</th>
                      <th>Tareas</th>
                      <th>Situación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.transversalOverview.rows.map((row) => (
                      <tr key={row.id}>
                        <td><strong>{row.name}</strong></td>
                        <td>{row.actions}</td>
                        <td>{row.participants}</td>
                        <td>{row.evidence}</td>
                        <td>{row.planProgressPercent === null ? (row.planConfigured ? 'Sin métricas' : 'Sin plan') : row.planProgressPercent + '%'}</td>
                        <td>
                          {row.tasksDone}/{row.tasksTotal} completadas
                          {row.tasksPending > 0 ? ' · ' + row.tasksPending + ' pendientes' : ''}
                          {row.tasksOverdue > 0 ? ' · ' + row.tasksOverdue + ' vencidas' : ''}
                        </td>
                        <td>
                          {row.actions === 0
                            ? <span className="badge warningChip">Sin actividad</span>
                            : row.tasksOverdue > 0
                              ? <span className="badge dangerBadge">Requiere atención</span>
                              : <span className="badge success">En seguimiento</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {summary.alerts.length > 0 && (
            <section className="reportSection noPrint">
              <h2>Alertas de calidad antes de cerrar el informe</h2>
              <div className="assignmentList">
                {summary.alerts.map((alert) => (
                  <div className="assignmentRow" key={alert.key}>
                    <div>
                      <strong>{alert.title}</strong>
                      <span>{alert.detail}</span>
                    </div>
                    <span className={alert.severity === 'CRITICAL' ? 'badge dangerBadge' : 'badge warningChip'}>
                      {alert.severity === 'CRITICAL' ? 'Crítica' : alert.severity === 'WARNING' ? 'Revisar' : 'Información'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {aiText && (
            <section className="reportSection aiInterpretation">
              <h2>{aiMode === 'draft' ? 'Borrador de memoria asistido por IA' : 'Interpretación asistida por IA'}</h2>
              <div className="noPrint">
                <label>
                  Narrativa editable
                  <textarea
                    rows={18}
                    maxLength={60000}
                    value={aiText}
                    onChange={(event) => setAiText(event.target.value)}
                  />
                </label>
                <p className="reportNote">
                  Revisa, corrige o completa el texto antes de guardar el corte. Al guardar, esta versión exacta queda conservada como narrativa del informe.
                </p>
              </div>
              <p className="preLine printOnly">{aiText}</p>
              <p className="reportNote">
                Texto generado a partir de indicadores agregados y revisable por la coordinación antes de su uso oficial.
              </p>
            </section>
          )}

          {comparison && (
            <section className="reportSection comparisonBlock">
              <h2>Comparativa con {comparison.academicYear.name}</h2>
              <p className="reportNote">
                Referencia: {new Date(comparison.period.from).toLocaleDateString('es-ES')} – {new Date(comparison.period.to).toLocaleDateString('es-ES')}.
                La variación se calcula como periodo actual menos periodo de referencia.
              </p>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Indicador</th><th>Actual</th><th>Referencia</th><th>Variación</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>Actuaciones validadas</td>
                      <td>{summary.totals.validatedActions}</td>
                      <td>{comparison.totals.validatedActions}</td>
                      <td>{delta(summary.totals.validatedActions, comparison.totals.validatedActions)}</td>
                    </tr>
                    <tr>
                      <td>Docentes participantes</td>
                      <td>{summary.totals.teachers}</td>
                      <td>{comparison.totals.teachers}</td>
                      <td>{delta(summary.totals.teachers, comparison.totals.teachers)}</td>
                    </tr>
                    <tr>
                      <td>Participaciones de alumnado</td>
                      <td>{summary.totals.studentParticipations}</td>
                      <td>{comparison.totals.studentParticipations}</td>
                      <td>{delta(summary.totals.studentParticipations, comparison.totals.studentParticipations)}</td>
                    </tr>
                    <tr>
                      <td>Horas registradas</td>
                      <td>{summary.totals.totalHours}</td>
                      <td>{comparison.totals.totalHours}</td>
                      <td>{delta(summary.totals.totalHours, comparison.totals.totalHours)}</td>
                    </tr>
                    <tr>
                      <td>Evidencias</td>
                      <td>{summary.totals.evidence}</td>
                      <td>{comparison.totals.evidence}</td>
                      <td>{delta(summary.totals.evidence, comparison.totals.evidence)}</td>
                    </tr>
                    <tr>
                      <td>Cobertura documental</td>
                      <td>{summary.totals.evidenceCoveragePercent}%</td>
                      <td>{comparison.totals.evidenceCoveragePercent}%</td>
                      <td>{delta(summary.totals.evidenceCoveragePercent, comparison.totals.evidenceCoveragePercent, ' pp')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="reportKpis">
            <div><strong>{summary.totals.validatedActions}</strong><span>actuaciones validadas</span></div>
            <div><strong>{summary.totals.teachers}</strong><span>docentes participantes</span></div>
            <div><strong>{summary.totals.studentParticipations}</strong><span>participaciones alumnado</span></div>
            <div><strong>{summary.totals.totalHours}</strong><span>horas registradas</span></div>
            <div><strong>{summary.totals.evidence}</strong><span>evidencias</span></div>
            <div><strong>{summary.totals.evidenceCoveragePercent}%</strong><span>cobertura documental</span></div>
          </section>

          <section className="reportSection">
            <h2>Calidad de las evidencias</h2>
            <div className="pendingSummary">
              <span>{summary.totals.actionsWithEvidence} actuaciones con evidencia</span>
              <span>{summary.totals.actionsWithoutEvidence} actuaciones sin evidencia</span>
              <span>{summary.totals.evidenceFiles} archivos</span>
              <span>{summary.totals.evidenceLinks} enlaces</span>
            </div>
            <p className="reportNote">
              La cobertura documental indica qué porcentaje de las actuaciones validadas dispone de al menos una evidencia asociada.
            </p>
          </section>

          {summary.planProgress.length > 0 && (
            <section className="reportSection">
              <h2>Seguimiento de los planes anuales</h2>
              {summary.planProgress.map((plan) => (
                <div className="planReportBlock" key={plan.id}>
                  <div className="panelHeader">
                    <div>
                      <p className="eyebrow">{plan.network.name}</p>
                      <h3>{plan.title}</h3>
                    </div>
                    <span className="badge">
                      {plan.averageProgressPercent === null ? 'Sin métricas' : plan.averageProgressPercent + '% medio'}
                    </span>
                  </div>
                  <div className="pendingSummary">
                    <span>{plan.taskSummary.done}/{plan.taskSummary.total} tareas completadas</span>
                    <span>{plan.taskSummary.pending} pendientes</span>
                    {plan.taskSummary.overdue > 0 && <span>{plan.taskSummary.overdue} fuera de plazo</span>}
                  </div>
                  {plan.taskSummary.officialMilestones.length > 0 && (
                    <div className="officialMilestones">
                      {plan.taskSummary.officialMilestones.map((milestone) => (
                        <div key={milestone.id}>
                          <strong>{milestone.title}</strong>
                          <span>
                            {milestone.dueDate ? new Date(milestone.dueDate).toLocaleDateString('es-ES') : 'Sin fecha'}
                            {' · '}
                            {milestone.status === 'DONE' ? 'Completado' : milestone.status === 'IN_PROGRESS' ? 'En curso' : 'Pendiente'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {plan.objectives.length ? (
                    <div className="tableWrap">
                      <table>
                        <thead>
                          <tr><th>Objetivo</th><th>Estado</th><th>Resultado</th><th>Meta</th><th>Avance</th></tr>
                        </thead>
                        <tbody>
                          {plan.objectives.map((objective) => (
                            <tr key={objective.id}>
                              <td>{objective.title}</td>
                              <td>{objective.status}</td>
                              <td>{objective.currentValue ?? '—'}</td>
                              <td>{objective.targetValue ?? '—'}</td>
                              <td>{objective.progressPercent === null ? '—' : objective.progressPercent + '%'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="empty">El plan todavía no tiene objetivos.</p>}
                </div>
              ))}
            </section>
          )}

          {summary.networkInsights.length > 0 && (
            <section className="reportSection">
              <h2>Indicadores específicos de las redes</h2>
              <p className="reportNote">
                Se calculan automáticamente a partir de los campos opcionales que el profesorado completa al registrar cada actuación.
              </p>
              {summary.networkInsights.map((network) => (
                <div className="planReportBlock" key={network.id}>
                  <p className="eyebrow">{network.name}</p>
                  <div className="insightGrid">
                    {network.fields.map((field) => (
                      <div className="insightField" key={field.key}>
                        <strong>{field.label}</strong>
                        <div className="insightValues">
                          {field.values.map((value) => (
                            <span key={value.value}>{value.label} · {value.count}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {(summary.totals.pendingActions > 0 || summary.totals.returnedActions > 0) && (
            <section className="reportSection noPrint">
              <h2>Datos todavía no consolidados</h2>
              <div className="pendingSummary">
                <span>{summary.totals.pendingActions} pendientes de validación</span>
                <span>{summary.totals.returnedActions} devueltas para corrección</span>
              </div>
              <p className="reportNote">Estas actuaciones no se incluyen en las cifras oficiales anteriores.</p>
            </section>
          )}

          {summary.byNetwork.length > 0 && (
            <section className="reportSection">
              <h2>Resultados por red</h2>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Red</th><th>Actuaciones</th><th>Participaciones</th><th>Evidencias</th></tr></thead>
                  <tbody>
                    {summary.byNetwork.map((item) => (
                      <tr key={item.id}><td>{item.name}</td><td>{item.actions}</td><td>{item.participants}</td><td>{item.evidence}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!summary.network && <p className="reportNote">Una actuación puede pertenecer a varias redes; por ello la suma por red puede superar el total de actuaciones únicas.</p>}
            </section>
          )}

          <section className="reportSection">
            <h2>Evolución temporal</h2>
            {summary.byMonth.length ? (
              <div className="monthChart">
                {summary.byMonth.map((item) => (
                  <div className="monthRow" key={item.month}>
                    <span>{monthLabel(item.month)}</span>
                    <div className="monthTrack"><div className="monthBar" style={{ width: `${Math.max(4, (item.actions / maxMonthly) * 100)}%` }} /></div>
                    <strong>{item.actions}</strong>
                  </div>
                ))}
              </div>
            ) : <p className="empty">Sin actuaciones validadas.</p>}
          </section>

          <section className="reportColumns">
            <div className="reportSection">
              <h2>Por tipo de actuación</h2>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Tipo</th><th>Act.</th><th>Particip.</th></tr></thead>
                  <tbody>{summary.byType.map((item) => <tr key={item.type}><td>{item.type}</td><td>{item.actions}</td><td>{item.participants}</td></tr>)}</tbody>
                </table>
              </div>
            </div>

            <div className="reportSection">
              <h2>Por familia profesional</h2>
              {summary.byFamily.length ? (
                <div className="tableWrap">
                  <table>
                    <thead><tr><th>Familia</th><th>Act.</th><th>Particip.</th></tr></thead>
                    <tbody>{summary.byFamily.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.actions}</td><td>{item.participants}</td></tr>)}</tbody>
                  </table>
                </div>
              ) : <p className="empty">No hay grupos vinculados a las actuaciones.</p>}
            </div>
          </section>

          <section className="reportSection">
            <h2>Profesorado participante</h2>
            <div className="teacherList">
              {summary.teachers.map((teacher) => <span key={teacher.id}>{teacher.name}</span>)}
            </div>
          </section>

          <footer className="reportFooter">
            <span>Generado automáticamente por CÍCLOPE FP</span>
            <span>{new Date(summary.generatedAt).toLocaleString('es-ES')}</span>
          </footer>
        </article>
      )}
    </main>
  );
}
