import type { Database } from '@app/db';
import { APP_NAME, FEE_SATS, type Messages } from '@app/shared';

// A page anyone sees without logging in. Agents get it as <path>.md, listed in
// llms.txt and joined in llms-full.txt (routes/agents.ts). body is Markdown
// below the title and description and carries the page's content, not its
// layout. path is the page's URL, so the browser test can open it.
export type PublicPage = { path: string; title: string; description: string; body?: string };

// The arena's public pages. The protocol and the attempt flow are live views,
// not stable content, so they are not listed here. Keep bodies free of `##`
// headings unless the page renders a matching <h2> (browser test agents.test).
export async function publicPages(_db: Database, m: Messages): Promise<PublicPage[]> {
  return [
    {
      path: '/',
      title: APP_NAME,
      description: m.tagline,
      body: [
        m.landIntro,
        '',
        `- ${m.layerAgent}: ${m.layerAgentDesc}`,
        `- ${m.layerVm}: ${m.layerVmDesc}`,
        `- ${m.layerNet}: ${m.layerNetDesc}`,
        `- ${m.layerHost}: ${m.layerHostDesc}`,
        '',
        `${m.tier1Name} (${m.tier1Goal}) · ${m.tier2Name} (${m.tier2Goal}) · ${m.tier3Name} (${m.tier3Goal})`,
        '',
        m.feeNote(FEE_SATS),
        '',
        m.builtWith,
      ].join('\n'),
    },
    { path: '/regeln', title: m.rulesTitle, description: m.tagline, body: m.rulesIntro },
  ];
}
