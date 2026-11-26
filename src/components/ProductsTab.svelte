<script lang="ts">
  import { tick, untrack } from 'svelte';
  import { focusById } from '../lib/app-state.svelte';
  import { getApp } from '../lib/context';
  import {
    downloadCsv,
    exportFileNames,
    exportToasts,
    labelLinksCsv,
    resultsCsv,
  } from '../lib/csv';
  import {
    DATE_ERROR,
    RUP_LABELS,
    SORTS,
    appliedFilters,
    clearChip,
    defaultEnd,
    siteSummary,
    type AppliedChip,
  } from '../lib/filters';
  import { epaDataAsOf } from '../lib/currency';
  import { fmt, localDate } from '../lib/format';
  import { printCurrentView } from '../lib/print';
  import { DESKTOP, flowKeeper, onScrollFrame, publishPinnedHeight } from '../lib/sticky';
  import { Accordion } from 'bits-ui';
  import FilterSelect, { type SelectOption } from './FilterSelect.svelte';
  import Icon from './Icon.svelte';
  import DownloadMenu from './DownloadMenu.svelte';
  import ProductCard from './ProductCard.svelte';
  import ProductList from './ProductList.svelte';
  import ViewToggle from './ViewToggle.svelte';

  const app = getApp();

  // Sticky stack (desktop): the search and toolbar row pin under the tab bar, as one
  // compact row while pinned. Phones pin only the tab bar.
  let headEl: HTMLElement | undefined = $state();
  let headSentinel: HTMLElement | undefined = $state();
  let headPinned = $state(false);
  $effect(() => {
    if (!headEl || !headSentinel) return;
    const sentinel = headSentinel;
    const desktop = matchMedia(DESKTOP);
    const tabsBottom = () =>
      document.querySelector('.tabs.stuck')?.getBoundingClientRect().bottom ?? 0;
    const stopKeeper = flowKeeper(headEl, 'pinned');
    const height = publishPinnedHeight(headEl, '--head-h', 'pinned', () => desktop.matches);
    headHeight = height;
    const stopScroll = onScrollFrame(
      () =>
        (headPinned =
          desktop.matches &&
          sentinel.offsetParent !== null &&
          sentinel.getBoundingClientRect().top < tabsBottom()),
    );
    return () => {
      stopKeeper();
      height.destroy();
      stopScroll();
    };
  });
  let headHeight: ReturnType<typeof publishPinnedHeight> | undefined;
  $effect(() => {
    // Leaving or returning to the products tab: the head stops or starts counting.
    void app.view;
    queueMicrotask(() => headHeight?.update());
  });

  const opts = (values: string[]): SelectOption[] => values.map((v) => ({ value: v, label: v }));
  const SIGNAL_OPTIONS: SelectOption[] = [
    { value: 'DANGER', label: 'DANGER' },
    { value: 'WARNING', label: 'WARNING' },
    { value: 'CAUTION', label: 'CAUTION' },
    { value: 'NONE', label: 'None reported by EPA' },
    { value: 'NOT_SUPPLIED', label: 'Not supplied / needs review' },
  ];
  const RUP_OPTIONS: SelectOption[] = Object.entries(RUP_LABELS).map(([value, label]) => ({
    value,
    label,
  }));
  const QUALITY_OPTIONS: SelectOption[] = [
    { value: 'verified', label: 'EPA row · complete percentages' },
    { value: 'base-linked', label: 'Related base formulation' },
    { value: 'needs-review', label: 'Needs review / missing fields' },
  ];
  const SORT_OPTIONS: SelectOption[] = Object.entries(SORTS).map(([value, sort]) => ({
    value,
    label: sort.label,
  }));
  const ready = $derived(app.loadState === 'ready');
  const n = $derived(app.result.products.length);
  const today = localDate();

  let resultsEl: HTMLDivElement | undefined = $state();
  let filtersEl: HTMLElement | undefined = $state();

  // ---- live announcements and focus restore (legacy render()) --------------

  $effect(() => {
    if (!ready) return;
    const { invalidDates } = app.result;
    const message =
      app.count +
      (n ? '. Showing ' + app.pageInfo.label : '. Try a broader search or reset your filters.');
    untrack(() => {
      if (invalidDates) {
        app.announcer.announce(DATE_ERROR, true);
        return;
      }
      app.announcer.clearAlert();
      if (app.view === 'products') app.announcer.announce(message);
    });
  });

  // If the focused result control disappears on re-render, focus the result count.
  let resultsHadFocus = false;
  $effect.pre(() => {
    void app.pageProducts;
    void app.result;
    resultsHadFocus = !!resultsEl?.contains(document.activeElement);
  });
  $effect(() => {
    void app.pageProducts;
    void app.result;
    if (resultsHadFocus && !resultsEl?.contains(document.activeElement))
      focusById('count', { preventScroll: true });
  });

  // ---- handlers --------------------------------------------------------------

  function onSiteChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const current = app.filters.sites;
    app.filters.sites = app.catalog.scope.sites.filter((site) =>
      site === input.value ? input.checked : current.includes(site),
    );
  }

  function setFiltersOpen(open: boolean) {
    app.filtersOpen = open;
    // The class toggles synchronously in legacy; focus after Svelte updates the DOM.
    queueMicrotask(() => focusById(open ? 'filter-title' : 'mobile-filter'));
  }

  function onFiltersKeydown(event: KeyboardEvent) {
    // Oct 19: Escape closes the filter drawer only at mobile widths, where it is a drawer.
    if (event.key === 'Escape' && matchMedia('(max-width:700px)').matches && app.filtersOpen) {
      event.preventDefault();
      setFiltersOpen(false);
    }
  }

  $effect(() => {
    const query = matchMedia('(max-width:700px)');
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches && !app.filtersOpen && filtersEl?.contains(document.activeElement))
        focusById('mobile-filter');
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  });

  function exportResults() {
    downloadCsv(resultsCsv(app.catalog, app.result.products), exportFileNames.results());
    app.showToast(exportToasts.results(n));
  }

  function exportLabels() {
    if (!n) return;
    downloadCsv(labelLinksCsv(app.result.products), exportFileNames.labels());
    app.showToast(exportToasts.labels(n));
  }

  const chips = $derived(appliedFilters(app.filters, defaultEnd(app.catalog)));

  /** Clear one applied filter; keep keyboard focus in the chip row (or the result count). */
  async function removeChip(chip: AppliedChip, index: number) {
    app.filters = clearChip(app.filters, chip.key, defaultEnd(app.catalog));
    await tick();
    const remaining = document.querySelectorAll<HTMLButtonElement>('#applied .chip');
    (remaining[Math.min(index, remaining.length - 1)] ?? document.getElementById('count'))?.focus();
  }

  function goToPage(page: number) {
    app.page = page;
    focusById('count');
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="products"
  role="tabpanel"
  tabindex="0"
  aria-labelledby="tab-products"
  hidden={app.view !== 'products'}
>
  <div class="section-intro">
    <h2>Explore seed treatments</h2>
    <p>
      Start with a product name or a crop. Select <strong>Compare</strong> on any product to build your
      side-by-side view.
    </p>
  </div>
  <details class="label-about">
    <summary>About label links</summary>
    <p id="label-help" class="small muted label-help">
      <strong>EPA-accepted label (PDF)</strong> opens EPA’s file for that exact registration: EPA’s
      acceptance letter first, then the EPA-accepted master label, which can differ from the label
      on the container. <strong>Find product label</strong> opens EPA’s label search where there is
      no direct file (distributor products: search the full EPA number, or ask the registrant for
      the marketed label). Newer supplemental labeling is linked separately. Each product’s details
      give its file date. PDFs need an internet connection.
      <strong>Export label links</strong> saves a CSV for all matching products across every page.
    </p>
  </details>
  <button
    id="mobile-filter"
    class="mobile-filters"
    aria-expanded={app.filtersOpen}
    aria-controls="filters"
    onclick={() => setFiltersOpen(!app.filtersOpen)}
  >
    {app.filtersOpen ? 'Hide filters' : 'Show filters'}
  </button>
  <div class="workspace">
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <aside
      class="filter {app.filtersOpen ? 'open' : ''}"
      id="filters"
      aria-label="Product filters"
      bind:this={filtersEl}
      onkeydown={onFiltersKeydown}
    >
      <div class="filter-title">
        <h2 id="filter-title" tabindex="-1">Refine your search</h2>
        <button
          class="quiet small"
          id="reset"
          aria-label="Reset all product filters and search"
          onclick={() => app.reset()}
        >
          Reset
        </button>
      </div>
      <!-- Deviation (user decision): no state registration filter (legacy details.state-filters). -->
      <fieldset class="filter-group">
        <legend>Crop &amp; location</legend>
        <div class="field">
          <span id="crop-label">Crop / EPA site</span>
          <details class="site-picker">
            <summary id="site-summary" aria-describedby="crop-label">
              {siteSummary(app.filters.sites)}
            </summary>
            <div class="site-options" id="site-options" role="group" aria-labelledby="crop-label">
              {#each app.catalog.scope.sites as site (site)}
                <label class="check">
                  <input
                    type="checkbox"
                    value={site}
                    checked={app.filters.sites.includes(site)}
                    onchange={onSiteChange}
                  /><span>{site}</span>
                </label>
              {/each}
            </div>
          </details>
        </div>
      </fieldset>
      <fieldset class="filter-group">
        <legend>Treatment purpose</legend>
        <FilterSelect
          id="purpose"
          label="EPA product purpose"
          allLabel="All purposes"
          options={opts(ready ? app.options.purpose : [])}
          bind:value={app.filters.purpose}
        />
        <FilterSelect
          id="technology"
          label="Technology type"
          allLabel="All technologies"
          options={opts(app.options.technology)}
          bind:value={app.filters.technology}
        />
      </fieldset>
      <Accordion.Root type="multiple" class="filter-accordion">
        <Accordion.Item value="groups" class="filter-section">
          <Accordion.Header level={3}>
            <Accordion.Trigger class="filter-section-trigger">
              Groups &amp; EPA hazards
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content class="filter-section-content">
            <FilterSelect
              id="frac"
              label="FRAC fungicide group"
              allLabel="All FRAC groups"
              options={opts(app.options.frac)}
              bind:value={app.filters.frac}
            />
            <FilterSelect
              id="irac"
              label="IRAC insecticide group"
              allLabel="All IRAC groups"
              options={opts(app.options.irac)}
              bind:value={app.filters.irac}
            />
            <FilterSelect
              id="signal"
              label="EPA signal word"
              allLabel="All signal words"
              options={SIGNAL_OPTIONS}
              bind:value={app.filters.signal}
            />
            <FilterSelect
              id="rup"
              label="EPA restricted-use flag"
              allLabel="All flags"
              options={RUP_OPTIONS}
              bind:value={app.filters.rup}
            />
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="records" class="filter-section record-filters">
          <Accordion.Header level={3}>
            <Accordion.Trigger class="filter-section-trigger">
              Company &amp; ingredient evidence
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content class="filter-section-content">
            <FilterSelect
              id="manufacturer"
              label="Registrant / manufacturer"
              allLabel="All companies"
              options={opts(app.options.manufacturer)}
              bind:value={app.filters.manufacturer}
            />
            <FilterSelect
              id="quality"
              label="Ingredient data"
              allLabel="All records"
              options={QUALITY_OPTIONS}
              bind:value={app.filters.quality}
            />
          </Accordion.Content>
        </Accordion.Item>
        <Accordion.Item value="dates" class="filter-section">
          <Accordion.Header level={3}>
            <Accordion.Trigger class="filter-section-trigger">
              Registration status &amp; dates
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content class="filter-section-content">
            <label class="field">
              <span>Status group</span><input value="Active Products" disabled />
            </label><label class="field">
              <span>Status date – start</span><input
                type="date"
                id="start"
                max={today}
                aria-describedby="date-help date-error"
                aria-invalid={app.result.invalidDates ? 'true' : undefined}
                bind:value={app.filters.start}
              />
            </label><label class="field">
              <span>Status date – end</span><input
                type="date"
                id="end"
                max={today}
                aria-describedby="date-help date-error"
                aria-invalid={app.result.invalidDates ? 'true' : undefined}
                bind:value={app.filters.end}
              />
            </label>
            <p class="small muted" id="date-help">
              {ready
                ? 'Uses EPA STATUS_DT. Blank start; end is the import cutoff. Changing this filter does not retrieve newer EPA records.'
                : 'Start is blank; end defaults to today. Uses EPA status dates.'}
            </p>
            <p id="date-error" class="field-error" hidden={!app.result.invalidDates}>
              {app.result.invalidDates ? DATE_ERROR : ''}
            </p>
          </Accordion.Content>
        </Accordion.Item>
      </Accordion.Root>
      <div class="side-note">
        <strong>Seed treatment only.</strong> Grain-storage-only products and all deltamethrin products
        are excluded. Crop groups are not expanded into unverified uses.
      </div>
      <button
        id="apply-filters"
        class="solid mobile-filters"
        onclick={() => {
          app.filtersOpen = false;
          focusById('count');
        }}
      >
        Show results
      </button>
    </aside>
    <div class="results-column">
      <div class="head-sentinel" aria-hidden="true" bind:this={headSentinel}></div>
      <div class="results-head" class:pinned={headPinned} bind:this={headEl}>
        <div class="toolbar">
          <div class="search">
            <label for="query">Search products and ingredients</label><span aria-hidden="true">
              <Icon name="search" />
            </span><input
              id="query"
              type="search"
              placeholder="Search a product, active ingredient, or EPA number…"
              bind:value={app.filters.query}
            />
          </div>
        </div>
        <div class="result-heading">
          <h3 id="count" tabindex="-1">
            {app.loadState === 'unavailable' ? 'No live catalog' : ready ? app.count : ''}
          </h3>
          {#if ready && !app.result.invalidDates}<span class="result-meta">
              · EPA data as of {fmt(epaDataAsOf(app.catalog))}
            </span>{/if}
          <div class="result-controls">
            <ViewToggle />
            <FilterSelect
              id="sort"
              label="Sort"
              inline
              options={SORT_OPTIONS}
              bind:value={app.filters.sort as string}
            />
            <DownloadMenu
              canExport={ready && n > 0}
              onResults={exportResults}
              onLabels={exportLabels}
              onPrint={() => printCurrentView(app.view)}
            />
          </div>
        </div>
      </div>
      <div id="applied" class="applied" role="group" aria-label="Applied product filters">
        {#if ready && !app.result.invalidDates}
          {#each chips as chip, i (chip.label)}<button
              type="button"
              class="chip removable"
              aria-label="Remove filter: {chip.label}"
              onclick={() => removeChip(chip, i)}
            >
              {chip.label}<span aria-hidden="true">×</span>
            </button>{/each}
        {/if}
      </div>
      <div id="results" role="region" aria-labelledby="count" bind:this={resultsEl}>
        {#if app.loadState === 'unavailable'}
          <div class="empty">
            <h3>Source connection required</h3>
            <p class="muted">Connect and validate the EPA source to publish the catalog.</p>
          </div>
        {:else if !ready}
          <!-- loading -->
        {:else if app.result.invalidDates}
          <div class="empty">
            <h3>Start date is after end date.</h3>
            <p>Choose a valid status-date range.</p>
          </div>
        {:else}
          {#if app.pageProducts.length && app.productView === 'list'}
            <ProductList products={app.pageProducts} />
          {:else}
            {#each app.pageProducts as p (p.id)}
              <ProductCard product={p} />
            {:else}
              <div class="empty">
                <h3>No matching products.</h3>
                <p class="muted">Try a broader search or reset your filters.</p>
                <button
                  data-reset
                  onclick={() => {
                    app.reset();
                    focusById('query');
                  }}
                >
                  Reset filters
                </button>
                <!-- Deviation: Oct 19 also pointed at the state-evidence filter, which isn't ported. -->
                <p class="small muted">
                  An empty result does not prove a product is unavailable or unregistered. Check the
                  current label and relevant state authority before use.
                </p>
              </div>
            {/each}
          {/if}
        {/if}
      </div>
      <nav
        id="pager"
        class="pager"
        aria-label="Product result pages"
        hidden={!ready || app.result.invalidDates || !n}
      >
        <button
          id="page-prev"
          disabled={app.pageInfo.page <= 1}
          onclick={() => goToPage(Math.max(1, app.page - 1))}
        >
          ← Previous
        </button><span id="page-label">{ready ? app.pageInfo.label : ''}</span><button
          id="page-next"
          disabled={app.pageInfo.page >= app.pageInfo.pages}
          onclick={() => goToPage(app.page + 1)}
        >
          Next →
        </button>
      </nav>
    </div>
  </div>
</section>

<style>
  /* Print this view: the Oct 19 print CSS hides the whole workspace; print the results. */
  @media print {
    .workspace {
      display: block !important;
    }
    .filter,
    .toolbar,
    .label-help,
    .pager,
    .mobile-filters {
      display: none !important;
    }
  }

  /* Applied-filter chips are buttons that remove their filter; keep the Oct 19 chip look. */
  .applied .chip.removable {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 32px;
    padding: 4px 10px;
    font-weight: 400;
    color: #354936;
    background: #edf1e8;
    border: 1px solid #d0dbc7;
    border-radius: 5px;
  }
  .applied .chip.removable:hover {
    background: #e2eadb;
    border-color: #99b59e;
  }
  .applied .chip.removable span {
    font-size: 1rem;
    line-height: 1;
  }
  @media print {
    .applied .chip.removable span {
      display: none;
    }
  }
  .result-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
  }
  /*
   * 4a.3: the filter sidebar stays in view on desktop (scrolling inside itself when it is
   * taller than the window, and clear of the compare tray); on phones the "Show filters"
   * button is pinned to the bottom of the screen, above the compare tray.
   */
  @media screen and (min-width: 701px) {
    .filter {
      position: sticky;
      top: calc(var(--tabs-h, 51px) + var(--head-h, 58px) + 12px);
      max-height: calc(
        100vh - var(--tabs-h, 51px) - var(--head-h, 58px) - 24px - var(--comparison-clearance, 0px)
      );
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    /* Search + toolbar row: pinned under the tab bar. */
    .results-head {
      position: sticky;
      top: var(--tabs-h, 51px);
      z-index: 20;
      background: var(--paper);
    }
    .results-head.pinned {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 14px;
      padding: 6px 0 8px;
      box-shadow: 0 8px 10px -10px #233b2d40;
    }
    .results-head.pinned .toolbar {
      flex: 1 1 13rem;
      min-width: 0;
    }
    .results-head.pinned .toolbar label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .results-head.pinned .toolbar input {
      min-height: 40px;
      padding-block: 6px;
    }
    .results-head.pinned .toolbar :global(.icon) {
      margin-bottom: -3px;
    }
    .results-head.pinned .result-heading {
      flex: 0 1 auto;
      margin: 0;
    }
    .results-head.pinned .result-meta {
      display: none;
    }
    .results-head.pinned :global(.select-trigger) {
      min-width: 10rem;
      min-height: 40px;
    }
  }
  @media screen and (max-width: 700px) {
    #mobile-filter {
      position: fixed;
      z-index: 9;
      left: 16px;
      right: 16px;
      bottom: calc(12px + var(--comparison-clearance, 0px));
      width: auto;
      margin: 0;
      background: var(--green-dark);
      border-color: var(--green-dark);
      color: #fff;
      box-shadow: 0 4px 16px #122b3340;
    }
  }
  .result-meta {
    margin-right: auto;
    color: var(--muted);
    font-size: 0.875rem;
  }
  /* Filter groups (Bits UI Accordion), styled like the legacy disclosures they replace. */
  .filter :global(.filter-section) {
    margin-top: 16px;
    padding-top: 6px;
    border-top: 1px solid var(--line);
  }
  .filter :global(.filter-section h3) {
    margin: 0;
    font: inherit;
  }
  .filter :global(.filter-section-trigger) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 44px;
    padding: 8px 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--ink);
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.5;
    text-align: left;
  }
  .filter :global(.filter-section-trigger:hover:not(:disabled)) {
    background: transparent;
    color: var(--green-dark);
  }
  .filter :global(.filter-section-trigger)::before {
    content: '';
    flex: none;
    width: 0;
    height: 0;
    border-block: 5px solid transparent;
    border-left: 7px solid currentColor;
    transition: transform 0.15s;
  }
  .filter :global(.filter-section-trigger[data-state='open'])::before {
    transform: rotate(90deg);
  }
  .filter :global(.filter-section-content) {
    padding-bottom: 6px;
  }
  .filter :global(.select-field) {
    margin: 12px 0;
  }
  /* 4a follow-up 2: the label explanation is a one-line disclosure (open when printing). */
  .label-about {
    margin: -6px 0 14px;
  }
  .label-about summary {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    list-style: none;
    min-height: 44px;
    color: var(--green-dark);
    font-size: 0.9375rem;
    font-weight: 600;
    cursor: pointer;
  }
  .label-about summary::-webkit-details-marker {
    display: none;
  }
  .label-about summary::before {
    content: '';
    border-block: 5px solid transparent;
    border-left: 7px solid currentColor;
    transition: transform 0.15s;
  }
  .label-about[open] summary::before {
    transform: rotate(90deg);
  }
  .label-about .label-help {
    max-width: 80ch;
    margin: 0 0 8px;
  }
  @media print {
    .label-about .label-help {
      display: block !important;
    }
  }
</style>
