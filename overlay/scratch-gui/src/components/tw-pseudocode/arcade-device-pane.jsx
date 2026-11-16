import PropTypes from 'prop-types';
import {makeT, browserLocale} from '../../lib/bw-i18n.js';
import React from 'react';
import {mirrorArcadeDeviceFrame, paintArcadeDeviceFrame} from '../../lib/bw-arcade-device-frame.js';
import VM from 'scratch-vm';
import {createArcadeStatsOutput} from '../../lib/bw-arcade-stats-output.js';
const ArcadeStatsOutput=createArcadeStatsOutput(React,PropTypes);

// Our component, so a local table rather than react-intl — see lib/bw-i18n.js.
const A11Y_L10N = {
    en: {
        'a11y.player': 'Player',
        'a11y.neopixels': 'NeoPixels',
        'a11y.lightSensor': 'Light sensor',
        'a11y.tiltX': 'Tilt X',
        'a11y.tiltY': 'Tilt Y',
        'a11y.serial': 'Arcade serial',
        'runtime.physicsStepNoProgress': 'Physics could not advance with minimum step {minStep} and maximum step {maxStep}. Use positive step sizes and a maximum step at least as large as the minimum step.'
    },
    de: {
        'a11y.player': 'Spieler',
        'a11y.neopixels': 'NeoPixel-LEDs',
        'a11y.lightSensor': 'Lichtsensor',
        'a11y.tiltX': 'Neigung X',
        'a11y.tiltY': 'Neigung Y',
        'a11y.serial': 'Arcade-Seriell',
        'runtime.physicsStepNoProgress': 'Die Physik konnte mit minimaler Schrittweite {minStep} und maximaler Schrittweite {maxStep} nicht fortfahren. Verwende positive Schrittweiten und eine maximale Schrittweite, die mindestens so groß wie die minimale ist.'
    }
};
const at = makeT(A11Y_L10N);


const BUTTONS = {
    up: {label: '▲', key: 'ArrowUp'},
    down: {label: '▼', key: 'ArrowDown'},
    left: {label: '◀', key: 'ArrowLeft'},
    right: {label: '▶', key: 'ArrowRight'},
    a: {label: 'A', key: ' '},
    b: {label: 'B', key: 'z'},
    start: {label: 'START', key: 'Enter'},
    select: {label: 'SELECT', key: 'm'}
};

const buttonStyle = (kind, down) => ({
    appearance: 'none', WebkitAppearance: 'none', touchAction: 'none', userSelect: 'none',
    border: '2px solid rgba(255,255,255,.34)', color: '#fff', fontWeight: 800,
    background: down ? '#38bdf8' : (kind === 'action' ? '#e11d48' : '#172033'),
    boxShadow: down ? 'inset 0 2px 5px rgba(0,0,0,.5)' : '0 4px 0 #070b12',
    transform: down ? 'translateY(3px)' : 'none', cursor: 'pointer'
});

const ControlButton = ({button, kind, down, onDown, onUp, style}) => (
    <button
        aria-label={button}
        data-testid={`bw-arcade-${button}`}
        onContextMenu={event => event.preventDefault()}
        onPointerDown={event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); onDown(button); }}
        onPointerUp={event => { event.preventDefault(); onUp(button); }}
        onPointerCancel={() => onUp(button)}
        style={{...buttonStyle(kind, down), ...style}}
        type="button"
    >{BUTTONS[button].label}</button>
);

ControlButton.propTypes = {
    button: PropTypes.oneOf(Object.keys(BUTTONS)).isRequired,
    down: PropTypes.bool.isRequired,
    kind: PropTypes.string,
    onDown: PropTypes.func.isRequired,
    onUp: PropTypes.func.isRequired,
    style: PropTypes.object
};

/**
 * A functional MakeCode Arcade / PyBadge console surface. The display mirrors
 * Scratch's 480x360 renderer into Arcade's 160x120 viewport; the extra four
 * rows above and below model the PyBadge's physical 160x128 TFT. Controls post
 * through Scratch's keyboard IO, so imported games and ordinary key blocks use
 * exactly the same input path.
 */
const ArcadeDevicePane = ({vm}) => {
    const canvasRef = React.useRef(null);
    const heldRef = React.useRef(new Set());
    const playerRef = React.useRef(1);
    const [player, setPlayer] = React.useState(1);
    const [held, setHeld] = React.useState({});
    const device = String(vm.runtime.bwDeviceId || vm.runtime.stc?.device || 'arcade').toLowerCase();
    const compact = device === 'pybadge-lc';
    const [light, setLight] = React.useState(50);
    const [tiltX, setTiltX] = React.useState(0);
    const [tiltY, setTiltY] = React.useState(0);
    const [, setRevision] = React.useState(0);
    const [runtimeDiagnostic, setRuntimeDiagnostic] = React.useState(null);

    const publishState = React.useCallback(next => {
        // Runtime frames and suspended scenes retain this world's identity.
        // Buttons are physical input shared by those scenes, so update their
        // existing map rather than replacing either object on pointer events.
        const state = vm.runtime.bwArcadeDeviceState || (vm.runtime.bwArcadeDeviceState = {
            buttons: {}, neopixels: Array(compact ? 1 : 5).fill('#111827'),
            battery: 100, light: 50, tiltX: 0, tiltY: 0
        });
        for (const [key, value] of Object.entries(next)) {
            if (key === 'buttons') Object.assign(state.buttons || (state.buttons = {}), value);
            else state[key] = value;
        }
    }, [compact, vm]);

    const setButton = React.useCallback((name, isDown) => {
        if (isDown) heldRef.current.add(name); else heldRef.current.delete(name);
        const buttons = {};
        Object.keys(BUTTONS).forEach(key => { buttons[key] = heldRef.current.has(key); });
        setHeld(buttons);
        if (playerRef.current === 1) publishState({buttons});
        else {
            const state = vm.runtime.bwArcadeDeviceState || (vm.runtime.bwArcadeDeviceState = {});
            const controllers = state.controllerButtons || (state.controllerButtons = {});
            Object.assign(controllers[playerRef.current] || (controllers[playerRef.current] = {}), buttons);
        }
        vm.runtime.emit('ARCADE_CONTROLLER_INPUT', playerRef.current, name, isDown);
        // Legacy keyboard blocks, dialog controls and button hats belong to player one.
        if (playerRef.current !== 1) {
            vm.runtime.emit('ARCADE_PLAYER_BUTTON_EDGE', playerRef.current, name, isDown);
            return;
        }
        if (vm.runtime.bwArcadeDialogOpen && vm.runtime.bwArcadeDialogType === 'ask') {
            vm.runtime.emit('ARCADE_DIALOG_BUTTON_EDGE', name, isDown);
            return;
        }
        if (isDown && vm.runtime.bwArcadeDialogOpen) {
            vm.runtime.emit('ARCADE_BUTTON_DOWN', name);
            return;
        }
        vm.postIOData('keyboard', {key: BUTTONS[name].key, isDown});
        if (isDown && vm.runtime.startHats) vm.runtime.startHats('arcade_whenButton', {BUTTON: name});
    }, [publishState, vm]);

    const selectPlayer = event => {
        [...heldRef.current].forEach(name => setButton(name, false));
        playerRef.current = Number(event.target.value);
        setPlayer(playerRef.current);
    };

    React.useEffect(() => () => {
        [...heldRef.current].forEach(name => setButton(name, false));
    }, [setButton]);

    React.useEffect(() => {
        publishState({light, tiltX, tiltY});
    }, [light, publishState, tiltX, tiltY]);

    React.useEffect(() => {
        const changed = () => setRevision(value => value + 1);
        vm.runtime.on('ARCADE_DEVICE_CHANGED', changed);
        vm.runtime.on('ARCADE_DEVICE_STATS', changed);
        return () => {
            vm.runtime.removeListener('ARCADE_DEVICE_CHANGED', changed);
            vm.runtime.removeListener('ARCADE_DEVICE_STATS', changed);
        };
    }, [vm]);

    React.useEffect(() => {
        // The renderer can be replaced across stage/project transitions; follow it,
        // but only to re-attach. Pixels are copied right after renderer.draw()
        // (see bw-arcade-device-frame.js), never from this loop.
        let frame;
        let attached = null;
        let release = null;
        const follow = () => {
            const renderer = vm.runtime.renderer || null;
            if (renderer !== attached) {
                if (release) release();
                attached = renderer;
                release = mirrorArcadeDeviceFrame(renderer, () => canvasRef.current);
                if (!renderer) paintArcadeDeviceFrame(canvasRef.current, null);
            }
            frame = requestAnimationFrame(follow);
        };
        follow();
        return () => {
            cancelAnimationFrame(frame);
            if (release) release();
        };
    }, [vm]);

    React.useEffect(() => {
        const diagnosed = issue => {
            if (issue?.code !== 'physics-step-no-progress') return;
            setRuntimeDiagnostic(previous => previous &&
                ['code', 'engine', 'maxSpeed', 'minStep', 'maxStep'].every(key => previous[key] === issue[key]) ? previous : issue);
        };
        const reset = () => setRuntimeDiagnostic(null);
        vm.runtime.on('ARCADE_RUNTIME_DIAGNOSTIC', diagnosed);
        vm.runtime.on('PROJECT_START', reset);
        vm.runtime.on('PROJECT_LOADED', reset);
        return () => {
            vm.runtime.removeListener('ARCADE_RUNTIME_DIAGNOSTIC', diagnosed);
            vm.runtime.removeListener('PROJECT_START', reset);
            vm.runtime.removeListener('PROJECT_LOADED', reset);
        };
    }, [vm]);

    const pixels = vm.runtime.bwArcadeDeviceState?.neopixels || [];
    const serial = vm.runtime.bwArcadeDeviceState?.serial || '';
    const round = {width: 62, height: 62, borderRadius: '50%', fontSize: 24};
    const dpad = {position: 'absolute', width: 52, height: 52, borderRadius: 8, fontSize: 20};
    return (
        <div data-testid="bw-arcade-device" style={{height: '100%', minHeight: 620, overflow: 'auto', background: 'radial-gradient(circle at 50% 5%,#334155,#070b12 70%)', padding: '18px 12px', boxSizing: 'border-box', color: '#e2e8f0'}}>
            <div style={{maxWidth: 660, margin: '0 auto'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8}}>
                    <strong>{compact ? 'PyBadge LC' : device === 'microbit' ? 'micro:bit Arcade' : 'MakeCode Arcade · PyBadge'}</strong>
                    <label>{at(browserLocale(), 'a11y.player')} <select
                        aria-label={at(browserLocale(), 'a11y.player')} data-testid="bw-arcade-player"
                        value={player} onChange={selectPlayer}>
                        {[1, 2, 3, 4].map(number => <option key={number} value={number}>{number}</option>)}
                    </select></label>
                    <small>160 × 120 game · 160 × 128 TFT</small>
                </div>
                <div style={{position: 'relative', borderRadius: 38, padding: '35px 42px 28px', background: 'linear-gradient(145deg,#5b21b6,#312e81)', border: '4px solid #8b5cf6', boxShadow: '0 14px 32px rgba(0,0,0,.5),inset 0 0 0 2px rgba(255,255,255,.13)'}}>
                    <div style={{display: 'flex', justifyContent: 'center', gap: 15, height: 14, marginTop: -23, marginBottom: 11}} aria-label={at(browserLocale(), 'a11y.neopixels')}>
                        {Array.from({length: compact ? 1 : 5}, (_, index) => <span key={index} data-testid={`bw-arcade-pixel-${index}`} style={{width: 12, height: 12, borderRadius: '50%', background: pixels[index] || '#111827', border: '1px solid #fff8', boxShadow: `0 0 10px ${pixels[index] || 'transparent'}`}} />)}
                    </div>
                    <div style={{maxWidth: 512, margin: '0 auto', background: '#020617', padding: 12, borderRadius: 10, border: '3px solid #111827', boxShadow: 'inset 0 0 18px #000'}}>
                        <canvas ref={canvasRef} width="160" height="128" style={{display: 'block', width: '100%', aspectRatio: '5 / 4', imageRendering: 'pixelated', background: '#020617'}} />
                        <ArcadeStatsOutput runtime={vm.runtime} />
                    </div>
                    <div style={{height: 220, position: 'relative', marginTop: 20}}>
                        <div style={{position: 'absolute', left: 8, top: 13, width: 164, height: 164}}>
                            <ControlButton button="up" down={Boolean(held.up)} onDown={name => setButton(name, true)} onUp={name => setButton(name, false)} style={{...dpad, left: 56, top: 0}} />
                            <ControlButton button="left" down={Boolean(held.left)} onDown={name => setButton(name, true)} onUp={name => setButton(name, false)} style={{...dpad, left: 0, top: 56}} />
                            <ControlButton button="right" down={Boolean(held.right)} onDown={name => setButton(name, true)} onUp={name => setButton(name, false)} style={{...dpad, left: 112, top: 56}} />
                            <ControlButton button="down" down={Boolean(held.down)} onDown={name => setButton(name, true)} onUp={name => setButton(name, false)} style={{...dpad, left: 56, top: 112}} />
                        </div>
                        <ControlButton button="b" kind="action" down={Boolean(held.b)} onDown={name => setButton(name, true)} onUp={name => setButton(name, false)} style={{...round, position: 'absolute', right: 85, top: 78}} />
                        <ControlButton button="a" kind="action" down={Boolean(held.a)} onDown={name => setButton(name, true)} onUp={name => setButton(name, false)} style={{...round, position: 'absolute', right: 8, top: 25}} />
                        <ControlButton button="select" down={Boolean(held.select)} onDown={name => setButton(name, true)} onUp={name => setButton(name, false)} style={{position: 'absolute', left: '38%', bottom: 0, width: 72, height: 28, borderRadius: 14, fontSize: 9}} />
                        <ControlButton button="start" down={Boolean(held.start)} onDown={name => setButton(name, true)} onUp={name => setButton(name, false)} style={{position: 'absolute', left: '54%', bottom: 0, width: 72, height: 28, borderRadius: 14, fontSize: 9}} />
                    </div>
                </div>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, marginTop: 14, padding: 12, borderRadius: 12, background: '#111827'}}>
                    <label>Light (A7): {light}<input aria-label={at(browserLocale(), 'a11y.lightSensor')} type="range" min="0" max="100" value={light} onChange={e => setLight(Number(e.target.value))} style={{width: '100%'}} /></label>
                    {!compact && <label>Tilt X: {tiltX}<input aria-label={at(browserLocale(), 'a11y.tiltX')} type="range" min="-1024" max="1024" value={tiltX} onChange={e => setTiltX(Number(e.target.value))} style={{width: '100%'}} /></label>}
                    {!compact && <label>Tilt Y: {tiltY}<input aria-label={at(browserLocale(), 'a11y.tiltY')} type="range" min="-1024" max="1024" value={tiltY} onChange={e => setTiltY(Number(e.target.value))} style={{width: '100%'}} /></label>}
                </div>
                {runtimeDiagnostic && <div role="alert" data-testid="bw-arcade-runtime-diagnostic"
                    style={{marginTop: 12, padding: 12, borderRadius: 8, background: '#451a03', color: '#fef3c7'}}>
                    {at(browserLocale(), 'runtime.physicsStepNoProgress', runtimeDiagnostic)}
                </div>}
                {serial && <pre data-testid="bw-arcade-serial" aria-label={at(browserLocale(), 'a11y.serial')}
                    style={{maxHeight: 180, overflow: 'auto', marginTop: 12, padding: 12,
                        borderRadius: 8, background: '#0f172a', color: '#e2e8f0', whiteSpace: 'pre-wrap'}}>{serial}</pre>}
            </div>
        </div>
    );
};

ArcadeDevicePane.propTypes = {vm: PropTypes.instanceOf(VM).isRequired};

export default ArcadeDevicePane;
