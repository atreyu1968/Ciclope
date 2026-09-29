'use client';

import { useEffect, useState } from 'react';

type Me = {
  firstName: string;
  lastName: string;
  centerName: string;
  academicYearName?: string;
};

export default function Topbar() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch('/api/auth/me').then(async (response) => {
      if (!response.ok) return;
      setMe(await response.json());
    }).catch(() => undefined);
  }, []);

  return (
    <header className="topbar">
      <div>
        <strong>CÍCLOPE FP</strong>
        <span>{me?.centerName || 'Redes de Enseñanzas Profesionales'}</span>
      </div>
      <span className="course">
        {me?.academicYearName ? 'Curso ' + me.academicYearName : 'Redes de Enseñanzas Profesionales'}
      </span>
    </header>
  );
}
