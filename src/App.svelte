<script lang="ts">
  import { onMount } from 'svelte';
  import logo from './assets/cpn-logo-2022.png';
  import { AppState, type View } from './lib/app-state.svelte';
  import { setApp } from './lib/context';
  import { heroModeText, updateWarning } from './lib/currency';
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

  // 4a.5: the notice is for loading, failures and warnings only. When the catalog loads
  // normally it stays empty (an always-present live region, visually collapsed); the data
  // date sits by the result count and the details are in the footer and Sources tab.
  const warning = $derived(updateWarning(app.flags, app.status));
  const quietNotice = $derived(app.loadState === 'ready' && !warning);

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
      target="_blank"
      rel="noopener noreferrer"
      href="https://cropprotectionnetwork.org/"
      aria-label="Crop Protection Network home (opens in a new tab)"
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
        <span>14 seed-treatment sites</span><span>
          EPA APPRIL data · saved Greenbook &amp; CDMS references
        </span><span id="hero-mode">
          {heroModeText(app.loadState, app.catalog)}
        </span>
      </div>
    </div>
  </div>
</section>
<main class="shell" id="main" tabindex="-1">
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
  <div class="notice" class:quiet-notice={quietNotice} id="notice" role="status" aria-atomic="true">
    {#if app.loadState === 'loading'}
      Loading the database…
    {:else if app.loadState === 'unavailable'}
      <strong>Database connection pending</strong><span>
        The verified catalog has not been connected. No example records are being shown as live
        data. The tool will retry automatically.
      </span>
    {:else if warning}
      <strong>{warning.title}</strong><span>{warning.message}</span>
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

<style>
  /*
   * Hero (4a.2 of Phase 3c, 4a.4): full width without the art; the title on one line; a
   * shorter hero; the 01/02/03 strip is gone (the tabs say the same). The paragraph keeps
   * a readable 740px measure.
   */
  @media screen {
    .hero .shell {
      grid-template-columns: minmax(0, 1fr);
      padding-block: 26px 24px;
    }
    .hero h1 {
      max-width: none;
      margin: 10px 0 12px;
      font-size: clamp(2rem, 4.2vw, 3.4rem);
      line-height: 1.05;
    }
    .hero h1 span {
      display: inline;
    }
    .hero p {
      max-width: 740px;
    }
    .hero-actions {
      margin-top: 16px;
    }
    .hero-bottom {
      margin-top: 14px;
    }
    /* The step strip used to separate hero and tabs. */
    .tabs {
      margin-top: 8px;
    }
  }
  @media screen and (max-width: 700px) {
    .hero .shell {
      padding-block: 20px;
    }
    .hero h1 {
      max-width: none;
      font-size: clamp(1.625rem, 7.6vw, 2.4rem);
      margin-bottom: 12px;
    }
    /* Tabs: one row that scrolls sideways instead of a two-column grid. */
    .tabs {
      display: flex;
      flex-wrap: nowrap;
      gap: 6px;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scrollbar-width: thin;
      padding-block: 12px;
    }
    .tabs button,
    .tabs button:last-child {
      flex: none;
      grid-column: auto;
      justify-content: center;
    }
  }
  /* Empty notice: keep the live region in the page but take no space. */
  .notice.quiet-notice {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip-path: inset(50%);
    border: 0;
  }
  /* ?embed: the hero shrinks to a slim banner (title and data line only). */
  :global(html[data-view='embed']) .hero .shell {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 20px;
    padding-block: 10px;
  }
  :global(html[data-view='embed']) .hero-copy {
    display: contents;
  }
  :global(html[data-view='embed']) .hero h1 {
    margin: 0;
    font-size: 1.5rem;
  }
  :global(html[data-view='embed']) .hero small,
  :global(html[data-view='embed']) .hero p,
  :global(html[data-view='embed']) .hero-actions {
    display: none;
  }
  :global(html[data-view='embed']) .hero-bottom {
    margin: 0;
  }
</style>
