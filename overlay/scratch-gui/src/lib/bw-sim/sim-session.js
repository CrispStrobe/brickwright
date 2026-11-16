// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// One Sim Lab run: LDraw text → PlacedModel (model/ldraw-model.js) →
// CompiledMechanism (mech/compile.js) → physics core (physics/jolt-core.js) →
// the model's hub, as a VirtualHub of its family (hubs/, through the port
// boundary in hub-bridge.js). The Sim Lab pane owns one session
// at a time; everything here is DOM-free so the same sequence runs headless
// in tests.
//
// What the user sees as a list is collected, never thrown away (the repo's
// "refusals are listed" rule): model refusals (an unknown part, loose
// geometry, a mirrored part) and compiler diagnostics (a motor without a
// port, an unsupported gear) both end up in `issues`.
//
// Where the physics runs (ROADMAP §4.9, docs/SIM-LAB-PLAN.md "§4.9 The physics
// worker"): given a PhysicsClient for physics/physics-worker.js, in that Web
// Worker — the hubs and their controllers stay here, and each tick's
// steps come back as frames the hubs replay (sim-worker-protocol.js);
// otherwise (node, no Worker, the worker could not load Jolt) on the main
// thread, as before. Both give the same numbers; `worker` says which one runs.
//
// A scene with a NON-REWINDABLE hub (exportState().nonRewindable: an emulated
// firmware, hubs/spike/spike-firmware-hub.js) never goes to the worker — a
// batch there may be redone from a Jolt checkpoint, and an emulator cannot be
// rewound (docs/ROBOT-LAB-SPIKE-EMULATION.md §2.3, owner answer Q1/D3). It
// runs on this thread through the lockstep runner (routes/renode-lockstep/
// runner.js), one physics step per exchange; `lockstep` says so, and
// `realTimeFactor` how fast the emulator lets simulated time go.

import {observationSelection, collectFixedObservations, createPrecisionAnalysis} from './measurements/precision.js';
import {startupDiagnosticSelection} from './measurements/startup-diagnostic.js';
import {admitStartupDiagnostic} from './measurements/startup-diagnostic-consumer.js';
import {autoPorts} from './hubs/auto-ports.js';
import {parseModel} from './model/ldraw-model.js';
import {compile} from './mech/compile.js';
import {mechanismIssues} from './mech/insight.js';
import {loadJolt, createPhysicsCore} from './physics/jolt-core.js';
import {SimHubBridge, HubReplay, STEP_MS} from './hub-bridge.js';
import {MirrorCore} from './sim-worker-protocol.js';
import {hubRegistry, LAB_DIRECT_ID} from './hubs/index.js';
import {upgradePartMeta, partHubProfile, partDrivenJoints} from './contracts.js';
import {createMat} from './world/mats.js';
import {placeOnStart, driveAnchor} from './world/place.js';
import {LockstepRunner, isNonRewindable, L3_HUB_NEEDS_LOCKSTEP} from './routes/renode-lockstep/runner.js';

/**
 * The part catalog from part-meta/parts.json's parsed content. The caller
 * imports the JSON (webpack bundles it into the Sim Lab chunk; tests read the
 * file), so this module stays loadable by node --test without JSON modules.
 * Every entry comes out as PartMeta v2: a v1 file (a user's catalog, an old
 * fixture) is upgraded entry by entry (contracts.js upgradePartMeta).
 */
export const catalogFrom = partsJson => new Map(partsJson.parts.map(p => [p.part, upgradePartMeta(p)]));

/** Optional manual commands for a model's ports; these limit requested targets, never physical poses. */
const RESONANCE_MANUAL_JOG = Object.freeze({
    A: Object.freeze({minDeg: -2, maxDeg: 2, stepDeg: 0.5, speedDps: 5})
});

/**
 * Reference models shipped in static/sim-lab/models/ (file name → titles). A model
 * may name an example program in static/sim-lab/programs/ (DEVICE SPIKE text; for the
 * RCX, NQC source `.nqc`; DEVICE EV3 text; legonxt blocks `.blocks.json`) and
 * the mat it is meant for: the pane offers to load it into the Code tab.
 */
export const MODELS = Object.freeze([
    {file: 'driving-base.ldr', title: {en: 'SPIKE driving base — differential steering', de: 'SPIKE-Fahrbasis — Differenziallenkung'}},
    {file: 'line-follower.ldr', title: {en: 'Line follower — light-sensor feedback', de: 'Linienfolger — Regelung mit Lichtsensoren'},
        example: 'line-follower.bw', mat: 'line-oval'},
    {file: 'wall-stopper.ldr', title: {en: 'Wall stopper — distance-controlled braking', de: 'Wandstopper — Bremsen nach Abstand'},
        example: 'wall-stopper.bw', mat: 'wall'},
    {file: 'colour-explorer.ldr', title: {en: 'Colour explorer — colour and heading feedback', de: 'Farbentdecker — Rückmeldung aus Farbe und Fahrtrichtung'},
        example: 'colour-explorer.bw', mat: 'colour-zones'},
    // The same robot a second time, with its Sumo program: `id` keys the entry (the pane lists by it).
    {id: 'sumo', file: 'colour-explorer.ldr', title: {en: 'Sumo ring — colour-guided pushing', de: 'Sumo-Ring — farbgeführtes Schieben'},
        example: 'sumo.bw', mat: 'sumo'},
    {file: 'forklift.ldr', title: {en: 'Forklift — rack-and-pinion lift', de: 'Gabelstapler — Zahnstangen-Hub'},
        example: 'forklift.bw', mat: 'warehouse'},
    {file: 'maze-runner.ldr', title: {en: 'Maze runner — distance and colour navigation', de: 'Labyrinth-Läufer — Navigation mit Abstand und Farbe'},
        example: 'maze.bw', mat: 'maze'},
    // Gear mechanics (docs/ROBOT-LAB-ARCHITECTURE.md §1.2): a shifting gearbox and a differential, on a stand.
    {file: 'gearbox.ldr', title: {en: 'Two-speed gearbox — sliding-clutch shift', de: 'Zweigang-Schaltgetriebe — Schalten mit Schiebekupplung'},
        example: 'gearbox.bw'},
    {file: 'differential.ldr', title: {en: 'Differential — holding one output doubles the other', de: 'Differenzialgetriebe — ein Abtrieb fest, der andere doppelt so schnell'},
        example: 'differential.bw'},
    // The differential on wheels (docs/ROBOT-LAB-ARCHITECTURE.md T6): motor A drives the rear axle through it,
    // motor B steers the front wheels (an Ackermann tie rod). The `intro` is the pane's one-paragraph story.
    {file: 'differential-car.ldr', title: {en: 'Differential car — differential drive and rack steering', de: 'Differenzial-Auto — Differenzialantrieb und Zahnstangenlenkung'},
        example: 'differential-car.bw', mat: 'plain',
        intro: {
            en: 'A car that steers like a real one. Motor A turns the back wheels through a differential, ' +
                'so in a curve the outer wheel can roll faster than the inner one. Motor B steers with a rack and ' +
                'pinion: its gear slides a toothed bar, and rods from the bar\'s ends turn the front wheels, the ' +
                'inner one a little more. Run it: the car drives ahead, goes once round a circle and backs up to ' +
                'where it started.',
            de: 'Ein Auto, das lenkt wie ein echtes. Motor A dreht die Hinterräder über ein Differenzial, ' +
                'so kann in der Kurve das äußere Rad schneller rollen als das innere. Motor B lenkt mit einer ' +
                'Zahnstange: Sein Zahnrad schiebt die Stange, und Spurstangen an ihren Enden drehen die ' +
                'Vorderräder, das innere etwas stärker. Starte es: Das Auto fährt geradeaus, einmal im Kreis ' +
                'und rückwärts zurück zum Start.'
        }},
    // Flexible parts (docs/ROBOT-LAB-UX.md §11): a chain from the motor's 8T to a 24T.
    {file: 'chain-drive.ldr', title: {en: 'Chain drive — 8T to 24T in the same direction', de: 'Kettenantrieb — 8er auf 24er, gleiche Drehrichtung'},
        example: 'chain-drive.bw'},
    // Pneumatics v1 (docs/ROBOT-LAB-UX.md §16): motor A turns a valve's lever; hoses feed a cylinder.
    {file: 'pneumatic-press.ldr', title: {en: 'Pneumatic cylinder — valve-reversed air drive', de: 'Pneumatikzylinder — Druckluft, vom Ventil umgeschaltet'},
        example: 'pneumatic-press.bw'},
    // Pen and paper (architecture M15): the driving base, its castor ball a pen.
    {file: 'drawing-robot.ldr', title: {en: 'Drawing robot — trailing pen traces the motion', de: 'Malroboter — nachlaufender Stift zeichnet die Bewegung'},
        example: 'drawing-robot.bw', mat: 'plain'},
    {file: 'mean-machine.ldr', title: {en: 'Mean Machine — mechanical average', de: 'Mean Machine — mechanischer Mittelwert'}, example: 'mean-machine.bw', mat: 'plain'},
    {file: 'stepworks.ldr', title: {en: 'Stepworks — walking-beam conveyor', de: 'Stepworks — Hubbalkenförderer'}, example: 'stepworks.bw', mat: 'plain'},
    {file: 'stride-lab.ldr', title: {en: 'Stride Lab — nearly straight working stroke', de: 'Stride Lab — fast gerader Arbeitshub'}, example: 'stride-lab.bw', mat: 'plain'},
    {file: 'twinpoint.ldr', title: {en: 'Twinpoint — parallel five-bar positioner', de: 'Twinpoint — paralleler Fünfgelenkarm'}, example: 'twinpoint.bw', mat: 'plain'},
    {file: 'butterfly.ldr', title: {en: 'Butterfly — flapping-wing automaton', de: 'Butterfly — Flügelschlagautomat'}, example: 'butterfly.bw', mat: 'plain'},
    {file: 'tempo-loop.ldr', title: {en: 'Tempo Loop — variable-speed double crank', de: 'Tempo Loop — ungleichförmige Doppelkurbel'}, example: 'tempo-loop.bw', mat: 'plain'},
    {file: 'tilt-lab.ldr', title: {en: 'Tilt Lab — two-axis marble maze', de: 'Tilt Lab — zweiachsiges Kugellabyrinth'}, example: 'tilt-lab.bw', mat: 'plain'},
    {"file": "rod-ratio.ldr", "title": {"en": "Rod Ratio — comparing connecting rods", "de": "Rod Ratio — Pleuellängen im Vergleich"}, "example": "rod-ratio.bw", "mat": "plain", "manualJog": {"A": {"minDeg": 0, "maxDeg": 8640, "stepDeg": 180, "speedDps": 720}}},
    {"file": "vernier-drive.ldr", "title": {"en": "Vernier Drive — differential reduction", "de": "Vernier Drive — Differenzial-Untersetzung"}, "example": "vernier-drive.bw", "mat": "plain", "manualJog": {"A": {"minDeg": 0, "maxDeg": 9000, "stepDeg": 225, "speedDps": 240}}},
    {"file": "line-turner.ldr", "title": {"en": "Line Turner — Scott–Russell linkage", "de": "Line Turner — Scott-Russell-Geradführung"}, "example": "line-turner.bw", "mat": "plain", "manualJog": {"A": {"minDeg": 0, "maxDeg": 183, "stepDeg": 15, "speedDps": 60}}},
    {"file": "dune-strider.ldr", "title": {"en": "Dune Strider — paired Jansen legs", "de": "Dune Strider — gekoppelte Jansen-Beine"}, "example": "dune-strider.bw", "mat": "plain", "manualJog": {"A": {"minDeg": 0, "maxDeg": 720, "stepDeg": 30, "speedDps": 90}}},
    {"file": "atlas-six.ldr", "title": {"en": "Atlas Six — six-axis Stewart platform", "de": "Atlas Six — Stewart-Plattform mit sechs Achsen"}, "example": "atlas-six.bw", "mat": "plain", "manualJog": {"A": {"minDeg": -90, "maxDeg": 90, "stepDeg": 15, "speedDps": 30}, "B": {"minDeg": -90, "maxDeg": 90, "stepDeg": 15, "speedDps": 30}, "C": {"minDeg": -90, "maxDeg": 90, "stepDeg": 15, "speedDps": 30}, "D": {"minDeg": -90, "maxDeg": 90, "stepDeg": 15, "speedDps": 30}, "E": {"minDeg": -90, "maxDeg": 90, "stepDeg": 15, "speedDps": 30}, "F": {"minDeg": -90, "maxDeg": 90, "stepDeg": 15, "speedDps": 30}}},
    {"file": "oblique.ldr", "title": {"en": "Oblique — adjustable-angle trammel", "de": "Oblique — Ellipsenzirkel mit verstellbarem Winkel"}, "example": "oblique.bw", "mat": "plain", "manualJog": {"A": {"minDeg": 0, "maxDeg": 360, "stepDeg": 15, "speedDps": 24}, "B": {"minDeg": -90, "maxDeg": 0, "stepDeg": 9, "speedDps": 24}}},
    {"file": "cable-compass.ldr", "title": {"en": "Cable Compass — two-winch positioner", "de": "Cable Compass — Zweiwinden-Positionierer"}, "example": "cable-compass.bw", "mat": "plain", "manualJog": {"A": {"minDeg": -4600, "maxDeg": 6400, "stepDeg": 90, "speedDps": 180}, "B": {"minDeg": -4600, "maxDeg": 6400, "stepDeg": 90, "speedDps": 180}}},
    {"file": "cable-compass-control.ldr", "title": {"en": "Cable Compass Control — disconnected left winch", "de": "Cable-Compass-Kontrolle — getrennte linke Winde"}, "example": "cable-compass.bw", "mat": "plain", "manualJog": {"A": {"minDeg": -4600, "maxDeg": 6400, "stepDeg": 90, "speedDps": 180}, "B": {"minDeg": -4600, "maxDeg": 6400, "stepDeg": 90, "speedDps": 180}}},
    {file: 'rise-ratio.ldr', title: {en: 'Rise Ratio — rack-driven scissor lift', de: 'Rise Ratio — Scherenhubtisch mit Zahnstange'}, example: 'rise-ratio.bw', mat: 'plain', manualJog: {A: {minDeg: -153, maxDeg: 0, stepDeg: 15, speedDps: 40}}},
    {file: 'rise-ratio-control.ldr', title: {en: 'Rise Ratio Control — disconnected rack drive', de: 'Rise-Ratio-Kontrolle — getrennter Zahnstangenantrieb'}, example: 'rise-ratio.bw', mat: 'plain', manualJog: {A: {minDeg: -153, maxDeg: 0, stepDeg: 15, speedDps: 40}}},
    {file: 'cascade.ldr', title: {en: 'Cascade — a free double pendulum', de: 'Cascade — ein freies Doppelpendel'}, example: 'cascade.bw', mat: 'plain', manualJog: {A: {minDeg: 0, maxDeg: 90, stepDeg: 15, speedDps: 180}}},
    {file: 'cascade-control.ldr', title: {en: 'Cascade Control — a real elbow brace', de: 'Cascade-Kontrolle — ein mechanisch versteiftes Gelenk'}, example: 'cascade.bw', mat: 'plain', manualJog: {A: {minDeg: 0, maxDeg: 90, stepDeg: 15, speedDps: 180}}},
    {file: 'wavemaker.ldr', title: {en: 'WaveMaker — Cardan ripple and differential', de: 'WaveMaker — Kardanschwankung und Differenzial'}, example: 'wavemaker.bw', mat: 'plain', manualJog: {A: {minDeg: 0, maxDeg: 1440, stepDeg: 90, speedDps: 30}}},
    {file: 'wavemaker-control.ldr', title: {en: 'WaveMaker Control — correctly phased Cardan joints', de: 'WaveMaker-Kontrolle — richtig ausgerichtete Kardangelenke'}, example: 'wavemaker.bw', mat: 'plain', manualJog: {A: {minDeg: 0, maxDeg: 1440, stepDeg: 90, speedDps: 30}}},
    {file: 'sine-shuttle.ldr', title: {en: 'SineShuttle — captured-block Scotch yoke', de: 'SineShuttle — Kurbelschleife mit gefangenem Gleitstein'}, example: 'sine-shuttle.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 1080, stepDeg: 15, speedDps: 30}}},
    {file: 'quartermaster.ldr', title: {en: 'Quartermaster — latched contact indexer', de: 'Quartermaster — Kontakt-Schrittgetriebe mit Sperre'}, example: 'quartermaster.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 160, stepDeg: 5, speedDps: 30}, B: {minDeg: -45, maxDeg: 0, stepDeg: 5, speedDps: 30}}},
    {file: 'toggle-lever.ldr', title: {en: 'Toggle Lever — a link folding toward dead centre', de: 'Kniehebel — ein Lenker klappt zum Totpunkt'}, example: 'toggle-lever.bw', mat: 'plain',
        manualJog: {A: {minDeg: -85, maxDeg: 85, stepDeg: 5, speedDps: 30}}},
    {file: 'thirdline.ldr', title: {en: 'Thirdline — angle trisector', de: 'Thirdline — Winkeldreiteiler'}, example: 'thirdline.bw', mat: 'plain',
        manualJog: {A: {minDeg: -5, maxDeg: 40, stepDeg: 5, speedDps: 8}}},
    {
        "file": "tipline.ldr",
        "title": {
            "en": "Tipline — sliding versus tipping",
            "de": "Tipline — Rutschen oder Kippen"
        },
        "example": "tipline.bw",
        "mat": "plain",
        "intro": {
            "en": "One motor tilts two equally heavy free towers with low or high internal ballast. In the native recordings, high ballast tips near 15° and low ballast slides near 22°. Swap the ballast heights between lanes; a tall passive wall arrests the later motion.",
            "de": "Ein Motor neigt zwei gleich schwere freie Türme mit tiefem oder hohem innerem Ballast. In den nativen Aufzeichnungen kippt die hohe Anordnung bei etwa 15°; die tiefe rutscht bei etwa 22°. Vertausche die Ballasthöhen zwischen den Spuren; eine hohe passive Wand fängt die spätere Bewegung ab."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 23.5,
                "stepDeg": 1,
                "speedDps": 1
            }
        }
    },
    {
        "file": "twistspan.ldr",
        "title": {
            "en": "TwistSpan — two-cord torsion pendulum",
            "de": "TwistSpan — Zweifaden-Torsionspendel"
        },
        "example": "twistspan.bw",
        "mat": "plain",
        "intro": {
            "en": "One motor turns an upper bar; two fixed 104 mm cords suspend a separate passive payload. Compare 64 mm and 32 mm tie spacing with the same rigid parts: the recorded period changes from about 0.77 s to 1.52 s.",
            "de": "Ein Motor dreht den oberen Balken; zwei feste 104-mm-Schnüre tragen eine eigene passive Last. Vergleiche 64 mm und 32 mm Befestigungsabstand bei denselben starren Teilen: Die aufgezeichnete Periode ändert sich von etwa 0,77 s auf 1,52 s."
        },
        "manualJog": {
            "A": {
                "minDeg": 0,
                "maxDeg": 20,
                "stepDeg": 5,
                "speedDps": 10
            }
        }
    },
    {
        "file": "swayshift.ldr",
        "title": {
            "en": "SwayShift — timing an anti-sway transfer",
            "de": "SwayShift — Nachschwingen durch gezieltes Timing mindern"
        },
        "example": "swayshift.bw",
        "mat": "plain",
        "intro": {
            "en": "One motor drives a rack trolley through a 3:1 speed increase. A freely hinged rigid pendulum has a 216 mm hole span. Compare the same nominal 22 mm + 22 mm transfer with half-period or full-period timing between move starts, then observe the passive load after arrival.",
            "de": "Ein Motor bewegt einen Zahnstangenschlitten mit dreifacher Ausgangsdrehzahl. Das frei gelagerte starre Pendel hat 216 mm Abstand zwischen den äußeren Löchern. Vergleiche dieselbe Sollfahrt von 22 mm + 22 mm mit einer halben oder einer ganzen Periode zwischen den Bewegungsstarts und beobachte das Nachschwingen."
        },
        "manualJog": {
            "A": {
                "minDeg": -70,
                "maxDeg": 0,
                "stepDeg": 5,
                "speedDps": 20
            }
        }
    },
    {file: 'samebeat.ldr', title: {en: 'Samebeat — reversible pendulum', de: 'Samebeat — Reversionspendel'}, example: 'samebeat.bw', mat: 'plain',
        manualJog: {A: {minDeg: -8, maxDeg: 8, stepDeg: 4, speedDps: 60}}},
    {file: 'carry-ratio.ldr', title: {en: 'Carry Ratio — a free ball carried by a driven tray', de: 'Carry Ratio — eine freie Kugel auf einem angetriebenen Tisch'}, example: 'carry-ratio.bw', mat: 'plain',
        manualJog: {A: {minDeg: -180, maxDeg: 2880, stepDeg: 90, speedDps: 120}}},
    {file: 'air-budget.ldr', title: {en: 'Air Budget — one pump, finite stored air', de: 'Air Budget — eine Pumpe, begrenzter Luftvorrat'}, example: 'air-budget.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 3240, stepDeg: 180, speedDps: 270}}},
    {file: 'cross-ratio.ldr', title: {en: 'Cross Ratio — crossed four-bar', de: 'Cross Ratio — gekreuztes Viergelenk'}, example: 'cross-ratio.bw', mat: 'plain',
        manualJog: {A: {minDeg: -30, maxDeg: 90, stepDeg: 15, speedDps: 12}}},
    {file: 'foldback.ldr', title: {en: 'Foldback — crossed four-bar', de: 'Foldback — gekreuztes Viergelenk'}, example: 'foldback.bw', mat: 'plain',
        manualJog: {A: {minDeg: -20, maxDeg: 70, stepDeg: 5, speedDps: 15}}},
    {file: 'ghost-pivot.ldr', title: {en: 'Ghost Pivot — remote centre of motion', de: 'Ghost Pivot — fernliegender Drehpunkt'}, example: 'ghost-pivot.bw', mat: 'plain',
        manualJog: {A: {minDeg: -35, maxDeg: 35, stepDeg: 5, speedDps: 10}}},
    {file: 'travel-dial.ldr', title: {en: 'Travel Dial — passive measuring wheel', de: 'Travel Dial — passives Messrad'}, example: 'travel-dial.bw', mat: 'plain',
        manualJog: {A: {minDeg: -60, maxDeg: 60, stepDeg: 15, speedDps: 15}}},
    {file: 'pivot-exchange.ldr', title: {en: 'Pivot Exchange — nearly equal periods from different pivots', de: 'Pivot Exchange — nahezu gleiche Perioden an verschiedenen Aufhängungen'}, example: 'pivot-exchange.bw', mat: 'plain'},
    {file: 'phasor-twin.ldr', title: {en: 'Phasor Twin — the Stirling phase loop', de: 'Phasor Twin — die Stirling-Phasenschleife'}, example: 'phasor-twin.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 720, stepDeg: 45, speedDps: 45}}},
    {file: 'final-squeeze.ldr', title: {en: 'Final Squeeze — a knee press', de: 'Final Squeeze — eine Kniehebelpresse'}, example: 'final-squeeze.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 25, stepDeg: 5, speedDps: 8}}},
    {file: 'high-select.ldr', title: {en: 'High Select — mechanical maximum', de: 'High Select — mechanisches Maximum'}, example: 'high-select.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 152, stepDeg: 19, speedDps: 38}, B: {minDeg: 0, maxDeg: 152, stepDeg: 19, speedDps: 38}}},
    {file: 'poise.ldr', title: {en: 'Poise — Roberval balance', de: 'Poise — Roberval-Waage'}, example: 'poise.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 180, stepDeg: 45, speedDps: 15}, B: {minDeg: 0, maxDeg: 180, stepDeg: 45, speedDps: 15}}},
    {file: 'bend-ripple.ldr', title: {en: 'Bend Ripple — variable-bend Cardan joint', de: 'Bend Ripple — Kardangelenk mit verstellbarem Knickwinkel'}, example: 'bend-ripple.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 765, stepDeg: 45, speedDps: 24}, B: {minDeg: 0, maxDeg: 20, stepDeg: 5, speedDps: 4}}},
    {file: 'offset-relay.ldr', title: {en: 'Offset Relay — variable-offset coupling', de: 'Offset Relay — Kupplung mit variablem Versatz'}, example: 'offset-relay.bw', mat: 'plain',
        manualJog: {A: {minDeg: -3, maxDeg: 2883, stepDeg: 90, speedDps: 90}, B: {minDeg: -160, maxDeg: 84, stepDeg: 19.1, speedDps: 15}}},
    {file: 'rack-decoder.ldr', title: {en: 'Rack Decoder — mechanical selection', de: 'Rack Decoder — mechanische Auswahl'}, example: 'rack-decoder.bw', mat: 'plain',
        manualJog: {A: {minDeg: -122, maxDeg: 122, stepDeg: 19.1, speedDps: 14.3}, B: {minDeg: -122, maxDeg: 122, stepDeg: 19.1, speedDps: 14.3}}},
    {file: 'remote-pivot.ldr', title: {en: 'Remote Pivot — empty-centre rotation', de: 'Remote Pivot — Drehung um ein freies Zentrum'}, example: 'remote-pivot.bw', mat: 'plain',
        manualJog: {A: {minDeg: -31, maxDeg: 31, stepDeg: 5, speedDps: 8}}},
    {file: 'schmidt-shift.ldr', title: {en: 'Schmidt Shift — offset coupling', de: 'Schmidt Shift — Kupplung für versetzte Wellen'}, example: 'schmidt-shift.bw', mat: 'plain',
        manualJog: {A: {minDeg: -360, maxDeg: 720, stepDeg: 45, speedDps: 30}}},
    {file: 'equal-share.ldr', title: {en: 'Equal Share — whippletree force equalizer', de: 'Equal Share — Kraftausgleich mit Ausgleichsbalken'}, example: 'equal-share.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 35, stepDeg: 5, speedDps: 8}}},
    {file: 'stroke-shift.ldr', title: {en: 'Stroke Shift — adjustable crank throw', de: 'Stroke Shift — verstellbarer Kurbelradius'}, example: 'stroke-shift.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 1080, stepDeg: 90, speedDps: 180}, B: {minDeg: 0, maxDeg: 3582.446015, stepDeg: 1791.223007, speedDps: 360}}},
    {file: 'triad-table.ldr', title: {en: 'Triad Table — three lengths, one pose', de: 'Triad Table — drei Längen, eine Pose'}, example: 'triad-table.bw', mat: 'plain',
        manualJog: {A: {minDeg: -1500, maxDeg: 1500, stepDeg: 150, speedDps: 180}, B: {minDeg: -1500, maxDeg: 1500, stepDeg: 150, speedDps: 180}, C: {minDeg: -1500, maxDeg: 1500, stepDeg: 150, speedDps: 180}}},
    {file: 'toggle-press.ldr', title: {en: 'Toggle Press — near-dead-centre ram', de: 'Kniehebelpresse — Schlitten nahe dem Totpunkt'}, example: 'toggle-press.bw', mat: 'plain',
        manualJog: {A: {minDeg: -82, maxDeg: 0, stepDeg: 2, speedDps: 8}}},
    {file: 'footfall.ldr', title: {en: 'Footfall — twelve-link leg-path tracer', de: 'Schrittspur — zwölfgliedrige Beinmechanik'}, example: 'footfall.bw', mat: 'plain',
        manualJog: {A: {minDeg: -5, maxDeg: 365, stepDeg: 5, speedDps: 12}}},
    {file: 'phasekeeper.ldr', title: {en: 'Phasekeeper — equal-angle double-Cardan transmission', de: 'Phasenhalter — gleichwinklige Doppel-Kardankupplung'}, example: 'phasekeeper.bw', mat: 'plain',
        manualJog: {A: {minDeg: -5, maxDeg: 365, stepDeg: 5, speedDps: 18}}},
    {file: 'vectorsum.ldr', title: {en: 'VectorSum — two-input differential mixer', de: 'Vektorsumme — Differentialmischer mit zwei Eingängen'}, example: 'vectorsum.bw', mat: 'plain',
        manualJog: {A: {minDeg: -190, maxDeg: 190, stepDeg: 10, speedDps: 24}, B: {minDeg: -190, maxDeg: 190, stepDeg: 10, speedDps: 24}}},
    {file: 'pointweaver.ldr', title: {en: 'PointWeaver — two-motor five-bar path tracer', de: 'Punktweber — Fünfgelenk-Bahnzeichner mit zwei Motoren'}, example: 'pointweaver.bw', mat: 'plain',
        manualJog: {A: {minDeg: -34, maxDeg: 2, stepDeg: 1, speedDps: 8}, B: {minDeg: -11, maxDeg: 26, stepDeg: 1, speedDps: 8}}},
    {file: 'kestrel-flapper.ldr', title: {en: 'Kestrel — flapping linkage', de: 'Kestrel — Schlagflügel-Gestänge'}, example: 'kestrel-flapper.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 720, stepDeg: 30, speedDps: 45}}},
    {file: 'meridian-linkage.ldr', title: {en: 'Meridian — straight-line linkage', de: 'Meridian — Geradführungs-Gestänge'}, example: 'meridian-linkage.bw', mat: 'plain',
        manualJog: {A: {minDeg: -60, maxDeg: 60, stepDeg: 10, speedDps: 15}}},
    {file: 'lumen-iris.ldr', title: {en: 'Lumen — six-leaf iris', de: 'Lumen — sechsblättrige Iris'}, example: 'lumen-iris.bw', mat: 'plain',
        manualJog: {A: {minDeg: -55.2168, maxDeg: 0, stepDeg: 13.8042, speedDps: 15}}},
    {file: 'tangent-table.ldr', title: {en: 'Tangent Table — mechanical angle mapping', de: 'Tangent Table — mechanische Winkelabbildung'}, example: 'tangent-table.bw', mat: 'plain',
        manualJog: {A: {minDeg: -16, maxDeg: 16, stepDeg: 1, speedDps: 8}, B: {minDeg: -2627, maxDeg: 2627, stepDeg: 597, speedDps: 300}}},
    {file: 'paired-door-sync.ldr', title: {en: 'Paired Door Sync — one pinion, two opposed racks', de: 'Doppeltür-Synchron — ein Ritzel, zwei gegenläufige Zahnstangen'}, example: 'paired-door-sync.bw', mat: 'plain',
        manualJog: {A: {minDeg: -150, maxDeg: 150, stepDeg: 15, speedDps: 15}}},
    {file: 'rimrun.ldr', title: {en: 'RimRun — equal weight, different roll', de: 'RimRun — gleiche Masse, anderes Rollverhalten'}, example: 'rimrun.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 100, stepDeg: 10, speedDps: 60}}},
    {file: 'watt-line.ldr', title: {en: "Watt’s Line — approximate straight-line linkage", de: 'Watt’s Line — angenäherte Geradführung'}, example: 'watt-line.bw', mat: 'plain',
        manualJog: {A: {minDeg: -20, maxDeg: 20, stepDeg: 2, speedDps: 6}}},
    {file: 'twin-tempo.ldr', title: {en: 'TwinTempo — three-to-one hoist', de: 'TwinTempo — Seilzüge im Verhältnis drei zu eins'}, example: 'twin-tempo.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 720, stepDeg: 45, speedDps: 60}}},
    {file: 'root-bridge.ldr', title: {en: 'Root Bridge — passive geometric mean', de: 'Root Bridge — passives geometrisches Mittel'}, example: 'root-bridge.bw', mat: 'plain',
        manualJog: {A: {minDeg: -17.4, maxDeg: 22.8, stepDeg: 2, speedDps: 8}, B: {minDeg: -22.8, maxDeg: 17.4, stepDeg: 2, speedDps: 8}}},
    {file: 'balance-engine.ldr', title: {en: 'Balance Engine — reciprocating-mass balance', de: 'Balance Engine — Ausgleich hin- und hergehender Massen'}, example: 'balance-engine.bw', mat: 'plain'},
    {file: 'cusp-lab.ldr', title: {en: 'Cusp Lab — rolling-gear curve machine', de: 'Cusp Lab — Kurvenmaschine mit rollendem Zahnrad'}, example: 'cusp-lab.bw', mat: 'plain',
        manualJog: {A: {minDeg: -360, maxDeg: 0, stepDeg: 10, speedDps: 10}}},
    {file: 'gimbal-lab.ldr', title: {en: 'Gimbal Lab — three-axis gimbal lock', de: 'Gimbal Lab — dreiachsige Gimbal-Sperre'},
        example: 'gimbal-lab.bw', mat: 'plain', manualJog: {A: {minDeg: -30, maxDeg: 30, stepDeg: 5, speedDps: 10}, B: {minDeg: -5, maxDeg: 95, stepDeg: 5, speedDps: 10}, C: {minDeg: -30, maxDeg: 30, stepDeg: 5, speedDps: 10}}, intro: {
            en: 'Three nested frames put yaw, pitch and roll on separate motors. At 90° middle pitch the outer and inner axes align, so opposite A/C moves cancel at the green marker even though every bearing still turns.',
            de: 'Drei verschachtelte Rahmen verteilen Gieren, Nicken und Rollen auf getrennte Motoren. Bei 90° mittlerer Neigung liegen die äußere und innere Achse auf einer Linie; entgegengesetzte A/C-Bewegungen heben sich am grünen Marker auf, obwohl sich jedes Lager weiter dreht.'
        }},
    // Selecting any preset reloads the same saved assembly before loading its finite experiment.
    {file: 'resonance-lab.ldr', title: {en: 'Resonance Lab — near-resonant burst', de: 'Resonance Lab — resonanznahe Anregung'},
        example: 'resonance-lab.bw', mat: 'plain', manualJog: RESONANCE_MANUAL_JOG, intro: {
            en: 'One motor rocks the blue input through ±2°. Two bands excite the passive orange arm. Compare the three fresh experiments, then watch the output ring down while the input holds.',
            de: 'Ein Motor bewegt den blauen Eingang um ±2°. Zwei Bänder regen den passiven orangefarbenen Arm an. Vergleiche die drei frisch geladenen Versuche und beobachte anschließend das Ausschwingen bei gehaltenem Eingang.'
        }},
    {id: 'resonance-lab-slow', file: 'resonance-lab.ldr', title: {en: 'Resonance Lab — slow comparison', de: 'Resonance Lab — langsamer Vergleich'},
        example: 'resonance-lab-slow.bw', mat: 'plain', manualJog: RESONANCE_MANUAL_JOG},
    {id: 'resonance-lab-fast', file: 'resonance-lab.ldr', title: {en: 'Resonance Lab — fast comparison', de: 'Resonance Lab — schneller Vergleich'},
        example: 'resonance-lab-fast.bw', mat: 'plain', manualJog: RESONANCE_MANUAL_JOG},
    {file: 'echo-bridge.ldr', title: {"en": "Echo Bridge — motion passed between pendulums", "de": "Echo Bridge — Bewegung wandert zwischen Pendeln"}, example: 'echo-bridge.bw', mat: 'plain'},
    {file: 'linger.ldr', title: {"en": "Linger — six-bar dwell machine", "de": "Linger — sechsgliedriges Rastgetriebe"}, example: 'linger.bw', mat: 'plain'},
    {file: 'crossline.ldr', title: {"en": "Crossline — geared straight-line pair", "de": "Crossline — Geradführung durch Gegenrotation"}, example: 'crossline.bw', mat: 'plain'},
    {file: 'counterturn.ldr', title: {en: 'Counterturn — a free carrier and flywheel', de: 'Counterturn — freier Träger und Schwungrad'}, example: 'counterturn.bw', mat: 'plain'},
    {file: "afterturn.ldr", title: {en: "Afterturn — a closed shape cycle", de: "Afterturn — ein geschlossener Formzyklus"}, example: "afterturn.bw", mat: "plain",
        manualJog: {A: {minDeg: 0, maxDeg: 900, stepDeg: 90, speedDps: 90}, B: {minDeg: 0, maxDeg: 70, stepDeg: 10, speedDps: 10}}},
    {file: 'helixgate.ldr', title: {en: 'HelixGate — a 24:1 worm gearbox', de: 'HelixGate — ein Schneckengetriebe mit 24:1'}, example: 'helixgate.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 720, stepDeg: 45, speedDps: 60}}},
    {file: 'looprelay.ldr', title: {"en": "LoopRelay — chain drive, gear reversal", "de": "LoopRelay — Kettenantrieb mit Zahnradumkehr"}, example: 'looprelay.bw', mat: 'plain',
        manualJog: {"A": {"minDeg": 0, "maxDeg": 180, "stepDeg": 5, "speedDps": 12}}},
    {file: 'paritydial.ldr', title: {"en": "ParityDial — two outputs, one idler", "de": "ParityDial — zwei Abtriebe, ein Zwischenrad"}, example: 'paritydial.bw', mat: 'plain',
        manualJog: {"A": {"minDeg": -90, "maxDeg": 90, "stepDeg": 5, "speedDps": 15}}},
    {file: 'counterslide.ldr', title: {"en": "CounterSlide — twin-rack self-centering jaws", "de": "CounterSlide — selbstzentrierende Doppelzahnstangen"}, example: 'counterslide.bw', mat: 'plain',
        manualJog: {"A": {"minDeg": -100, "maxDeg": 0, "stepDeg": 5, "speedDps": 15}}},
    {file: 'evenhand.ldr', title: {en: 'Evenhand — counterbalanced two-joint arm', de: 'Evenhand — ausgewogener Zweigelenkarm'}, example: 'evenhand.bw', mat: 'plain',
        manualJog: {A: {minDeg: -20, maxDeg: 20, stepDeg: 5, speedDps: 20}, B: {minDeg: -30, maxDeg: 30, stepDeg: 5, speedDps: 25}}},
    {file: 'obliquity-orrery.ldr', title: {en: 'Obliquity Orrery — the tilt behind the seasons', de: 'Obliquity Orrery — die Neigung hinter den Jahreszeiten'}, example: 'obliquity-orrery.bw', mat: 'plain',
        manualJog: {A: {minDeg: -90, maxDeg: 0, stepDeg: 5, speedDps: 12}}},
    {file: 'cadence-geneva.ldr', title: {en: 'Cadence — Geneva indexing', de: 'Cadence — Malteserkreuz-Schaltung'}, example: 'cadence-geneva.bw', mat: 'plain',
        manualJog: {A: {minDeg: -45, maxDeg: 4365, stepDeg: 45, speedDps: 30}}},
    {file: 'helios-transmission.ldr', title: {en: 'Helios — epicyclic transmission', de: 'Helios — Planetengetriebe'}, example: 'helios-transmission.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 360, stepDeg: 30, speedDps: 30}, B: {minDeg: -360, maxDeg: 0, stepDeg: 30, speedDps: 42}}},
    {file: 'orion-cardan.ldr', title: {en: 'Orion — double Cardan drive', de: 'Orion — Doppel-Kardanantrieb'}, example: 'orion-cardan.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 360, stepDeg: 15, speedDps: 60}}},
    {file: 'apex.ldr', title: {en: 'Apex — Wankel rotary geometry', de: 'Apex — Wankel-Rotorgeometrie'}, example: 'apex.bw', mat: 'plain',
        manualJog: {A: {minDeg: 0, maxDeg: 1512, stepDeg: 126, speedDps: 36}}},
    {file: 'tempest-pendulum.ldr', title: {en: 'Tempest — serial double pendulum', de: 'Tempest — serielles Doppelpendel'}, example: 'tempest-pendulum.bw', mat: 'plain',
        manualJog: {A: {minDeg: -30, maxDeg: 0, stepDeg: 5, speedDps: 30}}},
    {file: 'product-plotter.ldr', title: {en: 'Product Plotter — a mechanical multiplier', de: 'Product Plotter — ein mechanischer Multiplizierer'},
        example: 'product-plotter.bw', mat: 'plain', manualJog: {A: {minDeg: -15, maxDeg: 15, stepDeg: 2, speedDps: 10}, B: {minDeg: -75, maxDeg: 75, stepDeg: 10, speedDps: 30}}, intro: {
            en: 'Motor A tilts a straight guide; motor B slides the green rail. Their intersection moves the passive orange carriage, so similar triangles make its displacement equal the product of both inputs divided by a fixed reference length.',
            de: 'Motor A neigt eine gerade Führung; Motor B verschiebt die grüne Schiene. Ihr Schnittpunkt bewegt den passiven orangefarbenen Schlitten. Ähnliche Dreiecke machen seinen Weg zum Produkt beider Eingaben, geteilt durch eine feste Bezugslänge.'
        }},
    {file: 'snapgate.ldr', title: {en: 'Snapgate — a spring memory switch', de: 'Snapgate — ein Feder-Speicherschalter'}, example: 'snapgate.bw', mat: 'plain'},
    {file: 'bit-keeper.ldr', title: {"en": "Bit Keeper — a mechanical memory", "de": "Bit Keeper — ein mechanisches Gedächtnis"}, example: 'bit-keeper.bw', mat: 'plain'},
    {file: 'offset-orbit.ldr', title: {"en": "Offset Orbit — one turn, two orbits", "de": "Offset Orbit — eine Umdrehung, zwei Bahnen"}, example: 'offset-orbit.bw', mat: 'plain'},
    {file: 'circle-splitter.ldr', title: {"en": "Circle Splitter — circles into straight strokes", "de": "Circle Splitter — Kreise werden gerade Hübe"}, example: 'circle-splitter.bw', mat: 'plain'},
    {file: 'integral.ldr', title: {en: 'Integral — a friction wheel computer', de: 'Integral — ein Reibrad-Rechner'}, example: 'integral.bw', mat: 'plain'},
    {file: 'ellipsa.ldr', title: {"en": "Ellipsa — one-motor ellipsograph", "de": "Ellipsa — Ellipsenmechanik mit einem Motor"}, example: 'ellipsa.bw', mat: 'plain'},
    {file: 'momentum-twins.ldr', title: {"en": "Momentum Twins — reaction wheels", "de": "Momentum Twins — Reaktionsräder"}, example: 'momentum-twins.bw', mat: 'plain'},
    {file: 'bloom-gate.ldr', title: {"en": "Bloom Gate — a mechanical iris", "de": "Bloom Gate — eine mechanische Iris"}, example: 'bloom-gate.bw', mat: 'plain'},
    {file: 'amplify.ldr', title: {"en": "Amplify — a path at twice the scale", "de": "Amplify — eine Bahn im doppelten Maßstab"}, example: 'amplify.bw', mat: 'plain'},
    {file: 'pantograph-doubler.ldr', title: {en: 'Pantograph Doubler — passive 2:1 scale', de: 'Pantograf-Verdoppler — passive 2:1-Übersetzung'}, example: 'pantograph-doubler.bw', mat: 'plain'},
    {file: 'scale-studio.ldr', title: {en: 'Scale Studio — 2:1 pantograph in quarter turns', de: 'Skalenstudio — 2:1-Pantograf in Vierteldrehungen'}, example: 'scale-studio.bw', mat: 'plain'},
    {file: 'ripple-relay.ldr', title: {en: 'Ripple Relay — phased Cardan joints cancel ripple', de: 'Ripple Relay — phasenrichtige Kardangelenke heben Ungleichförmigkeit auf'}, example: 'ripple-relay.bw', mat: 'plain'},
    {file: 'crossglide.ldr', title: {en: 'Crossglide — Oldham coupling for offset shafts', de: 'Crossglide — Oldham-Kupplung für versetzte Wellen'}, example: 'crossglide.bw', mat: 'plain'},
    {file: 'scale-echo.ldr', title: {en: 'Scale Echo — two-to-one pantograph', de: 'Scale Echo — Pantograf mit Faktor zwei'}, example: 'scale-echo.bw', mat: 'plain'},
    {file: 'turnwise.ldr', title: {en: 'Turnwise — unequal steering angles', de: 'Turnwise — unterschiedliche Lenkwinkel'}, example: 'turnwise.bw', mat: 'plain'},
    {file: 'ellipse-engine.ldr', title: {en: 'Ellipse Engine — orthogonal trammel', de: 'Ellipse Engine — rechtwinkliger Ellipsenzirkel'}, example: 'ellipse-engine.bw', mat: 'plain'},
    {file: 'quickstroke.ldr', title: {en: 'Quickstroke — quick-return linkage', de: 'Quickstroke — Schnellrücklauf'}, example: 'quickstroke.bw', mat: 'plain'},
    {file: 'sarrus-lift.ldr', title: {en: 'Sarrus Lift — spatial straight-line linkage', de: 'Sarrus Lift — räumliche Geradführung'}, example: 'sarrus-lift.bw', mat: 'plain'},
    {file: 'magnetic-chess.ldr', title: {en: 'Magnetic Chess — finite-force transport', de: 'Magnetic Chess — Transport mit Magnetkraft'}, example: 'magnetic-chess.bw', mat: 'plain'},
    {file: 'orbit-mixer.ldr', title: {en: 'Orbit Mixer — planetary heading control', de: 'Orbit Mixer — Planetengetriebe und Ausrichtung'}, example: 'orbit-mixer.bw', mat: 'plain'},
    {file: 'phase-bridge.ldr', title: {en: 'Phase Bridge — double-Cardan cancellation', de: 'Phase Bridge — Doppel-Kardan-Ausgleich'}, example: 'phase-bridge.bw', mat: 'plain'},
    {file: 'phase-bridge-misphased.ldr', title: {en: 'Phase Bridge — misphased comparison', de: 'Phase Bridge — falsch ausgerichteter Vergleich'}, example: 'phase-bridge.bw', mat: 'plain'},
    {file: 'axis-plotter.ldr', title: {en: 'Axis Plotter — Cartesian drawing', de: 'Axis Plotter — kartesisches Zeichnen'}, example: 'axis-plotter.bw', mat: 'plain'},
    {file: 'atlas-arm.ldr', title: {en: 'Atlas Arm — worm drives and gripper', de: 'Atlas Arm — Schneckengetriebe und Greifer'}, example: 'atlas-arm.bw', mat: 'plain'},
    {file: 'switchback-lift.ldr', title: {en: 'Switchback Lift — ball return machine', de: 'Switchback Lift — Kugel-Rücklaufmaschine'}, example: 'switchback-lift.bw', mat: 'plain'},
    {file: 'straight-eight.ldr', title: {en: 'Straight Eight — straight-line linkage', de: 'Straight Eight — Geradführung'}, example: 'straight-eight.bw', mat: 'plain'},
    {file: 'pendulum-array.ldr', title: {en: 'Motor-excited pendulum array — length sets the period', de: 'Motorangeregte Pendelreihe — Länge bestimmt die Periode'}, example: 'pendulum-array.bw', mat: 'plain'},
    {file: 'clutch-bench.ldr', title: {en: 'Clutch load bench — slipping clutch and hold', de: 'Rutschkupplungs-Prüfstand — schleifende Kupplung und Halten'}, example: 'clutch-bench.bw', mat: 'plain'},
    {file: 'pulse-percussion.ldr', title: {en: 'Pulse Percussion — cam-lifted gravity beaters', de: 'Puls-Schlagwerk — Nockenhub für Fallgewichte'}, example: 'pulse-percussion.bw', mat: 'plain'},
    {file: 'centrifugal-governor.ldr', title: {en: 'Centrifugal governor — lift grows with speed squared', de: 'Fliehkraftregler — Hub wächst mit dem Quadrat der Drehzahl'}, example: 'centrifugal-governor.bw', mat: 'plain'},
    {file: 'tidal-trio.ldr', title: {en: 'Tidal Trio: Wave — three phased four-bars', de: 'Gezeiten-Trio: Welle — drei phasenversetzte Viergelenke'},
        example: 'tidal-trio.bw', mat: 'plain'},
    {id: 'tidal-trio-together', file: 'tidal-trio.ldr', title: {en: 'Tidal Trio: Together — synchronized four-bars', de: 'Gezeiten-Trio: Gleichlauf — gleichphasige Viergelenke'},
        example: 'tidal-trio-together.bw', mat: 'plain'},
    {id: 'tidal-trio-alternating', file: 'tidal-trio.ldr', title: {en: 'Tidal Trio: Alternating — offset crank phases', de: 'Gezeiten-Trio: Abwechselnd — versetzte Kurbelphasen'},
        example: 'tidal-trio-alternating.bw', mat: 'plain'},
    {id: 'tidal-trio-reverse', file: 'tidal-trio.ldr', title: {en: 'Tidal Trio: Reverse wave — reversed phase order', de: 'Gezeiten-Trio: Gegenwelle — umgekehrte Phasenfolge'},
        example: 'tidal-trio-reverse.bw', mat: 'plain'},
    {file: 'orbital-loom.ldr', title: {en: 'Orbital Loom: Fivefold — rotating paper and pen', de: 'Orbit-Zeichner: Fünffach — drehendes Papier und Stift'},
        example: 'orbital-loom.bw', mat: 'plain'},
    {id: 'orbital-loom-sevenfold', file: 'orbital-loom.ldr', title: {en: 'Orbital Loom: Sevenfold — 7:1 pen-to-paper turns', de: 'Orbit-Zeichner: Siebenfach — 7:1 Stift zu Papier'},
        example: 'orbital-loom-sevenfold.bw', mat: 'plain'},
    {id: 'orbital-loom-elevenfold', file: 'orbital-loom.ldr', title: {en: 'Orbital Loom: Elevenfold — 11:1 pen-to-paper turns', de: 'Orbit-Zeichner: Elffach — 11:1 Stift zu Papier'},
        example: 'orbital-loom-elevenfold.bw', mat: 'plain'},
    {id: 'orbital-loom-eightfold', file: 'orbital-loom.ldr', title: {en: 'Orbital Loom: Eightfold — 8:1 pen-to-paper turns', de: 'Orbit-Zeichner: Achtfach — 8:1 Stift zu Papier'},
        example: 'orbital-loom-eightfold.bw', mat: 'plain'},
    {file: 'positioning-arm.ldr', title: {en: 'Two-joint positioning arm — serial 80/64 mm links', de: 'Zweigelenk-Positionierarm — serielle 80/64-mm-Glieder'},
        example: 'positioning-arm.bw', mat: 'plain'},
    {file: 'ratio-workbench.ldr', title: {en: 'Three-drive ratio workbench — 1:1, 1:15, 1:243', de: 'Getriebe-Vergleich — 1:1, 1:15, 1:243'},
        example: 'ratio-workbench.bw', mat: 'plain'},
    {file: 'rack-shuttle.ldr', title: {en: 'Rack shuttle table — 8T pinion, 50.27 mm per two turns', de: 'Zahnstangen-Schiebetisch — 8er-Ritzel, 50,27 mm je zwei Umdrehungen'},
        example: 'rack-shuttle.bw', mat: 'plain'},
    {file: 'crank-rocker.ldr', title: {en: 'Motorised crank-rocker — four-bar rocker', de: 'Motorisierte Kurbelschwinge — Viergelenk'},
        example: 'crank-rocker.bw', mat: 'plain'},
    {file: 'parallel-lift.ldr', title: {en: 'Parallel-motion lift — level tray on a curved path', de: 'Parallelogramm-Hebebühne — waagerechte Plattform auf gekrümmter Bahn'},
        example: 'parallel-lift.bw', mat: 'plain'},
    {file: 'screw-crane.ldr', title: {en: 'Screw crane with powered slew — screw lift and 8:28 slew', de: 'Spindelkran mit Schwenkantrieb — Spindelhub und 8:28-Schwenkung'},
        example: 'screw-crane.bw', mat: 'plain'},
    {file: 'sky-courier.ldr', title: {en: 'Sky Courier — two-winch suspended gondola', de: 'Sky Courier — schwebende Gondel an zwei Winden'},
        example: 'sky-courier.bw', mat: 'plain', intro: {
            en: 'Two 24:1 worm winches wind separate cords onto flanged drums. Shortening both cords lifts the gondola; shortening one more than the other moves it sideways. The gondola itself has no motor and may sway.',
            de: 'Zwei 24:1-Schneckenwinden wickeln getrennte Schnüre auf Bundtrommeln. Werden beide Schnüre kürzer, hebt sich die Gondel; ist eine kürzer als die andere, wandert sie zur Seite. Die Gondel selbst hat keinen Motor und kann schwingen.'
        }},
    {file: 'pivot-rover.ldr', title: {en: 'Pivot-steered rover — bogie steering and free half-shafts', de: 'Drehschemel-Rover — Drehschemellenkung und freie Halbwellen'},
        example: 'pivot-rover.bw', mat: 'plain'},
    {file: 'chain-transmission.ldr', title: {en: 'Long chain transmission — 16T to 24T, 42 links', de: 'Langes Kettengetriebe — 16er auf 24er, 42 Glieder'},
        example: 'chain-transmission.bw', mat: 'plain'},
    {file: 'flywheel-differential.ldr', title: {en: 'Flywheel differential — inertia split across two outputs', de: 'Schwungrad-Differenzial — Trägheit auf zwei Abtriebe verteilt'},
        example: 'flywheel-differential.bw', mat: 'plain'},
    {file: 'survey-rover.ldr', title: {en: 'Survey rover — gravity back-drives the sensor head', de: 'Erkundungsrover — Schwerkraft bewegt den Sensorkopf zurück'},
        example: 'survey-rover.bw', mat: 'plain'},
    {file: 'excavator.ldr', title: {en: 'Excavator — screw actuators and slewing frame', de: 'Bagger — Spindelantriebe und Drehgestell'},
        example: 'excavator.bw', mat: 'plain'},
    // A slewing crane (docs/ROBOT-LAB-ARCHITECTURE.md T1): the turntable on A, the boom luffed by a linear actuator on B.
    {file: 'crane.ldr', title: {en: 'Crane — linear-actuator boom and geared slew', de: 'Kran — Spindelausleger und Zahnkranz-Schwenkung'},
        example: 'crane.bw', mat: 'plain'},
    // The LEGO MINDSTORMS RCX (hubs/rcx/, docs/ROBOT-LAB-RCX.md): its examples are NQC (`.nqc`), compiled
    // by nqc-wasm and downloaded to the Lab's RCX, where the clean-room bytecode VM runs them.
    {file: 'rcx-bumper-car.ldr', title: {en: 'RCX bumper car — contact feedback stops or reverses', de: 'RCX-Rempelauto — Kontaktrückmeldung stoppt oder kehrt um'},
        example: 'rcx-bumper-car.nqc', mat: 'wall'},
    {id: 'rcx-line-follower', file: 'rcx-bumper-car.ldr', title: {en: 'RCX line follower — light-sensor edge tracking', de: 'RCX-Linienfolger — Kantenfolge mit Lichtsensor'},
        example: 'rcx-line-follower.nqc', mat: 'line-oval'},
    // MINDSTORMS EV3 and NXT (hubs/ev3/, hubs/nxt/, docs/ROBOT-LAB-EV3-NXT.md): their blocks reach the
    // Lab's brick as direct commands over the Scratch Link BT-classic registry. The EV3's example is
    // DEVICE EV3 text (the ev3comprehensive blocks); the NXT's, legonxt blocks (`.blocks.json`: a
    // sprite's script, added to the editing sprite) — the NXT has no DEVICE words yet.
    {file: 'ev3-wall-stopper.ldr', title: {en: 'EV3 wall stopper — ultrasonic distance stop', de: 'EV3-Wandstopper — Stopp per Ultraschall'},
        example: 'ev3-wall-stopper.bw', mat: 'wall'},
    {file: 'nxt-bumper-bot.ldr', title: {en: 'NXT bumper bot — touch-sensor reversal', de: 'NXT-Rempelroboter — Umkehr per Tastsensor'},
        example: 'nxt-bumper-bot.blocks.json', mat: 'wall'},
    // No hub at all: the Robot Lab's own lab-direct hub owns the motor, and its example steers it
    // with `lab` words (docs/SIM-LAB.md "Steering the Lab").
    {file: 'motor-bench.ldr', title: {en: 'Motor bench (no hub) — free-running motor and gear', de: 'Motorprüfstand (ohne Hub) — Motor und Getriebe im Leerlauf'},
        example: 'motor-bench.bw'},
    // LEGO radio hubs (hubs/lwp3, hubs/wedo2; docs/LWP3-VIRTUAL-HUB-NOTES.md): their examples are written in the
    // pup / boost / wedo words (lib/legoHubsDialect.js), which ⇦ To blocks turns into the real LEGO extensions'
    // blocks; Run connects those blocks to the scene's hub over Web Bluetooth or Scratch Link.
    {file: 'technic-hub-bench.ldr', title: {en: 'Technic Hub motor bench — encoder measurement', de: 'Technic-Hub-Motorprüfstand — Messung am Drehgeber'},
        example: 'technic-hub-bench.bw'},
    {file: 'boost-rover.ldr', title: {en: 'BOOST rover — two built-in wheel motors', de: 'BOOST-Rover — zwei eingebaute Radmotoren'},
        example: 'boost-rover.bw', mat: 'plain'},
    {file: 'wedo-milo.ldr', title: {en: 'WeDo 2.0 rover — distance-sensor stop', de: 'WeDo-2.0-Rover — Stopp per Abstandssensor'},
        example: 'wedo-milo.bw', mat: 'wall'}
]);
export const MODELS_BASE = 'static/sim-lab/models/';
export const PROGRAMS_BASE = 'static/sim-lab/programs/';

/**
 * Parse and compile LDraw text. Never throws for bad user input: problems
 * come back in `issues`, and `mechanism` is null when nothing can run.
 * @returns {{model: object, mechanism: object|null, issues: {severity: string, code: string, message: string, line?: number}[]}}
 */
/**
 * @param {string} text LDraw
 * @param {Map} catalog
 * @param {{mat?: string, autoPorts?: boolean}} [options] autoPorts (default: a file from elsewhere, one without our
 *        `0 Author: Brickwright`): unplugged motors and sensors go into free ports (hubs/auto-ports.js), in the model
 *        itself, so Build shows them and a port the builder takes out later stays out; mat: a mat id (bw-sim/world/mats.js): the floor shows it, the colour
 *        sensor reads it, a mat with a start pose gets the model placed on that pose, and a mat's
 *        obstacles (a wall) become static bodies the robot and the distance sensor meet
 * @returns {{model, runModel, mechanism, issues}} `model` is the model as authored (what Build edits
 *          and the project saves); `runModel` is where it stands on the mat (what is simulated and drawn)
 */
/** A file we wrote ourselves (serializeModel's header): its ports are as the builder left them, unplugged ones too. */
const OWN_FILE = /^0 Author: (?:Brickwright|CrispStrobe)\s*$/m;

export const prepareModel = (text, catalog, {mat = null, autoPorts: plugIn = !OWN_FILE.test(text), breakLoops = true, freeHingeFrictionNm} = {}) => {
    const {model: parsedModel, refusals} = parseModel(text, {catalog});
    // One issue per unknown file, however often it is placed: a real model's cables and hoses are thousands of
    // segment lines (6,424 on one set), and the Lab lists every issue.
    const unknownOf = new Map();
    const issues = [];
    for (const r of refusals) {
        const file = r.code === 'unknown-part' ? /'(.+)'/.exec(r.message)?.[1] : null;
        if (file && unknownOf.has(file)) {
            const first = unknownOf.get(file);
            first.count += 1;
            if (first.lines.length < 20) first.lines.push(r.line);
            continue;
        }
        const issue = {severity: 'warning', ...r};
        if (file) {
            Object.assign(issue, {count: 1, lines: [r.line]});
            unknownOf.set(file, issue);
        }
        issues.push(issue);
    }
    for (const issue of unknownOf.values()) {
        if (issue.count > 1) issue.message = `${issue.message} (and ${issue.count - 1} more)`;
    }
    if (refusals.some(r => r.code === 'bad-motor-direction' || r.code === 'bad-rotor-model' || r.code === 'bad-internal-edge-pair' || r.code === 'bad-solver-preset')) {
        // Keep the geometry available for inspection, but do not hand the editor
        // dangling collision-policy references. The named error still prevents
        // simulation; parseModel retains the original invalid declarations for
        // callers that validate, compile or save the raw parsed model.
        const displayModel = {...parsedModel};
        if (refusals.some(r => r.code === 'bad-internal-edge-pair')) delete displayModel.internalEdgeRemovalPairs;
        if (refusals.some(r => r.code === 'bad-solver-preset')) delete displayModel.solver;
        return {model: displayModel, runModel: displayModel, mechanism: null, issues};
    }
    if (parsedModel.parts.length === 0) {
        issues.push({severity: 'error', code: 'empty-model', message: 'The model has no parts the Sim Lab knows.', parts: []});
        return {model: parsedModel, runModel: parsedModel, mechanism: null, issues};
    }
    const matDef = mat ? createMat(mat) : null;
    const start = matDef ? matDef.startPose : null;
    // Motors and sensors the file left unplugged go into the hub's free ports (hubs/auto-ports.js).
    const {model: wired, plugged} = plugIn ? autoPorts(parsedModel, catalog, hubRegistry) : {model: parsedModel, plugged: []};
    const model = wired;
    if (plugged.length) {
        issues.push({severity: 'info', code: 'ports-plugged', parts: plugged.map(p => p.part),
            message: `Plugged in: ${plugged.map(p => `${p.part} → ${p.hub ? `${p.hub}.` : ''}${p.port}`).join(', ')}`});
    }
    for (const p of model.parts) if (p.rotorAngle !== undefined && partDrivenJoints(catalog instanceof Map ? catalog.get(p.part) : catalog[p.part]).length !== 1) {
        issues.push({severity: 'warning', code: 'bad-rotor', parts: [p.id], message: 'ROTOR needs a part with one driven internal joint.'});
    }
    const runModel = start ? placeOnStart(wired, start, driveAnchor(wired, catalog)) : wired;
    // A mat's obstacles (a wall) are static bodies of the scene, compiled with the model.
    // ...and its loads (a pallet: world/objects.js) dynamic bodies the model moves by contact.
    let mechanism;
    try {
        mechanism = compile(runModel, catalog, {version: 2, rescueLoose: plugIn, breakLoops, ...(freeHingeFrictionNm !== undefined ? {freeHingeFrictionNm} : {}), ...(matDef ? {mat, ...(matDef.obstacles.length ? {obstacles: matDef.obstacles} : {}),
        ...(matDef.loads.length ? {loads: matDef.loads} : {})} : {})});
    } catch (error) {
        if (!(error instanceof RangeError) || !error.message.startsWith('internalEdgeRemovalPairs')) throw error;
        issues.push({severity: 'error', code: 'bad-internal-edge-pair', message: error.message, parts: []});
        return {model, runModel, mechanism: null, issues};
    }

    // An explicitly declared payload is free to roll or be carried by contact.
    // Admit only wholly free payload islands: marking one structural member as
    // LOAD must never hide an accidentally detached assembly.
    const declaredLoads = new Set(model.parts.filter(p => p.load).map(p => p.id));
    const freeLoads = new Set();
    for (const b of mechanism.bodies) {
        if (!b.parts?.length || !b.parts.every(id => declaredLoads.has(id))) continue;
        if (mechanism.joints.some(j => j.body1 === b.id || j.body2 === b.id)) continue;
        if (mechanism.hubs.some(h => h.body === b.id)) continue;
        b.role = 'load';
        b.parts.forEach(id => freeLoads.add(id));
    }
    for (const id of declaredLoads) if (!freeLoads.has(id)) issues.push({severity: 'warning', code: 'bad-load', parts: [id],
        message: `Payload ${id} must be a free island containing only declared loads.`});
    issues.push(...mechanismIssues(mechanism).filter(i => !(i.code === 'loose-part' && i.parts?.length && i.parts.every(id => freeLoads.has(id)))));
    return {model, runModel, mechanism, issues};
};

/**
 * The model's hubs as the bridge and the worker take them: [{id, profile, body}] — the
 * hub part's id, its family's profile id (PartMeta v2 `hubProfile`; a v1 hub part: its
 * `hub.profile`, else SPIKE Prime) and the body that carries it (its pose is the IMU).
 * The scene still runs ONE: the hub on the first body that has one (CompiledMechanism
 * v2's hubs[0]). The data carries every hub and each binding's {hub, port}, and the
 * bridge binds several hubs by those (hub-bridge.js hubBindings); running a model's
 * second hub is the multi-hub slice's (R16: a hub picker, a route per hub).
 */
export const hubsOf = (model, mechanism, catalog, {all = false} = {}) => {
    // Every hub (CompiledMechanism v2 hubs[], in body order) when the caller runs several.
    if (all && Array.isArray(mechanism.hubs) && mechanism.hubs.length) {
        return mechanism.hubs.map(h => ({id: h.id, profile: h.profile, body: h.body}));
    }
    // The first hub of CompiledMechanism v2 (the body that carries its housing: a hub with built-in
    // motors, the BOOST Move Hub, is a part of its output bodies too).
    if (Array.isArray(mechanism.hubs) && mechanism.hubs.length) {
        const h = mechanism.hubs[0];
        return [{id: h.id, profile: h.profile, body: h.body}];
    }
    const hubParts = new Map(model.parts.filter(p => partHubProfile(catalog.get(p.part))).map(p => [p.id, partHubProfile(catalog.get(p.part))]));
    const body = mechanism.bodies.find(b => b.parts.some(id => hubParts.has(id)));
    if (!body) return [];
    const id = body.parts.find(partId => hubParts.has(partId));
    return [{id, profile: hubParts.get(id), body: body.id}];
};

/**
 * The hubs a scene runs: the model's (hubsOf), or — for a model with motors or sensors and
 * no hub part — the Robot Lab's own `lab-direct` hub (hubs/lab-direct), which owns them all so
 * blocks, `lab` words and Python/JS can turn them directly through the same port boundary.
 * Its pose is not an IMU (nothing reads it): it rides on the first moving body.
 */
export const sceneHubDefs = (model, mechanism, catalog, {all = false, registry = hubRegistry} = {}) => {
    const defs = hubsOf(model, mechanism, catalog, {all});
    if (defs.length || !registry.has('lab-direct')) return defs;
    const wired = mechanism.joints.some(j => j.motor) || (mechanism.sensors || []).length > 0;
    if (!wired) return [];
    const body = (mechanism.bodies.find(b => b.motion === 'dynamic') || mechanism.bodies[0]).id;
    return [{id: LAB_DIRECT_ID, profile: 'lab-direct', body}];
};

/** The body that carries the (first) hub, or null. */
export const hubBodyOf = (model, mechanism, catalog) => hubsOf(model, mechanism, catalog)[0]?.body ?? null;

/**
 * The scene's hubs as VirtualHubs: `createHub(def)` may supply one (an emulated
 * firmware's, say; it returns null to take the family's default), and the default
 * adapters wrap `hubState` — which only one hub of a scene can do.
 */
const makeHubs = ({defs, registry, hubState, createHub}) => {
    let shared = false;
    return defs.map((h, index) => {
        // The Robot Lab's own hub wraps no hub state and is no firmware's to emulate.
        if (h.profile === 'lab-direct') return {...h, hub: registry.create(h.profile, {id: h.id})};
        const made = createHub ? createHub({...h, index}) : null;
        if (made) return {...h, hub: made};
        if (shared) throw new Error(`hub '${h.id}': two hubs of a scene cannot share one hub state`);
        shared = true;
        return {...h, hub: registry.create(h.profile, {id: h.id, hubState})};
    });
};

/**
 * At most this much simulated time per worker batch. When the worker cannot keep up
 * with real time, the rest is dropped (stats.droppedMs) — as the pane's frame clamp
 * (MAX_FRAME_MS) drops it on the main thread — instead of piling up as lag.
 */
export const MAX_BATCH_STEPS = 20;

/** The index of the first body whose pose (7 numbers each, as posesOf and snapshot() give) is not finite, or -1. */
const nonFiniteBody = bodies => {
    for (let i = 0; i < bodies.length; i++) if (!Number.isFinite(bodies[i])) return Math.floor(i / 7);
    return -1;
};

/**
 * Why a run stops when the solver diverges: a NaN or infinite pose never heals, and stepping
 * it on only makes the worker slow and every reader of the poses (the view, the API) fail.
 */
const divergence = (bodyId, ms) => new Error(`the solver diverged: body ${bodyId} has no finite pose at ${(ms / 1000).toFixed(2)} s`);

export class SimSession {
    /**
     * @param {object} options
     * @param {object} options.hubState the hub's state (SPIKE: a VirtualSpikeHubState, shared with the arena
     *        and the program routes), wrapped by its family's VirtualHub adapter
     * @param {object} [options.registry] the hub registry (default: the built-in families)
     * @param {object} options.model a PlacedModel
     * @param {object} options.mechanism its CompiledMechanism
     * @param {Map} options.catalog part catalog (catalogFrom(parts.json))
     * @param {object} [options.J] the Jolt namespace (loadJolt()): the physics runs on this thread
     * @param {object} [options.worker] a PhysicsClient whose worker has loaded this mechanism
     *        (simLoad), with `loaded` its reply: the physics runs in the worker
     * @param {Function} [options.createHub] ({id, profile, body, index}) => a VirtualHub for that hub,
     *        or null for its family's default adapter on `hubState`. Given, the session runs EVERY
     *        hub of the model (CompiledMechanism v2 hubs[]); absent, the first only (as before R13)
     * @param {object[]} [options.hubs] the hubs, already made (fromText makes them to decide on the worker)
     */
    constructor ({hubState, model, runModel = model, mechanism, catalog, mat = null, J = null, worker = null, loaded = null,
        registry = hubRegistry, createHub = null, hubs: made = null}) {
        this.model = model;
        /** The model where it stands on the mat — what the physics runs and the view draws. */
        this.runModel = runModel;
        this.mat = mat;
        this.mechanism = mechanism;
        /** The part catalogue the model was compiled with (the Robot Lab API reads part kinds from it). */
        this.catalog = catalog;
        this.hubState = hubState;
        /** [{id, profile, body, hub}]: the model's hubs, each a VirtualHub (hubs/hub-profile.js). */
        this.hubs = made || makeHubs({defs: sceneHubDefs(model, mechanism, catalog, {all: Boolean(createHub), registry}), registry, hubState, createHub});
        /** A hub of the scene cannot be rewound: in-thread, one step per lockstep exchange. */
        this.lockstep = this.hubs.some(({hub}) => isNonRewindable(hub));
        if (worker && this.lockstep) {
            throw new Error(`${L3_HUB_NEEDS_LOCKSTEP}: a scene with an emulated hub runs its physics on the main thread, not in the worker`);
        }
        const hubs = this.hubs.map(({hub, body}) => ({hub, body}));
        this.time = 0;
        this.listeners = new Set();
        this._observationRevision = 0;
        this._measurementObservation = null;
        this._precisionAnalysis = createPrecisionAnalysis(null);
        /** Why a worker was offered but the physics runs here (fromText), or null. */
        this.workerError = null;
        this.worker = Boolean(worker);
        if (worker) {
            this.client = worker;
            this.scene = loaded.scene;
            this.core = new MirrorCore(mechanism, loaded);
            this.bridge = hubs.length ? new HubReplay({hubs, mechanism, readings: loaded.readings || {}}) : null;
            this._steps = 0;
            this._ticks = [];
            this._pendingMs = 0;
            this._inFlight = null;
            this._idle = [];
            /** Round trips, work in the worker, redone batches, replay divergences (always 0), dropped time. */
            this.stats = {batches: 0, steps: 0, redos: 0, diverged: 0, droppedMs: 0,
                roundTripMs: 0, maxRoundTripMs: 0, workerMs: 0, mainMs: 0};
            this.failed = null;
        } else {
            this.core = createPhysicsCore(J, mechanism, {stepHz: 1000 / STEP_MS});
            // Without a hub there is nothing to drive, but the model still falls and settles.
            this.bridge = hubs.length ? new SimHubBridge({hubs, core: this.core, mechanism}) : null;
            this.failed = null;
            if (this.lockstep) {
                this.runner = new LockstepRunner({bridge: this.bridge, hubs: this.hubs.map(({hub}) => hub),
                    onAdvance: runner => { this.time = runner.stats.simulatedMs; this._advanced(); },
                    onFail: error => { this.failed = error; }});
                this.stats = this.runner.stats;
            }
        }
    }

    /**
     * Builds a session from LDraw text; resolves to {session, issues} or {session: null, issues}.
     * With `worker` (a PhysicsClient) the physics runs there; if the worker cannot load the
     * scene, it runs on this thread and `session.workerError` says why.
     */
    static async fromText (text, {hubState, catalog, mat = null, autoPorts: importAutoPorts, worker = null, registry = hubRegistry, createHub = null}) {
        const {model, runModel, mechanism, issues} = prepareModel(text, catalog, {mat, autoPorts: importAutoPorts});
        if (!mechanism) return {session: null, issues, model, runModel};
        let workerError = null;
        const defs = sceneHubDefs(model, mechanism, catalog, {all: Boolean(createHub), registry});
        const hubs = makeHubs({defs, registry, hubState, createHub});
        if (worker && hubs.some(({hub}) => isNonRewindable(hub))) {
            // Refused, not failed: the worker stays usable for the next scene.
            workerError = `${L3_HUB_NEEDS_LOCKSTEP}: an emulated hub cannot be rewound, so this scene runs on the main thread`;
            worker = null;
        }
        if (worker) {
            try {
                const loaded = await worker.simLoad({mechanism, hubs: defs, stepMs: STEP_MS});
                return {session: new SimSession({hubState, model, runModel, mechanism, catalog, mat, worker, loaded, registry, hubs}), issues, model, runModel};
            } catch (error) {
                workerError = error.message || String(error);
            }
        }
        const J = await loadJolt();
        const session = new SimSession({hubState, model, runModel, mechanism, catalog, mat, J, registry, hubs});
        session.workerError = workerError;
        return {session, issues, model, runModel};
    }

    /**
     * Advance by ms of simulated time (fixed 5 ms steps inside). On this thread the steps
     * run now; with the worker they are sent as one batch and reach the hub, `time` and
     * the poses when it comes back (idle() waits for that).
     */
    tick (ms) {
        if (this.worker) {
            if (this._disposed || this.failed) return;
            this._pendingMs += ms;
            if (this.bridge) this._steps += this.bridge.due(ms);
            else this._ticks.push(ms);
            this._send();
            return;
        }
        if (this.runner) {
            this.runner.tick(ms);
            return;
        }
        if (this.failed) return;
        if (this.bridge) this.bridge.tick(ms);
        else this.core.step(ms / 1000);
        const snap = this.core.snapshot();
        const bad = nonFiniteBody(snap.bodies);
        if (bad >= 0) {
            // The poses stay those of the last finite step (snapshot()); time stops there.
            this._fail(divergence(snap.bodyIds[bad], this.time + ms));
            return;
        }
        this._good = snap;
        this.time += ms;
        this._advanced();
    }

    /** Resolves when every tick so far has reached the hub (at once on this thread). */
    idle () {
        if (this.runner) return this.runner.idle();
        if (!this.worker || (!this._inFlight && !this._due())) return Promise.resolve();
        return new Promise((resolve, reject) => this._idle.push({resolve, reject}));
    }

    /** Calls fn() each time simulated time advances (after the hub has the new step). Returns an unsubscribe. */
    onAdvance (fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    /** Reset analytical state on an explicit selection change; no physical state is changed. */
    setMeasurementObservation ({joints = [], contacts = false, screws = false, mode = 'oscillation', thresholdDegrees = 0, bodies = []} = {}) {
        // bodies: optional per-step poses of requested dynamic bodies (observational; empty by default).
        const key = JSON.stringify({joints, contacts, screws, mode, thresholdDegrees, ...(bodies.length ? {bodies} : {})});
        if (key === this._measurementObservationKey) return;
        const selection = observationSelection({revision: ++this._observationRevision, joints, contacts, screws, mode, thresholdDegrees, ...(bodies.length ? {bodies} : {})}, this.mechanism);
        this._measurementCollector?.detach();
        this._measurementObservationKey = key;
        this._measurementObservation = selection;
        this._precisionAnalysis = createPrecisionAnalysis(selection);
        this._lastMeasurementObservations = null;
        this._measurementCollector = this.worker ? null : collectFixedObservations(this.core, this.mechanism, selection);
    }

    resetMeasurementPrecision () {
        if (!this._measurementObservation) return;
        this._measurementCollector?.detach();
        this._measurementObservation = {...this._measurementObservation, revision: ++this._observationRevision};
        this._lastMeasurementObservations = null;
        this._precisionAnalysis = createPrecisionAnalysis(this._measurementObservation);
        this._measurementCollector = this.worker ? null : collectFixedObservations(this.core, this.mechanism, this._measurementObservation);
    }

    /** Copied last accepted bounded packet, for observational consumers only. */
    get measurementObservations () { return this._lastMeasurementObservations ? JSON.parse(JSON.stringify(this._lastMeasurementObservations)) : null; }

    _acceptMeasurementObservations (packet) {
        if (!this._disposed && this._precisionAnalysis.accept(packet)) this._lastMeasurementObservations = packet;
    }

    get measurementPrecision () { return this._precisionAnalysis.snapshot(); }

    /** Optional worker startup diagnostic. Enable before the first tick; null disables observations only. */
    setStartupDiagnostic (value) {
        if (value == null) {
            this._startupDiagnosticSelection = null;
            this._lastStartupDiagnosticObservations = null;
            return null;
        }
        if (this._disposed || !this.worker || this.time !== 0 || this.core.time !== 0 || this._inFlight || this._due() || this._pendingMs > 0) {
            throw new Error('startup diagnostic requires an idle worker before its first tick');
        }
        const selection = startupDiagnosticSelection({...value, revision: (this._startupDiagnosticRevision || 0) + 1}, this.mechanism);
        this._startupDiagnosticRevision = selection.revision;
        this._startupDiagnosticSelection = selection;
        this._lastStartupDiagnosticObservations = null;
        return structuredClone(selection);
    }

    get startupDiagnosticRevision () { return this._startupDiagnosticSelection?.revision ?? null; }
    get startupDiagnosticObservations () { return this._lastStartupDiagnosticObservations ? structuredClone(this._lastStartupDiagnosticObservations) : null; }

    _acceptStartupDiagnostic (packet, batch, endSeconds) {
        if (this._disposed || !this._startupDiagnosticSelection || batch.startupDiagnostic !== this._startupDiagnosticSelection) return;
        const accepted = admitStartupDiagnostic(packet, batch.startupDiagnostic, batch.startupDiagnosticStartSeconds, endSeconds);
        this._lastStartupDiagnosticObservations = {schema: 'robot-lab.startup-accepted-batch.v1',
            revision: this._startupDiagnosticSelection.revision, acceptedBatch: (this._startupDiagnosticAcceptedCount || 0) + 1,
            coreStartSeconds: batch.startupDiagnosticStartSeconds, coreEndSeconds: endSeconds, ...accepted};
        this._startupDiagnosticAcceptedCount = this._lastStartupDiagnosticObservations.acceptedBatch;
    }

    _advanced () {
        if (this._disposed) return;
        const observations = this._measurementCollector?.take();
        if (observations) this._acceptMeasurementObservations(observations);
        for (const fn of [...this.listeners]) {
            if (this._disposed) break;
            if (this.listeners.has(fn)) fn(this);
        }
    }

    _due () {
        return this.bridge ? this._steps > 0 : this._ticks.length > 0;
    }

    _send () {
        if (this._inFlight || this._disposed || this.failed) return;
        if (!this._due()) {
            // Ticks too short for a step still count as simulated time, as on this thread.
            if (this._pendingMs > 0 && !this._inFlight) { this.time += this._pendingMs; this._pendingMs = 0; this._advanced(); }
            this._settle();
            return;
        }
        let ms = this._pendingMs;
        const batch = {};
        if (this.bridge) {
            let steps = this._steps;
            if (steps > MAX_BATCH_STEPS) {
                this.stats.droppedMs += (steps - MAX_BATCH_STEPS) * STEP_MS;
                steps = MAX_BATCH_STEPS;
                ms = steps * STEP_MS;
            }
            this._steps = 0;
            const hubs = this._exportHubs();
            Object.assign(batch, {steps, hubs, key: this._hubsKey(hubs)});
        } else {
            batch.ticks = this._ticks;
            this._ticks = [];
        }
        this._pendingMs = 0;
        batch.ms = ms;
        batch.observation = this._measurementObservation;
        if (this._startupDiagnosticSelection) {
            batch.startupDiagnostic = this._startupDiagnosticSelection;
            batch.startupDiagnosticStartSeconds = this.core.time;
        }
        this._post(batch, false);
    }

    _post (batch, redo) {
        const sent = this._inFlight = {batch, at: now()};
        this.client.simBatch({scene: this.scene, steps: batch.steps, ticks: batch.ticks, hubs: batch.hubs, redo, observation: batch.observation,
            ...(batch.startupDiagnostic ? {startupDiagnostic: batch.startupDiagnostic} : {})}).then(
            reply => { if (this._inFlight === sent) this._receive(sent, reply); },
            error => { if (this._inFlight === sent) this._fail(error); });
    }

    _receive (sent, reply) {
        if (this._disposed) return;
        const start = now();
        const {batch} = sent;
        const stats = this.stats;
        const roundTrip = start - sent.at;
        stats.roundTripMs += roundTrip;
        stats.maxRoundTripMs = Math.max(stats.maxRoundTripMs, roundTrip);
        stats.workerMs += reply.workMs || 0;
        if (this.bridge) {
            // Something set a motor while the batch was in flight: in-thread, that command
            // would have reached the hub before these steps. Redo them from the worker's
            // checkpoint with the hubs as they are now.
            const hubs = this._exportHubs();
            const key = this._hubsKey(hubs);
            if (key !== batch.key) {
                stats.redos++;
                Object.assign(batch, {hubs, key});
                stats.mainMs += now() - start;
                this._post(batch, true);
                return;
            }
        }
        // A diverged batch reaches neither the hubs nor the mirror: they keep the last finite step.
        const bad = nonFiniteBody(reply.bodies);
        if (bad >= 0) {
            stats.mainMs += now() - start;
            this._fail(divergence(this.core.bodyIds[bad], this.time + batch.ms));
            return;
        }
        if (this.bridge) stats.diverged += this.bridge.replay(reply.frames);
        // Replay may synchronously publish a hub callback which disposes this session.
        if (this._disposed || this._inFlight !== sent) return;
        this.core.update(reply);
        // Only the accepted replay may contribute; stale selection replies are refused.
        this._acceptMeasurementObservations(reply.observations);
        if (batch.startupDiagnostic) this._acceptStartupDiagnostic(reply.startupDiagnostic, batch, reply.t);
        stats.batches++;
        stats.steps += batch.steps || 0;
        this.time += batch.ms;
        this._inFlight = null;
        stats.mainMs += now() - start;
        this._advanced();
        this._send();
    }

    /** Every hub's exportState(), by hub id (what a batch carries to the worker's mirrors). */
    _exportHubs () {
        const out = {};
        for (const {id, hub} of this.hubs) out[id] = hub.exportState();
        return out;
    }

    /** One comparable key for all hubs' states: equal keys, identical drives. */
    _hubsKey (states) {
        return this.hubs.map(({id, hub}) => hub.stateKey(states[id])).join('\n');
    }

    _settle () {
        if (this._inFlight || this._due()) return;
        const waiting = this._idle;
        this._idle = [];
        for (const w of waiting) w.resolve();
    }

    _fail (error) {
        this.failed = error;
        this._inFlight = null;
        const waiting = this._idle || [];
        this._idle = [];
        for (const w of waiting) w.reject(error);
        if (typeof console !== 'undefined') console.error('Sim Lab physics worker:', error);
    }

    /** The poses now; after a divergence on this thread, those of the last finite step. */
    snapshot () { return this.failed && this._good ? this._good : this.core.snapshot(); }

    /** Lockstep scenes: simulated ms per wall ms lately (null before it is measured, or without lockstep). */
    get realTimeFactor () {
        return this.runner ? this.runner.realTimeFactor : null;
    }

    dispose () {
        this._disposed = true;
        this._measurementCollector?.detach();
        this._measurementObservation = null;
        this._lastMeasurementObservations = null;
        if (this._startupDiagnosticSelection) {
            this._startupDiagnosticSelection = null;
            this._lastStartupDiagnosticObservations = null;
        }
        this.listeners.clear();
        this.runner?.dispose();
        this.bridge?.dispose();
        if (this.worker) {
            this.client.simDispose(this.scene).catch(() => {});
            this._inFlight = null;
            this._steps = 0;
            this._ticks = [];
            this._settle();
        } else this.core.destroy();
    }
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
