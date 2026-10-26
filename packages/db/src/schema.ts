import type { FeedbackContext, UpdateContent } from '@app/shared';
import {
  bigint,
  bigserial,
  boolean,
  customType,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' });

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Stored lowercase, see the email schema in @app/shared
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  // Opt-in for update mails, null = off. The time is the proof of consent.
  updatesConsentAt: timestamp('updates_consent_at'),
  // Language of the update mails, taken at login and when switching them on
  locale: varchar('locale', { length: 5 }).default('de').notNull(),
  // Key of the unsubscribe link in update mails, works without login
  unsubscribeToken: uuid('unsubscribe_token').defaultRandom().notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const magicLinks = pgTable('magic_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  // Ticked "send me updates", applied when the link is opened
  updatesOptIn: boolean('updates_opt_in').default(false).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Mobile apps log in with a code from the mail, a link can't open the app
export const loginCodes = pgTable('login_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: varchar('email', { length: 255 }).notNull(),
  codeHash: varchar('code_hash', { length: 64 }).notNull(),
  updatesOptIn: boolean('updates_opt_in').default(false).notNull(),
  attempts: integer('attempts').default(0).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  tokenHash: varchar('token_hash', { length: 64 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Passkeys, added by a logged-in user (README, „Passkeys“). The id is the
// credential ID in base64url, the authenticator sends it with every login.
export const passkeys = pgTable('passkeys', {
  id: varchar('id', { length: 1400 }).primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  publicKey: bytea('public_key').notNull(),
  counter: bigint('counter', { mode: 'number' }).notNull(),
  transports: jsonb('transports').$type<string[]>(),
  // Synced by a password manager, else bound to one device
  backedUp: boolean('backed_up').notNull(),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Challenges of running passkey ceremonies, single use. userId is set while
// adding a passkey, null for a login.
export const passkeyChallenges = pgTable('passkey_challenges', {
  challenge: varchar('challenge', { length: 100 }).primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at').notNull(),
});

// Counters of lib/rate-limit.ts in the API
export const rateLimits = pgTable('rate_limits', {
  key: varchar('key', { length: 300 }).primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at').notNull(),
});

// Keys the API generates on first use, so every instance shares them and no
// deployment has to set them. `altcha` signs the challenges of lib/altcha.ts.
export const serverSecrets = pgTable('server_secrets', {
  name: varchar('name', { length: 50 }).primaryKey(),
  value: varchar('value', { length: 128 }).notNull(),
});

// Bug reports and ideas from the feedback button, also mailed and filed as
// GitHub issues. The random id is the key of the screenshot URL.
export const feedback = pgTable('feedback', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  kind: varchar('kind', { length: 10 }).notNull(),
  message: text('message').notNull(),
  screenshot: bytea('screenshot'),
  context: jsonb('context').$type<FeedbackContext & { api: string }>().notNull(),
  issueUrl: varchar('issue_url', { length: 300 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Update mails, see README „Update-Mails“. Drafts from updates/<slug>.md carry
// the slug, sentAt marks the moment Robin sent it.
export const updates = pgTable('updates', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: varchar('slug', { length: 200 }).unique(),
  content: jsonb('content').$type<UpdateContent>().notNull(),
  image: bytea('image'),
  sentAt: timestamp('sent_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// One row per recipient of a sent update, the worker works through the pending ones
export const updateDeliveries = pgTable(
  'update_deliveries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    updateId: uuid('update_id')
      .references(() => updates.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    // pending, sent, failed, or skipped when the user unsubscribed in between
    status: varchar('status', { length: 10 }).default('pending').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    // Last try, the send time once sent. Paces all workers together.
    attemptedAt: timestamp('attempted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [unique().on(table.updateId, table.userId)],
);

// Käfig: one attempt in the arena. Created only after a paid L402 token; the
// unique paymentHash makes a proof single-use (no replay). tier 0 = the cage
// held, 1–3 = the boundary the agent broke, stopped names the layer it was
// stopped at when it held. The document is the untrusted input the agent saw.
export const attempts = pgTable('attempts', {
  id: uuid('id').defaultRandom().primaryKey(),
  paymentHash: varchar('payment_hash', { length: 64 }).notNull().unique(),
  nym: varchar('nym', { length: 40 }).default('anon').notNull(),
  // Only to pay out a confirmed break, verified by hand
  lnAddress: varchar('ln_address', { length: 200 }),
  document: text('document').notNull(),
  tier: integer('tier').default(0).notNull(),
  stopped: varchar('stopped', { length: 10 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// A payout owed for a confirmed break. Stays `pending` until Robin reviews and
// pays it by hand (prototypes.md, Grundsatz 8); no agent ever triggers a payout.
export const claims = pgTable('claims', {
  id: uuid('id').defaultRandom().primaryKey(),
  attemptId: uuid('attempt_id')
    .references(() => attempts.id, { onDelete: 'cascade' })
    .notNull(),
  tier: integer('tier').notNull(),
  sats: integer('sats').notNull(),
  lnAddress: varchar('ln_address', { length: 200 }),
  // pending, paid, or rejected
  status: varchar('status', { length: 10 }).default('pending').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  decidedAt: timestamp('decided_at'),
});

// The public, tamper-evident protocol (README, „Protokoll“), our Turso
// stand-in. Each row's hash chains in the previous hash, so an edited or
// removed row breaks the chain. Appends are serialized by an advisory lock.
export const protocol = pgTable('protocol', {
  seq: bigserial('seq', { mode: 'number' }).primaryKey(),
  at: timestamp('at').defaultNow().notNull(),
  event: varchar('event', { length: 40 }).notNull(),
  subject: varchar('subject', { length: 120 }).notNull(),
  detail: varchar('detail', { length: 300 }).notNull(),
  prevHash: varchar('prev_hash', { length: 64 }),
  hash: varchar('hash', { length: 64 }).notNull(),
});
