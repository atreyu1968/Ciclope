# CÍCLOPE FP — Checklist maestro para versión plenamente funcional

> Documento vivo. Solo se marca una tarea como **[x]** cuando está implementada en `main` y, cuando procede, validada por CI.
>
> Estados auxiliares usados durante el desarrollo: **EN CURSO** y **BLOQUEADO**.

## 1. Base técnica y despliegue

- [x] Monorepo TypeScript con frontend Next.js y backend NestJS.
- [x] PostgreSQL + Prisma y migraciones versionadas.
- [x] Ejecución nativa en Ubuntu, sin Docker.
- [x] Servicios systemd para API y frontend.
- [x] Proxy Nginx para aplicación y API.
- [x] Instalador automatizado para Ubuntu.
- [x] Variables de entorno y generación de secretos.
- [x] Endpoint de salud de la API.
- [x] CI de compilación y comprobaciones básicas.
- [x] Script de actualización segura de una instalación existente.
- [x] Copia de seguridad automática de PostgreSQL y ficheros.
- [x] Procedimiento automatizado de restauración.
- [x] Rotación/limpieza de releases y backups antiguos.
- [x] Comprobación postinstalación que valida servicios, web y API; pendiente ampliar la prueba profunda de BD/escritura en la fase de tests.
- [ ] Documentar despliegue con dominio/HTTPS y Cloudflare Tunnel.

## 2. Puesta en marcha, autenticación y seguridad

- [x] Configuración inicial del centro.
- [x] Creación del administrador inicial.
- [x] Inicio de sesión y sesiones persistentes.
- [x] Roles y autorización en backend.
- [x] Restricción de endpoints administrativos por rol.
- [x] Cifrado de secretos de integraciones.
- [x] Cambio de contraseña desde la cuenta.
- [x] Recuperación/restablecimiento de contraseña.
- [x] Forzar cambio de contraseña temporal cuando corresponda.
- [x] Cierre de sesión explícito desde la interfaz.
- [x] Gestión administrativa de activación/desactivación de usuarios.
- [x] Registro de auditoría de operaciones sensibles.
- [ ] Rate limiting básico en login y endpoints públicos.
- [x] Revisión de cabeceras HTTP de seguridad y política de cookies.
- [ ] Validación final de permisos de todos los roles.

## 3. Cursos académicos y coordinaciones

- [x] Cursos académicos persistentes.
- [x] Curso activo por centro.
- [x] Histórico de cursos.
- [x] Coordinadores vinculados a un curso académico.
- [x] Varias coordinaciones simultáneas por docente.
- [x] Coordinación general CÍCLOPE y coordinaciones por red.
- [x] Curso activo visible dinámicamente en sesión/cabecera.
- [x] Cierre de curso guiado.
- [x] Apertura de nuevo curso copiando estructura reutilizable sin copiar actuaciones.
- [x] Vista histórica de coordinaciones por curso.
- [x] Protección contra dejar un curso sin configuración mínima necesaria.

## 4. Estructura FP y profesorado

- [x] Familias profesionales.
- [x] Grupos docentes.
- [x] Profesorado vinculado al centro.
- [x] Asociación profesorado-familias.
- [x] Turnos.
- [x] Alta manual de profesorado.
- [x] Importación masiva de profesorado.
- [x] Edición completa de ficha de profesor.
- [x] Desactivación/reactivación sin pérdida de histórico.
- [ ] Exportación del profesorado.
- [ ] Informe de errores y previsualización antes de una importación masiva.
- [ ] Gestión de duplicados en importación.

## 5. Las cuatro redes

- [x] Innovación.
- [x] Emprendimiento.
- [x] Información y Orientación Profesional.
- [x] Calidad.
- [x] Formularios con datos específicos por red.
- [x] Coordinadores independientes por red.
- [x] Indicadores diferenciados por red.
- [x] Plan anual independiente por red.
- [ ] Panel comparativo transversal de las cuatro redes.
- [ ] Configuración administrativa de textos/objetivos institucionales sin modificar código.

## 6. Registro de actuaciones por el profesorado

- [x] Formulario de nueva actuación.
- [x] Selección de una o varias redes.
- [x] Asociación con grupos.
- [x] Fecha, duración, participantes y datos descriptivos.
- [x] Datos específicos según la red.
- [x] Identificación del docente remitente.
- [x] Estado pendiente de validación.
- [x] Mis actuaciones.
- [x] Corrección y reenvío de actuaciones devueltas.
- [ ] Guardado como borrador por el docente.
- [ ] Edición antes de validación.
- [ ] Duplicar una actuación recurrente.
- [ ] Formulario optimizado para móvil.
- [ ] Confirmación clara y número/referencia tras registrar.

## 7. Validación por coordinación

- [x] Bandeja de actuaciones.
- [x] Validación.
- [x] Devolución para corrección con motivo.
- [x] Reenvío posterior por el profesor.
- [x] Notificación por correo al validar/devolver.
- [ ] Validación múltiple desde la bandeja.
- [ ] Filtros avanzados por red, fecha, familia, docente y estado.
- [ ] Historial visible de cambios de estado.
- [ ] Avisos de actuaciones pendientes demasiado tiempo.

## 8. Evidencias

- [x] Evidencias mediante enlace.
- [x] Evidencias mediante archivo.
- [x] Asociación a actuación.
- [x] Metadatos de fichero.
- [ ] Descarga segura de evidencias desde interfaz.
- [ ] Eliminación controlada antes de cerrar/validar.
- [ ] Límites configurables de tamaño y tipos de archivo.
- [ ] Previsualización cuando el formato lo permita.
- [ ] Comprobación de ficheros huérfanos.

## 9. Comunicación con todo el claustro FP

- [x] Comunicaciones internas.
- [x] Segmentación de destinatarios.
- [x] Estado leído/no leído.
- [x] Solicitud de respuesta.
- [x] Fecha límite.
- [x] Respuesta del destinatario.
- [x] Buzón del profesorado.
- [x] Conversación/respuestas del buzón.
- [x] Resend integrado.
- [x] Configuración de Resend desde administración.
- [x] Correo de prueba.
- [x] Cola de correo con reintentos.
- [x] Deduplicación de envíos.
- [ ] Plantillas institucionales HTML para correo.
- [ ] Vista de entregas/fallos de correo para coordinación.
- [ ] Reenvío manual de mensajes fallidos.
- [ ] Adjuntos en comunicaciones cuando sean necesarios.
- [ ] Preferencias básicas de notificación por usuario.

## 10. Planificación y «mi hora de coordinación»

- [x] Dashboard de coordinación.
- [x] Plan anual por red.
- [x] Objetivos.
- [x] Tareas.
- [x] Responsables.
- [x] Fechas límite.
- [x] Hitos oficiales.
- [x] Hitos comunes a las cuatro redes.
- [x] Progreso de objetivos.
- [x] Vinculación actuaciones-objetivos.
- [x] Recordatorios automáticos de plazos.
- [ ] Agenda priorizada de la hora semanal: qué hacer primero y por qué.
- [ ] Marcar/posponer tareas desde el propio dashboard.
- [ ] Resumen semanal automático para cada coordinador.
- [ ] Detección automática de redes/objetivos sin actividad reciente.
- [ ] Vista calendario de tareas e hitos.

## 11. Informes, indicadores y memoria

- [x] Resumen agregado.
- [x] Filtros por curso, red y periodo.
- [x] Indicadores por red.
- [x] Indicadores por familia, tipo y mes.
- [x] Seguimiento del plan.
- [x] Exportación CSV.
- [x] Vista imprimible/PDF.
- [x] Cortes/snapshots congelados.
- [x] Histórico de informes.
- [x] Estado guardado/presentado.
- [x] IA para interpretar datos.
- [x] IA para redactar borrador de memoria.
- [x] Datos enviados a IA limitados a información agregada.
- [ ] Editor del borrador de memoria antes de guardar/presentar.
- [ ] Guardar la versión IA como narrativa del snapshot.
- [ ] Exportación DOCX/ODT de memoria.
- [ ] Comparativa entre periodos del mismo curso.
- [ ] Comparativa interanual.
- [ ] Alertas automáticas por indicadores anómalos o incompletos.
- [ ] Informe ejecutivo conjunto de las cuatro redes.

## 12. IA

- [x] Configuración desde administración.
- [x] Clave cifrada.
- [x] Proveedor, URL base y modelo configurables.
- [x] Prueba de conexión.
- [x] Interpretación de informes.
- [x] Redacción de memoria.
- [ ] Asistente para redactar comunicaciones.
- [ ] Asistente para resumir el buzón y detectar asuntos pendientes.
- [ ] Asistente para proponer borradores de objetivos/tareas a partir del plan.
- [ ] Registro de cuándo se usó IA y sobre qué función.
- [ ] Límites de tamaño y manejo robusto de timeouts/errores.
- [ ] Aviso visible de que el texto generado requiere revisión humana.

## 13. Automatizaciones

- [x] Motor interno de automatizaciones.
- [x] Recordatorios de tareas próximas.
- [x] Recordatorios de comunicaciones pendientes.
- [x] Notificaciones del flujo de actuaciones.
- [ ] Resumen semanal de coordinación.
- [ ] Aviso de tareas vencidas.
- [ ] Aviso de hitos próximos.
- [ ] Aviso de comunicaciones sin respuesta tras el plazo.
- [ ] Panel de estado de automatizaciones y últimos envíos.

## 14. Administración y experiencia de usuario

- [x] Estética institucional común.
- [x] Cabecera dinámica.
- [x] Panel central `/admin`.
- [x] Accesos a profesorado, estructura, cursos e integraciones.
- [ ] Menú de navegación persistente según rol.
- [ ] Perfil del usuario.
- [ ] Página 403 amigable.
- [ ] Página 404 propia.
- [ ] Estados vacíos coherentes.
- [ ] Indicadores de carga en todas las acciones asíncronas.
- [ ] Confirmaciones para operaciones destructivas.
- [ ] Revisión responsive completa.
- [ ] Revisión de accesibilidad por teclado, etiquetas y contraste.
- [ ] Unificar mensajes de error y éxito.

## 15. Calidad y pruebas

- [x] CI de build en GitHub Actions.
- [ ] Tests unitarios de servicios críticos.
- [ ] Tests de autorización por rol.
- [ ] Tests de integración API + PostgreSQL.
- [ ] Tests E2E: configuración inicial → login → actuación → validación → informe.
- [ ] Tests E2E de comunicaciones/Resend con transporte simulado.
- [ ] Tests E2E de cierre/apertura de curso.
- [ ] Prueba de instalación limpia en Ubuntu.
- [ ] Prueba de actualización conservando datos.
- [ ] Prueba de backup y restauración.
- [ ] Prueba con datos de volumen razonable de un curso completo.
- [ ] Auditoría de dependencias y vulnerabilidades.
- [ ] Semáforo final sin errores críticos.

## 16. Documentación y entrega estable

- [x] README base.
- [x] Arquitectura documentada.
- [x] Instalador documentado de forma básica.
- [ ] README definitivo de instalación, actualización y recuperación.
- [ ] Manual del administrador.
- [ ] Manual del coordinador.
- [ ] Guía rápida para el profesorado.
- [ ] Documentar configuración de Resend.
- [ ] Documentar proveedores de IA compatibles y privacidad.
- [ ] Changelog.
- [ ] Etiqueta/release de GitHub para v1.0.0.
- [ ] Checklist de aceptación de producción firmado técnicamente.

## Criterio de «plenamente funcional»

CÍCLOPE alcanzará la primera versión plenamente funcional cuando los flujos esenciales puedan completarse sin intervención técnica: instalación, configuración inicial, gestión del curso y usuarios, registro y validación de actuaciones, evidencias, comunicaciones, planificación, automatizaciones, informes, cierre de curso, actualización y recuperación; y cuando dichos flujos estén cubiertos por pruebas y documentación suficiente.
