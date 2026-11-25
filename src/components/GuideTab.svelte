<script lang="ts">
  import { onMount } from 'svelte';
  import { factSheetUrl } from '../lib/assets';
  import { getApp } from '../lib/context';
  import GuideContent from './GuideContent.svelte';

  const app = getApp();
  let pdfUrl = $state('');
  onMount(async () => {
    pdfUrl = await factSheetUrl();
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="guide"
  role="tabpanel"
  tabindex="0"
  aria-labelledby="tab-guide"
  hidden={app.view !== 'guide'}
>
  <div class="introline">
    <div>
      <h2>Compare treatment types.</h2>
      <p>Purpose, resistance groups, product hazards, and best management practices.</p>
    </div>
    <a class="guide-action" href={pdfUrl} download="CPN_Seed_Treatment_Comparison.pdf">
      Download comparison fact sheet ↓
    </a>
  </div>
  <div id="guide-content">
    {#if app.loadState === 'ready'}<GuideContent />{/if}
  </div>
</section>
