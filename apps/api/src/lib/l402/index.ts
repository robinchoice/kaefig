import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { type Database, serverSecrets } from '@app/db';
import { FEE_SATS, type Messages } from '@app/shared';
import { eq } from 'drizzle-orm';
import { generateToken } from '../../middleware/auth';
import { type LightningBackend, lightning } from './backend';

export { lightning } from './backend';

// L402 (Lightning HTTP 402): a request to run an attempt is answered with 402
// and a token plus an invoice; once paid, the caller proves it with the
// preimage and the same token. The token here is a signed payment-hash +
// document-hash pair rather than a full macaroon with caveats — enough to bind
// a paid attempt to one exact document and make the proof single-use, without
// pulling in a macaroon library (README, „L402“; AGENTS.md, „Abweichungen“).

export const sha256 = (data: string) => createHash('sha256').update(data).digest('hex');

let key: Buffer | null = null;
async function hmacKey(db: Database): Promise<Buffer> {
  if (key) return key;
  await db.insert(serverSecrets).values({ name: 'l402', value: generateToken() }).onConflictDoNothing();
  const [row] = await db.select().from(serverSecrets).where(eq(serverSecrets.name, 'l402'));
  key = Buffer.from(row!.value, 'hex');
  return key;
}

const b64url = (data: string) => Buffer.from(data).toString('base64url');

async function sign(db: Database, payload: string) {
  return createHmac('sha256', await hmacKey(db))
    .update(payload)
    .digest('base64url');
}

type Token = { ph: string; dh: string };

async function mint(db: Database, token: Token): Promise<string> {
  const body = b64url(JSON.stringify(token));
  return `${body}.${await sign(db, body)}`;
}

async function open(db: Database, macaroon: string): Promise<Token | null> {
  const [body, mac] = macaroon.split('.');
  if (!body || !mac) return null;
  const expected = await sign(db, body);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const token = JSON.parse(Buffer.from(body, 'base64url').toString()) as Token;
    return typeof token.ph === 'string' && typeof token.dh === 'string' ? token : null;
  } catch {
    return null;
  }
}

export type Challenge = {
  macaroon: string;
  invoice: string;
  paymentHash: string;
  amountSats: number;
  testMode: boolean;
};

// Mint an invoice and a token bound to this document. The web shows the invoice
// and, in test mode, a button to settle it.
export async function challenge(db: Database, document: string): Promise<Challenge> {
  const backend = lightning();
  const invoice = await backend.createInvoice(FEE_SATS, 'kaefig attempt');
  const dh = sha256(document);
  return {
    macaroon: await mint(db, { ph: invoice.paymentHash, dh }),
    invoice: invoice.paymentRequest,
    paymentHash: invoice.paymentHash,
    amountSats: FEE_SATS,
    testMode: backend.testMode,
  };
}

type Verified = { ok: true; paymentHash: string } | { ok: false; error: keyof Messages };

// Check an `Authorization: L402 <macaroon>:<preimage>` header against the
// document. The caller still enforces single use via the unique payment hash.
export async function verifyAuth(db: Database, header: string | undefined, document: string): Promise<Verified> {
  const token = header?.match(/^L402 (.+):(.+)$/);
  if (!token) return { ok: false, error: 'paymentRequired' };
  const [, macaroon, preimage] = token;

  const opened = await open(db, macaroon!);
  if (!opened || opened.dh !== sha256(document)) return { ok: false, error: 'paymentInvalid' };
  if (!/^[0-9a-f]{64}$/i.test(preimage!)) return { ok: false, error: 'paymentInvalid' };
  if (createHash('sha256').update(Buffer.from(preimage!, 'hex')).digest('hex') !== opened.ph) {
    return { ok: false, error: 'paymentInvalid' };
  }
  if (!(await (lightning() as LightningBackend).isSettled(opened.ph))) return { ok: false, error: 'paymentUnpaid' };
  return { ok: true, paymentHash: opened.ph };
}
