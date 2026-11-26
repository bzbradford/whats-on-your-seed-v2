<script lang="ts">
  import { Tooltip } from 'bits-ui';
  import type { Snippet } from 'svelte';

  // A short explanation for a terse List column header (Bits UI Tooltip). It opens on
  // hover and keyboard focus and describes the trigger (aria-describedby) while open.
  // The trigger is the header's own button, or a focusable span for plain headers.
  let {
    tip,
    children,
    asButton = false,
    onclick,
    buttonClass = '',
    dataSortColumn,
  }: {
    tip: string;
    children: Snippet;
    asButton?: boolean;
    onclick?: () => void;
    buttonClass?: string;
    dataSortColumn?: string;
  } = $props();
</script>

<Tooltip.Root delayDuration={300}>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      {#if asButton}
        <button
          {...props}
          type="button"
          class={buttonClass}
          data-sort-column={dataSortColumn}
          {onclick}
        >
          {@render children()}
        </button>
      {:else}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <span {...props} class="tip-text" tabindex="0">{@render children()}</span>
      {/if}
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content class="header-tip" sideOffset={6}>{tip}</Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>

<style>
  .tip-text {
    text-decoration: underline dotted;
    text-underline-offset: 3px;
    cursor: help;
  }
  :global(.header-tip) {
    z-index: 70;
    max-width: 18rem;
    padding: 8px 10px;
    border-radius: 6px;
    background: #173e25;
    color: #fff;
    font: 0.8125rem/1.5 var(--font-body);
    box-shadow: 0 6px 20px #122b3340;
  }
</style>
