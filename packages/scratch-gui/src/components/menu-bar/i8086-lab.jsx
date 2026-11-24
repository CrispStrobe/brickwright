import React, {useEffect, useRef, useState} from 'react';
import {makeT, browserLocale} from '../../lib/bw-i18n.js';
import {createPortal} from 'react-dom';
import {getI8086MemoryMode, setI8086MemoryMode} from '../../lib/bw-i8086-preferences.js';
import {i8086Execution} from '../../lib/bw-i8086-execution.js';
import styles from './i8086-lab.css';

// Our component, so a local table rather than react-intl — see lib/bw-i18n.js.
const A11Y_L10N = {
    en: {
        'a11y.close8086': 'Close 8086 diagnostics'
    },
    de: {
        'a11y.close8086': '8086-Diagnose schließen'
    }
};
const at = makeT(A11Y_L10N);


// settings-menu.jsx loads this panel lazily on the first open request and mounts it already open.
export default function I8086Lab ({initiallyOpen = false}) {
    const dialog = useRef(null);
    const active = useRef(null);
    const [open, setOpen] = useState(initiallyOpen);
    const [memoryMode, setMemoryMode] = useState(getI8086MemoryMode);
    const [executionMode, setExecutionMode] = useState(i8086Execution.getPreference);
    const [executionState, setExecutionState] = useState(i8086Execution.snapshot);
    const [workload, setWorkload] = useState('registers');
    const [status, setStatus] = useState('');
    const [storageNote, setStorageNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState(null);
    const close = () => { active.current?.abort(); active.current = null; setBusy(false); setOpen(false); };
    useEffect(() => {
        const show = () => { setMemoryMode(getI8086MemoryMode()); setExecutionMode(i8086Execution.getPreference());
            setExecutionState(i8086Execution.snapshot()); setOpen(true); };
        window.addEventListener('bw-open-i8086-lab', show);
        return () => { window.removeEventListener('bw-open-i8086-lab', show); active.current?.abort(); };
    }, []);
    useEffect(() => i8086Execution.subscribe(setExecutionState), []);
    useEffect(() => {
        const node = dialog.current;
        if (!node) return undefined;
        if (open && !node.open) node.showModal();
        return () => { if (node.open) node.close(); };
    }, [open]);
    const run = async () => {
        const controller = new AbortController();
        active.current = controller; setBusy(true); setResult(null); setStatus('Loading isolated benchmark…');
        try {
            const {compareSandbox} = await import(/* webpackChunkName: "bw-i8086-lab" */ '../../lib/bw-i8086-lab/benchmark.js');
            if (controller.signal.aborted) return;
            const report = await compareSandbox({workload, signal: controller.signal,
                onProgress: message => { if (active.current === controller) setStatus(message); }});
            if (active.current === controller) { setResult(report); setStatus('Complete — all measured states match JavaScript.'); }
        } catch (error) {
            if (active.current === controller) setStatus(`No accepted result: ${error.message}`);
        } finally {
            if (active.current === controller) { active.current = null; setBusy(false); }
        }
    };
    // Closed diagnostics leave no hidden buttons for other panels or probes.
    if (!open) return null;
    return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="i8086-lab-title"
        data-testid="i8086-lab" onMouseUp={event => event.stopPropagation()}
        onCancel={event => { event.preventDefault(); close(); }}>
        <h2 id="i8086-lab-title">8086 execution diagnostics</h2>
        <button className={styles.close} onClick={close} aria-label={at(browserLocale(), 'a11y.close8086')}>Close</button>
        <label className={styles.row}>8086 execution preference (this browser)
            <select data-testid="i8086-execution-mode" value={executionMode} onChange={event => {
                const value = event.target.value;
                const persisted = i8086Execution.setPreference(value);
                setExecutionMode(value);
                setStorageNote(persisted ? 'Preference saved; rebuild or reattach to apply.' :
                    'Storage unavailable; preference applies to new targets in this tab only.');
            }}>
                <option value="auto">Auto (preserve machine semantics)</option>
                <option value="functional">Functional (DOS programs retain DOS services)</option>
                <option value="wired">Wired digital (unavailable — construction will be refused)</option>
            </select>
        </label>
        <p>This browser-local preference is not saved in the project and does not switch a running target.
            Rebuild or reattach to apply. Project and media context is preserved: Auto uses DOS services
            for DOS programs and functional hardware for hardware setups; it never substitutes one for the other.</p>
        <div role="status" data-testid="i8086-execution-status">
            {executionState.active ? <>
                <p>Active request: {executionState.active.preference}. Actual: {executionState.active.actual.family}
                    {' / '}{executionState.active.actual.semantics}{' / '}{executionState.active.actual.implementation}.</p>
                <p>{executionState.active.reason} Backend changes require a new target.</p>
            </> : <p>No active 8086/80186 execution selection.</p>}
            {executionState.refusal && <p>Refused: {executionState.refusal.code} — {executionState.refusal.reason}</p>}
        </div>
        <label className={styles.row}>Project RAM word access
            <select data-testid="i8086-memory-mode" value={memoryMode} onChange={event => {
                const value = event.target.value;
                const persisted = setI8086MemoryMode(value);
                setMemoryMode(value);
                setStorageNote(persisted ? 'Preference saved.' : 'Storage unavailable; applied for this tab only.');
            }}>
                <option value="optimized">Optimized (default)</option>
                <option value="reference">Reference byte access (diagnostic)</option>
            </select>
        </label>
        <p>Applies to newly created 8086/80186 targets. Rebuild or reattach the target to apply.
            Existing targets are unchanged. Reference mode disables only the RAM word shortcut;
            REP optimizations and correctness fixes remain enabled.</p>
        <p role="status">{storageNote}</p>
        <h3>Experimental benchmark sandbox</h3>
        <p>Bundled programs only, with separate CPU and RAM. This does not run or modify your project.
            Decoded blocks and Wasm are not supported project backends: no devices, interrupts or debugger integration.
            Timer batching is not offered because it changes observable counter state.</p>
        <label className={styles.row}>Bundled workload
            <select data-testid="i8086-lab-workload" value={workload} disabled={busy}
                onChange={event => { setWorkload(event.target.value); setResult(null); setStatus(''); }}>
                <option value="registers">Register-only counted loop (Wasm best case)</option>
                <option value="mixed">Mixed arithmetic and RAM</option>
                <option value="strings">REP word copies</option>
            </select>
        </label>
        <button data-testid="i8086-lab-run" disabled={busy} onClick={run}>Compare JS / decoded / Wasm</button>
        {busy && <button data-testid="i8086-lab-cancel" onClick={() => active.current?.abort()}>Cancel benchmark</button>}
        <p role="status" data-testid="i8086-lab-status">{status}</p>
        {result && <div data-testid="i8086-lab-results">
            <p>{result.scope} Three samples after warmup. Smaller time is better;
                overlapping ranges are inconclusive. A synthetic-loop gain is not a general emulator speedup.</p>
            {result.unavailable.length > 0 && <p>Unavailable: {result.unavailable.join(', ')}</p>}
            <table><thead><tr><th>Backend</th><th>Median / range ms</th><th>RT</th><th>vs JS</th><th>Warmup ms</th><th>State</th></tr></thead>
                <tbody>{result.rows.map(row => <tr key={row.mode}>
                    <td>{row.mode}</td><td>{row.medianMs.toFixed(2)} / {row.minMs.toFixed(2)}–{row.maxMs.toFixed(2)}</td>
                    <td>{row.realTimeRatio.toFixed(1)}×</td><td>{row.speedup.toFixed(2)}×</td>
                    <td>{row.warmupMs.toFixed(2)}</td><td>{row.correctness}</td>
                </tr>)}</tbody></table>
            <details><summary>Compilation and fallback counts (per sample)</summary>
                <pre>{JSON.stringify(result.rows.map(row => ({mode: row.mode,
                    samples: row.samples.map(sample => sample.stats)})), null, 2)}</pre>
            </details>
        </div>}
    </dialog>, document.body);
}
