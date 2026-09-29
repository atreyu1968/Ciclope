# Arquitectura de CÍCLOPE FP

## Principios

1. El profesorado introduce la información en origen.
2. La coordinación supervisa y valida; no retranscribe.
3. Una actuación puede pertenecer a una o varias redes.
4. Los datos validados alimentarán indicadores, informes y memoria.
5. El portal del profesorado debe poder utilizarse desde móvil en menos de 90 segundos por actuación ordinaria.
6. La aplicación se despliega directamente en Ubuntu, sin Docker.
7. Todas las operaciones de gestión pertenecen a un curso académico.
8. Las coordinaciones se asignan por curso, nunca como atributos permanentes del usuario.
9. Un mismo docente puede acumular dos o más coordinaciones simultáneamente en el mismo curso.
10. El cambio de coordinador en un curso posterior no modifica el histórico anterior.

## Componentes

- `apps/web`: interfaz Next.js.
- `apps/api`: API NestJS.
- `packages/database`: modelo PostgreSQL/Prisma.
- `deploy`: Nginx y systemd.
- `scripts`: instalación y mantenimiento.

## Coordinaciones

La tabla `NetworkCoordinator` relaciona `AcademicYear + Network + User`.
No existe restricción de una única red por usuario. Por tanto, un docente puede ser responsable de Innovación y Calidad en el mismo curso, además de estar asignado a CÍCLOPE.

Los permisos de coordinación se calculan en cada sesión a partir de las asignaciones del curso activo.

## Flujo de actuación

Profesorado autenticado → actuación asociada al curso activo → PENDING_VALIDATION → bandeja de la coordinación correspondiente → VALIDATED o RETURNED.


## Evidencias e indicadores

Las evidencias se asocian a una actuación y pueden ser archivos o enlaces. Los informes se calculan siempre sobre actuaciones validadas y muestran:

- actuaciones con y sin evidencia;
- cobertura documental porcentual;
- número de archivos y enlaces;
- evidencias por red;
- avance automático de objetivos medibles del plan anual.

Una evidencia añadida a una actuación validada modifica de forma inmediata los indicadores y, cuando el objetivo utiliza la métrica `EVIDENCE`, su grado de avance.

## Planificación anual

Existe un único plan por combinación `AcademicYear + Network`. Los coordinadores autorizados pueden:

- crear y activar el plan;
- definir objetivos cualitativos o con métrica automática;
- vincular actuaciones a objetivos;
- crear tareas, responsables y fechas límite;
- consultar el avance sin transcribir datos.

Las métricas automáticas disponibles son actuaciones validadas, participaciones de alumnado, horas registradas y evidencias.
El dashboard destaca tareas vencidas y actuaciones validadas sin evidencia para concentrar la hora semanal de coordinación en excepciones.
