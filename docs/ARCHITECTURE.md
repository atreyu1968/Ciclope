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


## Automatizaciones internas

La API ejecuta un ciclo ligero de automatizaciones sin cron externo ni contenedores. Con Resend activado en el panel de administración:

- avisa una sola vez cuando una tarea asignada se aproxima a su fecha límite;
- avisa una sola vez cuando una tarea asignada queda vencida;
- recuerda respuestas obligatorias antes del plazo de una comunicación;
- emite un único aviso adicional si el plazo vence sin respuesta.

La cola `EmailOutbox` utiliza `dedupeKey` para garantizar idempotencia: un reinicio de la API o una ejecución repetida no duplica el mismo recordatorio.


## Integraciones externas

Cada centro dispone de una única configuración de integraciones en `CenterIntegrationSettings`.

### Resend

El correo saliente se procesa mediante la cola `EmailOutbox` y la API HTTP de Resend. No se utiliza SMTP.
La API Key, el remitente y el estado de activación se administran desde la aplicación.
Las claves se cifran con AES-256-GCM antes de persistirse y la clave maestra reside exclusivamente en `INTEGRATIONS_ENCRYPTION_KEY` del servidor.

### Inteligencia artificial

El administrador puede configurar un proveedor compatible con Chat Completions mediante:

- nombre del proveedor;
- URL base;
- modelo;
- API Key;
- activación/desactivación.

La clave se almacena cifrada y nunca se devuelve al cliente.
Los coordinadores pueden solicitar desde Informes dos operaciones:

1. interpretación técnica de indicadores;
2. redacción de un borrador formal de memoria.

Antes de enviar información al proveedor se genera un payload agregado que excluye el listado nominal del profesorado.
El texto producido por IA se presenta como borrador sujeto a revisión humana.


## Registro inteligente por red

`Action.networkDetails` almacena un JSON estructurado y validado por el backend. El formulario común sigue siendo único; los campos específicos aparecen únicamente para las redes seleccionadas y son opcionales.

La configuración actual recoge señales reutilizables para memoria e indicadores:

- Innovación: enfoque, transferibilidad y colaboración externa.
- Emprendimiento: enfoque, colaboración externa y resultado generado.
- Información y Orientación Profesional: ámbito, destinatario y colaboración externa.
- Calidad: ámbito de mejora, fase EQAVET y generación de acción de mejora.

Los valores se validan contra `ACTION_NETWORK_FIELDS`. El backend ignora claves no reconocidas y no acepta opciones fuera del catálogo.

## Hitos oficiales

Los planes del curso 2026-2027 incorporan automáticamente los hitos conocidos publicados por la DGFPERE:

- presentación del Plan de Acción: 30/10/2026;
- memoria final del Plan de Acción: 18/06/2027.

Se modelan como `PlanTask` con `official=true` y una `officialKey` estable. La restricción única `planId + officialKey` permite ejecutar el backfill en cada arranque sin duplicar tareas.

Los informes trimestrales se gestionan como tareas del plan cuando la DGFPERE publique las fechas concretas.


## Informes por periodo

Los endpoints de informes aceptan `from` y `to` en formato `YYYY-MM-DD`. El mismo alcance temporal se utiliza para:

- resumen de indicadores;
- exportación CSV;
- impresión/PDF;
- interpretación con IA;
- redacción asistida de memoria.

Las actuaciones del periodo se filtran por `activityDate`. El progreso de los objetivos del plan se mantiene como avance acumulado hasta la fecha final del periodo, evitando comparar una meta anual únicamente contra la actividad aislada de un trimestre.

## Hitos comunes del curso

`AcademicYearMilestone` permite registrar una fecha común una sola vez. Al crearla, CÍCLOPE genera una `PlanTask` equivalente en todos los planes existentes del curso y la conserva como plantilla para planes creados posteriormente.

Cada tarea distribuida utiliza `officialKey = YEAR_MILESTONE:<id>`, por lo que la sincronización es idempotente.
Esta función está reservada a administración, dirección y coordinación CÍCLOPE.
