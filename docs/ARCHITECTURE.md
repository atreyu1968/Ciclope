# Arquitectura de CÍCLOPE FP

## Principios

1. El profesorado introduce la información en origen.
2. La coordinación supervisa y valida; no retranscribe.
3. Una actuación puede pertenecer a una o varias redes.
4. Los datos validados alimentarán indicadores, informes y memoria.
5. El portal del profesorado debe poder utilizarse desde móvil en menos de 90 segundos por actuación ordinaria.
6. La aplicación se despliega directamente en Ubuntu, sin Docker.

## Componentes

- `apps/web`: interfaz Next.js.
- `apps/api`: API NestJS.
- `packages/database`: modelo PostgreSQL/Prisma.
- `deploy`: Nginx y systemd.
- `scripts`: instalación y mantenimiento.

## Redes iniciales

Las cuatro redes se crean en el seed y están activas desde la V1:
- Innovación.
- Emprendimiento.
- Información y Orientación Profesional.
- Calidad.

## Primer flujo implementado

Profesorado → formulario → PENDING_VALIDATION → coordinación → VALIDATED.

El siguiente bloque sustituirá los campos provisionales de identidad del formulario por autenticación y sesión, e incorporará bandeja de coordinación, devolución y validación masiva.
