import React from 'react';
import MachineScreenHeader from './machine-screen-header.jsx';
import {keyToBytes} from '../../lib/bw-debug/terminal-keys.js';
import {pcSet1Bytes} from '../../lib/bw-machines/pc-scancodes.js';
import {ps2ButtonBit, ps2Delta} from '../../lib/bw-machines/ps2-pointer.js';

const spectrumSpecialKeys = {
    ShiftLeft: ['caps'], ShiftRight: ['caps'], AltLeft: ['sym'], AltRight: ['sym'],
    Enter: ['enter'], NumpadEnter: ['enter'], Space: ['space'], Backspace: ['caps', '0'],
    ArrowLeft: ['caps', '5'], ArrowDown: ['caps', '6'], ArrowUp: ['caps', '7'], ArrowRight: ['caps', '8']
};

function spectrumKeys (code) {
    if (/^Key[A-Z]$/.test(code)) return [code.slice(3).toLowerCase()];
    if (/^Digit[0-9]$/.test(code)) return [code.slice(5)];
    return spectrumSpecialKeys[code] || [];
}

/** Large, focusable VGA face for the Widgets pane. The panel owns frame storage;
 * this face only paints it and sends live input to the active machine runner. */
export default function MachineConsole({widget, keyIn, serialIn, mouseIn, keyboardSet, isFullScreen, onToggleFullScreen, locale}) {
    const root = React.useRef(null);
    const canvas = React.useRef(null);
    const aspect = widget.config.displayAspect;
    const hasDisplayAspect = Number.isFinite(aspect) && aspect > 0;
    const held = React.useRef(new Set());
    const buttons = React.useRef(0);
    const point = React.useRef(null);
    const [focused, setFocused] = React.useState(false);
    React.useEffect(() => {
        const el = canvas.current;
        const rgba = widget?.state?.rgba;
        if (!el || !rgba) return;
        const width = widget.config.width;
        const height = widget.config.height;
        if (el.width !== width) el.width = width;
        if (el.height !== height) el.height = height;
        el.getContext('2d').putImageData(
            new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
    }, [widget?.state?.rgba, widget?.state?.frame, widget?.config?.width, widget?.config?.height]);
    const release = () => {
        if (keyboardSet === 'spectrum') {
            if (held.current.size) keyIn?.([]);
        } else {
            for (const code of held.current) {
                for (const byte of pcSet1Bytes(code, false, keyboardSet === 'at-set1')) keyIn?.(byte);
            }
        }
        held.current.clear();
        if (buttons.current) mouseIn?.({dx: 0, dy: 0, buttons: 0});
        buttons.current = 0;
        point.current = null;
    };
    React.useEffect(() => {
        // Window deactivation can leave the console as document.activeElement,
        // so element blur alone does not release guest input.
        window.addEventListener('blur', release);
        return () => {
            window.removeEventListener('blur', release);
            // Release into the old runner on replacement or unmount.
            release();
        };
    }, [keyIn, mouseIn, keyboardSet]);
    React.useEffect(() => {
        if (!keyIn && !serialIn) return undefined;
        // Scratch's global keyboard listener can stop propagation before React's
        // delegated onKeyDown reaches this component. Window capture runs first,
        // and only when the console itself has focus.
        const onKey = (e, down) => {
            if (document.activeElement !== root.current) return;
            if (serialIn) {
                if (!down || e.key === 'Tab') return;
                const encoded = keyToBytes(e);
                if (!encoded || encoded.length !== 1 || encoded[0] > 0x7f) return;
                e.preventDefault();
                e.stopPropagation();
                serialIn(e.key === 'Backspace' ? 0x08 : encoded[0]);
                return;
            }
            if (keyboardSet === 'spectrum') {
                const names = spectrumKeys(e.code);
                if (!names.length) return;
                e.preventDefault();
                e.stopPropagation();
                if (down) held.current.add(e.code);
                else held.current.delete(e.code);
                keyIn([...new Set([...held.current].flatMap(spectrumKeys))]);
                return;
            }
            const bytes = pcSet1Bytes(e.code, down, keyboardSet === 'at-set1');
            if (bytes == null) return;
            e.preventDefault(); e.stopPropagation();
            if (down) {
                if (!held.current.has(e.code)) {
                    held.current.add(e.code);
                    for (const byte of bytes) keyIn(byte);
                }
            } else if (held.current.delete(e.code)) {
                for (const byte of bytes) keyIn(byte);
            }
        };
        const down = e => onKey(e, true);
        const up = e => onKey(e, false);
        window.addEventListener('keydown', down, true);
        window.addEventListener('keyup', up, true);
        return () => {
            window.removeEventListener('keydown', down, true);
            window.removeEventListener('keyup', up, true);
        };
    }, [keyIn, serialIn, keyboardSet]);
    const pointerMove = e => {
        if (!mouseIn) return;
        const next = {x: e.clientX, y: e.clientY};
        const prev = point.current;
        point.current = next;
        if (prev) {
            const dx = ps2Delta(next.x - prev.x);
            const dy = ps2Delta(next.y - prev.y);
            if (dx || dy) mouseIn({dx, dy, buttons: buttons.current});
        }
    };
    const pointerDown = e => {
        root.current?.focus();
        if (!mouseIn) return;
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
        point.current = {x: e.clientX, y: e.clientY};
        buttons.current |= ps2ButtonBit(e.button);
        mouseIn({dx: 0, dy: 0, buttons: buttons.current});
    };
    const pointerUp = e => {
        if (!mouseIn) return;
        buttons.current &= ~ps2ButtonBit(e.button);
        mouseIn({dx: 0, dy: 0, buttons: buttons.current});
    };
    const toggleFull = () => {
        release();
        onToggleFullScreen();
        root.current?.focus();
    };
    return (
        <div ref={root} data-testid="bw-machine-console" tabIndex={0}
            onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); release(); }}
            style={{width: '100%', height: '100%', minHeight: 0, background: '#000',
                display: 'flex', flexDirection: 'column', outline: focused ? '2px solid #60a5fa' : 'none'}}>
            <MachineScreenHeader locale={locale} title={widget.name}
                help={(keyIn || serialIn) && (mouseIn ? 'Click the screen to use the keyboard and mouse.'
                    : 'Click the screen to type into the machine.')}
                isFullScreen={isFullScreen} onToggleFullScreen={onToggleFullScreen && toggleFull} />
            <div onPointerMove={pointerMove} onPointerDown={pointerDown} onPointerUp={pointerUp}
                onLostPointerCapture={() => {
                    if (buttons.current) { buttons.current = 0; mouseIn?.({dx: 0, dy: 0, buttons: 0}); }
                    point.current = null;
                }}
                onContextMenu={e => { if (mouseIn) e.preventDefault(); }}
                style={{flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    containerType: hasDisplayAspect ? 'size' : undefined}}>
                <canvas ref={canvas} data-testid="bw-machine-canvas"
                    style={{display: 'block', imageRendering: 'pixelated',
                        width: hasDisplayAspect ? `min(100cqw, ${100 * aspect}cqh)` : '100%',
                        height: hasDisplayAspect ? `min(100cqh, ${100 / aspect}cqw)` : '100%',
                        objectFit: hasDisplayAspect ? 'fill' : 'contain'}} />
                {!widget.state.signal && <span style={{position: 'absolute', color: '#4ade80'}}>NO SIGNAL</span>}
            </div>
        </div>
    );
}
