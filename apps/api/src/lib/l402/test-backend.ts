import { createHash } from 'node:crypto';
import type { Invoice, LightningBackend } from './backend';

// A deterministic, local stand-in for a Lightning node. Invoices are fake but
// shaped like a regtest bolt11 string, and the preimage/payment-hash pair is
// real crypto, so the L402 verification is exercised end to end without a node
// or any money. State is in memory: a restart forgets open invoices, which only
// means an unpaid attempt must start over.
export function testBackend(): LightningBackend {
  const invoices = new Map<string, { preimage: string; settled: boolean }>();

  return {
    testMode: true,

    async createInvoice(amountSats, _memo): Promise<Invoice> {
      const preimage = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
      const paymentHash = createHash('sha256').update(Buffer.from(preimage, 'hex')).digest('hex');
      invoices.set(paymentHash, { preimage, settled: false });
      return { paymentHash, paymentRequest: `lnbcrt${amountSats}n1test${paymentHash.slice(0, 32)}` };
    },

    async isSettled(paymentHash) {
      return invoices.get(paymentHash)?.settled ?? false;
    },

    async settleForTest(paymentHash) {
      const invoice = invoices.get(paymentHash);
      if (!invoice) return null;
      invoice.settled = true;
      return invoice.preimage;
    },
  };
}
