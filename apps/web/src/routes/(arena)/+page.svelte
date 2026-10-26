<script lang="ts">
  import type { Layer } from '@app/shared';
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { arena, loadFeed } from '$lib/arena.svelte';
  import { t } from '$lib/i18n';

  const de = $derived(page.data.locale === 'de');

  const layerName = (layer: Layer | null) =>
    layer === 'agent'
      ? t().layerAgent
      : layer === 'vm'
        ? t().layerVm
        : layer === 'net'
          ? t().layerNet
          : layer === 'host'
            ? t().layerHost
            : '—';

  // Rough "x minutes ago" without a dependency
  function ago(iso: string) {
    const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return de ? 'gerade eben' : 'just now';
    const m = Math.floor(s / 60);
    if (m < 60) return de ? `vor ${m} Min.` : `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return de ? `vor ${h} Std.` : `${h} h ago`;
    return new Date(iso).toLocaleDateString(de ? 'de-DE' : 'en-GB');
  }

  onMount(loadFeed);
</script>

<h1>{t().landTitlePre}<em>{t().landTitleEm}</em>.</h1>
<p class="sub">{t().landIntro}</p>

<div class="stack">
  <div class="layer l-agent"><h3>{t().layerAgent}</h3><p>{t().layerAgentDesc}</p><span class="tag">{t().tierTag(1)}</span></div>
  <div class="layer l-vm"><h3>{t().layerVm}</h3><p>{t().layerVmDesc}</p><span class="tag">{t().tierTag(2)}</span></div>
  <div class="layer l-net"><h3>{t().layerNet}</h3><p>{t().layerNetDesc}</p><span class="tag">{t().tierTag(3)}</span></div>
  <div class="layer l-host"><h3>{t().layerHost}</h3><p>{t().layerHostDesc}</p><span class="tag">{t().goalTag}</span></div>
</div>

<a class="btn" href="/versuch">{t().startAttempt}</a>
<p class="built">{t().builtWith}</p>

<div class="feed">
  <div class="label">{t().lastAttempts}</div>
  {#if arena.feed.length === 0}
    <p class="empty">{t().noAttempts}</p>
  {:else}
    {#each arena.feed as row (row.n)}
      <div class="row">
        <span><b>#{row.n}</b> {row.nym}</span>
        <span>
          {#if row.tier > 0}<span class="hit">{t().tierTag(row.tier)}!</span>{:else}{layerName(row.stopped)}{/if}
          · {ago(row.createdAt)}
        </span>
      </div>
    {/each}
  {/if}
</div>

<style>
  h1 {
    font-size: 26px;
    margin: 0 0 6px;
    color: #fff;
  }
  h1 em {
    color: var(--green);
    font-style: normal;
  }
  .sub {
    color: var(--dim);
    margin: 0 0 20px;
    max-width: 640px;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 9px;
    max-width: 540px;
    margin: 4px 0 24px;
  }
  .layer {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 13px 16px;
    background: var(--panel);
    position: relative;
  }
  .layer h3 {
    margin: 0;
    font-size: 14px;
    color: var(--fg);
  }
  .layer p {
    margin: 3px 0 0;
    color: var(--dim);
    font-size: 12px;
  }
  .layer .tag {
    position: absolute;
    right: 14px;
    top: 13px;
    font-size: 11px;
    color: var(--dim);
    letter-spacing: 1px;
  }
  .l-agent {
    margin: 0 44px;
  }
  .l-vm {
    margin: 0 24px;
  }
  .l-net {
    margin: 0 8px;
  }
  .btn {
    display: inline-block;
    background: var(--green);
    color: #04130a;
    border: 0;
    padding: 11px 20px;
    font: inherit;
    font-weight: 700;
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none;
  }
  .built {
    margin-top: 16px;
    color: var(--dim);
    font-size: 13px;
  }
  .feed {
    margin-top: 18px;
  }
  .label {
    color: var(--dim);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .empty {
    color: var(--dim);
  }
  .row {
    display: flex;
    justify-content: space-between;
    padding: 7px 0;
    border-bottom: 1px solid var(--line);
    color: var(--dim);
  }
  .row b {
    color: var(--fg);
  }
  .hit {
    color: var(--amber);
  }
  @media (max-width: 820px) {
    .l-agent,
    .l-vm,
    .l-net {
      margin: 0;
    }
  }
</style>
