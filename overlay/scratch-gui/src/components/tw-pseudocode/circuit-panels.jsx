// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Circuit tab's host-side chrome, drawn with the Robot Lab's conventions
// (sim-lab-toolbar.jsx): the panel switch (Designer | Warnings | Parts list | Examples) as a
// segmented group of icon buttons with a "name · what it does" tooltip, the panel views under
// one non-wrapping, sideways-scrolling header row (toolbar-scroll-row.jsx, as the Code tab and
// the Robot Lab do), and every empty state as a centred message with one action under it.
//
// Loaded with the designer (circuit-tab.jsx `load()`, chunk "bw-circuit-panels"), never on
// first load: the tab is mounted from the start, and the first-load budget has no room.
// Everything that decides WHAT to show lives in lib/circuit-panels-model.js.

import React from 'react';
import PropTypes from 'prop-types';
import {Separator, toolStyles} from './sim-lab-toolbar.jsx';
import ScrollRow from './toolbar-scroll-row.jsx';
import {CIRCUIT_PANELS, bomView, circuitPanelLabel, circuitPanelText, warningsBadge, warningsView} from
    '../../lib/circuit-panels-model.js';

/** 24×24 strokes in the Robot Lab's icon style ({d, fill} is a filled shape). */
const PANEL_ICONS = {
    'parts-toggle': 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    'warning': ['M12 3l10 18H2z', 'M12 10v5', {d: 'M11 17.5h2v2h-2z', fill: true}],
    'parts-list': 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
    'example': 'M14 3H6v18h12V7zM14 3v4h4M10 12l-2 2 2 2M14 12l2 2-2 2',
    'ok': ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M8 12.5l3 3 5-6'],
    'info': ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 11v6', 'M12 7.5h.01'],
    'error': ['M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z', 'M12 7v6', 'M12 16.5h.01'],
    'copy': 'M9 9h11v11H9zM5 15H4V4h11v1'
};

const PanelIcon = ({name, size = 18}) => (
    <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} style={{display: 'block', flex: '0 0 auto'}}>
        {[].concat(PANEL_ICONS[name] || []).map((p, i) => (typeof p === 'string' ?
            <path key={i} d={p} /> :
            <path key={i} d={p.d} fill={p.fill ? 'currentColor' : 'none'} />))}
    </svg>
);
PanelIcon.propTypes = {name: PropTypes.string.isRequired, size: PropTypes.number};

/**
 * Designer | Warnings | Parts list | Examples. Square 34 px buttons (the designer toolbar's
 * control size, which its 150 px navigation slot and the circuit UX gate both assume), the
 * Robot Lab mode switch's look: a grey track, the current panel raised in indigo.
 */
export const PanelSwitch = ({panel, drc, locale, onSelect, menu, onPick}) => {
    const badge = warningsBadge(drc);
    return (
        <div data-panel-navigation role="group" aria-label={circuitPanelText(locale, 'group')}
            // No padding: the group must stay 34 px tall, the height of every designer toolbar
            // control (verify-circuit-ux measures it on the bar and in the overflow menu).
            style={menu ? {display: 'grid'} : {display: 'inline-flex', alignItems: 'center', gap: 2, padding: 0, borderRadius: 7,
                background: '#e2e8f0', flex: '0 0 auto', height: 34}}>
            {CIRCUIT_PANELS.map(({id, icon}) => {
                const {name, tooltip} = circuitPanelLabel(locale, id);
                const on = panel === id;
                const count = id === 'warnings' && badge ? badge.count : null;
                if (menu) return (
                    <button key={id} type="button" className="circuit-menu-row" role="menuitemradio"
                        data-testid={`bw-circuit-panel-${id}`} aria-checked={on} title={tooltip}
                        onClick={() => { if (!on) onSelect(id); onPick?.(); }}>
                        <PanelIcon name={icon} />
                        <span className="circuit-menu-label">{name}{count ? ` (${count})` : ''}</span>
                        {on && <span aria-hidden="true">✓</span>}
                    </button>
                );
                return (
                    <button
                        key={id}
                        type="button"
                        data-testid={`bw-circuit-panel-${id}`}
                        onClick={() => { if (!on) onSelect(id); }}
                        // The English name stays the accessible name in English; the gates
                        // and the Edit menu's Panels entries use the same words.
                        aria-label={name}
                        title={count ? `${tooltip} (${count})` : tooltip}
                        aria-pressed={on}
                        style={{
                            position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 34, minWidth: 34, height: 34, padding: 0, boxSizing: 'border-box', borderRadius: 6,
                            border: `1px solid ${on ? '#6366f1' : 'transparent'}`,
                            background: on ? '#fff' : 'transparent',
                            color: on ? '#312e81' : '#334155',
                            boxShadow: on ? '0 1px 2px rgba(15, 23, 42, 0.18)' : 'none',
                            cursor: on ? 'default' : 'pointer'
                        }}
                    >
                        <PanelIcon name={icon} />
                        {count ? (
                            <span aria-hidden="true" style={{position: 'absolute', top: -2, right: -2, minWidth: 14, padding: '0 3px',
                                boxSizing: 'border-box', borderRadius: 8, fontSize: 9, lineHeight: '14px', fontWeight: 700,
                                background: badge.danger ? '#dc2626' : '#f59e0b', color: badge.danger ? '#fff' : '#1f2937'}}
                            >{count}</span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
};
PanelSwitch.propTypes = {
    drc: PropTypes.object,
    menu: PropTypes.bool,
    onPick: PropTypes.func,
    locale: PropTypes.string,
    onSelect: PropTypes.func.isRequired,
    panel: PropTypes.string.isRequired
};

/** A centred message with up to two actions under it: the Robot Lab tab's empty/released state. */
const EmptyState = ({view, locale, onSelect}) => {
    const s = toolStyles(false);
    const tone = {ok: ['ok', '#15803d'], info: ['info', '#475569'], error: ['error', '#b91c1c']}[view.tone] || ['info', '#475569'];
    const actions = [view.action, view.second].filter(Boolean);
    return (
        <div data-circuit-empty-state={view.tone} style={{flex: '1 1 auto', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24, minHeight: 160, textAlign: 'center'}}>
            <span style={{color: tone[1]}}><PanelIcon name={tone[0]} size={28} /></span>
            <p role="status" style={{maxWidth: 460, margin: 0, color: '#334155', fontSize: 14}}>{view.message}</p>
            {view.hint ? <p style={{maxWidth: 460, margin: 0, color: '#64748b', fontSize: 12.5}}>{view.hint}</p> : null}
            {actions.length ? (
                <div style={{display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center'}}>
                    {actions.map((id, i) => (
                        <button key={id} type="button" data-testid={`bw-circuit-empty-${id}`} onClick={() => onSelect(id)}
                            style={i === 0 ?
                                {...s.button, padding: '0 14px', height: 34, borderColor: '#4338ca', background: '#4f46e5', color: '#fff', fontWeight: 600} :
                                {...s.button, padding: '0 14px', height: 34, borderColor: '#cbd5e1', background: '#fff'}}>
                            {circuitPanelText(locale, `action.${id}`)}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
};
EmptyState.propTypes = {locale: PropTypes.string, onSelect: PropTypes.func.isRequired, view: PropTypes.object.isRequired};

/** The CSV for ordering, behind a disclosure; a textarea is selectable everywhere without clipboard permission. */
const BomCsv = ({csv, locale}) => (
    <details style={{marginTop: 12}} data-testid="bw-bom-csv">
        <summary style={{cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6}}>
            <PanelIcon name="copy" size={16} />{circuitPanelText(locale, 'bom.exportCsv')}
        </summary>
        <textarea
            readOnly
            onFocus={e => e.target.select()}
            value={csv}
            style={{width: '100%', minHeight: 140, marginTop: 6, fontFamily: 'monospace', fontSize: 12, boxSizing: 'border-box'}}
        />
    </details>
);
BomCsv.propTypes = {csv: PropTypes.string.isRequired, locale: PropTypes.string};

/** The designer speaks 'de' or 'en'; every other locale gets English. */
const designerLang = locale => (String(locale || 'en').slice(0, 2) === 'de' ? 'de' : 'en');

const WarningsBody = ({drc, ui, locale, onSelect}) => {
    const view = warningsView(locale, drc);
    if (view.kind === 'empty') return <EmptyState view={view} locale={locale} onSelect={onSelect} />;
    // The vendor panel words each finding for the language (bw-circuit-ui src/i18n/drc-de.js).
    if (ui && ui.DrcPanel) return <ui.DrcPanel warnings={view.warnings} lang={designerLang(locale)} />;
    // The data is real even when the vendor panel is not in the build; show it plainly.
    return (
        <ul style={{margin: 0, paddingLeft: 18, fontSize: 13}}>
            {view.warnings.map((w, i) => (
                <li key={i} style={{marginBottom: 6, color: w.severity === 'danger' ? '#991b1b' : '#92400e'}}
                >{`${w.rule}: ${w.message || ''} (${w.partId || 'circuit'})`}</li>
            ))}
        </ul>
    );
};
WarningsBody.propTypes = {drc: PropTypes.object, locale: PropTypes.string, onSelect: PropTypes.func.isRequired, ui: PropTypes.object};

const BomBody = ({ui, circuit, locale, onSelect}) => {
    const view = bomView(locale, ui, circuit);
    if (view.kind === 'empty') return <EmptyState view={view} locale={locale} onSelect={onSelect} />;
    // ONE CSV control. The vendor's BomPanel carries its own CSV export (a bom.csv download,
    // through the same bomToCsv), so the host's copyable CSV is only the fallback for a build
    // without that panel; both at once showed two CSV buttons for one list.
    if (ui.BomPanel) return <ui.BomPanel parts={circuit.parts} lang={designerLang(locale)} />;
    const csv = view.csv === null ? null : <BomCsv csv={view.csv} locale={locale} />;
    return (
        <div>
            <table style={{fontSize: 13, borderCollapse: 'collapse'}}>
                <tbody>
                    {view.rows.map((row, i) => (
                        <tr key={i}>
                            <td style={{padding: '2px 10px 2px 0'}}>{row.qty || row.quantity}</td>
                            <td style={{padding: '2px 10px 2px 0'}}>{row.kind || row.name || row.label}</td>
                            <td style={{padding: '2px 0'}}>{row.value || ''}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {csv}
        </div>
    );
};
BomBody.propTypes = {circuit: PropTypes.object, locale: PropTypes.string, onSelect: PropTypes.func.isRequired, ui: PropTypes.object};

const ExamplesBody = ({ui, examples, examplesError, currentDevice, locale, onLoadExample, onDismissError}) => {
    if (!ui || !ui.ExamplesBrowser) {
        return <EmptyState view={{tone: 'info', message: circuitPanelText(locale, 'examples.noBrowser')}} locale={locale} onSelect={() => {}} />;
    }
    if (!examples) {
        return examplesError ?
            <EmptyState view={{tone: 'error', message: examplesError}} locale={locale} onSelect={() => {}} /> :
            <div role="status" style={{padding: 24, color: '#64748b'}}>{circuitPanelText(locale, 'examples.loading')}</div>;
    }
    // An advisory is a DISMISSIBLE STRIP above the list; it used to replace the whole browser,
    // so one sticky message rendered where the examples list should have been.
    return (
        <div style={{display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0}}>
            {examplesError ? (
                <div role="status" style={{display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', fontSize: 12,
                    background: 'rgba(230, 126, 34, 0.12)', borderBottom: '1px solid rgba(230, 126, 34, 0.4)', flexShrink: 0}}>
                    <span style={{flex: 1}}>{examplesError}</span>
                    <button type="button" onClick={onDismissError} aria-label={circuitPanelText(locale, 'a11y.dismiss')}
                        style={{border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1}}>{'×'}</button>
                </div>
            ) : null}
            <div style={{flex: 1, minHeight: 0, overflow: 'auto'}}>
                <ui.ExamplesBrowser examples={examples} onLoadExample={onLoadExample} currentDevice={currentDevice}
                    lang={designerLang(locale)} />
            </div>
        </div>
    );
};
ExamplesBody.propTypes = {
    currentDevice: PropTypes.string,
    examples: PropTypes.array,
    examplesError: PropTypes.string,
    locale: PropTypes.string,
    onDismissError: PropTypes.func,
    onLoadExample: PropTypes.func,
    ui: PropTypes.object
};

/**
 * A panel other than the Designer: one header row (the panel switch, the panel's name, and
 * what it is for), then the panel's body, which carries its own scroll (the tab is
 * `overflow: clip`, and a 53-row parts list would otherwise be cut off with no way to reach it).
 */
export const PanelView = props => {
    const {panel, drc, locale, onSelect} = props;
    const badge = warningsBadge(drc);
    const {name} = circuitPanelLabel(locale, panel);
    const heading = panel === 'warnings' && badge ? circuitPanelText(locale, 'heading.warnings', {count: badge.count}) : name;
    const hint = circuitPanelText(locale, `hint.${panel}`);
    let body = null;
    if (panel === 'warnings') body = <WarningsBody {...props} />;
    else if (panel === 'bom') body = <BomBody {...props} />;
    else if (panel === 'examples') body = <ExamplesBody {...props} />;
    return (
        <div data-circuit-panel={panel} style={{display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, gap: 6}}>
            <ScrollRow testId="bw-circuit-panel-header" label={circuitPanelText(locale, 'group')}
                style={{padding: '4px 6px', minHeight: 44, boxSizing: 'border-box', alignItems: 'center',
                    background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 4}}
                scrollerStyle={{alignItems: 'center', gap: 6}}>
                <PanelSwitch panel={panel} drc={drc} locale={locale} onSelect={onSelect} />
                <Separator coarse={false} />
                <h2 style={{margin: 0, fontSize: 14, fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap'}}>{heading}</h2>
                <span style={{fontSize: 12, color: '#64748b', whiteSpace: 'nowrap'}}>{hint}</span>
            </ScrollRow>
            <div style={{flex: '1 1 0', minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column'}}>
                {body}
            </div>
        </div>
    );
};
PanelView.propTypes = {
    circuit: PropTypes.object,
    drc: PropTypes.object,
    locale: PropTypes.string,
    onSelect: PropTypes.func.isRequired,
    panel: PropTypes.string.isRequired,
    ui: PropTypes.object
};
