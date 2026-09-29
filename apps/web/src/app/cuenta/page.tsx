'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Me = {
  firstName: string;
  lastName: string;
  email: string;
  centerName: string;
  academicYearName?: string;
  roles: string[];
  coordinatorNetworkCodes: string[];
};

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Superadministración',
  ADMIN_CENTRO: 'Administración del centro',
  DIRECCION: 'Dirección',
  COORDINADOR_CICLOPE: 'Coordinación CÍCLOPE',
  COORD_INNOVACION: 'Coordinación de Innovación',
  COORD_EMPRENDIMIENTO: 'Coordinación de Emprendimiento',
  COORD_IOP: 'Coordinación de Información y Orientación Profesional',
  COORD_CALIDAD: 'Coordinación de Calidad',
  PROFESOR_FP: 'Profesorado de FP',
};

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => {
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      if (!response.ok) {
        setError('No se pudo cargar tu perfil.');
        return;
      }
      setMe(await response.json());
    }).catch(() => setError('No se pudo cargar tu perfil.'));
  }, [router]);

  if (error) return <main className="shell"><div className="errorBox">{error}</div></main>;
  if (!me) return <main className="shell"><p>Cargando perfil…</p></main>;

  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Cuenta</p>
          <h1>{me.firstName} {me.lastName}</h1>
          <p className="lead">Información de acceso y responsabilidades activas en CÍCLOPE FP.</p>
        </div>
        <a className="secondaryButton" href="/">Volver</a>
      </div>

      <section className="adminGrid">
        <article className="panel">
          <p className="eyebrow">Identificación</p>
          <h2>Datos de la cuenta</h2>
          <p><strong>Correo:</strong> {me.email}</p>
          <p><strong>Centro:</strong> {me.centerName}</p>
          <p><strong>Curso activo:</strong> {me.academicYearName || 'Sin curso activo'}</p>
          <div className="rowActions">
            <a className="primaryButton" href="/cuenta/cambiar-contrasena">Cambiar contraseña</a>
          </div>
        </article>

        <article className="panel">
          <p className="eyebrow">Permisos</p>
          <h2>Funciones activas</h2>
          <div className="chipRow">
            {me.roles.map((role) => <span className="chip" key={role}>{ROLE_LABELS[role] || role}</span>)}
          </div>
          {me.coordinatorNetworkCodes.length > 0 && (
            <p className="hint">Las coordinaciones mostradas dependen del curso académico activo.</p>
          )}
        </article>
      </section>
    </main>
  );
}
