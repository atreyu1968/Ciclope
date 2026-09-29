export default function AccessDeniedPage() {
  return (
    <main className="formShell narrow">
      <div className="formIntro">
        <p className="eyebrow">Acceso restringido</p>
        <h1>No tienes permiso para esta función</h1>
        <p>Tu cuenta está activa, pero la operación solicitada requiere otro rol o una coordinación asignada en el curso académico correspondiente.</p>
      </div>
      <div className="rowActions">
        <a className="primaryButton" href="/">Volver al inicio</a>
        <a className="secondaryButton" href="/cuenta">Ver mi perfil</a>
      </div>
    </main>
  );
}
