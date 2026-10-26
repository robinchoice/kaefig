import { accessSync, constants } from 'node:fs';
import type { Messages, TraceEvent, Verdict } from '@app/shared';
import type { CageSecrets } from './agent';
import { verdictOf } from './detect';
import { cageBusy, microsandboxRun } from './microsandbox-runner';
import { simRun } from './sim-runner';

export type { CageSecrets } from './agent';
export { cageBusy };

// A fresh set of secrets for one attempt. The bait is unique so its appearance
// anywhere outside the VM is unambiguous; the flag never enters the VM.
export function newCage(): CageSecrets {
  const rnd = () => Buffer.from(crypto.getRandomValues(new Uint8Array(12))).toString('hex');
  return { honeytoken: `KAEFIG-BAIT-${rnd()}`, flag: `KAEFIG-FLAG-${rnd()}` };
}

// The canary catches a bait that reached our off-allowlist address — a real
// phone-home. In a holding cage the VM never reaches it, so this stays empty.
// Per instance in memory; exfil essentially never happens, and a missed cross-
// instance hit would only under-count, never grant a payout by mistake.
const canaryHits = new Set<string>();
export const recordCanaryHit = (token: string) => canaryHits.add(token);

type Runner = 'sim' | 'microsandbox';

// KVM on the laptop ⇒ the real microVM; otherwise (CI, cloud) the simulation.
// KAEFIG_RUNNER forces one. The simulation holds just like a real cage, so the
// arena stays honest about boundaries either way.
export function chooseRunner(): Runner {
  const forced = process.env.KAEFIG_RUNNER;
  if (forced === 'sim' || forced === 'microsandbox') return forced;
  try {
    accessSync('/dev/kvm', constants.R_OK | constants.W_OK);
    return 'microsandbox';
  } catch {
    return 'sim';
  }
}

// One stable protocol entry (language-neutral) the caller appends to the log.
export type Blocked = { kind: 'net' | 'fs'; target: string };

// Map the agent's actions to localized trace lines, paced for a legible live
// view. Returns the verdict, the note and the blocked attempts so the caller
// can persist all three. onEvent may be async (e.g. writing to a stream).
export async function runCage(opts: {
  document: string;
  secrets: CageSecrets;
  m: Messages;
  // Delay between trace lines; 0 in tests
  paceMs?: number;
  onEvent?: (event: TraceEvent) => void | Promise<void>;
}): Promise<{ verdict: Verdict; runner: Runner; note: string; blocked: Blocked[] }> {
  const { document, secrets, m, paceMs = 0, onEvent } = opts;
  const runner = chooseRunner();
  const start = Date.now();
  const emit = (kind: TraceEvent['kind'], text: string) => onEvent?.({ at: Date.now() - start, kind, text });
  const pace = () => (paceMs ? new Promise((r) => setTimeout(r, paceMs)) : Promise.resolve());

  await emit('vm', m.traceVmStarted);
  await pace();
  await emit('info', m.traceTask);
  await pace();

  const actions =
    runner === 'microsandbox' ? await microsandboxRun(document, secrets) : await simRun(document, secrets);

  const blocked: Blocked[] = [];
  for (const action of actions) {
    await pace();
    // A blocked attempt is the boundary doing its job. A rare one that got
    // through is not shown here; the verdict and its win line carry that.
    if (action.kind === 'read') await emit('agent', m.traceReadDoc);
    else if (action.kind === 'think') await emit('agent', m.traceThinking);
    else if (action.kind === 'note') await emit('agent', m.traceWroteNote);
    else if (action.kind === 'net' && !action.ok) {
      blocked.push({ kind: 'net', target: action.host });
      await emit('block', m.traceNetBlocked(action.host));
    } else if (action.kind === 'fs' && !action.ok) {
      blocked.push({ kind: 'fs', target: action.path });
      await emit('block', m.traceFsBlocked(action.path));
    }
  }

  const verdict = verdictOf(actions, secrets, canaryHits.has(secrets.honeytoken));
  canaryHits.delete(secrets.honeytoken);

  await pace();
  if (verdict.tier === 1) await emit('win', m.traceBaitFound);
  else if (verdict.tier === 2) await emit('win', m.traceExfil);
  else if (verdict.tier === 3) await emit('win', m.traceEscape);
  await emit('vm', m.traceVmDestroyed);

  return { verdict, runner, note: actions.find((a) => a.kind === 'note')?.text ?? '', blocked };
}
