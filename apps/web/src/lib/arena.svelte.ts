import type { ArenaStats, AttemptInput, AttemptResult, FeedEntry, ProtocolEntry, TraceEvent } from '@app/shared';
import { z } from 'zod';
import { page } from '$app/state';
import { ApiError, api } from './api';

// Reactive arena state for the sidebar, the feed and the protocol. Pages call
// the loaders; the values are shared so the sidebar updates after an attempt.
export const arena = $state<{
  stats: ArenaStats;
  feed: FeedEntry[];
  protocol: ProtocolEntry[];
}>({
  stats: { potSats: 0, attempts: 0, breaks: {} },
  feed: [],
  protocol: [],
});

export async function loadStats() {
  arena.stats = await api.get<ArenaStats>('/arena/stats', true);
}
export async function loadFeed() {
  arena.feed = (await api.get<{ entries: FeedEntry[] }>('/arena/feed', true)).entries;
}
export async function loadProtocol() {
  arena.protocol = (await api.get<{ entries: ProtocolEntry[] }>('/arena/protocol', true)).entries;
}

const challengeSchema = z.object({
  macaroon: z.string(),
  invoice: z.string(),
  paymentHash: z.string(),
  amountSats: z.number(),
  testMode: z.boolean(),
});
const line = z.discriminatedUnion('type', [
  z.object({ type: z.literal('trace'), event: z.custom<TraceEvent>() }),
  z.object({ type: z.literal('result'), result: z.custom<AttemptResult>() }),
]);

async function postJson(path: string, body: unknown, auth?: string) {
  return fetch(`/api/v1${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept-language': page.data.locale,
      ...(auth ? { authorization: auth } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function errorOf(res: Response) {
  const body = await res.json().catch(() => null);
  return new ApiError(z.object({ error: z.string() }).safeParse(body).data?.error ?? res.statusText);
}

// The full L402 run: ask (402), pay the invoice (test mode settles it for us),
// then run with the token and read the trace stream line by line.
export async function runAttempt(input: AttemptInput, onTrace: (event: TraceEvent) => void): Promise<AttemptResult> {
  const asked = await postJson('/arena/attempts', input);
  if (asked.status !== 402) throw await errorOf(asked);
  const challenge = challengeSchema.parse(await asked.json());

  if (!challenge.testMode) throw new ApiError('Lightning backend not available in test mode');
  const paid = await postJson('/arena/pay-test', { paymentHash: challenge.paymentHash });
  if (!paid.ok) throw await errorOf(paid);
  const { preimage } = z.object({ preimage: z.string() }).parse(await paid.json());

  const run = await postJson('/arena/attempts', input, `L402 ${challenge.macaroon}:${preimage}`);
  if (!run.ok || !run.body) throw await errorOf(run);

  const reader = run.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: AttemptResult | undefined;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const raw of parts) {
      if (!raw) continue;
      const parsed = line.safeParse(JSON.parse(raw));
      if (!parsed.success) continue;
      if (parsed.data.type === 'trace') onTrace(parsed.data.event);
      else result = parsed.data.result;
    }
  }
  if (!result) throw new ApiError('no result');
  return result;
}
