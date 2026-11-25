<script lang="ts">
  import type { MatrixCell } from '../lib/matrix';
  import ExtLink from './ExtLink.svelte';
  import LabelAction from './LabelAction.svelte';

  let { cell }: { cell: MatrixCell } = $props();
  const view = $derived(cell.view);
</script>

{#if view.kind === 'text'}
  {#each view.text.split('\n') as line, i (i)}{#if i}<br />{/if}{line}{/each}
{:else if view.kind === 'links'}
  {#each view.links as l, i (i)}{#if i}<br />{/if}<ExtLink
      url={l.url}
      text={l.label}
    />{:else}{view.empty}{/each}
{:else if view.kind === 'pests'}
  {#if view.pests}
    <details class="matrix-pests">
      <summary>View EPA pest list</summary>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <p tabindex="0" role="region" aria-label="EPA pest list">{view.pests}</p>
    </details>
    <span class="small muted">Product-wide index; verify crop and pest on the label.</span>
  {:else}
    Not supplied
  {/if}
{:else}
  <LabelAction product={view.product} />
  <p class="small muted">{view.access.note}</p>
  {#if view.access.pdf}<ExtLink url={view.access.lookup} text="EPA label history" />{/if}
{/if}
