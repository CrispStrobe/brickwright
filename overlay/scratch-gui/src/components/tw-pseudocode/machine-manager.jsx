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
import {makeT} from '../../lib/bw-i18n.js';
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
import {localAtBiosMachine, localFreedosVgaMachine} from '../../lib/bw-machines/local-freedos-vga.js';
import {defaultImageFetcher} from '../../lib/bw-machines/activate.js';
import {remoteMachineImagesAllowed} from '../../lib/distribution-policy.js';
import {CIRCUIT_LIBRARY_MACHINES, libraryCircuitPrograms} from '../../lib/bw-machines/library-circuits.js';
import {
    libraryMedia, libraryLicenseUrl, localizedMedia, openLibraryMedia, readKim1LibraryTape, readLibraryCode, readMediaManifest
} from '../../lib/bw-machines/library-media.js';
import {aceKimLicenses, createLibraryAceKim} from '../../lib/bw-machines/ace-kim-library.js';
import {createXkimTerminal, readXkimMedia, XKIM_SOURCE} from '../../lib/bw-machines/kim1-xkim.js';
import {kim1CpmProfiles, readKim1CpmArchive, createKim1CpmTerminal} from '../../lib/bw-machines/kim1-cpm65.js';
import {lessonMachines, lessonT} from '../../lib/bw-machines/lessons.js';

const T = {
    en: {
        wiredFirmware: 'Wired firmware',
        local386: 'Local 386 media',
        localDos: 'Boot a local DOSBox HDD',
        localDosInfo: 'Select a raw hard-disk image. An optional DOSBox configuration supplies the 386 CPU and disk geometry. Its imgmount filename must match the image.',
        localPackage: 'Local DOS package (STORED ZIP)',
        localPackageInfo: 'Select an uncompressed ZIP up to 16 MiB containing one DOSBox configuration and its matching raw hard-disk image.',
        localFreeDos: 'FreeDOS VGA (named 386 profile)',
        localFreeDosInfo: 'Select a boot floppy or a type-1 HDD. Leave the ROM fields empty to use the bundled BIOS and VGA firmware.',
        bootDisk: 'Boot disk',
        bootPackage: 'Boot package HDD',
        bootFreeDos: 'Boot FreeDOS VGA',
        bootBios: 'Boot BIOS only',
        diskImage: 'Disk image',
        zipFile: 'ZIP file',
        floppy: 'Floppy',
        title: 'Machines', empty: 'No machines yet — import one below.',
        run: 'Run', dup: 'Duplicate', del: 'Delete', close: 'Close',
        importL: 'Import a manifest URL, machine JSON, or DOSBox .conf',
        importB: 'Import', exportB: 'Export all',
        imported: 'Imported.', exported: 'Exported below — copy it.', removed: 'Deleted.',
        duped: 'Duplicated.', badImport: 'Could not import: ',
        nativeBlocks: 'Native blocks (experimental)', nativeSaved: 'Execution setting saved.'
    },
    de: {
        wiredFirmware: 'Firmware für die Schaltung',
        local386: 'Lokale 386-Medien',
        localDos: 'Lokales DOSBox-Festplattenabbild starten',
        localDosInfo: 'Wähle ein Rohabbild der Festplatte. Eine optionale DOSBox-Konfiguration legt die 386-CPU und die Geometrie fest. Der Dateiname im imgmount-Befehl muss zum Abbild passen.',
        localPackage: 'Lokales DOS-Paket (unkomprimiertes ZIP)',
        localPackageInfo: 'Wähle ein unkomprimiertes ZIP bis 16 MiB mit einer DOSBox-Konfiguration und dem passenden Rohabbild der Festplatte.',
        localFreeDos: 'FreeDOS VGA (386-Profil)',
        localFreeDosInfo: 'Wähle eine Startdiskette oder eine Typ-1-Festplatte. Leere ROM-Felder verwenden das mitgelieferte BIOS und die VGA-Firmware.',
        bootDisk: 'Festplatte starten',
        bootPackage: 'Paket-Festplatte starten',
        bootFreeDos: 'FreeDOS VGA starten',
        bootBios: 'Nur BIOS starten',
        diskImage: 'Festplattenabbild',
        zipFile: 'ZIP-Datei',
        floppy: 'Diskette',
        title: 'Maschinen', empty: 'Noch keine Maschinen vorhanden.',
        run: 'Starten', dup: 'Duplizieren', del: 'Löschen', close: 'Schließen',
        importL: 'Manifest-URL, Maschinen-JSON oder DOSBox-Konfiguration importieren',
        importB: 'Importieren', exportB: 'Alle exportieren',
        imported: 'Importiert.', exported: 'Exportiert. Kopiere die Daten unten.', removed: 'Gelöscht.',
        duped: 'Dupliziert.', badImport: 'Import fehlgeschlagen: ',
        nativeBlocks: 'Native Blöcke (experimentell)', nativeSaved: 'Ausführungseinstellung gespeichert.'
    }
};
const tr = makeT(T);

const virtual8086Presets = [
    ['Serial Shell', 'serial-monitor', 'serialshell'], ['Keyboard Echo', 'keyboard-demo', 'kbddemo'],
    ['Timer + Keyboard', 'desk-demo', 'deskdemo'], ['Blink (GPIO)', 'blink-demo', 'blink'],
    ['Timer Tick', 'timer-demo', 'timerdemo']
];

const graphics8086Presets = [
    ['CGA Text Demo', 'cga-demo', 'cgademo'], ['CGA Graphics', 'cga-gfx-demo', 'cgademo'],
    ['VGA 256-colour', 'vga-demo', 'vgademo'], ['Hercules Mono', 'hercules-demo', 'hercdemo'],
    ['EGA 16-colour', 'ega-demo', 'egademo']
];

const modeBadge = m => (m === 'wired' ? '🔌 wired' : m === 'auto' ? '◐ auto' : '⚙ functional');

const machineLabels = {i8086: '8086', i80286: '80286', i80386: '80386',
    eater6502: '6502', kim1: 'KIM-1 (6502)', z80: 'Z80',
    cp1: 'Kosmos CP1 (8049)', microtronic: 'Busch Microtronic (TMS1600)', cardiac: 'CARDIAC',
    riscv32: 'RISC-V (RV32IMA)', rp2040js: 'Raspberry Pi Pico (RP2040)'};
const machineOrder = Object.keys(machineLabels);
const machineRank = kind => {
    const rank = machineOrder.indexOf(kind);
    return rank < 0 ? machineOrder.length : rank;
};
const sortMachines = (a, b) => machineRank(a) - machineRank(b) || a.localeCompare(b);

const btn = {padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
    background: '#fff', cursor: 'pointer', fontSize: 12};
const primary = {...btn, background: 'linear-gradient(135deg,#4c97ff,#4280d7)', color: '#fff', border: 'none'};
const rowStyle = {display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 13};
const fieldsStyle = {...rowStyle, fontSize: 11, marginTop: 4};

function MachineEntry({title, info, infoPrefix, actions, children, rowAttributes}) {
    const [showInfo, setShowInfo] = React.useState(false);
    const infoLabel = `${infoPrefix} ${title}`;
    return (
        <div {...rowAttributes} style={{padding: '6px 0', borderBottom: '1px solid #f1f5f9'}}>
            <div style={rowStyle}>
                <strong style={{flex: '1 1 130px', minWidth: 0, overflowWrap: 'anywhere'}}>
                    <span>{title}</span>{info && <button type="button" title={infoLabel} aria-label={infoLabel}
                        aria-expanded={showInfo} data-testid="bw-mm-item-info"
                        style={{...btn, marginInlineStart: 6, padding: '1px 5px', color: '#334155'}}
                        onClick={() => setShowInfo(open => !open)}>ⓘ</button>}
                </strong>
                {actions}
            </div>
            {showInfo && info && <div data-testid="bw-mm-item-description"
                style={{fontSize: 12, color: '#334155', margin: '5px 0', lineHeight: 1.45}}>
                {info}
            </div>}
            {children}
        </div>
    );
}

export default function MachineManager({store, onRun, onClose, locale, preferredMachine, wiredPresets, onOpenExample, onRunKim1Tty, onRunAceKim}) {
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
    const [query, setQuery] = React.useState('');
    const [openGroups, setOpenGroups] = React.useState({});
    const [graphics8086, setGraphics8086] = React.useState('cga-demo');
    const virtual8086 = !(preferredMachine === 'i8086' && wiredPresets?.length);
    const openByDefault = Boolean(machineFilter || query.trim());
    const infoPrefix = /^de/i.test(locale) ? 'Informationen zu' : 'About';
    const matchesType = kind => !machineFilter || kind === machineFilter;
    const matchesTitle = title => String(title || '').toLowerCase().includes(query.trim().toLowerCase());
    const matchingMachines = machines.filter(machine => matchesType(machine.machine) && matchesTitle(machine.title));
    const matchingPresets = matchesType(preferredMachine)
        ? (wiredPresets || []).filter(preset => matchesTitle(preset.title)) : [];
    const showLocal386 = matchesType('i80386');
    const mediaAllowed = remoteMachineImagesAllowed();
    const matchingMedia = mediaAllowed ? libraryMedia.map(item => localizedMedia(item, locale))
        .filter(item => matchesType(item.machine) && matchesTitle(item.title)) : [];
    const [circuits, setCircuits] = React.useState(null);
    const [cpmProfile, setCpmProfile] = React.useState(kim1CpmProfiles[0]);
    const [cpmFile, setCpmFile] = React.useState(null);
    const [xkimRom, setXkimRom] = React.useState(null);
    const [xkimMedia, setXkimMedia] = React.useState([]);
    const [xkimMediaKind, setXkimMediaKind] = React.useState('files');
    const controllerRequest = React.useRef(null);
    React.useEffect(() => () => { controllerRequest.current = null; }, []);
    const [launching, setLaunching] = React.useState(null);
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
        controllerRequest.current = null;
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
    const runBios = async () => {
        try {
            const cfg = localAtBiosMachine(freeMedia);
            await run(cfg, {fetcher: async ref => {
                const file = ref.url === 'local-media:bios' ? freeMedia.bios :
                    ref.url === 'local-media:vga-rom' ? freeMedia.vgaRom : null;
                return file ? {bytes: new Uint8Array(await file.arrayBuffer())} : defaultImageFetcher(ref);
            }});
        } catch (error) { setStatus(error.message); }
    };
    const runVirtual8086 = (title, name, profile) => run(newMachineConfig({
        title, machine: 'i8086', executionMode: 'functional',
        slots: {rom: {url: `static/roms/i8086-${name}.bin`}}, bootOrder: ['rom']
    }), {i8086RomProfile: profile});
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
    const lessons = allLessons.filter(lesson => matchesType(lesson.config.machine) && matchesTitle(lesson.config.title));
    const machineKinds = [...new Set([preferredMachine, 'i8086', 'i80386', ...CIRCUIT_LIBRARY_MACHINES,
        ...allLessons.map(lesson => lesson.config.machine), ...(mediaAllowed ? libraryMedia.map(item => item.machine) : []),
        ...machines.map(machine => machine.machine)].filter(Boolean))].sort(sortMachines);
    const circuitTitle = example => example.title?.[/^de/i.test(locale) ? 'de' : 'en'] || example.title?.en || example.id;
    const canOpenExample = !!onOpenExample;
    const showCircuitPrograms = canOpenExample && (!machineFilter || CIRCUIT_LIBRARY_MACHINES.includes(machineFilter));
    React.useEffect(() => {
        if (!canOpenExample) return undefined;
        let current = true;
        fetch('examples/index.json').then(response => {
            if (!response.ok) throw new Error(`Examples HTTP ${response.status}`);
            return response.json();
        }).then(index => {
            if (current) setCircuits(libraryCircuitPrograms(index));
        }).catch(error => {
            if (current) setStatus(error.message);
        });
        return () => { current = false; };
    }, [canOpenExample]);
    const matchingCircuits = circuits?.filter(example => matchesType(example.machine) && matchesTitle(circuitTitle(example))) || [];
    const launch = async (id, action) => {
        invalidateDosPackage();
        setLaunching(id);
        setStatus(/^de/i.test(locale) ? 'Wird gestartet…' : 'Starting…');
        try {
            if (await action() !== false) onClose?.();
        } catch (error) {
            setStatus(error.message);
        } finally {
            setLaunching(null);
        }
    };
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
                cfg = fromMediaManifest(await readMediaManifest(url), {source: url.href, baseUrl: new URL('.', url).href});
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
            setOpenGroups(current => ({...current, [cfg.machine]: true}));
            setText(''); setStatus(t('imported')); await refresh();
        } catch (e) { setStatus(t('badImport') + e.message); }
    };

    const doExport = async () => {
        try { setText(JSON.stringify(await store.export(), null, 2)); setStatus(t('exported')); }
        catch (e) { setStatus(e.message); }
    };

    const stop = e => e.stopPropagation();
    const availableGraphics = graphics8086Presets.filter(([title]) =>
        matchesTitle(title) || matchesTitle('Graphics test'));
    const graphicsPreset = availableGraphics.find(([, name]) => name === graphics8086) || availableGraphics[0];
    const groups = machineKinds.filter(matchesType).map(kind => ({
        kind,
        bios: kind === 'i80386' && matchesTitle('386 AT BIOS'),
        graphics: kind === 'i8086' && virtual8086 ? graphicsPreset : null,
        virtual: kind === 'i8086' && virtual8086 ?
            virtual8086Presets.filter(([title]) => matchesTitle(title)) : [],
        presets: kind === preferredMachine ? matchingPresets : [],
        lessons: lessons.filter(lesson => lesson.config.machine === kind),
        saved: matchingMachines.filter(machine => machine.machine === kind),
        media: matchingMedia.filter(item => item.machine === kind),
        cpm65: kind === 'kim1' && onRunKim1Tty && matchesTitle('CP/M-65 for KIM-1'),
        xkim: kind === 'kim1' && onRunKim1Tty && matchesTitle('Corsham xKIM'),
        examples: showCircuitPrograms ? matchingCircuits.filter(example => example.machine === kind) : [],
        local: kind === 'i80386' && (
            !query.trim() || ['local386', 'localDos', 'localPackage', 'localFreeDos'].some(key => matchesTitle(t(key))))
    })).filter(group => group.bios || group.local || group.graphics || group.virtual.length || group.presets.length ||
        group.lessons.length || group.saved.length || group.media.length || group.examples.length || group.cpm65 || group.xkim);

    return (
        <div onClick={closeManager} data-testid="bw-machine-manager"
            style={{...overlayBox, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <div onClick={stop} style={{background: '#fff', borderRadius: 10, width: 'min(680px, 92vw)',
                maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
                boxShadow: '0 12px 40px rgba(0,0,0,0.3)'}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                    padding: '12px 16px', borderBottom: '1px solid #e2e8f0'}}>
                    <strong style={{fontSize: 15}}>{preferredMachine ? (/^de/i.test(locale) ? 'Firmware-Bibliothek' : 'Firmware library') : t('title')}</strong>
                    <select aria-label={/^de/i.test(locale) ? 'Zielsystem' : 'Machine type'} value={machineFilter}
                        onChange={event => { setMachineFilter(event.target.value); setOpenGroups({}); }}>
                        <option value="">{/^de/i.test(locale) ? 'Alle Maschinen' : 'All machines'}</option>
                        {machineKinds.map(kind => <option key={kind} value={kind}>{machineLabels[kind] || kind}</option>)}
                    </select>
                    <input type="search" aria-label={/^de/i.test(locale) ? 'Firmware suchen' : 'Search firmware'}
                        placeholder={/^de/i.test(locale) ? 'Suchen' : 'Search'} value={query}
                        style={{flex: '1 1 100px', minWidth: 80}} onChange={event => { setQuery(event.target.value); setOpenGroups({}); }} />
                    <button onClick={closeManager} style={btn} data-testid="bw-mm-close">{t('close')}</button>
                </div>

                <div style={{overflowY: 'auto', padding: '8px 16px', flex: 1}}>
                    {groups.length === 0 && <div style={{color: '#64748b', padding: '18px 4px'}}>
                        {query.trim() ? (/^de/i.test(locale) ? 'Keine passenden Einträge' : 'No matching entries') : t('empty')}
                    </div>}
                    {groups.map(group => {
                        const title = machineLabels[group.kind] || group.kind;
                        const open = openGroups[group.kind] ?? openByDefault;
                        const groupId = `bw-mm-items-${group.kind}`;
                        return (
                            <section key={group.kind} data-machine-kind={group.kind} aria-label={title}
                                style={{marginBottom: 6}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                                    <h3 style={{margin: 0, flex: 1}}>
                                        <button type="button" aria-expanded={open} aria-controls={groupId}
                                            data-testid="bw-mm-group-toggle"
                                            style={{...btn, display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                                padding: '6px 8px', background: '#eef2f7', textAlign: 'start',
                                                fontSize: 13, fontWeight: 600, color: '#1e293b'}}
                                            onClick={() => setOpenGroups(current => ({...current, [group.kind]: !open}))}>
                                            <span aria-hidden="true" style={{display: 'inline-block',
                                                transform: open ? 'rotate(90deg)' : undefined}}>›</span>
                                            {title}
                                        </button>
                                    </h3>
                                    {group.graphics && <select aria-label={/^de/i.test(locale) ? '8086-Grafik' : '8086 graphics'}
                                        data-testid="bw-mm-8086-graphics" style={btn} value={group.graphics[1]}
                                        onChange={event => {
                                            setGraphics8086(event.target.value);
                                            setOpenGroups(current => ({...current, i8086: true}));
                                        }}>
                                        {availableGraphics.map(([label, name]) =>
                                            <option key={name} value={name}>{label}</option>)}
                                    </select>}
                                </div>
                                <div id={groupId} hidden={!open} style={{paddingInlineStart: 16}}>
                                    {group.bios && <MachineEntry title="386 AT BIOS" infoPrefix={infoPrefix}
                                        info="Start the virtual 386 with the bundled BIOS and no boot disk."
                                        actions={<button type="button" style={primary} data-testid="bw-mm-at-bios-run"
                                            onClick={runBios}>Start 386</button>} />}
                                    {group.graphics && <MachineEntry
                                        title={/^de/i.test(locale) ? 'Grafiktest' : 'Graphics test'} actions={
                                            <button type="button" style={primary} data-testid={`bw-mm-8086-${group.graphics[1]}`}
                                                onClick={() => runVirtual8086(...group.graphics)}>{t('run')}</button>
                                        } />}
                                    {group.virtual.map(([label, name, profile]) =>
                                        <MachineEntry key={name} title={label} actions={
                                            <button type="button" style={primary} data-testid={`bw-mm-8086-${name}`}
                                                onClick={() => runVirtual8086(label, name, profile)}>{t('run')}</button>
                                        } />)}
                                    {group.presets.length > 0 && <section aria-label={t('wiredFirmware')} data-testid="bw-mm-wired-presets">
                                        {group.presets.map(preset => <MachineEntry key={preset.id} title={preset.title}
                                            info={preset.summary} infoPrefix={infoPrefix} actions={
                                                <button type="button" onClick={() => launch(preset.id, preset.run)}
                                                    disabled={launching !== null} data-testid={`bw-mm-wired-${preset.id}`} style={primary}>
                                                    {t('run')}
                                                </button>
                                            } />)}
                                    </section>}
                                    {group.lessons.map(lesson => (
                                        <MachineEntry key={lesson.config.id} title={lesson.config.title} infoPrefix={infoPrefix}
                                            rowAttributes={{'data-testid': 'bw-mm-lesson', 'data-lesson-id': lesson.config.id}} info={<>
                                                <div>{lesson.summary}</div>
                                                <div style={{marginTop: 4}} data-testid="bw-mm-lesson-licence">
                                                    {lesson.licence}{' '}
                                                    <a href={lesson.source} target="_blank" rel="noopener noreferrer"
                                                        data-testid="bw-mm-lesson-source">{lesson.sourceLabel}</a>
                                                </div>
                                            </>} actions={<>
                                                <button onClick={() => {invalidateDosPackage(); return runLesson(lesson);}} style={primary}
                                                    disabled={lessonBusy === lesson.config.id}
                                                    data-testid="bw-mm-lesson-run">{lessonT(locale, 'lessons.run')}</button>
                                                {lesson.coldConfig && (
                                                    <button onClick={() => {invalidateDosPackage(); return runLesson(lesson, true);}} style={btn}
                                                        disabled={lessonBusy === lesson.config.id}
                                                        data-testid="bw-mm-lesson-cold">{lesson.coldLabel}</button>
                                                )}
                                            </>} />
                                    ))}
                                    {group.saved.map(m => (
                                        <MachineEntry key={m.id} title={m.title || '(untitled)'} infoPrefix={infoPrefix}
                                            rowAttributes={{'data-testid': 'bw-mm-row'}} info={<>
                                                {title} · {modeBadge(m.executionMode)}
                                                {m.cpu?.variant ? ` · ${m.cpu.variant}` : ''}
                                            </>} actions={<>
                                                <button onClick={() => {invalidateDosPackage(); return run(m);}} style={primary} data-testid="bw-mm-run">{t('run')}</button>
                                                <button onClick={() => dup(m.id)} style={btn}>{t('dup')}</button>
                                                <button onClick={() => del(m.id)} style={{...btn, color: '#b91c1c'}}>{t('del')}</button>
                                            </>}>
                                            {m.machine === 'i80386' && <label style={{fontSize: 11, color: '#475569'}}>
                                                <input type="checkbox" data-testid="bw-mm-native-blocks"
                                                    checked={m.nativeBlocks === true}
                                                    onChange={e => setNativeBlocks(m, e.target.checked)} />
                                                {t('nativeBlocks')}
                                            </label>}
                                        </MachineEntry>
                                    ))}
                                    {group.media.length > 0 && <div data-testid="bw-mm-downloadable-media">
                                        {group.media.map(item => <MachineEntry key={item.id} title={item.title} infoPrefix={infoPrefix}
                                            rowAttributes={{'data-machine-media': item.id}}
                                            info={<>
                                                {item.summary && <div>{item.summary}</div>}
                                                {item.aceKim ? aceKimLicenses.map(({label, url}) => <div key={label}>
                                                    <a href={url} target="_blank" rel="noopener noreferrer">{label} · MIT</a>
                                                </div>) : item.licenseFile ? <a href={libraryLicenseUrl(item)} target="_blank" rel="noopener noreferrer">
                                                    {item.license}
                                                </a> : (/^de/i.test(locale) ? `Lizenz · ${item.license}` : `License · ${item.license}`)}
                                            </>}
                                            actions={
                                                <button type="button" disabled={launching !== null || (item.aceKim ? !onRunAceKim :
                                                        item.kim1Tape ? !onOpenExample : !item.benchmark && !onRun)} style={btn}
                                                    onClick={() => launch(item.id, async () => {
                                                        if (item.benchmark) {
                                                            window.dispatchEvent(new CustomEvent('bw-open-native-benchmarks',
                                                                {detail: {run: item.benchmark}}));
                                                            return true;
                                                        }
                                                        if (item.aceKim) {
                                                            const request = {};
                                                            controllerRequest.current = request;
                                                            const machine = await createLibraryAceKim();
                                                            if (controllerRequest.current !== request) return false;
                                                            onRunAceKim(machine);
                                                            return true;
                                                        }
                                                        if (item.kim1Tape) {
                                                            const kim1Tape = await readKim1LibraryTape(item);
                                                            return onOpenExample('kim1-wired-io', false, {kim1Tape});
                                                        }
                                                        const [config, code] = await Promise.all([openLibraryMedia(item), readLibraryCode(item)]);
                                                        return onRun(config, {code});
                                                    })}>
                                                    {t('run')}
                                                </button>
                                            } />)}
                                    </div>}
                                    {group.cpm65 && <MachineEntry title="CP/M-65 for KIM-1" infoPrefix={infoPrefix}
                                        rowAttributes={{'data-testid': 'bw-mm-kim1-cpm65'}}
                                        info={<>Choose the matching <a href={cpmProfile.url} target="_blank" rel="noreferrer">upstream ZIP</a>.
                                            {' '}The archive stays in this session. CP/M-65 itself is BSD-2-Clause, and the disk includes separately licensed utilities.</>}
                                        actions={<>
                                            <select aria-label="CP/M-65 drive" value={cpmProfile.id} disabled={launching !== null}
                                                onChange={event => {
                                                    setCpmProfile(kim1CpmProfiles.find(profile => profile.id === event.target.value));
                                                    setCpmFile(null);
                                                    setStatus('');
                                                }}>
                                                {kim1CpmProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                                            </select>
                                            <input key={cpmProfile.id} type="file" accept=".zip" aria-label="CP/M-65 ZIP"
                                                style={{maxWidth: 175}} disabled={launching !== null}
                                                onChange={event => setCpmFile(event.target.files?.[0] || null)} />
                                            <button type="button" style={btn} disabled={launching !== null || !cpmFile}
                                                onClick={() => launch('kim1-cpm65', async () => {
                                                    const request = {};
                                                    controllerRequest.current = request;
                                                    const media = await readKim1CpmArchive(cpmProfile.id, cpmFile);
                                                    if (controllerRequest.current !== request) return false;
                                                    const session = await createKim1CpmTerminal(media);
                                                    if (controllerRequest.current !== request) {
                                                        session.dispose();
                                                        return false;
                                                    }
                                                    onRunKim1Tty(session);
                                                    return true;
                                                })}>{t('run')}</button>
                                        </>} />}
                                    {group.xkim && <MachineEntry title="Corsham xKIM" infoPrefix={infoPrefix}
                                        rowAttributes={{'data-testid': 'bw-mm-xkim'}}
                                        info={<>Use the 8 KiB ROM built from the <a href={XKIM_SOURCE} target="_blank" rel="noreferrer">upstream xKIM source</a>.
                                            {' '}Choose loose 8.3 files or a FAT12/16/32 image up to 128 MiB. For an image, only compatible root files are imported.
                                            {' '}The guest changes session copies. Export files in Controller keeps them in a ZIP.</>}
                                        actions={<>
                                            <label style={fieldsStyle}>ROM
                                                <input type="file" accept=".rom,.bin" aria-label="xKIM ROM" disabled={launching !== null}
                                                    style={{maxWidth: 140}} onChange={event => setXkimRom(event.target.files?.[0] || null)} />
                                            </label>
                                            <select value={xkimMediaKind} aria-label="xKIM storage type" disabled={launching !== null}
                                                onChange={event => { setXkimMedia([]); setXkimMediaKind(event.target.value); }}>
                                                <option value="files">Loose files</option>
                                                <option value="fat">FAT image</option>
                                            </select>
                                            <input key={xkimMediaKind} type="file" multiple={xkimMediaKind === 'files'}
                                                aria-label={xkimMediaKind === 'files' ? 'xKIM Corsham files' : 'xKIM FAT image'}
                                                disabled={launching !== null} style={{maxWidth: 140}}
                                                onChange={event => setXkimMedia(Array.from(event.target.files || []))} />
                                            <button type="button" style={btn} disabled={launching !== null || !xkimRom}
                                                onClick={() => launch('kim1-xkim', async () => {
                                                    const request = {};
                                                    controllerRequest.current = request;
                                                    if (xkimMediaKind === 'fat' && !xkimMedia[0]) throw new Error('Choose an xKIM FAT image.');
                                                    const media = await readXkimMedia(
                                                        xkimRom, xkimMediaKind === 'files' ? xkimMedia : [], xkimMediaKind === 'fat' ? xkimMedia[0] : null
                                                    );
                                                    if (controllerRequest.current !== request) return false;
                                                    const session = await createXkimTerminal(media);
                                                    if (controllerRequest.current !== request) {
                                                        session.dispose();
                                                        return false;
                                                    }
                                                    onRunKim1Tty(session);
                                                    return true;
                                                })}>{t('run')}</button>
                                        </>} />}
                                    {group.examples.length > 0 && <div data-testid="bw-mm-circuit-programs">
                                        {group.examples.map(example => <MachineEntry key={example.id} title={circuitTitle(example)} rowAttributes={{'data-machine-example': example.id}} actions={
                                            <button type="button" disabled={launching !== null} style={btn}
                                                onClick={() => launch(example.id, () => onOpenExample(example.id, example.codeOnly))}>
                                                {/^de/i.test(locale) ? 'Öffnen' : 'Open'}
                                            </button>
                                        } />)}
                                    </div>}
                                    {group.local && <div data-testid="bw-mm-local-386" aria-label={t('local386')}>
                                        <MachineEntry title={t('localDos')} infoPrefix={infoPrefix}
                                            info={t('localDosInfo')}
                                            actions={<button onClick={() => {invalidateDosPackage(); return runLocal();}} style={primary}
                                                data-testid="bw-mm-local-run">{t('bootDisk')}</button>}>
                                            <div style={fieldsStyle}>
                                                <label>{t('diskImage')}{' '}
                                                    <input type="file" accept=".img,.ima,.bin" data-testid="bw-mm-local-disk"
                                                        onChange={e => setLocalDisk(e.target.files?.[0] || null)} />
                                                </label>
                                                <label>DOSBox .conf{' '}
                                                    <input type="file" accept=".conf,.txt" data-testid="bw-mm-local-conf"
                                                        onChange={async e => {
                                                            const file = e.target.files?.[0];
                                                            if (file) setText(await file.text());
                                                        }} />
                                                </label>
                                                <label>
                                                    <input type="checkbox" data-testid="bw-mm-local-native-blocks"
                                                        checked={localNativeBlocks}
                                                        onChange={e => setLocalNativeBlocks(e.target.checked)} />
                                                    {t('nativeBlocks')}
                                                </label>
                                            </div>
                                        </MachineEntry>
                                        <MachineEntry title={t('localPackage')} infoPrefix={infoPrefix}
                                            info={t('localPackageInfo')}
                                            actions={<button data-testid="bw-mm-dos-package-run" style={primary}
                                                disabled={!dosPackageFile || dosPackageBusy} onClick={runDosPackage}>{t('bootPackage')}</button>}>
                                            <div style={fieldsStyle}>
                                                <label>{t('zipFile')}{' '}
                                                    <input type="file" accept=".zip" data-testid="bw-mm-dos-package"
                                                        onChange={e => selectDosPackage(e.target.files?.[0] || null)} />
                                                </label>
                                            </div>
                                        </MachineEntry>
                                        <MachineEntry title={t('localFreeDos')} infoPrefix={infoPrefix}
                                            info={t('localFreeDosInfo')}
                                            actions={<>
                                                <button onClick={() => {invalidateDosPackage(); return runFree386();}} style={primary}
                                                    data-testid="bw-mm-free386-run">{t('bootFreeDos')}</button>
                                                {(freeMedia.bios || freeMedia.vgaRom) && <button type="button" style={btn}
                                                    onClick={runBios}>{t('bootBios')}</button>}
                                            </>}>
                                            <div style={fieldsStyle}>
                                                {[
                                                    ['floppy', t('floppy'), '.img,.ima,.dsk'],
                                                    ['hdd', 'HDD', '.img,.ima'],
                                                    ['bios', 'AT BIOS', '.rom,.bin'],
                                                    ['vgaRom', 'VGA ROM', '.rom,.bin'],
                                                ].map(([slot, label, accept]) => <label key={slot}>
                                                    {label}{' '}
                                                    <input type="file" accept={accept} data-testid={`bw-mm-free386-${slot}`}
                                                        onChange={e => {
                                                            const file = e.target.files?.[0] || null;
                                                            setFreeMedia(current => ({...current, [slot]: file}));
                                                        }} />
                                                </label>)}
                                                <label>
                                                    <input type="checkbox" data-testid="bw-mm-free386-native-blocks"
                                                        checked={freeNativeBlocks}
                                                        onChange={e => setFreeNativeBlocks(e.target.checked)} />
                                                    {t('nativeBlocks')}
                                                </label>
                                            </div>
                                        </MachineEntry>
                                    </div>}
                                </div>
                            </section>
                        );
                    })}
                </div>

                <div style={{borderTop: '1px solid #e2e8f0', padding: '8px 16px'}}>
                    <textarea aria-label={showLocal386 ? t('importL') : 'Import a manifest URL or machine JSON'}
                        rows={1} value={text} onChange={e => setText(e.target.value)}
                        placeholder={showLocal386 ? t('importL') : 'Paste a manifest URL or machine JSON'} data-testid="bw-mm-import-text"
                        style={{width: '100%', minHeight: 32, maxHeight: 140, marginTop: 2, fontFamily: 'monospace',
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
