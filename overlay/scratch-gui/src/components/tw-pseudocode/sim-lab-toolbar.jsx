// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Robot Lab's icon toolbar (sim-lab-pane.jsx): grouped icon buttons, a tooltip
// on each with its name and shortcut (sim-lab-toolbar-text.js), its name as the
// accessible name, toggles as pressed buttons or switches, and, when the pane is
// narrow, a "More" menu holding whatever does not fit, with full names.
//
// Icons are drawn as inline SVG strokes, the way the app's other Brickwright surfaces
// draw theirs (the Code tab's icon in gui.jsx, the Lab's own compact toolbar before
// this): no icon font, no new dependency, the same picture on every school device.
//
// Every control keeps one test id, `bw-sim-lab-<id>`, wherever it is shown (bar or
// menu), and only one of the two is rendered at a time.

import React from 'react';
import {createPortal} from 'react-dom';
import {createPopupTrigger} from './sim-lab-popup-trigger.js';

/** 24×24 stroke paths; an array entry {d, fill: true} is a filled shape. */
export const ICONS = {
    simulate: ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', {d: 'M10 8.5v7l5.5-3.5z', fill: true}],
    build: 'M3 11h18v9H3zM6 11V7h4v4M14 11V7h4v4',
    instructions: 'M2 5h6a4 4 0 0 1 4 4v11a3 3 0 0 0-3-3H2zM22 5h-6a4 4 0 0 0-4 4v11a3 3 0 0 1 3-3h7z',
    run: [{d: 'M7 4l13 8-13 8z', fill: true}],
    pause: 'M8 5v14M16 5v14',
    reset: 'M3 4v6h6M3.5 15a9 9 0 1 0 2.1-9.4L3 10',
    'mode-move': 'M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3',
    'mode-rotate': 'M21 12a9 3.5 0 1 1-18 0a9 3.5 0 1 1 18 0zM12 3a3.5 9 0 1 1 0 18a3.5 9 0 1 1 0-18z',
    turn: 'M19 12a7 7 0 1 1-2-4.9M19 4v4h-4',
    'turn-back': 'M5 12a7 7 0 1 0 2-4.9M5 4v4h4',
    tip: 'M4 20h16M6 16L16 6M16 6v6M16 6h-6',
    group: 'M2 2h20v20H2zM6 6h5v5H6zM13 13h5v5h-5z',
    ungroup: 'M3 3h7v7H3zM14 14h7v7h-7zM14 3l3 3M21 10l-3-3M3 21l3-3M10 14l-3 3',
    duplicate: 'M8 8h12v12H8zM4 16V4h12M14 11v6M11 14h6',
    delete: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    cancel: 'M6 6l12 12M18 6L6 18',
    copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
    paste: 'M9 3h6v4H9zM8 5H5v16h14V5h-3',
    'select-all': 'M4 4h3M10 4h4M17 4h3v3M20 10v4M20 17v3h-3M14 20h-4M7 20H4v-3M4 14v-4M4 7V4',
    undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
    redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
    'view-home': 'M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5',
    'view-fit': 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M9 9h6v6H9z',
    'view-top': ['M12 3l9 5v8l-9 5-9-5V8z', {d: 'M12 3l9 5-9 5-9-5z', fill: true}],
    'view-front': ['M12 3l9 5v8l-9 5-9-5V8z', {d: 'M3 8l9 5v8l-9-5z', fill: true}],
    'view-side': ['M12 3l9 5v8l-9 5-9-5V8z', {d: 'M21 8l-9 5v8l9-5z', fill: true}],
    grid: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18',
    'show-ports': 'M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4',
    'show-motion': 'M4 12h9M2 7h8M6 17h8M15 7l5 5-5 5',
    // Simulate: a gauge (speed), a sensor with its beam, a small chart (readings)
    speed: 'M4 17a8 8 0 1 1 16 0M12 17l4-6M3 17h2M19 17h2',
    'show-sensors': 'M3 9h5v6H3zM8 12h3M13 12h2M17 12h2M21 10v4',
    readings: 'M3 3v18h18M7 15l4-5 3 3 5-7',
    'show-stats': 'M3 21h18M6 17v-5M12 17V4M18 17V8',
    // a trophy (challenges)
    challenges: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3',
    'mirror-x': 'M12 3v18M9 7l-6 5 6 5zM15 7l6 5-6 5z',
    'mirror-z': 'M3 12h18M7 9l5-6 5 6zM7 15l5 6 5-6z',
    hide: 'M3 3l18 18M10.6 6.1A10 10 0 0 1 12 6c6 0 10 6 10 6a17 17 0 0 1-3.2 3.7M6.6 6.6A17 17 0 0 0 2 12s4 6 10 6a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
    isolate: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    'show-all': 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z',
    measure: 'M3 17L17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2',
    eyedropper: 'M15 3l6 6-3 3-6-6zM13 7l-9 9v4h4l9-9',
    'parts-toggle': 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    properties: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
    shortcuts: 'M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10',
    'file-menu': 'M3 6h6l2 2h10v11H3z',
    open: 'M3 6h6l2 2h10v3M3 6v13h15l3-8H6l-3 8',
    save: 'M12 4v11M7 10l5 5 5-5M4 20h16',
    example: 'M14 3H6v18h12V7zM14 3v4h4M10 12l-2 2 2 2M14 12l2 2-2 2',
    help: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    caret: 'M6 9l6 6 6-6',
    chevronLeft: 'M15 6l-6 6 6 6',
    chevronRight: 'M9 6l6 6-6 6'
};

export const Icon = ({name, size = 18}) => {
    const spec = [].concat(ICONS[name] || []);
    return (
        <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeLinecap="round" strokeLinejoin="round" strokeWidth={name === 'more' ? 3.5 : 2} style={{display: 'block', flex: '0 0 auto'}}>
            {spec.map((p, i) => (typeof p === 'string' ?
                <path key={i} d={p} /> :
                <path key={i} d={p.d} fill={p.fill ? 'currentColor' : 'none'} />))}
        </svg>
    );
};

/** The tooltip: the name, the shortcut when there is one, then what it does when that needs saying. */
export const tooltipOf = (T, id, label, help) => {
    const keys = T.keys[id];
    const named = keys ? T.tooltip.replace('{label}', label).replace('{keys}', keys) : label;
    return help ? `${named} · ${help}` : named;
};

/** Colours and sizes shared by every toolbar control. */
export const toolStyles = coarse => {
    const size = coarse ? 40 : 32;
    const base = {display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, minWidth: size, height: size,
        padding: '0 7px', boxSizing: 'border-box', borderRadius: 6, border: '1px solid transparent', background: 'transparent',
        color: '#1e293b', cursor: 'pointer', font: 'inherit', fontSize: 12, whiteSpace: 'nowrap', flex: '0 0 auto'};
    return {
        size,
        button: base,
        pressed: {...base, background: '#e0e7ff', borderColor: '#6366f1', color: '#312e81'},
        primary: {...base, background: '#16a34a', borderColor: '#15803d', color: '#fff', padding: '0 10px', fontWeight: 600},
        stop: {...base, background: '#f59e0b', borderColor: '#d97706', color: '#1f2937', padding: '0 10px', fontWeight: 600},
        separator: {width: 1, alignSelf: 'stretch', margin: '4px 3px', background: '#cbd5e1', flex: '0 0 1px'}
    };
};

/**
 * One toolbar action. `item`: {id, label, icon, run, disabled, pressed, kind ('button' | 'switch'), words, style}.
 * On the bar it is an icon (words beside it when `words`); in the More menu it is a row with
 * its name and its shortcut.
 */
export const ToolButton = ({item, T, coarse, inMenu = false}) => {
    const s = toolStyles(coarse);
    const title = tooltipOf(T, item.id, item.label, item.title);
    const isSwitch = item.kind === 'switch';
    const on = Boolean(item.pressed);
    const aria = isSwitch ? {role: 'switch', 'aria-checked': on} : (item.pressed === undefined ? {} : {'aria-pressed': on});
    const keys = T.keys[item.id];
    if (inMenu) {
        return (
            <button type="button" data-overflow-action data-testid={`bw-sim-lab-${item.id}`} disabled={item.disabled} title={title} aria-label={item.label}
                aria-keyshortcuts={keys || undefined} onClick={item.run} {...aria}
                style={{...s.button, justifyContent: 'flex-start', width: '100%', height: coarse ? 40 : 30, padding: '0 8px',
                    ...(on ? {background: '#e0e7ff', color: '#312e81'} : {}), opacity: item.disabled ? 0.45 : 1}}>
                <Icon name={item.icon || item.id} />
                <span style={{flex: '1 1 auto', textAlign: 'left'}}>{item.label}</span>
                {keys ? <kbd style={{fontFamily: 'inherit', fontSize: 11, color: '#64748b'}}>{keys}</kbd> : null}
            </button>
        );
    }
    const style = item.style || (on ? s.pressed : s.button);
    return (
        <button type="button" data-testid={`bw-sim-lab-${item.id}`} disabled={item.disabled} title={title} aria-label={item.label}
            aria-keyshortcuts={keys || undefined} onClick={item.run} {...aria}
            style={{...style, opacity: item.disabled ? 0.4 : 1, cursor: item.disabled ? 'default' : 'pointer'}}>
            <Icon name={item.icon || item.id} />
            {item.words ? <span>{item.words}</span> : null}
        </button>
    );
};

/**
 * A pop-up attached to a toolbar button: the More menu, the File menu, Help.
 * Closes on Escape and on a press outside it (the pane's outside-press handler,
 * which looks for [data-sim-lab-popup]).
 */
export const Popup = ({id, open, onToggle, onClose, button, children, align = 'left', width = 260, label, closeOnPick = true, testId, role = 'group', anchorTestId, keepMounted = false, overflowMenu = false}) => {
    const anchor = React.useRef(null);
    const panel = React.useRef(null);
    const toggle = React.useRef(onToggle);
    toggle.current = onToggle;
    const trigger = React.useRef(null);
    if (!trigger.current) trigger.current = createPopupTrigger(() => toggle.current());
    const [position, setPosition] = React.useState({left: 8, top: 8});
    React.useLayoutEffect(() => {
        if (!open) return undefined;
        const place = () => {
            const rect = anchor.current?.getBoundingClientRect();
            if (!rect) return;
            if (!rect.width && !rect.height) { onClose('hidden'); return; }
            const w = Math.min(width, window.innerWidth - 16);
            const left = Math.max(8, Math.min(window.innerWidth - w - 8, align === 'right' ? rect.right - w : rect.left));
            const top = Math.min(rect.bottom + 4, Math.max(8, window.innerHeight - 220));
            // Same spot: no state change, so no re-render and no layout for the observer to see again.
            setPosition(prev => (prev.left === left && prev.top === top ? prev : {left, top}));
        };
        place();
        // The observer callback only SCHEDULES the placement for the next frame. Doing it inside
        // the callback (a state update, and `onClose` when the anchor is hidden) re-rendered, and so
        // re-laid-out, the very toolbar being observed within the same delivery: the shape that can end
        // in "ResizeObserver loop completed with undelivered notifications".
        let frame = 0;
        const schedule = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; place(); }); };
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
        if (anchor.current) observer?.observe(anchor.current);
        window.addEventListener('resize', place);
        window.addEventListener('scroll', place, true);
        return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
    }, [open, width, align]);
    React.useEffect(() => {
        if (!open) return undefined;
        const outside = event => {
            if (!anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) onClose('outside');
        };
        document.addEventListener('pointerdown', outside, true);
        return () => document.removeEventListener('pointerdown', outside, true);
    }, [open, onClose]);
    return <div ref={anchor} data-testid={anchorTestId} data-sim-lab-popup={id} style={{position: 'relative', flex: '0 0 auto'}}
        onBlur={e => {
            // Focus moved to something outside both the button and the (portalled) panel: close, as a
            // menu does. Events from the portal bubble here through the React tree. A dialog keeps its
            // own focus handling, and a null target (the window lost focus, a click on a non-focusable
            // surface) is left to the outside-press handler.
            const next = e.relatedTarget;
            if (!open || role === 'dialog' || !next) return;
            if (!anchor.current?.contains(next) && !panel.current?.contains(next)) onClose('blur');
        }}
        onKeyDown={e => {
            const trigger = anchor.current?.querySelector('button');
            if (open && e.key === 'Escape') { e.stopPropagation(); onClose('escape'); trigger?.focus(); return; }
            // The panel is portalled to <body>, so Tab would leave it for the end of the page: arrows move
            // between its controls, ArrowDown on the button opens it onto the first, and Tab off either
            // end returns to the button.
            const items = Array.from(panel.current?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), [role="menuitem"]:not([aria-disabled="true"]), [tabindex="0"]') || []);
            if (e.target === trigger && e.key === 'ArrowDown' && role !== 'dialog') {
                e.preventDefault();
                if (!open) onToggle();
                requestAnimationFrame(() => (Array.from(panel.current?.querySelectorAll('button:not([disabled]), [role="menuitem"]:not([aria-disabled="true"])') || [])[0])?.focus());
                return;
            }
            if (!open || !panel.current || !panel.current.contains(e.target) || !items.length) return;
            const at = items.indexOf(e.target.closest('button, a[href], input, select, [role="menuitem"], [tabindex="0"]'));
            const field = e.target.matches && e.target.matches('input, select, textarea');
            if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !field && role !== 'dialog') {
                e.preventDefault();
                items[(Math.max(at, 0) + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
            } else if (e.key === 'Tab' && ((!e.shiftKey && at === items.length - 1) || (e.shiftKey && at === 0))) {
                e.preventDefault();
                onClose('tab');
                trigger?.focus();
            }
        }}>
        {React.cloneElement(button, {'aria-haspopup': role === 'dialog' ? 'dialog' : 'true', 'aria-expanded': open, ...trigger.current})}
        {open || keepMounted ? createPortal(
            <div ref={panel} role={role} data-sim-lab-popup={id} data-editor-overflow={overflowMenu || undefined} aria-label={label} data-testid={testId || `bw-sim-lab-${id}-menu`}
                onClick={e => {
                    if (!closeOnPick || !e.target.closest) return;
                    const pick = e.target.closest('button');
                    // A disclosure button (aria-expanded) or one marked data-keep-open opens something INSIDE
                    // the menu; closing would hide what it just showed.
                    if (pick && !pick.closest('[aria-expanded], [data-keep-open]')) onClose();
                }}
                style={{position: 'fixed', ...position, zIndex: 3000, width, maxWidth: 'calc(100vw - 16px)', maxHeight: '65vh',
                    overflowY: 'auto', display: open ? 'flex' : 'none', flexDirection: 'column', alignItems: 'stretch', gap: 2, padding: 6, fontSize: 12,
                    background: '#fff', border: '1px solid #94a3b8', borderRadius: 8, boxShadow: '0 6px 18px rgba(15, 23, 42, 0.25)', boxSizing: 'border-box'}}>
                {children}
            </div>
        , document.body) : null}
    </div>;
};

/** A thin rule between groups (decorative). */
export const Separator = ({coarse}) => <span aria-hidden="true" style={toolStyles(coarse).separator} />;

/**
 * Which of `groups` (in order; each {id, label, items}) stay on the bar when it is `width` px
 * wide and which go to the More menu. Items carry a priority (`pri`: 1 first to stay, then 2, 3);
 * the lowest-priority ones leave first, and if even the first ones do not fit, the last of them
 * leave too. With `width` 0 (not measured) or `wrap`, nothing leaves.
 * @returns {{bar: object[], more: object[]}} groups with their items split
 */
export const splitToolbar = (groups, {width, coarse, reserved = 0, wrap = false}) => {
    if (!width || wrap) return {bar: groups, more: []};
    const s = toolStyles(coarse);
    const GAP = 2;
    const SEPARATOR = 7 + 2 * GAP;
    const itemWidth = item => (item.width || (item.words ? s.size + 8 * String(item.words).length : s.size)) + GAP;
    const total = bar => reserved + s.size + GAP + bar.reduce((sum, g) => sum + (g.items.length ? SEPARATOR + g.items.reduce((n, i) => n + itemWidth(i), 0) : 0), 0);
    const keep = maxPri => groups.map(g => ({...g, items: g.items.filter(i => (i.pri || 3) <= maxPri)}));
    const maxPri = [3, 2, 1].find(p => total(keep(p)) <= width) || 1;
    const bar = keep(maxPri);
    const dropped = new Set(groups.flatMap(g => g.items.filter(i => (i.pri || 3) > maxPri)));
    // Still too wide: the last items on the bar go too, except the pinned ones (`pin`: the
    // compact palette's button, Run, Undo — what a narrow pane cannot work without).
    for (let g = bar.length - 1; g >= 0 && total(bar) > width; g--) {
        for (let k = bar[g].items.length - 1; k >= 0 && total(bar) > width; k--) {
            if (bar[g].items[k].pin) continue;
            dropped.add(bar[g].items[k]);
            bar[g].items.splice(k, 1);
        }
    }
    const more = groups.map(g => ({...g, items: g.items.filter(i => dropped.has(i))})).filter(g => g.items.length);
    return {bar: bar.filter(g => g.items.length), more};
};
