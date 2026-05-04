import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  pgPool?: Pool;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add it to `.env` for Prisma + PostgreSQL.",
    );
  }

  const pool = globalForPrisma.pgPool ?? new Pool({ connectionString });
  globalForPrisma.pgPool = pool;

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = (() => {
  const client = globalForPrisma.prisma ?? createPrismaClient();
  globalForPrisma.prisma = client;
  return client;
})();
