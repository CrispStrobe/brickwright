// SPDX-License-Identifier: BSD-3-Clause
// A small browser shell around the actual editor lifecycle and BASIC controls.
// This qualifies those seams without claiming to build the complete Scratch GUI.

function extract(source, start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    if (first < 0 || last <= first) throw new Error(`CrispBASIC editor harness boundary changed: ${start.trim()}`);
    return source.slice(first, last);
}

// Keep both the Node lifecycle fixture and the browser shell on the same
// production methods, including the profile/draft and unmount dependencies.
export function extractCrispBasicEditorMethods(sourceText) {
    return [
        ['    async compileCrispBasic () {', '    async runCrispBasic (code) {'],
        ['    async runCrispBasic (code) {', '    // Fetch examples/index.json once'],
        ['    componentWillUnmount () {', '    // Current-locale string table'],
        ['    activeCode () {', '    // Lazily import the compiler'],
        ['    codeDevice () {', '    // Publish the device of the successfully loaded project'],
        ['    selectedBasicProfile () {', '    picoBasicHardwareText (key) {'],
        ['    disposeCodeRun () {', '    submitCodeInput (event, expectedInput = this.state.codeInput) {'],
        ['    closePicoBasicHardware = error => {', '    async sendPicoBasicToHardware (profile) {'],
        ['    invalidateArcadeReport () {', '    beginArcadeReport () {'],
        ['    setHighlightedLine (n) {', '    /** Toggle maximize:']
    ].map(([start, end]) => extract(sourceText, start, end)).join('\n');
}

/** Return an ESM/JSX module for esbuild's jsx loader. /adapter.js and
 * /terminal.js are served by the real-worker browser qualification harness. */
export function createCrispBasicEditorHarness(sourceText) {
    const locale = extract(sourceText, 'const L10N = {', 'const pickLocale = ');
    const labels = extract(sourceText, 'const LANG_LABEL = ', '\n');
    // The shell edits the same authored Code document as the full component.
    // Keep these adapters out of extractCrispBasicEditorMethods: its Node caller
    // already receives them from the shared codeDocumentEditorClass fixture.
    const methods = extractCrispBasicEditorMethods(sourceText) +
        extract(sourceText, '    codeRuntimeFor (lang, target) {', '    authoredCodeState (') +
        extract(sourceText, '    withRetainedDrafts (', '    restoreStandaloneBasic (') +
        extract(sourceText, '    genOpts (lang = this.state.lang) {', '    setGenOpt (patch) {');
    const controls = extract(sourceText,
        "                        {this.state.lang === 'basic' && !this.selectedBasicProfile()?.compiled && this.activeCode().trim() ? (",
        "                        {this.state.lang === 'fe' && this.activeCode().trim() ? (");
    const output = extract(sourceText, '                {/* VDU terminal for BBC BASIC', '                {this.state.codeRunLabel ? (');
    return `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createCrispBasicRunner} from '/adapter.js';
import {prepareCompiledBasic} from '/test-gui/lib/crispbasic-compiler.js';
import VduTerminal from '/terminal.js';
import {basicProfileFor, hiddenCodeDrafts, standaloneBasicDrafts}
    from '/test-gui/lib/bw-matrix/code-languages.js';
import {createCodeDocument, editCodeDocument, selectCodeDocumentLanguage, addCodeProjection,
    restoreCodeDocumentState, codeTargetFromSource, OWNED_CONSOLE_EXECUTION}
    from '/test-gui/lib/code-source-document.js';
// This focused shell has no CAD pane. Its full-editor counterpart qualifies CAD.
const process = {env: {BW_ENABLE_CAD: false}};
${locale}
${labels}

export default class CrispBasicEditorHarness extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            lang: 'basic', basicProfile: 'bbc', basicEngine: 'crispbasic', basicConnectCircuit: false,
            basicConnectCad: false, basicPortableLibrary: false, basicLineNumbers: false,
            libraryTarget: null, authoredSources: {},
            basicFilename: props.filename || 'browser-editor.bas', basicOutputRunId: 0,
            basicInputMethod: null, basicInputValue: '', basicInputError: '', basicDiagnostic: null,
            basicWarnings: [], basicGenerationFailed: false,
            buffers: {...Object.fromEntries(Object.keys(LANG_LABEL).map(language => [language, ''])),
                basic: props.source || 'PRINT "CrispBASIC"\\n'},
            output: '', basicRawOutput: '', basicIsBbc: false, running: false,
            crispBasicActive: false, basicResetting: false, highlightedLine: null
        };
        this._cmEditor = {setHighlightedLine: line => this.setState({highlightedLine: line})};
    }
    componentDidMount() {
        this._unmounted = false;
        window.crispBasicEditor = this;
        this.props.onReady?.(this);
    }
    get L() { return L10N[this.props.locale === 'de' ? 'de' : 'en']; }
    async loadCrispBasicRunner() { return {createCrispBasicRunner}; }
${methods}
    render() {
        const actionBtn = {padding: '6px 10px', margin: 4};
        const menu = false;
        return <main>
            <h1>CrispBASIC editor integration qualification</h1>
            <textarea data-testid="bw-crispbasic-source" aria-label="BASIC source"
                value={this.activeCode()} onChange={event => this.setActiveCode(event.target.value)}
                rows={10} cols={72} spellCheck={false} />
            <div>${controls}</div>
            <output data-testid="bw-crispbasic-status">{this.state.status}</output>
            <output data-testid="bw-crispbasic-highlight">{this.state.highlightedLine}</output>
            <p>{this.L.basicCrispScope}</p>
            ${output}
        </main>;
    }
}

export function mountCrispBasicEditor(element, props = {}) {
    const root = createRoot(element);
    root.render(<CrispBasicEditorHarness {...props} />);
    return () => root.unmount();
}
`;
}
