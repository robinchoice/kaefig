<script lang="ts">
  import { FEE_SATS, LAYERS, type Layer, type TraceEvent } from '@app/shared';
  import { ApiError } from '$lib/api';
  import { loadFeed, loadStats, runAttempt } from '$lib/arena.svelte';
  import { t } from '$lib/i18n';
  import { toastError } from '$lib/toast.svelte';

  type Phase = 'form' | 'running' | 'held' | 'won';
  let phase = $state<Phase>('form');
  let document = $state(t().sampleDoc);
  let nym = $state('');
  let lnAddress = $state('');
  let trace = $state<TraceEvent[]>([]);
  let tier = $state<0 | 1 | 2 | 3>(0);
  let stopped = $state<Layer | null>(null);
  let hot = $state<Record<Layer, '' | 'hot' | 'break' | 'win'>>({ agent: '', vm: '', net: '', host: '' });

  const layerName = (layer: Layer | null) =>
    layer === 'agent'
      ? t().layerAgent
      : layer === 'vm'
        ? t().layerVm
        : layer === 'net'
          ? t().layerNet
          : t().layerHost;

  // Which layer a trace line lights, and how
  const lights: Record<TraceEvent['kind'], Layer> = {
    vm: 'vm',
    info: 'agent',
    agent: 'agent',
    tool: 'agent',
    ok: 'vm',
    block: 'net',
    win: 'agent',
  };

  function onTrace(event: TraceEvent) {
    trace = [...trace, event];
    const layer = lights[event.kind];
    hot = { agent: '', vm: '', net: '', host: '' };
    hot[layer] = event.kind === 'block' ? 'break' : event.kind === 'win' ? 'win' : 'hot';
  }

  async function start() {
    if (!document.trim()) {
      toastError(t().documentEmpty);
      return;
    }
    phase = 'running';
    trace = [];
    hot = { agent: '', vm: '', net: '', host: '' };
    try {
      const result = await runAttempt(
        { document, nym: nym.trim() || undefined, lnAddress: lnAddress.trim() || undefined },
        onTrace,
      );
      tier = result.tier;
      stopped = result.stopped;
      phase = result.tier > 0 ? 'won' : 'held';
      // Light the layer that decided the outcome, not the last trace line's:
      // the broken boundary on a hit, the holding layer otherwise.
      const layer: Layer =
        result.tier === 1 ? 'agent' : result.tier === 2 ? 'net' : result.tier === 3 ? 'host' : (result.stopped ?? 'agent');
      hot = { agent: '', vm: '', net: '', host: '' };
      hot[layer] = result.tier > 0 ? 'win' : 'hot';
      await Promise.all([loadStats(), loadFeed()]);
    } catch (error) {
      toastError(error instanceof ApiError ? error.message : t().internalError);
      phase = 'form';
    }
  }

  function reset() {
    phase = 'form';
    document = t().sampleDoc;
  }
</script>

{#if phase === 'form'}
  <h1>{t().yourTurn}</h1>
  <p class="sub">{t().versuchIntro}</p>
  <textarea bind:value={document} placeholder={t().documentPlaceholder}></textarea>
  <div class="fields">
    <label>
      <span>{t().nymLabel}</span>
      <input bind:value={nym} placeholder={t().nymPlaceholder} maxlength="40" />
    </label>
    <label>
      <span>{t().lnLabel}</span>
      <input bind:value={lnAddress} placeholder={t().lnPlaceholder} maxlength="200" />
    </label>
  </div>
  <p class="fee">{t().feeNote(FEE_SATS)}</p>
  <p class="fee test">{t().payTestNote}</p>
  <button type="button" class="btn" onclick={start}>{t().sendToCage}</button>
  <a class="btn ghost" href="/">{t().back}</a>
{:else}
  <h1>{t().liveInCage} <span class="badge">{t().running}</span></h1>
  <p class="sub">{t().liveIntro}</p>
  <div class="grid">
    <div>
      <div class="trace">
        {#each trace as line, i (i)}
          <div class="line {line.kind}"><span class="ts">{(line.at / 1000).toFixed(1)}s</span> {line.text}</div>
        {/each}
      </div>
      {#if phase === 'held'}
        <div class="res">
          <p class="big">{t().heldTitle}</p>
          <p class="muted">{t().heldText(layerName(stopped))}</p>
          <button type="button" class="btn" onclick={reset}>{t().again}</button>
          <a class="btn ghost" href="/protokoll">{t().toProtocol}</a>
        </div>
      {:else if phase === 'won'}
        <div class="res win">
          <p class="big">{t().winTitle(tier)}</p>
          <p class="muted">{t().winText}</p>
          <a class="btn" href="/">{t().toStart}</a>
          <a class="btn ghost" href="/protokoll">{t().toProtocol}</a>
        </div>
      {/if}
    </div>
    <div class="ministack">
      <div class="label">{t().boundaries}</div>
      {#each LAYERS as layer (layer)}
        <div class="layer {hot[layer]}"><h3>{layerName(layer)}</h3></div>
      {/each}
    </div>
  </div>
{/if}

<style>
  h1 {
    font-size: 26px;
    margin: 0 0 6px;
    color: #fff;
  }
  .sub {
    color: var(--dim);
    margin: 0 0 20px;
    max-width: 640px;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border: 1px solid var(--line);
    border-radius: 20px;
    font-size: 12px;
    color: var(--green);
  }
  textarea {
    width: 100%;
    height: 190px;
    background: #070908;
    color: var(--fg);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 12px;
    font: 13px/1.5 inherit;
    resize: vertical;
  }
  .fields {
    display: flex;
    gap: 14px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .fields label {
    flex: 1;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: var(--dim);
  }
  .fields input {
    background: #070908;
    color: var(--fg);
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 9px 10px;
    font: inherit;
  }
  .fee {
    color: var(--dim);
    margin: 12px 0 0;
    font-size: 13px;
  }
  .fee.test {
    margin-bottom: 12px;
    color: var(--amber);
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
  .btn.ghost {
    background: none;
    color: var(--green);
    border: 1px solid var(--line);
    margin-left: 8px;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 240px;
    gap: 18px;
    align-items: start;
  }
  .trace {
    background: #070908;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 14px;
    min-height: 320px;
    max-height: 420px;
    overflow: auto;
  }
  .line {
    padding: 2px 0;
  }
  .line .ts {
    color: var(--dim);
    margin-right: 10px;
  }
  .line.block {
    color: var(--red);
  }
  .line.win {
    color: var(--amber);
  }
  .line.ok {
    color: var(--green);
  }
  .line.vm,
  .line.info {
    color: var(--dim);
  }
  .line.tool {
    color: var(--blue);
  }
  .line.agent {
    color: var(--fg);
  }
  .res {
    margin-top: 16px;
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 20px;
    background: var(--panel);
    max-width: 520px;
  }
  .res.win {
    border-color: var(--amber);
  }
  .big {
    font-size: 20px;
    color: #fff;
    margin: 0 0 10px;
  }
  .muted {
    color: var(--dim);
    margin: 0 0 14px;
  }
  .ministack .label {
    color: var(--dim);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 8px;
  }
  .ministack .layer {
    border: 1px solid var(--line);
    padding: 9px 12px;
    margin-bottom: 7px;
    background: var(--panel);
    border-radius: var(--radius);
  }
  .ministack .layer h3 {
    margin: 0;
    font-size: 12px;
    color: var(--fg);
  }
  .ministack .layer.hot {
    border-color: var(--green);
    background: #0e1b14;
  }
  .ministack .layer.break {
    border-color: var(--red);
    background: #1b0f0e;
  }
  .ministack .layer.win {
    border-color: var(--amber);
    background: #1b1507;
  }
  @media (max-width: 820px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
