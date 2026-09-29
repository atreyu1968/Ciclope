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

type Preview = {
  rows: Array<{
    row: number;
    email: string;
    name: string;
    action: 'CREATE' | 'UPDATE' | 'ERROR';
    activeAccountExists?: boolean | null;
    issues: string[];
  }>;
  summary: {
    create: number;
    update: number;
    errors: number;
    familiesToCreate: string[];
  };
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
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  async function previewRows(nextRows: ImportRow[]) {
    setChecking(true);
    const response = await fetch('/api/users/import/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rows: nextRows }),
    });
    const body = await response.json().catch(() => ({}));
    setChecking(false);

    if (response.status === 401) {
      router.push('/login');
      return;
    }
    if (!response.ok) {
      setPreview(null);
      setError(Array.isArray(body?.message) ? body.message.join(' ') : body?.message || 'No se pudo validar el archivo.');
      return;
    }
    setPreview(body);
  }

  async function loadFile(event: ChangeEvent<HTMLInputElement>) {
    setError('');
    setResult(null);
    setPreview(null);
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
    if (parsed.length > 1000) {
      setError('La importación admite un máximo de 1.000 filas por archivo.');
      return;
    }

    setRows(parsed);
    await previewRows(parsed);
  }

  async function importRows() {
    if (!preview || preview.summary.errors > 0) return;
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
    await previewRows(rows);
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
          <p className="lead">
            CÍCLOPE valida el archivo antes de escribir en la base de datos: detecta altas, actualizaciones y duplicados.
          </p>
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
        {checking && <p className="hint">Comprobando el archivo contra la base de datos…</p>}
        {error && <div className="errorBox">{error}</div>}
      </section>

      {preview && (
        <section className="statsGrid">
          <article className="statCard"><strong>{preview.summary.create}</strong><span>cuentas nuevas</span></article>
          <article className="statCard"><strong>{preview.summary.update}</strong><span>cuentas a actualizar</span></article>
          <article className="statCard"><strong>{preview.summary.errors}</strong><span>filas con errores</span></article>
          <article className="statCard"><strong>{preview.summary.familiesToCreate.length}</strong><span>familias nuevas</span></article>
        </section>
      )}

      {preview?.summary.familiesToCreate.length ? (
        <div className="notice">
          <strong>Familias que se crearán:</strong> {preview.summary.familiesToCreate.join(', ')}
        </div>
      ) : null}

      {rows.length > 0 && preview && (
        <section className="panel tablePanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Vista previa validada</p>
              <h2>{rows.length} docentes</h2>
            </div>
            <button
              className="primaryButton"
              disabled={sending || checking || preview.summary.errors > 0}
              onClick={() => void importRows()}
            >
              {sending ? 'Importando…' : preview.summary.errors > 0 ? 'Corrige los errores antes de importar' : 'Confirmar importación'}
            </button>
          </div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Fila</th><th>Nombre</th><th>Correo</th><th>Acción</th><th>Incidencias</th></tr></thead>
              <tbody>
                {preview.rows.slice(0, 150).map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.name}</td>
                    <td>{row.email}</td>
                    <td>
                      <span className={row.action === 'ERROR' ? 'badge dangerBadge' : row.action === 'CREATE' ? 'badge success' : 'badge'}>
                        {row.action === 'CREATE' ? 'Crear' : row.action === 'UPDATE' ? 'Actualizar' : 'Error'}
                      </span>
                    </td>
                    <td>{row.issues.join(' ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 150 && <p className="hint">Se muestran las primeras 150 filas de {preview.rows.length}.</p>}
        </section>
      )}

      {result && (
        <section className="successBox">
          <h2>Importación completada</h2>
          <p>{result.created} cuentas creadas · {result.updated} actualizadas · {result.familiesCreated} familias creadas.</p>
          {result.errors?.length > 0 && (
            <div className="errorBox">
              <strong>{result.errors.length} filas no se importaron</strong>
              {result.errors.slice(0, 20).map((item: any) => (
                <p key={item.row}>Fila {item.row} · {item.email}: {item.message}</p>
              ))}
            </div>
          )}
          {result.temporaryCredentials?.length > 0 && (
            <>
              <h3>Credenciales temporales de nuevas cuentas</h3>
              <div className="tableWrap">
                <table>
                  <thead><tr><th>Correo</th><th>Contraseña temporal</th></tr></thead>
                  <tbody>{result.temporaryCredentials.map((item: any) => <tr key={item.email}><td>{item.email}</td><td><code>{item.password}</code></td></tr>)}</tbody>
                </table>
              </div>
              <p className="hint">Estas contraseñas se muestran para su entrega inicial; el usuario deberá cambiarlas al acceder.</p>
            </>
          )}
        </section>
      )}
    </main>
  );
}
