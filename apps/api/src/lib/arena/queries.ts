import { attempts, claims, type Database } from '@app/db';
import { type ArenaStats, FEE_SATS, type FeedEntry, type Layer, type TierId } from '@app/shared';
import { count, desc, eq, sql } from 'drizzle-orm';

// Read models for the sidebar, the feed and the CLI. The pot is derived, never
// stored: the seed plus every stake, minus what was paid out for a break. So
// the number always matches the attempts and claims that back it.
export async function stats(db: Database): Promise<ArenaStats> {
  const seed = Number(process.env.KAEFIG_POT_SEED_SATS) || 0;
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(attempts);
  const [{ paid } = { paid: 0 }] = await db
    .select({ paid: sql<number>`coalesce(sum(${claims.sats}), 0)::int` })
    .from(claims)
    .where(eq(claims.status, 'paid'));
  const broken = await db
    .select({ tier: attempts.tier, c: count() })
    .from(attempts)
    .where(sql`${attempts.tier} > 0`)
    .groupBy(attempts.tier);

  const breaks: Record<string, number> = {};
  for (const row of broken) breaks[String(row.tier)] = row.c;
  return { potSats: seed + n * FEE_SATS - paid, attempts: n, breaks };
}

export async function feed(db: Database, limit = 12): Promise<FeedEntry[]> {
  const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(attempts);
  const rows = await db
    .select({ nym: attempts.nym, tier: attempts.tier, stopped: attempts.stopped, createdAt: attempts.createdAt })
    .from(attempts)
    .orderBy(desc(attempts.createdAt))
    .limit(limit);
  return rows.map((row, i) => ({
    n: total - i,
    nym: row.nym,
    tier: row.tier as 0 | TierId,
    stopped: (row.stopped as Layer | null) ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}
