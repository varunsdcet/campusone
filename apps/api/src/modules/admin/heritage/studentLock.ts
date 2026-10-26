import { createHash } from "node:crypto";
import { prisma } from "@myheritage/db";

const locks = new Map<string, Promise<unknown>>();
export const STUDENT_MONEY_LOCK_SQL =
  "SELECT pg_advisory_xact_lock($1::integer, $2::integer)::text AS locked";

function advisoryKey(value: string): [number, number] {
  const digest = createHash("sha256").update(value).digest();
  return [digest.readInt32BE(0), digest.readInt32BE(4)];
}

async function withDatabaseLock<T>(key: string, run: () => Promise<T>) {
  // Unit tests exercise the deterministic in-process queue without requiring PostgreSQL.
  if (process.env.NODE_ENV === "test") return run();
  const [namespace, entity] = advisoryKey(key);
  return prisma.$transaction(
    async (tx) => {
      // Prisma sends JavaScript numbers as PostgreSQL bigint parameters. PostgreSQL only
      // exposes the two-key advisory-lock overload for (integer, integer), so cast both
      // parameters explicitly instead of asking PostgreSQL for a non-existent overload.
      // Cast the void return value to text as Prisma cannot deserialize PostgreSQL void.
      await tx.$queryRawUnsafe(STUDENT_MONEY_LOCK_SQL, namespace, entity);
      return run();
    },
    { timeout: 120_000 },
  );
}

/** Serialises money movements per student across every API replica. */
export async function withStudentMoneyLock<T>(institutionId: string, studentId: string, run: () => Promise<T>): Promise<T> {
  const key = `${institutionId}:${studentId}`;
  const next = (locks.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => withDatabaseLock(key, run));
  const tail = next.catch(() => undefined);
  locks.set(key, tail);
  try {
    return await next;
  } finally {
    if (locks.get(key) === tail) locks.delete(key);
  }
}
