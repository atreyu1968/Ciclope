'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Year = { id: string; name: string; isActive: boolean };
type Network = { id: string; name: string };
type Summary = {
  center: { name: string; code?: string | null };
  academicYear: { id: string; name: string; startsAt: string; endsAt: string; isActive: boolean };
  network?: { id: string; name: string } | null;
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
  planProgress: Array<{
    id: string;
    title: string;
    status: string;
    network: { id: string; name: string };
    measurableObjectives: number;
    averageProgressPercent: number | null;
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
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

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
    const params = new URLSearchParams({ academicYearId: yearId });
    if (networkId) params.set('networkId', networkId);

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
  }, [yearId, networkId, router]);

  const maxMonthly = useMemo(
    () => Math.max(1, ...(summary?.byMonth.map((item) => item.actions) ?? [1])),
    [summary],
  );

  function csvHref() {
    const params = new URLSearchParams({ academicYearId: yearId });
    if (networkId) params.set('networkId', networkId);
    return `/api/reports/actions.csv?${params.toString()}`;
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
          <a className="secondaryButton" href={csvHref()}>Exportar CSV</a>
          <button className="primaryButton" onClick={() => window.print()}>Imprimir / guardar PDF</button>
          <a className="secondaryButton" href="/coordinacion">Volver</a>
        </div>
      </div>

      <section className="panel reportFilters noPrint">
        <div className="twoColumns">
          <label>Curso académico
            <select value={yearId} onChange={(e) => setYearId(e.target.value)}>
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
      </section>

      {error && <div className="errorBox noPrint">{error}</div>}
      {loading && <div className="panel noPrint"><p>Generando informe…</p></div>}

      {summary && !loading && (
        <article className="reportDocument">
          <header className="reportHeader">
            <p className="eyebrow">CÍCLOPE FP · Memoria automática</p>
            <h1>{summary.network?.name || 'Redes de Enseñanzas Profesionales'}</h1>
            <p>{summary.center.name}{summary.center.code ? ` · ${summary.center.code}` : ''}</p>
            <p>Curso académico {summary.academicYear.name}</p>
          </header>

          <section className="reportSection">
            <h2>Resumen ejecutivo</h2>
            <p>
              Durante el curso {summary.academicYear.name} se han validado <strong>{summary.totals.validatedActions}</strong> actuaciones
              {summary.network ? ` vinculadas a la red de ${summary.network.name}` : ' dentro del ámbito consultado'}.
              Han participado <strong>{summary.totals.teachers}</strong> docentes y se han registrado
              <strong> {summary.totals.studentParticipations}</strong> participaciones de alumnado. Las actuaciones acumulan
              <strong> {summary.totals.totalHours}</strong> horas registradas y <strong>{summary.totals.evidence}</strong> evidencias.
            </p>
            <p className="reportNote">
              “Participaciones de alumnado” suma las participaciones declaradas en las actuaciones; no equivale necesariamente a alumnado único.
            </p>
          </section>

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
