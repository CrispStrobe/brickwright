import React, {useEffect, useState} from 'react';
import {Kim1Video} from 'bw-circuit-ui/components/Kim1Video.jsx';
import {Kim1Panel} from 'bw-circuit-ui/components/Kim1Panel.jsx';

/** Every KIM-1 view controls the device on the Circuit tab's board. */
export default function Kim1Surface({vm, partId, variant, locale, Editor}) {
    const [, redraw] = useState(0);
    useEffect(() => {
        const sync = () => redraw(value => value + 1);
        window.addEventListener('bw-board-ready', sync);
        const timer = variant === 'code' ? null : setInterval(sync, 100);
        return () => {
            window.removeEventListener('bw-board-ready', sync);
            if (timer !== null) clearInterval(timer);
        };
    }, [variant, vm, partId]);

    const board = vm?.runtime?.circuitBoard;
    const circuit = vm?.runtime?.circuitModel;
    const part = circuit?.getPart?.(partId);
    const state = part?.kind === 'kim-1' && board?.getDeviceState?.(partId);
    if (!state) return null;
    if (variant === 'video') {
        return state.k1008 ? <Kim1Video device={state.k1008} memoryCard={state.memoryCard} /> : null;
    }
    const control = detail => window.dispatchEvent(new CustomEvent('bw-kim1-control', {
        detail: {board, partId, ...detail}
    }));
    return <Kim1Panel board={board} part={part} lang={locale} variant={variant} showAceKim={false} Editor={Editor}
        onProgramChange={(id, program) => control({program})}
        onRunClock={() => control({run: true})} />;
}
