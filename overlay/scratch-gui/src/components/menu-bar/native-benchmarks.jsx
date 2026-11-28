import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {catalog, provenance, mediaCommit, fetchAssets, runNativeBenchmark} from '../../lib/bw-native-benchmarks/index.js';
import styles from './i8086-lab.css';

// settings-menu.jsx loads this panel lazily on the first open request and mounts it already open.
export default function NativeBenchmarks ({initiallyOpen = false, initialOpenDetail}) {
    const dialog = useRef(null);
    const active = useRef(null);
    const [open, setOpen] = useState(initiallyOpen);
    const [project, setProject] = useState('topbench');
    const [assets, setAssets] = useState(null);
    const [notice, setNotice] = useState('');
    const [status, setStatus] = useState('Choose an owned benchmark and fetch its verified assets.');
    const [busy, setBusy] = useState(false);
    const [output, setOutput] = useState(null);
    const raw = catalog[project].manifest?.kind === 'native-i80386-raw';
    const stop = () => {
        active.current?.abort(); active.current = null;
        setBusy(false); setStatus('Stopped; no accepted result.');
    };
    const close = () => { stop(); setOpen(false); };
    useEffect(() => {
        const show = event => {
            setOpen(true);
            if (Object.hasOwn(catalog, event.detail?.run)) launchPreset(event.detail.run);
        };
        if (Object.hasOwn(catalog, initialOpenDetail?.run)) launchPreset(initialOpenDetail.run);
        window.addEventListener('bw-open-native-benchmarks', show);
        return () => {
            window.removeEventListener('bw-open-native-benchmarks', show);
            active.current?.abort(); active.current = null;
        };
    }, []);
    useEffect(() => {
        const node = dialog.current;
        if (!node) return undefined;
        if (open && !node.open) node.showModal();
        return () => { if (node.open) node.close(); };
    }, [open]);
    const execute = async operation => {
        active.current?.abort();
        const controller = new AbortController();
        active.current = controller; setBusy(true); setOutput(null);
        try {
            await operation(controller);
        } catch (error) {
            if (active.current === controller) setStatus(`Error: ${error.message}`);
        } finally {
            if (active.current === controller) { active.current = null; setBusy(false); }
        }
    };
    const prepare = () => execute(async controller => {
        setAssets(null); setNotice(''); setStatus('Fetching and verifying SHA-256…');
        const result = await fetchAssets(project, {signal: controller.signal,
            onNotice: text => { if (active.current === controller) setNotice(text); }});
        if (active.current !== controller) return;
        setAssets(result);
        setStatus('Ready. Review the retained notices, then run the native i80386 engine.');
    });
    const runAssets = async (prepared, controller) => {
        setStatus('Launching native i80386…');
        const result = await runNativeBenchmark(prepared, {signal: controller.signal, onProgress: progress => {
            if (active.current !== controller) return;
            setStatus(`Running native i80386 — ${progress.retired} retired instructions`); setOutput(progress);
        }});
        if (active.current !== controller) return;
        setOutput(result);
        const ending = result.exitCode === null ? (result.terminated ? 'Guest halted.' : 'Guest did not halt.') :
            `Exit ${result.exitCode}.`;
        setStatus(result.accepted ? `Complete — native execution validated. ${ending}` :
            `No accepted result — ${result.status}. ${ending}`);
    };
    const run = () => execute(controller => runAssets(assets, controller));
    const launchPreset = id => execute(async controller => {
        setProject(id);
        setAssets(null);
        setNotice('');
        setStatus('Fetching and verifying SHA-256…');
        const prepared = await fetchAssets(id, {signal: controller.signal,
            onNotice: text => { if (active.current === controller) setNotice(text); }});
        if (active.current !== controller) return;
        setAssets(prepared);
        await runAssets(prepared, controller);
    });
    if (!open) return null;
    return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="native-benchmarks-title"
        data-testid="native-benchmarks" onMouseUp={event => event.stopPropagation()}
        onCancel={event => { event.preventDefault(); close(); }}>
        <h2 id="native-benchmarks-title">Benchmarks — native i80386</h2>
        <button className={styles.close} onClick={close}>Close benchmarks</button>
        <label className={styles.row}>Owned benchmark
            <select value={project} disabled={busy} data-testid="native-benchmark-project" onChange={event => {
                setProject(event.target.value); setAssets(null); setNotice(''); setOutput(null);
                setStatus('Fetch the selected benchmark assets.');
            }}>
                {Object.entries(catalog).map(([id, item]) => <option key={id} value={id}>{item.title}</option>)}
            </select>
        </label>
        <details><summary>About this benchmark</summary>
            {raw ? <p>The guest runs directly in 32-bit protected mode and reports over the AT UART.
                Validation requires the expected prime count and sum followed by HLT.</p> : project === 'topbench' ?
                <p>The CGA display reports the benchmark score. Release 0.40c displays a 0.40b banner.</p> :
                <p>The software floating-point validation build checks ten numeric modules and a positive guest-clock duration.</p>}
            <p>Instruction counts describe the emulator run.</p>
        </details>
        <button disabled={busy} onClick={prepare} data-testid="native-benchmark-fetch">Fetch / verify assets</button>
        <button disabled={busy || !assets} onClick={run}
            data-testid="native-benchmark-run">Run native benchmark</button>
        {busy && <button onClick={stop} data-testid="native-benchmark-stop">Stop</button>}
        <p role="status" data-testid="native-benchmark-status">{status}</p>
        <details><summary>Asset provenance and exact hashes</summary>
            <p><a href={`https://github.com/${provenance.repository}/tree/${mediaCommit}/${provenance.base}/${catalog[project].directory || project}`}
                target="_blank" rel="noreferrer">Owned media package</a> at {mediaCommit}</p>
            <pre>{JSON.stringify(catalog[project].files, null, 2)}</pre>
            <p>Verified bytes are cached in this browser when storage is available and rehashed before use.</p>
        </details>
        {notice && <details><summary>License notice</summary><pre data-testid="native-benchmark-license">{notice}</pre></details>}
        {output && <div data-testid="native-benchmark-output">
            <p>Retired instructions: {output.retired} · {raw ? 'Machine steps' : 'Service steps'}: {output.steps}</p>
            {!raw && <><h3>CGA text screen</h3><pre data-testid="native-benchmark-screen">{output.screen.join('\n')}</pre></>}
            <h3>{raw ? 'UART output' : 'DOS output'}</h3>
            <pre data-testid="native-benchmark-stdout">{output.stdout || '(waiting for output)'}</pre>
            {output.status !== 'running' && <details><summary>Run details</summary>
                <pre data-testid="native-benchmark-result">{JSON.stringify(output, null, 2)}</pre>
            </details>}
        </div>}
    </dialog>, document.body);
}
