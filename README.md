# CÍCLOPE FP

Aplicación fullstack para la coordinación de las cuatro Redes de Enseñanzas Profesionales en centros de Formación Profesional de Canarias.

## Objetivo

Reducir la carga administrativa de las coordinaciones y servir como canal asíncrono de comunicación con todo el profesorado de FP. La información se registra una sola vez y se reutiliza para seguimiento, indicadores, evidencias, planificación e informes.

## Redes operativas

- Innovación
- Emprendimiento
- Información y Orientación Profesional
- Calidad

## Arquitectura

- Frontend: Next.js + TypeScript
- Backend: NestJS + TypeScript
- Base de datos: PostgreSQL
- ORM: Prisma
- Producción: Ubuntu + Node.js + PostgreSQL + Nginx + systemd
- Sin Docker

## Funcionalidades ya implementadas

- autenticación y permisos;
- cursos académicos e histórico;
- coordinaciones vinculadas a curso, con varias coordinaciones por docente;
- estructura FP por familias y grupos;
- registro de actuaciones por el profesorado;
- validación y devolución para corrección;
- evidencias mediante archivos y enlaces;
- comunicaciones segmentadas y seguimiento de lectura/respuesta;
- buzón del claustro;
- planes anuales por red, objetivos, tareas y responsables;
- indicadores y memoria automática;
- cobertura documental y progreso automático de objetivos;
- formulario inteligente con datos opcionales específicos por red;
- indicadores automáticos de Innovación, Emprendimiento, IOP y Calidad;
- informes por periodo para cierres trimestrales, con CSV, PDF e IA sobre el mismo intervalo;
- hitos oficiales de planificación integrados en cada plan anual;
- hitos comunes del curso distribuibles a las cuatro redes desde una única acción;
- seguimiento de tareas, vencimientos y próximos plazos desde el dashboard;
- recordatorios automáticos de plazos;
- correo transaccional mediante Resend;
- configuración de Resend desde el panel de administración;
- API de IA configurable desde el panel de administración;
- interpretación de indicadores y redacción asistida de borradores de memoria;
- instalación nativa automatizada en Ubuntu.

## Integraciones

Las claves de Resend y de la API de IA se configuran en **Administración → Integraciones**. Se almacenan cifradas en PostgreSQL y nunca se devuelven al navegador.

La integración de IA utiliza una API compatible con Chat Completions. En los informes solo se envían datos agregados: el listado nominal del profesorado no se remite al proveedor de IA.

## Instalación

El script `scripts/install-ubuntu.sh` instala las dependencias, PostgreSQL, Node.js, Nginx, crea el usuario de servicio, genera secretos, ejecuta migraciones, compila la aplicación y activa los servicios systemd.
