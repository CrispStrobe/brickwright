// SPDX-License-Identifier: BSD-3-Clause
// A small browser shell around the actual editor lifecycle and BASIC controls.
// This qualifies those seams without claiming to build the complete Scratch GUI.

function extract(source, start, end) {
    const first = source.indexOf(start);
    const last = source.indexOf(end, first);
    if (first < 0 || last <= first) throw new Error(`CrispBASIC editor harness boundary changed: ${start.trim()}`);
    return source.slice(first, last);
}

/** Return an ESM/JSX module for esbuild's jsx loader. /adapter.js and
 * /terminal.js are served by the real-worker browser qualification harness. */
export function createCrispBasicEditorHarness(sourceText) {
    const locale = extract(sourceText, 'const L10N = {', 'const pickLocale = ');
    const labels = extract(sourceText, 'const LANG_LABEL = ', '\n');
    const methods = extract(sourceText, '    async runCrispBasic (code) {', '    // Fetch examples/index.json once') +
        extract(sourceText, '    componentWillUnmount () {', '    // Current-locale string table') +
        extract(sourceText, '    activeCode () {', '    // Lazily import the compiler') +
        extract(sourceText, '    setHighlightedLine (n) {', '    /** Toggle maximize:');
    const controls = extract(sourceText,
        "                        {this.state.lang === 'basic' && this.activeCode().trim() ? (",
        "                        {this.state.lang === 'fe' && this.activeCode().trim() ? (");
    const output = extract(sourceText, '                {/* VDU terminal for BBC BASIC', '                </React.Fragment>}');
    return `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {createCrispBasicRunner} from '/adapter.js';
import VduTerminal from '/terminal.js';
${locale}
${labels}

export default class CrispBasicEditorHarness extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            lang: 'basic', basicProfile: 'bbc', basicEngine: 'crispbasic', basicConnectCircuit: false,
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
    invalidateArcadeReport() {}
${methods}
    render() {
        const actionBtn = {padding: '6px 10px', margin: 4};
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
