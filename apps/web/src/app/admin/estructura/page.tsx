'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Family = {
  id: string;
  name: string;
  code?: string | null;
  _count?: { users: number; groups: number };
};
type Group = {
  id: string;
  name: string;
  shift: string;
  studentCount?: number | null;
  professionalFamily: Family;
};

export default function StructureAdminPage() {
  const router = useRouter();
  const [families, setFamilies] = useState<Family[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [familiesResponse, groupsResponse] = await Promise.all([
        fetch('/api/structure/families'),
        fetch('/api/structure/groups'),
      ]);
      if (familiesResponse.status === 401 || groupsResponse.status === 401) {
        router.push('/login');
        return;
      }
      if (!familiesResponse.ok || !groupsResponse.ok) {
        setMessage('No se pudo cargar la estructura académica.');
        return;
      }
      setFamilies(await familiesResponse.json());
      setGroups(await groupsResponse.json());
    } catch {
      setMessage('No se pudo cargar la estructura académica.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function createFamily(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/structure/families', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        code: form.get('code') || undefined,
      }),
    });
    setMessage(response.ok ? 'Familia profesional creada.' : 'No se pudo crear la familia.');
    if (response.ok) {
      event.currentTarget.reset();
      await load();
    }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/structure/groups', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        professionalFamilyId: form.get('professionalFamilyId'),
        name: form.get('name'),
        shift: form.get('shift'),
        studentCount: form.get('studentCount') ? Number(form.get('studentCount')) : undefined,
      }),
    });
    setMessage(response.ok ? 'Grupo creado.' : 'No se pudo crear el grupo.');
    if (response.ok) {
      event.currentTarget.reset();
      await load();
    }
  }

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Estructura de FP</h1>
          <p className="lead">Familias profesionales y grupos vinculados al curso académico activo.</p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/admin/profesorado">Profesorado</a>
          <a className="secondaryButton" href="/">Volver</a>
        </div>
      </div>

      {message && <div className="notice">{message}</div>}
      {loading && (
        <div className="loadingState" role="status" aria-live="polite">
          <span className="loadingSpinner" aria-hidden="true" />
          <strong>Cargando estructura académica…</strong>
        </div>
      )}

      <section className="adminGrid">
        <article className="panel">
          <h2>Nueva familia profesional</h2>
          <form className="compactForm" onSubmit={createFamily}>
            <label>Nombre<input name="name" required /></label>
            <label>Código<input name="code" placeholder="Opcional" /></label>
            <button className="primaryButton">Crear familia</button>
          </form>

          <div className="assignmentList structureList">
            <h3>Familias del centro</h3>
            {!loading && !families.length && (
              <div className="emptyState"><h3>Sin familias profesionales</h3><p>Crea la primera familia para poder organizar grupos y profesorado.</p></div>
            )}
            {families.map((family) => (
              <div className="assignmentRow" key={family.id}>
                <div>
                  <strong>{family.name}</strong>
                  <span>{family.code || 'Sin código'} · {family._count?.users ?? 0} docentes · {family._count?.groups ?? 0} grupos</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h2>Nuevo grupo</h2>
          <form className="compactForm" onSubmit={createGroup}>
            <label>Familia profesional
              <select name="professionalFamilyId" required defaultValue="">
                <option value="" disabled>Selecciona familia</option>
                {families.map((family) => <option key={family.id} value={family.id}>{family.name}</option>)}
              </select>
            </label>
            <label>Nombre del grupo<input name="name" placeholder="1.º CFGM Gestión Administrativa" required /></label>
            <div className="twoColumns">
              <label>Turno
                <select name="shift" defaultValue="UNSPECIFIED">
                  <option value="MORNING">Mañana</option>
                  <option value="AFTERNOON">Tarde</option>
                  <option value="BOTH">Ambos</option>
                  <option value="UNSPECIFIED">Sin especificar</option>
                </select>
              </label>
              <label>N.º de alumnos<input type="number" name="studentCount" min="0" /></label>
            </div>
            <button className="primaryButton">Crear grupo</button>
          </form>

          <div className="assignmentList structureList">
            <h3>Grupos del curso activo</h3>
            {!loading && !groups.length && (
              <div className="emptyState"><h3>Sin grupos en el curso activo</h3><p>Crea un grupo cuando exista al menos una familia profesional configurada.</p></div>
            )}
            {groups.map((group) => (
              <div className="assignmentRow" key={group.id}>
                <div>
                  <strong>{group.name}</strong>
                  <span>{group.professionalFamily.name} · {group.shift} · {group.studentCount ?? '—'} alumnos</span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
