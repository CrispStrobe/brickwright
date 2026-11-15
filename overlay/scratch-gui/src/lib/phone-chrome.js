/**
 * Give a phone back some of its vertical space.
 *
 * MEASURED FIRST. The menu bar is 48px and the tab strip 44px, so 92px of
 * chrome sits above any content. In portrait that is 39pt of a 930pt screen
 * (4.2%) and does not matter. IN LANDSCAPE IT IS 84pt OF 430 — 19.4%, a fifth
 * of the screen gone before the reader sees anything. Shrinking the two rows to
 * 36 and 34 takes it to 70px: 64pt, 14.8%. Every tab stays clickable and no tab
 * falls below the 32px touch floor.
 *
 * AND IT IS ONE ROW NOW. The menu bar has 509px of free width (its items end at
 * x=481, the next sits at 996) and the tab strip is only 250px wide, so the tabs
 * fit beside them. The first attempt moved the strip with `position: absolute`
 * and DID reclaim the 44px — `panelTop` 92 -> 48 — but the relocated tabs were
 * 0 of 6 clickable. That was not a stacking problem: z-index 492 over the menu
 * bar's 491 changed nothing, and elementsFromPoint showed the tab list absent
 * from the hit stack entirely. Lifted out of its parent's box it was CLIPPED by
 * an ancestor's `overflow: hidden`, which cannot simply be relaxed because that
 * same overflow is what makes the panes scroll.
 *
 * `position: fixed` is the answer, because a fixed box is positioned against the
 * viewport and ESCAPES ancestor overflow clipping altogether. Measured with it:
 * chrome 92 -> 36px, tabs 6 of 6 hittable AND 6 of 6 actually switchable, in
 * both orientations, with zero overlap against the menu items.
 *
 * Two things that had to be checked before trusting it, because a fixed element
 * floats over everything by nature:
 *   - The File menu still opens and its dropdown is reachable (186x312, hit
 *     test lands inside it), so the strip does not cover the menus it sits
 *     beside.
 *   - FULL SCREEN is unaffected: the app already removes the tab strip there
 *     (measured rect [0,0,0,0]), so there is no floating tab bar over a
 *     full-screen stage or widgets pane.
 *
 * A fixed element is also only safe while no ancestor is transformed — a
 * transform makes it position against that ancestor instead. Checked: none of
 * the tab list's ancestors carries transform, filter or will-change.
 *
 * Keyed on the same `data-bw-touch` flag as the tap-target floor, for the same
 * reason: a width media query cannot fire when the layout viewport is 1024 on
 * every phone. See touch-targets.js.
 *
 * @module
 */

const STYLE_ID = 'bw-phone-chrome';
const ATTR = 'data-bw-touch';

/** Menu bar height on a touch screen, in CSS pixels. */
export const MENU_H = 44;
/** Tab strip height on a touch screen, in CSS pixels. */
export const TABS_H = 44;
/** Distance from the right edge, clearing the menu bar's right-hand item. */
export const TABS_RIGHT = 60;
/**
 * Floor for the editor column, in CSS pixels — upstream's own flex-basis.
 * It is a FLOOR and not a fixed width: the point is to let that column shrink
 * back to it so the right-hand pane can have some width. See the note below.
 */
export const EDITOR_MIN = 598;
/**
 * Tab height. Stays at or above the 32px touch floor deliberately — shrinking
 * the row must not shrink the thing you tap.
 */
export const TAB_H = 44;

/**
 * The rule text. Class names are matched by SUBSTRING because CSS Modules
 * rewrites them (`menu-bar_menu-bar_x2Jqi`), and the generated name keeps the
 * source name inside it. Exported so a test can assert what it touches.
 * @returns {string}
 */
export const chromeRule = () => `
html[${ATTR}] [class*="menu-bar_menu-bar"],
html[${ATTR}] [class*="gui_menu-bar-position"] {
    height: ${MENU_H}px;
    min-height: ${MENU_H}px;
}
html[${ATTR}] [class*="gui_tab-list"] {
    /* fixed, not absolute: see the note above on ancestor overflow clipping. */
    position: fixed;
    top: 1px;
    right: ${TABS_RIGHT}px;
    width: max-content;
    max-width: var(--bw-tab-available, calc(100% - ${TABS_RIGHT + 8}px));
    overflow-x: auto;
    padding: 0;
    gap: 2px;
    flex-wrap: nowrap;
    height: ${TABS_H}px;
    min-height: ${TABS_H}px;
    margin: 0;
    /* above the menu bar's 491, which is a sibling in the root stacking context */
    z-index: 492;
    background: transparent;
}
html[${ATTR}] [class*="gui_tab"][role="tab"] {
    height: ${TAB_H}px;
    min-height: ${TAB_H}px;
    min-width: ${TAB_H}px;
    flex: 0 0 auto;
    box-sizing: border-box;
    margin: 0;
    padding: 0 10px;
    align-items: center;
    justify-content: center;
    white-space: nowrap;
}
html[${ATTR}] [role="tab"] [data-bw-tab-label] {
    font-size: 14px;
    line-height: 20px;
}
html[${ATTR}] [role="tab"] [data-bw-tab-icon] {
    flex: 0 0 20px;
    width: 20px;
    height: 20px;
    font-size: 20px;
}
html[${ATTR}] [data-testid="bw-chrome-toggle"] {
    width: ${TAB_H}px;
    height: ${TAB_H}px;
    min-width: ${TAB_H}px;
    min-height: ${TAB_H}px;
    top: 1px;
}
/* Compact mode must also escape the clipped editor ancestor. Reset both
   horizontal anchors; retaining right:48px with relative positioning put the
   expand control at x=-28 on a 1024px iPad. */
html[${ATTR}] body.bw-compact-chrome [role="tablist"] {
    position: fixed;
    top: 1px;
    left: 56px;
    right: auto;
    width: max-content;
    max-width: var(--bw-tab-available, calc(100% - 64px));
    height: ${TABS_H}px;
    min-height: ${TABS_H}px;
}
/* Fixed compact tabs still need a row above the editor's actual controls. */
html[${ATTR}] body.bw-compact-chrome [class*="gui_tabs"] {
    box-sizing: border-box;
    padding-top: ${TABS_H}px;
}
/* LET THE EDITOR COLUMN SHRINK, so the pane beside it can exist.
   Upstream gives it 'flex: 1 0 598px' -- grow freely, NEVER shrink. On a 1024
   layout that starves its neighbour: measured on the Circuit tab in landscape,
   where the parts rail is open, the editor grew to 942px and the stage column
   (which is what the debugger is portaled into) collapsed to its 120px
   min-width and then overflowed the layout, right edge 1071 against 1024. A
   120px debugger is not a debugger.
   With shrink enabled and 598 kept as a floor: editor 942 -> 660, debugger
   120 -> 355, right edge 1071 -> 1024. The designer keeps its bench — the
   canvas stays 700 wide inside an overflow-x: auto pane (scrollWidth 700,
   client 418), which is how it already behaved, and its right edge is inside
   the layout.
   Portrait is unaffected: the rail starts closed there, so the editor was
   already 660 and the column already 355. */
html[${ATTR}] [class*="gui_editor-wrapper"] {
    flex: 1 1 ${EDITOR_MIN}px;
    min-width: ${EDITOR_MIN}px;
}
`;

/**
 * Install the rule. Idempotent. The `html` flag itself is owned by
 * touch-targets.js — this only adds rules that read it, so the two cannot
 * disagree about whether a screen is a touch screen.
 * @returns {() => void} uninstall
 */
export function installPhoneChrome () {
    if (typeof document === 'undefined') return () => {};
    let style = document.getElementById(STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    style.textContent = chromeRule();
    return () => {
        if (style && style.parentNode) style.parentNode.removeChild(style);
    };
}
