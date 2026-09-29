const areas = [
  {
    href: '/admin/profesorado',
    eyebrow: 'Personas y permisos',
    title: 'Profesorado',
    description: 'Altas, perfiles, turnos, familias profesionales y acceso del claustro de FP.',
  },
  {
    href: '/admin/estructura',
    eyebrow: 'Estructura del centro',
    title: 'Familias y grupos',
    description: 'Configura la estructura de FP que se reutiliza en actuaciones, comunicaciones e informes.',
  },
  {
    href: '/admin/cursos',
    eyebrow: 'Organización anual',
    title: 'Cursos y coordinaciones',
    description: 'Gestiona cursos académicos y vincula cada coordinación a su curso, admitiendo varias por docente.',
  },
  {
    href: '/admin/redes',
    eyebrow: 'Marco institucional',
    title: 'Redes',
    description: 'Edita para este centro la descripción y los objetivos de referencia de Innovación, Emprendimiento, IOP y Calidad.',
  },
  {
    href: '/admin/integraciones',
    eyebrow: 'Servicios externos',
    title: 'Integraciones',
    description: 'Configura Resend y la API de IA del centro, comprueba su estado y realiza pruebas de conexión.',
  },
  {
    href: '/admin/auditoria',
    eyebrow: 'Seguridad y trazabilidad',
    title: 'Auditoría',
    description: 'Consulta las operaciones sensibles realizadas sobre cuentas, contraseñas y configuración administrativa.',
  },
];

export default function AdminPage() {
  return (
    <main className="shell">
      <div className="pageHeader">
        <div>
          <p className="eyebrow">Administración</p>
          <h1>Panel de administración</h1>
          <p className="lead">
            Configuración central de CÍCLOPE FP. Los datos definidos aquí se comparten entre las cuatro redes y evitan duplicar tareas durante el curso.
          </p>
        </div>
        <a className="secondaryButton" href="/">Volver al inicio</a>
      </div>

      <section className="adminGrid">
        {areas.map((area) => (
          <article className="panel" key={area.href}>
            <p className="eyebrow">{area.eyebrow}</p>
            <h2>{area.title}</h2>
            <p>{area.description}</p>
            <div className="rowActions">
              <a className="primaryButton" href={area.href}>Abrir</a>
            </div>
          </article>
        ))}
      </section>

      <section className="attention">
        <div>
          <p className="eyebrow">Criterio de diseño</p>
          <h2>Una sola configuración para todo el centro</h2>
        </div>
        <p>
          El curso activo, la estructura docente, las coordinaciones y las integraciones se administran una vez y se reutilizan en actuaciones, planes, comunicaciones, automatizaciones e informes.
        </p>
      </section>
    </main>
  );
}
