// The Lightning backend behind the L402 paywall. The arena only needs to mint
// an invoice and later check that it was paid; a payment is proven to the API
// by the preimage, whose SHA-256 is the payment hash. One interface, so a real
// node (LND, LNbits, …) slots in for the test backend at live-go without
// touching the routes. No real money until then (Robin decides, Grundsatz 8).

export type Invoice = { paymentHash: string; paymentRequest: string };

export interface LightningBackend {
  // True while invoices are fake and settled locally, so the UI can offer a
  // "confirm test payment" button and never suggests real money moved.
  readonly testMode: boolean;
  createInvoice(amountSats: number, memo: string): Promise<Invoice>;
  isSettled(paymentHash: string): Promise<boolean>;
  // Test backend only: settle the invoice and reveal its preimage, standing in
  // for a wallet paying it. A real backend returns null — a wallet pays it.
  settleForTest(paymentHash: string): Promise<string | null>;
}

import { testBackend } from './test-backend';

let backend: LightningBackend | null = null;

// Only the test backend exists for now. A real one is wired here once Robin
// picks a node and funds the pot (README/AGENTS.md, „Abweichungen“).
export function lightning(): LightningBackend {
  backend ??= testBackend();
  return backend;
}
