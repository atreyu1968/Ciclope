# Changelog

Todos los cambios relevantes de CÍCLOPE FP se documentan en este archivo.

El proyecto sigue un esquema de versionado semántico. La versión `1.0.0` se etiquetará únicamente cuando el checklist de aceptación de producción esté completamente validado.

## [Unreleased] — candidato a 1.0.0

### Añadido

- Aplicación fullstack Next.js + NestJS + PostgreSQL/Prisma para la coordinación de Redes de Enseñanzas Profesionales.
- Gestión nativa de las cuatro redes: Innovación, Emprendimiento, Información y Orientación Profesional y Calidad.
- Cursos académicos con histórico, cierre, rollover y coordinaciones vinculadas por curso.
- Varias coordinaciones simultáneas por docente y coordinación general CÍCLOPE.
- Gestión de profesorado, familias profesionales, grupos y turnos.
- Importación y exportación de profesorado con previsualización y validación de errores.
- Registro de actuaciones por el profesorado, borradores, edición, duplicado, devolución, corrección y reenvío.
- Validación individual y múltiple con filtros e historial de estados.
- Evidencias por enlace y fichero con descarga segura y previsualización.
- Comunicaciones internas segmentadas, lectura, respuesta, plazos y adjuntos.
- Integración de correo transaccional con Resend, cola, reintentos, deduplicación y seguimiento de entregas.
- Buzón asíncrono entre profesorado y coordinaciones.
- Plan anual por red, objetivos, tareas, responsables, métricas e hitos.
- Calendario y panel «Mi hora de coordinación» con agenda priorizada.
- Automatizaciones de recordatorios, vencimientos, hitos y resúmenes semanales.
- Informes agregados, filtros, comparativas, snapshots, CSV, PDF, DOCX y ODT.
- Indicadores diferenciados por red y alertas de datos incompletos o anómalos.
- Integración configurable de IA compatible con Chat Completions para informes, memoria, comunicaciones, buzón y planificación.
- Gestión administrativa de Resend e IA con secretos cifrados.
- Preferencias de notificación por usuario.
- Auditoría de operaciones sensibles.
- Recuperación y cambio de contraseña, contraseñas temporales y revocación de sesiones.
- Rate limiting básico y cabeceras/cookies de seguridad.
- Instalación nativa automatizada en Ubuntu con Node.js, PostgreSQL, Nginx y systemd, sin Docker.
- Scripts de actualización con copia previa y rollback, backup, restauración y healthcheck.
- Documentación de arquitectura, despliegue Ubuntu/Cloudflare, integraciones y manuales por perfil.

### Calidad

- CI de compilación, auditoría de dependencias y validación Prisma.
- Tests unitarios y de autorización.
- Tests de integración API + PostgreSQL.
- E2E sobre la API compilada para configuración inicial, autenticación, actuaciones, validación e informes.
- E2E de comunicaciones con transporte Resend simulado.
- E2E de cierre, rollover y activación de curso.
- Prueba representativa de volumen con 1.200 actuaciones, 80 docentes simulados y 840 evidencias.
- Workflow operativo Ubuntu 24.04 para validar instalación, actualización y recuperación real; se mantiene como condición de aceptación de `1.0.0`.

### Corregido durante la fase de aceptación

- Healthcheck de API ajustado al prefijo real `/api/health`.
- Instalador endurecido para arrancar PostgreSQL/Nginx explícitamente en instalaciones mínimas.
- Toolchain de instalación/actualización fijada a Node.js 24 de `/usr/bin` para evitar runtimes heredados del entorno interactivo.
- Ejecución de scripts operativos mediante `bash`, evitando depender del bit ejecutable conservado por Git.
- E2E ejecutado contra el artefacto NestJS compilado para reproducir el comportamiento real de producción.
