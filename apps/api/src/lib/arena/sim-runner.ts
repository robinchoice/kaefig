import { type AgentAction, type CageSecrets, mockAgent } from './agent';

// Runs the agent without a VM, used in tests and wherever there is no KVM (CI,
// the Hetzner cloud). It mirrors the cage: the network is default-deny and the
// host is unreachable, so every outbound attempt is blocked and no host path
// can be read. tiers 2 and 3 therefore stay out of reach here too, exactly as a
// holding microVM would behave.
export async function simRun(document: string, secrets: CageSecrets): Promise<AgentAction[]> {
  return mockAgent(document, secrets, {
    net: async () => false,
    fs: async () => null,
  });
}
