import { z } from 'zod';
import { type Command, EXIT, Failure, str } from '../command';

// Sends a document into the cage over the same L402 flow as the web: ask (402),
// settle the invoice in test mode, run with the token, read the trace stream.
// The arena is public, so no login is needed.

const challengeSchema = z.object({
  macaroon: z.string(),
  invoice: z.string(),
  paymentHash: z.string(),
  amountSats: z.number(),
  testMode: z.boolean(),
});
const resultSchema = z.object({
  id: z.string(),
  nym: z.string(),
  tier: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  stopped: z.enum(['agent', 'vm', 'net', 'host']).nullable(),
  createdAt: z.string(),
});
const statsSchema = z.object({ potSats: z.number(), attempts: z.number(), breaks: z.record(z.string(), z.number()) });
const traceLine = z.object({ type: z.literal('trace'), event: z.object({ at: z.number(), text: z.string() }) });
const resultLine = z.object({ type: z.literal('result'), result: resultSchema });

export const arena: Record<string, Command> = {
  attempt: {
    help: (m) => [['attempt [--doc <text>] [--nym <name>] [--ln <addr>]', m.cliAttemptHelp]],
    options: { doc: { type: 'string' }, nym: { type: 'string' }, ln: { type: 'string' } },
    async run(ctx) {
      const { values, m, url, locale, io } = ctx;
      const document = str(values.doc) ?? (await io.stdin());
      if (!document.trim()) throw new Failure(m.documentEmpty, EXIT.usage);
      const body = { document, nym: str(values.nym), lnAddress: str(values.ln) };

      const post = (path: string, payload: unknown, auth?: string) =>
        fetch(`${url}/api/v1${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'accept-language': locale,
            ...(auth ? { authorization: auth } : {}),
          },
          body: JSON.stringify(payload),
        }).catch(() => {
          throw new Failure(m.cliUnreachable(url), EXIT.error);
        });

      const fail = async (res: Response) => {
        const data = z.object({ error: z.string() }).safeParse(await res.json().catch(() => null));
        throw new Failure(data.data?.error ?? m.cliBadAnswer, EXIT.error);
      };

      const asked = await post('/arena/attempts', body);
      if (asked.status !== 402) await fail(asked);
      const parsedChallenge = challengeSchema.safeParse(await asked.json());
      if (!parsedChallenge.success) throw new Failure(m.cliBadAnswer, EXIT.error);
      const challenge = parsedChallenge.data;
      if (!challenge.testMode) throw new Failure(m.paymentRequired, EXIT.error);

      const paid = await post('/arena/pay-test', { paymentHash: challenge.paymentHash });
      if (!paid.ok) await fail(paid);
      const preimage = z.object({ preimage: z.string() }).safeParse(await paid.json());
      if (!preimage.success) throw new Failure(m.cliBadAnswer, EXIT.error);

      const run = await post('/arena/attempts', body, `L402 ${challenge.macaroon}:${preimage.data.preimage}`);
      if (!run.ok || !run.body) await fail(run);

      const reader = run.body!.getReader();
      const decoder = new TextDecoder();
      const lines: string[] = [];
      let result: z.infer<typeof resultSchema> | undefined;
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';
        for (const raw of parts) {
          if (!raw) continue;
          const json: unknown = JSON.parse(raw);
          const trace = traceLine.safeParse(json);
          if (trace.success) {
            lines.push(`  ${(trace.data.event.at / 1000).toFixed(1)}s ${trace.data.event.text}`);
            continue;
          }
          const final = resultLine.safeParse(json);
          if (final.success) result = final.data.result;
        }
      }
      if (!result) throw new Failure(m.cliBadAnswer, EXIT.error);

      const stats = statsSchema.safeParse(await (await fetch(`${url}/api/v1/arena/stats`)).json());
      const outcome =
        result.tier > 0
          ? m.cliAttemptWon(result.tier)
          : m.cliAttemptHeld(
              result.stopped === 'net'
                ? m.layerNet
                : result.stopped === 'vm'
                  ? m.layerVm
                  : result.stopped === 'host'
                    ? m.layerHost
                    : m.layerAgent,
            );

      const fmt = (n: number) => n.toLocaleString('de-DE');
      const text = [...lines, '', outcome]
        .concat(stats.success ? [m.cliPotLine(fmt(stats.data.potSats), fmt(stats.data.attempts))] : [])
        .join('\n');
      return { data: { result, stats: stats.success ? stats.data : null }, text };
    },
  },
};
