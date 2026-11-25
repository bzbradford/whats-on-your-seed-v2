<script lang="ts">
  import { onMount } from 'svelte';
  import logo from './assets/cpn-logo-2022.png';
  import seedPhoto from './assets/adam-sisson-treated-corn.jpg';
  import { AppState, type View } from './lib/app-state.svelte';
  import { setApp } from './lib/context';
  import {
    aboutDatesText,
    aboutUpdateModeText,
    catalogLastChanged,
    citationText,
    dataNote,
    epaDataAsOf,
    updateWarning,
  } from './lib/currency';
  import { fmt } from './lib/format';
  import ProductsTab from './components/ProductsTab.svelte';
  import MatrixTab from './components/MatrixTab.svelte';
  import ResourcesTab from './components/ResourcesTab.svelte';
  import Disclaimer from './components/Disclaimer.svelte';
  import CompareBar from './components/CompareBar.svelte';
  import DetailDialog from './components/DetailDialog.svelte';

  const app = setApp(
    new AppState({
      standalone: import.meta.env.MODE === 'standalone',
      baseUrl: import.meta.env.BASE_URL,
    }),
  );

  onMount(() => {
    void app.start();
  });

  const TABS: { id: View; label: string }[] = [
    { id: 'products', label: 'Products' },
    // One text node with its trailing space, as in legacy (split nodes shift glyphs).
    { id: 'matrix', label: 'Compare ' },
    { id: 'resources', label: 'Guides & sources' },
  ];

  const warning = $derived(updateWarning(app.flags, app.status));

  function onTabKeydown(event: KeyboardEvent) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    let index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    index =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? buttons.length - 1
          : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    void app.goTo(buttons[index].dataset.tab!);
    buttons[index].focus();
  }

  function skipToMain(event: MouseEvent) {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }
</script>

<a href="#main" class="jump" onclick={skipToMain}>Skip to database</a>
<header>
  <div class="shell top">
    <a
      class="brand"
      href="https://cropprotectionnetwork.org/"
      aria-label="Crop Protection Network home"
    >
      <img
        class="brand-logo"
        src={logo}
        width="678"
        height="272"
        alt="Crop Protection Network — A Product of Land Grant Universities"
      />
    </a><span class="tag" id="build-label">Seed treatment database</span>
  </div>
</header>
<section class="intro shell" aria-labelledby="page-title">
  <div>
    <h1 id="page-title">What’s on Your Seed?</h1>
    <p>
      Identify active ingredients in seed treatments and compare up to four products at a time. This
      resource helps farmers, crop advisers, Extension educators, researchers, and industry
      professionals make sense of product names and treatment components.
    </p>
    <p class="small muted">
      Product facts come from EPA’s APPRIL registration export. Other reference sources are
      identified separately.
    </p>
  </div>
  <figure class="seed-photo">
    <img
      src={seedPhoto}
      width="900"
      height="600"
      alt="Close-up of treated corn kernels with red and purple seed coatings."
    />
    <figcaption>Treated corn seed. Photo: Adam Sisson, Iowa State University.</figcaption>
  </figure>
</section>
<div class="shell introduction-details">
  <div class="catalog-summary" id="catalog-summary" aria-label="Catalog dates">
    {#if app.loadState === 'loading'}
      Connecting to the catalog…
    {:else if app.loadState === 'unavailable'}
      Live data not connected
    {:else}
      <span><strong>EPA data as of:</strong> {fmt(epaDataAsOf(app.catalog))}</span><span>
        <strong>Catalog last changed:</strong>
        {fmt(catalogLastChanged(app.catalog, app.status))}
      </span><span>
        {app.catalog.products.length.toLocaleString()} active registrations in this export
      </span>
    {/if}
  </div>
  <details class="about-tool" id="about-tool">
    <summary>About this tool and how to use it</summary>
    <div class="about-copy">
      <h2>What it is and who it is for</h2>
      <p>
        What’s on Your Seed? is an interactive product-identification and education resource for
        people who grow crops, advise farmers, teach, or work with seed treatments. Its purpose is
        to help users understand what is in a product and compare reported product facts.
      </p>
      <h2>How it works</h2>
      <p>
        The catalog uses EPA’s APPRIL Excel export to identify active registrations matching the
        seed-treatment sites listed in the crop filter. Records retain their full EPA registration
        numbers. Ingredient classifications and guidance come from separately identified references;
        saved Greenbook and CDMS references are distinguished from EPA data.
      </p>
      <p>
        Known deltamethrin products and grain-storage-only entries are excluded. Crop groups are not
        expanded into unverified uses. Missing ingredient information is flagged for review. Federal
        registration does not establish state approval.
      </p>
      <h2>How to use it</h2>
      <ol>
        <li>
          Search a product name, ingredient, or EPA number. Narrow results by crop or purpose; open <strong>
            More filters
          </strong> for technology, resistance groups, hazards, company, and dates.
        </li>
        <li>
          Read the ingredients and source notes. Open <strong>Details &amp; label</strong> for the full
          product record, or follow its label link.
        </li>
        <li>
          Select <strong>Compare</strong> beside up to four products, then open
          <strong>Compare</strong> to view the complete matrix. Downloads and printing are grouped with
          the results.
        </li>
        <li>
          Open <strong>Guides &amp; sources</strong> for abbreviations, ingredient information, treatment
          types, signal words, warnings, and source details.
        </li>
      </ol>
      <h2>Dates and updates</h2>
      <p id="about-dates">
        {app.loadState === 'ready'
          ? aboutDatesText(app.catalog, app.status)
          : 'Catalog dates will appear when data are loaded.'}
      </p>
      <p id="about-update-mode">
        {app.loadState === 'ready'
          ? aboutUpdateModeText(app.standalone)
          : 'Downloaded copies are fixed snapshots. The hosted tool reads its published catalog.'}
      </p>
      <h2>How to cite this version</h2>
      <p id="tool-citation">
        {app.loadState === 'ready'
          ? citationText(app.catalog)
          : 'Citation details will appear when data are loaded.'}
      </p>
      <p class="small muted">
        This is a suggested citation for this repository version. Final CPN authorship, publication
        URL, and any DOI require CPN editorial confirmation.
      </p>
    </div>
  </details>
  <div class="notice" id="notice" role="status" aria-atomic="true">
    {#if app.loadState === 'loading'}
      Loading the database…
    {:else if app.loadState === 'unavailable'}
      <strong>Database connection pending</strong><span>
        The verified catalog has not been connected. No example records are being shown as live
        data. The tool will retry automatically.
      </span>
    {:else if warning}
      <strong>{warning.title}</strong><span>{warning.message}</span>
    {:else}
      <strong>Data note:</strong><span>
        {dataNote(app.catalog, app.flags.usingEmbeddedSnapshot)}
      </span>
    {/if}
  </div>
</div>
<main class="shell" id="main" tabindex="-1">
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
  <nav class="tabs" aria-label="Tool views" role="tablist" onkeydown={onTabKeydown}>
    {#each TABS as tab (tab.id)}
      <button
        role="tab"
        id="tab-{tab.id}"
        tabindex={app.view === tab.id ? 0 : -1}
        aria-selected={app.view === tab.id}
        aria-controls={tab.id}
        data-tab={tab.id}
        onclick={() => app.goTo(tab.id, true)}
      >
        {tab.label}{#if tab.id === 'matrix'}<span id="nav-selected-count">
            ({app.selectedProducts.length})
          </span>{/if}
      </button>
    {/each}
  </nav>
  <ProductsTab />
  <MatrixTab />
  <ResourcesTab />
  <Disclaimer />
</main>
<CompareBar />
<DetailDialog />
<div class="toast" id="toast" aria-hidden="true" hidden={!app.toast.visible}>
  {app.toast.message}
</div>
<div id="a11y-status" class="sr-only" role="status" aria-atomic="true">{app.live.status}</div>
<div id="a11y-alert" class="sr-only" role="alert" aria-atomic="true">{app.live.alert}</div>
