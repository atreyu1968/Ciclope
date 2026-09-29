# Despliegue de CÍCLOPE FP en Ubuntu con dominio, HTTPS y Cloudflare Tunnel

Este procedimiento describe el despliegue de producción recomendado para CÍCLOPE FP **sin Docker**, utilizando los componentes ya incluidos en el repositorio:

- Ubuntu Server;
- Node.js 24;
- PostgreSQL;
- Nginx;
- servicios `systemd` para frontend y API;
- Cloudflare Tunnel para publicar la aplicación por HTTPS sin exponer PostgreSQL, Node.js ni los puertos internos.

## 1. Topología recomendada

```text
Internet
   │
   │ HTTPS
   ▼
Cloudflare
   │
   │ Cloudflare Tunnel (conexiones salientes)
   ▼
cloudflared (Ubuntu)
   │
   │ HTTP local
   ▼
Nginx :80
   ├── /       → Next.js 127.0.0.1:3000
   └── /api/   → NestJS  127.0.0.1:4000
                     │
                     ▼
             PostgreSQL 127.0.0.1:5432
```

La API ya escucha únicamente en `127.0.0.1:4000`. El frontend se inicia igualmente en `127.0.0.1:3000`. PostgreSQL debe permanecer accesible solo desde el servidor.

Con Cloudflare Tunnel no es necesario abrir al exterior los puertos 3000, 4000 ni 5432. El túnel establece conexiones salientes hacia Cloudflare.

## 2. Requisitos previos

Antes de comenzar:

1. disponer de un servidor Ubuntu actualizado con acceso de administrador;
2. disponer de un dominio gestionado por Cloudflare;
3. elegir el nombre público, por ejemplo `ciclope.midominio.es`;
4. comprobar que el servidor tiene salida a Internet;
5. si existe un firewall restrictivo de salida, permitir las conexiones que requiere `cloudflared`, actualmente el puerto 7844 TCP/UDP según la documentación oficial de Cloudflare.

Documentación oficial de referencia:

- https://developers.cloudflare.com/tunnel/get-started/
- https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/create-local-tunnel/
- https://developers.cloudflare.com/tunnel/features/locally-managed-tunnels/as-a-service/linux/

## 3. Instalación base de CÍCLOPE

El repositorio contiene `scripts/install-ubuntu.sh`. El instalador:

- instala Nginx, PostgreSQL, Git y Node.js 24;
- crea el usuario de sistema `ciclope`;
- crea la base de datos y genera una contraseña aleatoria;
- genera `SESSION_SECRET` e `INTEGRATIONS_ENCRYPTION_KEY`;
- ejecuta migraciones y datos iniciales;
- compila frontend y backend;
- instala los servicios `ciclope-api` y `ciclope-web`;
- configura Nginx.

Si ya se conoce la URL pública, es preferible indicarla durante la instalación:

```bash
sudo env CICLOPE_PUBLIC_URL="https://ciclope.midominio.es" bash scripts/install-ubuntu.sh
```

Si el instalador se ejecuta sin esa variable, utilizará temporalmente `http://localhost`.

La configuración persistente queda en:

```text
/etc/ciclope-fp/ciclope.env
```

Los datos persistentes se almacenan bajo:

```text
/var/lib/ciclope-fp/
```

y el código desplegado bajo:

```text
/opt/ciclope-fp/
```

## 4. Ajustar la URL pública

Comprueba el valor:

```bash
sudo grep '^APP_BASE_URL=' /etc/ciclope-fp/ciclope.env
```

Debe coincidir exactamente con el origen HTTPS que utilizarán los usuarios:

```text
APP_BASE_URL=https://ciclope.midominio.es
```

Si necesitas modificarlo:

```bash
sudo nano /etc/ciclope-fp/ciclope.env
sudo systemctl restart ciclope-api ciclope-web
```

Este valor es importante porque CÍCLOPE lo utiliza para generar enlaces de recuperación de contraseña, avisos, buzón y otras notificaciones.

No cambies ni publiques los valores de `DATABASE_URL`, `SESSION_SECRET` o `INTEGRATIONS_ENCRYPTION_KEY`.

## 5. Comprobar el origen antes de publicar

Antes de crear el túnel:

```bash
sudo systemctl status ciclope-api ciclope-web nginx --no-pager
curl -fsS http://127.0.0.1/api/health
curl -I http://127.0.0.1/
sudo nginx -t
```

Los puertos internos pueden comprobarse con:

```bash
sudo ss -lntp | grep -E ':(80|3000|4000|5432)\b'
```

La API, el frontend y PostgreSQL no deben quedar escuchando públicamente.

## 6. Instalar cloudflared

Cloudflare mantiene un repositorio APT para Debian/Ubuntu. El procedimiento oficial actual es:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null

echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list

sudo apt-get update
sudo apt-get install -y cloudflared
cloudflared --version
```

## 7. Crear un túnel administrado desde Cloudflare

Para una instalación de centro, el método recomendado es administrar el túnel desde el panel de Cloudflare:

1. entra en Cloudflare;
2. abre **Networking → Tunnels**;
3. crea un túnel, por ejemplo `ciclope-produccion`;
4. selecciona Linux como conector;
5. copia el comando de instalación que proporciona Cloudflare;
6. en el servidor ejecuta el comando mostrado, que tendrá esta forma:

```bash
sudo cloudflared service install <TUNNEL_TOKEN>
```

El token es un secreto de infraestructura. No debe copiarse al repositorio, documentación compartida ni capturas.

Comprueba el servicio:

```bash
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
```

## 8. Publicar el hostname

Dentro del túnel añade una aplicación/hostname público:

```text
Hostname: ciclope.midominio.es
Service:  http://127.0.0.1:80
```

CÍCLOPE debe publicarse a través de **Nginx**, no apuntando directamente a 3000 o 4000. De esta forma se conserva un único origen local, el límite de subida y las cabeceras configuradas en `deploy/nginx/ciclope.conf`.

Cloudflare gestiona el acceso HTTPS del usuario al hostname público. La comunicación del conector con el origen se mantiene dentro del túnel.

## 9. Firewall

Con una publicación exclusivamente mediante Cloudflare Tunnel, el servidor no necesita aceptar tráfico web entrante desde Internet.

Si se utiliza UFW y la administración se realiza por SSH, revisa cuidadosamente la conectividad antes de activarlo. Un ejemplo típico es:

```bash
sudo ufw allow OpenSSH
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw enable
```

No abras al exterior:

- `3000/tcp`;
- `4000/tcp`;
- `5432/tcp`.

Si necesitas que Nginx siga siendo accesible desde una LAN de gestión, añade únicamente la regla correspondiente a esa red privada.

## 10. Verificación desde Internet

Una vez conectado el túnel:

```bash
curl -I https://ciclope.midominio.es/
curl -fsS https://ciclope.midominio.es/api/health
```

Comprueba además desde un navegador:

1. carga de la pantalla inicial;
2. creación/configuración inicial si es una instalación nueva;
3. inicio y cierre de sesión;
4. persistencia de la sesión tras recargar;
5. cambio de contraseña;
6. acceso a un recurso protegido;
7. subida de una evidencia pequeña;
8. Administración → Integraciones → prueba de Resend;
9. Administración → Integraciones → prueba de IA, si se va a utilizar;
10. recepción de un correo y comprobación de que sus enlaces comienzan por `https://ciclope.midominio.es`.

## 11. Nginx y tamaños de evidencias

La configuración incluida en el repositorio establece:

```nginx
client_max_body_size 25M;
```

y CÍCLOPE utiliza por defecto:

```text
EVIDENCE_MAX_MB=25
```

Si se aumenta el límite de evidencias, modifica ambos valores de forma coherente y recarga Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart ciclope-api
```

## 12. Actualizar cloudflared

Si se instaló desde APT:

```bash
sudo apt-get update
sudo apt-get install --only-upgrade cloudflared
sudo systemctl restart cloudflared
```

Comprueba después:

```bash
sudo systemctl is-active cloudflared
curl -fsS https://ciclope.midominio.es/api/health
```

## 13. Copias de seguridad antes de cambios

Antes de una actualización importante:

```bash
cd /opt/ciclope-fp/current
sudo bash scripts/backup.sh
```

La copia incluye PostgreSQL, evidencias subidas y una copia protegida del fichero de configuración.

Por defecto las copias quedan en:

```text
/var/lib/ciclope-fp/backups/
```

Para restaurar una copia concreta:

```bash
cd /opt/ciclope-fp/current
sudo bash scripts/restore.sh /var/lib/ciclope-fp/backups/AAAAMMDD-HHMMSS
```

La copia del fichero `ciclope.env` contiene secretos y debe tratarse como información sensible.

## 14. Diagnóstico rápido

### La web pública devuelve 502

```bash
sudo systemctl status cloudflared nginx ciclope-web ciclope-api --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
sudo journalctl -u ciclope-web -n 100 --no-pager
sudo journalctl -u ciclope-api -n 100 --no-pager
curl -I http://127.0.0.1/
curl -fsS http://127.0.0.1/api/health
```

Si el origen local funciona pero el hostname público no, revisa el túnel y su hostname. Si el origen local tampoco funciona, revisa Nginx y los servicios de CÍCLOPE.

### Los enlaces de los correos apuntan a localhost

Corrige `APP_BASE_URL` en `/etc/ciclope-fp/ciclope.env` y reinicia API y frontend.

### cloudflared no arranca

```bash
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 200 --no-pager
```

Si el servicio se instaló mediante token desde el panel, vuelve al túnel en Cloudflare y comprueba que el conector aparece activo.

## 15. Criterio de despliegue correcto

El despliegue se considera operativo cuando:

- `ciclope-api`, `ciclope-web`, Nginx y `cloudflared` están activos;
- `/api/health` responde tanto localmente como mediante HTTPS;
- el navegador no muestra errores de certificado;
- los puertos 3000, 4000 y 5432 no están expuestos a Internet;
- `APP_BASE_URL` coincide con la URL pública HTTPS;
- las sesiones funcionan correctamente;
- Resend e IA, si se habilitan, superan sus pruebas desde Administración;
- se ha creado al menos una copia de seguridad y se conoce el procedimiento de restauración.

