<script lang="ts">
  import type { EducationSource } from '../lib/types';
  import ExtLink from './ExtLink.svelte';

  // Legacy `sources()`: education source ids as links, joined with " · ".
  let { ids, sources }: { ids: string[] | undefined; sources: EducationSource[] } = $props();
  const SEPARATOR = ' · ';
</script>

{#each ids || [] as id, i (i)}{@const x = sources.find(
    (s) => s.id === id,
  )}{#if i}{SEPARATOR}{/if}{#if x}<ExtLink url={x.url} text={id} />{/if}{/each}
