// Keyboard behavior shared by the existing menu components. Form controls inside
// menus keep their native cursor keys; editor commands never receive those keys.
export const menuItems = menu => Array.from(menu?.querySelectorAll('[role^="menuitem"]') || [])
    .filter(item => item.closest('[role="menu"]') === menu && item.getAttribute('aria-disabled') !== 'true');

export const focusMenuEdge = (menu, last = false) => {
    const items = menuItems(menu);
    const item = items[last ? items.length - 1 : 0];
    if (item) { item.focus(); item.scrollIntoView?.({block: 'nearest'}); }
    else menu?.focus?.();
};

// A deferred submenu callback must not steal a newer pointer or keyboard focus.
export const focusSubmenuIfStillOnOpener = opener => {
    if (opener && opener.ownerDocument.activeElement === opener) {
        focusMenuEdge(opener.querySelector('[role="menu"]'));
    }
};

export const openMenuFromKeyboard = (event, open, close) => {
    if (['Escape', 'Tab'].includes(event.key) &&
        event.currentTarget.getAttribute('aria-expanded') === 'true' && typeof close === 'function') {
        if (event.key === 'Escape') event.preventDefault();
        event.stopPropagation();
        close();
        return;
    }
    if (!['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const root = event.currentTarget.closest('[data-bw-menu-root]');
    const last = event.key === 'ArrowUp';
    open();
    requestAnimationFrame(() => focusMenuEdge(root?.querySelector('[role="menu"]'), last));
};

const cycleRootMenu = (menu, step, close) => {
    const opener = menu.closest('[data-bw-menu-root]')?.querySelector('[data-bw-menu-trigger]');
    if (!opener) return;
    const triggers = Array.from(menu.ownerDocument.querySelectorAll('[data-bw-menu-trigger]'))
        .filter(button => !button.disabled && button.getClientRects().length);
    const index = triggers.indexOf(opener);
    if (index < 0 || triggers.length < 2) return;
    const next = triggers[(index + step + triggers.length) % triggers.length];
    close?.();
    next.focus();
    next.click();
    requestAnimationFrame(() => focusMenuEdge(next.closest('[data-bw-menu-root]')?.querySelector('[role="menu"]')));
};

export const handleMenuKeyDown = (event, close) => {
    if (event.target.matches?.('input, textarea, select, [contenteditable="true"]') &&
        !['Escape', 'Tab'].includes(event.key)) return;
    const menu = event.currentTarget;
    const parentItem = menu.parentElement?.closest('[role^="menuitem"]');
    if (!parentItem && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        cycleRootMenu(menu, event.key === 'ArrowRight' ? 1 : -1, close);
        return;
    }
    if (event.key === 'Escape' || event.key === 'Tab' || event.key === 'ArrowLeft') {
        if (event.key === 'ArrowLeft' && !parentItem) return;
        if (event.key !== 'Tab') event.preventDefault();
        event.stopPropagation();
        const opener = parentItem || menu.closest('[data-bw-menu-root]')?.querySelector('[data-bw-menu-trigger]');
        close?.();
        if (event.key !== 'Tab') opener?.focus();
        return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const items = menuItems(menu);
    const active = event.target.closest('[role^="menuitem"]');
    const index = items.indexOf(active);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
        event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    if (items[next]) { items[next].focus(); items[next].scrollIntoView?.({block: 'nearest'}); }
};

export const menuTriggerStyle = {display: 'inline-flex', alignItems: 'center', height: '100%',
    padding: '0 0.25rem', margin: 0, border: 0, background: 'none', color: 'inherit', font: 'inherit', cursor: 'pointer'};
