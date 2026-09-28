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
          <p className="eyebrow">Panel del centro</p>
          <h1>Coordinación sencilla, información única.</h1>
          <p>El profesorado registra las actuaciones. Las coordinaciones validan y el sistema reutiliza los datos para evidencias, indicadores e informes.</p>
        </div>
        <a className="primaryButton" href="/actuaciones/nueva">Registrar actuación</a>
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
        <div><p className="eyebrow">Principio</p><h2>Registrar una vez. Reutilizar siempre.</h2></div>
        <div className="metric"><strong>1</strong><span>formulario para el profesorado</span></div>
        <div className="metric"><strong>4</strong><span>redes conectadas</span></div>
        <div className="metric"><strong>0</strong><span>transcripciones por coordinación</span></div>
      </section>
    </main>
  );
}
