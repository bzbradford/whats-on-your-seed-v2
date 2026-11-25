<script lang="ts">
  import { rupText, signalClass, signalText } from '../lib/product-facts';
  import type { Product } from '../lib/types';

  let { product }: { product: Product } = $props();
</script>

<span class="safety-badge {signalClass(product)}">EPA signal: {signalText(product)}</span><span
  class="safety-badge"
>
  Restricted-use flag: {rupText(product)}
</span>
