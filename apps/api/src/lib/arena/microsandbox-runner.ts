import type { AgentAction, CageSecrets } from './agent';
import { AGENT_SH } from './agent';

// The microsandbox SDK loads a native module and the libkrun runtime. Import it
// lazily, only when a real run happens, so the API boots fast and a sim-only
// deployment (no KVM) never touches the native code.
type Msb = typeof import('microsandbox');
let sdk: Promise<Msb> | null = null;
const loadSdk = () => {
  sdk ??= import('microsandbox');
  return sdk;
};

// Runs the agent inside a real microVM (microsandbox). Needs KVM, so this runs
// on the laptop, not in CI. The network is default-deny — only DNS to the host
// so a name still resolves and the blocked connection reads as a clean denial
// rather than a lookup failure. Nothing of the operator leaks in: no tools, no
// credentials, only the task and the bait in the agent's context
// (khala: untrusted-input-agents-inherit-operator-tools).

let runtime: Promise<unknown> | null = null;

// One VM at a time: KVM and the sandbox name are shared, and a public arena
// should not let callers fan out VMs. The route turns a busy cage into 429.
let busy = false;

export function cageBusy() {
  return busy;
}

export async function microsandboxRun(document: string, secrets: CageSecrets): Promise<AgentAction[]> {
  busy = true;
  try {
    const { ensureRuntime, NetworkPolicy, Sandbox } = await loadSdk();
    runtime ??= ensureRuntime();
    await runtime;

    const policy = NetworkPolicy.builder()
      .defaultDeny()
      .egress((e) => e.udp().tcp().port(53).allowHost())
      .build();

    const sb = await Sandbox.builder(`kaefig-run`)
      .image('alpine')
      .memory(512)
      .cpus(1)
      .network((n) => n.policy(policy))
      .env('AGENT_CONTEXT', secrets.honeytoken)
      .env('AGENT_DOC_B64', Buffer.from(document).toString('base64'))
      .replace()
      .create();

    try {
      const handle = await sb.execStream('sh', ['-c', AGENT_SH]);
      let out = '';
      for await (const ev of handle) {
        if (ev.kind === 'stdout' || ev.kind === 'stderr') out += new TextDecoder().decode(ev.data);
      }
      return parse(out);
    } finally {
      await sb.stop().catch(() => {});
    }
  } finally {
    busy = false;
  }
}

// Turn the agent's line protocol (see AGENT_SH) back into actions. Unknown
// lines are ignored, so a noisy guest cannot inject extra actions.
function parse(out: string): AgentAction[] {
  const actions: AgentAction[] = [];
  for (const line of out.split('\n')) {
    if (line === 'EV read') actions.push({ kind: 'read' });
    else if (line === 'EV think') actions.push({ kind: 'think' });
    else if (line.startsWith('EV net ')) {
      const [, , host, ok] = line.split(' ');
      actions.push({ kind: 'net', host: host ?? '?', ok: ok === 'ok' });
    } else if (line.startsWith('EV fs ')) {
      const [, , path, ok] = line.split(' ');
      actions.push({ kind: 'fs', path: path ?? '?', ok: ok === 'ok' });
    } else if (line.startsWith('NOTE ')) {
      actions.push({ kind: 'note', text: Buffer.from(line.slice(5), 'base64').toString('utf8') });
    }
  }
  return actions;
}
