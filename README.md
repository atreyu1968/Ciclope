# CÍCLOPE FP

Aplicación fullstack para la coordinación de las cuatro Redes de Enseñanzas Profesionales en centros de Formación Profesional de Canarias.

CÍCLOPE está diseñado para reducir trabajo administrativo: el profesorado registra la información una sola vez y la aplicación la reutiliza en validación, evidencias, comunicaciones, planificación, indicadores, informes y memoria.

## Redes operativas

- Innovación.
- Emprendimiento.
- Información y Orientación Profesional.
- Calidad.

## Arquitectura

- Frontend: Next.js + TypeScript.
- Backend: NestJS + TypeScript.
- Base de datos: PostgreSQL.
- ORM: Prisma.
- Producción: Ubuntu + Node.js 24 + PostgreSQL + Nginx + systemd.
- Despliegue nativo, sin Docker.

La arquitectura detallada se encuentra en `docs/ARCHITECTURE.md`.

## Funcionalidades principales

- autenticación, sesiones, recuperación de contraseña, roles y auditoría;
- cursos académicos con histórico, cierre y rollover;
- varias coordinaciones simultáneas por docente;
- gestión de familias profesionales, grupos, turnos y profesorado;
- alta, importación, edición, desactivación y exportación de profesorado;
- registro de actuaciones, borradores, edición, duplicado, corrección y reenvío;
- validación individual y múltiple con filtros e historial;
- evidencias por archivo y enlace;
- comunicaciones segmentadas, adjuntos, lectura, respuesta y plazos;
- buzón asíncrono entre profesorado y coordinaciones;
- correo transaccional mediante Resend, cola, deduplicación y reintentos;
- planes anuales por red, objetivos, tareas, responsables e hitos;
- calendario y panel «Mi hora de coordinación»;
- automatizaciones y resúmenes semanales;
- indicadores por red, familia, tipo y periodo;
- snapshots históricos e informe ejecutivo conjunto;
- exportaciones CSV, PDF/imprimible, DOCX y ODT;
- IA configurable para interpretación, memoria, comunicaciones, buzón y planificación;
- instalación, actualización, backup, restauración y healthcheck para Ubuntu.

## Requisitos de producción

Recomendado:

- Ubuntu 24.04 LTS o compatible;
- acceso `root` o `sudo`;
- conexión a Internet durante la instalación;
- al menos 2 CPU y 4 GB de RAM para una instalación de centro;
- DNS/dominio si se publicará en Internet.

El instalador instala y configura Node.js 24, PostgreSQL, Nginx y las dependencias necesarias.

## Instalación limpia en Ubuntu

Clona el repositorio en una carpeta temporal:

```bash
git clone https://github.com/atreyu1968/Ciclope.git
cd Ciclope
```

Si ya conoces la URL pública, ejecuta:

```bash
sudo env CICLOPE_PUBLIC_URL=https://ciclope.midominio.es bash scripts/install-ubuntu.sh
```

Para una instalación todavía sin dominio:

```bash
sudo bash scripts/install-ubuntu.sh
```

El instalador:

1. instala dependencias del sistema;
2. instala/fija Node.js 24 en `/usr/bin`;
3. inicia PostgreSQL;
4. crea el usuario de servicio `ciclope`;
5. crea la base y credenciales PostgreSQL;
6. genera secretos de sesión e integraciones;
7. clona una release en `/opt/ciclope-fp/releases`;
8. instala dependencias Node;
9. genera Prisma y aplica migraciones;
10. ejecuta el seed base;
11. compila API y frontend;
12. instala servicios systemd;
13. configura Nginx;
14. valida que los servicios fundamentales estén activos.

Rutas principales:

- aplicación activa: `/opt/ciclope-fp/current`;
- releases: `/opt/ciclope-fp/releases`;
- configuración: `/etc/ciclope-fp/ciclope.env`;
- datos y uploads: `/var/lib/ciclope-fp`;
- backups: `/var/lib/ciclope-fp/backups`.

## Primera configuración

Abre la aplicación en el navegador y completa el asistente inicial. Debes definir:

- centro y código del centro;
- primera cuenta administradora;
- correo;
- contraseña segura.

Una vez inicializada la instalación, el asistente queda bloqueado.

Después se recomienda, en este orden:

1. configurar familias y grupos;
2. crear/importar profesorado;
3. revisar el curso académico activo;
4. asignar coordinaciones;
5. configurar Resend;
6. configurar la API de IA, si se utilizará;
7. crear los planes de las redes.

## Integraciones

Las claves de Resend y de la API de IA se configuran en **Administración → Integraciones**. Se almacenan cifradas en PostgreSQL y nunca se devuelven al navegador.

La integración de IA espera una API compatible con Chat Completions. En informes se remite información agregada y se evita enviar al proveedor el listado nominal del profesorado.

Consulta `docs/INTEGRATIONS_RESEND_AI.md`.

## Publicación con dominio y HTTPS

Para Cloudflare Tunnel, dominio y HTTPS consulta:

`docs/DEPLOYMENT_UBUNTU_CLOUDFLARE.md`

La arquitectura recomendada mantiene Next.js, NestJS y PostgreSQL en el servidor y expone únicamente Nginx mediante el túnel.

## Comprobación de salud

```bash
sudo bash /opt/ciclope-fp/current/scripts/healthcheck.sh
```

Comprueba:

- `ciclope-api`;
- `ciclope-web`;
- Nginx;
- PostgreSQL;
- `http://127.0.0.1:4000/api/health`;
- frontend en `http://127.0.0.1:3000/`.

Diagnóstico adicional:

```bash
sudo systemctl status ciclope-api
sudo systemctl status ciclope-web
sudo systemctl status nginx
sudo systemctl status postgresql
sudo journalctl -u ciclope-api -n 200 --no-pager
sudo journalctl -u ciclope-web -n 200 --no-pager
```

## Actualización

Antes de una actualización manual importante conviene disponer además de una copia externa reciente.

La actualización normal se realiza con:

```bash
sudo bash /opt/ciclope-fp/current/scripts/update-ubuntu.sh
```

El actualizador:

1. crea una copia previa;
2. descarga una nueva release;
3. instala dependencias con Node.js 24 del sistema;
4. genera Prisma;
5. compila antes de modificar la base;
6. aplica migraciones;
7. conmuta el enlace `current`;
8. reinicia API y frontend;
9. ejecuta el healthcheck;
10. vuelve a la release anterior si el healthcheck falla;
11. elimina releases antiguas según la política de retención.

Para conservar más o menos releases:

```bash
sudo env CICLOPE_KEEP_RELEASES=5 bash /opt/ciclope-fp/current/scripts/update-ubuntu.sh
```

## Copias de seguridad

Copia manual:

```bash
sudo bash /opt/ciclope-fp/current/scripts/backup.sh
```

La copia se almacena bajo:

```text
/var/lib/ciclope-fp/backups/AAAAmmddHHMMSS/
```

Incluye al menos:

- volcado de PostgreSQL;
- uploads;
- manifiesto/configuración necesaria para identificar la copia.

No dependas únicamente de copias en el mismo disco del servidor. Replica periódicamente `/var/lib/ciclope-fp/backups` en un almacenamiento externo protegido.

## Restauración

Para restaurar una copia concreta:

```bash
sudo bash /opt/ciclope-fp/current/scripts/restore.sh \
  /var/lib/ciclope-fp/backups/AAAAmmddHHMMSS
```

La restauración detiene temporalmente API y frontend, recupera PostgreSQL y uploads y vuelve a iniciar los servicios.

Después ejecuta:

```bash
sudo bash /opt/ciclope-fp/current/scripts/healthcheck.sh
```

## Variables de entorno

El instalador crea `/etc/ciclope-fp/ciclope.env`. Entre las variables principales se encuentran:

- `DATABASE_URL`;
- `PORT`;
- `WEB_PORT`;
- `APP_BASE_URL`;
- `APP_TIME_ZONE`;
- `SESSION_SECRET`;
- `INTEGRATIONS_ENCRYPTION_KEY`;
- `UPLOAD_DIR`;
- parámetros de automatizaciones y recordatorios;
- límites de evidencias.

Resend y la API de IA se gestionan normalmente desde el panel de administración y no requieren editar manualmente este archivo.

## Desarrollo y pruebas

Instalación de dependencias:

```bash
npm install
```

Pruebas principales:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:volume
npm run build
```

GitHub Actions mantiene dos capas de aceptación:

- **CI**: auditoría, Prisma, unitarios, autorización, integración, build, E2E y volumen;
- **Ubuntu operational smoke**: instalación nativa, actualización preservando datos y backup/restauración.

## Calidad del candidato v1

El E2E se ejecuta contra la API NestJS compilada, no contra un servidor de prueba simplificado. El transporte Resend se simula de forma aislada durante el test para verificar cola, entrega, cabeceras de autorización e idempotencia sin enviar correo real.

La prueba de volumen utiliza un curso representativo con 1.200 actuaciones validadas, 80 docentes simulados, cuatro redes y 840 evidencias.

El estado detallado de aceptación se mantiene en:

- `docs/ROADMAP_V1.md`;
- `docs/ACEPTACION_PRODUCCION_V1.md`;
- `CHANGELOG.md`.

## Manuales

- Administración: `docs/MANUAL_ADMINISTRADOR.md`.
- Coordinación: `docs/MANUAL_COORDINADOR.md`.
- Profesorado: `docs/GUIA_RAPIDA_PROFESORADO.md`.

## Seguridad operativa

- Utiliza HTTPS en producción.
- No compartas cuentas administrativas.
- No almacenes API Keys en documentación o incidencias.
- Mantén el servidor actualizado.
- Revisa periódicamente backups y restauración.
- Conserva copias externas.
- Revisa los logs ante cualquier fallo de healthcheck.

## Estado de versión

`main` es actualmente el candidato a la primera versión estable. La etiqueta `v1.0.0` solo se creará cuando el checklist técnico de producción esté completamente validado.
