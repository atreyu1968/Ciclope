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
