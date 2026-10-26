<script lang="ts">
  import { APP_BAND, APP_NAME, bandColor, bandGradient, DEEP, GLOW } from '@app/shared';
  import { page } from '$app/state';
  import PleasanceFooter from '$lib/components/PleasanceFooter.svelte';
  import Toasts from '$lib/components/Toasts.svelte';
  import { t } from '$lib/i18n';

  let { children } = $props();

  // Link previews. Public pages override them with meta in their server load,
  // pages with ssr = false don't get any (link crawlers run no JavaScript).
  const meta = $derived({ title: APP_NAME, description: t().tagline, image: '', ...page.data.meta });
</script>

<svelte:head>
  <title>{APP_NAME}</title>
  <meta property="og:site_name" content={APP_NAME} />
  <meta property="og:type" content="website" />
  <meta property="og:title" content={meta.title} />
  <meta property="og:description" content={meta.description} />
  {#if meta.image}
    <meta property="og:image" content={meta.image} />
  {:else}
    <meta property="og:image" content="{page.url.origin}/og-image-{page.data.locale}.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="{APP_NAME}: {t().tagline}" />
  {/if}
  <meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div
  class="shell"
  style:--gradient={bandGradient(APP_BAND, GLOW)}
  style:--accent={bandColor((APP_BAND.from + APP_BAND.to) / 2, DEEP)}
>
  <div class="content">
    {@render children()}
  </div>
  <PleasanceFooter />
  <Toasts />
</div>

<style>
  @font-face {
    font-family: 'Bricolage Grotesque';
    font-weight: 200 800;
    font-stretch: 75% 100%;
    font-display: swap;
    src: url('/fonts/bricolage-grotesque-latin-ext.woff2') format('woff2');
    unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF,
      U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF;
  }
  @font-face {
    font-family: 'Bricolage Grotesque';
    font-weight: 200 800;
    font-stretch: 75% 100%;
    font-display: swap;
    src: url('/fonts/bricolage-grotesque-latin.woff2') format('woff2');
    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329,
      U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
  }
  /* Käfig runs in a dark console look (DESIGN: Glaskasten im Konsole-Stil).
     The starter's variable names stay so Button, Input and the footer adapt. */
  :global(:root) {
    color-scheme: dark;
    --bg: #0a0c0b;
    --surface: #111513;
    --panel: #111513;
    --line: #23302a;
    --border: #23302a;
    --text: #c9d6cf;
    --fg: #c9d6cf;
    --muted: #6f8278;
    --dim: #6f8278;
    --green: #5cff9d;
    --amber: #ffb547;
    --red: #ff5f56;
    --blue: #8fd6ff;
    --needs: #ffb547;
    --needs-bg: #3a2c10;
    --new: #5cff9d;
    --new-bg: #0e2c1c;
    --error: #ff5f56;
    --error-bg: #2a1210;
    --radius: 6px;
    --font-display: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    --spectrum: linear-gradient(90deg, #f2545b, #fb8c45, #f2c14e, #6ccf8e, #46bfe0, #8e92f8, #c39bf2);
  }
  :global(*) {
    box-sizing: border-box;
  }
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    line-height: 1.55;
  }
  :global(h1, h2) {
    font-family: var(--font-display);
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  :global(a) {
    color: inherit;
  }
  .shell {
    display: flex;
    flex-direction: column;
    min-height: 100dvh;
  }
  .content {
    flex: 1;
  }
</style>
