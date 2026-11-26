// Machine Manager — the library surface (design §4.6, §8 step 3).
//
// A modal over the shared machine store: browse the saved machines, run one,
// duplicate/delete, and import/export. Opened from the code-tab device
// dropdown's "Manage machines…" entry (it dispatches `bw-open-machine-manager`;
// gui.jsx renders this). It is a picker + config surface — it adds NO pane: a
// machine's screen/keyboard are its Widgets (§4.2/§4.5), reached by Run.
//
// Defensive by construction (every store call is async and may reject; the
// browser store can be a memory fallback) so a storage hiccup never blanks the
// app. Inline styles, matching the rest of tw-pseudocode.

import React from 'react';
import {currentBox, overlayStyleFor, subscribeVisualViewport} from '../../lib/visual-viewport.js';
import {
    fromMediaManifest, fromDosboxConf
} from '../../lib/bw-machines/importers.js';
import {
    newMachineConfig, validateMachineConfig
} from '../../lib/bw-machines/machine-config.js';
import {localDosboxMachine} from '../../lib/bw-machines/local-dosbox.js';
import {readDosPackageZip, DOS_PACKAGE_LIMITS} from '../../lib/bw-machines/dos-package-zip.js';
import {localDosPackage} from '../../lib/bw-machines/local-dos-package.js';
import {localFreedosVgaMachine} from '../../lib/bw-machines/local-freedos-vga.js';
import {defaultImageFetcher} from '../../lib/bw-machines/activate.js';
import {remoteMachineImagesAllowed} from '../../lib/distribution-policy.js';
import {lessonMachines, lessonT} from '../../lib/bw-machines/lessons.js';

const T = {
    en: {
        title: 'Machines', empty: 'No machines yet — import one below.',
        run: 'Run', dup: 'Duplicate', del: 'Delete', close: 'Close',
        importL: 'Import a manifest URL, machine JSON, or DOSBox .conf',
        importB: 'Import', exportB: 'Export all', paste: 'Paste JSON or .conf here…',
        imported: 'Imported.', exported: 'Exported below — copy it.', removed: 'Deleted.',
        duped: 'Duplicated.', badImport: 'Could not import: ',
        nativeBlocks: 'Native blocks (experimental)', nativeSaved: 'Execution setting saved.'
    }
};
const tr = (locale, k) => (T[(locale || 'en').slice(0, 2)] || T.en)[k] || T.en[k] || k;

const modeBadge = m => (m === 'wired' ? '🔌 wired' : m === 'auto' ? '◐ auto' : '⚙ functional');

export default function MachineManager({store, onRun, onClose, locale, preferredMachine}) {
    // WHERE THE SCREEN IS, not where the page is. `inset: 0` covers the LAYOUT
    // viewport, which this app floors at 1024px wide — so on a 430pt phone the
    // modal centred at x=512 and its buttons sat off the side of the screen.
    // Reported from iOS as "cannot import a machine"; Playwright could not
    // click them either, because a fixed element cannot be scrolled into a
    // visual viewport. On a desktop the two boxes agree and this is inert.
    const [vvBox, setVvBox] = React.useState(currentBox);
    React.useEffect(() => subscribeVisualViewport(setVvBox), []);
    const overlayBox = overlayStyleFor(vvBox,
        typeof window === 'undefined' ? 0 : window.innerWidth);
    const [machines, setMachines] = React.useState([]);
    const [machineFilter, setMachineFilter] = React.useState(preferredMachine || '');
    const matchingMachines = machines.filter(machine => !machineFilter || machine.machine === machineFilter);
    const [status, setStatus] = React.useState('');
    const [text, setText] = React.useState('');
    const [localDisk, setLocalDisk] = React.useState(null);
    const [localNativeBlocks, setLocalNativeBlocks] = React.useState(false);
    const [dosPackageFile, setDosPackageFile] = React.useState(null);
    const [dosPackageBusy, setDosPackageBusy] = React.useState(false);
    const dosPackageOwner = React.useRef({mounted:true,epoch:{},file:null,busy:false});
    React.useEffect(() => {
        const owner = dosPackageOwner.current; owner.mounted = true;
        return () => {owner.mounted = false; owner.epoch = {};};
    }, []);
    const [freeMedia, setFreeMedia] = React.useState({});
    const [freeNativeBlocks, setFreeNativeBlocks] = React.useState(false);
    const t = k => tr(locale, k);

    const refresh = React.useCallback(async () => {
        try { setMachines(await store.list()); }
        catch (e) { setStatus(`${e.message}`); }
    }, [store]);

    React.useEffect(() => { refresh(); }, [refresh]);

    const invalidateDosPackage = () => {
        const owner = dosPackageOwner.current;
        const pending = owner.busy;
        owner.epoch = {}; owner.busy = false;
        if (owner.mounted) {
            setDosPackageBusy(false);
            if (pending) setStatus('DOS package cancelled by another action');
        }
    };
    const closeManager = event => {
        invalidateDosPackage();
        if (onClose) onClose(event);
    };
    const run = async (cfg, opts) => {
        try {
            if (onRun) await onRun(cfg, opts);
            if (onClose) onClose();
        } catch (e) { setStatus(e.message); }
    };
    const runLocal = async () => {
        try {
            if (!localDisk) throw new Error('select a raw hard-disk image first');
            const confText = /\[(dosbox|cpu|autoexec)\]/i.test(text) ? text : '';
            const cfg = localDosboxMachine({confText,
                fileName: localDisk.name, byteLength: localDisk.size,
                nativeBlocks: localNativeBlocks});
            const bytes = new Uint8Array(await localDisk.arrayBuffer());
            await run(cfg, {fetcher: ref => ref.url === 'local-media:disk'
                ? Promise.resolve({bytes}) : defaultImageFetcher(ref)});
        } catch (e) { setStatus(e.message); }
    };
    const selectDosPackage = file => {
        const owner = dosPackageOwner.current;
        if (!owner.mounted) return;
        owner.epoch = {}; owner.file = file; owner.busy = false;
        setDosPackageFile(file); setDosPackageBusy(false);
        setStatus(file ? `Selected DOS package: ${file.name}` : '');
    };
    const runDosPackage = async () => {
        const owner = dosPackageOwner.current, file = owner.file, epoch = owner.epoch;
        if (!owner.mounted || owner.busy || !file) return;
        const current = () => owner.mounted && owner.epoch === epoch && owner.file === file;
        owner.busy = true; setDosPackageBusy(true);
        setStatus('Checking bounded STORED DOS package…');
        try {
            if (!Number.isSafeInteger(file.size) || file.size < 22 || file.size > DOS_PACKAGE_LIMITS.rawBytes) {
                throw new Error('DOS package: select a non-empty STORED ZIP of at most 16 MiB');
            }
            const archive = await file.arrayBuffer(); if (!current()) return;
            const entries = await readDosPackageZip(archive); if (!current()) return;
            const selected = localDosPackage(entries);
            setStatus(`DOS package: ${selected.selectedConfig} → ${selected.selectedImage}`);
            if (typeof onRun !== 'function') throw new Error('DOS package: machine runner unavailable');
            await onRun(selected.config, {fetcher: async ref => {
                if (!current()) throw new Error('DOS package selection changed');
                if (ref.url !== 'local-media:disk') throw new Error('DOS package: no unselected media or network fallback');
                return {bytes:selected.bytes};
            }});
            if (!current()) return;
            if (onClose) onClose();
        } catch (error) {
            if (current()) setStatus(error.message || String(error));
        } finally {
            if (current()) {owner.busy = false; setDosPackageBusy(false);}
        }
    };
    const runFree386 = async () => {
        try {
            const cfg = localFreedosVgaMachine({...freeMedia,
                nativeBlocks: freeNativeBlocks});
            const files = {};
            for (const slot of ['hdd', 'floppy', 'bios', 'vgaRom']) {
                if (freeMedia[slot]) files[slot === 'vgaRom' ? 'vga-rom' : slot] =
                    new Uint8Array(await freeMedia[slot].arrayBuffer());
            }
            await run(cfg, {fetcher: ref => {
                const slot = ref.url.slice('local-media:'.length);
                if (!Object.prototype.hasOwnProperty.call(files, slot)) {
                    throw new Error(`no selected ${slot} media`);
                }
                return Promise.resolve({bytes: files[slot]});
            }});
        } catch (e) { setStatus(e.message); }
    };
    // A LESSON fetches its media on Run (megabytes, SHA-256-checked), so it is
    // AWAITED: the modal stays open saying what it is fetching, and a refusal
    // (a hash mismatch names the slot) is shown here instead of vanishing into
    // an unhandled rejection behind a closed modal.
    const allLessons = React.useMemo(() => lessonMachines(locale), [locale]);
    const lessons = allLessons.filter(lesson => !machineFilter || lesson.config.machine === machineFilter);
    const machineKinds = [...new Set([preferredMachine, ...allLessons.map(lesson => lesson.config.machine),
        ...machines.map(machine => machine.machine)].filter(Boolean))].sort();
    const [lessonBusy, setLessonBusy] = React.useState(null);
    // `cold`: the lesson's "Boot from scratch" config (no snapshot slot).
    const runLesson = async (lesson, cold = false) => {
        const title = lesson.config.title;
        setLessonBusy(lesson.config.id);
        setStatus(lessonT(locale, 'lessons.fetching', {title, size: cold ? lesson.coldSize : lesson.size}));
        try {
            if (onRun) await onRun(cold ? lesson.coldConfig : lesson.config);
            setLessonBusy(null);
            if (onClose) onClose();
        } catch (e) {
            setLessonBusy(null);
            setStatus(lessonT(locale, 'lessons.failed', {title, reason: (e && e.message) || String(e)}));
        }
    };
    const dup = async id => { try { await store.duplicate(id); setStatus(t('duped')); await refresh(); } catch (e) { setStatus(e.message); } };
    const del = async id => { try { await store.remove(id); setStatus(t('removed')); await refresh(); } catch (e) { setStatus(e.message); } };
    const setNativeBlocks = async (cfg, enabled) => {
        try {
            await store.put({...cfg, nativeBlocks: enabled});
            setStatus(t('nativeSaved'));
            await refresh();
        } catch (e) { setStatus(e.message); }
    };

    const doImport = async () => {
        const src = text.trim();
        if (!src) return;
        try {
            let cfg;
            if (/^https:\/\//i.test(src)) {
                if (!remoteMachineImagesAllowed()) throw new Error('Remote machine images are disabled in this build.');
                const url = new URL(src);
                if (!url.pathname.endsWith('/brickwright-media.json') || url.username || url.password) {
                    throw new Error('Use an HTTPS URL for a brickwright-media.json manifest.');
                }
                const response = await fetch(url, {redirect: 'error'});
                if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
                cfg = fromMediaManifest(await response.json(), {source: url.href, baseUrl: new URL('.', url).href});
            } else if (/\[(dosbox|cpu|autoexec)\]/i.test(src)) {
                cfg = fromDosboxConf(src);
            } else {
                const obj = JSON.parse(src);
                // A media-lab manifest (has slots+machine, no executionMode) vs a
                // machine config (already normalized-ish).
                cfg = (obj && obj.slots && obj.machine && !obj.executionMode)
                    ? fromMediaManifest(obj) : newMachineConfig(obj);
            }
            const v = validateMachineConfig(cfg);
            if (!v.ok) { setStatus(t('badImport') + v.errors.join('; ')); return; }
            await store.put(cfg);
            setText(''); setStatus(t('imported')); await refresh();
        } catch (e) { setStatus(t('badImport') + e.message); }
    };

    const doExport = async () => {
        try { setText(JSON.stringify(await store.export(), null, 2)); setStatus(t('exported')); }
        catch (e) { setStatus(e.message); }
    };

    const stop = e => e.stopPropagation();
    const btn = {padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
        background: '#fff', cursor: 'pointer', fontSize: 12};
    const primary = {...btn, background: 'linear-gradient(135deg,#4c97ff,#4280d7)', color: '#fff', border: 'none'};

    return (
        <div onClick={closeManager} data-testid="bw-machine-manager"
            style={{...overlayBox, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div onClick={stop} style={{background: '#fff', borderRadius: 10, width: 'min(680px, 92vw)',
                maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0,0,0,0.3)'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', borderBottom: '1px solid #e2e8f0'}}>
                    <strong style={{fontSize: 15}}>{preferredMachine ? (/^de/i.test(locale) ? 'Firmware-Bibliothek' : 'Firmware library') : t('title')}</strong>
                    <select aria-label={/^de/i.test(locale) ? 'Zielsystem' : 'Machine type'} value={machineFilter}
                        onChange={event => setMachineFilter(event.target.value)}>
                        <option value="">{/^de/i.test(locale) ? 'Alle Maschinen' : 'All machines'}</option>
                        {machineKinds.map(kind => <option key={kind} value={kind}>{kind === 'eater6502' ? '6502' : kind}</option>)}
                    </select>
                    <button onClick={closeManager} style={btn} data-testid="bw-mm-close">{t('close')}</button>
                </div>

                <div style={{overflowY: 'auto', padding: '8px 16px', flex: 1}}>
                    <div style={{fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase',
                        letterSpacing: 0.4, margin: '4px 0'}}>{lessonT(locale, 'lessons.heading')}</div>
                    {lessons.map(lesson => (
                        <div key={lesson.config.id} data-testid="bw-mm-lesson"
                            data-lesson-id={lesson.config.id}
                            style={{display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0',
                                borderBottom: '1px solid #f1f5f9'}}>
                            <div style={{flex: 1, minWidth: 0}}>
                                <div style={{fontWeight: 600, fontSize: 13}}>{lesson.config.title}</div>
                                <div style={{fontSize: 12, color: '#334155', marginTop: 2}}>{lesson.summary}</div>
                                <div style={{fontSize: 11, color: '#64748b', marginTop: 4}}
                                    data-testid="bw-mm-lesson-licence">
                                    {lesson.licence}{' '}
                                    <a href={lesson.source} target="_blank" rel="noopener noreferrer"
                                        data-testid="bw-mm-lesson-source">{lesson.sourceLabel}</a>
                                </div>
                            </div>
                            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                                <button onClick={() => {invalidateDosPackage(); return runLesson(lesson);}} style={primary}
                                    disabled={lessonBusy === lesson.config.id}
                                    data-testid="bw-mm-lesson-run">{lessonT(locale, 'lessons.run')}</button>
                                {lesson.coldConfig ? (
                                    <button onClick={() => {invalidateDosPackage(); return runLesson(lesson, true);}} style={btn}
                                        disabled={lessonBusy === lesson.config.id}
                                        data-testid="bw-mm-lesson-cold">{lesson.coldLabel}</button>
                                ) : null}
                            </div>
                        </div>
                    ))}
                    {matchingMachines.length === 0 && lessons.length === 0 ? (
                        <div style={{color: '#64748b', padding: '18px 4px'}}>{t('empty')}</div>
                    ) : matchingMachines.map(m => (
                        <div key={m.id} data-testid="bw-mm-row"
                            style={{display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                                borderBottom: '1px solid #f1f5f9'}}>
                            <div style={{flex: 1, minWidth: 0}}>
                                <div style={{fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap',
                                    overflow: 'hidden', textOverflow: 'ellipsis'}}>{m.title || '(untitled)'}</div>
                                <div style={{fontSize: 11, color: '#64748b'}}>
                                    {m.machine || '?'} · {modeBadge(m.executionMode)}
                                    {m.cpu && m.cpu.variant ? ` · ${m.cpu.variant}` : ''}
                                </div>
                                {m.machine === 'i80386' && <label style={{fontSize: 11, color: '#475569'}}>
                                    <input type="checkbox" data-testid="bw-mm-native-blocks"
                                        checked={m.nativeBlocks === true}
                                        onChange={e => setNativeBlocks(m, e.target.checked)} />
                                    {t('nativeBlocks')}
                                </label>}
                            </div>
                            <button onClick={() => {invalidateDosPackage(); return run(m);}} style={primary} data-testid="bw-mm-run">{t('run')}</button>
                            <button onClick={() => dup(m.id)} style={btn}>{t('dup')}</button>
                            <button onClick={() => del(m.id)} style={{...btn, color: '#b91c1c'}}>{t('del')}</button>
                        </div>
                    ))}
                </div>

                <div style={{borderTop: '1px solid #e2e8f0', padding: '10px 16px'}}>
                    <div style={{fontSize: 12, fontWeight: 600, marginBottom: 4}}>Boot a local DOSBox HDD</div>
                    <div style={{fontSize: 11, color: '#64748b', marginBottom: 6}}>
                        Select a raw .img disk. Optionally load a DOSBox .conf with 386 CPU and
                        imgmount -size geometry. The selected filename must match imgmount.
                        The image stays in this browser tab.
                    </div>
                    <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10}}>
                        <input type="file" accept=".img,.ima,.bin" data-testid="bw-mm-local-disk"
                            onChange={e => setLocalDisk(e.target.files?.[0] || null)} />
                        <label style={{fontSize: 11}}>DOSBox .conf
                            <input type="file" accept=".conf,.txt" data-testid="bw-mm-local-conf"
                                onChange={async e => {
                                    const file = e.target.files?.[0];
                                    if (file) setText(await file.text());
                                }} />
                        </label>
                        <button onClick={() => {invalidateDosPackage(); return runLocal();}} style={primary} data-testid="bw-mm-local-run">Boot disk</button>
                        <label style={{fontSize: 11, color: '#475569'}}>
                            <input type="checkbox" data-testid="bw-mm-local-native-blocks"
                                checked={localNativeBlocks}
                                onChange={e => setLocalNativeBlocks(e.target.checked)} />
                            {t('nativeBlocks')}
                        </label>
                    </div>
                    <div style={{fontSize: 12, fontWeight: 600, marginBottom: 4}}>Local DOS package (STORED ZIP)</div>
                    <div style={{fontSize: 11, color: '#64748b', marginBottom: 6}}>
                        One dosbox.conf and one matching bootable raw HDD image, at most 16 MiB.
                        Compressed ZIPs, COM/EXE packages and host commands are not supported.
                        Selected bytes stay in this tab; the existing raw-image chooser remains available.
                    </div>
                    <div style={{display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10}}>
                        <input type="file" accept=".zip" data-testid="bw-mm-dos-package"
                            onChange={e => selectDosPackage(e.target.files?.[0] || null)} />
                        <button data-testid="bw-mm-dos-package-run" style={primary}
                            disabled={!dosPackageFile || dosPackageBusy} onClick={runDosPackage}>Boot package HDD</button>
                    </div>
                    <div style={{fontSize: 12, fontWeight: 600, marginBottom: 4}}>FreeDOS VGA (named 386 profile)</div>
                    <div style={{fontSize: 11, color: '#64748b', marginBottom: 6}}>
                        Select a 1.2MB floppy or a type-1 306×4×17 hard disk. BIOS and VGA ROM
                        files are optional; the bundled LGPL firmware is used when omitted.
                        The selected bytes stay in this browser tab.
                    </div>
                    <div style={{display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10}}>
                        {[
                            ['floppy', 'Floppy', '.img,.ima,.dsk'],
                            ['hdd', 'HDD', '.img,.ima'],
                            ['bios', 'AT BIOS', '.rom,.bin'],
                            ['vgaRom', 'VGA ROM', '.rom,.bin'],
                        ].map(([slot, label, accept]) => <label key={slot} style={{fontSize: 11}}>
                            {label}
                            <input type="file" accept={accept} data-testid={`bw-mm-free386-${slot}`}
                                onChange={e => {
                                    const file = e.target.files?.[0] || null;
                                    setFreeMedia(current => ({...current, [slot]: file}));
                                }} />
                        </label>)}
                        <button onClick={() => {invalidateDosPackage(); return runFree386();}} style={primary}
                            data-testid="bw-mm-free386-run">Boot FreeDOS VGA</button>
                        <label style={{fontSize: 11, color: '#475569'}}>
                            <input type="checkbox" data-testid="bw-mm-free386-native-blocks"
                                checked={freeNativeBlocks}
                                onChange={e => setFreeNativeBlocks(e.target.checked)} />
                            {t('nativeBlocks')}
                        </label>
                    </div>
                    <label style={{fontSize: 12, color: '#475569'}}>{t('importL')}</label>
                    <textarea value={text} onChange={e => setText(e.target.value)}
                        placeholder={t('paste')} data-testid="bw-mm-import-text"
                        style={{width: '100%', height: 72, marginTop: 6, fontFamily: 'monospace',
                            fontSize: 11, borderRadius: 6, border: '1px solid #cbd5e1', padding: 6,
                            boxSizing: 'border-box', resize: 'vertical'}} />
                    <div style={{display: 'flex', gap: 8, alignItems: 'center', marginTop: 6}}>
                        <button onClick={doImport} style={primary} data-testid="bw-mm-import">{t('importB')}</button>
                        <button onClick={doExport} style={btn}>{t('exportB')}</button>
                        <span style={{fontSize: 12, color: '#64748b'}} data-testid="bw-mm-status">{status}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
