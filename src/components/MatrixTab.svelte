<script lang="ts">
  import { focusById } from '../lib/app-state.svelte';
  import { MAX_COMPARE, matrixMatches, matrixMatchesText, pickerValue } from '../lib/compare';
  import { getApp } from '../lib/context';
  import { downloadCsv, exportFileNames, matrixCsv } from '../lib/csv';
  import { fmt, localDate } from '../lib/format';
  import { MATRIX_NOTE, matrixRows, matrixSections } from '../lib/matrix';
  import { printMatrix } from '../lib/print';
  import MatrixCellView from './MatrixCellView.svelte';

  const app = getApp();
  const SLOTS = Array.from({ length: MAX_COMPARE }, (_, i) => i);
  const ps = $derived(app.comparison);
  const today = $derived.by(() => {
    void ps;
    return localDate();
  });
  const sections = $derived(matrixSections(matrixRows(app.catalog, today)));
  const matches = $derived(matrixMatches(app.catalog, app.selected, app.matrixQuery));
  let pick = $state('');
  const pickValue = $derived(pickerValue(matches, pick));
  const pickerDisabled = $derived(app.selected.length >= MAX_COMPARE || !matches.length);

  /** Row ids are numbered across sections, as in legacy. */
  const rowOffsets = $derived(
    sections.reduce<number[]>(
      (acc, s, i) => [...acc, i ? acc[i - 1] + sections[i - 1].rows.length : 0],
      [],
    ),
  );

  function add() {
    if (app.setComparison(pickValue, true)) focusById('matrix-search');
  }

  function exportMatrix() {
    if (!ps.length) return;
    downloadCsv(matrixCsv(app.catalog, ps), exportFileNames.matrix());
    app.showToast('Selected formulations exported with sources and comparison notes.');
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<section
  id="matrix"
  role="tabpanel"
  tabindex="0"
  aria-labelledby="tab-matrix"
  hidden={app.view !== 'matrix'}
>
  <div class="matrix-heading">
    <div>
      <h2 id="matrix-title" tabindex="-1">Seed Treatment Side-by-Side Comparison Matrix</h2>
      <p class="small muted">
        Compare registration, composition, target pests and label specifications for up to four
        formulations.
      </p>
      <strong id="matrix-count" class="small">{ps.length} of 4 formulations selected</strong>
    </div>
    <div class="matrix-actions">
      <button id="matrix-export" disabled={!ps.length} onclick={exportMatrix}>
        Export matrix CSV ↓
      </button><button
        id="matrix-print"
        disabled={!ps.length}
        onclick={() => ps.length && printMatrix()}
      >
        Print / Save PDF
      </button><button
        id="matrix-clear"
        class="quiet"
        disabled={!ps.length}
        onclick={() => app.clearComparison()}
      >
        Clear selection
      </button>
    </div>
  </div>
  <div id="matrix-selection" class="matrix-selection">
    {#each SLOTS as i (i)}
      {@const p = ps[i]}
      {#if p}
        <article class="matrix-slot filled">
          <span class="eyebrow">Formulation {i + 1}</span>
          <h3>{p.name}</h3>
          <p>EPA {p.registration_number}</p>
          <button
            class="quiet small"
            data-matrix-remove={p.id}
            aria-label="Remove {p.name}, EPA {p.registration_number}, from comparison"
            onclick={() => {
              app.setComparison(p.id, false);
              focusById('matrix-search');
            }}
          >
            Remove ×
          </button>
        </article>
      {:else}
        <div class="matrix-slot">
          <span class="eyebrow">Formulation {i + 1}</span>
          <p>Choose a formulation below</p>
        </div>
      {/if}
    {/each}
  </div>
  <div class="matrix-controls">
    <label class="field">
      <span>Search formulations</span><input
        type="search"
        id="matrix-search"
        placeholder="Product, ingredient or EPA number"
        bind:value={app.matrixQuery}
      />
    </label><label class="field">
      <span>Choose a formulation</span><select
        id="matrix-picker"
        aria-describedby="matrix-matches"
        disabled={pickerDisabled}
        value={pickValue}
        onchange={(event) => (pick = event.currentTarget.value)}
      >
        {#each matches as p (p.id)}
          <option value={p.id}>{p.name} · EPA {p.registration_number}</option>
        {:else}
          <option value="">No matching formulations</option>
        {/each}
      </select>
    </label><button id="matrix-add" class="solid" disabled={pickerDisabled} onclick={add}>
      Add to matrix
    </button>
  </div>
  <p id="matrix-matches" class="small muted" role="status" aria-atomic="true">
    {matrixMatchesText(matches.length, app.selected.length)}
  </p>
  <p id="matrix-note" class="matrix-context">{MATRIX_NOTE}</p>
  <div id="matrix-body" style:--matrix-columns={Math.max(ps.length, 1)}>
    {#if !ps.length}
      <div class="empty">
        <h3>Build your side-by-side comparison.</h3>
        <p>
          Search below the selection slots and add up to four formulations, or use the Compare
          checkboxes in Explore products.
        </p>
        <button data-tab="products" onclick={() => app.goTo('products', true)}>
          Explore products →
        </button>
      </div>
    {:else}
      {#if ps.length === 1}
        <p class="small muted">One formulation selected. Add another to compare side by side.</p>
      {/if}
      <p id="matrix-scroll-help" class="small muted">
        Scroll the table to see more columns and rows. With the table focused, use the arrow keys to
        scroll.
      </p>
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        class="matrix-scroll"
        role="region"
        aria-label="Selected formulation comparison"
        aria-describedby="matrix-scroll-help"
        tabindex="0"
      >
        <table class="matrix-table">
          <caption>
            Selected formulations · prepared {fmt(today)} · EPA workbook {fmt(
              app.catalog.meta.source_snapshot_date,
            )}
          </caption>
          <thead>
            <tr>
              <th scope="col">Comparison field</th>
              {#each ps as p (p.id)}
                <th scope="col" id="matrix-col-{p.id}">
                  <span class="comparison-name">{p.name}</span><span class="small">
                    EPA {p.registration_number}
                  </span>
                </th>
              {/each}
            </tr>
          </thead>
          {#each sections as section, g (section.title)}
            <tbody>
              <tr class="matrix-section">
                <th id="matrix-section-{g + 1}" colspan={ps.length + 1} scope="rowgroup">
                  {section.title}
                </th>
              </tr>
              {#each section.rows as row, r (row.label)}
                {@const rowId = `matrix-row-${rowOffsets[g] + r + 1}`}
                <tr>
                  <th id={rowId} scope="row">{row.label}</th>
                  {#each ps as p (p.id)}
                    <td headers="matrix-col-{p.id} matrix-section-{g + 1} {rowId}">
                      <MatrixCellView cell={row.get(p)} />
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          {/each}
        </table>
      </div>
    {/if}
  </div>
</section>
