import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Mantém o singleton em produção entre requisições Next.js
globalForPrisma.prisma = prisma
