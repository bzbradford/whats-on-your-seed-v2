<script lang="ts" module>
  // Legacy `icon(name)`: a reference into the inline sprite (IconSprite.svelte).
  export type IconName =
    | 'search'
    | 'seed'
    | 'compare'
    | 'flask'
    | 'book'
    | 'source'
    | 'arrow'
    | 'download'
    | 'fungus'
    | 'bug'
    | 'worm'
    | 'print';
</script>

<script lang="ts">
  let { name }: { name: IconName } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
  <use href="#icon-{name}"></use>
</svg>
