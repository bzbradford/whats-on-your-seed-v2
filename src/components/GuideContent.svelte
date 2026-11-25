<script lang="ts">
  import { getApp } from '../lib/context';
  import { fmt } from '../lib/format';
  import ExtLink from './ExtLink.svelte';
  import Icon from './Icon.svelte';
  import SourceLinks from './SourceLinks.svelte';

  // Oct 19 renderGuide(): the treatment guide as a grid of panels.
  const app = getApp();
  const e = $derived(app.catalog.education);
</script>

{#if !e}
  <p>The treatment guide is unavailable in this catalog.</p>
{:else}
  <div class="guide-grid">
    <article class="panel full">
      <h3>Treatment types at a glance</h3>
      <p>
        {e.status} · Reviewed {fmt(e.reviewed_on)}. Match the product to a diagnosed or anticipated
        pest; this is not an efficacy ranking.
      </p>
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
    </article>
    <article class="panel">
      <h3>FRAC &amp; IRAC groups</h3>
      <p>{e.classification_note}</p>
      <p>{e.resistance_note}</p>
      <p><SourceLinks ids={['FRAC', 'IRAC']} sources={e.sources} /></p>
      <button data-tab="ingredients" onclick={() => app.goTo('ingredients', true)}>
        <Icon name="flask" />Explore ingredient groups →
      </button>
    </article>
    <article class="panel">
      <h3>How to read product warnings</h3>
      <p>{e.signal_note}</p>
      <p>{e.data_note}</p>
      <p><SourceLinks ids={['EPA-SIGNAL', 'EPA-LABEL']} sources={e.sources} /></p>
    </article>
    <article class="panel full">
      <h3>EPA signal words</h3>
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
    </article>
    <article class="panel full">
      <h3>Best management practices</h3>
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
    </article>
    <article class="panel full">
      <h3>References &amp; review dates</h3>
      <p>
        Classification references: FRAC 2026 and IRAC v11.5 (February 2026). The guide is
        editorially reviewed; EPA imports do not automatically reassign resistance groups or rewrite
        BMPs.
      </p>
      <ul>
        {#each e.sources as x (x.id)}
          <li><ExtLink url={x.url} text={x.title} /></li>
        {/each}
      </ul>
    </article>
  </div>
{/if}
