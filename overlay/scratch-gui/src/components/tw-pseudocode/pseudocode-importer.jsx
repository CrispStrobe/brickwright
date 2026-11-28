import React from 'react';
import {remoteMachineImagesAllowed, remoteToolchainsAllowed} from '../../lib/distribution-policy.js';
import {createPortal} from 'react-dom';
import {showDebuggerOnStage} from '../../lib/bw-debug/show-debugger-on-stage.js';
import {usesScratchStage} from './code-example-view.js';
import {isMachinePickerBackdrop} from './machine-picker-view.js';
import {collectCodeNotices} from './code-notices.js';
import {Icon, Popup, toolStyles} from './sim-lab-toolbar.jsx';
import ScrollRow from './toolbar-scroll-row.jsx';
import {toolbarActionApplies} from '../../lib/code-toolbar-actions.js';
import {notifyEditorMenuActions, registerEditorMenuActions} from '../../lib/editor-menu-actions.js';
import {clearControllerPanel} from '../../lib/controller-inputs.js';
import PropTypes from 'prop-types';
import {connect} from 'react-redux';
import {setProjectTitle} from '../../reducers/project-title';
import {closeAlertWithId, showStandardAlert} from '../../reducers/alerts';
import {DEVICE_CHIP_LABELS} from '../../lib/device-labels.js';
import {normalizeDeviceId, resolveExampleBench} from '../../lib/example-bench.js';
import brickRobot from './brick-robot.svg';
import {IMPORT_ACCEPT, isImportableArtefact} from '../../lib/bw-makecode/accept.js';
// Static, not lazy: `_asmExamples()` is read during render, so it has to be
// synchronous — and the module is a few KB of strings, not a chunk worth
// splitting.
import {asmExamplesFor, riscvCExamplesFor, arduinoSketchExamplesFor} from '../../lib/bw-asm/examples.js';
import {blinkChoices, blinkMachineLabel, blinkFamily, blinkMachines, blinkProgramSource, blinkSource, blinkStarter} from '../../lib/bw-asm/blink-machines.js';
import {requestSketchBuild, sketchBoardFor, sketchFirmware} from '../../lib/bw-debug/arduino-sketch.js';
import {armRunFor, imageFromIntelHex} from '../../lib/bw-asm/arm-image.js';
import {
    requestAssembly, requestCBuild, asmRouteFor, cRouteFor, requestRiscvCBuild, requestBasicBuild, asmTargetForDevice, ASM_DIALECTS,
    RISCV_CC_ENDPOINT,
    runDosToolchain
} from '../../lib/bw-asm/assemble-route.js';
import {
    summarize as matrixSummary, explain as matrixExplain, LANGUAGES as MATRIX_LANGUAGES,
    DEVICES, DEVICE_GROUPS, cell as matrixCell
} from '../../lib/bw-matrix/capabilities.js';
import {basicProfileFor, basicProfilesFor, codeLanguageAvailable, hiddenCodeDrafts,
    picoBasicProfileForDialect, standaloneBasicDrafts} from '../../lib/bw-matrix/code-languages.js';
import {libraryMedia, loadPicoBasicFirmware, openLibraryMedia} from '../../lib/bw-machines/library-media.js';
import {runMachineConfig} from '../../lib/bw-machines/run-machine.js';
import {picoBasicCommands, picoBasicConsoleSpec} from '../../lib/bw-machines/pico-basic-source.js';
import {feProgramToC} from '../../lib/bw-lang/fe-target-c.js';
import {forthProgramToC} from '../../lib/bw-lang/forth-target-c.js';
import {fetchTclProgramC} from '../../lib/bw-lang/tcl-target-c.js';
import {setCircuitView, showCircuitDebugger} from '../../lib/bw-debug/debug-view.js';
import downloadBlob from '../../lib/download-blob.js';
import animationResourceMenuItems from 'scratch-vm/src/util/bw-animation-resource-menu.js';
import {conversionFailure} from '../../lib/bw-conversion-error.js';
import {getCostumeDocument, inspectArtwork, applyArtwork, syncAnimationResources} from '../../lib/bw-artwork-bundle.js';
import {captureCodeArtwork, codeArtworkMatches, retainCodeArtwork,
    captureCodeArtworkRevision, codeArtworkRevisionMatches} from '../../lib/bw-code-artwork.js';

// The example sources — upstream's and the locally-authored games, kept in
// separate files so the upstream one stays synchronizable — are 266 KiB raw
// (51 KiB compressed) that the entry bundle carried for a picker on one tab.
// They are fetched when the no-device Tools menu opens (or when restored game
// controls need to identify their source). `loadExample` awaits the load
// itself, so a click that races the fetch still works.
let examples = {};
let examplesPending = null;
let examplesReady = false;
const loadExamples = () => {
    if (!examplesPending) {
        const pending = Promise.all([
            import(/* webpackChunkName: "pseudocode-examples" */ '../../lib/sb3-creator-examples.js'),
            import(/* webpackChunkName: "pseudocode-examples" */ '../../lib/sb3-creator-game-examples.js')
        ]).then(([upstreamExamples, gameExamples]) => {
            // Keep locally-authored games outside the upstream-synchronized examples file.
            examples = {...upstreamExamples.default, ...gameExamples.default};
            examplesReady = true;
            return examples;
        }).catch(error => {
            // A transient offline/cache miss must not poison every later Tools
            // open. Only clear the promise that actually failed: a future
            // retry may already have installed a new one.
            if (examplesPending === pending) examplesPending = null;
            throw error;
        });
        examplesPending = pending;
    }
    return examplesPending;
};

const DEVICE_BY_ID = {};
for (const g of DEVICE_GROUPS) for (const d of g.devices) DEVICE_BY_ID[d.id] = { ...d, core: g.core, group: g.label };

// i18n for the Code tab's own strings. The editor already exposes the current locale in redux
// (state.locales.locale); we pick en/de from this table (falling back to English). Values may be
// functions for interpolation. To add a language, add its column.
import {lowerableLines} from '../../lib/bw-fpga/pseudocode-expr.js';
import {getFpgaEnabled} from '../../lib/bw-fpga-preferences.js';
import {isSpike3Program, runSpike3OnVirtualHub} from '../../lib/spike3-python-run.js';
import {isSpikeExtensionLoaded, snapshotSpikePorts} from '../../lib/spike-port-snapshot.js';
import {createCodeRunFeedback} from '../../lib/spike-arena/code-run-feedback.js';
// Every yes/no question is awaited: `window.confirm` cannot block in the desktop/iOS app.
import {confirmAsync, promptAsync} from '../../lib/native-dialog.js';
import {mathWithRandom, runWithReplayedInput} from '../../lib/replay-input.js';
import {createCodeExecutionSession} from '../../lib/code-execution-session.js';
import {JAVASCRIPT_WORKER_SOURCE, createPythonWorkerSource} from '../../lib/code-execution-workers.js';
import {
    createCodeDocument, readCodeDocument, editCodeDocument, selectCodeDocumentLanguage,
    addCodeProjection, restoreCodeDocumentState, serializeCodeDocument,
    codeDocumentConversionRefusal, codeTargetFromSource, OWNED_CONSOLE_EXECUTION
} from '../../lib/code-source-document.js';
// F10: an imported MakeCode project's own files, kept in the .sb3 and marked stale once the program changes.
import makeCodeOriginal from 'scratch-vm/src/serialization/bw-makecode-original.js';

// gui.jsx's tab order: the FPGA tab follows Circuit. Stated here because the
// handoff has to name a tab index and a wrong one silently switches to Sounds.
const FPGA_TAB_INDEX = 5;

const L10N = {
    en: {
        closeNotice: 'Close',
        cpmRunHint: 'Run the CP/M program. Edits build with hosted SDCC.',
        actionFiles: 'Files', actionPrograms: 'Program and export', actionExamples: 'Examples',
        fileMenuTitle: 'Open, save, import, examples and reference',
        makeCircuit: '⚙ Make this a circuit',
        makeCircuitTitle: e => `Build "${e}" as logic gates in the FPGA tab — it is a boolean expression over 1-bit pins, so it needs no program to run`,
        makeCircuitWhy: 'This line is a boolean expression over 1-bit input pins, which is a circuit: no time, no variables, nothing to run.',
        loadExample: '📚 Load example…', loadExampleTitle: 'Load a built-in example',
        examplesLoading: 'Loading built-in examples…',
        examplesRetry: 'Built-in examples unavailable — retry',
        openFile: 'Open', openFileTitle: t => `Open a source file (${t})`,
        saveFile: 'Save', saveFileTitle: n => `Save this tab as ${n}`,
        exportMakeCode: '📦 MakeCode source',
        exportMakeCodeTitle: 'Download the original recovered MakeCode project files for the official editor or PXT CLI',
        openBad: e => `Don't know that file type (${e}).`,
        openDone: (f, t) => `Loaded ${f} into the ${t} tab`,
        mcReading: f => `Reading ${f}…`,
        downloadHex: 'Export firmware (.hex)…',
        microbitNeedFirmware: 'Pick a MicroPython .hex once (from python.microbit.org, or the one that came with the board) — it is kept for this session.',
        microbitFirmwareBad: f => `${f} is not an Intel HEX file.`,
        microbitHexReady: f => `${f} saved. Copy it onto the MICROBIT drive.`,
        microbitFlash: '⚡ flash the micro:bit',
        microbitFlashTitle: 'Program the board directly over WebUSB (micro:bit V2 only) — no drag-and-drop.',
        microbitFlashPrep: 'Building the .hex to flash…',
        microbitFlashPick: 'Pick your micro:bit in the browser prompt…',
        microbitFlashing: 'Flashing the micro:bit — leave it plugged in…',
        microbitFlashDone: n => `Flashed ${n} bytes. The micro:bit has reset and is running your program.`,
        arduboyRunning: f => `Running ${f} on the Arduboy console. Arrow keys move, Z is A, X is B.`,
        mcPython: (f, n) => `${f} carried a MicroPython program (${n}) — loaded, and the simulator can run it.`,
        mcMicrobit: (f, n) => `Imported "${n}" from ${f} — MakeCode micro:bit, translated to blocks.`,
        mcEv3: (f, n) => `Imported "${n}" from ${f} — MakeCode LEGO EV3, translated to EV3 blocks.`,
        mcCpx: (f, n) => `Imported "${n}" from ${f} — MakeCode Circuit Playground Express, translated to CPX blocks.`,
        mcPartial: (f, n, k) => `Imported "${n}" from ${f}. ${k} thing(s) from MakeCode have no equivalent here; each is marked "# unsupported" in the code.`,
        mcArcade: (f, n, s, c, button) => `Imported the Arcade game "${n}" from ${f}: ${s} sprite(s), ${c} costume(s). Press ${button} to build it.`,
        mcNoSource: (f, k) => `${f} is a ${k} file with no project source embedded in it — nothing to import.`,
        mcFailed: (f, e) => `Could not read ${f}: ${e}`,
        mcShare: '🔗 MakeCode…',
        mcShareTitle: 'Import a project from a MakeCode share link (arcade.makecode.com or makecode.microbit.org)',
        mcSharePrompt: 'Paste a MakeCode share link:',
        mcShareLoading: 'Fetching the shared project…',
        mcExport: '⬆ To MakeCode',
        mcExportTitle: 'Save this project as a native MakeCode project (.mkcd)',
        mcExportDone: (f, u, editor) => (u ?
            `Saved ${f} — drop it on ${editor} to open it there. ${u} block(s) had no MakeCode equivalent.` :
            `Saved ${f} — drop it on ${editor} to open it there.`),
        mcExportEmpty: 'Nothing to export — write some blocks first.',
        mcRun: '▶ Run in MakeCode simulator',
        mcRunTitle: 'Compile this MakeCode project with MakeCode\'s own compiler and run it in MakeCode\'s simulator — nothing is translated, so nothing is lost',
        mcRunCompiling: n => `Compiling ${n} with MakeCode…`,
        toolbarLanguages: 'Languages', moreLanguages: 'More languages',
        cardiacLanguage: 'CARDIAC decimal computer',
        cp1Language: 'Kosmos CP1 teaching language…',
        cp1Open: 'Open the Kosmos CP1 starter? This replaces the current circuit and CP1 source.',
        mcRunStarted: (n, t) => `${n} is running in MakeCode's ${({arcade: 'Arcade', calliopemini: 'Calliope mini', ev3: 'EV3', adafruit: 'Circuit Playground'})[t] || 'micro:bit'} simulator.`,
        mcFetched: list => ` Extensions fetched from GitHub for this build: ${list}.`,
        mcLicenceUnknown: 'licence not recognised',
        mcEmulate: '▶ Run on the emulated micro:bit V2',
        mcEmulateTitle: 'Compile this micro:bit project with MakeCode\'s own compiler onto the Bluetooth-free firmware bases and run the real image on LabWired\'s micro:bit V2 (nRF52833) in the Debug pane — the official base carries Nordic\'s SoftDevice, which the emulator never runs',
        mcEmulateBuilding: n => `Building ${n} for the emulated micro:bit V2…`,
        mcEmulateStarted: n => `${n} is running on the emulated micro:bit V2. See the LED matrix in Widgets and serial output in the Debug pane.`,
        mcEmulateNoBases: 'This build does not serve the micro:bit V2 emulator bases (npm run sync:makecode fetches them), or this project needs a package set they do not cover; the emulator never falls back to the official base.',
        mcEmulateRefused: m => `The emulator refused this firmware base: ${m}`,
        mcFirmware: '⤓ Firmware for the board',
        mcFirmwareTitle: 'Build the real firmware for this project\'s board (micro:bit or Calliope .hex, EV3, Circuit Playground or the chosen Arcade board .uf2), with the project inside so MakeCode can reopen it',
        mcFirmwareBuilding: n => `Building firmware for ${n}…`,
        mcFirmwareDone: f => `Saved ${f} — copy it onto the board's USB drive (MICROBIT, MINI, CPLAYBOOT, EV3) to flash it. MakeCode also opens it as a project.`,
        mcNoRuntime: 'MakeCode runtime files are unavailable in this build.',
        mcNoBase: u => `This project uses a C++ extension outside MakeCode's default set, and building its firmware needs MakeCode's cloud compiler. It still runs in the simulator; to flash it, open it on ${u}.`,
        mcBoardPick: 'Arcade board…',
        mcBoardTitle: 'The board to build this Arcade game\'s firmware for — MakeCode Arcade\'s own list of boards',
        mcBoardByChip: 'Other boards, by chip',
        mcBoardNone: 'Choose the Arcade board first: MakeCode Arcade builds firmware for one board at a time, and there is no firmware for "no board".',
        mcBoardFirmwareDone: (f, b) => `Saved ${f} for ${b} — put the board into its bootloader (usually: press reset twice) and copy the file onto the USB drive that appears. MakeCode also opens it as a project.`,
        mcUnsupportedTarget: t => `MakeCode ${t} projects are not something this build can compile (micro:bit and Arcade are).`,
        mcCompileErrors: (n, first) => `MakeCode found ${n} error(s): ${first}`,
        mcNothingToRun: 'Nothing to run — import a MakeCode project, or write blocks for a micro:bit.',
        mcBoardsCompiling: n => `Compiling ${n} boards with MakeCode…`,
        mcBoardsFirmwareBuilding: n => `Building firmware for ${n} boards…`,
        mcBoardsFirmwareDone: files => `Saved ${files.join(' and ')}: one file per board. Copy each onto its own board's USB drive (MICROBIT, MINI) to flash it.`,
        mcBoardsExportDone: files => `Saved ${files.join(' and ')}: one MakeCode project per board.`,
        mcBoardsStarted: names => `${names.join(' + ')} are running side by side in MakeCode's simulators, sharing one radio.`,
        mcBoardNotMakeCode: (board, device) => `Board "${board}" is a ${device || 'board with no device'}: only micro:bit and Calliope mini boards run together in MakeCode's simulators.`,
        mcBoardCompileErrors: (board, n, first) => `Board "${board}": MakeCode found ${n} error(s). ${first}`,
        arcRun: '▶ Run as MakeCode Arcade',
        arcRunTitle: 'Turn this Scratch project into a MakeCode Arcade game (sprites from their costumes, scripts as code) and run it in MakeCode\'s Arcade simulator',
        arcExport: '⬆ To MakeCode Arcade',
        arcExportTitle: 'Save this project as a MakeCode Arcade game that arcade.makecode.com opens',
        gameWeb: '⬆ Playable web game (.zip)',
        gameWebTitle: 'Export this project as an editable JavaScript game: open play.html in any browser',
        gamePy: '⬆ Python + pygame game (.zip)',
        gamePyTitle: 'Export this project as an editable Python game: pip install pygame, then python main.py',
        gameDone: (f, a) => `Saved ${f}.${a ? ` ${a} block kind(s) run approximately — see README.md in the zip.` : ''}`,
        gameRefused: r => `Not exported: these blocks have no game-runtime equivalent yet — ${r}`,
        arcDone: (f, u) => `Saved ${f} — drop it on arcade.makecode.com.${u ? ` ${u} block kind(s) have no Arcade counterpart (commented where they stood).` : ''}`,
        arcStarted: u => `Running as a MakeCode Arcade game.${u ? ` ${u} block kind(s) have no Arcade counterpart.` : ''}`,
        saveEmpty: 'Nothing to save — this tab is empty.',
        restored: t => `Restored your unsaved ${t}.`,
        loadCatalogTitle: 'Load a catalog example for this device',
        noChips: 'Scratch stage',
        searchExamples: 'Search examples…',
        catalogLoading: 'Loading example catalog…',
        catalogEmpty: 'No catalog examples for this device.',
        catalogNoMatch: 'No examples match that search.',
        catalogUnavailable: e => `Example catalog unavailable (${e})`,
        infoTitle: 'Click for info', infoAria: 'About the Code tab',
        matrixTitle: 'What runs where: every language on every chip, native or lowered, simulator or silicon',
        matrixAria: 'Show the language and device matrix', matrixInfoAria: 'Reach of this language on this board',
        matrixHeading: 'What runs where',
        matrixLegend: 'native = the language itself runs on the chip · lowered = read into the dialect and re-emitted as something the chip runs · sim / silicon = where the result can go · open = a named task, not yet',
        matrixCurrent: 'current choice',
        reference: 'reference', referenceTitle: l => `Reference for ${l}`,
        customArt: 'Custom sprite art', customArtTitle: 'Upload SVGs and bake them in as sprite costumes',
        toBlocks: '⇦ To blocks', toBlocksTitle: l => `Compile this ${l} into blocks`,
        fromBlocks: 'From blocks ⇨', fromBlocksTitle: 'Read the current blocks back into all languages',
        compactToBlocks: '⇦ Blocks', compactFromBlocks: 'Blocks ⇨',
        run: 'Run', runBasic: '▶ Run BASIC', runFe: '▶ Run fe', runTcl: '▶ Run Tcl', runForth: '▶ Run Forth', animationLabel: 'Animation', runViaBlocks: d => `▶ ${d} via blocks`,
        runFeRiscv: '▶ fe on RISC-V', runTclRiscv: '▶ Tcl on RISC-V',
        runTclRiscvTitle: 'Build Jim Tcl with this program as C and run it on the RISC-V board', runForthRiscv: '▶ Forth on RISC-V',
        runForthRiscvTitle: 'Build zForth with this program as C and run it on the RISC-V board', runFeRiscvTitle: 'Build the fe interpreter with this program as C and run it on the RISC-V board',
        runViaBlocksTitle: 'Convert to blocks, then build them as C for the selected board in the debugger',
        nqcCompile: '⚙ Compile .rcx', nqcSend: '🧱 Send to RCX',
        nqcEmpty: 'Type some NQC first.',
        nqcNoCompiler: 'This build has no local NQC compiler.',
        nqcNoTower: 'No tower support here — the .rcx was saved instead. Send it with NQC, ' +
            'Bricx Command Center or firmdl3.',
        nqcSent: 'Sent to the brick.',
        nqcNote: 'NQC (Not Quite C) for the LEGO RCX, compiled in your browser — no network. ' +
            'Two units are easy to get silently wrong: motor power is 0-7, NOT a percentage ' +
            '(OUT_LOW is 1, OUT_HALF 3, OUT_FULL 7), and Wait() and PlayTone() take ' +
            'CENTISECONDS, so Wait(100) is one second. The brick needs LEGO firmware already ' +
            'loaded; nobody may redistribute it, so this app cannot supply it. A brick without ' +
            'firmware answers exactly like a brick that is switched off.',
        basicBudget: ms => `Stopped after ${(ms / 1000).toFixed(0)}s simulated time (endless loop?).`,
        basicInputExhausted: 'Program asked for INPUT but no more answers were provided.',
        basicNoPrompt: 'BASIC did not reach its ready prompt — the ROM may not have loaded.',
        basicLoading: 'Loading BASIC machine…',
        basicEngine: 'Engine', basicCrispEngine: 'CrispBASIC (browser)', basicZ80Engine: 'BBC BASIC Z80 (retro)',
        basicZ80Numbering: line => `BBC BASIC Z80 needs unique, increasing, unsigned whole-number line numbers on every statement (editor line ${line}). Enable Line numbers and regenerate the BASIC, or choose CrispBASIC.`,
        basicCrispLoading: 'Loading CrispBASIC…', basicCrispRunning: 'CrispBASIC is running.',
        basicCrispStopped: 'CrispBASIC stopped.', basicCrispStopping: 'Stopping CrispBASIC…',
        basicCrispReset: 'Reset', basicCrispResetDone: 'CrispBASIC reset.',
        basicCrispCompleted: code => code ? `Completed (exit ${code}).` : 'Completed.',
        basicCrispTimeout: 'CrispBASIC reached the 60-second run limit.',
        basicCrispOutputLimit: 'CrispBASIC reached the output limit.',
        basicCrispSimulationLimit: 'CrispBASIC reached a circuit simulation limit.',
        basicConnectCircuit: 'Connect Circuit',
        basicPortableLibrary: 'Generate portable Circuit calls',
        basicPortableHint: 'Regenerate from blocks to apply this choice. Portable calls need Connect Circuit to run; To blocks currently refuses them. Toggle and unsupported hardware operations are reported as generation errors.',
        basicCrispError: 'CrispBASIC could not finish this program.',
        basicInputLine: 'Program input', basicInputKey: 'One character (empty for Enter)',
        basicInputSend: 'Send', basicInputEnd: 'End input',
        basicInputKeyError: 'Enter one Latin-1 character, or leave the field empty for Enter.',
        basicCrispScope: 'Text, input and basic VDU drawing. Connect Circuit enables digital pins and simulated time on the current circuit. Physical hardware, files, graphics queries, sound and source debugging are unavailable. Runs stop after 60 seconds.',
        basic8086Building: 'Compiling BASIC for the 8086 in this browser…',
        basicRealDosBuilding: 'Compiling BASIC and preparing a real MS-DOS 2.0 boot disk…',
        basicRealDosFailed: (m) => `Could not prepare the MS-DOS boot disk: ${m}`,
        basicRealDosBooted: (n) => `Built ${n} bytes and booting real MS-DOS 2.0 — it runs PROG.COM at the A> prompt.`,
        basicEmpty: 'Enter a BASIC program to run.',
        basicUbasicRunning: 'Running your BASIC on the libre uBASIC interpreter on the DOS bench…',
        basicUbasicFailed: (m) => `The uBASIC (on DOS) route could not run: ${m}`,
        feRunning: 'Running your fe (Lisp) on the libre fe interpreter on the DOS bench…',
        feFailed: (m) => `The fe (Lisp on DOS) route could not run: ${m}`,
        forthRunning: 'Running your Forth on zForth, a libre interpreter, on the DOS bench…',
        forthFailed: (m) => `The Forth (zForth on DOS) route could not run: ${m}`,
        tclRunning: 'Running your Tcl on Jim Tcl, a libre interpreter, on the DOS bench…',
        tclFailed: (m) => `The Tcl (Jim Tcl on DOS) route could not run: ${m}`,
        basic8086Refused: (m) => `The BASIC compiler refused this program: ${m}`,
        basic8086Failed: (m) => `The 8086 BASIC route could not run: ${m}`,
        apply: '✓ Apply art & convert to blocks', done: 'Done',
        applyTitle: n => `Assign a sprite to ${n} more file(s) first`,
        applyReady: 'Bake these costumes in and convert your code to blocks',
        doneTitle: 'Keep these costumes; they apply on the next ⇦ To blocks',
        needSprite: n => `${n} file(s) still need a sprite.`,
        svgFile: 'SVG file', sprite: 'Sprite', mode: 'Mode', chooseSprite: '— choose sprite —',
        notInCode: 'not in code', replaceCostume: 'replace costume', addFrame: 'add as frame',
        driverShim: 'driver: shim', driverRemote: 'driver: remote (bridge)', driverOnbrick: 'driver: on-brick',
        driverSim: 'driver: simulated board',
        driverTitle: 'Hardware-extension driver: shim (neutral) · remote (bridge over WebSocket) · on-brick (device transpiler). The program is driver-agnostic; this only swaps the driver.',
        asyncLabel: 'async', asyncTitle: 'await hardware calls (BLE is async) and make functions async',
        eventsLabel: 'events', eventsTitle: 'turn extension event hats (when button pressed …) into driver callbacks',
        stConverting: to => `Converting to ${to}…`, stCantShow: (to, e) => `Can't show as ${to}: ${e}`,
        openEmptyTab: to => `Open an empty ${to} editor`,
        stRegen: 'Regenerating…', stCompiling: 'Compiling…', stReading: 'Reading current project…',
        stLoadingPy: 'Loading Python (Skulpt)…', stError: e => `Error: ${e}`,
        deployPico: '🔌 Deploy to Pico',
        deployPicoTitle: 'Send this program to a real Raspberry Pi Pico over USB (MicroPython)',
        deployPicoDone: 'Deployed to the Pico — main.py is running (and survives reboot).',
        deployPicoSaved: 'This browser cannot talk to USB serial (Chrome or Edge can). Saved main.py instead — copy it to the Pico with Thonny, or `bw flash` from the sb3-creator CLI.',
        deployPicoFail: e => `Pico deploy failed: ${e}`,
        deployPicoNoPort: 'No Pico found on USB. Plug it in (a normal boot, not BOOTSEL) and try again.',
        picoSimNoFirmware: 'The Pico simulator firmware is not in this build. Run `npm run sync:picomicropython` and rebuild, then ▶ Run again.',
        picoSimStopped: 'Simulator stopped.',
        stop: 'Stop',
        codeInput: 'Program input', codeInputSend: 'Send',
        codeConsolePython: 'Python console · Skulpt', codeConsoleJs: 'JavaScript console',
        jsProgram: 'JavaScript generation', jsClassic: 'Classic source', jsConsole: 'Console program',
        jsGenerationHint: 'Choose the JavaScript generated from blocks or Pseudo. This setting preserves authored JavaScript.',
        jsConsoleHint: 'Console programs support input and waits. Keep editing and running this JavaScript; conversion back to blocks is unavailable.',
        codeStopped: 'Stopped.', codeNoOutput: '(no output)',
        codeTimeout: 'Stopped after 4 seconds of execution. Time spent waiting for input does not count.',
        codeOutputLimit: 'Stopped: the console output limit (65,536 characters) was reached.',
        codeLegacySimulator: 'Legacy simulator preview; worker Stop is not available for this route.',
        deployPicoBootsel: 'The Pico is in BOOTSEL mode — it needs MicroPython first. Flash a MicroPython UF2 onto the RPI-RP2 volume, then deploy again.',
        deployPicoNoC: 'Write or import C in the C tab first, then deploy.',
        deployPicoUf2Done: 'firmware.uf2 downloaded. Hold BOOTSEL, plug the Pico into USB (it mounts as the RPI-RP2 drive), and drag firmware.uf2 onto it — it flashes and reboots into your program.',
        deployPicoUf2Fail: e => `Pico UF2 build failed: ${e}`,
        flashBoard: '⚡ Flash to board',
        flashBoardTitle: 'Compile and write this program to a real board over USB serial',
        flashCompiling: 'compiling for the board…',
        flashing: 'flashing…',
        flashDone: n => `flashed ${n} bytes — the board is running it`,
        flashNoSerial: 'This browser cannot flash over USB (Chrome or Edge can). The compiled image was downloaded instead.',
        flashNoPort: 'No port chosen.',
        flashFail: e => `flashing failed: ${e}`,
        flashColdBoot: 'PULL THE POWER AND REAPPLY IT — a reset button will not do; the STC bootloader only answers after a cold power-on.',
        flashStm32Boot: 'Set BOOT0 HIGH and reset the board (the F030 breakout has a jumper), then pick the port — the ROM bootloader only listens then.',
        flashEepromHint: 'Pick the Ben Eater EEPROM programmer (running bweep.ino) — this burns the CHIP, not the 6502/Z80; move the chip to the board after.',
        flashIspHint: 'Pick the USBasp/USBISP programmer wired to the chip\'s 6-pin ICSP header (MOSI/MISO/SCK/RST/VCC/GND).',
        flashSwd: '⚡ Flash via SWD',
        flashSwdTitle: 'Flash over the debug port using a CMSIS-DAP probe (DAPLink, or a Pico running picoprobe) — no BOOT0, no reset',
        flashSwdHint: 'Pick the CMSIS-DAP probe wired to SWDIO/SWCLK/GND (a DAPLink board, or a Pico running picoprobe).',
        flashNoWebUsb: 'This browser cannot do WebUSB (Chrome or Edge can — they flash the USBasp directly, here, no extra software). The compiled .hex was downloaded so you can use any external programmer you already have.',
        flashNeedsProgrammer: d => `${d} has no serial bootloader — it needs an ISP/SPI programmer (or, for a 6502/Z80 breadboard, an EEPROM burner). Compiled image downloaded so you can use your own tool.`,
        stLoaded: 'Blocks loaded.',
        stWarn: w => `Loaded with warnings — ${w}`,
        foreverLoop: 'This project has a forever (game) loop, so it runs in the blocks — press the green flag to play it. For a text run, try an algorithmic example (quiz, operators, 2048, …).',
        cNote: 'C for the STC12 / 8051. Paste your own firmware and press ⇦ To blocks, or compile it to a .hex with stc-compiler.vercel.app. One 8051 gap to know: tone (set <buzzer> to N hz) has no STC12 driver yet — it compiles to a SILENT no-op on the 8051 (and on the Pico), with no error; only the Arduino/AVR build makes sound. On the 8086 the C compiles and runs locally (SmallerC + the in-browser assembler); drive the 8255’s pins with the port-I/O primitives bw_outb(port, value) and bw_inb(port) — cdecl, 16-bit args, caller cleans — the same ones the generated C uses. Keep scalar variables and parameters unsigned (word-wide), not unsigned char: reading a byte value makes SmallerC emit MOVZX, an 80386 instruction the 8086 assembler refuses.',
        basicNote: 'BBC BASIC runs in CrispBASIC, the restricted browser build of R.T. Russell’s BBCSDL interpreter. Choose BBC BASIC Z80 for the retro machine, or the 6502/8086 profiles for those targets. VDU rendering supports text and basic drawing; full graphics compatibility, graphics queries, files, sound and source debugging are unavailable in CrispBASIC. Connect Circuit enables digital GPIO and simulated time on the active supported circuit; analog I/O, PWM and physical-board execution are unavailable. Conversion to blocks still supports only the reader’s documented subset. Multi-WHEN programs cannot be shown (BASIC is single-threaded).',
        asmNote: 'Write assembly or view the compiled listing. Source mode: write per-device assembly and assemble+run — the 6502/Z80/8086 benches boot the image directly. TWO ASSEMBLERS, and which one runs is always in the status line: 8086 assembly is built IN THIS BROWSER (no network, MASM syntax), while 8051/6502/Z80/AVR go to the hosted toolchain. Listing mode: generated read-only evidence, linked locally for bundled 8051 targets and explicitly hosted for unsupported targets. To blocks: 8086 assembly that ▶ Run on 8086 produced reads back; anything else is refused by name, with a count.',
        asmLifted: n => `${n} assembly statement(s) read back into the dialect`,
        asmLiftRefused: (why, n) => `Not read back: ${why}${n ? ` (${n} statement(s) before it were)` : ''}`,
        stCOneWay: 'That language cannot be compiled back to blocks.',
        // BASIC / ASM mode bar
        profile: 'Profile:', lineNumbers: 'Line numbers', alwaysOn6502: '(always on for 6502)',
        asmModeLabel: 'Mode:', asmSource: 'Source (editable)', asmListing: 'Listing (from compiler)',
        asmBlinkRunning: (machine, route) => `Blink 0 is running on ${machine} · ${route}`,
        asmExampleLabel: 'Example:', asmExamplePick: 'choose…',
        asmExampleReplace: 'Replace what is in the assembly editor?',
        asmExampleLoaded: n => `Loaded "${n}". Press Assemble & Run to build it.`,
        assembleAndRun: '🔩 Assemble & Run',
        // WHICH ROUTE RAN is part of the answer, not a detail. One tab has
        // two assemblers (see lib/bw-asm/assemble-route.js) and a user who
        // cannot tell which one refused their program cannot act on the
        // refusal — a ca65 diagnostic and an 8086 AsmError read nothing
        // alike, and only one of the two needs the network.
        asmRouteLocal: 'in this browser', asmRouteHosted: 'by the hosted assembler',
        asmDialectLabel: 'Dialect:',
        asmDialectTitle: 'MASM or NASM syntax for the 8086 assembler. Auto reads the source and refuses when it sees both.',
        asmDialectNames: {auto: 'auto (detect)', masm: 'MASM', nasm: 'NASM'},
        asmDialectUsed: d => ` — ${d.toUpperCase()} syntax`,
        asmAssembling: r => `Assembling ${r}…`,
        asmBuiltBench: (n, r, m) => `Assembled ${n} bytes ${r} — booting the ${m} bench…`,
        asmBuiltOnly: (n, r, t) => `Assembled OK (${n} bytes, ${r}). Auto-run from ASM is wired for the 6502/Z80/8086 benches; for ${t} use the compile path.`,
        asmBuiltArm: (n, r, t) => `Assembled ${n} bytes of Intel HEX ${r} — running it on the ${t} simulator.`,
        runCZ80: '▶ Run C on Z80',
        runCZ80Title: 'Compile this C for the Z80 bench (sdcc -mz80 on the hosted service) and boot it: ROM at $0000, RAM at $8000, the OUT latch and IN buffer on port 0.',
        runCZ80Building: 'Compiling C for the Z80 (hosted sdcc -mz80)…',
        runCZ80Built: (n) => `Built a ${n}-byte Z80 ROM — booting the Z80 bench…`,
        runCZ80Refused: (m) => `The Z80 C compiler refused this program: ${m}`,
        runCZ80Unavailable: (m) => `The Z80 C compiler is unavailable (it runs on the hosted service): ${m}`,
        asmSourceError: (r, m) => `Assembly errors (${r}): ${m}`,
        asmTransportError: (r, m) => `Assembler unreachable (${r}): ${m}`,
        asmWarnings: w => ` — ${w.length} warning(s): ${w.join('; ')}`,
        // The licence is the condition these examples ship under, so it is
        // rendered next to the picker and not buried in a notices file.
        asmCredit: a => `${a.author} · ${a.licence}`,
        asmCreditTitle: a => `Example programs by ${a.author}, ${a.licence}-licensed. Source: ${a.repo}`,
        basicInfoTitle: 'BASIC info', asmInfoTitle: 'ASM info',
        // micro:bit bar
        micropythonReadonly: 'Read-only — generated from your blocks for the micro:bit.',
        micropythonImported: 'Imported from a .hex — the simulator runs this as it is.',
        runOnSimulator: '▶ Run',
        toolbarLabel: 'Code editor toolbar (scrolls sideways)',
        openSpikeArena: '🪐 SPIKE arena',
        openSpikeArenaTitle: 'Explore a free virtual SPIKE sandbox or run a program in the arena challenges',
        spikeFirmwareRunTitle: 'Run the supported code subset in our simulation-only ARM firmware',
        runOnSpike3: '▶ Run on SPIKE 3 (Python)',
        runOnSpike3Title: 'Read this LEGO SPIKE App 3 Python program into SPIKE blocks and run them on the virtual SPIKE hub (and in the arena, when it is open)',
        spike3Console: 'SPIKE 3 Python console',
        spike3Stop: '■ Stop',
        spike3Running: 'Running on the virtual SPIKE hub…',
        spike3Stopped: 'Stopped.',
        spike3NoHub: 'The virtual SPIKE hub is not available in this build.',
        spike3NoConnect: 'Could not connect the SPIKE extension to the virtual hub.',
        spike3Unsupported: n => `${n} call(s) have no SPIKE block and were left out; each is marked "# unsupported" in the blocks' source.`,
        spike3Note: 'Note',
        spike3Error: 'Error',
        spike3Out: 'print',
        spike3Clear: 'Clear',
        runSpikeUsb: '▶ Run on SPIKE USB',
        probeSpikeUsb: 'Read USB ports',
        probeSpikeUsbTitle: 'Connect a physical LEGO USB hub and read which motors and sensors are attached to ports A–F. This does not inspect the virtual hub.',
        spikeUsbDirect: 'USB on this computer', spikeUsbBridge: 'USB via Mac on WLAN',
        spikeUsbRouteLabel: 'SPIKE USB route', dismissNotice: 'Dismiss notice',
        spikeUsbUrl: 'Mac bridge URL', spikeUsbToken: 'Bridge token',
        spikeUsbRunning: 'Streaming to the USB hub…',
        spikeUsbProbing: 'Reading USB hub ports…',
        spikeUsbDone: (firmware, ports) => `USB run complete (${firmware}). Ports: ${ports}`,
        spikeUsbFail: message => `SPIKE USB: ${message}`,
        debugOnSimulator: '🐞 Debug',
        debugLevelBlock: 'Block',
        debugLevelLine: 'Line',
        debugBlockHint: 'Block-level: steps block-by-block on the standard firmware — no extra download.',
        debugLineHint: 'Line-level: steps by source line with real variables & call stack (loads the settrace debug firmware, +6KB).',
        // device selector / maximize
        devicePlaceholder: 'Device…', deviceTitle: 'Target device — sets pin names, compile target and emulator',
        maximizeTitle: 'Maximize editor', restoreTitle: 'Restore panels',
        asmWriteFirst: 'Write assembly source first.',
        // Pseudocode → 8086, the offline path. The status line says where the
        // program was built as well as that it was, because "built" and
        // "built here, without the network" are different sentences and this
        // button's whole claim is the second one.
        run8086: '▶ Run on 8086',
        run8086Title: 'Turn these blocks into 8086 assembly in this browser and run it on the DOS bench — no network, no toolchain.',
        export8086Com: '⬇ .COM',
        export8086ComTitle: 'Download the assembled .COM — the exact assembler bytes (org 100h), to run under DOS or another 8086 emulator.',
        export8086Img: '⬇ .img',
        export8086ImgTitle: 'Download a bootable 1.44 MB floppy image that boots this program on real PC/XT hardware or another emulator.',
        export8086ComDone: n => `Saved the .COM (${n} bytes).`,
        export8086ImgDone: n => `Saved the bootable floppy image (${n} bytes).`,
        run8086Building: 'Lowering the blocks to 8086 assembly…',
        run8086Built: (n, b) => `Built ${n} bytes from ${b} block(s) in this browser — booting the 8086 DOS bench…`,
        run8086Refused: m => `The 8086 back end refused this program: ${m}`,
        run8086Failed: m => `Could not build for the 8086: ${m}`,
        run8086Empty: 'Write some pseudocode first.',
        runC8086: '▶ Run C on 8086',
        runC8086Title: 'Compile this C with SmallerC in this browser, assemble it here too, and run it on the DOS bench — no network, no toolchain.',
        runC8086Building: 'Compiling C for the 8086 in this browser…',
        runC8086Built: (n, r) => `Built ${n} bytes ${r} — booting the 8086 DOS bench…`,
        runC8086Refused: (r, m) => `The C compiler ${r} refused this program: ${m}`,
        runC8086Failed: (r, m) => `The 8086 C route (${r}) could not run: ${m}`,
        runC8086Empty: 'Write some C first.',
        runC8086Route: 'in this browser',
        runCRiscv: '▶ Run C on RISC-V',
        runCRiscvTitle: 'Compile this C and run it on the RV32IMA console. Pick the route: in the browser (a C subset, no server) or on the hosted service (full C).',
        runCRiscvRouteTitle: 'Where the C compiles: in the browser (shecc → wasm, a C subset, nothing leaves the page) or on the hosted service (a native gcc + picolibc — full C: floats, malloc, the standard library).',
        runCRiscvRouteBrowser: 'Browser · shecc (subset)',
        runCRiscvRouteServer: 'Server · gcc (full C)',
        runCRiscvBuilding: 'Compiling C for RISC-V…',
        runCRiscvBuilt: (n, segs, entry, compiler) =>
            `Built a ${n}-byte RISC-V image (${segs} segment${segs === 1 ? '' : 's'}, `
            + `entry 0x${entry.toString(16)}) with ${compiler} — booting the RV32IMA console…`,
        runCRiscvRefused: (m) => `The RISC-V C compiler refused this program: ${m}`,
        runCRiscvUnavailable: (m) => `The RISC-V C compiler is unavailable: ${m}`,
        runCRiscvEmpty: 'Write some C first.',
        runCRiscvTryServer: '▶ Try the full compiler (server)',
        runCRiscvTryServerTitle: 'The in-browser shecc compiles a subset of C. This program uses something it does not support — compile it on the hosted service (full gcc + picolibc) instead.',
        runSketch: '▶ Run sketch',
        runSketchTitle: 'Compile this C tab as an Arduino sketch — real C++: Serial, String, classes, the core\'s Wire/SPI/EEPROM/SoftwareSerial — on the hosted compiler, then run it on this board\'s simulator. Serial output appears in the debugger\'s serial console.',
        runSketchBuilding: 'Compiling the sketch with the Arduino core (hosted avr-gcc)…',
        runSketchBuilt: (n, libs, protos) =>
            `Built a ${n}-byte sketch with the Arduino core`
            + (libs.length ? ` and ${libs.join(', ')}` : '')
            + (protos ? ` (${protos} prototype${protos === 1 ? '' : 's'} generated, listed below)` : '')
            + ' — running it on the simulator.',
        runSketchRefused: (m) => `The Arduino compiler refused this sketch: ${m}`,
        runSketchUnavailable: (m) => `The Arduino compiler is unavailable (it runs on the hosted service): ${m}`,
        runSketchEmpty: 'Write a sketch first — setup() and loop().',
        runSketchBuiltArduboy: (n, libs) => `Built a ${n}-byte Arduboy sketch`
            + (libs.length ? ` with ${libs.join(', ')}` : '')
            + ' — running it on the Arduboy console. Arrow keys move, Z is A, X is B.',
        runSketchClockMismatch: (built, board) =>
            ` Note: the image was built for ${built} Hz but this board runs at ${board} Hz, so its timing will be off.`,
        // reference section headers
        h: {
            Structure: 'Structure', EventsHats: 'Events (hats)', Control: 'Control',
            ClonesBroadcasts: 'Clones & broadcasts', MotionLooks: 'Motion & Looks',
            DataLists: 'Data & lists', Expressions: 'Expressions', Conditions: 'Conditions',
            CustomBlocks: 'Custom blocks', PlaneteMaths: 'Planète Maths (extension)',
            ArraysVectors: 'Arrays & Vectors (extension)', SensingMore: 'Sensing & more',
            Statements: 'Statements', Declare: 'Declare (pseudocode tab)', Pins: 'Pins',
            Notes: 'Notes', Profiles: 'Profiles', LineNumbers: 'Line numbers', IO: 'I/O',
            Overview: 'Overview', Verbs: 'Verbs',
            Registers: 'Registers', Workflow: 'Workflow', Addressing: 'Addressing',
            I8086: '8086 (MASM, assembled here)'
        }
    },
    de: {
        closeNotice: 'Schließen',
        cpmRunHint: 'Führe das CP/M-Programm aus. Änderungen werden mit dem SDCC-Dienst kompiliert.',
        actionFiles: 'Dateien', actionPrograms: 'Programm und Export', actionExamples: 'Beispiele',
        fileMenuTitle: 'Öffnen, speichern, importieren, Beispiele und Referenz',
        makeCircuit: '⚙ Daraus eine Schaltung bauen',
        makeCircuitTitle: e => `„${e}" im FPGA-Tab als Logikgatter bauen — ein boolescher Ausdruck über 1-Bit-Pins, der kein Programm zum Laufen braucht`,
        makeCircuitWhy: 'Diese Zeile ist ein boolescher Ausdruck über 1-Bit-Eingangspins, und das ist eine Schaltung: keine Zeit, keine Variablen, nichts auszuführen.',
        loadExample: '📚 Beispiel laden…', loadExampleTitle: 'Ein eingebautes Beispiel laden',
        examplesLoading: 'Eingebaute Beispiele werden geladen…',
        examplesRetry: 'Eingebaute Beispiele nicht verfügbar — erneut versuchen',
        openFile: 'Öffnen', openFileTitle: t => `Eine Quelldatei öffnen (${t})`,
        saveFile: 'Speichern', saveFileTitle: n => `Diesen Tab als ${n} speichern`,
        exportMakeCode: '📦 MakeCode-Quellcode',
        exportMakeCodeTitle: 'Die unveränderten, wiederhergestellten MakeCode-Projektdateien für den offiziellen Editor oder die PXT-CLI laden',
        openBad: e => `Unbekannter Dateityp (${e}).`,
        openDone: (f, t) => `${f} in den ${t}-Tab geladen`,
        mcReading: f => `${f} wird gelesen…`,
        downloadHex: 'Firmware exportieren (.hex)…',
        microbitNeedFirmware: 'Einmal eine MicroPython-.hex wählen (von python.microbit.org oder die vom Board) — sie bleibt für diese Sitzung gespeichert.',
        microbitFirmwareBad: f => `${f} ist keine Intel-HEX-Datei.`,
        microbitHexReady: f => `${f} gespeichert. Auf das MICROBIT-Laufwerk kopieren.`,
        microbitFlash: '⚡ micro:bit flashen',
        microbitFlashTitle: 'Das Board direkt über WebUSB programmieren (nur micro:bit V2) — kein Ziehen und Ablegen.',
        microbitFlashPrep: 'Die .hex zum Flashen wird erstellt…',
        microbitFlashPick: 'micro:bit in der Browser-Abfrage auswählen…',
        microbitFlashing: 'micro:bit wird geflasht — eingesteckt lassen…',
        microbitFlashDone: n => `${n} Bytes geflasht. Der micro:bit wurde zurückgesetzt und führt dein Programm aus.`,
        arduboyRunning: f => `${f} läuft auf der Arduboy-Konsole. Pfeiltasten bewegen, Z ist A, X ist B.`,
        mcPython: (f, n) => `${f} enthielt ein MicroPython-Programm (${n}) — geladen, der Simulator kann es ausführen.`,
        mcMicrobit: (f, n) => `„${n}" aus ${f} importiert — MakeCode micro:bit, in Blöcke übersetzt.`,
        mcEv3: (f, n) => `„${n}" aus ${f} importiert — MakeCode LEGO EV3, in EV3-Blöcke übersetzt.`,
        mcCpx: (f, n) => `„${n}" aus ${f} importiert — MakeCode Circuit Playground Express, in CPX-Blöcke übersetzt.`,
        mcPartial: (f, n, k) => `„${n}" aus ${f} importiert. Für ${k} Element(e) aus MakeCode gibt es hier keine Entsprechung; jede ist im Code mit „# unsupported" markiert.`,
        mcArcade: (f, n, s, c, button) => `Arcade-Spiel „${n}" aus ${f} importiert: ${s} Sprite(s), ${c} Kostüm(e). Mit „${button}" bauen.`,
        mcNoSource: (f, k) => `${f} ist eine ${k}-Datei ohne eingebetteten Projekt-Quelltext — nichts zu importieren.`,
        mcFailed: (f, e) => `${f} konnte nicht gelesen werden: ${e}`,
        mcShare: '🔗 MakeCode…',
        mcShareTitle: 'Ein Projekt über einen MakeCode-Freigabelink importieren (arcade.makecode.com oder makecode.microbit.org)',
        mcSharePrompt: 'MakeCode-Freigabelink einfügen:',
        mcShareLoading: 'Geteiltes Projekt wird geladen…',
        mcExport: '⬆ Zu MakeCode',
        mcExportTitle: 'Dieses Projekt als natives MakeCode-Projekt (.mkcd) speichern',
        mcExportDone: (f, u, editor) => (u ?
            `${f} gespeichert — auf ${editor} ablegen, um es dort zu öffnen. Für ${u} Block/Blöcke gibt es in MakeCode keine Entsprechung.` :
            `${f} gespeichert — auf ${editor} ablegen, um es dort zu öffnen.`),
        mcExportEmpty: 'Nichts zu exportieren — zuerst Blöcke schreiben.',
        mcRun: '▶ Im MakeCode-Simulator ausführen',
        mcRunTitle: 'Dieses MakeCode-Projekt mit dem MakeCode-eigenen Compiler übersetzen und im MakeCode-Simulator ausführen — es wird nichts umgewandelt, also geht nichts verloren',
        mcRunCompiling: n => `${n} wird mit MakeCode übersetzt…`,
        toolbarLanguages: 'Sprachen', moreLanguages: 'Weitere Sprachen',
        cardiacLanguage: 'CARDIAC-Dezimalrechner',
        cp1Language: 'Kosmos-CP1-Lernsprache…',
        cp1Open: 'Kosmos-CP1-Einstieg öffnen? Die aktuelle Schaltung und der CP1-Quelltext werden ersetzt.',
        mcRunStarted: (n, t) => `${n} läuft im MakeCode-Simulator (${({arcade: 'Arcade', calliopemini: 'Calliope mini', ev3: 'EV3', adafruit: 'Circuit Playground'})[t] || 'micro:bit'}).`,
        mcFetched: list => ` Für diesen Build von GitHub geladene Erweiterungen: ${list}.`,
        mcLicenceUnknown: 'Lizenz nicht erkannt',
        mcEmulate: '▶ Auf dem emulierten micro:bit V2 ausführen',
        mcEmulateTitle: 'Dieses micro:bit-Projekt mit dem MakeCode-eigenen Compiler auf die Bluetooth-freien Firmware-Basen übersetzen und das echte Image auf LabWireds micro:bit V2 (nRF52833) im Debug-Bereich ausführen — die offizielle Basis enthält Nordics SoftDevice, die der Emulator nie ausführt',
        mcEmulateBuilding: n => `${n} wird für den emulierten micro:bit V2 gebaut…`,
        mcEmulateStarted: n => `${n} läuft auf dem emulierten micro:bit V2. Die LED-Matrix ist in Widgets, die serielle Ausgabe im Debug-Bereich.`,
        mcEmulateNoBases: 'Dieser Build stellt die micro:bit-V2-Emulator-Basen nicht bereit (npm run sync:makecode lädt sie), oder das Projekt braucht einen Paketsatz, den sie nicht abdecken; der Emulator weicht nie auf die offizielle Basis aus.',
        mcEmulateRefused: m => `Der Emulator hat diese Firmware-Basis abgelehnt: ${m}`,
        mcFirmware: '⤓ Firmware für das Board',
        mcFirmwareTitle: 'Die echte Firmware für das Board dieses Projekts bauen (micro:bit oder Calliope .hex, EV3, Circuit Playground oder das gewählte Arcade-Board .uf2), mit dem Projekt darin, damit MakeCode es wieder öffnen kann',
        mcFirmwareBuilding: n => `Firmware für ${n} wird gebaut…`,
        mcFirmwareDone: f => `${f} gespeichert — auf das USB-Laufwerk des Boards kopieren (MICROBIT, MINI, CPLAYBOOT, EV3), um es zu flashen. MakeCode öffnet die Datei auch als Projekt.`,
        mcNoRuntime: 'Die MakeCode-Laufzeitdateien sind in diesem Build nicht verfügbar.',
        mcNoBase: u => `Dieses Projekt nutzt eine C++-Erweiterung außerhalb des MakeCode-Standardsatzes; seine Firmware braucht den Cloud-Compiler von MakeCode. Im Simulator läuft es trotzdem; zum Flashen auf ${u} öffnen.`,
        mcBoardPick: 'Arcade-Board…',
        mcBoardTitle: 'Das Board, für das die Firmware dieses Arcade-Spiels gebaut wird — die Board-Liste von MakeCode Arcade selbst',
        mcBoardByChip: 'Andere Boards, nach Chip',
        mcBoardNone: 'Zuerst das Arcade-Board wählen: MakeCode Arcade baut Firmware immer für ein bestimmtes Board, und für „kein Board“ gibt es keine Firmware.',
        mcBoardFirmwareDone: (f, b) => `${f} für ${b} gespeichert — das Board in seinen Bootloader bringen (meist: zweimal Reset drücken) und die Datei auf das erscheinende USB-Laufwerk kopieren. MakeCode öffnet die Datei auch als Projekt.`,
        mcUnsupportedTarget: t => `MakeCode-${t}-Projekte kann dieser Build nicht übersetzen (micro:bit und Arcade schon).`,
        mcCompileErrors: (n, first) => `MakeCode meldet ${n} Fehler: ${first}`,
        mcNothingToRun: 'Nichts auszuführen — ein MakeCode-Projekt importieren oder Blöcke für einen micro:bit schreiben.',
        mcBoardsCompiling: n => `${n} Boards werden mit MakeCode kompiliert…`,
        mcBoardsFirmwareBuilding: n => `Firmware für ${n} Boards wird gebaut…`,
        mcBoardsFirmwareDone: files => `${files.join(' und ')} gespeichert: eine Datei je Board. Jede auf das USB-Laufwerk ihres eigenen Boards kopieren (MICROBIT, MINI), um es zu flashen.`,
        mcBoardsExportDone: files => `${files.join(' und ')} gespeichert: ein MakeCode-Projekt je Board.`,
        mcBoardsStarted: names => `${names.join(' + ')} laufen nebeneinander in den MakeCode-Simulatoren und teilen sich einen Funkkanal.`,
        mcBoardNotMakeCode: (board, device) => `Board „${board}“ ist ein ${device || 'Board ohne Gerät'}: nur micro:bit und Calliope mini laufen gemeinsam in den MakeCode-Simulatoren.`,
        mcBoardCompileErrors: (board, n, first) => `Board „${board}“: MakeCode meldet ${n} Fehler. ${first}`,
        arcRun: '▶ Als MakeCode Arcade ausführen',
        arcRunTitle: 'Dieses Scratch-Projekt in ein MakeCode-Arcade-Spiel umwandeln (Figuren aus ihren Kostümen, Skripte als Code) und im MakeCode-Arcade-Simulator ausführen',
        arcExport: '⬆ Zu MakeCode Arcade',
        arcExportTitle: 'Dieses Projekt als MakeCode-Arcade-Spiel speichern, das arcade.makecode.com öffnet',
        gameWeb: '⬆ Spielbares Web-Spiel (.zip)',
        gameWebTitle: 'Dieses Projekt als bearbeitbares JavaScript-Spiel exportieren: play.html in jedem Browser öffnen',
        gamePy: '⬆ Python-+-pygame-Spiel (.zip)',
        gamePyTitle: 'Dieses Projekt als bearbeitbares Python-Spiel exportieren: pip install pygame, dann python main.py',
        gameDone: (f, a) => `${f} gespeichert.${a ? ` ${a} Blockart(en) laufen nur näherungsweise — siehe README.md im Zip.` : ''}`,
        gameRefused: r => `Nicht exportiert: Für diese Blöcke gibt es noch keine Spiel-Laufzeit — ${r}`,
        arcDone: (f, u) => `${f} gespeichert — auf arcade.makecode.com ablegen.${u ? ` Für ${u} Blockart(en) gibt es in Arcade keine Entsprechung (als Kommentar markiert).` : ''}`,
        arcStarted: u => `Läuft als MakeCode-Arcade-Spiel.${u ? ` Für ${u} Blockart(en) gibt es in Arcade keine Entsprechung.` : ''}`,
        saveEmpty: 'Nichts zu speichern — dieser Tab ist leer.',
        restored: t => `Nicht gespeicherter ${t} wiederhergestellt.`,
        loadCatalogTitle: 'Ein Katalog-Beispiel für dieses Gerät laden',
        noChips: 'Scratch-Bühne',
        searchExamples: 'Beispiele suchen…',
        catalogLoading: 'Beispiel-Katalog wird geladen…',
        catalogEmpty: 'Keine Katalog-Beispiele für dieses Gerät.',
        catalogNoMatch: 'Keine Beispiele passen zur Suche.',
        catalogUnavailable: e => `Beispiel-Katalog nicht verfügbar (${e})`,
        infoTitle: 'Für Infos klicken', infoAria: 'Über den Code-Tab',
        matrixTitle: 'Was läuft wo: jede Sprache auf jedem Chip, nativ oder übersetzt, Simulator oder Hardware',
        matrixAria: 'Sprach- und Geräte-Matrix anzeigen', matrixInfoAria: 'Reichweite dieser Sprache auf diesem Board',
        matrixHeading: 'Was läuft wo',
        matrixLegend: 'nativ = die Sprache selbst läuft auf dem Chip · übersetzt = in den Dialekt gelesen und als etwas ausgegeben, das der Chip nativ ausführt · Sim / Hardware = wohin das Ergebnis kann · offen = eine benannte Aufgabe, noch nicht',
        matrixCurrent: 'aktuelle Wahl',
        reference: 'Referenz', referenceTitle: l => `Referenz für ${l}`,
        customArt: 'Eigene Sprite-Grafik', customArtTitle: 'SVGs hochladen und als Sprite-Kostüme einbacken',
        toBlocks: '⇦ Zu Blöcken', toBlocksTitle: l => `Diesen ${l}-Code zu Blöcken kompilieren`,
        fromBlocks: 'Von Blöcken ⇨', fromBlocksTitle: 'Das aktuelle Projekt in alle Sprachen einlesen',
        compactToBlocks: '⇦ Blöcke', compactFromBlocks: 'Blöcke ⇨',
        run: 'Ausführen', runBasic: '▶ BASIC ausführen', runFe: '▶ fe ausführen', runTcl: '▶ Tcl ausführen', runForth: '▶ Forth ausführen', animationLabel: 'Animation', runViaBlocks: d => `▶ ${d} über Blöcke`,
        runFeRiscv: '▶ fe auf RISC-V', runTclRiscv: '▶ Tcl auf RISC-V',
        runTclRiscvTitle: 'Jim Tcl mit diesem Programm als C bauen und auf dem RISC-V-Board ausführen', runForthRiscv: '▶ Forth auf RISC-V',
        runForthRiscvTitle: 'zForth mit diesem Programm als C bauen und auf dem RISC-V-Board ausführen', runFeRiscvTitle: 'Den fe-Interpreter mit diesem Programm als C bauen und auf dem RISC-V-Board ausführen',
        runViaBlocksTitle: 'In Blöcke umwandeln und sie im Debugger als C für das gewählte Board bauen',
        nqcCompile: '⚙ .rcx kompilieren', nqcSend: '🧱 An RCX senden',
        nqcEmpty: 'Zuerst NQC eingeben.',
        nqcNoCompiler: 'Dieser Build hat keinen lokalen NQC-Compiler.',
        nqcNoTower: 'Hier gibt es keine Turm-Unterstützung — die .rcx wurde stattdessen ' +
            'gespeichert. Mit NQC, Bricx Command Center oder firmdl3 senden.',
        nqcSent: 'An den Baustein gesendet.',
        nqcNote: 'NQC (Not Quite C) für den LEGO RCX, im Browser kompiliert — ohne Netz. ' +
            'Zwei Einheiten werden leicht unbemerkt falsch: Motorleistung ist 0-7, KEIN ' +
            'Prozentwert (OUT_LOW ist 1, OUT_HALF 3, OUT_FULL 7), und Wait() und PlayTone() ' +
            'nehmen HUNDERTSTELSEKUNDEN, Wait(100) ist also eine Sekunde. Der Baustein braucht ' +
            'bereits geladene LEGO-Firmware; sie darf nicht weitergegeben werden, diese App ' +
            'kann sie also nicht liefern. Ein Baustein ohne Firmware antwortet genau wie ein ' +
            'ausgeschalteter.',
        basicBudget: ms => `Nach ${(ms / 1000).toFixed(0)}s simulierter Zeit angehalten (Endlosschleife?).`,
        basicInputExhausted: 'Programm hat INPUT erwartet, aber es waren keine weiteren Antworten vorhanden.',
        basicNoPrompt: 'BASIC hat seine Bereit-Eingabeaufforderung nicht erreicht — das ROM wurde möglicherweise nicht geladen.',
        basicLoading: 'BASIC-Maschine wird geladen…',
        basicEngine: 'Engine', basicCrispEngine: 'CrispBASIC (Browser)', basicZ80Engine: 'BBC BASIC Z80 (Retro)',
        basicZ80Numbering: line => `BBC BASIC Z80 benötigt für jede Anweisung eindeutige, aufsteigende, ganzzahlige Zeilennummern ohne Vorzeichen (Editorzeile ${line}). Zeilennummern aktivieren und BASIC neu erzeugen oder CrispBASIC wählen.`,
        basicCrispLoading: 'CrispBASIC wird geladen…', basicCrispRunning: 'CrispBASIC läuft.',
        basicCrispStopped: 'CrispBASIC gestoppt.', basicCrispStopping: 'CrispBASIC wird gestoppt…',
        basicCrispReset: 'Zurücksetzen', basicCrispResetDone: 'CrispBASIC zurückgesetzt.',
        basicCrispCompleted: code => code ? `Beendet (Exit ${code}).` : 'Beendet.',
        basicCrispTimeout: 'CrispBASIC hat die Laufzeitgrenze von 60 Sekunden erreicht.',
        basicCrispOutputLimit: 'CrispBASIC hat die Ausgabegrenze erreicht.',
        basicCrispSimulationLimit: 'CrispBASIC hat eine Grenze der Schaltungssimulation erreicht.',
        basicConnectCircuit: 'Schaltung verbinden',
        basicPortableLibrary: 'Portable Schaltungsaufrufe erzeugen',
        basicPortableHint: 'Diese Auswahl mit „Aus Blöcken“ anwenden. Portable Aufrufe benötigen „Schaltung verbinden“; „Zu Blöcken“ lehnt sie derzeit ab. Umschalten und nicht unterstützte Hardwareoperationen werden als Erzeugungsfehler gemeldet.',
        basicCrispError: 'CrispBASIC konnte dieses Programm nicht beenden.',
        basicInputLine: 'Programmeingabe', basicInputKey: 'Ein Zeichen (leer für Eingabetaste)',
        basicInputSend: 'Senden', basicInputEnd: 'Eingabe beenden',
        basicInputKeyError: 'Ein Latin-1-Zeichen eingeben oder das Feld für die Eingabetaste leer lassen.',
        basicCrispScope: 'Text, Eingabe und einfache VDU-Zeichnungen. Schaltung verbinden aktiviert digitale Pins und simulierte Zeit in der aktuellen Schaltung. Physische Hardware, Dateien, Grafikabfragen, Ton und Quelltext-Debugging sind nicht verfügbar. Läufe enden nach 60 Sekunden.',
        basic8086Building: 'Übersetze BASIC für den 8086 in diesem Browser…',
        basicRealDosBuilding: 'Übersetze BASIC und bereite eine echte MS-DOS-2.0-Bootdiskette vor…',
        basicRealDosFailed: (m) => `Die MS-DOS-Bootdiskette konnte nicht vorbereitet werden: ${m}`,
        basicRealDosBooted: (n) => `${n} Bytes erzeugt — starte echtes MS-DOS 2.0; es führt PROG.COM am A>-Prompt aus.`,
        basicEmpty: 'Gib ein BASIC-Programm zum Ausführen ein.',
        basicUbasicRunning: 'Führe dein BASIC mit dem freien uBASIC-Interpreter auf der DOS-Werkbank aus…',
        basicUbasicFailed: (m) => `Die uBASIC-(auf-DOS)-Route lief nicht: ${m}`,
        feRunning: 'Führe dein fe (Lisp) mit dem freien fe-Interpreter auf der DOS-Werkbank aus…',
        feFailed: (m) => `Die fe-(Lisp-auf-DOS)-Route lief nicht: ${m}`,
        forthRunning: 'Führe dein Forth mit dem freien zForth-Interpreter auf der DOS-Werkbank aus…',
        forthFailed: (m) => `Die Forth-(zForth-auf-DOS)-Route lief nicht: ${m}`,
        tclRunning: 'Führe dein Tcl mit dem freien Jim-Tcl-Interpreter auf der DOS-Werkbank aus…',
        tclFailed: (m) => `Die Tcl-(Jim-Tcl-auf-DOS)-Route lief nicht: ${m}`,
        basic8086Refused: (m) => `Der BASIC-Compiler hat dieses Programm abgelehnt: ${m}`,
        basic8086Failed: (m) => `Die 8086-BASIC-Route lief nicht: ${m}`,
        apply: '✓ Grafik übernehmen & zu Blöcken', done: 'Fertig',
        applyTitle: n => `Weise erst ${n} weiteren Datei(en) ein Sprite zu`,
        applyReady: 'Diese Kostüme einbacken und den Code zu Blöcken umwandeln',
        doneTitle: 'Kostüme behalten; sie werden beim nächsten „⇦ Zu Blöcken” angewendet',
        needSprite: n => `${n} Datei(en) brauchen noch ein Sprite.`,
        svgFile: 'SVG-Datei', sprite: 'Sprite', mode: 'Modus', chooseSprite: '— Sprite wählen —',
        notInCode: 'nicht im Code', replaceCostume: 'Kostüm ersetzen', addFrame: 'als Bild hinzufügen',
        driverShim: 'Treiber: Shim', driverRemote: 'Treiber: Remote (Bridge)', driverOnbrick: 'Treiber: auf dem Stein',
        driverSim: 'Treiber: simuliertes Board',
        driverTitle: 'Hardware-Extension-Treiber: Shim (neutral) · Remote (Bridge über WebSocket) · auf dem Stein (Geräte-Transpiler). Das Programm ist treiberunabhängig; dies wechselt nur den Treiber.',
        asyncLabel: 'async', asyncTitle: 'Hardware-Aufrufe awaiten (BLE ist async) und Funktionen async machen',
        eventsLabel: 'events', eventsTitle: 'Extension-Event-Hats (wenn Knopf gedrückt …) in Treiber-Callbacks umwandeln',
        stConverting: to => `Wird zu ${to} umgewandelt…`, stCantShow: (to, e) => `Kann nicht als ${to} angezeigt werden: ${e}`,
        openEmptyTab: to => `Leeren ${to}-Editor öffnen`,
        stRegen: 'Wird neu erzeugt…', stCompiling: 'Wird kompiliert…', stReading: 'Aktuelles Projekt wird gelesen…',
        stLoadingPy: 'Python wird geladen (Skulpt)…', stError: e => `Fehler: ${e}`,
        deployPico: '🔌 Auf Pico übertragen',
        deployPicoTitle: 'Dieses Programm per USB auf einen echten Raspberry Pi Pico übertragen (MicroPython)',
        deployPicoDone: 'Auf den Pico übertragen — main.py läuft (auch nach Neustart).',
        deployPicoSaved: 'Dieser Browser kann kein USB-Serial (Chrome oder Edge können es). main.py wurde stattdessen gespeichert — mit Thonny auf den Pico kopieren, oder `bw flash` aus der sb3-creator-CLI.',
        deployPicoFail: e => `Pico-Übertragung fehlgeschlagen: ${e}`,
        deployPicoNoPort: 'Kein Pico am USB gefunden. Anstecken (normaler Start, nicht BOOTSEL) und erneut versuchen.',
        picoSimNoFirmware: 'Die Pico-Simulator-Firmware fehlt in diesem Build. `npm run sync:picomicropython` ausführen und neu bauen, dann erneut ▶ ausführen.',
        picoSimStopped: 'Simulator gestoppt.',
        stop: 'Stopp',
        codeInput: 'Programmeingabe', codeInputSend: 'Senden',
        codeConsolePython: 'Python-Konsole · Skulpt', codeConsoleJs: 'JavaScript-Konsole',
        jsProgram: 'JavaScript-Erzeugung', jsClassic: 'Klassischer Quelltext', jsConsole: 'Konsolenprogramm',
        jsGenerationHint: 'Wählt die JavaScript-Erzeugung aus Blöcken oder Pseudo. Selbst bearbeitetes JavaScript bleibt erhalten.',
        jsConsoleHint: 'Konsolenprogramme unterstützen Eingaben und Wartezeiten. JavaScript kann bearbeitet und ausgeführt, aber nicht zurück in Blöcke umgewandelt werden.',
        codeStopped: 'Gestoppt.', codeNoOutput: '(keine Ausgabe)',
        codeTimeout: 'Nach 4 Sekunden Ausführung gestoppt. Wartezeit auf Eingaben zählt nicht mit.',
        codeOutputLimit: 'Gestoppt: Das Ausgabelimit der Konsole (65.536 Zeichen) wurde erreicht.',
        codeLegacySimulator: 'Bisherige Simulator-Vorschau; Worker-Stopp ist für diesen Weg nicht verfügbar.',
        deployPicoBootsel: 'Der Pico ist im BOOTSEL-Modus — er braucht zuerst MicroPython. Ein MicroPython-UF2 auf das RPI-RP2-Laufwerk kopieren, dann erneut übertragen.',
        deployPicoNoC: 'Zuerst C im C-Tab schreiben oder importieren, dann übertragen.',
        deployPicoUf2Done: 'firmware.uf2 heruntergeladen. BOOTSEL gedrückt halten, den Pico per USB anstecken (er erscheint als Laufwerk RPI-RP2) und firmware.uf2 darauf ziehen — er flasht und startet in dein Programm.',
        deployPicoUf2Fail: e => `Pico-UF2-Erstellung fehlgeschlagen: ${e}`,
        flashBoard: '⚡ Auf Platine flashen',
        flashBoardTitle: 'Dieses Programm kompilieren und per USB auf eine echte Platine schreiben',
        flashCompiling: 'wird für die Platine kompiliert…',
        flashing: 'wird geflasht…',
        flashDone: n => `${n} Bytes geflasht — die Platine führt es aus`,
        flashNoSerial: 'Dieser Browser kann nicht per USB flashen (Chrome oder Edge können es). Das kompilierte Abbild wurde stattdessen heruntergeladen.',
        flashNoPort: 'Kein Port gewählt.',
        flashFail: e => `Flashen fehlgeschlagen: ${e}`,
        flashColdBoot: 'STROM ZIEHEN UND WIEDER ANLEGEN — eine Reset-Taste genügt nicht; der STC-Bootloader antwortet nur nach einem Kaltstart.',
        flashStm32Boot: 'BOOT0 auf HIGH setzen und die Platine zurücksetzen (das F030-Board hat einen Jumper), dann den Port wählen — nur dann lauscht der ROM-Bootloader.',
        flashEepromHint: 'Den Ben-Eater-EEPROM-Programmer (mit bweep.ino) wählen — das brennt den CHIP, nicht den 6502/Z80; den Chip danach auf die Platine setzen.',
        flashIspHint: 'Den USBasp/USBISP-Programmer wählen, der am 6-poligen ICSP-Header des Chips hängt (MOSI/MISO/SCK/RST/VCC/GND).',
        flashSwd: '⚡ Über SWD flashen',
        flashSwdTitle: 'Über den Debug-Port mit einem CMSIS-DAP-Adapter flashen (DAPLink oder ein Pico mit picoprobe) — ohne BOOT0, ohne Reset',
        flashSwdHint: 'Den CMSIS-DAP-Adapter wählen, der an SWDIO/SWCLK/GND hängt (ein DAPLink-Board oder ein Pico mit picoprobe).',
        flashNoWebUsb: 'Dieser Browser kann kein WebUSB (Chrome oder Edge können es — sie flashen den USBasp direkt, hier, ohne Zusatzsoftware). Die kompilierte .hex wurde heruntergeladen, damit ein bereits vorhandenes externes Programmiergerät genutzt werden kann.',
        flashNeedsProgrammer: d => `${d} hat keinen seriellen Bootloader — es braucht einen ISP/SPI-Programmer (oder, für ein 6502/Z80-Steckbrett, ein EEPROM-Brenngerät). Kompiliertes Abbild heruntergeladen.`,
        stLoaded: 'Blöcke geladen.',
        stWarn: w => `Mit Warnungen geladen — ${w}`,
        foreverLoop: 'Dieses Projekt hat eine Endlosschleife (Spiel), es läuft daher in den Blöcken — klicke die grüne Flagge zum Spielen. Für einen Text-Lauf nimm ein algorithmisches Beispiel (Quiz, Operatoren, 2048, …).',
        cNote: 'C für den STC12 / 8051. Eigene Firmware einfügen und „⇦ Zu Blöcken” drücken, oder auf stc-compiler.vercel.app zu .hex kompilieren. Eine 8051-Lücke: tone (set <buzzer> to N hz) hat noch keinen STC12-Treiber — es kompiliert auf dem 8051 (und dem Pico) zu einem STILLEN No-op, ohne Fehler; nur der Arduino/AVR-Build erzeugt Ton. Auf dem 8086 wird das C lokal kompiliert und ausgeführt (SmallerC + der In-Browser-Assembler); die Pins des 8255 werden mit den Port-I/O-Primitiven bw_outb(port, value) und bw_inb(port) angesteuert — cdecl, 16-Bit-Argumente, der Aufrufer räumt auf — dieselben, die das erzeugte C nutzt. Skalare Variablen und Parameter unsigned (wortbreit) halten, nicht unsigned char: das Lesen eines Byte-Werts lässt SmallerC MOVZX erzeugen, eine 80386-Instruktion, die der 8086-Assembler ablehnt.',
        basicNote: 'BBC BASIC läuft in CrispBASIC, der eingeschränkten Browser-Version von R.T. Russells BBCSDL-Interpreter. Für die Retro-Maschine BBC BASIC Z80 wählen; 6502/8086 haben eigene Profile. Die VDU-Anzeige unterstützt Text und einfache Zeichnungen. Vollständige Grafikkompatibilität, Grafikabfragen, Dateien, Ton und Quelltext-Debugging sind in CrispBASIC nicht verfügbar. Schaltung verbinden ermöglicht digitale GPIOs und simulierte Zeit in der aktiven unterstützten Schaltung; analoge Ein-/Ausgabe, PWM und Ausführung auf physischer Hardware sind nicht verfügbar. Die Umwandlung in Blöcke unterstützt weiterhin nur die dokumentierte Teilmenge des Readers. Multi-WHEN-Programme werden nicht dargestellt (BASIC ist einzel-threaded).',
        asmNote: 'Assembler schreiben oder kompiliertes Listing ansehen. Source-Modus: gerätespezifischen Assembler schreiben und assemblieren+ausführen — die 6502-/Z80-/8086-Werkbänke booten das Image direkt. ZWEI ASSEMBLER, und welcher lief, steht immer in der Statuszeile: 8086-Assembler wird IN DIESEM BROWSER gebaut (ohne Netz, MASM-Syntax), 8051/6502/Z80/AVR gehen an den gehosteten Dienst. Listing-Modus: erzeugter, schreibgeschützter Beleg, für gebündelte 8051-Ziele lokal gelinkt und für nicht unterstützte Ziele ausdrücklich gehostet. Zu Blöcken: 8086-Assembler, den ▶ Auf 8086 ausführen erzeugt hat, wird zurückgelesen; alles andere wird namentlich und gezählt abgelehnt.',
        asmLifted: n => `${n} Assembler-Anweisung(en) in den Dialekt zurückgelesen`,
        asmLiftRefused: (why, n) => `Nicht zurückgelesen: ${why}${n ? ` (${n} Anweisung(en) davor schon)` : ''}`,
        stCOneWay: 'Diese Sprache lässt sich nicht zu Blöcken zurückführen.',
        // BASIC / ASM mode bar
        profile: 'Profil:', lineNumbers: 'Zeilennummern', alwaysOn6502: '(immer an bei 6502)',
        asmModeLabel: 'Modus:', asmSource: 'Source (editierbar)', asmListing: 'Listing (vom Compiler)',
        asmBlinkRunning: (machine, route) => `LED 0 blinkt auf ${machine} · ${route}`,
        asmExampleLabel: 'Beispiel:', asmExamplePick: 'wählen…',
        asmExampleReplace: 'Inhalt des Assembler-Editors ersetzen?',
        asmExampleLoaded: n => `„${n}" geladen. Mit Assemblieren & Ausführen bauen.`,
        assembleAndRun: '🔩 Assemblieren & Ausführen',
        asmRouteLocal: 'in diesem Browser', asmRouteHosted: 'vom gehosteten Assembler',
        asmDialectLabel: 'Dialekt:',
        asmDialectTitle: 'MASM- oder NASM-Syntax für den 8086-Assembler. Auto liest die Quelle und lehnt ab, wenn beides vorkommt.',
        asmDialectNames: {auto: 'auto (erkennen)', masm: 'MASM', nasm: 'NASM'},
        asmDialectUsed: d => ` — ${d.toUpperCase()}-Syntax`,
        asmAssembling: r => `Assembliere ${r}…`,
        asmBuiltBench: (n, r, m) => `${n} Bytes assembliert ${r} — starte die ${m}-Werkbank…`,
        asmBuiltOnly: (n, r, t) => `Assembliert (${n} Bytes, ${r}). Auto-Start aus ASM ist für die 6502-/Z80-/8086-Werkbänke verdrahtet; für ${t} den Compile-Pfad nutzen.`,
        asmBuiltArm: (n, r, t) => `${n} Bytes Intel-HEX assembliert ${r} — läuft jetzt auf dem ${t}-Simulator.`,
        runCZ80: '▶ C auf Z80 ausführen',
        runCZ80Title: 'Dieses C für die Z80-Werkbank übersetzen (sdcc -mz80 auf dem gehosteten Dienst) und starten: ROM ab $0000, RAM ab $8000, OUT-Latch und IN-Puffer auf Port 0.',
        runCZ80Building: 'C wird für den Z80 übersetzt (gehosteter sdcc -mz80)…',
        runCZ80Built: (n) => `Z80-ROM mit ${n} Byte gebaut — starte die Z80-Werkbank…`,
        runCZ80Refused: (m) => `Der Z80-C-Compiler hat dieses Programm abgelehnt: ${m}`,
        runCZ80Unavailable: (m) => `Der Z80-C-Compiler ist nicht erreichbar (er läuft auf dem gehosteten Dienst): ${m}`,
        asmSourceError: (r, m) => `Assembler-Fehler (${r}): ${m}`,
        asmTransportError: (r, m) => `Assembler nicht erreichbar (${r}): ${m}`,
        asmWarnings: w => ` — ${w.length} Warnung(en): ${w.join('; ')}`,
        asmCredit: a => `${a.author} · ${a.licence}`,
        asmCreditTitle: a => `Beispielprogramme von ${a.author}, Lizenz ${a.licence}. Quelle: ${a.repo}`,
        basicInfoTitle: 'BASIC-Info', asmInfoTitle: 'ASM-Info',
        // micro:bit bar
        micropythonReadonly: 'Nur-Lesen — aus deinen Blöcken für den micro:bit generiert.',
        micropythonImported: 'Aus einer .hex importiert — der Simulator führt das direkt aus.',
        runOnSimulator: '▶ Ausführen',
        toolbarLabel: 'Code-Editor-Werkzeugleiste (seitlich scrollbar)',
        openSpikeArena: '🪐 SPIKE-Arena',
        openSpikeArenaTitle: 'Eine freie virtuelle SPIKE-Arena erkunden oder ein Programm in den Arena-Aufgaben ausführen',
        spikeFirmwareRunTitle: 'Unterstützten Code in unserer ARM-Firmware für die Simulation ausführen',
        runOnSpike3: '▶ Auf SPIKE 3 ausführen (Python)',
        runOnSpike3Title: 'Dieses LEGO-SPIKE-App-3-Python-Programm in SPIKE-Blöcke übersetzen und auf dem virtuellen SPIKE-Hub ausführen (und in der Arena, wenn sie offen ist)',
        spike3Console: 'SPIKE-3-Python-Konsole',
        spike3Stop: '■ Stopp',
        spike3Running: 'Läuft auf dem virtuellen SPIKE-Hub …',
        spike3Stopped: 'Gestoppt.',
        spike3NoHub: 'Der virtuelle SPIKE-Hub ist in diesem Build nicht verfügbar.',
        spike3NoConnect: 'Die SPIKE-Erweiterung konnte sich nicht mit dem virtuellen Hub verbinden.',
        spike3Unsupported: n => `${n} Aufruf(e) haben keinen SPIKE-Block und wurden weggelassen; jeder ist im Blockquelltext mit „# unsupported“ markiert.`,
        spike3Note: 'Hinweis',
        spike3Error: 'Fehler',
        spike3Out: 'print',
        spike3Clear: 'Leeren',
        runSpikeUsb: '▶ Auf SPIKE über USB ausführen',
        probeSpikeUsb: 'USB-Ports lesen',
        probeSpikeUsbTitle: 'Einen physischen LEGO-USB-Hub verbinden und Motoren und Sensoren an A–F lesen. Dies prüft nicht den virtuellen Hub.',
        spikeUsbDirect: 'USB an diesem Computer', spikeUsbBridge: 'USB über Mac im WLAN',
        spikeUsbRouteLabel: 'SPIKE-USB-Verbindung', dismissNotice: 'Hinweis schließen',
        spikeUsbUrl: 'Mac-Bridge-URL', spikeUsbToken: 'Bridge-Token',
        spikeUsbRunning: 'Programm wird per USB übertragen…',
        spikeUsbProbing: 'USB-Hub-Ports werden gelesen…',
        spikeUsbDone: (firmware, ports) => `USB-Programm beendet (${firmware}). Ports: ${ports}`,
        spikeUsbFail: message => `SPIKE USB: ${message}`,
        debugOnSimulator: '🐞 Debuggen',
        debugLevelBlock: 'Block',
        debugLevelLine: 'Zeile',
        debugBlockHint: 'Block-Ebene: Schritt für Block auf der Standard-Firmware — kein Extra-Download.',
        debugLineHint: 'Zeilen-Ebene: Schritt für Quellzeile mit echten Variablen & Aufrufstapel (lädt die settrace-Debug-Firmware, +6KB).',
        // device selector / maximize
        devicePlaceholder: 'Gerät…', deviceTitle: 'Zielgerät — bestimmt Pinbenennung, Compile-Ziel und Emulator',
        maximizeTitle: 'Editor maximieren', restoreTitle: 'Panels wiederherstellen',
        asmWriteFirst: 'Schreibe zuerst Assembler-Quellcode.',
        run8086: '▶ Auf 8086 ausführen',
        run8086Title: 'Diese Blöcke in diesem Browser in 8086-Assembler übersetzen und auf der DOS-Werkbank ausführen — ohne Netz, ohne Toolchain.',
        export8086Com: '⬇ .COM',
        export8086ComTitle: 'Die assemblierte .COM herunterladen — die exakten Assembler-Bytes (org 100h), zum Ausführen unter DOS oder einem anderen 8086-Emulator.',
        export8086Img: '⬇ .img',
        export8086ImgTitle: 'Ein bootfähiges 1,44-MB-Diskettenabbild herunterladen, das dieses Programm auf echter PC/XT-Hardware oder einem anderen Emulator startet.',
        export8086ComDone: n => `.COM gespeichert (${n} Bytes).`,
        export8086ImgDone: n => `Bootfähiges Diskettenabbild gespeichert (${n} Bytes).`,
        run8086Building: 'Übersetze die Blöcke in 8086-Assembler…',
        run8086Built: (n, b) => `${n} Bytes aus ${b} Block/Blöcken in diesem Browser erzeugt — starte die 8086-DOS-Werkbank…`,
        run8086Refused: m => `Das 8086-Backend hat dieses Programm abgelehnt: ${m}`,
        run8086Failed: m => `Build für den 8086 fehlgeschlagen: ${m}`,
        run8086Empty: 'Schreibe zuerst Pseudocode.',
        runC8086: '▶ C auf 8086 ausführen',
        runC8086Title: 'Dieses C mit SmallerC in diesem Browser übersetzen, hier auch assemblieren und auf der DOS-Werkbank ausführen — ohne Netz, ohne Toolchain.',
        runC8086Building: 'Übersetze C für den 8086 in diesem Browser…',
        runC8086Built: (n, r) => `${n} Bytes ${r} erzeugt — starte die 8086-DOS-Werkbank…`,
        runC8086Refused: (r, m) => `Der C-Compiler ${r} hat dieses Programm abgelehnt: ${m}`,
        runC8086Failed: (r, m) => `Die 8086-C-Route (${r}) lief nicht: ${m}`,
        runC8086Empty: 'Schreibe zuerst C.',
        runC8086Route: 'in diesem Browser',
        runCRiscv: '▶ C auf RISC-V ausführen',
        runCRiscvTitle: 'Dieses C übersetzen und auf der RV32IMA-Konsole ausführen. Route wählen: im Browser (eine C-Teilmenge, ohne Dienst) oder auf dem gehosteten Dienst (vollständiges C).',
        runCRiscvRouteTitle: 'Wo das C übersetzt wird: im Browser (shecc → WASM, eine C-Teilmenge, nichts verlässt die Seite) oder auf dem gehosteten Dienst (natives gcc + picolibc — vollständiges C: Gleitkomma, malloc, die Standardbibliothek).',
        runCRiscvRouteBrowser: 'Browser · shecc (Teilmenge)',
        runCRiscvRouteServer: 'Server · gcc (voll. C)',
        runCRiscvBuilding: 'Übersetze C für RISC-V…',
        runCRiscvBuilt: (n, segs, entry, compiler) =>
            `${n}-Byte-RISC-V-Abbild erzeugt (${segs} Segment${segs === 1 ? '' : 'e'}, `
            + `Einsprung 0x${entry.toString(16)}) mit ${compiler} — starte die RV32IMA-Konsole…`,
        runCRiscvRefused: (m) => `Der RISC-V-C-Compiler hat dieses Programm abgelehnt: ${m}`,
        runCRiscvUnavailable: (m) => `Der RISC-V-C-Compiler ist nicht verfügbar: ${m}`,
        runCRiscvEmpty: 'Schreibe zuerst C.',
        runCRiscvTryServer: '▶ Vollen Compiler versuchen (Server)',
        runCRiscvTryServerTitle: 'Das eingebaute shecc übersetzt eine Teilmenge von C. Dieses Programm nutzt etwas, das es nicht unterstützt — übersetze es stattdessen auf dem gehosteten Dienst (volles gcc + picolibc).',
        runSketch: '▶ Sketch ausführen',
        runSketchTitle: 'Diesen C-Tab als Arduino-Sketch übersetzen — echtes C++: Serial, String, Klassen, die Wire/SPI/EEPROM/SoftwareSerial-Bibliotheken des Cores — auf dem gehosteten Compiler, dann auf dem Simulator dieses Boards ausführen. Serielle Ausgaben erscheinen in der seriellen Konsole des Debuggers.',
        runSketchBuilding: 'Sketch wird mit dem Arduino-Core übersetzt (gehosteter avr-gcc)…',
        runSketchBuilt: (n, libs, protos) =>
            `Sketch mit ${n} Byte mit dem Arduino-Core gebaut`
            + (libs.length ? ` und ${libs.join(', ')}` : '')
            + (protos ? ` (${protos} Prototyp${protos === 1 ? '' : 'en'} erzeugt, unten aufgeführt)` : '')
            + ' — er läuft jetzt auf dem Simulator.',
        runSketchRefused: (m) => `Der Arduino-Compiler hat diesen Sketch abgelehnt: ${m}`,
        runSketchUnavailable: (m) => `Der Arduino-Compiler ist nicht erreichbar (er läuft auf dem gehosteten Dienst): ${m}`,
        runSketchEmpty: 'Schreibe zuerst einen Sketch — setup() und loop().',
        runSketchBuiltArduboy: (n, libs) => `Arduboy-Sketch mit ${n} Byte gebaut`
            + (libs.length ? ` mit ${libs.join(', ')}` : '')
            + ' — er läuft jetzt auf der Arduboy-Konsole. Pfeiltasten bewegen, Z ist A, X ist B.',
        runSketchClockMismatch: (built, board) =>
            ` Hinweis: Das Abbild wurde für ${built} Hz gebaut, dieses Board läuft aber mit ${board} Hz — das Timing stimmt daher nicht.`,
        // reference section headers
        h: {
            Structure: 'Struktur', EventsHats: 'Events (Hats)', Control: 'Steuerung',
            ClonesBroadcasts: 'Klone & Nachrichten', MotionLooks: 'Bewegung & Aussehen',
            DataLists: 'Daten & Listen', Expressions: 'Ausdrücke', Conditions: 'Bedingungen',
            CustomBlocks: 'Eigene Blöcke', PlaneteMaths: 'Planète Maths (Extension)',
            ArraysVectors: 'Arrays & Vektoren (Extension)', SensingMore: 'Fühlen & mehr',
            Statements: 'Anweisungen', Declare: 'Deklarieren (Pseudocode-Tab)', Pins: 'Pins',
            Notes: 'Hinweise', Profiles: 'Profile', LineNumbers: 'Zeilennummern', IO: 'Ein/Ausgabe',
            Overview: 'Übersicht', Verbs: 'Verben',
            Registers: 'Register', Workflow: 'Arbeitsablauf', Addressing: 'Adressierung',
            I8086: '8086 (MASM, hier assembliert)'
        }
    }
};
const pickLocale = loc => (loc && L10N[String(loc).slice(0, 2)] ? String(loc).slice(0, 2) : 'en');

/**
 * "Pseudocode" editor tab: the full SB3 Creator tool inside the editor.
 *  - load a built-in example
 *  - a collapsible syntax reference
 *  - upload SVGs and bake them in as sprite costumes
 *  - compile pseudocode into blocks and load it into the running VM
 *  - "From blocks": decompile the running project back into pseudocode (two-way)
 */

// Grouped catalogue of built-in examples (mirrors the standalone app).
const GROUPS = [
    {label: 'Games', items: [
        // The old shape-only Snake/Pong/Tetris/etc. mechanics remain available
        // in sb3-creator-examples.js for compiler regression coverage, but they
        // are not finished games and therefore do not belong in this gallery.
        // A game enters here only after an authored-art, onboarding, objective,
        // feedback, touch-control and live-VM audit.
        ['g2048', '✨ Nova Grid'],
        ['sigil_grid', '☀️ Sigil Grid'],
        ['vector_seven', '🏓 Vector Seven'],
        ['reactor_ricochet', '⚡ Reactor Ricochet'],
        ['flux_vault', '🔷 Flux Vault'],
        ['neon_circuit', '💡 Neon Circuit'],
        ['canal_command', '🚢 Canal Command'],
        ['sky_skim', '🪽 Skyline Swoop'],
        ['missile_ballet', '✈️ Contrail Panic'],
        ['orbit_ward', '🛡️ Aegis Arc'],
        ['chroma_code', '💎 Prism Lock'],
        ['fusion_foundry', '☄️ Core Cascade'],
        ['rooftop_relay', '🏃 Neon Relay'],
        ['twinwall', '🪩 Rift Rally'],
        ['turbo_chicane', '🏁 Slipstream Circuit'],
        ['abyss_rescue', '🤿 Abyss Lift'],
        ['specter_sweep', '🔮 Wardlight'],
        ['moonlight_heist', '🐭 Pantry Prowl'],
        ['cloud_court', '🏐 Nimbus Volley'],
        ['ember_dojo', '⚔️ Ember Parry'],
        ['lockstep_lagoon', '🌊 Tidegate Rush'],
        ['rink_riot', '🏒 Blue-Line Breaker'],
        ['rim_reactor', '🏀 Orbit Hoops'],
        ['comet_cup', '☄️ Comet Strikers'],
        ['trench_signal', '🛸 Echo Trench'],
        ['whisker_switch', '🐭 Whisker Relay'],
        ['spiral_circuit', '🌀 Helix Rush'],
        ['lilyway_rescue', '🐸 Moonbank Hop'],
        ['rotor_rogue', '🏍️ Crosswind Courier'],
        ['prism_spire', '🏗️ Lumen Stack'],
        ['shard_sheriff', '🩸 Plasma Posse'],
        ['halo_foundry', '🛡️ Halo Lockdown'],
        ['corridor_kestrel', '🛸 Carrier Kestrel'],
        ['thunder_volley', '⚡ Skycourt Surge'],
        ['cascade_pair', '🌈 Chromafall Reactor'],
        ['mooncoil_odyssey', '🌙 Cratercoil'],
        ['cinder_thrust', '🚀 Magma Lift'],
        ['triple_bingo', '🎲 Triple Bingo']
    ]},
    {label: 'Demos', items: [
        ['game', '🎯 Complete Game'], ['art', '🎨 Digital Art'], ['physics', '⚡ Physics Demo'],
        ['animation', '🎞️ Animation & Sound'], ['educational', '📚 Educational Tool']
    ]},
    {label: 'Language basics', items: [
        ['motion', 'Motion'], ['looks', 'Looks'], ['sound', 'Sound'], ['pen', 'Pen'],
        ['sensing', 'Sensing'], ['control', 'Control'], ['operators', 'Operators']
    ]},
    {label: 'Extensions', items: [
        ['planetemaths', '🧮 Planète Maths'], ['arrays', '📐 Arrays & Vectors']
    ]},
    // The examples for the C target. Everything above is a Scratch program and compiles to
    // C only as "no equivalent" warnings; these declare real pins and build on SDCC.
    {label: 'Hardware (STC12 / 8051)', items: [
        ['stc_blink', '💡 Blink two LEDs'], ['stc_button', '🔘 Button'],
        ['stc_potentiometer', '🎛️ Potentiometer (ADC)'],
        ['stc_two_scripts', '⏱️ Two scripts at once'], ['stc_pwm_fade', '🌗 PWM fade']
    ]},
    // The 8086 examples compile to ASSEMBLY through our own assembler rather
    // than to C — there is no ia16 compiler in the service and this tier does
    // not need one. `i8086_blink` is deliberately the STC blink with its
    // DEVICE line changed and its two 8051-only lines removed, because that
    // is the claim the whole tier rests on.
    {label: 'Hardware (8086)', items: [
        ['i8086_blink', '💡 Blink, reseated from the 8051'],
        ['i8086_keypad', '⌨️ Keypad on an 8255'],
        ['i8086_events', '⏱️ Four scripts, preemptive'],
        ['i8086_analog', '🎛️ Analog in (ADC0809)'],
        ['i8086_counter', '🔢 Eight-digit display']
    ]}
];

// Section header keys map to L10N.h — the code snippet items stay English (they ARE code).
const SYNTAX = [
    ['Structure', ['SPRITE Name:', 'STAGE:', 'GLOBAL score / LOCAL hp', 'LIST inventory',
        'SHAPE rect 16 90 / circle 18', 'SHAPE art skyline-swoop/bird',
        'SHAPE polygon 20 0 40 40 0 40 #f53',
        'COSTUME walk2 / BACKDROP night', 'SOUND jump 660', '# comment']],
    ['EventsHats', ['WHEN flag clicked:', 'WHEN space key pressed:', 'WHEN sprite clicked:',
        'WHEN I receive "go":', 'WHEN I start as a clone:']],
    ['Control', ['FOREVER:', 'REPEAT 10:', 'REPEAT UNTIL x > 5:', 'IF cond THEN: / ELSE:',
        'wait until cond', 'stop all / stop this script']],
    ['ClonesBroadcasts', ['create clone of myself', 'create clone of Bullet', 'delete this clone',
        'broadcast "go"', 'broadcast "go" and wait']],
    ['MotionLooks', ['move 10 steps', 'go to x: 0 y: 0', 'glide 1 secs to x: 50 y: 0',
        'point towards mouse-pointer', 'set size to 80 / set ghost effect to 50']],
    ['DataLists', ['set score to 0', 'change score by 1', 'add 5 to nums',
        'delete all of nums', 'replace item 1 of nums with 9']],
    ['Expressions', ['(a + b) * c, 7 mod 3', 'pick random 1 to 10', 'round x, sqrt of x',
        '"Score: " join score', 'x position, size, timer, answer']],
    ['Conditions', ['a > b, a <= b, a = b', 'cond and cond / or / not cond',
        'touching Sprite / touching color #ff0000', 'key space pressed? / mouse down?', 'nums contains 3']],
    ['CustomBlocks', ['DEFINE draw box (col) (row):', 'DEFINE FAST render: (warp)',
        '<flag> = boolean parameter', 'call: draw box 3 4', 'params in body: go to x: col y: row']],
    ['PlaneteMaths', ['factorial of 5', 'sum of digits of 123', 'min of a and b / max of a and b',
        '2 to the power of 8', 'pi, euler', 'x is multiple of 3']],
    ['ArraysVectors', ['new array "v" = [1,2,3]  (0-based)', 'new array "v" = range 1 to 5',
        'push x to array "v" / set item i of array "v" to x', 'item i of array "v" / sum of array "v"',
        'largest / smallest / length / mean of array "v"', 'array "v" contains x / array "v" as text']],
    ['SensingMore', ['x position of Player', 'current year, day of week',
        'distance to mouse-pointer', 'set drag mode draggable', 'play note 60 for 0.5 beats, set tempo to 120']]
];

// What each tab is, as a FILE. Every tab can now be opened from and saved to
// disk, so each needs an extension, a MIME type and a default basename.
// `.py` is claimed by two tabs; openBwFile resolves that in favour of the tab
// you are already on, else the first match here (python).
/**
 * The MakeCode boards this build runs (their runtime is served under
 * static/makecode/<pxt target id>/ by sync-makecode-runtime), and the firmware a
 * native build writes. Kept here rather than imported, because the runtime
 * module is loaded on demand only (test/makecode-ui-contract); the lists must
 * agree with pxt-runtime.js MAKECODE_BOARDS, which a test checks.
 */
const MAKECODE_RUNNABLE = ['microbit', 'calliopemini', 'ev3', 'adafruit', 'arcade'];
const MAKECODE_FIRMWARE = {microbit: 'hex', calliopemini: 'hex', ev3: 'uf2', adafruit: 'uf2', arcade: 'uf2'};
// Arcade firmware is per BOARD (pxt-runtime.js arcadeBoards): the picker's value.
const arcadeBoardKey = b => `${b.variant}:${b.name}`;
const MAKECODE_EDITOR = {microbit: 'https://makecode.microbit.org/', calliopemini: 'https://makecode.calliope.cc/',
    ev3: 'https://makecode.mindstorms.com/', adafruit: 'https://makecode.adafruit.com/', arcade: 'https://arcade.makecode.com/'};

const CODE_FILES = {
    pseudocode:  {ext: 'bw',  mime: 'text/plain',      base: 'program'},
    python:      {ext: 'py',  mime: 'text/x-python',   base: 'program'},
    javascript:  {ext: 'js',  mime: 'text/javascript', base: 'program'},
    c:           {ext: 'c',   mime: 'text/x-csrc',     base: 'program'},
    basic:       {ext: 'bas', mime: 'text/plain',      base: 'program'},
    asm:         {ext: 'asm', mime: 'text/plain',      base: 'program'},
    // main.py is not a preference: it is the name the Pico and the micro:bit
    // boot, and what deployToPico already hands over on non-Chromium.
    micropython: {ext: 'py',  mime: 'text/x-python',   base: 'main'},
    // NQC's own extension. The MIME is C's because NQC is a C dialect and
    // every editor on earth already highlights it that way; the EXTENSION is
    // not, because `nqc` is what the compiler, Bricx Command Center and
    // twenty-five years of example code expect to see.
    nqc:         {ext: 'nqc', mime: 'text/x-csrc',     base: 'program'},
    // fe (rxi), a tiny Lisp run as fe.exe on the DOS bench (DOS_TOOLCHAINS 'fe').
    fe:          {ext: 'fe',  mime: 'text/plain',      base: 'program'},
    forth:       {ext: 'fth', mime: 'text/plain',      base: 'program'},
    tcl:         {ext: 'tcl', mime: 'text/plain',      base: 'program'}
};
const CODE_ACCEPT = [...new Set(Object.values(CODE_FILES).map(f => `.${f.ext}`)), '.s', '.lst'].join(',');

// The pseudocode buffer used to be the only thing kept across reloads, and it
// was kept wrong: the editor's onChange (setActiveCode) CLEARS every buffer
// except the one being typed in, so editing any other tab drove pseudocode to
// '' and wiped the save. Track the ACTIVE buffer instead — that is the one the
// user is actually working in, and it is never emptied by that rule.
const BW_AUTOSAVE_KEY = 'bw-code-autosave';
// Code-tab languages most people never need: they stay out of the language row
// until chosen from its "+" menu (remembered per browser), opened, or written in.
const BW_OPTIONAL_LANGS = [['fe', 'λ fe', 'Lisp (fe: DOS, or any board via blocks)'], ['tcl', '○ Tcl', 'Tcl (Jim: DOS, or any board via blocks)'], ['forth', '🔺 Forth', 'Forth (zForth: DOS, or any board via blocks)']];
const BW_EXTRA_LANGS_KEY = 'bw-code-extra-languages';
const readExtraLangs = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(BW_EXTRA_LANGS_KEY) || '[]');
        return Array.isArray(saved) ? saved.filter(l => BW_OPTIONAL_LANGS.some(([id]) => id === l)) : [];
    } catch { return []; }
};

const LANG_LABEL = {pseudocode: 'Pseudocode', python: 'Python', javascript: 'JavaScript', c: 'C', basic: 'BASIC', asm: 'ASM', micropython: 'micro:bit', nqc: 'NQC', fe: 'fe (Lisp)', tcl: 'Tcl', forth: 'Forth'};

const DEVICE_HELP = {
    microbit: 'Run MicroPython in the right-hand micro:bit simulator, use its A/B buttons and sensor sliders, or download a .hex for a real board.',
    calliopemini: 'Uses the micro:bit-compatible MicroPython editor and simulator. P0–P20 programs retarget directly; MakeCode Calliope imports keep the Calliope device identity.',
    arcade: 'Runs games on the 160×120 console in the right pane. Arrow keys and the on-screen pad move; Space/Z are A/B.',
    pybadge: 'Runs the Arcade game on a PyBadge-shaped 160×128 console with A/B, D-pad, NeoPixels, light and tilt controls.',
    'pybadge-lc': 'Runs the Arcade game on the compact PyBadge LC console. Its virtual GPIO keeps code runnable without inventing physical breakout pins.',
    samd51: 'Targets the generic ATSAMD51J19 pin vocabulary. It has no invented board peripherals; choose PyBadge for its screen, controls and sensors.',
    arduboy: 'Runs games on the Arduboy console: open an existing ATmega32U4 .hex, or write an Arduboy2 sketch in the C tab and press ▶ Run sketch (compiled as C++ on the hosted service).',
    pico: 'Compiles bare-metal RP2040 code for the emulator, or deploys MicroPython main.py to a mounted Pico.',
    eater6502: 'Builds for the breadboard 6502 workstation: W65C22 VIA, ACIA serial, keyboard, OLED or VGA circuits and debugger.',
    z80: 'Builds for the Z80 bench with OUT0–OUT7 and IN0–IN7 latch/buffer pins and its machine debugger.',
    stm32f030: 'Compiles and emulates the light-tier STM32F030 target. Serial bootloader and SWD flashing actions appear for pseudocode.',
    esp8266: 'Writes C for the ESP8266 (GP0–GP5, GP12–GP15) against the blob-free esp8266js runtime and runs its flash image in the ESP8266 emulator: pins, waits, print, PWM and tone; no analog input.',
    default: 'Choose examples written for this exact board, edit code, convert supported constructs to Blocks, then run, emulate or flash using the actions shown for the target.'
};

const deviceHelp = id => DEVICE_HELP[id] || (/^(arduino|atmega|attiny)/.test(id || '') ?
    'Uses the AVR pin vocabulary and emulator. Open an example for this exact board; serial-bootloader targets also offer Flash to board.' :
    (/^stc/.test(id || '') ?
        'Compiles 8051/STC pseudocode, runs it in the chip emulator and offers the STC serial ISP flashing path.' : DEVICE_HELP.default));

// Languages you can compile back INTO blocks. C joined them once cToPseudocode landed:
// it reads both our own emitted C (which carries an `@bw` marker header, so the round-trip
// is exact) and hand-written firmware (pins from `#define LED1 P1_0`, polarity from the
// `LED_ON 0` idiom — every inference reported as a warning, never guessed silently).
// The one thing it will not do is invert the cooperative-scheduler form; it says so.
// DEVICE_CHIP_LABELS imported from ../../lib/device-labels.js
// fe and Tcl read and write through bw-lang/fe.js and bw-lang/tcl.js (Tcl
// keeps what blocks cannot say as raw blocks; fe refuses it by name).
const TWO_WAY = new Set(['pseudocode', 'python', 'javascript', 'c', 'basic', 'fe', 'tcl', 'forth']);

/**
 * The DOS-interpreter languages' halves, loaded on demand: the module's
 * default export reads the tab's text into pseudocode; `generate` turns a
 * project into the tab's text,
 * or into a comment block naming why it cannot (each language's own comment
 * syntax, so the refusal is still a valid file to open).
 */
const DOS_LANG = {
    fe: {
        load: () => import(/* webpackChunkName: "bw-lang-fe" */ '../../lib/bw-lang/fe.js'),
        generate: (m, proj) => {
            const r = m.generateFe(proj);
            return r.ok ? r.fe : `; === Cannot show as fe ===\n${r.reasons.map(s => '; ' + s).join('\n')}\n`;
        }
    },
    tcl: {
        load: () => import(/* webpackChunkName: "bw-lang-tcl" */ '../../lib/bw-lang/tcl.js'),
        generate: (m, proj) => {
            const r = m.generateTcl(proj);
            return r.ok ? r.tcl : `# === Cannot show as Tcl ===\n${r.reasons.map(s => '# ' + s).join('\n')}\n`;
        }
    },
    forth: {
        load: () => import(/* webpackChunkName: "bw-lang-forth" */ '../../lib/bw-lang/forth.js'),
        generate: (m, proj) => {
            const r = m.generateForth(proj);
            return r.ok ? r.forth : `( === Cannot show as Forth === )\n${r.reasons.map(s => `( ${s} )`).join('\n')}\n`;
        }
    }
};
/** The fe/Tcl buffers for From blocks: the open tab's text if it is one, the
 * others empty (they re-derive when opened, as after ⇦ To blocks). */
const dosLangBuffersFor = async (proj, openLang) => {
    const out = {};
    for (const [lang, d] of Object.entries(DOS_LANG)) out[lang] = lang === openLang ? d.generate(await d.load(), proj) : '';
    return out;
};

/**
 * ONE-WAY IS NOT THE SAME AS READ-ONLY, and the two were conflated because
 * every one-way tab so far happened to be generated output: the MicroPython
 * preview and the ASM listing are things the app WROTE, so making them
 * read-only was right by accident.
 *
 * NQC is one-way — there is no NQC-to-blocks front end — and yet it is the
 * tab you are meant to TYPE in. So the question the editor asks is no longer
 * "can this round-trip" but "is this mine to edit", which is what it should
 * have been asking all along.
 */
const EDITABLE_ONE_WAY = (lang, asmMode) =>
    lang === 'nqc' || (lang === 'asm' && asmMode === 'source');

const representationNotice = (lang, asmMode, locale) => {
    const de = /^de/i.test(locale || '');
    if (lang === 'nqc') return de ?
        'Editierbarer NQC-Quelltext • lokal kompilieren und an den RCX senden • kein Rückweg zu Blöcken' :
        'Editable NQC source • compile locally and send to an RCX • no reverse conversion to Blocks';
    if (lang === 'micropython') return de ?
        'Generierte schreibgeschützte Vorschau • Blöcke → micro:bit Python • kein Rückweg' :
        'Generated read-only preview • Blocks → micro:bit Python • no reverse conversion';
    if (lang === 'asm') {
        if (asmMode === 'listing') return de ?
            'Generiertes schreibgeschütztes Listing • Compiler → ASM • kein Rückweg zu Blöcken' :
            'Generated read-only listing • compiler → ASM • no reverse conversion to Blocks';
        return de ?
            'Editierbarer ASM-Quelltext • assemblieren und ausführen • kein Rückweg zu Blöcken' :
            'Editable ASM source • assemble and run • no reverse conversion to Blocks';
    }
    const name = LANG_LABEL[lang] || lang;
    return de ?
        `Editierbarer ${name}-Quelltext • Umwandlung zu/von Blöcken nur für die unterstützte Teilmenge • Warnungen prüfen` :
        `Editable ${name} source • converts to/from Blocks only for the supported subset • review warnings`;
};

const classifyConversionWarnings = warnings => {
    const unsupported = [];
    const changed = [];
    for (const warning of warnings || []) {
        const text = String(warning);
        if (/unsupported|not represent|cannot|could not|no sprite named/i.test(text)) unsupported.push(text);
        else changed.push(text);
    }
    return {unsupported, changed};
};

// What the Python / JavaScript front-ends actually support (shown as the reference
// when those tabs are active, so you know what round-trips to blocks).
// Section header keys map to L10N.h — code snippets stay English (they ARE code).
const SUPPORTED = {
    python: [
        ['Structure', ['def when_flag_clicked():', 'def do_myblock(a, b):', 'x = 0 / xs = []  (module state)', 'when_flag_clicked()  (run)']],
        ['Control', ['if / elif / else:', 'while cond:  →  repeat until', 'while True:  →  forever', 'for _ in range(n):', 'return  →  stop this script']],
        ['Statements', ['x = expr  /  x += expr', 'print(x)  →  say', 'x = input(p)  →  ask', 'xs.append/insert/clear', 'del xs[i-1]  /  xs[i-1] = v']],
        ['Expressions', ['+ - * / %,  a == b → =', 'and / or / not', '_eq(a, b) (loose =)', 'random.randint(a, b)', 'len(x), math.floor(x), str()/int()']]
    ],
    javascript: [
        ['Structure', ['function when_flag_clicked() {}', 'function do_myblock(a, b) {}', 'let x = 0;  let xs = [];', 'when_flag_clicked();  // run']],
        ['Control', ['if / else', 'while (cond)  →  repeat until', 'while (true)  →  forever', 'for (let i=0; i<n; i++)', 'return;  →  stop this script']],
        ['Statements', ['x = expr;  /  x += expr;', 'console.log(x)  →  say', 'prompt(p)  →  ask', 'xs.push/splice, xs.length', 'xs[i-1] = v']],
        ['Expressions', ['+ - * / %,  === → =', '&& / || / !', '_eq(a, b), _rand(a, b)', 'String()/Number()', 'Math.floor(x), arr[i-1]']]
    ],
    c: [
        ['Declare', ['DEVICE STC12C5A60S2', 'CLOCK 11059200  /  CLOCK 12 MHz',
            'PIN led = P1.0 OUTPUT ACTIVE LOW', 'PIN pot = P1.3 ANALOG   (ADC n is on P1.n)', 'PIN btn = P3.2 INPUT']],
        ['Pins', ['turn on led / turn off led', 'set led high / set led low', 'toggle led', 'read pot   (reporter or condition)']],
        ['Control', ['WHEN flag clicked:  → one script, or', 'several → cooperative tasks',
            'FOREVER / REPEAT n / REPEAT UNTIL', 'IF … THEN / ELSE', 'wait n seconds, wait until, stop']],
        ['Notes', ['Timer 0 at FOSC/12 — never a cycle-counted delay',
            'ACTIVE LOW: “turn on” writes a 0', 'variables are 16-bit ints',
            'motion/looks/sound → /* comments */', 'chips: stc12c5a60s2 · stc12c5a16s2 · stc89c52(rc) · stc15f2k60s2']]
    ],
    basic: [
        ['Profiles', ['BBC BASIC (default): REPEAT/UNTIL, PROC, TIME',
            '6502 BASIC: GOTO, PEEK/POKE, two-char names']],
        ['LineNumbers', ['On (default): 10 REM … / 20 LET … / 30 GOTO',
            'Off (BBC structured): no numbers, IF/ENDIF, WHILE/ENDWHILE',
            '6502 BASIC always uses line numbers']],
        ['Control', ['FOR/NEXT, REPEAT/UNTIL (BBC), WHILE/WEND (6502)',
            'IF/THEN/ELSE/ENDIF (structured) or IF … GOTO (numbered)',
            'PROC/ENDPROC (BBC custom blocks)']],
        ['IO', ['PRINT, INPUT (ask)', 'REM (comments)',
            'Refusals: multi-WHEN, pen, clones → shown as reasons']]
    ],
    asm: [
        ['Workflow', ['Source mode: write, assemble, run',
            'Listing mode: view compiled disassembly',
            'Hosted: 8051 (sdas8051), 6502 (ca65), Z80 (sdasz80), AVR (avr-as)',
            'In this browser: 8086/8088 (MASM subset) — no network']],
        ['Registers', ['A, B, DPTR, SP, PSW (8051)',
            'R0–R7 (register bank), SFRs',
            'Carry (C), Overflow (OV), Parity (P)']],
        ['Addressing', ['MOV A, #imm / MOV A, addr',
            'MOV @R0, A (indirect)', 'MOVC A, @A+DPTR (code memory)',
            'SJMP / LJMP / AJMP, LCALL / ACALL']],
        // The 8086 is a different assembler, a different syntax and a
        // different machine underneath; folding it into the 8051 rows above
        // would have made a reference that is wrong for both.
        ['I8086', ['.MODEL SMALL / .STACK / .DATA / .CODE',
            'PROC … ENDP, MACRO … ENDM, END <entry>',
            'MOV AX, @DATA / MOV DS, AX  (an .EXE needs it)',
            'INT 21h: AH=02h char, 09h string ($-ended), 4Ch exit',
            'INT 10h: AH=0Eh teletype, 09h char+attribute, 02h cursor',
            'Output is the CGA text page — no serial console here',
            'No 80186+: SHL AX,4 is expanded and warns; no 8087',
            'No keyboard yet: a program that waits for one will sit there']]
    ],
    // What generateTcl writes and tclToPseudocode reads: partcl, measured.
    tcl: [
        ['Overview', ['Jim Tcl (Tcl 8 compatible) on the DOS bench',
            'One WHEN flag clicked script + custom blocks (proc)',
            'Tcl blocks cannot say is kept as a grey raw block and written back as is']],
        ['Statements', ['set n 5  /  incr n  /  set n [expr {$n + x}] → change n by', 'puts $n  →  say',
            'after 1000  →  wait 1 secs', 'return / exit  →  stop this script / stop all']],
        ['Control', ['if {…} {…} elseif {…} {…} else {…}', 'while 1 {…}  →  forever',
            'while {!(…)} {…}  →  repeat until', 'for {set _r1 0} {$_r1 < N} {incr _r1} {…}  →  repeat N',
            'foreach x $L {…}  →  a counter walking the list']],
        ['Expressions', ['expr {…}: + - * / % ** == != < > <= >= && || !', 'abs sqrt floor ceil exp log log10 round rand',
            '[string length s] [string index s i] [string first a b]', '"text ${n} more"  →  join']],
        ['Lists', ['lappend L x  →  add x to L', '[lindex $L i] [llength $L]  (Tcl counts from 0)',
            'lset / linsert / lreplace  →  replace / insert / delete', '{x in $L}  →  L contains x']],
        ['Notes', ['A proc\'s variables are its own (they show as proc_name); global shares one',
            'A value from a proc comes back in proc_result',
            'Integers divide as integers (7 / 2 is 3); the DOS heap is about 12 KB']]
    ],
    // What generateFe writes and feToPseudocode reads.
    fe: [
        ['Overview', ['fe (rxi), a tiny Lisp on the DOS bench', 'Numbers are floats: (/ 7 2) is 3.5',
            'One WHEN flag clicked script + custom blocks (fn)']],
        ['Statements', ['(= n 5)  /  (= n (+ n 1)) → change n by 1', '(print n)  →  say',
            '(wait 1)  →  wait (no clock: a no-op)', '(= greet (fn (who) …))  →  DEFINE greet (who)']],
        ['Control', ['(if c (do …) (do …))', '(while t …)  →  forever', '(while (not c) …)  →  repeat until',
            '(= _r1 0) (while (< _r1 N) (= _r1 (+ _r1 1)) …)  →  repeat N']],
        ['Expressions', ['(+ a b) (- a b) (* a b) (/ a b) (mod a b)', '(< a b), (< b a) for a > b, (is a b) for =',
            '(and a b) (or a b) (not a)', 'true/false print as t/nil']],
        ['Notes', ['No join (fe cannot build text), no stop, no lists',
            'Custom blocks see and change globals']]
    ],
    micropython: [
        ['Overview', ['MicroPython for micro:bit v2',
            'from microbit import * (auto-generated)',
            'Generators as cooperative scheduler (yield ms)']],
        ['Verbs', ['display.scroll() — show text on LEDs',
            'print() — serial output',
            'say/think → stage speech (degraded)']],
        ['Pins', ['PIN led = P0 OUTPUT → pin0.write_digital()',
            'ACTIVE LOW inverts on/off',
            'read pin → pin0.read_digital/read_analog()']],
        ['Control', ['Multi-WHEN → generator tasks + round-robin driver',
            'yield ms at every wait/loop back-edge',
            'button_a / button_b (key a/b → micro:bit buttons)']]
    ]
};

// ── CodeMirror 6 editor (lazy-loaded) ──────────────────────────────
// The CM chunk (~600 KB) loads when this tab is first SHOWN — not when it
// mounts. gui.jsx force-renders every TabPanel, so this component mounts on
// every first paint; `isVisible` (the tab is selected) is what gates the
// editor and the example sources. Until then the FallbackEditor textarea
// stands in, so the tab's DOM exists for anything that looks for it.
// Blocks-only users never download either chunk.
const CMEditor = React.lazy(() =>
    import(/* webpackChunkName: "bw-codemirror" */ '../../lib/codemirror-editor.jsx')
);

const MicrotronicSurface = React.lazy(() => import(/* webpackChunkName: "bw-microtronic-surface" */ './microtronic-surface.jsx'));
const Kim1Surface = React.lazy(() => import(/* webpackChunkName: "bw-kim1-surface" */ './kim1-surface.jsx'));

// ── VDU terminal for BBC BASIC graphics (lazy-loaded) ──────────────
const VduTerminal = React.lazy(() =>
    import(/* webpackChunkName: "bw-vdu-terminal" */ './vdu-terminal.jsx')
);

// Fallback while the CM chunk loads — a plain textarea that matches the old editor
// closely enough to prevent layout jump. Also used if CM fails to load.
const FallbackEditor = ({value, onChange, readOnly}) => (
    <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        readOnly={readOnly}
        spellCheck={false}
        style={{
            flex: '1 1 0', minHeight: 0, width: '100%', resize: 'none',
            fontFamily: 'ui-monospace,SFMono-Regular,Menlo,monospace',
            fontSize: 13, lineHeight: '1.5', padding: 12,
            border: '1px solid #cbd5e1', borderRadius: 8,
            boxSizing: 'border-box'
        }}
    />
);

class PseudocodeImporter extends React.Component {
    constructor (props) {
        super(props);
        // One buffer per language tab. Editing the active tab clears the others so
        // switching tabs always re-derives them from the latest edit — you can never
        // end up with (say) pseudocode sitting in the Python tab.
        this.state = {revealed: props.isVisible !== false, lang: 'pseudocode', importedPython: false,
            extraLangs: readExtraLangs(), langMenuOpen: false,
            kim1PartId: typeof window !== 'undefined' && window.__bwMachineExtracted?.kind === 'kim1'
                ? window.__bwMachineExtracted.config.partId : null,
            kim1Active: typeof window !== 'undefined' && window.__bwMachineExtracted?.kind === 'kim1',
            cardiacActive: typeof window !== 'undefined' && window.__bwMachineExtracted?.kind === 'cardiac',
            cp1Active: typeof window !== 'undefined' && window.__bwMachineExtracted?.kind === 'cp1',
            // The Arcade board picker: the boards (null until loaded) and the one chosen.
            arcadeBoards: null, arcadeBoard: '',
            // One empty buffer per tab, from LANG_LABEL (the list of tabs);
            // every buffer reset is built the same way, so no language is
            // ever left without one — a missing buffer made activeCode()
            // undefined and crashed the tab on open.
            buffers: Object.fromEntries(Object.keys(LANG_LABEL).map(l => [l, ''])),
            basicProfile: 'bbc', basicEngine: 'crispbasic', basicLineNumbers: false, basicConnectCircuit: false,
            basicPortableLibrary: false,
            basicFilename: 'editor.bas', basicOutputRunId: 0,
            basicWarnings: [], basicGenerationFailed: false,
            basicInputMethod: null, basicInputValue: '', basicInputError: '', basicDiagnostic: null,
            crispBasicActive: false, basicResetting: false,
            uploads: [], status: '', conversionReport: null, busy: false, showInfo: false, showMatrix: false,
            codeNotices: [], codeNoticeId: 0,
            showArt: false, output: null, running: false, picoSimRunning: false,
            codeSessionRunning: false, codeInput: null, codeInputValue: '', codeRunLabel: '',
            // Hardware-extension codegen options (see reference/runtime-drivers.md): the emitted
            // driver (shim / remote / on-brick), plus async/await and event-hat switches.
            driverMode: 'shim', asyncMode: false, eventsMode: false, jsExecution: 'classic',
            codeDocument: null, codeTarget: null, codeRuntime: null,
            spikeUsbRoute: typeof navigator !== 'undefined' &&
                (/iPad|iPhone|Android/i.test(navigator.userAgent) ||
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) ? 'bridge' : 'direct',
            spikeUsbBridgeUrl: '', spikeUsbBridgeToken: '',
            // The RISC-V C route the user picks: 'browser' (shecc.wasm, a C
            // subset, no server) or 'server' (the hosted service — full C via
            // native gcc+picolibc). Default keeps the no-server path.
            riscvCRoute: 'browser',
            // Set when the browser (subset) compiler rejects a program the full
            // server compiler might still accept — offers a one-click retry.
            riscvCanRetryServer: false,
            // Editor maximize: collapses reference/art panels and hides the right stage pane
            maximized: false,
            // micro:bit debug granularity: 'block' (marker debugger on stock firmware,
            // the lightweight default) or 'line' (settrace line-level on the debug firmware).
            debugLevel: (() => { try { return localStorage.getItem('bw-microbit-debug-level') === 'line' ? 'line' : 'block'; } catch { return 'block'; } })(),
            // ASM tab mode: 'source' = editable author buffer, 'listing' = read-only disassembly
            asmMode: 'source',
            asmDialect: 'auto',
            // ASM listing line map from the compile service (addr/file/line triples).
            // Future current-PC highlight will drive setHighlightedLine via this.
            asmLineMap: null,
            // ASM listing buffer (separate from the editable asm buffer)
            asmListing: '',
            // Catalog examples (examples/index.json — same file the Circuit tab's
            // gallery loads). Fetched once, on demand, when a chip is selected:
            // the "Load example…" control then lists catalog programs for that
            // device instead of the built-in stage games.
            catalog: null, catalogError: null, showCatalog: false, exampleFilter: '', actionsOpen: false,
            bundledExamplesStatus: 'idle'};
        this._cmEditor = null;
        this._codeFileInput = React.createRef();
        // Cache compiled ASM by source hash so tab switching doesn't recompile.
        this._asmCache = {hash: null, asm: '', lineMap: null};
        this.handleFiles = this.handleFiles.bind(this);
        this.openMakeCodeShare = this.openMakeCodeShare.bind(this);
        this.exportMakeCode = this.exportMakeCode.bind(this);
        this.compile = this.compile.bind(this);
        this.fromBlocks = this.fromBlocks.bind(this);
        this.loadExample = this.loadExample.bind(this);
        this._loadBundledExamples = this._loadBundledExamples.bind(this);
        this.run = this.run.bind(this);
        this.submitCodeInput = this.submitCodeInput.bind(this);
        this._onStopCodeRun = () => this.stopCodeRun();
        this.switchTab = this.switchTab.bind(this);
        this.flashMicrobitSim = this.flashMicrobitSim.bind(this);
        this._onMicrobitRunRequest = this._onMicrobitRunRequest.bind(this);
        this.flashMicrobitSimDebug = this.flashMicrobitSimDebug.bind(this);
        this.deployToPico = this.deployToPico.bind(this);
        this.runSpikeUsb = this.runSpikeUsb.bind(this);
        this.deployPicoUf2 = this.deployPicoUf2.bind(this);
        this.flashToBoard = this.flashToBoard.bind(this);
        this.flashStm32ViaSwd = this.flashStm32ViaSwd.bind(this);
        this.flashMicrobitViaSwd = this.flashMicrobitViaSwd.bind(this);
        this.runPseudocodeOn8086 = this.runPseudocodeOn8086.bind(this);
        this.runCOn8086 = this.runCOn8086.bind(this);
        this.runCOnRiscv = this.runCOnRiscv.bind(this);
        this.runSketchOnAvr = this.runSketchOnAvr.bind(this);
        this.runCOnZ80 = this.runCOnZ80.bind(this);
        this.openCodeFile = this.openCodeFile.bind(this);
        this.saveCodeFile = this.saveCodeFile.bind(this);
        this._autosaveTimer = null;
    }

    onHardwareState = () => this.forceUpdate();

    openLibraryCode = event => {
        const program = event.detail;
        if (!program) return;
        const runtime = this.props.vm?.runtime;
        if (runtime?.bwLibraryCode === program) delete runtime.bwLibraryCode;
        this.setState(state => ({
            lang: program.language, libraryProgram: program, libraryTarget: null, status: '', output: null,
            ...(program.dosSourceName ? {basicProfile: 'i8086-ubasic'} : {}),
            cardiacActive: false, cp1Active: false, kim1Active: false, microtronicActive: false,
            buffers: {...state.buffers, [program.language]: program.text,
                pseudocode: `DEVICE ${program.machine}\n${(state.buffers.pseudocode || '').replace(/^DEVICE[^\n]*\n?/im, '')}`}
        }));
    };

    onLibraryMachineSelected = event => {
        const selection = event.detail;
        const runtime = this.props.vm?.runtime;
        if (selection && runtime?.bwLibraryMachineSelection === selection) delete runtime.bwLibraryMachineSelection;
        const kind = selection?.kind;
        const device = kind === 'rp2040js' ? 'pico' : kind;
        if (device !== 'i80386' && !DEVICE_BY_ID[device]) return;
        const picoProfile = picoBasicProfileForDialect(selection.picoBasicConsole);
        this.leaveCardiac();
        this.leaveCp1();
        this.setState(state => ({
            ...(picoProfile && {basicProfile: picoProfile.id}),
            asmRunDevice: null, libraryProgram: null, libraryTarget: device === 'i80386' ? device : null,
            kim1Active: false, microtronicActive: false, langMenuOpen: false,
            buffers: {...state.buffers, pseudocode: (device === 'i80386' ? '' : `DEVICE ${device.toUpperCase()}\n`) +
                (state.buffers.pseudocode || '').replace(/^DEVICE[^\n]*\n?/im, '')}
        }));
    };

    runLibraryProgram = async () => {
        const program = this.state.libraryProgram;
        if (!program || this.state.busy) return;
        const source = this.activeCode();
        this.setState({busy: true, status: ''});
        try {
            if (program.dosSourceName) {
                if (!source.trim()) {
                    this.setState({status: this.L.basicEmpty});
                    return;
                }
                this.setState({status: this.L.basicUbasicRunning});
                await program.run(source);
                if (!this._unmounted) this.setState({status: ''});
                return;
            }
            if (source === program.text) {
                await program.run();
                return;
            }
            if (program.compilerTarget !== 'z80-cpm' || !remoteToolchainsAllowed()) {
                throw new Error('The CP/M compiler is unavailable in this build.');
            }
            this.setState({status: 'Compiling C for CP/M…'});
            const {runCpmCom} = await import('../../lib/bw-machines/run-machine.js');
            const out = await this.hostedCompileC(source, program.compilerTarget, 'bin');
            const bytes = Uint8Array.from(atob(out.base64 || ''), char => char.charCodeAt(0));
            if (out.origin !== 0x100 || !bytes.length || bytes.length > 0xcf00 || bytes.length !== out.bytes) {
                throw new Error('The compiler returned an invalid CP/M image.');
            }
            if (this._unmounted || this.state.libraryProgram !== program || this.state.lang !== program.language) return;
            if (this.activeCode() !== source) {
                this.setState({status: 'The source changed during compilation. Run the updated program.'});
                return;
            }
            await runCpmCom(program.config, bytes);
            this.setState({status: ''});
        } catch (error) {
            if (!this._unmounted) this.setState({status: error.message});
        } finally {
            if (!this._unmounted) this.setState({busy: false});
        }
    };

    runActiveCode = event => {
        if (!this.props.isVisible || this.state.cardiacActive || this.state.cp1Active ||
            this.state.kim1Active || this.state.microtronicActive) return;
        event.detail.editor = 'code';
        if (this.state.lang !== 'basic' && !this.activeCode().trim()) return;
        const {lang, libraryProgram, busy, running} = this.state;
        const device = this.currentDevice();
        if (!this.allowsCodeLanguage(lang)) return;
        const target = asmTargetForDevice(device);
        const actions = {
            tcl: () => target === 'riscv32' ? this.runTclOnRiscv() : this.runTclOnDosInterp(),
            forth: () => target === 'riscv32' ? this.runForthOnRiscv() : this.runForthOnDosInterp(),
            fe: () => target === 'riscv32' ? this.runFeOnRiscv() : this.runFeOnDosInterp(),
            basic: () => this.runBasic(),
            python: () => this.run(),
            javascript: () => this.run(),
            asm: this.state.asmMode === 'source' && (() => this.assembleAndRun()),
            c: libraryProgram ? this.runLibraryProgram : target === 'riscv32' ? () => this.runCOnRiscv()
                : target === 'z80' ? () => this.runCOnZ80()
                    : target === 'i8086' ? () => this.runCOn8086()
                        : sketchBoardFor(this.currentDevice()) ? () => this.runSketchOnAvr() : null
        };
        if (!actions[lang]) return;
        event.preventDefault();
        if (!busy && !running) actions[lang]();
    };

    componentDidMount () {
        window.addEventListener('bw-stop-all', this._onStopCodeRun);
        this.bindCodeStopRuntime();
        this._unmounted = false;
        window.addEventListener('bw-hardware-state', this.onHardwareState);
        window.addEventListener('bw-library-code', this.openLibraryCode);
        window.addEventListener('bw-code-machine-selected', this.onLibraryMachineSelected);
        window.addEventListener('bw-run-active-code', this.runActiveCode);
        this.onLibraryMachineSelected({detail: this.props.vm?.runtime?.bwLibraryMachineSelection});
        this.openLibraryCode({detail: this.props.vm?.runtime?.bwLibraryCode});
        window.addEventListener('bw-read-blocks-into-code', this.fromBlocks);
        this._unregisterCodeMenu = registerEditorMenuActions('code', () => this.codeMenuActions());
        window.addEventListener('bw-microbit-run-request', this._onMicrobitRunRequest);
        window.addEventListener('bw-cp1-source-load', this.selectCp1);
        window.addEventListener('bw-kim1-selection', this.selectKim1);
        window.addEventListener('bw-microtronic-selected', this.selectMicrotronic);
        window.addEventListener('bw-board-ready', this.updateMicrotronicPart);
        this.updateMicrotronicPart();
        window.addEventListener('bw-cardiac-selected', this.selectCardiac);
        window.addEventListener('bw-machine-extracted', this.onCardiacMachineSelection);
        window.addEventListener('bw-cardiac-detached', this.detachCardiac);
        window.addEventListener('bw-cp1-circuit-detached', this.detachCp1);
        // CodeMirror arrives when the tab is first shown (_reveal), not now:
        // every TabPanel is force-rendered, so "mounted" is every first paint.
        // Bundled examples wait for the no-device Tools menu or a real source
        // consumer such as restored-game control discovery.
        if (this.state.revealed) this._reveal();
        // Pick up pseudocode from an example loaded via the Circuit tab.
        // loadExampleProgram stores the source on vm.runtime.bwPseudocodeSource
        // and emits PROJECT_CHANGED; we read it here so the Code tab fills.
        const vm = this.props.vm;
        let consumedParkedSource = false;
        if (vm && vm.runtime) {
            this._onProjectChanged = () => {
                this.invalidateArcadeReport();
                const src = vm.runtime.bwPseudocodeSource;
                if (src) {
                    if (src !== this.state.buffers.pseudocode) {
                        this._publishControlsFor(src);
                        this.setState(this.authoredCodeState('pseudocode', src));
                    }
                    delete vm.runtime.bwPseudocodeSource;
                    return true;
                }
                return false;
            };
            vm.runtime.on('PROJECT_CHANGED', this._onProjectChanged);
            // The lazy host may have consumed the event to activate this
            // component. Read the parked source once after binding so the
            // handoff survives that asynchronous mount boundary.
            consumedParkedSource = this._onProjectChanged();
        }
        // Bring back whatever was in the editor when the tab was last closed.
        // Only when EVERY buffer is empty: an example loaded through the
        // Circuit tab (above) or a restored project must win over the autosave.
        if (!consumedParkedSource && !Object.values(this.state.buffers).some(b => b && b.trim())) {
            const saved = this.readAutosave();
            if (saved) {
                this._publishControlsFor(saved.code);
                const restored = this.codeDocumentState(saved);
                this.setState({
                    ...restored,
                    ...this.restoreStandaloneBasic({...this.state, ...restored}, saved),
                    status: this.L.restored(LANG_LABEL[saved.lang] || saved.lang)
                });
            } else if (this._codeRestoreError) {
                this.setState({status: this._codeRestoreError});
            }
        }
        // If a device is already set (e.g. from a loaded project), fetch the
        // lightweight catalog metadata used to filter the device picker.
        const device = this.currentDevice();
        if (device) {
            this.loadCatalog();
        }
        // Project save/load (lib/bw-project-bundle.js). COLLECT: the autosave
        // is debounced 600 ms, so a save right after typing would carry the
        // buffer minus the last keystrokes — flush synchronously. LOADED: the
        // restored autosave is in localStorage but this mounted editor still
        // shows the old buffer; a loaded PROJECT wins over anything unsaved.
        this._onBundleCollect = event => {
            if (this._autosaveTimer) {
                clearTimeout(this._autosaveTimer);
                this._autosaveTimer = null;
            }
            if (!this.writeAutosave()) {
                event?.detail?.refuseCodeSave?.(this._codeSaveError || this._codeRestoreError ||
                    'Current Code source could not be saved.');
            }
        };
        window.addEventListener('bw-project-bundle-collect', this._onBundleCollect);

        // AN EXAMPLE LOADED FROM THE CIRCUIT TAB'S BROWSER IS STILL AN EXAMPLE.
        // setDevice below already resolves the matching bench and refuses a
        // device the example has no circuit for — but it reads
        // `this._lastCatalogExample`, which only loadCatalogExample sets. So the
        // Examples browser's path left it null and a later device pick skipped
        // the check entirely, retargeting the program while the authored board
        // stayed put. Recording it here makes ONE correct implementation serve
        // both paths rather than growing a second one beside it.
        this._onExampleLoaded = event => {
            const detail = event && event.detail;
            if (detail && detail.id) this._lastCatalogExample = detail;
        };
        window.addEventListener('bw-example-loaded', this._onExampleLoaded);
        // The SPIKE arena's "load reference solution" (spike-arena-pane.jsx):
        // the code replaces the pseudocode buffer and is built into blocks,
        // exactly as loading a gallery example does.
        this._onLoadPseudocode = event => {
            const code = event && event.detail && event.detail.code;
            if (typeof code !== 'string') return;
            // An NQC example (the Robot Lab's RCX models) goes into the NQC buffer as text:
            // the pane compiles and downloads it itself.
            if (event.detail.lang === 'nqc') {
                this.setState({...this.authoredCodeState('nqc', code), output: null, status: ''});
                return;
            }
            this._animationImport = null;
            this._makeCodeRequest = null;
            this._codeArtwork = null;
            this.setState({...this.authoredCodeState('pseudocode', code), output: null, status: ''}, () => {
                const complete = typeof event.detail.onComplete === 'function' ? event.detail.onComplete : () => {};
                Promise.resolve(this.compile({strict: typeof event.detail.onComplete === 'function'}))
                    .then(() => complete({ok: true}), error => {
                        if (!this._unmounted) this.setState({status: error.message});
                        complete({ok: false, message: error.message});
                    });
            });
        };
        window.addEventListener('bw-load-pseudocode', this._onLoadPseudocode);
        // A browser load can land before this component mounts (the Circuit tab
        // is the entry point for a journey). The publisher stashes the last one,
        // so replay it rather than starting blind.
        if (typeof window !== 'undefined' && window.__bwActiveExample) {
            this._lastCatalogExample = window.__bwActiveExample;
        }
        this._onBundleLoaded = event => {
            // A REFUSED sidecar is the case that PRESERVES what was already
            // here, so readAutosave() succeeds precisely when the refusal
            // notice matters most. Computing it after `if (saved)` therefore
            // made the notice unreachable for every learner who had anything
            // to preserve: the buffers came back and nothing said the file had
            // not been applied. Refusal wins the status line; the restore
            // still happens.
            const outcome = event?.detail?.outcome;
            const refused = outcome === 'future' || outcome === 'invalid' ||
                outcome === 'storage-failed';
            // This event follows a successful external project load. A refused
            // sidecar leaves the current authoring transaction untouched.
            if (outcome === 'legacy' || outcome === 'loaded') {
                this._codeArtwork = null;
                this._animationImport = null;
                this._makeCodeRequest = null;
                this.setState({uploads: []});
            }
            // The status line below is the Code tab's own surface, and opening a
            // project changes the active tab — so on its own the notice is
            // written where the learner is no longer looking (measured: the text
            // was present and HIDDEN). Raise it on the app-level alert surface
            // too, which gui.jsx mounts outside the tab strip; the status line
            // stays for anyone who IS on this tab.
            const REFUSAL_ALERTS = ['bwBundleRefusedFuture', 'bwBundleRefusedInvalid',
                'bwBundleRefusedStorage'];
            if (refused && this.props.dispatch) {
                const alertId = outcome === 'future' ? 'bwBundleRefusedFuture' :
                    outcome === 'storage-failed' ? 'bwBundleRefusedStorage' : 'bwBundleRefusedInvalid';
                try { this.props.dispatch(showStandardAlert(alertId)); } catch (e) { /* never break the load */ }
            } else if (this.props.dispatch) {
                // A refusal notice must not outlive the refusal. Each alert's clearList retires
                // the OTHER two, so a second bad file replaces the first notice — but a good load
                // raises nothing and so cleared nothing, and the stale banner then said "what you
                // had is still here" over a project whose surfaces had just been replaced. Seen in
                // the CP6 vanilla-cleared screenshot: empty Code, no widgets, no chip, and a notice
                // claiming everything had been preserved.
                for (const alertId of REFUSAL_ALERTS) {
                    try { this.props.dispatch(closeAlertWithId(alertId)); } catch (e) { /* never break the load */ }
                }
            }
            const refusal = () => {
                const version = event.detail.version ? ` v${event.detail.version}` : '';
                const reason = event.detail.reason || event.detail.report?.action || outcome;
                return `Project blocks loaded; Brickwright state${version} was not applied: ${reason}`;
            };
            if (refused) {
                // A rejected sidecar must preserve the live document, including
                // edits that have not reached the debounced autosave yet.
                this.setState({status: refusal()});
                return;
            }
            const saved = this.readAutosave();
            if (saved) {
                this._publishControlsFor(saved.code);
                const restored = this.codeDocumentState(saved);
                this.setState({
                    ...restored,
                    ...this.restoreStandaloneBasic({...this.state, ...restored}, saved),
                    status: refused
                        ? refusal()
                        : this.L.restored(LANG_LABEL[saved.lang] || saved.lang)
                });
            } else if (outcome === 'legacy' || outcome === 'loaded') {
                this._codeRestoreError = null;
                this.publishGameControls(null);
                this.setState({
                    ...this.codeDocumentState(createCodeDocument()),
                    status: ''
                });
            } else if (refused) {
                this.setState({status: refusal()});
            }
        };
        window.addEventListener('bw-project-bundle-loaded', this._onBundleLoaded);
        // A lazy host can observe a bundle event before this module finishes
        // loading. Replay only that captured detail here; events after mount
        // reach the ordinary listener above exactly once.
        if (this.props.pendingBundleDetail) {
            this._onBundleLoaded({detail: this.props.pendingBundleDetail});
            this.props.onPendingBundleHandled();
        }
        this.props.onReady();
    }

    /**
     * Publish game controls for a source once the example sources it is matched
     * against exist. Publishes null for a non-game, as the synchronous version
     * did, so loading a plain program after a game still clears the controls.
     * @param {string} source - pseudocode
     */
    _publishControlsFor (source) {
        if (!source) return;
        loadExamples().then(() => {
            if (this._unmounted) return;
            this.publishGameControls(this.gameKeyForSource(source));
        }).catch(() => {
            if (!this._unmounted) this.publishGameControls(null);
        });
    }

    /** Load the no-device picker on demand, with retry and stale-request guards. */
    _loadBundledExamples () {
        if (examplesReady) {
            if (!this._unmounted && this.state.bundledExamplesStatus !== 'ready') {
                this.setState({bundledExamplesStatus: 'ready'});
            }
            return Promise.resolve(examples);
        }
        const request = loadExamples();
        this._examplesLoadRequest = request;
        if (this.state.bundledExamplesStatus !== 'loading') {
            this.setState({bundledExamplesStatus: 'loading'});
        }
        return request.then(loaded => {
            if (!this._unmounted && this._examplesLoadRequest === request) {
                this.setState({bundledExamplesStatus: 'ready'});
            }
            return loaded;
        }, () => {
            if (!this._unmounted && this._examplesLoadRequest === request) {
                this.setState({bundledExamplesStatus: 'error'});
            }
            return null;
        });
    }

    /** The tab is (or has been) shown: reveal the editor, not its Tools payload. */
    _reveal () {
        if (this._revealing) return;
        this._revealing = true;
        if (!this.state.revealed) this.setState({revealed: true});
    }

    static getDerivedStateFromProps (props, state) {
        return collectCodeNotices(state, props.isVisible !== false);
    }

    componentDidUpdate (prevProps, prevState) {
        const hardware = this._picoBasicHardware;
        if (hardware && (prevProps.vm !== this.props.vm || this.state.lang !== 'basic' ||
            this.selectedBasicProfile()?.id !== hardware.profile.id)) this.closePicoBasicHardware();
        if ((prevState.lang !== this.state.lang || prevState.libraryTarget !== this.state.libraryTarget ||
            prevState.buffers.pseudocode !== this.state.buffers.pseudocode) &&
            !this.allowsCodeLanguage(this.state.lang)) {
            this.setState({lang: 'pseudocode', output: null, emptyTabOffer: null, langMenuOpen: false});
        }
        if (prevProps.vm !== this.props.vm || prevState.codeTarget !== this.state.codeTarget) {
            this.disposeCodeRun();
            if (this._picoSimRequest || this._picoSimStop) this.stopPicoSim();
        }
        if (prevProps.vm !== this.props.vm) {
            this.bindCodeStopRuntime();
        }
        if (prevProps.vm !== this.props.vm || prevState.lang !== this.state.lang ||
            prevState.buffers[this.state.lang] !== this.state.buffers[this.state.lang]) this.invalidateArcadeReport();
        if (prevProps.isVisible !== this.props.isVisible || prevState.busy !== this.state.busy ||
            prevState.revealed !== this.state.revealed || prevState.buffers !== this.state.buffers ||
            prevState.lang !== this.state.lang || prevState.basicProfile !== this.state.basicProfile ||
            prevState.asmMode !== this.state.asmMode) notifyEditorMenuActions();
        if (prevProps.isVisible !== this.props.isVisible) {
            this.setMaximizedChrome(this.props.isVisible !== false && this.state.maximized);
        }
        if (this.props.isVisible && !this.state.revealed) this._reveal();
        // Tools may have opened while a hardware device was selected. If the
        // user then chooses "none" without closing it, onToggle does not fire
        // again; this transition still has to wake the bundled picker.
        if (this.state.actionsOpen && !this.currentDevice() &&
            this.state.bundledExamplesStatus === 'idle') {
            this._loadBundledExamples();
        }
        // Debounced so a fast typist writes localStorage once per pause, not
        // once per keystroke. Watches the ACTIVE tab, both its language and
        // its text, so switching tabs re-saves under the new language.
        const activeBuffer = this.state.lang === 'basic' ? this.standaloneBasicProfile()?.id || 'basic' : this.state.lang;
        if (prevState.codeDocument !== this.state.codeDocument || prevState.lang !== this.state.lang ||
            prevState.basicProfile !== this.state.basicProfile ||
            prevState.buffers[activeBuffer] !== this.state.buffers[activeBuffer]) {
            if (this._autosaveTimer) clearTimeout(this._autosaveTimer);
            this._autosaveTimer = setTimeout(() => {
                this._autosaveTimer = null;
                this.writeAutosave();
            }, 600);
        }
    }

    readAutosave () {
        try {
            const raw = localStorage.getItem(BW_AUTOSAVE_KEY);
            if (!raw) return null;
            const document = readCodeDocument(JSON.parse(raw));
            this._codeRestoreError = null;
            return document;
        } catch (error) {
            this._codeRestoreError = `Could not restore Code: ${error.message}. The saved source is retained.`;
            return null;
        }
    }

    /**
     * Drafts that live beside the authored document: ASM/NQC and standalone
     * BASIC profile buffers are edited independently, and a machine that hides
     * a language keeps its authored text (hiddenCodeDrafts). A document state
     * rebuilds every view buffer, so carry these across it.
     */
    withRetainedDrafts (next, state, lang = state.lang, target = this.codeDevice()) {
        const own = next.codeDocument && next.codeDocument.lang;
        const independent = {asm: state.buffers.asm ?? '', nqc: state.buffers.nqc ?? '', ...standaloneBasicDrafts(state.buffers)};
        const keep = Object.fromEntries(Object.entries(independent).filter(([key, value]) => key !== own && value));
        return {...next, buffers: {...next.buffers, ...keep,
            ...hiddenCodeDrafts(state.authoredSources, state.buffers, target, lang)}};
    }

    /** A restored document whose generation options name a standalone Pico BASIC profile. */
    restoreStandaloneBasic (state, document) {
        const profile = document.lang === 'basic' && document.generationOptions &&
            document.generationOptions.basicProfile;
        if (!profile) return {};
        const restored = this.restoreCodeBuffer(state, {lang: 'basic', code: document.code, profile});
        return restored.basicProfile ? restored : {};
    }

    restoreCodeBuffer (state, saved) {
        const profile = saved.lang === 'basic' && basicProfilesFor('pico').find(item => item.id === saved.profile && item.standalone);
        if (profile && remoteMachineImagesAllowed()) {
            return {basicProfile: profile.id, libraryTarget: null, buffers: {...state.buffers,
                [profile.id]: saved.code, pseudocode: 'DEVICE PICO\n' +
                    (state.buffers.pseudocode || '').replace(/^DEVICE[^\n]*\n?/im, '')}};
        }
        return {buffers: {...state.buffers, [saved.lang]: saved.code}};
    }

    writeAutosave () {
        // An unreadable/future record is retained until an explicit new edit or
        // source load. Merely opening a tab must not overwrite it with emptiness.
        if (this._codeRestoreError) return false;
        try {
            localStorage.setItem(BW_AUTOSAVE_KEY, serializeCodeDocument(this.codeDocumentSnapshot()));
            this._codeSaveError = null;
            return true;
        } catch (error) {
            this._codeSaveError = `Code remains in the editor, but could not be saved: ${error.message}`;
            if (!this._unmounted) this.setState({status: this._codeSaveError});
            return false;
        }
    }

    /** Which tab owns a filename, preferring the one already open (.py is shared). */
    langForFile (name) {
        const ext = (String(name).match(/\.([^.]+)$/) || [])[1];
        if (!ext) return null;
        const e = ext.toLowerCase();
        if (e === 's') return 'asm';           // gas-style suffix
        if (e === 'lst') return 'asm';
        if (CODE_FILES[this.state.lang] && CODE_FILES[this.state.lang].ext === e) return this.state.lang;
        return Object.keys(CODE_FILES).find(k => CODE_FILES[k].ext === e) || null;
    }

    // Open a source file from disk into the tab that owns its extension. A
    // plain file input rather than showOpenFilePicker: that API is
    // Chromium-only and this has to work in Safari too, which is the same
    // reason deployToPico falls back to downloading main.py.
    openCodeFile (e) {
        const file = (e.target.files || [])[0];
        e.target.value = '';           // so re-opening the same file fires again
        if (!file || this.state.busy) return;
        this.publishGameControls(null);
        this._makeCodeProject = null;
        this._makeCodeImportedCode = null;
        // A compiled artefact from ANOTHER editor — a MakeCode .hex/.uf2/.png
        // cartridge, or a MicroPython .hex — is not source we can read as
        // text, but it is not opaque either: both formats carry the project
        // inside them. That import is its own path.
        if (isImportableArtefact(file.name)) {
            this.openArtefactFile(file);
            return;
        }
        const lang = this.langForFile(file.name);
        if (!lang) {
            this.setState({status: this.L.openBad(file.name)});
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            this._codeRestoreError = null;
            this._codeArtwork = null;
            this._animationImport = null;
            this._makeCodeRequest = null;
            const profile = lang === 'basic' && this.standaloneBasicProfile(lang);
            if (profile) {
                this.setState(st => ({lang, output: null, buffers: {...st.buffers, [profile.id]: String(reader.result)},
                    status: this.L.openDone(file.name, LANG_LABEL[lang])}));
                return;
            }
            this.setState(st => ({
            ...this.codeDocumentState(createCodeDocument({lang, code: String(reader.result)})), uploads: [],
            basicFilename: lang === 'basic' ? file.name : 'editor.bas',
            basicWarnings: [], basicGenerationFailed: false,
            // Same exclusivity the editor's own onChange uses: one authored
            // buffer at a time, so a stale translation of the PREVIOUS source
            // cannot sit in another tab pretending to match.
            asmMode: lang === 'asm' ? 'source' : st.asmMode,
            output: null,
            status: this.L.openDone(file.name, LANG_LABEL[lang] || lang)
            }));
        };
        reader.onerror = () => this.setState({status: this.L.stError(`Could not read ${file.name}`)});
        reader.readAsText(file);
    }

    /**
     * Import a compiled artefact from another editor.
     *
     * Three outcomes, and the status line tells the user which one they
     * got, because the difference matters to what they can do next:
     * a MicroPython hex is a program our simulator RUNS; a MakeCode
     * micro:bit project is source we can read and translate; a MakeCode
     * Arcade game is translated into sprites and opens on the 160x120
     * console surface; unsupported engine features remain explicitly listed.
     *
     * The importer is loaded on demand: it carries an LZMA decoder and a
     * PNG decoder that no other part of the app needs, and nobody should
     * pay for them until they open a .hex.
     */
    /**
     * Hand a compiled AVR program to the Arduboy pane and show it.
     *
     * The pane may not be mounted yet — switching the dock and loading the
     * program are one gesture — so the program is parked on the window for
     * the pane to collect on mount, as well as announced for a pane that
     * is already there.
     */
    runArduboyProgram (hex, label) {
        try {
            window.__bwArduboyPending = {hex, name: label};
            localStorage.setItem('bw-stage-circuit', '1');
            localStorage.setItem('bw-debug-dock', 'arduboy');
            // The right pane must be OPEN, not merely mounted, or the
            // console is in the DOM and invisible — the same trap the
            // controller dock documents.
            localStorage.setItem('bw-right-pane-hidden', '0');
            window.dispatchEvent(new CustomEvent('bw-settings-change', {
                detail: {key: 'bw-right-pane-hidden', value: '0'}
            }));
            window.dispatchEvent(new CustomEvent('bw-settings-change', {
                detail: {key: 'bw-debug-dock', value: 'arduboy'}
            }));
            window.dispatchEvent(new CustomEvent('bw-arduboy-load', {detail: {hex, name: label}}));
            this.setState({status: this.L.arduboyRunning(label)});
        } catch (e) {
            this.setState({status: this.L.mcFailed(label, (e && e.message) || String(e))});
        }
    }

    /**
     * Build a .hex a real micro:bit or Calliope will run, and download it.
     *
     * MicroPython is interpreted, so there is nothing to compile and no
     * server to ask: a flashable image is the RUNTIME with the script
     * appended at 0x3E000. The only thing we do not have is the runtime,
     * and it is 1.8 MB — too big to bundle into an app whose whole first
     * paint is 3.8 MB, and not ours to fetch by name at click time.
     *
     * So it is asked for once and kept for the session. Two ways to
     * supply it, and the second is why this is not a nuisance:
     *
     *   - pick a MicroPython .hex (python.microbit.org, uflash, or the
     *     one that came with the board), or
     *   - simply IMPORT one first — a downloaded MicroPython hex is
     *     runtime + script, so opening one to read its Python already
     *     hands us the runtime, and this button then needs nothing.
     */
    async downloadMicrobitHex () {
        const script = this.state.buffers.micropython || '';
        if (!script.trim()) {
            this.setState({status: this.L.mcExportEmpty});
            return;
        }
        let firmware = this._microbitFirmwareHex;
        if (!firmware) {
            firmware = await this._askForFirmware();
            if (!firmware) return;                 // cancelled; status already set
            this._microbitFirmwareHex = firmware;
        }
        try {
            const {appendScript} = await import(
                /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/micropython-hex.js');
            const hex = appendScript(firmware, script);
            const name = `${(this.currentStc()?.device || 'microbit').toLowerCase()}-program.hex`;
            this._download(name, hex, 'application/octet-stream');
            this.setState({status: this.L.microbitHexReady(name)});
        } catch (e) {
            this.setState({status: this.L.mcFailed('hex', (e && e.message) || String(e))});
        }
    }

    /**
     * ⬇ flash the micro:bit — write the program straight to the micro:bit V2's
     * nRF52833 over CMSIS-DAP / WebUSB (N9), the same open probe path
     * flashStm32ViaSwd takes for the STM32. Beside the .hex download; the button
     * shows only where WebUSB exists, and the handler refuses by name when no
     * probe is granted.
     */
    async flashMicrobitViaSwd () {
        const script = this.state.buffers.micropython || '';
        if (!script.trim()) { this.setState({status: this.L.mcExportEmpty}); return; }
        if (typeof navigator === 'undefined' || !navigator.usb) {
            this.setState({status: this.L.flashNoWebUsb});
            return;
        }
        // Ask for the board first: there is no point prompting for a 600 KB
        // firmware file if no probe is ever granted. A cancelled/empty picker
        // rejects here and is reported by name, exactly as the WebSerial ports
        // are — this is the path the browser gate drives (it grants nothing).
        let device;
        try {
            this.setState({status: this.L.microbitFlashPick});
            device = await navigator.usb.requestDevice({filters: [{vendorId: 0x0d28}]});
        } catch (e) {
            this.setState({status: this.L.flashNoPort});
            return;
        }
        let firmware = this._microbitFirmwareHex;
        if (!firmware) {
            firmware = await this._askForFirmware();
            if (!firmware) return;                 // cancelled; status already set
            this._microbitFirmwareHex = firmware;
        }
        this.setState({busy: true, status: this.L.microbitFlashPrep});
        try {
            const {appendScript} = await import(
                /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/micropython-hex.js');
            const hex = appendScript(firmware, script);
            const flasher = await import(/* webpackChunkName: "bw-flasher" */ '../../lib/flasher.js');
            this.setState({status: this.L.microbitFlashing});
            const done = await flasher.flashDaplinkMicrobit(device, hex, {log: () => {}});
            this.setState({busy: false, status: this.L.microbitFlashDone(done.bytes)});
        } catch (e) {
            this.setState({busy: false, status: this.L.flashFail(e && e.message ? e.message : String(e))});
        }
    }

    /** One file prompt for the MicroPython runtime. Resolves null if cancelled. */
    _askForFirmware () {
        return new Promise(resolve => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.hex';
            input.onchange = () => {
                const file = input.files && input.files[0];
                if (!file) { resolve(null); return; }
                const reader = new FileReader();
                reader.onload = () => {
                    const text = String(reader.result || '');
                    // Refuse anything that is not a hex here rather than
                    // letting appendScript emit a file the board rejects.
                    if (!/^\s*:[0-9A-Fa-f]{8}/.test(text)) {
                        this.setState({status: this.L.microbitFirmwareBad(file.name)});
                        resolve(null);
                        return;
                    }
                    resolve(text);
                };
                reader.onerror = () => resolve(null);
                reader.readAsText(file);
            };
            // A cancelled picker fires no event at all, so nothing is
            // pending afterwards — the promise simply never settles, which
            // is correct: no download, no status change, no error.
            input.click();
            this.setState({status: this.L.microbitNeedFirmware});
        });
    }

    /** Hand the browser a file. */
    _download (name, text, type) {
        return downloadBlob(name, new Blob([text], {type: type || 'text/plain'}));
    }

    /**
     * WHICH DEVICE THE ASM TAB IS WRITING FOR.
     *
     * This used to read `currentStc().device` alone, and that is only ever
     * populated by a COMPILE — so a device the user had just chosen from the
     * picker did not reach this tab until they had also compiled something,
     * and for the 8086 (no blocks path, so nothing to compile) it would never
     * have arrived at all. The DEVICE line in the pseudocode buffer is what
     * `setDevice` writes immediately, so it is asked first; `stc.device` is
     * the fallback for a project that arrived without one (an imported .sb3,
     * a machine-class example), and the runtime's published id/core after
     * that, which is how a CPU seated on the circuit board reaches here.
     *
     * One resolution, used by BOTH the example list and the ▶ button: two
     * different answers in one tab is how a program gets assembled for a
     * device the examples were not written for.
     */
    _asmDevice () {
        const stc = this.currentStc();
        const rt = this.props.vm && this.props.vm.runtime;
        return this.state.asmRunDevice || this.currentDevice() ||
            (stc && stc.device) ||
            (rt && (rt.bwDeviceId || rt.bwDeviceCore)) || '';
    }

    /** Starter programs for the selected device, or none. */
    _asmExamples () {
        const examples = asmExamplesFor(this._asmDevice());
        return [{id: 'blink0', label: 'Blink 0', labelDe: 'LED 0 blinken'}, ...examples];
    }

    /**
     * The attribution the shipped examples travel under, or null when the
     * current device's examples were written here.
     *
     * Rendered beside the picker rather than kept in a notices file: MIT asks
     * for the notice to accompany the code, and a learner who never opens
     * THIRD-PARTY-NOTICES.md has still been shown who wrote the program they
     * are reading.
     */
    _asmCredit () {
        const ex = this._asmExamples().find(e => e.attribution);
        return ex ? ex.attribution : null;
    }

    /**
     * Load a starter program into the ASM editor.
     *
     * It replaces the buffer rather than appending, and asks first when
     * there is work there — an example that silently eats what someone
     * typed is worse than no example.
     */
    async loadAsmExample (id) {
        if (!id) return;
        const example = this._asmExamples().find(e => e.id === id);
        if (!example) return;
        const current = (this.state.buffers.asm || '').trim();
        if (current && !(await confirmAsync(this.L.asmExampleReplace))) return;
        const family = example.source ? blinkFamily(example.source) : null;
        const source = id === 'blink0' ? blinkStarter : family ? blinkSource(family) : example.source;
        // When ASM is the authored program, an example replaces that program (and
        // drops projections that described the old one). Beside a document in
        // another language, ASM is an independent draft and only the draft changes.
        const document = this.state.codeDocument;
        this.setState({
            ...(document && document.lang !== 'asm' ? {buffers: {...this.state.buffers, asm: source}} :
                this.authoredCodeState('asm', source, this.currentDevice())),
            asmMode: 'source',
            status: this.L.asmExampleLoaded(
                pickLocale(this.props.locale) === 'de' ? example.labelDe : example.label)
        });
    }

    makeCodeImportModule () {
        return import(/* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/index.js');
    }

    currentMakeCodeRequest (request) {
        return !!request && !this._unmounted && this._makeCodeRequest === request &&
            this.props.vm.runtime.getTargetForStage() === request.stage;
    }

    openArtefactFile (file) {
        if (this._unmounted) return;
        const request = this._makeCodeRequest = {stage:this.props.vm.runtime.getTargetForStage()};
        this.setState({status:this.L.mcReading(file.name)});
        const reader = new FileReader();
        reader.onload = async () => {
            if (!this.currentMakeCodeRequest(request)) return;
            let res;
            try {
                const module = await this.makeCodeImportModule();
                if (!this.currentMakeCodeRequest(request)) return;
                res = await module.importArtefact(new Uint8Array(reader.result),
                    {name:file.name,animationResources:true,prepareDependencies:true});
            } catch (err) {
                if (!this.currentMakeCodeRequest(request)) return;
                this.setState({status:err && err.code === 'NO_EMBEDDED_SOURCE' ?
                    this.L.mcNoSource(file.name,err.format) :
                    this.L.mcFailed(file.name,(err && err.message) || String(err))});
                return;
            }
            if (!this.currentMakeCodeRequest(request)) return;
            if (res && res.kind === 'micropython') {
                try {this._microbitFirmwareHex = new TextDecoder().decode(new Uint8Array(reader.result));}
                catch (error) { /* The flash button can ask for non-text firmware. */ }
            }
            this.applyMakeCodeImport(res,file.name);
        };
        reader.onerror = () => {
            if (this.currentMakeCodeRequest(request)) this.setState({status:this.L.mcFailed(file.name,'read error')});
        };
        reader.readAsArrayBuffer(file);
    }

    /**
     * Land an imported MakeCode project in the editor.
     *
     * Shared by the file importer and the share-link importer, because a
     * project is a project however it arrived — and because the status
     * line has to say which of three things happened, which is exactly
     * the part worth having in one place.
     */
    applyMakeCodeImport (res, label) {
        // Whatever arrived, the previous project's touch controls are gone.
        this.publishGameControls(null);

        // An AVR hex is not a project to translate — it is a program to
        // RUN. Nothing in it can become blocks (it is compiled C++), so it
        // goes straight to the console pane rather than through any of the
        // machinery below.
        if (res.kind === 'avr-hex') {
            this.runArduboyProgram(res.hex, label);
            return;
        }
        this._codeArtwork = null;
        this._animationImport = null;
        this._makeCodeRequest = null;

        // What the "MakeCode source" download hands back: the recovered
        // files themselves, untouched by any translation.
        this._makeCodeProject = res.kind === 'makecode' ? {
            files: res.files,
            name: res.project.name || String(label).replace(/\.[^.]+$/, ''),
            target: res.project.target,
            dependencyInputs: res.dependencyInputs || null
        } : null;
        // F10: the translation as it arrived. A build of exactly this code keeps
        // the original files in the project (bw-makecode-original.js); an edited
        // one does not, since the files would describe a different program.
        this._makeCodeImportedCode = res.kind === 'makecode' && res.lang === 'pseudocode' ? res.code : null;
        const unsupported = (res.unsupported || []).length;
        const arcade = res.project.target === 'arcade';
        if (arcade && res.kind === 'makecode') this.loadArcadeBoards();
        let status;
        if (res.kind === 'micropython') {
            status = this.L.mcPython(label, Object.keys(res.files).join(', '));
        } else if (arcade) {
            // The button's own label, not a copy of it: a glyph typed here
            // drifts the moment the button changes — and this call went out
            // one argument short, which is how "Press undefined to build"
            // reached a green build.
            status = this.L.mcArcade(label, res.project.name,
                (res.sprites || []).length, (res.costumes || []).length, this.L.toBlocks);
        } else {
            status = unsupported ?
                this.L.mcPartial(label, res.project.name, unsupported) :
                res.note === 'ev3' ? this.L.mcEv3(label, res.project.name) :
                    res.note === 'adafruit' ? this.L.mcCpx(label, res.project.name) :
                    this.L.mcMicrobit(label, res.project.name);
        }
        this._animationImport = res.animationResources?.length ?
            {resources: res.animationResources, stage: this.props.vm.runtime.getTargetForStage()} : null;
        if (res.warnings?.length) status += ` · ${res.warnings.join(' · ')}`;
        if (res.dependencyMessages?.length) status += ` · ${res.dependencyMessages.join(' · ')}`;
        this.setState({
            ...this.authoredCodeState(res.lang, res.code, res.project.target),
            importedPython: res.kind === 'micropython',
            // Same exclusivity openCodeFile keeps: one authored buffer, so
            // no stale translation of a previous source can masquerade.
            // The game's artwork rides the same route as an SVG the user
            // drops in themselves: compile() applies `uploads` to the
            // sprites it just parsed, so the costumes land with the code.
            uploads: (res.costumes || []).map(costume => ({
                sprite: costume.sprite,
                filename: `${costume.name}.svg`,
                svg: costume.svg,
                mode: costume.mode || 'replace',
                costumeName: costume.name
            })),
            output: null,
            status
        });
    }

    /**
     * Import from a MakeCode share link — the same project, without the
     * binary. Needs the network, which is why it sits BESIDE the file
     * importer rather than replacing it: the packaged app and a school
     * laptop with no internet still have the .hex.
     */
    async openMakeCodeShare () {
        if (this._unmounted) return;
        // The prompt is asynchronous too: reserve this intent against the
        // current stage before another file/share action can supersede it.
        const request = this._makeCodeRequest = {stage: this.props.vm.runtime.getTargetForStage()};
        const current = () => !this._unmounted && this._makeCodeRequest === request &&
            this.props.vm.runtime.getTargetForStage() === request.stage;
        let shown = '';
        try {
            const url = await promptAsync(this.L.mcSharePrompt, '');
            if (!current()) return;
            if (!url || !url.trim()) {
                this._makeCodeRequest = null;
                return;
            }
            shown = url.trim();
            this.setState({status: this.L.mcShareLoading});
            // The component's shared loader keeps one chunk; a bare receiver
            // loads the same chunk directly.
            const module = this.makeCodeImportModule ? await this.makeCodeImportModule() : await import(
                /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/index.js');
            if (!current()) return;
            const res = await module.importShareLink(shown, {animationResources: true, prepareDependencies: true});
            if (!current()) return;
            this.applyMakeCodeImport(res, res.project.name || shown);
        } catch (err) {
            if (current()) this.setState({status: this.L.mcFailed(shown || this.L.mcSharePrompt, (err && err.message) || String(err))});
        }
    }

    /** Save the single-board program for its own MakeCode editor. */
    async exportMakeCode () {
        const source = this.state.buffers.pseudocode || '';
        if (!source.trim()) { this.setState({status: this.L.mcExportEmpty}); return; }
        if (this.hasBoards(source)) { await this.exportBoardsMakeCode(source); return; }
        const target = this.currentDevice();
        this.setState({busy: true});
        try {
            const SB3Creator = (await this.lib()).default;
            const creator = new SB3Creator();
            const project = creator.parse(source);
            const {exportToMakeCode, exportToMakeCodeCalliope, exportToMakeCodeEv3, makeCodeProjectFile} = await import(
                /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/index.js');
            const exporter = {microbit: exportToMakeCode, calliopemini: exportToMakeCodeCalliope,
                ev3: exportToMakeCodeEv3}[target];
            if (!exporter) throw new Error(`MakeCode export is not available for ${target || 'this device'}.`);
            const name = (source.match(/^#\s*(.+)$/m) || [])[1] || 'brickwright';
            const original = this.makeCodeOriginalStatus();
            // F10: unchanged imported projects retain their own target's files.
            const keepOriginal = original.status === 'current' && original.target === target;
            const exportName = String(keepOriginal && original.name || name).trim().slice(0, 40);
            const out = keepOriginal ? {files: original.files, unsupported: []} : exporter(project, {name: exportName});
            const basename = keepOriginal ? exportName : String(exportName).replace(/[^A-Za-z0-9_-]+/g, '-').toLowerCase() || 'project';
            const filename = `${basename}.mkcd`;
            await downloadBlob(filename, new Blob([makeCodeProjectFile(out.files, {name: exportName, target})],
                {type: 'application/octet-stream'}));
            this.setState({busy: false, status: this.L.mcExportDone(filename, out.unsupported.length, MAKECODE_EDITOR[target])});
        } catch (err) {
            this.setState({busy: false, status: this.L.mcFailed('MakeCode export', (err && err.message) || String(err))});
        }
    }

    /** What `Save` would call this tab's file. */
    saveFileName () {
        const lang = this.state.lang;
        if (lang === 'asm' && this.state.asmMode === 'listing') return 'program.lst';
        const f = CODE_FILES[lang] || CODE_FILES.pseudocode;
        // The pseudocode names itself after its target, which is the one piece
        // of identity a .bw always carries.
        const dev = lang === 'pseudocode' &&
            (this.state.buffers.pseudocode || '').match(/^DEVICE\s+([\w-]+)/im);
        return `${(dev ? dev[1].toLowerCase() : f.base)}.${f.ext}`;
    }

    canCompileToBlocks () {
        return !this.state.busy && (this.state.lang !== 'basic' || !this.standaloneBasicProfile()) && !!this.activeCode().trim() &&
            (TWO_WAY.has(this.state.lang) || this.canLiftAsm());
    }

    codeMenuActions () {
        if (this._unmounted || !this.props.isVisible || !this.state.revealed) return null;
        return {
            open: {label:'Open code file…',location:'file',
                enabled: !this.state.busy && !!this._codeFileInput.current,
                run: () => this._codeFileInput.current.click()
            },
            // Match the toolbar: saving a snapshot is allowed while compiling.
            save: {label:'Save code as…',location:'file',enabled: true, run: this.saveCodeFile},
            'to-blocks': {label:'Convert code to blocks',location:'edit',enabled: this.canCompileToBlocks(), run: this.compile},
            'from-blocks': {label:'Generate code from blocks',location:'edit',enabled: !this.state.busy && (this.state.lang !== 'basic' || !this.standaloneBasicProfile()), run: this.fromBlocks}
        };
    }

    // Save the code ITSELF, comments and all. The .sb3 round-trip preserves a
    // program but not a single comment — blocks carry no file-level text — so
    // a documented source can only survive as its own file.
    saveCodeFile () {
        const code = this.activeCode() || '';
        if (!code.trim()) { this.setState({status: this.L.saveEmpty}); return; }
        const name = this.saveFileName();
        const mime = (CODE_FILES[this.state.lang] || CODE_FILES.pseudocode).mime;
        return downloadBlob(name, new Blob([code], {type: mime}));
    }

    /**
     * The MakeCode project the ▶/⤓ actions work on: the imported one, exactly
     * as MakeCode wrote it — or, on a micro:bit, this tab's blocks exported to
     * MakeCode TypeScript (export.js, the same files ⬆ To MakeCode saves).
     */
    /**
     * F10: the imported MakeCode original the loaded project carries, and
     * whether it still describes the program ('current' | 'stale' |
     * 'unsettled' | 'none'; files only when current).
     */
    makeCodeOriginalStatus () {
        const vm = this.props.vm;
        if (!vm || !vm.runtime || !vm.runtime.bwMakeCode) return {status: 'none'};
        try {
            return makeCodeOriginal.original(JSON.parse(vm.toJSON()));
        } catch (e) {
            return {status: 'none'};
        }
    }

    async makeCodeSubject () {
        const original = this.makeCodeOriginalStatus();
        const imported = this._makeCodeProject;
        // A fresh import in this tab is the subject, unless it is the very import
        // the loaded project was built from and the program has changed since.
        const builtFromImport = imported && original.target === imported.target && original.name === imported.name;
        if (imported && imported.files && !(builtFromImport && original.status === 'stale')) return imported;
        if (original.status === 'current') return {files: original.files, name: original.name, target: original.target};
        const source = this.state.buffers.pseudocode || '';
        if (!['microbit', 'calliopemini'].includes(this.currentDevice()) || !source.trim()) return null;
        const SB3Creator = (await this.lib()).default;
        const project = new SB3Creator().parse(source);
        const {exportToMakeCode} = await import(
            /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/index.js');
        const name = ((source.match(/^#\s*(.+)$/m) || [])[1] || 'brickwright').trim().slice(0, 40);
        const files = exportToMakeCode(project, {name}).files;
        if (this.currentDevice() === 'calliopemini') {
            // The Calliope's API is the micro:bit's for everything the export
            // writes; its firmware base is for MakeCode's Calliope default set.
            const cfg = JSON.parse(files['pxt.json']);
            cfg.dependencies = {core: '*', radio: '*'};
            return {files: {...files, 'pxt.json': `${JSON.stringify(cfg, null, 4)}\n`}, name, target: 'calliopemini'};
        }
        return {files, name, target: 'microbit'};
    }

    /**
     * Whether to offer ▶ Run in MakeCode for `target`: not when this build
     * does not serve that target's runtime (made without npm run
     * sync:makecode) — the button could only fail. Unknown until the probe
     * answers (one HEAD request, cached), and offered meanwhile.
     */
    makeCodeRunOffered (target) {
        const known = (this.state.mcRuntime || {})[target];
        if (known === undefined) {
            this._mcProbes = this._mcProbes || new Set();
            if (!this._mcProbes.has(target)) {
                this._mcProbes.add(target);
                // A HEAD request for the file the compiler loads first (served
                // under static/makecode/<target>/ by sync:makecode), made here
                // rather than through pxt-runtime.js so that showing a button
                // never loads the compiler's chunk.
                fetch(`static/makecode/${target}/target.json`, {method: 'HEAD'})
                    .then(r => r.ok, () => false)
                    .then(ok => { if (!this._unmounted) this.setState(st => ({mcRuntime: {...st.mcRuntime, [target]: ok}})); });
            }
            return true;
        }
        return known;
    }

    /** A MakeCode failure in words: the runtime, the firmware base, or the program. */
    makeCodeFailure (err, target) {
        const code = err && err.code;
        if (code === 'NO_RUNTIME' || /target\.json: HTTP 404/.test(String(err && err.message))) return this.L.mcNoRuntime;
        if (code === 'NO_BASE_HEX') return this.L.mcNoBase(MAKECODE_EDITOR[target] || MAKECODE_EDITOR.microbit);
        if (code === 'UNSUPPORTED_TARGET') return err.message;
        return this.L.mcFailed('MakeCode', (err && err.message) || String(err));
    }

    /**
     * Compile with MakeCode's own compiler and run in MakeCode's simulator
     * (lib/bw-makecode/pxt-runtime.js, makecode-sim-pane.jsx). The pane may not
     * be mounted yet, so the program is parked on the window as well as
     * announced — the Arduboy console's contract.
     */
    /** Name the extensions a compile fetched on demand (pxt-runtime.js fetchedExtensions), with their licences. */
    fetchedNote (out) {
        const list = (out && out.fetchedExtensions) || [];
        if (!list.length) return '';
        return this.L.mcFetched(list.map(e => `${e.id} (${e.repo}${e.ref ? '#' + e.ref : ''}, ${e.licence || this.L.mcLicenceUnknown})`).join(', '));
    }
    /**
     * Several boards in one program (`DEVICE <id> AS <Name>:` sections): every
     * board is compiled for its own MakeCode target and the whole set goes to
     * the simulator pane, which frames one simulator per board and relays radio
     * between them. All boards or none: a pair with one half missing would
     * look like a broken radio.
     */
    /** Whether a program holds several boards (`DEVICE <id> AS <Name>:` sections). */
    hasBoards (source) {
        return /^DEVICE\s+[\w-]+\s+AS\s+\S/im.test(source || '');
    }

    /**
     * The boards of a multi-board program as MakeCode projects, one per board:
     * `[{name, device, target, files}]` (lib/bw-boards/makecode-boards.js).
     * Throws NOT_MAKECODE_BOARD, naming the board, when one is not a MakeCode board.
     */
    async boardSubjects (source) {
        const SB3Creator = (await this.lib()).default;
        const project = new SB3Creator().parse(source);
        const {exportToMakeCode} = await import(
            /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/index.js');
        const {boardMakeCodeProjects} = await import(
            /* webpackChunkName: "bw-makecode" */ '../../lib/bw-boards/makecode-boards.js');
        const name = ((source.match(/^#\s*(.+)$/m) || [])[1] || 'brickwright').trim().slice(0, 40);
        return {name, subjects: boardMakeCodeProjects(project, {exportToMakeCode, name})};
    }

    /** The status line for a failed multi-board MakeCode action. */
    boardsFailure (err) {
        return err && err.code === 'NOT_MAKECODE_BOARD' ?
            this.L.mcBoardNotMakeCode(err.board, err.device) :
            this.L.mcFailed('MakeCode', (err && err.message) || String(err));
    }

    /**
     * Several boards, several firmware files: each board is built for its own
     * target and saved under its own name. All boards are built before any file
     * is saved, so a failing board leaves no half set to flash.
     */
    async downloadBoardsFirmware (source) {
        this.setState({busy: true, status: this.L.mcBoardsFirmwareBuilding((source.match(/^DEVICE\s+[\w-]+\s+AS\s+/gim) || []).length)});
        try {
            const {name, subjects} = await this.boardSubjects(source);
            const {compileMakeCode, firmwareFile} = await import(
                /* webpackChunkName: "bw-makecode-pxt" */ '../../lib/bw-makecode/pxt-runtime.js');
            const slug = t => String(t).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
            const built = [];
            for (const subject of subjects) {
                const ext = MAKECODE_FIRMWARE[subject.target];
                const title = `${name} — ${subject.name}`;
                const out = await compileMakeCode({target: subject.target, files: subject.files, native: true, hwVariant: '',
                    embedSource: {files: subject.files, name: title, editorUrl: MAKECODE_EDITOR[subject.target]}});
                const fw = out.success ? firmwareFile({[`binary.${ext}`]: out.outfiles[`binary.${ext}`]}) : null;
                if (!fw) {
                    const d = out.diagnostics[0];
                    this.setState({busy: false, status: this.L.mcBoardCompileErrors(subject.name, out.diagnostics.length,
                        (d && `${d.file}:${d.line + 1} ${d.message}`) || '')});
                    return;
                }
                built.push({filename: `${[subject.target, slug(name) || 'program', slug(subject.name) || 'board'].join('-')}.${ext}`, bytes: fw.bytes});
            }
            for (const file of built) {
                await downloadBlob(file.filename, new Blob([file.bytes], {type: 'application/octet-stream'}));
            }
            this.setState({busy: false, status: this.L.mcBoardsFirmwareDone(built.map(f => f.filename))});
        } catch (err) {
            this.setState({busy: false, status: this.boardsFailure(err)});
        }
    }

    /** Several boards, several MakeCode projects: one .mkcd per board, for its own editor. */
    async exportBoardsMakeCode (source) {
        this.setState({busy: true});
        try {
            const {name, subjects} = await this.boardSubjects(source);
            const {makeCodeProjectFile} = await import(
                /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/index.js');
            const slug = t => String(t).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
            const saved = [];
            for (const subject of subjects) {
                const filename = `${[slug(name) || 'program', slug(subject.name) || 'board'].join('-')}.mkcd`;
                await downloadBlob(filename, new Blob([makeCodeProjectFile(subject.files,
                    {name: `${name} — ${subject.name}`.slice(0, 40), target: subject.target})], {type: 'application/octet-stream'}));
                saved.push(filename);
            }
            this.setState({busy: false, status: this.L.mcBoardsExportDone(saved)});
        } catch (err) {
            this.setState({busy: false, status: this.boardsFailure(err)});
        }
    }

    async runBoardsInMakeCode (source) {
        this.setState({busy: true, status: this.L.mcBoardsCompiling((source.match(/^DEVICE\s+[\w-]+\s+AS\s+/gim) || []).length)});
        try {
            const {name, subjects} = await this.boardSubjects(source);
            const {compileMakeCode} = await import(
                /* webpackChunkName: "bw-makecode-pxt" */ '../../lib/bw-makecode/pxt-runtime.js');
            const boards = [];
            for (const subject of subjects) {
                const out = await compileMakeCode({target: subject.target, files: subject.files});
                if (!out.success) {
                    const d = out.diagnostics[0];
                    this.setState({busy: false, status: this.L.mcBoardCompileErrors(subject.name, out.diagnostics.length,
                        (d && `${d.file}:${d.line + 1} ${d.message}`) || '')});
                    return;
                }
                boards.push({name: subject.name, target: subject.target, js: out.outfiles['binary.js']});
            }
            const program = {boards, name};
            window.__bwMakeCodePending = program;
            localStorage.setItem('bw-stage-circuit', '1');
            localStorage.setItem('bw-debug-dock', 'makecode');
            localStorage.setItem('bw-right-pane-hidden', '0');
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-debug-dock', value: 'makecode'}}));
            window.dispatchEvent(new CustomEvent('bw-makecode-load', {detail: program}));
            this.setState({busy: false, status: this.L.mcBoardsStarted(boards.map(b => b.name))});
        } catch (err) {
            this.setState({busy: false, status: this.boardsFailure(err)});
        }
    }

    async runInMakeCode () {
        const boardSource = this.state.buffers.pseudocode || '';
        if (this.hasBoards(boardSource)) { await this.runBoardsInMakeCode(boardSource); return; }
        const subject = await this.makeCodeSubject().catch(() => null);
        if (!subject) { this.setState({status: this.L.mcNothingToRun}); return; }
        const target = subject.target;
        this.setState({busy: true, status: this.L.mcRunCompiling(subject.name)});
        try {
            const {compileMakeCode} = await import(
                /* webpackChunkName: "bw-makecode-pxt" */ '../../lib/bw-makecode/pxt-runtime.js');
            const out = await compileMakeCode({target, files: subject.files});
            if (!out.success) {
                const first = (out.diagnostics[0] && `${out.diagnostics[0].file}:${out.diagnostics[0].line + 1} ${out.diagnostics[0].message}`) || '';
                this.setState({busy: false, status: this.L.mcCompileErrors(out.diagnostics.length, first)});
                return;
            }
            const program = {target, js: out.outfiles['binary.js'], name: subject.name};
            window.__bwMakeCodePending = program;
            localStorage.setItem('bw-stage-circuit', '1');
            localStorage.setItem('bw-debug-dock', 'makecode');
            localStorage.setItem('bw-right-pane-hidden', '0');
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-debug-dock', value: 'makecode'}}));
            window.dispatchEvent(new CustomEvent('bw-makecode-load', {detail: program}));
            this.setState({busy: false, status: this.L.mcRunStarted(subject.name, target) + this.fetchedNote(out)});
        } catch (err) {
            this.setState({busy: false, status: err && err.code === 'UNSUPPORTED_TARGET' ?
                this.L.mcUnsupportedTarget(target) : this.makeCodeFailure(err, target)});
        }
    }

    /**
     * ▶ Run on the emulated micro:bit V2 (task A8): MakeCode's own compiler links
     * the program onto a Bluetooth-free base (compileMakeCodeForEmulator — never
     * the official base, whose Nordic SoftDevice the emulator does not run), and
     * the image goes to the Debug pane on LabWired's micro:bit V2 board, through
     * the same firmware hand-off a compiled sketch takes. The engine loads an
     * ELF, so the plain V2 .hex becomes one where its records say (vector table at 0).
     */
    async runOnEmulatedMicrobit () {
        const subject = await this.makeCodeSubject().catch(() => null);
        if (!subject || subject.target !== 'microbit') { this.setState({status: this.L.mcNothingToRun}); return; }
        this.setState({busy: true, status: this.L.mcEmulateBuilding(subject.name)});
        try {
            const {compileMakeCodeForEmulator, firmwareFile} = await import(
                /* webpackChunkName: "bw-makecode-pxt" */ '../../lib/bw-makecode/pxt-runtime.js');
            const out = await compileMakeCodeForEmulator({target: 'microbit', files: subject.files});
            const fw = out.success ? firmwareFile({'binary.hex': out.outfiles['binary.hex']}) : null;
            if (!out.success || !fw) {
                const first = (out.diagnostics[0] && `${out.diagnostics[0].file}:${out.diagnostics[0].line + 1} ${out.diagnostics[0].message}`) || '';
                this.setState({busy: false, status: out.success ? this.L.mcEmulateNoBases : this.L.mcCompileErrors(out.diagnostics.length, first)});
                return;
            }
            const [{hexToSegments}, {binToElf}] = await Promise.all([
                import(/* webpackChunkName: "labwired-catalog" */ 'bw-board/hex-app-region.js'),
                import(/* webpackChunkName: "labwired-catalog" */ 'bw-board/bin-to-elf.js')]);
            const [first, ...rest] = hexToSegments(new TextDecoder().decode(fw.bytes));
            if (!first || first.addr !== 0) throw new Error('the emulator image has no vector table at 0');
            const elf = binToElf(first.data, {loadAddress: 0, extraSegments: rest.map(r => ({address: r.addr, bytes: r.data}))});
            const slug = String(subject.name).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'program';
            const detail = {format: 'firmware', kind: 'labwired', labwiredChip: 'board:microbit-v2', target: 'microbit',
                firmware: {name: `${slug}-microbit-v2-emu.elf`, bytes: elf, text: null, fCpu: null},
                rom: null, image: null, listing: null};
            // The Debug pane must be on screen to receive the image: a 'top' or
            // device dock, or a hidden stage circuit, leaves it in the Circuit tab.
            showDebuggerOnStage({storage: localStorage, dispatch: (key, value) =>
                window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key, value}}))});
            window.__bwPendingMedia = {type: 'asm', detail};
            window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
            this.setState({busy: false, status: this.L.mcEmulateStarted(subject.name) + this.fetchedNote(out)});
        } catch (err) {
            if (err && err.code === 'NO_BASE_HEX') { this.setState({busy: false, status: this.L.mcEmulateNoBases}); return; }
            if (err && /BASE$/.test(String(err.code || ''))) { this.setState({busy: false, status: this.L.mcEmulateRefused(err.message)}); return; }
            this.setState({busy: false, status: this.makeCodeFailure(err, 'microbit')});
        }
    }

    /**
     * The Arcade boards the firmware download can build for: pxt-arcade's own
     * list, as the sync served it (pxt-runtime.js arcadeBoards). Loaded once,
     * when an Arcade project arrives; absent runtime, an empty list.
     */
    async loadArcadeBoards () {
        if (this.state.arcadeBoards && this.state.arcadeBoards.length) return;
        const {arcadeBoards} = await import(
            /* webpackChunkName: "bw-makecode-pxt" */ '../../lib/bw-makecode/pxt-runtime.js');
        const boards = await arcadeBoards().catch(() => []);
        this.setState({arcadeBoards: boards});
    }

    /**
     * The real firmware: MakeCode's compiler links the program onto the
     * precompiled base and embeds the project, so the file both flashes a board
     * and opens in MakeCode as this project. An Arcade game is built for the
     * board chosen in the picker; with none chosen there is no base to link onto,
     * and the download says so rather than building (NO_BASE_HEX by name).
     */
    async downloadMakeCodeFirmware () {
        const boardSource = this.state.buffers.pseudocode || '';
        if (this.hasBoards(boardSource)) { await this.downloadBoardsFirmware(boardSource); return; }
        const subject = await this.makeCodeSubject().catch(() => null);
        let board = null;
        if (subject && subject.target === 'arcade') {
            board = (this.state.arcadeBoards || []).find(b => arcadeBoardKey(b) === this.state.arcadeBoard) || null;
            if (!board) { this.setState({status: this.L.mcBoardNone}); return; }
        }
        const ext = board ? board.ext : subject && MAKECODE_FIRMWARE[subject.target];
        if (!ext) {
            this.setState({status: this.L.mcNothingToRun});
            return;
        }
        this.setState({busy: true, status: this.L.mcFirmwareBuilding(subject.name)});
        try {
            const {compileMakeCode, firmwareFile} = await import(
                /* webpackChunkName: "bw-makecode-pxt" */ '../../lib/bw-makecode/pxt-runtime.js');
            const out = await compileMakeCode({target: subject.target, files: subject.files, native: true,
                hwVariant: board ? board.variant : '',
                embedSource: {files: subject.files, name: subject.name, editorUrl: MAKECODE_EDITOR[subject.target]}});
            // pxt returns a .uf2 as BASE64 (measured: 'VUYyCl…' = "UF2\n"), a .hex as
            // text; firmwareFile gives the bytes either way. Decoding a .uf2 as a
            // binary string would write a corrupt file.
            const fw = out.success ? firmwareFile({[`binary.${ext}`]: out.outfiles[`binary.${ext}`]}) : null;
            if (!fw) {
                const first = (out.diagnostics[0] && `${out.diagnostics[0].file}:${out.diagnostics[0].line + 1} ${out.diagnostics[0].message}`) || '';
                this.setState({busy: false, status: this.L.mcCompileErrors(out.diagnostics.length, first)});
                return;
            }
            const slug = t => String(t).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase();
            const filename = `${[subject.target, slug(subject.name) || 'program', board && slug(board.name)].filter(Boolean).join('-')}.${ext}`;
            await downloadBlob(filename, new Blob([fw.bytes], {type: 'application/octet-stream'}));
            this.setState({busy: false, status: (board ? this.L.mcBoardFirmwareDone(filename, board.name) : this.L.mcFirmwareDone(filename)) + this.fetchedNote(out)});
        } catch (err) {
            this.setState({busy: false, status: this.makeCodeFailure(err, subject.target)});
        }
    }

    /**
     * This Scratch project as a MakeCode Arcade game (lib/bw-makecode/export-arcade.js),
     * read from the LIVE project so costume edits count. Every costume is drawn
     * once up front: pixel-art costumes are read exactly from their SVG, anything
     * else is palette-matched from these pixels.
     */
    async arcadeFromStage () {
        const vm = this.props.vm;
        const {assetLibraryRecords, withoutAssetLibraries} = await import('../../lib/bw-asset-library.js');
        const savedProject = JSON.parse(vm.toJSON());
        const project = withoutAssetLibraries(savedProject, assetLibraryRecords(vm, savedProject));
        const draw = asset => new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                const width = Math.max(1, img.naturalWidth);
                const height = Math.max(1, img.naturalHeight);
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve({rgba: ctx.getImageData(0, 0, width, height).data, width, height});
            };
            img.onerror = () => resolve(null);
            img.src = asset.encodeDataURI();
        });
        const svgs = new Map();
        const rasters = new Map();
        const palettes = new Map();
        const sounds = new Map();
        const animationDocuments = [];
        for (const target of vm.runtime.targets) {
            if (!target.isOriginal) continue;
            // Sound bytes, for the export's tone check (a steady tone plays; sampled audio is named).
            for (const sound of target.sprite.sounds || []) if (sound.asset) sounds.set(sound.assetId, sound.asset.data);
            for (const costume of target.sprite.costumes) {
                if (costume.asset.dataFormat === 'svg') svgs.set(costume.assetId, costume.asset.decodeText());
                rasters.set(costume.assetId, await draw(costume.asset));
                const artwork = getCostumeDocument(costume);
                if (artwork?.palette) palettes.set(costume.assetId, artwork.palette);
                if (artwork?.animation?.resource) animationDocuments.push(artwork);
            }
        }
        const {projectJsonToArcade} = await import(
            /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/export-arcade.js');
        return projectJsonToArcade(JSON.stringify(project), {
            captureObservation: true,
            browserPointer: true,
            name: 'brickwright-game',
            animationDocuments,
            costumeSvg: (t, c) => svgs.get(c.assetId) || null,
            costumeRgba: (t, c) => rasters.get(c.assetId) || null,
            costumePalette: (t, c) => palettes.get(c.assetId) || null,
            soundData: (t, s) => sounds.get(s.assetId) || null
        });
    }

    insertAnimationResource (kind) {
        try {
            const resources = syncAnimationResources(this.props.vm);
            const id = this.state.animationResourceId || resources.keys().next().value;
            if (!resources.has(id)) throw new Error('Choose an available published animation.');
            const word = {frames: 'frames', fresh: 'fresh frames', interval: 'interval'}[kind];
            if (!word) throw new Error('Unknown animation resource operation.');
            const text = `(arcade animation ${word} resource ${JSON.stringify(id)})`;
            if (!this._cmEditor?.insertText?.(text)) this.setActiveCode(`${this.activeCode()}${text}`);
        } catch (error) { this.setState({status: error.message}); }
    }

    invalidateArcadeReport () {
        this._arcadeReportRevision = (this._arcadeReportRevision || 0) + 1;
        this._arcadeReportRequest = null;
        const revision = this._arcadeReportRevision;
        if (this.state.conversionReport?.operation) {
            try {
                this.setState(state => this._arcadeReportRevision === revision && this._arcadeReportRequest === null &&
                    state.conversionReport?.operation ? {conversionReport: null} : null);
            } catch { /* Clearing a report must not prevent the original edit/project handoff. */ }
        }
    }

    beginArcadeReport () {
        const request = {vm: this.props.vm, revision: this._arcadeReportRevision || 0};
        this._arcadeReportRequest = request;
        return request;
    }

    publishArcadeReport (request, out, operation, outcome) {
        // Report ownership only. This does not alter download, compilation,
        // player publication, asset collection or their original errors.
        if (this._unmounted || this._arcadeReportRequest !== request || request.vm !== this.props.vm ||
            request.revision !== (this._arcadeReportRevision || 0)) return;
        try {
            this.setState(() => {
                if (this._unmounted || this._arcadeReportRequest !== request || request.vm !== this.props.vm ||
                    request.revision !== (this._arcadeReportRevision || 0)) return null;
                try {
                    let observation=null;
                    try {
                        const evidence=Object.getOwnPropertyDescriptor(out,'refusalEvidence')?.value;
                        observation=evidence&&typeof evidence==='object'?
                            Object.getOwnPropertyDescriptor(evidence,'ownedJsonObservation')?.value:null;
                    } catch { /* Missing evidence cannot hide the original unsupported report. */ }
                    return {conversionReport: {direction: operation === 'export' ? 'Blocks → Arcade export' : 'Blocks → Arcade run',
                        operation, outcome, preserved: false, changed: [...(out.warnings || [])], unsupported: [...out.unsupported],
                        details: out.unsupportedDetails || [], observation: observation || null}};
                } catch { return null; }
            });
        } catch { /* Reporting must not replace the original export/run outcome. */ }
    }

    async runAsArcade () {
        const request = this.beginArcadeReport();
        this.setState({busy: true, status: this.L.mcRunCompiling('Arcade'), conversionReport: null});
        let out;
        try {
            out = await this.arcadeFromStage();
            const {compileMakeCode} = await import(
                /* webpackChunkName: "bw-makecode-pxt" */ '../../lib/bw-makecode/pxt-runtime.js');
            const built = await compileMakeCode({target: 'arcade', files: out.files});
            if (!built.success) {
                this.publishArcadeReport(request, out, 'run', 'The compiler rejected the generated Arcade source.');
                const d = built.diagnostics[0] || {};
                this.setState({busy: false, status: this.L.mcCompileErrors(built.diagnostics.length, `${d.file}:${(d.line || 0) + 1} ${d.message || ''}`)});
                return;
            }
            const program = {target: 'arcade', js: built.outfiles['binary.js'], name: 'Arcade'};
            window.__bwMakeCodePending = program;
            localStorage.setItem('bw-stage-circuit', '1');
            localStorage.setItem('bw-debug-dock', 'makecode');
            localStorage.setItem('bw-right-pane-hidden', '0');
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-debug-dock', value: 'makecode'}}));
            window.dispatchEvent(new CustomEvent('bw-makecode-load', {detail: program}));
            this.publishArcadeReport(request, out, 'run', 'Arcade source compiled and sent to the player; behavior is not verified.');
            this.setState({busy: false, status: this.L.arcStarted(out.unsupported.length)});
        } catch (err) {
            if (out) this.publishArcadeReport(request, out, 'run', 'Arcade run failed; the original error is shown in the status.');
            this.setState({busy: false, status: this.makeCodeFailure(err, 'arcade')});
        }
    }

    async exportArcade () {
        const request = this.beginArcadeReport();
        this.setState({busy: true, conversionReport: null});
        try {
            const original = this.makeCodeOriginalStatus();
            const out = original.status === 'current' && original.target === 'arcade' ?
                {files: original.files, unsupported: [], warnings: [], refusalEvidence: {ownedJsonObservation: {
                    schema: 'arcade-clean-export-observation-v1', origin: 'original-source-passthrough',
                    captureStatus: 'UNAVAILABLE_ORIGINAL_SOURCE_BRANCH'}}} : await this.arcadeFromStage();
            const {makeCodeProjectFile} = await import(
                /* webpackChunkName: "bw-makecode" */ '../../lib/bw-makecode/index.js');
            const name = JSON.parse(out.files['pxt.json']).name;
            const filename = `arcade-${String(name).replace(/[^a-z0-9_-]+/gi, '-').toLowerCase()}.mkcd`;
            const projectFile = makeCodeProjectFile(out.files, {name, target: 'arcade'});
            await downloadBlob(filename, new Blob([projectFile], {type: 'application/octet-stream'}),
                {allowBrowserShare: false});
            this.publishArcadeReport(request, out, 'export', original.status === 'current' && original.target === 'arcade' ?
                'Recovered original Arcade source saved; later behavior is not verified.' :
                'Arcade source saved, including all reported unsupported operations; it has not been compiled or run.');
            this.setState({busy: false, status: this.L.arcDone(filename, out.unsupported.length)});
        } catch (err) {
            this.setState({busy: false, status: this.L.mcFailed('MakeCode Arcade', (err && err.message) || String(err))});
        }
    }

    // The current project as a playable, editable game outside the editor:
    // target 'web' (JavaScript, play.html) or 'pygame' (Python). The exporter
    // (sb3-creator src/game, vendored) reads the saved .sb3 — the same bytes
    // File > Save writes — and refuses blocks its runtime cannot reproduce.
    async exportPlayableGame (target) {
        this.setState({busy: true, conversionReport: null});
        try {
            const blob = await this.props.vm.saveProjectSb3();
            const [{exportGame, loadSb3, zipExport}, {rasterizeInPage}] = await Promise.all([
                import(/* webpackChunkName: "bw-game-export" */ '../../lib/sb3-creator-game-export.js'),
                import(/* webpackChunkName: "bw-game-export" */ '../../lib/sb3-creator-game-raster.js')]);
            const title = (this.props && this.props.projectTitle) || 'brickwright-game';
            // Costumes are rasterized with this page's own canvas: pixel collisions and
            // touching colour in the exported game, with no extra dependency.
            const out = await exportGame(await loadSb3(await blob.arrayBuffer()), {target, title, rasterize: rasterizeInPage});
            if (!out.ok) {
                this.setState({busy: false, status: this.L.gameRefused(out.reasons.join('; '))});
                return;
            }
            const filename = `${out.name}-${target === 'pygame' ? 'pygame' : 'web'}.zip`;
            const zip = await zipExport(out.files, out.name);
            await downloadBlob(filename, new Blob([zip], {type: 'application/zip'}));
            this.setState({busy: false, status: this.L.gameDone(filename, Object.keys(out.report.approximate).length)});
        } catch (err) {
            this.setState({busy: false, status: this.L.mcFailed('game export', (err && err.message) || String(err))});
        }
    }

    // Export the exact source recovered from an imported MakeCode artefact.
    // This is deliberately not labelled as a BrickWright->UF2 compiler: edits
    // made after translation are not reverse-translated into these files.
    async exportMakeCodeSource () {
        const project = this._makeCodeProject;
        if (!project || !project.files) return;
        const imported = await import(/* webpackChunkName: "jszip" */ 'jszip');
        const JSZip = imported.default || imported;
        const zip = new JSZip();
        Object.entries(project.files).forEach(([name, source]) => zip.file(name, source));
        zip.file('BRICKWRIGHT-IMPORT.txt',
            `Recovered ${project.target} source from an imported MakeCode artefact.\n` +
            'These are the original files, not a reverse translation of later BrickWright edits.\n' +
            (this.makeCodeOriginalStatus().status === 'stale' ?
                'The program has been changed since it was imported, so these files no longer describe it.\n' : '') +
            'Open the folder with the MakeCode Asset Explorer/PXT toolchain and compile for your exact board.\n');
        const blob = await zip.generateAsync({type: 'blob'});
        await downloadBlob(`${String(project.name || 'makecode-project').replace(/[^a-z0-9_-]+/gi, '-')}.zip`, blob);
    }

    componentWillUnmount () {
        window.removeEventListener('bw-hardware-state', this.onHardwareState);
        window.removeEventListener('bw-library-code', this.openLibraryCode);
        window.removeEventListener('bw-code-machine-selected', this.onLibraryMachineSelected);
        window.removeEventListener('bw-run-active-code', this.runActiveCode);
        window.removeEventListener('bw-read-blocks-into-code', this.fromBlocks);
        this.setMaximizedChrome(false);
        this._unmounted = true;
        this.disposeCodeRun();
        if (this._picoSimRequest || this._picoSimStop) this.stopPicoSim();
        if (this._picoBasicHardware) this.closePicoBasicHardware();
        window.removeEventListener('bw-stop-all', this._onStopCodeRun);
        if (this._codeStopRuntime) this._codeStopRuntime.removeListener('PROJECT_STOP_ALL', this._onStopCodeRun);
        this._codeStopRuntime = null;
        this.disposeCrispBasic().catch(() => {});
        if (this._unregisterCodeMenu) this._unregisterCodeMenu();
        this._makeCodeRequest = null;
        const vm = this.props.vm;
        if (vm && vm.runtime && this._onProjectChanged) {
            vm.runtime.removeListener('PROJECT_CHANGED', this._onProjectChanged);
        }
        window.removeEventListener('bw-project-bundle-collect', this._onBundleCollect);
        window.removeEventListener('bw-example-loaded', this._onExampleLoaded);
        window.removeEventListener('bw-load-pseudocode', this._onLoadPseudocode);
        window.removeEventListener('bw-project-bundle-loaded', this._onBundleLoaded);
        window.removeEventListener('bw-microbit-run-request', this._onMicrobitRunRequest);
        window.removeEventListener('bw-cp1-source-load', this.selectCp1);
        window.removeEventListener('bw-kim1-selection', this.selectKim1);
        window.removeEventListener('bw-microtronic-selected', this.selectMicrotronic);
        window.removeEventListener('bw-board-ready', this.updateMicrotronicPart);
        window.removeEventListener('bw-cardiac-selected', this.selectCardiac);
        window.removeEventListener('bw-machine-extracted', this.onCardiacMachineSelection);
        window.removeEventListener('bw-cardiac-detached', this.detachCardiac);
        window.removeEventListener('bw-cp1-circuit-detached', this.detachCp1);
        // A pending debounce would otherwise lose the last edits on unmount.
        if (this._autosaveTimer) {
            clearTimeout(this._autosaveTimer);
            this._autosaveTimer = null;
            this.writeAutosave();
        }
    }

    // Current-locale string table for this tab's own UI (see L10N above).
    get L () { return L10N[pickLocale(this.props.locale)]; }

    /**
     * "⚙ Make this a circuit" — option C from docs/PSEUDOCODE-TO-VERILOG.md.
     *
     * OFFERED ONLY WHERE IT APPLIES, which is the whole design. The measured
     * answer is that 0 of 282 shipped example programs contain an expression
     * this accepts, so an affordance that were always visible would be an
     * affordance that always refuses — that measurement is why this is an
     * action and not a Code-tab subtab.
     *
     * Gated exactly as the FPGA surface itself is: the build flag AND the
     * per-user opt-in. The Code tab is not flagged, so without this check a
     * flag-off build would offer a handoff to a tab that is not there.
     */
    renderCircuitOffer () {
        if (!process.env.BW_ENABLE_FPGA) return null;
        let enabled = false;
        try { enabled = getFpgaEnabled(); } catch (e) { enabled = false; }
        if (!enabled) return null;
        if (this.state.lang !== 'pseudocode') return null;
        let found = [];
        try { found = lowerableLines(this.activeCode()); } catch (e) { return null; }
        if (!found.length) return null;
        const L = this.L;
        return (
            <div
                data-testid="bw-pseudocode-circuit-offer"
                style={{margin: '8px 0 0', padding: 10, borderRadius: 8,
                    background: '#f0fdf4', border: '1px solid #16a34a'}}
            >
                <div style={{fontSize: 11, lineHeight: 1.4, marginBottom: 6, color: '#166534'}}>
                    {L.makeCircuitWhy}
                </div>
                {found.map(f => (
                    <button
                        key={f.lineNo}
                        type="button"
                        data-testid={`bw-pseudocode-make-circuit-${f.lineNo}`}
                        title={L.makeCircuitTitle(f.expr)}
                        onClick={() => this.handoffCircuit(f)}
                        style={{marginRight: 6, marginBottom: 4, padding: '4px 10px', borderRadius: 6,
                            border: '1px solid #16a34a', background: '#fff', color: '#166534',
                            cursor: 'pointer', fontWeight: 600, fontSize: 12}}
                    >{`${L.makeCircuit} — ${f.expr}`}</button>
                ))}
            </div>
        );
    }

    /** Hand the model to the FPGA tab and go there. */
    handoffCircuit (found) {
        try {
            window.dispatchEvent(new CustomEvent('bw-fpga-seed-model', {detail: {model: found.model, expr: found.expr}}));
            window.dispatchEvent(new CustomEvent('bw-activate-tab', {detail: {index: FPGA_TAB_INDEX}}));
        } catch (e) { /* a browser that refuses CustomEvent cannot be helped here */ }
    }

    codeRuntimeFor (lang, target) {
        if (lang === 'javascript') return 'javascript';
        if (lang === 'python' || lang === 'micropython') return target === 'pico' ? 'pico-micropython' : 'skulpt';
        return null;
    }

    codeGenerationOptions (state = this.state) {
        return {driver: state.driverMode || 'shim', async: Boolean(state.asyncMode),
            events: Boolean(state.eventsMode),
            basicProfile: state.basicProfile || 'bbc', basicLineNumbers: state.basicLineNumbers !== false,
            ...(state.basicEngine === 'crispbasic' && state.basicPortableLibrary ? {basicMode: 'crispbasic'} : {}),
            ...(state.jsExecution === OWNED_CONSOLE_EXECUTION ? {execution: OWNED_CONSOLE_EXECUTION} : {})};
    }

    /** Bridge older source-loading routes to the same authored-document owner. */
    codeDocumentSnapshot (state = this.state) {
        const lang = state.lang;
        // Resolve the BASIC profile's machine from state, not currentDevice():
        // currentDevice() reads the target through this snapshot.
        const machine = lang === 'basic' && (state.libraryTarget || (state.codeDocument && state.codeDocument.target) ||
            codeTargetFromSource('pseudocode', state.buffers.pseudocode || ''));
        const standalone = lang === 'basic' && basicProfileFor(machine, state.basicProfile);
        const code = state.buffers[standalone && standalone.standalone ? standalone.id : lang] || '';
        const document = state.codeDocument;
        if (document) {
            const expected = document.lang === lang ? document.code : document.projections[lang]?.code;
            if (expected === code || (expected === undefined && !code)) {
                return document.selectedLang === lang ? document : selectCodeDocumentLanguage(document, lang,
                    {runtime: this.codeRuntimeFor(lang, document.target)});
            }
            return editCodeDocument(document, {lang, code,
                runtime: this.codeRuntimeFor(lang, lang === 'pseudocode' ? codeTargetFromSource(lang, code) : document.target),
                generationOptions: this.codeGenerationOptions(state)});
        }
        const target = codeTargetFromSource('pseudocode', state.buffers.pseudocode || '');
        return createCodeDocument({lang, code, target, runtime: this.codeRuntimeFor(lang, target),
            generationOptions: this.codeGenerationOptions(state)});
    }

    codeDocumentState (document) {
        const options = document.generationOptions;
        return {...restoreCodeDocumentState(document, Object.keys(LANG_LABEL)),
            driverMode: options.driver || 'shim', asyncMode: Boolean(options.async), eventsMode: Boolean(options.events),
            basicProfile: options.basicProfile || 'bbc', basicLineNumbers: options.basicLineNumbers !== false,
            jsExecution: options.execution === OWNED_CONSOLE_EXECUTION || document.execution === OWNED_CONSOLE_EXECUTION ||
                document.projections.javascript?.execution === OWNED_CONSOLE_EXECUTION ? OWNED_CONSOLE_EXECUTION : 'classic'};
    }

    /** An explicit file/example/import replaces the authored program, not a view. */
    authoredCodeState (lang, code, target = undefined) {
        this._codeRestoreError = null;
        const resolvedTarget = target === undefined ? codeTargetFromSource(lang, code) : target;
        return this.codeDocumentState(createCodeDocument({lang, code, target: resolvedTarget,
            runtime: this.codeRuntimeFor(lang, resolvedTarget), generationOptions: this.codeGenerationOptions()}));
    }

    retargetCodeState (source, selectedLang = this.state.lang) {
        const document = editCodeDocument(this.codeDocumentSnapshot(), {lang: 'pseudocode', code: source,
            runtime: null, generationOptions: this.codeGenerationOptions()});
        this._codeRestoreError = null;
        return this.codeDocumentState(selectCodeDocumentLanguage(document, selectedLang,
            {runtime: this.codeRuntimeFor(selectedLang, document.target)}));
    }

    /** Machine build output is a view of the captured editor revision. */
    codeProjectionState (state, document, buffers, lang, code) {
        if (state.buffers !== buffers || !code || document.lang === lang) return {};
        const next = addCodeProjection(document, {lang, code, sourceRevision: document.revision,
            options: this.genOpts(lang), runtime: this.codeRuntimeFor(lang, document.target)});
        return this.codeDocumentState(selectCodeDocumentLanguage(next, state.lang,
            {runtime: this.codeRuntimeFor(state.lang, document.target)}));
    }

    /** Keep generated buffers tied to the source and options that produced them. */
    codeDocumentWithBuffers (buffers, sourceLang, selectedLang = this.state.lang, diagnostics = null,
        authoredDocument = null) {
        const code = buffers[sourceLang] || '';
        const target = sourceLang === 'pseudocode' ? codeTargetFromSource(sourceLang, code) :
            this.codeDocumentSnapshot().target;
        let document = authoredDocument ? {...authoredDocument, projections: {}} :
            createCodeDocument({lang: sourceLang, code, target,
                runtime: this.codeRuntimeFor(sourceLang, target), generationOptions: this.codeGenerationOptions()});
        for (const [lang, text] of Object.entries(buffers)) {
            if (lang !== document.lang && text) document = addCodeProjection(document, {lang, code: text,
                sourceRevision: document.revision, options: this.genOpts(lang), diagnostics,
                runtime: this.codeRuntimeFor(lang, document.target)});
        }
        return selectCodeDocumentLanguage(document, selectedLang,
            {runtime: this.codeRuntimeFor(selectedLang, document.target)});
    }

    /** Show or hide the on-request tabs (fe, Tcl); remembered per browser. */
    activeCode () {
        const profile = this.state.lang === 'basic' && this.standaloneBasicProfile();
        if (profile) return this.state.buffers[profile.id] || '';
        if (this.state.lang === 'asm' && this.state.asmMode === 'listing') return this.state.asmListing;
        // A tab with no buffer yet (fe and Tcl were missing from the initial set and
        // crashed the editor when opened on an empty project) reads as empty.
        return this.state.buffers[this.state.lang] ?? '';
    }
    setActiveCode (text) {
        if (this.state.lang === 'asm' && this.state.asmMode === 'listing') return;
        this.invalidateArcadeReport();
        // A standalone BASIC profile edits its own draft beside the authored
        // document; ASM and NQC drafts are edited independently as well.
        const profile = this.state.lang === 'basic' && this.standaloneBasicProfile();
        if (profile) {
            this.setState(state => ({buffers: {...state.buffers, [profile.id]: text}}));
            return;
        }
        this._codeRestoreError = null;
        this.setState(s => {
            const generationFailed = s.lang === 'basic' && this.basicGenerationPlaceholder(text);
            const basicState = {basicFilename: s.lang === 'basic' ? s.basicFilename : 'editor.bas',
                basicWarnings: generationFailed ? (s.basicWarnings.length ? s.basicWarnings :
                    ['Remove or replace the generation-error banner before running or converting BASIC.']) : [],
                basicGenerationFailed: generationFailed};
            // An independent draft beside a document of another language stays a
            // draft; when ASM/NQC IS the authored document, the edit revises it.
            if ((s.lang === 'asm' || s.lang === 'nqc') && s.codeDocument && s.codeDocument.lang !== s.lang) {
                return {buffers: {...s.buffers, [s.lang]: text}, ...basicState};
            }
            const device = s.buffers.pseudocode?.match(/^DEVICE\s+([\w-]+)[^\n]*/im);
            const nextDevice = s.lang === 'pseudocode' ? text.match(/^DEVICE\s+([\w-]+)/im) : device;
            const target = nextDevice?.[1]?.toLowerCase() || s.libraryTarget;
            const next = this.withRetainedDrafts(this.codeDocumentState(editCodeDocument(this.codeDocumentSnapshot(s),
                {lang: s.lang, code: text, generationOptions: this.codeGenerationOptions(s)})), s, s.lang, target);
            return {...next, ...basicState, ...(nextDevice && {libraryTarget: null}),
                authoredSources: {...hiddenCodeDrafts(s.authoredSources, s.buffers, target, s.lang), [s.lang]: text}};
        });
    }

    // Lazily import the compiler through the registering door, which injects this
    // app's authored vector assets before handing the class over. The SHAPE art
    // dialect lives upstream; the artwork deliberately does not.
    async lib () {
        return await import(
            /* webpackChunkName: "sb3-creator" */ '../../lib/sb3-creator-register-art.js');
    }

    // Convert one language's source to another by going through blocks:
    // Two kinds of C arrive here and they need different readers. Host C is what
    // generateC now emits for a Scratch project — machine written, carrying its
    // own structure, and marked with @bw-program. Everything else is 8051 C,
    // possibly hand written, which sb3-creator-c.js infers pins from. Guessing
    // wrong means reading a sprite program as firmware, so the marker decides.
    async readC (text) {
        if (/@bw-program/.test(text)) {
            const host = (await import(/* webpackChunkName: "sb3-creator-chost" */ '../../lib/sb3-creator-chost.js')).default;
            return { pseudocode: host(text), warnings: [] };
        }
        const device = (await import(/* webpackChunkName: "sb3-creator-c" */ '../../lib/sb3-creator-c.js')).default;
        return device(text);
    }

    convertedSource ({pseudocode, warnings = []}) {
        if (pseudocode?.trim() || !warnings.length) return pseudocode;
        throw new Error(warnings.join(' · '));
    }

    // source → pseudocode → parse() → project → generate(to). Returns {code} or {error}.
    async deriveBuffer (src, from, to) {
        try {
            const refusal = codeDocumentConversionRefusal(this.state.codeDocument, from, src);
            if (refusal) throw new Error(refusal);
            const SB3 = (await this.lib()).default;
            let read = null;
            if (from === 'c') read = await this.readC(src);
            else if (from === 'python' || from === 'javascript') {
                const readers = await import(/* webpackChunkName: "sb3-creator-readers" */ '../../lib/robot-lab-pseudocode.js');
                read = from === 'python' ? readers.readPython(src) : readers.readJavaScript(src);
            } else if (from === 'basic') {
                if (this.state.basicGenerationFailed || this.basicGenerationPlaceholder(src)) {
                    throw new Error((this.state.basicWarnings || []).join('\n') || 'BASIC generation was refused. Remove or replace the generation-error banner.');
                }
                read = (await import(/* webpackChunkName: "sb3-creator-basic" */ '../../lib/sb3-creator-basic.js')).default(src);
                if (read.ok === false) throw new Error((read.reasons || []).join('\n') || 'BASIC conversion refused.');
            }
            else if (DOS_LANG[from]) read = (await DOS_LANG[from].load()).default(src);
            const pseudo = read ? this.convertedSource(read) : src;
            const creator = new SB3();
            creator.parse(pseudo);
            const proj = creator.project;
            let code;
            let basicWarnings = [];
            let basicGenerationFailed = false;
            if (to === 'pseudocode') code = new SB3().decompile(proj);
            else if (to === 'python') code = new SB3().generatePython(proj, this.genOpts(to));
            else if (to === 'c') code = new SB3().generateC(proj);
            else if (to === 'basic') {
                const r = new SB3().generateBASIC(proj, this.basicGenerationOptions());
                if (!r.ok) throw new Error(r.reasons.join('; '));
                code = r.basic;
                basicWarnings = r.warnings || [];
            } else if (to === 'micropython') {
                const r = new SB3().generateMicroPython(proj);
                if (!r.ok) throw new Error(r.reasons.join('; '));
                code = r.py;
            } else if (DOS_LANG[to]) {
                code = DOS_LANG[to].generate(await DOS_LANG[to].load(), proj);
            } else code = new SB3().generateJavaScript(proj, this.genOpts(to));
            if (to === 'javascript' && this.state.jsExecution === OWNED_CONSOLE_EXECUTION &&
                !/^\/\/ owned-console-v1:/m.test(code)) throw new Error('This compiler revision does not support console programs.');
            const classified = classifyConversionWarnings([...(read?.warnings || []), ...(creator.warnings || [])]);
            const diagnostics = {direction: `${LANG_LABEL[from] || from} → ${LANG_LABEL[to] || to}`,
                preserved: true, changed: classified.changed, unsupported: [...classified.unsupported, ...(read?.unsupported || [])]};
            return {code, diagnostics, options: this.genOpts(to), ...(to === 'basic' ? {basicWarnings, basicGenerationFailed} : {})};
        } catch (e) {
            const failure = conversionFailure(e);
            return {error: failure.message, diagnostics: {direction: `${LANG_LABEL[from] || from} → ${LANG_LABEL[to] || to}`,
                preserved: false, changed: [], unsupported: failure.issues,
                ...(failure.diagnostics ? {diagnostics: failure.diagnostics, sourceSpan: failure.sourceSpan,
                    code: failure.code} : {})}};
        }
    }

    /**
     * Is the RCX extension loaded? That is what decides whether the NQC tab
     * is offered, since the RCX has no DEVICE line of its own.
     *
     * Read defensively: this runs on every render, and an extension manager
     * that has not finished loading — or a host that has none — must not take
     * the Code tab down with it.
     */
    rcxLoaded () {
        try {
            const vm = this.props.vm;
            const ids = vm && vm.extensionManager && vm.extensionManager.getLoadedExtensionURLs ?
                Object.keys(vm.extensionManager.getLoadedExtensionURLs()) : [];
            if (ids.includes('legorcx')) return true;
            const loaded = vm && vm.extensionManager && vm.extensionManager._loadedExtensions;
            return Boolean(loaded && typeof loaded.has === 'function' && loaded.has('legorcx'));
        } catch (e) {
            return false;
        }
    }

    // Switch language tab. If the target buffer is empty, derive it from the active
    // buffer so the tab shows the same project in the new language.
    /** The optional languages the row shows: active, written in, or added from "+". */
    visibleOptionalLangs () {
        return BW_OPTIONAL_LANGS.filter(([l]) => this.state.lang === l ||
            (this.state.buffers[l] || '').trim() || this.state.extraLangs.includes(l));
    }
    /** Add an optional language to the row (remembered per browser) and open it. */
    addOptionalLang (l) {
        const extraLangs = this.state.extraLangs.includes(l) ? this.state.extraLangs : [...this.state.extraLangs, l];
        try { localStorage.setItem(BW_EXTRA_LANGS_KEY, JSON.stringify(extraLangs)); } catch { /* per-browser convenience only */ }
        this.setState({extraLangs, langMenuOpen: false}, () => this.switchTab(l));
    }
    selectKim1 = event => {
        const kim1PartId = event.detail?.partId || null;
        this.setState({kim1PartId, kim1Active: !!kim1PartId,
            ...(kim1PartId ? {cp1Active: false, cardiacActive: false} : {})});
    };
    detachCp1 = () => this.setState({cp1Active: false});
    selectCp1 = () => {
        this.leaveCardiac();
        this.setState({cp1Active: true, cardiacActive: false, kim1Active: false, microtronicActive: false});
    };
    detachCardiac = () => this.setState({cardiacActive: false});
    selectCardiac = () => this.setState({cardiacActive: true, cp1Active: false, kim1Active: false, microtronicActive: false});
    onCardiacMachineSelection = event => {
        if (event.detail?.kind !== 'kim1' && this.state.kim1PartId) this.selectKim1({});
        if (event.detail?.kind !== 'cardiac' && this.state.cardiacActive) this.detachCardiac();
    };
    leaveCardiac () {
        if (window.__bwMachineExtracted?.kind === 'cardiac') {
            window.dispatchEvent(new CustomEvent('bw-cardiac-code-selection', {detail: {active: false}}));
        }
        if (this.state.cardiacActive) this.detachCardiac();
    }
    openCardiacLanguage () {
        this.leaveCp1();
        this.setState({langMenuOpen: false});
        window.dispatchEvent(new CustomEvent('bw-cardiac-code-selection', {detail: {active: true}}));
        this.selectCardiac();
    }
    leaveCp1 () {
        if (window.__bwMachineExtracted?.kind === 'cp1') {
            window.dispatchEvent(new CustomEvent('bw-cp1-code-selection', {detail: {active: false}}));
        }
        if (this.state.cp1Active) this.detachCp1();
    }

    async openCp1Language () {
        this.leaveCardiac();
        this.setState({langMenuOpen: false});
        window.dispatchEvent(new CustomEvent('bw-cp1-code-selection', {detail: {active: true}}));
        if (window.__bwMachineExtracted?.kind === 'cp1') {
            this.selectCp1();
            return;
        }
        if (!(await confirmAsync(this.L.cp1Open)) || this._unmounted) return;
        window.dispatchEvent(new CustomEvent('bw-start-journey', {detail: {
            id: 'code:kosmos-cp1',
            exampleId: 'cp1-first-display',
            mode: 'circuit-only',
            onResult: result => {
                if (this._unmounted) return;
                if (result.ok) this.selectCp1();
                else if (result.error) this.setState({status: result.error});
            }
        }}));
    }

    selectMicrotronic = event => {
        const partId = event.detail?.partId || this.state.microtronicPartId;
        if (partId) this.setState({microtronicPartId: partId, microtronicActive: true,
            cp1Active: false, cardiacActive: false, kim1Active: false});
    };

    updateMicrotronicPart = () => {
        const parts = this.props.vm?.runtime?.circuitBoard?.getParts?.() || [];
        const partId = parts.find(part => part.kind === 'busch-microtronic')?.id || null;
        if (this.state.microtronicPartId !== partId) this.setState({
            microtronicPartId: partId, ...(partId ? {} : {microtronicActive: false})
        });
    };

    switchTab (to) {
        if (this.state.busy) return;
        this.detachCardiac();
        this.leaveCp1();
        this.setState({kim1Active: false, microtronicActive: false});
        const from = this.state.lang;
        if (to === from) return;
        const standalone = (from === 'basic' || to === 'basic') && this.standaloneBasicProfile('basic');
        if (to === 'basic' && standalone) {
            this.setState({lang: 'basic', output: null, status: '', emptyTabOffer: null});
            return;
        }
        const document = this.codeDocumentSnapshot();
        // ASM tab: author mode just switches. Listing mode must RE-DERIVE: the
        // listing belongs to the program as it is now, and the program may have
        // changed since the listing was built (To blocks, an edit in another
        // tab). fetchAsmListing() hashes the derived C and serves the cache when
        // nothing changed, so this costs nothing for an unchanged program.
        // Measured before this branch existed: a changed program re-entered the
        // tab and downloaded the OLD 37,410-char listing for 120 s
        // (verify-local-asm-listing, run 33984595568).
        if (to === 'asm') {
            if (this.state.asmMode === 'listing') { this.fetchAsmListing(); return; }
            this.setState({...this.codeDocumentState(selectCodeDocumentLanguage(document, 'asm')),
                output: null, status: ''});
            return;
        }
        const projection = document.projections[to];
        const existing = to === document.lang || (projection &&
            JSON.stringify(projection.options) === JSON.stringify(this.genOpts(to)));
        // A generated tab is a view of the authored document. Derive another
        // view from that document instead of roundtripping generated async JS.
        const src = document.code;
        const sourceLang = document.lang;
        // ASM source and NQC are edited independently. MicroPython has a
        // generated preview, but switching away does not reparse it as Pseudocode.
        // Leaving the ASM tab is not a conversion either: assembly is not a source
        // the other languages are derived from.
        const independent = !TWO_WAY.has(from) || to === 'nqc' || (from === 'basic' && standalone);
        const hasSource = (buffer, language) => Boolean(buffer && (language === 'pseudocode' ?
            buffer.replace(/^DEVICE\s+[^\n]*(?:\n|$)/im, '') : buffer).trim());
        if (independent || (!TWO_WAY.has(to) && hasSource(this.state.buffers[to], to))) {
            this.setState({lang: to, output: null, status: '', emptyTabOffer: null});
            return;
        }
        if (existing || !src || !src.trim()) {
            this.setState({...this.withRetainedDrafts(this.codeDocumentState(selectCodeDocumentLanguage(document, to,
                {runtime: this.codeRuntimeFor(to, document.target)})), this.state, to),
                output: null, status: '', emptyTabOffer: null});
            return;
        }
        const request = {};
        this._deriveRequest = request;
        const buffers = this.state.buffers;
        const vm = this.props.vm;
        const ownsRequest = () => !this._unmounted && this._deriveRequest === request;
        const ownsEditor = state => ownsRequest() && state.lang === from &&
            state.buffers === buffers && this.props.vm === vm;
        this.setState({busy: true, status: this.L.stConverting(to), emptyTabOffer: null});
        this.deriveBuffer(src, sourceLang, to).then(({code, error, diagnostics, options, basicWarnings = [], basicGenerationFailed = false}) => {
            // A failed conversion keeps the source tab, and offers an explicit
            // way into the requested tab with an empty buffer instead of a dead end.
            if (!ownsRequest()) return;
            this.setState(state => {
                if (!ownsRequest()) return null;
                // An edit/revert is a new revision even when its text matches.
                // Only this request's busy state may outlive editor ownership.
                if (!ownsEditor(state)) return {busy: false};
                if (error) return {busy: false, status: this.L.stCantShow(to, error), emptyTabOffer: to,
                    conversionReport: diagnostics || null};
                const next = addCodeProjection(document, {lang: to, code, sourceRevision: document.revision,
                    options: options || this.genOpts(to), diagnostics: diagnostics || null,
                    runtime: this.codeRuntimeFor(to, document.target)});
                return {...this.withRetainedDrafts(this.codeDocumentState(next), state, to), busy: false, output: null, status: '', emptyTabOffer: null,
                    ...(to === 'basic' ? {basicWarnings, basicGenerationFailed, basicFilename: 'editor.bas'} : {}),
                    conversionReport: diagnostics || null};
            });
        });
    }

    openEmptyTab (to) {
        if (this.state.busy || this.state.emptyTabOffer !== to) return;
        // The source buffer is kept; only the requested tab opens, empty.
        const device = this.currentDevice();
        this.setState(state => {
            const document = this.codeDocumentSnapshot(state);
            const projections = {...document.projections};
            delete projections[to];
            const next = this.withRetainedDrafts(this.codeDocumentState(selectCodeDocumentLanguage({...document, projections}, to,
                {runtime: this.codeRuntimeFor(to, document.target)})), state, to);
            if (to === 'pseudocode' && device && !next.buffers.pseudocode) next.buffers = {...next.buffers, pseudocode: `DEVICE ${device}\n`};
            return {...next, output: null, status: '', statusExpanded: false, emptyTabOffer: null};
        });
    }

    /** Simple hash for cache key — FNV-1a 32-bit on the source string. */
    _hashSource (str) {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = (h * 0x01000193) >>> 0;
        }
        return h.toString(16);
    }

    /** Fetch the ASM listing (compile with disassemble=true) for the listing mode. */
    async fetchAsmListing () {
        // Need C source to compile. Derive it from whatever is active.
        let cSrc = this.state.buffers.c;
        if (!cSrc || !cSrc.trim()) {
            // Derive C from the current active buffer first
            const src = this.state.buffers[this.state.lang] || this.state.buffers.pseudocode;
            if (!src || !src.trim()) {
                this.setState({lang: 'asm', output: null, status: 'No source to compile — write code in another tab first.'});
                return;
            }
            this.setState({busy: true, status: this.L.stCompiling});
            const result = await this.deriveBuffer(src, this.state.lang === 'asm' ? 'pseudocode' : this.state.lang, 'c');
            if (result.error) {
                this.setState({busy: false, lang: 'asm', status: `Cannot derive C: ${result.error}`});
                return;
            }
            cSrc = result.code;
        }

        const stc = this.currentStc();
        const deviceId = (stc && stc.device || 'stc12c5a60s2').toLowerCase();
        const fosc = Number(stc && (stc.clock || stc.fosc)) || 11059200;
        // A listing belongs to a particular image, not merely to source text.
        // Include every option that can change code generation and the listing
        // schema version so another device/clock cannot borrow stale addresses.
        const hash = this._hashSource(JSON.stringify({cSrc, deviceId, fosc, listingVersion: 1}));
        if (this._asmCache.hash === hash && this._asmCache.asm) {
            this.setState({
                lang: 'asm', asmMode: 'listing', busy: false, output: null, status: '',
                asmListing: this._asmCache.asm,
                asmLineMap: this._asmCache.lineMap
            });
            return;
        }

        this.setState({busy: true, status: this.L.stCompiling, conversionReport: null});
        try {
            const {requestGeneratedListing} = await import(
                /* webpackChunkName: "sdcc-listing-route" */ '../../lib/sdcc-wasm/listing-route.js');
            const out = await requestGeneratedListing({code: cSrc, deviceId, fosc}, {
                compileLocal: async (...args) => {
                    const {compile} = await import(
                        /* webpackChunkName: "sdcc-wasm" */ '../../lib/sdcc-wasm/compiler.js');
                    return compile(...args);
                },
                hostedFetch: globalThis.fetch
            });
            // v1 listing shape: {asm, lineMap, format, v}
            // Fallback: old response.disassembly string
            let asmText = '';
            let lineMap = null;
            if (out.listing && out.listing.asm) {
                asmText = out.listing.asm;
                lineMap = out.listing.lineMap || null;
            } else if (out.disassembly) {
                asmText = out.disassembly;
            } else {
                asmText = '; (no disassembly returned by the compiler service)';
            }
            // Cache it
            this._asmCache = {hash, asm: asmText, lineMap};
            this.setState({
                lang: 'asm', asmMode: 'listing', busy: false, output: null,
                status: lineMap ? `${lineMap.length} source mapping(s)` : '',
                asmListing: asmText,
                asmLineMap: lineMap
            });
        } catch (e) {
            this.setState({busy: false, lang: 'asm', asmMode: 'listing',
                status: this.L.stError(e.message),
                asmListing: `; Compile error: ${e.message}`});
        }
    }

    /**
     * Assemble and run.
     *
     * ONE TAB, TWO ASSEMBLERS, AND THE CHOICE IS NOT MADE HERE. The 8086 is
     * assembled IN THE BROWSER by the vendored MASM-subset assembler;
     * everything else is posted to the hosted service (stc-compiler
     * /assemble — sdas8051, ca65+ld65, sdasz80, avr-gcc). That is a real
     * inconsistency and `lib/bw-asm/assemble-route.js` is where it is argued
     * for; the short version is that neither ca65 nor sdasz80 knows the 8086,
     * so the alternative was not one route, it was no 8086 ASM tab.
     *
     * What this method owes the user is that the choice is never silent.
     * `requestAssembly` returns the route it took and the status line says
     * so — "assembled 384 bytes in this browser" is a different sentence from
     * "assembled by the hosted assembler", and a refusal names which of the
     * two assemblers refused, because their diagnostics read nothing alike.
     *
     * The image then travels the SAME path a hosted build's does:
     * `bw-asm-rom-ready` → circuit-tab stashes it → debug-panel boots it.
     * The detail grew `slotId`/`profile` because a .COM is not a ROM — see
     * `lib/bw-debug/i8086-dos-bench.js`. Auto-run is wired for the 6502, Z80
     * and 8086 benches; other targets assemble (errors surface here) and say
     * so rather than pretending to have run.
     */
    chooseBlinkMachine (family, source) {
        const choices = blinkChoices(family);
        this.setState({actionsOpen: false, blinkChoice: {choices, source, id: choices[0].id}});
    }

    renderBlinkMachinePicker () {
        const request = this.state.blinkChoice;
        if (!request) return null;
        const de = pickLocale(this.props.locale) === 'de';
        const close = () => this.setState({blinkChoice: null});
        return createPortal(
            <dialog data-testid="bw-blink-machine-dialog"
                ref={node => { if (node && !node.open) node.showModal(); }}
                aria-label={de ? 'Zielsystem für LED 0' : 'Machine for Blink 0'}
                onCancel={close}
                style={{width: 330, maxWidth: 'calc(100vw - 32px)', padding: 14,
                    border: '1px solid #94a3b8', borderRadius: 8, color: '#1e293b'}}>
                <form onSubmit={event => {
                    event.preventDefault();
                    const machine = request.choices.find(option => option.id === request.id);
                    this.setState({blinkChoice: null}, () => {
                        if (this.state.buffers.asm === request.source) this.assembleAndRun(machine);
                    });
                }} style={{display: 'grid', gap: 10}}>
                    <label htmlFor="bw-blink-machine">{de ? 'Zielsystem für LED 0' : 'Machine for Blink 0'}</label>
                    <select id="bw-blink-machine" autoFocus value={request.id}
                        onChange={event => this.setState({blinkChoice: {...request, id: event.target.value}})}>
                        {request.choices.map(machine => <option key={machine.id} value={machine.id}>
                            {blinkMachineLabel(machine, this.props.locale)}
                        </option>)}
                    </select>
                    {request.choices.find(option => option.id === request.id)?.circuit &&
                        this.props.vm?.runtime?.circuitBoard?.getParts?.().length > 0 &&
                        <small>{de ? 'Die Beispielschaltung ersetzt die aktuelle Schaltung.' :
                            'The example circuit replaces the current circuit.'}</small>}
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: 6}}>
                        <button type="button" onClick={close}>{de ? 'Abbrechen' : 'Cancel'}</button>
                        <button type="submit">{de ? 'Erstellen und starten' : 'Create and run'}</button>
                    </div>
                </form>
            </dialog>, document.body);
    }

    async activeBlinkMachine (family) {
        const runtime = this.props.vm?.runtime;
        const board = runtime?.circuitBoard;
        const parts = board?.getParts?.() || [];
        const previous = window.__bwPendingMedia?.detail?.asmBlink;
        const previousMachine = blinkMachines.find(machine => machine.id === previous?.id);
        if (previousMachine && (family === 'any' || previousMachine.family === family) &&
            (!previous.board || (previous.board === board &&
                (!previous.led || parts.some(part => part.id === previous.led))))) {
            return {machine: previousMachine, board: previous.board, config: previous.config, led: previous.led};
        }
        const model = runtime?.circuitModel;
        if (!model) return null;
        if ((family === 'any' || family === '8051') && parts.some(part => part.id === 'LED_led1')) {
            const device = (runtime.stc?.device || this._asmDevice()).toLowerCase();
            const machine = blinkMachines.find(item => item.family === '8051' && item.device === device);
            const wired = board.getNets().some(net => net.terminals.some(end =>
                end.part === 'LED_led1' && end.terminal === 'cathode') &&
                net.terminals.some(end => String(end.terminal).toLowerCase() === 'p1.0'));
            if (machine && wired) return {machine, board, led: 'LED_led1'};
        }
        if ((family === 'any' || family === '6502') && parts.some(part => part.kind === 'w65c02')) {
            const config = await this.blinkCircuitConfig('6502', model);
            if (config) return {machine: blinkMachines.find(machine => machine.id === '6502-wired'),
                board, config};
        }
        if ((family === 'any' || family === 'z80') && parts.some(part => part.kind === 'z80')) {
            const config = await this.blinkCircuitConfig('z80', model);
            if (config) return {machine: blinkMachines.find(machine => machine.id === 'z80-virtual'), board, config};
        }
        return null;
    }

    async blinkCircuitConfig (family, model) {
        const {extractMachine} = await import('bw-circuit-ui/model/machine-extract.js');
        if (family === '6502') {
            const {extract6502Machine} = await import('bw-board/m6502-extract.js');
            const result = extractMachine(model, {extract6502Machine});
            const resetVector = result.regions?.some(region => region.kind === 'rom' &&
                region.start === 0x8000 && region.end === 0xffff);
            if (result.ok && resetVector && result.chips.some(chip => chip.kind === 'via' && chip.at === 0x6000)) {
                return {clockHz: 1000000, regions: result.regions, chips: result.chips};
            }
        } else {
            const {extractZ80Machine} = await import('bw-board/z80-extract.js');
            const result = extractMachine(model, {extractZ80Machine});
            if (result.ok && result.ports?.some(port => port.kind === 'latch' && port.at === 1)) {
                return {clockHz: 7372800, regions: result.regions, ports: result.ports};
            }
        }
        return null;
    }

    async assembleAndRun (chosenMachine) {
        if (this.state.busy || this.state.blinkChoice) return;
        const originalSource = this.state.buffers.asm;
        const family = blinkFamily(originalSource || '');
        let active = null;
        if (family && !chosenMachine) {
            this.setState({busy: true});
            try {
                active = await this.activeBlinkMachine(family);
            } catch (error) {
                if (!this._unmounted) this.setState({busy: false, status: this.L.stError(error.message)});
                return;
            }
            if (this._unmounted) return;
            if (this.state.buffers.asm !== originalSource) {
                this.setState({busy: false});
                return;
            }
            if (!active) {
                this.setState({busy: false});
                this.chooseBlinkMachine(family, originalSource);
                return;
            }
        }
        const machine = chosenMachine || active?.machine;
        const source = family === 'any' && machine ? blinkSource(machine.family) : blinkProgramSource(originalSource || '', family);
        if (!source || !source.trim()) {
            this.setState({status: this.L.asmWriteFirst});
            return;
        }
        const device = machine?.device || this._asmDevice();
        const target = asmTargetForDevice(device);
        const route = asmRouteFor(device);
        const routeName = route === 'local' ? this.L.asmRouteLocal : this.L.asmRouteHosted;
        const BENCHES = {eater6502: '6502', z80: 'Z80', i8086: '8086', riscv32: 'RISC-V'};
        this.setState({busy: true, status: this.L.asmAssembling(routeName)});
        let out;
        try {
            out = await requestAssembly({source, device, dialect: machine ? 'auto' : this.state.asmDialect});
        } catch (e) {
            // 'source' is the user's program and the message names the line;
            // 'transport' is the network or a missing module and is not
            // something they can fix by editing. Conflating the two sent
            // people hunting for a syntax error in a working program.
            this.setState({busy: false, status: e.reason === 'source'
                ? this.L.asmSourceError(routeName, e.message)
                : this.L.asmTransportError(routeName, e.message)});
            return;
        }
        // Every give the local assembler made (an expanded 80186 shift, a
        // synthesised segment override) is recorded rather than silent, so a
        // program that assembled DIFFERENTLY from what was written says so.
        const warn = (out.dialect ? this.L.asmDialectUsed(out.dialect) : '') +
            (out.warnings.length ? this.L.asmWarnings(out.warnings) : '');
        const bench = BENCHES[out.target];
        let asmBlink = null;
        if (machine) {
            if (this._unmounted || this.state.buffers.asm !== originalSource) {
                if (!this._unmounted) this.setState({busy: false, status: ''});
                return;
            }
            try {
                const board = active?.board || (machine.circuit ? await this.prepareBlinkCircuit(machine) : null);
                const config = active?.config || (board && machine.family === '6502'
                    ? await this.blinkCircuitConfig('6502', this.props.vm.runtime.circuitModel) : null);
                if (board && machine.family === '6502' && !config) throw new Error('The breadboard has no VIA at $6000');
                if (this._unmounted || this.state.buffers.asm !== originalSource) {
                    if (!this._unmounted) this.setState({busy: false});
                    return;
                }
                asmBlink = {id: machine.id, device, label: machine.label.split(' · ')[1],
                    led: active ? active.led : machine.led, board, config};
                this.setState(state => ({buffers: {...state.buffers, asm: source}, asmRunDevice: device}));
            } catch (error) {
                this.setState({busy: false, status: this.L.stError(error.message)});
                return;
            }
        }
        if (machine?.family === '8051') {
            this.deliverAssembly({format: 'firmware', kind: 'emulator',
                firmware: {name: 'blink0.ihx', bytes: out.bytes, device, blinkOutputOnly: true}}, asmBlink,
            this.L.asmBlinkRunning(blinkMachineLabel(machine, this.props.locale), routeName));
            return;
        }
        if (bench) {
            // HARDWARE THE SOURCE ASKS FOR. A pseudocode program declares its
            // pins and the build returns the chips they need; an assembly
            // program has no declarations, so the EXAMPLE carries them. That
            // is how a program driving an NE2000's registers gets an NE2000
            // to drive -- without putting one on every learner's board.
            const chips = this.asmChipsForSource(this.state.buffers.asm);
            // A RISC-V build carries a loadable {entry, segments} image rather
            // than a flat `rom`; both travel on the same event, and debug-panel
            // routes by `format`.
            const detail = {rom: out.bytes, image: out.image || null,
                listing: out.listing, target: out.target,
                slotId: out.slotId, profile: out.profile, format: out.format,
                ...(out.target === 'i8086' ? {i8086Assembly: true} : {}),
                ...(chips.length ? {chips} : {})};
            const builtLen = out.bytes ? out.bytes.length
                : (out.image ? out.image.segments.reduce((n, s) => n + s.bytes.length, 0) : 0);
            this.deliverAssembly(detail, asmBlink, machine ? this.L.asmBlinkRunning(blinkMachineLabel(machine, this.props.locale), routeName) + warn :
                this.L.asmBuiltBench(builtLen, routeName, bench) + warn);
        } else if (armRunFor(out.target)) {
            // N4: the hosted ARM chain returns Intel HEX; the STM32F030 light
            // tier and rp2040js take a flash/SRAM image. Same firmware hand-off
            // a compiled sketch takes, on the device's own engine.
            const run = armRunFor(out.target);
            let image;
            try {
                image = imageFromIntelHex(new TextDecoder().decode(out.bytes), run.origin);
            } catch (e) {
                this.setState({busy: false, status: this.L.asmTransportError(routeName, e.message)});
                return;
            }
            const detail = {format: 'firmware', kind: run.kind, target: out.target,
                firmware: {name: 'program.hex', bytes: image, text: null, fCpu: null},
                rom: null, image: null, listing: null};
            try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
            window.dispatchEvent(new CustomEvent('bw-settings-change', {
                detail: {key: 'bw-right-pane-hidden', value: '0'}
            }));
            window.__bwPendingMedia = {type: 'asm', detail};
            window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
            this.setState({busy: false,
                status: this.L.asmBuiltArm(out.bytes.length, routeName, out.target) + warn});
        } else {
            this.setState({busy: false,
                status: this.L.asmBuiltOnly(out.bytes.length, routeName, target) + warn});
        }
    }

    async prepareBlinkCircuit (machine) {
        const response = await fetch(new URL(`examples/${machine.circuit}`, document.baseURI));
        if (!response.ok) throw new Error(`Circuit HTTP ${response.status}`);
        const data = await response.json();
        if (machine.family === '8051') {
            data.parts = data.parts.map(part => part.kind === 'mcu' ?
                {...part, params: {...part.params, chip: machine.device}} : part);
        }
        return new Promise((resolve, reject) => {
            const detail = {data: {...data, fileOnly: true}, asmBlinkReady: {resolve, reject}};
            if (this._unmounted || window.dispatchEvent(new CustomEvent('bw-load-circuit-data', {detail, cancelable: true}))) {
                reject(new Error('The Circuit editor is unavailable'));
            }
        });
    }

    deliverAssembly (detail, blink, status) {
        try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {
            detail: {key: 'bw-right-pane-hidden', value: '0'}
        }));
        if (blink) {
            detail.asmBlink = blink;
            const timeout = setTimeout(() => detail.bootCompletion.reject(new Error('The machine did not start')), 30000);
            detail.bootCompletion = {
                resolve: () => {
                    clearTimeout(timeout);
                    if (!this._unmounted) this.setState({busy: false,
                        ...(window.__bwPendingMedia?.detail === detail ? {status} : {})});
                },
                reject: error => {
                    clearTimeout(timeout);
                    if (!this._unmounted) this.setState({busy: false, status: this.L.stError(error.message)});
                }
            };
        }
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        if (!blink) this.setState({busy: false, status});
    }

    /**
     * ▶ Run on 8086 — the OFFLINE path from blocks to a running machine.
     *
     * Every other device on this tab reaches silicon as C through the hosted
     * compiler: `generateC(project)` and a POST to stc-compiler. There is no
     * 8086 back end behind that URL and there is not going to be one, so
     * this button takes the other road: `lib/bw-asm/pseudocode-8086.js`
     * lowers the blocks to 8086 assembly, `requestAssembly` assembles them
     * in this browser (the same local route `assembleAndRun` uses, argued
     * for in `lib/bw-asm/assemble-route.js`), and the image travels the
     * SAME `bw-asm-rom-ready` → circuit-tab → debug-panel path a hand-written
     * assembly program does. No network is touched at any point, which is
     * the whole claim.
     *
     * THE SOURCE IS PASSED AS WELL AS THE PROJECT, and that is not
     * belt-and-braces. `SB3Creator.parse()` silently DROPS a hardware
     * statement on a DEVICE it does not recognise, so a program with PIN
     * declarations arrives here as an empty script. The back end refuses it
     * by reading the text — see `emitI8086Asm`.
     *
     * A REFUSAL IS DIFFERENT FROM A FAILURE, and the status line says which.
     * `Pseudocode8086Error` means this program uses something the back end
     * does not lower, and the message names the block and lists what does
     * work; anything else is the assembler or a broken module.
     *
     * The generated assembly is left in the ASM tab. A learner who wants to
     * know what their blocks became can go and read it, which is most of the
     * point of having a machine this small.
     */
    async runPseudocodeOn8086 () {
        const src = this.state.buffers.pseudocode || '';
        const editorBuffers = this.state.buffers;
        const sourceDocument = this.codeDocumentSnapshot();
        if (!src.trim()) {
            this.setState({status: this.L.run8086Empty});
            return;
        }
        this.setState({busy: true, status: this.L.run8086Building, output: null});
        let out;
        let blocks = 0;
        try {
            const SB3Creator = (await this.lib()).default;
            const creator = new SB3Creator();
            creator.parse(src);
            const stage = (creator.project.targets || []).find(t => t.isStage);
            blocks = stage ? Object.keys(stage.blocks || {}).length : 0;
            const mod = await import(
                /* webpackChunkName: "bw-pc8086" */ '../../lib/bw-asm/pseudocode-8086.js');
            out = await mod.buildPseudocode8086(
                {project: creator.project, source: src, parseWarnings: creator.warnings});
        } catch (e) {
            this.setState({busy: false, status: e && e.name === 'Pseudocode8086Error'
                ? this.L.run8086Refused(e.message)
                : this.L.run8086Failed(e && e.message ? e.message : String(e))});
            return;
        }
        // `chips` carries hardware requested by the program's declarations.
        const detail = {rom: out.bytes, listing: null, target: out.target,
            slotId: out.slotId, profile: out.profile, format: out.format,
            chips: out.chips};
        try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {
            detail: {key: 'bw-right-pane-hidden', value: '0'}
        }));
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        const warn = out.warnings.length ? this.L.asmWarnings(out.warnings) : '';
        this.setState(st => ({
            busy: false,
            ...this.codeProjectionState(st, sourceDocument, editorBuffers, 'asm', out.asm),
            status: this.L.run8086Built(out.bytes.length, blocks) + warn
        }));
    }

    /**
     * Export the 8086 program beside ▶ Run: the assembled `.COM` (the
     * assembler's exact org-100h bytes) or a bootable 1.44M floppy `.img` that
     * boots the .COM on real PC/XT hardware or another emulator. silicon:
     * export only — not a flash transport (N10).
     */
    async exportI8086 (kind) {
        const src = this.state.buffers.pseudocode || '';
        if (!src.trim()) { this.setState({status: this.L.run8086Empty}); return; }
        this.setState({busy: true, status: ''});
        try {
            const SB3Creator = (await this.lib()).default;
            const creator = new SB3Creator();
            creator.parse(src);
            const mod = await import(
                /* webpackChunkName: "bw-pc8086" */ '../../lib/bw-asm/pseudocode-8086.js');
            const out = await mod.buildPseudocode8086(
                {project: creator.project, source: src, parseWarnings: creator.warnings});
            const {comFilename, imgFilename, buildFloppyImage} = await import(
                /* webpackChunkName: "bw-pc8086" */ '../../lib/bw-asm/i8086-floppy.js');
            const name = this._programName();
            if (kind === 'img') {
                const img = buildFloppyImage(out.bytes);
                this._download(imgFilename(name), img, 'application/octet-stream');
                this.setState({busy: false, status: this.L.export8086ImgDone(img.length)});
            } else {
                this._download(comFilename(name), out.bytes, 'application/octet-stream');
                this.setState({busy: false, status: this.L.export8086ComDone(out.bytes.length)});
            }
        } catch (e) {
            this.setState({busy: false, status: e && e.name === 'Pseudocode8086Error'
                ? this.L.run8086Refused(e.message)
                : this.L.run8086Failed(e && e.message ? e.message : String(e))});
        }
    }

    /** The download basename: the project title if we have one, else 'program'. */
    _programName () {
        const t = (this.props && this.props.projectTitle) || '';
        return String(t).trim() || 'program';
    }

    /**
     * ▶ Run C on 8086 — the C tab's offline route, and the last cell of the
     * 8086 column to close.
     *
     * EVERY OTHER DEVICE COMPILES C BY POSTING IT. `flashToBoard` and the
     * listing view both send the buffer to `stc-compiler /compile`, and for
     * the 8051 `sdcc-wasm/intercept.js` quietly answers that POST locally.
     * Neither works here: that service has no 8086 C back end and is not
     * getting one (ROADMAP §3.8.2b, door 1 is unbuilt), so the choice was a
     * local compiler or no C on this device at all.
     *
     * SmallerC (BSD-2, compiled to WASM) emits NASM `bits 16`;
     * `bw-board/i8086-asm.js` grew a NASM front end; `requestCBuild` is the
     * one place that decides those two are what an `i8086` C build means. The
     * image then travels the SAME `bw-asm-rom-ready` → circuit-tab →
     * debug-panel path that ▶ Assemble & Run and ▶ Run on 8086 use. Nothing
     * is fetched at any point.
     *
     * THE TWO STAGES BOTH NAME WHAT THEY REFUSE, and the status line carries
     * that verbatim rather than replacing it with "compilation failed":
     * smlrc says `Error in "main.c" (1:21) Unexpected token long`, the
     * assembler says `EXTERN "___fixsfsi" cannot be resolved`. Those are the
     * two edges this pipeline actually has (measured in
     * `test/smallerc-to-i8086-asm.test.mjs`) and a learner who meets one
     * should be told which stage met it.
     *
     * The generated assembly is left in the ASM tab, as ▶ Run on 8086 leaves
     * its own — a learner who wants to see what their C became can go and
     * read it.
     */
    async runCOn8086 () {
        const source = this.state.buffers.c || '';
        const editorBuffers = this.state.buffers;
        const sourceDocument = this.codeDocumentSnapshot();
        if (!source.trim()) {
            this.setState({status: this.L.runC8086Empty});
            return;
        }
        const device = this.currentDevice();
        const routeName = cRouteFor(device) === 'local'
            ? this.L.runC8086Route : this.L.asmRouteHosted;
        this.setState({busy: true, status: this.L.runC8086Building, output: null});
        let out;
        try {
            // NO SEAMS. `requestCBuild` defaults to the compiler and the
            // assembler the tests drive; an override here would be a second
            // local path that no gate runs, which is this repo's named
            // recurring defect.
            out = await requestCBuild({source, device});
        } catch (e) {
            this.setState({busy: false, status: e.reason === 'source'
                ? this.L.runC8086Refused(routeName, e.message)
                : this.L.runC8086Failed(routeName, e.message)});
            return;
        }
        const detail = {rom: out.bytes, listing: null, target: out.target,
            slotId: out.slotId, profile: out.profile, format: out.format};
        try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {
            detail: {key: 'bw-right-pane-hidden', value: '0'}
        }));
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        const warn = out.warnings.length ? this.L.asmWarnings(out.warnings) : '';
        this.setState(st => ({
            busy: false,
            ...this.codeProjectionState(st, sourceDocument, editorBuffers, 'asm', out.asm),
            status: this.L.runC8086Built(out.bytes.length, routeName) + warn
        }));
    }

    // Both RISC-V C compilers produce the same loadable image as ASM.
    // fe's own interpreter on RISC-V: one generated C file (bw-lang/fe-target-c.js)
    // on the hosted full-C route, booted like any RISC-V C program.
    runFeOnRiscv () {
        if (!this.activeCode().trim()) return;
        return this.runCOnRiscv('server', feProgramToC(this.activeCode()));
    }

    // Jim Tcl the same way (bw-lang/tcl-target-c.js); its 650 KB source is
    // fetched on demand and checked against the pinned hash, never bundled.
    async runTclOnRiscv () {
        if (!this.activeCode().trim()) return;
        let source;
        try {
            source = await fetchTclProgramC(this.activeCode());
        } catch (e) {
            this.setState({status: this.L.runCRiscvUnavailable(e.message)});
            return;
        }
        return this.runCOnRiscv('server', source);
    }

    // zForth the same way (bw-lang/forth-target-c.js).
    runForthOnRiscv () {
        if (!this.activeCode().trim()) return;
        return this.runCOnRiscv('server', forthProgramToC(this.activeCode()));
    }

    async runCOnRiscv (forceRoute, sourceOverride) {
        const source = typeof sourceOverride === 'string' ? sourceOverride : (this.state.buffers.c || '');
        if (!source.trim()) { this.setState({status: this.L.runCRiscvEmpty}); return; }
        // `forceRoute` (from the "try the server" hint) overrides the picker.
        const route = typeof forceRoute === 'string' ? forceRoute : this.state.riscvCRoute;
        this.setState({busy: true, status: this.L.runCRiscvBuilding, output: null,
            riscvCanRetryServer: false});
        let out;
        try {
            // 'browser' = shecc.wasm (subset, no server); 'server' = hosted full C.
            out = await requestRiscvCBuild({source, route, hostedTarget: 'riscv32-gcc'});
        } catch (e) {
            // 'transport' is the missing/unreachable service (not the user's
            // fault); 'source' is a compile error naming the line. When the
            // BROWSER (subset) compiler rejects a program, the full compiler on
            // the SERVER may still accept it — offer a one-click retry instead
            // of dead-ending on a subset limitation.
            const canRetryServer = route === 'browser' && e.reason === 'source' && !!RISCV_CC_ENDPOINT;
            this.setState({busy: false, riscvCanRetryServer: canRetryServer,
                status: e.reason === 'source'
                    ? this.L.runCRiscvRefused(e.message)
                    : this.L.runCRiscvUnavailable(e.message)});
            return;
        }
        const detail = {rom: null, image: out.image, listing: null, target: 'riscv32',
            slotId: 'riscv', profile: 'riscv', format: 'riscv'};
        try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        // Report WHAT was produced and by WHICH compiler: bytes, segment count,
        // entry, and whether it came from the browser (shecc) or the server (gcc).
        const bytes = out.image.segments.reduce((n, s) => n + s.bytes.length, 0);
        const compiler = out.route === 'local-wasm' ? 'shecc' : 'gcc';
        this.setState({busy: false, riscvCanRetryServer: false,
            status: this.L.runCRiscvBuilt(bytes, out.image.segments.length,
                out.image.entry >>> 0, compiler)});
    }

    /** Load a RISC-V C starter into the C buffer, and preselect the route the
     *  example needs (subset → browser, full C → server). */
    async loadRiscvCExample (id) {
        if (!id) return;
        const ex = riscvCExamplesFor('riscv32').find(e => e.id === id);
        if (!ex) return;
        const current = (this.state.buffers.c || '').trim();
        if (current && !(await confirmAsync(this.L.asmExampleReplace))) return;
        this.setState(state => ({
            ...this.authoredCodeState('c', ex.source, this.currentDevice()),
            riscvCRoute: ex.route || state.riscvCRoute,
            riscvCanRetryServer: false,
            status: this.L.asmExampleLoaded(
                pickLocale(this.props.locale) === 'de' ? ex.labelDe : ex.label)
        }));
    }

    /**
     * ▶ Run C on Z80 (N1) — the C tab's route onto the Z80 bench.
     *
     * The hosted service compiles `sdcc -mz80` for the bench's measured map
     * (ROM $0000-$7FFF, RAM $8000-$FFFF; stock crt0 puts `jp init` at the
     * reset vector) and returns the 32 KB ROM. It boots through the SAME
     * bw-asm-rom-ready → debug-panel path an assembled Z80 program takes, so
     * the bench, the latch LEDs and the debugger are the ones it already has.
     * Hosted, and says so: SDCC is GPL and does not ship in the page.
     */
    async runCOnZ80 () {
        const source = this.state.buffers.c || '';
        if (!source.trim()) { this.setState({status: this.L.runCRiscvEmpty}); return; }
        this.setState({busy: true, status: this.L.runCZ80Building, output: null});
        let out;
        try {
            out = await this.hostedCompileC(source, 'z80', 'bin');
        } catch (e) {
            const message = e && e.message ? e.message : String(e);
            const transport = (e && e.name === 'TypeError') || /failed to fetch|network/i.test(message);
            this.setState({busy: false, output: (e && e.log) || null,
                status: transport ? this.L.runCZ80Unavailable(message) : this.L.runCZ80Refused(message)});
            return;
        }
        const rom = Uint8Array.from(atob(out.base64), c => c.charCodeAt(0));
        const detail = {rom, image: null, listing: null, target: 'z80', slotId: 'rom', profile: null, format: 'rom'};
        try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        this.setState({busy: false, status: this.L.runCZ80Built(rom.length)});
    }

    /**
     * ▶ Run sketch — a hand-written Arduino sketch, compiled and running.
     *
     * The C tab on an AVR board otherwise reads its buffer back into blocks,
     * and that reader refuses what blocks cannot say: `Serial`, `String`, a
     * class, `#include <Wire.h>`. This compiles the buffer AS A SKETCH instead:
     * stc-compiler's `arduino` route builds it the way the Arduino IDE does,
     * real C++ against the Arduino core, and hands back an Intel HEX image.
     * That image boots through the debug panel's firmware path on the board's
     * own engine (avr8js for the ATmegas), where Serial output reaches the
     * serial console. Hosted, and says so: avr-gcc cannot run in the page.
     *
     * The mapping and the failure classes live in lib/bw-debug/arduino-sketch.js;
     * the compile itself is this component's ONE hosted compile, called here
     * by name so it counts as the caller it is.
     */
    async runSketchOnAvr () {
        const source = this.state.buffers.c || '';
        if (!source.trim()) { this.setState({status: this.L.runSketchEmpty}); return; }
        const device = this.currentDevice();
        this.setState({busy: true, status: this.L.runSketchBuilding, output: null});
        let built;
        try {
            built = await requestSketchBuild({
                source, device,
                compile: async (code, target, format, language, extra) =>
                    await this.hostedCompileC(code, target, format, language, extra)
            });
        } catch (e) {
            // A refusal is the sketch's, and the compiler's own words name
            // the line (`main.ino:12: error: ...`); a transport failure is
            // not something an edit fixes. The full log goes to the output
            // pane either way.
            this.setState({busy: false, output: (e && e.log) || null,
                status: e && e.reason === 'source'
                    ? this.L.runSketchRefused(e.message)
                    : this.L.runSketchUnavailable(e && e.message ? e.message : String(e))});
            return;
        }
        if (built.kind === 'arduboy') {
            // The Arduboy's engine is its console: the same hand-off a picked
            // Arduboy .hex takes, screen and buttons included.
            this.runArduboyProgram(built.hex, 'sketch.hex');
            this.setState({busy: false, output: null,
                status: this.L.runSketchBuiltArduboy(built.bytes, built.libraries)});
            return;
        }
        const detail = {format: 'avr-sketch', target: built.target, kind: built.kind,
            firmware: sketchFirmware(built), rom: null, image: null, listing: null};
        try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        const mismatch = built.builtForHz && built.builtForHz !== built.clockHz
            ? this.L.runSketchClockMismatch(built.builtForHz, built.clockHz) : '';
        this.setState({busy: false,
            output: built.prototypes.length ? built.prototypes.join('\n') : null,
            status: this.L.runSketchBuilt(built.bytes, built.libraries, built.prototypes.length) + mismatch});
    }

    /** Load an Arduino C++ starter sketch into the C buffer. */
    async loadArduinoSketchExample (id) {
        if (!id) return;
        const ex = arduinoSketchExamplesFor(this.currentDevice()).find(e => e.id === id);
        if (!ex) return;
        const current = (this.state.buffers.c || '').trim();
        if (current && !(await confirmAsync(this.L.asmExampleReplace))) return;
        this.setState({
            ...this.authoredCodeState('c', ex.source, this.currentDevice()),
            status: this.L.asmExampleLoaded(
                pickLocale(this.props.locale) === 'de' ? ex.labelDe : ex.label)
        });
    }

    /**
     * Compile the BASIC buffer to an 8086 .COM and boot it on the DOS bench —
     * the BASIC counterpart of runCOn8086. Reached only from the 'i8086' BASIC
     * profile; the 6502/Z80 profiles keep the ROM-interpreter path in runBasic.
     * device is 'i8086' by construction (the profile is the deliberate choice to
     * target the 8086), so it does not depend on the machine selector.
     */
    async runBasicOn8086 (code) {
        const source = code != null ? code : this.activeCode();
        const editorBuffers = this.state.buffers;
        const sourceDocument = this.codeDocumentSnapshot();
        if (!source.trim()) return;
        this.setState({busy: true, running: true, status: this.L.basic8086Building,
            output: null, basicRawOutput: '', basicIsBbc: false});
        let out;
        try {
            out = await requestBasicBuild({source, device: 'i8086'});
        } catch (e) {
            this.setState({busy: false, running: false, status: e.reason === 'source'
                ? this.L.basic8086Refused(e.message)
                : this.L.basic8086Failed(e.message)});
            return;
        }
        const detail = {rom: out.bytes, listing: null, target: out.target,
            slotId: out.slotId, profile: out.profile, format: out.format};
        try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {
            detail: {key: 'bw-right-pane-hidden', value: '0'}
        }));
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        const warn = out.warnings.length ? this.L.asmWarnings(out.warnings) : '';
        this.setState(st => ({
            busy: false, running: false,
            ...this.codeProjectionState(st, sourceDocument, editorBuffers, 'asm', out.asm),
            status: this.L.runC8086Built(out.bytes.length, this.L.runC8086Route) + warn
        }));
    }

    /**
     * Compile BASIC and run it on a REAL booted MS-DOS 2.0 kernel (not the fast
     * INT 21h service bench): the same requestBasicBuild produces the .COM, the
     * browser-safe FAT12 injector (bw-board/dos-fat-inject) drops it as PROG.COM
     * onto a copy of the prebuilt MIT MS-DOS 2.0 boot image (a static asset), and
     * the DOS bench boots that disk — the boot sector loads IO.SYS -> MSDOS.SYS
     * -> COMMAND.COM, which runs PROG from AUTOEXEC.BAT. Nothing here touches
     * the receipt-pinned image BUILDER; it only injects into a prebuilt image.
     */
    async runBasicOnRealDos (code) {
        const source = code != null ? code : this.activeCode();
        const editorBuffers = this.state.buffers;
        const sourceDocument = this.codeDocumentSnapshot();
        if (!source.trim()) return;
        this.setState({busy: true, running: true, status: this.L.basicRealDosBuilding,
            output: null, basicRawOutput: '', basicIsBbc: false});
        let out;
        try {
            out = await requestBasicBuild({source, device: 'i8086'});
        } catch (e) {
            this.setState({busy: false, running: false, status: e.reason === 'source'
                ? this.L.basic8086Refused(e.message) : this.L.basic8086Failed(e.message)});
            return;
        }
        let disk;
        try {
            const [inj, res] = await Promise.all([
                import(/* webpackChunkName: "bw-debug-i8086" */ 'bw-board/dos-fat-inject.js'),
                fetch('static/dos/msdos200-base.img'),
            ]);
            if (!res.ok) throw new Error(`base image HTTP ${res.status}`);
            const base = new Uint8Array(await res.arrayBuffer());
            disk = inj.injectFile(base, 'PROG.COM', out.bytes);
            disk = inj.injectFile(disk, 'AUTOEXEC.BAT', new TextEncoder().encode('PROG\r\n'));
        } catch (e) {
            this.setState({busy: false, running: false, status: this.L.basicRealDosFailed(e.message)});
            return;
        }
        const detail = {rom: disk, listing: null, target: 'i8086', slotId: 'disk', profile: 'dos', format: 'disk'};
        try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
        window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: 'bw-right-pane-hidden', value: '0'}}));
        window.__bwPendingMedia = {type: 'asm', detail};
        window.dispatchEvent(new CustomEvent('bw-asm-rom-ready', {detail}));
        this.setState(st => ({busy: false, running: false,
            ...this.codeProjectionState(st, sourceDocument, editorBuffers, 'asm', out.asm),
            status: this.L.basicRealDosBooted(out.bytes.length)}));
    }

    /**
     * Run BASIC on a REAL, LIBRE DOS-native interpreter — the third 8086 BASIC
     * path, and the only one where the LANGUAGE ITSELF runs on the machine
     * rather than being compiled to a .COM. uBASIC (Adam Dunkels; Danyil Bohdan
     * fork, BSD-3-Clause) is cross-compiled with ia16-elf-gcc to a 16-bit MS-DOS
     * .EXE (media-lab project `ubasic-dos`, shipped here as static/roms/ubasic.exe).
     *
     * The mechanism is dos-compile.js: `runDosToolchain('ubasic', …)` mounts the
     * user's program as PROG.BAS on the DOS disk, runs UBASIC.EXE on the bw-board
     * 8086 DOS service bench (INT 21h file I/O), and the interpreter reads PROG.BAS
     * and PRINTS as it runs. Being an interpreter it produces no output FILE, so
     * the screen comes back on the compile stage. The interpreter needs the 80186
     * core (ia16 emits LEAVE/PUSH imm/IMUL); the route pins `variant: '80186'`.
     *
     * Unlike runBasicOn8086 / runBasicOnRealDos (which build a .COM and hand it to
     * the right-pane debug bench), this route runs entirely here and shows the
     * captured screen inline in the output area — the same place the BBC/6502
     * ROM-interpreter path writes to.
     */
    async runBasicOnDosInterp (code) {
        const source = code != null ? code : this.activeCode();
        if (!source.trim()) return;
        this.setState({output: '', running: true, busy: true,
            status: this.L.basicUbasicRunning, basicRawOutput: '', basicIsBbc: false});
        try {
            const r = await runDosToolchain('ubasic', source, {
                // The interpreter binary is shipped as a static ROM (BSD-3-Clause,
                // provenance beside it) — fetched, never bundled into the JS.
                fetchToolchain: async () => {
                    const res = await fetch('static/roms/ubasic.exe');
                    if (!res.ok) throw new Error(`ubasic.exe HTTP ${res.status}`);
                    return {compiler: new Uint8Array(await res.arrayBuffer())};
                },
                maxSteps: 40_000_000
            });
            const stage = r.run || r.compile;
            const screen = (stage && stage.screen) || '';
            this.setState({output: screen.trim() || '(no output)', running: false, busy: false, status: ''});
        } catch (e) {
            this.setState({output: `Error: ${e.message}`, running: false, busy: false,
                status: this.L.basicUbasicFailed(e.message)});
        }
    }

    /**
     * Run fe (rxi's tiny Lisp) through fe.exe on the DOS bench
     * (DOS_TOOLCHAINS 'fe'), mirroring runBasicOnDosInterp: the interpreter
     * reads PROG.FE (INT 21h) and prints during its run, so the output is the
     * compile-stage screen (no output file).
     */
    async runFeOnDosInterp (code) {
        const source = code != null ? code : this.activeCode();
        if (!source.trim()) return;
        this.setState({output: '', running: true, busy: true, status: this.L.feRunning});
        try {
            const r = await runDosToolchain('fe', source, {
                // Shipped as a static ROM (MIT, provenance beside it) — fetched,
                // never bundled into the JS.
                fetchToolchain: async () => {
                    const res = await fetch('static/roms/fe.exe');
                    if (!res.ok) throw new Error(`fe.exe HTTP ${res.status}`);
                    return {compiler: new Uint8Array(await res.arrayBuffer())};
                },
                maxSteps: 60_000_000
            });
            const stage = r.run || r.compile;
            const screen = (stage && stage.screen) || '';
            this.setState({output: screen.trim() || '(no output)', running: false, busy: false, status: ''});
        } catch (e) {
            this.setState({output: `Error: ${e.message}`, running: false, busy: false,
                status: this.L.feFailed(e.message)});
        }
    }

    /**
     * Run Forth through zForth's forth.exe on the DOS bench (DOS_TOOLCHAINS
     * 'forth'), mirroring runFeOnDosInterp: the interpreter reads PROG.FTH
     * (INT 21h) and prints during its run, so the output is the compile-stage
     * screen (no output file). zForth's core.zf bootstrap is embedded in the
     * binary; maxSteps is higher than fe/Tcl because the soft-float bootstrap
     * runs before the user program.
     */
    async runForthOnDosInterp (code) {
        const source = code != null ? code : this.activeCode();
        if (!source.trim()) return;
        this.setState({output: '', running: true, busy: true, status: this.L.forthRunning});
        // GPIO bridge: the DOS Forth's `pin!` word OUTs to 0x378+pin (8 pins).
        // Decode those writes and drive the Widgets pane's GPIO strip through the
        // same bw-fpga-leds/bw-fpga-output event pump the FPGA tab uses, so a
        // `set pin N high/low` program lights visible LEDs. No new widget code.
        const GPIO_BASE = 0x378;
        const seenPins = new Set();
        const onPortAccess = ev => {
            if (!ev || ev.dir !== 'out') return;
            if (ev.port < GPIO_BASE || ev.port > GPIO_BASE + 7) return;
            const pin = ev.port - GPIO_BASE;
            const high = (ev.value & 0xff) !== 0;
            seenPins.add(pin);
            if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
            window.dispatchEvent(new CustomEvent('bw-fpga-leds',
                {detail: {pins: [...seenPins].sort((a, b) => a - b)}}));
            window.dispatchEvent(new CustomEvent('bw-fpga-output',
                {detail: {leds: [{pin, high}]}}));
        };
        try {
            const r = await runDosToolchain('forth', source, {
                fetchToolchain: async () => {
                    const res = await fetch('static/roms/forth.exe');
                    if (!res.ok) throw new Error(`forth.exe HTTP ${res.status}`);
                    return {compiler: new Uint8Array(await res.arrayBuffer())};
                },
                maxSteps: 200_000_000,
                onPortAccess
            });
            const stage = r.run || r.compile;
            const screen = (stage && stage.screen) || '';
            this.setState({output: screen.trim() || '(no output)', running: false, busy: false, status: ''});
        } catch (e) {
            this.setState({output: `Error: ${e.message}`, running: false, busy: false,
                status: this.L.forthFailed(e.message)});
        }
    }

    /**
     * Run Tcl through Jim Tcl's jim.exe on the DOS bench (DOS_TOOLCHAINS
     * 'jim'), mirroring runFeOnDosInterp: the interpreter reads PROG.TCL
     * (INT 21h) and prints during its run, so the output is the compile-stage
     * screen (no output file). Jim, not partcl: the tab reads and writes real
     * Tcl (expr, lists, dicts, strings), and partcl has none of those. Jim's
     * Tcl-coded library is a second file, JIMLIB.TCL, read on first use.
     */
    async runTclOnDosInterp (code) {
        const source = code != null ? code : this.activeCode();
        if (!source.trim()) return;
        this.setState({output: '', running: true, busy: true, status: this.L.tclRunning});
        try {
            const r = await runDosToolchain('jim', source, {
                // Shipped as static files (BSD-2, provenance beside them) —
                // fetched, never bundled into the JS.
                // Both paths literal, so the ROM census sees them.
                fetchToolchain: async () => {
                    const bytes = async res => {
                        if (!res.ok) throw new Error(`${res.url} HTTP ${res.status}`);
                        return new Uint8Array(await res.arrayBuffer());
                    };
                    const [compiler, lib] = await Promise.all([
                        fetch('static/roms/jim.exe').then(bytes),
                        fetch('static/roms/jimlib.tcl').then(bytes)
                    ]);
                    return {compiler, support: {'JIMLIB.TCL': lib}};
                },
                maxSteps: 60_000_000
            });
            const stage = r.run || r.compile;
            const screen = (stage && stage.screen) || '';
            this.setState({output: screen.trim() || '(no output)', running: false, busy: false, status: ''});
        } catch (e) {
            this.setState({output: `Error: ${e.message}`, running: false, busy: false,
                status: this.L.tclFailed(e.message)});
        }
    }

    /**
     * Which chips an assembly source needs, from a declaration IN the source.
     *
     * `; BW-CHIPS: ne2000@320` on any line asks the bench for that card. It is
     * a comment, so it assembles everywhere and means something only here --
     * the same trick a `#pragma` plays, and the reason an example can request
     * hardware without inventing an assembler directive that MASM would
     * reject.
     *
     * NOT INFERRED FROM THE CODE. A source that happens to `OUT 320h` gets
     * nothing: guessing hardware from port writes would give a learner a card
     * they did not ask for and hide the fact that a board needs one.
     */
    asmChipsForSource (src) {
        const out = [];
        const seen = new Set();
        for (const m of String(src || '').matchAll(/^\s*;\s*BW-CHIPS:\s*(.+)$/gim)) {
            for (const spec of m[1].split(',')) {
                const bits = spec.trim().match(/^([a-z0-9]+)(?:@([0-9a-f]+))?$/i);
                if (!bits) continue;
                const kind = bits[1].toLowerCase();
                const at = bits[2] ? parseInt(bits[2], 16) : undefined;
                // KEYED ON KIND AND ADDRESS, not kind alone. Two cards at two
                // ports on one board is the whole point of a hub, and the
                // first version deduplicated by kind -- silently dropping the
                // second card and leaving an example that talks to nobody.
                const key = `${kind}@${at === undefined ? '-' : at}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const chip = {kind, name: `${kind}${out.filter(c => c.kind === kind).length}`};
                if (at !== undefined) chip.at = at;
                out.push(chip);
            }
        }
        // A card with no link hears nothing. ONE card gets a loopback, which
        // is what a real card's self-test uses; SEVERAL get a shared hub, so
        // they hear each other and the MAC filter becomes the visible thing.
        const cards = out.filter(c => c.kind === 'ne2000');
        if (cards.length === 1) cards[0].loopback = true;
        else if (cards.length > 1) for (const c of cards) c.hub = true;
        return out;
    }

    // Keil C51 gives itself away: keywords SDCC spells differently, and its register headers.
    looksLikeKeil (src) {
        return /\bsbit\s+\w+\s*=|\bsfr\s+\w+\s*=|\b_at_\b|#include\s*<\s*reg5\d|\bdata\s+\w+\s*;|\bcode\s+\w+\s*\[/.test(src);
    }

    async translateKeil (src) {
        try {
            const r = await fetch('https://stc-compiler.vercel.app/translate', {
                method: 'POST', headers: {'content-type': 'application/json'},
                body: JSON.stringify({code: src, target: 'stc12c5a60s2'})
            });
            if (!r.ok) return {ok: false, error: `HTTP ${r.status}`};
            const b = await r.json();
            // The SDCC source is in `c`; `translated` is a stats object ({include: 1, sbit: 2}).
            return b.c ? {ok: true, code: b.c, stats: b.translated} : {ok: false, error: 'no translation returned'};
        } catch (e) {
            return {ok: false, error: e.message};
        }
    }



    allowsCodeLanguage (lang) {
        return codeLanguageAvailable(lang, this.codeDevice(), {
            remoteImages: remoteMachineImagesAllowed(), riscvHosted: remoteToolchainsAllowed() && Boolean(RISCV_CC_ENDPOINT)
        });
    }

    codeDevice () {
        return this.state.libraryTarget || (this.state.lang === 'asm' && this.state.asmRunDevice) || this.currentDevice();
    }

    // Target belongs to the authored document, including while its Pseudo view
    // is absent after editing Python/JS. A legacy source loader is reconciled
    // by codeDocumentSnapshot before it is saved or executed.
    currentDevice () {
        if (this.state.codeDocument) return this.codeDocumentSnapshot().target;
        const src = this.state.buffers.pseudocode || '';
        const m = src.match(/^DEVICE\s+([\w-]+)/im);
        return m ? m[1].toLowerCase() : null;
    }

    // Publish the device of the successfully loaded project, not a tentative
    // editor header. The stage header listens to this event to offer its console.
    publishAppliedDevice (stc) {
        const runtime = this.props.vm && this.props.vm.runtime;
        const deviceId = typeof stc?.device === 'string' ? stc.device.toLowerCase() : '';
        const info = DEVICE_BY_ID[deviceId];
        if (runtime) {
            runtime.bwDeviceCore = info ? info.core : null;
            runtime.bwDeviceId = deviceId || null;
        }
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('bw-settings-change', {
                detail: {key: 'bw-device-id', value: deviceId}
            }));
        }
    }

    // Set the DEVICE in the pseudocode buffer. When the code has PIN declarations,
    // retargetPseudocode rewrites them to the target's conventional pins and reports
    // any hard blockers ("no ADC on this chip"). Code without pins just gets its
    // DEVICE line rewritten — there is nothing to refuse.
    async setDevice (deviceId) {
        if (deviceId !== '__manage__' && this.state.asmRunDevice) this.setState({asmRunDevice: null});
        if (this.state.libraryProgram && deviceId !== '__manage__') this.setState({libraryProgram: null});
        if (deviceId === 'kosmos-cp1') return this.openCp1Language();
        if (deviceId === '__manage__') {
            this.setState({actionsOpen: false});
            // The "Manage machines…" entry is a command, not a device: open the
            // library modal (gui.jsx owns it) and leave the current device as-is,
            // so the controlled <select> snaps back to the real selection.
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bw-open-machine-manager'));
            }
            return;
        }
        this.leaveCp1();
        this.leaveCardiac();
        this.setState({libraryTarget: null, kim1Active: false, microtronicActive: false, langMenuOpen: false});
        // Selecting an execution target for authored text does not recompile
        // an unrelated Pseudo projection or replace the visible source.
        const document = this.codeDocumentSnapshot();
        const request = {};
        this._deviceRequest = request;
        const buffers = this.state.buffers;
        const vm = this.props.vm;
        const ownsRequest = () => !this._unmounted && this._deviceRequest === request && this.props.vm === vm;
        const ownsEditor = () => ownsRequest() && this.state.buffers === buffers;
        if (document.lang !== 'pseudocode') {
            if (deviceId && !DEVICE_BY_ID[deviceId]) return;
            this._codeRestoreError = null;
            this.setState({...this.codeDocumentState(editCodeDocument(document, {
                lang: document.lang, code: document.code, target: deviceId || null,
                runtime: this.codeRuntimeFor(document.lang, deviceId || null)
            })), status: '', showCatalog: Boolean(deviceId)});
            if (deviceId) this.loadCatalog();
            return;
        }
        if (!deviceId) {
            // "no chips" — pure Scratch stage mode. Drop the DEVICE line and the
            // runtime device hints; "Load example…" goes back to the stage games.
            this.setState({...this.retargetCodeState(document.code.replace(/^DEVICE\s+[\w-]+[^\n]*\n?/im, ''),
                'pseudocode'), showCatalog: false, status: ''});
            this.publishAppliedDevice(null);
            return;
        }
        const info = DEVICE_BY_ID[deviceId];
        if (!info) return;
        this.loadCatalog();
        const src = this.state.buffers.pseudocode || '';
        // PIN or PART: a 74HC595 chaser declares no PIN lines yet claims
        // three pins through its PART binding. The PIN-only test meant
        // switching the device on such a program silently kept DEVICE
        // STC12 — 'we choose Nano, we get stc12' (owner, repeatedly).
        const hasPins = /^\s*(PIN|PART)\s/im.test(src);

        // Retargeting remaps MCU pin idioms, and only a device with a pin pool
        // has any to remap. A CPU bench like the i8086 DOS bench has none, so
        // pushing it through retargetPseudocode returns "unknown device" and the
        // switch is aborted — the dropdown snaps back and the device looks
        // unselectable. Such a device just gets its DEVICE line rewritten (the
        // no-pins path below); its PIN/PART lines are inert on the bench, which
        // runs through the 8086 ASM/BASIC toolchain, not GPIO. Gated on the pool
        // table, not a hardcoded id, so any future pool-less core behaves too.
        let SB3Creator = null;
        let canRetarget = false;
        if (hasPins) {
            SB3Creator = (await this.lib()).default;
            if (!ownsEditor()) return;
            canRetarget = !!(SB3Creator.RETARGET_POOLS && SB3Creator.RETARGET_POOLS[deviceId]);
        }

        if (hasPins && canRetarget) {
            const result = SB3Creator.retargetPseudocode(src, deviceId);
            if (result.ok) {
                // Retargeting the text is only half of the operation. The
                // circuit tab must have the matching generated/reseated bench
                // before we commit the new DEVICE, or it would keep showing
                // the previous MCU with freshly retargeted firmware.
                const ex = this._lastCatalogExample;
                const sourceDevice = (src.match(/^DEVICE\s+([\w-]+)/im) || [])[1] || '';
                const resolvedBench = ex
                    ? resolveExampleBench(ex, deviceId, sourceDevice)
                    : null;
                if (resolvedBench && resolvedBench.error) {
                    this.setState({status: `Cannot retarget to ${info.label}: ${resolvedBench.error}`});
                    return;
                }
                this.setState({
                    // Generated MicroPython belongs to the old device/source.
                    // Clear it atomically with the retarget so an immediate
                    // tab switch derives the newly rewritten example instead
                    // of reusing a stale (or failed) prior build.
                    ...this.retargetCodeState(result.pseudocode),
                    status: result.warnings.length
                        ? `Retargeted to ${info.label}: ${result.warnings.join('; ')}`
                        : `Retargeted to ${info.label}.`
                }, () => {
                    if (!ownsRequest()) return;
                    // The switch must produce a RUNNABLE project and a
                    // matching bench, exactly like loading an example does —
                    // retargeting only the text left the VM and the Circuit
                    // tab on the old device.
                    Promise.resolve(this.compile({pseudocode: result.pseudocode})).catch(() => {});
                    const bench = resolvedBench && resolvedBench.retargeted
                        ? resolvedBench.path
                        : null;
                    if (bench && typeof window !== 'undefined') {
                        const detail = {benchPath: bench, exampleId: ex.id, device: deviceId};
                        window.__bwExampleBench = detail;
                        window.dispatchEvent(new CustomEvent('bw-example-bench', {detail}));
                    }
                });
            } else {
                this.setState({status: `Cannot retarget to ${info.label}: ${result.reasons.join('; ')}`});
                return; // don't switch — the reasons explain why
            }
        } else {
            const line = `DEVICE ${deviceId.toUpperCase()}`;
            let nextSource = '';
            await new Promise(resolve => this.setState(s => {
                if (!ownsRequest()) return null;
                const buf = s.buffers.pseudocode || '';
                let next;
                if (/^DEVICE\s+[\w-]+/im.test(buf)) {
                    next = buf.replace(/^DEVICE\s+[\w-]+.*$/im, line);
                } else {
                    next = line + '\n' + buf;
                }
                nextSource = next;
                return this.retargetCodeState(next);
            }, resolve));
            if (!ownsRequest()) return;
            // A sensor/display-only example has no PIN/PART declaration, but
            // it is still a runnable program. The old no-pins route rewrote
            // only the editor text, leaving the VM and generated MicroPython
            // on the previous device. Compile this route too, and await it so
            // the Calliope tab cannot open onto an empty/stale derivation.
            if (deviceId === 'riscv32') {
                this.publishAppliedDevice({device: deviceId});
                return;
            }
            await this.compile({pseudocode: nextSource});
            if (!ownsRequest()) return;
            if (['microbit', 'calliopemini'].includes(deviceId)) {
                const sourceDocument = this.codeDocumentSnapshot();
                const currentBuffers = this.state.buffers;
                const generated = await this.deriveBuffer(nextSource, 'pseudocode', 'micropython');
                if (!generated.error) {
                    await new Promise(resolve => this.setState(s => ownsRequest() && s.buffers === currentBuffers ?
                        this.codeDocumentState(selectCodeDocumentLanguage(addCodeProjection(sourceDocument, {
                            lang: 'micropython', code: generated.code, sourceRevision: sourceDocument.revision,
                            options: generated.options || this.genOpts('micropython'), diagnostics: generated.diagnostics || null
                        }), s.lang, {runtime: this.codeRuntimeFor(s.lang, sourceDocument.target)})) : null, resolve));
                }
            }
        }
        // compile() publishes the applied project's device after loadProject.
        // A refused or failed retarget must retain the running project's hints.
    }

    // Real hardware, two minutes: generate MicroPython and push it to a
    // Pico over WebSerial (raw REPL, main.py — survives reboot). WebSerial
    // is Chromium-only, so everywhere else this degrades to downloading
    // main.py with a hint at Thonny / `bw flash`. The protocol core lives
    // in pico-repl.js (vendored from sb3-creator, tested against a mock).
    async runSpikeUsb (probeOnly = false) {
        const source = probeOnly ? '' : (this.state.buffers.pseudocode || '');
        if (!probeOnly && !source.trim()) return;
        this.setState({busy: true, status: probeOnly ? this.L.spikeUsbProbing : this.L.spikeUsbRunning, output: ''});
        try {
            const usb = await import(/* webpackChunkName: "spike-usb-stream" */ '../../lib/spike-usb-stream.js');
            let result;
            if (this.state.spikeUsbRoute === 'bridge') {
                if (!this.state.spikeUsbBridgeUrl || !this.state.spikeUsbBridgeToken) {
                    throw new Error('Enter the Mac bridge URL and token');
                }
                result = await usb.runSpikeUsbBridge(source,
                    this.state.spikeUsbBridgeUrl, this.state.spikeUsbBridgeToken);
                this.setState({output: result.lines.join('\n')});
            } else {
                const lines = [];
                result = await usb.runSpikeUsbDirect(source, {onLine: line => {
                    lines.push(line);
                    this.setState({output: lines.join('\n')});
                }});
            }
            const ports = Object.entries(result.ports).map(([p, type]) =>
                `${p}: ${usb.SPIKE_USB_NAMES[type] || 'empty'}`).join(' · ');
            this.setState({busy: false, status: this.L.spikeUsbDone(result.firmware, ports)});
        } catch (error) {
            const cancelled = error && error.name === 'NotFoundError';
            this.setState({busy: false, status: cancelled ? '' : this.L.spikeUsbFail(error.message)});
        }
    }

    async deployToPico () {
        if (this._picoBasicHardware) await this.closePicoBasicHardware();
        const src = this.state.buffers.pseudocode || '';
        if (!src.trim()) return;
        this.setState({busy: true, status: ''});
        try {
            const SB3Creator = (await this.lib()).default;
            const creator = new SB3Creator();
            creator.parse(src);
            const r = creator.generateMicroPython();
            if (!r.ok) {
                this.setState({busy: false,
                    status: this.L.deployPicoFail((r.reasons || []).join('; ') || 'not expressible in MicroPython')});
                return;
            }
            const tauri = await import(
                /* webpackChunkName: "pico-repl" */ '../../lib/pico-tauri-transport.js');
            if (tauri.available()) {
                // Desktop app: native serial through the Rust commands —
                // works in Safari-engine webviews and driverless on Windows.
                const ports = await tauri.listPorts();
                if (!ports.length) {
                    const inBootsel = await tauri.bootselVolume().catch(() => false);
                    this.setState({busy: false, status: inBootsel
                        ? this.L.deployPicoBootsel
                        : this.L.deployPicoNoPort});
                    return;
                }
                const path = ports.find(p => /usbmodem|ttyACM/i.test(p)) || ports[0];
                const {createPicoRepl} = await import(
                    /* webpackChunkName: "pico-repl" */ '../../lib/pico-repl.js');
                const transport = await tauri.openTransport(path);
                try {
                    await createPicoRepl(transport).deployMainPy(r.py);
                    this.setState({busy: false, status: this.L.deployPicoDone});
                } finally {
                    await transport.close().catch(() => {});
                }
            } else if (typeof navigator !== 'undefined' && navigator.serial) {
                // Chromium: straight onto the board. 0x2e8a = Raspberry Pi.
                const port = await navigator.serial.requestPort({filters: [{usbVendorId: 0x2e8a}]});
                await port.open({baudRate: 115200});
                const {webSerialTransport, createPicoRepl} = await import(
                    /* webpackChunkName: "pico-repl" */ '../../lib/pico-repl.js');
                const transport = webSerialTransport(port);
                try {
                    await createPicoRepl(transport).deployMainPy(r.py);
                    this.setState({busy: false, status: this.L.deployPicoDone});
                } finally {
                    await transport.close().catch(() => {});
                }
            } else {
                // Safari & friends: hand over main.py and say why.
                await downloadBlob('main.py', new Blob([r.py], {type: 'text/x-python'}));
                this.setState({busy: false, status: this.L.deployPicoSaved});
            }
        } catch (e) {
            // A cancelled port picker is a choice, not an error.
            const cancelled = e && (e.name === 'NotFoundError' || /No port selected/i.test(e.message));
            this.setState({busy: false, status: cancelled ? '' : this.L.deployPicoFail(e.message)});
        }
    }

    /** STM32 over SWD via a CMSIS-DAP probe (WebUSB) — the bootloader-free
     *  alternative to the AN3155 UART path. No BOOT0, no reset button. */
    async flashStm32ViaSwd () {
        const src = this.state.buffers.pseudocode || '';
        if (!src.trim()) return;
        if (typeof navigator === 'undefined' || !navigator.usb) {
            this.setState({status: this.L.flashNoWebUsb});
            return;
        }
        this.setState({busy: true, status: this.L.flashCompiling});
        try {
            const SB3Creator = (await this.lib()).default;
            const creator = new SB3Creator();
            creator.parse(src);
            const cSrc = creator.generateC(creator.project, {debug: false});
            const out = await this.hostedCompileC(cSrc, 'stm32f030', 'bin');
            const raw = Uint8Array.from(atob(out.base64), c => c.charCodeAt(0));
            const flasher = await import(/* webpackChunkName: "bw-flasher" */ '../../lib/flasher.js');
            const lines = [];
            const log = (t) => { lines.push(t); this.setState({output: lines.join('\n')}); };
            this.setState({status: this.L.flashSwdHint});
            const device = await navigator.usb.requestDevice({filters: []});
            this.setState({status: this.L.flashing});
            const done = await flasher.flashSwdStm32(device, raw, {log});
            this.setState({busy: false, status: this.L.flashDone(done.bytes)});
        } catch (e) {
            const cancelled = e && (e.name === 'NotFoundError' || /No device selected/i.test(e.message));
            this.setState({busy: false, status: cancelled ? this.L.flashNoPort : this.L.flashFail(e.message)});
        }
    }

    /** Which serial-flash family a device belongs to, or null when it has
     *  no serial bootloader (needs an external programmer). One place, so
     *  the button's enablement and the flasher agree. */
    flashFamily (device) {
        const d = String(device || '').toLowerCase();
        if (d === 'pico') return 'micropython';        // handled by deployToPico
        if (d === 'stm32f030') return 'stm32';
        if (/^stc/.test(d)) return 'stc';
        // optiboot STK500v1 boards: pulsed on DTR and flashed over the Arduino
        // bootloader. The Mega is NOT one of them — its stk500boot speaks
        // STK500v2, a different protocol, which flasher.js DOES implement
        // (flashAvrMega); it routes to its own 'avr-mega' family just below,
        // matching the matrix's stk500v2-webserial transport for arduino-mega.
        if (['arduino-uno', 'arduino-nano', 'atmega328p', 'atmega168p'].includes(d)) return 'avr';
        if (['arduino-mega', 'atmega2560'].includes(d)) return 'avr-mega';  // STK500v2, via flashAvrMega
        // ATtiny has no bootloader; a USBasp/USBISP dongle flashes it over
        // the ICSP header (WebUSB). The same path flashes any AVR too, but
        // those default to their bootloader above.
        if (['attiny85', 'attiny88'].includes(d)) return 'isp';
        // 6502/Z80 breadboards: no bootloader — the ROM is burned on a
        // Ben Eater EEPROM programmer running bweep.ino over serial.
        if (['eater6502', '6502', 'w65c02', 'z80'].includes(d)) return 'eeprom';
        return null;
    }

    /** The Pico's C silicon half (L2): a C-tab program compiles to a bare-metal
     *  RP2040 image on the hosted service, which /uf2 wraps as a UF2 container
     *  the RP2040 bootrom drag-flashes over BOOTSEL. The REPL path (deployToPico)
     *  cannot serve this — a bin is not a .py. Origin is the image's own load
     *  address (0x20000000, the SRAM layout the rp2040 target links and the sim
     *  runs); a flash-resident image with boot2 is the functional follow-up, out
     *  of L2's scope — L2 delivers the route and the UF2 offer. */
    /**
     * The ONE hosted C compile in this component. Every caller that needs
     * stc-compiler's /compile goes through here — flashToBoard, the STM32 SWD
     * path and the Pico UF2 deploy — so the URL literal exists once, the
     * sdcc-wasm intercept sees every 8051 request, and a gate can count call
     * sites instead of trusting a comment. Throws with the service's message.
     * @param {string} code C source
     * @param {string} target the service's target id
     * @param {string} format 'ihx' | 'hex' | 'bin'
     * @param {string} [language] 'c' (the default), or 'arduino' for a sketch
     *     compiled as C++ against the Arduino core (runSketchOnAvr)
     * @param {object} [extra] further request fields, e.g. {symbols: true}
     * @returns {Promise<object>} the service's successful response
     */
    async hostedCompileC (code, target, format, language = 'c', extra = {}) {
        const res = await fetch('https://stc-compiler.vercel.app/compile', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({code, language, target, format, ...extra})
        });
        const out = await res.json();
        if (!out.success) {
            const err = new Error(out.error || 'the compiler refused this program');
            err.log = out.log || '';
            throw err;
        }
        return out;
    }

    async deployPicoUf2 () {
        const cSrc = this.state.buffers.c;
        if (!cSrc || !cSrc.trim()) { this.setState({status: this.L.deployPicoNoC}); return; }
        this.setState({busy: true, status: this.L.flashCompiling});
        try {
            const cout = await this.hostedCompileC(cSrc, 'rp2040', 'bin');
            const ures = await fetch('https://stc-compiler.vercel.app/uf2', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({base64: cout.base64, origin: 0x20000000})
            });
            const uout = await ures.json();
            if (!uout.success) throw new Error(uout.error || 'UF2 conversion failed');
            const uf2 = Uint8Array.from(atob(uout.base64), c => c.charCodeAt(0));
            await downloadBlob(uout.filename || 'firmware.uf2',
                new Blob([uf2], {type: 'application/octet-stream'}));
            this.setState({busy: false, status: this.L.deployPicoUf2Done});
        } catch (e) {
            this.setState({busy: false, status: this.L.deployPicoUf2Fail(e.message)});
        }
    }

    /** Compile the current program for its device and write it to a real
     *  board over Web Serial, dispatching to the vendored flasher by
     *  family. Non-serial-bootloader devices get their image downloaded
     *  with a message naming the programmer they need. */
    async flashToBoard () {
        const device = this.currentDevice();
        const family = this.flashFamily(device);
        if (family === 'micropython') {
            const basic = this.state.lang === 'basic' && this.selectedBasicProfile();
            if (basic?.media) return this.downloadPicoBasicFirmware(basic);
            // The Pico decides by ARTEFACT KIND, not just device (L2): a C-tab
            // program is a bare-metal bin, which BOOTSEL drag-flashes as a UF2 —
            // the MicroPython REPL (deployToPico) cannot take a bin. Pseudocode
            // and MicroPython still go to the REPL. flashFamily() stays a
            // device->family map; the kind branch lives here, where the buffer
            // origin is known.
            if (device === 'pico' && this.state.lang === 'c') return this.deployPicoUf2();
            return this.deployToPico();
        }

        const src = this.state.buffers.pseudocode || '';
        if (!src.trim()) return;

        const noSerial = typeof navigator === 'undefined' || !navigator.serial;
        const downloadImage = (bytes, name) =>
            downloadBlob(name, new Blob([bytes], {type: 'application/octet-stream'}));

        this.setState({busy: true, status: this.L.flashCompiling});
        try {
            // Compile through the same hosted service and format the Run
            // path uses: hex for STC/AVR, a raw bin for STM32.
            const SB3Creator = (await this.lib()).default;
            const creator = new SB3Creator();
            creator.parse(src);
            const cSrc = creator.generateC(creator.project, {debug: false});
            const COMPILE_TARGET = {
                'arduino-nano': 'atmega328p', 'arduino-uno': 'atmega328p',
                'atmega328p': 'atmega328p', 'atmega168p': 'atmega168p',
                'stm32f030': 'stm32f030', 'arduino-mega': 'atmega2560', 'atmega2560': 'atmega2560',
                'attiny85': 'attiny85', 'attiny88': 'attiny88',
                'eater6502': 'eater6502', '6502': 'eater6502', 'w65c02': 'eater6502'
            };
            const target = COMPILE_TARGET[String(device).toLowerCase()] || String(device).toLowerCase();
            const format = (family === 'stm32' || family === 'eeprom') ? 'bin' : 'ihx';
            const out = await this.hostedCompileC(cSrc, target, format);
            const raw = Uint8Array.from(atob(out.base64), c => c.charCodeAt(0));

            if (family === null) {
                downloadImage(raw, out.filename || `firmware.${format === 'bin' ? 'bin' : 'hex'}`);
                this.setState({busy: false, status: this.L.flashNeedsProgrammer(device)});
                return;
            }
            if (noSerial) {
                downloadImage(raw, out.filename || `firmware.${format === 'bin' ? 'bin' : 'hex'}`);
                this.setState({busy: false, status: this.L.flashNoSerial});
                return;
            }

            const flasher = await import(/* webpackChunkName: "bw-flasher" */ '../../lib/flasher.js');
            const lines = [];
            const log = (t) => { lines.push(t); this.setState({output: lines.join('\n')}); };

            if (family === 'isp') {
                // WebUSB, not Web Serial: a USBasp is a raw USB device.
                if (typeof navigator === 'undefined' || !navigator.usb) {
                    downloadImage(raw, out.filename || 'firmware.hex');
                    this.setState({busy: false, status: this.L.flashNoWebUsb});
                    return;
                }
                this.setState({status: this.L.flashIspHint});
                const device = await navigator.usb.requestDevice({filters: [{vendorId: 0x16c0}]});
                this.setState({status: this.L.flashing});
                const done = await flasher.flashUsbasp(device, new TextDecoder().decode(raw), {log});
                this.setState({busy: false, status: this.L.flashDone(done.bytes)});
                return;
            }

            if (family === 'stm32') {
                this.setState({status: this.L.flashStm32Boot});
                const port = await navigator.serial.requestPort();
                await flasher.openStm32Port(port);
                this.setState({status: this.L.flashing});
                const done = await flasher.flashStm32(port, raw, {log});
                this.setState({busy: false, status: this.L.flashDone(done.bytes)});
            } else if (family === 'stc') {
                this.setState({status: this.L.flashColdBoot});
                const port = await navigator.serial.requestPort();
                await port.open({baudRate: 115200});
                const done = await flasher.flashStc(port, new TextDecoder().decode(raw), {
                    log, onPowerCycle: () => this.setState({status: this.L.flashColdBoot})
                });
                this.setState({busy: false, status: this.L.flashDone(done.bytes)});
            } else if (family === 'eeprom') {
                this.setState({status: this.L.flashEepromHint});
                const port = await navigator.serial.requestPort();
                await port.open({baudRate: 115200});
                this.setState({status: this.L.flashing});
                const done = await flasher.flashEeprom(port, raw, {log});
                this.setState({busy: false, status: this.L.flashDone(done.bytes)});
            } else if (family === 'avr-mega') {
                const port = await navigator.serial.requestPort();
                this.setState({status: this.L.flashing});
                const done = await flasher.flashAvrMega(port, new TextDecoder().decode(raw), {log});
                this.setState({busy: false, status: this.L.flashDone(done.bytes)});
            } else { // avr (optiboot v1)
                const port = await navigator.serial.requestPort();
                this.setState({status: this.L.flashing});
                const done = await flasher.flashAvr(port, new TextDecoder().decode(raw), {log});
                this.setState({busy: false, status: this.L.flashDone(done.bytes)});
            }
        } catch (e) {
            const cancelled = e && (e.name === 'NotFoundError' || /No port selected/i.test(e.message));
            this.setState({busy: false, status: cancelled ? this.L.flashNoPort : this.L.flashFail(e.message)});
        }
    }

    // The project's hardware declarations. `vm.runtime.stc` is where they live while
    // a project is loaded (see loadProject above for why toJSON cannot carry them);
    // the toJSON read stays as a fallback for the day the VM does.
    currentStc () {
        const vm = this.props.vm;
        if (!vm) return null;
        if (vm.runtime && vm.runtime.stc) return vm.runtime.stc;
        try { return JSON.parse(vm.toJSON()).stc || null; } catch { return null; }
    }

    // Hardware-extension codegen options passed to generatePython/generateJavaScript.
    genOpts (lang = this.state.lang) {
        if (lang === 'javascript' && this.state.jsExecution === OWNED_CONSOLE_EXECUTION) {
            return {driver: 'shim', async: true, events: false, execution: OWNED_CONSOLE_EXECUTION};
        }
        if (lang === 'basic') return {profile: this.state.basicProfile, lineNumbers: this.state.basicLineNumbers};
        return {driver: this.state.driverMode, async: this.state.asyncMode, events: this.state.eventsMode};
    }

    // Apply a codegen-option change and regenerate the active code view.
    setGenOpt (patch) {
        const request = {};
        this._deriveRequest = request;
        const lang = this.state.lang;
        const buffers = this.state.buffers;
        const vm = this.props.vm;
        const document = this.codeDocumentSnapshot();
        const ownsRequest = () => !this._unmounted && this._deriveRequest === request;
        const ownsEditor = state => ownsRequest() && state.lang === lang &&
            state.buffers === buffers && this.props.vm === vm;
        this.setState(state => ownsEditor(state) ? {...patch, codeDocument: {...document,
            generationOptions: this.codeGenerationOptions({...state, ...patch})}} : null, () => {
            if (!ownsRequest()) return;
            const src = document.code;
            if (!ownsEditor(this.state) || lang === document.lang || !src || !src.trim()) {
                this.setState(() => ownsRequest() ? {busy: false} : null);
                return;
            }
            this.setState({busy: true, status: this.L.stRegen});
            this.deriveBuffer(src, document.lang, lang).then(({code, error, diagnostics, options}) => {
                if (!ownsRequest()) return;
                this.setState(state => {
                    if (!ownsRequest()) return null;
                    if (!ownsEditor(state)) return {busy: false};
                    if (error) return {busy: false, status: error, conversionReport: diagnostics || null};
                    const next = addCodeProjection({...document, generationOptions: this.codeGenerationOptions(state)},
                        {lang, code, sourceRevision: document.revision, options: options || this.genOpts(lang),
                            diagnostics: diagnostics || null, runtime: this.codeRuntimeFor(lang, document.target)});
                    return {...this.withRetainedDrafts(this.codeDocumentState(next), state, lang), busy: false, status: '', output: null,
                        conversionReport: diagnostics || null};
                });
            });
        });
    }

    // Lazily fetch the prebuilt Skulpt sources (~1 MB, only on the first Python
    // run) and cache the raw strings so both the main-thread injector and the
    // Worker builder can reuse them.
    async skulptSource () {
        if (this._skSrc) return this._skSrc;
        const [core, stdlib] = await Promise.all([
            import(/* webpackChunkName: "skulpt" */ '!!raw-loader!skulpt/dist/skulpt.min.js'),
            import(/* webpackChunkName: "skulpt-stdlib" */ '!!raw-loader!skulpt/dist/skulpt-stdlib.js')
        ]);
        this._skSrc = {core: core.default || core, stdlib: stdlib.default || stdlib};
        return this._skSrc;
    }

    // Skulpt's dist assumes a global `Sk`, so on the main thread we inject it as a
    // <script> rather than importing it as a module.
    async loadSkulpt () {
        if (window.Sk && window.Sk.configure) return window.Sk;
        const {core, stdlib} = await this.skulptSource();
        const inject = (src) => { const s = document.createElement('script'); s.text = src; document.head.appendChild(s); };
        inject(core); inject(stdlib);
        if (!window.Sk || !window.Sk.configure) throw new Error('Skulpt failed to load');
        return window.Sk;
    }

    async runJsMain (code, buf) {
        const log = (...a) => buf.push(a.map(x => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ') + '\n');
        // With the simulated-board driver the emitted program is the MCU side of the board
        // contract, so it needs an actual board to drive — otherwise `_board()` stays null and
        // the program runs neutrally, which looks like the feature is broken.
        // Use the Circuit tab's board if it exists (one board, one truth), otherwise build one.
        const sharedBoard = this.props.vm && this.props.vm.runtime && this.props.vm.runtime.circuitBoard;
        const board = this.state.driverMode === 'simulator'
            ? (sharedBoard || await this.makeSimBoard(buf))
            : undefined;
        if (sharedBoard && this.state.driverMode === 'simulator') {
            buf.push('simulated board: using the Circuit tab\'s board.\n');
        }
        // eslint-disable-next-line no-new-func
        const fn = new Function('console', 'prompt', 'bwBoard', 'Math', code);
        // The program's `prompt(q)` must have its answer at once, and in the desktop/iOS app no
        // dialog can block (lib/native-dialog.js), so the program is replayed with the answers
        // collected so far (lib/replay-input.js); a Cancel reads as '' as it always did.
        const start = buf.length;
        await runWithReplayedInput(({prompt, random}) => {
            buf.length = start;
            fn({log, error: log, warn: log, info: log}, prompt, board, mathWithRandom(random));
        }, async q => (await promptAsync(q)) || '');
        if (board) this.reportSimBoard(board, buf);
    }

    // Build a board from the project's own PIN declarations (boundary C), so pressing Run on
    // an STC12 project simulates the circuit those declarations imply rather than nothing.
    async makeSimBoard (buf) {
        try {
            // Lazily imported, like skulpt and the compiler: the engine is only needed when
            // someone actually runs with the simulated-board driver, and the bundle is
            // already large enough that everything optional should stay out of the entry.
            const {BoardImpl, inferNetlist} =
                await import(/* webpackChunkName: "bw-board" */ 'bw-board');
            const stc = this.currentStc();
            if (!stc || !(stc.pins || []).length) {
                buf.push('simulated board: the project declares no PINs, so there is nothing to wire.\n');
                return undefined;
            }
            const {parts, nets, notes} = inferNetlist(stc);
            const board = new BoardImpl();
            board.setNetlist(parts, nets);
            board.setPower(true);
            for (const n of notes || []) buf.push(`board: ${n}\n`);
            this._simParts = parts;
            return board;
        } catch (e) {
            buf.push(`simulated board unavailable: ${e.message}\n`);
            return undefined;
        }
    }

    // Report what the circuit actually did. Without this the run is silent and the user has
    // no way to tell a working simulation from a no-op.
    reportSimBoard (board, buf) {
        try {
            for (const part of this._simParts || []) {
                if (part.kind === 'led') {
                    buf.push(`LED ${part.id}: ${(board.ledBrightness(part.id) * 100).toFixed(1)}% brightness\n`);
                } else if (part.kind === 'buzzer') {
                    const t = board.buzzerTone(part.id);
                    buf.push(`buzzer ${part.id}: ${t.on ? `${t.hz.toFixed(0)} Hz` : 'silent'}\n`);
                }
            }
        } catch (e) { buf.push(`board readout failed: ${e.message}\n`); }
    }

    async runPyMain (code, buf) {
        const Sk = await this.loadSkulpt();
        Sk.configure({
            output: (t) => buf.push(t),
            read: (f) => { if (Sk.builtinFiles && Sk.builtinFiles.files[f]) return Sk.builtinFiles.files[f]; throw new Error(`module ${f} not found`); },
            // A Promise is a Skulpt suspension (Sk.builtin.file.$readline, resumed by
            // asyncToPromise below), so `input()` waits for the in-app dialog; Cancel reads ''.
            inputfun: async (p) => (await promptAsync(p)) || '',
            inputfunTakesPrompt: true,
            __future__: Sk.python3
        });
        await Sk.misceval.asyncToPromise(() => Sk.importMainWithBody('<brickwright>', false, code, true));
    }

    bindCodeStopRuntime () {
        if (this._codeStopRuntime) this._codeStopRuntime.removeListener('PROJECT_STOP_ALL', this._onStopCodeRun);
        this._codeStopRuntime = this.props.vm && this.props.vm.runtime;
        if (this._codeStopRuntime) this._codeStopRuntime.on('PROJECT_STOP_ALL', this._onStopCodeRun);
    }

    stopCodeRun () {
        if (this._picoSimRequest || this._picoSimStop) this.stopPicoSim();
        if (this._picoBasicHardware) {
            if (this.state.busy) this.closePicoBasicHardware();
            else this._picoBasicHardware.session?.terminal.send([3]);
        }
        if (this._codeSession) this._codeSession.stop();
    }

    disposeCodeRun () {
        const owned = this._codeRunRequest || this._codeSession;
        const session = this._codeSession;
        // Revoke the component owner BEFORE cleanup callbacks or lazy loads can
        // publish. A subsequent run must not inherit this run's final output.
        this._codeRunRequest = null;
        this._codeSession = null;
        if (session) session.dispose();
        if (owned && !this._unmounted) this.setState(() => this._unmounted || this._codeRunRequest ? null : {
            running: false, codeSessionRunning: false, codeInput: null, codeInputValue: '', codeRunLabel: ''
        });
    }

    submitCodeInput (event, expectedInput = this.state.codeInput) {
        if (event) event.preventDefault();
        const session = this._codeSession;
        const input = this.state.codeInput;
        const request = this._codeRunRequest;
        if (this._unmounted || !request || this.props.vm !== request.vm ||
            !session || !input || input !== expectedInput || input.runId !== session.id) return;
        session.replyToInput(input.requestId, this.state.codeInputValue);
    }

    // Console runs own their clicked source, lazy runtime load, worker and input.
    // A worker is a Stop/responsiveness boundary, not a complete security sandbox.
    // Owned generated programs register their task lifetime with the worker.
    async run () {
        const lang = this.state.lang;
        this.disposeCodeRun();
        const document = this.codeDocumentSnapshot();
        const expectedRuntime = this.codeRuntimeFor(lang, document.target);
        if (document.runtime && document.runtime !== expectedRuntime) {
            this.setState({status: `The saved runtime ${document.runtime} is not available for this target. Source is preserved.`});
            return;
        }
        // Pico + Python: run in the SIMULATOR — boot MicroPython in rp2040js and
        // run the program live over the same createPicoRepl the silicon deploy
        // uses (N3c), instead of the in-page Skulpt console below.
        if ((lang === 'python' || lang === 'micropython') && this.currentDevice() === 'pico') {
            return this.runPicoSim(this.activeCode());
        }
        const code = this.activeCode();
        const request = {vm: this.props.vm, lang, code, runtime: document.runtime,
            target: document.target, sourceRevision: document.revision};
        this._codeRunRequest = request;
        const ownsRequest = () => !this._unmounted && this._codeRunRequest === request && this.props.vm === request.vm;
        const python = lang === 'python' || lang === 'micropython';
        // Preserve the existing interactive board route until R4 provides the
        // shared worker/board bridge. It has no worker Stop guarantee; do not
        // silently replace its working board access with an empty worker stub.
        const legacySimulator = lang === 'javascript' && this.state.driverMode === 'simulator' &&
            !codeDocumentConversionRefusal(document, lang, code) &&
            /(^|[^.\w])prompt\s*\(/.test(code);
        this.setState(() => ownsRequest() ? {
            output: '', running: true, status: python ? this.L.stLoadingPy : '',
            codeSessionRunning: !legacySimulator, codeInput: null, codeInputValue: '',
            codeRunLabel: legacySimulator ? this.L.codeLegacySimulator :
                (python ? this.L.codeConsolePython : this.L.codeConsoleJs)
        } : null);
        if (legacySimulator) {
            const buf = [];
            try {
                if (/while\s*\(\s*true\s*\)/.test(code)) throw new Error(this.L.foreverLoop);
                await this.runJsMain(code, buf);
            } catch (error) { buf.push(String(error.message || error)); }
            if (!ownsRequest()) return;
            this.setState(() => ownsRequest() ? {
                output: buf.join('') || this.L.codeNoOutput, running: false, status: '', codeRunLabel: ''
            } : null);
            return;
        }
        const session = createCodeExecutionSession({
            code,
            workerSource: python ? async () => {
                const sources = await this.skulptSource();
                if (ownsRequest() && this._codeSession === session) this.setState(() =>
                    ownsRequest() && this._codeSession === session ? {status: ''} : null);
                return createPythonWorkerSource(sources);
            } : JAVASCRIPT_WORKER_SOURCE,
            onOutput: output => {
                if (ownsRequest() && this._codeSession === session) this.setState(() =>
                    ownsRequest() && this._codeSession === session ? {output} : null);
            },
            onInput: input => {
                if (ownsRequest() && this._codeSession === session) this.setState(() =>
                    ownsRequest() && this._codeSession === session ? {codeInput: input, codeInputValue: ''} : null);
            }
        });
        this._codeSession = session;
        const result = await session.promise;
        if (!ownsRequest() || this._codeSession !== session) return;
        this._codeSession = null;
        const note = result.status === 'timeout' ? this.L.codeTimeout :
            result.status === 'stopped' ? this.L.codeStopped :
                result.status === 'output-limit' ? this.L.codeOutputLimit : result.error;
        this.setState(() => ownsRequest() ? {
            output: result.output + (note ? `${result.output ? '\n' : ''}${note}` : '') || this.L.codeNoOutput,
            running: false, status: '', codeSessionRunning: false, codeInput: null, codeInputValue: '', codeRunLabel: ''
        } : null);
    }
    /**
     * Run the Pico's MicroPython program IN THE SIMULATOR. Boots the pinned
     * firmware in rp2040js and installs main.py over createPicoRepl — the SAME
     * program, deployment protocol and reboot boundary the silicon path uses.
     * Refuses by name only when the firmware asset is absent.
     */
    async runPicoSim (pythonSource = null) {
        const src = typeof pythonSource === 'string' ? pythonSource : this.state.buffers.pseudocode || '';
        if (!src.trim()) return;
        this.stopPicoSim();
        const request = {};
        this._picoSimRequest = request;
        const controller = new AbortController();
        this._picoSimAbort = controller;
        const vm = this.props.vm;
        const target = this.currentDevice();
        const ownsRequest = () => !this._unmounted && this._picoSimRequest === request &&
            this.props.vm === vm && this.currentDevice() === target;
        this.setState({output: '', running: true, picoSimRunning: false, status: ''});
        try {
            let py = src;
            if (typeof pythonSource !== 'string') {
                const SB3Creator = (await this.lib()).default;
                if (!ownsRequest()) return;
                const creator = new SB3Creator();
                creator.parse(src);
                const r = creator.generateMicroPython();
                if (!r.ok) {
                    this.setState({running: false, status:
                        this.L.deployPicoFail((r.reasons || []).join('; ') || 'not expressible in MicroPython')});
                    return;
                }
                py = r.py;
            }
            const {startPicoSimRun} = await import(
                /* webpackChunkName: "pico-sim-run" */ '../../lib/pico-sim-run.js');
            const {loadPicoFirmware} = await import('../../lib/pico-firmware.js');
            if (!ownsRequest()) return;
            const fw = await loadPicoFirmware();
            if (!ownsRequest()) return;
            if (!fw) {
                this.setState({running: false, status: this.L.picoSimNoFirmware});
                return;
            }
            const handle = await startPicoSimRun({
                image: fw.image,
                vm,
                stc: this.currentStc(),
                py,
                signal: controller.signal,
                onStatus: s => { if (ownsRequest()) this.setState({status: s}); },
                onError: e => { if (ownsRequest()) this.setState({status:
                    this.L.deployPicoFail(e && e.message ? e.message : String(e))}); }
            });
            if (!ownsRequest()) { handle.stop(); return; }
            this._picoSimStop = handle.stop;
            this.setState({picoSimRunning: true});
        } catch (e) {
            if (!ownsRequest()) return;
            this._picoSimStop = null;
            this.setState({running: false, picoSimRunning: false, status:
                this.L.deployPicoFail(e && e.message ? e.message : String(e))});
        }
    }

    /** Stop a live Pico simulator run: interrupt the program and tear the run
     *  down (the RUN board dies with it, the canvas rebinds to the designer). */
    stopPicoSim () {
        this._picoSimRequest = null;
        if (this._picoSimAbort) {
            this._picoSimAbort.abort();
            this._picoSimAbort = null;
        }
        if (this._picoSimStop) {
            try { this._picoSimStop(); } catch { /* teardown must not throw at the user */ }
            this._picoSimStop = null;
        }
        if (!this._unmounted) this.setState({running: false, picoSimRunning: false, status: this.L.picoSimStopped});
    }

    // Flash the micro:bit simulator with the current MicroPython code.
    // Activates the simulator pane (stage-header dock='microbit') and posts
    // the code via the CustomEvent bus; the MicrobitSimPane picks it up.
    // Open the SPIKE arena (spike-arena-pane.jsx) in the right column. The
    // program reaches it through the virtual SPIKE hub, not through this call.
    openSpikeArena () {
        const values = {'bw-right-pane-hidden': '0', 'bw-debug-dock': 'spikearena'};
        try { Object.entries(values).forEach(([k, v]) => localStorage.setItem(k, v)); } catch { /* noop */ }
        Object.entries(values).forEach(([k, v]) => {
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: k, value: v}}));
        });
    }

    /**
     * LEGO SPIKE App 3 Python: read it into SPIKE blocks (the vendored reader,
     * through compile()), then run those blocks on the virtual SPIKE hub —
     * the one hub the arena, the word blocks and the panel share. print()
     * lands in the console below via the VM's say events; what the reader could
     * not express, and what it approximated, is listed there too.
     */
    async runOnNuttxPython () {
        const caller = {cancelled: false};
        this._nuttxCodeCaller = caller;
        const owns = () => this._nuttxCodeCaller === caller;
        const active = () => owns() && !caller.cancelled;
        const publish = state => { if (owns()) this.setState(state); };
        let pane = null;
        this.openSpikeArena();
        if (!owns()) return;
        publish({busy: true});
        const feedback = createCodeRunFeedback(publish, {
            running: 'Python running in full NuttX firmware.', completed: 'Python firmware program completed.', stopped: this.L.spike3Stopped});
        if (!owns()) return;
        // Install cancellation before waiting for the arena or its state callback.
        this._spike3Stop = () => {
            if (!owns()) return;
            caller.cancelled = true;
            feedback.requestStop();
            const stoppedPane = pane;
            return Promise.resolve().then(() => {
                if (!owns() || !stoppedPane || stoppedPane.disposed || window.__bwSpikeArena?._pane !== stoppedPane) return;
                return stoppedPane.stopProgram();
            }).catch(error => {
                // The shared Stop handler has an unscoped async catch. Keep the
                // error here so a former caller cannot publish into a new run.
                publish({status: error.message});
            });
        };
        try {
            const source = this.activeCode();
            const deadline = Date.now() + 15000;
            while (active() && !window.__bwSpikeArena?.bridge && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
            if (!active()) return;
            pane = window.__bwSpikeArena?._pane;
            if (!pane?.bridge || pane.disposed) throw new Error('Open the SPIKE arena before running firmware');
            await new Promise(resolve => pane.setState({execution: 'nuttx'}, resolve));
            if (!active()) return;
            if (pane.disposed || window.__bwSpikeArena?._pane !== pane) {
                caller.cancelled = true; feedback.requestStop(); return;
            }
            const callbacks = Object.fromEntries(Object.entries(feedback.callbacks).map(([name, callback]) =>
                [name, (...args) => { if (active()) return callback(...args); }]));
            await pane.startFirmware(null, {source, ...callbacks,
                onOutput: output => {
                    if (active()) publish({spike3Log: [{kind: 'out', text: output.text + (output.truncated ? '\n… output truncated' : '')}]});
                }});
            if (!active()) return;
            if (!pane.firmwareSession) throw new Error(pane.state.message || 'Full NuttX firmware could not start');
            feedback.started();
        } catch (error) { if (owns() && !feedback.cancelled) publish({status: error.message}); }
        finally { publish({busy: false}); }
    }

    // New MicroPython execution glue: BSD-3-Clause, (c) 2026 Brickwright contributors.
    async runOnMicroPythonImage () {
        this.openSpikeArena();
        this.setState({busy: true});
        const feedback = createCodeRunFeedback(state => this.setState(state), {
            running: 'Python running in the local MicroPython image.', completed: 'MicroPython program completed.', stopped: this.L.spike3Stopped});
        try {
            const source = this.activeCode();
            const {encodeSource} = await import('../../lib/spike-micropython/raw-repl.js');
            encodeSource(source);
            const deadline = Date.now() + 15000;
            while (!window.__bwSpikeArena?.bridge && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
            const pane = window.__bwSpikeArena?._pane;
            if (!pane?.bridge || pane.disposed) throw new Error('Open the SPIKE arena before running MicroPython');
            await pane.stopProgram();
            await new Promise(resolve => pane.setState({execution: 'micropython', topology: pane.state.sandbox && pane.state.topology === 'six-motors' ? 'six-motors' : 'default'}, resolve));
            if (!pane.state.microImageSelected && !await pane.chooseMicroPythonImage()) {
                this.setState({status: 'Image selection cancelled.'});
                return;
            }
            this._spike3Stop = () => { feedback.requestStop(); return pane.stopProgram(); };
            this.setState({spike3Running: true, spike3Log: [], status: 'Python running in the local MicroPython image.'});
            await pane.startFirmware(null, {source, ...feedback.callbacks,
                onOutput: output => this.setState({spike3Log: [{kind: 'out', text: output.text + (output.truncated ? '\n… output truncated' : '')}]})});
            if (!pane.firmwareSession && pane.state.status === 'failed') throw new Error(pane.state.message || 'MicroPython could not start');
        } catch (error) { if (!feedback.cancelled) this.setState({spike3Running: false, status: error.message}); }
        finally { this.setState({busy: false}); }
    }

    async runOnSpikeFirmware () {
        this.openSpikeArena();
        this.setState({busy: true});
        const feedback = createCodeRunFeedback(state => this.setState(state), {
            running: 'Code program running in ARM firmware.', completed: 'Firmware program completed.', stopped: this.L.spike3Stopped});
        try {
            await this.compile({strict: true});
            const deadline = Date.now() + 15000;
            while (!window.__bwSpikeArena?.bridge && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
            const pane = window.__bwSpikeArena?._pane;
            if (!pane?.bridge) throw new Error('Open the SPIKE arena before running firmware');
            await new Promise(resolve => pane.setState({execution: pane.state.execution === 'nuttx' ? 'nuttx' : 'program'}, resolve));
            this._spike3Stop = () => { feedback.requestStop(); return pane.stopProgram(); };
            await pane.startFirmware(null, feedback.callbacks);
            if (!pane.firmwareSession) throw new Error(pane.state.message || 'Firmware could not start');
            feedback.started();
        } catch (error) { if (!feedback.cancelled) this.setState({status: error.message}); }
        finally { this.setState({busy: false}); }
    }

    async runOnSpike3 () {
        const code = this.activeCode();
        if (!isSpike3Program(code)) return;
        const log = [];
        const push = (kind, text) => { log.push({kind, text}); this.setState({spike3Log: log.slice()}); };
        this.setState({spike3Log: [], spike3Running: false});
        let report = null;
        try {
            report = (await import(/* webpackChunkName: "sb3-creator-readers" */ '../../lib/robot-lab-pseudocode.js')).readPython(code);
        } catch (e) {
            push('err', `${this.L.spike3Error}: ${e.message}`);
            return;
        }
        if (report.unsupported && report.unsupported.length) push('err', this.L.spike3Unsupported(report.unsupported.length));
        (report.unsupported || []).forEach(u => push('err', `# unsupported: ${u}`));
        (report.notes || []).forEach(n => push('note', `${this.L.spike3Note}: ${n}`));
        try { await this.compile({strict: ['program', 'nuttx'].includes(window.__bwSpikeArena?._pane?.state.execution)}); }
        catch (error) { push('err', error.message); return; }
        const result = await runSpike3OnVirtualHub(this.props.vm, {
            onPrint: text => push('out', String(text)),
            onCompleted: () => this.setState({spike3Running: false, status: 'Firmware program completed.'})
        });
        if (!result.ok) {
            push('err', result.reason === 'firmware' ? result.detail : result.reason === 'no-hub' ? this.L.spike3NoHub : `${this.L.spike3NoConnect} ${result.detail || ''}`.trim());
            return;
        }
        this._spike3Stop = result.stop;
        this.setState({spike3Running: true, status: this.L.spike3Running});
    }

    stopSpike3 () {
        if (this._spike3Stop) {
            try { Promise.resolve(this._spike3Stop()).catch(error => this.setState({status: error.message})); } catch { /* teardown must not throw at the user */ }
            this._spike3Stop = null;
        }
        this.setState({spike3Running: false, status: this.L.spike3Stopped});
    }

    _onMicrobitRunRequest (event) {
        this.flashMicrobitSim(event && event.detail);
    }

    flashMicrobitSim (options = {}) {
        const code = this.state.buffers.micropython;
        if (!code || !code.trim() || /^# ===/.test(code)) return;
        // Switch the right pane to the micro:bit simulator view
        const values = {
            'bw-hide-stage': '1',
            'bw-right-pane-hidden': '0',
            'bw-debug-dock': 'microbit',
            'bw-stage-circuit': '1'
        };
        try { Object.entries(values).forEach(([k, v]) => localStorage.setItem(k, v)); } catch { /* noop */ }
        Object.entries(values).forEach(([k, v]) => {
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: k, value: v}}));
        });
        // Send the code to the simulator pane
        {
            // Park on a module latch too: opening the dock mounts the sim pane
            // in the same tick, so its window listener may not exist yet — the
            // pane reads this latch on mount (first-click fix).
            const detail = {code, autostart: Boolean(options.autostart)};
            try { window.__bwMicrobitPendingFlash = detail; } catch { /* noop */ }
            window.dispatchEvent(new CustomEvent('bw-microbit-flash', {detail}));
        }
    }

    // Debug on the simulator: regenerate the MicroPython as a LINE-LEVEL trace
    // build — `generateMicroPython(project, {trace:true, breakpoints})` installs
    // a sys.settrace hook that prints RS(0x1e)L line markers over serial and
    // HALTS at breakpoint lines, dumping real locals (\x1eV) and the call stack
    // (\x1eK). The sim pane loads the settrace-enabled debug firmware and gets
    // the `lineMap` (python line -> block id) to highlight the live block and
    // drive step/continue (microbit-sim-pane.jsx, microbit-debug.js).
    // Breakpoints are the block ids the user right-clicked (bw-debug/breakpoints.js,
    // reused unchanged); the codegen bakes them to a line set.
    _setDebugLevel (lv) {
        const level = lv === 'line' ? 'line' : 'block';
        this.setState({debugLevel: level});
        try { localStorage.setItem('bw-microbit-debug-level', level); } catch { /* noop */ }
    }

    async flashMicrobitSimDebug () {
        const line = this.state.debugLevel === 'line';
        let breakpoints = [];
        try {
            const bp = await import(/* webpackChunkName: "bw-debug" */ '../../lib/bw-debug/breakpoints.js');
            breakpoints = bp.listBreakpoints ? bp.listBreakpoints() : [];
        } catch { /* no breakpoints module — debug with none, still useful for stepping */ }
        let code;
        let lineMap;
        let positions;
        let procNames;
        try {
            const SB3Creator = (await this.lib()).default;
            const proj = JSON.parse(this.props.vm.toJSON());
            const r = new SB3Creator().generateMicroPython(proj,
                line ? {trace: true, breakpoints} : {debug: true, breakpoints});
            if (!r.ok) {
                this.setState({status: this.L.stError((r.reasons || []).join(' · '))});
                return;
            }
            code = r.py;
            if (line) { lineMap = r.lineMap || {}; }
            else { positions = r.positions || []; procNames = r.procNames || []; }
        } catch (e) {
            this.setState({status: this.L.stError(e.message)});
            return;
        }
        // Activate the micro:bit sim pane, same as the plain run.
        const values = {
            'bw-hide-stage': '1',
            'bw-right-pane-hidden': '0',
            'bw-debug-dock': 'microbit',
            'bw-stage-circuit': '1'
        };
        try { Object.entries(values).forEach(([k, v]) => localStorage.setItem(k, v)); } catch { /* noop */ }
        Object.entries(values).forEach(([k, v]) => {
            window.dispatchEvent(new CustomEvent('bw-settings-change', {detail: {key: k, value: v}}));
        });
        const detail = line
            ? {code, trace: true, lineMap}
            : {code, debug: true, positions, procNames};
        // Park on a module latch (first-click mount-race fix — see plain run).
        try { window.__bwMicrobitPendingFlash = detail; } catch { /* noop */ }
        window.dispatchEvent(new CustomEvent('bw-microbit-flash', {detail}));
    }

    // Run BASIC on the real emulated machine.
    // 6502 profile → BasicMachineRunner (pump ms), BBC profile → BbcZ80Runner (pump steps).
    /**
     * Compile the NQC buffer to an .rcx image.
     *
     * `runtime.nqcCompile` is installed by lib/nqc-runtime-hook.js and runs a
     * vendored MPL-2.0 build of NQC in the browser, so this needs no network.
     * A host without it gets a named refusal rather than a silent no-op —
     * there is no hosted fallback HERE on purpose: the RCX extension has one
     * for its own blocks, and duplicating it in the editor would mean two
     * places to keep in step.
     */
    /**
     * Hand a binary to the browser as a download. saveCodeFile() does this for
     * TEXT and cannot be reused: it takes the active buffer and a MIME from
     * CODE_FILES, and an .rcx is neither.
     */
    saveBlob (bytes, name, mime) {
        return downloadBlob(name, new Blob([bytes], {type: mime}));
    }

    async _compileNqc () {
        const source = (this.state.buffers.nqc || '').trim();
        if (!source) return {ok: false, log: this.L.nqcEmpty};
        const runtime = this.props.vm && this.props.vm.runtime;
        const compile = runtime && runtime.nqcCompile;
        if (typeof compile !== 'function') return {ok: false, log: this.L.nqcNoCompiler};
        try {
            return await compile.call(runtime, source, 'RCX2');
        } catch (e) {
            return {ok: false, log: String((e && e.message) || e)};
        }
    }

    async compileNqcToFile () {
        this.setState({busy: true, status: ''});
        const out = await this._compileNqc();
        if (!out.ok) {
            this.setState({busy: false, status: out.log});
            return;
        }
        this.saveBlob(out.bytes, 'program.rcx', 'application/octet-stream');
        this.setState({busy: false, status: `${out.bytes.length} bytes`});
    }

    async sendNqcToBrick () {
        this.setState({busy: true, status: ''});
        const out = await this._compileNqc();
        if (!out.ok) {
            this.setState({busy: false, status: out.log});
            return;
        }
        const runtime = this.props.vm && this.props.vm.runtime;
        const send = runtime && runtime.rcxDownload;
        if (typeof send !== 'function') {
            // Compiled fine, nowhere to send it: hand over the file rather
            // than throwing the work away. Same choice the extension makes.
            this.saveBlob(out.bytes, 'program.rcx', 'application/octet-stream');
            this.setState({busy: false, status: this.L.nqcNoTower});
            return;
        }
        const result = await send.call(runtime, out.bytes, {programSlot: 0});
        this.setState({busy: false,
            status: result && result.ok ? this.L.nqcSent : String((result && result.log) || 'download failed')});
    }

    // Keep engine loading behind an overridable method so lifecycle tests can
    // hold the actual editor at the same asynchronous boundary as a cold tab.
    async loadCrispBasicRunner () {
        return import(/* webpackChunkName: "crispbasic-runner" */ '../../lib/crispbasic-runner.js');
    }

    async runCrispBasic (code) {
        if (this._unmounted || this._crispBasicRun || this._crispBasicReset || this.state.running) return;
        const epoch = this._crispBasicEpoch = (this._crispBasicEpoch || 0) + 1;
        const run = {source: code, filename: this.state.basicFilename || 'editor.bas', runner: null, cancelled: false};
        const circuit = this.state.basicConnectCircuit ? {runtime: this.props.vm?.runtime} : undefined;
        this._crispBasicRun = run;
        const owns = () => !this._unmounted && this._crispBasicRun === run;
        const ownsOutcome = () => !this._unmounted && this._crispBasicEpoch === epoch;
        this.setState(s => ({output: '', running: true, status: this.L.basicCrispLoading,
            basicRawOutput: '', basicIsBbc: true, crispBasicActive: true,
            basicOutputRunId: s.basicOutputRunId + 1, basicDiagnostic: null,
            basicInputMethod: null, basicInputValue: '', basicInputError: ''}));
        this.setHighlightedLine(null);
        let result;
        let failure;
        // A project/circuit replacement during the editor's cold import must
        // revoke this Run before the loaded adapter can acquire a new board.
        const pendingCircuitChange = event => {
            if (run.runner || !owns()) return;
            if (event.type === 'bw-project-bundle-loaded' &&
                ['future', 'invalid', 'storage-failed'].includes(event.detail?.outcome)) return;
            if (event.type === 'bw-settings-change' && event.detail?.key !== 'bw-device-id') return;
            this.stopCrispBasic();
        };
        const circuitEvents = circuit && typeof window !== 'undefined' ?
            ['bw-circuit-changed', 'bw-board-ready', 'bw-project-bundle-loaded', 'bw-settings-change',
                'bw-stop-all', 'bw-power-off', 'bw-green-flag'] : [];
        for (const name of circuitEvents) window.addEventListener(name, pendingCircuitChange);
        const circuitRuntimeEvents = circuit?.runtime?.on && circuit?.runtime?.off ?
            ['PROJECT_STOP_ALL', 'PROJECT_START', 'PROJECT_LOADED'].map(name => [name, () => pendingCircuitChange({type: name})]) : [];
        for (const [name, handler] of circuitRuntimeEvents) circuit.runtime.on(name, handler);
        try {
            const {createCrispBasicRunner} = await this.loadCrispBasicRunner();
            if (!owns() || run.cancelled) return;
            run.runner = createCrispBasicRunner({...(circuit ? {circuit} : {}), onEvent: event => {
                if (!owns() || run.cancelled) return;
                if (event.type === 'state' && (event.state === 'loading' || event.state === 'running')) {
                    this.setState(() => ownsOutcome() && !run.cancelled ? {
                        status: event.state === 'loading' ? this.L.basicCrispLoading : this.L.basicCrispRunning
                    } : null);
                    return;
                }
                if (event.type !== 'view') return;
                // React may batch the final bytes with completion. The epoch
                // keeps those accepted bytes after the active run is cleared,
                // while Stop, Reset, a newer run and unmount revoke stale work.
                this.setState(() => ownsOutcome() && !run.cancelled ? {
                    output: event.output, basicRawOutput: event.rawOutput,
                    basicInputMethod: event.inputMethod
                } : null);
            }});
            result = await run.runner.run(code, {filename: run.filename, interactive: true, timeoutMs: 60000});
        } catch (error) {
            failure = error;
        } finally {
            for (const name of circuitEvents) window.removeEventListener(name, pendingCircuitChange);
            for (const [name, handler] of circuitRuntimeEvents) circuit.runtime.off(name, handler);
            // Run owns a fresh adapter. Do not enable the next Run until its
            // worker and callbacks have been disposed, even on a host failure.
            try { if (run.runner) await run.runner.dispose(); }
            catch (error) { failure = error; }
            if (owns()) {
                this._crispBasicRun = null;
                const error = failure || (result && result.error);
                let status = this.L.basicCrispError;
                if (!failure && result) {
                    if (result.status === 'completed') status = this.L.basicCrispCompleted(result.exitCode);
                    else if (result.status === 'cancelled') status = this.L.basicCrispStopped;
                    else if (result.status === 'timeout') status = this.L.basicCrispTimeout;
                    else if (result.status === 'output-limit') status = this.L.basicCrispOutputLimit;
                    else if (result.status === 'simulation-limit') status = this.L.basicCrispSimulationLimit;
                }
                const diagnostic = error ? this.crispBasicDiagnostic(error, run.filename) : null;
                this.setState(() => ownsOutcome() ? {running: false, crispBasicActive: false, status, basicDiagnostic: diagnostic,
                    basicInputMethod: null, basicInputValue: '', basicInputError: ''} : null);
                if (diagnostic && diagnostic.line && ownsOutcome() && this.state.lang === 'basic' &&
                    this.state.buffers.basic === run.source) this.setHighlightedLine(diagnostic.line);
            }
        }
        return result;
    }

    crispBasicDiagnostic (error, filename) {
        const name = error.filename || filename;
        const line = Number.isInteger(error.line) ? error.line : null;
        const column = Number.isInteger(error.column) ? error.column : null;
        const location = `${name}${line === null ? '' : `:${line}`}${column === null ? '' : `:${column}`}`;
        const message = String(error.message || error);
        return {line, message: error.kind === 'host' || message.startsWith(`${location}:`) ? message : `${location}: ${message}`};
    }

    stopCrispBasic () {
        const run = this._crispBasicRun;
        if (!run) return;
        run.cancelled = true;
        if (run.runner) {
            run.runner.cancel();
            this.setState({basicInputMethod: null, status: this.L.basicCrispStopping});
        } else {
            // A cold dynamic import is not cancellable; revoke its right to
            // start a session when it resolves, and leave the editor usable.
            this._crispBasicRun = null;
            this.setState({running: false, crispBasicActive: false, basicInputMethod: null, status: this.L.basicCrispStopped});
        }
    }

    async resetCrispBasic () {
        if (this._crispBasicReset || this._unmounted) return;
        const reset = this._crispBasicReset = {};
        this._crispBasicEpoch = (this._crispBasicEpoch || 0) + 1;
        const run = this._crispBasicRun;
        this._crispBasicRun = null;
        if (run) run.cancelled = true;
        this.setState({basicResetting: true, basicInputMethod: null});
        let failure;
        try {
            if (run && run.runner) {
                await run.runner.reset();
            }
        } catch (error) { failure = error; }
        try { if (run && run.runner) await run.runner.dispose(); }
        catch (error) { failure = error; }
        if (this._unmounted || this._crispBasicReset !== reset) return;
        this._crispBasicReset = null;
        this.setState(s => ({running: false, crispBasicActive: false, basicResetting: false, output: '', basicRawOutput: '',
            basicOutputRunId: s.basicOutputRunId + 1, basicInputMethod: null, basicInputValue: '', basicInputError: '',
            basicDiagnostic: failure ? this.crispBasicDiagnostic(failure, 'editor.bas') : null,
            status: failure ? this.L.basicCrispError : this.L.basicCrispResetDone}));
        this.setHighlightedLine(null);
    }

    async disposeCrispBasic () {
        this._crispBasicEpoch = (this._crispBasicEpoch || 0) + 1;
        this._crispBasicReset = null;
        const run = this._crispBasicRun;
        this._crispBasicRun = null;
        if (run) run.cancelled = true;
        if (run && run.runner) {
            run.runner.cancel();
            await run.runner.dispose();
        }
    }

    sendCrispBasicInput (event) {
        if (event) event.preventDefault();
        const run = this._crispBasicRun;
        const method = this.state.basicInputMethod;
        if (!run || !run.runner || run.cancelled || !method) return;
        const value = this.state.basicInputValue;
        try {
            if (method === 'key' && (value.length > 1 || (value && value.charCodeAt(0) > 255))) {
                throw new Error(this.L.basicInputKeyError);
            }
            run.runner.writeInput(method === 'line' ? `${value}\n` : value || '\r');
            this.setState({basicInputMethod: null, basicInputValue: '', basicInputError: ''});
        } catch (error) { this.setState({basicInputError: error.message}); }
    }

    endCrispBasicInput () {
        const run = this._crispBasicRun;
        if (!run || !run.runner || run.cancelled) return;
        try {
            run.runner.endInput();
            this.setState({basicInputMethod: null, basicInputValue: '', basicInputError: ''});
        } catch (error) { this.setState({basicInputError: error.message}); }
    }

    z80BasicNumberingIssue (code) {
        let previous = -1;
        const lines = code.split(/\r\n|\r|\n/);
        for (let index = 0; index < lines.length; index++) {
            if (!lines[index].trim()) continue;
            const match = /^[ \t]*(\d+)(.*)$/.exec(lines[index]);
            if (!match || /^\.|^[eE][+-]?\d/.test(match[2])) return index + 1;
            const number = Number(match[1]);
            if (!Number.isSafeInteger(number) || number <= previous) return index + 1;
            previous = number;
        }
        return null;
    }

    basicGenerationPlaceholder (text) {
        // This is an explanatory failure buffer, not an empty BASIC program.
        // Whitespace edits (or a saved/reopened buffer) must not clear refusal;
        // removing/replacing the banner is an explicit authored correction.
        return /^[ \t]*(?:\d+[ \t]*)?REM[ \t]*===[ \t]*Cannot[ \t]*show[ \t]*as[ \t]*BASIC[ \t]*===/mi.test(String(text || ''));
    }

    basicGenerationOptions (state = this.state) {
        const profile = basicProfileFor(this.codeDevice(), state.basicProfile);
        return {profile: profile?.dialect === 'ms' ? 'ms' : 'bbc', lineNumbers: state.basicLineNumbers,
            ...(profile?.id === 'bbc' && state.basicEngine === 'crispbasic' && state.basicPortableLibrary ? {mode: 'crispbasic'} : {})};
    }

    selectedBasicProfile () {
        return basicProfileFor(this.codeDevice(), this.state.basicProfile);
    }

    standaloneBasicProfile (lang = this.state.lang) {
        if (lang !== 'basic') return null;
        const profile = this.selectedBasicProfile();
        return profile?.standalone ? profile : null;
    }

    picoBasicHardwareText (key) {
        const de = pickLocale(this.props.locale) === 'de';
        const strings = {
            terminal: ['Pico UART', 'Pico-UART'],
            download: ['Download Pico BASIC UF2', 'Pico-BASIC-UF2 herunterladen'],
            send: ['Replace Pico listing and run…', 'Programm auf Pico ersetzen und ausführen…'],
            disconnect: ['Disconnect Pico UART', 'Pico-UART trennen'],
            reset: ['Reset the Pico now. Keep the USB-to-UART adapter connected.', 'Pico jetzt zurücksetzen. Den USB-UART-Adapter verbunden lassen.'],
            sent: ['Listing sent to Pico UART. Use Controller for input and output.', 'Programm an Pico-UART gesendet. Ein- und Ausgabe erfolgen im Controller.'],
            noPort: ['No serial adapters found.', 'Keine seriellen Adapter gefunden.'],
            port: ['Enter the number of your USB-to-UART adapter.', 'Nummer des USB-UART-Adapters eingeben.'],
            badPort: ['Choose a number from the adapter list.', 'Eine Nummer aus der Adapterliste auswählen.'],
            firmware: ['Copy the UF2 to the RPI-RP2 drive in BOOTSEL mode. The download contains the interpreter.',
                'UF2 im BOOTSEL-Modus auf das Laufwerk RPI-RP2 kopieren. Der Download enthält den Interpreter.']
        };
        return strings[key][de ? 1 : 0];
    }

    async downloadPicoBasicFirmware (profile) {
        if (this.state.busy) return;
        this.setState({busy: true});
        try {
            const bytes = await loadPicoBasicFirmware(profile);
            if (this._unmounted) return;
            await downloadBlob(`${profile.media}.uf2`, new Blob([bytes], {type: 'application/octet-stream'}));
            if (!this._unmounted) this.setState({status: this.picoBasicHardwareText('firmware')});
        } catch (error) {
            if (!this._unmounted) this.setState({status: error.message});
        } finally {
            if (!this._unmounted) this.setState({busy: false});
        }
    }

    closePicoBasicHardware = error => {
        const job = this._picoBasicHardware;
        if (!job) return this._picoBasicClosing;
        this._picoBasicHardware = null;
        job.unmirror?.();
        window.removeEventListener('bw-machine-media-load', job.mediaChanged);
        const close = job.session ? () => job.session.close() : () => job.transport?.close();
        const closing = Promise.resolve().then(close).catch(() => {}).finally(() => {
            if (this._picoBasicClosing === closing) this._picoBasicClosing = null;
        });
        this._picoBasicClosing = closing;
        if (!this._unmounted) this.setState({picoBasicConnected: false, status: error ? String(error.message || error) : ''});
        return closing;
    };

    async sendPicoBasicToHardware (profile) {
        if (this.state.busy || this._picoBasicClosing) return;
        let commands;
        try {
            commands = picoBasicCommands(this.activeCode(), profile.dialect);
        } catch (error) {
            this.setState({status: error.message});
            return;
        }
        const existing = this._picoBasicHardware;
        if (existing && existing.profile.id !== profile.id) return;
        const job = existing || {profile, mediaChanged: () => this.closePicoBasicHardware()};
        this._picoBasicHardware = job;
        const owns = () => !this._unmounted && this._picoBasicHardware === job;
        this.setState({busy: true, status: '', output: null});
        try {
            if (!existing) {
                // Invoke the browser chooser before any asynchronous module loading.
                const port = !window.__TAURI__?.core ? await navigator.serial.requestPort() : null;
                const [{createPicoBasicConsole}, {Terminal}, tauri, {webSerialTransport}] = await Promise.all([
                    import('../../lib/bw-machines/pico-basic-console.js'),
                    import(/* webpackChunkName: "bw-xterm" */ '@xterm/xterm'),
                    import('../../lib/pico-tauri-transport.js'),
                    import('../../lib/pico-repl.js')
                ]);
                if (!owns()) return;
                const {baudRate} = picoBasicConsoleSpec(profile.dialect);
                if (port) {
                    await port.open({baudRate});
                    try {
                        job.transport = webSerialTransport(port, {throwOnEof: true});
                    } catch (error) {
                        await port.close();
                        throw error;
                    }
                } else {
                    const ports = await tauri.listPorts();
                    if (!ports.length) throw new Error(this.picoBasicHardwareText('noPort'));
                    const choices = ports.map((path, i) => `${i + 1}. ${path}`).join('\n');
                    const choice = await promptAsync(`${this.picoBasicHardwareText('port')}\n${choices}`, ports.length === 1 ? '1' : '');
                    if (choice === null || !owns()) return;
                    const path = ports[Number(choice) - 1];
                    if (!path) throw new Error(this.picoBasicHardwareText('badPort'));
                    job.transport = await tauri.openTransport(path, baudRate);
                }
                if (!owns()) {
                    await job.transport.close();
                    return;
                }
                job.session = createPicoBasicConsole({
                    transport: job.transport, cursor: new Terminal({cols: 80, rows: 24, scrollback: 0, allowProposedApi: true}),
                    dialect: profile.dialect, openingMessage: this.picoBasicHardwareText('reset'),
                    onError: error => { if (owns()) this.closePicoBasicHardware(error); }
                });
                setCircuitView({fullWidth: false, dock: 'controller'});
                job.unmirror = window.bwMirrorMachineTerminal?.({
                    title: this.picoBasicHardwareText('terminal'), raw: job.session.terminal
                }, true);
                window.addEventListener('bw-machine-media-load', job.mediaChanged);
                this.setState({picoBasicConnected: true, status: this.picoBasicHardwareText('reset')});
            }
            await job.session.run(commands);
            if (owns()) this.setState({status: this.picoBasicHardwareText('sent')});
        } catch (error) {
            if (owns()) await this.closePicoBasicHardware(error.name === 'NotFoundError' ? null : error);
        } finally {
            if (owns() && !job.session) this.closePicoBasicHardware();
            if (!this._unmounted) this.setState({busy: false});
        }
    }

    async runPicoBasic (source, profile) {
        if (this._picoBasicHardware) await this.closePicoBasicHardware();
        if (!remoteMachineImagesAllowed()) {
            this.setState({status: 'Remote machine images are disabled in this build.'});
            return;
        }
        const media = libraryMedia.find(entry => entry.id === profile.media);
        this.setState({busy: true, status: this.L.basicLoading, output: null, basicRawOutput: '', basicIsBbc: false});
        try {
            const config = await openLibraryMedia(media);
            if (this._unmounted || this.currentDevice() !== 'pico' || this.state.lang !== 'basic' ||
                this.selectedBasicProfile()?.id !== profile.id) return;
            await runMachineConfig(config, {picoBasicSource: source});
            if (!this._unmounted) this.setState({status: ''});
        } catch (error) {
            if (!this._unmounted) this.setState({status: error.message});
        } finally {
            if (!this._unmounted) this.setState({busy: false});
        }
    }

    async runBasic () {
        const selection = this.selectedBasicProfile();
        const profile = selection?.id;
        if (!profile || this.state.busy || this.state.running || this.state.basicResetting) return;
        const code = this.activeCode();
        if (!code.trim()) {
            this.setState({status: this.L.basicEmpty});
            return;
        }
        if (this.state.basicGenerationFailed || this.basicGenerationPlaceholder(code)) return;
        if (profile === 'bbc' && this.state.basicEngine !== 'z80') return this.runCrispBasic(code);
        if (profile === 'bbc' && this.state.basicEngine === 'z80') {
            // The retro runner types each line at a console prompt. An
            // unnumbered statement would execute while loading, before RUN.
            // Admit the authored text as-is; never silently number or sort it.
            const line = this.z80BasicNumberingIssue(code);
            if (line !== null) {
                this.setState({status: this.L.basicZ80Numbering(line), basicDiagnostic: null,
                    output: null, basicRawOutput: '', basicIsBbc: false});
                return;
            }
        }
        if (profile === 'i8086-ubasic' && this.state.libraryProgram?.dosSourceName) {
            return this.runLibraryProgram();
        }
        // The 8086 profile compiles BASIC to a .COM and boots the DOS bench (the
        // C/asm-tab path), rather than running a 6502/Z80 ROM interpreter.
        if (profile === 'i8086') return this.runBasicOn8086(code);
        if (profile === 'i8086-dos') return this.runBasicOnRealDos(code);
        // The libre DOS-native interpreter path: uBASIC.EXE runs the program on
        // the 8086 DOS bench (the language itself runs on the machine).
        if (profile === 'i8086-ubasic') return this.runBasicOnDosInterp(code);
        if (selection.media) return this.runPicoBasic(code, selection);
        this.setState(s => ({output: '', running: true, status: this.L.basicLoading, basicRawOutput: '',
            basicIsBbc: false, crispBasicActive: false, basicDiagnostic: null, basicInputMethod: null,
            basicOutputRunId: s.basicOutputRunId + 1}));
        try {
            const isBbc = profile === 'bbc';
            let runner;
            if (isBbc) {
                const {BbcZ80Runner} = await import(/* webpackChunkName: "bw-board" */ 'bw-board/bbc-z80-runner.js');
                const res = await fetch('static/roms/bbcbasic.com');
                if (!res.ok) throw new Error('Failed to load bbcbasic.com');
                const com = new Uint8Array(await res.arrayBuffer());
                runner = new BbcZ80Runner({com}).start(code, {maxSteps: 200_000_000, inputs: []});
            } else {
                const {BasicMachineRunner} = await import(/* webpackChunkName: "bw-board" */ 'bw-board/basic-machine-runner.js');
                const res = await fetch('static/roms/basic.rom');
                if (!res.ok) throw new Error('Failed to load basic.rom');
                const rom = new Uint8Array(await res.arrayBuffer());
                runner = new BasicMachineRunner({rom}).start(code, {maxMs: 30000, inputs: []});
            }
            this.setState({status: '', basicIsBbc: isBbc});
            const pumpSlice = isBbc ? 500_000 : 50;
            const tick = () => {
                const r = runner.pump(pumpSlice);
                this.setState({output: r.output || '…', basicRawOutput: isBbc ? runner.rawOutput : ''});
                if (!r.done) { requestAnimationFrame(tick); return; }
                let suffix = '';
                if (r.reason === 'budget') suffix = '\n' + this.L.basicBudget(isBbc ? 0 : 30000);
                else if (r.reason === 'input-exhausted') suffix = '\n' + this.L.basicInputExhausted;
                else if (r.reason === 'no-ready-prompt') suffix = '\n' + this.L.basicNoPrompt;
                this.setState({output: (r.output + suffix).trim() || '(no output)', running: false,
                    basicRawOutput: isBbc ? runner.rawOutput : ''});
            };
            requestAnimationFrame(tick);
        } catch (e) {
            this.setState({output: `Error: ${e.message}`, running: false, status: ''});
        }
    }

    // Fetch examples/index.json once — the same file the Circuit tab's gallery
    // loads (see circuit-tab.jsx loadExamples). Kept as a fetch, not an import:
    // the catalog is data for a control most users never open. An entry needs
    // source for the Code editor. Wired ROM lessons can be tagged as circuits
    // even when they ship a program and a bootable image.
    async loadCatalog () {
        if (this.state.catalog || this._catalogLoading) return;
        this._catalogLoading = true;
        try {
            const res = await fetch('examples/index.json');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = (Array.isArray(data) ? data : (data.examples || []))
                .filter(ex => ex.files?.program && (ex.kind === 'program' || ex.kind === 'full' || ex.files.rom));
            this.setState({catalog: list, catalogError: null});
        } catch (e) {
            this.setState({catalogError: e.message});
        }
        this._catalogLoading = false;
    }

    // Normalize a device id for matching the catalog's `devices` values against
    // the Device dropdown's ids. Both sides are lowercase-with-dashes today
    // ('arduino-uno', 'stc12c5a60s2', 'attiny88', 'pico', 'eater6502'); the
    // normalization keeps a case or underscore drift from silently emptying the list.
    _normDevice (id) {
        return normalizeDeviceId(id);
    }

    catalogForDevice (device) {
        const selected = this._normDevice(device);
        return (this.state.catalog || []).filter(ex => {
            const devices = ex.devices || (ex.device ? [ex.device] : []);
            return devices.some(target => this._normDevice(target) === selected);
        });
    }

    // Load a catalog example's program.bw into the pseudocode editor. If the
    // program's DEVICE line differs from the selected device, retarget it via
    // SB3Creator.retargetPseudocode; a refusal shows its reasons in the status
    // line (the tab's existing warning surface) and loads nothing.
    async loadCatalogExample (ex, deviceOverride) {
        this.publishGameControls(null);
        this._lastCatalogExample = ex;
        // A row's device chip passes its device explicitly; a plain row
        // click keeps the buffer's DEVICE. Before the chips existed the
        // only way to pick was the separate device dropdown, which nobody
        // found — 'we click Nano and receive stc12 anyway' (owner).
        // kind:'full' examples (retro console, calculator) default to their
        // AUTHORED device — current-chip-first loaded a generated LED bench
        // where the curated build's matrices belonged (parity with cui's
        // ExamplesBrowser ca6d810).
        let device = (deviceOverride && this._normDevice(deviceOverride)) ||
            null;
        if (!device && ex.kind === 'full' && ex.authored) {
            device = this._normDevice(ex.authored);
        }
        if (!device) device = this.currentDevice();
        this.setState({showCatalog: false, busy: true, status: ''});
        try {
            const res = await fetch(`examples/${ex.files.program}`);
            if (!res.ok) throw new Error(`program: HTTP ${res.status}`);
            let src = await res.text();
            const exDevice = this._normDevice((src.match(/^DEVICE\s+([\w-]+)/im) || [])[1]);
            if (ex.files.rom && ex.files.circuit && /^(eater6502|6502|w65c02)$/.test(exDevice) &&
                (!device || device === exDevice)) {
                // The wired loader applies the circuit, faceplate and ROM in
                // order. Compiling only the declaration leaves the VDP idle.
                const outcome = await new Promise(complete => {
                    const handled = !window.dispatchEvent(new CustomEvent('bw-open-wired-machine-example', {
                        cancelable: true, detail: {example: ex, complete}
                    }));
                    if (!handled) complete({ok: false, error: 'The Circuit example loader is unavailable.'});
                });
                this.setState({busy: false, status: outcome.error ? this.L.stError(outcome.error) : ''});
                return;
            }
            let warnings = [];
            if (device && exDevice && exDevice !== device) {
                const SB3Creator = (await this.lib()).default;
                if (SB3Creator.retargetPseudocode) {
                    const result = SB3Creator.retargetPseudocode(src, device);
                    if (!result.ok) {
                        this.setState({busy: false,
                            status: `Cannot load "${ex.id}" for ${device}: ${(result.reasons || []).join('; ')}`});
                        return;
                    }
                    src = result.pseudocode;
                    warnings = result.warnings || [];
                }
            }
            const resolvedBench = resolveExampleBench(ex, device, exDevice);
            if (resolvedBench.error) {
                this.setState({busy: false, status: resolvedBench.error});
                return;
            }
            // Loading an example must produce a RUNNABLE project, not just
            // editor text: without the compile the VM kept the previous
            // project's pins and device, the Circuit tab rendered the OLD
            // chip and the debugger said 'no pins declared' (owner report:
            // Nano + 8-LED chaser showed an stc12, 2026-08-17). setState is
            // async — compile in its callback, on the NEW buffer.
            this._codeArtwork = null;
            this._animationImport = null;
            this._makeCodeRequest = null;
            this.setState({...this.authoredCodeState('pseudocode', src), busy: false, output: null, uploads: [],
                status: warnings.length ? warnings.join('; ') : ''},
            () => {
                Promise.resolve(this.compile({scratchExample: !device && !exDevice && !ex.files?.controller})).catch(e => this.setState(
                    {status: `Loaded, but building the project failed: ${e.message}`}));
            });
            // A FACEPLATE example ships a controller layout beside its
            // program (files.controller): restore it into the live panel so
            // the widgets + variable bindings arrive ready-made. Same shape
            // gui.jsx restores from runtime.stc.controller on PROJECT_LOADED.
            if (ex.files && ex.files.controller) {
                try {
                    const cres = await fetch(`examples/${ex.files.controller}`);
                    if (cres.ok) {
                        const layout = await cres.json();
                        const rt = this.props.vm && this.props.vm.runtime;
                        const panel = rt && rt.controllerPanel;
                        if (panel && layout && Array.isArray(layout.widgets)) {
                            clearControllerPanel(panel);
                            // ONE BAD WIDGET MUST NOT EMPTY THE PANEL. This loop
                            // removes every existing widget before it adds any,
                            // and used to sit inside the outer bare `catch` — so
                            // a single `addWidget` throw (an unknown type, a
                            // duplicate name) left the panel with nothing at all
                            // and no message. `6502-terminal` declared a
                            // `terminal` widget the model did not have, and lost
                            // its keyboard along with its screen
                            // (docs/LESSON-REVIEW-WAVE-4.md defect 8). Skip the
                            // widget that fails, keep the rest, and say so.
                            const skipped = [];
                            for (const w of layout.widgets) {
                                try {
                                    const added = panel.addWidget(w.name, w.type, w.config || {}, w.layout || {});
                                    if (w.binding) added.binding = { ...w.binding };
                                } catch (err) {
                                    skipped.push(`${w && w.name} (${w && w.type})`);
                                }
                            }
                            if (skipped.length) {
                                this.setState(st => ({status: [st.status,
                                    `Controller layout: skipped ${skipped.join(', ')}`]
                                    .filter(Boolean).join('; ')}));
                            }
                            // A layout that names no mode opens in `edit`, where
                            // every input control renders disabled — so a
                            // faceplate of buttons comes up dead. Four shipped
                            // layouts were in that state; they now declare it,
                            // and the panel's own toJSON carries it through a
                            // save (Wave 4 defect 5b).
                            panel.setHideBindings?.(!!layout.hideBindings);
                            if (layout.mode) panel.setMode(layout.mode);
                            if (rt.stc) rt.stc.controller = layout;
                        }
                    }
                } catch { /* a faceplate without its layout still loads the program */ }
            }
            // The PROGRAM retargeted; the BENCH must follow or the runner
            // falls back to an inferred, unseated board. But the AUTHORED
            // circuit outranks any generated bench for the example's own
            // device: the calculator's authored board has the real 16-button
            // matrix and the OLED, while the generated bench is a generic
            // LED-per-pin approximation (owner screenshots, 2026-08-17).
            // Only a genuinely retargeted device gets its generated bench.
            const benchPath = resolvedBench.path;
            if (benchPath && typeof window !== 'undefined') {
                const detail = {benchPath, exampleId: ex.id, device: device || exDevice};
                // Stash before dispatch: the Circuit tab consumes the event,
                // but the debug RUNNER may boot later (or without that tab
                // ever mounting) and must find the example's real circuit
                // instead of inferring a phantom bench (owner report — the
                // multimeter showed 8 auto-LEDs where the LM358 build was).
                window.__bwExampleBench = detail;
                window.dispatchEvent(new CustomEvent('bw-example-bench', {detail}));
            }
        } catch (e) {
            this.setState({busy: false, status: this.L.stError(e.message)});
        }
    }

    async loadExample (key) {
        const request = {};
        this._bundledExampleSelection = request;
        const loaded = key && (await this._loadBundledExamples());
        const src = loaded && loaded[key];
        if (!src || this._unmounted || this._bundledExampleSelection !== request) return;
        const exampleTitle = GROUPS.flatMap(group => group.items).find(([id]) => id === key)?.[1];
        if (exampleTitle) this.props.dispatch(setProjectTitle(exampleTitle.replace(/^[^\p{L}\p{N}]+/u, '')));
        this._codeArtwork = null;
        this._animationImport = null;
        this._makeCodeRequest = null;
        this.setState({uploads: []});
        this.publishGameControls(GROUPS[0].items.some(([gameKey]) => gameKey === key) ? key : null);
        // Selection is an explicit request to replace the program, as in Circuit's
        // example browser. Compile only after React has committed the new buffer.
        const apply = patch => new Promise(resolve => {
            if (this._unmounted || this._bundledExampleSelection !== request) { resolve(); return; }
            this.setState({...patch, ...this.authoredCodeState('pseudocode', patch.buffers.pseudocode)}, () => {
                if (this._unmounted || this._bundledExampleSelection !== request) { resolve(); return; }
                Promise.resolve(this.compile({scratchExample: !device && !exampleDevice})).then(() => {
                    if (patch.status && !this._unmounted && this._bundledExampleSelection === request) {
                        this.setState(state => ({status: [patch.status, state.status].filter(Boolean).join(' · ')}));
                    }
                }).catch(error => {
                    if (!this._unmounted) this.setState({status: this.L.stError(error.message)});
                }).finally(resolve);
            });
        });
        const device = this.currentDevice();
        const exampleDevice = (src.match(/^DEVICE\s+([\w-]+)/im) || [])[1];
        // Retarget hardware examples when the selected device differs.
        if (device && exampleDevice && device !== exampleDevice.toLowerCase()) {
            const SB3Creator = (await this.lib()).default;
            // A pool-less target (the i8086 DOS bench) has no MCU pins to remap;
            // retargetPseudocode would refuse it ("unknown device"). Load the
            // example with its DEVICE line switched instead — its PIN/PART lines
            // are inert on the bench. Mirrors the setDevice guard.
            if (!(SB3Creator.RETARGET_POOLS && SB3Creator.RETARGET_POOLS[device])) {
                const switched = src.replace(/^DEVICE\s+[\w-]+.*$/im, `DEVICE ${device.toUpperCase()}`);
                return apply({lang: 'pseudocode', output: null, status: '',
                    buffers: {pseudocode: switched, python: '', javascript: '', c: '', basic: '', asm: '', micropython: ''}});
            }
            const result = SB3Creator.retargetPseudocode(src, device);
            if (result.ok) {
                return apply({lang: 'pseudocode', output: null,
                    status: result.warnings.length ? result.warnings.join('; ') : '',
                    buffers: {pseudocode: result.pseudocode, python: '', javascript: '', c: '', basic: '', asm: '', micropython: ''}});
            }
            // Show what blocked the retarget — the example stays loaded in its original form.
            return apply({lang: 'pseudocode', output: null,
                status: `Loaded for ${exampleDevice} (cannot retarget to ${device}: ${result.reasons.join('; ')})`,
                buffers: {pseudocode: src, python: '', javascript: '', c: '', basic: '', asm: '', micropython: ''}});
        }
        return apply({lang: 'pseudocode', output: null, status: '',
            buffers: {pseudocode: src, python: '', javascript: '', c: '', basic: '', asm: '', micropython: ''}});
    }

    publishGameControls (gameKey) {
        const runtime = this.props.vm && this.props.vm.runtime;
        if (!runtime) return;
        runtime.bwGameControlKey = gameKey || null;
        runtime.emit('BW_GAME_CONTROLS_CHANGED', runtime.bwGameControlKey);
        if (gameKey && typeof window !== 'undefined') {
            try { localStorage.setItem('bw-right-pane-hidden', '0'); } catch { /* private mode */ }
            window.dispatchEvent(new CustomEvent('bw-settings-change', {
                detail: {key: 'bw-right-pane-hidden', value: '0'}
            }));
        }
    }

    gameKeyForSource (source) {
        if (!source) return null;
        const firstLine = String(source).split('\n', 1)[0].trim();
        const match = GROUPS[0].items.find(([key]) =>
            String(examples[key] || '').split('\n', 1)[0].trim() === firstLine);
        return match ? match[0] : null;
    }
    // Sprite names declared in the current pseudocode — used to populate the
    // "associate SVG → sprite" dropdowns so you pick a real sprite, not guess a name.
    spriteNames () {
        const src = this.state.lang === 'pseudocode' ? this.activeCode() : this.state.buffers.pseudocode;
        const names = [];
        const re = /^\s*SPRITE\s+([^\s:]+)/gm;
        let m;
        while ((m = re.exec(src || '')) !== null) names.push(m[1]);
        return names;
    }
    handleFiles (e) {
        const files = Array.from(e.target.files || []);
        files.forEach(f => {
            if (!/\.svg$/i.test(f.name) && !f.type.includes('svg')) return;
            const reader = new FileReader();
            reader.onload = () => this.setState(s => ({
                uploads: [...s.uploads, {sprite: '', filename: f.name, svg: String(reader.result), mode: 'replace'}]
            }));
            reader.readAsText(f);
        });
        e.target.value = '';
    }
    setUpload (i, patch) {
        this.setState(s => ({uploads: s.uploads.map((u, idx) => (idx === i ? {...u, ...patch} : u))}));
    }
    removeUpload (i) {
        this.setState(s => ({uploads: s.uploads.filter((_, idx) => idx !== i)}));
    }
    // Compile the active tab's code to blocks. Python/JavaScript go through their
    // parser to pseudocode first. After loading, the other two tabs are regenerated
    // from the compiled project so all three stay consistent.
    /**
     * The ASM tab reads back to blocks only for 8086 assembly the ▶ button
     * produced (plan task L1): the reader lifts the emitter's own shapes and
     * refuses everything else by name. Other devices' assembly stays one-way.
     */
    canLiftAsm () {
        return this.state.lang === 'asm' && this.state.asmMode === 'source' &&
            asmTargetForDevice(this.currentDevice()) === 'i8086';
    }

    // fe, Tcl and Forth interpreters exist only as DOS programs. On any other
    // board the program runs as its blocks, which the debugger builds as C.
    async runViaBlocksOnDevice () {
        await this.compile();
        if (this.state.conversionReport?.preserved) showCircuitDebugger();
    }
    async compile ({strict = false, pseudocode = null, scratchExample = false} = {}) {
        if (pseudocode == null && this.state.lang === 'basic' && this.standaloneBasicProfile()) return;
        const vm = this.props.vm;
        const conversionRequest = {};
        this._conversionRequest = conversionRequest;
        const buffersAtStart = this.state.buffers;
        const languageAtStart = this.state.lang;
        let authoredDocument = this.codeDocumentSnapshot();
        if (typeof pseudocode === 'string' &&
            (authoredDocument.lang !== 'pseudocode' || authoredDocument.code !== pseudocode)) {
            authoredDocument = editCodeDocument(authoredDocument, {lang: 'pseudocode', code: pseudocode,
                runtime: null, generationOptions: this.codeGenerationOptions()});
        }
        let ownedAnimation = this._animationImport;
        let ownedMakeCodeRequest = this._makeCodeRequest;
        const ownsConversion = () => !this._unmounted && this.props.vm === vm &&
            this._conversionRequest === conversionRequest;
        // Buffers are immutable editor revisions. Equality of the source text
        // alone would allow an edit/revert to revive an older conversion.
        const ownsEditor = state => ownsConversion() &&
            state.buffers === buffersAtStart && state.lang === languageAtStart &&
            this._animationImport === ownedAnimation && this._makeCodeRequest === ownedMakeCodeRequest;
        const publishEditor = patch => this.setState(state => ownsEditor(state) ?
            (typeof patch === 'function' ? patch(state) : patch) : null);
        // A device retarget compiles the rewritten canonical program even when
        // a generated, one-way language tab is visible. Ordinary To blocks still
        // compiles the active editable language and keeps its existing checks.
        const lang = typeof pseudocode === 'string' ? 'pseudocode' : this.state.lang;
        if (!TWO_WAY.has(lang) && !this.canLiftAsm()) { this.setState({busy: false, status: this.L.stCOneWay}); return; }
        this.setState({busy: true, status: this.L.stCompiling});
        const pending = this._animationImport;
        const uploads = this.state.uploads;
        const appliedUploads = new Set();
        const stage = this.props.vm.runtime.getTargetForStage();
        const activeAtStart = this.activeCode();
        try {
            let source = typeof pseudocode === 'string' ? pseudocode : this.activeCode();
            const refusal = codeDocumentConversionRefusal(this.state.codeDocument, lang, source);
            if (refusal) throw new Error(refusal);
            let parseWarnings = [];
            if (lang === 'asm') {
                const lift = (await import(/* webpackChunkName: "bw-asm-reader" */ '../../lib/bw-asm/asm-8086-to-pseudocode.js')).default;
                const res = lift(source);
                if (!res.ok) {
                    publishEditor({status: this.L.asmLiftRefused(res.error.message, res.stats.lifted)});
                    return;
                }
                source = this.convertedSource(res);
                parseWarnings = [this.L.asmLifted(res.stats.lifted)];
            } else if (lang === 'python') {
                const res = (await import(/* webpackChunkName: "sb3-creator-readers" */ '../../lib/robot-lab-pseudocode.js')).readPython(source);
                if (strict && res.unsupported?.length) throw new Error(res.unsupported.join(' · '));
                source = this.convertedSource(res); parseWarnings = res.warnings || [];
            } else if (lang === 'javascript') {
                const res = (await import(/* webpackChunkName: "sb3-creator-readers" */ '../../lib/robot-lab-pseudocode.js')).readJavaScript(source);
                source = this.convertedSource(res); parseWarnings = res.warnings || [];
            } else if (lang === 'basic') {
                if (this.state.basicGenerationFailed || this.basicGenerationPlaceholder(source)) {
                    throw new Error((this.state.basicWarnings || []).join('\n') || 'BASIC generation was refused. Remove or replace the generation-error banner.');
                }
                const res = (await import(/* webpackChunkName: "sb3-creator-basic" */ '../../lib/sb3-creator-basic.js')).default(source);
                if (res.ok === false) throw new Error((res.reasons || []).join('\n') || 'BASIC conversion refused.');
                source = this.convertedSource(res); parseWarnings = res.warnings || [];
            } else if (DOS_LANG[lang]) {
                const res = (await DOS_LANG[lang].load()).default(source);
                if (strict && res.warnings.length) throw new Error(res.warnings.join(' · '));
                source = this.convertedSource(res); parseWarnings = res.warnings || [];
            } else if (lang === 'c') {
                // Keil C51 is a different dialect — sbit/sfr/_at_/reg5x headers that SDCC
                // does not accept and our front end does not model. stc-compiler already
                // solves that (546/597 of an 86-repo corpus), so normalise through it first
                // rather than teaching the front end a second dialect. Best effort: if the
                // service is unreachable we parse the original text and say so.
                let text = source;
                if (this.looksLikeKeil(source)) {
                    const t = await this.translateKeil(source);
                    if (t.ok) { text = t.code; parseWarnings.push('Keil C51 normalised to SDCC via stc-compiler'); }
                    else parseWarnings.push(`could not reach the Keil translator (${t.error}) — parsing the original`);
                }
                const res = await this.readC(text);
                source = this.convertedSource(res); parseWarnings = parseWarnings.concat(res.warnings || []);
            }
            const SB3Creator = (await this.lib()).default;
            const creator = new SB3Creator();
            creator.parse(source);
            const sourceDeclarations = JSON.parse(JSON.stringify(creator.project));
            const missing = [];
            uploads.forEach(u => {
                const name = (u.sprite || '').trim();
                if (!name || !u.svg) return;
                const ok = u.mode === 'add' ?
                    creator.addCustomSVGCostume(name, u.svg, u.filename.replace(/\.svg$/i, '')) :
                    creator.applyCustomSVG(name, u.svg);
                // A game's art keeps the name the translation gave it (hero,
                // coinAnimation 2) instead of the creator's default costume1,
                // so the costume list in the paint editor says what each is.
                if (ok && u.mode !== 'add' && u.costumeName) {
                    const target = creator.project.targets.find(t => !t.isStage && t.name === name);
                    if (target?.costumes?.[0]) target.costumes[0].name = String(u.costumeName);
                }
                if (!ok) missing.push(name);
                else appliedUploads.add(u);
            });
            if (strict && (parseWarnings.length || creator.warnings.length)) throw new Error([...parseWarnings, ...creator.warnings].join(' · '));
            const context = codeArtworkMatches(this.props.vm, this._codeArtwork) ? this._codeArtwork : null;
            if (lang === 'pseudocode' && this._makeCodeProject && this._makeCodeProject.files &&
                typeof this._makeCodeImportedCode === 'string' && source === this._makeCodeImportedCode) {
                creator.project.bwMakeCode = makeCodeOriginal.record(this._makeCodeProject.target,
                    this._makeCodeProject.files, this._makeCodeProject.name);
                if (this._makeCodeProject.dependencyInputs) creator.project.bwMakeCode.dependencyInputs = this._makeCodeProject.dependencyInputs;
            }
            const blob = await creator.generateSB3();
            let projectBytes = await blob.arrayBuffer();
            let artwork = null;
            if (context || pending) {
                const module = await import('jszip');
                const ZIP = module.default || module;
                const zip = await ZIP.loadAsync(projectBytes);
                if (context) retainCodeArtwork(zip, creator.project, this.props.vm, context, uploads);
                const revision = context && captureCodeArtworkRevision(this.props.vm, context);
                if (pending) {
                    if (pending.stage !== stage) throw new Error('The loaded project changed since this animation import. Import it again.');
                    const {installAnimationImport} = await import('../../lib/bw-animation-import.js');
                    const storage = this.props.vm.runtime.storage;
                    await installAnimationImport(zip, pending.resources, bytes => storage.createAsset(
                        storage.AssetType.ImageVector, storage.DataFormat.SVG, bytes, null, true).assetId);
                }
                projectBytes = await zip.generateAsync({type: 'arraybuffer', compression: 'DEFLATE'});
                artwork = await inspectArtwork(projectBytes);
                if (artwork.outcome === 'invalid' || (context && (!codeArtworkMatches(this.props.vm, context) ||
                    !codeArtworkRevisionMatches(this.props.vm, revision)))) {
                    throw new Error(artwork.reason || 'Artwork or the loaded project changed while preparing this conversion. Read From blocks again.');
                }
            }
            if (!ownsEditor(this.state)) return;
            if (this.props.vm.runtime.getTargetForStage() !== stage || this._animationImport !== pending || this.state.uploads !== uploads ||
                this.activeCode() !== activeAtStart) throw new Error('The code or loaded project changed while preparing this conversion. Try again.');
            // A request still preparing a new conversion does not revoke the
            // metadata of the project this load actually applies. A newer VM
            // load or a changed loaded stage does revoke that authority.
            this._conversionProjectLoad = conversionRequest;
            await this.props.vm.loadProject(projectBytes);
            const loadedStage = this.props.vm.runtime.getTargetForStage();
            const ownsLoadedProject = () => this._conversionProjectLoad === conversionRequest &&
                !this._unmounted && this.props.vm === vm &&
                this.props.vm.runtime.getTargetForStage() === loadedStage;
            if (!ownsLoadedProject()) return;
            if (ownsEditor(this.state)) {
                this._animationImport = ownedAnimation = null;
                this._makeCodeRequest = ownedMakeCodeRequest = null;
            }
            if (artwork) applyArtwork(artwork, this.props.vm);
            // The loaded project owns applied uploads, including ordinary SVG
            // imports with no animation bundle. Later conversions read its live
            // artwork instead of replaying stale imports or append operations.
            this._codeArtwork = captureCodeArtwork(this.props.vm, creator.project, sourceDeclarations);
            // Auto-select the first sprite with scripts so the Blocks palette
            // shows meaningful blocks, not "Stage selected — no motion blocks".
            if (vm.runtime && vm.runtime.targets) {
                const best = vm.runtime.targets.find(
                    t => !t.isStage && t.blocks.getScripts().length > 0
                ) || vm.runtime.targets.find(t => !t.isStage);
                if (best && ownsEditor(this.state)) {
                    vm.setEditingTarget(best.id);
                }
            }
            // The .sb3 carries the STC12 declarations as a top-level `stc` key, but
            // scratch-vm's serializer only knows targets/monitors/extensions/meta and
            // drops everything else — so vm.toJSON().stc has always come back
            // undefined, and every reader of it (the circuit designer, the simulator
            // driver's pin table) silently saw a project with no pins. Keep them on
            // the runtime, which survives for as long as the project is loaded.
            // Not a substitute for the VM carrying them: re-opening a saved .sb3
            // still loses the pins until it does.
            // Set stc on the runtime AND write the persistence comment so it
            // survives a save/reload cycle. readStc recovers from the comment if
            // the top-level key was stripped by a foreign round trip.
            const stc = creator.project.stc || null;
            if (stc) stc.pinsSource = 'program';
            { const stcTraceObj = stc; if (typeof window !== 'undefined') { (window.__bwStcTrace = window.__bwStcTrace || []).push({who: 'importerCompile', t: Date.now(), b4: JSON.stringify((stcTraceObj && stcTraceObj.pins || []).find(p => p.name === 'b4') || null)}); } }
            if (this.props.vm.setStc) {
                this.props.vm.setStc(stc);
            } else {
                this.props.vm.runtime.stc = stc;
            }
            // Announce it. The readers (circuit-tab, the debugger pane, the
            // engine picker) re-read runtime.stc on PROJECT_CHANGED, and until
            // now that event only came from the workspace reload echoing its
            // own Blockly events into the VM a task later — an echo that also
            // replaced every block object (lib/workspace-reload-events.js).
            if (this.props.vm.runtime.emitProjectChanged) this.props.vm.runtime.emitProjectChanged();
            this.publishAppliedDevice(stc);
            // Re-call getInfo() on loaded extensions so device-dependent gating
            // (e.g. hiding PWM blocks on AVR, PCA blocks on STC89) takes effect.
            if (this.props.vm.extensionManager && this.props.vm.extensionManager.refreshBlocks) {
                await this.props.vm.extensionManager.refreshBlocks({throwOnError: true});
            }
            if (!ownsLoadedProject()) return;
            // Write the persistence comment on the stage target
            if (stc) {
                const SB3Creator = (await this.lib()).default || (await this.lib());
                if (!ownsLoadedProject()) return;
                if (SB3Creator.writeStcComment) {
                    const proj = JSON.parse(this.props.vm.toJSON());
                    proj.stc = stc;
                    SB3Creator.writeStcComment(proj);
                    // Write the comment back onto the actual stage target's comments
                    const stage = this.props.vm.runtime.getTargetForStage();
                    if (stage && proj.targets) {
                        const serialStage = proj.targets.find(t => t.isStage);
                        if (serialStage && serialStage.comments) {
                            const comment = serialStage.comments[SB3Creator.STC_COMMENT_ID];
                            if (comment) {
                                stage.createComment(SB3Creator.STC_COMMENT_ID,
                                    null, comment.text, comment.x, comment.y,
                                    comment.width, comment.height, comment.minimized);
                            }
                        }
                    }
                }
            }
            // Show the target the blocks actually landed on. Every program this
            // dialect generates is Stage-only, so `find(!isStage)` returns
            // undefined and the old `if (first)` quietly did nothing: the editor
            // kept whichever target was selected before the import, and the new
            // blocks were real, correct, and on a Stage nobody was looking at.
            // That is what "to blocks does not draw the blocks" was.
            const first = this.props.vm.runtime.targets.find(target => !target.isStage) ||
                this.props.vm.runtime.getTargetForStage();
            if (first && ownsEditor(this.state)) this.props.vm.setEditingTarget(first.id);
            // regenerate the other tabs from the compiled project
            if (!ownsEditor(this.state)) return;
            const proj = creator.project;
            if (scratchExample && !stc?.device) {
                setCircuitView({fullWidth: false, dock: 'off', rightPaneVisible: usesScratchStage(proj)});
            }
            const nb = {...this.state.buffers};
            if (lang !== 'pseudocode') nb.pseudocode = new SB3Creator().decompile(proj);
            if (lang !== 'python') nb.python = new SB3Creator().generatePython(proj, this.genOpts('python'));
            if (lang !== 'javascript') nb.javascript = this.state.jsExecution === OWNED_CONSOLE_EXECUTION ? '' :
                new SB3Creator().generateJavaScript(proj, this.genOpts('javascript'));
            if (lang !== 'c') nb.c = new SB3Creator().generateC(proj);
            let basicWarnings = [];
            let basicGenerationFailed = false;
            if (lang !== 'basic') {
                const br = new SB3Creator().generateBASIC(proj, this.basicGenerationOptions());
                nb.basic = br.ok ? br.basic : `REM === Cannot show as BASIC ===\n${br.reasons.map(s => 'REM ' + s).join('\n')}`;
                basicWarnings = [...(br.reasons || []), ...(br.warnings || [])];
                basicGenerationFailed = !br.ok;
            }
            // fe and Tcl are NOT regenerated here: their generators load lazily, and
            // awaiting them inside compile() raced with the user on a slow runner —
            // after the snapshot above it overwrote an edit typed meanwhile; before
            // loadProject it reloaded the project after a machine had started and
            // stopped it. Other interpreter tabs re-derive when opened.
            for (const l of Object.keys(DOS_LANG)) if (l !== lang) nb[l] = '';
            {
                const mp = new SB3Creator().generateMicroPython(proj);
                nb.micropython = mp.ok ? mp.py : `# === Cannot generate MicroPython ===\n${mp.reasons.map(s => '# ' + s).join('\n')}`;
            }
            const warns = [...parseWarnings, ...creator.warnings];
            if (missing.length) warns.push(`no sprite named: ${missing.join(', ')}`);
            const classified = classifyConversionWarnings(warns);
            publishEditor(state => ({
                ...this.withRetainedDrafts(this.codeDocumentState(this.codeDocumentWithBuffers(nb, authoredDocument.lang, languageAtStart,
                    {changed: classified.changed, unsupported: classified.unsupported}, authoredDocument)), state, lang),
                basicWarnings, basicGenerationFailed, basicFilename: 'editor.bas',
                // This flag belongs to the admitted buffer regeneration too.
                importedPython: false,
                uploads: state.uploads.filter(upload => !appliedUploads.has(upload)),
                status: warns.length ? this.L.stWarn(warns.slice(0, 4).join(' · ')) : this.L.stLoaded,
                conversionReport: {direction: `${LANG_LABEL[lang] || lang} → Blocks`, preserved: true,
                    changed: classified.changed, unsupported: classified.unsupported}
            }));
        } catch (e) {
            const failure = conversionFailure(e);
            publishEditor({status: this.L.stError(failure.message), conversionReport: {
                direction: `${LANG_LABEL[lang] || lang} → Blocks`, preserved: false,
                changed: [], unsupported: failure.issues,
                ...(failure.diagnostics ? {diagnostics: failure.diagnostics, sourceSpan: failure.sourceSpan,
                    code: failure.code} : {})
            }});
            if (strict) throw e;
        } finally {
            // React may apply this updater after a newer conversion starts.
            this.setState(() => ownsConversion() ? {busy: false} : null);
        }
    }
    // Read the running project into all languages at once.
    async fromBlocks () {
        if (this.state.lang === 'basic' && this.standaloneBasicProfile()) return;
        const request = {};
        this._deriveRequest = request;
        const vm = this.props.vm;
        const lang = this.state.lang;
        const previousBuffers = this.state.buffers;
        const originalProject = vm.toJSON();
        const ownsRequest = () => !this._unmounted && this._deriveRequest === request;
        const ownsEditor = state => ownsRequest() && this.props.vm === vm && state.lang === lang &&
            state.buffers === previousBuffers && vm.toJSON() === originalProject;
        this.setState({busy: true, status: this.L.stReading, conversionReport: null});
        try {
            const SB3Creator = (await this.lib()).default;
            const {assetLibraryRecords, withoutAssetLibraries} = await import('../../lib/bw-asset-library.js');
            const savedProject = JSON.parse(originalProject);
            const project = withoutAssetLibraries(savedProject, assetLibraryRecords(vm, savedProject));
            // VM serialization can retain device declarations only in the
            // Stage persistence comment. Restore them before any generator,
            // including legacy BASIC, reads this detached project snapshot.
            if (!project.stc) {
                const stc = SB3Creator.readStc(project);
                if (stc) project.stc = stc;
            }
            const basicResult = new SB3Creator().generateBASIC(project, this.basicGenerationOptions());
            const mpResult = new SB3Creator().generateMicroPython(project);
            const buffers = {
                pseudocode: new SB3Creator().decompile(project),
                python: new SB3Creator().generatePython(project, this.genOpts('python')),
                javascript: lang !== 'javascript' && this.state.jsExecution === OWNED_CONSOLE_EXECUTION ? '' :
                    new SB3Creator().generateJavaScript(project, this.genOpts('javascript')),
                c: new SB3Creator().generateC(project),
                basic: basicResult.ok ? basicResult.basic : `REM === Cannot show as BASIC ===\n${basicResult.reasons.map(s => 'REM ' + s).join('\n')}`,
                asm: this.state.buffers.asm ?? '',
                nqc: this.state.buffers.nqc ?? '',
                ...standaloneBasicDrafts(this.state.buffers),
                micropython: mpResult.ok ? mpResult.py : `# === Cannot generate MicroPython ===\n${mpResult.reasons.map(s => '# ' + s).join('\n')}`,
                ...(await dosLangBuffersFor(project, lang))
            };
            if (lang === 'javascript' && this.state.jsExecution === OWNED_CONSOLE_EXECUTION &&
                !/^\/\/ owned-console-v1:/m.test(buffers.javascript)) {
                throw new Error('This compiler revision does not support console programs.');
            }
            if (!ownsEditor(this.state)) return;
            const baseline = new SB3Creator();
            baseline.parse(buffers.pseudocode);
            this._animationImport = null;
            this._makeCodeRequest = null;
            this._codeArtwork = captureCodeArtwork(this.props.vm, baseline.project);
            // Diagnostics sit inside scripts too, indented, so match any indent and
            // list each one: a count of column-0 comments reported "✓ OK" for them.
            const unsupportedDiagnostics = Array.from(buffers.pseudocode.matchAll(/^\s*# unsupported:\s*(.*)$/gm), match => match[1].trim());
            const unsupported = unsupportedDiagnostics.length;
            this._codeRestoreError = null;
            this.setState(state => ownsEditor(state) ? {
                ...this.withRetainedDrafts(this.codeDocumentState(this.codeDocumentWithBuffers(buffers, 'pseudocode', lang,
                    {changed: [], unsupported: unsupportedDiagnostics})), state),
                importedPython: false,
                basicWarnings: [...(basicResult.reasons || []), ...(basicResult.warnings || [])],
                basicGenerationFailed: !basicResult.ok, basicFilename: 'editor.bas',
                uploads: [], // the live project now owns its artwork; old import SVGs are stale
                output: null,
                status: unsupported ?
                    `Read into all languages — ${unsupported} unsupported diagnostic(s) retained in Code.` :
                    'Read the current project into all languages. Edit any of them, then “To blocks”.',
                conversionReport: {direction: 'Blocks → Code', preserved: true, changed: [],
                    unsupported: unsupportedDiagnostics}
            } : null);
        } catch (e) {
            const failure = conversionFailure(e);
            this.setState(state => ownsEditor(state) ? {status: this.L.stError(failure.message), conversionReport: {
                direction: 'Blocks → Code', preserved: false, changed: [], unsupported: failure.issues
            }} : null);
        } finally {
            this.setState(() => ownsRequest() ? {busy: false} : null);
        }
    }

    /** Imperative API: highlight a source line (1-based) in the editor.
     *  Used by the debugger for BASIC TRACE glow and current-PC highlight. */
    setHighlightedLine (n) {
        if (this._cmEditor && this._cmEditor.setHighlightedLine) {
            this._cmEditor.setHighlightedLine(n);
        }
    }

    setMaximizedChrome (active) {
        if (active && this._chromeBeforeMaximize === undefined) {
            this._chromeBeforeMaximize = document.body.classList.contains('bw-compact-chrome');
        } else if (active || this._chromeBeforeMaximize === undefined) return;
        const compact = active || this._chromeBeforeMaximize;
        if (!active) this._chromeBeforeMaximize = undefined;
        window.dispatchEvent(new CustomEvent('bw-chrome-compact-request', {detail: {compact}}));
    }

    /** Toggle maximize: collapse reference/art/info panels and hide the right pane. */
    toggleMaximize () {
        const next = !this.state.maximized;
        this.setMaximizedChrome(next);
        this.setState({maximized: next, actionsOpen: false, showArt: false, showInfo: false, showMatrix: false});
        try { localStorage.setItem('bw-editor-max', next ? '1' : '0'); } catch { /* noop */ }
        // Toggle the right pane via the existing mechanic
        window.dispatchEvent(new CustomEvent('bw-settings-change', {
            detail: {key: 'bw-right-pane-hidden', value: next ? '1' : '0'}
        }));
    }

    renderAsmExamplePicker (menu) {
        const locale = pickLocale(this.props.locale);
        return (
            <label data-code-machine-select={menu || undefined}
                style={menu ? undefined : {display: 'flex', alignItems: 'center', gap: 4}}>
                {menu && <Icon name="example" />}
                {this.L.asmExampleLabel}
                <select data-testid={menu ? 'bw-asm-examples-menu' : 'bw-asm-examples'}
                    disabled={this.state.busy} onChange={event => this.loadAsmExample(event.target.value)}
                    style={{padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1'}} value="">
                    <option value="">{this.L.asmExamplePick}</option>
                    {this._asmExamples().map(example => (
                        <option key={example.id} value={example.id}>
                            {locale === 'de' ? example.labelDe : example.label}
                        </option>
                    ))}
                </select>
            </label>
        );
    }

    renderCatalogControl (item) {
        const {showCatalog, showCatalogFull, catalogError, catalog, exampleFilter} = this.state;
        const device = this.currentDevice();
        const locale = pickLocale(this.props.locale);
        const de = locale === 'de';
        const query = exampleFilter.trim().toLowerCase();
        const rows = this.catalogForDevice(device).filter(({title = {}, id}) =>
            !query || [title.en, title.de, id].some(value => String(value || '').toLowerCase().includes(query)));
        const close = () => this.setState({showCatalogFull: false});
        const list = full => (
            <div data-testid="bw-catalog-panel" data-device={device || ''}
                data-catalog={catalogError ? 'error' : catalog ? 'ready' : 'loading'}
                style={{display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1,
                    maxHeight: full ? undefined : 300, padding: 6, gap: 6}}>
                <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                    <input type="search" value={exampleFilter} autoFocus onChange={e => this.setState({exampleFilter: e.target.value})}
                        placeholder={this.L.searchExamples} aria-label={this.L.searchExamples}
                        style={{flex: 1, minWidth: 0, padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, font: 'inherit'}}
                        data-testid="bw-catalog-search" />
                    {!full && <button type="button" style={toolStyles(false).button}
                        aria-label={de ? 'Beispielbibliothek öffnen' : 'Open full examples library'}
                        title={de ? 'Beispielbibliothek öffnen' : 'Open full examples library'}
                        onClick={() => this.setState({showCatalogFull: true, actionsOpen: false})}>⛶</button>}
                </div>
                <div style={{overflowY: 'auto', minHeight: 0, scrollbarWidth: 'thin', display: 'grid',
                    gridTemplateColumns: full ? 'repeat(auto-fill, minmax(min(100%, 240px), 1fr))' : '1fr',
                    gap: 4, alignContent: 'start'}}>
                    {catalogError ? this.L.catalogUnavailable(catalogError) :
                        !catalog ? this.L.catalogLoading :
                            rows.length === 0 ? this.L.catalogNoMatch : rows.map(ex => {
                                const names = ex.title || {};
                                const title = names[locale] || names.en || ex.id;
                                return <button key={ex.id} type="button"
                                    onClick={() => {
                                        this.setState({actionsOpen: false, showCatalogFull: false});
                                        this.loadCatalogExample(ex, device);
                                    }}
                                    style={{...item, border: '1px solid #cbd5e1', background: '#fff'}}
                                    title={ex.id} data-testid="bw-catalog-item">
                                    {title}
                                </button>;
                            })}
                </div>
            </div>
        );
        return (
            <div data-keep-open>
                <button type="button" onClick={() => { this.loadCatalog(); this.setState(s => ({showCatalog: !s.showCatalog})); }}
                    style={{...item, background: showCatalog ? '#e2e8f0' : '#f1f5f9'}}
                    aria-expanded={showCatalog} title={this.L.loadCatalogTitle} data-testid="bw-catalog-toggle" data-overflow-action>
                    <Icon name="example" />{this.L.loadExample.replace(/^📚\s*/, '')}<Icon name="chevronRight" size={12} />
                </button>
                {showCatalog && !showCatalogFull && this.state.actionsOpen && list(false)}
                {showCatalogFull && createPortal(
                    <dialog ref={node => { if (node && !node.open) node.showModal(); }} onClose={close}
                        aria-label={de ? 'Beispielbibliothek' : 'Examples library'}
                        style={{width: 'calc(100vw - 32px)', height: 'calc(100dvh - 32px)', maxWidth: 'none', maxHeight: 'none',
                            boxSizing: 'border-box', border: '1px solid #94a3b8', borderRadius: 10, padding: 12, color: '#1e293b'}}>
                        <div style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
                            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px'}}>
                                <strong>{de ? 'Beispiele' : 'Examples'} · {DEVICE_CHIP_LABELS[device] || device}</strong>
                                <button type="button" onClick={close} style={toolStyles(false).button}
                                    aria-label={de ? 'Schließen' : 'Close'}>×</button>
                            </div>
                            {list(true)}
                        </div>
                    </dialog>, document.body)}
            </div>
        );
    }

    renderMacDevicePicker () {
        const current = this.codeDevice() || '';
        const close = () => this.macDeviceDialog?.close();
        const choose = id => {
            close();
            this.setDevice(id);
        };
        const item = (id, label) => <button type="button" key={id || 'none'} role="menuitemradio"
            aria-checked={id === current} data-device-option={id} title={label}
            style={{...toolStyles(false).button, display: 'block', textAlign: 'left', width: '100%',
                overflow: 'hidden', textOverflow: 'ellipsis'}}
            onClick={() => choose(id)}>{label}</button>;
        const heading = {display: 'block', padding: '5px 8px 2px', fontSize: 11, color: '#64748b'};
        return createPortal(<dialog ref={element => {this.macDeviceDialog = element;}}
            data-testid="bw-mac-device-menu" aria-label={this.L.deviceTitle}
            onClick={event => {
                if (isMachinePickerBackdrop(event)) close();
            }}
            style={{width: 270, maxWidth: 'calc(100vw - 24px)', maxHeight: '70vh',
                padding: 8, border: '1px solid #94a3b8', borderRadius: 8, fontSize: 12}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4}}>
                <strong>{pickLocale(this.props.locale) === 'de' ? 'Zielsystem' : 'Machine'}</strong>
                <button type="button" style={toolStyles(false).button} aria-label={this.L.closeNotice} onClick={close}>×</button>
            </div>
            <button type="button" style={{...toolStyles(false).button, justifyContent: 'flex-start', width: '100%'}}
                onClick={() => choose('__manage__')}>{pickLocale(this.props.locale) === 'de' ? 'Maschinen verwalten…' : 'Manage machines…'}</button>
            {item('', this.L.noChips)}
            <strong style={heading}>Intel 8049</strong>
            {item('kosmos-cp1', 'Kosmos CP1')}
            {DEVICE_GROUPS.map(group => <React.Fragment key={group.label}>
                <strong style={heading}>{group.label}</strong>
                {group.devices.map(device => item(device.id, device.label))}
            </React.Fragment>)}
        </dialog>, document.body);
    }

    openCodeInfo () {
        this.setState({showInfo: true, actionsOpen: false}, () => {
            this.codeHelpClose?.focus();
        });
    }

    dismissCodeNotice (notice) {
        this.setState(state => ({
            codeNotices: state.codeNotices.filter(item => item.id !== notice.id),
            ...(notice.report && notice.report === state.conversionReport ? {conversionReport: null} : {})
        }));
    }

    renderCodeInfo (machine) {
        const {lang, asmMode, codeNotices, showInfo, emptyTabOffer} = this.state;
        const locale = pickLocale(this.props.locale);
        const de = locale === 'de';
        const local = (english, german) => de ? german : english;
        const close = () => this.setState({showInfo: false});
        const count = codeNotices.filter(notice => notice.unread).length;
        const latestStatus = codeNotices.find(notice => notice.status);
        const latestReport = codeNotices.find(notice => notice.report);
        const device = this.currentDevice();
        const summary = !machine && device && matrixSummary(lang, device, locale);
        const standalone = this.standaloneBasicProfile();
        const notes = {
            piccolo: local('Use unnumbered source, lowercase keywords and labels. SAVE, LOAD and FILES use LittleFS. Files are included when you save the Brickwright project.',
                'Quelltext ohne Zeilennummern, kleingeschriebene Schlüsselwörter und Sprungmarken verwenden. SAVE, LOAD und FILES verwenden LittleFS. Dateien werden mit dem Brickwright-Projekt gespeichert.'),
            stefan: local('Use line numbers for jumps and answer INPUT in Controller. SAVE, CATALOG and LOAD use LittleFS. Files survive reruns and are included when you save the Brickwright project.',
                'Für Sprünge Zeilennummern verwenden und INPUT im Controller beantworten. SAVE, CATALOG und LOAD verwenden LittleFS. Dateien bleiben bei Neustarts erhalten und werden mit dem Brickwright-Projekt gespeichert.')
        };
        const basicProfile = lang === 'basic' && this.selectedBasicProfile();
        const languageNote = standalone ? notes[standalone.dialect] + ' ' + local(
            'Run BASIC sends your source to the Pico UART console. Block conversion is unavailable for this dialect.',
            'BASIC ausführen sendet den Quelltext an die UART-Konsole des Pico. Für diesen Dialekt ist keine Blockumwandlung verfügbar.'
        ) : {basic: this.L.basicNote, asm: this.L.asmNote, nqc: this.L.nqcNote, c: this.L.cNote}[lang];
        const note = basicProfile?.id === 'pico-bbcbasic' ? languageNote + ' ' + local(
            'SAVE and LOAD use LittleFS. Files survive reruns and are included when you save the Brickwright project.',
            'SAVE und LOAD verwenden LittleFS. Dateien bleiben bei Neustarts erhalten und werden mit dem Brickwright-Projekt gespeichert.'
        ) : languageNote;
        const picoHardwareHelp = basicProfile?.media && local(
            'Download the UF2 and copy it to RPI-RP2 in BOOTSEL mode. Connect a 3.3 V USB-to-UART adapter with TX to GP1, RX to GP0 and GND to GND. Choose Replace Pico listing and run, select the adapter, then reset the Pico when prompted. This replaces the listing in memory. Use Controller for input and Ctrl+C.',
            'UF2 herunterladen und im BOOTSEL-Modus nach RPI-RP2 kopieren. Einen 3,3-V-USB-UART-Adapter anschließen (TX an GP1, RX an GP0 und GND an GND). Programm auf Pico ersetzen und ausführen wählen, den Adapter auswählen und den Pico bei Aufforderung zurücksetzen. Das Programm im Speicher wird ersetzt. Eingabe und Strg+C erfolgen im Controller.'
        );
        const sections = standalone ? null : lang === 'pseudocode' ? SYNTAX : SUPPORTED[lang];
        const closeStyle = {...toolStyles(false).button, fontSize: 18, lineHeight: 1};
        const lane = {background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 6, padding: '5px 8px'};

        return <Popup id="code-info" testId="bw-code-info-popover"
            open={this.props.isVisible !== false && showInfo} align="right" width={440} role="dialog"
            label={this.L.infoAria} closeOnPick={false} onClose={close}
            onToggle={() => showInfo ? close() : this.openCodeInfo()}
            button={<button type="button" data-testid="bw-code-info" aria-label={this.L.infoAria}
                title={this.L.infoAria} style={{...toolStyles(false).button, position: 'relative'}}>
                <Icon name="help" />
                {count > 0 && <span data-testid="bw-code-info-count" style={{position: 'absolute', right: -3, top: 0,
                    borderRadius: 9, minWidth: 13, padding: '1px 3px', background: '#6435c9', color: '#fff',
                    fontSize: 9, lineHeight: '12px', textAlign: 'center'}} aria-label={local(
                    `${count} unread notices`, `${count} ungelesene Meldungen`)}>{count}</span>}
            </button>}>
            <div data-code-help style={{padding: 4, display: 'grid', gap: 8, color: '#334155', overflowWrap: 'anywhere'}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <strong>{this.L.infoAria}</strong>
                    <button ref={node => { this.codeHelpClose = node; }} type="button" style={closeStyle}
                        aria-label={local('Close Code help', 'Code-Hilfe schließen')} onClick={event => {
                            const trigger = event.currentTarget.ownerDocument.querySelector('[data-testid="bw-code-info"]');
                            close();
                            trigger?.focus();
                        }}>×</button>
                </div>
                {codeNotices.length > 0 && <section aria-label={local('Notices', 'Meldungen')}
                    data-testid="bw-code-notices" style={{display: 'grid', gap: 5}}>
                    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                        <strong>{local('Notices', 'Meldungen')}</strong>
                        <button type="button" style={{...closeStyle, fontSize: 22}} data-testid="bw-clear-code-notices"
                            aria-label={local('Clear all notices', 'Alle Meldungen löschen')}
                            title={local('Clear all notices', 'Alle Meldungen löschen')}
                            onClick={() => {
                                this.codeHelpClose?.focus();
                                this.setState({codeNotices: [], conversionReport: null, status: '', emptyTabOffer: null});
                            }}>×</button>
                    </div>
                    {codeNotices.map(notice => {
                        const report = notice.report;
                        return <div key={notice.id} data-code-notice style={{...lane, display: 'flex', alignItems: 'flex-start', gap: 8}}>
                            {report ? <details data-testid={notice === latestReport ? 'bw-conversion-report' : undefined}
                                open={(!report.preserved || report.changed.length > 0 || report.unsupported.length > 0) || undefined}
                                style={{flex: 1, minWidth: 0}}>
                                <summary style={{cursor: 'pointer', fontWeight: 600}}>
                                    {local('Conversion report', 'Umwandlungsbericht')}: {report.direction}
                                </summary>
                                <div data-testid={notice === latestReport ? 'bw-conversion-preserved' : undefined}>
                                    {report.operation ? report.outcome : <>{local('Preserved', 'Bewahrt')}: {report.preserved ?
                                        local('project structure generated and loaded', 'Projektstruktur erzeugt und geladen') :
                                        local('no — conversion failed', 'nein — Umwandlung fehlgeschlagen')}</>}
                                </div>
                                <div data-testid={notice === latestReport ? 'bw-conversion-changed' : undefined}>
                                    {local('Changed', 'Geändert')}: {report.changed.join(' · ') ||
                                        local('no reported changes', 'keine gemeldeten Änderungen')}
                                </div>
                                <div data-testid={notice === latestReport ? 'bw-conversion-unsupported' : undefined}
                                    style={{color: report.unsupported.length ? '#92400e' : undefined}}>
                                    {local('Unsupported', 'Nicht unterstützt')}: {report.unsupported.join(' · ') ||
                                        local('nothing reported', 'nichts gemeldet')}
                                </div>
                                {report.details?.length > 0 && <pre data-testid={notice === latestReport ?
                                    'bw-conversion-refusal-details' : undefined} style={{whiteSpace: 'pre-wrap', fontSize: 11}}>
                                    {JSON.stringify(report.details, null, 2)}
                                </pre>}
                            </details> : <div style={{flex: 1, minWidth: 0, whiteSpace: 'pre-wrap'}}
                                data-testid={notice === latestStatus ? 'bw-code-status' : undefined}>
                                {notice.status}
                                {notice === latestStatus && notice.offer && notice.offer === emptyTabOffer &&
                                    <button type="button" data-testid="bw-open-empty-tab" onClick={() => {
                                        this.openEmptyTab(notice.offer);
                                        this.dismissCodeNotice(notice);
                                        close();
                                    }}>{this.L.openEmptyTab(notice.offer)}</button>}
                            </div>}
                            <button type="button" style={closeStyle}
                                data-testid={notice === latestReport ? 'bw-dismiss-conversion-report' : notice === latestStatus ?
                                    /^(Restored your unsaved |Nicht gespeicherter )/.test(notice.status) ?
                                        'bw-dismiss-restored' : 'bw-dismiss-code-status' : undefined}
                                aria-label={this.L.dismissNotice} title={this.L.dismissNotice}
                                onClick={() => {
                                    this.codeHelpClose?.focus();
                                    this.dismissCodeNotice(notice);
                                }}>×</button>
                        </div>;
                    })}
                </section>}
                {!machine && <>
                    {device && <div>{deviceHelp(device)}</div>}
                    {summary && <div data-testid="bw-code-device-capabilities"><strong>{summary}</strong>
                        <div>{matrixExplain(lang, device, locale)}</div>
                    </div>}
                    <div data-testid="bw-representation-status">{representationNotice(lang, asmMode, this.props.locale)}</div>
                    {TWO_WAY.has(lang) && <div>{local(
                        'To blocks converts the active editor. From blocks reads the project into Code. Conversion reports identify unsupported operations.',
                        'Zu Blöcken übersetzt den aktiven Editor. Von Blöcken liest das Projekt als Code. Der Umwandlungsbericht nennt nicht unterstützte Befehle.'
                    )}</div>}
                    {note && <div style={{whiteSpace: 'pre-wrap'}} data-code-language-note={lang}>{note}</div>}
                    {picoHardwareHelp && <div>{picoHardwareHelp}</div>}
                    {sections?.length > 0 && <details><summary>{this.L.reference}</summary>
                        {sections.map(([heading, items]) => <div key={heading}>
                            <strong>{this.L.h[heading] || heading}</strong>
                            <ul style={{margin: '2px 0 8px', paddingLeft: 20}}>
                                {items.map(text => <li key={text}><code>{text}</code></li>)}
                            </ul>
                        </div>)}
                    </details>}
                </>}
                <div>{local('Ctrl or ⌘ + F searches. Ctrl or ⌘ + Z undoes a text edit.',
                    'Strg oder ⌘ + F sucht. Strg oder ⌘ + Z macht eine Texteingabe rückgängig.')}</div>
            </div>
        </Popup>;
    }

    renderActionMenu (csel, renderCodeControls, renderLanguages, machine, renderDeviceSelect) {
        const item = {...csel, ...toolStyles(false).button, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
            width: '100%', boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', height: 'auto',
            minHeight: 32, padding: '6px 8px', whiteSpace: 'normal', fontSize: 12};
        return (
            <Popup id="code-actions" overflowMenu anchorTestId="bw-code-actions" testId="bw-code-actions-menu"
                open={this.props.isVisible !== false && this.state.actionsOpen} align="right" width={270} keepMounted
                label={L10N[pickLocale(this.props.locale)].fileMenuTitle}
                onToggle={() => this.setState(state => ({actionsOpen: !state.actionsOpen}))}
                onClose={() => this.setState({actionsOpen: false})}
                button={<button type="button" data-testid="bw-code-actions-trigger" style={toolStyles(false).button}
                    title={L10N[pickLocale(this.props.locale)].fileMenuTitle}
                    aria-label={this.L.fileMenuTitle}><Icon name="more" /></button>}>
                {!machine && (
                    <div data-code-menu-group role="group" aria-label={this.L.actionExamples}>
                    {this.currentDevice() ? this.renderCatalogControl(item) :
                        this.state.bundledExamplesStatus === 'error' ? (
                            <button type="button" onClick={this._loadBundledExamples} data-overflow-action style={item}
                                title={this.L.loadExampleTitle} data-testid="bw-load-example-retry">
                                {this.L.examplesRetry}
                            </button>
                        ) : this.state.bundledExamplesStatus !== 'ready' ? (
                            <span style={{...item, cursor: 'wait', color: '#64748b'}} aria-live="polite"
                                data-testid="bw-load-example-loading">{this.L.examplesLoading}</span>
                        ) : (
                        <select defaultValue="" onChange={e => { this.setState({actionsOpen: false}); this.loadExample(e.target.value); }}
                            style={{...item, border: 'none'}} title={this.L.loadExampleTitle}
                            data-testid="bw-load-example">
                            <option value="" disabled>{this.L.loadExample}</option>
                            {GROUPS.map(g => (
                                <optgroup key={g.label} label={g.label}>
                                    {g.items.filter(([k]) => examples[k]).map(([k, label]) =>
                                        <option key={k} value={k}>{label}</option>)}
                                </optgroup>
                            ))}
                        </select>
                    )}
                    </div>
                )}
                {this.state.actionsOpen && <>
                    <div data-code-menu-group data-code-overflow-controls>
                        {machine === 'cardiac' ? <div ref={this.props.onCardiacToolsSlot} data-cardiac-overflow-tools /> :
                            !machine && renderCodeControls(true)}
                        {machine && renderDeviceSelect(true)}
                        <button type="button" onClick={() => this.openCodeInfo()} data-overflow-action>
                            <Icon name="help" />{this.L.infoAria}
                        </button>
                        <details>
                            <summary data-overflow-action><Icon name="example" />{this.L.toolbarLanguages}<Icon name="chevronRight" size={12} /></summary>
                            <div>{renderLanguages(true)}</div>
                        </details>
                    </div>
                </>}
                {!machine && <>
                    <div data-code-menu-group role="group" aria-label={this.L.actionFiles}>
                    <label data-overflow-action style={item} title={this.L.openFileTitle(`${CODE_ACCEPT},${IMPORT_ACCEPT}`)}
                        data-testid="bw-open-file" role="button" tabIndex={this.state.busy ? -1 : 0} aria-disabled={this.state.busy}
                        onKeyDown={event => {
                            if (event.key !== 'Enter' && event.key !== ' ') return;
                            event.preventDefault();
                            if (!this.state.busy) this._codeFileInput.current?.click();
                        }}>
                        <Icon name="open" />{this.L.openFile}
                        <input ref={this._codeFileInput} type="file" accept={`${CODE_ACCEPT},${IMPORT_ACCEPT}`} style={{display: 'none'}}
                            disabled={this.state.busy}
                            onChange={event => { this.setState({actionsOpen: false}); this.openCodeFile(event); }} />
                    </label>
                    <button type="button" onClick={this.saveCodeFile} data-overflow-action style={item}
                        title={this.L.saveFileTitle(this.saveFileName())} data-testid="bw-save-file">
                        <Icon name="save" />{this.L.saveFile}
                    </button>
                    </div>
                    <div data-code-menu-group role="group" aria-label={this.L.actionPrograms}>
                    {this.state.lang === 'micropython' ? (
                        <button type="button" onClick={() => this.downloadMicrobitHex()} data-overflow-action style={item}
                            disabled={this.state.busy || !this.state.buffers.micropython.trim() || /^# ===/.test(this.state.buffers.micropython)}
                            title={this.L.microbitNeedFirmware} data-testid="bw-microbit-download-hex">
                            {this.L.downloadHex}
                        </button>
                    ) : null}
                    <button type="button" onClick={this.openMakeCodeShare} data-overflow-action style={item}
                        title={this.L.mcShareTitle} data-testid="bw-makecode-share">
                        <Icon name="link" />{this.L.mcShare.replace(/^🔗\s*/, '')}
                    </button>
                    {['microbit', 'calliopemini', 'ev3', 'cpx'].includes(this.currentDevice()) ? (
                        <button type="button" onClick={this.exportMakeCode} data-overflow-action style={item}
                            title={this.L.mcExportTitle} disabled={this.state.busy}
                            data-testid="bw-makecode-export">{this.L.mcExport}</button>
                    ) : null}
                    {this._makeCodeProject ? (
                        <button type="button" onClick={() => this.exportMakeCodeSource()} data-overflow-action style={item}
                            title={this.L.exportMakeCodeTitle} data-testid="bw-export-makecode-source">
                            {this.L.exportMakeCode}
                        </button>
                    ) : null}
                    {((this._makeCodeProject && MAKECODE_RUNNABLE.includes(this._makeCodeProject.target)) ||
                        ['microbit', 'calliopemini'].includes(this.currentDevice())) &&
                        this.makeCodeRunOffered(this._makeCodeProject ? this._makeCodeProject.target :
                            (this.currentDevice() === 'calliopemini' ? 'calliopemini' : 'microbit')) ? (
                            <button type="button" onClick={() => this.runInMakeCode()} data-overflow-action style={item}
                                title={this.L.mcRunTitle} disabled={this.state.busy}
                                data-testid="bw-makecode-run">{this.L.mcRun}</button>
                        ) : null}
                    {(this._makeCodeProject ? this._makeCodeProject.target === 'microbit' : this.currentDevice() === 'microbit') &&
                        this.makeCodeRunOffered('microbit') ? (
                            <button type="button" onClick={() => this.runOnEmulatedMicrobit()} data-overflow-action style={item}
                                title={this.L.mcEmulateTitle} disabled={this.state.busy}
                                data-testid="bw-makecode-emulate">{this.L.mcEmulate}</button>
                        ) : null}
                    {this._makeCodeProject && this._makeCodeProject.target === 'arcade' ? (
                        <select value={this.state.arcadeBoard} data-overflow-action style={item} disabled={this.state.busy}
                            title={this.L.mcBoardTitle} data-testid="bw-makecode-arcade-board"
                            data-boards={(this.state.arcadeBoards || []).length}
                            onChange={e => this.setState({arcadeBoard: e.target.value})}>
                            <option value="">{this.L.mcBoardPick}</option>
                            {(this.state.arcadeBoards || []).filter(b => !b.card).map(b => (
                                <option key={arcadeBoardKey(b)} value={arcadeBoardKey(b)}>{b.name}</option>
                            ))}
                            <optgroup label={this.L.mcBoardByChip}>
                                {(this.state.arcadeBoards || []).filter(b => b.card).map(b => (
                                    <option key={arcadeBoardKey(b)} value={arcadeBoardKey(b)}>{`${b.name} (${b.chip})`}</option>
                                ))}
                            </optgroup>
                        </select>
                    ) : null}
                    {(this._makeCodeProject && MAKECODE_FIRMWARE[this._makeCodeProject.target]) ||
                        (!this._makeCodeProject && ['microbit', 'calliopemini'].includes(this.currentDevice())) ? (
                            <button type="button" onClick={() => this.downloadMakeCodeFirmware()} data-overflow-action style={item}
                                title={this.L.mcFirmwareTitle} disabled={this.state.busy}
                                data-testid="bw-makecode-firmware">{this.L.mcFirmware}</button>
                        ) : null}
                    <button type="button" onClick={() => this.runAsArcade()} data-overflow-action style={item}
                        title={this.L.arcRunTitle} disabled={this.state.busy}
                        data-testid="bw-makecode-arcade-run"><Icon name="run" />{this.L.arcRun.replace(/^▶\s*/, '')}</button>
                    <button type="button" onClick={() => this.exportArcade()} data-overflow-action style={item}
                        title={this.L.arcExportTitle} disabled={this.state.busy}
                        data-testid="bw-makecode-arcade-export"><Icon name="save" />{this.L.arcExport.replace(/^⬆\s*/, '')}</button>
                    <button type="button" onClick={() => this.exportPlayableGame('web')} data-overflow-action style={item}
                        title={this.L.gameWebTitle} disabled={this.state.busy}
                        data-testid="bw-game-export-web"><Icon name="save" />{this.L.gameWeb.replace(/^⬆\s*/, '')}</button>
                    <button type="button" onClick={() => this.exportPlayableGame('pygame')} data-overflow-action style={item}
                        title={this.L.gamePyTitle} disabled={this.state.busy}
                        data-testid="bw-game-export-pygame"><Icon name="save" />{this.L.gamePy.replace(/^⬆\s*/, '')}</button>
                    </div>
                    <div data-code-menu-group role="group" aria-label={this.L.reference}>
                    <button type="button" onClick={() => this.setState(s => ({showArt: !s.showArt}))}
                        data-overflow-action style={item} title={this.L.customArtTitle}>
                        <Icon name="view-fit" />{this.L.customArt}{this.state.uploads.length ? ` (${this.state.uploads.length})` : ''}
                    </button>
                    </div>
                </>}
            </Popup>
        );
    }

    /**
     * The overall view of lib/bw-matrix/capabilities.js: one column per chip
     * family (the family's first device stands for it, plus the chosen device
     * when it is not that one), one row per language, each cell the same
     * summary the badge shows with the full sentence as its title. The table
     * is read from the module every render, so it cannot disagree with the
     * badge or with docs/generated/LANGUAGE-DEVICE-MATRIX.md.
     */
    renderMatrixPanel () {
        const locale = pickLocale(this.props.locale);
        const current = this.currentDevice();
        const cols = [];
        for (const d of DEVICES) {
            if (d.programmable === false) continue;
            if (!cols.some(c => c.family === d.family)) cols.push(d);
        }
        if (current && !cols.some(c => c.id === current)) {
            const cur = DEVICES.find(d => d.id === current);
            if (cur && cur.programmable !== false) {
                const i = cols.findIndex(c => c.family === cur.family);
                cols.splice(i + 1, 0, cur);
            }
        }
        const cellStyle = {padding: '3px 6px', border: '1px solid #cbd5e1', fontSize: 11, whiteSpace: 'nowrap'};
        return (
            <div data-testid="bw-matrix-panel"
                data-device-ids={DEVICES.map(d => d.id).join(' ')}
                style={{padding: '8px 12px', background: '#eff6ff', border: '1px solid #bfdbfe',
                    borderRadius: '0 0 8px 8px', fontSize: 12, color: '#334155', flexShrink: 0, overflowX: 'auto'}}>
                <div style={{fontWeight: 'bold', marginBottom: 4, color: '#1e3a8a'}}>{this.L.matrixHeading}</div>
                <div style={{marginBottom: 6, fontSize: 11, color: '#475569'}}>{this.L.matrixLegend}</div>
                <table style={{borderCollapse: 'collapse'}}>
                    <thead>
                        <tr>
                            <th style={cellStyle} />
                            {cols.map(d => (
                                <th key={d.id} style={{...cellStyle, background: d.id === current ? '#dbeafe' : '#f8fafc'}}
                                    title={d.id === current ? this.L.matrixCurrent : d.group}>
                                    {d.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {MATRIX_LANGUAGES.map(l => (
                            <tr key={l.id}>
                                <th style={{...cellStyle, textAlign: 'left',
                                    background: l.id === this.state.lang ? '#dbeafe' : '#f8fafc'}}>
                                    {l.label}
                                </th>
                                {cols.map(d => {
                                    const c = matrixCell(l.id, d.id);
                                    const here = l.id === this.state.lang && d.id === current;
                                    return (
                                        <td key={d.id} data-testid={`bw-matrix-cell-${l.id}-${d.id}`}
                                            data-kind={c ? c.kind : 'none'}
                                            title={matrixExplain(l.id, d.id, locale)}
                                            style={{...cellStyle, cursor: 'help',
                                                background: here ? '#bfdbfe' : c && c.kind === 'none' ? '#fff7ed' : '#fff'}}>
                                            {matrixSummary(l.id, d.id, locale)}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    render () {
        const codeInput = this.state.codeInput;
        // The selected .tab-panel is display:flex (row); like .blocks-wrapper we must
        // flex-grow to fill the column width, else we shrink to content (~660px) and
        // leave a big gap before the stage.
        // overflow:hidden so the Code tab container does NOT scroll — CM6's own
        // .cm-scroller handles scrolling inside the editor. minHeight:0 prevents
        // the flex min-height:auto trap that makes tall content overflow.
        const wrap = {height: '100%', flex: '1 1 auto', minWidth: 0, minHeight: 0, boxSizing: 'border-box', padding: 16, overflow: 'hidden',
            display: 'flex', flexDirection: 'column', font: '14px/1.5 sans-serif', color: '#575e75'};
        const btn = {padding: '10px 18px', borderRadius: 8, border: 'none', color: '#fff', cursor: 'pointer',
            fontWeight: 600, background: 'linear-gradient(135deg,#4c97ff,#4280d7)'};
        const actionBtn = {...btn, padding: '5px 9px', fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0};
        const sel = {padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', font: 'inherit'};
        const max = this.state.maximized;
        const codeDevice = this.codeDevice();
        const usesMacDevicePicker = typeof window !== 'undefined' && window.__TAURI__ && /^Mac/.test(navigator.platform);
        const ownedConsoleSource = Boolean(codeDocumentConversionRefusal(
            this.state.codeDocument, this.state.lang, this.activeCode()));
        const csel = {...sel, padding: '4px 8px', fontSize: 12}; // compact select
        const languageTabStyle = active => ({
            padding: this.state.cardiacActive ? '5px 6px' : '6px 10px', border: '1px solid #cbd5e1', borderBottomColor: active ? '#fff' : '#cbd5e1',
            borderRadius: '8px 8px 0 0', cursor: 'pointer', fontWeight: active ? 700 : 500, fontSize: 13,
            background: active ? '#fff' : '#eef2f7', color: active ? '#1e293b' : '#64748b',
            position: 'relative', top: active ? 0 : 1, whiteSpace: 'nowrap'
        });
        const spikeCode = /\b(?:spike(?:prime)?|PrimeHub|InventorHub)\b/i.test(this.activeCode());
        const showSpikeAction = isSpikeExtensionLoaded(this.props.vm) || spikeCode;
        // The device this tab is writing for: the MakeCode project's target, else the DEVICE header.
        const toolbarDevice = (this._makeCodeProject && this._makeCodeProject.target) || this.currentDevice();
        const applies = id => toolbarActionApplies(id, {device: toolbarDevice,
            evidence: id === 'spike-arena' ? snapshotSpikePorts(this.props.vm?.runtime).connected : showSpikeAction});
        const showPythonRunTargets = this.state.lang === 'python' && this.activeCode().trim() &&
            window.__TAURI_INTERNALS__ && applies('spike-nuttx');
        const german = pickLocale(this.props.locale) === 'de';
        const selectedMachine = this.state.cp1Active ? 'kosmos-cp1' : this.state.cardiacActive ? 'cardiac' :
            this.state.kim1Active ? 'kim1' : this.state.microtronicActive ? 'microtronic' : this.state.libraryTarget;
        const machineLabel = {'kosmos-cp1': 'Kosmos CP1', cardiac: 'CARDIAC', kim1: 'KIM-1',
            microtronic: 'Microtronic', i80386: '80386'}[selectedMachine] || DEVICE_BY_ID[codeDevice]?.label || this.L.noChips;
        const renderDeviceSelect = menu => (
                        <div data-code-machine-select={menu || undefined} style={menu ? undefined : {display: 'contents'}}>
                        {menu && <Icon name="chip" />}
                        {usesMacDevicePicker ? <button type="button" aria-haspopup="dialog"
                            aria-label={this.L.deviceTitle} title={this.L.deviceTitle}
                            data-testid={menu ? 'bw-device-picker-trigger-menu' : 'bw-device-picker-trigger'}
                            style={{...csel, alignSelf: 'center', cursor: 'pointer', whiteSpace: 'nowrap',
                                minWidth: 0, flexShrink: menu ? 1 : 0, overflow: 'hidden', textOverflow: 'ellipsis'}}
                            onClick={() => this.setState({actionsOpen: false}, () => {
                                const dialog = this.macDeviceDialog;
                                if (dialog && !dialog.open) {
                                    dialog.showModal();
                                    dialog.querySelector('[aria-checked="true"]')?.focus();
                                }
                            })}>
                            {machineLabel} ▾
                        </button> : (
                        <select value={selectedMachine || codeDevice || ''} onChange={e => this.setDevice(e.target.value)}
                            style={{...csel, alignSelf: 'center', maxWidth: '100%', minWidth: 0, whiteSpace: 'nowrap',
                                flexShrink: menu ? 1 : 0}} title={this.L.deviceTitle}
                            data-testid={menu ? "bw-device-select-menu" : "bw-device-select"}>
                            <option value="">{this.L.noChips}</option>
                            {selectedMachine && selectedMachine !== 'kosmos-cp1' &&
                                <option value={selectedMachine} disabled>{machineLabel}</option>}
                            <optgroup label="Intel 8049">
                                <option value="kosmos-cp1" data-machine-launch="">Kosmos CP1</option>
                            </optgroup>
                            {DEVICE_GROUPS.map(g => (
                                <optgroup key={g.label} label={g.label}>
                                    {g.devices.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                                </optgroup>
                            ))}
                            {/* Opens the machine library (gui.jsx renders it); not a device. */}
                            <option value="__manage__" data-machine-launch="">{'Manage machines…'}</option>
                        </select>)}
                        </div>
        );
        const picoBasicHardware = this.state.lang === 'basic' && this.selectedBasicProfile()?.media
            ? this.selectedBasicProfile() : null;
        const renderCodeControls = menu => (
            <React.Fragment>
                    <div data-testid={menu ? undefined : "bw-code-action-row"} style={{display: 'inline-flex', alignSelf: 'center',
                        alignItems: 'center', gap: 6, flexWrap: 'nowrap', flexShrink: 0}}>
                        <button onClick={this.compile}
                            aria-label={this.L.toBlocks}
                            disabled={!this.canCompileToBlocks()}
                            title={this.L.toBlocksTitle(LANG_LABEL[this.state.lang])}
                            style={actionBtn}>
                            {menu ? <><Icon name="to-blocks" />{this.L.toBlocks.replace('⇦ ', '')}</> : <span aria-hidden="true">⇦ ▣</span>}
                        </button>
                        <button onClick={this.fromBlocks} disabled={this.state.busy || Boolean(this.standaloneBasicProfile())}
                            aria-label={this.L.fromBlocks}
                            title={this.L.fromBlocksTitle}
                            style={{...actionBtn, background: 'linear-gradient(135deg,#a55b80,#8e4a6c)'}}>
                            {menu ? <><Icon name="from-blocks" />{this.L.fromBlocks.replace(' ⇨', '')}</> : <span aria-hidden="true">▣ ⇨</span>}
                        </button>
                        {menu && picoBasicHardware && <React.Fragment>
                            <button type="button" data-testid="bw-pico-basic-download"
                                disabled={this.state.busy} onClick={() => this.downloadPicoBasicFirmware(picoBasicHardware)}>
                                {this.picoBasicHardwareText('download')}
                            </button>
                            {(navigator.serial || window.__TAURI__?.core) && <button type="button"
                                data-testid="bw-pico-basic-hardware-send" disabled={this.state.busy || !this.activeCode().trim()}
                                onClick={() => {
                                    this.setState({actionsOpen: false});
                                    this.sendPicoBasicToHardware(picoBasicHardware);
                                }}>
                                {this.picoBasicHardwareText('send')}
                            </button>}
                            {this.state.picoBasicConnected && <button type="button" data-testid="bw-pico-basic-disconnect"
                                onClick={() => this.closePicoBasicHardware()}>{this.picoBasicHardwareText('disconnect')}</button>}
                        </React.Fragment>}
                        {this.currentDevice() === 'pico' && !picoBasicHardware ? (
                            <button onClick={this.deployToPico} disabled={this.state.busy}
                                data-testid={menu ? "bw-deploy-pico-menu" : "bw-deploy-pico"}
                                title={this.L.deployPicoTitle}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#2f9e44,#237a34)'}}>
                                {this.L.deployPico}
                            </button>
                        ) : null}
                        {this.state.lang === 'pseudocode' && applies('spike-usb') ? (
                            <span style={{display: 'inline-flex', gap: 5, alignItems: 'center', flexWrap: 'nowrap'}}>
                                <select value={this.state.spikeUsbRoute} disabled={this.state.busy}
                                    aria-label={this.L.spikeUsbRouteLabel} data-testid={menu ? "bw-spike-usb-route-menu" : "bw-spike-usb-route"}
                                    onChange={e => this.setState({spikeUsbRoute: e.target.value})}
                                    style={{...csel, maxWidth: 180}}>
                                    <option value="direct">{this.L.spikeUsbDirect}</option>
                                    <option value="bridge">{this.L.spikeUsbBridge}</option>
                                </select>
                                {this.state.spikeUsbRoute === 'bridge' ? (
                                    <React.Fragment>
                                        <input type="url" placeholder={this.L.spikeUsbUrl}
                                            aria-label={this.L.spikeUsbUrl} value={this.state.spikeUsbBridgeUrl}
                                            onChange={e => this.setState({spikeUsbBridgeUrl: e.target.value})}
                                            style={{...csel, width: 135}} />
                                        <input type="password" placeholder={this.L.spikeUsbToken}
                                            aria-label={this.L.spikeUsbToken} value={this.state.spikeUsbBridgeToken}
                                            onChange={e => this.setState({spikeUsbBridgeToken: e.target.value})}
                                            style={{...csel, width: 95}} />
                                    </React.Fragment>
                                ) : null}
                                <button onClick={() => this.runSpikeUsb(true)} disabled={this.state.busy}
                                    title={this.L.probeSpikeUsbTitle}
                                    data-testid={menu ? "bw-probe-spike-usb-menu" : "bw-probe-spike-usb"} style={actionBtn}>
                                    {this.L.probeSpikeUsb}
                                </button>
                                <button onClick={() => this.runSpikeUsb(false)} disabled={this.state.busy || !(this.state.buffers.pseudocode || '').trim()}
                                    data-testid={menu ? "bw-run-spike-usb-menu" : "bw-run-spike-usb"} style={{...actionBtn, background: '#d97706', color: '#fff'}}>
                                    {this.L.runSpikeUsb}
                                </button>
                            </span>
                        ) : null}
                        {/* Flash to a real board for every family that has a serial
                            bootloader (STC ISP, AVR STK500v1, STM32 AN3155); the
                            method downloads the image + names the programmer for
                            the rest. Pico keeps its own MicroPython button above. */}
                        {this.currentDevice() !== 'pico'
                         && this.state.lang === 'pseudocode'
                         && this.flashFamily(this.currentDevice()) !== null ? (
                            <button onClick={this.flashToBoard} disabled={this.state.busy}
                                data-testid={menu ? "bw-flash-board-menu" : "bw-flash-board"}
                                title={this.L.flashBoardTitle}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#c9761b,#a35d12)'}}>
                                {this.L.flashBoard}
                            </button>
                        ) : null}
                        {/* The 8086's ▶. It sits with the other per-device buttons
                            rather than with the Python/JS "Run" above, because it
                            does what THEY do — build for the selected device and
                            start it — and not what that one does (evaluate the
                            editor's text in a worker). `asmTargetForDevice` is the
                            one function that decides what an 8086 is, so the
                            button and the assembler cannot disagree about it. */}
                        {this.state.lang === 'pseudocode'
                         && asmTargetForDevice(this.currentDevice()) === 'i8086' ? (
                                <button onClick={this.runPseudocodeOn8086} disabled={this.state.busy}
                                    data-testid={menu ? "bw-run-8086-menu" : "bw-run-8086"}
                                    title={this.L.run8086Title}
                                    style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}>
                                    {this.L.run8086}
                                </button>
                            ) : null}
                        {/* Export beside ▶ Run: the assembled .COM and a bootable
                            floppy .img, to carry off the bench to real hardware or
                            another emulator (N10). silicon: export only. */}
                        {this.state.lang === 'pseudocode'
                         && asmTargetForDevice(this.currentDevice()) === 'i8086' ? (
                                <React.Fragment>
                                    <button onClick={() => this.exportI8086('com')} disabled={this.state.busy}
                                        data-testid={menu ? "bw-export-8086-com-menu" : "bw-export-8086-com"} title={this.L.export8086ComTitle}
                                        style={{...actionBtn, background: '#e2e8f0', color: '#334155'}}>
                                        {this.L.export8086Com}
                                    </button>
                                    <button onClick={() => this.exportI8086('img')} disabled={this.state.busy}
                                        data-testid={menu ? "bw-export-8086-img-menu" : "bw-export-8086-img"} title={this.L.export8086ImgTitle}
                                        style={{...actionBtn, background: '#e2e8f0', color: '#334155'}}>
                                        {this.L.export8086Img}
                                    </button>
                                </React.Fragment>
                            ) : null}
                        {/* The C tab's ▶, and it is the same shape as the one
                            above: build for the selected device and start it. It
                            appears only where a LOCAL C route exists, because the
                            hosted compiler has no 8086 back end — so this button
                            can never be the thing that posts a program. */}
                        {this.state.lang === 'c'
                         && cRouteFor(this.currentDevice()) === 'local' ? (
                                <button onClick={this.runCOn8086} disabled={this.state.busy}
                                    data-testid={menu ? "bw-run-c-8086-menu" : "bw-run-c-8086"}
                                    title={this.L.runC8086Title}
                                    style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}>
                                    {this.L.runC8086}
                                </button>
                            ) : null}
                        {/* The RISC-V C ▶ and its route chooser. The user picks where
                            C compiles: in the BROWSER (shecc.wasm — a C subset, no
                            server) or on the SERVER (the hosted service — full C via
                            native gcc + picolibc). Both boot through the same riscv
                            image path; only the compiler differs. */}
                        {this.state.lang === 'c'
                         && asmTargetForDevice(this.currentDevice()) === 'riscv32' ? (
                                <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                                    <label style={{fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4}}>
                                        {this.L.asmExampleLabel}
                                        <select data-testid={menu ? "bw-riscv-c-examples-menu" : "bw-riscv-c-examples"}
                                            onChange={e => this.loadRiscvCExample(e.target.value)}
                                            value=""
                                            disabled={this.state.busy}
                                            style={{padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1'}}>
                                            <option value="">{this.L.asmExamplePick}</option>
                                            {riscvCExamplesFor('riscv32').map(ex => (
                                                <option key={ex.id} value={ex.id}>
                                                    {pickLocale(this.props.locale) === 'de' ? ex.labelDe : ex.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label title={this.L.runCRiscvRouteTitle}
                                        style={{fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4}}>
                                        <select value={this.state.riscvCRoute}
                                            data-testid={menu ? "bw-riscv-c-route-menu" : "bw-riscv-c-route"}
                                            onChange={e => this.setState({riscvCRoute: e.target.value})}
                                            disabled={this.state.busy}
                                            style={{padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', font: 'inherit'}}>
                                            <option value="browser">{this.L.runCRiscvRouteBrowser}</option>
                                            <option value="server" disabled={!RISCV_CC_ENDPOINT}>{this.L.runCRiscvRouteServer}</option>
                                        </select>
                                    </label>
                                    <button onClick={() => this.runCOnRiscv()} disabled={this.state.busy}
                                        data-testid={menu ? "bw-run-c-riscv-menu" : "bw-run-c-riscv"}
                                        title={this.L.runCRiscvTitle}
                                        style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}>
                                        {this.L.runCRiscv}
                                    </button>
                                    {/* Smart hint: the browser subset rejected this program;
                                        offer the full compiler on the server in one click. */}
                                    {this.state.riscvCanRetryServer ? (
                                        <button onClick={() => this.runCOnRiscv('server')} disabled={this.state.busy}
                                            data-testid={menu ? "bw-run-c-riscv-server-menu" : "bw-run-c-riscv-server"}
                                            title={this.L.runCRiscvTryServerTitle}
                                            style={{...actionBtn, background: 'linear-gradient(135deg,#f08c00,#e67700)'}}>
                                            {this.L.runCRiscvTryServer}
                                        </button>
                                    ) : null}
                                </span>
                            ) : null}
                        {/* The AVR boards' C tab ▶: the buffer compiled AS A SKETCH —
                            real Arduino C++ (Serial, String, classes, the core's
                            libraries) on the hosted `arduino` route — and booted on
                            the board's own engine through the debug panel's firmware
                            path. Gated by the route's own device table, so the button
                            and the compile cannot disagree about which boards it
                            serves. */}
                        {this.state.lang === 'c' && sketchBoardFor(this.currentDevice()) ? (
                                <span style={{display: 'inline-flex', alignItems: 'center', gap: 8}}>
                                    <label style={{fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4}}>
                                        {this.L.asmExampleLabel}
                                        <select data-testid={menu ? "bw-arduino-sketch-examples-menu" : "bw-arduino-sketch-examples"}
                                            onChange={e => this.loadArduinoSketchExample(e.target.value)}
                                            value=""
                                            disabled={this.state.busy}
                                            style={{padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1'}}>
                                            <option value="">{this.L.asmExamplePick}</option>
                                            {arduinoSketchExamplesFor(this.currentDevice()).map(ex => (
                                                <option key={ex.id} value={ex.id}>
                                                    {pickLocale(this.props.locale) === 'de' ? ex.labelDe : ex.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <button onClick={this.runSketchOnAvr} disabled={this.state.busy}
                                        data-testid={menu ? "bw-run-arduino-sketch-menu" : "bw-run-arduino-sketch"}
                                        title={this.L.runSketchTitle}
                                        style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}>
                                        {this.L.runSketch}
                                    </button>
                                </span>
                            ) : null}
                        {/* N1: the Z80 bench's C ▶, gated by the route function that
                            decides what a Z80 is (asmTargetForDevice). */}
                        {this.state.lang === 'c' && !this.state.libraryProgram && asmTargetForDevice(this.currentDevice()) === 'z80' ? (
                                <button onClick={this.runCOnZ80} disabled={this.state.busy}
                                    data-testid={menu ? "bw-run-c-z80-menu" : "bw-run-c-z80"}
                                    title={this.L.runCZ80Title}
                                    style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}>
                                    {this.L.runCZ80}
                                </button>
                            ) : null}
                        {this.currentDevice() === 'stm32f030' && this.state.lang === 'pseudocode' ? (
                            <button onClick={this.flashStm32ViaSwd} disabled={this.state.busy}
                                data-testid={menu ? "bw-flash-swd-menu" : "bw-flash-swd"}
                                title={this.L.flashSwdTitle}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#1b7fc9,#125fa3)'}}>
                                {this.L.flashSwd}
                            </button>
                        ) : null}
                        {this.state.lang === 'javascript' ? (
                            <label title={this.L.jsGenerationHint} style={{fontSize: 13}}>
                                {this.L.jsProgram}{' '}
                                <select data-testid="bw-js-execution-target" aria-label={this.L.jsProgram}
                                    value={this.state.jsExecution} disabled={this.state.busy}
                                    onChange={e => this.setGenOpt({jsExecution: e.target.value})}
                                    style={{padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', font: 'inherit'}}>
                                    <option value="classic">{this.L.jsClassic}</option>
                                    <option value={OWNED_CONSOLE_EXECUTION}>{this.L.jsConsole}</option>
                                </select>
                            </label>
                        ) : null}
                        {this.state.lang !== 'pseudocode' && this.state.lang !== 'c' &&
                         !(this.state.lang === 'javascript' && this.state.jsExecution === OWNED_CONSOLE_EXECUTION) &&
                         /_[a-z]+\.|Driver/.test(this.activeCode()) ? (
                            <span style={{fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8}}>
                                <label title={this.L.driverTitle}>
                                    🔌{' '}
                                    <select value={this.state.driverMode} onChange={e => this.setGenOpt({driverMode: e.target.value})} disabled={this.state.busy}
                                        style={{padding: '5px 8px', borderRadius: 6, border: '1px solid #cbd5e1', font: 'inherit'}}>
                                        <option value="shim">{this.L.driverShim}</option>
                                        <option value="remote">{this.L.driverRemote}</option>
                                        <option value="ondevice">{this.L.driverOnbrick}</option>
                                        <option value="simulator">{this.L.driverSim}</option>
                                    </select>
                                </label>
                                <label title={this.L.asyncTitle}>
                                    <input type="checkbox" checked={this.state.asyncMode} disabled={this.state.busy}
                                        onChange={e => this.setGenOpt({asyncMode: e.target.checked})} /> {this.L.asyncLabel}
                                </label>
                                <label title={this.L.eventsTitle}>
                                    <input type="checkbox" checked={this.state.eventsMode} disabled={this.state.busy}
                                        onChange={e => this.setGenOpt({eventsMode: e.target.checked})} /> {this.L.eventsLabel}
                                </label>
                            </span>
                        ) : null}
                        {(this.state.lang === 'python' || this.state.lang === 'javascript') && this.activeCode().trim() ? (
                            <button onClick={this.run} disabled={this.state.running}
                                data-testid={menu ? "bw-code-run-menu" : "bw-code-run"}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}>
                                ▶ {this.L.run} {this.state.lang === 'python' ? 'Python' : 'JavaScript'}
                            </button>
                        ) : null}
                        {this.state.codeSessionRunning ? (
                            <button type="button" onClick={this._onStopCodeRun}
                                data-testid={menu ? "bw-code-stop-menu" : "bw-code-stop"} style={actionBtn}>
                                ■ {this.L.stop}
                            </button>
                        ) : null}
    
                        <React.Fragment>
                            {applies('spike-arena') ? (
                                <button onClick={() => this.openSpikeArena()} title={this.L.openSpikeArenaTitle}
                                    style={{...actionBtn, background: 'linear-gradient(135deg,#e8590c,#c2410c)'}}
                                    data-testid={menu ? "bw-open-spike-arena-menu" : "bw-open-spike-arena"}>
                                    {this.L.openSpikeArena}
                                </button>
                            ) : null}
                            {menu && showPythonRunTargets && (
                                <details data-testid="bw-python-run-on">
                                    <summary data-overflow-action>
                                        <span aria-hidden="true">▶</span>{german ? 'Ausführen auf' : 'Run on'}
                                        <Icon name="chevronRight" size={12} />
                                    </summary>
                                    <div>
                                        <button type="button" onClick={() => this.runOnNuttxPython()} disabled={this.state.busy}
                                            data-testid="bw-spike-nuttx-python-run-menu"
                                            title={german ? 'Python in der NuttX-Firmware ausführen' : 'Run Python in the NuttX firmware'}>
                                            NuttX
                                        </button>
                                        <button type="button" onClick={() => this.runOnMicroPythonImage()} disabled={this.state.busy}
                                            data-testid="bw-spike-micropython-run-menu"
                                            title={german ? 'Lokales MicroPython-Image in Renode ausführen' : 'Run with a local MicroPython image in Renode'}>
                                            {german ? 'MicroPython-Image…' : 'MicroPython image…'}
                                        </button>
                                    </div>
                                </details>
                            )}
                            {applies('spike-firmware') && window.__TAURI_INTERNALS__ && ((this.state.lang === 'pseudocode' && this.currentDevice() === 'spike') || (this.state.lang === 'python' && isSpike3Program(this.activeCode()))) ? <button type="button" onClick={() => this.runOnSpikeFirmware()}
                                disabled={this.state.busy} style={actionBtn} data-testid={menu ? "bw-spike-firmware-run-menu" : "bw-spike-firmware-run"}
                                title={this.L.spikeFirmwareRunTitle}>
                                ▶ Firmware
                            </button> : null}
                        </React.Fragment>
                        {this.state.lang === 'python' && isSpike3Program(this.activeCode()) ? (
                            <button onClick={() => this.runOnSpike3()} title={this.L.runOnSpike3Title} disabled={this.state.busy}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#f59e0b,#d97706)'}}
                                data-testid={menu ? "bw-spike3-run-menu" : "bw-spike3-run"}>
                                {this.L.runOnSpike3}
                            </button>
                        ) : null}
                        {this.state.spike3Running ? (
                            <button onClick={() => this.stopSpike3()} data-testid={menu ? "bw-spike3-stop-menu" : "bw-spike3-stop"}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#fa5252,#e03131)'}}>
                                {this.L.spike3Stop}
                            </button>
                        ) : null}
                        {this.state.picoSimRunning ? (
                            <button onClick={() => this.stopPicoSim()} data-testid={menu ? "bw-pico-sim-stop-menu" : "bw-pico-sim-stop"}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#fa5252,#e03131)'}}>
                                ■ {this.L.stop}
                            </button>
                        ) : null}
                        {this.state.lang === 'basic' && this.activeCode().trim() ? (
                            <button onClick={() => this.runBasic()} disabled={this.state.running || this.state.busy || this.state.basicResetting || this.state.basicGenerationFailed || this.basicGenerationPlaceholder(this.state.buffers.basic)}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}
                                data-testid={menu ? "bw-basic-run-menu" : "bw-basic-run"}>
                                {this.L.runBasic}
                            </button>
                        ) : null}
                        {this.state.crispBasicActive && this.state.running ? (
                            <button type="button" onClick={() => this.stopCrispBasic()} disabled={this.state.basicResetting}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#fa5252,#e03131)'}}
                                data-testid="bw-crispbasic-stop">
                                ■ {this.L.stop}
                            </button>
                        ) : null}
                        {this.state.lang === 'basic' && this.state.basicProfile === 'bbc' && this.state.basicEngine === 'crispbasic' ? (
                            <button type="button" onClick={() => this.resetCrispBasic()}
                                disabled={this.state.basicResetting || (this.state.running && !this.state.crispBasicActive)}
                                style={actionBtn} data-testid="bw-crispbasic-reset">
                                {this.L.basicCrispReset}
                            </button>
                        ) : null}
                        {this.state.lang === 'basic' && this.state.basicProfile === 'bbc' && this.state.basicEngine === 'crispbasic' ? (
                            <label style={{display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap'}}>
                                <input type="checkbox" checked={Boolean(this.state.basicConnectCircuit)}
                                    disabled={this.state.running || this.state.basicResetting}
                                    onChange={event => this.setState({basicConnectCircuit: event.target.checked})}
                                    data-testid="bw-crispbasic-connect-circuit" />
                                {this.L.basicConnectCircuit}
                            </label>
                        ) : null}
                        {this.state.lang === 'fe' && this.activeCode().trim() ? (
                            <button onClick={() => this.runFeOnDosInterp()} disabled={this.state.running}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}
                                data-testid={menu ? "bw-fe-run-menu" : "bw-fe-run"}>
                                {this.L.runFe}
                            </button>
                        ) : null}
                        {this.state.lang === 'fe' && this.activeCode().trim() ? (
                            <button onClick={() => this.runFeOnRiscv()} disabled={this.state.running || this.state.busy}
                                title={this.L.runFeRiscvTitle}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}
                                data-testid={menu ? "bw-fe-run-riscv-menu" : "bw-fe-run-riscv"}>
                                {this.L.runFeRiscv}
                            </button>
                        ) : null}
                        {this.state.lang === 'forth' && this.activeCode().trim() ? (
                            <button onClick={() => this.runForthOnDosInterp()} disabled={this.state.running}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}
                                data-testid={menu ? "bw-forth-run-menu" : "bw-forth-run"}>
                                {this.L.runForth}
                            </button>
                        ) : null}
                        {this.state.lang === 'forth' && this.activeCode().trim() ? (
                            <button onClick={() => this.runForthOnRiscv()} disabled={this.state.running || this.state.busy}
                                title={this.L.runForthRiscvTitle}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}
                                data-testid={menu ? "bw-forth-run-riscv-menu" : "bw-forth-run-riscv"}>
                                {this.L.runForthRiscv}
                            </button>
                        ) : null}
                        {this.state.lang === 'tcl' && this.activeCode().trim() ? (
                            <button onClick={() => this.runTclOnDosInterp()} disabled={this.state.running}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}
                                data-testid={menu ? "bw-tcl-run-menu" : "bw-tcl-run"}>
                                {this.L.runTcl}
                            </button>
                        ) : null}
                        {['fe', 'tcl', 'forth'].includes(this.state.lang) && this.currentDevice() &&
                            this.activeCode().trim() ? (
                            <button onClick={() => this.runViaBlocksOnDevice()}
                                disabled={this.state.running || this.state.busy}
                                title={this.L.runViaBlocksTitle}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#4c97ff,#4280d7)'}}
                                data-testid={menu ? "bw-run-via-blocks-menu" : "bw-run-via-blocks"}>
                                {this.L.runViaBlocks(this.currentDevice())}
                            </button>
                        ) : null}
                        {this.state.lang === 'tcl' && this.activeCode().trim() ? (
                            <button onClick={() => this.runTclOnRiscv()} disabled={this.state.running || this.state.busy}
                                title={this.L.runTclRiscvTitle}
                                style={{...actionBtn, background: 'linear-gradient(135deg,#37b24d,#2f9e44)'}}
                                data-testid={menu ? "bw-tcl-run-riscv-menu" : "bw-tcl-run-riscv"}>
                                {this.L.runTclRiscv}
                            </button>
                        ) : null}
                        {menu && this.state.lang === 'asm' && this.state.asmMode === 'source' && <>
                            <button type="button" data-testid="bw-asm-assemble-menu"
                                disabled={this.state.busy || !this.state.buffers.asm.trim()} onClick={() => this.assembleAndRun()}>
                                <Icon name="run" />{this.L.assembleAndRun.replace(/^🔩\s*/, '')}
                            </button>
                            {this.renderAsmExamplePicker(true)}
                        </>}
                        {this.state.lang === this.state.libraryProgram?.language && (
                            <button type="button" style={actionBtn} onClick={this.runLibraryProgram}
                                disabled={this.state.busy} title={this.L.cpmRunHint}
                                data-testid={menu ? 'bw-library-code-run-menu' : 'bw-library-code-run'}>
                                {menu ? <Icon name="run" /> : '▶ '}{this.state.libraryProgram.title}
                            </button>
                        )}
                        {this.state.lang === 'nqc' ? (
                            <React.Fragment>
                                <button type="button" onClick={() => this.compileNqcToFile()}
                                    disabled={this.state.busy || !(this.state.buffers.nqc || '').trim()}
                                    data-testid={menu ? "bw-nqc-compile-menu" : "bw-nqc-compile"} title={this.L.nqcNote.slice(0, 80)}
                                    style={{...actionBtn, background: '#e2e8f0', color: '#334155'}}>
                                    {this.L.nqcCompile}
                                </button>
                                <button type="button" onClick={() => this.sendNqcToBrick()}
                                    disabled={this.state.busy || !(this.state.buffers.nqc || '').trim()}
                                    data-testid={menu ? "bw-nqc-send-menu" : "bw-nqc-send"} title={this.L.nqcNote.slice(0, 80)}
                                    style={{...actionBtn, background: '#4c97ff', color: '#fff'}}>
                                    {this.L.nqcSend}
                                </button>
                            </React.Fragment>
                        ) : null}
                    </div>
                    {!menu && <span style={{flex: 1, minWidth: 4}} />}
                    {/* Compact controls */}
                    <React.Fragment>
                        <button type="button" onClick={() => this.setState(s => ({showMatrix: !s.showMatrix}))}
                            aria-label={this.L.matrixAria} title={this.L.matrixTitle}
                            data-testid={menu ? "bw-matrix-toggle-menu" : "bw-matrix-toggle"}
                            style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 20,
                                padding: '0 6px', border: 'none', borderRadius: 10,
                                background: this.state.showMatrix ? '#4c97ff' : '#e2e8f0',
                                color: this.state.showMatrix ? '#fff' : '#475569', fontSize: 11, fontWeight: 700,
                                cursor: 'pointer', alignSelf: 'center'}}>
                            {menu ? <><Icon name="grid" /><span>{pickLocale(this.props.locale) === 'de' ? 'Sprachmatrix' : 'Language matrix'}</span></> :
                                <span aria-hidden="true">⊞⊟</span>}
                        </button>
                        <button type="button" onClick={() => showCircuitDebugger()}
                            aria-label={pickLocale(this.props.locale) === 'de' ? 'Debugger öffnen' : 'Open debugger'}
                            title={pickLocale(this.props.locale) === 'de' ? 'Debugger im rechten Bereich öffnen' : 'Open debugger in the right pane'}
                            data-testid={menu ? "bw-open-circuit-debugger-menu" : "bw-open-circuit-debugger"}
                            style={{display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 20,
                                padding: '0 7px', border: 'none', borderRadius: 10, background: '#e2e8f0',
                                color: '#475569', fontSize: 11, fontWeight: 700, cursor: 'pointer', alignSelf: 'center'}}>
                            {menu ? <><Icon name="debugger" />{pickLocale(this.props.locale) === 'de' ? 'Debugger öffnen' : 'Open debugger'}</> :
                                <span aria-hidden="true">🐞</span>}
                        </button>
                        {renderDeviceSelect(menu)}
                    </React.Fragment>
            </React.Fragment>
        );
        const machine = this.state.microtronicActive ? 'microtronic' : this.state.cardiacActive ? 'cardiac' : this.state.cp1Active ? 'cp1' :
            this.state.kim1Active ? 'kim1' : null;
        const languageAvailable = lang => !machine && this.allowsCodeLanguage(lang);
        const basicProfile = this.selectedBasicProfile();
        const basicProfileLabels = {bbc: 'BBC BASIC (Z80)', ms: '6502 BASIC', i8086: '8086 BASIC (native)',
            'i8086-dos': '8086 BASIC (MS-DOS 2.0)', 'i8086-ubasic': 'uBASIC (DOS)', 'pico-bbcbasic': 'PicoBB BBC BASIC',
            'pico-piccolo': 'PiccoloBASIC', 'pico-stefan': 'Stefan’s BASIC'};
        const renderLanguages = menu => (
            <React.Fragment>
                    {[['pseudocode', '🧩 Pseudo'], ['python', '🐍 Py'], ['javascript', '🟨 JS'], ['c', '🔧 C'], ['basic', '📺 BAS'], ['asm', '🔩 ASM'],
                        ...this.visibleOptionalLangs().map(([l, label]) => [l, label]),
                        // The tab follows the DEVICE line, except when a
                        // MicroPython program was imported from a .hex: there
                        // is no pseudocode then, and hiding the tab would hide
                        // the Run button of the one program we can run as-is.
                        ...(['microbit', 'calliopemini'].includes(codeDevice) ||
                            (!codeDevice && (this.state.buffers.micropython || '').trim()) ?
                            [['micropython', this.currentDevice() === 'calliopemini' ? '🤖 Calliope' : '🤖 micro:bit']] : []),
                        // NQC appears for people who have an RCX and stays out
                        // of everyone else's way. The RCX is not a DEVICE line
                        // — it is reached through an extension — so the test
                        // is whether that extension is loaded, plus the usual
                        // "there is already something in the buffer" so a
                        // file you opened does not vanish when you switch tabs.
                        ...(this.rcxLoaded() || (this.state.buffers.nqc || '').trim() ?
                            [['nqc', '🧱 NQC']] : [])].filter(([l]) => languageAvailable(l)).map(([l, label]) => {
                        const active = !this.state.cp1Active && !this.state.cardiacActive && !this.state.kim1Active && !this.state.microtronicActive && this.state.lang === l;
                        return (
                            <button key={l} type="button" aria-pressed={active} onClick={() => this.switchTab(l)}
                                disabled={this.state.busy && !active} title={menu ? LANG_LABEL[l] : label}
                                aria-label={menu ? (l === 'micropython' ? label.replace(/^\S+\s+/, '') : LANG_LABEL[l]) : label}
                                style={languageTabStyle(active)}>
                                {menu ? (l === 'micropython' ? label.replace(/^\S+\s+/, '') : LANG_LABEL[l]) :
                                    this.state.cardiacActive ? label.split(' ')[0] : label}
                            </button>
                        );
                    })}
                    {this.state.cp1Active && <button type="button" data-testid={menu ? "bw-code-cp1-tab-menu" : "bw-code-cp1-tab"} onClick={() => this.openCp1Language()}
                        disabled={this.state.busy} aria-pressed={this.state.cp1Active} title={this.L.cp1Language}
                        style={languageTabStyle(this.state.cp1Active)}>
                        CP1
                    </button>}
                    {this.state.cardiacActive && <button type="button" data-testid={menu ? "bw-code-cardiac-tab-menu" : "bw-code-cardiac-tab"} onClick={() => this.openCardiacLanguage()}
                        disabled={this.state.busy} aria-pressed={this.state.cardiacActive}
                        title={this.L.cardiacLanguage} style={languageTabStyle(this.state.cardiacActive)}>
                        CARDIAC
                    </button>}
                    {this.state.microtronicPartId && (!machine || machine === 'microtronic') && <button type="button"
                        data-testid={menu ? 'bw-code-microtronic-tab-menu' : 'bw-code-microtronic-tab'}
                        onClick={this.selectMicrotronic} aria-pressed={!!this.state.microtronicActive}
                        style={languageTabStyle(this.state.microtronicActive)}>Microtronic</button>}
                    {this.state.kim1PartId && (!machine || machine === 'kim1') && <button type="button" data-testid={menu ? "bw-code-kim1-tab-menu" : "bw-code-kim1-tab"}
                        onClick={() => this.setState({kim1Active: true, cp1Active: false, cardiacActive: false, microtronicActive: false})}
                        aria-pressed={this.state.kim1Active} style={languageTabStyle(this.state.kim1Active)}>
                        KIM-1
                    </button>}
                    {(() => {
                        const shown = this.visibleOptionalLangs().map(([l]) => l);
                        const hidden = BW_OPTIONAL_LANGS.filter(([l]) => languageAvailable(l) && !shown.includes(l))
                            .map(([language, label, name]) => [language, label, name, () => this.addOptionalLang(language)]);
                        if (!machine && !codeDevice) hidden.push(['cp1', 'CP1', this.L.cp1Language, () => this.openCp1Language()]);
                        if (!machine && !codeDevice) hidden.push(['cardiac', 'CARDIAC', this.L.cardiacLanguage, () => this.openCardiacLanguage()]);
                        if (!hidden.length) return null;
                        if (menu) return hidden.map(([language, label, name, open]) =>
                            <button key={language} type="button" title={name} disabled={this.state.busy}
                                onClick={open}>{LANG_LABEL[language] || label}</button>);
                        return (
                            <Popup id="code-lang-more" anchorTestId="bw-lang-more-anchor" testId="bw-lang-more-menu" role="menu"
                                open={this.props.isVisible !== false && this.state.langMenuOpen} align="left" width={220}
                                label={this.L.moreLanguages}
                                onToggle={() => { if (!this.state.busy) this.setState(s => ({langMenuOpen: !s.langMenuOpen})); }}
                                onClose={() => this.setState({langMenuOpen: false})}
                                button={<button type="button" data-testid="bw-lang-more" disabled={this.state.busy}
                                    aria-label={this.L.moreLanguages} title={this.L.moreLanguages}
                                    style={{padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '8px 8px 0 0', cursor: 'pointer',
                                        fontWeight: 700, fontSize: 13, background: '#eef2f7', color: '#64748b', position: 'relative', top: 1}}>
                                    +
                                </button>}>
                                {hidden.map(([l, label, name, open]) => (
                                    <button key={l} type="button" role="menuitem" title={name} onClick={open}
                                        style={{padding: '7px 10px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer',
                                            fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap'}}>
                                        {label}
                                    </button>
                                ))}
                            </Popup>
                        );
                    })()}
            </React.Fragment>
        );
        const languageBar = (
                <ScrollRow testId="bw-lang-row" label={this.L.toolbarLabel}
                    style={{marginBottom: -1, paddingRight: 40}} scrollerStyle={{paddingBottom: 1}}
                    trailing={(
                        <React.Fragment>
                            {this.renderCodeInfo(machine)}
                            {this.renderActionMenu(csel, renderCodeControls, renderLanguages, machine, renderDeviceSelect)}
                    <button onClick={() => this.toggleMaximize()}
                        style={{...csel, cursor: 'pointer', background: max ? '#4c97ff' : '#f1f5f9',
                            color: max ? '#fff' : 'inherit', minWidth: 24, border: '1px solid #cbd5e1', alignSelf: 'center'}}
                        title={max ? this.L.restoreTitle : this.L.maximizeTitle}
                        aria-label={max ? this.L.restoreTitle : this.L.maximizeTitle} aria-pressed={max}
                        data-testid="bw-editor-maximize">
                        {max ? '⊡' : '⊞'}
                    </button>

                        </React.Fragment>
                    )}>
                    {renderLanguages(false)}
                    {this.state.cardiacActive && !this.state.actionsOpen && <div ref={this.props.onCardiacToolsSlot}
                        data-cardiac-tools-slot style={{display: 'flex', flexShrink: 0, alignItems: 'center', paddingLeft: 4}} />}
                    {!this.state.cp1Active && !this.state.cardiacActive && !this.state.kim1Active && !this.state.microtronicActive && <React.Fragment>
                    {renderCodeControls(false)}
                    </React.Fragment>}
                </ScrollRow>
        );
        return (
            <div style={{...wrap, position: 'relative'}} data-testid="bw-code-editor"
                data-code-operation-status={this.state.status || undefined}>
                {usesMacDevicePicker && this.renderMacDevicePicker()}
                {max ? <details data-code-max-tools style={{position: 'absolute', top: 8, left: 16, right: 52,
                    zIndex: 20, pointerEvents: 'none'}} onKeyDown={event => {
                    if (event.key === 'Escape') {
                        event.currentTarget.open = false;
                        event.currentTarget.querySelector('summary')?.focus();
                    }
                }}>
                    <summary data-testid="bw-max-editor-tools" aria-label={this.L.toolbarLabel} title={this.L.toolbarLabel}
                        style={{listStyle: 'none', textAlign: 'center', cursor: 'pointer', width: 28, marginLeft: 'auto',
                            pointerEvents: 'auto', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff'}}>
                        …
                    </summary>
                    <div style={{pointerEvents: 'auto', background: '#f1f5f9', padding: 4, borderRadius: 6,
                        border: '1px solid #cbd5e1', boxShadow: '0 2px 8px #0002'}}>
                        {languageBar}
                    </div>
                </details> : languageBar}
                {this.renderBlinkMachinePicker()}
                {this.state.microtronicActive ? (
                    <React.Suspense fallback={null}>
                        <MicrotronicSurface vm={this.props.vm} partId={this.state.microtronicPartId} variant="code"
                            locale={this.props.locale} Editor={CMEditor} />
                    </React.Suspense>
                ) : this.state.kim1Active ? (
                    <React.Suspense fallback={null}>
                        <Kim1Surface vm={this.props.vm} partId={this.state.kim1PartId} variant="code"
                            locale={this.props.locale} Editor={CMEditor} />
                    </React.Suspense>
                ) : this.state.cardiacActive ? (
                    <div ref={this.props.onCardiacCodeSlot} data-cardiac-language-pane
                        style={{flex: 1, minHeight: 0, overflow: 'auto'}} />
                ) : this.state.cp1Active ? (
                    <div ref={this.props.onCp1CodeSlot} data-cp1-language-pane
                        style={{flex: 1, minHeight: 0, overflow: 'auto'}} />
                ) : <React.Fragment>
                {ownedConsoleSource ? (
                    <div data-testid="bw-code-conversion-limit" role="status"
                        style={{padding: '5px 10px', marginTop: 4, background: '#fff8e1', border: '1px solid #f0c36d',
                            borderRadius: 6, color: '#5d4300', fontSize: 12, lineHeight: 1.4, flexShrink: 0}}>
                        {this.L.jsConsoleHint}
                    </div>
                ) : null}
                {this.state.showMatrix && !max && this.renderMatrixPanel()}

                {this.state.lang === 'basic' && basicProfile && !max && (
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 16, padding: '6px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', fontSize: 13, alignItems: 'center'}}>
                        <label style={{display: 'flex', alignItems: 'center', gap: 4}}>
                            {this.L.profile}
                            <select value={basicProfile.id} data-testid="bw-basic-profile" disabled={this.state.running || this.state.basicResetting}
                                onChange={e => this.setGenOpt({basicProfile: e.target.value, basicFilename: 'editor.bas', basicWarnings: [], basicGenerationFailed: false})}
                                style={{padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1'}}>
                                {basicProfilesFor(codeDevice).map(({id}) =>
                                    <option key={id} value={id}>{basicProfileLabels[id]}</option>)}
                            </select>
                        </label>
                        {basicProfile.id === 'bbc' ? (
                            <label style={{display: 'flex', alignItems: 'center', gap: 4}}>
                                {this.L.basicEngine}
                                <select value={this.state.basicEngine} disabled={this.state.running || this.state.basicResetting}
                                    onChange={e => this.setGenOpt({basicEngine: e.target.value})}
                                    style={{padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1'}}
                                    data-testid="bw-basic-engine">
                                    <option value="crispbasic">{this.L.basicCrispEngine}</option>
                                    <option value="z80">{this.L.basicZ80Engine}</option>
                                </select>
                            </label>
                        ) : null}
                        {basicProfile.id === 'bbc' && this.state.basicEngine === 'crispbasic' ? (
                            <label style={{display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'}}>
                                <input type="checkbox" checked={Boolean(this.state.basicPortableLibrary)}
                                    disabled={this.state.running || this.state.basicResetting}
                                    onChange={event => this.setGenOpt({basicPortableLibrary: event.target.checked})}
                                    data-testid="bw-basic-portable-library" />
                                {this.L.basicPortableLibrary}
                            </label>
                        ) : null}
                        {!this.standaloneBasicProfile() && <label style={{display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer'}}>
                            <input type="checkbox" checked={this.state.basicLineNumbers}
                                disabled={basicProfile.id === 'ms' || this.state.running || this.state.basicResetting}
                                onChange={e => this.setGenOpt({basicLineNumbers: e.target.checked, basicWarnings: [],
                                    basicGenerationFailed: false, basicFilename: 'editor.bas'})} />
                            {this.L.lineNumbers}{' '}{basicProfile.id === 'ms' ? this.L.alwaysOn6502 : ''}
                        </label>}
                    </div>
                )}
                {this.state.lang === 'basic' && this.state.basicProfile === 'bbc' && this.state.basicEngine === 'crispbasic' ? (
                    <div style={{padding: '6px 12px', fontSize: 12, color: '#475569', flexShrink: 0}}
                        data-testid="bw-crispbasic-capabilities">
                        {this.L.basicCrispScope}
                        {this.state.basicPortableLibrary ? <p style={{margin: '4px 0 0'}}>{this.L.basicPortableHint}</p> : null}
                    </div>
                ) : null}
                {this.state.lang === 'basic' && this.state.basicWarnings.length ? (
                    <ul style={{margin: '4px 0', padding: '8px 12px 8px 28px', fontSize: 12, color: '#92400e',
                        background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, flexShrink: 0}}
                        data-testid="bw-basic-generation-warnings">
                        {this.state.basicWarnings.map((warning, index) => <li key={index}>{warning}</li>)}
                    </ul>
                ) : null}
                {this.state.lang === 'asm' && !max && (
                    <div style={{display: 'flex', gap: 16, padding: '6px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderTop: 'none', fontSize: 13, alignItems: 'center'}}>
                        <label style={{display: 'flex', alignItems: 'center', gap: 4}}>
                            {this.L.asmModeLabel}
                            <select value={this.state.asmMode}
                                onChange={e => {
                                    const mode = e.target.value;
                                    this.setState({asmMode: mode});
                                    if (mode === 'listing') this.fetchAsmListing();
                                }}
                                style={{padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1'}}>
                                <option value="source">{this.L.asmSource}</option>
                                <option value="listing">{this.L.asmListing}</option>
                            </select>
                        </label>
                        {/* Dialect: an 8086 choice only. The other assemblers each read
                            one syntax, so the selector does not appear for them. */}
                        {this.state.asmMode === 'source' && asmTargetForDevice(this._asmDevice()) === 'i8086' && (
                            <label style={{display: 'flex', alignItems: 'center', gap: 4}} title={this.L.asmDialectTitle}>
                                {this.L.asmDialectLabel}
                                <select value={this.state.asmDialect} data-testid="bw-asm-dialect"
                                    onChange={e => this.setState({asmDialect: e.target.value})}
                                    style={{padding: '2px 6px', borderRadius: 4, border: '1px solid #cbd5e1'}}>
                                    {ASM_DIALECTS.map(d => <option key={d} value={d}>{this.L.asmDialectNames[d]}</option>)}
                                </select>
                            </label>
                        )}
                        {this.state.asmMode === 'source' && this.renderAsmExamplePicker(false)}
                        {/* The licence is the CONDITION these ship under, so it
                            is visible where they are chosen rather than only in
                            THIRD-PARTY-NOTICES.md. The programs also carry their
                            own AUTHOR/REPOSITORY/LICENSE header into the editor,
                            so a learner who copies the text out takes the notice
                            with them. */}
                        {this.state.asmMode === 'source' && this._asmCredit() && (
                            <a
                                data-testid="bw-asm-example-credit"
                                href={this._asmCredit().repo}
                                target="_blank" rel="noopener noreferrer"
                                title={this.L.asmCreditTitle(this._asmCredit())}
                                style={{fontSize: 11, color: '#64748b', textDecoration: 'underline'}}>
                                {this.L.asmCredit(this._asmCredit())}
                            </a>
                        )}
                        {this.state.asmMode === 'source' && (
                            <button type="button"
                                onClick={() => this.assembleAndRun()}
                                disabled={this.state.busy || !this.state.buffers.asm.trim()}
                                style={{padding: '4px 12px', borderRadius: 6, border: 'none',
                                    cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                    background: 'linear-gradient(135deg,#37b24d,#2f9e44)', color: '#fff'}}
                                data-testid="bw-asm-assemble">
                                {this.L.assembleAndRun}
                            </button>
                        )}
                    </div>
                )}
                {this.state.lang === 'micropython' && !max && (
                    <div style={{display: 'flex', gap: 16, padding: '6px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderTop: 'none', fontSize: 13, alignItems: 'center'}}
                        data-testid="bw-micropython-bar">
                        <span style={{color: '#166534'}}>
                            {this.state.importedPython ? this.L.micropythonImported : this.L.micropythonReadonly}
                        </span>
                        <span style={{flex: 1}} />
                        {/* Debug granularity: block-level (marker, stock firmware) or
                            line-level (settrace, debug firmware). User's choice, persisted. */}
                        <div style={{display: 'inline-flex', border: '1px solid #a855f7', borderRadius: 6, overflow: 'hidden'}}
                            data-testid="bw-microbit-debug-level">
                            {['block', 'line'].map(lv => (
                                <button key={lv} type="button"
                                    aria-label={lv === 'line' ? this.L.debugLevelLine : this.L.debugLevelBlock}
                                    aria-pressed={this.state.debugLevel === lv}
                                    onClick={() => this._setDebugLevel(lv)}
                                    title={lv === 'line' ? this.L.debugLineHint : this.L.debugBlockHint}
                                    style={{padding: '3px 10px', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                                        background: this.state.debugLevel === lv ? '#7c3aed' : '#faf5ff',
                                        color: this.state.debugLevel === lv ? '#fff' : '#7c3aed'}}
                                    data-testid={`bw-microbit-debug-level-${lv}`}>
                                    <span aria-hidden="true">{lv === 'line' ? '≡' : '▣'}</span>
                                </button>
                            ))}
                        </div>
                        <button type="button"
                            onClick={() => this.flashMicrobitSimDebug()}
                            disabled={this.state.busy || !this.state.buffers.micropython.trim() || /^# ===/.test(this.state.buffers.micropython)}
                            style={{padding: '4px 12px', borderRadius: 6, border: '1px solid #a855f7',
                                cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                background: '#faf5ff', color: '#7c3aed'}}
                            data-testid="bw-microbit-debug">
                            {this.L.debugOnSimulator}
                        </button>
                        <button type="button"
                            onClick={() => this.flashMicrobitSim()}
                            title={pickLocale(this.props.locale) === 'de' ? 'Im Simulator ausführen' : 'Run on Simulator'}
                            disabled={this.state.busy || !this.state.buffers.micropython.trim() || /^# ===/.test(this.state.buffers.micropython)}
                            style={{padding: '4px 12px', borderRadius: 6, border: 'none',
                                cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                background: 'linear-gradient(135deg,#16a34a,#15803d)', color: '#fff'}}
                            data-testid="bw-microbit-flash">
                            {this.L.runOnSimulator}
                        </button>
                        {/* Flash straight to the board over WebUSB (N9) —
                            shown only where WebUSB exists; the handler refuses
                            by name when no probe is granted. */}
                        {typeof navigator !== 'undefined' && navigator.usb ? (
                            <button type="button"
                                onClick={this.flashMicrobitViaSwd}
                                disabled={this.state.busy || !this.state.buffers.micropython.trim() || /^# ===/.test(this.state.buffers.micropython)}
                                title={this.L.microbitFlashTitle}
                                style={{padding: '4px 12px', borderRadius: 6, border: '1px solid #0ea5e9',
                                    cursor: 'pointer', fontWeight: 600, fontSize: 12,
                                    background: '#f0f9ff', color: '#0369a1'}}
                                data-testid="bw-microbit-flash-webusb">
                                {this.L.microbitFlash}
                            </button>
                        ) : null}
                    </div>
                )}
                {this.state.lang === 'pseudocode' && this.currentDevice() === 'arcade' ? (() => {
                    const resources = [...(this.props.vm.runtime.bwArcadeAnimationResources?.values() || [])];
                    const items = animationResourceMenuItems(this.props.vm.runtime.bwArcadeAnimationResources, this.props.vm.runtime);
                    const id = this.state.animationResourceId || resources[0]?.id || '';
                    const de = pickLocale(this.props.locale) === 'de';
                    const ready = !this.state.busy && resources.some(resource => resource.id === id);
                    // One compact row: picker plus an Insert menu, so the three
                    // insert actions take no toolbar width until asked for.
                    const insert = kind => {
                        this.setState({animationMenuOpen: false});
                        this.insertAnimationResource(kind);
                    };
                    const item = {whiteSpace: 'nowrap'};
                    return <div data-testid="bw-code-animation-resources"
                        style={{display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', margin: '4px 0'}}>
                        <label title={this.L.animationLabel}>🎞{' '}
                            <select data-testid="bw-code-animation-picker" value={id} aria-label={this.L.animationLabel}
                                onChange={event => this.setState({animationResourceId: event.target.value})}>
                                {!resources.length ? <option value="">{de ? 'Zuerst in Pixel veröffentlichen' : 'Publish a timeline in Pixel first'}</option> : null}
                                {items.map(entry => <option key={entry.value} value={entry.value}>{entry.text}</option>)}
                            </select>
                        </label>
                        <button type="button" disabled={!ready} data-testid="bw-code-animation-insert-menu"
                            aria-haspopup="menu" aria-expanded={this.state.animationMenuOpen ? 'true' : 'false'}
                            onClick={() => this.setState(state => ({animationMenuOpen: !state.animationMenuOpen}))}>
                            {de ? 'Einfügen ▾' : 'Insert ▾'}</button>
                        {this.state.animationMenuOpen && ready ? (
                            // Inline while open: an overlay here sat under the tab row,
                            // which then took the clicks (arcade animation gate).
                            <div role="menu" data-testid="bw-code-animation-insert-items"
                                style={{display: 'inline-flex', gap: 4, flexWrap: 'wrap'}}>
                                <button type="button" role="menuitem" style={item}
                                    data-testid="bw-code-animation-insert-frames" onClick={() => insert('frames')}>
                                    {de ? 'Bilder einfügen' : 'Insert frames'}</button>
                                <button type="button" role="menuitem" style={item}
                                    title={de ? 'Jeder Aufruf erzeugt neue Bilder und ein neues Array.' : 'Each call creates new images and a new array.'}
                                    data-testid="bw-code-animation-insert-fresh" onClick={() => insert('fresh')}>
                                    {de ? 'Frische Bilder einfügen' : 'Insert fresh frames'}</button>
                                <button type="button" role="menuitem" style={item}
                                    data-testid="bw-code-animation-insert-interval" onClick={() => insert('interval')}>
                                    {de ? 'Intervall einfügen' : 'Insert interval'}</button>
                            </div>
                        ) : null}
                    </div>;
                })() : null}
                {this.state.revealed ? (
                    <React.Suspense fallback={
                        <FallbackEditor
                        value={this.activeCode()}
                        onChange={text => this.setActiveCode(text)}
                        readOnly={!TWO_WAY.has(this.state.lang) && !EDITABLE_ONE_WAY(this.state.lang, this.state.asmMode)}
                    />
                    }>
                        <CMEditor
                            ref={ref => { this._cmEditor = ref; }}
                            value={this.activeCode()}
                            onChange={text => this.setActiveCode(text)}
                            readOnly={!TWO_WAY.has(this.state.lang) && !EDITABLE_ONE_WAY(this.state.lang, this.state.asmMode)}
                            lang={this.state.lang}
                            isVisible={this.props.isVisible}
                        />
                    </React.Suspense>
                ) : (
                    /* Hidden tab: the textarea stands in and CodeMirror is not fetched. */
                    <FallbackEditor
                        value={this.activeCode()}
                        onChange={text => this.setActiveCode(text)}
                        readOnly={!TWO_WAY.has(this.state.lang) && !EDITABLE_ONE_WAY(this.state.lang, this.state.asmMode)}
                    />
                )}

                {this.renderCircuitOffer()}

                {this.state.showArt && (
                <div style={{margin: '12px 0 4px', padding: 12, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8}}>
                    <p style={{margin: '0 0 8px'}}>
                        {pickLocale(this.props.locale) === 'de' ? (
                            <React.Fragment>
                                Lade eine oder mehrere <code>.svg</code>-Dateien hoch und ordne jede unten in der Tabelle
                                einem Sprite aus deinem Pseudocode zu. Bei <strong>⇦ Zu Blöcken</strong> wird jedes SVG als
                                Kostüm dieses Sprites eingebacken — <em>ersetzen</em> tauscht das Kostüm, <em>als Bild
                                hinzufügen</em> ergänzt eines für Animation.
                            </React.Fragment>
                        ) : (
                            <React.Fragment>
                                Upload one or more <code>.svg</code> files, then associate each with a sprite from your
                                pseudocode in the table below. On <strong>⇦ To blocks</strong>, every SVG is baked
                                in as that sprite&apos;s costume — <em>replace</em> swaps its costume, <em>add as frame</em>
                                appends one for animation.
                            </React.Fragment>
                        )}
                    </p>
                    <input type="file" accept=".svg,image/svg+xml" multiple onChange={this.handleFiles} />
                    {this.state.uploads.length > 0 && (() => {
                        const sprites = this.spriteNames();
                        const th = {textAlign: 'left', padding: '6px 8px', borderBottom: '2px solid #e2e8f0', fontSize: 12, opacity: .75};
                        const td = {padding: '6px 8px', borderBottom: '1px solid #eef2f7', verticalAlign: 'middle'};
                        return (
                            <table style={{borderCollapse: 'collapse', width: '100%', marginTop: 10}}>
                                <thead><tr>
                                    <th style={th}>{this.L.svgFile}</th>
                                    <th style={th}>{this.L.sprite}</th>
                                    <th style={th}>{this.L.mode}</th>
                                    <th style={th} />
                                </tr></thead>
                                <tbody>
                                    {this.state.uploads.map((u, i) => (
                                        <tr key={i}>
                                            <td style={td}>
                                                <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                                                    <img src={`data:image/svg+xml,${encodeURIComponent(u.svg)}`} alt=""
                                                        style={{width: 36, height: 36, objectFit: 'contain', background: '#fff',
                                                            border: '1px solid #e2e8f0', borderRadius: 6, flexShrink: 0}} />
                                                    <span style={{fontSize: 12, opacity: .7, wordBreak: 'break-all'}}>{u.filename}</span>
                                                </div>
                                            </td>
                                            <td style={td}>
                                                <select value={u.sprite} onChange={e => this.setUpload(i, {sprite: e.target.value})}
                                                    style={{padding: '4px 8px', borderRadius: 6,
                                                        border: `1px solid ${u.sprite ? '#cbd5e1' : '#f0a0a0'}`, minWidth: 130}}>
                                                    <option value="">{this.L.chooseSprite}</option>
                                                    {sprites.map(n => <option key={n} value={n}>{n}</option>)}
                                                    {u.sprite && !sprites.includes(u.sprite) &&
                                                        <option value={u.sprite}>{u.sprite} ({this.L.notInCode})</option>}
                                                </select>
                                            </td>
                                            <td style={td}>
                                                <select value={u.mode} onChange={e => this.setUpload(i, {mode: e.target.value})}
                                                    style={{padding: '4px 6px', borderRadius: 6, border: '1px solid #cbd5e1'}}>
                                                    <option value="replace">{this.L.replaceCostume}</option>
                                                    <option value="add">{this.L.addFrame}</option>
                                                </select>
                                            </td>
                                            <td style={td}>
                                                <button onClick={() => this.removeUpload(i)}
                                                    style={{border: 'none', background: 'none', cursor: 'pointer', fontSize: 16}}>✕</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        );
                    })()}
                    {this.state.uploads.length > 0 && this.spriteNames().length === 0 && (
                        <p style={{margin: '8px 0 0', fontSize: 12, color: '#b45309'}}>
                            {pickLocale(this.props.locale) === 'de' ? (
                                <React.Fragment>
                                    Noch keine <code>SPRITE</code>-Deklarationen im Pseudocode gefunden — füge eine hinzu
                                    (z.&nbsp;B. <code> SPRITE Player:</code>), um ein SVG damit zu verknüpfen.
                                </React.Fragment>
                            ) : (
                                <React.Fragment>
                                    No <code>SPRITE</code> declarations found in your pseudocode yet — add one (e.g.
                                    <code> SPRITE Player:</code>) to associate an SVG with it.
                                </React.Fragment>
                            )}
                        </p>
                    )}
                    {this.state.uploads.length > 0 && (() => {
                        const unassigned = this.state.uploads.filter(u => !u.sprite).length;
                        return (
                            <div style={{marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
                                <button type="button"
                                    onClick={() => { this.setState({showArt: false}); this.compile(); }}
                                    disabled={this.state.busy || unassigned > 0 || !this.activeCode().trim()}
                                    title={unassigned > 0 ?
                                        this.L.applyTitle(unassigned) :
                                        this.L.applyReady}
                                    style={{...btn, background: unassigned > 0 ?
                                        '#cbd5e1' : 'linear-gradient(135deg,#3aa76d,#2d8a58)'}}>
                                    {this.L.apply}
                                </button>
                                <button type="button" onClick={() => this.setState({showArt: false})}
                                    title={this.L.doneTitle}
                                    style={{...btn, background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1'}}>
                                    {this.L.done}
                                </button>
                                {unassigned > 0 && (
                                    <span style={{fontSize: 12, color: '#b45309'}}>
                                        {this.L.needSprite(unassigned)}
                                    </span>
                                )}
                            </div>
                        );
                    })()}
                </div>
                )}

                {this.state.spike3Log && this.state.spike3Log.length ? (
                    <div data-testid="bw-spike3-console" role="log" aria-label={this.L.spike3Console}
                        style={{marginTop: 6, maxHeight: 140, overflowY: 'auto', flexShrink: 0, padding: '4px 8px',
                            background: '#101820', color: '#e6edf3', borderRadius: 6,
                            font: '12px ui-monospace,SFMono-Regular,Menlo,monospace'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', color: '#8b98a5', marginBottom: 2}}>
                            <span>{this.L.spike3Console}</span>
                            <button type="button" onClick={() => this.setState({spike3Log: []})}
                                style={{background: 'none', border: 'none', color: '#8b98a5', cursor: 'pointer', padding: 0}}>
                                {this.L.spike3Clear}
                            </button>
                        </div>
                        {this.state.spike3Log.map((entry, i) => (
                            <div key={i} data-kind={entry.kind} style={{whiteSpace: 'pre-wrap',
                                color: entry.kind === 'err' ? '#ff8787' : entry.kind === 'note' ? '#ffd43b' : '#e6edf3'}}>
                                {entry.text}
                            </div>
                        ))}
                    </div>
                ) : null}

                {/* VDU terminal for BBC BASIC — renders DRAW/MOVE/PLOT graphics */}
                {this.state.basicIsBbc && this.state.basicRawOutput ? (
                    <React.Suspense fallback={null}>
                        <VduTerminal output={this.state.basicRawOutput} resetKey={this.state.basicOutputRunId} />
                    </React.Suspense>
                ) : null}
                {this.state.crispBasicActive && this.state.basicInputMethod ? (
                    <form onSubmit={event => this.sendCrispBasicInput(event)}
                        style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '8px 0'}}
                        data-testid="bw-crispbasic-input-form">
                        <label style={{display: 'flex', alignItems: 'center', gap: 8}}>
                            {this.state.basicInputMethod === 'key' ? this.L.basicInputKey : this.L.basicInputLine}
                            <input type="text" value={this.state.basicInputValue}
                                maxLength={this.state.basicInputMethod === 'key' ? 1 : 4096}
                                onChange={event => this.setState({basicInputValue: event.target.value, basicInputError: ''})}
                                autoComplete="off" spellCheck={false} data-testid="bw-crispbasic-input" />
                        </label>
                        <button type="submit" data-testid="bw-crispbasic-send">{this.L.basicInputSend}</button>
                        <button type="button" onClick={() => this.endCrispBasicInput()}
                            data-testid="bw-crispbasic-end-input">{this.L.basicInputEnd}</button>
                        {this.state.basicInputError ? <span role="alert" style={{color: '#b91c1c'}}>{this.state.basicInputError}</span> : null}
                    </form>
                ) : null}
                {this.state.lang === 'basic' && this.state.basicDiagnostic ? (
                    <div role="alert" style={{padding: '8px 12px', color: '#991b1b', background: '#fef2f2',
                        border: '1px solid #fecaca', borderRadius: 6, overflowWrap: 'anywhere'}}
                        data-testid="bw-crispbasic-diagnostic">
                        {this.state.basicDiagnostic.message}
                    </div>
                ) : null}
                {this.state.output != null ? (
                    <pre data-testid={['basic', 'fe', 'tcl'].includes(this.state.lang) ? `bw-${this.state.lang}-output` : 'bw-code-output'}
                        style={{marginTop: 10, padding: 12, background: '#0c3a44', color: '#c7f0e0', borderRadius: 8,
                        fontFamily: 'monospace', fontSize: 13, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap'}}>
                        {this.state.output || '…'}
                    </pre>
                ) : null}
                {this.state.codeRunLabel ? (
                    <div role="status" style={{fontSize: 12, color: '#475569'}}>{this.state.codeRunLabel}</div>
                ) : null}
                {codeInput ? (
                    <form onSubmit={event => this.submitCodeInput(event, codeInput)} data-testid="bw-code-input"
                        style={{display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8}}>
                        <label htmlFor="bw-code-input-answer" style={{whiteSpace: 'pre-wrap', overflowWrap: 'anywhere'}}>
                            {codeInput.prompt || this.L.codeInput}
                        </label>
                        <input id="bw-code-input-answer" type="text" autoFocus autoComplete="off" maxLength={65536}
                            value={this.state.codeInputValue}
                            onChange={event => {
                                const value = event.target.value;
                                this.setState(state => state.codeInput === codeInput ? {codeInputValue: value} : null);
                            }} />
                        <button type="submit" style={actionBtn}>{this.L.codeInputSend}</button>
                        <button type="button" onClick={this._onStopCodeRun} style={actionBtn}>{this.L.stop}</button>
                    </form>
                ) : null}
                </React.Fragment>}
            </div>
        );
    }
}

PseudocodeImporter.propTypes = {
    onCp1CodeSlot: PropTypes.func,
    onCardiacCodeSlot: PropTypes.func,
    onCardiacToolsSlot: PropTypes.func,
    vm: PropTypes.shape({loadProject: PropTypes.func, toJSON: PropTypes.func}).isRequired,
    locale: PropTypes.string,
    // Whether this tab is the selected one. Gates the CodeMirror chunk and the
    // example sources; see the comment above CMEditor. Defaults to visible so a
    // host that does not manage tabs gets the full editor.
    isVisible: PropTypes.bool,
    pendingBundleDetail: PropTypes.shape({}),
    onPendingBundleHandled: PropTypes.func,
    onReady: PropTypes.func,
    // Injected by connect() with no mapDispatchToProps. Declared so the refusal
    // alert is not a silent prop-types warning in development.
    dispatch: PropTypes.func
};

PseudocodeImporter.defaultProps = {
    isVisible: true,
    pendingBundleDetail: null,
    onPendingBundleHandled: () => {},
    onReady: () => {}
};

export default connect(state => ({
    vm: state.scratchGui.vm,
    locale: state.locales && state.locales.locale
}))(PseudocodeImporter);
