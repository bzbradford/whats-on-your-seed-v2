<script lang="ts">
  import { getApp } from '../lib/context';
  import { ariaSort, columnSort, type SortColumn } from '../lib/filters';
  import { cropFamilies, fmt, shortSite } from '../lib/format';
  import { labelAccess } from '../lib/labels';
  import { moaGroups, signalClass, signalText } from '../lib/product-facts';
  import type { Product } from '../lib/types';
  import ExtLink from './ExtLink.svelte';
  import LabelAction from './LabelAction.svelte';

  // List view: one dense row per product. The product name button is the keyboard path
  // to the detail dialog; clicking elsewhere on a row is a mouse shortcut to it.
  let { products }: { products: Product[] } = $props();
  const app = getApp();
  const reference = $derived(app.catalog.ingredient_reference);
  /**
   * Up to four ingredients are listed; longer lists (mostly stacked Bt traits) show three
   * and count the rest ("+3 more"), which the dialog lists in full.
   */
  const shown = (p: Product) => (p.ingredients.length > 4 ? 3 : p.ingredients.length);

  const COLUMNS: { key: SortColumn | null; label: string; className: string }[] = [
    { key: 'name', label: 'Product', className: 'col-product' },
    { key: 'ingredient', label: 'Active ingredients', className: 'col-ingredients' },
    { key: 'purpose', label: 'Purpose', className: 'col-purpose' },
    { key: 'signal', label: 'Signal / RUP', className: 'col-signal' },
    { key: null, label: 'FRAC / IRAC', className: 'col-groups' },
    { key: null, label: 'Crops', className: 'col-crops' },
    { key: null, label: 'Label', className: 'col-label' },
    { key: null, label: 'Compare', className: 'col-compare' },
  ];

  function groups(p: Product): string {
    const frac = moaGroups(reference, p, 'frac');
    const irac = moaGroups(reference, p, 'irac');
    return [
      frac.length ? 'FRAC ' + frac.join(', ') : '',
      irac.length ? 'IRAC ' + irac.join(', ') : '',
    ]
      .filter(Boolean)
      .join(' · ');
  }

  function onRowClick(event: MouseEvent, p: Product) {
    const target = event.target as HTMLElement;
    if (target.closest('a, button, input, label')) return;
    if (window.getSelection()?.toString()) return; // let people select text
    app.openDialog({ kind: 'product', id: p.id });
  }

  function onCompareChange(event: Event, p: Product) {
    const input = event.currentTarget as HTMLInputElement;
    if (!app.setComparison(p.id, input.checked)) input.checked = app.selected.includes(p.id);
  }
</script>

<table class="product-list">
  <caption class="sr-only">
    Products, {app.pageInfo.label}. Select a product name for its full record.
  </caption>
  <thead>
    <tr>
      {#each COLUMNS as col (col.label)}
        <th
          scope="col"
          class={col.className}
          aria-sort={col.key ? ariaSort(app.filters.sort, col.key) : undefined}
        >
          {#if col.key}
            {@const key = col.key}
            <button
              type="button"
              class="sort-button"
              data-sort-column={key}
              onclick={() => (app.filters.sort = columnSort(app.filters.sort, key))}
            >
              {col.label}<span class="sort-mark" aria-hidden="true">
                {ariaSort(app.filters.sort, key) === 'ascending'
                  ? '▲'
                  : ariaSort(app.filters.sort, key) === 'descending'
                    ? '▼'
                    : '↕'}
              </span>
            </button>
          {:else}
            {col.label}
          {/if}
        </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each products as p (p.id)}
      {@const selected = app.selected.includes(p.id)}
      {@const access = labelAccess(p)}
      {@const g = groups(p)}
      <tr class="product-row" class:selected onclick={(e) => onRowClick(e, p)}>
        <th scope="row" class="col-product">
          <button
            class="row-name"
            aria-haspopup="dialog"
            data-detail={p.id}
            onclick={() => app.openDialog({ kind: 'product', id: p.id })}
          >
            {p.name}
          </button>
          <span class="row-sub">{p.registrant} · EPA {p.registration_number}</span>
        </th>
        <td class="col-ingredients">
          {#each p.ingredients.slice(0, shown(p)) as a, i (i)}
            <span class="row-ingredient">
              <span class="row-ingredient-name" title={a.name}>
                {a.name}
              </span>{#if a.percent != null}<span class="pct">{a.percent}%</span>{/if}
            </span>
          {:else}
            <span class="muted">Not in source entry</span>
          {/each}
          {#if p.ingredients.length > shown(p)}<span class="row-more">
              +{p.ingredients.length - shown(p)} more
            </span>{/if}
        </td>
        <td class="col-purpose">
          {#each p.purposes as purpose (purpose)}<span class="row-purpose">{purpose}</span>{/each}
        </td>
        <td class="col-signal">
          <span class="row-signal {signalClass(p)}">{signalText(p)}</span>
          {#if p.safety?.restricted_use === true}<span class="row-rup">Restricted use</span>{/if}
        </td>
        <td class="col-groups" data-label="FRAC/IRAC">
          {#if g}{g}{:else}<span class="none" aria-label="None assigned">—</span>{/if}
        </td>
        <td class="col-crops" data-label="Crops" title={p.sites.map(shortSite).join('; ')}>
          {cropFamilies(p.sites).join(', ')}
        </td>
        <td class="col-label">
          <LabelAction product={p} compact />
          {#each access.supplemental as s (s.url)}<span class="label-supplemental">
              <ExtLink url={s.url} text={'Supplemental · ' + fmt(s.date)} />
            </span>{/each}
        </td>
        <td class="col-compare">
          <label class="row-compare">
            <input
              type="checkbox"
              data-select={p.id}
              checked={selected}
              aria-label="Compare {p.name}, EPA {p.registration_number}"
              onchange={(e) => onCompareChange(e, p)}
            /><span>Compare</span>
          </label>
        </td>
      </tr>
    {/each}
  </tbody>
</table>

<style>
  .product-list {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    table-layout: fixed;
    font-size: 0.875rem;
    background: #fff;
    border: 1px solid #d5ded0;
    border-radius: 10px;
  }
  .product-list th,
  .product-list td {
    padding: 10px 8px;
    border-bottom: 1px solid #e5e9df;
    vertical-align: top;
    text-align: left;
    overflow-wrap: anywhere;
  }
  /* Sticky column headers (relative to the page). */
  .product-list thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: #25472f;
    color: #fff;
    font-weight: 600;
    font-size: 0.8125rem;
    white-space: normal;
  }
  .product-list thead th:first-child {
    border-top-left-radius: 9px;
  }
  .product-list thead th:last-child {
    border-top-right-radius: 9px;
  }
  .col-product {
    width: 20%;
  }
  .col-ingredients {
    width: 23%;
  }
  .col-purpose {
    width: 11%;
  }
  .col-signal {
    width: 9%;
  }
  .col-groups {
    width: 8%;
  }
  .col-crops {
    width: 10%;
  }
  .col-label {
    width: 11%;
  }
  .col-compare {
    width: 8%;
  }
  .sort-button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 2px 4px;
    margin: -2px -4px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
  }
  .sort-button:hover:not(:disabled) {
    background: #33593d;
  }
  .sort-mark {
    font-size: 0.6875rem;
    opacity: 0.85;
  }
  .product-row {
    cursor: pointer;
  }
  .product-row:hover > :global(*) {
    background: #f4f6ef;
  }
  .product-row.selected > :global(*) {
    background: #e7efdf;
  }
  .product-list tbody th {
    background: #fff;
    font-weight: 400;
  }
  .row-name {
    display: block;
    min-height: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--green-dark);
    font: 700 1.0625rem/1.25 var(--font-heading);
    text-align: left;
    text-decoration: underline;
    text-decoration-color: transparent;
    text-underline-offset: 3px;
  }
  .row-name:hover:not(:disabled) {
    background: none;
    text-decoration-color: currentColor;
  }
  .row-sub {
    display: block;
    margin-top: 2px;
    font-size: 0.8125rem;
    color: var(--muted);
  }
  .row-ingredient {
    display: flex;
    gap: 6px;
    align-items: baseline;
  }
  /* Long plant-incorporated-protectant names: two lines, full name in the title/dialog. */
  .row-ingredient-name {
    display: -webkit-box;
    min-width: 0;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
  }
  .row-ingredient .pct {
    flex: none;
    font-weight: 700;
    white-space: nowrap;
  }
  .row-more,
  .row-purpose {
    display: block;
    font-size: 0.8125rem;
  }
  .row-more {
    color: var(--muted);
  }
  .product-list thead th.col-compare {
    overflow-wrap: normal;
  }
  .row-signal {
    display: block;
    font-weight: 600;
  }
  .row-signal.danger {
    color: #8b1e13;
  }
  .row-signal.warning {
    color: #764100;
  }
  .row-rup {
    display: inline-block;
    margin-top: 4px;
    padding: 1px 6px;
    border: 1px solid #bf9958;
    border-radius: 4px;
    background: #fff5df;
    color: #764100;
    font-size: 0.75rem;
    font-weight: 600;
  }
  .col-crops,
  .col-groups {
    font-size: 0.8125rem;
    color: #354936;
  }
  .col-label :global(.label-action) {
    display: inline;
    min-height: 0;
    padding: 0;
    border: 0;
    background: none;
    font-size: 0.8125rem;
    line-height: 1.5;
  }
  .col-label :global(.label-action .icon) {
    width: 14px;
    height: 14px;
    margin-right: 4px;
  }
  .label-supplemental {
    display: block;
    margin-top: 4px;
    font-size: 0.75rem;
  }
  .row-compare {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    min-height: 44px;
    font-size: 0.75rem;
    color: var(--green-dark);
    cursor: pointer;
  }
  .row-compare input {
    width: 20px;
    height: 20px;
    margin: 0;
    accent-color: var(--green);
  }

  /* Phones: each row becomes a compact stacked block; sort with the Sort menu. */
  @media (max-width: 700px) {
    .product-list,
    .product-list tbody,
    .product-list tr,
    .product-list th,
    .product-list td {
      display: block;
      width: auto;
    }
    .product-list {
      border: 0;
      background: transparent;
    }
    .product-list thead {
      display: none;
    }
    .product-list .product-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px 12px;
      margin-bottom: 10px;
      padding: 12px;
      background: #fff;
      border: 1px solid #d5ded0;
      border-radius: 8px;
    }
    .product-list .product-row > :global(*) {
      grid-column: 1;
      padding: 0;
      border: 0;
      background: transparent;
    }
    .product-list .product-row > .col-compare {
      grid-column: 2;
      grid-row: 1;
    }
    .product-list .product-row > .col-signal,
    .product-list .product-row > .col-purpose {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      align-items: center;
    }
    .product-list .product-row > .col-groups:has(.none) {
      display: none;
    }
    .row-signal {
      display: inline;
    }
    .row-rup {
      margin-top: 0;
    }
    .row-purpose {
      display: inline;
    }
    .row-purpose + .row-purpose::before {
      content: '· ';
    }
    [data-label]::before {
      content: attr(data-label) ': ';
      font-weight: 600;
      color: var(--ink);
    }
    .product-list .product-row.selected {
      background: #e7efdf;
      border-color: var(--green);
    }
  }
</style>
