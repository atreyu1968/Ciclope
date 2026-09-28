import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'packages/database/prisma/schema.prisma',
  migrations: {
    path: 'packages/database/prisma/migrations',
    seed: 'tsx packages/database/prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
