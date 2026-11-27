// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Circuit tab's own panels (Designer | Warnings | Parts list | Examples): their names,
// their one-line help, and what each shows when it has nothing to list. Pure data and
// decisions, no React, so it is testable on its own; circuit-panels.jsx draws it the way
// the Robot Lab draws its toolbar and its empty states (icon buttons with a name and a
// "name · what it does" tooltip, a centred message with one action under it).

import {makeT} from './bw-i18n.js';

/** The panels in strip order, with the Robot Lab icon each one uses (sim-lab-toolbar.jsx ICONS). */
export const CIRCUIT_PANELS = [
    {id: 'designer', icon: 'parts-toggle'},
    {id: 'warnings', icon: 'warning'},
    {id: 'bom', icon: 'parts-list'},
    {id: 'examples', icon: 'example'}
];

export const CIRCUIT_PANEL_TEXT = {
    en: {
        'group': 'Circuit panels',
        'name.designer': 'Designer',
        'name.warnings': 'Circuit Check',
        'name.bom': 'Parts list',
        'name.examples': 'Examples',
        'help.designer': 'Build the circuit on the breadboard and simulate it',
        'help.warnings': 'Design-rule check: shorts, missing resistors, overloaded pins',
        'help.bom': 'Every part on the board, counted, with a CSV for ordering',
        'help.examples': 'Starter circuits and programs to open and change',
        'heading.warnings': 'Circuit Check ({count})',
        'hint.warnings': 'Checked again whenever the circuit changes. Red items can damage a real part.',
        'hint.bom': 'Counts every part on the board. Copy the CSV to order them.',
        'hint.examples': 'Opening an example replaces the circuit on the board.',
        'drc.noExport': 'This build of the circuit designer cannot check circuits yet.',
        'drc.noCircuit': 'The circuit has not loaded yet, so it cannot be checked. Open the Designer once, then come back.',
        'drc.failed': 'The design-rule check failed: {message}',
        'drc.clean': 'No warnings: nothing on this board breaks a design rule.',
        'drc.cleanHint': 'The check runs again every time you change the circuit.',
        'bom.noExport': 'This build of the circuit designer cannot list parts yet.',
        'bom.noCircuit': 'The circuit has not loaded yet, so there is nothing to count. Open the Designer once, then come back.',
        'bom.empty': 'No parts on the board yet.',
        'bom.emptyHint': 'Drag parts from the Parts palette in the Designer, or open an example.',
        'bom.exportCsv': 'Copy as CSV',
        'examples.noBrowser': 'This build of the circuit designer does not include the examples yet.',
        'examples.loading': 'Loading examples…',
        'action.designer': 'Open the Designer',
        'action.examples': 'Browse examples',
        'a11y.dismiss': 'Dismiss'
    },
    de: {
        'group': 'Schaltungsbereiche',
        'name.designer': 'Designer',
        'name.warnings': 'Schaltungsprüfung',
        'name.bom': 'Stückliste',
        'name.examples': 'Beispiele',
        'help.designer': 'Die Schaltung auf dem Steckbrett bauen und simulieren',
        'help.warnings': 'Entwurfsregelprüfung: Kurzschlüsse, fehlende Widerstände, überlastete Pins',
        'help.bom': 'Alle Bauteile auf der Platine, gezählt, mit CSV zum Bestellen',
        'help.examples': 'Startschaltungen und -programme zum Öffnen und Ändern',
        'heading.warnings': 'Schaltungsprüfung ({count})',
        'hint.warnings': 'Wird bei jeder Änderung neu geprüft. Rote Einträge können ein echtes Bauteil beschädigen.',
        'hint.bom': 'Zählt alle Bauteile auf der Platine. Kopiere die CSV zum Bestellen.',
        'hint.examples': 'Ein Beispiel zu öffnen ersetzt die Schaltung auf der Platine.',
        'drc.noExport': 'Dieser Build des Schaltungs-Designers kann Schaltungen noch nicht prüfen.',
        'drc.noCircuit': 'Die Schaltung ist noch nicht geladen und kann daher nicht geprüft werden. Öffne einmal den Designer und komm zurück.',
        'drc.failed': 'Die Entwurfsregelprüfung ist fehlgeschlagen: {message}',
        'drc.clean': 'Keine Warnungen: Nichts auf dieser Platine verletzt eine Entwurfsregel.',
        'drc.cleanHint': 'Die Prüfung läuft bei jeder Änderung der Schaltung erneut.',
        'bom.noExport': 'Dieser Build des Schaltungs-Designers kann noch keine Stückliste erstellen.',
        'bom.noCircuit': 'Die Schaltung ist noch nicht geladen, daher gibt es nichts zu zählen. Öffne einmal den Designer und komm zurück.',
        'bom.empty': 'Noch keine Bauteile auf der Platine.',
        'bom.emptyHint': 'Ziehe Bauteile aus der Bauteilpalette im Designer oder öffne ein Beispiel.',
        'bom.exportCsv': 'Als CSV kopieren',
        'examples.noBrowser': 'Dieser Build des Schaltungs-Designers enthält die Beispiele noch nicht.',
        'examples.loading': 'Beispiele werden geladen…',
        'action.designer': 'Designer öffnen',
        'action.examples': 'Beispiele ansehen',
        'a11y.dismiss': 'Schließen'
    }
};

export const circuitPanelText = makeT(CIRCUIT_PANEL_TEXT);

/** A panel's name and its tooltip, "Name · what it does" (the Robot Lab's tooltip form). */
export const circuitPanelLabel = (locale, id) => {
    const name = circuitPanelText(locale, `name.${id}`);
    return {name, tooltip: `${name} · ${circuitPanelText(locale, `help.${id}`)}`};
};

/**
 * What the Warnings panel shows. `drc` is the host's check result: {warnings} or
 * {error: 'noExport' | 'noCircuit' | 'failed', message}.
 * @returns {{kind: 'list', warnings: object[]} | {kind: 'empty', tone, message, hint, action}}
 */
export const warningsView = (locale, drc) => {
    const t = (key, vars) => circuitPanelText(locale, key, vars);
    if (!drc || drc.error === 'noExport') return {kind: 'empty', tone: 'info', message: t('drc.noExport'), hint: null, action: null};
    if (drc.error === 'noCircuit') return {kind: 'empty', tone: 'info', message: t('drc.noCircuit'), hint: null, action: 'designer'};
    if (drc.error) return {kind: 'empty', tone: 'error', message: t('drc.failed', {message: drc.message || drc.error}), hint: null, action: 'designer'};
    if (!drc.warnings || !drc.warnings.length) {
        return {kind: 'empty', tone: 'ok', message: t('drc.clean'), hint: t('drc.cleanHint'), action: 'designer'};
    }
    return {kind: 'list', warnings: drc.warnings};
};

/**
 * What the Parts list shows, given the designer module (`ui`) and its circuit.
 * @returns {{kind: 'list', rows: object[], csv: string|null} | {kind: 'empty', tone, message, hint, action}}
 */
export const bomView = (locale, ui, circuit) => {
    const t = key => circuitPanelText(locale, key);
    if (!ui || typeof ui.generateBom !== 'function') return {kind: 'empty', tone: 'info', message: t('bom.noExport'), hint: null, action: null};
    if (!circuit) return {kind: 'empty', tone: 'info', message: t('bom.noCircuit'), hint: null, action: 'designer'};
    const rows = ui.generateBom(circuit.parts) || [];
    if (!rows.length) return {kind: 'empty', tone: 'info', message: t('bom.empty'), hint: t('bom.emptyHint'), action: 'designer', second: 'examples'};
    return {kind: 'list', rows, csv: typeof ui.bomToCsv === 'function' ? ui.bomToCsv(rows) : null};
};

/** The badge on the Warnings button: a real count only (never "0" for a check that could not run). */
export const warningsBadge = drc => {
    const findings = drc?.warnings?.filter(w => w.severity !== 'info');
    if (!findings?.length) return null;
    return {count: findings.length, danger: findings.some(w => w.severity === 'danger' || w.severity === 'error')};
};
