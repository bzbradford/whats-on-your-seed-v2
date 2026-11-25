<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  // Legacy `purposeBadge`: icon per EPA purpose (flask for anything else).
  const ICONS: Record<string, IconName> = {
    Fungicide: 'fungus',
    Insecticide: 'bug',
    Nematicide: 'worm',
    Biological: 'seed',
  };
  let { purpose }: { purpose: string } = $props();
</script>

<span class="purpose-badge"><Icon name={ICONS[purpose] || 'flask'} />{purpose}</span>
