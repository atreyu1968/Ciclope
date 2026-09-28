const networks = [
  ['Innovación', 'Proyectos, ATECA y transferencia'],
  ['Emprendimiento', 'Iniciativas, retos y colaboración'],
  ['Información y Orientación Profesional', 'Acciones de información y orientación'],
  ['Calidad', 'Indicadores, evaluación y mejora continua'],
];

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <div>
          <p className="eyebrow">CÍCLOPE FP</p>
          <h1>Coordinación sencilla, información única.</h1>
          <p>El profesorado registra las actuaciones. Las coordinaciones validan y el sistema reutiliza los datos para evidencias, indicadores e informes.</p>
        </div>
        <div className="rowActions">
          <a className="secondaryButton" href="/login">Acceder</a>
          <a className="primaryButton" href="/actuaciones/nueva">Registrar actuación</a>
        </div>
      </section>

      <section>
        <div className="sectionHeading">
          <div><p className="eyebrow">Redes operativas</p><h2>Las cuatro redes desde el primer día</h2></div>
        </div>
        <div className="networkGrid">
          {networks.map(([name, description]) => (
            <article className="networkCard" key={name}>
              <div className="networkMark" aria-hidden="true" />
              <h3>{name}</h3><p>{description}</p><span className="status">Operativa</span>
            </article>
          ))}
        </div>
      </section>

      <section className="attention">
        <div><p className="eyebrow">Trabajo diario</p><h2>Accesos principales</h2></div>
        <div className="metric"><strong>01</strong><a href="/actuaciones/nueva">Registrar actuación</a></div>
        <div className="metric"><strong>02</strong><a href="/coordinacion/actuaciones">Bandeja coordinación</a></div>
        <div className="metric"><strong>03</strong><a href="/comunicaciones">Comunicaciones</a><a className="hint" href="/comunicaciones/nueva">Publicar mensaje</a></div>
      </section>
      <section className="quickLinks">
        <a className="secondaryButton" href="/admin/profesorado">Profesorado</a>
        <a className="secondaryButton" href="/admin/estructura">Familias y grupos</a>
        <a className="secondaryButton" href="/admin/cursos">Cursos y coordinaciones</a>
      </section>
    </main>
  );
}
