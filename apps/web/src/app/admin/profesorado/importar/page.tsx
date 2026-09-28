'use client';

import { ChangeEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type ImportRow = {
  firstName: string;
  lastName: string;
  email: string;
  shift?: 'MORNING' | 'AFTERNOON' | 'BOTH' | 'UNSPECIFIED';
  families?: string[];
};

function splitCsvLine(line: string, delimiter: string) {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function normalizeShift(value: string): ImportRow['shift'] {
  const normalized = value.trim().toLowerCase();
  if (['mañana', 'manana', 'morning', 'm'].includes(normalized)) return 'MORNING';
  if (['tarde', 'afternoon', 't'].includes(normalized)) return 'AFTERNOON';
  if (['ambos', 'ambas', 'both', 'mañana y tarde', 'manana y tarde'].includes(normalized)) return 'BOTH';
  return 'UNSPECIFIED';
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export default function ImportFacultyPage() {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [sending, setSending] = useState(false);

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    setResult(null);
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      setError('El archivo debe contener cabecera y al menos una fila.');
      return;
    }

    const delimiter = (lines[0].split(';').length > lines[0].split(',').length) ? ';' : ',';
    const headers = splitCsvLine(lines[0], delimiter).map(normalizeHeader);
    const indexes = {
      firstName: headers.findIndex((h) => ['nombre', 'firstname'].includes(h)),
      lastName: headers.findIndex((h) => ['apellidos', 'apellido', 'lastname'].includes(h)),
      email: headers.findIndex((h) => ['email', 'correo', 'correo electronico'].includes(h)),
      shift: headers.findIndex((h) => ['turno', 'shift'].includes(h)),
      families: headers.findIndex((h) => ['familias', 'familia', 'familias profesionales'].includes(h)),
    };

    if (indexes.firstName < 0 || indexes.lastName < 0 || indexes.email < 0) {
      setError('Faltan columnas obligatorias: nombre, apellidos y email.');
      return;
    }

    const parsed = lines.slice(1).map((line) => {
      const cells = splitCsvLine(line, delimiter);
      const familiesValue = indexes.families >= 0 ? cells[indexes.families] ?? '' : '';
      return {
        firstName: cells[indexes.firstName]?.trim() ?? '',
        lastName: cells[indexes.lastName]?.trim() ?? '',
        email: cells[indexes.email]?.trim() ?? '',
        shift: indexes.shift >= 0 ? normalizeShift(cells[indexes.shift] ?? '') : 'UNSPECIFIED',
        families: familiesValue ? familiesValue.split('|').map((item) => item.trim()).filter(Boolean) : [],
      } satisfies ImportRow;
    }).filter((row) => row.firstName && row.lastName && row.email);

    if (!parsed.length) {
      setError('No se han encontrado filas válidas.');
      return;
    }
    setRows(parsed);
  }

  async function importRows() {
    setSending(true);
    setError('');
    const response = await fetch('/api/users/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rows }),
    });
    if (response.status === 401) {
      router.push('/login');
      return;
    }
    const body = await response.json().catch(() => ({}));
    setSending(false);
    if (!response.ok) {
      setError(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'No se pudo importar.');
      return;
    }
    setResult(body);
  }

  function downloadTemplate() {
    const content = 'nombre;apellidos;email;turno;familias\nAna;Pérez García;ana@centro.es;mañana;Administración y Gestión|Comercio y Marketing\n';
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_profesorado_ciclope.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Importar profesorado</h1>
          <p className="lead">Carga el claustro FP de una sola vez. Los correos existentes se actualizan; no se duplican usuarios.</p>
        </div>
        <div className="rowActions">
          <button className="secondaryButton" onClick={downloadTemplate}>Descargar plantilla</button>
          <a className="secondaryButton" href="/admin/profesorado">Volver</a>
        </div>
      </div>

      <section className="panel">
        <h2>Archivo CSV</h2>
        <p className="hint">
          Columnas: nombre, apellidos, email, turno y familias. Si un docente pertenece a varias familias, sepáralas con |.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={loadFile} />
        {error && <div className="errorBox">{error}</div>}
      </section>

      {rows.length > 0 && (
        <section className="panel tablePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Vista previa</p>
              <h2>{rows.length} docentes</h2>
            </div>
            <button className="primaryButton" disabled={sending} onClick={importRows}>
              {sending ? 'Importando…' : 'Importar profesorado'}
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Nombre</th><th>Correo</th><th>Turno</th><th>Familias</th></tr></thead>
              <tbody>
                {rows.slice(0, 100).map((row, index) => (
                  <tr key={row.email + index}>
                    <td>{row.lastName}, {row.firstName}</td>
                    <td>{row.email}</td>
                    <td>{row.shift}</td>
                    <td>{row.families?.join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 100 && <p className="hint">Se muestran las primeras 100 filas de {rows.length}.</p>}
        </section>
      )}

      {result && (
        <section className="successBox">
          <h2>Importación completada</h2>
          <p>{result.created} cuentas creadas · {result.updated} actualizadas · {result.familiesCreated} familias creadas.</p>
          {result.errors?.length > 0 && <p>{result.errors.length} filas requieren revisión.</p>}
          {result.temporaryCredentials?.length > 0 && (
            <>
              <h3>Credenciales temporales de nuevas cuentas</h3>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Correo</th><th>Contraseña temporal</th></tr></thead>
                  <tbody>{result.temporaryCredentials.map((item: any) => <tr key={item.email}><td>{item.email}</td><td><code>{item.password}</code></td></tr>)}</tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </main>
  );
}
