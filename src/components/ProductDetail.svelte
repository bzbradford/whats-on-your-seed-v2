<script lang="ts">
  import { getApp } from '../lib/context';
  import { fmt } from '../lib/format';
  import { EPA_LABEL_SEARCH, labelAccess, workbookLabelFile } from '../lib/labels';
  import { coverageText, detailWarning, recordTypeText, ref, rupText } from '../lib/product-facts';
  import type { Product } from '../lib/types';
  import ExtLink from './ExtLink.svelte';
  import Icon from './Icon.svelte';
  import LabelAction from './LabelAction.svelte';
  import SafetyBadges from './SafetyBadges.svelte';

  let { p }: { p: Product } = $props();
  const app = getApp();
  const reference = $derived(app.catalog.ingredient_reference);
  const warning = $derived(detailWarning(p));
  const x = $derived(labelAccess(p));
  const workbookLabel = $derived(workbookLabelFile(p));
  const docLabel = (type: string) =>
    type === 'sds'
      ? 'Safety data sheet'
      : type === 'supplemental_label'
        ? 'Supplemental label'
        : 'Specimen label';
</script>

{#if warning}<div class="notice">{warning}</div>{/if}
<section class="panel label-panel">
  <h3>Product label downloads</h3>
  <p><strong>EPA registration {p.registration_number}</strong> · {p.registrant}</p>
  <div class="label-actions">
    <LabelAction product={p} />{#if x.pdf}<ExtLink
        url={x.lookup}
        text="Search EPA label history"
      />{/if}
  </div>
  {#if x.supplemental.length}
    <p><strong>Newer supplemental labeling</strong> (adds to or changes the label above):</p>
    <ul class="label-supplemental-list">
      {#each x.supplemental as s (s.url)}
        <li><ExtLink url={s.url} text={s.description + ' · ' + fmt(s.date)} /></li>
      {/each}
    </ul>
  {/if}
  <p>{x.note}</p>
  <p class="small muted">
    {x.pdf
      ? 'Source: the newest EPA file with a full label for this exact registration, from the files listed in its workbook row. '
      : ''}An internet connection is needed to open label documents. If a link fails, <ExtLink
      url={EPA_LABEL_SEARCH}
      text="open EPA label search"
    /> and enter the full registration number above.
  </p>
  <p class="small muted">
    EPA files may contain master, supplemental or historical labeling. Check the marketed product’s
    current container label, seed tag, crop uses and state requirements.{x.distributor
      ? ' A base-registration label is not a substitute for the distributor’s marketed label.'
      : ''}
  </p>
</section>
<section class="safety-panel">
  <h3>EPA signal word &amp; warnings</h3>
  <SafetyBadges product={p} />
  <p>
    <strong>EPA restricted-use flag:</strong>
    {rupText(p)}{#if p.safety?.restricted_use_reason}<br /><strong>EPA reason:</strong>
      {p.safety.restricted_use_reason}{/if}
  </p>
  <p>
    These fields come from this registration’s EPA workbook row, created {fmt(
      p.source_snapshot_date,
    )}. Current label precautions have not been reviewed. {p.safety?.signal_word_raw &&
    p.safety?.signal_word_state === 'unrecognized'
      ? 'Unrecognized source value: ' + p.safety.signal_word_raw + '. '
      : ''}Missing fields are not filled from the base product. “None” does not mean harmless.
  </p>
  <p>
    Check the current label and seed tag for PPE, first aid, environmental hazards, treated-seed
    restrictions, storage, and disposal. An SDS signal word may differ from the EPA label signal
    word.
  </p>
  {#if workbookLabel}
    <p>
      <ExtLink
        url={workbookLabel.url}
        text={'EPA-accepted label listed in the workbook · ' + fmt(workbookLabel.date)}
      /><br /><span class="small muted">
        Exact registration match; file contents and current applicability have not been reviewed.
      </span>
    </p>
  {/if}
  <button data-tab="guide" onclick={() => app.goTo('guide', true)}>
    <Icon name="book" />Signal words &amp; BMP guide →
  </button>
</section>
<div class="details-grid">
  <div>
    <h3>Ingredient breakdown</h3>
    {#if p.ingredient_source_url}
      <p class="small muted">
        Ingredient evidence: <ExtLink
          url={p.ingredient_source_url}
          text={p.ingredient_source || 'Product label'}
        />
      </p>
    {/if}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class="table-scroll"
      role="region"
      aria-label="Ingredient breakdown; scroll to view all columns"
      tabindex="0"
    >
      <table>
        <caption class="sr-only">Ingredient percentages, purposes, and groups</caption>
        <thead>
          <tr>
            <th scope="col">Ingredient</th><th scope="col">In product</th><th scope="col">
              Purpose / group
            </th>
          </tr>
        </thead>
        <tbody>
          {#each p.ingredients as a, i (i)}
            <tr>
              <th scope="row">
                <button
                  class="quiet"
                  data-ingredient={a.name}
                  aria-haspopup="dialog"
                  onclick={() => app.openDialog({ kind: 'ingredient', name: a.name })}
                >
                  {a.name}
                </button>
              </th><td>{a.percent == null ? 'Not supplied' : a.percent + '%'}</td><td>
                {ref(reference, a).purpose}<br /><span class="muted">
                  {ref(reference, a).group}
                </span>
              </td>
            </tr>
          {:else}
            <tr><td colspan="3">Ingredients not supplied by source.</td></tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="small muted">
      {coverageText(reference, p)}. Percentages are the EPA-reported values. Check the ingredient
      name and source label for the concentration basis, especially plant-incorporated protectants;
      values are not dose or performance scores.
    </p>
    <h3 style="margin-top:25px">Sites within the project scope</h3>
    {#each p.sites as site, i (site)}{i ? ' ' : ''}<span class="chip">{site}</span>{/each}
    <p class="small muted">
      {p.source_sites_note || 'Only exact seed-treatment sites listed in the EPA export are shown.'}
    </p>
  </div>
  <div class="panel">
    <h3>Record &amp; provenance</h3>
    <dl>
      <dt>EPA registration</dt>
      <dd>{p.registration_number}</dd>
      <dt>Registrant / manufacturer</dt>
      <dd>{p.registrant}</dd>
      <dt>Record type</dt>
      <dd>{recordTypeText(p.record_type)}</dd>
      <dt>Ingredient basis</dt>
      <dd>
        {p.ingredient_basis || 'Source record'}{p.base_registration
          ? ' · EPA ' + p.base_registration
          : ''}
      </dd>
      <dt>Status reported</dt>
      <dd>{p.status}</dd>
      <dt>First EPA registration date</dt>
      <dd>{fmt(p.first_registration_date)}</dd>
      <dt>EPA status date</dt>
      <dd>{fmt(p.status_date)}</dd>
      <dt>Workbook created</dt>
      <dd>{fmt(p.source_snapshot_date)}</dd>
      <dt>Latest EPA label date</dt>
      <dd>{fmt(p.latest_label_date)}</dd>
      <dt>Imported</dt>
      <dd>{fmt(p.imported_at || p.retrieved_at)}</dd>
      <dt>Source sheet row</dt>
      <dd>{p.source_row || 'Not supplied'}</dd>
    </dl>
    <div class="links">
      <ExtLink url={p.source_url} text={p.source + ' record'} />{#if p.greenbook}<ExtLink
          url={p.greenbook.source_url}
          text="Greenbook record"
        />{/if}{#if p.cdms}<ExtLink url={p.cdms.source_url} text="CDMS labels / SDS" />{/if}<ExtLink
        url="https://ordspub.epa.gov/ords/pesticides/f?p=APPRIL_PUBLIC:2"
        text="EPA search"
      />
    </div>
    {#if p.cdms?.documents?.length}
      <p class="small">
        {#each p.cdms.documents as d, i (i)}{#if i}<br />{/if}<ExtLink
            url={d.url}
            text={docLabel(d.type) + (d.revision ? ' · ' + d.revision : '')}
          />{/each}
      </p>
    {/if}
    {#if p.cdms?.warnings?.length}
      <p class="small">
        {#each p.cdms.warnings as w, i (i)}{#if i}<br />{/if}{w}{/each}
      </p>
    {/if}
    {#if p.greenbook?.warnings?.length}
      <p class="small" style="color:var(--amber)">
        {#each p.greenbook.warnings as w, i (i)}{#if i}<br />{/if}{w}{/each}
      </p>
    {/if}
  </div>
</div>

<style>
  .label-supplemental-list {
    margin: 0 0 12px;
    padding-left: 1.25rem;
  }
</style>
