# CÍCLOPE FP — Manual del administrador

## 1. Finalidad

Este manual está dirigido a la persona administradora de CÍCLOPE FP en el centro educativo. Su objetivo es dejar la aplicación preparada para el trabajo ordinario del profesorado y de las coordinaciones, mantener la estructura académica de cada curso y resolver las operaciones habituales sin intervención técnica.

CÍCLOPE está diseñado para que la información se registre una sola vez y pueda reutilizarse posteriormente en actuaciones, validaciones, planificación, comunicaciones, indicadores, informes y memoria.

## 2. Primer acceso

Tras una instalación nueva, accede a la aplicación desde el dominio o dirección configurada y completa el asistente de **Configuración inicial**.

Debes indicar:

- nombre del centro;
- código del centro;
- nombre y apellidos de la primera persona administradora;
- correo electrónico;
- contraseña inicial segura.

La contraseña debe tener al menos 12 caracteres e incluir mayúsculas, minúsculas y números.

Una vez creada la instalación, el asistente queda bloqueado y no puede volver a utilizarse para crear otro administrador inicial.

## 3. Panel de Administración

El menú **Administración** centraliza las tareas de configuración del centro. Las áreas principales son:

- Profesorado de FP;
- Estructura académica;
- Cursos y coordinaciones;
- Redes;
- Integraciones;
- Auditoría.

## 4. Profesorado

### 4.1 Alta manual

En **Administración → Profesorado** puedes crear una cuenta indicando nombre, apellidos y correo electrónico.

La contraseña temporal puede introducirse manualmente o generarse automáticamente. Se muestra una sola vez y el usuario deberá cambiarla en el primer acceso cuando así lo indique el sistema.

### 4.2 Edición de ficha

Cada ficha permite modificar:

- nombre y apellidos;
- correo electrónico;
- turno;
- familias profesionales;
- estado activo/inactivo.

Las coordinaciones no se asignan desde la ficha personal: se vinculan siempre a un curso académico para conservar correctamente el histórico.

### 4.3 Desactivación

Desactivar una cuenta no borra su información histórica. La persona deja de poder iniciar sesión y se revocan sus sesiones, pero permanecen las actuaciones, relaciones históricas y registros necesarios para informes y trazabilidad.

### 4.4 Restablecimiento de contraseña

La administración puede generar una nueva contraseña temporal. La operación revoca las sesiones previas y obliga al usuario a volver a autenticarse.

### 4.5 Importación y exportación

CÍCLOPE permite:

- exportar el directorio de profesorado a CSV;
- descargar una plantilla de importación;
- previsualizar una importación antes de aplicarla;
- distinguir altas, actualizaciones y errores;
- crear nuevas familias profesionales detectadas en el fichero cuando proceda.

No confirmes una importación mientras la previsualización muestre errores.

## 5. Estructura académica

En **Administración → Estructura** se gestionan las familias profesionales y los grupos del curso activo.

Para cada grupo pueden definirse los datos académicos utilizados posteriormente en actuaciones y estadísticas. Conviene revisar esta sección al comienzo de cada curso antes de abrir el registro de actividad al profesorado.

## 6. Cursos académicos

CÍCLOPE conserva el histórico por curso. Solo puede existir un curso activo por centro.

### 6.1 Crear un curso

Indica:

- nombre, por ejemplo `2026-2027`;
- fecha de inicio;
- fecha de finalización.

La creación no implica necesariamente su activación inmediata.

### 6.2 Coordinaciones

Las coordinaciones se asignan dentro de un curso académico. Una misma persona puede coordinar dos o más redes y también ejercer la coordinación general CÍCLOPE.

Antes de activar un curso, CÍCLOPE comprueba la configuración mínima necesaria. El objetivo es evitar comenzar un curso sin responsables definidos.

### 6.3 Cierre de curso

Antes de cerrar, utiliza la comprobación de cierre. El sistema revisa bloqueos como actuaciones pendientes y comunicaciones todavía en borrador.

El cierre conserva todos los datos y deja el curso disponible para consultas e informes históricos.

### 6.4 Preparar el curso siguiente

La operación de rollover permite crear el siguiente curso reutilizando, cuando se seleccione:

- grupos;
- coordinaciones por red;
- coordinación CÍCLOPE.

No se copian las actuaciones ni las comunicaciones del curso anterior.

## 7. Configuración de las cuatro redes

En **Administración → Redes** pueden personalizarse la descripción institucional y las líneas u objetivos de referencia de:

- Innovación;
- Emprendimiento;
- Información y Orientación Profesional;
- Calidad.

Estos textos sirven de marco para el trabajo de coordinación, pero no sustituyen los objetivos operativos de cada plan anual.

## 8. Resend

La configuración de correo se realiza en **Administración → Integraciones**.

Debes proporcionar:

- activación de Resend;
- nombre del remitente;
- correo remitente autorizado;
- API Key de Resend.

La clave se cifra antes de almacenarse y no vuelve a mostrarse en el navegador.

Utiliza **Enviar prueba** antes de comenzar los envíos reales. El dominio del remitente debe estar previamente autorizado en Resend.

La documentación técnica ampliada está en `docs/INTEGRATIONS_RESEND_AI.md`.

## 9. API de inteligencia artificial

CÍCLOPE admite un proveedor compatible con Chat Completions. La administración configura:

- nombre del proveedor;
- URL base;
- modelo;
- API Key;
- activación/desactivación.

La clave se almacena cifrada. Antes de utilizar la IA en producción, ejecuta **Probar conexión**.

Las funciones de IA generan propuestas que requieren revisión humana. En los informes se envía información agregada y se evita remitir el listado nominal del profesorado.

## 10. Auditoría

**Administración → Auditoría** muestra operaciones sensibles como altas, modificaciones de cuentas, restablecimientos de contraseña e importaciones. Los registros son de consulta y no se editan desde la interfaz.

## 11. Seguridad operativa

Recomendaciones:

1. Mantener el servidor Ubuntu actualizado.
2. No compartir la cuenta administradora.
3. Utilizar HTTPS en producción.
4. No copiar API Keys en correos, documentos o incidencias.
5. Mantener copias de seguridad periódicas.
6. Revisar los servicios tras cada actualización con `scripts/healthcheck.sh`.
7. Conservar varias copias de seguridad fuera del propio servidor.

## 12. Copias de seguridad y restauración

Para crear una copia manual:

```bash
sudo /opt/ciclope-fp/current/scripts/backup.sh
```

Las copias incluyen PostgreSQL, ficheros subidos y configuración operativa necesaria para identificar la instalación.

Para restaurar una copia concreta:

```bash
sudo /opt/ciclope-fp/current/scripts/restore.sh /var/lib/ciclope-fp/backups/AAAAmmddHHMMSS
```

La restauración detiene temporalmente API y frontend, restaura base de datos y ficheros y vuelve a iniciar los servicios.

## 13. Actualización

Ejecuta:

```bash
sudo /opt/ciclope-fp/current/scripts/update-ubuntu.sh
```

La actualización crea una copia previa, descarga una nueva release, instala dependencias, aplica migraciones, compila y ejecuta el healthcheck. Si la comprobación falla, el script intenta volver a la release anterior.

## 14. Diagnóstico rápido

```bash
sudo systemctl status ciclope-api
sudo systemctl status ciclope-web
sudo systemctl status nginx
sudo systemctl status postgresql
sudo /opt/ciclope-fp/current/scripts/healthcheck.sh
```

Logs de la API y frontend:

```bash
sudo journalctl -u ciclope-api -n 200 --no-pager
sudo journalctl -u ciclope-web -n 200 --no-pager
```

## 15. Rutina recomendada al inicio de curso

1. Crear o preparar el nuevo curso.
2. Revisar familias profesionales y grupos.
3. Revisar el directorio de profesorado.
4. Asignar coordinaciones de las cuatro redes y CÍCLOPE.
5. Activar el curso.
6. Comprobar Resend.
7. Comprobar la API de IA si se utilizará.
8. Pedir a las coordinaciones que creen o revisen sus planes anuales.
9. Realizar una actuación de prueba y validar el circuito.
10. Crear una copia de seguridad inicial.
