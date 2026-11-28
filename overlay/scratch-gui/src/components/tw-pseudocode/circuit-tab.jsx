import {setCircuitView, showCircuitDebugger} from '../../lib/bw-debug/debug-view.js';
import {addCardiacFace, addMicrotronicFace, addKim1Face, addKim1VideoFace} from '../../lib/controller-machine-faces.js';
import React from 'react';
import {clearControllerPanel, serializeControllerPanel} from '../../lib/controller-inputs.js';
import {makeT} from '../../lib/bw-i18n.js';
import {createCardiacWorkspace, CARDIAC_WORKSPACE_KEY, readCardiacWorkspaceActive, setCardiacWorkspaceActive} from '../../lib/cardiac-project.js';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {normalizeDeviceId, resolveExampleBench} from '../../lib/example-bench.js';
import {advanceDebugPhase} from '../../lib/bw-debug/debug-phase-transition.js';
import {shouldLoadCircuitDesigner} from '../../lib/bw-debug/circuit-designer-load-policy.js';
import {getReactPerformanceProbe, profileReactSubtree} from '../../lib/bw-debug/react-perf-profiler.js';
import {shouldRefreshDesignerDebugState} from '../../lib/bw-debug/debug-ui-refresh.js';
import {s040PartIds, sameS040PartIds} from '../../lib/bw-debug/s040-part-ids.js';
import {circuitAutosaveRecord, readCircuitOwner} from '../../lib/circuit-autosave-record.js';
import {setProjectTitle} from '../../reducers/project-title';
import {activateTab} from '../../reducers/editor-tab';
import {noCircuitMessage} from '../../lib/example-device-only.js';
import {getIsAnyCreatingNewState} from '../../reducers/project-state';
import {activateUndoSurface, getUndoState, notifyUndoState, registerUndoSurface} from '../../lib/global-undo.js';
import {notifyEditorMenuActions, registerEditorMenuActions} from '../../lib/editor-menu-actions.js';
import {confirmAsync} from '../../lib/native-dialog.js';
import {circuitExamplesWithArtwork, loadGalleryArtwork} from '../../lib/gallery-artwork.js';
import {applyBenchTemperature, clampBenchTemperature, loadBenchTemperature, saveBenchTemperature} from
    '../../lib/bench-temperature.js';

/**
 * The panel's own learner-facing strings. Not scratch-gui's, so not
 * react-intl: this is the local-table pattern the tw-pseudocode panes use,
 * with the shared machinery from lib/bw-i18n.js. Console diagnostics
 * ('[brickwright] …') are deliberately NOT here — nobody reads a log in
 * translation, and putting them here would only hide them from the developer
 * who needs them.
 */
const PANEL_L10N = {
    en: {
        'designer.loading': 'Loading the circuit designer…',
        'designer.failed': 'The circuit designer failed to load: {error}',
        'designer.reload': 'Reload the editor',
        'examples.notVendored': 'The example gallery is not part of this build (examples/index.json: {message}).',
        'examples.indexFailed': 'The starter project index could not be loaded.',
        'app.republished': 'A new version was published while this tab was open. Reloading…'
    },
    de: {
        'designer.loading': 'Schaltungs-Designer wird geladen…',
        'designer.failed': 'Der Schaltungs-Designer konnte nicht geladen werden: {error}',
        'designer.reload': 'Editor neu laden',
        'examples.notVendored': 'Die Beispielgalerie gehört nicht zu diesem Build (examples/index.json: {message}).',
        'examples.indexFailed': 'Der Index der Startprojekte konnte nicht geladen werden.',
        'app.republished': 'Eine neue Version wurde veröffentlicht, während dieser Tab offen war. Wird neu geladen…'
    }
};
const pt = makeT(PANEL_L10N);


const Kim1Surface = React.lazy(() => import(/* webpackChunkName: "bw-kim1-surface" */ './kim1-surface.jsx'));

const DebugPanel = React.lazy(() =>
    import(/* webpackChunkName: "bw-debug-panel" */ './debug-panel.jsx')
);

/**
 * The circuit designer, as a first-class editor tab beside Code / Costumes / Sounds.
 *
 * It began life as a toggle inside the Code tab and that was the wrong home: a board
 * you wire by dragging parts needs the whole editor pane, not a strip under a textarea.
 *
 * Two things this has to get right:
 *
 * 1. `forceRenderTabPanel` is set on the GUI's <Tabs>, so this component is mounted from
 *    the moment the editor opens, whether or not anyone ever looks at the tab. The engine
 *    and the panel are therefore loaded on first *visibility*, not on mount — otherwise
 *    every user pays for a designer most of them never open.
 * 2. The board is inferred from the project's PIN declarations (boundary C), so it is
 *    re-read each time the tab is opened; the user may well have edited the declarations
 *    in the Code tab in between.
 */
// Locale strings for the debugger-solo empty state. The app's i18n is
// MODULAR (locale from the redux store, per-key dicts, en fallback) so a
// language is added by adding a key — never by sniffing
// navigator.language inline, which can neither be extended nor tested.

// A panel render-crash must never take the whole app down: degrade to a
// card with the error and a remount button (the Step x10 chain unmounted
// the entire GUI before this existed).
class PanelBoundary extends React.Component {
    constructor (props) { super(props); this.state = {err: null}; }
    static getDerivedStateFromError (err) { return {err}; }
    componentDidCatch (err) { console.error('[brickwright] debug panel crashed:', err); }
    render () {
        if (this.state.err) {
            return (
                <div style={{padding: 10, color: '#b91c1c', fontSize: 12.5}} data-debug-panel-crash>
                    <div>{`The debugger hit an error: ${String(this.state.err && this.state.err.message || this.state.err).slice(0, 200)}`}</div>
                    <button style={{marginTop: 8, padding: '4px 10px', cursor: 'pointer'}}
                        onClick={() => this.setState({err: null})}>{'Restart the debugger panel'}</button>
                </div>
            );
        }
        return this.props.children;
    }
}

// A dock SLOT: adopts the persistent debug-host DOM node. The DebugPanel
// renders through ONE portal into ONE node that never changes identity —
// docking moves the NODE between slots, so the runner survives the move
// (owner requirement: '>>' must not reset a running session).
const HostMount = ({host, style}) => (
    <div
        data-debug-host-slot
        style={{display: 'flex', flexDirection: 'column', flex: '1 1 auto',
            minHeight: 0, minWidth: 0, ...style}}
        ref={el => { if (el && host && host.parentElement !== el) el.appendChild(host); }}
    />
);

// A program drives the board when it declares PINs OR binds a PART
// (PART leds = 74HC595 ... claims pins with zero PIN lines — the
// 8-LED chaser showed 'No program pins declared' forever, owner
// report 2026-08-17).
const stcDrives = stc => !!(stc && ((stc.pins && stc.pins.length) ||
    (stc.parts && stc.parts.length)));

// Progress-only debugger refresh. Pauses, errors and phase transitions arrive
// through separate content changes immediately; live counters/partial serial
// text are human-facing and do not justify rebuilding this React subtree at
// animation speed (or at the old 10 Hz floor).
const DEBUG_LIVE_REFRESH_MS = 250;

// These modes share the right column with panes owned by gui.jsx. Remember
// their selection too, so a controller/device face never covers a stale
// debugger portal that still thinks the column belongs to it.
function CircuitPanelNavigation({Switch, panel, drc, locale, onSelect, menu, onPick}) {
    return <>
        <Switch {...{panel, drc, locale, onSelect, menu, onPick}} />
        {menu && <button type="button" className="circuit-menu-row" data-testid="bw-circuit-machines"
            onClick={() => {
                onPick?.();
                window.dispatchEvent(new CustomEvent('bw-open-machine-manager'));
            }}>
            <span aria-hidden="true" style={{width: 18, textAlign: 'center'}}>▣</span>
            <span className="circuit-menu-label">{/^de/i.test(locale) ? 'Maschinen…' : 'Machines…'}</span>
        </button>}
    </>;
}

const CIRCUIT_DOCKS = new Set(['top', 'right', 'off', 'solo']);
const DEVICE_DOCKS = new Set(['controller', 'microbit', 'arcade', 'cpx', 'arduboy', 'makecode', 'spikearena', 'cad', 'robots']);

class CircuitTab extends React.Component {
    constructor (props) {
        super(props);
        let hintDismissed = false;
        try {
            hintDismissed = localStorage.getItem('bw-circuit-hint') === '1';
        } catch { /* private mode */ }
        let debugHintDismissed = false;
        try {
            debugHintDismissed = localStorage.getItem('bw-debug-hint') === '1';
        } catch { /* private mode */ }
        let hideStage = false;
        // 'right' by default: the FULL DebugPanel in the Circuit editor's
        // right column. 'top' tucked it into the Designer's Instruments
        // column, which reads as "there is no debugger here" — the owner
        // asked for the right-pane debugger roughly ten times before this
        // default changed (2026-08-17). 'top' stays selectable in settings.
        let debugDock = 'right';
        let showInStage = false;
        let rightPaneHidden = true;
        try {
            showInStage = localStorage.getItem('bw-stage-circuit') === '1';
            rightPaneHidden = localStorage.getItem('bw-right-pane-hidden') !== '0';
        } catch { /* private mode */ }
        this._stageHost = null;
        try {
            hideStage = localStorage.getItem('bw-hide-stage') === '1';
            const d = localStorage.getItem('bw-debug-dock');
            if (CIRCUIT_DOCKS.has(d) || DEVICE_DOCKS.has(d)) debugDock = d;
        } catch { /* private mode: defaults */ }
        this.state = {Designer: null, ui: null, panels: null, error: null, reloading: false, stc: null,
            board: null, debugState: null, s040PartIds: [], panel: 'designer', circuit: null, hintDismissed,
            debugHintDismissed, hideStage, debugDock, showInStage, rightPaneHidden,
            examples: null, examplesError: null, curriculum: null,
            circuitData: null, loadingExample: null,
            cpxState: this.props.vm?.runtime?.bwCpxState || null, handleCpxInput: null,
            machineBooted: false, pendingExampleTitle: null,
            // The air every part sits in (lib/bench-temperature.js): the chips'
            // on-die sensors and the temperature-dependent parts read it.
            benchC: loadBenchTemperature()};
        this.handleRunnerChange = this.handleRunnerChange.bind(this);
        this.handleBenchTemperature = this.handleBenchTemperature.bind(this);
        this.handleCircuitReady = this.handleCircuitReady.bind(this);
        this.handleDesignerMenuActions = this.handleDesignerMenuActions.bind(this);
        this.loadExample = this.loadExample.bind(this);
        this.selectPanel = this.selectPanel.bind(this);
        this.openInlineExamples = this.openInlineExamples.bind(this);
        this._boxRef = React.createRef();
        this._measureBox = this._measureBox.bind(this);
        this.handleDeclarationChange = this.handleDeclarationChange.bind(this);
        this.handleCircuitEdit = this.handleCircuitEdit.bind(this);
        this.handleProjectStart = this.handleProjectStart.bind(this);
        this.handleSimulationStart = this.handleSimulationStart.bind(this);
        this.handleVmProjectStart = this.handleVmProjectStart.bind(this);
        this.handleVmStopAll = this.handleVmStopAll.bind(this);
        this.handleRunnerGone = this.handleRunnerGone.bind(this);
        this.handleProjectStop = this.handleProjectStop.bind(this);
        this.handleProjectChanged = this.handleProjectChanged.bind(this);
        this.handleCpxState = this.handleCpxState.bind(this);
        this._circuitFileWake = this._circuitFileWake.bind(this);
        // The File-menu action waiting for the designer to exist, or null. Not
        // state: replaying it must not itself schedule a render.
        this._circuitFilePending = null;
        this._circuitFileReplayFrame = null;
        // The benchmark installs this before application boot. It remains null
        // for ordinary production sessions, so source attribution has neither
        // trace allocation nor a changing prop identity outside the receipt.
        this._performanceProbe = getReactPerformanceProbe();
    }

    _markReactUpdate (source, detail) {
        if (this._performanceProbe) this._performanceProbe.mark(source, detail);
    }

    /** A cached component module is not necessarily a mounted File receiver. */
    _circuitFileWake (e) {
        const detail = (e && e.detail) || {};
        if (detail.bwReplay || this.state.error || this._boxRef.current) return;
        if (!['load', 'save', 'import', 'export'].includes(detail.action)) return;
        this._circuitFilePending = detail.action;
        // The hidden view may have unmounted before its debounced autosave.
        // Preserve the last real host-owned circuit, rather than rebuilding a
        // starter or replaying an older example when the receiver remounts.
        const circuit = this.state.circuit;
        if (circuit && typeof circuit.toJSON === 'function') {
            this.setState({circuitData: circuit.toJSON()});
        }
        this.props.onShowCircuit?.();
        this.load({explicit: true});
    }

    _replayCircuitFile () {
        if (!this._boxRef.current || !this._circuitFilePending || this._circuitFileReplayFrame != null) return;
        // Wait for the mounted designer's effects to register the upstream
        // command channel. Repeated host updates must not schedule duplicates.
        this._circuitFileReplayFrame = requestAnimationFrame(() => {
            this._circuitFileReplayFrame = null;
            if (!this._boxRef.current) return;
            const action = this._circuitFilePending;
            this._circuitFilePending = null;
            window.dispatchEvent(new CustomEvent(
                'bw-circuit-file', {detail: {action, bwReplay: true}}));
        });
    }

    componentDidMount () {
        this._couplingHandler = event => {
            const {board, owner, signal, ready, reject} = event.detail || {};
            if (board && signal?.aborted) { reject?.(new Error('Circuit clock request was cancelled')); return; }
            if (board && this.props.vm?.runtime?.bwRunBoard) { reject?.(new Error('Stop the circuit debugger first')); return; }
            const identity = owner || board;
            if (board && this._coupledOwner && this._coupledOwner !== identity) {
                reject?.(new Error('The Circuit clock already has an owner')); return;
            }
            if (!board && this._coupledOwner &&
                (owner ? this._coupledOwner !== owner : this._coupledOwner !== this._coupledBoard)) return;
            this._coupledOwner = board ? identity : null;
            this._coupledBoard = board || null;
            this.setState({board: board || null, cadCircuitRequested: false}, () => setTimeout(() => {
                // A cancelled acquisition cannot acknowledge a newer owner.
                if (board && (this._coupledOwner !== identity || signal?.aborted)) return;
                ready?.();
            }, 0));
        };
        this._couplingOpen = () => {this.setState({cadCircuitRequested: true});this.load({explicit: true});};
        window.addEventListener('bw-circuit-clock-owner', this._couplingHandler);
        window.addEventListener('bw-circuit-ensure-ready', this._couplingOpen);
        this._menuMounted = true;
        this._designerMenuActions = [];
        this.unregisterMenu = registerEditorMenuActions('circuit', () => this.editorMenuActions());
        this.subscribeCpxRuntime(this.props.vm?.runtime);
        // The Designer's own ↶ / ↷ buttons run its undo and redo (they also
        // refresh its view); the model's history (bw-circuit-ui model/history.js)
        // says how many steps each way there are.
        const history = () => this.props.vm?.runtime?.circuitModel?.history;
        const depth = () => {
            const h = history();
            if (h && typeof h._cursor === 'number' && typeof h.length === 'number') {
                return {undo: Math.max(0, h._cursor), redo: Math.max(0, h.length - 1 - h._cursor)};
            }
            return {undo: this._findUndoButton() ? 1 : 0, redo: this._findHistoryButton('↷') ? 1 : 0};
        };
        const press = symbol => {
            const button = this._findHistoryButton(symbol);
            if (!button) return false;
            button.click();
            return true;
        };
        this._unregisterUndo = registerUndoSurface('circuit', {
            label: 'Circuit',
            canUndo: () => depth().undo > 0,
            canRedo: () => depth().redo > 0,
            depth,
            // The history coordinator names these steps (lib/bw-circuit-step-names.js).
            snapshots: () => {
                const h = history();
                return h && Array.isArray(h._stack) ? {stack: h._stack, cursor: h._cursor} : null;
            },
            undo: () => press('↶'),
            redo: () => press('↷')
        });
        if (this.props.isVisible) {
            activateUndoSurface('circuit');
            this.load();
        }
        window.addEventListener('resize', this._measureBox);
        // The File menu's four circuit actions (menu-bar.jsx) dispatch
        // `bw-circuit-file`, and the RECEIVER is bw-circuit-ui's CircuitDesigner,
        // which lite mounts LAZILY: `load()` runs only once this tab is visible or
        // portalled into the stage column. On a session where the Circuit tab has
        // never been opened there was no listener at all, so Open / Save / Import /
        // Export circuit did nothing, said nothing and logged nothing — the exact
        // shape of the dead "Diagram (.json)" button bw-circuit-ui 1397493 deleted.
        // This listener is registered unconditionally and only acts while the
        // designer is absent: it starts the load and replays the action once the
        // receiver exists, so the menu reaches the feature from a cold start.
        window.addEventListener('bw-circuit-file', this._circuitFileWake);
        // The FPGA tab's "wire up a demo board" builds a circuit into the live
        // model, but the designer re-renders only on its own edits or a fresh
        // circuitData prop — so it hands us the built circuit's JSON and we LOAD
        // it, the same path a saved circuit takes (re-renders + applies live).
        this._loadCircuitData = async event => {
            const {data, asmBlinkReady} = event?.detail || {};
            if (!data || !Array.isArray(data.parts)) return;
            if (asmBlinkReady) {
                event.preventDefault();
                try {
                    await this.load({explicit: true});
                    const board = await new Promise((resolve, reject) => {
                        const expected = data.parts.filter(part => part.kind !== 'breadboard');
                        const done = () => {
                            window.removeEventListener('bw-board-ready', ready);
                            clearTimeout(timeout);
                        };
                        const ready = () => {
                            const live = this.props.vm?.runtime;
                            const board = live?.circuitBoard;
                            if (!live?.circuitModel || !board || !expected.every(part =>
                                board.getParts().some(placed => placed.id === part.id))) return;
                            done();
                            resolve(board);
                        };
                        const timeout = setTimeout(() => {
                            done();
                            reject(new Error('The example circuit could not be loaded'));
                        }, 15000);
                        window.addEventListener('bw-board-ready', ready);
                        this.setState({circuitData: data, panel: 'designer'}, ready);
                    });
                    asmBlinkReady.resolve(board);
                } catch (error) {
                    asmBlinkReady.reject(error);
                }
                return;
            }
            this._markReactUpdate('host:fpga-demo');
            this.setState({circuitData: data});
            if (typeof this._applyToLiveCircuit === 'function') this._applyToLiveCircuit(data);
        };
        window.addEventListener('bw-load-circuit-data', this._loadCircuitData);
        // Project save/load carries the Circuit and Widgets tabs through the
        // .sb3 bundle (lib/bw-project-bundle.js). COLLECT: flush the LIVE
        // state into the bundle's keys before the save reads them — the
        // autosave only updates on an edit, so an untouched example saved
        // the previous bench. LOADED: the restored keys are in localStorage
        // but a mounted tab shows its old content; hand the circuit to the
        // Designer as fresh circuitData (it loads any new prop reference)
        // and rebuild the controller panel in place (listeners keep refs).
        this._onBundleCollect = () => {
            try {
                const rt = this.props.vm && this.props.vm.runtime;
                const m = rt && rt.circuitModel;
                if (m && typeof m.toJSON === 'function') {
                    localStorage.setItem('bw-circuit-autosave', JSON.stringify(m.toJSON()));
                }
                const p = rt && rt.controllerPanel;
                if (p && typeof p.toJSON === 'function') {
                    if (p.getWidgetNames().length) {
                        localStorage.setItem('bw-ctl-widgets', JSON.stringify(serializeControllerPanel(p)));
                    } else {
                        localStorage.removeItem('bw-ctl-widgets');
                    }
                }
            } catch (e) { /* the Scratch half of the save must survive this */ }
        };
        window.addEventListener('bw-project-bundle-collect', this._onBundleCollect);
        // vm.runtime.circuitModel is read by a RUNNING program — bw-debug's
        // debug-runner and the circuit VM extension both resolve the board
        // through it — so it is not the Designer's private state. But it is
        // ASSIGNED by the Designer, once, from onCircuitReady, and the Designer
        // is not always mounted: render() returns early with two portals when
        // the debugger is docked 'right' (the DEFAULT) or 'solo' while the Code
        // tab is active, and <Designer> is then absent from the returned tree.
        // Its circuitData effect cannot run, and the reference outlives it.
        //
        // Measured 2026-09-02 in a real browser against a production build, with
        // an ordered localStorage/event trace. Opening a vanilla .sb3 while the
        // Circuit tab was active: two `SET bw-circuit-file-loaded` (this handler
        // AND the Designer effect) and `ASSIGN parts len=6`. Opening one while
        // the Code tab was active: ONE set, no assign — the effect never ran and
        // vm.runtime.circuitModel kept the previous project's six parts
        // (breadboard, vcc, gnd, mcu, resistor, led) after every localStorage
        // key, the code buffer and the widgets had cleared.
        //
        // So a learner who opens a fresh project from the Code tab and presses
        // the green flag drives the PREVIOUS project's board. That is the
        // one-board-one-truth law in bw-setup.md, and clicking the Circuit tab
        // before reading would only hide it. Replacement applies HERE, in a
        // window listener that runs whatever the render branch is doing.
        this._applyToLiveCircuit = data => {
            const rt = this.props.vm && this.props.vm.runtime;
            const model = rt && rt.circuitModel;
            if (!model || !data || !Array.isArray(data.parts)) return;
            try {
                if (!data.parts.length && !(data.wires && data.wires.length)) {
                    // Emptying needs no parser, so replacement stays atomic even
                    // before the bw-circuit-ui chunk has ever been fetched.
                    model.vcc = data.vcc === undefined ? 5 : data.vcc;
                    model.parts.length = 0;
                    model.wires.length = 0;
                    if (model.breadboards && typeof model.breadboards.clear === 'function') {
                        model.breadboards.clear();
                    }
                } else if (this._Circuit) {
                    const parsed = this._Circuit.fromJSON(data);
                    model.vcc = parsed.vcc;
                    model.parts = parsed.parts;
                    model.wires = parsed.wires;
                    model.breadboards = parsed.breadboards;
                } else {
                    // No chunk yet means no Designer has ever run, so nothing has
                    // published a model to be stale — leave it to seed on mount.
                    return;
                }
                if (typeof model._syncNetlist === 'function') model._syncNetlist();
                // Publish hidden replacements through the same authority/event
                // as Designer.onBoardReady, so runtime widget bindings follow.
                rt.circuitBoard = model.board;
                if (typeof window !== 'undefined') {
                    window.__board = model.board;
                    window.dispatchEvent(new CustomEvent('bw-board-ready'));
                }
            } catch (e) {
                console.warn('[brickwright] could not apply the loaded circuit to the live model', e);
            }
        };
        this._onBundleLoaded = event => {
            // A refused future or invalid sidecar leaves the current project
            // untouched. Its announcement is for the refusal notice only.
            if (['future', 'invalid', 'storage-failed'].includes(event?.detail?.outcome)) return;
            try {
                const raw = localStorage.getItem('bw-circuit-autosave');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    try { localStorage.setItem('bw-circuit-file-loaded', '1'); } catch (e) { /* full */ }
                    this._markReactUpdate('host:circuit-data');
                    this.setState({circuitData: parsed});
                    this._applyToLiveCircuit(parsed);
                    const cp1 = this.activateCp1Circuit(parsed);
                    const cardiacPart = parsed.parts?.find(part => part.kind === 'cardiac');
                    if (cp1) {
                        setCardiacWorkspaceActive(localStorage, false);
                        this.showControllerDock();
                    } else if (cardiacPart) this.activateCardiac(cardiacPart.id);
                    else if (readCardiacWorkspaceActive(localStorage)) this.activateCardiac();
                    else this._onCardiacCodeSelection({detail: {active: false}});
                } else if (event?.detail?.outcome === 'legacy' || event?.detail?.outcome === 'loaded') {
                    try { localStorage.setItem('bw-circuit-file-loaded', '1'); } catch (e) { /* full */ }
                    const emptied = {version: 1, parts: [], wires: []};
                    this._markReactUpdate('host:circuit-data');
                    this.setState({circuitData: emptied});
                    this._applyToLiveCircuit(emptied);
                    this.activateCp1Circuit(emptied);
                    if (readCardiacWorkspaceActive(localStorage)) this.activateCardiac();
                    else this._onCardiacCodeSelection({detail: {active: false}});
                }
                // The GUI owns project Widgets restoration, including when Circuit is hidden.
            } catch (e) {
                console.warn('[brickwright] restoring the loaded project\'s tabs failed', e);
            }
        };
        window.addEventListener('bw-project-bundle-loaded', this._onBundleLoaded);
        // The stage-hiding CSS lives here rather than in a stylesheet because
        // the wrapper's class is a hashed CSS-module name; the attribute-
        // contains selector survives rebuilds.
        if (!document.getElementById('bw-layout-style')) {
            const st = document.createElement('style');
            st.id = 'bw-layout-style';
            st.textContent = 'html[data-bw-hide-stage] div[class*="stage-and-target-wrapper"] div[class*="stage-canvas-wrapper"],html[data-bw-hide-stage] div[class*="stage-and-target-wrapper"] div[class*="target-wrapper"]{display:none !important} html[data-bw-hide-stage] div[class*="stage-and-target-wrapper"] div[class*="stage-wrapper"]{position:relative;z-index:3;background:transparent !important} details > summary::-webkit-details-marker{display:none} details > summary::marker{content:""}';
            document.head.appendChild(st);
        }
        this._syncStageAttr();
        this._ensureStageHost();
        this._settingsHandler = event => {
            const {key, value} = event.detail || {};
            if (key === 'about') return;
            if (key === 'debugDock' || key === 'bw-debug-dock') {
                this.setDock(value);
                // A right-docked debugger (or a controller faceplate) is a
                // request to USE the optional right pane. gui.jsx opens its
                // column on this same event — but this tab keeps its own
                // rightPaneHidden, and _syncStageAttr re-nones the stage
                // wrapper from that stale flag on EVERY update. Since the
                // dock's portal host is a CHILD of that wrapper, the whole
                // dock — debugger, serial console, input line — was
                // display:none while every existence probe still passed
                // (the browser gate's :visible click caught it).
                if (value === 'right' || DEVICE_DOCKS.has(value)) {
                    try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
                    this.setState({rightPaneHidden: false});
                }
                // Stage-header view changes can arrive while this tab is still
                // mounted but not selected. Request the designer here too;
                // otherwise the portal host is visible before its content has
                // ever been loaded and the user sees a blank debugger pane.
                //
                // EVERY dock, not just 'top' and 'solo'. 'right' and 'off' live
                // INSIDE the designer's tree, so they need it loaded more than
                // 'solo' does (which renders the panel on its own) — and they
                // were the two values excluded from this call. Settings →
                // Workspace → Debugger → Right, from any tab but Circuit, left
                // the portal host displayed and empty: the blank pane the owner
                // reported, and the same blank the Scratch stage showed on a
                // fresh load before anyone had opened the Circuit tab.
                if (this.state.showInStage) this.load();
            }
            if (key === 'stageCircuit' || key === 'bw-stage-circuit') {
                this.setDisplayPreference('showInStage', value === '1');
                if (value === '1') this.load();
            }
            if (key === 'hideStage' || key === 'bw-hide-stage') {
                // The Code-mode circuit is rendered into the normal stage column.
                // Hide only Scratch-stage children; the portal is explicitly
                // exempted by data-bw-circuit-stage-host and remains visible.
                try { localStorage.setItem('bw-hide-stage', value === '1' ? '1' : '0'); } catch { /* private mode */ }
                this.setDisplayPreference('hideStage', value === '1');
            }
            if (key === 'bw-right-pane-hidden') {
                try { localStorage.setItem('bw-right-pane-hidden', value === '1' ? '1' : '0'); } catch { /* private mode */ }
                this.setState({rightPaneHidden: value === '1'});
            }
            if (key === 'bw-device-id' && value !== 'cardiac') {
                this._onCardiacCodeSelection({detail: {active: false}});
            }
            if (key === 'bw-device-id' && value !== 'cp1' && value !== 'kosmos-cp1') {
                this._onCp1CodeSelection({detail: {active: false}});
            }
            if (key === 'bw-circuit-theme') {
                try { localStorage.setItem('bw-circuit-theme', value); } catch { /* private mode */ }
                // CircuitDesigner owns the visual theme; forward the same
                // setting event so an already-mounted designer updates now.
            }
        };
        window.addEventListener('bw-settings-change', this._settingsHandler);
        // The first-run chooser is global, but this tab owns the canonical
        // examples loader. forceRenderTabPanel keeps this listener alive even
        // when a starter ultimately opens the Code tab (the LEGO journey).
        this._starterJourneyHandler = event => this.loadStarterJourney(event);
        window.addEventListener('bw-start-journey', this._starterJourneyHandler);
        // Machine bench: Build Machine dispatches this when the bus extractor
        // succeeds. The DebugPanel needs to render even without declared pins
        // so the user can load a program and run the machine. The detail is
        // ALSO stashed on window: the DebugPanel mounts lazily BECAUSE of
        // this event, so its own listener structurally cannot have heard the
        // first one — it replays the stash on mount. Same for a program
        // delivered (preset / file / ASM) before the panel finished mounting.
        this._machineExtractedHandler = e => {
            if (window.__bwMachineExtracted?.kind === 'cardiac' && e?.detail?.kind !== 'cardiac') {
                setCardiacWorkspaceActive(localStorage, false);
                const runtime = this.props.vm?.runtime;
                if (runtime?.bwDeviceCore === 'cardiac') runtime.bwDeviceCore = this._cardiacNormalCore;
                this._cardiacNormalCore = undefined;
            }
            window.__bwMachineExtracted = e && e.detail;
            if (e.detail?.clearLoadedMedia) delete window.__bwPendingMedia;
            this._markReactUpdate('host:machine-booted');
            this.setState({machineBooted: true});
        };
        window.addEventListener('bw-machine-extracted', this._machineExtractedHandler);
        window.addEventListener('bw-cp1-code-selection', this._onCp1CodeSelection);
        window.addEventListener('bw-cardiac-code-selection', this._onCardiacCodeSelection);
        window.addEventListener('bw-cardiac-run-request', this._onCardiacRunRequest);
        window.addEventListener('bw-cardiac-open', this._onCardiacOpen);
        window.addEventListener('bw-cardiac-program-loaded', this._onCardiacProgramLoaded);
        window.addEventListener('bw-cp1-circuit-detached', this._restoreCp1Dock);
        this._mediaStashHandler = e => {
            const detail = e?.detail;
            const previous = window.__bwPendingMedia?.detail;
            window.__bwPendingMedia = {type: 'media', detail};
            if (detail !== previous) {
                if (detail?.machineView === 'debugger') showCircuitDebugger();
                if (detail?.machineView === 'controller') setCircuitView({fullWidth: false, dock: 'controller'});
            }
            this._markReactUpdate('host:machine-booted');
            this.setState({machineBooted: true});
        };
        window.addEventListener('bw-machine-media-load', this._mediaStashHandler);
        this._asmStashHandler = e => {
            window.__bwPendingMedia = {type: 'asm', detail: e && e.detail};
            this._markReactUpdate('host:machine-booted');
            this.setState({machineBooted: true});
        };
        window.addEventListener('bw-asm-rom-ready', this._asmStashHandler);
        if (window.__bwPendingMedia) {
            this._markReactUpdate('host:machine-booted');
            this.setState({machineBooted: true});
        }
        // Code-tab catalog loads name the bench for the chosen device; the
        // board must show THAT wiring and seating, not the authored default
        // and never the runner's inferred fallback.
        this._benchHandler = async (e) => {
            const {benchPath, exampleId, device} = (e && e.detail) || {};
            if (!benchPath) return;
            try {
                const res = await fetch(`examples/${benchPath}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                // Generated benches carry {parts, nets}; authored circuits
                // carry {parts, wires}. The designer accepts both (its
                // loader feeds nets to syncWithExternalNets directly).
                if (!data || !Array.isArray(data.parts) ||
                    !(Array.isArray(data.wires) || Array.isArray(data.nets))) {
                    throw new Error('not a circuit (no parts with wires or nets)');
                }
                this._markReactUpdate('host:circuit-data');
                // Keep the file's wiring through designer inference. Sim can
                // still run the loaded program when it matches this device.
                this.setState({circuitData: {...data, fileOnly: true, catalogProgramDevice: normalizeDeviceId(device)},
                    loadingExample: null, examplesError: null});
            } catch (err) {
                this.setState({examplesError:
                    `bench for "${exampleId}": ${err.message}`});
            }
        };
        window.addEventListener('bw-example-bench', this._benchHandler);
        this._openMachineExample = event => {
            const {example, complete} = event.detail || {};
            if (!example?.files?.rom || typeof complete !== 'function') return;
            event.preventDefault();
            this.loadExample(example, {activateCircuit: true})
                .then(complete, error => complete({ok: false, error: error.message}));
        };
        window.addEventListener('bw-open-wired-machine-example', this._openMachineExample);
        // The Scratch controls dispatch these user-level events even when the
        // VM has no executable MCU program. Keep the designer simulation in
        // lockstep with Green Flag/Red Flag in that case too.
        this._greenFlagHandler = this.handleProjectStart;
        this._stopAllHandler = this.handleProjectStop;
        window.addEventListener('bw-green-flag', this._greenFlagHandler);
        window.addEventListener('bw-stop-all', this._stopAllHandler);
        // Power off in the designer = MCU loses power = runner stops.
        this._powerOffHandler = this.handleProjectStop;
        window.addEventListener('bw-power-off', this._powerOffHandler);
        const runtime = this.props.vm && this.props.vm.runtime;
        if (runtime && runtime.on) {
            runtime.on('PROJECT_START', this.handleVmProjectStart);
            runtime.on('PROJECT_STOP_ALL', this.handleVmStopAll);
            // "To blocks" in the Code tab lands fresh pin declarations on
            // runtime.stc and announces them with PROJECT_CHANGED — but until
            // this subscription existed, nothing here re-read them: the
            // portalled debugger (any dock, and 'solo' most visibly, since it
            // is nothing BUT the debugger) kept the previous project's pins
            // until some view toggle happened to call load().
            runtime.on('PROJECT_CHANGED', this.handleProjectChanged);
        }
    }

    _findHistoryButton = symbol => this._boxRef.current && Array.from(
        this._boxRef.current.querySelectorAll('button')
    ).find(button => button.textContent.trim() === symbol)

    _findUndoButton = () => this._findHistoryButton('↶')

    componentDidUpdate (prevProps, prevState) {
        if (prevProps.isVisible !== this.props.isVisible || prevProps.locale !== this.props.locale ||
            prevState.panel !== this.state.panel) notifyEditorMenuActions();
        if (prevProps.vm?.runtime !== this.props.vm?.runtime) this.subscribeCpxRuntime(this.props.vm?.runtime);
        if (this.props.isVisible && !prevProps.isVisible) activateUndoSurface('circuit');
        // Hiding the tab can unmount the Designer (debugger docked right/solo) and
        // cancel its debounced autosave, so re-entering restored an older circuit.
        // Flush that autosave instead: the same key and rule as bw-circuit-ui's
        // (non-empty circuits only), from the Designer that was actually mounted.
        // Host circuitData is untouched, so a bench delivered while hidden wins.
        // The record must be bw-circuit-ui's own (lib/circuit-autosave-record.js):
        // a differently shaped record for the same circuit made opening a project
        // with a refused sidecar rewrite the known circuit (task I5).
        if (prevProps.isVisible && !this.props.isVisible && !this._boxRef.current && this._designerShown) {
            const record = circuitAutosaveRecord(this.state.circuit, readCircuitOwner(localStorage));
            if (record !== null) {
                try { localStorage.setItem('bw-circuit-autosave', record); } catch (e) { /* storage blocked */ }
            }
        }
        this._designerShown = Boolean(this.props.isVisible && this._boxRef.current);
        // The event that opens this lazily rendered bench can precede the
        // DebugPanel listener in the same React commit. Replay the retained
        // image after that commit; the transition guard prevents a loop when
        // this component's own stash listener observes the replay.
        if (prevState && !prevState.machineBooted && this.state.machineBooted &&
            window.__bwPendingMedia) {
            const pending = window.__bwPendingMedia;
            requestAnimationFrame(() => window.dispatchEvent(new CustomEvent(
                pending.type === 'asm' ? 'bw-asm-rom-ready' : 'bw-machine-media-load',
                {detail: pending.detail})));
        }
        // The receiver can remount while its component module stays cached.
        this._replayCircuitFile();
        // TitledHOC resets the title to “BrickWright Project” when the
        // load/create state settles. Publish an example's name after that
        // transition, rather than racing it immediately after vm.loadProject.
        if (this.state.pendingExampleTitle && prevProps.isProjectCreating &&
            !this.props.isProjectCreating) {
            this.props.onSetProjectTitle(this.state.pendingExampleTitle);
            this.setState({pendingExampleTitle: null});
        }
        this._measureBox();
        if (this.props.isVisible && !prevProps.isVisible) {
            this.load();
            // Re-entering Circuit is the final synchronization point: its
            // persistent debugger is now committed and visible. Re-deliver
            // the retained image so a handoff made while Code owned the tab
            // cannot be stranded in an older hidden panel instance.
            const pending = window.__bwPendingMedia;
            if (pending) {
                requestAnimationFrame(() => window.dispatchEvent(new CustomEvent(
                    pending.type === 'asm' ? 'bw-asm-rom-ready' : 'bw-machine-media-load',
                    {detail: pending.detail})));
            }
        }
        this._syncStageAttr();
        this._ensureStageHost();
        // The host is created outside React's tree. When the Code tab becomes
        // active, render once more after that host exists so the circuit is
        // actually portalled into the right pane instead of leaving a blank
        // stage after returning from the dedicated Circuit tab.
        const portalNow = this._stagePortalOn();
        if (portalNow !== !!this._portalOn && !this._portalRefreshQueued) {
            this._portalRefreshQueued = true;
            this._markReactUpdate('host:portal-refresh');
            this.setState({});
            Promise.resolve().then(() => { this._portalRefreshQueued = false; });
        }
        // The event above covers a dock CHANGE; this covers every other way the
        // portal turns on — a dock persisted in localStorage, a tab switch, the
        // host appearing after the first render. The host is the stage column
        // while coding, so if it is going to be shown, its content has to exist.
        if (shouldLoadCircuitDesigner({
            isVisible: this.props.isVisible,
            portalOn: portalNow,
            debugDock: this.state.debugDock
        }) && !this.state.Designer && !this.loading &&
            !this.state.error && !this.state.reloading) {
            this.load();
        }
        if (this._stageHost) {
            // Never show an EMPTY host. It is an opaque white overlay pinned
            // over the stage column: displayed with nothing portalled into it,
            // it does not read as "still loading", it reads as a blank pane —
            // which is exactly what a fresh editor showed where the Scratch
            // stage should be, and what dock 'right' showed instead of the
            // debugger. _portalRendered is set by render at the points where
            // it actually returns a portal, so this can never drift from it.
            const rightHere = this.props.isVisible && this.state.showInStage &&
                this.state.debugDock === 'right' && this._stageRightRendered;
            this._stageHost.style.display =
                (portalNow && this._portalRendered) || rightHere ? 'block' : 'none';

        }
    }

    /** The tab panel gives height:100% nothing definite to resolve
     *  against, so the designer sat at its 700x500 MINIMUM in any window
     *  ("does not use the screen size", owner, roughly the tenth time).
     *  Measure where the box actually starts and claim the rest of the
     *  viewport explicitly. */
    _measureBox () {
        this._sizeStageHost();
        const el = this._boxRef.current;
        if (!el || this._portalOn) return;
        const r = el.getBoundingClientRect();
        const top = Math.round(r.top);
        const left = Math.round(r.left);
        if (Math.abs((this.state.boxTop ?? -99) - top) > 1 ||
            Math.abs((this.state.boxLeft ?? -99) - left) > 1) {
            if (this._performanceProbe) this._markReactUpdate('host:box-measure', {top, left});
            this.setState({boxTop: top, boxLeft: left});
        }
    }

    componentWillUnmount () {
        this.galleryArtworkRequest = null;
        this._coupledOwner?.stop?.();
        this._coupledOwner = null;
        this._coupledBoard = null;
        window.removeEventListener('bw-circuit-clock-owner', this._couplingHandler);
        window.removeEventListener('bw-circuit-ensure-ready', this._couplingOpen);
        this.releaseEsp32S040Input();
        this._menuMounted = false;
        this._designerMenuActions = [];
        if (this.unregisterMenu) this.unregisterMenu();
        this._cpxRuntime?.removeListener('CPX_STATE', this.handleCpxState);
        this._cpxInputs?.release();
        this._cpxInputs = null;
        this._cpxRuntime = null;
        if (this._unregisterUndo) this._unregisterUndo();
        cancelAnimationFrame(this._hostResizeFrame);
        cancelAnimationFrame(this._circuitFileReplayFrame);
        this._circuitFileReplayFrame = null;
        this._circuitFilePending = null;
        if (this._hostRO) { this._hostRO.disconnect(); this._hostRO = null; }
        window.removeEventListener('resize', this._measureBox);
        window.removeEventListener('bw-circuit-file', this._circuitFileWake);
        window.removeEventListener('bw-load-circuit-data', this._loadCircuitData);
        window.removeEventListener('bw-project-bundle-collect', this._onBundleCollect);
        window.removeEventListener('bw-project-bundle-loaded', this._onBundleLoaded);
        window.removeEventListener('bw-settings-change', this._settingsHandler);
        window.removeEventListener('bw-start-journey', this._starterJourneyHandler);
        window.removeEventListener('bw-machine-extracted', this._machineExtractedHandler);
        window.removeEventListener('bw-cp1-code-selection', this._onCp1CodeSelection);
        window.removeEventListener('bw-cardiac-code-selection', this._onCardiacCodeSelection);
        window.removeEventListener('bw-cardiac-run-request', this._onCardiacRunRequest);
        window.removeEventListener('bw-cardiac-open', this._onCardiacOpen);
        window.removeEventListener('bw-cardiac-program-loaded', this._onCardiacProgramLoaded);
        window.removeEventListener('bw-cp1-circuit-detached', this._restoreCp1Dock);
        window.removeEventListener('bw-machine-media-load', this._mediaStashHandler);
        window.removeEventListener('bw-asm-rom-ready', this._asmStashHandler);
        window.removeEventListener('bw-example-bench', this._benchHandler);
        window.removeEventListener('bw-open-wired-machine-example', this._openMachineExample);
        window.removeEventListener('bw-green-flag', this._greenFlagHandler);
        window.removeEventListener('bw-stop-all', this._stopAllHandler);
        window.removeEventListener('bw-power-off', this._powerOffHandler);
        const runtime = this.props.vm && this.props.vm.runtime;
        if (runtime && runtime.removeListener) {
            runtime.removeListener('PROJECT_START', this.handleVmProjectStart);
            runtime.removeListener('PROJECT_STOP_ALL', this.handleVmStopAll);
            runtime.removeListener('PROJECT_CHANGED', this.handleProjectChanged);
        }
        document.documentElement.removeAttribute('data-bw-hide-stage');
        const oldWrap = document.querySelector('div[class*="stage-and-target-wrapper"]');
        if (oldWrap) oldWrap.style.display = '';
        if (this._stageHost && this._stageHost.parentNode) {
            this._stageHost.parentNode.removeChild(this._stageHost);
        }
    }

    subscribeCpxRuntime (runtime) {
        this._cpxRuntime?.removeListener('CPX_STATE', this.handleCpxState);
        this._cpxInputs?.release();
        this._cpxRuntime = runtime || null;
        this._cpxInputs = this.createCpxInputs(this._cpxRuntime);
        this.setState({handleCpxInput: runtime ? this._cpxInputs.input : null});
        this._cpxRuntime?.on('CPX_STATE', this.handleCpxState);
        this.handleCpxState(this._cpxRuntime?.bwCpxState || null);
    }

    createCpxInputs (runtime) {
        // A mounted face keeps its input sink even if the host changes VM.
        // Retire that sink and release only presses originating on this face.
        const held = new Map();
        let active = true;
        return {
            input: input => {
                let board = runtime?.bwCpx;
                if (!active || !input) return;
                if ((input.button === 'A' || input.button === 'B') && typeof input.down === 'boolean') {
                    if (input.down) {
                        if (!board || held.has(input.button)) return;
                        held.set(input.button, board);
                    } else {
                        board = held.get(input.button);
                        if (!board) return;
                        held.delete(input.button);
                    }
                    board.setButton(input.button, input.down);
                } else if (board && typeof input.switchRight === 'boolean') {
                    board.setSwitch(input.switchRight);
                }
            },
            release: () => {
                active = false;
                const pending = [...held];
                held.clear();
                for (const [button, board] of pending) board.setButton(button, false);
            }
        };
    }

    handleCpxState (next) {
        // Sensor/audio-only publications must not redraw the entire designer.
        // Retain the original snapshot; the runtime remains its sole owner.
        this.setState(previous => {
            const old = previous.cpxState;
            if (old === next) return null;
            if (old && next && old.switchRight === next.switchRight && old.redLed === next.redLed &&
                old.buttons?.A === next.buttons?.A && old.buttons?.B === next.buttons?.B) {
                let same = true;
                for (let i = 0; i < 10; i++) {
                    if (old.shown?.[i] !== next.shown?.[i]) {
                        same = false;
                        break;
                    }
                }
                if (same) return null;
            }
            return {cpxState: next};
        });
    }

    setDock (d) {
        if (!CIRCUIT_DOCKS.has(d) && !DEVICE_DOCKS.has(d)) return;
        this.setState({debugDock: d});
        try { localStorage.setItem('bw-debug-dock', d); } catch { /* private mode */ }
    }

    setDisplayPreference (key, value) {
        this.setState({[key]: value});
        const storageKey = key === 'showInStage' ? 'bw-stage-circuit' : 'bw-hide-stage';
        try { localStorage.setItem(storageKey, value ? '1' : '0'); } catch { /* private mode */ }
    }

    publishExampleTitle (example) {
        const titles = example && example.title;
        const locale = String(this.props.locale || 'en').slice(0, 2);
        const title = typeof titles === 'string' ? titles :
            (titles && (titles[locale] || titles.en || titles.de)) || example.id;
        if (this.props.isProjectCreating) this.setState({pendingExampleTitle: title});
        else if (this.props.onSetProjectTitle) this.props.onSetProjectTitle(title);

        // WHICH example is active, published for everyone who needs to know.
        //
        // Two defects came from nobody being told. (1) The Code tab's setDevice
        // already resolves the matching bench and REFUSES a device the example
        // has no circuit for — but only `if (this._lastCatalogExample)`, which
        // the importer sets solely on its own catalogue path. An example loaded
        // from THIS browser left that null, so picking a device afterwards
        // retargeted the program with no bench check at all and the authored
        // board stayed under it: an STC89 program on an STC12 board (owner,
        // 2026-09-07). (2) The project name is overwritten with the example's
        // title, and nothing said which example that name came from.
        //
        // The event carries what both consumers need: `id` doubles as the
        // intro's directory (examples/<id>/intro.md), and devices/benches/files
        // are what resolveExampleBench reads.
        if (typeof window !== 'undefined' && example && example.id) {
            const detail = {
                id: example.id, title,
                devices: example.devices, benches: example.benches,
                files: example.files, authored: example.authored,
                kind: example.kind, category: example.category
            };
            window.__bwActiveExample = detail;
            window.dispatchEvent(new CustomEvent('bw-example-loaded', {detail}));
        }
    }

    handleProjectStart (event) {
        if (this._coupledBoard) return;
        this.setState(state => ({runToken: (state.runToken || 0) + 1,
            runMachineOnFlag: event?.detail?.runMachine !== false}));
    }

    handleSimulationStart () {
        const {vm} = this.props;
        const {stc, circuitData, machineBooted} = this.state;
        const device = vm?.runtime?.bwDeviceId || stc?.device;
        const programBench = circuitData?.catalogProgramDevice &&
            circuitData.catalogProgramDevice === normalizeDeviceId(device);
        if (!vm || this._coupledBoard || machineBooted || (circuitData?.fileOnly && !programBench) ||
            !stcDrives(stc) || device === 'microbit' || device === 'calliopemini') {
            this.handleProjectStart();
            return;
        }
        // This button originates the run. The Circuit and Debugger listeners
        // observe the flag, while the VM executes the blocks on the visible board.
        vm.start();
        window.dispatchEvent(new CustomEvent('bw-green-flag'));
        vm.greenFlag();
    }

    handleProjectStop () {
        if (this._coupledBoard) return;
        this.setState(state => ({stopToken: (state.stopToken || 0) + 1}));
    }

    /**
     * The VM's own stop. vm.greenFlag() calls stopAll() FIRST, so a green
     * flag emits PROJECT_STOP_ALL and then PROJECT_START in one synchronous
     * call. Relayed as a user stop, that bumped stopToken beside the start's
     * runToken, and the designer applies the two in effect order: simulate,
     * then build. Until task B7 the `bw-green-flag` event arrived LAST (on a
     * setTimeout) and set simulate again; now that it goes out first — the
     * designer's clear must precede the program — the stop token would be the
     * last word and every green flag would leave the designer in build mode,
     * its clock stopped. A VM stop that a start follows in the same call is a
     * restart: it is held for a microtask and dropped if the start arrives.
     */
    handleVmStopAll () {
        this._vmStopPending = true;
        Promise.resolve().then(() => {
            if (!this._vmStopPending) return;
            this._vmStopPending = false;
            this.handleProjectStop();
        });
    }

    handleVmProjectStart () {
        this._vmStopPending = false;
        this.handleProjectStart();
    }

    /** Re-read runtime.stc when the project changes (e.g. "To blocks" landed
     *  new pin declarations). Reference-compare first: PROJECT_CHANGED also
     *  fires for block edits that leave stc untouched. */
    handleProjectChanged () {
        const next = this.readStc();
        if (next !== this.state.stc) this.setState({stc: next});
    }

    /** The overlay div inside the stage column that hosts the portal. Created
     *  lazily OUTSIDE render (DOM mutation is a lifecycle affair); render only
     *  uses it if it already exists — the first eligible update supplies it. */
    _ensureDebugHost () {
        if (!this._debugHost) {
            const el = document.createElement('div');
            el.dataset.bwDebugHost = 'true';
            el.style.cssText = 'display:flex;flex-direction:column;flex:1 1 auto;' +
                'min-height:0;width:100%;height:100%;overflow:auto;';
            this._debugHost = el;
        }
        return this._debugHost;
    }

    _ensureStageHost () {
        if (this._stageHost && document.contains(this._stageHost)) return this._stageHost;
        const wrap = document.querySelector('div[class*="stage-and-target-wrapper"]');
        if (!wrap) return null;
        if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
        const host = document.createElement('div');
        // Keep the stage header controls above the portal: the portal owns the
        // stage surface, but must never intercept the three view buttons.
        host.dataset.bwCircuitStageHost = 'true';
        host.style.cssText = 'position:absolute;inset:0;z-index:0;background:#fff;display:none;overflow:auto;';
        wrap.appendChild(host);
        this._stageHost = host;
        this._sizeStageHost();
        // Layout-driven, not render-driven: the wrapper reaches its final
        // (oversized) width after our render pass, so a one-shot measure
        // reads pre-layout numbers and the cap never applies.
        // Per-host wiring: the stage wrapper is REPLACED when a project
        // loads, and an observer bound once watched the dead wrapper while
        // the new one grew to 1992px unobserved.
        if (typeof ResizeObserver !== 'undefined') {
            if (this._hostRO) this._hostRO.disconnect();
            this._hostRO = new ResizeObserver(() => {
                cancelAnimationFrame(this._hostResizeFrame);
                this._hostResizeFrame = requestAnimationFrame(() => this._sizeStageHost());
            });
            this._hostRO.observe(wrap);
        }
        return host;
    }

    /** The stage wrapper can be laid out WIDER than the viewport (it gets
     *  clipped by an ancestor), so an inset:0 host inherits a phantom
     *  ~2x width and everything portalled into it lays out off-screen —
     *  the Code-mode debugger sat 'too much to the right' with its right
     *  half cut (owner report + measured: pane 1992px wide at x=1018 in a
     *  2000px window). Cap the host at what is actually visible. */
    _sizeStageHost () {
        const host = this._stageHost;
        if (!host || !host.parentElement) return;
        const wl = host.parentElement.getBoundingClientRect().left;
        const visible = Math.max(280, Math.round(window.innerWidth - wl - 4));
        const wrapW = Math.round(host.parentElement.getBoundingClientRect().width);
        if (wrapW > visible + 8) {
            host.style.right = 'auto';
            host.style.width = `${visible}px`;
        } else {
            host.style.right = '0';
            host.style.width = '';
        }
    }

    /** While coding (any other tab), the circuit takes the stage's column —
     *  the owner's default: you watch the LED you are programming, not an
     *  empty Scratch stage. Only when there is circuit content to show. */
    _stagePortalOn () {
        if (this.props.isVisible || !this.state.showInStage) return false;
        // Controller and device panes own their whole column. The runner
        // stays mounted in its portal while the debugger view is hidden.
        if (!CIRCUIT_DOCKS.has(this.state.debugDock)) return false;
        // This is a presentation choice, not a capability check. Debugger
        // mode must still show the designer for an empty project so the user
        // can build the circuit before adding MCU code.
        return !!this._stageHost && document.contains(this._stageHost);
    }

    /** Hide the stage+sprites column only while THIS tab is the visible one —
     *  the option reads "give the circuit the whole width", not "lose the
     *  stage everywhere". Other tabs get it back the moment they show. */
    _syncStageAttr () {
        const on = !!this.state.hideStage;
        if (on) document.documentElement.setAttribute('data-bw-hide-stage', '');
        else document.documentElement.removeAttribute('data-bw-hide-stage');
        const wrap = document.querySelector('div[class*="stage-and-target-wrapper"]');
        if (wrap) wrap.style.display = this.state.rightPaneHidden ? 'none' : '';
        const stage = wrap && wrap.querySelector('div[class*="stage-wrapper"]');
        const canvas = wrap && wrap.querySelector('div[class*="stage-canvas-wrapper"]');
        const target = wrap && wrap.querySelector('div[class*="target-wrapper"]');
        if (canvas) canvas.style.display = on ? 'none' : '';
        if (target) target.style.display = on ? 'none' : '';
        if (stage) {
            stage.style.position = 'relative';
            stage.style.zIndex = on ? '3' : '';
            stage.style.background = on ? 'transparent' : '';
            stage.style.flex = on ? '1 1 100%' : '';
            stage.style.width = on ? '100%' : '';
            // Keep the wrapper hit-testable: the stage canvas/target are
            // hidden individually below, while the header must still receive
            // the Scratch/circuit/debugger mode clicks.
            stage.style.pointerEvents = '';
            const header = stage.querySelector('div[class*="stage-menu-wrapper"]');
            if (header) {
                header.style.pointerEvents = on ? 'auto' : '';
                // The circuit portal fills the stage wrapper. Keep the three
                // mode buttons above that surface so switching between
                // Scratch, circuit-only, and debugger never loses the only
                // route back.
                header.style.position = 'relative';
                header.style.zIndex = '10';
            }
        }
    }

    async load ({explicit = false} = {}) {
        this._markReactUpdate('host:stc-load');
        this.setState({stc: this.readStc()});
        if (this.state.Designer || this.loading) return;
        if (!shouldLoadCircuitDesigner({
            explicit,
            isVisible: this.props.isVisible,
            portalOn: this._stagePortalOn(),
            debugDock: this.state.debugDock
        })) return;
        this.loading = true;
        try {
            const [engine, m6502, z80, i8086] = await Promise.all([
                import(/* webpackChunkName: "bw-board" */ 'bw-board'),
                import(/* webpackChunkName: "bw-board" */ 'bw-board/m6502-extract.js'),
                import(/* webpackChunkName: "bw-board" */ 'bw-board/z80-extract.js'),
                import(/* webpackChunkName: "bw-board" */ 'bw-board/i8086-extract.js')
            ]);
            const extract6502Machine = m6502.extract6502Machine;
            const extractZ80Machine = z80.extractZ80Machine;
            const extract8086Machine = i8086.extract8086Machine;
            // The device registry has no self-registration: seventeen register*
            // exports and, until 2026-08-10, zero callers outside the engine's
            // own tests — servo/555/h-bridge netlists failed as "unknown kind"
            // with their drivers sitting right there. Register at injection.
            if (typeof engine.registerAllDevices === 'function') engine.registerAllDevices();
            // The host's panel switch and panel views (Robot Lab conventions) come with
            // the designer, never on first load: this tab is mounted from the start.
            const [ui, panels] = await Promise.all([
                import(/* webpackChunkName: "bw-circuit-ui" */ 'bw-circuit-ui'),
                import(/* webpackChunkName: "bw-circuit-panels" */ './circuit-panels.jsx')
            ]);
            // Inject only once the designer is genuinely needed. Keeping the
            // DRC and retro extractors at module scope made webpack promote the
            // board/Circuit UI graph into the cold Code-tab journey even though
            // right/solo render only DebugPanel at that boundary.
            if (typeof ui.setExtractors === 'function') {
                ui.setExtractors({extract6502Machine, extractZ80Machine, extract8086Machine,
                    extractCp1Machine: engine.extractCp1Machine});
            }
            // Kept so _applyToLiveCircuit can parse a restored bench without a
            // second import. Nothing else in this file needs the model class.
            this._Circuit = ui.Circuit || (ui.default && ui.default.Circuit) || null;
            const setEngine = ui.setEngine || (ui.default && ui.default.setEngine);
            if (typeof setEngine !== 'function') throw new Error('bw-circuit-ui setEngine export is unavailable');
            // `stc_mcu` is the legacy arbitrary-package surface: shipped
            // circuits legitimately use P5 and package pins absent from the
            // registry's smaller concrete STC model. Returning that model
            // makes bw-circuit-ui treat its terminal list as authoritative and
            // disconnects those wires. Null deliberately selects the generic
            // MCU boundary for this one kind; every functional model below
            // (PS/2, SimpleVGA, memories, modern boards) still passes through.
            const getCircuitDevice = kind => kind === 'stc_mcu' ? null : engine.getDevice(kind);
            // getDevice lets the designer keep registered board kinds
            // (arduino_uno, attiny85, ...) as themselves in the engine
            // netlist instead of collapsing them to 'mcu' — power pins
            // source, inputs read, and stateful PS/2/VGA faces exist. The
            // registry contract returns the model, not only a boolean: the
            // designer also derives authoritative terminal names from it.
            // Keep hasDevice for older vendored UI builds, but getDevice is
            // the current contract. Omitting it collapsed Aurora-65's PS/2
            // and SimpleVGA parts into generic MCUs in the browser while the
            // isolated tests (which injected getDevice) remained green.
            // The machine extractors ride the SAME injection: Build Machine
            // reads eng.extract6502Machine from getEngine(). They were wired
            // into the DRC (setExtractors, top of this file) but not into the
            // engine object, so every deployed Build Machine answered "no
            // retro CPU found" with the W65C02 seated in plain sight.
            setEngine({BoardImpl: engine.BoardImpl, inferNetlist: engine.inferNetlist, checkWiring: engine.checkWiring,
                extractCp1Machine: engine.extractCp1Machine,
                hasDevice: engine.hasDevice, getDevice: getCircuitDevice, extract6502Machine, extractZ80Machine,
                extract8086Machine,
                // The sweep instrument (SweepPanel): Kennlinien + Bode run
                // these on an offline board copy. Same contract as the
                // extractors above — if they are absent, the panel refuses
                // truthfully instead of blaming the circuit.
                runDcSweep: engine.runDcSweep, runAcSweep: engine.runAcSweep, logSpace: engine.logSpace,
                // DRC rule 8 (aggregate current) sums the chip current of every
                // seated part. Without these two it cannot: drc.js's
                // getCurrentRatings() falls back to `getMaxCurrent: () => null`,
                // which marks EVERY kind-rated part an honest unknown, so the
                // sum never reaches the limit and the danger warning cannot
                // fire — silently, because the fallback is a legitimate
                // conservative default and nothing logs. The deployed app has
                // been in that state; only the isolated tests (which inject
                // them) ever summed. Same producer-must-assert-consumer shape
                // as getDevice and the extractors above.
                getMaxCurrent: engine.getMaxCurrent, PORT_LIMITS: engine.PORT_LIMITS});
            // Part sidecars (pin maps, current ratings, footprints) into the
            // parts registry. require.context because this bundle is webpack,
            // not vite. 115 files, ~464 KiB, in this same chunk.
            //
            // NOT fatal, and not awaited into the same try as the designer.
            // The registry is an enhancement: `artCoverage()` already reports
            // which kinds fall back to the hand-drawn switch, so a designer
            // with no sidecars is degraded and usable. Loading it inside the
            // designer's try meant one bad JSON file took down the whole tab —
            // and worse, looked like a stale build, because that catch offers
            // the failure to the chunk-recovery path and would have reloaded
            // the page over a missing part drawing.
            import(/* webpackChunkName: "bw-circuit-ui" */ 'bw-circuit-ui/model/sidecar-loader.js')
                .catch((e) => console.warn(
                    '[brickwright] part sidecars unavailable — the palette will ' +
                    'fall back to built-in drawings:', e));
            // (The WASM compiler intercept used to be installed here. It now
            // lives at the compile call site in debug-runner.js: patching
            // globalThis.fetch only matters when something compiles, and hanging
            // it off this tab's visibility made local routing depend on whether
            // the user happened to open the Circuit tab first.)
            // Keep the whole module, not just the designer. The warnings, parts
            // list and examples panels are separate exports, and a build may
            // legitimately not have them yet — which the panel strip reports
            // rather than hides.
            this._markReactUpdate('host:designer-load');
            this.setState({Designer: ui.CircuitDesigner, ui, panels});
        } catch (e) {
            // A chunk that 404s because the deploy moved on is not an error the
            // user can act on, and catching it here made it INVISIBLE to the
            // global recovery in index.ejs: that handler only sees failures
            // nobody handled, and this catch handles it. The result was a
            // permanently dead panel next to a recovery that never ran. So ask
            // the recovery explicitly; it reloads once per tab, and returns
            // false if this is not a stale build or the one shot is spent.
            const recovering = typeof window !== 'undefined' &&
                window.__bwRecoverFromStaleBuild &&
                window.__bwRecoverFromStaleBuild(e && e.message);
            this.setState(recovering ? {reloading: true} : {error: e.message});
        }
        this.loading = false;
    }

    /**
     * The designer handing over the circuit it owns.
     *
     * `runDrc` wants `circuit.parts`, `.wires`, `.breadboards` and `.board`, and
     * `generateBom` wants the parts — all of it inside CircuitDesigner, and
     * neither `onBoardReady` nor `onDeclarationChange` carries it.
     *
     * It arrives ONCE, on mount, and that is right rather than a bug: the
     * circuit is a `useRef` instance that mutates in place behind an internal
     * revision counter, so the host holds a live reference — the same handshake
     * as `onBoardReady`. What a once-only handover does NOT give us is a signal
     * that the contents changed, which is why `onDeclarationChange` doubles as
     * one below.
     *
     * (The prop is `onCircuitReady`. I asked for `onCircuitChange` and it
     * shipped under the other name — the sixth producer/consumer mismatch of
     * this campaign, and the one that cost the least, because nothing silently
     * half-worked: the panels kept saying they had no circuit.)
     */
    handleCircuitReady (circuit) {
        const selectedMachine = window.__bwMachineExtracted;
        const selectedCardiac = selectedMachine?.kind === 'cardiac' ? selectedMachine : null;
        const virtualCardiac = selectedCardiac && !selectedCardiac.config?.partId;
        // Deleting/clearing the circuit must STOP the debugger: a live
        // runner kept driving a board that no longer exists (owner
        // report, 2026-08-17). An empty board with a runner attached =
        // bump the stop token; the panel tears its session down.
        try {
            const nParts = circuit && circuit.parts
                ? (circuit.parts.size ?? circuit.parts.length ?? 0) : 0;
            const hadParts = this.state.circuit && this.state.circuit.parts
                ? (this.state.circuit.parts.size ?? this.state.circuit.parts.length ?? 0) : 0;
            if (nParts === 0 && hadParts > 0 && !virtualCardiac) {
                this.setState(st => ({stopToken: (st.stopToken || 0) + 1}));
            }
        } catch { /* never block circuit publication */ }
        this._markReactUpdate('host:circuit-ready');
        this.setState({circuit});
        if (selectedCardiac?.config?.partId && this._cardiacAttachedBoard &&
            !circuit?.parts?.some(part => part.kind === 'cardiac' && part.id === selectedCardiac.config.partId)) {
            this._onCardiacCodeSelection({detail: {active: false}});
        }
        if (typeof window !== 'undefined') {
            const parts = circuit && circuit.parts ?
                (circuit.parts.size ?? circuit.parts.length ?? 0) : 0;
            const wires = circuit && circuit.wires ?
                (circuit.wires.size ?? circuit.wires.length ?? 0) : 0;
            window.dispatchEvent(new CustomEvent('bw-circuit-ready', {detail: {parts, wires}}));
        }
        // Detect CPU parts on the board and publish the core so the debug
        // panel creates the right target kind (z80, eater6502, avr8js).
        if (circuit && circuit.parts) {
            const rt = this.props.vm && this.props.vm.runtime;
            if (rt && !rt.bwDeviceCore) {
                const is8086 = (k) => k === 'i8086' || k === '8086' || k === 'i8088' || k === '8088';
                if (window.__bwMachineExtracted?.kind === 'cp1' &&
                    circuit.parts.some(p => p.kind === 'kosmos-cp1')) {
                    rt.bwDeviceCore = 'cp1';
                } else if (circuit.parts.some(p => p.kind === 'z80')) {
                    rt.bwDeviceCore = 'z80';
                } else if (circuit.parts.some(p => p.kind === 'w65c02')) {
                    rt.bwDeviceCore = 'w65c02';
                } else if (circuit.parts.some(p => is8086(p.kind))) {
                    // The 8088 is an 8086 with an eight-bit bus. Same
                    // instruction set, same registers, same core here — the
                    // difference is bus timing, which this tier does not model,
                    // so refusing the 8088 by name would refuse a machine we
                    // can in fact run.
                    rt.bwDeviceCore = 'i8086';
                }
            }
        }
    }

    /**
     * Keep the hardware contract live while the user wires the board.
     *
     * CircuitDesigner derives pins from physical wiring; the Scratch blocks
     * and debugger read them from runtime.stc. Leaving this as a one-way
     * preview made a perfectly wired Uno look disconnected to the code tab.
     * Merge only the circuit-owned tables so compiler/device settings and any
     * declarations not represented by the visual starter-kit parts survive.
     */
    /**
     * The designer telling us the CIRCUIT changed — a part added or removed, a
     * param edited, a wire made or broken.
     *
     * `bw-circuit-changed` used to be dispatched from `handleDeclarationChange`
     * below, which fires only when the DERIVED PIN DECLARATIONS move. On a bench
     * with no microcontroller they never do — `{"pins":[],"ports":[],"parts":[]}`
     * before and after every edit — so on those benches the event could not fire
     * at all, and three lessons that ask the learner to edit a circuit and watch
     * for a response were left with a checkpoint only their manual button could
     * complete (`starter-circuit-path`, `signals-resonance`,
     * `machines-contention`; `docs/WAVE-OPEN-DEFECTS.md` D6).
     *
     * `onCircuitEdit` is the honest producer and strictly subsumes the old one,
     * since declarations are derived from the same parts and wires. It does not
     * fire on the circuit arriving, only on a change to it.
     */
    handleCircuitEdit (detail) {
        notifyUndoState();
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent('bw-circuit-changed', {detail: detail || {}}));
    }

    handleDeclarationChange (decls) {
        this._markReactUpdate('host:declaration-revision');
        this.setState(s => ({circuitRev: (s.circuitRev || 0) + 1}));
        if (!decls || !decls.device || !Array.isArray(decls.pins)) return;
        const vm = this.props.vm;
        if (!vm) return;
        const current = (vm.runtime && vm.runtime.stc) || {};
        // An EMPTY derived pin list must never erase a loaded program's
        // non-empty pins: a stale bench that derives nothing would wipe
        // runtime.stc and kill the debugger ('No program pins' on a
        // program that has them). Peer-suggested guard (stc-e1).
        if (!decls.pins.length && current.pins && current.pins.length) return;
        // A loaded PROGRAM's declarations are the contract; the designer's
        // wiring-derived pins are heuristics (their polarity walk falls
        // back to the 8051 active-low idiom when nets have not resolved
        // yet). Letting the derivation REPLACE parsed pins flipped the
        // Pico calculator's 17 ACTIVE-HIGH keys to active-low mid-load:
        // the firmware then armed pull-UPS, every key read as pressed
        // forever, and the OLED never drew. Program-declared names win;
        // derived pins only add names the program does not declare.
        const rt = vm.runtime;
        const hasProgram = current.pinsSource === 'program' &&
            Array.isArray(current.pins) && current.pins.length > 0;
        let pins = decls.pins;
        if (hasProgram) {
            const progByName = new Map(current.pins.map(p => [p.name, p]));
            pins = decls.pins.map(dp => progByName.get(dp.name) || dp);
            for (const p of current.pins) {
                if (!pins.some(m => m.name === p.name)) pins.push(p);
            }
        }
        const next = {
            ...current,
            device: decls.device,
            pins,
            pinsSource: hasProgram ? 'program' : 'derived',
            ports: decls.ports || [],
            parts: decls.parts || []
        };
        { const stcTraceObj = next; if (typeof window !== 'undefined') { (window.__bwStcTrace = window.__bwStcTrace || []).push({who: 'declChange', t: Date.now(), b4: JSON.stringify((stcTraceObj && stcTraceObj.pins || []).find(p => p.name === 'b4') || null), dbg: JSON.stringify({hasProgram, src: !!(rt && rt.bwPseudocodeSource), curLen: (current.pins || []).length, curB4: (current.pins || []).find(p => p.name === 'b4') || null})}); } }
        if (vm.setStc) vm.setStc(next);
        else if (vm.runtime) vm.runtime.stc = next;
        this._markReactUpdate('host:declaration-stc');
        this.setState({stc: next});
        if (vm.runtime && vm.runtime.emit) vm.runtime.emit('PROJECT_CHANGED');
    }

    /** Load the example catalog for the gallery or a starter journey. */
    async loadExamples () {
        if (this.state.examples) return this.state.examples;
        if (this.examplesLoadingPromise) return this.examplesLoadingPromise;
        this.examplesLoadingPromise = (async () => {
            try {
                const res = await fetch('examples/index.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                const list = Array.isArray(data) ? data : (data.examples || []);
                this._markReactUpdate('host:examples');
                const previousError = this.examplesLoadError;
                this.examplesLoadError = null;
                this.setState(state => ({examples: list,
                    examplesError: state.examplesError === previousError ? null : state.examplesError}));
                return list;
            } catch (e) {
                const message = pt(this.props.locale, 'examples.notVendored', {message: e.message});
                this.examplesLoadError = message;
                this.setState({examplesError: message});
                return null;
            } finally {
                this.examplesLoadingPromise = null;
            }
        })();
        return this.examplesLoadingPromise;
    }

    loadExamplesGallery () {
        const artwork = loadGalleryArtwork('circuits');
        if (this.galleryArtworkRequest === artwork) return;
        this.galleryArtworkRequest = artwork;
        Promise.all([this.loadExamples(), artwork]).then(([list, index]) => {
            if (this.galleryArtworkRequest !== artwork) return;
            if (!list) {
                this.galleryArtworkRequest = null;
                return;
            }
            const decorated = circuitExamplesWithArtwork(list, index);
            if (decorated !== list) this.setState(state => state.examples === list ? {examples: decorated} : null);
        });
    }

    openInlineExamples () {
        this.loadExamplesGallery();
        this.loadCurriculum();
    }

    /**
     * The Codex manifest — the trails, chapters and stations that turn the
     * gallery into a curriculum instead of a grid of thumbnails.
     *
     * CircuitDesigner shows the Codex only when it is handed BOTH `examples`
     * and `curriculum`, and this host only ever handed it examples — so the
     * Codex shell, the trails and every word of their narrative shipped dark,
     * and the gallery was the only way in. Nobody could have noticed from the
     * app: an absent toggle looks exactly like a feature that does not exist.
     *
     * Unlike the gallery, a missing manifest is NOT surfaced as an error. The
     * gallery is what this tab is for and its absence is a broken build; the
     * Codex is an additional lens over the same examples, and a build without
     * it should quietly show the gallery rather than an apology.
     */
    async loadCurriculum () {
        if (this.state.curriculum) return this.state.curriculum;
        if (this.curriculumLoadingPromise) return this.curriculumLoadingPromise;
        this.curriculumLoadingPromise = (async () => {
            try {
                const res = await fetch('examples/curriculum.json');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                if (!data || !Array.isArray(data.trails) || data.trails.length === 0) return null;
                this._markReactUpdate('host:curriculum');
                this.setState({curriculum: data});
                return data;
            } catch (e) {
                return null;
            } finally {
                this.curriculumLoadingPromise = null;
            }
        })();
        return this.curriculumLoadingPromise;
    }

    /** Open one of the three first-run journeys through the normal loaders. */
    async loadStarterJourney (event) {
        const journey = event && event.detail || {};
        const finish = detail => {
            if (journey.id) window.dispatchEvent(new CustomEvent('bw-starter-result', {
                detail: {journeyId: journey.id, ...detail}
            }));
            journey.onResult?.(detail);
        };
        try {
            const list = await this.loadExamples();
            if (!Array.isArray(list)) throw new Error(this.examplesLoadError ||
                pt(this.props.locale, 'examples.indexFailed'));
            const example = list.find(item => item.id === journey.exampleId);
            if (!example) throw new Error(
                `Starter example "${journey.exampleId}" is missing from examples/index.json.`);
            if (journey.mode !== 'program-only') this.load({explicit: true});
            const result = journey.mode === 'program-only' ?
                await this.loadProgramOnlyStarter(example) :
                await this.loadExample(example, {
                    circuitOnly: journey.mode === 'circuit-only' || !!journey.kim1Tape,
                    activateCircuit: !!journey.kim1Tape,
                    kim1Tape: journey.kim1Tape
                });
            finish(result && result.ok ? {ok: true} : {
                ok: false,
                cancelled: !!(result && result.cancelled),
                error: result && result.error
            });
        } catch (error) {
            finish({ok: false, error: error.message});
        }
    }

    showControllerDock () {
        if (window.__bwMachineExtracted?.kind === 'cp1' && CIRCUIT_DOCKS.has(this.state.debugDock)) {
            this._cp1NormalDock = this.state.debugDock;
        }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {
            detail: {key: 'bw-right-pane-hidden', value: '0'}
        }));
        window.dispatchEvent(new CustomEvent('bw-settings-change', {
            detail: {key: 'bw-debug-dock', value: 'controller'}
        }));
    }

    _restoreCp1Dock = () => {
        if (this.state.debugDock === 'controller') {
            window.dispatchEvent(new CustomEvent('bw-settings-change', {
                detail: {key: 'bw-debug-dock', value: this._cp1NormalDock || 'top'}
            }));
        }
        this._cp1NormalDock = null;
    };

    _onCardiacCodeSelection = event => {
        if (event.detail?.active) {
            if (window.__bwMachineExtracted?.kind !== 'cardiac') this.activateCardiac();
            else this.showCardiacController();
            window.dispatchEvent(new CustomEvent('bw-cardiac-selected'));
            return;
        }
        if (window.__bwMachineExtracted?.kind !== 'cardiac') return;
        this._cardiacAttachedBoard = null;
        setCardiacWorkspaceActive(localStorage, false);
        delete window.__bwMachineExtracted;
        const runtime = this.props.vm?.runtime;
        if (runtime?.bwDeviceCore === 'cardiac') runtime.bwDeviceCore = this._cardiacNormalCore;
        this._cardiacNormalCore = undefined;
        this.setState({machineBooted: false});
        window.dispatchEvent(new CustomEvent('bw-cardiac-detached'));
    };

    _onCardiacProgramLoaded = async event => {
        // CircuitTab retains the model even when the Designer is hidden. Its
        // normal parameter writer preserves the accepted initial image there.
        try {
            const {acceptedCardiacProgram, saveCardiacProgram} = await import('bw-circuit-ui/model/cardiac-controls.js');
            const circuit = this.state.circuit;
            const partId = event.detail?.partId;
            const board = this.props.vm?.runtime?.circuitBoard;
            const program = acceptedCardiacProgram(board, circuit?.getPart?.(partId), event.detail?.program);
            if (!program || !saveCardiacProgram(circuit, partId, program)) return;
            circuit.setPartParam(partId, 'program', program);
            const record = circuitAutosaveRecord(circuit, readCircuitOwner(localStorage));
            if (record !== null) localStorage.setItem('bw-circuit-autosave', record);
        } catch (error) {
            this.setState({examplesError: `CARDIAC program could not be saved to the circuit: ${error.message}`});
        }
    };

    _onCardiacOpen = event => {
        const partId = event.detail?.partId;
        const board = this.props.vm?.runtime?.circuitBoard;
        if (!partId || !board?.getParts?.().some(part => part.id === partId && part.kind === 'cardiac')) return;
        this.activateCardiac(partId);
    };

    _onCardiacRunRequest = () => {
        if (window.__bwMachineExtracted?.kind === 'cardiac') this.showCardiacController();
    };

    showCardiacController () {
        const panel = this.props.vm?.runtime?.controllerPanel;
        if (panel && addCardiacFace(panel)) {
            window.dispatchEvent(new CustomEvent('bw-controller-changed', {
                detail: {data: serializeControllerPanel(panel)}
            }));
        }
        this.showControllerDock();
    }

    activateCardiac (partId = null) {
        if (window.__bwMachineExtracted?.kind === 'cp1') this._onCp1CodeSelection({detail: {active: false}});
        setCardiacWorkspaceActive(localStorage, true);
        const runtime = this.props.vm?.runtime;
        if (runtime?.bwDeviceCore !== 'cardiac') this._cardiacNormalCore = runtime?.bwDeviceCore;
        if (runtime) runtime.bwDeviceCore = 'cardiac';
        const board = runtime?.circuitBoard;
        this._cardiacAttachedBoard = partId &&
            board?.getParts?.().some(part => part.kind === 'cardiac' && part.id === partId) ? board : null;
        const config = partId ? {partId} : {};
        window.dispatchEvent(new CustomEvent('bw-machine-extracted', {detail: {kind: 'cardiac', config, clearLoadedMedia: true}}));
        window.dispatchEvent(new CustomEvent('bw-cardiac-selected'));
        this.showCardiacController();
        return config;
    }

    async loadCardiacExample (example, opts = {}) {
        this.setState({loadingExample: example.id, examplesError: null});
        try {
            const sourceResponse = await fetch(`examples/${example.files.cardiac}`);
            if (!sourceResponse.ok) throw new Error(`CARDIAC source: HTTP ${sourceResponse.status}`);
            const source = await sourceResponse.text();
            let inputDeck = '';
            if (example.files.deck) {
                const deckResponse = await fetch(`examples/${example.files.deck}`);
                if (!deckResponse.ok) throw new Error(`CARDIAC deck: HTTP ${deckResponse.status}`);
                inputDeck = await deckResponse.text();
            }
            if (source.length > 131072 || inputDeck.length > 32768) throw new Error('CARDIAC example exceeds workspace limits.');
            // Persist before mounting: a lazy host can miss the source event.
            const draft = createCardiacWorkspace(source, inputDeck);
            if (example.files.circuit) draft.inputMode = 'circuit';
            let partId = null;
            if (example.files.circuit) {
                await this.load({explicit: true});
                const opened = await this.loadExample({...example, files: {...example.files, cardiac: null}}, opts);
                if (!opened.ok) return opened;
                const data = opened.circuitData;
                const part = data?.parts?.find(item => item.kind === 'cardiac');
                if (!part) throw new Error('The CARDIAC example needs a CARDIAC adapter.');
                this._applyToLiveCircuit(data);
                partId = part.id;
            }
            localStorage.setItem(CARDIAC_WORKSPACE_KEY, JSON.stringify(draft));
            this.activateCardiac(partId);
            if (!partId) window.dispatchEvent(new CustomEvent('bw-activate-tab', {detail: {index: 3}}));
            window.dispatchEvent(new CustomEvent('bw-cardiac-source-load',
                {detail: {source, inputDeck, inputMode: draft.inputMode, exampleId: example.id}}));
            this.publishExampleTitle(example);
            this.setState({loadingExample: null});
            return {ok: true};
        } catch (error) {
            this.setState({loadingExample: null, examplesError: error.message});
            return {ok: false, error: error.message};
        }
    }

    _onCp1CodeSelection = event => {
        const runtime = this.props.vm?.runtime;
        const active = window.__bwMachineExtracted;
        if (event.detail?.active) {
            if (active?.kind === 'cardiac') this._onCardiacCodeSelection({detail: {active: false}});
            const suspended = this._cp1Suspended;
            if (active?.kind === 'cp1' || !suspended) return;
            const parts = this.state.circuit?.parts || this.state.circuitData?.parts;
            this._cp1Suspended = null;
            if (!parts?.some(part => part.kind === 'kosmos-cp1' && part.id === suspended.config.partId)) return;
            this._cp1NormalCore = runtime?.bwDeviceCore;
            if (runtime) runtime.bwDeviceCore = 'cp1';
            delete window.__bwPendingMedia;
            window.dispatchEvent(new CustomEvent('bw-machine-extracted', {
                detail: {kind: 'cp1', config: suspended.config, resumeCp1: true}
            }));
            this.showControllerDock();
            return;
        }
        if (active?.kind !== 'cp1') return;
        this._cp1Suspended = active;
        delete window.__bwMachineExtracted;
        if (window.__bwPendingMedia?.detail?.kind === 'cp1') delete window.__bwPendingMedia;
        if (runtime?.bwDeviceCore === 'cp1') runtime.bwDeviceCore = this._cp1NormalCore;
        this._cp1NormalCore = undefined;
        this.setState({machineBooted: false});
        window.dispatchEvent(new CustomEvent('bw-cp1-circuit-detached', {detail: {suspended: true}}));
    };

    activateCp1Circuit (data, useDefaultMonitor = false) {
        this._cp1Suspended = null;
        const part = data?.parts?.find(item => item.kind === 'kosmos-cp1');
        const runtime = this.props.vm?.runtime;
        if (!part) {
            if (window.__bwMachineExtracted?.kind !== 'cp1' && runtime?.bwDeviceCore !== 'cp1') return null;
            if (window.__bwMachineExtracted?.kind === 'cp1') {
                delete window.__bwMachineExtracted;
                this.setState({machineBooted: false});
            }
            if (window.__bwPendingMedia?.detail?.kind === 'cp1') delete window.__bwPendingMedia;
            if (runtime?.bwDeviceCore === 'cp1') runtime.bwDeviceCore = this._cp1NormalCore;
            this._cp1NormalCore = undefined;
            window.dispatchEvent(new CustomEvent('bw-cp1-circuit-detached'));
            return null;
        }
        if (window.__bwMachineExtracted?.kind === 'cardiac') this._onCardiacCodeSelection({detail: {active: false}});
        const config = {partId: part.id, expansion: part.params?.expansion === true,
            clockHz: part.params?.clockHz || 6000000};
        if (runtime && runtime.bwDeviceCore !== 'cp1') this._cp1NormalCore = runtime.bwDeviceCore;
        if (runtime) runtime.bwDeviceCore = 'cp1';
        if (window.__bwPendingMedia && (useDefaultMonitor || window.__bwPendingMedia.detail?.kind !== 'cp1')) {
            delete window.__bwPendingMedia;
        }
        window.dispatchEvent(new CustomEvent('bw-machine-extracted', {detail: {kind: 'cp1', config, useDefaultMonitor}}));
        return config;
    }

    selectKim1 (part) {
        const current = window.__bwMachineExtracted;
        if (!part) {
            if (current?.kind === 'kim1') {
                delete window.__bwMachineExtracted;
                window.dispatchEvent(new CustomEvent('bw-kim1-selection'));
                this.setState({machineBooted: false});
            }
            return;
        }
        if (current?.kind === 'kim1' && current.config.partId === part.id) return;
        window.dispatchEvent(new CustomEvent('bw-machine-extracted', {
            detail: {kind: 'kim1', config: {partId: part.id}, clearLoadedMedia: true}
        }));
        window.dispatchEvent(new CustomEvent('bw-kim1-selection', {detail: {partId: part.id}}));
    }

    handleWiredBootReady = (data, board, result) => {
        const pending = this._wiredExample;
        if (!pending || pending.data !== data) return;
        this._wiredExample = null;
        if (!result.ok || !board) {
            this.setState({examplesError: result.reasons?.join(' · ') || 'The circuit could not be attached.'});
            return;
        }
        const runtime = this.props.vm?.runtime;
        if (runtime) runtime.circuitBoard = board;
        window.dispatchEvent(new CustomEvent('bw-board-ready'));
        if (pending.media) window.dispatchEvent(new CustomEvent('bw-machine-media-load', {detail: pending.media}));
    };

    /**
     * Apply an example's shipped controller layout (files.controller) to
     * the runtime panel — replacing whatever widgets the previous project
     * left, exactly as loading an example replaces its circuit and program.
     * With no controller file the panel is CLEARED for the same reason.
     * Factored out of loadProgramOnlyStarter (2026-08-25) because the
     * general loadExample path never applied layouts at all: a circuit
     * example could not ship pre-defined widgets (owner report — the
     * calculator "SHOULD come with widgets pre-defined").
     */
    async applyControllerLayout (example, opts = {}) {
        const runtime = this.props.vm && this.props.vm.runtime;
        const panel = runtime && runtime.controllerPanel;
        const path = example && example.files && example.files.controller;
        if (!path) {
            if (panel) clearControllerPanel(panel);
            return false;
        }
        const response = await fetch(`examples/${path}`);
        if (!response.ok) {
            if (opts.required) throw new Error(`controller: HTTP ${response.status}`);
            return false;
        }
        const layout = await response.json();
        if (!panel || !layout || !Array.isArray(layout.widgets)) {
            if (opts.required) throw new Error('controller layout is not available');
            return false;
        }
        clearControllerPanel(panel);
        for (const widget of layout.widgets) {
            const added = panel.addWidget(widget.name, widget.type,
                widget.config || {}, widget.layout || {});
            if (widget.binding) added.binding = {...widget.binding};
        }
        panel.setHideBindings?.(!!layout.hideBindings);
        if (layout.mode) panel.setMode(layout.mode);
        if (runtime.stc) runtime.stc.controller = layout;
        return true;
    }

    /** Program-only starters (currently LEGO) have no fictional circuit to load. */
    async loadProgramOnlyStarter (example) {
        if (example.files?.cardiac) return this.loadCardiacExample(example);
        const message = /^de/i.test(navigator.language) ?
            `„${example.id}" öffnen?\n\nDas ersetzt das aktuelle Projekt. Nicht Gespeichertes geht verloren.` :
            `Open "${example.id}"?\n\nThis replaces the current project. Anything unsaved is lost.`;
        // Awaited: a native dialog in the desktop/iOS app (lib/native-dialog.js). With no
        // way to ask at all (a headless harness), go ahead, as before.
        if (!(await confirmAsync(message, {unavailable: true}))) return {ok: false, cancelled: true};
        this.setState({loadingExample: example.id, examplesError: null});
        try {
            await this.loadExampleProgram(example, null);
            this.setState({loadingExample: null, stc: this.readStc()});
            this.publishExampleTitle(example);
            if (example.files && example.files.controller) {
                await this.applyControllerLayout(example, {required: true});
                window.dispatchEvent(new CustomEvent('bw-settings-change', {
                    detail: {key: 'bw-stage-circuit', value: '1'}
                }));
                window.dispatchEvent(new CustomEvent('bw-settings-change', {
                    detail: {key: 'bw-debug-dock', value: 'controller'}
                }));
            } else {
                // A hardware extension project has no fictional breadboard. Show
                // its Scratch/extension stage while coding instead of an empty circuit.
                window.dispatchEvent(new CustomEvent('bw-settings-change', {
                    detail: {key: 'bw-stage-circuit', value: '0'}
                }));
            }
            return {ok: true};
        } catch (error) {
            this.setState({loadingExample: null, examplesError:
                `Could not fully open "${example.id}": ${error.message}.`});
            return {ok: false, error: error.message};
        }
    }

    /**
     * Open a gallery example onto the board.
     *
     * The card hands back the whole index entry, so the files it names are
     * fetched here rather than guessed: `files.circuit` is a path relative to
     * the gallery root, not an id to reconstruct.
     *
     * Loading is destructive — it replaces whatever is on the board. That is
     * acceptable without a confirm dialog *only* because bw-circuit-ui's
     * `handleLoad` calls `_saveHistory()` first, so undo brings the previous
     * circuit back. If that ever stops being true this needs a prompt, which is
     * why the reason is written down rather than assumed.
     *
     * @param {object} ex an entry from examples/index.json
     */
    /**
     * Load an example's program, so the project gains its PIN declarations.
     *
     * Without this, opening an example gives a wired board and no debugger:
     * the run controls are gated on `stc.pins`, and pins are declared in
     * `program.bw`, not in `circuit.json`. That is the shortest path a curious
     * user takes to find the debugger, and it ended nowhere.
     *
     * `vm.loadProject` REPLACES the project — unlike loading a circuit, which
     * the designer's undo can recover. So this asks first.
     *
     * This repeats part of pseudocode-importer.jsx's sequence (parse →
     * generateSB3 → loadProject → set stc) rather than sharing it, and that is
     * a deliberate, narrow choice I would rather flag than hide: extracting the
     * importer's version means refactoring working code that has no test
     * covering it. What is NOT duplicated is the stc-comment persistence — the
     * importer writes `stc` into a stage comment so it survives save/reload.
     * An opened example lives on `runtime.stc`, which `readStc()` reads, and is
     * lost on reload. If examples ever need to survive a save, this should call
     * the importer's path instead of growing a second copy of it.
     *
     * @returns {Promise<boolean>} whether pins were loaded
     */
    async loadExampleProgram (ex, pick) {
        const path = ex && ex.files && ex.files.program;
        if (!path) return false;
        const vm = this.props.vm;
        if (!vm || !vm.loadProject) return false;
        const res = await fetch(`examples/${path}`);
        if (!res.ok) throw new Error(`program: HTTP ${res.status}`);
        let source = await res.text();
        // Through the registering door: an example loaded here is parsed here, and a
        // game example's `SHAPE art …` needs this app's artwork already injected.
        const {default: SB3Creator} = await import(
            /* webpackChunkName: "sb3-creator" */ '../../lib/sb3-creator-register-art.js');

        // An example is a curated PAIRING of program and circuit: the
        // circuit.json has the example's own device seated and wired. This
        // used to retarget the program to the CURRENT project's device,
        // which silently broke the pairing — the ATtiny88 pendant retargeted
        // to an STC12 program (or, when retarget refused, loaded as-authored
        // but with the OLD device's engine still selected), and the matrix
        // never lit (owner report, 3791c09). The example's device wins;
        // retargeting stays available afterwards in the Code tab.
        let exDevice = (source.match(/^DEVICE\s+([\w-]+)/im) || [])[1];
        // A picked device retargets the program; a refusal keeps the
        // authored pairing and says why instead of silently substituting.
        const pickNorm = (pick || '').toLowerCase().replace(/_/g, '-');
        if (pickNorm && exDevice &&
            pickNorm !== exDevice.toLowerCase().replace(/_/g, '-') &&
            SB3Creator.retargetPseudocode) {
            const r = SB3Creator.retargetPseudocode(source, pickNorm);
            if (r.ok) {
                source = r.pseudocode;
                exDevice = pickNorm;
            } else {
                throw new Error(`cannot retarget to ${pickNorm}: ` +
                    `${(r.reasons || []).join('; ') || 'unknown reason'}`);
            }
        }

        const creator = new SB3Creator();
        creator.parse(source);
        const blob = await creator.generateSB3();
        await vm.loadProject(await blob.arrayBuffer());
        // Auto-select the first sprite with scripts so the Blocks palette
        // shows meaningful blocks, not "Stage selected — no motion blocks".
        if (vm.runtime && vm.runtime.targets) {
            const best = vm.runtime.targets.find(
                t => !t.isStage && t.blocks.getScripts().length > 0
            ) || vm.runtime.targets.find(t => !t.isStage);
            if (best) {
                vm.setEditingTarget(best.id);
            }
        }
        // scratch-vm's serializer drops unknown top-level keys, so `stc` never
        // survives toJSON. Keep it on the runtime, which lives as long as the
        // project does — the same reason the importer does it.
        const stc = creator.project.stc || null;
        // Pins parsed from a PROGRAM outrank wiring-derived heuristics —
        // the marker travels on the object because the importer consumes
        // (and clears) bwPseudocodeSource before the designer's first
        // declaration pass fires.
        if (stc) stc.pinsSource = 'program';
        { const stcTraceObj = stc; if (typeof window !== 'undefined') { (window.__bwStcTrace = window.__bwStcTrace || []).push({who: 'loadExampleProgram', t: Date.now(), b4: JSON.stringify((stcTraceObj && stcTraceObj.pins || []).find(p => p.name === 'b4') || null)}); } }
        if (vm.setStc) vm.setStc(stc); else vm.runtime.stc = stc;
        // Store the pseudocode source so the Code tab can show it.
        // The importer reads this on mount/update and fills its buffer
        // when it sees the project changed.
        vm.runtime.bwPseudocodeSource = source;
        // Publish the example's device on the runtime, exactly like the
        // importer's device switch does — the debug panel reads these to
        // select the matching engine. Without this the pendant (ATTINY88)
        // ran on "Simulated (STC12 / 8051)" and every pin stayed off.
        if (exDevice) {
            const id = exDevice.toLowerCase();
            vm.runtime.bwDeviceId = id;
            const core =
                /^stc/.test(id) ? '8051' :
                /^(arduino-|atmega|attiny)/.test(id) ? 'arduino' :
                id === 'pico' ? 'rp2040' :
                /^stm32/.test(id) ? 'arm' :
                /^(eater6502|6502|w65c02)$/.test(id) ? 'w65c02' :
                /^(z80|zx48|zx128)$/.test(id) ? 'z80' :
                /^(i8086|8086|i8088|8088)$/.test(id) ? 'i8086' :
                id === 'microbit' ? 'micropython' : null;
            if (core) vm.runtime.bwDeviceCore = core;
        }
        // Emit a project change so the importer knows to re-read.
        vm.runtime.emit('PROJECT_CHANGED');
        // Not just a boolean: whether the "no pins" advisory is even true
        // depends on WHAT the program is. A PART binding (PART leds =
        // 74HC595 data P1.0 ...) drives pins without a single PIN line,
        // and a machine-class device (6502/Z80 bench) has no pin concept
        // at all — scolding either one misleads (owner report).
        return {
            pins: !!stcDrives(stc),
            hasPart: /^PART\s+/im.test(source),
            device: (exDevice || '').toLowerCase(),
        };
    }

    loadKim1TapeCircuit (circuitData, partId, tape, nextState) {
        const runtime = this.props.vm.runtime;
        const previousPart = runtime.circuitModel?.getPart(partId);
        return new Promise((resolve, reject) => {
            const ready = () => {
                const part = runtime.circuitModel?.getPart(partId);
                const board = runtime.circuitBoard;
                if (this.state.circuitData !== circuitData || part === previousPart || part?.params?.program !== tape.program ||
                    !board?.getDeviceState?.(partId)) return;
                cleanup();
                // Run after the Designer has attached its simulation clock to this board.
                setTimeout(() => {
                    if (this.state.circuitData !== circuitData || runtime.circuitBoard !== board) {
                        reject(new Error('The KIM-1 circuit was replaced before launch.'));
                        return;
                    }
                    const setup = {
                        'ram-check': ['setBackplane', [
                            {kind: 'kim-2', address: 0x2000}, {kind: 'kim-3', address: 0x4000},
                            {kind: 'kim-3b', address: 0x6000}
                        ]],
                        video: ['setK1008', 0x2000],
                        'memory-map': ['setMemoryCard', tape.image],
                        'sd-read': ['mountSD', tape.image],
                        'corsham-read': ['mountCorshamDisk', tape.image]
                    }[tape.preset];
                    try {
                        if (!setup || !board.setDeviceControl(partId, ...setup) ||
                            !board.setDeviceControl(partId, 'key', 'GO')) {
                            throw new Error('The KIM-1 could not start the paper-tape program.');
                        }
                        window.dispatchEvent(new CustomEvent('bw-kim1-control', {detail: {board, partId, run: true}}));
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                }, 0);
            };
            const cleanup = () => {
                clearTimeout(timeout);
                window.removeEventListener('bw-board-ready', ready);
            };
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('The KIM-1 circuit did not become ready.'));
            }, 15000);
            window.addEventListener('bw-board-ready', ready);
            this.setState(nextState);
        });
    }

    async loadExample (ex, opts) {
        if (ex?.files?.cardiac) return this.loadCardiacExample(ex, opts);
        // The Examples browser's device chip arrives here as opts.device
        // (with opts.bench naming the generated per-device circuit). It
        // used to be DROPPED: clicking Pico on any example loaded the
        // authored device anyway (owner report, 2026-08-17). The authored
        // circuit still outranks a generated bench for the example's own
        // device — the bench is a generic approximation.
        const pick = normalizeDeviceId(opts && opts.device) || null;
        const benchOverride = (opts && opts.bench) || null;
        const path = ex && ex.files && ex.files.circuit;
        if (!path) {
            // A micro:bit or SPIKE example ships no circuit because the DEVICE is
            // the board. Saying "lists no circuit file" for that is a fault report
            // about a correct state, and a lesson sends learners straight into it.
            // The predicate is shared with test/declared-pins-wired.test.mjs so the
            // surface and the gate cannot drift apart about what device-only means.
            const {deviceOnly, message} = noCircuitMessage(ex);
            this.setState({examplesError: message});
            return {ok: false, error: message, deviceOnly};
        }
        // An example with a program replaces the project, which undo cannot
        // recover — so ask, once, and say what is at stake. A circuit-only
        // example touches nothing but the board and needs no permission.
        // Whether the example ships a program file. The kind field is a
        // categorisation tag, not a file-presence gate: an example can be
        // kind:'circuit' (it is ABOUT a circuit) and still declare pins
        // that need loading. The gate must be the file, not the tag.
        const hasProgram = !(opts && opts.circuitOnly) && !ex.files?.cp1 && !!(ex.files && ex.files.program);
        if (hasProgram) {
            const msg = /^de/i.test(navigator.language)
                ? `„${ex.id}" öffnen?\n\nDas ersetzt das aktuelle Projekt — seine Blöcke, Pins und sein Board. Nicht Gespeichertes geht verloren.`
                : `Open "${ex.id}"?\n\nThis replaces the current project — its blocks, its pins and its board. Anything unsaved is lost.`;
            // Awaited: a native dialog in the desktop/iOS app (lib/native-dialog.js). With no
            // way to ask at all (a headless harness), go ahead, as before.
            const ok = await confirmAsync(msg, {unavailable: true});
            if (!ok) return {ok: false, cancelled: true};
        }
        this.setState({loadingExample: ex.id, examplesError: null});
        try {
            if (opts?.activateCircuit) {
                await this.load({explicit: true});
                window.dispatchEvent(new CustomEvent('bw-activate-tab', {detail: {index: 4}}));
            }
            // Which circuit: the authored one for the authored device, the
            // generated bench for a genuinely different picked device.
            let circuitPath = path;
            if (pick && hasProgram) {
                const pres = await fetch(`examples/${ex.files.program}`);
                if (!pres.ok) throw new Error(`program: HTTP ${pres.status}`);
                const psrc = await pres.text();
                const exDev = (psrc.match(/^DEVICE\s+([\w-]+)/im) || [])[1] || '';
                const resolved = resolveExampleBench(ex, pick, exDev, benchOverride);
                if (resolved.error) throw new Error(resolved.error);
                circuitPath = resolved.path || path;
            }
            const res = await fetch(`examples/${circuitPath}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            if (!data || !Array.isArray(data.parts) ||
                !(Array.isArray(data.wires) || Array.isArray(data.nets))) {
                throw new Error('not a circuit (no parts with wires or nets)');
            }
            const microtronicPart = data.parts.find(item => item.kind === 'busch-microtronic');
            const kim1Part = data.parts.find(item => item.kind === 'kim-1');
            const kim1Tape = opts?.kim1Tape;
            if (kim1Tape) {
                if (!kim1Part) throw new Error('The paper tape requires a KIM-1 circuit.');
                kim1Part.params = {...kim1Part.params, clockHz: 1000000, program: kim1Tape.program};
            }
            if (!kim1Part) this.selectKim1(null);
            if (ex.files?.cp1) {
                const sourceResponse = await fetch(`examples/${ex.files.cp1}`);
                if (!sourceResponse.ok) throw new Error(`CP1 program: HTTP ${sourceResponse.status}`);
                const source = await sourceResponse.text();
                const part = data.parts.find(item => item.kind === 'kosmos-cp1');
                if (!part) throw new Error('The CP1 example needs a CP1 board');
                const configuration = {expansion: part.params?.expansion === true,
                    clockHz: part.params?.clockHz || 6000000};
                const draft = {format: 'brickwright.cp1-workspace', version: 1, configuration, rom: null, source};
                // Persist before mounting the panel. A lazy debugger can miss the event.
                localStorage.setItem('bw-cp1-workspace', JSON.stringify(draft));
                const config = this.activateCp1Circuit(data, true);
                window.dispatchEvent(new CustomEvent('bw-cp1-source-load', {detail: {source, ...config}}));
            } else if (!data.parts.some(item => item.kind === 'kosmos-cp1')) {
                this.activateCp1Circuit(data);
            }
            // The program first: it calls vm.loadProject, which would otherwise
            // discard a circuit loaded a moment earlier. Its failure is not
            // fatal — a board with no pins is still a board, and the panel now
            // says why the debugger is absent — so the circuit still loads and
            // the reason is reported.
            let prog = null;
            let programError = null;
            if (hasProgram) {
                try {
                    prog = await this.loadExampleProgram(ex, pick);
                } catch (e) {
                    programError = e.message;
                }
            }
            // The example's faceplate, if it ships one — after the program,
            // whose vm.loadProject would have wiped a panel set earlier.
            // Non-fatal: a circuit without its widgets is still a circuit.
            // When a layout DID apply, surface it: dock the right pane on
            // the controller, else the shipped faceplate sits invisible
            // behind a toggle nobody knows to press.
            try {
                const applied = await this.applyControllerLayout(ex);
                if (kim1Part) {
                    this.selectKim1(kim1Part);
                    const panel = this.props.vm?.runtime?.controllerPanel;
                    const face = panel && addKim1Face(panel, kim1Part.id);
                    const video = panel && kim1Tape?.preset === 'video' && addKim1VideoFace(panel, kim1Part.id);
                    if (face || video) {
                        panel.setMode('play');
                        window.dispatchEvent(new CustomEvent('bw-controller-changed', {
                            detail: {data: serializeControllerPanel(panel)}
                        }));
                    }
                }
                if (microtronicPart) {
                    const panel = this.props.vm?.runtime?.controllerPanel;
                    if (panel && addMicrotronicFace(panel, microtronicPart.id)) {
                        panel.setMode('play');
                        window.dispatchEvent(new CustomEvent('bw-controller-changed', {
                            detail: {data: serializeControllerPanel(panel)}
                        }));
                    }
                    window.dispatchEvent(new CustomEvent('bw-microtronic-selected', {detail: {partId: microtronicPart.id}}));
                }
                if (applied || ex.files?.cp1 || kim1Part || microtronicPart) this.showControllerDock();
            } catch (e) {
                console.warn('[brickwright] example controller layout failed', e);
            }
            // The example's own ROM, if it ships one. Three machine benches
            // used to extract a machine cleanly and then boot with ZERO ROM
            // bytes — the bus extract was never the problem, there was simply
            // no image (D7). Now that sb3-creator builds and declares them,
            // the bench that HAS an image boots its own program instead of
            // asking the learner to pick a generic preset from the loader.
            //
            // Non-fatal on purpose, like the faceplate above: a machine with
            // no image is still the machine the example wires, and the
            // preset loader remains available. The event is the SAME one
            // CircuitDesigner's preset buttons dispatch, so it takes the
            // established path — this tab stashes it to window.__bwPendingMedia
            // and debug-panel applies it when the panel mounts, which is what
            // makes an example loaded BEFORE the debugger exists still boot.
            let wiredMedia = null;
            const wiredBoot = this.state.Designer?.supportsWiredExampleBoot &&
                data.parts.some(part => part.kind === 'w65c02');
            try {
                const romPath = ex.files && ex.files.rom;
                if (romPath) {
                    // The machine kind comes off the parts actually on the
                    // board, not off the example id or its category — the
                    // same test CircuitDesigner uses to decide it has a
                    // retro CPU at all.
                    const cpu = data.parts.find(pt => pt.kind === 'w65c02' || pt.kind === 'z80'
                        || pt.kind === 'i8086' || pt.kind === '8086'
                        || pt.kind === 'i8088' || pt.kind === '8088');
                    if (cpu) {
                        const rres = await fetch(`examples/${romPath}`);
                        if (!rres.ok) throw new Error(`HTTP ${rres.status}`);
                        const bytes = new Uint8Array(await rres.arrayBuffer());
                        // An 8086/8088 must not fall through to the 6502
                        // bench: its ROM would be run as 6502 opcodes and
                        // the panel would show a plausible, wrong machine.
                        // The 8088 shares the 8086's kind for the same
                        // reason the extractor and the core do — same
                        // instruction set, different bus width.
                        const kind = cpu.kind === 'z80' ? 'z80'
                            : /^(i8086|8086|i8088|8088)$/.test(cpu.kind) ? 'i8086'
                                : 'eater6502';
                        const media = {slotId: 'rom', bytes, kind, profile: null, name: romPath.split('/').pop()};
                        if (kind === 'eater6502' && wiredBoot) wiredMedia = media;
                        else window.dispatchEvent(new CustomEvent('bw-machine-media-load', {detail: media}));
                    }
                }
            } catch (e) {
                console.warn('[brickwright] example ROM load failed', e);
            }
            const pins = !!(prog && prog.pins);
            // Switching to the Designer is the point of clicking an example —
            // leaving the user on the gallery with an invisible change would be
            // the same silence this panel strip exists to avoid.
            const circuitData = kim1Tape ? {vcc: data.vcc, parts: [kim1Part], wires: [], fileOnly: true}
                : wiredBoot ? {...data, fileOnly: true, bootWiredExample: true}
                    : hasProgram ? data : {...data, fileOnly: true};
            this._wiredExample = wiredBoot ? {data: circuitData, media: wiredMedia} : null;
            const nextState = {
                // fileOnly tells the designer this circuit came with no
                // program: never rebuild it from whatever pins the previous
                // project left behind.
                circuitData,
                panel: 'designer',
                loadingExample: null,
                stc: this.readStc(),
                examplesError: programError ?
                    `Opened the circuit for "${ex.id}", but its program did not load ` +
                    `(${programError}), so there are no pins and no debugger.` : null
            };
            if (kim1Tape) await this.loadKim1TapeCircuit(circuitData, kim1Part.id, kim1Tape, nextState);
            else this.setState(nextState);
            // A loaded example is a named project, not the generic project
            // created by the SB3 converter. Keep the normal title reducer as
            // the single source used by the menu bar, save dialog and window.
            this.publishExampleTitle(kim1Tape ? {...ex, title: kim1Tape.title} : ex);
            // Machine-class devices (the 6502/Z80 benches) have no pin
            // concept — their debugger comes from the bus extract, not
            // from PIN lines. PART bindings drive pins without PIN lines.
            // Scolding either case was wrong (owner report, twice).
            const machineClass = prog && /^(eater6502|z80|zx48|zx128|6502|w65c02|i8086|8086|i8088|8088)$/.test(prog.device);
            if (hasProgram && !pins && !programError && prog && !prog.hasPart && !machineClass) {
                this.setState({examplesError:
                    `"${ex.id}" loaded, but its program declares no pins, so the ` +
                    'debugger stays hidden.'});
            }
            return programError ? {ok: false, error: programError} :
                {ok: true, circuitData: hasProgram ? data : {...data, fileOnly: true}};
        } catch (e) {
            this.setState({loadingExample: null, examplesError:
                `Could not open "${ex.id}": ${e.message}.`});
            return {ok: false, error: e.message};
        }
    }

    /** DRC warnings, or null when we cannot compute them (and why). */
    drcWarnings () {
        const {ui, circuit, board} = this.state;
        if (!ui || typeof ui.runDrc !== 'function') {
            return {error: 'noExport'};
        }
        if (!circuit) {
            return {error: 'noCircuit'};
        }
        try {
            return {warnings: ui.runDrc(circuit, board || circuit.board) || []};
        } catch (e) {
            // A checker that throws must not read as a clean circuit.
            // (Codes, not sentences: circuit-panels-model.js words them per locale.)
            return {error: 'failed', message: e.message};
        }
    }

    /**
     * The debugger's board is THE board.
     *
     * Without this the tab builds its own and the runner builds another, and the
     * one on screen is not the one the emulator is driving — LEDs stay dark while
     * the program blinks them. Boundary A × D needs nothing more than handing the
     * same instance over: a halted MCU stops calling advanceTo, so the board
     * freezes coherently and no pause() is needed (DEBUG-CONTROL-MODEL §3.1).
     */
    handleRunnerChange (runner, ui) {
        if (this._coupledBoard) return;
        // An accepted touch-up emits inside release(). It must not recreate
        // the owner being released, including during this component's unmount.
        if (this._releasingEsp32S040Input) return;
        const board = runner.board();
        // The runner builds its own board for a run; it sits on the same bench.
        applyBenchTemperature(board, this.state.benchC);
        // A stopped runner must not leave a ghost session on screen: after
        // Stop the phase is 'idle' (or 'error'), ui.session is stale or
        // null, and passing the last debugState through kept the designer's
        // status panel glowing green RUNNING forever. No session — no panel.
        const phase = ui && ui.phase;
        const previousS040 = this._esp32S040InputOwner;
        const ownerId = runner.esp32S040PartId || null;
        if (previousS040 && (previousS040.runner !== runner || previousS040.partId !== ownerId ||
            phase === 'idle' || phase === 'error')) this.releaseEsp32S040Input();
        if (ownerId && phase !== 'idle' && phase !== 'error' && !this._esp32S040InputOwner) {
            this._esp32S040InputOwner = this.createEsp32S040InputOwner(runner, ownerId);
        }
        const s040 = this._esp32S040InputOwner || null;
        const s040Changed = s040 !== (previousS040 || null);
        // A runner update already carries a complete snapshot. Live progress
        // arrives periodically, but an unchanged phase is not another phase
        // transition: dispatching it again wakes every guided-lesson observer
        // for no new fact. Distinct phases still dispatch on the same update
        // that announced them, including pause/error/idle.
        const runnerChanged = Boolean(this._lastDebugRunner && runner !== this._lastDebugRunner);
        const phaseTransition = advanceDebugPhase(this._lastDebugPhase, phase, runnerChanged);
        this._lastDebugPhase = phaseTransition.next;
        this._lastDebugRunner = phase ? runner : null;
        if (typeof window !== 'undefined' && phaseTransition.dispatch) {
            window.dispatchEvent(new CustomEvent('bw-debug-phase', {detail: {phase}}));
        }
        if (phase === 'idle' || phase === 'error') {
            // ...and no session, no loan of the display either. The runner's
            // board stays on screen only while its run lives: kept after a
            // stop, it outlived every later green flag, and the designer kept
            // showing a board nothing drove while the Scratch VM's blocks wrote
            // the designer's own (task B8, measured on production). Handed
            // back, the designer resumes its own board's clock.
            if (this.state.debugState !== null || this.state.board !== null) {
                this._markReactUpdate('host:runner-state');
                this.setState({debugState: null, board: null});
            }
            if (typeof window !== 'undefined' && window.__activeBoard === board) {
                window.__activeBoard = window.__board || null;
            }
            return;
        }
        // GAP C fix: rebind the diagnostic hook to the ACTIVE board while a
        // debug session is attached. window.__board is set once by onBoardReady
        // (the designer's own board), but during a debug run the active board
        // is the runner's — one-board-one-truth says reads follow the active
        // board, and a diagnosis hook that lies costs a full probe cycle.
        if (board && typeof window !== 'undefined') window.__activeBoard = board;
        const halted = !!(ui && ui.session && ui.session.halted);
        const why = ui && ui.session && ui.session.why;
        // The designer reads debugState.tasks and .capabilities, and this passed
        // neither — so its Level 1 position panel and its active-part highlight
        // both received undefined and silently rendered nothing. Optional
        // chaining on their side meant nothing errored: the fifth time in two
        // days a value was written for a consumer, or read from a producer,
        // that did not exist. Enriched with the block id, which only the runner
        // can supply — it holds the (task, state) -> block map.
        const kinds = ui && ui.yieldKinds;
        // Do not call runner.state() here. `ui` IS the snapshot produced for
        // this update, and its session already carries the live task list.
        // Calling state() again rebuilt breakpoint arrays, maps, conditions,
        // serial lines and scheduler position a second time for every publish.
        const tasks = (why && why.tasks ? why.tasks :
            (ui && ui.session ? ui.session.tasks : null)) || null;
        const enriched = tasks && tasks.map(t => {
            const blockId = ui && ui.blockOfTask ? ui.blockOfTask[`${t.task}/${t.state}`] : undefined;
            // A raw Scratch block id ("FWr0@1h…") on screen is worse than
            // nothing; only this side owns the VM, so the human label is
            // resolved here and the designer renders label, never blockId.
            return {...t, blockId, label: blockId ? this.labelForBlock(blockId) : undefined,
                kind: blockId && kinds ? kinds[blockId] : undefined};
        });
        const haltReason = why ? why.cause : null;
        // bwMs: the cooperative scheduler's millisecond tick, read from RAM via
        // the symbol table's bw_ms address. undefined before symbols exist (no
        // fabricated zero — see ceafc8d).
        const bwMs = ui ? ui.bwMs : undefined;
        const caps = ui ? ui.capabilities : null;
        const prev = this.state.debugState || {};
        // CONTENT comparison, not identity: `enriched` is a fresh array on
        // every runner emit — emits come once per rAF pump frame — so the
        // old `enriched !== prev.tasks` guard was always true and this
        // setState re-rendered the entire tab subtree at 60 Hz throughout
        // a run (the dominant React cost in the run-mode CPU profile,
        // after the canvas layers were memoized). The ms tick alone must
        // not force a frame either: a live counter is readable at 4 Hz.
        const tasksStamp = enriched
            ? enriched.map(t => `${t.task}/${t.state}/${t.blockId || ''}`).join('|')
            : null;
        const msMoved = (typeof bwMs === 'number' && typeof prev.bwMs === 'number')
            ? Math.abs(bwMs - prev.bwMs) >= 250
            : bwMs !== prev.bwMs;
        // Keep the established top-dock serial content stamp. The full
        // DebugPanel owns the console, but this also preserves the compact
        // designer status publication contract when that dock is selected.
        const so = ui && ui.serialOutput;
        const serialStamp = so ? `${so.length}:${(so[so.length - 1] || '').length}` : '';
        const now = Date.now();
        const floorDue = (now - (this._debugStateAt || 0)) >= DEBUG_LIVE_REFRESH_MS;
        // The DebugPanel owns serial and its full live UI. CircuitDesigner
        // consumes only board/halt state plus DebugStatus when docked top/solo.
        // With the default right dock, pushing an otherwise unused 4 Hz state
        // object made React reconcile the entire designer (~8.5 ms per publish
        // in the production receipt). Preserve immediate structural changes;
        // do not wake a hidden consumer for progress it cannot display.
        if (shouldRefreshDesignerDebugState({
            dock: this.state.debugDock,
            boardChanged: board !== this.state.board || s040Changed,
            haltedChanged: halted !== prev.halted,
            haltReasonChanged: haltReason !== prev.haltReason,
            tasksChanged: tasksStamp !== (prev._tasksStamp ?? null),
            serialChanged: serialStamp !== (prev._serialStamp ?? ''),
            msMoved,
            capabilitiesChanged: caps !== prev.capabilities,
            floorDue
        })) {
            this._debugStateAt = now;
            this._markReactUpdate('host:runner-state');
            this.setState({
                board,
                debugState: {
                    esp32S040PartId: s040?.partId || null,
                    onEsp32S040Input: s040?.input || null,
                    video: s040?.video,
                    halted,
                    skewNs: why ? why.skewNs : 0n,
                    haltReason,
                    bwMs,
                    tasks: enriched,
                    _tasksStamp: tasksStamp,
                    _serialStamp: serialStamp,
                    capabilities: caps,
                    // D29. The designer's DebugStatus renders its watchpoint
                    // field only when `onAddWatchpoint` is a function, and it
                    // is handed `debugState.addWatchpoint` — which nothing here
                    // ever set, so the field could not appear no matter what
                    // the emulator supported. The defect ledger recorded this
                    // as a missing WASM export; the export was there all along
                    // (instantiated and checked), and the consumer was the gap.
                    // Producer-must-assert-consumer, from the other side.
                    //
                    // The space is iram because that is where the C target's
                    // scheduler variables live and where a learner's `counter`
                    // is; the drawer offers the other spaces by name.
                    addWatchpoint: addr => {
                        const r = runner.toggleWatchpoint
                            ? runner.toggleWatchpoint('iram', addr) : null;
                        // Surface a refusal rather than dropping it: the whole
                        // point of this feature is that an armed watchpoint is
                        // really armed.
                        if (r && r.refused && typeof window !== 'undefined') {
                            window.alert(r.refused);
                        }
                        return r;
                    },
                    // Step-over and step-out were the same shape of gap: the
                    // buttons render from `capabilities` and called undefined.
                    stepOver: () => runner.stepOver(),
                    stepOut: () => runner.stepOut(),
                    runToAddress: address => runner.runToAddress(address)
                }
            });
        }
    }

    /** The Debug pane tore its runner down (new program, new firmware, a
     *  reboot, unmount): its board is no longer anything's, so the designer
     *  takes its own back (task B8). */
    handleRunnerGone () {
        this.releaseEsp32S040Input();
        if (this.state.board === null && this.state.debugState === null) return;
        this._markReactUpdate('host:runner-state');
        this.setState({board: null, debugState: null});
    }

    createEsp32S040InputOwner (runner, partId) {
        let active = true;
        let pressed = false;
        return {
            runner, partId,
            video: () => active && typeof runner.video === 'function' ? runner.video() : null,
            input: changes => {
                if (!active) return {accepted: false, reason: 'This S040 input owner has been released'};
                const result = runner.setInputs(changes);
                if (result?.accepted) {
                    for (const change of changes) {
                        if (change.component === 'touch' && change.channel === 'pressed') pressed = change.value === 1;
                    }
                }
                return result;
            },
            release: () => {
                if (!active) return;
                active = false;
                if (pressed) {
                    pressed = false;
                    runner.setInputs([{component: 'touch', channel: 'pressed', value: 0}]);
                }
            }
        };
    }

    releaseEsp32S040Input () {
        const owner = this._esp32S040InputOwner;
        this._esp32S040InputOwner = null;
        if (!owner) return;
        this._releasingEsp32S040Input = true;
        try { owner.release(); }
        finally { this._releasingEsp32S040Input = false; }
    }

    /** Resolve a Scratch block id to something a person can read: the
     *  block's opcode with its extension prefix dropped and underscores
     *  spaced ("stc12_setpin" → "setpin"). Null when the block is gone —
     *  the caller renders nothing rather than an opaque id. */
    labelForBlock (blockId) {
        const vm = this.props.vm;
        const targets = vm && vm.runtime && vm.runtime.targets;
        if (!targets) return null;
        for (const t of targets) {
            const b = t.blocks && t.blocks.getBlock && t.blocks.getBlock(blockId);
            if (b && b.opcode) {
                const bare = b.opcode.includes('_') ? b.opcode.slice(b.opcode.indexOf('_') + 1) : b.opcode;
                return bare.replace(/_/g, ' ');
            }
        }
        return null;
    }

    /** The project's own hardware declarations — device, clock, and the pin table.
     *
     * They live on the runtime, not in the serialised project: scratch-vm's sb3
     * serializer emits targets/monitors/extensions/meta and drops every other
     * top-level key, so the `stc` block that SB3Creator writes into the .sb3 never
     * came back out of vm.toJSON(). This read used to be that one, which is why the
     * designer opened empty for every project, hardware or not. */
    readStc () {
        const vm = this.props.vm;
        if (vm && vm.runtime && vm.runtime.stc) return vm.runtime.stc;
        try { return JSON.parse(vm.toJSON()).stc || null; } catch { return null; }
    }

    render () {
        const {Designer, error, reloading, stc} = this.state;
        // overflow:clip prevents deep sidebar scrolls from shifting the page.
        // But clip on its own cuts off anything taller than the tab with no way
        // to reach it — the parts palette ended below the fold at "09 Shift Reg"
        // with no bottom edge, and the multimeter the same. A column flex box
        // gives the designer the remaining height explicitly, and `minHeight: 0`
        // is what lets a flex child actually shrink and scroll instead of
        // growing past its parent (the default `min-height: auto` is exactly
        // why this looked like a clipping bug rather than a sizing one).
        // `width: 100%` is not redundant with a block element's default: the
        // tab panel upstream is `display: flex`, so this root is a FLEX ITEM,
        // and a flex item's default `flex-grow: 0` sizes it to its content. It
        // measured 1313px inside a 1400px panel — the leftover strip that made
        // "Full width" look like it was not reclaiming the whole width. The
        // stage was hidden correctly the whole time; the tab simply never grew
        // into the space it was given. `flex` is stated too, so this does not
        // depend on which of the two upstream happens to honour.
        // minHeight:0 breaks the flex min-height:auto trap so the designer
        // content can scroll when portalled into the right pane (where the
        // host has overflow:auto). Without it, the box grows to its content
        // height and the portal host clips silently.
        const box = {height: '100%', width: '100%', flex: '1 1 auto', minHeight: 0,
            overflow: 'auto', padding: 8, boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column'};
        // Claim the real viewport once we know where the box starts —
        // see _measureBox. The portal path keeps the stage host's sizing.
        if (!this._portalOn && this.state.boxTop != null) {
            // HEIGHT only. Width claims override the GUI's right-pane
            // splitter and, in the Code-mode portal, laid the debugger out
            // for a phantom 1992px column (owner reports; the first attempt
            // at this fix was reverted by a concurrent agent's reset --hard
            // between edit and commit — verify the COMMITTED bytes).
            box.height = `calc(100vh - ${this.state.boxTop + 4}px)`;
        }
        // Nothing below returns a portal until it says so. componentDidUpdate
        // shows the stage host only when this is true, so the three early
        // returns here (reloading / error / designer not loaded) leave the
        // Scratch stage visible instead of covering it with a white box.
        this._portalRendered = false;
        if (reloading) {
            return (
                <div role="status" style={{...box, padding: 24, color: '#64748b'}}>
                    {pt(this.props.locale, 'app.republished')}
                </div>
            );
        }
        if (error) {
            // Reached only when recovery declined: not a stale build, or the
            // one-shot is spent (a second failure is a real bug, not a deploy
            // race, and looping the reload would hide it). Offer the manual
            // action rather than leaving a dead panel — the user's tab may have
            // been open across two deploys, which is not their fault.
            // Laid out as the Robot Lab tab's states: a centred message, one action.
            return (
                <div style={{...box, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24}}>
                    <p role="alert" style={{maxWidth: 460, margin: 0, textAlign: 'center', color: '#b91c1c', fontSize: 14}}>
                        {pt(this.props.locale, 'designer.failed', {error})}
                    </p>
                    <button
                        type="button"
                        style={{padding: '8px 16px', borderRadius: 8, border: '1px solid #4338ca', background: '#4f46e5',
                            color: '#fff', fontWeight: 600, cursor: 'pointer'}}
                        onClick={() => {
                            try {
                                sessionStorage.removeItem('bw-chunk-recovery');
                            } catch { /* private mode */ }
                            location.reload();
                        }}
                    >
                        {pt(this.props.locale, 'designer.reload')}
                    </button>
                </div>
            );
        }
        // Debugger-only right pane: docks 'solo' AND 'right' give the
        // DebugPanel the stage column while coding — 'right' used to fall
        // through to the FULL DESIGNER portal squeezed into ~350px: the
        // canvas swallowed the width, the instruments column was clipped
        // off, and the owner met an "unusable debugger" whose clicks landed
        // on breadboard SVG (report, 2026-08-17). While coding, a debugger
        // dock means the DEBUGGER. It deliberately does not wait for the
        // Designer chunk (the panel has its own Suspense), and it only
        // applies while portalled: on the dedicated Circuit tab, 'right'
        // keeps the designer beside the panel (below) and 'solo' falls back
        // to the instruments-column dock, so the designer stays reachable.
        if ((this.state.debugDock === 'solo' || this.state.debugDock === 'right') &&
            this._stagePortalOn() && !this.state.cadCircuitRequested) {
            this._portalOn = true;
            const solo = (
                // paddingTop clears the stage-header row: the panel (and the
                // no-code warning) rendered flush against the tab strip and
                // read as misplaced (owner report, 2026-08-17 — and 7 hours
                // before that).
                <div style={{...box, overflow: 'auto', paddingTop: 48}} data-debugger-solo-pane>
                    <HostMount host={this._ensureDebugHost()} />
                </div>
            );
            this._portalRendered = true;
            return [
                ReactDOM.createPortal(solo, this._stageHost),
                ReactDOM.createPortal(this.renderDebugPanel(), this._ensureDebugHost(), 'debug-panel')
            ];
        }
        if (!Designer) {
            // Loading the circuit designer changes only the view. Keep the
            // already-running debugger portal mounted while that chunk loads;
            // unmounting DebugPanel destroys its runner and replays the media.
            return [
                <div key="designer-loading" role="status" style={{...box, padding: 24, color: '#64748b'}}>
                    {pt(this.props.locale, 'designer.loading')}
                </div>,
                (this.state.machineBooted || stcDrives(stc) || !this.state.rightPaneHidden) &&
                    ReactDOM.createPortal(this.renderDebugPanel(), this._ensureDebugHost(), 'debug-panel')
            ];
        }
        // CAD preparation needs the actual Designer to instantiate its Board,
        // even while the default right/solo dock shows only the debugger.
        this._portalOn = !this.state.cadCircuitRequested && this._stagePortalOn();
        // On the dedicated Circuit tab 'solo' behaves as 'top': the designer
        // with the compact debugger in its Instruments column.
        const cp1ControllerDock = this.state.debugDock === 'controller' && ['cp1', 'cardiac', 'kim1'].includes(window.__bwMachineExtracted?.kind);
        const dock = this.state.debugDock === 'solo' || cp1ControllerDock ? 'top'
            : CIRCUIT_DOCKS.has(this.state.debugDock) ? this.state.debugDock : 'off';
        const content = (
            <div ref={this._boxRef} style={box} onPointerDown={() => activateUndoSurface('circuit')}>
                {/* The standalone-circuit invitation and the debugger hint used to render here
                    as two dismissible orange ▲ banners. Removed at the owner's request: they
                    pushed the board down and duplicated the top-bar Warnings selector, which
                    (with its count) is now the single home for anything the user needs flagged.
                    The guidance they carried lives in the Examples/docs, not a persistent banner. */}
                <div style={{display: 'flex', flex: '1 1 auto', minHeight: 0, gap: 8}}>
                <div style={{flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column'}}>
                {/* The tab container is `overflow: clip` so a deep sidebar scroll cannot
                    shift the page. That is right for the designer, whose palette and panels
                    scroll internally — but these panels do not. A 53-row parts list or a
                    long warnings list would be clipped with no way to reach the rest of it:
                    content silently absent, which is the failure this strip exists to avoid.
                    So the panel body carries its own scroll. */}
                {this.state.panel === 'designer' ? null : (
                    <div style={{flex: '1 1 0', minHeight: 0, height: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column'}}>
                        {this.renderPanel()}
                    </div>
                )}
                {/* The designer stays mounted whatever panel is showing: it owns the
                    circuit, the board and the emulator's view of both, and unmounting
                    it to show a parts list would tear all three down and rebuild them
                    on the way back. Hidden, not destroyed. */}
                <div style={this.state.panel === 'designer' ?
                    {flex: '1 1 auto', minHeight: 0, overflow: 'auto'} : {display: 'none'}}>
                    {profileReactSubtree(React, 'CircuitDesigner', (<Designer
                        cpxState={this.state.cpxState}
                        onCpxInput={this.state.handleCpxInput}
                        esp32S040PartId={this.state.debugState?.esp32S040PartId || null}
                        onEsp32S040Input={this.state.debugState?.onEsp32S040Input || null}
                    performanceProbe={this._performanceProbe}
                    stc={stc}
                    examples={this.state.examples || undefined}
                    examplesError={this.state.examplesError}
                    curriculum={this.state.curriculum || undefined}
                    onOpenExamples={this.openInlineExamples}
                    onLoadExample={this.loadExample}
                    board={this.state.board || undefined}
                    debugState={this.state.debugState || undefined}
                    onEditorMenuActions={this.handleDesignerMenuActions}
                    onCircuitReady={c => { window.__circuit = c; if (this.props.vm && this.props.vm.runtime) this.props.vm.runtime.circuitModel = c; this.handleCircuitReady(c); }}
                    circuitData={this.state.circuitData || undefined}
                    microtronicInstruments={false}
                    kim1Instruments={window.__bwMachineExtracted?.kind !== 'kim1'}
                    onWiredBootReady={this.handleWiredBootReady}
                    onBoardReady={(board) => {
                        // Same diagnosis hook the standalone harness exposes —
                        // production incidents get measured, not guessed at.
                        window.__board = board;
                        applyBenchTemperature(board, this.state.benchC);
                        // Publish the board so the Code tab's sim runner can use it
                        // instead of building its own. One board, one truth.
                        const vm = this.props.vm;
                        if (vm && vm.runtime) {
                            vm.runtime.circuitBoard = board;
                            this.selectKim1(board.getParts?.().find(part => part.kind === 'kim-1'));
                            const cardiac = window.__bwMachineExtracted;
                            if (cardiac?.kind === 'cardiac' && cardiac.config?.partId && this._cardiacAttachedBoard !== board &&
                                board.getParts?.().some(part => part.kind === 'cardiac' && part.id === cardiac.config.partId)) {
                                this._cardiacAttachedBoard = board;
                                window.dispatchEvent(new CustomEvent('bw-machine-extracted', {detail: cardiac}));
                            }
                            // A published board mutates independently of debugger props.
                            // Publish only changes to the S040 selection to avoid render loops.
                            const ids = s040PartIds(board);
                            if (!sameS040PartIds(ids, this.state.s040PartIds)) {
                                this.setState({s040PartIds: ids});
                            }
                            // Producer-asserts-the-consumer: verify the circuit extension
                            // can read it (it uses a lazy getter on this.runtime.circuitBoard).
                            console.assert(vm.runtime.circuitBoard === board,
                                'circuitBoard not readable from runtime');
                            // The Widgets tab resolves this board through an
                            // epoch — announce it, since the circuit-ready
                            // event fires before the board exists.
                            window.dispatchEvent(new CustomEvent('bw-board-ready'));
                        }
                    }}
                    simulationOnly={(() => {
                        // Read stc12liveCapabilities from runtime.
                        // If a live hardware target is connected, simulation-only
                        // features (voltage, current, brightness) are unavailable.
                        const vm = this.props.vm;
                        const caps = vm && vm.runtime && vm.runtime.stc12liveCapabilities;
                        if (caps) return false; // live hardware → no sim values
                        return undefined; // default: simulator assumed
                    })()}
                        onCircuitEdit={this.handleCircuitEdit}
                        onOpenMachineLibrary={(kind, presets) => window.dispatchEvent(new CustomEvent('bw-open-machine-manager',
                            {detail: {kind, presets}}))}
                        onDeclarationChange={this.handleDeclarationChange}
                        panelNav={this.renderPanelStrip()}
                        lang={String(this.props.locale || 'en').slice(0, 2) === 'de' ? 'de' : 'en'}
                        // The control is the designer's (its "More circuit controls"
                        // menu, bw-circuit-ui BenchTemperature.jsx); the value is ours.
                        benchTemperature={this.state.benchC}
                        onBenchTemperatureChange={this.handleBenchTemperature}
                    embedded={this._portalOn}
                    // The debugger belongs to the designer's Instruments
                    // column in both the Code Blocks portal and the dedicated
                    // Circuit tab. The old visibility guard made “switch to
                    // debugger” a no-op whenever Circuit itself was active.
                    debuggerOn={dock === 'top'}
                    debuggerPanel={dock === 'top' ? <HostMount host={this._ensureDebugHost()} /> : null}
                    // The >> / << move buttons in the Designer's instruments
                    // debugger header (cui 526dc9b) are gated on this
                    // callback — without it they never rendered, and the
                    // owner's 'move the debugger to the right pane' spec
                    // silently had no UI. Persist + broadcast so the
                    // stage-header view buttons stay in sync.
                    debugDock={dock}
                    onDebugDockChange={(d) => {
                        try { localStorage.setItem('bw-debug-dock', d); } catch { /* private mode */ }
                        this.setDock(d);
                        window.dispatchEvent(new CustomEvent('bw-settings-change',
                            {detail: {key: 'bw-debug-dock', value: d}}));
                    }}
                    // Remount-proof "a machine was built here": the designer's
                    // own machineResult dies with it on a tab switch, and the
                    // debugger slot must survive the Code-tab round trip the
                    // ASM workflow requires. This state lives up here and does.
                    benchOpen={this.state.machineBooted}
                        runToken={this.state.runToken}
                        stopToken={this.state.stopToken}
                        onSimulationStart={this.handleSimulationStart}
                    />))}
                </div>
                </div>
{/* dock 'right' renders in the ACTUAL right pane (the stage
                    column, right of the GUI splitter) via the stage-host portal
                    below — the inline column that sat BETWEEN the instruments
                    and the splitter is gone (owner screenshot, 2026-08-17). */}
                </div>
            </div>
        );
        const panelPortal = ReactDOM.createPortal(
            this.renderDebugPanel(), this._ensureDebugHost(), 'debug-panel');
        if (this._portalOn) {
            this._portalRendered = true;
            return [ReactDOM.createPortal(content, this._stageHost), panelPortal];
        }
        // Dedicated Circuit tab, dock 'right': the panel lives in the REAL
        // right pane — the stage column beyond the movable splitter.
        this._stageRightRendered = false;
        let stagePane = null;
        if (this.state.debugDock === 'right' && this.state.showInStage) {
            const host = this._ensureStageHost();
            if (host) {
                this._stageRightRendered = true;
                stagePane = ReactDOM.createPortal(
                    <div style={{height: '100%', width: '100%', boxSizing: 'border-box',
                        overflow: 'auto', padding: 8, paddingTop: 48,
                        display: 'flex', flexDirection: 'column'}} data-debugger-solo-pane>
                        <HostMount host={this._ensureDebugHost()} />
                    </div>, host);
            }
        }
        return [content, stagePane, panelPortal];
    }

    /** One DebugPanel instance, rendered through ONE portal into ONE
     *  persistent DOM node (_ensureDebugHost). Docking moves the NODE
     *  between slots (HostMount adopts it), so the panel never remounts
     *  and a running session SURVIVES every dock change — including
     *  '>>' to the right pane and back (owner requirement, 2026-08-17). */
    renderDebugPanel () {
        const {stc} = this.state;
        const machine = window.__bwMachineExtracted;
        if (machine?.kind === 'kim1') return <PanelBoundary>
            <React.Suspense fallback={null}>
                <Kim1Surface vm={this.props.vm} partId={machine.config.partId}
                    locale={this.props.locale} variant="debugger" />
            </React.Suspense>
        </PanelBoundary>;
        return (
            <PanelBoundary>
                <React.Suspense fallback={null}>
                    {profileReactSubtree(React, 'DebugPanel', (<DebugPanel
                        clockHz={(stc && Number(stc.clock)) || 11059200}
                        runToken={this.state.runToken}
                        runMachineOnFlag={this.state.runMachineOnFlag}
                        stopToken={this.state.stopToken}
                        s040PartIds={this.state.s040PartIds}
                        onRunnerChange={this.handleRunnerChange}
                        onRunnerGone={this.handleRunnerGone}
                    />))}
                </React.Suspense>
            </PanelBoundary>
        );
    }

    /**
     * The bench temperature control (rendered by the designer). Every board this tab shows moves with it:
     * the designer's (which the Scratch VM's reporters read through
     * runtime.circuitBoard) and a debug runner's while its run lives.
     */
    handleDesignerMenuActions (actions) {
        if (!this._menuMounted) return;
        this._designerMenuActions = Array.isArray(actions) ? actions : [];
        notifyEditorMenuActions();
    }

    editorMenuActions () {
        if (!this._menuMounted || this.props.isVisible !== true || getUndoState().surface !== 'circuit') return null;
        const entries = Object.create(null);
        const de = String(this.props.locale || '').startsWith('de');
        // The designer's file commands replace the host File bridge, so they sit
        // flat in File with the host's names. The supplier's `file` group key is
        // not a label to show.
        const fileLabels = de ?
            {open: 'Schaltung öffnen…', save: 'Schaltung speichern', import: 'Schaltung importieren…', export: 'Schaltung exportieren…'} :
            {open: 'Open circuit…', save: 'Save circuit', import: 'Import circuit…', export: 'Export circuit…'};
        // Older qualified CUI pins simply omit this optional publication. The
        // original host File bridge remains available until supplier adoption.
        for (const action of this._designerMenuActions || []) {
            if (!action || ['undo', 'redo'].includes(action.name) || typeof action.name !== 'string' ||
                typeof action.label !== 'string' || typeof action.run !== 'function' ||
                !['file', 'edit'].includes(action.location)) continue;
            const entry = {...action, enabled: action.enabled === true};
            if (action.location === 'file') {
                delete entry.submenu;
                if (Object.hasOwn(fileLabels, action.name)) entry.label = fileLabels[action.name];
            }
            entries[action.name] = entry;
        }
        const panels = de ? [['designer', 'Designer'], ['warnings', 'Schaltungsprüfung'], ['bom', 'Stückliste'], ['examples', 'Beispiele']] :
            [['designer', 'Designer'], ['warnings', 'Circuit Check'], ['bom', 'Parts list'], ['examples', 'Examples']];
        for (const [panel, label] of panels) {
            entries[`host-panel-${panel}`] = {label, location: 'edit', submenu: de ? 'Bereiche' : 'Panels',
                enabled: true, checked: this.state.panel === panel, radio: true, run: () => this.setState({panel})};
        }
        return entries;
    }

    handleBenchTemperature (value) {
        const c = clampBenchTemperature(value);
        if (c === null) return;
        saveBenchTemperature(c);
        if (c !== this.state.benchC) this.setState({benchC: c});
        const vm = this.props.vm;
        const boards = new Set([this.state.board, typeof window === 'undefined' ? null : window.__board,
            vm && vm.runtime ? vm.runtime.circuitBoard : null]);
        for (const board of boards) applyBenchTemperature(board, c);
    }

    /** Show one of the tab's panels and fetch the example catalog on demand. */
    selectPanel (panel) {
        this.setState({panel});
        if (panel === 'examples') this.loadExamplesGallery();
    }

    /**
     * Designer | Warnings | Parts list | Examples (circuit-panels.jsx, loaded with the
     * designer). In the designer's toolbar this is its panel navigation; the other panels
     * carry it in their own header row.
     */
    renderPanelStrip () {
        const {panels, panel} = this.state;
        if (!panels) return null;
        return <CircuitPanelNavigation Switch={panels.PanelSwitch} panel={panel} drc={this.drcWarnings()}
            locale={this.props.locale} onSelect={this.selectPanel} />;
    }

    renderPanel () {
        const {panels, panel, ui, circuit, examples, examplesError} = this.state;
        if (!panels || panel === 'designer') return null;
        const stc = this.readStc();
        return (
            <panels.PanelView
                panel={panel}
                locale={this.props.locale}
                onSelect={this.selectPanel}
                drc={this.drcWarnings()}
                ui={ui}
                circuit={circuit}
                examples={examples}
                examplesError={examplesError}
                currentDevice={stc && stc.device ? String(stc.device).toLowerCase() : null}
                onLoadExample={this.loadExample}
                onDismissError={() => this.setState({examplesError: null})}
            />
        );
    }
}

CircuitTab.propTypes = {
    isProjectCreating: PropTypes.bool,
    isVisible: PropTypes.bool,
    onSetProjectTitle: PropTypes.func,
    onShowCircuit: PropTypes.func,
    vm: PropTypes.shape({runtime: PropTypes.object, toJSON: PropTypes.func}).isRequired
};

export default connect(state => ({
    vm: state.scratchGui.vm,
    locale: state.locales.locale,
    isProjectCreating: getIsAnyCreatingNewState(state.scratchGui.projectState.loadingState),
    isVisible: state.scratchGui.editorTab.activeTabIndex === 4
}), dispatch => ({
    onSetProjectTitle: title => dispatch(setProjectTitle(title)),
    onShowCircuit: () => dispatch(activateTab(4))
}))(CircuitTab);
