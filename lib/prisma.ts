import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const prismaClientSingleton = () => {
  const datasources =
    process.env.NODE_ENV === 'production' && process.env.DATABASE_URL
      ? { db: { url: process.env.DATABASE_URL } }
      : undefined

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources,
  })
}

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
