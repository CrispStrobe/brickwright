import React, {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {catalog, provenance, fetchAssets, runNativeBenchmark} from '../../lib/bw-native-benchmarks/index.js';
import styles from './i8086-lab.css';

export default function NativeBenchmarks () {
    const dialog = useRef(null);
    const active = useRef(null);
    const [open, setOpen] = useState(false);
    const [project, setProject] = useState('topbench');
    const [assets, setAssets] = useState(null);
    const [notice, setNotice] = useState('');
    const [status, setStatus] = useState('Choose an owned benchmark and fetch its verified assets.');
    const [busy, setBusy] = useState(false);
    const [output, setOutput] = useState(null);
    const stop = () => {
        active.current?.abort(); active.current = null;
        setBusy(false); setStatus('Stopped; no accepted result.');
    };
    const close = () => { stop(); setOpen(false); };
    useEffect(() => {
        const show = () => setOpen(true);
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
        setStatus(project === 'topbench' ? 'Ready. Review the notice, then run the native i80386 engine.' :
            'Source verified. Automatic execution unavailable: the pinned package does not distribute a validation executable.');
    });
    const run = () => execute(async controller => {
        setStatus('Launching native i80386…');
        const result = await runNativeBenchmark(assets, {signal: controller.signal, onProgress: progress => {
            if (active.current !== controller) return;
            setStatus(`Running native i80386 — ${progress.retired} retired instructions`); setOutput(progress);
        }});
        if (active.current !== controller) return;
        setOutput(result);
        setStatus(result.accepted ? `Complete — native execution validated; exit ${result.exitCode}.` :
            `No accepted result — ${result.status}; exit ${result.exitCode}.`);
    });
    if (!open) return null;
    return createPortal(<dialog ref={dialog} className={styles.dialog} aria-labelledby="native-benchmarks-title"
        data-testid="native-benchmarks" onMouseUp={event => event.stopPropagation()}
        onCancel={event => { event.preventDefault(); close(); }}>
        <h2 id="native-benchmarks-title">Benchmarks — native i80386</h2>
        <button className={styles.close} onClick={close}>Close benchmarks</button>
        <p>Runs in an isolated native i80386 machine with the owned DOS service shim and fixed CGA text surface.
            Functional output only; no physical CPU timing or speedup claim. No guest OS or x87 backend.</p>
        <label className={styles.row}>Owned benchmark
            <select value={project} disabled={busy} data-testid="native-benchmark-project" onChange={event => {
                setProject(event.target.value); setAssets(null); setNotice(''); setOutput(null);
                setStatus('Fetch the selected benchmark assets.');
            }}>
                {Object.entries(catalog).map(([id, item]) => <option key={id} value={id}>{item.title}</option>)}
            </select>
        </label>
        {project === 'topbench' ? <p>Release 0.40c displays a 0.40b banner. Declared CGA shim reports only the
            observed EGA/VGA/font queries absent. An exit code alone does not validate the result.</p> :
            <p>Whetstone software floating point PRINTOUT validation build. This owned package supplies source
                and a local ia16 build recipe. Automatic browser execution is unavailable until the qualified
                executable has distributable runtime provenance and notices.</p>}
        <button disabled={busy} onClick={prepare} data-testid="native-benchmark-fetch">Fetch / verify assets</button>
        <button disabled={busy || !assets || project !== 'topbench'} onClick={run}
            data-testid="native-benchmark-run">Run native benchmark</button>
        {busy && <button onClick={stop} data-testid="native-benchmark-stop">Stop</button>}
        <p role="status" data-testid="native-benchmark-status">{status}</p>
        <details><summary>Asset provenance and exact hashes</summary>
            <p><a href={`https://github.com/${provenance.repository}/tree/${provenance.commit}/${provenance.base}/${project}`}
                target="_blank" rel="noreferrer">Owned media package</a> at {provenance.commit}</p>
            <pre>{JSON.stringify(catalog[project].files, null, 2)}</pre>
            <p>Verified bytes are cached in this browser when storage is available and rehashed before use.</p>
        </details>
        {notice && <details open><summary>License notice</summary><pre data-testid="native-benchmark-license">{notice}</pre></details>}
        {output && <div data-testid="native-benchmark-output">
            <p>Retired instructions: {output.retired}; service steps: {output.steps}</p>
            <h3>CGA text screen</h3><pre data-testid="native-benchmark-screen">{output.screen.join('\n')}</pre>
            <h3>DOS output</h3><pre data-testid="native-benchmark-stdout">{output.stdout || '(no DOS stdout)'}</pre>
            {output.status !== 'running' && <pre data-testid="native-benchmark-result">{JSON.stringify(output, null, 2)}</pre>}
        </div>}
    </dialog>, document.body);
}
