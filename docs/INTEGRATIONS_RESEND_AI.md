# Integraciones de CÍCLOPE FP: Resend e IA

CÍCLOPE permite configurar desde **Administración → Integraciones** dos servicios externos opcionales:

- Resend, para el correo transaccional y los avisos automáticos;
- un proveedor de IA con una API compatible con el esquema de **Chat Completions** utilizado por CÍCLOPE.

Las dos integraciones son configurables por centro. Las claves se cifran antes de almacenarse en PostgreSQL con `INTEGRATIONS_ENCRYPTION_KEY` y nunca vuelven a mostrarse en el navegador.

---

## 1. Resend

### Para qué se utiliza

Cuando Resend está activo, CÍCLOPE puede enviar:

- comunicaciones publicadas al profesorado;
- avisos de validación o devolución de actuaciones;
- respuestas y actualizaciones del buzón;
- recuperación de contraseña;
- recordatorios de tareas;
- recordatorios de hitos;
- recordatorios de comunicaciones pendientes;
- resumen semanal de coordinación;
- pruebas de correo desde Administración.

CÍCLOPE mantiene una cola de correo con reintentos y deduplicación. Los errores agotados pueden consultarse desde coordinación y reintentarse manualmente.

### Datos que debe preparar el administrador

En la cuenta de Resend:

1. crea o selecciona el dominio que utilizará el centro;
2. completa la verificación DNS requerida por Resend;
3. crea una API Key con los permisos necesarios para enviar correo;
4. decide el remitente, por ejemplo `ciclope@midominio.es`.

El dominio del correo remitente debe estar autorizado por el proveedor.

### Configuración en CÍCLOPE

En **Administración → Integraciones → Resend** completa:

- **Activar envíos por Resend**;
- **Nombre del remitente**: por ejemplo, `CÍCLOPE FP`;
- **Correo remitente**;
- **API Key**.

Pulsa **Guardar Resend**.

La API Key queda cifrada. Cuando vuelvas a la pantalla el campo aparecerá vacío; dejarlo vacío conserva la clave existente.

### Prueba

Después de guardar, pulsa **Enviar prueba**.

La prueba se envía a la cuenta del administrador que está realizando la comprobación. Si funciona, la interfaz mostrará la confirmación correspondiente.

### Recomendaciones

- utiliza una cuenta o subdominio institucional para el correo;
- no reutilices una API Key personal para otros servicios;
- rota la clave si existe sospecha de exposición;
- no guardes claves en README, incidencias, capturas, repositorios o documentos compartidos;
- revisa periódicamente **Coordinación → Comunicaciones** para detectar entregas fallidas;
- mantén correctamente configurado `APP_BASE_URL`, porque los enlaces de los correos se generan a partir de esa URL.

### Plantilla de correo

CÍCLOPE envía una versión de texto y una versión HTML institucional del mismo mensaje. La plantilla HTML incorpora:

- cabecera CÍCLOPE FP;
- asunto visible;
- cuerpo estructurado;
- pie institucional;
- compatibilidad con clientes que solo acepten texto.

---

## 2. Integración de IA

### Compatibilidad técnica

La integración espera un proveedor que acepte:

```text
POST <URL_BASE>/chat/completions
Authorization: Bearer <API_KEY>
Content-Type: application/json
```

y que devuelva el contenido principal en una estructura equivalente a:

```text
choices[0].message.content
```

Por tanto, el proveedor elegido debe ofrecer una interfaz compatible con este contrato.

CÍCLOPE no presupone un proveedor concreto: el administrador configura:

- nombre del proveedor;
- URL base;
- nombre del modelo;
- API Key.

### Configuración

En **Administración → Integraciones → API de IA**:

1. activa **Asistencia de IA**;
2. introduce un nombre identificativo para el proveedor;
3. introduce la URL base de la API, sin añadir manualmente `/chat/completions`;
4. escribe el identificador exacto del modelo;
5. introduce la API Key;
6. guarda la configuración;
7. pulsa **Probar conexión**.

La aplicación realiza una petición mínima y comprueba que el proveedor devuelve texto interpretable.

### Funciones que utilizan IA

CÍCLOPE utiliza la integración, cuando el usuario lo solicita expresamente, para:

- interpretar informes;
- redactar borradores de memoria;
- proponer borradores de comunicaciones;
- resumir el buzón de coordinación;
- proponer objetivos y tareas a partir de un plan anual.

La IA no valida actuaciones, no publica comunicaciones, no responde al profesorado y no modifica planes de forma autónoma.

### Revisión humana obligatoria

Todo contenido generado por IA aparece como **borrador** o **propuesta** y muestra un aviso de revisión humana.

La coordinación debe comprobar especialmente:

- fechas;
- cifras;
- nombres de redes y colectivos;
- referencias normativas;
- compromisos o instrucciones;
- interpretaciones causales;
- conclusiones que no estén respaldadas por los datos.

La publicación, guardado oficial o aplicación del texto siempre requiere una acción posterior de una persona.

---

## 3. Privacidad y minimización de datos

### Informes y memorias

Para interpretar informes o redactar memorias, CÍCLOPE construye un payload agregado. No envía al proveedor el listado nominal del profesorado utilizado internamente para calcular indicadores.

El payload puede contener, según el informe:

- número de actuaciones;
- participaciones declaradas;
- evidencias;
- distribución por red, familia, tipo o mes;
- avance de planes;
- tareas pendientes;
- alertas agregadas;
- comparativas temporales.

### Resumen del buzón

Para el resumen asistido del buzón, CÍCLOPE prepara un contexto que excluye nombres y direcciones de correo. Puede incluir:

- categoría;
- asunto;
- estado;
- fecha de actualización;
- red o redes relacionadas;
- texto del último mensaje.

El contenido escrito por una persona puede contener por sí mismo información identificativa. Por ello, antes de activar esta función el centro debe valorar las condiciones de tratamiento de datos del proveedor contratado.

### Comunicaciones

Cuando se solicita un borrador de comunicación, se envía únicamente el contexto introducido en el asistente y, cuando procede, el título/cuerpo que el coordinador ha decidido incluir.

### Planificación

Para proponer objetivos y tareas, se envían datos funcionales del plan:

- red;
- título y resumen;
- estado;
- objetivos existentes;
- métricas y metas;
- tareas existentes;
- fechas y relaciones con objetivos.

No se envía al proveedor el nombre del responsable de cada tarea.

---

## 4. Seguridad de las claves

Las claves de Resend e IA:

- se reciben únicamente por endpoints administrativos;
- se cifran con AES-256-GCM antes de persistirse;
- utilizan una clave derivada de `INTEGRATIONS_ENCRYPTION_KEY`;
- no se devuelven a la interfaz;
- no se incluyen en auditoría;
- no deben incluirse en logs.

El fichero de producción:

```text
/etc/ciclope-fp/ciclope.env
```

contiene `INTEGRATIONS_ENCRYPTION_KEY` y debe tener acceso restringido.

Las copias de seguridad incluyen una copia protegida de este fichero para que las integraciones cifradas sigan siendo recuperables tras una restauración.

---

## 5. Límites y manejo de errores de IA

CÍCLOPE aplica actualmente:

- máximo aproximado de 100.000 caracteres de entrada por solicitud;
- timeout de 30 segundos;
- límite de salida solicitado al proveedor;
- límite defensivo del texto que acepta como respuesta;
- validación de que la respuesta contiene texto interpretable;
- mensajes controlados ante error HTTP, timeout o fallo de conexión.

Un error del proveedor no modifica el plan, el informe, la comunicación ni el buzón.

---

## 6. Auditoría del uso de IA

Cada uso de una función asistida queda registrado en la auditoría con:

- función utilizada;
- usuario que la solicitó;
- fecha/hora;
- si tuvo éxito;
- tamaño aproximado de entrada y salida;
- tipo de error cuando falla.

Para reducir la exposición de información, el registro de auditoría **no guarda el prompt completo ni la respuesta generada**.

---

## 7. Criterio para autorizar un proveedor de IA

Antes de habilitar un proveedor en un centro, conviene comprobar:

1. contrato y condiciones de tratamiento de datos;
2. ubicación y régimen de tratamiento aplicable;
3. política de conservación de entradas y salidas;
4. uso o no de los datos para entrenamiento;
5. posibilidad de desactivar retención cuando el proveedor lo permita;
6. medidas de seguridad y control de acceso;
7. procedimiento de borrado;
8. canal de soporte e incidencias;
9. límites de uso y coste;
10. compatibilidad técnica con el endpoint requerido por CÍCLOPE.

La decisión sobre el proveedor corresponde al centro u organización responsable del tratamiento y debe ajustarse a sus instrucciones y normativa aplicable.

---

## 8. Diagnóstico

### Resend indica “no configurado”

Comprueba que:

- la integración está activada;
- existe una API Key guardada;
- el remitente es un correo válido;
- el dominio está autorizado por Resend.

### La prueba de correo falla

Revisa:

- API Key;
- dominio/remitente;
- conectividad saliente HTTPS;
- mensaje de error que muestra CÍCLOPE;
- estado de la integración en Resend.

### La IA indica “no configurada”

Comprueba que están guardados y activados:

- proveedor;
- URL base;
- modelo;
- API Key.

### La prueba de IA devuelve 404

La URL base debe representar la raíz de la API compatible. CÍCLOPE añade `/chat/completions` automáticamente.

### La prueba de IA agota el tiempo

Comprueba:

- conectividad;
- disponibilidad del proveedor;
- modelo configurado;
- límites de la cuenta;
- proxy/firewall de salida.

CÍCLOPE cancela la petición cuando supera el timeout para evitar dejar acciones bloqueadas indefinidamente.
