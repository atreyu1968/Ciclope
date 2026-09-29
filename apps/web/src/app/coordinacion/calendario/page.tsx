'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type CalendarTask = {
  id: string;
  title: string;
  description?: string | null;
  dueDate: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  official: boolean;
  objective?: { id: string; title: string } | null;
  owner?: { id: string; firstName: string; lastName: string } | null;
  plan: {
    id: string;
    network: { id: string; name: string; code: string };
  };
};

type CalendarData = {
  academicYear: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
  } | null;
  tasks: CalendarTask[];
};

const statusLabels: Record<CalendarTask['status'], string> = {
  TODO: 'Pendiente',
  IN_PROGRESS: 'En curso',
  DONE: 'Hecha',
};

function dateKey(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return date.toISOString().slice(0, 10);
}

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

export default function CoordinationCalendarPage() {
  const router = useRouter();
  const [data, setData] = useState<CalendarData | null>(null);
  const [cursor, setCursor] = useState<Date | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/plans/calendar').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo cargar el calendario.');
        return;
      }

      const loaded = body as CalendarData;
      setData(loaded);
      if (loaded.academicYear) {
        const start = new Date(loaded.academicYear.startsAt);
        const end = new Date(loaded.academicYear.endsAt);
        const now = new Date();
        const initial = now >= start && now <= end ? now : start;
        setCursor(monthStart(initial));
      }
    }).catch(() => setError('No se pudo cargar el calendario.'));
  }, [router]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of data?.tasks ?? []) {
      if (!task.dueDate) continue;
      const key = dateKey(task.dueDate);
      const rows = map.get(key) ?? [];
      rows.push(task);
      map.set(key, rows);
    }
    return map;
  }, [data]);

  const monthCells = useMemo(() => {
    if (!cursor) return [] as Array<number | null>;
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const firstWeekdayMonday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return [
      ...Array.from({ length: firstWeekdayMonday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [cursor]);

  if (error) {
    return <main className="shell"><div className="errorBox">{error}</div></main>;
  }
  if (!data || (data.academicYear && !cursor)) {
    return <main className="shell"><p>Cargando calendario…</p></main>;
  }

  if (!data.academicYear || !cursor) {
    return (
      <main className="shell">
        <div className="pageHeader">
          <div><p className="eyebrow">Planificación</p><h1>Calendario de coordinación</h1></div>
          <a className="secondaryButton" href="/coordinacion">Volver</a>
        </div>
        <div className="panel"><p className="empty">No existe un curso académico activo para mostrar el calendario.</p></div>
      </main>
    );
  }

  const startMonth = monthStart(new Date(data.academicYear.startsAt));
  const endMonth = monthStart(new Date(data.academicYear.endsAt));
  const currentMonthIndex = cursor.getUTCFullYear() * 12 + cursor.getUTCMonth();
  const startMonthIndex = startMonth.getUTCFullYear() * 12 + startMonth.getUTCMonth();
  const endMonthIndex = endMonth.getUTCFullYear() * 12 + endMonth.getUTCMonth();
  const monthLabel = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(cursor);
  const todayKey = dateKey(new Date());

  function moveMonth(delta: number) {
    setCursor((current) => {
      if (!current) return current;
      return new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1));
    });
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Planificación · {data.academicYear.name}</p>
          <h1>Calendario de coordinación</h1>
          <p className="lead">Tareas e hitos de las redes que coordinas, ordenados por fecha para anticipar el trabajo.</p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/coordinacion/planes">Planes anuales</a>
          <a className="secondaryButton" href="/coordinacion">Volver</a>
        </div>
      </div>

      <section className="panel calendarPanel">
        <div className="calendarToolbar">
          <button
            className="secondaryButton"
            type="button"
            disabled={currentMonthIndex <= startMonthIndex}
            onClick={() => moveMonth(-1)}
          >
            ← Mes anterior
          </button>
          <div>
            <p className="eyebrow">Vista mensual</p>
            <h2>{monthLabel}</h2>
          </div>
          <button
            className="secondaryButton"
            type="button"
            disabled={currentMonthIndex >= endMonthIndex}
            onClick={() => moveMonth(1)}
          >
            Mes siguiente →
          </button>
        </div>

        <div className="calendarLegend">
          <span><i className="calendarDot official" /> Hito oficial</span>
          <span><i className="calendarDot active" /> En curso</span>
          <span><i className="calendarDot done" /> Hecha</span>
        </div>

        <div className="calendarGrid" role="grid" aria-label={'Calendario de ' + monthLabel}>
          {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
            <div className="calendarWeekday" role="columnheader" key={day}>{day}</div>
          ))}

          {monthCells.map((day, index) => {
            if (day === null) {
              return <div className="calendarDay emptyDay" aria-hidden="true" key={'empty-' + index} />;
            }
            const key = dateKey(new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day)));
            const dayTasks = tasksByDay.get(key) ?? [];
            const isToday = key === todayKey;

            return (
              <div className={'calendarDay ' + (isToday ? 'today' : '')} role="gridcell" key={key}>
                <div className="calendarDate">
                  <strong>{day}</strong>
                  {isToday && <span>Hoy</span>}
                </div>
                <div className="calendarEvents">
                  {dayTasks.map((task) => (
                    <a
                      className={
                        'calendarEvent ' +
                        (task.official ? 'official ' : '') +
                        (task.status === 'DONE' ? 'done' : task.status === 'IN_PROGRESS' ? 'active' : '')
                      }
                      href="/coordinacion/planes"
                      key={task.id}
                      title={task.description || task.title}
                    >
                      <strong>{task.title}</strong>
                      <span>{task.plan.network.name}</span>
                      <small>
                        {statusLabels[task.status]}
                        {task.owner ? ' · ' + task.owner.firstName + ' ' + task.owner.lastName : ''}
                      </small>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <div>
            <p className="eyebrow">Resumen del curso</p>
            <h2>Compromisos con fecha</h2>
          </div>
          <span className="badge">{data.tasks.length} elementos</span>
        </div>
        {data.tasks.length ? (
          <div className="tableWrap">
            <table>
              <thead>
                <tr><th>Fecha</th><th>Red</th><th>Tarea / hito</th><th>Estado</th><th>Responsable</th></tr>
              </thead>
              <tbody>
                {data.tasks.map((task) => (
                  <tr key={task.id}>
                    <td>{new Date(task.dueDate).toLocaleDateString('es-ES')}</td>
                    <td>{task.plan.network.name}</td>
                    <td>
                      <strong>{task.title}</strong>
                      {task.official && <span className="badge success">Hito oficial</span>}
                    </td>
                    <td>{statusLabels[task.status]}</td>
                    <td>{task.owner ? task.owner.firstName + ' ' + task.owner.lastName : 'Sin responsable'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="empty">No hay tareas o hitos con fecha en los planes autorizados.</p>}
      </section>
    </main>
  );
}
