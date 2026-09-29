'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

type Me = {
  firstName: string;
  lastName: string;
  centerName: string;
  academicYearName?: string;
  mustChangePassword: boolean;
};

export default function Topbar() {
  const [me, setMe] = useState<Me | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => {
      if (!response.ok) return;
      setMe(await response.json());
    }).catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    if (me?.mustChangePassword && pathname !== '/cuenta/cambiar-contrasena') {
      router.push('/cuenta/cambiar-contrasena');
    }
  }, [me, pathname, router]);

  async function logout() {
    setLoggingOut(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    setMe(null);
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="topbar">
      <div>
        <strong>CÍCLOPE FP</strong>
        <span>{me?.centerName || 'Redes de Enseñanzas Profesionales'}</span>
      </div>

      <div className="rowActions">
        <span className="course">
          {me?.academicYearName ? 'Curso ' + me.academicYearName : 'Redes de Enseñanzas Profesionales'}
        </span>
        {me && (
          <>
            <a className="secondaryLink" href="/cuenta/cambiar-contrasena">
              {me.firstName} {me.lastName}
            </a>
            <button className="secondaryButton" type="button" disabled={loggingOut} onClick={() => void logout()}>
              {loggingOut ? 'Saliendo…' : 'Cerrar sesión'}
            </button>
          </>
        )}
      </div>
    </header>
  );
}
