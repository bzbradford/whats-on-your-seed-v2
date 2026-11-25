// Application state (Svelte 5 runes). Thin glue: all rules live in the
// framework-free modules it calls. Components read this and call its methods.

import { tick } from 'svelte';
import { Announcer, type LiveRegions } from './announcer';
import { dataBase, loadEmbedded } from './catalog';
import {
  CAP_MESSAGE,
  comparisonProducts,
  loadSelection,
  saveSelection,
  selectedInCatalogOrder,
  setSelection,
} from './compare';
import { PUBLISHED_DATA_URL, POLL_INTERVAL_MS, type SyncFlags } from './currency';
import {
  PAGE_SIZE,
  categoryOptions,
  countText,
  defaultEnd,
  emptyFilters,
  filterProducts,
  pageInfo,
  resetFilters,
  type Filters,
} from './filters';
import {
  carryOver,
  catalogChanged,
  fetchCatalogOrNull,
  fetchPublished,
  fetchStatus,
  publicationChanged,
} from './sync';
import { loadView, saveView, type ProductView } from './preferences';
import type { Catalog, SyncStatus, UpdateHistory } from './types';

/** The five tabs of the Oct 19 reference. */
export const VIEWS = ['products', 'matrix', 'ingredients', 'guide', 'data'] as const;
export type View = (typeof VIEWS)[number];
export type DialogContent =
  { kind: 'product'; id: string } | { kind: 'ingredient'; name: string } | null;

const EMPTY_CATALOG = {
  mode: 'loading',
  products: [],
  meta: {},
  scope: { sites: [] },
  ingredient_reference: {},
} as unknown as Catalog;

export class AppState {
  readonly standalone: boolean;
  readonly dataBase: string;

  // Large immutable data: replaced wholesale, never deep-proxied.
  catalog = $state.raw<Catalog>(EMPTY_CATALOG);
  status = $state.raw<SyncStatus | null>(null);
  history = $state.raw<UpdateHistory | null>(null);
  loadState = $state<'loading' | 'ready' | 'unavailable'>('loading');
  flags = $state<SyncFlags>({
    usingEmbeddedSnapshot: false,
    catalogPollFailed: false,
    statusPollFailed: false,
  });

  filters = $state<Filters>(emptyFilters());
  selected = $state<string[]>([]);
  view = $state<View>('products');
  dialog = $state<DialogContent>(null);
  filtersOpen = $state(false);
  toast = $state({ message: '', visible: false });
  live = $state<LiveRegions>({ status: '', alert: '' });
  /** Cards or List on the products tab; remembered per viewer. */
  productView = $state<ProductView>(loadView());
  matrixQuery = $state('');
  ingredientQuery = $state('');

  #pageState = $state({ key: '', page: 1 });
  #toastTimer: ReturnType<typeof setTimeout> | undefined;
  #polling = false;
  /** The sync status of the publication the displayed catalog came from. */
  #catalogStatus: SyncStatus | null = null;
  readonly announcer: Announcer;

  options = $derived(categoryOptions(this.catalog));
  result = $derived(filterProducts(this.catalog, this.filters));
  count = $derived(countText(this.result));
  /** Any filter or catalog change returns to page 1 (legacy `render()`). */
  #pageKey = $derived(JSON.stringify(this.filters) + this.catalog.meta.last_successful_sync);
  pageInfo = $derived(
    pageInfo(
      this.result.products.length,
      this.#pageState.key === this.#pageKey ? this.#pageState.page : 1,
    ),
  );
  pageProducts = $derived(
    this.result.products.slice(
      (this.pageInfo.page - 1) * PAGE_SIZE,
      this.pageInfo.page * PAGE_SIZE,
    ),
  );
  comparison = $derived(comparisonProducts(this.catalog, this.selected));
  selectedProducts = $derived(selectedInCatalogOrder(this.catalog, this.selected));

  constructor(opts: { standalone: boolean; baseUrl: string }) {
    this.standalone = opts.standalone;
    this.dataBase = dataBase(opts.standalone, PUBLISHED_DATA_URL, opts.baseUrl);
    this.announcer = new Announcer(this.live);
  }

  // ---- loading and refresh -------------------------------------------------

  async load(): Promise<void> {
    const embedded = await loadEmbedded();
    if (embedded) {
      this.flags.usingEmbeddedSnapshot = true;
      this.status = embedded.status;
      this.#catalogStatus = embedded.status;
      this.history = embedded.history;
      this.#setup(embedded.catalog);
      await this.poll();
    } else {
      const r = await fetchPublished(this.dataBase);
      if (r.catalog) {
        this.flags.catalogPollFailed = false;
        this.#catalogStatus = r.status;
        this.#setup(r.catalog);
      } else {
        this.flags.catalogPollFailed = true;
        this.loadState = 'unavailable';
      }
      this.#applyStatus(r.status, r.history);
    }
    setInterval(() => void this.poll(), POLL_INTERVAL_MS);
  }

  #setup(catalog: Catalog): void {
    this.catalog = catalog;
    this.filters.end = defaultEnd(catalog);
    this.selected = loadSelection(catalog.products);
    saveSelection(this.selected);
    this.loadState = 'ready';
  }

  #applyStatus(status: SyncStatus | null, history: UpdateHistory | null): void {
    if (status) {
      this.status = status;
      this.flags.statusPollFailed = false;
    } else this.flags.statusPollFailed = true;
    if (history) this.history = history;
  }

  /**
   * The five-minute check. Fetches the small sync-status.json (and history) and only
   * re-downloads catalog.json when the status shows a new publication, or when no
   * catalog is displayed yet. A newer catalog keeps the user's filters and selection.
   */
  async poll(): Promise<void> {
    if (this.#polling) return;
    this.#polling = true;
    try {
      if (!this.catalog.products.length) {
        const r = await fetchPublished(this.dataBase);
        if (r.catalog) {
          this.flags.catalogPollFailed = false;
          this.#catalogStatus = r.status;
          this.#setup(r.catalog);
        } else this.flags.catalogPollFailed = true;
        this.#applyStatus(r.status, r.history);
        return;
      }
      const { status, history } = await fetchStatus(this.dataBase);
      if (history) this.history = history;
      if (!status) {
        // Offline or unpublished: nothing could be checked.
        this.flags.statusPollFailed = true;
        if (this.flags.usingEmbeddedSnapshot) this.flags.catalogPollFailed = true;
        return;
      }
      this.flags.statusPollFailed = false;
      if (!publicationChanged(this.#catalogStatus, status)) {
        // The displayed catalog is the published one.
        this.status = status;
        this.flags.catalogPollFailed = false;
        this.flags.usingEmbeddedSnapshot = false;
        return;
      }
      const next = await fetchCatalogOrNull(this.dataBase);
      if (!next) {
        // Keep the displayed catalog and its status; retry on the next poll.
        this.flags.catalogPollFailed = true;
        return;
      }
      this.flags.catalogPollFailed = false;
      this.flags.usingEmbeddedSnapshot = false;
      this.#catalogStatus = status;
      this.status = status;
      if (catalogChanged(this.catalog, next)) {
        const kept = carryOver(this.catalog, next, this.filters, this.selected);
        this.catalog = next;
        this.filters = kept.filters;
        this.selected = kept.selected;
        saveSelection(this.selected);
        if (this.dialog) this.closeDialog();
        this.showToast('The published catalog has been updated.');
      }
    } finally {
      this.#polling = false;
    }
  }

  // ---- products ------------------------------------------------------------

  get page(): number {
    return this.pageInfo.page;
  }
  set page(n: number) {
    this.#pageState = { key: this.#pageKey, page: n };
  }

  reset(): void {
    this.filters = resetFilters(this.filters, this.catalog);
    this.#pageState = { key: '', page: 1 };
  }

  setProductView(view: ProductView): void {
    this.productView = view;
    saveView(view);
  }

  // ---- comparison ----------------------------------------------------------

  /** Add/remove a product. Returns false when refused (unknown id or four selected). */
  setComparison(id: string, checked: boolean): boolean {
    const { selected, result } = setSelection(this.selected, this.catalog.products, id, checked);
    if (result === 'unknown') return false;
    if (result === 'full') {
      this.showToast(CAP_MESSAGE);
      return false;
    }
    this.selected = selected;
    saveSelection(this.selected);
    const name = this.catalog.products.find((p) => p.id === id)?.name;
    this.announcer.announce(
      `${name} ${checked ? 'added to' : 'removed from'} comparison. ${selected.length} of 4 selected.`,
    );
    return true;
  }

  clearComparison(): void {
    this.selected = [];
    saveSelection(this.selected);
    focusById(this.view === 'matrix' ? 'matrix-search' : 'query');
    this.announcer.announce('Comparison cleared.');
  }

  // ---- navigation, dialog, toast -------------------------------------------

  /** Switch tab (legacy `tabs`); the ingredient guide announces its count on arrival. */
  async goTo(id: string, moveFocus = false): Promise<void> {
    if (!(VIEWS as readonly string[]).includes(id)) return;
    if (this.dialog) this.closeDialog(false);
    this.view = id as View;
    await tick();
    if (moveFocus) focusById('tab-' + id);
  }

  /** Hero shortcuts: open a tab and focus its search box. */
  async start(id: 'products' | 'ingredients'): Promise<void> {
    await this.goTo(id);
    focusById(id === 'products' ? 'query' : 'ingredient-search');
  }

  async compare(): Promise<void> {
    await this.goTo('matrix');
    focusById('matrix-title');
  }

  #dialogTrigger: Element | null = null;

  openDialog(content: Exclude<DialogContent, null>): void {
    if (!this.dialog) this.#dialogTrigger = document.activeElement;
    this.dialog = content;
  }

  closeDialog(restore = true): void {
    // Close the element now: focus can't move out of a modal dialog while it's open.
    (document.getElementById('dialog') as HTMLDialogElement | null)?.close();
    this.dialog = null;
    if (restore) {
      const trigger = this.#dialogTrigger as HTMLElement | null;
      const valid =
        trigger?.isConnected &&
        !trigger.closest('[hidden]') &&
        trigger.getClientRects().length &&
        !(trigger as HTMLButtonElement).disabled;
      (valid ? trigger : document.getElementById('tab-' + this.view))?.focus();
    }
    this.#dialogTrigger = null;
  }

  showToast(message: string): void {
    this.announcer.announce(message);
    this.toast = { message, visible: true };
    clearTimeout(this.#toastTimer);
    this.#toastTimer = setTimeout(() => (this.toast.visible = false), 6000);
  }
}

export function focusById(id: string, options?: FocusOptions): void {
  document.getElementById(id)?.focus(options);
}
