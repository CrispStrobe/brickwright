import React from 'react';
import PropTypes from 'prop-types';

import {keyToBytes, textToBytes} from '../../lib/bw-debug/terminal-keys.js';
import {confirmAsync} from '../../lib/native-dialog.js';

/**
 * An OSC 8 hyperlink the guest printed was clicked. xterm's default handler does
 * `if (confirm(...)) window.open(...)`, and in the desktop/iOS app `confirm` returns an
 * always-truthy Promise (lib/native-dialog.js), so it opened any link without asking. Same
 * question and the same opener-less window, but the answer is awaited.
 * @param {MouseEvent} event the click
 * @param {string} uri the link target (xterm passes only http: and https: here)
 * @returns {Promise<void>} settles once answered
 */
export const openTerminalLink = async (event, uri) => {
    const go = await confirmAsync(`Do you want to navigate to ${uri}?\n\n` +
        'WARNING: This link could potentially be dangerous');
    if (!go) return;
    const opened = window.open();
    if (!opened) return;
    try {
        opened.opener = null;
    } catch (error) { /* a cross-origin window may refuse; the URL is set either way */ }
    opened.location.href = uri;
};

/**
 * The Linux lesson's console: a real terminal (xterm.js, MIT) on the guest's
 * /dev/ttyS0, in place of the line-at-a-time serial box.
 *
 * KEYS go to the guest as they are pressed — no local echo, no local line
 * editing; the guest's tty does both. Our own table (lib/bw-debug/
 * terminal-keys.js, tested in Node) decides the bytes for every key it knows:
 * Enter → CR, Backspace → DEL, Ctrl-letters → C0 controls (Ctrl-C = 0x03 is
 * the guest's intr), arrows/Home/End as VT100 sequences honouring DECCKM, the
 * editing and function keys as xterm sends them. Keys it leaves alone (dead
 * keys, IME composition, Cmd/Meta, Ctrl-Shift-C/V) go through xterm's own
 * input handling and arrive in `onData` — as do pastes, which xterm hands
 * over with line ends as CR and, if the guest asked for bracketed paste,
 * wrapped in ESC [ 200~ … 201~. Terminal replies (a cursor-position report
 * `vi` asks for) also come back through `onData`, and are sent on.
 *
 * OUTPUT is the UART's raw byte stream, delivered by the runner once per
 * frame (`runner.terminal.subscribe`), replayed from the start if this
 * component mounts late.
 *
 * SIZE is a fixed 80×24: the guest's UART cannot be told a window size, and
 * busybox assumes 80×24 when it is not told (see lib/bw-debug/linux-console.js).
 *
 * xterm.js loads lazily, in its own chunk, only when a Linux terminal shows.
 */
class LinuxTerminal extends React.Component {
    constructor (props) {
        super(props);
        this.host = React.createRef();
        this.term = null;
        this.unsubscribe = null;
        this.resizeObserver = null;
        this.disposed = false;
        this.state = {phase: 'loading', error: null};
    }

    componentDidMount () {
        Promise.all([
            import(/* webpackChunkName: "bw-xterm" */ '@xterm/xterm'),
            import(/* webpackChunkName: "bw-xterm" */ '!!raw-loader!@xterm/xterm/css/xterm.css')
        ]).then(([xterm, css]) => {
            if (this.disposed) return;
            installCss(css.default || css);
            this.open(xterm.Terminal);
        }).catch(error => {
            if (!this.disposed) this.setState({phase: 'error', error: String(error && error.message || error)});
        });
    }

    shouldComponentUpdate (nextProps, nextState) {
        return nextState.phase !== this.state.phase || nextState.error !== this.state.error ||
            nextProps.hint !== this.props.hint;
    }

    componentWillUnmount () {
        this.disposed = true;
        if (this.unsubscribe) this.unsubscribe();
        this.unsubscribe = null;
        this.resizeObserver?.disconnect();
        if (this.term) this.term.dispose();
        this.term = null;
    }

    open (Terminal) {
        const {terminal} = this.props;
        const term = new Terminal({
            cols: terminal.cols || 80,
            rows: terminal.rows || 24,
            scrollback: 2000,
            convertEol: false,
            cursorBlink: true,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
            fontSize: 12,
            theme: {background: '#0d1117', foreground: '#d0d7de', cursor: '#2ecc71'},
            linkHandler: {activate: openTerminalLink}
        });
        this.term = term;
        const send = bytes => terminal.send(bytes);
        term.attachCustomKeyEventHandler(ev => {
            const bytes = keyToBytes(ev, {applicationCursor: term.modes.applicationCursorKeysMode});
            if (bytes === null) return true;              // xterm's own input path
            if (ev.type === 'keydown') {
                ev.preventDefault();
                ev.stopPropagation();
                send(bytes);
            }
            return false;                                 // keydown, keypress, keyup: ours
        });
        // Text xterm produced itself: IME/dead-key composition, a paste, a
        // terminal report. JS strings → UTF-8, as the table sends printables.
        term.onData(data => send(textToBytes(data)));
        // onBinary carries byte strings (mouse reports in X10 mode): one char, one byte.
        term.onBinary(data => send(Array.from(data, ch => ch.charCodeAt(0) & 0xff)));
        term.open(this.host.current);
        this.unsubscribe = terminal.subscribe(bytes => term.write(bytes));
        const viewport = this.host.current.parentElement?.parentElement;
        if (viewport && typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(([entry]) => {
                const {width, height} = entry.contentRect;
                const size = Math.max(10, Math.min(24, Math.floor(Math.min(
                    (width - 12) / (term.cols * 0.61),
                    (height - 12) / (term.rows * 1.25)
                ))));
                if (term.options.fontSize !== size) term.options.fontSize = size;
            });
            this.resizeObserver.observe(viewport);
        }
        this.setState({phase: 'ready'});
    }

    render () {
        const {phase, error} = this.state;
        return (
            <div>
                <div
                    data-testid={this.props.terminal.kind === 'pico' ? 'bw-picobb-terminal' : 'bw-linux-terminal'}
                    data-terminal-state={phase}
                    ref={this.host}
                    style={{
                        overflowX: 'auto', background: '#0d1117', padding: 4,
                        borderRadius: 4, minHeight: 60
                    }}
                />
                {(error || this.props.hint) && <div
                    style={{color: error ? '#e74c3c' : '#7f8c8d', fontSize: 11, marginTop: 4}}>
                    {error || this.props.hint}
                </div>}
            </div>
        );
    }
}

LinuxTerminal.propTypes = {
    terminal: PropTypes.shape({
        kind: PropTypes.string,
        cols: PropTypes.number,
        rows: PropTypes.number,
        subscribe: PropTypes.func.isRequired,
        send: PropTypes.func.isRequired
    }).isRequired,
    hint: PropTypes.string
};

/** xterm's stylesheet, once per document (its class names are global). */
function installCss (text) {
    if (typeof document === 'undefined' || document.getElementById('bw-xterm-css')) return;
    const style = document.createElement('style');
    style.id = 'bw-xterm-css';
    style.textContent = String(text);
    document.head.appendChild(style);
}

export default LinuxTerminal;
