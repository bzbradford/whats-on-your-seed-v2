<script lang="ts">
  import { getApp } from '../lib/context';
  import {
    UPDATE_WORKFLOW_URL,
    automaticUpdatesText,
    catalogLastChanged,
    epaDataAsOf,
    historyRows,
    importedAt,
    updateWarning,
  } from '../lib/currency';
  import { fmt } from '../lib/format';
  import ExtLink from './ExtLink.svelte';

  const app = getApp();
  const m = $derived(app.catalog.meta);
  const a = $derived(m.audit || {});
  const warning = $derived(updateWarning(app.flags, app.status));
  const history = $derived(historyRows(app.history?.updates ?? []));
  const label = (key: string) =>
    key === 'NONE' ? 'None reported by EPA' : key === 'NOT_SUPPLIED' ? 'Not supplied' : key;
</script>

<!--
  Intentional deviation (PLAN.md Phase 3): legacy's "Automatic source checks" panel
  showed the last EPA check and a 48-hour staleness warning. Checks no longer commit,
  so this panel shows the EPA data date, when the catalog last changed, and the
  update history instead.
-->
<article class="panel full">
  <h3>Data currency &amp; update history</h3>
  <p>
    The repository checks EPA’s published Excel export weekly, on Mondays at <strong>
      6:30 a.m. America/Chicago
    </strong>, and publishes a new catalog only when the data have changed. A schedule being
    configured does not establish that a run has succeeded.
  </p>
  <dl>
    <dt>EPA data as of</dt>
    <dd>{fmt(epaDataAsOf(app.catalog))} (EPA workbook created)</dd>
    <dt>Catalog last changed</dt>
    <dd>{fmt(catalogLastChanged(app.catalog, app.status))}</dd>
  </dl>
  <p>
    {app.flags.usingEmbeddedSnapshot
      ? 'The embedded snapshot is displayed. This download checks the published catalog when online and every five minutes while open.'
      : app.status?.message || 'No published update status is recorded in this copy.'}
  </p>
  {#if warning}
    <p class="notice"><strong>{warning.title}</strong> {warning.message}</p>
  {/if}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="table-scroll"
    role="region"
    aria-label="Catalog update history; scroll to view all columns"
    tabindex="0"
  >
    <table>
      <caption class="sr-only">Published catalog updates, newest first</caption>
      <thead>
        <tr>
          <th scope="col">Published</th><th scope="col">Result</th><th scope="col">
            EPA workbook created
          </th><th scope="col">Records</th>
        </tr>
      </thead>
      <tbody>
        {#each history as h (h.key)}
          <tr>
            <th scope="row">{h.date}</th><td>{h.outcome}</td><td>{h.workbook}</td><td>
              {h.counts}
            </td>
          </tr>
        {:else}
          <tr><td colspan="4">No update history is recorded in this copy.</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="small muted">
    The history lists published catalog changes. Weeks in which EPA’s export did not change are not
    listed; the update runs record every check. EPA registration does not establish state approval.
  </p>
  <p>
    <ExtLink
      url={app.status?.scheduler?.workflow_url || UPDATE_WORKFLOW_URL}
      text="View source update runs"
    />
  </p>
</article>
<article class="panel full">
  <h3>Coverage of the supplied EPA export</h3>
  <div class="metrics">
    <div>
      <strong>{app.catalog.products.length.toLocaleString()}</strong><small>
        Active registrations included
      </small>
    </div>
    <div>
      <strong>{a.row_count?.toLocaleString() || '—'}</strong><small>Source rows checked</small>
    </div>
    <div>
      <strong>{a.excluded_records?.length ?? '—'}</strong><small>
        Deltamethrin / cutoff exclusions
      </small>
    </div>
    <div>
      <strong>{a.distinct_ingredients ?? '—'}</strong><small>Distinct EPA ingredient codes</small>
    </div>
  </div>
  <p>{m.coverage_note || 'No EPA catalog is connected.'}</p>
  <p>{a.currency_note || ''}</p>
</article>
<article class="panel">
  <h3>Source dates &amp; connections</h3>
  <dl>
    <dt>EPA source</dt>
    <dd>{m.source_acquisition || 'Not connected'}</dd>
    <dt>Workbook created</dt>
    <dd>{fmt(m.source_snapshot_date)}</dd>
    <dt>Imported</dt>
    <dd>{fmt(importedAt(app.catalog))}</dd>
    <dt>Catalog last changed</dt>
    <dd>{fmt(catalogLastChanged(app.catalog, app.status))}</dd>
    <dt>Greenbook</dt>
    <dd>{m.greenbook?.state || 'Not connected'} · {m.greenbook?.matched || 0} matches</dd>
    <dt>CDMS / TELUS</dt>
    <dd>{m.cdms?.state || 'Not connected'} · {m.cdms?.matched || 0} matches</dd>
    <dt>Automatic updates</dt>
    <dd>{automaticUpdatesText(app.catalog, app.standalone, app.flags.usingEmbeddedSnapshot)}</dd>
  </dl>
  <p>
    Saved Greenbook and CDMS references retain their original dates. They do not override the EPA
    formulation or prove current availability.
  </p>
  <p>
    <ExtLink
      url="https://www3.epa.gov/pesticides/appril/apprildatadump_public.xlsx"
      text="Official EPA workbook"
    /> · <ExtLink url="https://www.greenbook.net/" text="Greenbook" /> · <ExtLink
      url="https://www.cdms.net/LabelsSDS/home"
      text="CDMS"
    />
  </p>
</article>
<article class="panel">
  <h3>Scope &amp; ingredient quality</h3>
  <dl>
    <dt>Status group</dt>
    <dd>Active Products (export: Active)</dd>
    <dt>Status-date start</dt>
    <dd>Blank / no lower limit</dd>
    <dt>Status-date end</dt>
    <dd>{fmt(m.status_date_end)}</dd>
    <dt>Base-product formulations</dt>
    <dd>{a.base_linked_formulations ?? 0} distributor records</dd>
    <dt>Missing formulations</dt>
    <dd>{a.missing_formulation_products ?? 0}</dd>
    <dt>Missing percentage</dt>
    <dd>{a.missing_percent_products ?? 0} records</dd>
  </dl>
  <p>
    All 14 site names are matched exactly, ignoring capitalization and extra spaces. Crop groups are
    not expanded. Known deltamethrin records are excluded; records with missing ingredients are
    clearly flagged for review.
  </p>
  <p>
    Distributor records keep their full EPA numbers. Where their AIS field is blank, related
    base-product ingredients are identified separately. Distributor use claims can be narrower;
    verify the distributor label.
  </p>
  <p>
    <ExtLink
      url="https://www.epa.gov/pesticide-registration/pesticide-registration-manual-chapter-9-supplemental-distribution-registered"
      text="EPA distributor-product guidance"
    />
  </p>
</article>
<article class="panel full">
  <h3>Signal words &amp; classification coverage</h3>
  <p>
    {Object.entries(a.signal_word_counts || {})
      .map(([key, n]) => label(key) + ': ' + n)
      .join(' · ')}. Restricted-use flag Yes: {a.restricted_use_products ?? 'Unknown'}.
  </p>
  <p>
    Signal words and restricted-use flags refresh from each product’s own EPA row. Current label
    contents are not automatically extracted. FRAC/IRAC references and the fact sheet have a
    separate editorial review date: {fmt(app.catalog.education?.reviewed_on)}.
  </p>
  <button data-tab="guide" onclick={() => app.goTo('guide', true)}>Open treatment guide</button>
</article>
<article class="panel full">
  <h3>Products by requested site</h3>
  <p>A registration can appear under several sites. Counts overlap and should not be added.</p>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="table-scroll"
    role="region"
    aria-label="Products by EPA site; scroll to view all columns"
    tabindex="0"
  >
    <table>
      <caption class="sr-only">Included registrations by EPA site</caption>
      <thead>
        <tr><th scope="col">EPA site</th><th scope="col">Included registrations</th></tr>
      </thead>
      <tbody>
        {#each app.catalog.scope.sites as site (site)}
          <tr><th scope="row">{site}</th><td>{a.counts_by_site?.[site] ?? '—'}</td></tr>
        {/each}
      </tbody>
    </table>
  </div>
</article>
<article class="panel">
  <h3>Automatic EPA updates</h3>
  <p>
    The supplied updater downloads the official APPRIL workbook, checks the entire export, applies
    the 14-site scope and exclusions, and publishes a new catalog with change history.
  </p>
  <p>
    The GitHub source job checks weekly, on Mondays at 6:30 a.m. America/Chicago, downloads the
    workbook only when EPA has changed it, and records additions, changes, and removals from the
    scoped catalog. Changes become available after EPA publishes them in this export. Older or
    incomplete workbooks and unexpectedly large removals stop publication. A failed check preserves
    the previous catalog.
  </p>
  <p>
    New downloads check GitHub for published data when opened online and every five minutes while
    open, with an embedded snapshot for offline use. Older downloads remain fixed snapshots. <strong>
      CPN hosting is separate:
    </strong> the CPN website must be connected to the published files; the hosted interface checks its
    published data every five minutes.
  </p>
</article>
<article class="panel">
  <h3>Products &amp; technologies</h3>
  <p>
    The list includes every matching registration in the export, including distributor products and
    other technologies indexed under the requested sites. It is not limited by brand name or a
    hand-selected product list.
  </p>
  <p>
    EPA product categories describe the registered product; the ingredient guide uses separately
    reviewed classifications. Unreviewed ingredients remain unclassified. Commercial package
    composition still needs its own manufacturer evidence.
  </p>
  <p>
    Percentages retain the EPA values and source basis; they are not application rates or efficacy
    scores.
  </p>
</article>
