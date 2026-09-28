import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CÍCLOPE FP',
  description: 'Coordinación de las Redes de Enseñanzas Profesionales',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <header className="topbar">
          <div><strong>CÍCLOPE FP</strong><span>Redes de Enseñanzas Profesionales</span></div>
          <span className="course">Curso 2026-2027</span>
        </header>
        {children}
      </body>
    </html>
  );
}
