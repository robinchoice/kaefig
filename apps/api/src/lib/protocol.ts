import { createHash } from 'node:crypto';
import { type Database, protocol } from '@app/db';
import type { ProtocolEntry } from '@app/shared';
import { desc, sql } from 'drizzle-orm';

// The public, tamper-evident protocol — our Turso stand-in (AGENTS.md,
// „Abweichungen“). Every append chains the previous row's hash into this one,
// so editing or dropping a row breaks the chain from there on. An advisory lock
// serializes appends across all API instances, so the chain stays linear.

const LOCK = 7_461_6669; // "kaefig"-ish constant for pg_advisory_xact_lock

function hashRow(prevHash: string, event: string, subject: string, detail: string) {
  return createHash('sha256').update([prevHash, event, subject, detail].join('\u0000')).digest('hex');
}

export async function append(db: Database, entry: { event: string; subject: string; detail: string }) {
  const { event, subject, detail } = entry;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK})`);
    const [last] = await tx.select({ hash: protocol.hash }).from(protocol).orderBy(desc(protocol.seq)).limit(1);
    const prevHash = last?.hash ?? '';
    const hash = hashRow(prevHash, event, subject, detail);
    await tx.insert(protocol).values({ event, subject, detail, prevHash, hash });
  });
}

export async function recent(db: Database, limit = 100): Promise<ProtocolEntry[]> {
  const rows = await db.select().from(protocol).orderBy(desc(protocol.seq)).limit(limit);
  return rows.map((r) => ({
    seq: r.seq,
    at: r.at.toISOString(),
    event: r.event,
    subject: r.subject,
    detail: r.detail,
    hash: r.hash,
  }));
}
