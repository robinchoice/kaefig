<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { arena, loadProtocol } from '$lib/arena.svelte';
  import { t } from '$lib/i18n';

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(page.data.locale === 'de' ? 'de-DE' : 'en-GB');

  onMount(loadProtocol);
</script>

<h1>{t().protTitle}</h1>
<p class="sub">{t().protIntro}</p>

{#if arena.protocol.length === 0}
  <p class="empty">{t().protEmpty}</p>
{:else}
  <table>
    <tbody>
      {#each arena.protocol as entry (entry.seq)}
        <tr>
          <td class="ts">{time(entry.at)}</td>
          <td class="event">{entry.event}</td>
          <td>{entry.subject}</td>
          <td class="detail">{entry.detail}</td>
        </tr>
      {/each}
    </tbody>
  </table>
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
  .empty {
    color: var(--dim);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  td {
    padding: 7px 6px;
    border-bottom: 1px solid var(--line);
    color: var(--dim);
  }
  td.ts {
    color: var(--fg);
    white-space: nowrap;
  }
  td.event {
    color: var(--blue);
  }
  td.detail {
    color: var(--fg);
  }
</style>
