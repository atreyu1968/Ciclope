# CÍCLOPE FP — Checklist técnico de aceptación de producción v1.0.0

> Este documento es el acta técnica previa al etiquetado `v1.0.0`. No debe considerarse cerrado mientras exista algún criterio obligatorio sin validar.

## 1. Identificación

- Proyecto: CÍCLOPE FP.
- Repositorio: `atreyu1968/Ciclope`.
- Rama candidata: `main`.
- Plataforma objetivo: Ubuntu 24.04 LTS o compatible, Node.js 24, PostgreSQL, Nginx y systemd.
- Modelo de despliegue: nativo, sin Docker.

## 2. Criterios funcionales obligatorios

- [x] Configuración inicial y creación del primer administrador.
- [x] Autenticación, cierre de sesión y recuperación de contraseña.
- [x] Gestión de profesorado, familias, grupos y turnos.
- [x] Cursos académicos y coordinaciones vinculadas por curso.
- [x] Cuatro redes operativas.
- [x] Registro, borrador, edición, corrección y reenvío de actuaciones.
- [x] Validación individual y múltiple.
- [x] Evidencias por fichero y enlace.
- [x] Comunicaciones internas, respuestas y adjuntos.
- [x] Resend con cola y reintentos.
- [x] Buzón entre profesorado y coordinación.
- [x] Planificación anual, objetivos, tareas, hitos y calendario.
- [x] Automatizaciones y resumen semanal.
- [x] Indicadores, informes, snapshots y memoria.
- [x] Exportaciones CSV, PDF/imprimible, DOCX y ODT.
- [x] Integración de IA administrable y con revisión humana.
- [x] Cierre y rollover de curso sin copiar actuaciones.

## 3. Seguridad y trazabilidad

- [x] Autorización backend por roles.
- [x] Matriz de permisos cubierta por tests.
- [x] Secretos de integraciones cifrados en base de datos.
- [x] Cookies y cabeceras HTTP revisadas.
- [x] Rate limiting en accesos públicos sensibles.
- [x] Registro de auditoría para operaciones sensibles.
- [x] Revocación de sesiones cuando procede.
- [x] Auditoría de dependencias de CI sin vulnerabilidades de nivel alto que bloqueen la entrega.

## 4. Calidad automatizada

- [x] Build de frontend y backend en CI.
- [x] Validación y generación Prisma.
- [x] Tests unitarios de servicios críticos.
- [x] Tests de autorización.
- [x] Tests de integración con PostgreSQL.
- [x] E2E del flujo configuración → login → actuación → validación → informe.
- [x] E2E de comunicaciones con Resend simulado.
- [x] E2E de cierre, rollover y activación de curso.
- [x] Prueba representativa de volumen con 1.200 actuaciones.

## 5. Operación Ubuntu

- [x] Instalador automatizado ejecutado en Ubuntu 24.04 hasta disponer de API, web, PostgreSQL y Nginx activos.
- [ ] Actualización completa validada conservando datos y ficheros.
- [ ] Backup y restauración completos validados sobre una instalación real.
- [x] Healthcheck comprueba `ciclope-api`, `ciclope-web`, Nginx, PostgreSQL, `/api/health` y frontend.
- [x] Instalador fija Node.js 24 del sistema para coincidir con los servicios systemd.
- [x] Rollback de actualización implementado si el healthcheck de la nueva release falla.

## 6. Experiencia de usuario

- [x] Navegación por rol.
- [x] Estados vacíos coherentes.
- [x] Indicadores de carga y bloqueo contra dobles envíos.
- [x] Confirmación de operaciones destructivas.
- [x] Revisión responsive.
- [x] Revisión de navegación por teclado, foco, etiquetas y contraste.
- [x] Mensajes de éxito, información y error diferenciados.

## 7. Documentación

- [x] Arquitectura.
- [x] Despliegue Ubuntu/Cloudflare.
- [x] Integraciones Resend/IA.
- [x] Manual del administrador.
- [x] Manual de coordinación.
- [x] Guía rápida para el profesorado.
- [ ] README operativo definitivo revisado contra las pruebas Ubuntu finales.
- [x] Changelog de candidato v1.

## 8. Condición para firma técnica

La aceptación técnica podrá declararse **APTA PARA v1.0.0** únicamente cuando:

1. el workflow principal de CI esté verde sobre el commit candidato;
2. el workflow `Ubuntu operational smoke` complete instalación, actualización, backup y restauración;
3. no exista ningún error crítico conocido;
4. el README refleje los comandos operativos finalmente validados;
5. el `ROADMAP_V1.md` no contenga pendientes de calidad/documentación necesarios para producción.

## 9. Estado actual

**EN VALIDACIÓN OPERATIVA.** La instalación limpia sobre Ubuntu 24.04 ya ha sido ejecutada con servicios, API, frontend y Nginx operativos. La actualización y restauración se mantienen abiertas hasta que el workflow operativo complete todas sus fases en una única ejecución.

La firma técnica se actualizará en este documento inmediatamente antes de crear la etiqueta `v1.0.0`.
