<script lang="ts">
  import { onMount } from 'svelte';
  import { factSheetUrl } from '../lib/assets';
  import { getApp } from '../lib/context';
  import { fmt } from '../lib/format';
  import ExtLink from './ExtLink.svelte';
  import SourceLinks from './SourceLinks.svelte';

  const app = getApp();
  const e = $derived(app.catalog.education);
  let pdfUrl = $state('');
  onMount(async () => {
    pdfUrl = await factSheetUrl();
  });
</script>

{#if !e}
  <p>The treatment guide is unavailable in this catalog.</p>
{:else}
  <details class="resource-block" id="treatment-guide">
    <summary>Treatment types &amp; resistance groups</summary>
    <div class="resource-copy">
      <p class="small muted">{e.status} · Reviewed {fmt(e.reviewed_on)}.</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="table-scroll"
        role="region"
        aria-label="Treatment types; scroll to view all columns"
        tabindex="0"
      >
        <table class="guide-table">
          <caption class="sr-only">Treatment types, purposes, and considerations</caption>
          <thead>
            <tr>
              <th scope="col">Type</th><th scope="col">Purpose</th><th scope="col">
                What to compare
              </th><th scope="col">Limits / considerations</th>
            </tr>
          </thead>
          <tbody>
            {#each e.treatments as t (t.type)}
              <tr>
                <th scope="row">{t.type}</th><td>{t.purpose}</td><td>{t.compare}</td><td>
                  {t.limit}<br /><span class="small">
                    <SourceLinks ids={t.source_ids} sources={e.sources} />
                  </span>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p>{e.technology_note}</p>
      <h3>FRAC &amp; IRAC groups</h3>
      <p>{e.classification_note}</p>
      <p>{e.resistance_note}</p>
      <p><SourceLinks ids={['FRAC', 'IRAC']} sources={e.sources} /></p>
      <button
        class="text-action"
        data-tab="ingredients"
        onclick={() => app.goTo('ingredients', true)}
      >
        Explore ingredient groups
      </button>
    </div>
  </details>
  <details class="resource-block" id="warning-guide">
    <summary>EPA signal words &amp; treatment warnings</summary>
    <div class="resource-copy">
      <h3>How to read product warnings</h3>
      <p>{e.signal_note}</p>
      <p>{e.data_note}</p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="table-scroll"
        role="region"
        aria-label="EPA signal words; scroll to view all columns"
        tabindex="0"
      >
        <table class="guide-table">
          <caption class="sr-only">EPA signal words and their meaning</caption>
          <thead>
            <tr>
              <th scope="col">Displayed value</th><th scope="col">Meaning</th><th scope="col">
                How to use it
              </th>
            </tr>
          </thead>
          <tbody>
            {#each e.signals as t (t.word)}
              <tr><th scope="row">{t.word}</th><td>{t.meaning}</td><td>{t.note}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
      <p><SourceLinks ids={['EPA-SIGNAL', 'EPA-LABEL']} sources={e.sources} /></p>
      <button
        class="text-action"
        data-open-resource="seed-abbreviations"
        onclick={() => app.openResource('seed-abbreviations')}
      >
        Read abbreviations such as PPE, SDS, and RUP
      </button>
    </div>
  </details>
  <details class="resource-block" id="handling-guide">
    <summary>Best management practices &amp; handling</summary>
    <div class="resource-copy">
      <ol>
        {#each e.bmps as t (t.title)}
          <li>
            <strong>{t.title}.</strong>
            {t.text}
            <span class="small"><SourceLinks ids={t.source_ids} sources={e.sources} /></span>
          </li>
        {/each}
      </ol>
      <p>
        Practices are general. Follow the applicable U.S. label and local requirements; the Canadian
        resource is used for general stewardship, not Canadian legal requirements.
      </p>
    </div>
  </details>
  <details class="resource-block" id="guide-references">
    <summary>Guide references &amp; review dates</summary>
    <div class="resource-copy">
      <p>
        Classification references: FRAC 2026 and IRAC v11.5 (February 2026). The guide is
        editorially reviewed; EPA imports do not automatically reassign resistance groups or rewrite
        handling guidance.
      </p>
      <ul>
        {#each e.sources as x (x.id)}
          <li><ExtLink url={x.url} text={x.title} /></li>
        {/each}
      </ul>
      <a class="guide-action" href={pdfUrl} download="CPN_Seed_Treatment_Comparison.pdf">
        Download comparison fact sheet (PDF)
      </a>
    </div>
  </details>
{/if}
