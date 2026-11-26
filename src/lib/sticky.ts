// The sticky stack (4a follow-up 4): the tab bar pins at the top at every width; on
// desktop the products search + toolbar row pins under it. Their pinned heights are
// published as CSS custom properties on <html> so other parts can sit below them:
//   --tabs-h  height of the stuck tab bar (CSS fallbacks until it first sticks)
//   --head-h  height of the pinned products head (0 on phones and other tabs)
// `scroll-padding-top` uses both, so focus(), anchors and scrollIntoView land below.

/**
 * Publish an element's *pinned* height as a CSS variable on <html>, so offsets that
 * depend on it stay put while things pin and unpin (moving offsets made the sticky
 * sidebar jump under the pointer). The element counts as pinned while it has
 * `pinnedClass`; `active()` false (hidden, or not pinnable at this width) publishes 0;
 * otherwise the last pinned value is kept. Driven by the DOM itself (class and size
 * observers), so it can't run ahead of rendering.
 */
export function publishPinnedHeight(
  el: HTMLElement,
  variable: string,
  pinnedClass: string,
  active: () => boolean = () => true,
) {
  const update = () => {
    if (!active() || el.offsetParent === null)
      document.documentElement.style.setProperty(variable, '0px');
    else if (el.classList.contains(pinnedClass))
      document.documentElement.style.setProperty(variable, el.offsetHeight + 'px');
  };
  const sizes = new ResizeObserver(update);
  sizes.observe(el, { box: 'border-box' });
  const classes = new MutationObserver(update);
  classes.observe(el, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('resize', update);
  update();
  return {
    update,
    destroy() {
      sizes.disconnect();
      classes.disconnect();
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty(variable);
    },
  };
}

/**
 * Call `update` on any scroll (window or the ?embed body scroller) and resize, once per
 * frame. Returns a cleanup.
 */
export function onScrollFrame(update: () => void) {
  let frame = 0;
  const schedule = () => {
    if (!frame)
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
  };
  document.addEventListener('scroll', schedule, { capture: true, passive: true });
  window.addEventListener('resize', schedule);
  update();
  return () => {
    cancelAnimationFrame(frame);
    document.removeEventListener('scroll', schedule, { capture: true });
    window.removeEventListener('resize', schedule);
  };
}

/** Desktop layout (where the products head pins too). */
export const DESKTOP = '(min-width: 701px)';

/**
 * Keep an element's share of the page height constant when it slims down while pinned
 * (it has `pinnedClass`). Without this, a short page near its end can loop: pinning
 * shrinks the page, the scroll position clamps, the element unpins and grows, and so
 * on. While pinned, the lost height is added back as bottom margin (in flow, above the
 * visible area). Driven by class and size observers.
 */
export function flowKeeper(el: HTMLElement, pinnedClass: string) {
  let natural = 0;
  const outer = () => {
    const style = getComputedStyle(el);
    return el.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
  };
  const apply = () => {
    el.style.marginBottom = '';
    if (!el.classList.contains(pinnedClass)) {
      natural = outer();
      return;
    }
    const extra = natural - outer();
    if (extra > 0)
      el.style.marginBottom = parseFloat(getComputedStyle(el).marginBottom) + extra + 'px';
  };
  const sizes = new ResizeObserver(apply);
  sizes.observe(el, { box: 'border-box' });
  const classes = new MutationObserver(apply);
  classes.observe(el, { attributes: true, attributeFilter: ['class'] });
  apply();
  return () => {
    sizes.disconnect();
    classes.disconnect();
    el.style.marginBottom = '';
  };
}
