<script lang="ts">
  import { labelAccess, labelActionText } from '../lib/labels';
  import type { Product } from '../lib/types';

  let { product }: { product: Product } = $props();
  const action = $derived(labelActionText(product, labelAccess(product)));
</script>

<a
  class="label-action"
  data-label-link={product.id}
  href={action.href}
  target="_blank"
  rel="noopener noreferrer"
  aria-label={action.ariaLabel}
>
  {action.title}<span aria-hidden="true">↗</span>
</a>
