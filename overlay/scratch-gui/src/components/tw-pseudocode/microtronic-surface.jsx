// SPDX-License-Identifier: BSD-3-Clause
import React, {useEffect, useState} from 'react';
import {MicrotronicPanel} from 'bw-circuit-ui/components/MicrotronicPanel.jsx';

export default function MicrotronicSurface({vm, partId, variant, locale, Editor}) {
    const [, redraw] = useState(0);
    useEffect(() => {
        const sync = () => redraw(value => value + 1);
        window.addEventListener('bw-board-ready', sync);
        const timer = variant === 'front' ? setInterval(sync, 100) : null;
        return () => {
            window.removeEventListener('bw-board-ready', sync);
            if (timer !== null) clearInterval(timer);
        };
    }, [vm, partId, variant]);

    const board = vm?.runtime?.circuitBoard;
    const part = vm?.runtime?.circuitModel?.getPart?.(partId);
    if (part?.kind !== 'busch-microtronic' || !board?.getDeviceState?.(partId)) return null;
    const control = detail => window.dispatchEvent(new CustomEvent('bw-microtronic-control', {
        detail: {board, partId, ...detail}
    }));
    return <MicrotronicPanel board={board} part={part} lang={locale}
        variant={variant} Editor={Editor} onProgramChange={(id, program) => control({program})}
        onExecutionModeChange={(id, executionMode) => control({executionMode})}
        onRunClock={() => control({run: true})} />;
}
