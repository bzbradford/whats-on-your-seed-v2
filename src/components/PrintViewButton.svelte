<script lang="ts">
  import { getApp } from '../lib/context';
  import { printCurrentView } from '../lib/print';
  import Icon from './Icon.svelte';

  // Brought forward from the master-era UI ("Print this view").
  let { class: className = 'export' }: { class?: string } = $props();
  const app = getApp();
</script>

<button type="button" class="{className} print-view" onclick={() => printCurrentView(app.view)}>
  <Icon name="print" />Print this view
</button>

<style>
  .print-view {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  @media print {
    .print-view {
      display: none !important;
    }
  }
</style>
