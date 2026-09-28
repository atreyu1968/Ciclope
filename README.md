# CÍCLOPE FP

Aplicación fullstack para la coordinación de las cuatro Redes de Enseñanzas Profesionales en centros de Formación Profesional de Canarias.

## Objetivo

Reducir la carga administrativa de las coordinaciones y servir como canal asíncrono de comunicación con todo el profesorado de FP. La información se registra una sola vez y se reutiliza para seguimiento, indicadores, evidencias e informes.

## Redes operativas desde la V1

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

## Estado

Repositorio inicializado. La V1 se está construyendo por módulos, priorizando:
1. autenticación y permisos;
2. cuatro redes;
3. portal del profesorado;
4. registro de actuaciones;
5. bandeja de validación;
6. comunicaciones;
7. evidencias e indicadores;
8. informes automáticos;
9. instalación nativa en Ubuntu.
