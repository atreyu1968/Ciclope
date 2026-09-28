import { PrismaPg } from '@prisma/adapter-pg';
import { NetworkCode, PrismaClient } from '../../../apps/api/src/generated/prisma/client';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL no está configurada.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const center = await prisma.center.upsert({
    where: { code: 'CONFIGURAR' },
    update: {},
    create: { name: 'Centro pendiente de configurar', code: 'CONFIGURAR' },
  });

  const academicYear = await prisma.academicYear.upsert({
    where: { centerId_name: { centerId: center.id, name: '2026-2027' } },
    update: { isActive: true },
    create: {
      centerId: center.id,
      name: '2026-2027',
      startsAt: new Date('2026-09-01T00:00:00.000Z'),
      endsAt: new Date('2027-06-30T23:59:59.000Z'),
      isActive: true,
    },
  });

  await prisma.academicYear.updateMany({
    where: { centerId: center.id, id: { not: academicYear.id } },
    data: { isActive: false },
  });

  const networks = [
    [NetworkCode.INNOVATION, 'Innovación', 'Innovación aplicada, ATECA, proyectos y transferencia', 1],
    [NetworkCode.ENTREPRENEURSHIP, 'Emprendimiento', 'Iniciativas emprendedoras, retos y colaboración con el entorno', 2],
    [NetworkCode.GUIDANCE, 'Información y Orientación Profesional', 'Información académica y orientación profesional', 3],
    [NetworkCode.QUALITY, 'Calidad', 'Evaluación, indicadores y mejora continua', 4],
  ] as const;

  for (const [code, name, description, sortOrder] of networks) {
    await prisma.network.upsert({
      where: { code },
      update: { name, description, sortOrder, active: true },
      create: { code, name, description, sortOrder },
    });
  }

  const roles = [
    ['SUPERADMIN', 'Superadministración'],
    ['ADMIN_CENTRO', 'Administración del centro'],
    ['DIRECCION', 'Equipo directivo'],
    ['COORDINADOR_CICLOPE', 'Coordinación CÍCLOPE'],
    ['COORD_INNOVACION', 'Coordinación de Innovación'],
    ['COORD_EMPRENDIMIENTO', 'Coordinación de Emprendimiento'],
    ['COORD_IOP', 'Coordinación de Información y Orientación Profesional'],
    ['COORD_CALIDAD', 'Coordinación de Calidad'],
    ['MIEMBRO_CICLOPE', 'Miembro de CÍCLOPE'],
    ['RESPONSABLE_PROYECTO', 'Responsable de proyecto'],
    ['PROFESOR_FP', 'Profesorado FP'],
    ['LECTURA', 'Solo lectura'],
  ];

  for (const [key, name] of roles) {
    await prisma.role.upsert({ where: { key }, update: { name }, create: { key, name } });
  }
}

main().then(() => prisma.$disconnect()).catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
