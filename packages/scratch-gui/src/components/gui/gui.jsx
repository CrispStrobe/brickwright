import {addAceKimFace} from '../../lib/controller-machine-faces.js';
import '../../lib/bw-color-mode.css';
import classNames from 'classnames';
import omit from 'lodash.omit';
import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import {clearControllerPanel, connectControllerBoard, serializeControllerPanel} from '../../lib/controller-inputs.js';
import LogikusHost from '../tw-pseudocode/logikus-host.jsx';
import {Cp1Surfaces} from '../tw-pseudocode/cp1-surfaces.js';
import {CardiacSurfaces} from '../tw-pseudocode/cardiac-surfaces.js';
import {defineMessages, FormattedMessage, injectIntl, intlShape} from 'react-intl';
import {connect} from 'react-redux';
import MediaQuery from 'react-responsive';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import EditorHelp from './editor-help.jsx';
import CircuitTab from '../tw-pseudocode/circuit-tab.jsx';
import {setCircuitView} from '../../lib/bw-debug/debug-view.js';
import {getCadEnabled, setCadEnabled as setCadPreference, CAD_TOGGLE_EVENT, CAD_OPEN_EVENT} from '../../lib/bw-cad-preferences.js';
import {getFpgaEnabled, FPGA_TOGGLE_EVENT} from '../../lib/bw-fpga-preferences.js';
import {pinsToValue} from '../../lib/bw-fpga/pin-value.js';
// FpgaTab ships only in a build that carries it (BW_ENABLE_FPGA), and even then
// loads LAZILY: its synthesis/simulation code must not weigh on first paint, and
// most users never open it. React.lazy keeps the whole surface in a chunk fetched
// only when the tab is shown. In a build WITHOUT the flag, DefinePlugin makes the
// condition a literal false and the import() lives in a dead branch, so no FPGA
// code is emitted — the build-time drop the payload guards depend on is intact.
const FpgaTab = process.env.BW_ENABLE_FPGA
    ? React.lazy(() => import(/* webpackChunkName: "bw-fpga-tab" */ '../tw-pseudocode/fpga-tab.jsx'))
    : null;
const CadTab = process.env.BW_ENABLE_CAD
    ? React.lazy(() => import(/* webpackChunkName: "bw-cad-tab" */ '../tw-pseudocode/cad-tab.jsx'))
    : null;
const MicrobitSimPane = React.lazy(() =>
    import(/* webpackChunkName: "bw-microbit-sim" */ '../tw-pseudocode/microbit-sim-pane.jsx')
);
const ArcadeDevicePane = React.lazy(() =>
    import(/* webpackChunkName: "bw-arcade-device" */ '../tw-pseudocode/arcade-device-pane.jsx')
);
const CpxDevicePane = React.lazy(() =>
    import(/* webpackChunkName: "bw-cpx-device" */ '../tw-pseudocode/cpx-device-pane.jsx')
);
const GameTouchControls = React.lazy(() =>
    import(/* webpackChunkName: "bw-game-touch-controls" */ '../tw-pseudocode/game-touch-controls.jsx')
);
const ArduboyPane = React.lazy(() =>
    import(/* webpackChunkName: "bw-arduboy" */ '../tw-pseudocode/arduboy-pane.jsx'));
const MakeCodeSimPane = React.lazy(() =>
    import(/* webpackChunkName: "bw-makecode-sim" */ '../tw-pseudocode/makecode-sim-pane.jsx'));
// One persistent SPIKE world, with independently selected execution backends.
const SpikeSimulatorPane = React.lazy(() =>
    import(/* webpackChunkName: "bw-spike-simulator" */ '../tw-pseudocode/spike-simulator-pane.jsx'));
const ControllerPanelView = React.lazy(() =>
    import(/* webpackChunkName: "bw-controller-panel" */ '../tw-pseudocode/controller-panel-view.jsx')
);
import tabStyles from 'react-tabs/style/react-tabs.css';
import VM from 'scratch-vm';
import Renderer from 'scratch-render';

import Blocks from '../../containers/blocks.jsx';
import CostumeTab from '../../containers/costume-tab.jsx';
const TargetPane = React.lazy(() => import(/* webpackChunkName: "sprite-target-pane" */ '../../containers/target-pane.jsx'));
import LazySoundTab, {preloadSoundTab} from '../../containers/lazy-sound-tab.jsx';
import LazyPseudocodeImporter, {
    preloadPseudocodeImporter
} from '../../containers/lazy-pseudocode-importer.jsx';
import StageWrapper from '../../containers/stage-wrapper.jsx';
import Loader from '../loader/loader.jsx';
import Box from '../box/box.jsx';
import MenuBar from '../menu-bar/menu-bar.jsx';
import ChromeToggle from './chrome-toggle.jsx';
import StarterJourneys from './starter-journeys.jsx';
// The lessons panel carries seven wave catalogs (232 KiB raw, 74 KiB compressed)
// and is closed on every first paint; it arrives when someone opens it.
const MachineCodeEditor = React.lazy(() =>
    import(/* webpackChunkName: "bw-codemirror" */ '../../lib/codemirror-editor.jsx')
);
const GuidedLessons = React.lazy(() => import(/* webpackChunkName: "guided-lessons" */ './guided-lessons.jsx'));
import lessonCatalog from './lessons.json';
import chromeStyles from './compact-chrome.css';
import {editorOverflowStyles} from '../tw-pseudocode/editor-overflow-styles.js';
import PaneDivider from './pane-divider.jsx';
import PaneStrip from './pane-strip.jsx';
import {computePaneStyles, isCollapsed, isExplicitFraction} from '../../lib/pane-sizes.js';
import {setPaneSize} from '../../reducers/pane-layout';
import {setFullScreen} from '../../reducers/mode';
import CostumeLibrary from '../../containers/costume-library.jsx';
import BackdropLibrary from '../../containers/backdrop-library.jsx';
import Watermark from '../../containers/watermark.jsx';

import Backpack from '../../containers/backpack.jsx';
import WebGlModal from '../../containers/webgl-modal.jsx';
import TipsLibrary from '../../containers/tips-library.jsx';
import Cards from '../../containers/cards.jsx';
import Alerts from '../../containers/alerts.jsx';
import DragLayer from '../../containers/drag-layer.jsx';
import ConnectionModal from '../../containers/connection-modal.jsx';
import TelemetryModal from '../telemetry-modal/telemetry-modal.jsx';

import layout, {STAGE_SIZE_MODES} from '../../lib/layout-constants';
import {resolveStageSize} from '../../lib/screen-utils';
import {themeMap} from '../../lib/themes';

import { ControllerPanel } from 'bw-board/controller.js';
import { createMachineVideoMirror } from '../../lib/bw-machines/video-mirror.js';
import { createKeyboardSteer } from '../../lib/bw-machines/keyboard-steer.js';
import { createMachineAudioSpeaker } from '../../lib/bw-machines/audio-speaker.js';
import { runMachineConfig } from '../../lib/bw-machines/run-machine.js';
import { getMachineStore } from '../../lib/bw-machines/machine-store-instance.js';
// The machine library modal — lazy so it costs nothing until "Manage machines…".
const MachineManager = React.lazy(() =>
    import(/* webpackChunkName: "bw-machine-manager" */ '../tw-pseudocode/machine-manager.jsx'));
import { bindPanelToVariables } from 'bw-board/controller-binding.js';
import EditorErrorBoundary from '../editor-error-boundary/editor-error-boundary.jsx';
import styles from './gui.css';
import addExtensionIcon from './icon--extensions.svg';
import codeIcon from './icon--code.svg';
import costumesIcon from './icon--costumes.svg';
import soundsIcon from './icon--sounds.svg';

const messages = defineMessages({
    addExtension: {
        id: 'gui.gui.addExtension',
        description: 'Button to add an extension in the target pane',
        defaultMessage: 'Add Extension'
    }
});

// Cache this value to only retrieve it once the first time.
// Assume that it doesn't change for a session.
let isRendererSupported = null;

const STARTER_COMPLETE_KEY = 'bw-starter-v1-complete';
const STARTER_EVENTS_KEY = 'bw-starter-v1-events';

// Keep first-run product signals local. They are useful for diagnosing whether a
// journey was opened or dismissed, but do not belong in network telemetry unless
// the app's explicit telemetry consent path grows support for them later.
const recordStarterEvent = (type, journeyId) => {
    try {
        const previous = JSON.parse(localStorage.getItem(STARTER_EVENTS_KEY) || '[]');
        const events = Array.isArray(previous) ? previous.slice(-19) : [];
        events.push({type, journeyId: journeyId || null, at: new Date().toISOString()});
        localStorage.setItem(STARTER_EVENTS_KEY, JSON.stringify(events));
    } catch { /* private mode, unavailable storage, or an old malformed value */ }
};

// Tab order of the <TabList> in GUIComponent: 0-2 are upstream's (blocks,
// costumes, sounds), 3 and 4 are Brickwright's Code and Circuit tabs. The panels
// are force-rendered, so a panel's own idea of "visible" has to come from here.
const CODE_TAB_INDEX = 3;
const CIRCUIT_TAB_INDEX = 4;

// The FPGA/HDL surface is a BUILD-TIME opt-in and ships hidden. Webpack replaces
// this with a literal, so an off build drops the tab, its panel and everything
// they import. It is appended LAST so no existing tab index moves: CODE_TAB_INDEX
// and circuit-tab.jsx's hard-coded index both stay valid either way, which
// test/circuit-tab-index.test.mjs checks.
//
// This is deliberately not a Code-tab language. The Code tab's premise is
// blocks <-> pseudocode <-> Python/JS as representations of ONE program, and
// Verilog is not a representation of a Scratch script. See docs/TANG-NANO.md.
// BUILD-time: is the FPGA surface bundled at all? Never gates visibility alone —
// see showFpga below, which also requires the user's opt-in.
const FPGA_BUILT = process.env.BW_ENABLE_FPGA;

// The Robot Lab (docs/SIM-LAB.md) is appended after everything else, FPGA included, so
// no existing index moves (CODE_TAB_INDEX, circuit-tab.jsx's 4, pseudocode-importer.jsx's
// FPGA_TAB_INDEX 5). Its own index therefore depends on whether the FPGA tab is shown;
// robot-lab-tab.jsx is handed it rather than hard-coding one.
const robotLabTabIndex = showFpgaTab => (showFpgaTab ? 6 : 5);
// The tab component itself loads when the Robot Lab is first wanted (shown, or asked for by
// the SPIKE arena's "Open in Robot Lab"), not with the first load: eager, it pushed the 8086
// benchmark's P17 initial JavaScript over its budget (PR #1097). 'bw-open-robot-lab' is
// ROBOT_LAB_EVENTS.open (lib/robot-lab-events.js), spelled out so that module stays lazy too.
const RobotLabTab = React.lazy(() =>
    import(/* webpackChunkName: "bw-robotlab-tab" */ '../tw-pseudocode/robot-lab-tab.jsx'));
const ROBOT_LAB_OPEN_EVENT = 'bw-open-robot-lab';
// A persistent element that holds one surface (CAD, Robot Lab) while it moves
// between its tab and the right pane.
const createSurfaceHost = name => {
    if (typeof document === 'undefined') return null;
    const host = document.createElement('div');
    host.dataset.bwSurface = name;
    host.style.cssText = 'display:flex;flex-direction:column;flex:1 1 auto;width:100%;height:100%;min-width:0;min-height:0';
    return host;
};
const placeSurface = (host, slot) => {
    if (!host || !slot || host.parentNode === slot) return;
    slot.appendChild(host);
    // 3D views size themselves from their container; tell them it changed.
    window.dispatchEvent(new Event('resize'));
};
const SLOT_STYLE = {display: 'flex', flexDirection: 'column', flex: '1 1 auto', width: '100%', height: '100%', minWidth: 0, minHeight: 0};

const GUIComponent = props => {
    React.useEffect(() => { document.documentElement.dataset.bwColorMode = props.theme === 'dark' ? 'dark' : 'light'; }, [props.theme]);
    const [starterOpen, setStarterOpen] = React.useState(false);
    // RUNTIME: has the user switched the FPGA tab on (Settings ▸ FPGA lab)? It
    // ships hidden even when built. The settings menu and this tab list are
    // different components, so a window event keeps them in step without a reload.
    const [fpgaEnabled, setFpgaEnabled] = React.useState(getFpgaEnabled);
    React.useEffect(() => {
        const onToggle = () => setFpgaEnabled(getFpgaEnabled());
        window.addEventListener(FPGA_TOGGLE_EVENT, onToggle);
        return () => window.removeEventListener(FPGA_TOGGLE_EVENT, onToggle);
    }, []);
    const showFpga = FPGA_BUILT && fpgaEnabled;
    const [cadEnabled, setCadEnabled] = React.useState(getCadEnabled);
    React.useEffect(() => {
        const onToggle = () => setCadEnabled(getCadEnabled());
        window.addEventListener(CAD_TOGGLE_EVENT, onToggle);
        return () => window.removeEventListener(CAD_TOGGLE_EVENT, onToggle);
    }, []);
    const showCad = process.env.BW_ENABLE_CAD && cadEnabled;
    const [starterBusy, setStarterBusy] = React.useState(false);
    const [starterError, setStarterError] = React.useState('');
    const [lessonsOpen, setLessonsOpen] = React.useState(false);
    const [activeLessonId, setActiveLessonId] = React.useState(null);
    const [lessonInitialEvent, setLessonInitialEvent] = React.useState('');
    const closeStarter = React.useCallback(() => {
        try {
            localStorage.setItem(STARTER_COMPLETE_KEY, '1');
        } catch { /* private mode */ }
        recordStarterEvent('dismissed');
        setStarterOpen(false);
        setStarterBusy(false);
        setStarterError('');
    }, []);
    React.useEffect(() => {
        try {
            if (localStorage.getItem(STARTER_COMPLETE_KEY) !== '1') setStarterOpen(true);
        } catch {
            setStarterOpen(true);
        }
        const open = () => {
            recordStarterEvent('reopened');
            setStarterBusy(false);
            setStarterError('');
            setStarterOpen(true);
        };
        const result = event => {
            const detail = event.detail || {};
            setStarterBusy(false);
            if (String(detail.journeyId || '').startsWith('lesson:')) {
                window.dispatchEvent(new CustomEvent('bw-lesson-project-result', {detail}));
                return;
            }
            if (detail.ok) {
                try {
                    localStorage.setItem(STARTER_COMPLETE_KEY, '1');
                } catch { /* private mode */ }
                recordStarterEvent('opened', detail.journeyId);
                setStarterOpen(false);
                setStarterError('');
                const lesson = lessonCatalog.lessons.find(item => item.journeyId === detail.journeyId);
                if (lesson) {
                    setActiveLessonId(lesson.id);
                    setLessonInitialEvent('starter-loaded');
                    setLessonsOpen(true);
                }
            } else {
                recordStarterEvent(detail.cancelled ? 'cancelled' : 'failed', detail.journeyId);
                setStarterError(detail.cancelled ? 'cancelled' :
                    (detail.error || 'The starter project could not be opened.'));
            }
        };
        const openLessons = () => {
            setActiveLessonId(null);
            setLessonInitialEvent('');
            setLessonsOpen(true);
        };
        window.addEventListener('bw-open-getting-started', open);
        window.addEventListener('bw-starter-result', result);
        window.addEventListener('bw-open-lessons', openLessons);
        return () => {
            window.removeEventListener('bw-open-getting-started', open);
            window.removeEventListener('bw-starter-result', result);
            window.removeEventListener('bw-open-lessons', openLessons);
        };
    }, []);
    // Let another surface (the FPGA tab) activate a tab by index — it needs the
    // Circuit tab to become visible so its designer mounts and publishes the live
    // circuit handle. The tab list lives here; the requester only knows the index.
    React.useEffect(() => {
        const onActivate = e => {
            const idx = e && e.detail && e.detail.index;
            if (typeof idx === 'number' && props.onActivateTab) props.onActivateTab(idx);
        };
        window.addEventListener('bw-activate-tab', onActivate);
        return () => window.removeEventListener('bw-activate-tab', onActivate);
    }, [props.onActivateTab]);
    // The Robot Lab tab mounts once wanted and then stays mounted (its model and a running
    // program survive a trip to another tab). Before it has loaded, an open request is
    // answered here: show the tab, which then mounts visible and takes the hub.
    const [robotLabWanted, setRobotLabWanted] = React.useState(false);
    const robotLabIndex = robotLabTabIndex(showFpga);
    // Append CAD after Robots so every existing tab keeps its index.
    const cadTabIndex = robotLabIndex + 1;
    const previousFpgaVisibility = React.useRef(showFpga);
    const fpgaLayoutChanging = previousFpgaVisibility.current !== showFpga;
    React.useEffect(() => {
        const wasShown = previousFpgaVisibility.current;
        previousFpgaVisibility.current = showFpga;
        if (wasShown === showFpga) return;
        const index = props.activeTabIndex;
        if (showFpga && index >= 5) props.onActivateTab(index + 1);
        else if (!showFpga && index > 5) props.onActivateTab(index - 1);
        else if (!showFpga && index === 5) props.onActivateTab(4);
    }, [showFpga, props.activeTabIndex, props.onActivateTab]);
    const [cadWanted, setCadWanted] = React.useState(false);
    React.useEffect(() => {
        if (!process.env.BW_ENABLE_CAD || !props.vm?.runtime) return undefined;
        // The CAD bridges arrive in their own chunk after the first paint (lib/bw-cad-host.js).
        let disposed = false, remove = null;
        import(/* webpackChunkName: "bw-cad-host" */ '../../lib/bw-cad-host.js')
            .then(({installCadHost}) => { if (!disposed) remove = installCadHost(props.vm); })
            .catch(error => console.warn('[brickwright] CAD host failed to load', error));
        return () => {disposed = true; if (remove) remove();};
    }, [props.vm]);
    if (showCad && !cadWanted && !fpgaLayoutChanging && props.activeTabIndex === cadTabIndex) setCadWanted(true);
    React.useEffect(() => {
        if (!showCad && props.activeTabIndex === cadTabIndex) props.onActivateTab(robotLabIndex);
    }, [showCad, props.activeTabIndex, props.onActivateTab, cadTabIndex, robotLabIndex]);
    if (!robotLabWanted && !fpgaLayoutChanging && props.activeTabIndex === robotLabIndex) setRobotLabWanted(true);
    React.useEffect(() => {
        const onOpen = () => {
            setRobotLabWanted(true);
            if (props.onActivateTab) props.onActivateTab(robotLabIndex);
        };
        window.addEventListener(ROBOT_LAB_OPEN_EVENT, onOpen);
        return () => window.removeEventListener(ROBOT_LAB_OPEN_EVENT, onOpen);
    }, [props.onActivateTab, robotLabIndex]);
    const chooseStarter = React.useCallback(journey => {
        setStarterBusy(true);
        setStarterError('');
        // Cards that open a surface rather than an example answer through the same
        // result event as the circuit tab does for examples.
        const report = detail => window.dispatchEvent(new CustomEvent('bw-starter-result',
            {detail: {journeyId: journey.id, ...detail}}));
        if (journey.action === 'robot-lab') {
            setRobotLabWanted(true);
            props.onActivateTab(robotLabIndex);
            report({ok: true});
            return;
        }
        if (process.env.BW_ENABLE_CAD && journey.action === 'cad-robot') {
            setCadPreference(true);
            setCadWanted(true);
            props.onActivateTab(cadTabIndex);
            import(/* webpackChunkName: "cad-robot-projects" */ '../../lib/bw-cad-robot-projects.js')
                .then(({openCadRobotProject}) => openCadRobotProject(props.vm, journey.projectId, props.intl.locale))
                .then(opened => report(opened ? {ok: true} : {cancelled: true}),
                    error => report({error: (error && error.message) || String(error)}));
            return;
        }
        props.onActivateTab(journey.editorTab);
        window.dispatchEvent(new CustomEvent('bw-start-journey', {detail: journey}));
    }, [props.onActivateTab, props.vm, props.intl, robotLabIndex, cadTabIndex]);
    React.useEffect(() => {
        const openLessonProject = event => {
            const lesson = event.detail || {};
            if (lesson.loadMode === 'logikus') {
                // The Logikus bench is app-owned and opens beside the current
                // project; it does not load a vendored gallery example.
                window.dispatchEvent(new CustomEvent('bw-logikus-open', {detail: {
                    presetId: lesson.presetId,
                    journeyId: `lesson:${lesson.id}`
                }}));
                return;
            }
            const editorTab = lesson.loadMode === 'program-only' ? 3 : 4;
            props.onActivateTab(editorTab);
            window.dispatchEvent(new CustomEvent('bw-start-journey', {detail: {
                id: `lesson:${lesson.id}`,
                exampleId: lesson.exampleId,
                mode: lesson.loadMode
            }}));
        };
        window.addEventListener('bw-open-lesson-project', openLessonProject);
        return () => window.removeEventListener('bw-open-lesson-project', openLessonProject);
    }, [props.onActivateTab]);
    React.useEffect(() => {
        const vm = props.vm;
        if (!vm || !vm.on) return undefined;
        const connected = peripheral => window.dispatchEvent(new CustomEvent('bw-hardware-state', {
            detail: {state: 'connected', peripheral: peripheral || null}
        }));
        const disconnected = peripheral => window.dispatchEvent(new CustomEvent('bw-hardware-state', {
            detail: {state: 'disconnected', peripheral: peripheral || null}
        }));
        vm.on('PERIPHERAL_CONNECTED', connected);
        vm.on('PERIPHERAL_DISCONNECTED', disconnected);
        return () => {
            vm.removeListener('PERIPHERAL_CONNECTED', connected);
            vm.removeListener('PERIPHERAL_DISCONNECTED', disconnected);
        };
    }, [props.vm]);
    const [stagePaneVisible, setStagePaneVisible] = React.useState(() => {
        // A fresh Circuit workspace should devote its width to the editor.
        // Only an explicit saved preference (or a view such as Debugger,
        // which publishes bw-right-pane-hidden=0) opens the optional pane.
        try { return localStorage.getItem('bw-right-pane-hidden') === '0'; } catch { return false; }
    });
    // dockMode drives which pane the right column shows. 'microbit' replaces the
    // sprite list with the sim; every other value keeps the normal stage+targets.
    // Read BOTH bw-debug-dock and bw-stage-circuit so a stale localStorage value
    // from a prior session never activates the sim pane on a mint project.
    const [dockMode, setDockMode] = React.useState(() => {
        try {
            const dock = localStorage.getItem('bw-debug-dock') || 'right';
            const circuit = localStorage.getItem('bw-stage-circuit');
            // Only honour 'microbit' if the circuit-pane flag is also set
            if ((dock === 'microbit' || dock === 'arcade') && circuit !== '1') return 'top';
            // A restored 'microbit' pane must also match the PROJECT: a
            // pure-circuit or STC/AVR project reopening after a micro:bit
            // session was showing the sim for no reason (owner report).
            // The button still switches explicitly; only the silent
            // restore is gated on the device actually being a micro:bit.
            if (dock === 'microbit' &&
                !['microbit', 'calliopemini'].includes(props.vm?.runtime?.stc?.device)) return 'top';
            // Same rule for the console: a restored 'arduboy' dock with no
            // program is a blank screen someone has to work out how to
            // leave, so it opens only when the device says so.
            if (dock === 'arduboy' && props.vm?.runtime?.bwDeviceId !== 'arduboy' &&
                !window.__bwArduboyPending) return 'top';
            // The MakeCode simulator holds no program of its own across a
            // reload: restoring its dock would show an empty pane.
            if (dock === 'makecode' && !window.__bwMakeCodePending) return 'top';
            if (!['top', 'off', 'right', 'solo', 'controller', 'microbit', 'arcade', 'cpx', 'arduboy', 'makecode', 'spikearena', 'cad', 'robots'].includes(dock)) return 'top';
            // The CAD view restores only where the CAD Editor is built and switched on.
            if (dock === 'cad' && !(process.env.BW_ENABLE_CAD && getCadEnabled())) return 'top';
            // The arena restores only for a SPIKE project.
            if (dock === 'spikearena' && props.vm?.runtime?.stc?.device !== 'spike') return 'top';
            // The Circuit Playground board restores only for a DEVICE CPX program.
            if (dock === 'cpx' && (props.vm?.runtime?.bwDeviceId || props.vm?.runtime?.stc?.device) !== 'cpx') return 'top';
            if (dock === 'arcade' && !['arcade', 'pybadge', 'pybadge-lc', 'samd51']
                .includes(props.vm?.runtime?.bwDeviceId || props.vm?.runtime?.stc?.device)) return 'top';
            return dock;
        } catch { return 'top'; }
    });
    const [showCircuitStage, setShowCircuitStage] = React.useState(() => {
        try { return localStorage.getItem('bw-stage-circuit') === '1'; } catch { return false; }
    });
    const circuitOwnsStage = showCircuitStage && (dockMode === 'right' ||
        (props.activeTabIndex !== CIRCUIT_TAB_INDEX && ['top', 'off', 'solo'].includes(dockMode)));
    const [cardiacCodeSlot, setCardiacCodeSlot] = React.useState(null);
    const [cardiacToolsSlot, setCardiacToolsSlot] = React.useState(null);
    const [cardiacControllerSlot, setCardiacControllerSlot] = React.useState(null);
    const [cardiacAttached, setCardiacAttached] = React.useState(() => window.__bwMachineExtracted?.kind === 'cardiac');
    React.useEffect(() => {
        const selected = event => setCardiacAttached(event.detail?.kind === 'cardiac');
        const detached = () => setCardiacAttached(false);
        window.addEventListener('bw-machine-extracted', selected);
        window.addEventListener('bw-cardiac-detached', detached);
        return () => {
            window.removeEventListener('bw-machine-extracted', selected);
            window.removeEventListener('bw-cardiac-detached', detached);
        };
    }, []);
    const cardiacSurfaces = React.useMemo(() => ({code: cardiacCodeSlot, tools: cardiacToolsSlot,
        controller: cardiacControllerSlot, Editor: MachineCodeEditor}),
    [cardiacCodeSlot, cardiacToolsSlot, cardiacControllerSlot]);
    const [cp1CodeSlot, setCp1CodeSlot] = React.useState(null);
    const [cp1ControllerSlot, setCp1ControllerSlot] = React.useState(null);
    const [cp1Attached, setCp1Attached] = React.useState(() => window.__bwMachineExtracted?.kind === 'cp1');
    React.useEffect(() => {
        const selected = event => setCp1Attached(event.detail?.kind === 'cp1');
        const detached = () => setCp1Attached(false);
        window.addEventListener('bw-machine-extracted', selected);
        window.addEventListener('bw-cp1-circuit-detached', detached);
        return () => {
            window.removeEventListener('bw-machine-extracted', selected);
            window.removeEventListener('bw-cp1-circuit-detached', detached);
        };
    }, []);
    const cp1Surfaces = React.useMemo(() => ({code: cp1CodeSlot, controller: cp1ControllerSlot, Editor: MachineCodeEditor}),
        [cp1CodeSlot, cp1ControllerSlot]);
    const [gameControlKey, setGameControlKey] = React.useState(() =>
        props.vm?.runtime?.bwGameControlKey || null);
    React.useEffect(() => {
        const runtime = props.vm && props.vm.runtime;
        if (!runtime || !runtime.on) return undefined;
        const changed = key => setGameControlKey(key || null);
        runtime.on('BW_GAME_CONTROLS_CHANGED', changed);
        return () => runtime.removeListener('BW_GAME_CONTROLS_CHANGED', changed);
    }, [props.vm]);
    React.useEffect(() => {
        const sync = event => {
            const detail = event.detail || {};
            if (detail.key === 'bw-right-pane-hidden') {
                setStagePaneVisible(detail.value !== '1');
            } else if (detail.key === 'bw-debug-dock') {
                setDockMode(detail.value || 'top');
                // A right-docked debugger is a request to use the optional
                // pane, not merely to mount it in hidden DOM. Fresh projects
                // remain collapsed; this opens only on explicit debugger
                // demand from Settings or the stage controls.
                // Same rule for the CONTROLLER dock: an example shipping a
                // faceplate docks it here, and mounting 19 widgets into a
                // collapsed pane is indistinguishable from nothing loading
                // (measured: the calculator's shipped layout, present in
                // the DOM, invisible on screen).
                if (detail.value === 'right' || detail.value === 'controller' || detail.value === 'microbit' || detail.value === 'arcade' || detail.value === 'makecode' || detail.value === 'spikearena' || detail.value === 'cad' || detail.value === 'robots') {
                    setStagePaneVisible(true);
                    try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
                }
            } else if (detail.key === 'bw-stage-circuit') {
                setShowCircuitStage(detail.value === '1');
                // If the circuit pane is being deactivated while in microbit mode, reset
                if (detail.value !== '1') {
                    setDockMode(prev => prev === 'microbit' ? 'top' : prev);
                }
            }
        };
        window.addEventListener('bw-settings-change', sync);
        return () => window.removeEventListener('bw-settings-change', sync);
    }, []);

    // ── CAD and Robot Lab in the right pane ───────────────────────────
    // Each is ONE live instance (a WebGL view, a physics world, the shared hub):
    // React renders it into a persistent host element, which is moved to its tab
    // while that tab is open, else to the right pane when docked there. Moving the
    // element keeps the editor, the camera and a running program; a second mount
    // would fight the first for the session.
    const cadHost = React.useMemo(() => createSurfaceHost('cad'), []);
    const robotsHost = React.useMemo(() => createSurfaceHost('robots'), []);
    const [cadTabSlot, setCadTabSlot] = React.useState(null);
    const [cadPaneSlot, setCadPaneSlot] = React.useState(null);
    const [robotsTabSlot, setRobotsTabSlot] = React.useState(null);
    const [robotsPaneSlot, setRobotsPaneSlot] = React.useState(null);
    const paneOpen = stagePaneVisible && !isCollapsed((props.paneLayout && props.paneLayout.right && props.paneLayout.right.size) || 'm');
    const cadTabActive = showCad && props.activeTabIndex === cadTabIndex;
    const cadInPane = Boolean(showCad) && dockMode === 'cad' && !cadTabActive;
    const robotsTabActive = props.activeTabIndex === robotLabIndex;
    const robotsInPane = dockMode === 'robots' && !robotsTabActive;
    const cadVisible = cadTabActive || (cadInPane && paneOpen);
    const robotsVisible = robotsTabActive || (robotsInPane && paneOpen);
    if (cadInPane && !cadWanted) setCadWanted(true);
    if (robotsInPane && !robotLabWanted) setRobotLabWanted(true);
    React.useEffect(() => {
        placeSurface(cadHost, cadInPane ? cadPaneSlot : cadTabSlot);
    }, [cadHost, cadInPane, cadPaneSlot, cadTabSlot]);
    React.useEffect(() => {
        placeSurface(robotsHost, robotsInPane ? robotsPaneSlot : robotsTabSlot);
    }, [robotsHost, robotsInPane, robotsPaneSlot, robotsTabSlot]);
    // Blocks that need the CAD editor (CAD shapes, CAD program blocks) ask for it
    // here. It opens beside the blocks, in the right pane, rather than taking the
    // learner away from them; where it is already showing, nothing moves.
    React.useEffect(() => {
        const open = () => {
            if (!showCad) return;
            setCadWanted(true);
            if (cadTabActive || (cadInPane && paneOpen)) return;
            setCircuitView({fullWidth: true, dock: 'cad'});
        };
        window.addEventListener(CAD_OPEN_EVENT, open);
        return () => window.removeEventListener(CAD_OPEN_EVENT, open);
    }, [showCad, cadTabActive, cadInPane, paneOpen]);

    // ── Controller panel ──────────────────────────────────────────────
    const controllerPanelRef = React.useRef(null);
    if (!controllerPanelRef.current) controllerPanelRef.current = new ControllerPanel();
    const controllerPanel = controllerPanelRef.current;
    const [machineConsole, setMachineConsole] = React.useState(null);
    const [machineTerminal, setMachineTerminal] = React.useState(null);
    const [aceKimMachine, setAceKimMachine] = React.useState(null);
    const ownedControllerSession = React.useRef(null);
    React.useEffect(() => {
        const stop = () => {
            ownedControllerSession.current?.();
            ownedControllerSession.current = null;
        };
        const events = ['bw-stop-all', 'bw-cp1-stop-request', 'bw-cardiac-stop-request',
            'bw-machine-media-load', 'bw-machine-extracted', 'bw-start-journey'];
        for (const event of events) window.addEventListener(event, stop);
        const runtime = props.vm?.runtime;
        runtime?.on('PROJECT_STOP_ALL', stop);
        return () => {
            stop();
            runtime?.removeListener('PROJECT_STOP_ALL', stop);
            for (const event of events) window.removeEventListener(event, stop);
        };
    }, [props.vm]);
    // Expose on vm.runtime so ControllerExtension can find it, and wire the
    // LIVE variable binding: input widgets write program variables, display
    // widgets show them (bindPanelToVariables polls via requestAnimationFrame).
    React.useEffect(() => {
        if (!props.vm || !props.vm.runtime) return undefined;
        props.vm.runtime.controllerPanel = controllerPanel;
        const varBinding = bindPanelToVariables(controllerPanel, props.vm);
        return () => varBinding.dispose();
    }, [props.vm, controllerPanel]);
    // Restore panel from project data when project loads
    React.useEffect(() => {
        const onProjectLoad = () => {
            try {
                const stc = props.vm?.runtime?.stc;
                const stored=localStorage.getItem('bw-ctl-widgets');
                const layout=stored?JSON.parse(stored):stc?.controller;
                if (layout) {
                    const restored = ControllerPanel.fromJSON(layout);
                    // Replace widgets in the existing panel
                    clearControllerPanel(controllerPanel);
                    const skipped = [];
                    for (const w of restored.getWidgets()) {
                        // Same rule as the importer's restore: one widget the
                        // model refuses must not empty the panel, because this
                        // loop has already removed everything that was there.
                        try {
                            const added = controllerPanel.addWidget(w.name, w.type, w.config, w.layout);
                            if (w.binding) added.binding = { ...w.binding };
                        } catch (err) {
                            skipped.push(w && w.name);
                        }
                    }
                    if (skipped.length) {
                        // eslint-disable-next-line no-console
                        console.warn('controller layout: skipped', skipped.join(', '));
                    }
                    // The MODE travels with the layout. Without this a saved
                    // project restored its widgets and then sat in `edit`,
                    // where every input control renders disabled — so a
                    // faceplate that worked when the example was opened was
                    // dead the next time the project was loaded.
                    controllerPanel.setHideBindings?.(!!restored.hideBindings);
                    controllerPanel.setMode(restored.mode);
                } else {clearControllerPanel(controllerPanel);controllerPanel.setMode('edit');}
            } catch { /* ignore corrupt data */ }
        };
        const onBundle=event=>{if(['loaded','legacy'].includes(event.detail?.outcome))onProjectLoad();};
        if (props.vm) props.vm.on('PROJECT_LOADED', onProjectLoad);
        window.addEventListener('bw-project-bundle-loaded',onBundle);
        onProjectLoad();
        return () => { if (props.vm) props.vm.removeListener('PROJECT_LOADED', onProjectLoad);window.removeEventListener('bw-project-bundle-loaded',onBundle); };
    }, [props.vm, controllerPanel]);
    // Listen for persistence events from the panel view
    React.useEffect(() => {
        const onChanged = (e) => {
            // Store controller data on the runtime stc object for project save
            if (props.vm && props.vm.runtime && props.vm.runtime.stc) {
                props.vm.runtime.stc.controller = e.detail.data;
            }
        };
        const collect=()=>{const data=serializeControllerPanel(controllerPanel);try{localStorage.setItem('bw-ctl-widgets',JSON.stringify(data));}catch{}onChanged({detail:{data}});};
        window.addEventListener('bw-controller-changed', onChanged);
        window.addEventListener('bw-project-bundle-collect',collect);
        return () => {window.removeEventListener('bw-controller-changed', onChanged);window.removeEventListener('bw-project-bundle-collect',collect);};
    }, [props.vm, controllerPanel]);

    // Mirror the FPGA design's OUTPUT pins into the Controller/Widgets view.
    //
    // The FPGA tab drives the placed board's LEDs, but the Widgets view is a
    // right-pane dock the tab cannot reach — and a board pin has no path into a
    // widget in this build's bw-board pin. So the tab hands us the pin numbers
    // (`bw-fpga-leds`) and their live levels (`bw-fpga-output`), and we own the
    // panel: one indicator widget per pin, updated as the design runs. Then the
    // synthesised LEDs are visible in the Widgets view too, not only on the board.
    // Gated on the build flag so an FPGA-off build drops the wiring entirely.
    React.useEffect(() => {
        if (!FPGA_BUILT) return undefined;
        const wname = pin => `fpga_p${pin}`;
        const SEG7_NAME = 'fpga_value'; // the one seven-segment readout of the outputs
        const onLeds = e => {
            const pins = (e && e.detail && e.detail.pins) || [];
            if (!pins.length) return;
            // Drop indicators left over from a PREVIOUS design's pins — switching
            // from the 6-LED counter (15-20) to the 4-LED sequence (15-18) must
            // not leave p19/p20 hanging. Only our own `fpga_p*` widgets are
            // touched; a user's other widgets are never removed.
            const want = new Set(pins.map(pin => wname(pin)));
            for (const existing of controllerPanel.getWidgetNames()) {
                if (/^fpga_p\d+$/.test(existing) && !want.has(existing)) {
                    try { controllerPanel.removeWidget(existing); } catch (err) { /* already gone */ }
                }
            }
            pins.forEach((pin, i) => {
                const name = wname(pin);
                if (!controllerPanel.getWidget(name)) {
                    try {
                        controllerPanel.addWidget(name, 'bargraph',
                            {min: 0, max: 1, segments: 1, label: `p${pin}`},
                            {x: 1 + (i * 3), y: 1, w: 2, h: 3});
                    } catch (err) { /* a name clash means it is already there */ }
                }
            });
            // Play mode renders the indicators as live displays, not editor chrome.
            controllerPanel.setMode('play');
            // Dock the panel and show a tab where the dock renders, so the LEDs
            // are actually on screen rather than mounted into a collapsed pane.
            window.dispatchEvent(new CustomEvent('bw-settings-change',
                {detail: {key: 'bw-debug-dock', value: 'controller'}}));
            if (props.onActivateTab) props.onActivateTab(CODE_TAB_INDEX);
        };
        const onOutput = e => {
            const leds = (e && e.detail && e.detail.leds) || [];
            for (const {pin, high} of leds) {
                const name = wname(pin);
                if (controllerPanel.getWidget(name) && typeof controllerPanel.setBargraphValue === 'function') {
                    try { controllerPanel.setBargraphValue(name, high ? 1 : 0); } catch (err) { /* removed mid-run */ }
                }
            }
            // A seven-segment readout (opt-in via bw-fpga-seg7) shows the SAME
            // output pins folded into one number, so a counter reads 0,1,2,3…
            if (controllerPanel.getWidget(SEG7_NAME) && typeof controllerPanel.setSevenSegValue === 'function') {
                try { controllerPanel.setSevenSegValue(SEG7_NAME, pinsToValue(leds)); } catch (err) { /* removed mid-run */ }
            }
        };
        // Opt-in: the FPGA tab asks for a seven-segment digit of its outputs. We
        // own the panel, so we make the widget; `bw-fpga-output` then drives it.
        const onSeg7 = e => {
            const pins = (e && e.detail && e.detail.pins) || [];
            if (!pins.length) return;
            if (!controllerPanel.getWidget(SEG7_NAME)) {
                try {
                    controllerPanel.addWidget(SEG7_NAME, 'sevenseg',
                        {digits: Math.max(2, String((1 << pins.length) - 1).length), label: 'value'},
                        {x: 1, y: 5, w: 5, h: 4});
                } catch (err) { /* already there */ }
            }
            controllerPanel.setMode('play');
            window.dispatchEvent(new CustomEvent('bw-settings-change',
                {detail: {key: 'bw-debug-dock', value: 'controller'}}));
            if (props.onActivateTab) props.onActivateTab(CODE_TAB_INDEX);
        };
        window.addEventListener('bw-fpga-leds', onLeds);
        window.addEventListener('bw-fpga-output', onOutput);
        window.addEventListener('bw-fpga-seg7', onSeg7);
        return () => {
            window.removeEventListener('bw-fpga-leds', onLeds);
            window.removeEventListener('bw-fpga-output', onOutput);
            window.removeEventListener('bw-fpga-seg7', onSeg7);
        };
    }, [controllerPanel, props.onActivateTab]);

    // Mirror a running MACHINE's video() framebuffer into the Widgets pane — the
    // same idea as the FPGA mirror above, for a machine's SCREEN. A machine's
    // screen is a `simplevga` widget (design §4.2; bw-board setVgaFrame:
    // "Mirror a machine video card frame into a VGA widget"), so a booted DOS/
    // ELKS/6502-with-video machine renders here, not only in the Debug
    // instrument. A run path opts in by calling `window.bwMirrorMachineVideo(
    // {videoFn, widget})` once the runner exists; `videoFn` is the runner's
    // `video()` accessor and `widget` the config's declared screen widget
    // (activateConfig's `videoWidget`). Only one machine mirror runs at a time.
    React.useEffect(() => {
        let mirror = null;
        let steer = null;
        let speaker = null;
        const stop = () => {
            if (mirror) { mirror.stop(); mirror = null; }
            setMachineConsole(null);
        };
        const stopKbd = () => { if (steer) { steer.stop(); steer = null; } };
        const stopAudio = () => { if (speaker) { speaker.stop(); speaker = null; } };
        // Play a machine's audio() (an array of {hz,on} voices) through Web Audio
        // — the machine's sound through the attached speakers (design §4.5). A run
        // path calls window.bwPlayMachineAudio({audioFn}) after the runner exists;
        // start on the boot CLICK so the browser allows audio.
        const startAudio = payload => {
            const p = payload || {};
            const audioFn = typeof p.audioFn === 'function'
                ? p.audioFn
                : (p.runner && typeof p.runner.audio === 'function'
                    ? () => p.runner.audio() : null);
            if (!audioFn) return;
            stopAudio();
            speaker = createMachineAudioSpeaker({audioFn});
            speaker.start();
        };
        // Steer a machine from a Widgets keyboard widget: drain its keys and feed
        // runner.keyIn (design §4.5). The input counterpart of the video mirror.
        const startKbd = payload => {
            const p = payload || {};
            const keyIn = typeof p.keyInFn === 'function'
                ? p.keyInFn
                : (p.runner && typeof p.runner.keyIn === 'function'
                    ? sc => p.runner.keyIn(sc) : null);
            const widget = p.widget && typeof p.widget.name === 'string'
                ? p.widget
                : (typeof p.name === 'string' ? {name: p.name, type: 'keyboard'} : null);
            if (!keyIn || !widget) return;
            // Ensure the input widget exists before draining it.
            if (typeof controllerPanel.getWidget === 'function' &&
                !controllerPanel.getWidget(widget.name) &&
                typeof controllerPanel.addWidget === 'function') {
                try {
                    controllerPanel.addWidget(widget.name, widget.type || 'keyboard',
                        widget.config || {}, widget.layout || {});
                } catch (err) { /* already there */ }
            }
            stopKbd();
            steer = createKeyboardSteer({panel: controllerPanel, widgetName: widget.name, keyIn});
            steer.start();
        };
        const start = payload => {
            const p = payload || {};
            const videoFn = typeof p.videoFn === 'function'
                ? p.videoFn
                : (p.runner && typeof p.runner.video === 'function'
                    ? () => p.runner.video() : null);
            const widget = p.widget && typeof p.widget.name === 'string'
                ? p.widget
                // A run path may pass just a name; default to a simplevga screen.
                : (typeof p.name === 'string' ? {name: p.name, type: 'simplevga'} : null);
            if (!videoFn || !widget) return;
            stop();                                 // replace any prior machine mirror
            mirror = createMachineVideoMirror({panel: controllerPanel, videoFn, widget});
            mirror.start();
            setMachineConsole({name: widget.name, keyboardSet: p.keyboardSet,
                keyIn: typeof p.keyInFn === 'function' ? p.keyInFn : null,
                serialIn: typeof p.serialInFn === 'function' ? p.serialInFn : null,
                mouseIn: typeof p.mouseInFn === 'function' ? p.mouseInFn : null});
            // Make the screen actually visible: dock the Widgets pane, play
            // mode, and surface the code tab where the dock renders — exactly as
            // the FPGA mirror does for its LEDs.
            controllerPanel.setMode('play');
            // A caller may populate Widgets while keeping its debugger visible.
            // Existing machine callers still focus the controller by default.
            if (p.focusController !== false) {
                window.dispatchEvent(new CustomEvent('bw-settings-change',
                    {detail: {key: 'bw-debug-dock', value: 'controller'}}));
                if (props.onActivateTab) props.onActivateTab(CODE_TAB_INDEX);
            }
        };
        const onStart = e => start(e && e.detail);
        const onStop = () => stop();
        window.addEventListener('bw-machine-video', onStart);
        window.addEventListener('bw-machine-video-stop', onStop);
        // Imperative API so a run path need not know the event names.
        window.bwMirrorMachineVideo = payload => start(payload);
        window.bwMirrorMachineTerminal = (session, focus) => {
            setMachineTerminal(session);
            if (focus) {
                controllerPanel.setMode('play');
                window.dispatchEvent(new CustomEvent('bw-settings-change',
                    {detail: {key: 'bw-debug-dock', value: 'controller'}}));
            }
            return () => setMachineTerminal(active => active === session ? null : active);
        };
        window.bwStopMachineVideo = () => stop();
        // "Run this machine config": resolve its media and boot it via the
        // existing media-load path, carrying its declared screen widget so the
        // video mirrors here. The manager UI / quick-picker call this; exposing
        // it also gives run-machine.js a non-test consumer.
        window.bwRunMachine = (config, opts) => runMachineConfig(config, opts);
        window.bwSteerMachineKeyboard = payload => startKbd(payload);
        window.bwStopMachineKeyboard = () => stopKbd();
        window.bwPlayMachineAudio = payload => startAudio(payload);
        window.bwStopMachineAudio = () => stopAudio();
        return () => {
            window.removeEventListener('bw-machine-video', onStart);
            window.removeEventListener('bw-machine-video-stop', onStop);
            if (window.bwMirrorMachineVideo) delete window.bwMirrorMachineVideo;
            delete window.bwMirrorMachineTerminal;
            setMachineTerminal(null);
            if (window.bwStopMachineVideo) delete window.bwStopMachineVideo;
            if (window.bwRunMachine) delete window.bwRunMachine;
            if (window.bwSteerMachineKeyboard) delete window.bwSteerMachineKeyboard;
            if (window.bwStopMachineKeyboard) delete window.bwStopMachineKeyboard;
            if (window.bwPlayMachineAudio) delete window.bwPlayMachineAudio;
            if (window.bwStopMachineAudio) delete window.bwStopMachineAudio;
            stop();
            stopKbd();
            stopAudio();
        };
    }, [controllerPanel, props.onActivateTab]);

    // Resolve the board instance from the runtime (circuit-tab creates it).
    //
    // THIS IS A PLAIN READ OF A MUTABLE RUNTIME FIELD, so React has no reason to
    // re-render when the board appears. The Circuit tab creates it asynchronously
    // when a circuit finishes loading; anything mounted before that — the Widgets
    // tab's part picker in particular — captured `null` and kept it. That is why
    // an OLED sitting on the board could not be selected under Binding > part:
    // the picker calls `board.parts`, got nothing, and silently rendered an empty
    // list (`_partIds()` swallows the throw).
    //
    // `bw-circuit-ready` already fires exactly once when the circuit finishes
    // loading. Listening to it and bumping a counter is the whole fix: the read
    // below re-runs and the picker fills.
    const [boardEpoch, setBoardEpoch] = React.useState(0);
    React.useEffect(() => {
        const onReady = () => setBoardEpoch(n => n + 1);
        window.addEventListener('bw-circuit-ready', onReady);
        // The board is published in onBoardReady, a separate (later)
        // callback than the circuit publish above — listen to both so the
        // memo re-runs when the board actually exists.
        window.addEventListener('bw-board-ready', onReady);
        return () => {
            window.removeEventListener('bw-circuit-ready', onReady);
            window.removeEventListener('bw-board-ready', onReady);
        };
    }, []);
    const board = React.useMemo(
        // `runtime.circuitBoard` is what circuit-tab's onBoardReady
        // actually publishes. The previous read, `runtime.stc.board`, is a
        // field NOTHING in the codebase writes — the epoch listener re-read
        // a nonexistent path forever, so the Widgets part picker stayed
        // empty and an OLED on the board could not be bound (owner report,
        // 2026-08-25; verified with git grep: zero writers).
        // A RUNNING emulator's board outranks the designer's: widget
        // presses must land where the program executes, and part-bound
        // displays must mirror the device the emulator drives.
        () => props.vm?.runtime?.bwRunBoard || props.vm?.runtime?.circuitBoard || props.vm?.runtime?.stc?.board || null,
        [props.vm, boardEpoch]);

    // Programs and saved tuning must reach the board even while Widgets is closed.
    React.useEffect(() => {
        const connection = connectControllerBoard(controllerPanel, board, props.vm?.runtime);
        return () => connection.dispose();
    }, [controllerPanel, board, props.vm]);

    const {
        accountNavOpen,
        activeTabIndex,
        alertsVisible,
        authorId,
        authorThumbnailUrl,
        authorUsername,
        basePath,
        backdropLibraryVisible,
        backpackHost,
        backpackVisible,
        blocksId,
        blocksTabVisible,
        cardsVisible,
        canChangeLanguage,
        canChangeTheme,
        canCreateNew,
        canEditTitle,
        canManageFiles,
        canRemix,
        canSave,
        canCreateCopy,
        canShare,
        canUseCloud,
        children,
        connectionModalVisible,
        costumeLibraryVisible,
        costumesTabVisible,
        enableCommunity,
        intl,
        isCreating,
        isFullScreen,
        isPlayerOnly,
        isRtl,
        isShared,
        isTelemetryEnabled,
        isTotallyNormal,
        loading,
        logo,
        renderLogin,
        onClickAbout,
        onClickAccountNav,
        onCloseAccountNav,
        onLogOut,
        onOpenRegistration,
        onToggleLoginOpen,
        onActivateCostumesTab,
        onActivateSoundsTab,
        onActivateTab,
        onClickLogo,
        onExtensionButtonClick,
        onProjectTelemetryEvent,
        onRequestCloseBackdropLibrary,
        onRequestCloseCostumeLibrary,
        onRequestCloseTelemetryModal,
        onSeeCommunity,
        onShare,
        onShowPrivacyPolicy,
        onStartSelectingFileUpload,
        onTelemetryModalCancel,
        onTelemetryModalOptIn,
        onTelemetryModalOptOut,
        showComingSoon,
        soundsTabVisible,
        stageSizeMode,
        paneLayout,
        onSetPaneSize,
        targetIsStage,
        telemetryModalVisible,
        theme,
        tipsLibraryVisible,
        vm,
        ...componentProps
    } = omit(props, 'dispatch');
    if (children) {
        return <Box {...componentProps}>{children}</Box>;
    }

    const tabClassNames = {
        tabs: styles.tabs,
        tab: classNames(tabStyles.reactTabsTab, styles.tab),
        tabList: classNames(tabStyles.reactTabsTabList, styles.tabList),
        tabPanel: classNames(tabStyles.reactTabsTabPanel, styles.tabPanel),
        tabPanelSelected: classNames(tabStyles.reactTabsTabPanelSelected, styles.isSelected),
        tabSelected: classNames(tabStyles.reactTabsTabSelected, styles.isSelected)
    };

    if (isRendererSupported === null) {
        isRendererSupported = Renderer.isSupported();
    }

    // The machine library modal, opened from the code-tab device dropdown's
    // "Manage machines…" entry (it dispatches bw-open-machine-manager). Running
    // a machine from it boots via the shared runMachineConfig bridge — so its
    // screen/keyboard land in the Widgets pane like any other machine.
    const [showMachines, setShowMachines] = React.useState(null);
    React.useEffect(() => {
        const open = event => setShowMachines({kind: event.detail?.kind || null, presets: event.detail?.presets});
        window.addEventListener('bw-open-machine-manager', open);
        return () => window.removeEventListener('bw-open-machine-manager', open);
    }, []);
    const machineManagerModal = showMachines ? (
        <React.Suspense fallback={null}>
            <MachineManager store={getMachineStore()} locale={props.intl.locale} preferredMachine={showMachines.kind}
                onRun={async (cfg, opts) => {
                    const code = opts?.code;
                    const run = (source = code?.text) => runMachineConfig(cfg, code?.dosSourceName ? {
                        ...opts, dosSource: {name: code.dosSourceName, text: source}
                    } : opts);
                    const started = await run();
                    if (started && code) {
                        const program = {...code, config: cfg, run};
                        delete vm.runtime.bwLibraryMachineSelection;
                        vm.runtime.bwLibraryCode = program;
                        window.dispatchEvent(new CustomEvent('bw-library-code', {detail: program}));
                        props.onActivateTab(CODE_TAB_INDEX);
                    } else if (started?.detail?.kind) {
                        const selection = {kind: started.detail.kind, picoBasicConsole: started.detail.picoBasicConsole};
                        delete vm.runtime.bwLibraryCode;
                        vm.runtime.bwLibraryMachineSelection = selection;
                        window.dispatchEvent(new CustomEvent('bw-code-machine-selected', {detail: selection}));
                    }
                    return started;
                }}
                onRunKim1Tty={session => {
                    props.vm.stopAll();
                    window.bwStopMachineVideo?.();
                    const unmirror = window.bwMirrorMachineTerminal(session, true);
                    ownedControllerSession.current = () => {
                        session.dispose();
                        unmirror();
                    };
                    window.dispatchEvent(new CustomEvent('bw-settings-change',
                        {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
                    session.start();
                }}
                onRunAceKim={machine => {
                    props.vm.stopAll();
                    window.bwStopMachineVideo?.();
                    setAceKimMachine(machine);
                    ownedControllerSession.current = () => setAceKimMachine(null);
                    addAceKimFace(controllerPanel);
                    controllerPanel.setMode('play');
                    window.dispatchEvent(new CustomEvent('bw-controller-changed', {
                        detail: {data: serializeControllerPanel(controllerPanel)}
                    }));
                    window.dispatchEvent(new CustomEvent('bw-settings-change',
                        {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
                    window.dispatchEvent(new CustomEvent('bw-settings-change',
                        {detail: {key: 'bw-debug-dock', value: 'controller'}}));
                }}
                wiredPresets={showMachines.presets}
                onOpenExample={(exampleId, codeOnly, options) => new Promise((resolve, reject) => {
                    props.onActivateTab(codeOnly ? 3 : CIRCUIT_TAB_INDEX);
                    window.dispatchEvent(new CustomEvent('bw-start-journey', {detail: {
                        exampleId, kim1Tape: options?.kim1Tape, onResult: result => {
                            if (result.error) reject(new Error(result.error));
                            else {
                                if (result.ok && options?.kim1Tape) props.onActivateTab(CODE_TAB_INDEX);
                                resolve(result.ok);
                            }
                        }
                    }}));
                })}
                onClose={() => setShowMachines(null)} />
        </React.Suspense>
    ) : null;

    return (<CardiacSurfaces.Provider value={cardiacSurfaces}><Cp1Surfaces.Provider value={cp1Surfaces}><React.Fragment><style>{editorOverflowStyles}</style><MediaQuery minWidth={layout.fullSizeMinWidth}>{isFullSize => {
        const stageSize = resolveStageSize(stageSizeMode, isFullSize);

        // Three-column pane sizing from the paneLayout reducer.
        // The middle column's `upper` content id decides what the first TabPanel
        // shows: 'blocks-canvas' (default) = the workspace, 'code' = the pseudocode
        // editor. This is the "content swap" — the Tabs structure stays intact, only
        // the first panel's content changes per preset.
        const leftSize = paneLayout?.left?.size || 'm';
        const middleSize = paneLayout?.middle?.size || 'l';
        const rightSize = paneLayout?.right?.size || 'm';
        const middleContent = paneLayout?.middle?.upper || 'blocks-canvas';
        const renderCodePane = isVisible => (
            <EditorErrorBoundary name="Code"><LazyPseudocodeImporter
                isVisible={isVisible} vm={vm} onCp1CodeSlot={setCp1CodeSlot} onCardiacCodeSlot={setCardiacCodeSlot} onCardiacToolsSlot={setCardiacToolsSlot}
            /></EditorErrorBoundary>
        );
        const helpEditor = [
            middleContent === 'code' ? 'Code' : 'Blocks',
            targetIsStage ? 'Backdrops' : 'Costumes',
            'Sounds',
            middleContent === 'code' ? 'Blocks' : 'Code',
            'Circuit',
            ...(showFpga ? ['FPGA'] : []),
            'Robots',
            ...(showCad ? ['CAD'] : [])
        ][activeTabIndex] || 'Blocks';
        const helpLabels = {
            Blocks: ['blocksTab','Blocks'], Costumes: ['costumesTab','Costumes'], Backdrops: ['backdropsTab','Backdrops'],
            Sounds: ['soundsTab','Sounds'], Code: ['codeTab','Code'], Circuit: ['circuitTab','Circuit'],
            FPGA: ['fpgaTab','FPGA'], Robots: ['robotLabTab','Robots'], CAD: ['cadTab','CAD']
        };
        const [helpLabelId, helpLabelDefault] = helpLabels[helpEditor];
        const paneStyles = computePaneStyles(leftSize, middleSize, rightSize);

        // Full screen for the RIGHT-PANE docks (controller / micro:bit): make the
        // active pane fill the viewport as its OWN content instead of fullscreening
        // the (hidden) Scratch stage. z-index stays UNDER the stage-header's fixed
        // exit overlay ($z-index-stage-header = 5000), so the return control is
        // always painted on top and clickable — never a trap.
        const dockFullScreenStyle = isFullScreen ? {
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            width: '100vw', height: '100vh', margin: 0, zIndex: 4000,
            background: '#ffffff', overflow: 'auto'
        } : null;

        // Right-pane full screen: the stock presentation mode is defeated by
        // brickwright's inline pane widths, so the right pane stayed a half-width
        // panel with the editor still showing beside it. The stage, the circuit
        // designer (dockMode 'off') and the debugger (dockMode 'right'/'solo')
        // all render in the RIGHT pane, so for every right-pane mode EXCEPT
        // controller/micro:bit (which paint their own 100vw overlay), hide the
        // editor and let the right pane fill the window.
        const stageFullScreen = isFullScreen && dockMode !== 'controller' && dockMode !== 'microbit' &&
            dockMode !== 'arcade' && dockMode !== 'cpx' && dockMode !== 'arduboy' && dockMode !== 'makecode' &&
            dockMode !== 'cad' && dockMode !== 'robots';

        return isPlayerOnly ? (
            <StageWrapper
                isFullScreen={isFullScreen}
                isRendererSupported={isRendererSupported}
                isRtl={isRtl}
                loading={loading}
                stageSize={STAGE_SIZE_MODES.large}
                vm={vm}
            >
                {alertsVisible ? (
                    <Alerts className={styles.alertsContainer} />
                ) : null}
            </StageWrapper>
        ) : (
            <Box
                className={styles.pageWrapper}
                dir={isRtl ? 'rtl' : 'ltr'}
                {...componentProps}
            >
                {/* No custom exit-fullscreen button: the stage-header's own
                    un-full-screen control is now a fixed top-right overlay
                    (z-5100, above any dock overlay), so it is the single,
                    intuitive exit for every mode. Escape still works too. */}
                {telemetryModalVisible ? (
                    <TelemetryModal
                        isRtl={isRtl}
                        isTelemetryEnabled={isTelemetryEnabled}
                        onCancel={onTelemetryModalCancel}
                        onOptIn={onTelemetryModalOptIn}
                        onOptOut={onTelemetryModalOptOut}
                        onRequestClose={onRequestCloseTelemetryModal}
                        onShowPrivacyPolicy={onShowPrivacyPolicy}
                    />
                ) : null}
                {loading ? (
                    <Loader />
                ) : null}
                {isCreating ? (
                    <Loader messageId="gui.loader.creating" />
                ) : null}
                {isRendererSupported ? null : (
                    <WebGlModal isRtl={isRtl} />
                )}
                {starterOpen ? (
                    <StarterJourneys
                        busy={starterBusy}
                        cadAvailable={Boolean(process.env.BW_ENABLE_CAD)}
                        error={starterError}
                        locale={intl.locale}
                        onChoose={chooseStarter}
                        onClose={closeStarter}
                    />
                ) : null}
                {lessonsOpen ? (
                    <React.Suspense fallback={null}>
                        <GuidedLessons
                            initialEvent={lessonInitialEvent}
                            lessonId={activeLessonId}
                            locale={intl.locale}
                            onClose={() => setLessonsOpen(false)}
                            onSelectLesson={id => {
                                setLessonInitialEvent('');
                                setActiveLessonId(id);
                            }}
                        />
                    </React.Suspense>
                ) : null}
                {tipsLibraryVisible ? (
                    <TipsLibrary />
                ) : null}
                {cardsVisible ? (
                    <Cards />
                ) : null}
                {alertsVisible ? (
                    <Alerts className={styles.alertsContainer} />
                ) : null}
                {connectionModalVisible ? (
                    <ConnectionModal
                        vm={vm}
                    />
                ) : null}
                {costumeLibraryVisible ? (
                    <CostumeLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseCostumeLibrary}
                    />
                ) : null}
                {backdropLibraryVisible ? (
                    <BackdropLibrary
                        vm={vm}
                        onRequestClose={onRequestCloseBackdropLibrary}
                    />
                ) : null}
                <MenuBar
                    accountNavOpen={accountNavOpen}
                    authorId={authorId}
                    authorThumbnailUrl={authorThumbnailUrl}
                    authorUsername={authorUsername}
                    canChangeLanguage={canChangeLanguage}
                    canChangeTheme={canChangeTheme}
                    canCreateCopy={canCreateCopy}
                    canCreateNew={canCreateNew}
                    canEditTitle={canEditTitle}
                    canManageFiles={canManageFiles}
                    canRemix={canRemix}
                    canSave={canSave}
                    canShare={canShare}
                    className={styles.menuBarPosition}
                    enableCommunity={enableCommunity}
                    isShared={isShared}
                    isTotallyNormal={isTotallyNormal}
                    logo={logo}
                    renderLogin={renderLogin}
                    showComingSoon={showComingSoon}
                    onClickAbout={onClickAbout}
                    onClickAccountNav={onClickAccountNav}
                    onClickLogo={onClickLogo}
                    onCloseAccountNav={onCloseAccountNav}
                    onLogOut={onLogOut}
                    onOpenRegistration={onOpenRegistration}
                    onProjectTelemetryEvent={onProjectTelemetryEvent}
                    onSeeCommunity={onSeeCommunity}
                    onShare={onShare}
                    onStartSelectingFileUpload={onStartSelectingFileUpload}
                    onToggleLoginOpen={onToggleLoginOpen}
                />
                <Box className={styles.bodyWrapper}>
                    <Box
                        className={styles.flexWrapper}
                        data-workspace-columns="true"
                        style={stagePaneVisible ? undefined : {display: 'block', width: '100%'}}
                    >
                        <Box
                            className={classNames(styles.editorWrapper, chromeStyles.responsiveEditor)}
                            data-editor-pane="true"
                            style={stageFullScreen ? {display: 'none'} : (stagePaneVisible ? {
                                minWidth: 0, minHeight: 0, flexShrink: 1,
                                ...(isExplicitFraction(rightSize) ? {flex: '1 1 0%'} : {})
                            } : {
                                display: 'flex', width: '100%', maxWidth: costumesTabVisible ? '100vw' : 'none', height: '100%',
                                flex: 'none', flexBasis: 'auto', minWidth: 0
                            })}
                        >
                            <Tabs
                                style={{minWidth: 0, minHeight: 0}}
                                forceRenderTabPanel
                                className={tabClassNames.tabs}
                                selectedIndex={activeTabIndex}
                                selectedTabClassName={tabClassNames.tabSelected}
                                selectedTabPanelClassName={tabClassNames.tabPanelSelected}
                                onSelect={onActivateTab}
                            >
                                <TabList className={tabClassNames.tabList} data-bw-editor-tabs="">
                                    <ChromeToggle className={chromeStyles.chromeToggle} hidden={stageFullScreen} />
                                    <Tab className={tabClassNames.tab}
                                        title={intl.formatMessage({id: 'gui.gui.blocksTab', defaultMessage: 'Blocks'})}
                                        aria-label={intl.formatMessage({id: 'gui.gui.blocksTab', defaultMessage: 'Blocks'})}
                                        onFocus={preloadPseudocodeImporter} onMouseEnter={preloadPseudocodeImporter}>
                                        <img aria-hidden="true" data-bw-tab-icon="" draggable={false} src={codeIcon} />
                                        <span data-bw-tab-label=""><FormattedMessage id="gui.gui.blocksTab" defaultMessage="Blocks" /></span>
                                    </Tab>
                                    <Tab className={tabClassNames.tab} onClick={onActivateCostumesTab}
                                        title={intl.formatMessage(targetIsStage ? {id: 'gui.gui.backdropsTab', defaultMessage: 'Backdrops'} : {id: 'gui.gui.costumesTab', defaultMessage: 'Costumes'})}
                                        aria-label={intl.formatMessage(targetIsStage ? {id: 'gui.gui.backdropsTab', defaultMessage: 'Backdrops'} : {id: 'gui.gui.costumesTab', defaultMessage: 'Costumes'})}>
                                        <img aria-hidden="true" data-bw-tab-icon="" draggable={false} src={costumesIcon} />
                                        <span data-bw-tab-label="">{targetIsStage ? (
                                            <FormattedMessage defaultMessage="Backdrops" description="Button to get to the backdrops panel" id="gui.gui.backdropsTab" />
                                        ) : (
                                            <FormattedMessage defaultMessage="Costumes" description="Button to get to the costumes panel" id="gui.gui.costumesTab" />
                                        )}</span>
                                    </Tab>
                                    <Tab className={tabClassNames.tab} onClick={onActivateSoundsTab}
                                        onFocus={preloadSoundTab} onMouseEnter={preloadSoundTab}
                                        title={intl.formatMessage({id: 'gui.gui.soundsTab', defaultMessage: 'Sounds'})}
                                        aria-label={intl.formatMessage({id: 'gui.gui.soundsTab', defaultMessage: 'Sounds'})}>
                                        <img aria-hidden="true" data-bw-tab-icon="" draggable={false} src={soundsIcon} />
                                        <span data-bw-tab-label=""><FormattedMessage defaultMessage="Sounds" description="Button to get to the sounds panel" id="gui.gui.soundsTab" /></span>
                                    </Tab>
                                    <Tab className={tabClassNames.tab}
                                        title={intl.formatMessage({id: 'gui.gui.codeTab', defaultMessage: 'Code'})}
                                        aria-label={intl.formatMessage({id: 'gui.gui.codeTab', defaultMessage: 'Code'})}>
                                        <svg aria-hidden="true" data-bw-tab-icon="" viewBox="0 0 24 24" focusable="false">
                                            <path d="m8 5-6 7 6 7m8-14 6 7-6 7M14 3l-4 18" fill="none" stroke="currentColor" strokeWidth="2" />
                                        </svg>
                                        <span data-bw-tab-label=""><FormattedMessage defaultMessage="Code" description="Brickwright code editor tab" id="gui.gui.codeTab" /></span>
                                    </Tab>
                                    <Tab className={tabClassNames.tab}
                                        title={intl.formatMessage({id: 'gui.gui.circuitTab', defaultMessage: 'Circuit'})}
                                        aria-label={intl.formatMessage({id: 'gui.gui.circuitTab', defaultMessage: 'Circuit'})}>
                                        <span aria-hidden="true" data-bw-tab-icon="">🔌</span>
                                        <span data-bw-tab-label=""><FormattedMessage defaultMessage="Circuit" description="Brickwright circuit designer tab" id="gui.gui.circuitTab" /></span>
                                    </Tab>
                                    {showFpga ? (
                                        <Tab className={tabClassNames.tab}
                                            title={intl.formatMessage({id: 'gui.gui.fpgaTab', defaultMessage: 'FPGA'})}
                                            aria-label={intl.formatMessage({id: 'gui.gui.fpgaTab', defaultMessage: 'FPGA'})}>
                                            <span aria-hidden="true" data-bw-tab-icon="">⬢</span>
                                            <span data-bw-tab-label=""><FormattedMessage defaultMessage="FPGA" description="Brickwright FPGA/HDL surface tab" id="gui.gui.fpgaTab" /></span>
                                        </Tab>
                                    ) : null}
                                    <Tab className={tabClassNames.tab}
                                        title={intl.formatMessage({id: 'gui.gui.robotLabTab', defaultMessage: 'Robots'})}
                                        aria-label={intl.formatMessage({id: 'gui.gui.robotLabTab', defaultMessage: 'Robots'})}>
                                        <svg aria-hidden="true" data-bw-tab-icon="" viewBox="0 0 24 24" focusable="false">
                                            <path d="M7 8h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zM12 4v4M9.5 12.5h.01M14.5 12.5h.01M3 12v3M21 12v3M8 21h8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                        </svg>
                                        <span data-bw-tab-label=""><FormattedMessage defaultMessage="Robots" description="Brickwright Robot Lab (3D LEGO model and physics) tab" id="gui.gui.robotLabTab" /></span>
                                    </Tab>
                                    {showCad ? <Tab className={tabClassNames.tab}
                                        title={intl.formatMessage({id: 'gui.gui.cadTab', defaultMessage: 'CAD'})}
                                        aria-label={intl.formatMessage({id: 'gui.gui.cadTab', defaultMessage: 'CAD'})}>
                                        <span aria-hidden="true" data-bw-tab-icon="">◇</span>
                                        <span data-bw-tab-label="">{'CAD'}</span>
                                    </Tab> : null}
                                    {helpEditor !== 'Code' && <EditorHelp inTabList editor={helpEditor} locale={intl.locale}
                                        label={intl.formatMessage({id: `gui.gui.${helpLabelId}`, defaultMessage: helpLabelDefault})} />}
                                </TabList>
                                <TabPanel className={tabClassNames.tabPanel}>
                                    {middleContent === 'code' ? (
                                        /* Content swap: the code preset puts the pseudocode editor
                                           in the first (blocks) tab panel. The blocks workspace
                                           stays mounted in TabPanel index 3 so it is not destroyed. */
                                        renderCodePane(activeTabIndex === 0)
                                    ) : (
                                        <React.Fragment>
                                            <Box className={styles.blocksWrapper}>
                                                <Blocks
                                                    key={`${blocksId}/${theme}`}
                                                    canUseCloud={canUseCloud}
                                                    grow={1}
                                                    isVisible={blocksTabVisible}
                                                    onAddExtension={onExtensionButtonClick}
                                                    onReadCode={() => {
                                                        onActivateTab(CODE_TAB_INDEX);
                                                        window.dispatchEvent(new CustomEvent('bw-read-blocks-into-code'));
                                                    }}
                                                    options={{
                                                        media: `${basePath}static/${themeMap[theme].blocksMediaFolder}/`
                                                    }}
                                                    stageSize={stageSize}
                                                    theme={theme}
                                                    vm={vm}
                                                />
                                            </Box>
                                            <Box className={styles.extensionButtonContainer}>
                                                <button
                                                    className={styles.extensionButton}
                                                    title={intl.formatMessage(messages.addExtension)}
                                                    onClick={onExtensionButtonClick}
                                                >
                                                    <img
                                                        className={styles.extensionButtonIcon}
                                                        draggable={false}
                                                        src={addExtensionIcon}
                                                    />
                                                </button>
                                            </Box>
                                            <Box className={styles.watermark}>
                                                <Watermark />
                                            </Box>
                                        </React.Fragment>
                                    )}
                                </TabPanel>
                                <TabPanel className={tabClassNames.tabPanel}>
                                    {costumesTabVisible ? <CostumeTab vm={vm} /> : null}
                                </TabPanel>
                                <TabPanel className={tabClassNames.tabPanel}>
                                    {soundsTabVisible ? <LazySoundTab vm={vm} /> : null}
                                </TabPanel>
                                <TabPanel className={tabClassNames.tabPanel}>
                                    {middleContent !== 'code' ? renderCodePane(activeTabIndex === CODE_TAB_INDEX) : null}
                                </TabPanel>
                                <TabPanel className={tabClassNames.tabPanel}>
                                    <EditorErrorBoundary name="Circuit"><CircuitTab /></EditorErrorBoundary>
                                </TabPanel>
                                {showFpga ? (
                                    <TabPanel className={tabClassNames.tabPanel}>
                                        <EditorErrorBoundary name="FPGA"><React.Suspense fallback={
                                            <div style={{padding: 24, color: '#64748b'}}>{'Loading FPGA lab…'}</div>
                                        }>
                                            <FpgaTab />
                                        </React.Suspense></EditorErrorBoundary>
                                    </TabPanel>
                                ) : null}
                                <TabPanel className={tabClassNames.tabPanel}>
                                    {/* The Robot Lab lives in robotsHost, placed here or in the right pane. */}
                                    <div ref={setRobotsTabSlot} style={SLOT_STYLE} />
                                    {robotLabWanted ? null : <div data-testid="bw-robot-lab-tab" data-state="idle" />}
                                </TabPanel>
                                {showCad ? <TabPanel className={tabClassNames.tabPanel}>
                                    <div ref={setCadTabSlot} style={SLOT_STYLE} />
                                </TabPanel> : null}
                            </Tabs>
                            {robotLabWanted && robotsHost ? ReactDOM.createPortal(<EditorErrorBoundary name="Robots">
                                <React.Suspense fallback={<div data-testid="bw-robot-lab-tab" data-state="loading" />}>
                                    <RobotLabTab
                                        isVisible={robotsVisible}
                                        locale={intl.locale}
                                        tabIndex={robotLabIndex}
                                        vm={vm}
                                    />
                                </React.Suspense></EditorErrorBoundary>, robotsHost) : null}
                            {showCad && cadWanted && cadHost ? ReactDOM.createPortal(<EditorErrorBoundary name="CAD">
                                <React.Suspense fallback={<div role="status">{intl.locale.startsWith('de') ? 'CAD wird geladen…' : 'Loading CAD…'}</div>}>
                                    <CadTab vm={vm} isVisible={cadVisible} docked={cadInPane} locale={intl.locale} theme={theme} onEditProgram={()=>props.onActivateTab(CODE_TAB_INDEX)} onOpenCircuit={()=>props.onActivateTab(4)} />
                                </React.Suspense>
                            </EditorErrorBoundary>, cadHost) : null}
                            <button
                                type="button"
                                data-right-pane-toggle="true"
                                aria-pressed={stagePaneVisible}
                                aria-label={stagePaneVisible
                                    ? (/^de/i.test(navigator.language) ? 'Rechtes Panel ausblenden' : 'Hide right panel')
                                    : (/^de/i.test(navigator.language) ? 'Rechtes Panel einblenden' : 'Show right panel')}
                                title={stagePaneVisible
                                    ? (/^de/i.test(navigator.language) ? 'Rechtes Panel ausblenden' : 'Hide right panel')
                                    : (/^de/i.test(navigator.language) ? 'Rechtes Panel einblenden' : 'Show right panel')}
                                onClick={() => {
                                    const next = !stagePaneVisible;
                                    setStagePaneVisible(next);
                                    try { localStorage.setItem('bw-right-pane-hidden', next ? '0' : '1'); } catch { /* private mode */ }
                                    window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-right-pane-hidden', value: next ? '0' : '1'}}));
                                    // Blockly caches its SVG dimensions and only re-fits on a resize
                                    // event. The pane-divider drag fires continuous resizes (so the
                                    // slider frees the space), but an instant hide/show does not —
                                    // the workspace stays at its old width and the freed room reads
                                    // as empty gap. Nudge it once the DOM has reflowed.
                                    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
                                }}
                                style={{position: 'absolute', zIndex: 20, right: 0, top: 6, width: 32, minWidth: 32, height: 32, padding: 0, border: '1px solid #94a3b8', borderRadius: 5, background: stagePaneVisible ? '#2563eb' : '#475569', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 22, lineHeight: 1}}
                            >{stagePaneVisible ? '›' : '‹'}</button>
                            {backpackVisible ? (
                                <Backpack host={backpackHost} />
                            ) : null}
                        </Box>

                        {stagePaneVisible ? <PaneDivider
                            isRtl={isRtl}
                            share={rightSize}
                            onCollapseToggle={() => onSetPaneSize &&
                                onSetPaneSize('right', isCollapsed(rightSize) ? 'm' : 'xs')}
                            onResize={share => onSetPaneSize && onSetPaneSize('right', share)}
                        /> : null}

                        <Box className={classNames(styles.stageAndTargetWrapper, styles[stageSize])}
                            data-right-pane="true"
                            style={stageFullScreen ? {
                                flex: '1 1 100%', width: '100%', minWidth: 0, height: '100%'
                            } : (stagePaneVisible ? paneStyles.right : {
                                display: 'none', flex: '0 0 0', width: 0, minWidth: 0
                            })}>
                            {/* Covers the column rather than replacing it — the stage stays
                                mounted underneath, clipped to 28px, so restoring is instant
                                and scratch-render's canvas is never torn down. */}
                            {isCollapsed(rightSize) ? (
                                <PaneStrip
                                    onRestore={() => onSetPaneSize && onSetPaneSize('right', 'm')}
                                />
                            ) : null}
                            {/* StageWrapper always renders so its header (view
                                toggle buttons) stays reachable in every mode.
                                In controller mode the stage canvas is hidden
                                so the panel owns the full column. */}
                            <div hidden={isFullScreen && dockMode === 'controller'}
                                style={circuitOwnsStage || dockMode === 'controller' || dockMode === 'arcade' || dockMode === 'cpx' || dockMode === 'arduboy' || dockMode === 'makecode' || dockMode === 'spikearena' || dockMode === 'cad' || dockMode === 'robots' ? {maxHeight: 44, overflow: 'hidden', flexShrink: 0, borderBottom: '3px solid #475569', background: '#cbd5e1', boxShadow: '0 3px 6px rgba(0,0,0,0.22)', position: 'relative', zIndex: 5, boxSizing: 'border-box'} : undefined}>
                                <EditorErrorBoundary name="Stage"><StageWrapper
                                    isFullScreen={isFullScreen}
                                    isRendererSupported={isRendererSupported}
                                    isRtl={isRtl}
                                    stageSize={stageSize}
                                    vm={vm}
                                /></EditorErrorBoundary>
                            </div>
                            {gameControlKey && dockMode !== 'microbit' && dockMode !== 'arcade' && dockMode !== 'controller' ? (
                                <React.Suspense fallback={null}>
                                    <GameTouchControls gameKey={gameControlKey} vm={vm} />
                                </React.Suspense>
                            ) : null}
                            {dockMode === 'cad' || dockMode === 'robots' ? (
                                <div data-bw-stage-dock={dockMode} key={dockMode}
                                    ref={dockMode === 'cad' ? setCadPaneSlot : setRobotsPaneSlot}
                                    style={dockFullScreenStyle || {position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff'}}>
                                    {(dockMode === 'cad' ? (cadTabActive || !showCad) : robotsTabActive) ? (
                                        <p role="status" style={{margin: 'auto', padding: 24, maxWidth: 320, textAlign: 'center', color: '#64748b', fontSize: 13}}>
                                            {dockMode === 'cad' && !showCad ?
                                                (intl.locale.startsWith('de') ? 'Schalte den CAD-Editor unter Einstellungen → Arbeitsbereich ein.' : 'Turn on the CAD Editor in Settings → Workspace.') :
                                                (intl.locale.startsWith('de') ? 'Wird gerade in seinem Tab angezeigt. Wechsle zu den Blöcken, um es hier zu sehen.' : 'Showing in its own tab right now. Switch back to the blocks to see it here.')}
                                        </p>
                                    ) : null}
                                </div>
                            ) : dockMode === 'microbit' ? (
                                <React.Suspense fallback={
                                    <div style={{padding: 24, color: '#64748b'}}>{/^de/i.test(navigator.language) ? 'micro:bit-Simulator wird geladen…' : 'Loading micro:bit simulator…'}</div>
                                }>
                                    <div style={dockFullScreenStyle || {position: 'relative', flex: 1, minHeight: 0}}>
                                        <MicrobitSimPane />
                                    </div>
                                </React.Suspense>
                            ) : dockMode === 'spikearena' ? (
                                <React.Suspense fallback={<div style={{padding: 24, color: '#64748b'}}>{/^de/i.test(navigator.language) ? 'SPIKE-Simulator wird geladen…' : 'Loading SPIKE simulator…'}</div>}>
                                    <div style={dockFullScreenStyle || {position: 'relative', flex: 1, minHeight: 0}}>
                                        <SpikeSimulatorPane vm={vm} locale={intl.locale}
                                            isFullScreen={isFullScreen} onEnterFullScreen={props.onEnterFullScreen} />
                                    </div>
                                </React.Suspense>
                            ) : dockMode === 'makecode' ? (
                                <React.Suspense fallback={<div style={{padding: 24, color: '#64748b'}}>Loading MakeCode simulator…</div>}>
                                    <div style={dockFullScreenStyle || {position: 'relative', flex: 1, minHeight: 0}}>
                                        <MakeCodeSimPane vm={vm} />
                                    </div>
                                </React.Suspense>
                            ) : dockMode === 'arduboy' ? (
                                <React.Suspense fallback={<div style={{padding: 24, color: '#64748b'}}>Loading Arduboy…</div>}>
                                    <div style={dockFullScreenStyle || {position: 'relative', flex: 1, minHeight: 0}}>
                                        <ArduboyPane vm={vm} />
                                    </div>
                                </React.Suspense>
                            ) : dockMode === 'cpx' ? (
                                <React.Suspense fallback={<div style={{padding: 24, color: '#64748b'}}>Loading Circuit Playground…</div>}>
                                    <div style={dockFullScreenStyle || {position: 'relative', flex: 1, minHeight: 0}}>
                                        <CpxDevicePane vm={vm} />
                                    </div>
                                </React.Suspense>
                            ) : dockMode === 'arcade' ? (
                                <React.Suspense fallback={<div style={{padding: 24, color: '#64748b'}}>Loading game console…</div>}>
                                    <div style={dockFullScreenStyle || {position: 'relative', flex: 1, minHeight: 0}}>
                                        <ArcadeDevicePane vm={vm} />
                                    </div>
                                </React.Suspense>
                            ) : dockMode === 'controller' ? (
                                <React.Suspense fallback={
                                    <div style={{padding: 24, color: '#64748b'}}>Loading controller…</div>
                                }>
                                    <div data-bw-stage-dock="controller" style={dockFullScreenStyle || {position: 'relative', zIndex: 1, flex: 1, minHeight: 0, borderTop: '1px solid #ffffff', background: '#f8fafc'}}>
                                        <ControllerPanelView
                                            panel={controllerPanel}
                                            board={board}
                                            manageBoardBinding={false}
                                            vm={vm}
                                            machineConsole={machineConsole}
                                            machineTerminal={machineTerminal}
                                            aceKimMachine={aceKimMachine}
                                            sendBasicLine={vm?.runtime?.bwBasicSerial}
                                            cp1WidgetSlot={cp1Attached ? setCp1ControllerSlot : undefined}
                                            cardiacWidgetSlot={cardiacAttached ? setCardiacControllerSlot : undefined}
                                            locale={intl.locale}
                                            isFullScreen={isFullScreen}
                                            onExitFullScreen={props.onExitFullScreen}
                                            onEnterFullScreen={props.onEnterFullScreen}
                                        />
                                    </div>
                                </React.Suspense>
                            ) : (
                                <Box className={styles.targetWrapper} style={circuitOwnsStage ? {display: 'none'} : undefined}>
                                    <EditorErrorBoundary name="Sprites"><React.Suspense fallback={<div role="status">Loading sprites and artwork…</div>}>
                                        <TargetPane stageSize={stageSize} vm={vm} />
                                    </React.Suspense></EditorErrorBoundary>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>
                <DragLayer />
            </Box>
        );
    }}</MediaQuery>{machineManagerModal}<LogikusHost panel={controllerPanel} locale={intl.locale} vm={vm} /></React.Fragment></Cp1Surfaces.Provider></CardiacSurfaces.Provider>);
};

GUIComponent.propTypes = {
    accountNavOpen: PropTypes.bool,
    activeTabIndex: PropTypes.number,
    authorId: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false
    authorThumbnailUrl: PropTypes.string,
    authorUsername: PropTypes.oneOfType([PropTypes.string, PropTypes.bool]), // can be false
    backdropLibraryVisible: PropTypes.bool,
    backpackHost: PropTypes.string,
    backpackVisible: PropTypes.bool,
    basePath: PropTypes.string,
    blocksTabVisible: PropTypes.bool,
    blocksId: PropTypes.string,
    canChangeLanguage: PropTypes.bool,
    canChangeTheme: PropTypes.bool,
    canCreateCopy: PropTypes.bool,
    canCreateNew: PropTypes.bool,
    canEditTitle: PropTypes.bool,
    canManageFiles: PropTypes.bool,
    canRemix: PropTypes.bool,
    canSave: PropTypes.bool,
    canShare: PropTypes.bool,
    canUseCloud: PropTypes.bool,
    cardsVisible: PropTypes.bool,
    children: PropTypes.node,
    costumeLibraryVisible: PropTypes.bool,
    costumesTabVisible: PropTypes.bool,
    enableCommunity: PropTypes.bool,
    intl: intlShape.isRequired,
    isCreating: PropTypes.bool,
    isFullScreen: PropTypes.bool,
    isPlayerOnly: PropTypes.bool,
    isRtl: PropTypes.bool,
    isShared: PropTypes.bool,
    isTotallyNormal: PropTypes.bool,
    loading: PropTypes.bool,
    logo: PropTypes.string,
    onActivateCostumesTab: PropTypes.func,
    onActivateSoundsTab: PropTypes.func,
    onActivateTab: PropTypes.func,
    onClickAccountNav: PropTypes.func,
    onClickLogo: PropTypes.func,
    onCloseAccountNav: PropTypes.func,
    onExtensionButtonClick: PropTypes.func,
    onEnterFullScreen: PropTypes.func,
    onExitFullScreen: PropTypes.func,
    onLogOut: PropTypes.func,
    onOpenRegistration: PropTypes.func,
    onRequestCloseBackdropLibrary: PropTypes.func,
    onRequestCloseCostumeLibrary: PropTypes.func,
    onRequestCloseTelemetryModal: PropTypes.func,
    onSeeCommunity: PropTypes.func,
    onShare: PropTypes.func,
    onShowPrivacyPolicy: PropTypes.func,
    onStartSelectingFileUpload: PropTypes.func,
    onTabSelect: PropTypes.func,
    onTelemetryModalCancel: PropTypes.func,
    onTelemetryModalOptIn: PropTypes.func,
    onTelemetryModalOptOut: PropTypes.func,
    onToggleLoginOpen: PropTypes.func,
    renderLogin: PropTypes.func,
    showComingSoon: PropTypes.bool,
    soundsTabVisible: PropTypes.bool,
    stageSizeMode: PropTypes.oneOf(Object.keys(STAGE_SIZE_MODES)),
    targetIsStage: PropTypes.bool,
    telemetryModalVisible: PropTypes.bool,
    theme: PropTypes.string,
    tipsLibraryVisible: PropTypes.bool,
    vm: PropTypes.instanceOf(VM).isRequired
};
GUIComponent.defaultProps = {
    backpackHost: null,
    backpackVisible: false,
    basePath: './',
    blocksId: 'original',
    canChangeLanguage: true,
    canChangeTheme: true,
    canCreateNew: false,
    canEditTitle: false,
    canManageFiles: true,
    canRemix: false,
    canSave: false,
    canCreateCopy: false,
    canShare: false,
    canUseCloud: false,
    enableCommunity: false,
    isCreating: false,
    isShared: false,
    isTotallyNormal: false,
    loading: false,
    showComingSoon: false,
    stageSizeMode: STAGE_SIZE_MODES.large
};

const mapStateToProps = state => ({
    blocksId: state.scratchGui.timeTravel.year.toString(),
    stageSizeMode: state.scratchGui.stageSize.stageSize,
    theme: state.scratchGui.theme.theme,
    paneLayout: state.scratchGui.paneLayout
});

const mapDispatchToProps = dispatch => ({
    onSetPaneSize: (column, size) => dispatch(setPaneSize(column, size)),
    onEnterFullScreen: () => dispatch(setFullScreen(true)),
    onExitFullScreen: () => dispatch(setFullScreen(false))
});

export default injectIntl(connect(
    mapStateToProps,
    mapDispatchToProps
)(GUIComponent));
