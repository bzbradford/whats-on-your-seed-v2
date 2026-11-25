<script lang="ts">
  import { safeUrl } from '../lib/format';

  // Legacy `link()`: https only, new tab, with a visible arrow and screen-reader hint.
  let { url, text }: { url: string | null | undefined; text: string } = $props();
</script>

<a href={safeUrl(url)} target="_blank" rel="noopener noreferrer">
  {text} <span aria-hidden="true">↗</span><span class="sr-only"> (opens in a new tab)</span>
</a>
