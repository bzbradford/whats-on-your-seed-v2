<script lang="ts">
  import { labelAccess, labelActionText } from '../lib/labels';
  import type { Product } from '../lib/types';
  import Icon from './Icon.svelte';

  // `compact`: shorter visible text for the List view (the accessible name stays full).
  let { product, compact = false }: { product: Product; compact?: boolean } = $props();
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
  <Icon name={access.pdf ? 'download' : 'search'} />{compact
    ? access.pdf
      ? 'EPA label (PDF)'
      : 'Find label'
    : action.title}<span aria-hidden="true">↗</span>
</a>
