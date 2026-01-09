import { config } from 'dotenv'
import type { PrismaConfig } from 'prisma'
import { env } from 'prisma/config'

// Load .env.local first, then .env as fallback
config({ path: '.env.local' })
config({ path: '.env' })

export default {
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'npx tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
} satisfies PrismaConfig
