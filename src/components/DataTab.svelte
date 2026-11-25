<script lang="ts">
  import { getApp } from '../lib/context';
  import DataGrid from './DataGrid.svelte';

  const app = getApp();
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="data"
  role="tabpanel"
  tabindex="0"
  aria-labelledby="tab-data"
  hidden={app.view !== 'data'}
>
  <div class="introline">
    <div>
      <h2>Information you can trace.</h2>
      <p>Every record retains its source. Collection dates and source dates are kept separate.</p>
    </div>
  </div>
  <div id="data-grid" class="data-grid">
    {#if app.loadState !== 'loading'}<DataGrid />{/if}
  </div>
</section>
