import React from 'react';
import {VduDecoder} from 'bw-board/vdu-decoder.js';

/**
 * VduTerminal — BBC BASIC VDU terminal with canvas graphics.
 *
 * The BBC's graphics are a BYTE PROTOCOL: MOVE/DRAW/PLOT/COLOUR are
 * VDU control sequences on the same stream as printed text. This
 * component feeds the raw serial output through VduDecoder and renders:
 * - text on a fixed 40-column preview grid
 * - relative/absolute lines, points, filled triangles and rectangles
 *
 * BBC BASIC screen coordinates: origin at bottom-left, Y increases
 * upward, 1280×1024 logical units in MODE 0-6.
 */

// BBC BASIC 8-colour palette (physical colours 0-7)
const PALETTE = [
    '#000000', '#ff0000', '#00ff00', '#ffff00',
    '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
];

const L10N = {
    en: {vduTitle: 'BBC BASIC screen', unsupported: 'Canvas preview could not render:'},
    de: {vduTitle: 'BBC-BASIC-Bildschirm', unsupported: 'Die Canvas-Vorschau konnte nicht darstellen:'}
};
const pickLocale = () => { try { return /^de/i.test(navigator.language) ? 'de' : 'en'; } catch { return 'en'; } };

class VduTerminal extends React.Component {
    constructor (props) {
        super(props);
        this._canvasRef = React.createRef();
        this.state = {unsupported: []};
        this._resetState();
    }

    _resetState () {
        this._decoder = new VduDecoder();
        this._gx = 0; // graphics cursor x (logical 0-1279)
        this._gy = 0; // graphics cursor y (logical 0-1023)
        this._previousPoint = [0, 0];
        this._originX = 0;
        this._originY = 0;
        this._gcol = 7; // graphics foreground colour
        this._gBgCol = 0;
        this._gmode = 0;
        this._gBgMode = 0;
        this._textCol = 7; // text foreground colour
        this._bgCol = 0; // background colour
        this._cx = 0; // text cursor column
        this._cy = 0; // text cursor row
        this._processed = 0; // bytes already processed from props.output
        this._lastOutput = '';
        this._unsupported = new Set();
    }

    componentDidMount () {
        this._draw();
        // The lazy renderer often mounts after the first worker output (or
        // even completion), so its initial props are part of the stream too.
        this._processNew();
    }

    componentDidUpdate (prevProps) {
        const output = this.props.output || '';
        const reset = this.props.resetKey !== prevProps.resetKey || !output.startsWith(this._lastOutput);
        if (reset) {
            this._resetState();
            this._draw();
        }
        if (reset || this.props.output !== prevProps.output) {
            this._processNew();
        }
    }

    _processNew () {
        const output = this.props.output || '';
        this._lastOutput = output;
        if (output.length <= this._processed) { this._publishUnsupported(); return; }
        const newBytes = output.slice(this._processed);
        this._processed = output.length;

        for (let i = 0; i < newBytes.length; i++) {
            const events = this._decoder.push(newBytes.charCodeAt(i));
            for (const ev of events) this._handleEvent(ev);
        }
        this._publishUnsupported();
    }

    _publishUnsupported () {
        const unsupported = [...this._unsupported];
        if (unsupported.join('\n') !== this.state.unsupported.join('\n')) this.setState({unsupported});
    }

    _cannotRender (operation) {
        // A program cannot grow UI state indefinitely by sending unknown VDUs.
        if (this._unsupported.size < 16) this._unsupported.add(operation);
    }

    _handleEvent (ev) {
        const canvas = this._canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        // Map BBC logical coords (1280×1024, origin bottom-left) to canvas
        const mapX = x => (x / 1280) * W;
        const mapY = y => H - 1 - (y / 1024) * H;

        switch (ev.type) {
        case 'char':
            ctx.fillStyle = PALETTE[this._textCol & 7];
            ctx.font = '12px monospace';
            ctx.fillText(ev.char, this._cx * 8 + 2, this._cy * 16 + 13);
            this._cx++;
            if (this._cx >= 40) { this._cx = 0; this._cy++; }
            break;
        case 'newline':
            this._cy++;
            break;
        case 'cr':
            this._cx = 0;
            break;
        case 'cls':
            ctx.fillStyle = PALETTE[this._bgCol & 7];
            ctx.fillRect(0, 0, W, H);
            this._cx = 0; this._cy = 0;
            break;
        case 'clg':
            if (this._gBgMode !== 0) { this._cannotRender(`GCOL ${this._gBgMode}`); break; }
            ctx.fillStyle = PALETTE[this._gBgCol & 7];
            ctx.fillRect(0, 0, W, H);
            break;
        case 'move':
        case 'draw':
        case 'plot': {
            // BBC's low three PLOT bits choose relative/absolute and
            // move/foreground/inverse/background; the family chooses geometry.
            // https://www.bbcbasic.co.uk/bbcwin/manual/bbcwin3.html
            const mode = ev.mode;
            const family = mode & ~7;
            const action = mode & 3;
            const x = ev.x + (mode & 4 ? this._originX : this._gx);
            const y = ev.y + (mode & 4 ? this._originY : this._gy);
            const [previousX, previousY] = this._previousPoint;
            const fromX = this._gx, fromY = this._gy;
            this._previousPoint = [fromX, fromY];
            this._gx = x; this._gy = y;
            if (!action) break;
            if (![0, 64, 80, 96].includes(family) || action === 2) {
                this._cannotRender(`PLOT ${mode}`); break;
            }
            const gmode = action === 3 ? this._gBgMode : this._gmode;
            if (gmode !== 0) { this._cannotRender(`GCOL ${gmode}`); break; }
            ctx.fillStyle = ctx.strokeStyle = PALETTE[(action === 3 ? this._gBgCol : this._gcol) & 7];
            if (family === 0) {
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(mapX(fromX), mapY(fromY));
                ctx.lineTo(mapX(x), mapY(y));
                ctx.stroke();
            } else if (family === 64) {
                ctx.fillRect(Math.floor(mapX(x)), H - 1 - Math.floor((y / 1024) * H), 1, 1);
            } else if (family === 80) {
                ctx.beginPath();
                ctx.moveTo(mapX(previousX), mapY(previousY));
                ctx.lineTo(mapX(fromX), mapY(fromY));
                ctx.lineTo(mapX(x), mapY(y));
                ctx.closePath(); ctx.fill();
            } else {
                const left = Math.floor(mapX(Math.min(fromX, x)));
                const right = Math.floor(mapX(Math.max(fromX, x)));
                const top = H - 1 - Math.floor((Math.max(fromY, y) / 1024) * H);
                const bottom = H - 1 - Math.floor((Math.min(fromY, y) / 1024) * H);
                ctx.fillRect(left, top, right - left + 1, bottom - top + 1);
            }
            break;
        }
        case 'colour':
            if (ev.n >= 128) this._bgCol = ev.n & 7;
            else this._textCol = ev.n & 7;
            break;
        case 'gcol':
            if (ev.colour >= 128) { this._gBgCol = ev.colour & 7; this._gBgMode = ev.mode; }
            else { this._gcol = ev.colour & 7; this._gmode = ev.mode; }
            break;
        case 'mode':
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, W, H);
            this._cx = 0; this._cy = 0;
            this._gx = 0; this._gy = 0;
            this._previousPoint = [0, 0];
            this._originX = 0; this._originY = 0;
            this._gcol = 7; this._gBgCol = 0; this._gmode = 0; this._gBgMode = 0;
            this._textCol = 7; this._bgCol = 0;
            break;
        case 'home':
            this._cx = 0; this._cy = 0;
            break;
        case 'origin':
            this._originX = ev.x; this._originY = ev.y;
            break;
        case 'tab':
            this._cx = ev.x; this._cy = ev.y;
            break;
        case 'cursor':
            this._cx = Math.max(0, this._cx + ev.dx);
            this._cy = Math.max(0, this._cy + ev.dy);
            break;
        case 'vdu':
            // NUL and text-output enable do not paint anything. Other VDUs
            // must be visible as unsupported instead of silently misdrawing.
            if (![0, 4, 6].includes(ev.code)) this._cannotRender(`VDU ${ev.code}`);
            break;
        }
    }

    _draw () {
        const canvas = this._canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    render () {
        const t = L10N[pickLocale()];
        return (
            <div style={{background: '#000', borderRadius: 4, overflow: 'hidden',
                border: '1px solid #333', display: 'inline-block', marginTop: 8}}
                data-testid="bw-vdu-terminal">
                <canvas
                    ref={this._canvasRef}
                    width={320}
                    height={256}
                    title={t.vduTitle}
                    style={{
                        width: 320, height: 256,
                        imageRendering: 'pixelated',
                        display: 'block'
                    }}
                />
                {this.state.unsupported.length ? <div role="status" data-testid="bw-vdu-unsupported"
                    style={{color: '#fff', padding: '6px 8px', maxWidth: 304, fontSize: 12}}>
                    {t.unsupported} {this.state.unsupported.join(', ')}
                </div> : null}
            </div>
        );
    }
}

export default VduTerminal;
