import type { Metadata } from 'next';
import './globals.css';
import Topbar from './topbar';

export const metadata: Metadata = {
  title: 'CÍCLOPE FP',
  description: 'Coordinación de las Redes de Enseñanzas Profesionales',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Topbar />
        {children}
      </body>
    </html>
  );
}
