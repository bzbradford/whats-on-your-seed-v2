<script lang="ts">
  import { loadCatalog } from './lib/catalog';
  import { getViewMode } from './lib/view-mode';

  const viewMode = getViewMode(window.location.search);
  const catalogPromise = loadCatalog();
</script>

<main class="app" data-view={viewMode}>
  {#if viewMode === 'full'}
    <h1 class="title">What's on Your Seed?</h1>
  {/if}

  {#await catalogPromise}
    <p role="status">Loading catalog…</p>
  {:then catalog}
    <p class="summary" data-testid="product-count">
      {catalog.products.length} products · EPA data as of {catalog.meta.source_snapshot_date}
    </p>
    <ul class="product-list">
      {#each catalog.products as product (product.id)}
        <li>
          <strong>{product.name}</strong>
          <span class="muted">{product.registration_number} · {product.registrant}</span>
        </li>
      {/each}
    </ul>
  {:catch error}
    <p role="alert" class="error">Could not load the catalog: {error.message}</p>
  {/await}
</main>

<style>
  @reference './app.css';

  .app {
    @apply mx-auto max-w-5xl p-4;
  }
  .app[data-view='embed'] {
    @apply h-screen max-w-none overflow-auto p-2;
  }
  .title {
    @apply mb-2 text-2xl font-bold;
  }
  .summary {
    @apply mb-4 text-sm text-gray-600;
  }
  .product-list li {
    @apply flex flex-col border-b border-gray-200 py-1;
  }
  .muted {
    @apply text-sm text-gray-500;
  }
  .error {
    @apply text-red-700;
  }
</style>
