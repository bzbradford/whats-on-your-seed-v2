<script lang="ts">
  import { signalClass, signalText } from '../lib/product-facts';
  import type { Product } from '../lib/types';

  // Oct 19 `safetyBadge`: the signal word, plus a badge only when the RUP flag is Yes.
  let { product }: { product: Product } = $props();
</script>

<span class="safety-badge {signalClass(product)}">
  EPA signal: {signalText(product)}
</span>{#if product.safety?.restricted_use === true}<span class="safety-badge warning">
    Restricted-use flag: Yes
  </span>{/if}
