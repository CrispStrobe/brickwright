import React from 'react';
import {VduDecoder} from 'bw-board/vdu-decoder.js';

/**
 * VduTerminal — BBC BASIC VDU terminal with canvas graphics.
 *
 * The BBC's graphics are a BYTE PROTOCOL: MOVE/DRAW/PLOT/COLOUR are
 * VDU control sequences on the same stream as printed text. This
 * component feeds the raw serial output through VduDecoder and renders:
 * - text as a character grid (MODE 7 style: 40 cols × 25 rows)
 * - graphics (DRAW/MOVE/PLOT) as lines on a canvas overlay
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
    en: {vduTitle: 'BBC BASIC screen'},
    de: {vduTitle: 'BBC-BASIC-Bildschirm'}
};
const pickLocale = () => { try { return /^de/i.test(navigator.language) ? 'de' : 'en'; } catch { return 'en'; } };

class VduTerminal extends React.Component {
    constructor (props) {
        super(props);
        this._canvasRef = React.createRef();
        this._resetState();
    }

    _resetState () {
        this._decoder = new VduDecoder();
        this._gx = 0; // graphics cursor x (logical 0-1279)
        this._gy = 0; // graphics cursor y (logical 0-1023)
        this._gcol = 7; // graphics foreground colour
        this._textCol = 7; // text foreground colour
        this._bgCol = 0; // background colour
        this._cx = 0; // text cursor column
        this._cy = 0; // text cursor row
        this._processed = 0; // bytes already processed from props.output
        this._lastOutput = '';
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
        if (output.length <= this._processed) return;
        const newBytes = output.slice(this._processed);
        this._processed = output.length;

        for (let i = 0; i < newBytes.length; i++) {
            const events = this._decoder.push(newBytes.charCodeAt(i));
            for (const ev of events) this._handleEvent(ev);
        }
    }

    _handleEvent (ev) {
        const canvas = this._canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        // Map BBC logical coords (1280×1024, origin bottom-left) to canvas
        const mapX = x => (x / 1280) * W;
        const mapY = y => H - (y / 1024) * H;

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
            this._cx = 0;
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
            ctx.fillStyle = PALETTE[this._bgCol & 7];
            ctx.fillRect(0, 0, W, H);
            break;
        case 'move':
            this._gx = ev.x;
            this._gy = ev.y;
            break;
        case 'draw':
            ctx.strokeStyle = PALETTE[this._gcol & 7];
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(mapX(this._gx), mapY(this._gy));
            ctx.lineTo(mapX(ev.x), mapY(ev.y));
            ctx.stroke();
            this._gx = ev.x;
            this._gy = ev.y;
            break;
        case 'plot':
            // Generic PLOT: for now, treat as DRAW for triangle fill modes
            // and as MOVE for move modes. Full PLOT decode is future.
            if (ev.mode <= 3) { this._gx = ev.x; this._gy = ev.y; }
            else {
                ctx.strokeStyle = PALETTE[this._gcol & 7];
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(mapX(this._gx), mapY(this._gy));
                ctx.lineTo(mapX(ev.x), mapY(ev.y));
                ctx.stroke();
                this._gx = ev.x;
                this._gy = ev.y;
            }
            break;
        case 'colour':
            if (ev.n >= 128) this._bgCol = ev.n & 7;
            else this._textCol = ev.n & 7;
            break;
        case 'gcol':
            this._gcol = ev.colour & 7;
            break;
        case 'mode':
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, W, H);
            this._cx = 0; this._cy = 0;
            this._gx = 0; this._gy = 0;
            break;
        case 'home':
            this._cx = 0; this._cy = 0;
            break;
        case 'origin':
            // TODO: set graphics origin offset
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
            </div>
        );
    }
}

export default VduTerminal;
