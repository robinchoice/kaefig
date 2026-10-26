<script lang="ts">
  import { TIERS } from '@app/shared';
  import { onMount } from 'svelte';
  import { arena, loadStats } from '$lib/arena.svelte';
  import { t } from '$lib/i18n';

  let { children } = $props();

  const fmt = (n: number) => n.toLocaleString('de-DE');
  const tierText = (id: number) =>
    id === 1
      ? { name: t().tier1Name, goal: t().tier1Goal }
      : id === 2
        ? { name: t().tier2Name, goal: t().tier2Goal }
        : { name: t().tier3Name, goal: t().tier3Goal };

  onMount(loadStats);
</script>

<div class="top">
  <a class="logo" href="/">käfig<span> // break the agent</span></a>
  <nav>
    <a href="/">{t().navStart}</a>
    <a href="/protokoll">{t().navProtocol}</a>
    <a href="/regeln">{t().navRules}</a>
  </nav>
</div>

<div class="wrap">
  <aside class="side">
    <div class="label">{t().potLabel}</div>
    <div class="pot">{fmt(arena.stats.potSats)} <span class="unit">{t().sats}</span></div>
    <div class="label small">{t().attemptsDone(fmt(arena.stats.attempts))}</div>
    <div class="tiers">
      {#each TIERS as tier (tier.id)}
        {@const won = arena.stats.breaks[String(tier.id)] ?? 0}
        <div class="tier">
          <div class="h"><b>{tier.id}. {tierText(tier.id).name}</b><span>{fmt(tier.reward)}</span></div>
          <p>{tierText(tier.id).goal}</p>
          {#if won > 0}
            <small class="won">{t().tierWon(won)}</small>
          {:else}
            <small class="open">{t().tierOpen}</small>
          {/if}
        </div>
      {/each}
    </div>
  </aside>
  <main class="main">
    {@render children()}
  </main>
</div>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
    padding: 14px 20px;
    border-bottom: 1px solid var(--line);
  }
  .logo {
    color: var(--green);
    font-weight: 700;
    letter-spacing: 0.5px;
    text-decoration: none;
  }
  .logo span {
    color: var(--dim);
    font-weight: 400;
  }
  nav a {
    margin-left: 16px;
    color: var(--dim);
    text-decoration: none;
  }
  nav a:hover {
    color: var(--fg);
  }
  .wrap {
    display: grid;
    /* minmax(0, …) lets the main column shrink instead of pushing content
       (the live-run grid) past the right edge */
    grid-template-columns: 280px minmax(0, 1fr);
  }
  .side {
    border-right: 1px solid var(--line);
    padding: 20px;
  }
  .main {
    min-width: 0;
    padding: 26px 30px;
  }
  .label {
    color: var(--dim);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .label.small {
    margin-top: 4px;
    text-transform: none;
    letter-spacing: 0;
    font-size: 12px;
  }
  .pot {
    font-size: 32px;
    color: var(--amber);
    font-weight: 700;
    line-height: 1.1;
  }
  .pot .unit {
    font-size: 16px;
  }
  .tiers {
    margin-top: 10px;
  }
  .tier {
    border: 1px solid var(--line);
    padding: 10px 12px;
    margin-top: 10px;
    background: var(--panel);
    border-radius: var(--radius);
  }
  .tier .h {
    display: flex;
    justify-content: space-between;
  }
  .tier .h b {
    color: var(--fg);
  }
  .tier .h span {
    color: var(--amber);
  }
  .tier p {
    margin: 4px 0 0;
    color: var(--dim);
    font-size: 12px;
  }
  .tier small.won {
    color: var(--green);
  }
  .tier small.open {
    color: var(--dim);
  }
  @media (max-width: 820px) {
    .wrap {
      grid-template-columns: 1fr;
    }
    .side {
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
  }
</style>
