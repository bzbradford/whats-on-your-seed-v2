<script lang="ts">
  import type { Product } from '../lib/types';

  // 4a.5: records without EPA ingredients are flagged on the record itself (this replaced
  // the page-level "N records lack ingredients" notice).
  let { product }: { product: Product } = $props();
</script>

{#if product.ingredient_quality === 'missing'}
  <span class="record-flag">Ingredients missing · deltamethrin exclusion not confirmed</span>
{/if}

<style>
  .record-flag {
    display: inline-block;
    margin-top: 6px;
    padding: 2px 8px;
    border: 1px solid #bf9958;
    border-left-width: 4px;
    border-radius: 4px;
    background: #fff5df;
    color: #6e511f;
    font-size: 0.8125rem;
    font-weight: 600;
  }
</style>
