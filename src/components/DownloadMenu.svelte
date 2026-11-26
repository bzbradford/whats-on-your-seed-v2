<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import Icon from './Icon.svelte';

  // "Download ▾" (Bits UI DropdownMenu): the results CSV, the label-links CSV and printing,
  // in one compact control on the results toolbar row. The items keep the ids the old
  // buttons had (#export, #export-labels, #print-results).
  let {
    canExport,
    onResults,
    onLabels,
    onPrint,
  }: {
    /** False before the catalog loads and when nothing matches. */
    canExport: boolean;
    onResults: () => void;
    onLabels: () => void;
    onPrint: () => void;
  } = $props();
</script>

<span class="download">
  <DropdownMenu.Root>
    <DropdownMenu.Trigger id="download-menu" class="download-trigger">
      <Icon name="download" />Download<span class="chevron" aria-hidden="true"></span>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content class="download-content" align="end" sideOffset={4}>
        <DropdownMenu.Item
          id="export"
          class="download-item"
          disabled={!canExport}
          onSelect={onResults}
        >
          <Icon name="download" /><span>
            Results (CSV)<small>All matching products, with sources</small>
          </span>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          id="export-labels"
          class="download-item"
          disabled={!canExport}
          aria-describedby="label-help"
          onSelect={onLabels}
        >
          <Icon name="download" /><span>
            Label links (CSV)<small>EPA label PDF or lookup for every match</small>
          </span>
        </DropdownMenu.Item>
        <DropdownMenu.Separator class="download-separator" />
        <DropdownMenu.Item id="print-results" class="download-item" onSelect={onPrint}>
          <Icon name="print" /><span>Print this view</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>
</span>

<style>
  .download :global(.download-trigger) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 40px;
    padding: 6px 12px;
    border: 1px solid #87967f;
    border-radius: 6px;
    background: #fff;
    color: var(--green-dark);
    font-size: 0.875rem;
    font-weight: 600;
  }
  .download :global(.download-trigger:hover:not(:disabled)),
  .download :global(.download-trigger[data-state='open']) {
    background: #edf1e8;
  }
  .download :global(.download-trigger .icon) {
    width: 18px;
    height: 18px;
  }
  .chevron {
    width: 7px;
    height: 7px;
    margin: 0 2px 3px;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    transform: rotate(45deg);
  }
  /* Portalled to <body>: global, uniquely named. */
  :global(.download-content) {
    z-index: 60;
    min-width: 15rem;
    padding: 4px;
    border: 1px solid #b7c8af;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 8px 28px #122b3330;
    font: 0.9375rem/1.4 var(--font-body);
    color: var(--ink);
  }
  :global(.download-item) {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-height: 44px;
    padding: 8px 10px;
    border-radius: 5px;
    cursor: pointer;
    outline: none;
  }
  :global(.download-item .icon) {
    flex: none;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    color: var(--green-dark);
  }
  :global(.download-item small) {
    display: block;
    color: var(--muted);
    font-size: 0.8125rem;
  }
  :global(.download-item[data-highlighted]) {
    background: #e7efdf;
    color: var(--green-dark);
  }
  :global(.download-item[data-disabled]) {
    opacity: 0.5;
    cursor: default;
  }
  :global(.download-separator) {
    height: 1px;
    margin: 4px 0;
    background: var(--line);
  }
  @media print {
    .download {
      display: none;
    }
  }
</style>
