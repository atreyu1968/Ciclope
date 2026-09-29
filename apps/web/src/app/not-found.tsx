export default function NotFound() {
  return (
    <main className="formShell narrow">
      <div className="formIntro">
        <p className="eyebrow">Error 404</p>
        <h1>Página no encontrada</h1>
        <p>La dirección solicitada no existe o ha cambiado. Puedes volver al inicio de CÍCLOPE FP.</p>
      </div>
      <div className="rowActions">
        <a className="primaryButton" href="/">Ir al inicio</a>
        <a className="secondaryButton" href="/coordinacion">Mi hora de coordinación</a>
      </div>
    </main>
  );
}
