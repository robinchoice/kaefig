import { attempts, claims } from '@app/db';
import { type AttemptResult, attemptSchema, FEE_SATS, messages, TIERS } from '@app/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { z } from 'zod';
import { cageBusy, chooseRunner, newCage, recordCanaryHit, runCage } from '../lib/arena';
import { feed, stats } from '../lib/arena/queries';
import { locale, t } from '../lib/i18n';
import { challenge, lightning, verifyAuth } from '../lib/l402';
import { append, recent } from '../lib/protocol';
import { clientIp, rateLimit, tooManyRequests } from '../lib/rate-limit';
import { validJson } from '../lib/validate';
import type { AppEnv } from '../types';

// One attempt costs a paid L402 token; the shared limit only slows how fast a
// single address can ask for invoices and run attempts.
const attemptLimit = rateLimit('arena-attempt', 30, 10 * 60 * 1000);

const payTestSchema = z.object({ paymentHash: z.string().regex(/^[0-9a-f]{64}$/i) });

export const arenaRoutes = new Hono<AppEnv>()
  .get('/stats', async (c) => c.json(await stats(c.get('db'))))
  .get('/feed', async (c) => c.json({ entries: await feed(c.get('db')) }))
  .get('/protocol', async (c) => c.json({ entries: await recent(c.get('db')) }))

  // The canary: an address off the agent's allowlist. A holding cage never
  // reaches it; a request here means a bait left the VM (tier 2).
  .post('/canary', async (c) => {
    const token = (await c.req.text()).trim();
    if (token) recordCanaryHit(token);
    return c.json({ ok: true });
  })

  // Test mode only: settle an invoice and reveal its preimage, standing in for
  // a wallet. A real backend has no such endpoint.
  .post('/pay-test', validJson(payTestSchema), async (c) => {
    const backend = lightning();
    if (!backend.testMode) return c.json({ error: t(c).notFound }, 404);
    const preimage = await backend.settleForTest(c.req.valid('json').paymentHash);
    if (!preimage) return c.json({ error: t(c).paymentInvalid }, 400);
    return c.json({ preimage });
  })

  // L402: no token ⇒ 402 with an invoice and a token bound to this document; a
  // valid token ⇒ run the cage and stream the trace as NDJSON.
  .post('/attempts', validJson(attemptSchema), async (c) => {
    const db = c.get('db');
    if (!(await attemptLimit.hit(c, clientIp(c)))) return tooManyRequests(c);
    const { document, nym, lnAddress } = c.req.valid('json');

    const auth = c.req.header('authorization');
    if (!auth) {
      const ch = await challenge(db, document);
      c.header('WWW-Authenticate', `L402 macaroon="${ch.macaroon}", invoice="${ch.invoice}"`);
      return c.json(ch, 402);
    }

    const verified = await verifyAuth(db, auth, document);
    if (!verified.ok) return c.json({ error: t(c)[verified.error] }, verified.error === 'paymentInvalid' ? 400 : 402);
    if (chooseRunner() === 'microsandbox' && cageBusy()) return c.json({ error: t(c).runnerBusy }, 429);

    // Claim the payment; the unique hash makes the proof single-use.
    const who = nym?.slice(0, 40) || 'anon';
    const [row] = await db
      .insert(attempts)
      .values({ paymentHash: verified.paymentHash, nym: who, lnAddress: lnAddress ?? null, document })
      .onConflictDoNothing()
      .returning({ id: attempts.id });
    if (!row) return c.json({ error: t(c).attemptReplay }, 409);

    const id = row.id;
    const subject = `#${id.slice(0, 8)}`;
    const m = messages[locale(c)];
    await append(db, { event: 'attempt.created', subject, detail: `${FEE_SATS} sats (L402)` });
    await append(db, { event: 'vm.started', subject, detail: chooseRunner() });

    c.header('content-type', 'application/x-ndjson');
    return stream(c, async (s) => {
      const cage = newCage();
      const { verdict, blocked } = await runCage({
        document,
        secrets: cage,
        m,
        paceMs: Number(process.env.KAEFIG_PACE_MS ?? 500),
        onEvent: async (event) => {
          await s.write(`${JSON.stringify({ type: 'trace', event })}\n`);
        },
      });

      for (const b of blocked) {
        await append(db, { event: b.kind === 'net' ? 'net.denied' : 'fs.denied', subject, detail: b.target });
      }
      await db.update(attempts).set({ tier: verdict.tier, stopped: verdict.stopped }).where(eq(attempts.id, id));

      if (verdict.tier > 0) {
        const reward = TIERS.find((tier) => tier.id === verdict.tier)?.reward ?? 0;
        await db
          .insert(claims)
          .values({ attemptId: id, tier: verdict.tier, sats: reward, lnAddress: lnAddress ?? null });
        await append(db, { event: 'tier.reached', subject, detail: `tier ${verdict.tier}` });
        await append(db, { event: 'claim.pending', subject, detail: `${reward} sats` });
      } else {
        await append(db, { event: 'attempt.held', subject, detail: verdict.stopped ?? 'agent' });
      }
      await append(db, { event: 'vm.destroyed', subject, detail: '0 bytes' });

      const result: AttemptResult = {
        id,
        nym: who,
        tier: verdict.tier,
        stopped: verdict.stopped,
        createdAt: new Date().toISOString(),
      };
      await s.write(`${JSON.stringify({ type: 'result', result })}\n`);
    });
  });
