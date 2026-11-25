<script lang="ts">
  import { labelAccess, labelActionText } from '../lib/labels';
  import type { Product } from '../lib/types';
  import Icon from './Icon.svelte';

  let { product }: { product: Product } = $props();
  const access = $derived(labelAccess(product));
  const action = $derived(labelActionText(product, access));
</script>

<a
  class="label-action"
  data-label-link={product.id}
  href={action.href}
  target="_blank"
  rel="noopener noreferrer"
  aria-label={action.ariaLabel}
>
  <Icon name={access.pdf ? 'download' : 'search'} />{action.title}<span aria-hidden="true">↗</span>
</a>
