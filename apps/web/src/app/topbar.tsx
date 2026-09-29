'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Me = {
  firstName: string;
  lastName: string;
  email: string;
  centerName: string;
  academicYearName?: string;
  mustChangePassword: boolean;
  roles: string[];
};

const COORDINATION_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN_CENTRO',
  'DIRECCION',
  'COORDINADOR_CICLOPE',
  'COORD_INNOVACION',
  'COORD_EMPRENDIMIENTO',
  'COORD_IOP',
  'COORD_CALIDAD',
]);

const ADMIN_ROLES = new Set(['SUPERADMIN', 'ADMIN_CENTRO', 'DIRECCION']);

export default function Topbar() {
  const [me, setMe] = useState<Me | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => {
      if (!response.ok) {
        setMe(null);
        return;
      }
      setMe(await response.json());
    }).catch(() => setMe(null));
  }, [pathname]);

  useEffect(() => {
    if (me?.mustChangePassword && pathname !== '/cuenta/cambiar-contrasena') {
      router.push('/cuenta/cambiar-contrasena');
    }
  }, [me, pathname, router]);

  const navigation = useMemo(() => {
    if (!me || me.mustChangePassword) return [];
    const coordinator = me.roles.some((role) => COORDINATION_ROLES.has(role));
    const admin = me.roles.some((role) => ADMIN_ROLES.has(role));
    return [
      { href: '/', label: 'Inicio', visible: true },
      { href: '/actuaciones/nueva', label: 'Registrar actuación', visible: true },
      { href: '/actuaciones/mis-actuaciones', label: 'Mis actuaciones', visible: true },
      { href: '/comunicaciones', label: 'Comunicaciones', visible: true },
      { href: '/coordinacion', label: 'Coordinación', visible: coordinator },
      { href: '/informes', label: 'Informes', visible: coordinator },
      { href: '/admin', label: 'Administración', visible: admin },
    ].filter((item) => item.visible);
  }, [me]);

  const publicAuthPath =
    pathname === '/login' ||
    pathname === '/configuracion-inicial' ||
    pathname === '/recuperar-contrasena' ||
    pathname === '/restablecer-contrasena';

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setMe(null);
    router.push('/login');
    router.refresh();
  }

  return (
    <>
      <header className="topbar">
        <div>
          <a className="brandLink" href="/"><strong>CÍCLOPE FP</strong></a>
          <span>{me?.centerName || 'Redes de Enseñanzas Profesionales'}</span>
        </div>

        <div className="rowActions">
          <span className="course">
            {me?.academicYearName ? 'Curso ' + me.academicYearName : 'Redes de Enseñanzas Profesionales'}
          </span>
          {me && (
            <>
              <a className="secondaryLink" href="/cuenta">
                {me.firstName} {me.lastName}
              </a>
              <button className="secondaryButton" type="button" disabled={loggingOut} onClick={() => void logout()}>
                {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
              </button>
            </>
          )}
        </div>
      </header>

      {me && !publicAuthPath && navigation.length > 0 && (
        <nav className="mainNav" aria-label="Navegación principal">
          <div className="mainNavInner">
            {navigation.map((item) => {
              const active = item.href === '/'
                ? pathname === '/'
                : pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <a className={active ? 'mainNavLink active' : 'mainNavLink'} href={item.href} key={item.href}>
                  {item.label}
                </a>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
