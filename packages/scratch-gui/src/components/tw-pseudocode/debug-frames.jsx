import React from 'react';
import PropTypes from 'prop-types';

import {deriveFrames} from '../../lib/bw-debug/frames.js';

/**
 * Where am I, and what can be said about how I got here — D28.
 *
 * The defect this closes reads "There is no frames-or-locals view in the debug
 * UI; Step Out is real, a call stack is not." The tempting fix is a pane
 * labelled Frames that shows *something* on every engine. This is not that.
 *
 * On the C target there is no call stack, because the program is not a stack
 * machine: `generateC` lowers each WHEN block to a state machine over a
 * millisecond tick, so "inside the pulse procedure" is a VALUE in a
 * `<task>_state` variable. This pane therefore leads with the refusal — in a
 * sentence, above the data — and then shows the position that DOES exist:
 * each task's state, its deadline, the address the state lives at, and the
 * block it belongs to.
 *
 * On 6502 and Z80 a hardware return-address stack really exists, so it is
 * walked and shown — still labelled as candidates, because nothing on those
 * machines marks a return address apart from a pushed register.
 *
 * The derivation lives in `lib/bw-debug/frames.js` and is tested there without
 * a browser; this file is the rendering only.
 */

const L10N = {
    en: {
        title: 'Position',
        scheduler: 'Tasks',
        machine: 'Return stack',
        task: 'task', state: 'state', until: 'waits until', at: 'at',
        finished: 'finished',
        returnTo: 'returns to',
        variables: 'Variables',
        noneYet: 'Nothing to show yet.',
        collapse: 'Hide', expand: 'Show', reason: 'About this stack'
    },
    de: {
        title: 'Position',
        scheduler: 'Aufgaben',
        machine: 'Rücksprungstapel',
        task: 'Aufgabe', state: 'Zustand', until: 'wartet bis', at: 'bei',
        finished: 'fertig',
        returnTo: 'springt zurück nach',
        variables: 'Variablen',
        noneYet: 'Noch nichts anzuzeigen.',
        collapse: 'Ausblenden', expand: 'Anzeigen', reason: 'Über diesen Stapel'
    }
};

const CARD = {
    border: '1px solid #2c3e50', borderRadius: 4, padding: 8, marginTop: 8,
    background: '#141c2e'
};
const LABEL = {fontSize: 11, color: '#7f8c8d', textTransform: 'uppercase', letterSpacing: 0.5};
const WHY = {
    fontSize: 11, color: '#95a5a6', lineHeight: 1.45, marginTop: 4,
    borderLeft: '2px solid #34495e', paddingLeft: 6
};
const ROW = {
    display: 'flex', gap: 8, alignItems: 'baseline', padding: '2px 0',
    fontFamily: 'monospace', fontSize: 12
};
const NAME = {color: '#5dade2', minWidth: 66};
const VALUE = {color: '#ecf0f1'};
const DIM = {color: '#7f8c8d'};

const hex = (n, w = 4) => `0x${(n >>> 0).toString(16).toUpperCase().padStart(w, '0')}`;

export default class DebugFrames extends React.Component {
    constructor (props) {
        super(props);
        this.state = {open: true};
        this.toggle = this.toggle.bind(this);
    }

    tx (key) {
        const table = L10N[this.props.locale] || L10N.en;
        return table[key] || L10N.en[key];
    }

    toggle () {
        this.setState(s => ({open: !s.open}));
    }

    renderScheduler (view) {
        return view.frames.map((f, i) => (
            <div key={`${f.task}-${i}`} style={ROW} data-frame-row>
                <span style={NAME}>{f.task}</span>
                <span style={VALUE}>
                    {`${this.tx('state')} ${f.finished ? this.tx('finished') : f.state}`}
                </span>
                {f.label ? <span style={DIM}>{`· ${f.label}`}</span> : null}
                {/* A deadline only means something while a task is waiting for
                    it; a finished task reports none, and showing a 0 there
                    would invent one. */}
                {typeof f.until === 'number' ? (
                    <span style={DIM}>{`· ${this.tx('until')} ${f.until} ms`}</span>
                ) : null}
                {/* The address is what makes this a debugger view rather than
                    a status line: it is the number to watch in memory. */}
                {typeof f.stateAddr === 'number' ? (
                    <span style={DIM}>{`· ${this.tx('at')} ${hex(f.stateAddr, 2)}`}</span>
                ) : null}
            </div>
        ));
    }

    renderMachine (view) {
        return view.frames.map((f, i) => (
            <div key={`${f.at}-${i}`} style={ROW} data-frame-row>
                <span style={NAME}>{`#${i}`}</span>
                <span style={DIM}>{`${this.tx('at')} ${hex(f.at)}`}</span>
                <span style={VALUE}>{`${this.tx('returnTo')} ${hex(f.returnTo)}`}</span>
            </div>
        ));
    }

    render () {
        const {runner, ui, locale} = this.props;
        if (!runner) return null;

        let view;
        try {
            view = deriveFrames(runner, ui, {kind: this.props.kind});
        } catch (e) {
            // A pane that throws takes the whole panel with it. Saying the
            // derivation failed is strictly better than an unmounted tab.
            view = {kind: 'none', frames: [], callStack: null,
                why: `The position could not be read: ${e && e.message}`, variables: []};
        }

        const heading = view.kind === 'machine' ? this.tx('machine')
            : view.kind === 'scheduler' ? this.tx('scheduler')
                : this.tx('title');

        return (
            <div style={CARD} data-debug-frames data-frames-kind={view.kind}>
                <div
                    style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}
                >
                    <span style={LABEL}>{`${this.tx('title')} — ${heading}`}</span>
                    <div style={{display: 'flex', alignItems: 'center'}}>
                    {view.why && <button type="button" aria-label={this.tx('reason')} title={view.why}
                        aria-expanded={!!this.state.showReason}
                        onClick={() => this.setState(state => ({showReason: !state.showReason}))}
                        style={{background: 'none', border: 0, color: '#5dade2', cursor: 'pointer'}}>ⓘ</button>}
                    <button
                        onClick={this.toggle}
                        style={{
                            background: 'none', border: 'none', color: '#5dade2',
                            cursor: 'pointer', fontSize: 11, fontFamily: 'monospace'
                        }}
                    >{this.state.open ? this.tx('collapse') : this.tx('expand')}</button>
                    </div>
                </div>

                {view.why && this.state.showReason ? (
                    <div style={WHY} data-frames-why>{view.why}</div>
                ) : null}

                {this.state.open ? (
                    <div style={{marginTop: 6}}>
                        {view.frames.length === 0 ? (
                            <div style={{...DIM, fontSize: 11}}>{this.tx('noneYet')}</div>
                        ) : view.kind === 'machine'
                            ? this.renderMachine(view) : this.renderScheduler(view)}

                        {view.variables && view.variables.length ? (
                            <div style={{marginTop: 8}}>
                                <span style={LABEL}>{this.tx('variables')}</span>
                                {view.variables.map((v, i) => (
                                    <div key={`${v.name}-${i}`} style={ROW} data-frame-var>
                                        <span style={NAME}>{v.name}</span>
                                        <span style={VALUE}>{String(v.value)}</span>
                                        <span style={DIM}>{`· ${v.where}`}</span>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>
        );
    }
}

DebugFrames.propTypes = {
    runner: PropTypes.object,
    ui: PropTypes.object,
    kind: PropTypes.string,
    locale: PropTypes.string
};
