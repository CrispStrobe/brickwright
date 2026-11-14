// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Sim Lab (beta): a LEGO model built from real parts, simulated with
// physics, driven by the virtual SPIKE hub that every programming route
// already talks to (docs/SIM-LAB-PLAN.md). This pane only loads a model,
// runs the clock and shows the 3D view; everything else is in lib/bw-sim,
// reached through ONE dynamic import so the first load does not grow.
//
// One clock (docs/SPIKE-ARENA.md): while the Sim Lab runs, its session owns
// the hub's motor clock; the arena is not mounted at the same time (the
// simulator pane shows one or the other). And the program's clock is the
// world's (docs/SIM-LAB-PLAN.md §4.9, lib/bw-sim/sim-clock.js): while it runs,
// each VM step buys one step of simulated time and the VM waits for the world,
// so a slow machine runs the whole program slower (the status line shows the
// real-time factor) instead of letting the program's `wait`s outrun the world.
//
// The model is saved with the project (C8) the way every other Brickwright
// surface is (lib/bw-project-bundle.js): one localStorage key, carried as the
// bundle's `simLab` section. On `bw-project-bundle-collect` the pane writes
// the model it shows; on mount and on `bw-project-bundle-loaded` it opens the
// stored one. While the pane is not mounted the key simply keeps what the
// project load put there, so nothing is lost and nothing is pending.

import React from 'react';
import SimLabNotice from './sim-lab-notice.jsx';
import paneStyles from './sim-lab-pane.css';
import {connect} from 'react-redux';
import {setProjectTitle} from '../../reducers/project-title';
import {pickLocale, browserLocale} from '../../lib/bw-i18n.js';
import {activateUndoSurface, getUndoState, notifyUndoState, registerUndoSurface} from '../../lib/global-undo.js';
import {SIM_LAB_STORAGE_KEY, simLabRecordFromText, readSimLabStorage, isStorableName} from '../../lib/bw-sim/model/sim-lab-persist.js';
import SimLabPalette from './sim-lab-palette.jsx';
import SimLabInfo from './sim-lab-info.jsx';
import SimLabReadings from './sim-lab-readings.jsx';
import SimLabConnections from './sim-lab-connections.jsx';
import SimLabBrickButtons from './sim-lab-brick-buttons.jsx';
import SimLabMeasurements, {measurementWords} from './sim-lab-measurements.jsx';
import {measurementDefinitions} from '../../lib/bw-sim/measurements/schema.js';
import {CONTROL_PAIR_SCHEMA, restoreControlPair} from '../../lib/bw-sim/measurements/control-pairs.js';
import {createMeasurementRecorder} from '../../lib/bw-sim/measurements/recording.js';
import {measurementModelContext} from '../../lib/bw-sim/measurements/model-context.js';
import {refuseSimLabSave, clearSimLabSaveFailure, simLabSaveFailure} from '../../lib/bw-sim/model/sim-lab-save-state.js';
import {measurementJointBound} from '../../lib/bw-sim/measurements/readings.js';
import {teachingMeasurementPreset} from '../../lib/bw-sim/measurements/teaching-presets.js';
import SimLabStats from './sim-lab-stats.jsx';
import SimLabChallenges from './sim-lab-challenges.jsx';
import SimLabInstructions from './sim-lab-instructions.jsx';
import SimLabExamples from './sim-lab-examples.jsx';
import SimLabLesson from './sim-lab-lesson.jsx';
import {INSIGHT_TEXT, issueSentence, fillText} from './sim-lab-insight-text.js';
import {firmwareRefusalSentence} from './sim-lab-firmware-text.js';
import {EDITOR_TEXT} from './sim-lab-editor-text.js';
import SimLabProperties from './sim-lab-properties.jsx';
import SimLabShortcuts from './sim-lab-shortcuts.jsx';
import SimLabCoach from './sim-lab-coach.jsx';
import SimLabMotorMixer, {MIXER_OPEN_KEY} from './sim-lab-motor-mixer.jsx';
import {setMixerMotorPower, setMixerMotorJog, manualDriveAllowed} from './sim-lab-motor-control.js';
import {createManualPolicyResolver} from './sim-lab-manual-policy.js';
import PaneDivider from '../gui/pane-divider.jsx';
import {Icon, Popup, Separator, ToolButton, splitToolbar, toolStyles, tooltipOf} from './sim-lab-toolbar.jsx';
import {TOOLBAR_TEXT} from './sim-lab-toolbar-text.js';
import {sharedSpikeHubState} from '../../lib/virtual-hub/shared-spike-hub.js';
import {ROBOT_LAB_EVENTS} from '../../lib/robot-lab-events.js';
import {notifyEditorMenuActions, registerEditorMenuActions} from '../../lib/editor-menu-actions.js';

/**
 * The LEGO extensions that program a radio hub (hub `protocol`, bw-sim/hubs/lwp3 and hubs/wedo2), in the
 * order Run looks for them: the bundled unified ones first, then scratch-vm's own.
 */
const HUB_EXTENSIONS = Object.freeze({
    lwp3: Object.freeze(['legopoweredup', 'legoboostunified', 'boost']),
    wedo2: Object.freeze(['wedo2unified', 'wedo2'])
});

/** A MODELS entry's key: its `id` when one model file is listed more than once, else its file. */
const modelKey = m => m.id || m.file;

const TEXT = {
    en: {
        model: 'Model', importHelp: 'Open a model: LDraw (.ldr, .mpd), BrickLink Studio (.io), LEGO Digital Designer (.lxf) or LeoCAD (.lcd)', loading: 'Loading the model and the physics engine…', ready: 'Ready', running: 'Running', paused: 'Paused',
        failed: 'Could not load the model: {error}', physicsFailed: 'The physics stopped: {error}. Press Reset to start again.', noWebgl: 'This browser cannot show the 3D view ({error}). The simulation still runs.',
        connectFailed: 'Could not connect the program to the virtual hub: {error}',
        noProgram: 'No SPIKE program is loaded yet, so nothing tells the motors to turn. Write one in the Code tab and press ⇦ To blocks (or build it with blocks), then press Run — or drive the robot with the arrows below.',
        example: 'Load example program', exampleOffer: 'Choose an example to load its model and program, then press Run.',
        exampleLoaded: 'The example program is in the Code tab now. Press Run.',
        exampleGoal: {
            'line-follower.bw': 'The example program is in the Code tab now. Press Run and watch the robot follow the black line.',
            'wall-stopper.bw': 'The example program is in the Code tab now. Press Run and watch the robot stop before the wall. Challenge: make it stop 20 cm away.',
            'colour-explorer.bw': 'The example program is in the Code tab now. Press Run and watch the robot find the red square. Challenge: make it find the green one.',
            'sumo.bw': 'The example program is in the Code tab now. Press Run: the robot drives around and turns back whenever it sees the black ring. Challenge: make it turn the other way, or faster.',
            'rcx-bumper-car.nqc': 'The NQC program is in the NQC tab and in the Lab\'s RCX. Press Run: the robot drives to the wall, backs off when its bumper is pressed and turns away. Challenge: make it back off further.',
            'rcx-line-follower.nqc': 'The NQC program is in the NQC tab and in the Lab\'s RCX. Press Run and watch it follow the line\'s edge with its light sensor. Challenge: change THRESHOLD and see what happens.',
            'motor-bench.bw': 'The example program is in the Code tab now, in lab words: no hub, the Robot Lab turns the motor itself. Press Run. Challenge: make it turn back the other way.',
            'ev3-wall-stopper.bw': 'The example program is in the Code tab now, in EV3 words. Press Run: the program connects to the Lab\'s EV3 over Scratch Link and drives at the wall until its ultrasonic sensor sees it closer than 15 cm.',
            'nxt-bumper-bot.blocks.json': 'The NXT blocks are on the sprite now. Press Run: the program connects to the Lab\'s NXT over Scratch Link, turns both wheels once, then drives until the bumper touches the wall.',
            'technic-hub-bench.bw': 'The example program is in the Code tab now, in pup words: the LEGO Powered Up blocks. The blocks are loaded automatically. Press Run: the blocks connect to the Lab\'s Technic Hub and turn motor A one full turn. Challenge: make it turn three quarters.',
            'boost-rover.bw': 'The example program is in the Code tab now, in boost words: the LEGO BOOST blocks. The blocks are loaded automatically. Press Run: the Move Hub drives ahead with its motors A and B, then spins on the spot. Challenge: make it spin the other way.',
            'wedo-milo.bw': 'The example program is in the Code tab now, in wedo words: the LEGO WeDo 2.0 blocks. The blocks are loaded automatically. Press Run: the rover drives until its motion sensor sees the wall. Challenge: make it stop further away.',
            'crane.bw': 'The example program is in the Code tab now. Press Run: the crane lifts its boom, swings the hook a quarter turn, lets it down and swings back. Challenge: make it swing the other way.',
            'drawing-robot.bw': 'The example program is in the Code tab now. Press Run and watch a drawing robot draw a square: each corner turns fast, then slowly to 90°. Challenge: draw a triangle.'
        },
        noProgramLab: 'Nothing tells this motor to turn yet. Use the Robot Lab blocks (Add Extension) or lab words in the Code tab, press ⇦ To blocks, then press Run.',
        noProgramBt: 'No {brick} program is loaded yet, so nothing tells the motors to turn. Add the {brick} blocks (Add Extension) or load the example program, then press Run.',
        noProgramHub: 'No program for this hub is loaded yet. Add its blocks ({extensions}) or write pup, boost or wedo words in the Code tab, press ⇦ To blocks, then press Run.',
        exampleFailed: 'Could not load the example program: {error}',
        mat: 'Mat', drive: 'Drive', forward: 'Forward', back: 'Back', left: 'Left', right: 'Right', stop: 'Stop', speed: 'Speed',
        driveHelp: 'Hold an arrow (or use the arrow keys) to drive with motors A and B.', readout: 'Hub', air: 'Air',
        drawingPreview: 'Live drawing', issues: 'Notes about this model', time: 'Simulated time: {s} s', canvasLabel: '3D view of the simulated model',
        parts: 'Parts', saveHelp: 'Save the model as a file', port: 'Port', none: 'none',
        saveFormats: {ldr: 'LDraw (.ldr)', mpd: 'LDraw multi-part (.mpd)', io: 'BrickLink Studio (.io)'},
        fileFailed: 'Could not open {name}: {error}',
        fileErrors: {
            'io-encrypted': 'this BrickLink Studio file is password-protected (an older Studio made it). Open it in a current Studio and save it again, or export it there as LDraw (File › Export As).',
            'io-no-model': 'this BrickLink Studio file holds no LDraw model (model.ldr).',
            'not-a-zip': 'the file is damaged or not the kind its name says.',
            'model-too-big': 'the model inside the file is far too big for the Robot Lab.',
            'lxf-no-lxfml': 'this LEGO Digital Designer file holds no model (.LXFML).',
            'lxf-unreadable': 'this LEGO Digital Designer model could not be read.',
            'lxf-version': 'this LEGO Digital Designer file is from a version the Robot Lab cannot read (only LDD 4).',
            'lcd-unreadable': 'this LeoCAD project could not be read.',
            'lcd-version': 'this LeoCAD project is from a version the Robot Lab cannot read (LeoCAD 0.5 to 0.79 files only).',
            'unsupported-format': 'the Robot Lab opens .ldr, .mpd, .io, .lxf and .lcd files.'
        },
        instructionsHelp: 'Step-by-step building instructions for this robot, to build it from real LEGO® parts',
        search: 'Search parts', searchHint: 'Search: name or number', clearSearch: 'Clear the search', recent: 'Recently used',
        noMatches: 'No part matches “{q}”.', partTitle: '{name} · part {number}',
        paletteHelp: 'Click a part, then click in the view. Or drag it into the view.',
        helpBuild: 'How to build', helpParts: 'Placing parts',
        readingsTitle: 'Readings', readingsMotors: 'Motors', readingsSensors: 'Sensors', readingsEmpty: 'This model has no motors or sensors.',
        readingsMotor: 'Motor {port}', readingsSensor: '{kind} {port}', readingsClose: 'Close',
        challengesTitle: 'Challenges', challengeStart: 'Start', challengeRestart: 'Start again', challengeAgain: 'Try again',
        challengeOthers: 'All challenges', challengeReady: 'Press Run to begin.', challengeTime: '{s} s',
        challengeStars: '{n} of 3 stars', challengeBest: 'Best: {n} of 3 stars, {text}',
        challengeMeasure: {time: '{v} s', gap: '{v} cm to the wall', overshoot: '{v} cm past the edge', shape: '{v} % off a square'},
        challengeWhy: {offTrack: 'The robot left the line.', touched: 'The robot touched the wall.',
            leftRing: 'The robot left the ring.', timeUp: 'Time is up.'},
        challenges: {
            'oval-lap': {title: 'One lap', goal: 'Follow the line once around the oval.'},
            'wall-stop': {title: 'Stop at the wall', goal: 'Drive at the wall and stop close to it without touching it.'},
            'sumo-stay': {title: 'Stay in the ring', goal: 'Keep the robot inside the ring for 30 seconds.'},
            'maze-goal': {title: 'Through the maze', goal: 'Find the way to the green square.'},
            'zones-tour': {title: 'Four corners', goal: 'Drive into all four coloured corners, in any order.'},
            'draw-square': {title: 'Draw a square', goal: 'Mark a part "Draws on the floor" and drive a square: the squarer, the more stars.'}
        },
        kinds: {distance: 'Distance', color: 'Colour', force: 'Force', touch: 'Touch', light: 'Light', rotation: 'Rotation', tilt: 'Tilt', motion: 'Motion'},
        replay: 'Replay', replayHelp: 'Look back at the last seconds. Run goes on from now.', replayNow: 'now', speedValue: '{n}×',
        catalogueOpen: 'Add a part from the LDraw catalogue', catalogueTitle: 'LDraw catalogue', catalogueBack: 'Back to the parts',
        catalogueHint: 'Number or name, e.g. 3001, slope 45', catalogueLoading: 'Loading the catalogue…',
        catalogueUnavailable: 'The LDraw catalogue could not be loaded ({error}). It needs a network connection.',
        catalogueAbout: 'Search all {total} LDraw parts. Added parts stay on this device.',
        catalogueCount: '{shown} of {total} parts', catalogueAdd: 'Add', catalogueAdding: 'Adding…', catalogueHave: 'Added',
        catalogueAdded: '{name} added. Click in the view to place it.',
        catalogueDecoration: '{name} added as decoration: it does not connect ({why}).',
        catalogueFailed: '{part} could not be added: {error}',
        catalogueCredits: 'Credits for the {n} parts you added',
        myParts: 'My parts', catalogueRemove: 'Remove {name} from my parts', catalogueRemoved: '{name} removed.',
        catalogueInUse: '{name} is in this model: delete it from the model first.',
        catalogueCredit: 'Parts: LDraw.org Parts Library, CC BY.',
        selectedOne: 'Selected: {name}', selectedMany: 'Selected: {n} parts',
        timeShort: '{s} s',
        partsToggle: 'Show or hide the parts', infoToggle: 'Show or hide the whole note',
        route: 'Program', routeScratch: 'SPIKE blocks', routeFirmware: 'SPIKE firmware (desktop)',
        rcxTarget: 'RCX downloads go to', rcxTargetTower: 'IR tower (a real RCX)', rcxTargetLab: 'Robot Lab RCX',
        rcxNoProgram: 'The RCX has no program yet. Load the example, or choose "Robot Lab RCX" and send one from the NQC tab or the RCX blocks.',
        rcxFailed: 'The RCX program could not be loaded: {error}',
        routeUnavailable: 'Not available: this build has no managed Renode runtime with lockstep.',
        realTime: '{f}× real time', firmwareFailed: 'Could not start the SPIKE firmware: {error}',
        stopping: 'Stopping the program…',
        firmwareReloading: 'The program changed: starting the emulated hub again with the new program…',
        firmwareFault: 'The program on the SPIKE firmware stopped with an error ({error}). Press Run to start it again.',
        firmwareControlFailed: 'The SPIKE firmware did not take the command: {error}',
        st: {
            idle: 'Click a part to select it. Drag it to move it; Shift+click adds parts; drag empty space to look around.',
            hover: '{part}: click to select, drag to move', hoverSelected: '{part}: drag to move, R turns, Delete removes',
            placing: 'Placing {part}: click to place, R turns, Alt: no magnet, Esc stops',
            idleTouch: 'Tap a part to select it and drag it to move it. A long press adds parts. Drag empty space to look around, pinch to zoom; long-press empty space, then drag, to select with a box.',
            placingTouch: 'Placing {part}: tap where it goes, Turn ↻ turns it, Cancel stops',
            boxing: 'Now drag a box around the parts to select',
            dragging: 'Drag {part} into the view and let go to place it (Esc cancels)',
            snap: 'Snaps to {target} hole {hole}', snapNoHole: 'Snaps to {target}', snapped: 'Snapped to {target} hole {hole}', snappedNoHole: 'Snapped to {target}',
            floor: 'On the floor', onTop: 'On top of {target}', moving: 'Moving x {x}, y {y}, z {z} LDU (1 hole = 20)',
            turning: 'Turning {deg}° (hold Shift for 15° steps)', turned: 'Turned 90°', turnedAbout: 'Turned about its connection to {target}',
            grouped: '{n} parts grouped: clicking one selects all', ungrouped: 'Group taken apart',
            groupNeedsTwo: 'Select at least two parts to group them (Shift+click).', notGrouped: 'The selection is not in a group.',
            moved: 'Moved', placed: 'Placed {part}', selected: '{n} selected', deleted: 'Deleted {n}', pasted: 'Added {n} copies', copied: 'Copied {n}',
            undone: 'Undone', redone: 'Redone',
            gizmoArrow: 'Drag the {color} arrow to move along {axis}', gizmoPlane: 'Drag the square to move in the {axis} plane',
            gizmoRing: 'Drag the {color} ring to turn (90° steps, Shift: 15°)', red: 'red', green: 'green', blue: 'blue',
            nothingSelected: 'Select a part first (click it).', clipboardEmpty: 'Nothing copied yet: select parts and press Ctrl+C.', noRoom: 'No free spot next to it: move the parts apart first.',
            nothingToUndo: 'Nothing to undo.', nothingToRedo: 'Nothing to redo.', invalid: 'That does not work here: {detail}',
            blocked: 'Would go into {target}: let go and it stays where it was',
            overlapMove: 'Not moved: it would go into {target}.', overlapPlace: 'Not placed: it would go into {target}.',
            overlapTurn: 'Not turned: it would go into {target}.'
        }
    },
    de: {
        model: 'Modell', importHelp: 'Ein Modell öffnen: LDraw (.ldr, .mpd), BrickLink Studio (.io), LEGO Digital Designer (.lxf) oder LeoCAD (.lcd)', loading: 'Modell und Physik-Engine werden geladen…', ready: 'Bereit', running: 'Läuft', paused: 'Pausiert',
        failed: 'Das Modell konnte nicht geladen werden: {error}', physicsFailed: 'Die Physik ist stehen geblieben: {error}. Mit Zurücksetzen geht es neu los.', noWebgl: 'Dieser Browser kann die 3D-Ansicht nicht zeigen ({error}). Die Simulation läuft trotzdem.',
        connectFailed: 'Das Programm konnte nicht mit dem virtuellen Hub verbunden werden: {error}',
        noProgram: 'Es ist noch kein SPIKE-Programm geladen, darum dreht sich kein Motor. Schreibe eins im Code-Tab und drücke ⇦ Zu Blöcken (oder baue es aus Blöcken), dann Start — oder fahre den Roboter mit den Pfeilen unten.',
        example: 'Beispielprogramm laden', exampleOffer: 'Wähle ein Beispiel, um Modell und Programm zu laden. Drücke dann Start.',
        exampleLoaded: 'Das Beispielprogramm steht jetzt im Code-Tab. Drücke Start.',
        exampleGoal: {
            'line-follower.bw': 'Das Beispielprogramm steht jetzt im Code-Tab. Drücke Start und schau zu, wie der Roboter der schwarzen Linie folgt.',
            'wall-stopper.bw': 'Das Beispielprogramm steht jetzt im Code-Tab. Drücke Start und schau zu, wie der Roboter vor der Wand anhält. Aufgabe: Lass ihn 20 cm vor der Wand anhalten.',
            'colour-explorer.bw': 'Das Beispielprogramm steht jetzt im Code-Tab. Drücke Start und schau zu, wie der Roboter das rote Feld findet. Aufgabe: Lass ihn das grüne finden.',
            'sumo.bw': 'Das Beispielprogramm steht jetzt im Code-Tab. Drücke Start: Der Roboter fährt herum und kehrt um, sobald er den schwarzen Ring sieht. Aufgabe: Lass ihn andersherum oder schneller drehen.',
            'rcx-bumper-car.nqc': 'Das NQC-Programm steht jetzt im NQC-Tab und im RCX des Labors. Drücke Start: Der Roboter fährt zur Wand, setzt zurück, sobald sein Stoßfänger gedrückt wird, und dreht ab. Aufgabe: Lass ihn weiter zurücksetzen.',
            'rcx-line-follower.nqc': 'Das NQC-Programm steht jetzt im NQC-Tab und im RCX des Labors. Drücke Start und schau zu, wie er mit dem Lichtsensor dem Rand der Linie folgt. Aufgabe: Ändere THRESHOLD und schau, was passiert.',
            'motor-bench.bw': 'Das Beispielprogramm steht jetzt im Code-Tab, in lab-Wörtern: ohne Hub dreht das Robot Lab den Motor selbst. Drücke Start. Aufgabe: Lass ihn wieder zurückdrehen.',
            'ev3-wall-stopper.bw': 'Das Beispielprogramm steht jetzt im Code-Tab, in EV3-Wörtern. Drücke Start: Das Programm verbindet sich über Scratch Link mit dem EV3 des Labors und fährt auf die Wand zu, bis sein Ultraschallsensor sie näher als 15 cm sieht.',
            'nxt-bumper-bot.blocks.json': 'Die NXT-Blöcke sind jetzt bei der Figur. Drücke Start: Das Programm verbindet sich über Scratch Link mit dem NXT des Labors, dreht beide Räder einmal und fährt dann, bis der Stoßfänger die Wand berührt.',
            'technic-hub-bench.bw': 'Das Beispielprogramm steht jetzt im Code-Tab, in pup-Wörtern: die Blöcke von LEGO Powered Up. Die Blöcke werden automatisch geladen. Drücke Start: Die Blöcke verbinden sich mit dem Technic-Hub des Labors und drehen Motor A einmal ganz herum. Aufgabe: Lass ihn eine Dreivierteldrehung machen.',
            'boost-rover.bw': 'Das Beispielprogramm steht jetzt im Code-Tab, in boost-Wörtern: die Blöcke von LEGO BOOST. Die Blöcke werden automatisch geladen. Drücke Start: Der Move Hub fährt mit seinen Motoren A und B geradeaus und dreht sich dann auf der Stelle. Aufgabe: Lass ihn andersherum drehen.',
            'wedo-milo.bw': 'Das Beispielprogramm steht jetzt im Code-Tab, in wedo-Wörtern: die Blöcke von LEGO WeDo 2.0. Die Blöcke werden automatisch geladen. Drücke Start: Der Rover fährt, bis sein Bewegungssensor die Wand sieht. Aufgabe: Lass ihn weiter vorher anhalten.',
            'crane.bw': 'Das Beispielprogramm steht jetzt im Code-Tab. Drücke Start: Der Kran hebt seinen Ausleger, schwenkt den Haken eine Vierteldrehung, lässt ihn ab und schwenkt zurück. Aufgabe: Lass ihn in die andere Richtung schwenken.',
            'drawing-robot.bw': 'Das Beispielprogramm steht jetzt im Code-Tab. Drücke Start und sieh zu, wie der Malroboter ein Quadrat malt: Jede Ecke dreht er erst schnell, dann langsam bis 90°. Aufgabe: Mal ein Dreieck.'
        },
        noProgramLab: 'Noch sagt dem Motor niemand, dass er sich drehen soll. Nimm die Robot-Lab-Blöcke (Erweiterung hinzufügen) oder lab-Wörter im Code-Tab, drücke ⇦ Zu Blöcken und dann Start.',
        noProgramBt: 'Es ist noch kein {brick}-Programm geladen, darum dreht sich kein Motor. Füge die {brick}-Blöcke hinzu (Erweiterung hinzufügen) oder lade das Beispielprogramm, dann drücke Start.',
        noProgramHub: 'Für diesen Hub ist noch kein Programm geladen. Füge seine Blöcke hinzu ({extensions}) oder schreibe pup-, boost- oder wedo-Wörter im Code-Tab, drücke ⇦ Zu Blöcken und dann Start.',
        exampleFailed: 'Das Beispielprogramm konnte nicht geladen werden: {error}',
        mat: 'Matte', drive: 'Fahren', forward: 'Vorwärts', back: 'Rückwärts', left: 'Links', right: 'Rechts', stop: 'Stopp', speed: 'Tempo',
        driveHelp: 'Halte einen Pfeil gedrückt (oder nutze die Pfeiltasten), um mit den Motoren A und B zu fahren.', readout: 'Hub', air: 'Luft',
        drawingPreview: 'Live-Zeichnung', issues: 'Hinweise zu diesem Modell', time: 'Simulierte Zeit: {s} s', canvasLabel: '3D-Ansicht des simulierten Modells',
        parts: 'Teile', saveHelp: 'Das Modell als Datei speichern', port: 'Port', none: 'keiner',
        saveFormats: {ldr: 'LDraw (.ldr)', mpd: 'LDraw mehrteilig (.mpd)', io: 'BrickLink Studio (.io)'},
        fileFailed: '{name} konnte nicht geöffnet werden: {error}',
        fileErrors: {
            'io-encrypted': 'Diese BrickLink-Studio-Datei ist mit einem Passwort geschützt (von einer älteren Studio-Version). Öffne sie in einem aktuellen Studio und speichere sie neu, oder exportiere sie dort als LDraw (Datei › Exportieren als).',
            'io-no-model': 'Diese BrickLink-Studio-Datei enthält kein LDraw-Modell (model.ldr).',
            'not-a-zip': 'Die Datei ist beschädigt oder nicht das, was ihr Name sagt.',
            'model-too-big': 'Das Modell in der Datei ist viel zu groß für das Roboter-Labor.',
            'lxf-no-lxfml': 'Diese LEGO-Digital-Designer-Datei enthält kein Modell (.LXFML).',
            'lxf-unreadable': 'Dieses LEGO-Digital-Designer-Modell konnte nicht gelesen werden.',
            'lxf-version': 'Diese LEGO-Digital-Designer-Datei stammt aus einer Version, die das Roboter-Labor nicht lesen kann (nur LDD 4).',
            'lcd-unreadable': 'Dieses LeoCAD-Projekt konnte nicht gelesen werden.',
            'lcd-version': 'Dieses LeoCAD-Projekt stammt aus einer Version, die das Roboter-Labor nicht lesen kann (nur Dateien von LeoCAD 0.5 bis 0.79).',
            'unsupported-format': 'Das Roboter-Labor öffnet .ldr-, .mpd-, .io-, .lxf- und .lcd-Dateien.'
        },
        instructionsHelp: 'Bauanleitung für diesen Roboter, Schritt für Schritt, zum Nachbauen mit echten LEGO®-Teilen',
        search: 'Teile suchen', searchHint: 'Suche: Name oder Nummer', clearSearch: 'Suche löschen', recent: 'Zuletzt benutzt',
        noMatches: 'Kein Teil passt zu „{q}“.', partTitle: '{name} · Teil {number}',
        paletteHelp: 'Klicke ein Teil an, dann in die Ansicht. Oder zieh es in die Ansicht.',
        helpBuild: 'So baust du', helpParts: 'Teile platzieren',
        readingsTitle: 'Messwerte', readingsMotors: 'Motoren', readingsSensors: 'Sensoren', readingsEmpty: 'Dieses Modell hat keine Motoren oder Sensoren.',
        readingsMotor: 'Motor {port}', readingsSensor: '{kind} {port}', readingsClose: 'Schließen',
        challengesTitle: 'Aufgaben', challengeStart: 'Starten', challengeRestart: 'Neu starten', challengeAgain: 'Nochmal',
        challengeOthers: 'Alle Aufgaben', challengeReady: 'Drücke Start, um zu beginnen.', challengeTime: '{s} s',
        challengeStars: '{n} von 3 Sternen', challengeBest: 'Bestes: {n} von 3 Sternen, {text}',
        challengeMeasure: {time: '{v} s', gap: '{v} cm bis zur Wand', overshoot: '{v} cm über den Rand', shape: '{v} % neben einem Quadrat'},
        challengeWhy: {offTrack: 'Der Roboter hat die Linie verlassen.', touched: 'Der Roboter hat die Wand berührt.',
            leftRing: 'Der Roboter hat den Ring verlassen.', timeUp: 'Die Zeit ist um.'},
        challenges: {
            'oval-lap': {title: 'Eine Runde', goal: 'Folge der Linie einmal um das Oval.'},
            'wall-stop': {title: 'Halt an der Wand', goal: 'Fahre auf die Wand zu und halte dicht davor, ohne sie zu berühren.'},
            'sumo-stay': {title: 'Im Ring bleiben', goal: 'Halte den Roboter 30 Sekunden lang im Ring.'},
            'maze-goal': {title: 'Durchs Labyrinth', goal: 'Finde den Weg zum grünen Feld.'},
            'zones-tour': {title: 'Vier Ecken', goal: 'Fahre in alle vier farbigen Ecken, in beliebiger Reihenfolge.'},
            'draw-square': {title: 'Zeichne ein Quadrat', goal: 'Markiere ein Teil „Malt auf den Boden“ und fahre ein Quadrat: Je quadratischer, desto mehr Sterne.'}
        },
        kinds: {distance: 'Abstand', color: 'Farbe', force: 'Kraft', touch: 'Berührung', light: 'Licht', rotation: 'Drehung', tilt: 'Neigung', motion: 'Bewegung'},
        replay: 'Wiederholung', replayHelp: 'Auf die letzten Sekunden zurückschauen. Start geht ab jetzt weiter.', replayNow: 'jetzt', speedValue: '{n}×',
        catalogueOpen: 'Ein Teil aus dem LDraw-Katalog hinzufügen', catalogueTitle: 'LDraw-Katalog', catalogueBack: 'Zurück zu den Teilen',
        catalogueHint: 'Nummer oder Name, z. B. 3001, slope 45', catalogueLoading: 'Katalog wird geladen…',
        catalogueUnavailable: 'Der LDraw-Katalog konnte nicht geladen werden ({error}). Er braucht eine Netzwerkverbindung.',
        catalogueAbout: 'Durchsuche alle {total} LDraw-Teile. Hinzugefügte Teile bleiben auf diesem Gerät.',
        catalogueCount: '{shown} von {total} Teilen', catalogueAdd: 'Hinzufügen', catalogueAdding: 'Wird hinzugefügt…', catalogueHave: 'Vorhanden',
        catalogueAdded: '{name} hinzugefügt. Klicke in die Ansicht, um es zu platzieren.',
        catalogueDecoration: '{name} als Deko hinzugefügt: es verbindet sich nicht ({why}).',
        catalogueFailed: '{part} konnte nicht hinzugefügt werden: {error}',
        catalogueCredits: 'Credits für deine {n} hinzugefügten Teile',
        myParts: 'Meine Teile', catalogueRemove: '{name} aus meinen Teilen entfernen', catalogueRemoved: '{name} entfernt.',
        catalogueInUse: '{name} ist in diesem Modell: lösche es zuerst aus dem Modell.',
        catalogueCredit: 'Teile: LDraw.org Parts Library, CC BY.',
        selectedOne: 'Ausgewählt: {name}', selectedMany: 'Ausgewählt: {n} Teile',
        timeShort: '{s} s',
        partsToggle: 'Teile zeigen oder ausblenden', infoToggle: 'Den ganzen Hinweis zeigen oder einklappen',
        route: 'Programm', routeScratch: 'SPIKE-Blöcke', routeFirmware: 'SPIKE-Firmware (Desktop)',
        rcxTarget: 'RCX-Übertragung an', rcxTargetTower: 'IR-Tower (ein echter RCX)', rcxTargetLab: 'Robot-Lab-RCX',
        rcxNoProgram: 'Der RCX hat noch kein Programm. Lade das Beispiel, oder wähle „Robot-Lab-RCX“ und übertrage eines aus dem NQC-Tab oder mit den RCX-Blöcken.',
        rcxFailed: 'Das RCX-Programm konnte nicht geladen werden: {error}',
        routeUnavailable: 'Nicht verfügbar: Dieser Build hat keine verwaltete Renode-Laufzeit mit Lockstep.',
        realTime: '{f}× Echtzeit', firmwareFailed: 'Die SPIKE-Firmware konnte nicht starten: {error}',
        stopping: 'Das Programm hält an…',
        firmwareReloading: 'Das Programm hat sich geändert: Der emulierte Hub startet neu mit dem neuen Programm…',
        firmwareFault: 'Das Programm auf der SPIKE-Firmware hat mit einem Fehler angehalten ({error}). Drücke Ausführen, um es neu zu starten.',
        firmwareControlFailed: 'Die SPIKE-Firmware hat den Befehl nicht angenommen: {error}',
        st: {
            idle: 'Klicke ein Teil an, um es auszuwählen. Ziehen verschiebt es; Umschalt+Klick wählt mehr Teile; Ziehen auf leerer Fläche dreht die Ansicht.',
            hover: '{part}: klicken wählt aus, ziehen verschiebt', hoverSelected: '{part}: ziehen verschiebt, R dreht, Entf löscht',
            placing: '{part} platzieren: klicken setzt, R dreht, Alt: ohne Magnet, Esc beendet',
            idleTouch: 'Tippe ein Teil an, um es auszuwählen, und zieh es, um es zu verschieben. Lange drücken wählt mehr Teile. Ziehen auf leerer Fläche dreht die Ansicht, zwei Finger zoomen; lange auf leere Fläche drücken und ziehen wählt mit einem Rahmen.',
            placingTouch: '{part} platzieren: tippe, wo es hin soll, Drehen ↻ dreht es, Abbrechen beendet',
            boxing: 'Zieh jetzt einen Rahmen um die Teile, die du auswählen willst',
            dragging: 'Zieh {part} in die Ansicht und lass los, um es zu setzen (Esc bricht ab)',
            snap: 'Rastet an {target} Loch {hole} ein', snapNoHole: 'Rastet an {target} ein', snapped: 'An {target} Loch {hole} eingerastet', snappedNoHole: 'An {target} eingerastet',
            floor: 'Auf dem Boden', onTop: 'Oben auf {target}', moving: 'Verschieben x {x}, y {y}, z {z} LDU (1 Loch = 20)',
            turning: 'Drehen {deg}° (Umschalt halten: 15°-Schritte)', turned: 'Um 90° gedreht', turnedAbout: 'Um die Verbindung zu {target} gedreht',
            grouped: '{n} Teile gruppiert: ein Klick wählt alle', ungrouped: 'Gruppe aufgelöst',
            groupNeedsTwo: 'Wähle mindestens zwei Teile aus, um sie zu gruppieren (Umschalt+Klick).', notGrouped: 'Die Auswahl ist in keiner Gruppe.',
            moved: 'Verschoben', placed: '{part} gesetzt', selected: '{n} ausgewählt', deleted: '{n} gelöscht', pasted: '{n} Kopien eingefügt', copied: '{n} kopiert',
            undone: 'Rückgängig gemacht', redone: 'Wiederhergestellt',
            gizmoArrow: 'Ziehe den {color} Pfeil, um entlang {axis} zu schieben', gizmoPlane: 'Ziehe das Quadrat, um in der {axis}-Ebene zu schieben',
            gizmoRing: 'Ziehe den {color} Ring zum Drehen (90°-Schritte, Umschalt: 15°)', red: 'roten', green: 'grünen', blue: 'blauen',
            nothingSelected: 'Wähle zuerst ein Teil aus (anklicken).', clipboardEmpty: 'Noch nichts kopiert: Teile auswählen und Strg+C drücken.', noRoom: 'Kein freier Platz daneben: rück die Teile erst auseinander.',
            nothingToUndo: 'Nichts rückgängig zu machen.', nothingToRedo: 'Nichts zu wiederholen.', invalid: 'Das geht hier nicht: {detail}',
            blocked: 'Würde in {target} hineinragen: loslassen lässt es, wo es war',
            overlapMove: 'Nicht verschoben: Es würde in {target} hineinragen.', overlapPlace: 'Nicht gesetzt: Es würde in {target} hineinragen.',
            overlapTurn: 'Nicht gedreht: Es würde in {target} hineinragen.'
        }
    }
};

/**
 * Longest step the pane hands the physics per frame, on the paths that tick by wall time (the
 * firmware route, or a VM whose step hook is inert): a backgrounded tab must not jump seconds ahead.
 */
const MAX_FRAME_MS = 50;
/** Replay (Simulate, paused): the last 20 s of simulated time, a pose about every 33 ms of it. */
const REPLAY_MS = 20000;
const REPLAY_STEP_MS = 33;
/** Readings: 10 samples per simulated second, the last 10 s drawn. */
const READINGS_SAMPLES = 100;
/** A challenge is judged this often (simulated ms); its best results are kept on this device. */
const CHALLENGE_STEP_MS = 100;
const CHALLENGE_BEST_KEY = 'bw-sim-challenge-best';
const readBest = () => {
    try { return JSON.parse(localStorage.getItem(CHALLENGE_BEST_KEY) || '{}') || {}; } catch { return {}; }
};
/** The real-time factor is shown below this (a timer's jitter keeps a machine that keeps up near 1). */
const SHOW_RTF_BELOW = 0.95;
/** Build mode recompiles the model this long after the last edit (ms), for the issues and the motion overlay. */
const INSIGHT_DEBOUNCE_MS = 150;
/** How long "show me these parts" pulses them in Simulate (ms). */
const HIGHLIGHT_MS = 3000;
/**
 * What "Open…" accepts (lib/bw-sim/model/model-file.js OPEN_ACCEPT, kept here so the first load does not
 * pull the model readers in; test/bw-sim-model-file.test.mjs holds the two equal) and what "Save as…" offers.
 */
const OPEN_ACCEPT = '.ldr,.mpd,.io,.lxf,.lcd';
const SAVE_FORMATS = ['ldr', 'mpd', 'io'];
/** The `0 <title>` line every model the pane writes carries (it is not parsed back, so it must not vary). */
const MODEL_TITLE = 'Robot Lab model';
/**
 * Below this width of the PANE (not the window: the pane can be narrow inside a wide window)
 * the pane is compact: icon toolbars with a "More…" menu, the parts palette as a drawer over
 * the view, notes folded to one line, so the 3D view keeps most of the height.
 */
const COMPACT_BELOW_PX = 720;
/** Below this pane width the compact toolbars show glyphs only (a 1024 px tablet's side pane). */
const NARROW_BELOW_PX = 420;
/** From this pane width the properties panel stands beside the 3D view; narrower, it opens over the view's right edge. */
const DOCK_PROPERTIES_PX = 1280;
/** What is hidden in Build stays hidden for the browser session (view state, not the model). */
const HIDDEN_STORAGE_KEY = 'bw-sim-lab-hidden';
/** How Build's 3D view reads a scroll (camera-nav.js wheelIntent), kept in this browser. */
const WHEEL_STORAGE_KEY = 'bw-sim-lab-wheel-mode';
const MOUSE_PRESET_KEY = 'bw-sim-lab-mouse-preset';
/** Set once the coach marks were put away on this device (sim-lab-coach.jsx). */
const COACH_KEY = 'bw-sim-lab-coach-done';

/**
 * The GUI's show/hide-stage button (gui.jsx data-right-pane-toggle) floats over the editor's top
 * right corner; when the tab strip folds away (compact chrome) it sits on the toolbar's row, so the
 * toolbar keeps that corner free.
 */
const RIGHT_PANE_TOGGLE_PX = 36;
/** From this pane width the mode switch shows its words beside the icons. */
const MODE_WORDS_PX = 1200;
/** Never wider than this share of the pane, the parts panel (dragged by its divider). */
const MAX_PANEL_SHARE = 0.45;

class SimLabPane extends React.Component {
    constructor (props) {
        super(props);
        const locale = pickLocale(props.locale || browserLocale(), TEXT);
        this.locale = locale;
        this.text = TEXT[locale];
        this.itext = INSIGHT_TEXT[locale] || INSIGHT_TEXT.en;
        this.etext = EDITOR_TEXT[locale] || EDITOR_TEXT.en;
        this.ttext = TOOLBAR_TEXT[locale] || TOOLBAR_TEXT.en;
        // The project's hub (docs/ROBOT-LAB-ARCHITECTURE.md R1: the VirtualHub boundary): the one the
        // SPIKE arena shares (lib/virtual-hub/shared-spike-hub.js), unless a host hands one in.
        this.hub = props.hubState || sharedSpikeHubState();
        this.state = {status: 'loading', message: '', info: '', driveSpeed: 50, issues: [], modelFile: null, shipped: null, simMs: 0, rtf: null, view3d: 'loading',
            mode: 'simulate', placing: null, selection: [], editorTick: 0, mat: null,
            buildStatus: {kind: 'idle'}, gizmoMode: 'move', grid: 10, recent: [], thumbTick: 0,
            showPorts: true, showMotion: false, blockers: [], portPicker: null, instructions: null, coarse: false,
            controlsOpen: false, brickControlsOpen: false, connectionControlsOpen: false, manualOverride: false, programLoading: false,
            connection: {bricks: [], routes: [], hubId: null, route: 'bluetooth', status: 'idle', message: ''},
            mixerOpen: (() => { try { return localStorage.getItem(MIXER_OPEN_KEY) === '1'; } catch { return false; } })(), mixer: {session: null, power: {}},
            // Simulate: sensor rays, the Readings panel, slow motion, and the replay position (null: live)
            measurementsOpen: false, showMeasurements: false, measurementTick: 0, showSensors: false, readings: false, showStats: false, timeScale: 1, replayAt: null, replayFrames: 0, readingsTick: 0,
            examplesOpen: false, lessonKey: null, challengesOpen: false, challenge: null, challengeResult: null, challengeBest: readBest(),
            paneWidth: 0, menu: null, drawer: false, paletteDragging: false, infoOpen: false, route: 'scratch',
            paletteOpen: true, paletteShare: null, propsShare: null, propsDocked: true,
            hidden: [], editGroup: null, pick: null, measurement: null, placeColor: null, propsOpen: false, shortcuts: false,
            hold: null, announce: '', wheelMode: this.storedWheelMode(), mousePreset: this.storedMousePreset(), coach: null};
        this.root = React.createRef();
        this.viewWrap = React.createRef();
        this.box = React.createRef();
        this.file = React.createRef();
        this.lib = null;
        this.measurements = [];
        this.measurementModels = new Map();
        this.measurementRecording = createMeasurementRecorder();
        this.measurementContext = null;
        this.measurementExperiments = new Map();
        this.measurementSelection = null;
        this.measurementRevision = 0;
        this.measurementSaveError = null;
        this.measurementReader = null;
        this.measurementRows = [];
        this.measurementRowsTime = null;
        this.session = null;
        // Synchronous tokens also reject a second click before React has rendered the busy state.
        this.manualJogs = new Map();
        this.manualPolicy = null;
        this.manualPolicyResolver = null;
        this.view = null;
        this.frame = this.frame.bind(this);
        this.onBundleCollect = this.onBundleCollect.bind(this);
        this.onBundleLoaded = this.onBundleLoaded.bind(this);
        this.requestThumb = this.requestThumb.bind(this);
        this.openCatalogue = this.openCatalogue.bind(this);
        this.addCatalogPart = this.addCatalogPart.bind(this);
        this.cataloguePreview = this.cataloguePreview.bind(this);
        this.removeCatalogPart = this.removeCatalogPart.bind(this);
        this.armPart = this.armPart.bind(this);
        this.pressPart = this.pressPart.bind(this);
        this.onPointerKind = this.onPointerKind.bind(this);
        this.onOutsidePress = this.onOutsidePress.bind(this);
        /** Palette parts waiting for their picture (drawn a few per frame in `frame`). */
        this.thumbQueue = new Set();
        this.thumbs = null;
        this.last = null;
        /** The program clock (lib/bw-sim/sim-clock.js), made when the chunk is in; installed while running. */
        this.clock = null;
    }

    onPointerKind () {
        const coarse = Boolean(this.coarseQuery && this.coarseQuery.matches);
        if (coarse !== this.state.coarse) this.setState({coarse});
    }

    /** The pane's own width decides the layout (a ResizeObserver, so a dragged divider counts too). */
    measure (width) {
        const paneWidth = Math.round(width);
        if (paneWidth !== this.state.paneWidth) this.setState({paneWidth});
    }

    compact () {
        return this.state.paneWidth > 0 && this.state.paneWidth < COMPACT_BELOW_PX;
    }

    /** So narrow that even the compact toolbars drop their words. */
    narrow () {
        return this.state.paneWidth > 0 && this.state.paneWidth < NARROW_BELOW_PX;
    }

    /** A press outside the open pop-up (More, File, Help) closes it. */
    onOutsidePress (event) {
        const open = this.state.menu;
        if (!open) return;
        const inside = event.target && event.target.closest && event.target.closest(`[data-sim-lab-popup="${open}"]`);
        if (!inside) this.setState({menu: null});
    }

    toggleMenu (id) {
        this.setState(s => ({menu: s.menu === id ? null : id}));
    }

    /** A number as the learner's language writes it (German: decimal comma). */
    decimal (text) {
        return this.locale === 'de' ? String(text).replace('.', ',') : String(text);
    }

    t (key, values = {}) {
        return this.text[key].replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));
    }

    async componentDidMount () {
        this._menuMounted = true;
        this.unregisterMenu = registerEditorMenuActions('robots', () => this.editorMenuActions());
        this.onProgramStart = () => { if (this.state.manualOverride) this.setManualOverride(false); };
        this.props.vm?.runtime?.on('PROJECT_RUN_START', this.onProgramStart);
        window.__bwSimLab = {
            get status () { return this._pane.state.status; },
            get issues () { return this._pane.state.issues; },
            get snapshot () { return this._pane.session ? this._pane.session.snapshot() : null; },
            /** Whether the physics runs in the Web Worker (false: on the main thread, see workerError). */
            get worker () { return this._pane.session ? this._pane.session.worker : null; },
            get workerError () { return this._pane.session ? this._pane.session.workerError : null; },
            /** The hub state a scene drives (it owns that hub's clock: spike3-python-run.js leaves it alone), or null. */
            get hubState () { return this._pane.session ? this._pane.session.hubState : null; },
            get view3d () { return this._pane.state.view3d; },
            get mode () { return this._pane.state.mode; },
            get editor () { return this._pane.editor || null; },
            get editView () { return this._pane.editView || null; },
            get projectRecord () { return this._pane.currentRecord(); },
            get blockers () { return this._pane.state.blockers; },
            /** The firmware route's program on the emulated hub: its state name ('ready', 'running', …) or null. */
            get firmwareProgram () { return this._pane.firmware?.program?.stateName ?? null; },
            /** The last Build-mode compile for the issues and the overlay: {ms, parts}. */
            get insight () { return this._pane.lastInsight || null; },
            /** Build (docs/ROBOT-LAB-UX.md §5): the lit connectors [{partId, connectorId, active}], the candidate pose, the ghost's tone. */
            highlights () { return this._pane.editView ? this._pane.editView.debug.highlights() : []; },
            candidate () { return this._pane.editView ? this._pane.editView.debug.candidate() : null; },
            ghostTone () { return this._pane.editView ? this._pane.editView.debug.ghostTone() : null; },
            /** The Robot Lab API (lib/bw-sim/api/robot-lab-api.js), the object blocks reach as runtime.robotLab; null until the chunk is in. */
            get api () { return this._pane.api || null; },
            _pane: this
        };
        // The SPIKE arena stands aside while this session drives the shared hub (lib/robot-lab-events.js).
        window.dispatchEvent(new CustomEvent(ROBOT_LAB_EVENTS.owner, {detail: {active: true}}));
        window.addEventListener('bw-project-bundle-collect', this.onBundleCollect);
        window.addEventListener('bw-project-bundle-loaded', this.onBundleLoaded);
        // A tablet (a finger is the main pointer): bigger buttons and touch wording.
        this.coarseQuery = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
        if (this.coarseQuery && this.coarseQuery.addEventListener) this.coarseQuery.addEventListener('change', this.onPointerKind);
        this.onPointerKind();
        window.addEventListener('pointerdown', this.onOutsidePress, true);
        if (this.root.current) {
            this.measure(this.root.current.getBoundingClientRect().width);
            if (typeof ResizeObserver === 'function') {
                this.resizer = new ResizeObserver(entries => this.measure(entries[0].target.getBoundingClientRect().width));
                this.resizer.observe(this.root.current);
            }
        }
        try {
            this.lib = await import(/* webpackChunkName: "bw-sim-lab" */ '../../lib/bw-sim/sim-lab.js');
        } catch (error) {
            if (!this.disposed) this.setState({status: 'failed', message: this.t('failed', {error: error.message})});
            return;
        }
        if (this.disposed) return;
        this.registerRcxTarget();
        // The scene's radio hubs (LWP3: BOOST, Powered Up, Technic, SPIKE Essential; WeDo 2.0) as virtual BLE
        // peripherals, for the LEGO extensions to reach over Web Bluetooth or Scratch Link (virtual-hub/lab-ble-peripherals.js).
        this.unregisterBle = this.lib.registerRobotLabBlePeripherals(() => (this.session ? this.session.hubs.map(h => h.hub) : []));
        this.installApi();
        this.installConnections();
        this.raf = requestAnimationFrame(this.frame);
        await this.openStored();
    }

    /**
     * The Robot Lab API (docs/SIM-LAB.md "Steering the Lab") over this pane: blocks reach it as
     * `runtime.robotLab` (looked up at each call, the runtime.nqcCompile hook pattern), the gates
     * and the JS driver as window.__bwSimLab.api. It is ours while this pane is mounted.
     */
    installApi () {
        this.api = this.lib.createRobotLabApi({
            getSession: () => this.session,
            getStatus: () => this.state.status,
            listModels: () => this.lib.MODELS.map(m => ({id: modelKey(m).replace(/\.ldr$/i, ''), title: m.title})),
            loadModel: spec => this.apiLoadModel(spec),
            start: () => this.apiStart(),
            stop: () => this.apiStop(),
            reset: () => this.reset(),
            ensureRunning: () => this.apiEnsureRunning(),
            setTimeScale: scale => this.setSpeed(scale),
            camera: view => this.apiCamera(view),
            drawing: () => (this.view && this.view.penStrokes ? this.view.penStrokes() : []),
            locale: () => this.locale
        });
        const runtime = this.props.vm && this.props.vm.runtime;
        if (runtime) runtime.robotLab = this.api;
    }

    /** The coordinator captures the old scene/VM before any asynchronous provider work. */
    installConnections () {
        this.connections = this.lib.createLabConnectionCoordinator({
            getVM: () => this.props.vm,
            stopClock: () => this.stopClock(),
            stopProgram: (vm, scene, {preserveProgram = false} = {}) => {
                if (!scene || scene.lockstep || !scene.hubs.some(record => this.lib.labConnectionRoutes(scene, record).length)) return;
                const errors = [];
                // A loadModel block replaces its world while its calling script
                // continues. Its old motors and pending toolbar Run still retire.
                try { if (!preserveProgram) vm?.stopAll(); } catch (error) { errors.push(error); }
                // Queued provider stop writes may outlive cancellation. Retire
                // the actual old model motors now, while routes are tombstones.
                for (const {hub} of scene.hubs || []) {
                    if (typeof hub.directCommand !== 'function') continue;
                    try { hub.hubState?.backend?.cancel(); } catch (error) { errors.push(error); }
                    let ports = [];
                    try { ports = hub.motorPortIds?.() || []; } catch (error) { errors.push(error); }
                    for (const port of ports) {
                        try {
                            const result = hub.directCommand(port, {stop: 'brake'});
                            if (result?.ok === false) throw new Error(result.message || 'Could not stop a Lab motor');
                        } catch (error) { errors.push(error); }
                    }
                }
                if (errors.length) throw new AggregateError(errors, 'Could not stop the old Lab program');
            },
            prepareRun: (scene, vm) => new Promise(resolve => {
                if (this.disposed || this.session !== scene || this.props.vm !== vm) { resolve(); return; }
                this.setState({status: 'running', message: '', info: ''}, resolve);
            }),
            startClock: (scene, vm) => {
                if (!this.disposed && this.session === scene && this.props.vm === vm) this.startClock();
            },
            onState: connection => {
                if (!this.disposed) this.setState({connection, ...(connection.status === 'failed' ? {
                    status: 'paused', message: this.t('connectFailed', {error: connection.message})
                } : {})});
            },
            host: window, navigatorHost: navigator
        });
    }

    observeConnection (action, scene = this.session) {
        const observation = this.connectionObservation = {};
        const failed = error => {
            const errors = [error];
            const remember = () => {
                this.lastConnectionError = errors.length === 1 ? error : new AggregateError(errors,
                    errors.map(cause => cause.message || String(cause)).join('; '));
            };
            remember();
            if (!this.disposed && this.session === scene && this.connectionObservation === observation && error.name !== 'AbortError') {
                try { this.stopClock(); } catch (cleanupError) { errors.push(cleanupError); }
                remember();
                try {
                    this.setState({status: 'paused', message: this.t('connectFailed', {error: this.lastConnectionError.message})});
                } catch (publicationError) { errors.push(publicationError); remember(); }
            }
        };
        try { return Promise.resolve(action()).catch(failed); }
        catch (error) { failed(error); return Promise.resolve(); }
    }

    connectLegacy (vm, connect, isCurrent) {
        return this.lib.serializeLabLegacyConnection({vm, connect, isCurrent}).catch(error => {
            if (isCurrent() && this.lib.labProviderRetirementFailure(vm)) {
                // The ordinary Bluetooth connection-error fallback must not
                // start a script after provider retirement became uncertain.
                this.runConnection = null;
                this.observeConnection(() => Promise.reject(new AggregateError([error], error.message)));
            }
            throw error;
        });
    }

    connectConnection ({run = false} = {}) {
        return this.observeConnection(() => {
            const selected = this.connections.snapshot();
            const record = this.session?.hubs.find(brick => brick.id === selected.hubId);
            // Expose the native REPL while paused too: Connect never installs
            // the world clock or starts a program.
            if (record?.profile === 'spike-prime') record.hub.hubState.setSimulationEnabled(true);
            return run ? this.connections.run() : this.connections.connect();
        });
    }

    selectConnection (selection) {
        this.runConnection = null;
        this.stopClock();
        this.setState({status: 'paused'});
        this.observeConnection(() => this.connections.select(selection));
    }

    disconnectConnection () {
        this.runConnection = null;
        this.stopClock();
        this.setState({status: 'paused'});
        this.observeConnection(() => this.connections.disconnect());
    }

    /** loadModel from a block, a word or a call: a shipped model by id, or LDraw text. */
    async apiLoadModel (spec) {
        if (this.disposed || !this.lib) return {ok: false, code: 'no-model'};
        const entry = this.lib.MODELS.find(m => modelKey(m).replace(/\.ldr$/i, '') === spec);
        if (entry?.blocked) return {ok: false, code: 'experimental-blocked', message: entry.intro[this.locale] || entry.intro.en};
        if (this.state.status === 'running') this.apiStop();
        if (this.editor) {
            this.teardownEditor();
            this.setState({mode: 'simulate', placing: null, selection: []});
        }
        if (entry) await this.openShipped(modelKey(entry), {preserveProgram: true});
        else {
            this.lastText = spec;
            await this.openText(spec, 'my-model.ldr', null, {preserveProgram: true});
        }
        return {ok: Boolean(this.session), status: this.state.status, issues: this.state.issues.length};
    }

    /** start from a block: run the world (never the green flag: the program asking is already running). */
    async apiStart () {
        if (!this.session || this.state.status === 'running') return;
        // Resume an already connected virtual SPIKE world without admitting a
        // new provider. Reconnecting disconnects that hub and clears its holds.
        const virtual = this.hub.data;
        if (this.state.status === 'paused' && !this.session.lockstep && !this.state.manualOverride &&
            virtual.simulationEnabled && virtual.connected && this.spikeLoaded() &&
            !this.rcxHub() && !this.radioHub() && !this.btProfile() &&
            this.props.vm.getPeripheralIsConnected('spikeprime')) {
            this.startClock();
            this.setState({status: 'running'});
            return;
        }
        await this.run({greenFlag: false});
    }

    /** stop from a block: pause the world, leave the program running (it may start it again). */
    apiStop () {
        if (!this.session) return;
        this.connections?.pauseRun();
        if (this.session.lockstep) { this.pauseFirmware(); return; }
        this.stopClock();
        this.setState({status: 'paused'});
    }

    /** A motor was told to turn: the world runs, as when the drive pad's arrow is held. */
    apiEnsureRunning () {
        if (!this.session || this.session.lockstep || this.state.status === 'running') return;
        this.hub.setSimulationEnabled(true);
        this.startClock();
        this.setState({status: 'running'});
    }

    apiCamera (view) {
        const v = this.view;
        if (!v) return;
        if (view && typeof view === 'object') v.followPart?.(view.follow || null);
        else if (view === 'fit') v.fit();
        else v.view(view);
    }

    robotLabLoaded () {
        const vm = this.props.vm;
        return Boolean(vm && vm.extensionManager && vm.extensionManager.isExtensionLoaded('robotlab'));
    }

    /** The scene has a SPIKE hub (its drive pad and readout make sense); a hubless model runs on lab-direct. */
    spikeScene () {
        return Boolean(this.session && this.session.hubs && this.session.hubs.some(h => h.profile === 'spike-prime'));
    }

    /** The scene's radio hub (an LWP3 hub or the WeDo 2.0 hub: hubs/lwp3, hubs/wedo2), or null. */
    radioHub () {
        const h = this.session && this.session.hubs && this.session.hubs.find(x => x.hub && x.hub.protocol);
        return h ? h.hub : null;
    }

    /**
     * The LEGO extension of the Code tab's program that speaks to this hub, or null: the first of
     * HUB_EXTENSIONS whose blocks the project uses (an extension stays loaded after its blocks are
     * gone, so being loaded is not enough), else the first loaded.
     */
    hubExtension (hub = this.radioHub()) {
        const vm = this.props.vm;
        if (!hub || !vm || !vm.extensionManager) return null;
        const loaded = (HUB_EXTENSIONS[hub.protocol] || []).filter(id => vm.extensionManager.isExtensionLoaded(id));
        const used = id => (vm.runtime.targets || []).some(t => Object.values((t.blocks && t.blocks._blocks) || {})
            .some(b => typeof b.opcode === 'string' && b.opcode.startsWith(`${id}_`)));
        return loaded.find(used) || loaded[0] || null;
    }

    /**
     * Connect the program's LEGO extension to the scene's hub, exactly as a person would connect it to a
     * real one — the extension's own connect (its block's function), over whatever transport it is set to
     * (Web Bluetooth, Scratch Link) — with connectVirtualHub choosing this hub. scratch-vm's own boost and
     * wedo2 connect through the runtime's peripheral scan, as the connection dialog does.
     */
    async connectRadioHub (hub, id) {
        const vm = this.props.vm;
        const prim = name => vm.runtime._primitives[`${id}_${name}`];
        const stock = id === 'boost' || id === 'wedo2';
        const connected = () => Boolean(stock ? vm.getPeripheralIsConnected(id) : prim('isConnected')?.({}));
        await this.lib.connectVirtualHub({host: window, extensionId: id, hubState: hub, timeoutMs: 15000, connected,
            disconnect: () => (stock ? vm.disconnectPeripheral(id) : prim('disconnect')?.({})),
            connect: () => {
                if (!stock) return prim('connect')({});
                return new Promise(resolve => {
                    const onList = list => {
                        const first = Object.keys(list || {})[0];
                        if (!first) return;
                        vm.runtime.removeListener('PERIPHERAL_LIST_UPDATE', onList);
                        vm.connectPeripheral(id, first);
                        resolve();
                    };
                    vm.runtime.on('PERIPHERAL_LIST_UPDATE', onList);
                    vm.scanForPeripheral(id);
                });
            }});
    }

    /** Run for a radio hub: the program's extension connects to it, then the green flag. */
    async runRadioHub (hub, {greenFlag = true} = {}) {
        const vm = this.props.vm;
        this.stopClock();
        const session = this.session;
        const request = this.runConnection = {};
        const current = () => !this.disposed && this.props.vm === vm && this.session === session && this.runConnection === request &&
            this.state.status === 'running' && !this.state.manualOverride;
        // A fast virtual connection can resolve before React flushes setState.
        // Commit Run first; an intervening Stop or replacement still wins.
        await new Promise(resolve => this.setState({status: 'running'}, resolve));
        if (!current()) return;
        const id = this.hubExtension(hub);
        if (!id) {
            this.startClock();
            const none = this.t('noProgramHub', {extensions: (HUB_EXTENSIONS[hub.protocol] || []).join(', ')});
            this.setState({info: this.shippedModel()?.example ? `${none} ${this.text.exampleOffer}` : none});
            return;
        }
        this.setState({info: ''});
        try {
            await this.connectLegacy(vm, () => this.connectRadioHub(hub, id), current);
        } catch (error) {
            if (!current()) return;
            this.setState({message: this.t('connectFailed', {error: error.message})});
            return;
        }
        if (current()) {
            this.startClock();
            if (greenFlag) vm.greenFlag();
        }
    }

    componentDidUpdate (prevProps, prevState) {
        // The main menus reflect commands, selection and UI toggles, never the
        // physics frame/readings counters. Re-read guards at each menu click.
        const fields = ['mode', 'status', 'programLoading', 'editorTick', 'selection', 'placing',
            'gizmoMode', 'hidden', 'editGroup', 'pick', 'showPorts', 'showMotion', 'showSensors',
            'readings', 'measurementsOpen', 'showStats', 'challengesOpen', 'drawer', 'paletteOpen',
            'propsDocked', 'propsOpen', 'paneWidth', 'coarse', 'modelFile', 'view3d'];
        if (prevProps.isVisible !== this.props.isVisible || prevProps.locale !== this.props.locale ||
            fields.some(field => prevState[field] !== this.state[field])) notifyEditorMenuActions();
    }

    editorMenuActions () {
        // An arena dock can mount this component too. Only the explicitly
        // visible full Robot tab with the current undo surface owns commands.
        if (!this._menuMounted || this.props.isVisible !== true || getUndoState().surface !== 'robots') return null;
        const actions = {};
        const add = (item, location, submenu = '') => {
            if (!item || typeof item.run !== 'function' || item.id === 'undo' || item.id === 'redo') return;
            actions[item.id] = {label: item.label, location, submenu, enabled: !item.disabled, run: item.run,
                ...(item.kind === 'switch' ? {checked: item.pressed === true} : {})};
        };
        for (const group of this.toolbarGroups()) {
            for (const item of group.items) add(item, 'edit', group.label);
        }
        for (const item of this.fileActions()) add(item, 'file');
        return actions;
    }

    componentWillUnmount () {
        this._menuMounted = false;
        if (this.unregisterMenu) this.unregisterMenu();
        this.props.vm?.runtime?.removeListener('PROJECT_RUN_START', this.onProgramStart);
        // Flush first: a Build-mode edit made just before handing the hub to the
        // arena must still be in the next save.
        this.onBundleCollect();
        // A running program lets go of the hub before the arena takes it.
        if (this.session && (this.state.status === 'running' || this.state.status === 'stopping')) {
            try { this.pause(); } catch { /* the session may be half gone */ }
        }
        window.removeEventListener('bw-project-bundle-collect', this.onBundleCollect);
        window.removeEventListener('bw-project-bundle-loaded', this.onBundleLoaded);
        window.removeEventListener('pointerdown', this.onOutsidePress, true);
        if (this.resizer) this.resizer.disconnect();
        if (this.coarseQuery && this.coarseQuery.removeEventListener) this.coarseQuery.removeEventListener('change', this.onPointerKind);
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        this.stopClock();
        this.teardown();
        if (this.connections) this.observeConnection(() => this.connections.dispose());
        this.teardownEditor();
        if (this.unregisterRcx) this.unregisterRcx();
        if (this.unregisterBle) this.unregisterBle();
        if (this.unregisterBt) this.unregisterBt();
        if (this.physics) this.physics.terminate();
        this.physics = null;
        const runtime = this.props.vm && this.props.vm.runtime;
        if (this.api) {
            if (runtime && runtime.robotLab === this.api) delete runtime.robotLab;
            this.api.dispose();
        }
        if (window.__bwSimLab && window.__bwSimLab._pane === this) {
            delete window.__bwSimLab;
            window.dispatchEvent(new CustomEvent(ROBOT_LAB_EVENTS.owner, {detail: {active: false}}));
        }
    }

    teardownEditor () {
        clearTimeout(this.insightTimer);
        if (this.unregisterUndo) this.unregisterUndo();
        this.unregisterUndo = null;
        if (this.unsubscribeInsight) this.unsubscribeInsight();
        this.unsubscribeInsight = null;
        if (this.editView) { try { this.editView.dispose(); } catch { /* a lost context may already be gone */ } }
        this.editView = null;
        this.editor = null;
        this.editorDrawn = false;
        if (!this.disposed) this.setState({editGroup: null, pick: null, measurement: null, shortcuts: false});
        // The pictures stay drawn (part-thumbnails.js keeps them); only the renderer goes.
        if (this.thumbs) { try { this.thumbs.dispose(); } catch { /* a lost context may already be gone */ } }
        this.thumbs = null;
        this.thumbQueue.clear();
    }

    /** Build mode: the current model (or an empty one) in the editor. */
    async enterBuild () {
        const {createEditor, createEditorView3D, createPartThumbnails, fetchLDrawClosure, fetchModelDrawing, parseLDConfig, CATALOG, DEFAULT_COLOR} = this.lib;
        const model = this.session ? this.session.model : {version: 1, parts: []};
        this.pause();
        this.teardown();
        this.teardownEditor();
        this.setState({mode: 'build', status: 'loading', message: '', placing: null, selection: [], buildStatus: {kind: 'idle'}, gizmoMode: 'move', portPicker: null});
        // Any palette part may be placed: the whole catalogue (its second piece is fetched the first
        // time Build opens, sim-lab.js loadFullCatalog), then its geometry, once.
        try {
            await this.lib.loadFullCatalog();
        } catch (error) {
            if (!this.disposed) this.setState({status: 'failed', message: this.t('failed', {error: error.message})});
            return;
        }
        if (this.disposed) return;
        if (!this.catalogFiles) this.catalogFiles = await fetchLDrawClosure([...CATALOG.keys()], {withConfig: true});
        if (this.disposed) return;
        let {read} = this.catalogFiles;
        // A model with decoration (a cable's segments) or parts of its own: those files too, its own first.
        if (model.decor || model.files) {
            const drawing = await fetchModelDrawing({parts: [], decor: model.decor, files: model.files});
            if (this.disposed) return;
            const catalogRead = read;
            read = path => drawing.read(path) ?? catalogRead(path);
        }
        this.editor = createEditor({model, catalog: CATALOG});
        const colors = parseLDConfig(read('ldconfig.ldr'));
        try {
            this.editView = createEditorView3D({container: this.box.current, read, colors,
                catalog: CATALOG, editor: this.editor,
                // A port picker belongs to the one part it was opened for.
                onSelect: selection => this.setState(s => ({selection,
                    portPicker: s.portPicker && selection.includes(s.portPicker.id) ? s.portPicker : null})),
                onChange: (model, info) => this.setState(s => ({editorTick: s.editorTick + 1,
                    recent: info && info.placed ? this.lib.pushRecent(s.recent, info.placed) : s.recent})),
                onStatus: buildStatus => this.setState({buildStatus}),
                // A part dragged out of the palette drawer: the drawer steps aside while it is carried.
                onTool: placing => this.setState({placing, paletteDragging: Boolean(placing && this.editView?.draggingFromPalette)}),
                onMode: gizmoMode => this.setState({gizmoMode}),
                portLabel: item => this.portLabelText(item),
                onPortLabel: (id, rect) => this.openPortPicker(id, rect),
                onViewState: view => this.onEditorViewState(view),
                onColorPicked: color => this.pickColour(color),
                measureLabel: m => fillText(this.etext.measureLabel, {ldu: this.decimal(m.ldu), studs: this.decimal(m.studs), mm: this.decimal(m.mm)}),
                onShortcuts: () => this.setState({shortcuts: true}),
                onHold: hold => this.setState({hold}),
                onAnnounce: info => this.setState({announce: this.announceText(info)}),
                viewCubeLabels: this.etext.connect.cube});
            this.editView.setGrid(this.state.grid);
            this.editView.setWheelMode(this.state.wheelMode);
            this.editView.setMousePreset(this.state.mousePreset);
            this.colors = colors;
            const palette = this.lib.colorPalette(colors);
            this.palette = {...palette, byCode: new Map([...palette.common, ...palette.more].map(c => [c.code, c]))};
            this.editView.setPlaceColor(this.state.placeColor ?? DEFAULT_COLOR);
            this.editView.setHidden(this.storedHidden());
            // Palette pictures: null without WebGL (the palette then shows names only).
            this.thumbs = createPartThumbnails({read, colors, color: DEFAULT_COLOR});
            this.editView.setOverlay({ports: this.state.showPorts, motion: this.state.showMotion});
            this.unsubscribeInsight = this.editor.subscribe(() => {
                this.scheduleInsight();
                notifyUndoState();
            });
            // Menu-bar Undo / Redo / History (lib/global-undo.js) while this editor is built.
            if (this.unregisterUndo) this.unregisterUndo();
            this.unregisterUndo = registerUndoSurface('robots', {
                label: 'Robot Lab',
                canUndo: () => !!this.editor?.canUndo,
                canRedo: () => !!this.editor?.canRedo,
                depth: () => ({undo: this.editor?.undoDepth || 0, redo: this.editor?.redoDepth || 0}),
                steps: () => this.editor?.historyLabels || null,
                undo: () => {
                    if (!this.editor?.canUndo || !this.editView) return false;
                    this.editView.undo();
                    return true;
                },
                redo: () => {
                    if (!this.editor?.canRedo || !this.editView) return false;
                    this.editView.redo();
                    return true;
                }
            });
            if (this.props.isVisible !== false) activateUndoSurface('robots');
            this.runInsight();
        } catch (error) {
            this.setState({status: 'failed', message: this.t('noWebgl', {error: error.message})});
            return;
        }
        this.setState({status: 'ready'});
        if (this.coachDue()) this.setState({coach: 0});
    }

    /**
     * Whether the coach marks show now: the first time Build opens on this device. An automated browser
     * (navigator.webdriver: the browser gates) gets them only when its URL asks (?bwCoach=1), so the
     * card never covers what another gate clicks.
     */
    coachDue () {
        try {
            const automated = typeof navigator !== 'undefined' && navigator.webdriver;
            if (automated && !/[?&]bwCoach=1\b/.test(window.location.search)) return false;
            return localStorage.getItem(COACH_KEY) !== '1';
        } catch {
            return true; // no storage (a private window): show them, they cannot be remembered
        }
    }

    /** The coach marks are put away for good on this device. */
    coachDone () {
        this.setState({coach: null});
        try { localStorage.setItem(COACH_KEY, '1'); } catch { /* private window: this session only */ }
        this.editView?.canvas.focus();
    }

    /** Hidden parts (ids) kept for this browser session. */
    storedHidden () {
        try {
            const ids = JSON.parse(sessionStorage.getItem(HIDDEN_STORAGE_KEY) || '[]');
            return Array.isArray(ids) ? ids.filter(id => typeof id === 'string') : [];
        } catch {
            return [];
        }
    }

    /** The build view's hidden parts, edited group, picking tool or measurement changed. */
    onEditorViewState ({hidden, group, pick, measure}) {
        this.setState({hidden, editGroup: group, pick, measurement: measure});
        try {
            sessionStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(hidden));
        } catch { /* storage off: hidden only until the pane closes */ }
    }

    /** An LDraw colour's name: German for the common palette, else LDConfig's English name. */
    colourName (code) {
        const own = this.etext.colourNames && this.etext.colourNames[code];
        if (own) return own;
        const c = this.colors && this.colors.get(code);
        return c ? c.name.replace(/_/g, ' ') : String(code);
    }

    /** The colour picker (or the eyedropper): new parts get this colour, and a selection is painted with it. */
    pickColour (color) {
        this.setState({placeColor: color});
        if (!this.editView) return;
        this.editView.setPlaceColor(color);
        if (this.editView.selection.length) this.editView.paint(color);
        this.setState(s => ({editorTick: s.editorTick + 1}));
    }

    /** Build: recompile shortly after the last edit (a drag is many edits). */
    scheduleInsight () {
        clearTimeout(this.insightTimer);
        this.insightTimer = setTimeout(() => this.runInsight(), INSIGHT_DEBOUNCE_MS);
    }

    /** Build: compile the editor's model; list its issues and redraw the motion overlay. */
    runInsight () {
        if (!this.editor || !this.lib) return;
        const result = this.lib.modelInsight(this.editor.model, this.lib.CATALOG);
        this.lastInsight = {ms: result.ms, parts: this.editor.model.parts.length};
        this.editView?.setMotion({joints: result.joints, gears: result.gears, tints: result.tints.parts});
        this.setState({issues: result.issues, blockers: result.blockers});
    }

    /** The accessible name of a port badge. */
    portLabelText (item) {
        const part = this.partName(item.part);
        return item.port ? fillText(this.itext.portLabel, {part, port: item.port}) : fillText(this.itext.portLabelNone, {part});
    }

    /** Build: a port badge was clicked — select its part and offer the ports next to the badge. */
    openPortPicker (id, rect) {
        if (!this.editView) return;
        this.editView.select([id]);
        const wrap = this.viewWrap.current?.getBoundingClientRect();
        const left = wrap ? Math.max(0, rect.left - wrap.left) : 0;
        const top = wrap ? rect.bottom - wrap.top + 4 : 0;
        this.setState({portPicker: {id, left, top}});
    }

    pickPort (id, port) {
        if (!this.editor) return;
        this.editor.apply({type: 'setPort', id, port: port || null});
        this.setState(s => ({portPicker: null, editorTick: s.editorTick + 1}));
    }

    setOverlay (change) {
        this.setState(change, () => {
            const shown = {ports: this.state.showPorts, motion: this.state.showMotion};
            this.editView?.setOverlay(shown);
            this.view?.setOverlay?.(shown);
            this.view?.setSensors?.(this.sensorRays(), this.state.showSensors);
        });
    }

    /** The parts an issue names, shown: selected and framed in Build, pulsing in Simulate. */
    focusIssue (issue) {
        const ids = issue.parts || [];
        if (!ids.length) return;
        if (this.editView) {
            this.editView.select(ids);
            this.editView.fitSelection();
        } else if (this.view?.highlight) {
            this.view.highlight(ids, HIGHLIGHT_MS);
        }
    }

    /** A placed part's name in the learner's language, from its id in the model on show. */
    partNameById (id) {
        const model = this.editor ? this.editor.model : this.session?.model;
        // The editor's model is frozen: its id map is built once (lib partsByIdOf), not a scan per issue.
        const placed = model && (Object.isFrozen(model.parts) ? this.lib.partsByIdOf(model).get(id) : model.parts.find(p => p.id === id));
        return placed ? this.partName(placed.part) : fillText(this.itext.part, {id});
    }

    /** Freeze committed samples before a synchronous save; retain at most four pane models. */
    rememberMeasurementHistory () {
        if (!this.measurementContext) return;
        if (this.measurementControlPair) {
            const packet = restoreControlPair(this.measurementControlPair, {...this.measurementContext, definitions: this.measurements}).packet;
            this.measurementExperiments.set(this.measurementContext.modelSha256, packet);
            return;
        }
        const wasActive = this.measurementRecording.snapshot().active;
        this.measurementRecording.stop('model-or-project-save');
        this.measurementRevision++;
        if (wasActive) this.setState(s => ({measurementTick: s.measurementTick + 1}));
        const packet = this.measurementRecording.exportExperiments({...this.measurementContext, selection: this.measurementSelection ||
            this.measurementRecording.selectionFor(this.opened?.text || '', this.measurementContext.modelSha256)});
        const key = this.measurementContext.modelSha256;
        if (!packet.runs.length) { this.measurementExperiments.delete(key); return; }
        if (!this.measurementExperiments.has(key) && this.measurementExperiments.size >= 4) {
            throw new Error('Four model histories are retained. Export or clear a recording before adding another.');
        }
        this.measurementExperiments.set(key, packet);
    }

    /** Current project model, or undefined while a model is not yet admitted. */
    currentRecord () {
        if (!this.lib) return undefined;
        const model = this.editor ? this.editor.model : this.session?.model;
        if (!model) return undefined;
        // The name is written into the text's `0 Name:` line; one the record could not
        // keep would make the reopened text differ, so such a name is not used at all.
        const name = !this.editor && isStorableName(this.state.modelFile) ? this.state.modelFile : 'my-model.ldr';
        this.rememberMeasurementHistory();
        const context = measurementModelContext(model, this.opened?.text || '', this.lib.serializeModel);
        return simLabRecordFromText(this.lib.serializeModel(model, {name, title: MODEL_TITLE, precision: 12}),
            {name, mat: this.state.mat, measurements: this.measurements, experiments: this.measurementExperiments.get(context.modelSha256)});
    }

    /** Before a save reads the bundle's keys: write the model the pane shows. */
    onBundleCollect (event) {
        try {
            const record = this.currentRecord();
            if (record) localStorage.setItem(SIM_LAB_STORAGE_KEY, JSON.stringify(record));
            else if (record === null) localStorage.removeItem(SIM_LAB_STORAGE_KEY);
            if (record !== undefined && !clearSimLabSaveFailure()) throw new Error('Recording storage could not confirm the save');
            if (this.measurementSaveError && this.state.message === this.measurementSaveError) this.setState({message: ''});
            this.measurementSaveError = null;
        } catch (error) {
            const message = this.locale === 'de' ? `Robot-Lab-Modell und Messreihen konnten nicht gespeichert werden. CSV exportieren oder Messreihen löschen und erneut versuchen. ${error.message}` :
                `Robot Lab model and recordings could not be saved. Export CSV or clear recordings, then try again. ${error.message}`;
            refuseSimLabSave(message);
            this.measurementSaveError = message;
            this.setState({message});
            event?.detail?.refuseSimLabSave?.(message);
        }
    }

    /** A project was opened: its model (or none) is in storage now. */
    async onBundleLoaded (event) {
        const outcome = event && event.detail && event.detail.outcome;
        if (outcome !== 'loaded' && outcome !== 'legacy') return;
        // Mount reads storage itself once the chunk is in.
        if (!this.lib || this.disposed) return;
        if (this.state.status === 'running') this.pause();
        if (this.editor) {
            this.teardownEditor();
            this.setState({mode: 'simulate', placing: null, selection: []});
        }
        this.measurementModels.clear();
        this.measurementExperiments.clear();
        this.measurementControlPair = null;
        this.measurementRecording = createMeasurementRecorder();
        this.measurementContext = null;
        this.measurementSelection = null;
        this.measurementReader = null; this.measurements = [];
        await this.openStored();
    }

    /** Open the project's model, or the default model when the project has none. */
    async openStored () {
        const pendingSave = simLabSaveFailure();
        let stored;
        try {
            stored = readSimLabStorage(localStorage.getItem(SIM_LAB_STORAGE_KEY));
        } catch {
            stored = {record: null, refusals: []}; // storage disabled: nothing was restored
        }
        const {record, refusals} = stored;
        this.setState({mat: record && record.mat ? record.mat : null});
        if (record) {
            this.lastText = record.ldraw;
            const opening = this.openText(record.ldraw, record.name || 'my-model.ldr', null, {measurements: record.measurements, experiments: record.experiments});
            const token = this.loadToken;
            await opening;
            if (token !== this.loadToken || this.disposed) return;
        } else {
            const opening = this.openShipped(modelKey(this.lib.MODELS[0]));
            const request = this.shippedRequest;
            await opening;
            if (request !== this.shippedRequest || this.disposed) return;
        }
        if (pendingSave && !this.disposed) { this.measurementSaveError = pendingSave; this.setState({message: pendingSave}); }
        if (refusals.length && !this.disposed) this.setState(s => ({issues: [...refusals, ...s.issues]}));
    }

    /** Back to simulation: compile what was built. */
    async exitBuild () {
        const text = this.lib.serializeModel(this.editor.model, {name: 'my-model.ldr', title: MODEL_TITLE, precision: 12});
        this.lastText = text;
        this.teardownEditor();
        this.setState({mode: 'simulate', placing: null, selection: []});
        await this.openText(text, 'my-model.ldr', null, {measurements: this.measurements});
    }

    /** "Save as…": the model on show (built or simulated) as a .ldr, .mpd or .io file (lib/bw-sim/model/model-file.js). */
    async saveAs (format) {
        this.setState({menu: null});
        const model = this.editor ? this.editor.model : this.session?.model;
        if (!model || !this.lib) return;
        const name = !this.editor && isStorableName(this.state.modelFile) ? this.state.modelFile : 'my-model.ldr';
        // The model's own author line (an imported model's stays: Brickwright would make it one of ours).
        const author = (/^0 Author: (.*?)\r?$/m.exec(this.lastText || '') || [])[1];
        const {data, filename, mime} = await this.lib.saveModelFile(model, format, {name, title: MODEL_TITLE, ...(author ? {author} : {})});
        const url = URL.createObjectURL(new Blob([data], {type: mime}));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    /**
     * Puts the VM on the session's clock (sim-clock.js). Not for the firmware route: its emulated
     * hub runs the program and paces the scene itself (routes/renode-lockstep).
     */
    startClock () {
        const vm = this.props.vm;
        if (!this.session || this.session.lockstep || !vm || !vm.runtime || this.clockInert) return;
        if (!this.clock) this.clock = new this.lib.SimLabClock({paceNominal: true});
        this.clock.timeScale = this.timeScale || 1;
        this.clock.install(vm.runtime, this.session);
    }

    /** Back to wall time (Pause, a new model, the pane closing). */
    stopClock () {
        if (this.clock) this.clock.uninstall();
    }

    teardown ({preserveProgram = false} = {}) {
        this.manualJogs.clear();
        this.manualPolicy = null;
        this.runConnection = null;
        if (this.connections) this.observeConnection(() => this.connections.setScene(null, {preserveProgram}));
        if (this.unregisterBt) this.observeConnection(() => this.unregisterBt());
        this.stopClock();
        if (this.unsubscribeDrawing) this.unsubscribeDrawing();
        this.unsubscribeDrawing = null;
        if (this.view) { try { this.view.dispose(); } catch { /* a lost context may already be gone */ } }
        this.view = null;
        if (this.session) this.session.dispose();
        this.session = null;
        if (this.api) this.api.sessionChanged();
    }

    /** Opens a MODELS entry by its key (`id`, else its file): one model file may be listed twice, with different examples. */
    async openShipped (key, {includeProgram = false, updateTitle = false, preserveProgram = false} = {}) {
        const request = this.shippedRequest = {};
        this.programRequest = null;
        if (includeProgram && this.session) this.pause();
        const entry = this.lib.MODELS.find(m => modelKey(m) === key);
        if (!entry) return;
        if (entry.blocked) { this.setState({message: entry.intro[this.locale] || entry.intro.en}); return; }
        const file = entry.file;
        const response = await fetch(`${this.lib.MODELS_BASE}${file}`);
        if (this.disposed || this.shippedRequest !== request) return;
        if (!response.ok) {
            this.setState({status: 'failed', message: this.t('failed', {error: `HTTP ${response.status}`})});
            return;
        }
        const text = await response.text();
        if (this.disposed || this.shippedRequest !== request) return;
        // A dropdown selection loads its program automatically, just like the
        // gallery. Prepare its mat first, so importing Blocks cannot trigger a
        // second model build and replace the worker after it appeared ready.
        if (includeProgram && this.state.challenge) {
            const challenge = this.lib.CHALLENGES.find(c => c.id === this.state.challenge);
            if (challenge && challenge.mat !== (entry.mat || 'plain')) this.endChallenge();
        }
        if (includeProgram && entry.mat && this.state.mat !== entry.mat) {
            await new Promise(resolve => this.setState({mat: entry.mat}, resolve));
            if (this.disposed || this.shippedRequest !== request) return;
        }
        await this.openText(text, file, key, {programLoading: Boolean(includeProgram && entry.example), preserveProgram, shippedRequest: request});
        if (this.disposed || this.shippedRequest !== request || this.state.status === 'failed') return;
        if (includeProgram && entry.example) await this.loadExample();
        if (this.disposed || this.shippedRequest !== request) return;
        if (updateTitle) this.props.onSetProjectTitle?.(entry.title[this.locale] || entry.title.en);
        // A model that comes with an example offers it while the Code tab has no SPIKE program.
        if (!this.disposed && this.shippedRequest === request) this.setState({...(this.state.lessonKey ? {lessonKey: key} : {}),
            ...(!includeProgram ? {info: this.shippedModel()?.example && !this.spikeLoaded() ? this.withIntro(this.text.exampleOffer) : ''} : {})});
    }

    /** The gallery uses the same model/program loaders as the dropdown and example button. */
    async openGalleryExample (key, includeProgram) {
        const entry = this.lib.MODELS.find(m => modelKey(m) === key);
        if (!entry) throw new Error(this.text.failed);
        if (entry.blocked) throw new Error(entry.intro[this.locale] || entry.intro.en);
        if (this.state.status === 'running') this.pause();
        if (this.editor) this.teardownEditor();
        await new Promise(resolve => this.setState({mode: 'simulate', placing: null, selection: [],
            mat: entry.mat || null, message: ''}, resolve));
        await this.openShipped(key, {includeProgram, updateTitle: true});
        if (!this.session || this.state.status === 'failed') throw new Error(this.state.message || this.text.failed);
        await new Promise(resolve => this.setState({}, resolve));
        if (this.state.message) throw new Error(this.state.message);
        this.closeExamples();
    }

    closeExamples () {
        this.setState({examplesOpen: false}, () => {
            this.root.current?.querySelector('[data-testid="bw-sim-lab-examples"]')?.focus();
        });
    }

    /** The MODELS entry of the model on show, or null for a built or imported one. */
    shippedModel () {
        return this.lib?.MODELS.find(m => modelKey(m) === this.state.shipped) || null;
    }

    /** Controls follow the saved assembly, without assigning gallery identity or loading a program. */
    manualControlPolicy () {
        return this.manualPolicy?.session === this.session ? this.manualPolicy : {available: false, manualJog: null};
    }

    async resolveManualControlPolicy (model, text) {
        try {
            // Do not recognize an import after the parser refused additional geometry or malformed input.
            if (this.lib.parseModel(text).refusals.length) return {available: true, manualJog: null};
            if (!this.manualPolicyResolver) this.manualPolicyResolver = createManualPolicyResolver({
                models: this.lib.MODELS, parseModel: this.lib.parseModel,
                loadText: async file => {
                    const response = await fetch(`${this.lib.MODELS_BASE}${file}`);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    return response.text();
                }
            });
            return {available: true, manualJog: await this.manualPolicyResolver(model)};
        } catch {
            // Unknown policy must not silently turn a failed reference fetch into continuous controls.
            return {available: false, manualJog: null};
        }
    }

    /** A shipped model's own short story (MODELS `intro`, EN/DE) before `text`, when it has one. */
    withIntro (text) {
        const intro = this.shippedModel()?.intro;
        return intro ? `${intro[this.locale] || intro.en} ${text}` : text;
    }

    /**
     * The model's example program (static/sim-lab/programs/, DEVICE SPIKE text) into the
     * Code tab, built into blocks as the arena's reference solutions are; the robot goes
     * onto the mat the program is written for.
     */
    async loadExample () {
        const request = this.programRequest = {};
        const entry = this.shippedModel();
        if (!entry?.example) return;
        this.setState({programLoading: true});
        let code;
        try {
            const response = await fetch(`${this.lib.PROGRAMS_BASE}${entry.example}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            code = await response.text();
        } catch (error) {
            this.setState({programLoading: false, message: this.t('exampleFailed', {error: error.message})});
            return;
        }
        if (this.disposed || this.programRequest !== request || this.shippedModel() !== entry) return;
        if (this.state.status === 'running') this.pause();
        if (entry.example.endsWith('.nqc')) await this.loadRcxExample(code);
        else if (entry.example.endsWith('.blocks.json')) await this.loadBlocksExample(code);
        else {
            try {
                await new Promise((resolve, reject) => window.dispatchEvent(new CustomEvent('bw-load-pseudocode', {
                    detail: {code, source: `sim-lab:${entry.file}`, onComplete: result => result.ok ? resolve() : reject(new Error(result.message))}
                })));
            } catch (error) {
                if (!this.disposed) this.setState({programLoading: false, message: this.t('exampleFailed', {error: error.message})});
                return;
            }
        }
        if (this.disposed) return;
        this.setState({programLoading: false});
        this.setState({info: this.text.exampleGoal[entry.example] || this.withIntro(this.text.exampleLoaded)});
        if (entry.mat && this.state.mat !== entry.mat) await this.setMat(entry.mat);
    }

    /**
     * "Open…": an LDraw, BrickLink Studio or LEGO Digital Designer file, turned into LDraw
     * text (lib/bw-sim/model/model-file.js). A file that cannot be opened at all leaves the
     * model on show as it is and says why; what the import left out joins the model's notes.
     */
    async openImported (event) {
        const f = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!f) return;
        let opened;
        try {
            const bytes = new Uint8Array(await f.arrayBuffer());
            const ldconfig = /\.lxf$/i.test(f.name) ?
                (await this.lib.fetchLDrawClosure([], {withConfig: true})).read('ldconfig.ldr') || '' : '';
            // An LDD file names its parts by design number: those the catalogue lacks are derived first, so
            // the import can place them by their connections (lib/bw-sim/model/ldd-snap.js).
            const prepareCatalog = parts => this.lib.catalogFor(parts.map(p => `1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${p}`).join('\n'));
            opened = await this.lib.openModelFile(f.name, bytes, {ldconfig, title: MODEL_TITLE, catalog: this.lib.CATALOG, prepareCatalog});
        } catch (error) {
            const reason = (error && this.text.fileErrors[error.code]) || (error && error.message) || String(error);
            if (!this.disposed) this.setState({message: this.t('fileFailed', {name: f.name, error: reason})});
            return;
        }
        if (this.disposed) return;
        this.lastText = opened.text;
        await this.openText(opened.text, opened.name, this.state.shipped);
        if (opened.refusals.length && !this.disposed) {
            this.setState(s => ({issues: this.lib.mergeImportIssues(opened.refusals, s.issues)}));
        }
    }

    async openText (text, name, shipped = null, {programLoading = false, measurements, experiments, preserveProgram = false, shippedRequest = null} = {}) {
        if (shippedRequest !== null && this.shippedRequest !== shippedRequest) return;
        // Inline/UI opens supersede pending shipped fetches. The owning shipped
        // loader retains its identity for its later program/title publication.
        this.shippedRequest = shippedRequest;
        try { this.rememberMeasurementHistory(); } catch (error) {
            this.setState({message: error.message});
            return;
        }
        if (this.opened && this.measurementReader) this.measurementModels.set(this.opened.text, this.measurements);
        const savedMeasurements = measurements === undefined ? this.measurementModels.get(text) : measurements;
        this.measurementContext = null;
        this.measurementPreview = null; this.measurementPreviewReader = null; this.measurementReader = null; this.measurementRows = []; this.measurementSampleTime = null; this.measurementRowsTime = null;
        const token = this.loadToken = {};
        this.clearReplay();
        this.opened = {text, name};
        this.teardown({preserveProgram});
        this.setState({status: 'loading', manualOverride: false, programLoading, message: '', issues: [], blockers: [], modelFile: name, shipped, simMs: 0, rtf: null, view3d: 'loading'});
        const {SimSession, fetchModelDrawing, createSimView3D, CATALOG} = this.lib;
        // The SPIKE firmware route (desktop): the emulated hub starts first; the scene then runs
        // in lockstep with it (lib/bw-sim/routes/renode-lockstep).
        let firmware = null;
        let refusal = null;
        this.firmware = null;
        if (this.state.route === 'firmware') {
            // The program the emulated hub runs: the Code tab's blocks, compiled by the SPIKE
            // arena's firmware compiler and uploaded before lockstep. A block it cannot express
            // is named in the pane; the route still opens, with no program (the robot stands).
            // The route compiles once state.read shows the image's instruction ABI (ops 7/8 or not).
            try {
                firmware = await this.lib.openFirmwareRoute({capabilities: this.renodeCapabilities(), hubState: this.hub,
                    compile: abi => this.compileFirmware(abi), onProgramChange: control => this.onFirmwareProgram(control)});
                refusal = firmware.compiled?.error ?? null;
            } catch (error) {
                if (token !== this.loadToken) return;
                // The packaged runtime has no lockstep/v1: not a failure, an unavailable route.
                if (error.code === 'lockstep-unsupported') {
                    this.setState({status: 'failed', programLoading: false, route: 'scratch', firmwareUnsupported: true, message: this.text.routeUnavailable});
                } else {
                    this.setState({status: 'failed', programLoading: false, message: this.t('firmwareFailed', {error: error.message})});
                }
                return;
            }
        }
        let result;
        try {
            // A model naming a part beyond the catalogue's core (sim-lab.js) loads the rest first.
            await this.lib.catalogFor(text);
            if (token !== this.loadToken || this.disposed) { firmware?.driver.end().catch(() => {}); return; }
            result = await SimSession.fromText(text, {hubState: this.hub, catalog: CATALOG, mat: this.state.mat,
                worker: this.physicsClient(), ...(firmware ? {createHub: firmware.createHub} : {})});
        } catch (error) {
            firmware?.driver.end().catch(() => {});
            if (token === this.loadToken) this.setState({status: 'failed', programLoading: false, message: this.t('failed', {error: error.message})});
            return;
        }
        if (!result.session) firmware?.driver.end().catch(() => {});
        if (token !== this.loadToken || this.disposed) { result.session?.dispose(); return; }
        if (result.session && firmware) {
            this.firmware = firmware;
            if (refusal) this.setState({message: firmwareRefusalSentence(this.locale, refusal)});
        }
        const {session, issues, model, runModel} = result;
        if (!session) {
            this.setState({status: 'failed', programLoading: false, issues, blockers: this.lib.runBlockers(issues, model, CATALOG),
                message: this.t('failed', {error: issues.at(-1)?.message || ''})});
            return;
        }
        const manualPolicy = await this.resolveManualControlPolicy(model, text);
        if (token !== this.loadToken || this.disposed) { session.dispose(); return; }
        const insight = this.lib.insightOf(runModel, session.mechanism, CATALOG, issues);
        this.session = session;
        this.manualPolicy = {session, ...manualPolicy};
        this.registerBtBricks();
        if (this.connections) this.observeConnection(() => this.connections.setScene(session, {preserveProgram}));
        this.measurementReader = this.lib.createMeasurementReader(session);
        this.measurementPreviewReader = this.lib.createMeasurementReader(session);
        this.measurements = savedMeasurements === undefined ? this.lib.measurementPresets(session) : measurementDefinitions(savedMeasurements);
        this.measurementRows = this.measurementReader.read(this.measurements);
        this.measurementRowsTime = this.session.time;
        this.measurementContext = measurementModelContext(model, text, this.lib.serializeModel);
        const savedExperiments = experiments === undefined ? this.measurementExperiments.get(this.measurementContext.modelSha256) : experiments;
        this.measurementRecording = createMeasurementRecorder();
        this.measurementControlPair = null;
        let experimentIssue = null;
        try {
            // Historical unavailable values and their original bindings remain data.
            // Live readers still refuse targets that the current compiler cannot resolve.
            if (savedExperiments?.schema === CONTROL_PAIR_SCHEMA) {
                this.measurementControlPair = restoreControlPair(savedExperiments, {...this.measurementContext, definitions: this.measurements}).packet;
            } else this.measurementRecording.restore(savedExperiments, this.measurementContext);
        } catch (error) {
            experimentIssue = {severity: 'warning', code: 'project-experiments-unreadable', message: `Saved recordings were refused: ${error.message}`};
        }
        this.measurementPrecisionEnabled = false;
        this.measurementPrecisionOptions = {mode: 'oscillation', thresholdDegrees: 0};
        this.measurementSelection = experimentIssue ? [] : savedExperiments?.selection || this.measurementRecording.selectionFor(text, this.measurementContext.modelSha256);
        // A real RCX keeps its program through a reset; the Lab's does too (a new scene, the same image).
        if (this.rcxHub() && this.rcxImage) this.rcxHub().loadProgram(this.rcxImage);
        if (this.api) this.api.sessionChanged();
        // The worker could not run the scene (no WebAssembly in workers, say): the physics runs
        // here, and later models do not try the worker again.
        if (session.workerError && this.physics && !session.lockstep) { this.physics.terminate(); this.physics = false; }
        let view3d = 'webgl';
        try {
            // The parts, the decoration (a cable's segments) and the model's own embedded parts.
            const {read} = await fetchModelDrawing(runModel, {withConfig: true});
            if (token !== this.loadToken || this.disposed) return;
            this.view = createSimView3D({drawingLabel: this.text.drawingPreview,container: this.box.current, model: runModel, mechanism: session.mechanism, read, catalog: CATALOG});
            if (runModel.drawings?.length || runModel.parts.some(part => part.pen)) {
                this.unsubscribeDrawing = session.onAdvance(() => {
                    if (this.session === session && this.view && this.state.replayAt === null) {
                        this.view.sampleDrawing(session.snapshot());
                    }
                });
            }
            this.view.setMousePreset(this.state.mousePreset);
            this.view.canvas.setAttribute('aria-label', this.t('canvasLabel'));
            this.view.setPorts(insight.ports.map(item => ({...item, label: this.portLabelText(item)})));
            this.view.setMotion({joints: insight.joints, gears: insight.gears, tints: insight.tints.bodies});
            this.view.setOverlay({ports: this.state.showPorts, motion: this.state.showMotion});
            this.view.setSensors(this.sensorRays(), this.state.showSensors);
            this.view.setMeasurements(() => {
                if (this.state.replayAt !== null || !this.measurementReader) return [];
                // Rendering must not advance the committed acceleration sample stream.
                const saved = this.state.showMeasurements ? this.measurementRows : [];
                const preview = this.state.measurementsOpen && this.measurementPreview && this.measurementPreviewReader ?
                    this.measurementPreviewReader.read([this.measurementPreview]) : [];
                return [...saved, ...preview].map(row => ({...row,
                    label: row.label === row.kind ? measurementWords(this.locale).kinds[row.kind] : row.label}));
            });
            this.view.render(session.snapshot());
        } catch (error) {
            view3d = 'fallback';
            this.setState({message: this.t('noWebgl', {error: error.message})});
        }
        this.configureMeasurementObservations();
        this.setState({status: 'ready', issues: experimentIssue ? [...issues, experimentIssue] : issues, blockers: insight.blockers, view3d});
    }

    /**
     * One physics worker for every model this pane opens (Jolt loads once), started on
     * first use; null where there are no workers, or once the worker has failed.
     */
    physicsClient () {
        if (this.physics === undefined) this.physics = this.lib.startPhysicsClient();
        return this.physics || null;
    }

    /** In the desktop app (or with injected capabilities): the SPIKE firmware route can be offered. */
    desktop () {
        return Boolean(this.props.renodeCapabilities || (typeof window !== 'undefined' && window.__TAURI_INTERNALS__));
    }

    /** The desktop app's native Renode capabilities (made once), or the injected ones. */
    renodeCapabilities () {
        if (this.props.renodeCapabilities) return this.props.renodeCapabilities;
        if (this._renodeCapabilities === undefined) this._renodeCapabilities = this.lib.desktopRenodeCapabilities(window);
        return this._renodeCapabilities;
    }

    /** Switches the program route and reloads the model on it (the firmware route starts the emulator). */
    setRoute (route) {
        if (route === this.state.route) return;
        const opened = this.opened;
        if (this.state.status === 'running') this.pause();
        this.setState({route}, () => {
            if (opened) this.openText(opened.text, opened.name, this.state.shipped);
        });
    }

    /**
     * The Code tab's program for the firmware route: {program} or {error} (which block, why),
     * for the instruction ABI the open route's image advertised (1 until one has).
     */
    compileFirmware (abi = this.firmware?.abi ?? 1) {
        return this.lib.compileRouteProgram(this.props.vm, {topology: 'default', abi});
    }

    /**
     * Run on the firmware route: the program as it is now (a changed one restarts the
     * emulated hub with it: program packets cannot cross during lockstep), then START.
     */
    async runFirmware () {
        const compiled = this.compileFirmware();
        if (compiled.error) {
            this.setState({message: firmwareRefusalSentence(this.locale, compiled.error)});
            return;
        }
        const key = JSON.stringify(compiled.program.instructions);
        if (this.firmware?.program?.key !== key) {
            this.setState({info: this.text.firmwareReloading});
            const opened = this.opened;
            if (!opened) return;
            await this.openText(opened.text, opened.name, this.state.shipped);
            if (this.disposed || this.firmware?.program?.key !== key) return;
        }
        const program = this.firmware.program;
        this.setState({status: 'running', info: '', message: ''});
        try {
            await program.start();
        } catch (error) {
            this.setState({status: 'paused', message: this.t('firmwareControlFailed', {error: error.message})});
        }
    }

    /** Pause on the firmware route: STOP, and the clock runs on until the hub has taken it (the robot brakes). */
    pauseFirmware () {
        const program = this.firmware?.program;
        if (!program || (!program.running && program.idle)) { this.setState({status: 'paused'}); return; }
        this.setState({status: 'stopping'});
        program.stop().catch(error => this.setState({status: 'paused', message: this.t('firmwareControlFailed', {error: error.message})}));
    }

    /** The emulated hub's program changed state (lib/bw-sim/routes/renode-lockstep/program.js onChange). */
    onFirmwareProgram (control) {
        if (this.disposed || this.firmware?.program !== control) return;
        if (control.failed) {
            this.setState({status: this.state.status === 'stopping' ? 'paused' : this.state.status,
                message: this.t('firmwareControlFailed', {error: control.failed.message})});
            return;
        }
        if (control.fault !== null && control.stateName === 'fault') {
            this.setState({message: this.t('firmwareFault', {error: control.fault})});
        }
        if (this.state.status === 'stopping' && !control.running && control.idle) this.setState({status: 'paused'});
    }

    frame (now) {
        this.raf = requestAnimationFrame(this.frame);
        const dt = this.last === null ? 0 : Math.min(MAX_FRAME_MS, now - this.last);
        const clocked = Boolean(this.clock && this.clock.installed);
        if (clocked) {
            this.clock.noteFrame();
            // The VM steps around the hook (arena-clock.js isInert): fall back to wall time, loudly in
            // behaviour rather than freezing the world and every wait with it.
            if (this.clock.inert) {
                this.stopClock();
                this.clockInert = true;
            }
        }
        this.last = now;
        if (this.editView) {
            // The model first; palette pictures (each a GPU read-back, slow on a software GPU) are drawn
            // in frames the build view did not need to redraw, once it has drawn the model.
            if (this.editView.render()) this.editorDrawn = true;
            else if (this.editorDrawn) this.drawThumbs();
            return;
        }
        if (!this.session) return;
        if (this.session.failed && this.state.status !== 'failed') {
            this.setState({status: 'failed', message: this.t('physicsFailed', {error: this.session.failed.message})});
        }
        // 'stopping': the firmware route keeps its clock until the emulated hub has taken STOP.
        // With the program clock installed the VM's steps tick the world (sim-clock.js), not frames.
        if ((this.state.status === 'running' || this.state.status === 'stopping') && dt > 0 && !(this.clock && this.clock.installed)) {
            this.session.tick(dt * (this.timeScale || 1));
        }
        // With the physics in the worker, simulated time advances when a batch comes back.
        if (Math.floor(this.session.time / 100) !== Math.floor(this.state.simMs / 100)) {
            const measured = this.session.lockstep ? this.session.realTimeFactor :
                this.clock && this.clock.installed ? this.clock.realTimeFactor : null;
            const simMs = this.session.time;
            // Keep the last measured pace after Pause, including the final worker reply.
            this.setState(s => ({simMs, rtf: Number.isFinite(measured) ? measured : s.status === 'running' ? null : s.rtf}));
        }
        if (this.state.status === 'running') this.record();
        if (this.state.readings && this.api) this.sample();
        if ((this.state.measurementsOpen || this.state.showMeasurements) && this.measurementReader && this.measurementSampleTime !== this.session.time) {
            if (this.measurementSampleTime === null || (this.state.status !== 'running' && this.state.status !== 'stopping') ||
                Math.abs(this.session.time - this.measurementSampleTime) >= 100) {
                this.measurementRows = this.measurementReader.read(this.measurements);
                this.measurementRowsTime = this.session.time;
                this.measurementSampleTime = this.session.time;
                this.setState(s => ({measurementTick: s.measurementTick + 1}));
            }
        }
        if (this.challengeRun && this.state.status === 'running') this.judgeChallenge();
        const replayed = this.state.replayAt !== null && this.replay ? this.replay.frames[this.state.replayAt] : null;
        if (this.view) this.view.render(replayed ? replayed.snapshot : this.session.snapshot());
    }

    // ---- Simulate: slow motion, replay, readings, sensor rays --------------------------------

    /** Slow motion: simulated per real time, 1, 1/2 or 1/4 (also the Robot Lab API's setTimeScale). */
    setSpeed (scale) {
        const s = Math.min(4, Math.max(0.05, Number(scale) || 1));
        this.timeScale = s;
        if (this.clock) this.clock.timeScale = s;
        if (this.state.timeScale !== s) this.setState({timeScale: s});
    }

    /** Keeps the last REPLAY_MS of the run (body poses, about 30 per simulated second) for the replay slider. */
    record () {
        const t = this.session.time;
        if (!this.replay) this.replay = {frames: []};
        const frames = this.replay.frames;
        if (frames.length && t - frames[frames.length - 1].t < REPLAY_STEP_MS) return;
        const snap = this.session.snapshot();
        frames.push({t, snapshot: {bodyIds: snap.bodyIds, bodies: Float32Array.from(snap.bodies)}});
        while (frames.length && t - frames[0].t > REPLAY_MS) frames.shift();
        if (this.state.replayAt !== null || frames.length % 15 === 0) this.setState({replayAt: null, replayFrames: frames.length});
    }

    clearReplay () {
        this.replay = null;
        this.readingsHistory = new Map();
        this.lastSample = null;
        if (this.state.replayAt !== null || this.state.replayFrames) this.setState({replayAt: null, replayFrames: 0});
    }

    /** Every motor's angle and speed and every sensor's value, 10 times a simulated second, for the Readings panel. */
    sample () {
        const t = this.session.time;
        if (this.lastSample !== null && this.lastSample !== undefined && t - this.lastSample < 100 && t >= this.lastSample) return;
        this.lastSample = t;
        const history = this.readingsHistory || (this.readingsHistory = new Map());
        const push = (key, value, now) => {
            const h = history.get(key) || {values: [], now: ''};
            h.values.push(value);
            if (h.values.length > READINGS_SAMPLES) h.values.shift();
            h.now = now;
            history.set(key, h);
        };
        const api = this.api;
        for (const m of api.motors()) {
            const ref = m.port ?? m.id;
            const angle = api.motorAngle(ref);
            push(`motor-${ref}`, angle, `${Math.round(angle)}° · ${Math.round(api.motorSpeed(ref))} °/s`);
        }
        for (const x of api.sensors()) {
            const ref = x.port ?? x.id;
            const v = api.sensorValue(ref);
            const now = x.kind === 'distance' ? (v < 0 ? '–' : `${v} cm`) : typeof v === 'number' ? String(v) : String(v);
            push(`sensor-${ref}`, typeof v === 'number' && v >= 0 ? v : null, now);
        }
        this.setState(s => ({readingsTick: s.readingsTick + 1}));
    }

    applyMeasurementControlPair (packet) {
        if (this.state.replayAt !== null || this.measurementRecording.snapshot().active || !this.measurementContext) return;
        const admitted = restoreControlPair(packet, {...this.measurementContext, definitions: this.measurements}).packet;
        if (!this.measurementExperiments.has(this.measurementContext.modelSha256) && this.measurementExperiments.size >= 4) throw new Error('Four model histories are retained');
        this.measurementRecording.clear();
        this.measurementControlPair = admitted;
        this.measurementRevision++;
        this.onBundleCollect();
        this.refreshMeasurements();
    }

    clearMeasurementControlPair () {
        this.measurementControlPair = null;
        this.measurementRecording.clear();
        if (this.measurementContext) this.measurementExperiments.delete(this.measurementContext.modelSha256);
        this.measurementRevision++;
        this.onBundleCollect();
        this.refreshMeasurements();
    }

    configureMeasurementObservations () {
        if (!this.session?.setMeasurementObservation) return;
        const byId = new Map(this.measurements.map(d => [d.id, d])), mechanism = this.session.mechanism;
        const joints = this.measurementPrecisionEnabled ? [...new Set((this.measurementSelection || []).map(id => byId.get(id)).filter(d => d?.joint &&
            mechanism.joints.some(j => j.id === d.joint && ['hinge', 'slider'].includes(j.type) && measurementJointBound(mechanism, j, d.binding))).map(d => d.joint))].slice(0, 4) : [];
        this.session.setMeasurementObservation({...this.measurementPrecisionOptions, joints, contacts: this.measurements.some(d => d.kind === 'contact'),
            screws: this.measurements.some(d => d.kind === 'screwSlips' || d.kind === 'screwLoad')});
    }

    changeMeasurements (definitions) {
        this.measurements = measurementDefinitions(definitions);
        this.configureMeasurementObservations();
        this.refreshMeasurements();
        this.onBundleCollect();
    }

    refreshMeasurements () {
        if (this.measurementReader) {
            this.measurementRows = this.measurementReader.read(this.measurements);
            this.measurementRowsTime = this.session.time;
        }
        this.measurementSampleTime = null;
        this.setState(s => ({measurementTick: s.measurementTick + 1}));
        if (this.view && this.session) this.view.render(this.session.snapshot(), {force: true});
    }

    /** The Readings panel's rows. */
    readingsRows () {
        const api = this.api;
        const history = this.readingsHistory || new Map();
        const T = this.text;
        const rows = (list, prefix, label) => list.map(x => {
            const ref = x.port ?? x.id;
            const h = history.get(`${prefix}-${ref}`) || {values: [], now: '…'};
            return {key: `${prefix}-${ref}`, label: label(x), now: h.now, values: h.values};
        });
        if (!api || !this.session) return {motors: [], sensors: []};
        return {
            motors: rows(api.motors(), 'motor', m => fillText(T.readingsMotor, {port: m.port ?? m.id})),
            sensors: rows(api.sensors(), 'sensor', x => fillText(T.readingsSensor, {kind: T.kinds[x.kind] || x.kind, port: x.port ?? x.id}))
        };
    }

    /**
     * The sensor rays for the view: each sensor part's probe (PartMeta `probe`, part frame), a distance
     * sensor's as long as it measures (1 cm = 25 LDU; nothing seen: its 2 m range), the others 2 cm.
     */
    sensorRays () {
        if (!this.session || !this.api) return [];
        const model = this.session.runModel || this.session.model;
        const byId = new Map(model.parts.map(p => [p.id, p]));
        const out = [];
        for (const x of this.api.sensors()) {
            const placed = byId.get(x.part);
            const meta = placed && this.lib.CATALOG.get(placed.part);
            const probe = meta && (meta.probe || meta.device?.probe);
            if (!probe || !probe.origin || !probe.direction) continue;
            const ref = x.port ?? x.id;
            out.push({id: x.part, origin: probe.origin, direction: probe.direction,
                lengthOf: x.kind === 'distance' ? () => {
                    const cm = this.api.sensorValue(ref);
                    return (typeof cm === 'number' && cm > 0 ? cm : 200) * 25;
                } : () => 50});
        }
        return out;
    }

    /** Paused with a recorded run: a slider back through its last seconds (the run goes on from now). */
    renderReplay () {
        const n = this.state.replayFrames;
        if (this.state.mode !== 'simulate' || this.state.status === 'running' || !this.replay || n < 2) return null;
        const frames = this.replay.frames;
        const at = this.state.replayAt === null ? frames.length - 1 : this.state.replayAt;
        const back = (frames[frames.length - 1].t - frames[at].t) / 1000;
        const T = this.text;
        return (
            <div data-testid="bw-sim-lab-replay" style={{position: 'absolute', left: 8, right: 8, bottom: 8, zIndex: 5, display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255, 255, 255, 0.94)', border: '1px solid #cbd5e1', borderRadius: 8, padding: '4px 10px', fontSize: 12}}>
                <span style={{fontWeight: 600}} title={T.replayHelp}>{T.replay}</span>
                <input type="range" data-testid="bw-sim-lab-replay-slider" aria-label={T.replay} title={T.replayHelp}
                    min={0} max={frames.length - 1} step={1} value={at} style={{flex: '1 1 auto'}}
                    onChange={e => {
                        const i = Number(e.target.value);
                        this.setState({replayAt: i >= frames.length - 1 ? null : i});
                    }} />
                <span data-testid="bw-sim-lab-replay-time" style={{fontVariantNumeric: 'tabular-nums', minWidth: 52, textAlign: 'right'}}>
                    {at >= frames.length - 1 ? T.replayNow : `−${back.toFixed(1)} s`}
                </span>
            </div>
        );
    }

    /** Slow motion: an icon and a list (1×, ½×, ¼×). */
    renderSpeed (inMenu) {
        const A = this.ttext.actions;
        const field = this.state.coarse ? {minHeight: 40} : {height: 28};
        return (
            <label title={A.speed} style={{display: 'inline-flex', alignItems: 'center', gap: 4, padding: inMenu ? '0 8px' : '0 4px', fontSize: 12, flex: '0 0 auto'}}>
                <Icon name="speed" />
                {inMenu ? <span style={{flex: '1 1 auto'}}>{A.speed}</span> : null}
                <select data-testid="bw-sim-lab-speed" aria-label={A.speed} value={this.state.timeScale} style={field}
                    onChange={e => this.setSpeed(Number(e.target.value))}>
                    {[0.25, 0.5, 1, 2, 4].map(v => <option key={v} value={v}>{fillText(this.text.speedValue, {n: v === 0.5 ? '½' : v === 0.25 ? '¼' : String(v)})}</option>)}
                </select>
            </label>
        );
    }

    /** The scene's RCX (hubs/rcx/), or null. */
    rcxHub () {
        const h = this.session && this.session.hubs.find(x => x.profile === 'rcx');
        return h ? h.hub : null;
    }

    /**
     * "Robot Lab RCX" as an `rcxDownload` target (lib/rcx/rcx-targets.js): the RCX blocks and the
     * NQC tab send to the scene's RCX once the user picks it below; the IR tower stays the default.
     */
    registerRcxTarget () {
        const runtime = this.props.vm && this.props.vm.runtime;
        if (!runtime || this.unregisterRcx) return;
        this.unregisterRcx = this.lib.registerRcxTarget(runtime, this.lib.robotLabRcxTarget(() => this.rcxHub(), {
            onLoaded: (bytes, hub) => {
                this.rcxImage = bytes.slice();
                // A download that started the program (the NQC tab, the RCX blocks) runs the world too.
                if (hub.status === 'running' && this.session && !this.session.lockstep && this.state.status !== 'running') {
                    this.startClock();
                    this.setState({status: 'running', info: ''});
                }
            }
        }));
    }

    setRcxTarget (id) {
        const runtime = this.props.vm && this.props.vm.runtime;
        if (!runtime) return;
        this.lib.selectRcxTarget(runtime, id);
        this.forceUpdate();
    }

    /** Run with an RCX: its program starts (again) on the Lab's clock. */
    runRcx () {
        const hub = this.rcxHub();
        this.stopClock();
        if (hub.status === 'empty') this.setState({info: this.text.rcxNoProgram});
        else {
            hub.run();
            this.setState({info: ''});
        }
        this.startClock();
        this.setState({status: 'running'});
    }

    /** An NQC example: into the NQC tab, compiled, and downloaded to the Lab's RCX (the target chosen for it). */
    async loadRcxExample (code) {
        window.dispatchEvent(new CustomEvent('bw-load-pseudocode', {detail: {code, lang: 'nqc', source: 'sim-lab'}}));
        const runtime = this.props.vm && this.props.vm.runtime;
        const fail = error => this.setState({message: this.t('rcxFailed', {error})});
        if (!runtime || typeof runtime.nqcCompile !== 'function' || typeof runtime.rcxDownload !== 'function') return fail('no NQC compiler');
        const compiled = await runtime.nqcCompile(code, 'RCX2');
        if (this.disposed) return;
        if (!compiled.ok) return fail(compiled.log);
        this.lib.selectRcxTarget(runtime, this.lib.ROBOT_LAB_RCX_TARGET);
        const sent = await runtime.rcxDownload(compiled.bytes, {target: this.lib.ROBOT_LAB_RCX_TARGET, run: false});
        if (!sent.ok) fail(sent.log);
    }

    /** 'ev3' or 'nxt' when the scene's hub is a MINDSTORMS brick its blocks reach over Scratch Link (hubs/ev3, hubs/nxt), else null. */
    btProfile () {
        const h = this.session && this.session.hubs.find(x => x.profile === 'ev3' || x.profile === 'nxt');
        return h ? h.profile : null;
    }

    /**
     * "Virtual EV3" and "Virtual NXT" in the Scratch Link BT-classic registry (lib/virtual-hub/
     * bt-classic-registry.js): while the scene has that brick, an EV3 or NXT extension that looks for
     * a brick over Scratch Link finds the Lab's, and its direct commands drive it.
     */
    registerBtBricks () {
        if (this.unregisterBt || !this.session || this.disposed) return;
        const scene = this.session;
        let active = true;
        const peers = new Set();
        const make = (profile, factory) => {
            const record = scene.hubs.find(item => item.profile === profile);
            const hub = record?.hub;
            const currentHub = () => active && !this.disposed && this.session === scene && !scene._disposed &&
                record && scene.hubs.includes(record) && record.hub === hub && record.profile === profile ? hub : null;
            const peripheral = factory(currentHub);
            return {...peripheral, open: link => {
                if (!currentHub()) throw new DOMException('The Lab Bluetooth brick was replaced.', 'NetworkError');
                const session = factory(currentHub).open(link);
                let live = true;
                let linkClosed = false;
                const owner = {retire: closeLink => {
                    const errors = [];
                    if (live) {
                        live = false;
                        peers.delete(owner);
                        try { session.close?.(); } catch (error) { errors.push(error); }
                    }
                    if (closeLink && !linkClosed) {
                        linkClosed = true;
                        try { link.close(); } catch (error) { errors.push(error); }
                    }
                    if (errors.length) throw new AggregateError(errors, 'Lab Bluetooth peer cleanup failed');
                }};
                peers.add(owner);
                if (!currentHub()) {
                    owner.retire(true);
                    throw new DOMException('The Lab Bluetooth brick was replaced while opening.', 'NetworkError');
                }
                return {
                    receive: bytes => {
                        if (!live) throw new DOMException('The Lab Bluetooth connection is closed.', 'NetworkError');
                        if (!currentHub()) {
                            owner.retire(true);
                            throw new DOMException('The Lab Bluetooth brick was replaced.', 'NetworkError');
                        }
                        return session.receive(bytes);
                    },
                    close: () => owner.retire(false)
                };
            }};
        };
        const unregister = [];
        const release = () => {
            if (!active) return;
            active = false;
            if (this.unregisterBt === release) this.unregisterBt = null;
            const errors = [];
            // Remove discovery first: callbacks from closing a peer cannot
            // reacquire an endpoint being retired or remove a later owner.
            for (const off of unregister) { try { off(); } catch (error) { errors.push(error); } }
            for (const owner of [...peers]) { try { owner.retire(true); } catch (error) { errors.push(error); } }
            if (errors.length) throw new AggregateError(errors, 'Lab Bluetooth retirement failed');
        };
        try {
            for (const [profile, factory] of [['ev3', this.lib.ev3ClassicPeripheral], ['nxt', this.lib.nxtClassicPeripheral]]) {
                if (scene.hubs.some(record => record.profile === profile)) {
                    unregister.push(this.lib.registerVirtualClassicPeripheral(make(profile, factory)));
                }
            }
        } catch (error) {
            try { release(); }
            catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Lab Bluetooth registration and rollback failed'); }
            throw error;
        }
        this.unregisterBt = release;
    }

    /**
     * Run with an EV3 or NXT: the loaded extension (ev3comprehensive or the stock `ev3`; legonxt)
     * connects to the Lab's brick over Scratch Link, then the green flag.
     */
    async runBt ({greenFlag = true} = {}) {
        const profile = this.btProfile();
        const vm = this.props.vm;
        const brick = profile === 'ev3' ? 'EV3' : 'NXT';
        const ids = profile === 'ev3' ? ['ev3comprehensive', 'ev3'] : ['legonxt'];
        const extensionId = ids.find(id => vm && vm.extensionManager && vm.extensionManager.isExtensionLoaded(id));
        this.stopClock();
        const session = this.session;
        const request = this.runConnection = {};
        const current = () => !this.disposed && this.props.vm === vm && this.session === session && this.runConnection === request &&
            this.state.status === 'running' && !this.state.manualOverride;
        // A fast virtual connection can resolve before React flushes setState.
        // Commit Run first; an intervening Stop or replacement still wins.
        await new Promise(resolve => this.setState({status: 'running'}, resolve));
        if (!current()) return;
        if (!extensionId) {
            this.startClock();
            this.setState({info: this.t('noProgramBt', {brick})});
            return;
        }
        this.setState({info: ''});
        try {
            await this.connectLegacy(vm, () => this.lib.connectVirtualHub({vm, extensionId,
                peripheralId: profile === 'ev3' ? this.lib.EV3_PERIPHERAL_ID : this.lib.NXT_PERIPHERAL_ID}), current);
        } catch (error) {
            // Said, and the world still runs: the program's own connect block may yet reach the brick.
            if (!current()) return;
            this.setState({message: this.t('connectFailed', {error: error.message})});
        }
        if (current()) {
            this.startClock();
            if (greenFlag) vm.greenFlag();
        }
    }

    /** A blocks example (`.blocks.json`: an extension's blocks for a sprite): the extension in, the script onto the editing sprite. */
    async loadBlocksExample (code) {
        const vm = this.props.vm;
        if (!vm || !vm.editingTarget) return;
        try {
            const example = JSON.parse(code);
            for (const id of example.extensions || []) {
                if (!vm.extensionManager.isExtensionLoaded(id)) await vm.extensionManager.loadExtensionURL(id);
            }
            await vm.shareBlocksToTarget(this.lib.vmBlocksOf(example.blocks), vm.editingTarget.id);
            vm.emitWorkspaceUpdate();
        } catch (error) {
            this.setState({message: this.t('exampleFailed', {error: error.message})});
        }
    }

    spikeLoaded () {
        const vm = this.props.vm;
        return Boolean(vm && vm.extensionManager && vm.extensionManager.isExtensionLoaded('spikeprime'));
    }

    /** As the arena's Start: connect the spikeprime blocks to the shared virtual hub, then green flag. */
    async run ({greenFlag = true} = {}) {
        if (!this.session || this.state.programLoading) return;
        if (this.state.manualOverride) this.setManualOverride(false);
        if (this.session.lockstep) { await this.runFirmware(); return; }
        if (this.connections && this.connections.snapshot().route !== 'bluetooth') {
            // A Robot Lab start block is already executing: only resume its
            // world. A toolbar Run owns a fresh provider/green-flag admission.
            if (!greenFlag) { this.apiEnsureRunning(); return; }
            this.runConnection = null;
            this.hub.setSimulationEnabled(true);
            await this.connectConnection({run: true});
            return;
        }
        if (this.rcxHub()) { this.runRcx(); return; }
        if (this.radioHub()) { await this.runRadioHub(this.radioHub(), {greenFlag}); return; }
        if (this.btProfile()) { await this.runBt({greenFlag}); return; }
        const vm = this.props.vm;
        const hubState = this.hub;
        hubState.setSimulationEnabled(true);
        // Connecting runs on wall time (its timeouts are the browser's); the program clock goes in
        // just before the green flag, so the program's first `wait` starts on the world's clock.
        this.stopClock();
        const session = this.session;
        const request = this.runConnection = {};
        const current = () => !this.disposed && this.props.vm === vm && this.session === session && this.runConnection === request &&
            this.state.status === 'running' && !this.state.manualOverride;
        // A fast virtual connection can resolve before React flushes setState.
        // Commit Run first; an intervening Stop or replacement still wins.
        await new Promise(resolve => this.setState({status: 'running'}, resolve));
        if (!current()) return;
        // Without a SPIKE or Robot Lab program the clock still runs (the arrows below drive the
        // motors), but say plainly why nothing moves on its own.
        const spike = this.spikeLoaded();
        if (!spike && !this.robotLabLoaded()) {
            this.startClock();
            const none = this.spikeScene() ? this.text.noProgram : this.text.noProgramLab;
            this.setState({info: this.shippedModel()?.example ? `${none} ${this.text.exampleOffer}` : none});
            return;
        }
        this.setState({info: ''});
        // A Robot Lab program alone (robotlab blocks, `lab` words): no hub to connect, the flag starts it.
        if (!spike) {
            this.startClock();
            if (greenFlag) vm.greenFlag();
            return;
        }
        const peripheral = vm.runtime.peripheralExtensions && vm.runtime.peripheralExtensions.spikeprime;
        try {
            const {connectVirtualSpike} = this.lib;
            await this.connectLegacy(vm, () => connectVirtualSpike({host: window, hubState,
                connected: () => vm.getPeripheralIsConnected('spikeprime'),
                disconnect: () => vm.disconnectPeripheral('spikeprime'),
                connect: async () => {
                    if (typeof peripheral.setMode === 'function') peripheral.setMode('web-ble');
                    await peripheral.scan();
                }}), current);
        } catch (error) {
            if (!current()) return;
            this.setState({message: this.t('connectFailed', {error: error.message})});
            return;
        }
        if (current()) {
            this.startClock();
            if (greenFlag) vm.greenFlag();
        }
    }
    /** Puts the current model on another mat (its start pose, if the mat has one) and reloads it. */
    async setMat (mat) {
        if (!this.session) return;
        const text = this.lib.serializeModel(this.session.model, {name: this.state.modelFile || 'model.ldr', precision: 12});
        this.pause();
        const challenge = this.state.challenge && this.lib.CHALLENGES.find(c => c.id === this.state.challenge);
        if (challenge && challenge.mat !== (mat || 'plain')) this.endChallenge();
        await new Promise(resolve => this.setState({mat: mat || null}, resolve));
        await this.openText(text, this.state.modelFile, this.state.shipped);
    }

    // ---- Challenges: a goal on a mat, judged while the robot runs (lib/bw-sim/world/challenges.js) ----

    /** Starts a challenge on its mat, the robot back at the start; Run begins it. null: back to the list. */
    async startChallenge (id) {
        if (!id) { this.endChallenge(); return; }
        const challenge = this.lib.CHALLENGES.find(c => c.id === id);
        if (!challenge || !this.session) return;
        this.challengeRun = null;
        this.setState({challenge: id, challengeResult: null, challengesOpen: true});
        if ((this.state.mat || 'plain') !== challenge.mat) await this.setMat(challenge.mat);
        else await this.reset();
        this.armChallenge();
    }

    /** A fresh judge for the challenge under way (after a start or a Reset: the robot is at the start). */
    armChallenge () {
        if (!this.state.challenge) return;
        this.challengeRun = this.lib.createChallengeRun(this.state.challenge);
        this.challengeFrom = null;
        this.challengeLast = null;
        this.setState({challengeResult: null});
    }

    endChallenge () {
        this.challengeRun = null;
        if (this.state.challenge) this.setState({challenge: null, challengeResult: null});
    }

    /** What the judge sees: the robot's outline on the floor (its parts' collider corners, metres) and which of the mat's obstacles it touches. */
    challengeObservation (tS) {
        const api = this.api;
        const parts = api.parts();
        const points = parts.flatMap(p => api.partOutline(p.id));
        const touching = {};
        for (const o of this.lib.createMat(this.state.mat || 'plain').obstacles) {
            touching[o.id] = parts.some(p => api.touching(p.id, o.id));
        }
        // What the pens have drawn (view/pen-layer.js), for "Draw a square".
        const drawing = this.view && this.view.penStrokes ? this.view.penStrokes() : [];
        return {tS, points, touching, drawing};
    }

    judgeChallenge () {
        const run = this.challengeRun;
        const t = this.session.time;
        if (this.challengeFrom === null || this.challengeFrom === undefined || t < this.challengeFrom) this.challengeFrom = t;
        if (this.challengeLast !== null && this.challengeLast !== undefined && t - this.challengeLast < CHALLENGE_STEP_MS) return;
        this.challengeLast = t;
        const before = run.result;
        const r = run.step(this.challengeObservation((t - this.challengeFrom) / 1000));
        if (r.status !== 'running') {
            this.challengeRun = null;
            if (r.status === 'done') this.keepBest(run.challenge, r);
            this.pause();
        }
        if (r.status !== before.status || Math.round(r.timeS * 10) !== Math.round(before.timeS * 10)) this.setState({challengeResult: r});
    }

    keepBest (challenge, r) {
        const best = readBest();
        if (!this.lib.betterResult(r, best[challenge.id])) return;
        best[challenge.id] = {stars: r.stars, value: r.value};
        try { localStorage.setItem(CHALLENGE_BEST_KEY, JSON.stringify(best)); } catch { /* private mode: kept for this visit */ }
        this.setState({challengeBest: best});
    }

    /** How a result's measure reads: a time, a gap, an overshoot. */
    measureText (challenge, value) {
        const v = challenge.measure === 'time' ? value.toFixed(1) : String(Math.round(value * 100));
        return fillText(this.text.challengeMeasure[challenge.measure], {v: this.decimal(v)});
    }

    renderChallenges () {
        const T = this.text;
        const mats = new Map(this.lib.MATS.map(m => [m.id, m.title[this.locale] || m.title.en]));
        const list = this.lib.CHALLENGES.map(c => {
            const best = this.state.challengeBest[c.id];
            return {id: c.id, mat: mats.get(c.mat) || c.mat, ...T.challenges[c.id],
                best: best ? {stars: best.stars, text: this.measureText(c, best.value)} : null};
        });
        const challenge = this.state.challenge && this.lib.CHALLENGES.find(c => c.id === this.state.challenge);
        const r = this.state.challengeResult;
        const active = challenge ? {id: challenge.id, result: r, measureText: r && r.status === 'done' ? this.measureText(challenge, r.value) : ''} : null;
        return (
            <SimLabChallenges text={{...T, close: T.readingsClose}} challenges={list} active={active}
                onStart={id => this.startChallenge(id)} onClose={() => this.setState({challengesOpen: false})} />
        );
    }

    /** Hold-to-drive with the movement pair (A left, mounted mirrored; B right), as the arena's drive pad. */
    drive (direction) {
        if (!this.session || !this.session.bridge || !this.spikeScene()) return;
        // Also guard stale pointer/keyboard events after a model or movement-pair change.
        const policy = this.manualControlPolicy();
        if (direction !== 'stop' && (!policy.available || !manualDriveAllowed(policy.manualJog, this.hub.movementPair))) return;
        const enablingOverride = direction !== 'stop' && !this.state.manualOverride;
        if (enablingOverride) this.setManualOverride(true);
        const hub = this.hub;
        hub.setSimulationEnabled(true);
        // Enabling override pauses synchronously, while React's status update
        // is deferred. Reinstall the clock even when state still says running.
        if (enablingOverride || this.state.status !== 'running') {
            this.startClock();
            this.setState({status: 'running'});
        }
        const [left, right] = hub.movementPair || ['A', 'B'];
        const pct = this.state.driveSpeed;
        const dps = port => hub.motors.percentToDps(port, pct);
        const set = (l, r) => {
            if (l === 0) hub.motors.stop(left); else hub.motors.runAtSpeed(left, -l * dps(left));
            if (r === 0) hub.motors.stop(right); else hub.motors.runAtSpeed(right, r * dps(right));
        };
        // Wheel-forward is left counter-clockwise (negative), right clockwise (positive).
        if (direction === 'forward') set(1, 1);
        else if (direction === 'back') set(-1, -1);
        else if (direction === 'left') set(-0.6, 0.6);
        else if (direction === 'right') set(0.6, -0.6);
        else set(0, 0);
        this.driving = direction === 'stop' ? null : direction;
    }

    onDriveKey (event, down) {
        const map = {ArrowUp: 'forward', ArrowDown: 'back', ArrowLeft: 'left', ArrowRight: 'right'};
        const dir = map[event.key];
        if (!dir || this.state.mode !== 'simulate') return;
        event.preventDefault();
        if (down && this.driving !== dir) this.drive(dir);
        if (!down && this.driving === dir) this.drive('stop');
    }

    pause () {
        if (!this.session) return;
        if (this.session.lockstep) { this.pauseFirmware(); return; }
        this.runConnection = null;
        if (this.connections && this.connections.snapshot().route !== 'bluetooth') {
            this.disconnectConnection();
            return;
        }
        // Pause stops the program too (a Robot Lab program's next motor command would run the world again).
        if (this.spikeLoaded() || this.robotLabLoaded() || this.hubExtension()) {
            try { this.props.vm.stopAll(); } catch { /* the VM may be mid-load */ }
        }
        this.hub.backend.cancel();
        this.stopClock();
        this.setState({status: 'paused'});
    }

    async reset () {
        if (!this.session) return;
        this.hub.stopAll?.();
        const name = this.state.modelFile;
        if (this.state.shipped) await this.openShipped(this.state.shipped);
        else if (this.lastText) await this.openText(this.lastText, name);
        this.armChallenge();
    }

    setManualOverride (enabled) {
        if (enabled && !this.manualControlPolicy().available) return;
        if (enabled) this.pause();
        for (const motor of this.api?.motors() || []) if (motor.direct) setMixerMotorPower(this.api, motor.id, 0);
        this.manualJogs.clear();
        this.setState({manualOverride: enabled, mixer: {session: this.session, power: {}}});
    }

    /** Manual commands are explicitly enabled; their sliders never pretend to be program telemetry. */
    renderBrickButtons () {
        return <SimLabBrickButtons locale={this.locale} api={this.api} scene={this.session}
            disabled={this.state.programLoading}
            onError={error => this.setState({message: error.message})} />;
    }

    /** The program connection: a folded section of Manual controls (no room above the scene). */
    renderConnections () {
        const connection = this.state.connection;
        if (!connection?.routes?.length) return null;
        return <SimLabConnections locale={this.locale} {...connection}
            disabled={this.state.programLoading}
            onHub={hubId => this.selectConnection({hubId, route: 'bluetooth'})}
            onRoute={route => this.selectConnection({route})}
            onConnect={() => this.connectConnection()}
            onDisconnect={() => this.disconnectConnection()} />;
    }

    renderMixer (button, brick) {
        if (!this.api) return null;
        const s = this.session;
        const power = this.state.mixer.session === s ? this.state.mixer.power : {};
        const lang = this.locale === 'de' ? 'de' : 'en';
        const {available, manualJog} = this.manualControlPolicy();
        const motors = this.api.motors().map(m => {
            const enc = this.api.encoder(m.id);
            return {id: m.id, port: m.port, hub: m.hub, direct: m.direct,
                hubName: (m.profile && m.profile.name && (m.profile.name[lang] || m.profile.name.en)) || m.hub || '',
                manualJog: manualJog?.[m.port], jogBusy: this.manualJogs.get(m.id)?.session === s,
                angleDeg: enc && enc.ok ? enc.angleDeg : null};
        });
        const setPower = (id, pct) => {
            if (!this.state.manualOverride || this.session !== s) return;
            const motor = this.api.motors().find(m => m.id === id);
            // A stale slider event must not bypass a port's finite manual controls.
            const policy = this.manualControlPolicy();
            if (pct !== 0 && (!policy.available || policy.manualJog?.[motor?.port] !== undefined)) return;
            const r = setMixerMotorPower(this.api, id, pct);
            if (r && r.ok === false) return;
            this.manualJogs.delete(id);
            this.setState(st => ({mixer: {session: s, power: {...(st.mixer.session === s ? st.mixer.power : {}), [id]: pct}}}));
        };
        const jog = (id, direction) => {
            if (this.disposed || this.session !== s || !this.state.manualOverride || this.state.status === 'failed') return;
            const busy = this.manualJogs.get(id)?.session === s;
            if (busy) return;
            const policy = this.manualControlPolicy();
            if (!policy.available) return;
            const motor = this.api.motors().find(m => m.id === id);
            const limits = policy.manualJog?.[motor?.port];
            const token = {session: s};
            this.manualJogs.set(id, token);
            const refresh = () => {
                if (!this.disposed && this.session === s) this.setState(st => ({mixer: {...st.mixer}}));
            };
            const finished = () => {
                // An interrupted command from an old scene must not unlock a newer command.
                if (this.manualJogs.get(id) !== token) return;
                this.manualJogs.delete(id);
                refresh();
            };
            const result = setMixerMotorJog(this.api, id, limits, direction, {enabled: this.state.manualOverride, busy});
            if (!result?.ok) { finished(); return; }
            if (!result.done || typeof result.done.then !== 'function') {
                // A finite command without completion feedback cannot safely accept another jog.
                setMixerMotorPower(this.api, id, 0);
                finished();
                return;
            }
            result.done.then(finished, finished);
            refresh();
        };
        return (
            <SimLabMotorMixer motors={motors} power={power} open={this.state.mixerOpen} locale={this.locale} button={button}
                available={available}
                brick={brick || null}
                brickOpen={this.state.brickControlsOpen}
                onBrickToggle={() => this.setState(st => ({brickControlsOpen: !st.brickControlsOpen}))}
                connection={this.renderConnections()}
                connectionOpen={this.state.connectionControlsOpen}
                onConnectionToggle={() => this.setState(st => ({connectionControlsOpen: !st.connectionControlsOpen}))}
                override={this.state.manualOverride} onOverride={enabled => this.setManualOverride(enabled)}
                drive={available && this.session.bridge && this.spikeScene() && manualDriveAllowed(manualJog, this.hub.movementPair) ? this.renderDrive(button) : null}
                onClose={() => { if (this.state.manualOverride) this.setManualOverride(false); if (this.driving) this.drive('stop'); this.setState({controlsOpen: false}); }}
                onToggle={() => this.setState(st => {
                    try { localStorage.setItem(MIXER_OPEN_KEY, st.mixerOpen ? '0' : '1'); } catch { /* private window: this session only */ }
                    return {mixerOpen: !st.mixerOpen};
                })}
                onPower={setPower} onJog={jog} onStop={id => setPower(id, 0)}
                onStopAll={() => {
                    this.props.vm.stopAll();
                    motors.filter(m => m.direct).forEach(m => setMixerMotorPower(this.api, m.id, 0));
                    this.manualJogs.clear();
                    this.setState({mixer: {session: s, power: {}}});
                }} />
        );
    }

    renderDrive (button) {
        // The arrow follows the finger (or button) that pressed it: captured, so sliding off does not
        // let go, and it stops when THAT finger lifts or the browser takes it away (another finger on
        // another arrow has taken over by then and keeps driving).
        const release = e => {
            if (this.drivePointer !== e.pointerId) return;
            this.drivePointer = null;
            this.drive('stop');
        };
        const hold = dir => ({
            onPointerDown: e => {
                e.currentTarget.setPointerCapture?.(e.pointerId);
                this.drivePointer = e.pointerId;
                this.drive(dir);
            },
            onPointerUp: release,
            onPointerCancel: release,
            onLostPointerCapture: release,
            onContextMenu: e => e.preventDefault()
        });
        const compact = this.compact();
        const arrow = {...button, minWidth: this.state.coarse ? 48 : 34, fontSize: 15, lineHeight: '18px', userSelect: 'none',
            WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'none', ...(compact ? {padding: '4px 6px', flex: '0 0 auto'} : {})};
        const hub = this.hub.data;
        const ports = [...new Set(this.session.mechanism.joints.filter(j => j.motor).map(j => j.motor.port))].sort();
        const sensorPorts = (this.session.mechanism.sensors || []).map(s => s.port).sort();
        // Each air network's pressure (physics/air.js): a tank that empties as its cylinders move.
        const air = this.session.core && this.session.core.airState ? this.session.core.airState() : [];
        const fmt = (port, s) => {
            if (!s) return '–';
            if (s.kind === 'distance') return s.distance < 0 ? '–' : `${s.distance} mm`;
            if (s.kind === 'color') return `${s.color} · ${s.reflection} %`;
            if (s.kind === 'force') return `${s.force} %${s.pressed ? ' ●' : ''}`;
            return s.kind;
        };
        return (
            <div data-testid="bw-sim-lab-drive" tabIndex={0} onKeyDown={e => this.onDriveKey(e, true)} onKeyUp={e => this.onDriveKey(e, false)}
                role="group" aria-label={this.text.drive}
                style={{display: 'flex', alignItems: 'center', flexWrap: 'nowrap', flexShrink: 0, gap: 4, fontSize: 12, outline: 'none', minWidth: 0}}>
                {!compact && <span style={{fontWeight: 600}}>{this.text.drive}</span>}
                <button type="button" style={arrow} data-testid="bw-sim-lab-drive-left" aria-label={this.text.left} {...hold('left')}>◀</button>
                <button type="button" style={arrow} data-testid="bw-sim-lab-drive-forward" aria-label={this.text.forward} {...hold('forward')}>▲</button>
                <button type="button" style={arrow} data-testid="bw-sim-lab-drive-back" aria-label={this.text.back} {...hold('back')}>▼</button>
                <button type="button" style={arrow} data-testid="bw-sim-lab-drive-right" aria-label={this.text.right} {...hold('right')}>▶</button>
                <label style={{whiteSpace: 'nowrap', flex: '0 0 auto'}}>{compact ? null : `${this.text.speed} `}
                    <input type="range" min={10} max={100} step={10} value={this.state.driveSpeed} data-testid="bw-sim-lab-drive-speed"
                        aria-label={this.text.speed}
                        onChange={e => this.setState({driveSpeed: Number(e.target.value)})} style={{verticalAlign: 'middle', width: compact ? 64 : 90}} />
                    {' '}{this.state.driveSpeed} %
                </label>
                <span data-testid="bw-sim-lab-readout" title={this.text.driveHelp}
                    style={{color: '#475569', maxWidth: 180, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {this.text.readout}: {ports.map(p => `${p} ${Math.round(hub.motors['ABCDEF'.indexOf(p)].position)}°`).join(' · ')}
                    {sensorPorts.length ? ' · ' + sensorPorts.map(p => `${p} ${fmt(p, hub.sensors['ABCDEF'.indexOf(p)])}`).join(' · ') : ''}
                    {hub.imu ? ` · yaw ${Math.round(hub.imu.yaw)}°` : ''}
                    {air.length ? ` · ${this.text.air} ${air.map(n => `${Math.round(n.kPa)} kPa`).join(' / ')}` : ''}
                </span>
            </div>
        );
    }

    /** The whole LDraw catalogue's part list, for the palette's "+" (lib/bw-sim/ldraw/ldraw-catalog.js). */
    openCatalogue () {
        return this.lib.ldrawCatalogue().then(catalogue => catalogue.catalog());
    }

    /**
     * Adds a catalogue part: derived (lib/bw-sim/part-meta/catalog-parts.js), its LDraw files joined to
     * the editor's (the view and the palette pictures read from that one map), and armed for placing.
     */
    async addCatalogPart (part) {
        // the files join the editor's map before the part joins the catalogue (sim-lab.js addCatalogPart)
        const added = await this.lib.addCatalogPart(part, {into: this.catalogFiles ? this.catalogFiles.files : null});
        if (this.disposed) return added;
        this.requestThumb(part); // its picture, now that its files are here (a draw before them kept none)
        this.editView?.setTool(part);
        this.setState(s => ({placing: part, recent: this.lib.pushRecent(s.recent, part),
            drawer: this.compact() ? false : s.drawer}));
        return added;
    }

    /**
     * A catalogue result's picture: its LDraw files from the catalogue, kept in the editor's map (so
     * adding the part later fetches nothing new), drawn by the palette's renderer. Four at a time.
     */
    cataloguePreview (part) {
        const run = async () => {
            if (!this.thumbs || !this.catalogFiles) return null;
            await this.lib.ldrawCatalogue();
            const closure = await this.lib.fetchLDrawClosure([part]);
            if (!closure.files.has(`parts/${part.toLowerCase()}`) || this.disposed || !this.thumbs) return null;
            for (const [path, text] of closure.files) this.catalogFiles.files.set(path, text);
            return this.thumbs.render(part) || null;
        };
        const queue = this.previewQueue || (this.previewQueue = {active: 0, waiting: []});
        return new Promise((resolve, reject) => {
            const start = () => {
                queue.active++;
                run().then(resolve, reject).finally(() => {
                    queue.active--;
                    const next = queue.waiting.shift();
                    if (next) next();
                });
            };
            if (queue.active < 4) start();
            else queue.waiting.push(start);
        });
    }

    /** Removes a part added from the catalogue, unless the model in Build uses it. */
    removeCatalogPart (part) {
        const model = this.editor ? this.editor.model : null;
        if (model && model.parts.some(p => p.part === part)) return {ok: false, reason: 'in-use'};
        if (this.state.placing === part) this.editView?.setTool(null);
        this.lib.removeCatalogPart(part);
        this.setState(s => ({recent: s.recent.filter(p => p !== part), placing: s.placing === part ? null : s.placing}));
        return {ok: true};
    }

    /** A palette tile came into view: its picture is drawn in a coming frame. */
    requestThumb (part) {
        if (this.thumbs && !this.thumbs.has(part)) this.thumbQueue.add(part);
    }

    /** Draws waiting palette pictures for at most a few milliseconds per frame, so opening Build stays smooth. */
    drawThumbs () {
        if (!this.thumbs || !this.thumbQueue.size) return;
        const start = performance.now();
        for (const part of this.thumbQueue) {
            this.thumbQueue.delete(part);
            this.thumbs.render(part);
            if (performance.now() - start > 6) break;
        }
        this.setState(s => ({thumbTick: s.thumbTick + 1}));
    }

    /** A click on a palette tile arms (or disarms) the placing tool, unless the press was dragged out. */
    armPart (part, how = {}) {
        if (this.paletteDragged) { this.paletteDragged = false; return; }
        // Target-first: a lit connector was clicked; a part that fits goes straight into it.
        if (this.editView && this.editView.pinnedTarget && this.editView.fitsTarget(part)) {
            this.editView.placeIntoTarget(part);
            this.setState(s => ({placing: null, drawer: this.compact() ? false : s.drawer}));
            return;
        }
        const next = this.state.placing === part ? null : part;
        // Enter on a tile, or a finger's tap: the ghost starts on the target nearest the view's centre.
        this.editView?.setTool(next, {centre: Boolean(next && (how.keyboard || this.tilePointer === 'touch'))});
        // The drawer closes once a part is armed, so the whole view is free for the click that places it.
        this.setState({placing: next, drawer: next && this.compact() ? false : this.state.drawer});
    }

    /** A press on a palette tile: the editor view follows it; dragged into the view, it places the part there. */
    pressPart (part, event) {
        this.paletteDragged = false;
        this.tilePointer = event.pointerType;
        if (event.button !== 0 || !this.editView) return;
        event.preventDefault(); // no text selection or native image drag while it is dragged out
        this.editView.pressPalettePart(part, event, ({dragged}) => {
            this.paletteDragged = dragged;
            if (dragged) this.setState({paletteDragging: false, drawer: false});
        });
    }

    renderPalette () {
        return (
            <SimLabPalette key={this.thumbs ? 'pictures' : 'names'} text={this.text} lib={this.lib} locale={this.locale}
                placing={this.state.placing} recent={this.state.recent} thumbs={this.thumbs} thumbTick={this.state.thumbTick}
                requestThumb={this.requestThumb} onArm={this.armPart} onPress={this.pressPart}
                fits={this.state.hold && this.state.hold.pinned && this.editView ? part => this.editView.fitsTarget(part) : null}
                onOpenCatalogue={this.openCatalogue} onAddCatalogPart={this.addCatalogPart}
                onCataloguePreview={this.cataloguePreview} onRemoveCatalogPart={this.removeCatalogPart} />
        );
    }

    /** What the screen reader hears for a new target or a refusal (aria-live). */
    announceText (info) {
        const C = this.etext.connect;
        const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));
        if (!info) return '';
        if (info.kind === 'refused') return fill(C.refusedPlace, {target: info.target ? this.partName(info.target) : ''});
        const values = {part: this.partName(info.part), target: info.target ? this.partName(info.target) : '',
            connector: C.connector[this.connectorType(info)] || C.connectorOther, n: info.index + 1, of: info.of,
            face: C.faces[info.face] || '', pairs: info.pairs === 1 ? C.pairsOne : fill(C.pairsMany, {n: info.pairs}),
            into: info.into ? this.partName(info.into) : ''};
        return fill(info.kind === 'blocked' ? C.announceBlocked : C.announce, values);
    }

    /** A connector's type, from the part's metadata. */
    connectorType ({target, connector}) {
        const m = this.lib && target && this.lib.CATALOG.get(target);
        const c = m && m.connectors.find(x => x.id === connector);
        return c ? c.type : null;
    }

    /** How the 3D view reads a scroll ('auto', 'mouse', 'trackpad'), kept in this browser. */
    storedWheelMode () {
        try {
            const v = localStorage.getItem(WHEEL_STORAGE_KEY);
            return ['auto', 'mouse', 'trackpad'].includes(v) ? v : 'auto';
        } catch {
            return 'auto';
        }
    }

    storedMousePreset () {
        try {
            return localStorage.getItem(MOUSE_PRESET_KEY) === 'studio' ? 'studio' : 'brickwright';
        } catch {
            return 'brickwright';
        }
    }

    /** The mouse preset for both views (camera-nav.js MOUSE_PRESETS), kept on this device. */
    setMousePreset (mousePreset) {
        this.setState({mousePreset});
        this.editView?.setMousePreset(mousePreset);
        this.view?.setMousePreset(mousePreset);
        try { localStorage.setItem(MOUSE_PRESET_KEY, mousePreset); } catch { /* private window: this session only */ }
    }

    setWheelMode (wheelMode) {
        this.setState({wheelMode});
        this.editView?.setWheelMode(wheelMode);
        try { localStorage.setItem(WHEEL_STORAGE_KEY, wheelMode); } catch { /* private window: this session only */ }
    }

    /**
     * Build: the hint bar (what the keys do now), the target chip (Target-first) and, for a finger,
     * the ✓ / ⟳ / ✕ buttons for the part in hand; plus the screen reader's announcements.
     */
    renderHoldOverlays () {
        const C = this.etext.connect;
        const hold = this.state.hold || {holding: false};
        const view = this.editView;
        let hint;
        if (hold.holding) {
            const dragging = !hold.part;
            hint = dragging ? C.hintDragging : hold.touch ? C.hintHoldingTouch : hold.keyboard ? C.hintHoldingKeyboard : C.hintHolding;
            if (hold.round) hint = `${hint} · ${C.hintFine}`;
            if (hold.tone === 'blocked') hint = `${C.hintBlocked} · ${hint}`;
        } else if (hold.pinned) {
            hint = C.hintTarget;
        } else {
            hint = null; // idle: the build (i) holds the how-to, the view stays clear
        }
        const pin = hold.pinned;
        const pinNumber = pin && /(\d+)$/.exec(pin.connectorId);
        const chipBase = {display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 999, fontSize: 12, boxShadow: '0 1px 4px rgba(15, 23, 42, 0.2)'};
        const touchButton = {minWidth: 48, minHeight: 48, borderRadius: 999, border: '1px solid #94a3b8', background: '#fff', fontSize: 20, cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(15, 23, 42, 0.25)'};
        return (
            <React.Fragment>
                {hint && <div data-testid="bw-sim-lab-hint-bar" data-holding={hold.holding ? 'yes' : 'no'} data-tone={hold.tone || ''}
                    style={{position: 'absolute', left: 8, bottom: 8, right: 108, zIndex: 3, pointerEvents: 'none', display: 'flex', justifyContent: 'flex-start'}}>
                    <span style={{background: hold.tone === 'blocked' ? 'rgba(254, 226, 226, 0.95)' : 'rgba(248, 250, 252, 0.92)', color: hold.tone === 'blocked' ? '#991b1b' : '#334155',
                        borderRadius: 6, padding: '3px 8px', fontSize: 12, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.15)'}}>{hint}</span>
                </div>}
                {pin && (
                    <div data-testid="bw-sim-lab-target-chip" style={{position: 'absolute', left: 8, top: 8, zIndex: 4, ...chipBase, background: '#fef3c7', color: '#92400e', fontWeight: 600}}>
                        {C.targetChip.replace('{target}', this.partName(pin.part))
                            .replace('{connector}', C.connector[this.connectorType({target: pin.part, connector: pin.connectorId})] || C.connectorOther)
                            .replace('{n}', pinNumber ? Number(pinNumber[1]) + 1 : '')}
                        <button type="button" data-testid="bw-sim-lab-target-clear" title={C.clearTarget} aria-label={C.clearTarget}
                            onClick={() => view?.clearTarget()} style={{border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 14, color: '#92400e', padding: 0}}>✕</button>
                    </div>
                )}
                {hold.holding && hold.part && (hold.touch || this.state.coarse) && (
                    <div role="group" aria-label={C.touchControls} data-testid="bw-sim-lab-touch-hold"
                        style={{position: 'absolute', right: 108, bottom: 44, zIndex: 5, display: 'flex', gap: 8}}>
                        <button type="button" data-testid="bw-sim-lab-touch-place" title={C.touchPlace} aria-label={C.touchPlace} style={touchButton}
                            onClick={() => view?.placeHeld()}>✓</button>
                        <button type="button" data-testid="bw-sim-lab-touch-turn" title={C.touchTurn} aria-label={C.touchTurn} style={touchButton}
                            onClick={() => view?.turn('up', 1)}>⟳</button>
                        <button type="button" data-testid="bw-sim-lab-touch-cancel" title={C.touchCancel} aria-label={C.touchCancel} style={touchButton}
                            onClick={() => { view?.setTool(null); this.setState({placing: null}); }}>✕</button>
                    </div>
                )}
                <div data-testid="bw-sim-lab-announce" aria-live="polite" role="status"
                    style={{position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap'}}>
                    {this.state.announce}
                </div>
            </React.Fragment>
        );
    }

    /** The build view's status (what is happening / what a click will do), in the learner's language. */
    buildStatusText () {
        const st = this.state.buildStatus || {kind: 'idle'};
        const T = this.text.st;
        const E = this.etext.st;
        const name = part => this.partName(part);
        const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));
        const hole = st.connector && /^[a-z](\d+)$/.exec(st.connector);
        switch (st.kind) {
        case 'hover': return fill(st.selected ? T.hoverSelected : T.hover, {part: name(st.part)});
        case 'placing': return fill(this.state.coarse ? T.placingTouch : T.placing, {part: name(st.part)});
        case 'dragging': return fill(T.dragging, {part: name(st.part)});
        case 'snap': case 'snapped': case 'turnedAbout': {
            const target = st.target ? name(st.target) : '';
            if (st.kind === 'turnedAbout') return fill(T.turnedAbout, {target});
            return hole ? fill(T[st.kind], {target, hole: Number(hole[1]) + 1}) : fill(T[`${st.kind}NoHole`], {target});
        }
        case 'gizmo': {
            const color = T[{X: 'red', Y: 'green', Z: 'blue'}[st.axis]] || '';
            if (st.mode === 'rotate') return fill(T.gizmoRing, {color});
            return fill(st.axis.length === 1 ? T.gizmoArrow : T.gizmoPlane, {color, axis: st.axis.toLowerCase()});
        }
        case 'onTop': return fill(T.onTop, {target: name(st.target)});
        case 'moving': return fill(T.moving, {x: st.delta[0], y: -st.delta[1], z: -st.delta[2]});
        case 'turning': return fill(T.turning, {deg: st.degrees});
        case 'placed': return fill(T.placed, {part: name(st.part)});
        case 'blocked': return fill(T.blocked, {target: name(st.target)});
        case 'refused': return fill(T[st.reason] || E[st.reason] || this.etext.connect.st[st.reason] || T.invalid, {detail: st.detail || '', target: st.target ? name(st.target) : ''});
        case 'released': return fill(this.etext.connect.st.released, {target: name(st.target)});
        case 'targetPinned': {
            const C = this.etext.connect;
            const num = st.connector && /(\d+)$/.exec(st.connector);
            return fill(C.st.targetPinned, {target: name(st.target), connector: C.connector[this.connectorType(st)] || C.connectorOther, hole: num ? Number(num[1]) + 1 : ''});
        }
        case 'targetCleared': case 'flipped': return this.etext.connect.st[st.kind];
        case 'connectedSelected': return fill(this.etext.connect.st.connectedSelected, {n: st.count});
        case 'painted': return fill(E.painted, {n: st.count, colour: this.colourName(st.color)});
        case 'pickedColor': return fill(E.pickedColor, {colour: this.colourName(st.color), part: name(st.part)});
        case 'measured': return fill(E.measured, {ldu: this.decimal(st.ldu), studs: this.decimal(st.studs), mm: this.decimal(st.mm)});
        case 'mirrored': return fill(st.kept ? E.mirroredKept : st.swapped ? E.mirroredSwapped : E.mirrored, {n: st.count, s: st.swapped, k: st.kept});
        case 'groupEdit': case 'groupLeft': return fill(E[st.kind], {name: st.name || ''});
        case 'turnedBy': return fill(E.turnedBy, {deg: st.degrees});
        case 'hinged': case 'hingeShown': return fill(E[st.kind], {n: st.count, deg: st.degrees, i: st.index + 1, of: st.of});
        case 'chained': return fill(st.tread ? E.treaded : E.chained, {n: st.count, g: st.gears});
        case 'banded': return fill(E.banded, {mm: st.mm, stretch: this.decimal(st.stretch)});
        case 'gliding': return fill(E.gliding, {ldu: this.decimal(st.ldu)});
        case 'roped': return fill(E.roped, {cm: this.decimal(st.cm)});
        case 'hosed': return fill(E.hosed, {from: E.hosePort[st.from] || st.from, to: E.hosePort[st.to] || st.to});
        case 'idle': return ''; // nothing to report; the (i) beside the status explains how to build
        default:
            if (E[st.kind]) return fill(E[st.kind], {n: st.count});
            return T[st.kind] ? fill(T[st.kind], {n: st.count}) : '';
        }
    }

    partName (part) {
        const m = this.lib && this.lib.CATALOG.get(part);
        return m ? ((this.locale === 'de' && m.nameDe) || m.name) : part;
    }

    /** Wide enough for the properties panel to stand beside the 3D view. */
    dockProperties () {
        return this.state.paneWidth >= DOCK_PROPERTIES_PX;
    }

    /** Build: the properties panel, docked beside the view or over its right edge. */
    renderProperties (button, docked) {
        if (!this.editor || !this.palette) return null;
        const field = this.state.coarse ? {minHeight: 40} : undefined;
        return (
            <SimLabProperties T={this.etext} lib={this.lib} editor={this.editor} view={this.editView} selectionIds={this.state.selection}
                palette={this.palette} colourName={code => this.colourName(code)} placeColor={this.state.placeColor ?? this.lib.DEFAULT_COLOR}
                pick={this.state.pick} editGroup={this.state.editGroup} partName={part => this.partName(part)} tick={this.state.editorTick}
                onColour={code => this.pickColour(code)} onTick={() => this.setState(s => ({editorTick: s.editorTick + 1}))}
                onClose={docked ? null : () => this.setState({propsOpen: false})} button={button} field={field} docked={docked} />
        );
    }

    /** One issue in a child's words; one that names parts is a button that shows them. */
    renderIssue (issue, key) {
        const sentence = issueSentence(this.itext, issue, id => this.partNameById(id));
        const color = issue.severity === 'error' ? '#b91c1c' : '#334155';
        if (!(issue.parts && issue.parts.length)) {
            return <li key={key} data-testid="bw-sim-lab-issue" data-code={issue.code} title={issue.message} style={{color}}>{sentence}</li>;
        }
        return (
            <li key={key} data-testid="bw-sim-lab-issue" data-code={issue.code} style={{color}}>
                <button type="button" data-testid={`bw-sim-lab-issue-${issue.code}`} data-parts={issue.parts.join(' ')}
                    title={this.itext.issueHelp} onClick={() => this.focusIssue(issue)}
                    style={{font: 'inherit', color: 'inherit', textAlign: 'left', background: 'none', border: 'none', padding: 0,
                        cursor: 'pointer', textDecoration: 'underline dotted'}}>
                    {sentence}
                </button>
            </li>
        );
    }

    /** What stops Run from doing what a child expects, said before Run. */
    renderBlockers () {
        const blockers = this.state.blockers || [];
        if (!blockers.length || this.state.status === 'loading') return null;
        if (this.compact()) {
            // One line ("Before you press Run: (2)") that opens to the list.
            return (
                <SimLabNotice content={blockers} testId="bw-sim-lab-blockers" closeLabel={`${this.itext.close}: ${this.itext.blockersTitle}`}>
                    <details role="alert" data-testid="bw-sim-lab-blockers"
                        style={{fontSize: 12, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, padding: '4px 32px 4px 8px', minWidth: 0}}>
                        <summary style={{cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                            <strong>{this.itext.blockersTitle}</strong> ({blockers.length})
                        </summary>
                        <ul style={{margin: '2px 0 0', paddingLeft: 18}}>
                            {blockers.map(b => this.renderIssue({...b, severity: 'warning'}, b.code))}
                        </ul>
                    </details>
                </SimLabNotice>
            );
        }
        return (
            <SimLabNotice content={blockers} testId="bw-sim-lab-blockers" closeLabel={`${this.itext.close}: ${this.itext.blockersTitle}`}>
                <div role="alert" data-testid="bw-sim-lab-blockers"
                    style={{fontSize: 12, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fdba74', borderRadius: 6, padding: '6px 32px 6px 8px'}}>
                    <strong>{this.itext.blockersTitle}</strong>
                    <ul style={{margin: '2px 0 0', paddingLeft: 18}}>
                        {blockers.map(b => this.renderIssue({...b, severity: 'warning'}, b.code))}
                    </ul>
                </div>
            </SimLabNotice>
        );
    }

    renderIssues () {
        const issues = this.state.issues;
        if (!issues.length) return null;
        const compact = this.compact();
        const T = this.text;
        return (
            <SimLabNotice content={issues} testId="bw-sim-lab-issues" closeLabel={`${this.itext.close}: ${T.issues}`}>
                <details data-testid="bw-sim-lab-issues" style={{fontSize: 12, paddingRight: 32}} open={!compact && issues.some(i => i.code !== 'locked-hinges')}>
                    <summary style={compact ? {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer'} : {cursor: 'pointer'}}>
                        {T.issues} ({issues.length})
                    </summary>
                    <ul style={{margin: '4px 0', paddingLeft: 18, maxHeight: 120, overflowY: 'auto'}}>{issues.map((i, n) => this.renderIssue(i, n))}</ul>
                </details>
            </SimLabNotice>
        );
    }

    /** Build: the ports offered next to a clicked port badge. */
    renderPortPicker (button) {
        const picker = this.state.portPicker;
        if (!picker || !this.editor) return null;
        const placed = this.editor.model.parts.find(p => p.id === picker.id);
        if (!placed) return null;
        const title = fillText(this.itext.portPick, {part: this.partName(placed.part)});
        const small = {...button, padding: '2px 7px', marginRight: 0};
        return (
            <div role="dialog" aria-label={title} data-testid="bw-sim-lab-port-picker"
                onKeyDown={e => e.key === 'Escape' && this.setState({portPicker: null})}
                style={{position: 'absolute', left: picker.left, top: picker.top, zIndex: 5, display: 'flex', alignItems: 'center', flexWrap: 'wrap',
                    gap: 3, maxWidth: 320, fontSize: 12, background: '#fff', border: '1px solid #94a3b8', borderRadius: 6, padding: 5,
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.2)'}}>
                <span style={{fontWeight: 600, marginRight: 4}}>{title}</span>
                {['', 'A', 'B', 'C', 'D', 'E', 'F'].map(port => (
                    <button key={port || 'none'} type="button" data-testid={`bw-sim-lab-port-pick-${port || 'none'}`}
                        aria-pressed={(placed.port || '') === port}
                        style={{...small, fontWeight: (placed.port || '') === port ? 700 : 400, background: (placed.port || '') === port ? '#dbeafe' : '#fff'}}
                        onClick={() => this.pickPort(picker.id, port)}>
                        {port || this.itext.portNone}
                    </button>
                ))}
                <button type="button" style={small} aria-label={this.itext.close} onClick={() => this.setState({portPicker: null})}>×</button>
            </div>
        );
    }

    /** A note for the learner (the info box); compact, it is one line that opens on a click. */
    renderInfo () {
        const info = this.state.info;
        if (!info || this.state.mode !== 'simulate' || !this.state.infoOpen) return null;
        const box = {fontSize: 12, color: '#1e3a8a', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '6px 8px'};
        // One line at every width (owner request: no long text on screen); a click shows all of it.
        const open = this.state.infoOpen;
        return (
            <div role="status" data-testid="bw-sim-lab-info" style={{...box, padding: '4px 8px', minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 6}}>
                {/* the toggle is its own small button: the note's words are not part of any button's name */}
                <button type="button" aria-expanded={open} aria-label={this.text.infoToggle} title={this.text.infoToggle}
                    onClick={() => this.setState(s => ({infoOpen: !s.infoOpen}))}
                    style={{flex: '0 0 auto', font: 'inherit', color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer'}}>
                    {open ? '▾' : '▸'}
                </button>
                <span onClick={() => this.setState(s => ({infoOpen: !s.infoOpen}))}
                    style={{flex: '1 1 auto', minWidth: 0, cursor: 'pointer', ...(open ? {} : {whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'})}}>
                    {info}
                </span>
            </div>
        );
    }

    /** The Build view or the Simulate view, whichever is on show (both take the camera actions). */
    camera3d () {
        return this.state.mode === 'build' ? this.editView : this.view;
    }

    /**
     * Every toolbar action once: id (its test id is `bw-sim-lab-<id>`, its tooltip's shortcut is
     * TOOLBAR_TEXT.keys[id]), label, icon, what it does, and its priority on a narrow bar
     * (pri 1 stays, 2 and 3 go to the More menu first).
     */
    actions () {
        const A = this.ttext.actions;
        const T = this.text;
        const I = this.itext;
        const editor = this.editor;
        const view = this.editView;
        const parts = editor ? editor.model.parts : [];
        const selection = this.state.selection;
        const nothing = !selection.length && !this.state.placing;
        const tick = () => this.setState(s => ({editorTick: s.editorTick + 1}));
        const busy = this.state.status === 'loading' || this.state.programLoading;
        const running = this.state.status === 'running';
        const narrow = !this.modeWords();
        const cam = this.camera3d();
        const noCam = !cam || busy;
        const docked = this.dockProperties();
        const s = toolStyles(this.state.coarse);
        return {
            run: running ?
                {id: 'pause', label: A.pause, icon: 'pause', words: narrow ? null : A.pause, style: s.stop, run: () => this.pause(), pri: 1, pin: true} :
                {id: 'run', label: A.run, icon: 'run', words: narrow ? null : A.run, style: s.primary, pri: 1, pin: true,
                    disabled: !this.session || busy || this.state.status === 'stopping', run: () => this.run()},
            reset: {id: 'reset', label: A.reset, disabled: !this.session || busy, run: () => this.reset(), pri: 1, pin: true},
            'mode-move': {id: 'mode-move', label: A['mode-move'], pressed: this.state.gizmoMode === 'move', run: () => view?.setMode('move'), pri: 1, pin: true},
            'mode-rotate': {id: 'mode-rotate', label: A['mode-rotate'], pressed: this.state.gizmoMode === 'rotate', run: () => view?.setMode('rotate'), pri: 1, pin: true},
            turn: {id: 'turn', label: A.turn, disabled: nothing, run: () => view?.turn('up', 1), pri: 1},
            'turn-back': {id: 'turn-back', label: A['turn-back'], disabled: nothing, run: () => view?.turn('up', -1), pri: 3},
            tip: {id: 'tip', label: A.tip, disabled: !selection.length, run: () => view?.turn('facing', 1), pri: 3},
            group: {id: 'group', label: A.group, disabled: selection.length < 2, run: () => { view?.groupSelection(); tick(); }, pri: 3},
            ungroup: {id: 'ungroup', label: A.ungroup, pri: 3,
                disabled: !(editor?.model.groups || []).some(g => g.parts.some(id => selection.includes(id))),
                run: () => { view?.ungroupSelection(); tick(); }},
            duplicate: {id: 'duplicate', label: A.duplicate, disabled: !selection.length, run: () => view?.duplicate(), pri: 3},
            delete: {id: 'delete', label: A.delete, disabled: !selection.length, run: () => view?.deleteSelection(), pri: 1},
            cancel: {id: 'cancel', label: A.cancel, disabled: nothing, run: () => view?.escape(), pri: 1},
            copy: {id: 'copy', label: A.copy, disabled: !selection.length, run: () => view?.copy(), pri: 3},
            paste: {id: 'paste', label: A.paste, run: () => view?.paste(), pri: 3},
            'select-all': {id: 'select-all', label: A['select-all'], disabled: !parts.length, run: () => view?.selectAll(), pri: 3},
            undo: {id: 'undo', label: A.undo, disabled: !editor?.canUndo, run: () => { view?.undo(); tick(); }, pri: 1, pin: true},
            redo: {id: 'redo', label: A.redo, disabled: !editor?.canRedo, run: () => { view?.redo(); tick(); }, pri: 2},
            'view-home': {id: 'view-home', label: A['view-home'], disabled: noCam, run: () => cam?.view?.('home'), pri: 2},
            'view-fit': {id: 'view-fit', label: A['view-fit'], disabled: noCam,
                run: () => (this.state.mode === 'build' ? view?.fitSelection() : this.view?.fit?.()), pri: 2},
            'view-top': {id: 'view-top', label: A['view-top'], disabled: noCam, run: () => cam?.view?.('top'), pri: 3},
            'view-front': {id: 'view-front', label: A['view-front'], disabled: noCam, run: () => cam?.view?.('front'), pri: 3},
            'view-side': {id: 'view-side', label: A['view-side'], disabled: noCam, run: () => cam?.view?.('side'), pri: 3},
            'show-ports': {id: 'show-ports', label: I.showPorts, title: I.showPortsHelp, kind: 'switch', pressed: this.state.showPorts,
                run: () => this.setOverlay({showPorts: !this.state.showPorts}), pri: 3},
            'show-motion': {id: 'show-motion', label: I.showMotion, title: I.showMotionHelp, kind: 'switch', pressed: this.state.showMotion,
                run: () => this.setOverlay({showMotion: !this.state.showMotion}), pri: 3},
            'mirror-x': {id: 'mirror-x', label: A['mirror-x'], disabled: !selection.length, run: () => { view?.mirror('x'); tick(); }, pri: 3},
            'mirror-z': {id: 'mirror-z', label: A['mirror-z'], disabled: !selection.length, run: () => { view?.mirror('z'); tick(); }, pri: 3},
            hide: {id: 'hide', label: A.hide, disabled: !selection.length, run: () => view?.hideSelection(), pri: 3},
            isolate: {id: 'isolate', label: A.isolate, disabled: !selection.length, run: () => view?.isolate(), pri: 3},
            'show-all': {id: 'show-all', label: A['show-all'], disabled: !this.state.hidden.length, run: () => view?.showAll(), pri: 3},
            measure: {id: 'measure', label: A.measure, pressed: this.state.pick === 'measure', run: () => view?.setPick('measure'), pri: 3},
            eyedropper: {id: 'eyedropper', label: A.eyedropper, title: this.etext.eyedropperHelp, pressed: this.state.pick === 'color',
                run: () => view?.setPick('color'), pri: 3},
            'parts-toggle': {id: 'parts-toggle', label: A['parts-toggle'], title: T.partsToggle, pri: 1, pin: true,
                pressed: this.compact() ? this.state.drawer : this.state.paletteOpen,
                words: this.compact() && this.state.paneWidth >= 560 && !this.state.coarse ? A['parts-toggle'] : null,
                run: () => this.setState(st => (this.compact() ? {drawer: !st.drawer} : {paletteOpen: !st.paletteOpen}))},
            properties: {id: 'properties', label: A.properties, title: this.etext.propertiesHelp, pri: 2,
                pressed: docked ? this.state.propsDocked : this.state.propsOpen,
                run: () => this.setState(st => (docked ? {propsDocked: !st.propsDocked} : {propsOpen: !st.propsOpen}))},
            shortcuts: {id: 'shortcuts', label: A.shortcuts, title: this.etext.shortcutsHelp, run: () => this.setState({shortcuts: true, menu: null}), pri: 3},
            grid: {id: 'grid', label: A.grid, pri: 3, width: 96, render: inMenu => this.renderGrid(inMenu)},
            speed: {id: 'speed', label: A.speed, pri: 1, pin: true, width: 84, render: inMenu => this.renderSpeed(inMenu)},
            'show-sensors': {id: 'show-sensors', label: A['show-sensors'], kind: 'switch', pressed: this.state.showSensors,
                run: () => this.setOverlay({showSensors: !this.state.showSensors}), pri: 3},
            measurements: {id: 'measurements', label: measurementWords(this.locale).title, icon: 'measure', kind: 'switch', pressed: this.state.measurementsOpen,
                run: () => this.setState(s => ({measurementsOpen: !s.measurementsOpen})), pri: 2},
            readings: {id: 'readings', label: A.readings, kind: 'switch', pressed: this.state.readings,
                run: () => this.setState(s => ({readings: !s.readings})), pri: 2},
            'show-stats': {id: 'show-stats', label: A['show-stats'], kind: 'switch', pressed: this.state.showStats,
                run: () => this.setState(s => ({showStats: !s.showStats})), pri: 3},
            challenges: {id: 'challenges', label: A.challenges, kind: 'switch', pressed: this.state.challengesOpen,
                run: () => this.setState(s => ({challengesOpen: !s.challengesOpen})), pri: 2},
            file: {id: 'file-menu', label: A['file-menu'], pri: 2, width: 46, render: inMenu => this.renderFile(inMenu)}
        };
    }

    /** The toolbar's groups after the mode switch, for the mode on show. */
    toolbarGroups () {
        const a = this.actions();
        const G = this.ttext.groups;
        const pick = (id, label, ids) => ({id, label, items: ids.map(k => (typeof k === 'string' ? a[k] : k))});
        if (this.state.mode === 'build') {
            return [
                pick('edit', G.edit, ['mode-move', 'mode-rotate', 'turn', 'turn-back', 'tip']),
                // While a part is armed there is nothing to delete: Cancel takes Delete's place up front.
                pick('arrange', G.arrange, [this.state.placing ? 'cancel' : 'delete', 'duplicate', 'copy', 'paste', 'select-all', 'group', 'ungroup',
                    {...a[this.state.placing ? 'delete' : 'cancel'], pri: 3}]),
                pick('history', G.edit, ['undo', 'redo']),
                pick('view', G.view, ['view-home', 'view-fit', 'view-top', 'view-front', 'view-side', 'grid']),
                pick('show', G.show, ['show-ports', 'show-motion']),
                pick('tools', G.tools, ['mirror-x', 'mirror-z', 'hide', 'isolate', 'show-all', 'measure', 'eyedropper']),
                pick('panels', G.panels, ['parts-toggle', 'properties', 'shortcuts']),
                pick('file', G.file, ['file'])
            ];
        }
        return [
            pick('run', G.run, ['run', 'reset', 'speed', 'challenges']),
            pick('view', G.view, ['view-home', 'view-fit', 'view-top', 'view-front', 'view-side']),
            pick('show', G.show, ['show-ports', 'show-motion', 'show-sensors', 'readings', 'measurements', 'show-stats']),
            pick('file', G.file, ['file'])
        ];
    }

    /** One toolbar entry: a button, or a control of its own (the grid step, the File menu). */
    renderTool (item, inMenu) {
        if (item.render) return <React.Fragment key={item.id}>{item.render(inMenu)}</React.Fragment>;
        return <ToolButton key={item.id} item={item} T={this.ttext} coarse={this.state.coarse} inMenu={inMenu} />;
    }

    /** Build's grid step: an icon and a list. */
    renderGrid (inMenu) {
        const A = this.ttext.actions;
        const field = this.state.coarse ? {minHeight: 40} : {height: 28};
        return (
            <label title={A.grid} style={{display: 'inline-flex', alignItems: 'center', gap: 4, padding: inMenu ? '0 8px' : '0 4px', fontSize: 12, flex: '0 0 auto'}}>
                <Icon name="grid" />
                {inMenu ? <span style={{flex: '1 1 auto'}}>{A.grid}</span> : null}
                <select data-testid="bw-sim-lab-grid" aria-label={A.grid} value={this.state.grid} style={field}
                    onChange={e => { const g = Number(e.target.value); this.editView?.setGrid(g); this.setState({grid: g}); }}>
                    {[1, 5, 10, 20].map(g => <option key={g} value={g}>{this.ttext.gridValue.replace('{n}', g)}</option>)}
                </select>
            </label>
        );
    }

    /** One set of file commands for the toolbar and the shared File menu. */
    fileActions () {
        const A = this.ttext.actions;
        const T = this.text;
        const busy = this.state.status === 'loading' || this.state.programLoading;
        const model = this.editor ? this.editor.model : this.session?.model;
        return [
            {id: 'open', label: A.open, title: T.importHelp, icon: 'open', disabled: busy || !this.lib, run: () => this.file.current.click()},
            ...SAVE_FORMATS.map(format => ({id: `save-${format}`, label: `${A.save} ${T.saveFormats[format]}`, title: T.saveHelp, icon: 'save',
                disabled: busy || !model, run: () => this.saveAs(format)}))
        ];
    }

    /** "Open…" and "Save as" the three formats: a File menu on the bar, rows in the More menu. */
    renderFile (inMenu) {
        const A = this.ttext.actions;
        const items = this.fileActions().map(item => <ToolButton key={item.id} item={item} T={this.ttext} coarse={this.state.coarse} inMenu />);
        if (inMenu) return items;
        const s = toolStyles(this.state.coarse);
        return (
            <Popup id="file" open={this.state.menu === 'file'} label={A['file-menu']} width={250} testId="bw-sim-lab-file-list"
                onToggle={() => this.toggleMenu('file')} onClose={() => this.setState({menu: null})}
                button={(
                    <button type="button" data-testid="bw-sim-lab-file-menu" aria-label={A['file-menu']} title={A['file-menu']} style={s.button}>
                        <Icon name="file-menu" /><Icon name="caret" size={12} />
                    </button>
                )}>
                {items}
            </Popup>
        );
    }

    /** Help: what the Lab is (the sentence that used to sit above everything) and how the view moves. */
    renderHelp () {
        const TT = this.ttext;
        const s = toolStyles(this.state.coarse);
        const rows = list => (
            <table style={{borderCollapse: 'collapse', width: '100%', margin: '2px 0 8px'}}>
                <tbody>
                    {list.map(([keys, what]) => (
                        <tr key={keys} style={{borderTop: '1px solid #e2e8f0'}}>
                            <td style={{padding: '3px 6px 3px 0', width: '45%', verticalAlign: 'top', fontWeight: 600}}>{keys}</td>
                            <td style={{padding: '3px 0', color: '#334155'}}>{what}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
        return (
            <Popup id="help" open={this.state.menu === 'help'} label={TT.actions.help} width={360} align="right" closeOnPick
                onToggle={() => this.toggleMenu('help')} onClose={() => this.setState({menu: null})}
                button={(
                    <button type="button" data-testid="bw-sim-lab-help" aria-label={TT.actions.help} title={TT.actions.help} style={s.button}>
                        <Icon name="help" />
                    </button>
                )}>
                <div data-testid="bw-sim-lab-help-popover" style={{padding: 4, lineHeight: 1.4}}>
                    <strong style={{fontSize: 13}}>{TT.helpTitle}</strong>
                    <p style={{margin: '4px 0 8px', color: '#334155'}}>{TT.helpIntro}</p>
                    <strong>{TT.cameraTitle}</strong>
                    {rows(TT.camera)}
                    {this.state.mode === 'build' && <strong>{TT.buildTitle}</strong>}
                    {this.state.mode === 'build' && rows(TT.build)}
                    {this.state.mode === 'build' && (
                        <button type="button" data-testid="bw-sim-lab-help-shortcuts" style={{...s.button, border: '1px solid #94a3b8'}}
                            onClick={() => this.setState({shortcuts: true})}>{TT.allShortcuts}</button>
                    )}
                </div>
            </Popup>
        );
    }

    /** Simulate | Build | Instructions, as one segmented control. */
    renderModeSwitch () {
        const A = this.ttext.actions;
        const busy = this.state.status === 'loading' || this.state.programLoading;
        const words = this.modeWords();
        const model = this.editor ? this.editor.model : this.session?.model;
        const s = toolStyles(this.state.coarse);
        const seg = on => ({...s.button, borderRadius: 6, padding: words ? '0 9px' : '0 6px', fontWeight: on ? 600 : 400,
            ...(on ? {background: '#fff', borderColor: '#6366f1', color: '#312e81', boxShadow: '0 1px 2px rgba(15, 23, 42, 0.18)'} : {})});
        const items = [
            {id: 'mode-simulate', icon: 'simulate', label: A.simulate, on: this.state.mode === 'simulate', disabled: busy || !this.lib,
                run: () => this.state.mode !== 'simulate' && this.exitBuild()},
            {id: 'mode-build', icon: 'build', label: A.build, on: this.state.mode === 'build', disabled: busy || !this.lib,
                run: () => this.state.mode !== 'build' && this.enterBuild()},
            {id: 'instructions', icon: 'instructions', label: A.instructions, on: Boolean(this.state.instructions), title: this.text.instructionsHelp,
                disabled: busy || !this.lib || !model?.parts.length, run: () => this.setState({instructions: model})}
        ];
        return (
            <div role="group" aria-label={this.ttext.groups.mode} data-testid="bw-sim-lab-mode-switch"
                style={{display: 'inline-flex', gap: 2, padding: 2, borderRadius: 8, background: '#e2e8f0', flex: '0 0 auto'}}>
                {items.map(item => (
                    <button key={item.id} type="button" data-testid={`bw-sim-lab-${item.id}`} aria-pressed={item.on} disabled={item.disabled}
                        aria-label={item.label} title={tooltipOf(this.ttext, item.id, item.label, item.title)} onClick={item.run}
                        style={{...seg(item.on), opacity: item.disabled ? 0.45 : 1}}>
                        <Icon name={item.icon} />{words ? <span>{item.label}</span> : null}
                    </button>
                ))}
            </div>
        );
    }

    /** Whether the mode switch has room for its words. */
    modeWords () {
        return this.state.paneWidth >= MODE_WORDS_PX;
    }

    /** The icon toolbar: the mode switch, the groups that fit, Help, and More for the rest. */
    renderToolbar () {
        const coarse = this.state.coarse;
        const s = toolStyles(coarse);
        const groups = this.toolbarGroups();
        const wrap = false;
        const modeWidth = this.modeWords() ? 330 : 3 * (s.size + 2) + 6;
        const exampleWords = this.state.paneWidth >= 1200;
        const examplesWidth = exampleWords ? 108 : s.size + 4;
        // The pane's padding, the mode switch and Help never leave the bar.
        const {bar, more} = splitToolbar(groups, {width: this.state.paneWidth - 16 - RIGHT_PANE_TOGGLE_PX, coarse,
            reserved: modeWidth + examplesWidth + s.size + (this.state.mode === 'simulate' ? 470 : 8), wrap});
        const TT = this.ttext;
        return (
            <div role="toolbar" aria-label={TT.toolbar} data-testid="bw-sim-lab-toolbar"
                style={{display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'nowrap', minWidth: 0, flexShrink: 0,
                    overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin',
                    paddingRight: RIGHT_PANE_TOGGLE_PX}}>
                {this.renderModeSwitch()}
                <button type="button" data-testid="bw-sim-lab-examples" aria-label={TT.actions.examples} title={TT.actions.examples}
                    disabled={!this.lib || this.state.status === 'loading' || this.state.programLoading} style={{...s.button, display: 'inline-flex', gap: 5, alignItems: 'center', flexShrink: 0}}
                    onClick={() => { if (this.state.status === 'running') this.pause(); this.setState({examplesOpen: true, menu: null}); }}>
                    <Icon name="build" />{exampleWords ? <span>{TT.actions.examples}</span> : null}
                </button>
                {bar.map(g => (
                    <React.Fragment key={g.id}>
                        <Separator coarse={coarse} />
                        <div role="group" aria-label={g.label} data-testid={`bw-sim-lab-group-${g.id}`} style={{display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0}}>
                            {g.items.map(item => this.renderTool(item, false))}
                        </div>
                    </React.Fragment>
                ))}
                {this.state.mode === 'simulate' && this.renderSimulateRow()}
                {this.state.mode === 'simulate' && this.state.info && <button type="button" style={s.button}
                    data-testid="bw-sim-lab-info-toggle" aria-expanded={this.state.infoOpen} aria-label={this.text.infoToggle}
                    title={this.text.infoToggle} onClick={() => this.setState(st => ({infoOpen: !st.infoOpen}))}><Icon name="help" /></button>}
                {this.state.mode === 'simulate' && <button type="button" data-testid="bw-sim-lab-controls-toggle"
                    disabled={this.state.status === 'loading' || this.state.programLoading}
                    aria-expanded={this.state.controlsOpen} aria-label={this.locale === 'de' ? 'Manuelle Steuerung' : 'Manual controls'}
                    title={this.locale === 'de' ? 'Manuelle Steuerung: Fahren, Motoren, Hub-Tasten und Verbindung' : 'Manual controls: drive, motors, brick buttons and connection'} style={s.button}
                    onClick={() => {
                        if (this.state.controlsOpen && this.state.manualOverride) this.setManualOverride(false);
                        if (this.driving) this.drive('stop');
                        this.setState(st => ({controlsOpen: !st.controlsOpen}));
                    }}><Icon name="show-motion" /></button>}
                <span style={{flex: '1 1 0', minWidth: 0}} />
                {this.renderHelp()}
                {more.length > 0 && (
                    <Popup id="more" open={this.state.menu === 'more'} label={TT.actions.more} width={270} align="right"
                        onToggle={() => this.toggleMenu('more')} onClose={() => this.setState({menu: null})}
                        button={(
                            <button type="button" data-testid="bw-sim-lab-more" aria-label={TT.actions.more} title={TT.actions.more} style={s.button}>
                                <Icon name="more" />
                            </button>
                        )}>
                        {more.map(g => (
                            <div key={g.id} role="group" aria-label={g.label} style={{display: 'flex', flexDirection: 'column', gap: 1, paddingBottom: 3,
                                marginBottom: 3, borderBottom: '1px solid #e2e8f0'}}>
                                {g.items.map(item => this.renderTool(item, true))}
                            </div>
                        ))}
                    </Popup>
                )}
            </div>
        );
    }

    /** Below the toolbar in Simulate: the model, the mat, the program route, the example, and the status. */
    renderLessonToggle () {
        if (!this.shippedModel()) return null;
        const label = this.locale === 'de' ? 'Modell-Lektion' : 'Model lesson';
        return <button type="button" data-testid="bw-sim-lab-lesson" aria-label={label} title={label} aria-expanded={Boolean(this.state.lessonKey)}
            style={{minHeight: this.state.coarse ? 40 : 28, border: '1px solid #94a3b8', borderRadius: 6, background: '#fff', color: '#0f172a', padding: '3px 8px', flexShrink: 0}}
            onClick={() => this.setState({lessonKey: this.state.lessonKey ? null : this.state.shipped})}>
            <Icon name="instructions" size={16} />
        </button>;
    }

    renderSimulateRow () {
        const {status, simMs, modelFile, shipped} = this.state;
        const busy = status === 'loading' || this.state.programLoading;
        const compact = this.compact();
        const T = this.text;
        const running = status === 'running';
        const field = {minWidth: 0, width: compact ? 120 : 170, maxWidth: 170, ...(this.state.coarse ? {minHeight: 40} : {height: 28})};
        // The firmware route's emulator pace (always shown); the program clock's only when the world holds
        // the program back (sim-clock.js): on a machine that keeps up there is nothing to say.
        const programRtf = this.state.rtf !== null && this.state.rtf !== undefined && this.state.rtf < SHOW_RTF_BELOW ? this.state.rtf : null;
        const rtf = this.session?.lockstep ? this.session.realTimeFactor : programRtf;
        const statusText = `${busy ? '…' : T[status] || ''}${this.session ? ` · ${this.t('timeShort', {s: (simMs / 1000).toFixed(1)})}` : ''}` +
            (rtf !== null && running ? ` · ${this.t('realTime', {f: this.decimal(rtf < 0.1 ? rtf.toFixed(3) : rtf.toFixed(2))})}` : '');
        // Desktop only (the web build has no managed Renode runtime): the program route.
        const firmwareReady = this.lib && this.desktop() &&
            this.lib.firmwareRouteReady(this.renodeCapabilities(), {unsupported: this.state.firmwareUnsupported});
        const icon = name => <span style={{color: '#475569'}}><Icon name={name} size={16} /></span>;
        const labelled = {display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0};
        const runtime = this.props.vm && this.props.vm.runtime;
        return (
            <div data-testid="bw-sim-lab-context" style={{display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap', flexShrink: 0, fontSize: 12}}>
                {this.renderLessonToggle()}
                <label style={labelled} title={T.model}>{icon('build')}
                    <select data-testid="bw-sim-lab-model" disabled={busy || !this.lib} value={shipped || ''} aria-label={T.model} style={field}
                        onChange={e => e.target.value && this.openShipped(e.target.value, {includeProgram: true, updateTitle: true})}>
                        {this.lib && this.lib.MODELS.map(m => <option key={modelKey(m)} value={modelKey(m)} disabled={m.blocked}>{m.title[this.locale] || m.title.en}{m.experimental ? (this.locale === 'de' ? ' (experimentell)' : ' (experimental)') : ''}</option>)}
                        {modelFile && !shipped && <option value="">{modelFile}</option>}
                    </select>
                </label>
                <label style={labelled} title={T.mat}>{icon('grid')}
                    <select data-testid="bw-sim-lab-mat" disabled={busy || !this.session} value={this.state.mat || 'plain'} aria-label={T.mat} style={{...field, width: 100}}
                        onChange={e => this.setMat(e.target.value === 'plain' ? null : e.target.value)}>
                        {this.lib && this.lib.MATS.map(m => <option key={m.id} value={m.id}>{m.title[this.locale] || m.title.en}</option>)}
                    </select>
                </label>
                {this.lib && this.desktop() && (
                    <label style={labelled} title={T.route}>{icon('run')}
                        <select data-testid="bw-sim-lab-route" disabled={busy} value={this.state.route} aria-label={T.route} style={field}
                            onChange={e => this.setRoute(e.target.value)}>
                            <option value="scratch">{T.routeScratch}</option>
                            <option value="firmware" disabled={!firmwareReady} title={firmwareReady ? undefined : T.routeUnavailable}>{T.routeFirmware}</option>
                        </select>
                    </label>
                )}
                {/* An RCX scene: where `rcxDownload` (the NQC tab, the RCX blocks) sends — the IR tower or the Lab's RCX. */}
                {this.lib && runtime && this.rcxHub() && (
                    <label style={labelled} title={T.rcxTarget}>{icon('save')}
                        <select data-testid="bw-sim-lab-rcx-target" value={this.lib.rcxTargetOf(runtime)} aria-label={T.rcxTarget} style={field}
                            onChange={e => this.setRcxTarget(e.target.value)}>
                            <option value={this.lib.TOWER_TARGET}>{T.rcxTargetTower}</option>
                            <option value={this.lib.ROBOT_LAB_RCX_TARGET}>{T.rcxTargetLab}</option>
                        </select>
                    </label>
                )}
                <span role="status" data-testid="bw-sim-lab-status"
                    title={statusText} style={{color: '#475569', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums'}}>
                    {statusText}
                </span>
            </div>
        );
    }

    /** Below the toolbar in Build: the selection as a chip, its port, what is hidden, and a one-line hint. */
    renderBuildRow () {
        const editor = this.editor;
        const view = this.editView;
        const TT = this.ttext;
        const T = this.text;
        const E = this.etext;
        const byId = editor ? this.lib.partsByIdOf(editor.model) : new Map();
        const selection = this.state.selection.map(id => byId.get(id)).filter(Boolean);
        const sel = selection.length === 1 ? selection[0] : null;
        const meta = sel ? this.lib.CATALOG.get(sel.part) : null;
        const portable = meta && this.lib.isPortPart(meta);
        const st = this.state.buildStatus || {};
        const refused = st.kind === 'refused';
        const blocked = st.kind === 'blocked';
        const field = this.state.coarse ? {minHeight: 40} : {height: 26};
        const chip = {display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', padding: '2px 8px', borderRadius: 999, fontSize: 12};
        const hint = this.buildStatusText();
        const selectionText = sel ? TT.selectedOne.replace('{name}', this.partName(sel.part)) : TT.selectedMany.replace('{n}', selection.length);
        return (
            <div data-testid="bw-sim-lab-context" style={{display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, minHeight: 26, fontSize: 12}}>
                {this.renderLessonToggle()}
                {selection.length > 0 && (
                    <span data-testid="bw-sim-lab-selection" title={sel ? this.t('selectedOne', {name: this.partName(sel.part)}) : this.t('selectedMany', {n: selection.length})}
                        style={{...chip, background: '#dbeafe', color: '#1e3a8a', fontWeight: 600, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                        <Icon name="select-all" size={14} />{selectionText}
                    </span>
                )}
                {portable && (
                    <label style={{...chip, padding: 0}}>{T.port}{': '}
                        <select data-testid="bw-sim-lab-port" value={sel.port || ''} style={field}
                            onChange={e => { editor.apply({type: 'setPort', id: sel.id, port: e.target.value || null}); this.setState(s => ({editorTick: s.editorTick + 1})); }}>
                            <option value="">{T.none}</option>
                            {['A', 'B', 'C', 'D', 'E', 'F'].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </label>
                )}
                {this.state.hidden.length > 0 && (
                    <button type="button" data-testid="bw-sim-lab-hidden-count" title={E.showAll} onClick={() => view?.showAll()}
                        style={{...chip, border: '1px solid #cbd5e1', background: '#f1f5f9', cursor: 'pointer', font: 'inherit', fontSize: 12}}>
                        <Icon name="hide" size={14} />{E.hiddenCount.replace('{n}', this.state.hidden.length)}
                    </button>
                )}
                {this.state.editGroup && (
                    <span data-testid="bw-sim-lab-group-edit-chip" style={{...chip, background: '#ede9fe', color: '#5b21b6', fontWeight: 600}}>
                        {E.groupBanner.replace('{name}', this.state.editGroup.name)}
                    </span>
                )}
                <SimLabInfo testid="bw-sim-lab-help-build" label={T.helpBuild}
                    text={<React.Fragment>
                        <span style={{display: 'block', marginBottom: 6}}>{this.state.coarse ? T.idleTouch : T.idle}</span>
                        <span style={{display: 'block'}}>{this.state.coarse ? this.etext.connect.hintIdleTouch : this.etext.connect.hintIdle}</span>
                    </React.Fragment>} />
                <span role="status" data-testid="bw-sim-lab-build-status" data-kind={st.kind || 'idle'} title={hint}
                    style={{color: refused || blocked ? '#b91c1c' : '#475569', fontWeight: refused ? 600 : 400,
                        flex: '1 1 0', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {hint}
                </span>
            </div>
        );
    }

    /** Build: the parts panel (beside the view, resizable, closable) or, compact, the drawer over the view. */
    renderPalettePanel () {
        if (this.state.mode !== 'build') return null;
        if (this.compact()) {
            // The palette as a drawer over the view's left edge; it stays mounted (search and open
            // categories survive), and steps aside while a part is carried out of it.
            return (
                <div data-testid="bw-sim-lab-palette-drawer" style={{position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 6, width: 230,
                    display: this.state.drawer ? 'flex' : 'none', visibility: this.state.paletteDragging ? 'hidden' : 'visible',
                    maxWidth: 'calc(100% - 48px)', background: '#fff', padding: '6px 0 6px 6px', borderRadius: '0 8px 8px 0',
                    boxShadow: '4px 0 14px rgba(15, 23, 42, 0.25)', boxSizing: 'border-box'}}>
                    {this.renderPalette()}
                </div>
            );
        }
        if (!this.state.paletteOpen) return null;
        const share = this.state.paletteShare;
        return (
            <React.Fragment>
                <div data-testid="bw-sim-lab-palette-panel"
                    style={{display: 'flex', minWidth: 160, minHeight: 0, flex: share ? `0 0 ${(share * 100).toFixed(2)}%` : '0 0 224px'}}>
                    {this.renderPalette()}
                </div>
                <PaneDivider sizedSide="previous" share={share || 'm'} label={this.ttext.resizeParts} title={this.ttext.resizeTip}
                    testId="bw-sim-lab-palette-divider"
                    onResize={f => this.setState({paletteShare: Math.min(MAX_PANEL_SHARE, f)})}
                    onCollapseToggle={() => this.setState({paletteOpen: false})} />
            </React.Fragment>
        );
    }

    /** Build, wide: the properties panel docked beside the view, resizable and closable. */
    renderDockedProperties (button) {
        if (this.state.mode !== 'build' || !this.dockProperties() || !this.state.propsDocked) return null;
        const share = this.state.propsShare;
        return (
            <React.Fragment>
                <PaneDivider share={share || 'm'} label={this.ttext.resizeProperties} title={this.ttext.resizeTip}
                    testId="bw-sim-lab-properties-divider"
                    onResize={f => this.setState({propsShare: Math.min(MAX_PANEL_SHARE, f)})}
                    onCollapseToggle={() => this.setState({propsDocked: false})} />
                <div data-testid="bw-sim-lab-properties-dock"
                    style={{display: 'flex', minHeight: 0, minWidth: 180, flex: share ? `0 0 ${(share * 100).toFixed(2)}%` : '0 0 240px'}}>
                    {this.renderProperties(button, true)}
                </div>
            </React.Fragment>
        );
    }

    render () {
        const {status, message} = this.state;
        const compact = this.compact();
        const coarse = this.state.coarse;
        const button = {padding: compact ? '4px 8px' : '4px 10px', marginRight: compact ? 0 : 6, borderRadius: 6, border: '1px solid #94a3b8', background: '#fff', cursor: 'pointer',
            // Under a finger: at least 40 px each way.
            ...(coarse ? {minHeight: 40, minWidth: 40, padding: compact ? '6px 8px' : '6px 12px'} : {})};
        const T = this.text;
        const simulate = this.state.mode === 'simulate';
        const build = this.state.mode === 'build';
        return (
            <div ref={this.root} className={paneStyles.root} data-testid="bw-sim-lab" data-status={status} data-layout={compact ? 'compact' : 'wide'} data-mode={this.state.mode}
                style={{position: 'relative', display: 'flex', flexDirection: 'column', gap: 6, padding: compact ? 6 : 8, height: '100%', width: '100%',
                    flex: '1 1 auto', boxSizing: 'border-box', minWidth: 0, minHeight: 0, background: '#f8fafc'}}>
                {this.renderToolbar()}
                {this.state.examplesOpen && this.lib && (
                    <SimLabExamples models={this.lib.MODELS} locale={this.locale} selected={this.state.shipped}
                        onChoose={(key, program) => this.openGalleryExample(key, program)}
                        onLesson={key => this.setState({examplesOpen: false, lessonKey: key})}
                        onClose={() => this.closeExamples()} />
                )}
                {this.state.instructions && (
                    <SimLabInstructions lib={this.lib} model={this.state.instructions} locale={this.locale}
                        title={this.editor ? null : this.shippedModel()?.title[this.locale] || this.state.modelFile}
                        onClose={() => this.setState({instructions: null})} />
                )}
                <input ref={this.file} type="file" accept={OPEN_ACCEPT} style={{display: 'none'}} data-testid="bw-sim-lab-file"
                    onChange={e => this.openImported(e)} />
                {build && this.editor && this.renderBuildRow()}
                {message && <div role="alert" data-testid="bw-sim-lab-message" style={{fontSize: 12, color: '#b91c1c'}}>{message}</div>}
                {this.renderInfo()}
                {this.renderBlockers()}
                <div data-testid="bw-sim-lab-main" style={{display: 'flex', flex: '1 1 auto', minHeight: compact ? 220 : 240, minWidth: 0, position: 'relative'}}>
                    {this.renderPalettePanel()}
                    <div ref={this.viewWrap} style={{flex: '1 1 auto', minHeight: compact ? 220 : 240, minWidth: 0, position: 'relative', display: 'flex',
                        background: '#fff', borderRadius: 6}}>
                        <div ref={this.box} data-testid="bw-sim-lab-view" style={{flex: '1 1 auto', minHeight: compact ? 220 : 240, minWidth: 0, position: 'relative'}} />
                        {build && this.editView && this.renderHoldOverlays()}
                        {simulate && this.state.showStats && this.session && (
                            <SimLabStats locale={this.locale} measurement={{status: this.state.status, rtf: this.state.rtf,
                                simMs: this.session.time, timeScale: this.state.timeScale, worker: this.session.worker,
                                lockstep: this.session.lockstep, stats: this.session.stats}}
                                onClose={() => this.setState({showStats: false})} />
                        )}
                        {simulate && this.state.readings && (
                            <SimLabReadings text={{...this.text, close: this.text.readingsClose}} {...this.readingsRows()}
                                onClose={() => this.setState({readings: false})} />
                        )}
                        {simulate && this.state.measurementsOpen && this.session && this.measurementReader && (
                            <SimLabMeasurements locale={this.locale} definitions={this.measurements} rows={this.measurementRows}
                                modelKey={this.opened?.text || ''} recorder={this.measurementRecording} modelContext={this.measurementContext} recorderRevision={this.measurementRevision}
                                recordingAllowed={!this.measurementContext || this.measurementExperiments.has(this.measurementContext.modelSha256) || this.measurementExperiments.size < 4}
                                controlPair={this.measurementControlPair}
                                histories={[...this.measurementExperiments].filter(([, packet]) => packet.schema !== CONTROL_PAIR_SCHEMA).map(([modelSha256, packet]) => ({modelSha256, packet}))}
                                onControlPair={packet => this.applyMeasurementControlPair(packet)} onClearControlPair={() => this.clearMeasurementControlPair()}
                                onHistoryChanged={() => this.onBundleCollect()}
                                initialPlots={this.measurementSelection || this.measurementRecording.selectionFor(this.opened?.text || '', this.measurementContext?.modelSha256)}
                                onPlotSelection={ids => { this.measurementSelection = ids.slice(0, 4); this.configureMeasurementObservations(); if (this.measurementRecording.snapshot().runs.length) this.onBundleCollect(); }}
                                onPickTarget={this.view?.setMeasurementPick}
                                onHighlight={ids => this.view?.highlight(ids)}
                                onPreview={definition => { this.measurementPreview = definition; }}
                                readPreview={definition => this.measurementPreviewReader?.read([definition])[0]}
                                parts={this.measurementReader.partIds.map(id => ({id, label: this.partNameById(id)}))}
                                mechanism={this.session.mechanism} shown={this.state.showMeasurements} replaying={this.state.replayAt !== null}
                                session={this.session} sampleTime={this.measurementRowsTime} paused={this.state.status !== 'running' && this.state.status !== 'stopping'}
                                precisionEnabled={Boolean(this.measurementPrecisionEnabled)}
                                precisionOptions={this.measurementPrecisionOptions}
                                onPrecisionOptions={options => { this.measurementPrecisionOptions = options; this.configureMeasurementObservations(); this.refreshMeasurements(); }}
                                onPrecisionToggle={() => { this.measurementPrecisionEnabled = !this.measurementPrecisionEnabled; this.configureMeasurementObservations(); this.refreshMeasurements(); }}
                                teachingPreset={teachingMeasurementPreset(this.session, this.shippedModel()?.file, this.locale)}
                                onSample={() => this.refreshMeasurements()}
                                onChange={definitions => this.changeMeasurements(definitions)}
                                onShown={shown => this.setState({showMeasurements: shown}, () => this.refreshMeasurements())}
                                onPresets={() => this.changeMeasurements(this.lib.measurementPresets(this.session))}
                                onClose={() => { this.measurementPrecisionEnabled = false; this.configureMeasurementObservations(); this.setState({measurementsOpen: false}); }} />
                        )}
                        {simulate && this.state.challengesOpen && this.lib && this.renderChallenges()}
                        {simulate && this.renderReplay()}
                        {this.renderPortPicker(button)}
                        {build && this.state.coach !== null && this.state.status === 'ready' && (
                            <SimLabCoach T={this.etext} step={this.state.coach} onNext={() => this.setState(s => ({coach: s.coach + 1}))}
                                onDone={() => this.coachDone()} />
                        )}
                        {build && !this.dockProperties() && this.state.propsOpen && (
                            <div data-testid="bw-sim-lab-properties-drawer" style={{position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 6, maxWidth: 'calc(100% - 48px)',
                                display: 'flex', boxShadow: '-4px 0 14px rgba(15, 23, 42, 0.25)', borderRadius: '8px 0 0 8px'}}>
                                {this.renderProperties(button, false)}
                            </div>
                        )}
                    </div>
                    {this.renderDockedProperties(button)}
                    {this.state.lessonKey && this.lib && (() => {
                        const entry = this.lib.MODELS.find(m => modelKey(m) === this.state.lessonKey);
                        return entry && <SimLabLesson key={this.state.lessonKey} entry={entry} models={this.lib.MODELS} locale={this.locale}
                            overlay={this.state.paneWidth < 900} onLoad={(key, program) => this.openGalleryExample(key, program)}
                            onRelated={key => this.setState({lessonKey: key})}
                            onClose={() => this.setState({lessonKey: null}, () => (this.root.current?.querySelector('[data-testid="bw-sim-lab-lesson"]') || this.root.current?.querySelector('[data-testid="bw-sim-lab-examples"]'))?.focus())} />;
                    })()}

                </div>
                {simulate && this.state.controlsOpen && !this.state.programLoading && this.session && !this.session.lockstep && this.renderMixer(button,
                    !this.api?.brickButtons()?.length ? null : this.renderBrickButtons())}
                {build && this.state.shortcuts && (
                    <SimLabShortcuts T={this.etext} wheelMode={this.state.wheelMode} onWheelMode={mode => this.setWheelMode(mode)}
                        mousePreset={this.state.mousePreset} onMousePreset={preset => this.setMousePreset(preset)}
                        onCoach={() => this.setState({shortcuts: false, coach: 0})} onClose={() => {
                        this.setState({shortcuts: false});
                        this.editView?.canvas.focus();
                    }} />
                )}
                {this.renderIssues()}
            </div>
        );
    }
}

export default connect(null, {onSetProjectTitle: setProjectTitle})(SimLabPane);
