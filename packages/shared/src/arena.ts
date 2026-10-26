import { z } from 'zod';

// The arena in one place, shared by API, web and CLI. The cage itself (the
// microVM, the honeytoken, the host flag) lives only in the API; here are the
// public contract and the shapes the UI renders.

// Price of one attempt, paid over Lightning as an L402 token (README, „L402“).
export const FEE_SATS = 100;

// A submitted document. Untrusted text; the API hands it to the caged agent.
export const MAX_DOCUMENT = 8000;

// The three boundaries, outer to inner goal. Rewards are what a held pot pays
// a confirmed break; the real number is the pot at payout time. ids are stable.
export const TIERS = [
  { id: 1, key: 'tierChat', reward: 5000 },
  { id: 2, key: 'tierExfil', reward: 50000 },
  { id: 3, key: 'tierEscape', reward: 195000 },
] as const;

export type TierId = (typeof TIERS)[number]['id'];

// The layers the UI lights up. The runner tags every trace line with the layer
// it belongs to, so web and CLI agree on the picture.
export const LAYERS = ['agent', 'vm', 'net', 'host'] as const;
export type Layer = (typeof LAYERS)[number];

// One line of a live run. kind drives the colour and which layer lights up.
export const traceKinds = ['vm', 'info', 'agent', 'tool', 'ok', 'block', 'win'] as const;
export type TraceKind = (typeof traceKinds)[number];

export type TraceEvent = {
  // Milliseconds since the run started
  at: number;
  kind: TraceKind;
  text: string;
};

// How a run ended. tier 0 means the cage held; 1–3 name the boundary broken.
// stopped is the layer the agent was stopped at, for the held case.
export type Verdict = {
  held: boolean;
  tier: 0 | TierId;
  stopped: Layer | null;
};

// The document to put in front of the agent, plus an optional nym shown in the
// feed and a Lightning address for a possible payout (verified by hand).
export const attemptSchema = z.object({
  document: z.string().trim().min(1, 'documentEmpty').max(MAX_DOCUMENT, 'documentTooLong'),
  nym: z.string().trim().max(40).optional(),
  // A Lightning address like you@wallet; only needed to claim a break
  lnAddress: z
    .string()
    .trim()
    .max(200)
    .regex(/^[^@\s]+@[^@\s]+$/, 'lnAddressInvalid')
    .optional(),
});

export type AttemptInput = z.infer<typeof attemptSchema>;

// What the API tells the client about a finished attempt.
export type AttemptResult = {
  id: string;
  nym: string;
  tier: 0 | TierId;
  stopped: Layer | null;
  createdAt: string;
};

// A row of the public feed on the landing page.
export type FeedEntry = {
  n: number;
  nym: string;
  tier: 0 | TierId;
  stopped: Layer | null;
  createdAt: string;
};

// The pot and the counters the sidebar shows.
export type ArenaStats = {
  potSats: number;
  attempts: number;
  // Confirmed breaks per tier id
  breaks: Record<string, number>;
};

// One entry of the tamper-evident protocol (README, „Protokoll“). hash chains
// each row to the one before, so the log cannot be edited unnoticed.
export type ProtocolEntry = {
  seq: number;
  at: string;
  event: string;
  subject: string;
  detail: string;
  hash: string;
};
