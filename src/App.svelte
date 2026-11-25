<script lang="ts">
  import { onMount } from 'svelte';
  import logo from './assets/cpn-logo-2022.png';
  import { AppState, type View } from './lib/app-state.svelte';
  import { setApp } from './lib/context';
  import { heroModeText, loadedNotice, updateWarning } from './lib/currency';
  import IconSprite from './components/IconSprite.svelte';
  import Icon, { type IconName } from './components/Icon.svelte';
  import ProductsTab from './components/ProductsTab.svelte';
  import MatrixTab from './components/MatrixTab.svelte';
  import IngredientsTab from './components/IngredientsTab.svelte';
  import GuideTab from './components/GuideTab.svelte';
  import DataTab from './components/DataTab.svelte';
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
    void app.load();
  });

  const TABS: { id: View; label: string; icon: IconName }[] = [
    { id: 'products', label: 'Explore products', icon: 'seed' },
    { id: 'matrix', label: 'Comparison matrix', icon: 'compare' },
    { id: 'ingredients', label: 'Ingredient guide', icon: 'flask' },
    { id: 'guide', label: 'Treatment guide', icon: 'book' },
    { id: 'data', label: 'Sources & updates', icon: 'source' },
  ];

  const notice = $derived(
    updateWarning(app.flags, app.status) ??
      loadedNotice(app.catalog, app.status, app.flags.usingEmbeddedSnapshot),
  );

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

<IconSprite />
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
<!-- Deviation (user decision): the decorative hero art (img.hero-art) is not shipped. -->
<section class="hero" aria-labelledby="page-title">
  <div class="shell">
    <div class="hero-copy">
      <small>Seed treatment explorer</small>
      <h1 id="page-title">What’s on <span>your seed?</span></h1>
      <p>
        Get to know the ingredients in seed treatments. Explore their purpose, compare product
        facts, and connect every decision to the source.
      </p>
      <div class="hero-actions">
        <button class="solid" data-start="products" onclick={() => app.start('products')}>
          Explore products <Icon name="arrow" />
        </button><button
          class="secondary"
          data-start="ingredients"
          onclick={() => app.start('ingredients')}
        >
          Understand ingredients <Icon name="book" />
        </button>
      </div>
      <div class="hero-bottom">
        <span>14 seed-treatment sites</span><span>EPA · Greenbook · CDMS</span><span id="hero-mode">
          {heroModeText(app.loadState, app.catalog)}
        </span>
      </div>
    </div>
  </div>
</section>
<main class="shell" id="main" tabindex="-1">
  <div class="start-strip" aria-label="How to use this tool">
    <div class="start-step">
      <span class="step-number" aria-hidden="true">01</span>
      <p><strong>Find a product</strong>Search by name, ingredient, or crop.</p>
    </div>
    <div class="start-step">
      <span class="step-number" aria-hidden="true">02</span>
      <p><strong>Understand its purpose</strong>Explore ingredients and groups.</p>
    </div>
    <div class="start-step">
      <span class="step-number" aria-hidden="true">03</span>
      <p><strong>Compare the facts</strong>Review up to four formulations.</p>
    </div>
  </div>
  <!-- svelte-ignore a11y_interactive_supports_focus -->
  <div class="tabs" aria-label="Database sections" role="tablist" onkeydown={onTabKeydown}>
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
        <Icon name={tab.icon} />{tab.label}
      </button>
    {/each}
  </div>
  <div class="notice" id="notice" role="status" aria-atomic="true">
    {#if app.loadState === 'loading'}
      Loading the database…
    {:else if app.loadState === 'unavailable'}
      <strong>Database connection pending</strong><span>
        The verified catalog has not been connected. No example records are being shown as live
        data. The tool will retry automatically.
      </span>
    {:else}
      <strong>{notice.title}</strong><span>{notice.message}</span>
    {/if}
  </div>
  <ProductsTab />
  <MatrixTab />
  <IngredientsTab />
  <GuideTab />
  <DataTab />
  <Disclaimer />
</main>
<CompareBar />
<DetailDialog />
<div class="toast" id="toast" aria-hidden="true" hidden={!app.toast.visible}>
  {app.toast.message}
</div>
<div id="a11y-status" class="sr-only" role="status" aria-atomic="true">{app.live.status}</div>
<div id="a11y-alert" class="sr-only" role="alert" aria-atomic="true">{app.live.alert}</div>
