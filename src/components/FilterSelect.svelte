<script lang="ts" module>
  export interface SelectOption {
    value: string;
    label: string;
  }
</script>

<script lang="ts">
  import { Select } from 'bits-ui';

  // A single-choice dropdown (Bits UI Select) in the CPN field style. The trigger is a
  // labelled combobox button; the list supports arrow keys, Home/End and type-ahead.
  // `allLabel` adds an "All …" choice that stands for the empty value.
  let {
    id,
    label,
    value = $bindable(),
    options,
    allLabel,
    inline = false,
  }: {
    id: string;
    label: string;
    value: string;
    options: SelectOption[];
    allLabel?: string;
    /** Label beside the trigger (the Sort control) instead of above it. */
    inline?: boolean;
  } = $props();

  /** Bits treats '' as "nothing selected", so the All choice uses a sentinel. */
  const ALL = '__all__';
  const items = $derived([
    ...(allLabel !== undefined ? [{ value: ALL, label: allLabel }] : []),
    ...options,
  ]);
  const internal = $derived(value === '' && allLabel !== undefined ? ALL : value);
  const selectedLabel = $derived(items.find((i) => i.value === internal)?.label ?? allLabel ?? '');
</script>

<div class="field select-field" class:inline>
  <label for={id}>{label}</label>
  <Select.Root
    type="single"
    {items}
    value={internal}
    onValueChange={(v) => (value = v === ALL ? '' : v)}
  >
    <Select.Trigger {id} class="select-trigger">
      <span class="select-value">{selectedLabel}</span><span class="chevron" aria-hidden="true"
      ></span>
    </Select.Trigger>
    <Select.Portal>
      <Select.Content class="select-content" sideOffset={4} collisionPadding={8}>
        <Select.Viewport class="select-viewport">
          {#each items as item (item.value)}
            <Select.Item value={item.value} label={item.label} class="select-item">
              {#snippet children({ selected })}
                <span class="select-check" aria-hidden="true">
                  {selected ? '✓' : ''}
                </span>{item.label}
              {/snippet}
            </Select.Item>
          {/each}
        </Select.Viewport>
      </Select.Content>
    </Select.Portal>
  </Select.Root>
</div>

<style>
  .select-field label {
    display: block;
    margin-bottom: 7px;
    font-weight: 600;
    color: var(--ink);
  }
  .select-field.inline {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
  .select-field.inline label {
    margin: 0;
    font-weight: 400;
    color: var(--muted);
    font-size: 0.875rem;
  }
  /* Trigger: looks like the legacy .field select (border, radius, chevron). */
  .select-field :global(.select-trigger) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 9px 10px;
    border: 1px solid var(--control-border);
    border-radius: 6px;
    background: #fff;
    color: var(--ink);
    font-size: 0.9375rem;
    font-weight: 400;
    text-align: left;
  }
  .select-field.inline :global(.select-trigger) {
    width: auto;
    min-width: 12rem;
    font-size: 0.875rem;
  }
  .select-field :global(.select-trigger:hover:not(:disabled)) {
    background: #f7f9f3;
    border-color: #4f6b4d;
  }
  .select-value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chevron {
    flex: none;
    width: 8px;
    height: 8px;
    margin: 0 2px 3px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg);
  }
  /* The list is portalled to <body>, so these are global but uniquely named. */
  :global(.select-content) {
    z-index: 60;
    min-width: var(--bits-select-anchor-width);
    max-width: min(32rem, calc(100vw - 16px));
    max-height: min(22rem, var(--bits-select-content-available-height));
    overflow: hidden;
    border: 1px solid #b7c8af;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 8px 28px #122b3330;
    font: 0.9375rem/1.4 var(--font-body);
    color: var(--ink);
  }
  :global(.select-viewport) {
    padding: 4px;
  }
  :global(.select-item) {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-height: 36px;
    padding: 8px 10px;
    border-radius: 5px;
    cursor: pointer;
    outline: none;
  }
  :global(.select-item[data-highlighted]) {
    background: #e7efdf;
    color: var(--green-dark);
  }
  :global(.select-item[data-selected]) {
    font-weight: 700;
  }
  .select-check {
    flex: none;
    width: 1em;
    color: var(--green-dark);
  }
</style>
