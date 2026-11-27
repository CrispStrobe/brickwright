import React from 'react';
import {connect} from 'react-redux';
import {Icon, Popup, toolStyles} from './sim-lab-toolbar.jsx';
import TANG_NANO_20K from 'bw-circuit-ui/parts-data/tang_nano_20k.json';
import {parseCst, emitCst} from '../../lib/bw-fpga/cst.js';
import {bridge, constraintsFromBindings} from '../../lib/bw-fpga/port-bridge.js';
import {applyPortValues, readBoardInputs} from '../../lib/bw-fpga/drive.js';
import {verilogToModel} from '../../lib/bw-fpga/verilog-to-model.js';
import {yosysToModel} from '../../lib/bw-fpga/yosys-to-model.js';
import {EXAMPLES} from '../../lib/bw-fpga/examples.js';
import {buildDemoBoard} from '../../lib/bw-fpga/demo-board.js';
import {buildCmosGate} from '../../lib/bw-fpga/cmos-board.js';
import {buildLogicIcGate} from '../../lib/bw-fpga/logic-ic-board.js';
import {LOGIC_IC_GATES, gateToLogicIc} from '../../lib/bw-fpga/logic-ic.js';
import {buildLogicIcCircuit, IC_CIRCUITS, circuitLabel, circuitHint} from '../../lib/bw-fpga/logic-ic-circuit.js';
import {t as tr, tn} from '../../lib/bw-fpga/l10n.js';
import {deriveView, viewStyles} from '../../lib/bw-fpga/tab-view.js';
import {readPorts, checkWidths, detectClockPort} from '../../lib/bw-fpga/yosys.js';
// Small and dependency-free, so these stay static: the licence screen is useful
// on its own, and the synthesis client's only job today is to refuse honestly.
import {screenForHostedSynthesis} from '../../lib/bw-fpga/licence.js';
import {synthesise} from '../../lib/bw-fpga/synthesis.js';
import {createLocalClient} from '../../lib/bw-fpga/local-client.js';
import {probeFlash, flashBitstream} from '../../lib/bw-fpga/fpga-tauri-transport.js';
import {webUsbSupported} from '../../lib/bw-fpga/webusb-flash.js';
import {defaultCatalog, probeBackends, selectBackend, offerable}
    from '../../lib/bw-fpga/backends.js';

const L10N = {
    en: {
        workspace: 'Workspace',
        more: 'More FPGA controls',
        designWorkspace: 'Design',
        buildWorkspace: 'Build',
        simulateWorkspace: 'Simulate',
        labInfo: 'About FPGA',
        gettingStarted: 'Getting started',
        showGuide: 'Show steps',
        replacesCircuit: 'Replaces the current Circuit model.',
        exampleLabel: 'Example',
        loadExample: 'Load example',
        exampleInfo: 'About this example',
        editorLabel: 'Editor',
        canvasEditor: 'Gate canvas',
        verilogEditor: 'Verilog',
        gateLabel: 'Gate',
        circuitLabel: 'Circuit',
        circuitModel: 'Circuit model',
        demoModel: 'Tang Nano demo board',
        transistorModel: 'Transistor gate',
        chipModel: '74xx gate',
        circuitModelOption: '74xx circuit',
        circuitInfo: 'About circuit models',
        circuitHelp: 'Build a wired demo board, a transistor gate, a 74xx gate, or a multi-chip circuit in the Circuit view. Building replaces the circuit there.',
        constraintsEditor: 'Pin constraints (.cst)',
        buildTarget: 'Build target',
        serviceBuild: 'Synthesis service',
        browserBuild: 'Browser netlist',
        buildInfo: 'About synthesis',
        backendInfo: 'Backend details',
        available: 'available',
        unavailable: 'unavailable',
        notProbed: 'not probed',
        browserLimit: 'Netlist only. Browser synthesis does not produce a bitstream.',
        simulateInfo: 'About simulation',
        simulationView: 'View',
        schematicView: 'Schematic',
        waveformView: 'Waveforms',
        pinsView: 'Pins and signals',
        importNetlist: 'Netlist input',
        emptySimulation: 'Load or build a netlist to inspect signals and step the clock.',
        controllerDisplay: 'Controller display',
        ledsDisplay: 'LED indicators',
        sevenSegmentDisplay: '7-segment number',
        wireDemoBoard: 'Wire up a demo board',
        wireDemoBoardHint: 'in Design, choose the Tang Nano demo board and build it',
        loadDesign: 'Load a design and synthesise it',
        loadDesignHint: 'load “Counting sequence” in Design, then open Build to synthesise',
        stepClock: 'Step the clock',
        stepClockHint: 'in Simulate, step the clock and watch the LEDs count in binary',
        seeInController: 'See it in the Controller view',
        seeInControllerHint: 'in Simulate, choose a Controller display to mirror the LEDs and run the design',
        allDone: '🎉 You designed a chip, synthesised it, and watched it light LEDs on the board and in the Widgets view.',
        newToFpga: 'New to the FPGA lab? Four steps to see your logic light LEDs:',
        threeWaysToSee: 'Three ways to SEE it: ',
        designDrawnAs: 'your design is drawn as a ',
        gateSchematic: 'gate schematic',
        andAs: ' and as ',
        waveforms: 'waveforms',
        belowAndYouCan: ' below — and you can ',
        buildYourOwnLogic: 'build your own logic',
        byPlacingGates: ' by placing gates (under “Verilog”), ',
        noHdlTyped: 'no HDL typed.',
        preferNoTyping: 'Prefer no typing? Open ',
        buildItVisuallyQuote: '“build it visually”',
        underVerilog: ' under Verilog and place gates — it runs live and generates the HDL for you.',
        done: 'Done',
        hideThis: 'Hide this',
        fpgaTitle: 'FPGA — Tang Nano 20K',
        fpgaDesc1: 'Write Verilog, synthesise it to a bitstream on the hosted service or to a ',
        fpgaDesc2: 'netlist here in the browser, and check that your pin constraints reach the ',
        fpgaDesc3: 'board. Copyleft sources are refused on the shared server and must be built ',
        fpgaDesc4: 'locally — the licence check below decides.',
        verilogTitle: 'Verilog',
        parseToCanvas: '⤵ Show on canvas',
        newHere: 'New here? Load a starter design, then Synthesise:',
        orBuildItVisually: 'Or build it visually — place gates and wire them, no Verilog typed',
        loadingGateBuilder: 'Loading the gate builder…',
        orOnFullCanvas: 'Build it visually — drag gates onto the canvas and wire them (no Verilog typed)',
        loadingCanvas: 'Loading the canvas…',
        wireDemoBoardBtn: '⬢ Wire up a demo board',
        buildTransistorsBtn: '⚛ Build the gate from transistors',
        buildIcBtn: '⚙ Build the gate from a 74xx chip',
        buildCircuitBtn: '⚙ Build this circuit',
        permissiveLicence: 'Declares a permissive licence — it may be built on the shared server.',
        whereBuiltTitle: 'Where it would be built',
        backendLabel: 'Backend: ',
        autoOption: 'Auto',
        buildsOn: 'Builds on ',
        synthesiseBtn: 'Synthesise',
        downloadFs: 'Download .fs',
        flashToBoard: 'Flash to board',
        flashingRuns: 'Flashing runs openFPGALoader in the native app.',
        browserCannotFlash1: 'A browser cannot flash yet. With the board on USB, use the CLI ',
        browserCannotFlash2: ' or ',
        browserCannotFlash3: '.',
        browserHasWebUsb: 'Your browser has WebUSB; direct in-browser flashing is planned but not built yet.',
        downloadNetlist: 'Download netlist',
        doneFeedback: '✓ Done.',
        synthesiseHereTitle: 'Synthesise in this browser (TN6a)',
        yosysRunsHere1: 'Yosys runs here, producing a netlist you can download or check in the pin ',
        yosysRunsHere2: 'panel below. It does not produce a bitstream — that needs place and route, ',
        yosysRunsHere3: 'another 183 MB, which is not offered yet.',
        starting: 'starting',
        downloading: 'Downloading…',
        downloadToolchain: 'Download the toolchain (77 MB, once)',
        synthesiseHereBtn: 'Synthesise here',
        checkPinsTitle: 'Check which pins reach the board (',
        placed: ' placed',
        cannot: ' cannot',
        checkPinsDesc1: 'Which of a design’s pins can actually reach the breadboard. This reads ',
        checkPinsDesc2: 'Gowin constraints against the real board part, and the same constraints ',
        checkPinsDesc3: 'are sent with a hosted build.',
        optionalPasteNetlist: 'Optional: paste a Yosys JSON netlist to also check the ports exist',
        importYosysToCanvas: '⤵ Import netlist to canvas',
        topModule: ' — top module: ',
        schematicTitle: 'Schematic — your design as gates',
        schematicDesc1: 'This is the Verilog above, synthesised to logic gates. Inputs sit on ',
        schematicDesc2: 'the left, outputs on the right; a wire lights with the value it carries ',
        schematicDesc3: 'as you step the clock.',
        loadingSchematic: 'Loading the schematic view…',
        waveformsTitle: 'Waveforms — the outputs over time',
        waveformsDesc1: 'The design run from reset for a few clock cycles: each output bit as a ',
        waveformsDesc2: 'square wave. A counter reads bottom-up — the lowest bit toggles every ',
        waveformsDesc3: 'cycle, the highest slowest.',
        loadingWaveform: 'Loading the waveform view…',
        reachesBoard: 'Reaches the board (',
        pinArrow: ' → pin ',
        terminalArrow: ' → terminal ',
        sharesHardware: ' (shares onboard hardware)',
        nothingPlacedYet: 'Nothing placed yet.',
        usableWithCaveat: 'Usable, with a caveat (',
        cannotReachBoard: 'Cannot reach the board (',
        clockTitle: 'Clock',
        clockDesc1: 'This design is clocked on ',
        clockDesc2: '. Step it to advance the design one cycle at a time and watch the outputs — and the board — follow.',
        stepClockBtn: 'Step clock ▸',
        resetBtn: 'Reset',
        stopAutoRun: '⏸ Stop auto-run',
        autoRun: '▶ Auto-run',
        cycle: ' cycle',
        cycles: ' cycles',
        showLeds: '⎈ Show the LEDs in the Controller view',
        showSeg7: '⧉ Show as a 7-seg number',
        mirrorsPins: 'mirrors pins ',
        asIndicators: ' as indicators and starts the clock',
        designInputsTitle: 'Design inputs',
        nothingDrivesThese: 'Nothing drives these yet, so set them here and watch the outputs follow.',
        whatCircuitEngine: 'What the circuit engine would be told',
        high: ' HIGH',
        low: ' LOW',
        highZ: ' (high-Z: the design reads it)',
        undriven: ' — undriven: nothing models the design yet, so there is no value to put on it.',
        nothingToDrive: 'Nothing to drive.',
        constraintsTitle: 'Constraints for the Gowin toolchain',
        constraintsDesc1: 'Canonical .cst covering only the ports that reach a header pin. ',
        constraintsDesc2: 'This is what leaves for real silicon.',
        plannedNext: 'Planned next: flashing a produced bitstream from the native app.',
        help: 'Help',
        buildingOn: 'Synthesising on ',
        mayTakeAMinute: ' … this can take up to a minute.',
        workingInBrowser: 'Synthesising in this browser …',
        needsAttention: 'Needs attention',
        synthFailedNext: 'Next step: fix the design in Design (or switch the build target in Build), then synthesise again.',
        headsUp: 'Heads-up',
        notes: 'Notes',
        glossaryTitle: 'Words used here',
        glossary: [
            ['Synthesis', 'turns your design into the gates and wires an FPGA can hold.'],
            ['Netlist', 'the synthesised design as a list of gates and wires. You can simulate it and download it.'],
            ['Bitstream (.fs)', 'the file that configures the real board. Only the hosted service makes one.'],
            ['Pin constraints (.cst)', 'which FPGA pin each port of your design uses.']
        ],
        pinsHint: 'Which FPGA pin each port of the design uses. The defaults match the examples.',
        bitstreamReady: 'Bitstream ready',
        netlistReady: 'Netlist ready',
        modules: 'modules',
        howToFlash: 'How to flash',
        flashing: 'Flashing…',
        flashFailed: 'Flash failed: ',
        nextSimulate: 'Next: Simulate ▸',
        nextBuild: 'Next: Build ▸',
        goBuild: 'Go to Build',
        designHint: 'Pick an example or draw gates, or write Verilog.',
        buildHint: 'Turn the design into something that runs: a bitstream for the board, or a netlist to simulate.',
        simulateHint: 'Step the clock, flip the inputs and watch the outputs.',
        synthesising: 'Synthesising…',
        needDesignFirst: 'Load an example or write a design in Design first.',
        boardOptional: 'Optional: try it on a breadboard.'
    },
    de: {
        workspace: 'Arbeitsbereich',
        more: 'Weitere FPGA-Werkzeuge',
        designWorkspace: 'Entwerfen',
        buildWorkspace: 'Erstellen',
        simulateWorkspace: 'Simulieren',
        labInfo: 'Über FPGA',
        gettingStarted: 'Erste Schritte',
        showGuide: 'Schritte anzeigen',
        replacesCircuit: 'Ersetzt das aktuelle Schaltungsmodell.',
        exampleLabel: 'Beispiel',
        loadExample: 'Beispiel laden',
        exampleInfo: 'Über dieses Beispiel',
        editorLabel: 'Editor',
        canvasEditor: 'Gatter-Leinwand',
        verilogEditor: 'Verilog',
        gateLabel: 'Gatter',
        circuitLabel: 'Schaltung',
        circuitModel: 'Schaltungsmodell',
        demoModel: 'Tang-Nano-Demoboard',
        transistorModel: 'Transistorgatter',
        chipModel: '74xx-Gatter',
        circuitModelOption: '74xx-Schaltung',
        circuitInfo: 'Über Schaltungsmodelle',
        circuitHelp: 'Erstellen Sie ein verkabeltes Demoboard, ein Transistorgatter, ein 74xx-Gatter oder eine Schaltung aus mehreren Chips in der Schaltungsansicht. Dabei wird die dortige Schaltung ersetzt.',
        constraintsEditor: 'Pin-Zuordnungen (.cst)',
        buildTarget: 'Syntheseziel',
        serviceBuild: 'Synthesedienst',
        browserBuild: 'Browser-Netzliste',
        buildInfo: 'Über Synthese',
        backendInfo: 'Backend-Details',
        available: 'verfügbar',
        unavailable: 'nicht verfügbar',
        notProbed: 'noch nicht geprüft',
        browserLimit: 'Nur Netzliste. Die Browser-Synthese erzeugt keinen Bitstream.',
        simulateInfo: 'Über Simulation',
        simulationView: 'Ansicht',
        schematicView: 'Schaltplan',
        waveformView: 'Wellenformen',
        pinsView: 'Pins und Signale',
        importNetlist: 'Netzliste eingeben',
        emptySimulation: 'Laden oder erstellen Sie eine Netzliste, um Signale zu prüfen und die Uhr zu takten.',
        controllerDisplay: 'Controller-Anzeige',
        ledsDisplay: 'LED-Anzeigen',
        sevenSegmentDisplay: '7-Segment-Zahl',
        wireDemoBoard: 'Demoboard verkabeln',
        wireDemoBoardHint: 'unter Entwerfen das Tang-Nano-Demoboard wählen und erstellen',
        loadDesign: 'Design laden und synthetisieren',
        loadDesignHint: 'unter Entwerfen „Counting sequence“ laden, dann unter Erstellen synthetisieren',
        stepClock: 'Uhr takten',
        stepClockHint: 'unter Simulieren die Uhr takten und die LEDs binär zählen sehen',
        seeInController: 'In der Controller-Ansicht ansehen',
        seeInControllerHint: 'unter Simulieren eine Controller-Anzeige wählen, um die LEDs zu spiegeln und das Design auszuführen',
        allDone: '🎉 Sie haben einen Chip entworfen, synthetisiert und gesehen, wie er LEDs auf dem Board und in der Widgets-Ansicht zum Leuchten bringt.',
        newToFpga: 'Neu im FPGA-Labor? Vier Schritte, um Ihre Logik LEDs leuchten zu sehen:',
        threeWaysToSee: 'Drei Möglichkeiten, es zu SEHEN: ',
        designDrawnAs: 'Ihr Design wird gezeichnet als ',
        gateSchematic: 'Gatterschaltplan',
        andAs: ' und als ',
        waveforms: 'Wellenformen',
        belowAndYouCan: ' unten — und Sie können ',
        buildYourOwnLogic: 'Ihre eigene Logik bauen',
        byPlacingGates: ' indem Sie Gatter platzieren (unter "Verilog"), ',
        noHdlTyped: 'ohne HDL zu tippen.',
        preferNoTyping: 'Lieber nicht tippen? Öffnen Sie ',
        buildItVisuallyQuote: '"visuell bauen"',
        underVerilog: ' unter Verilog und platzieren Sie Gatter — es läuft live und generiert das HDL für Sie.',
        done: 'Fertig',
        hideThis: 'Dies ausblenden',
        fpgaTitle: 'FPGA — Tang Nano 20K',
        fpgaDesc1: 'Schreiben Sie Verilog, synthetisieren Sie es zu einem Bitstream im gehosteten Service oder zu einer ',
        fpgaDesc2: 'Netzliste hier im Browser, und prüfen Sie, ob Ihre Pin-Constraints das ',
        fpgaDesc3: 'Board erreichen. Copyleft-Quellen werden auf dem geteilten Server abgelehnt und müssen ',
        fpgaDesc4: 'lokal gebaut werden — die Lizenzprüfung unten entscheidet.',
        verilogTitle: 'Verilog',
        parseToCanvas: '⤵ Auf Leinwand zeigen',
        newHere: 'Neu hier? Laden Sie ein Starter-Design, dann Synthetisieren:',
        orBuildItVisually: 'Oder visuell bauen — Gatter platzieren und verdrahten, ohne Verilog zu tippen',
        loadingGateBuilder: 'Lade den Gatter-Builder…',
        orOnFullCanvas: 'Visuell bauen — Gatter auf die Leinwand ziehen und verdrahten (kein Verilog)',
        loadingCanvas: 'Lade die Leinwand…',
        wireDemoBoardBtn: '⬢ Demoboard verkabeln',
        buildTransistorsBtn: '⚛ Gatter aus Transistoren bauen',
        buildIcBtn: '⚙ Gatter aus einem 74xx-Chip bauen',
        buildCircuitBtn: '⚙ Diese Schaltung bauen',
        permissiveLicence: 'Erklärt eine freizügige Lizenz — es kann auf dem geteilten Server gebaut werden.',
        whereBuiltTitle: 'Wo es gebaut werden würde',
        backendLabel: 'Backend: ',
        autoOption: 'Auto',
        buildsOn: 'Baut auf ',
        synthesiseBtn: 'Synthetisieren',
        downloadFs: '.fs herunterladen',
        flashToBoard: 'Auf Board flashen',
        flashingRuns: 'Flashen führt openFPGALoader in der nativen App aus.',
        browserCannotFlash1: 'Ein Browser kann noch nicht flashen. Mit dem Board am USB, nutzen Sie die CLI ',
        browserCannotFlash2: ' oder ',
        browserCannotFlash3: '.',
        browserHasWebUsb: 'Ihr Browser hat WebUSB; direktes Flashen im Browser ist geplant, aber noch nicht eingebaut.',
        downloadNetlist: 'Netzliste herunterladen',
        doneFeedback: '✓ Fertig.',
        synthesiseHereTitle: 'In diesem Browser synthetisieren (TN6a)',
        yosysRunsHere1: 'Yosys läuft hier und produziert eine Netzliste, die Sie herunterladen oder im Pin-Panel ',
        yosysRunsHere2: 'unten überprüfen können. Es produziert keinen Bitstream — das erfordert Place and Route, ',
        yosysRunsHere3: 'weitere 183 MB, was noch nicht angeboten wird.',
        starting: 'starte',
        downloading: 'Lade herunter…',
        downloadToolchain: 'Toolchain herunterladen (77 MB, einmalig)',
        synthesiseHereBtn: 'Hier synthetisieren',
        checkPinsTitle: 'Prüfen, welche Pins das Board erreichen (',
        placed: ' platziert',
        cannot: ' können nicht',
        checkPinsDesc1: 'Welche Pins eines Designs tatsächlich das Breadboard erreichen können. Dies liest ',
        checkPinsDesc2: 'Gowin-Constraints gegen das echte Board-Teil, und die gleichen Constraints ',
        checkPinsDesc3: 'werden bei einem gehosteten Build gesendet.',
        optionalPasteNetlist: 'Optional: Fügen Sie eine Yosys JSON-Netzliste ein, um auch zu prüfen, ob die Ports existieren',
        importYosysToCanvas: '⤵ Netzliste auf Leinwand importieren',
        topModule: ' — Top-Modul: ',
        schematicTitle: 'Schaltplan — Ihr Design als Gatter',
        schematicDesc1: 'Dies ist das obige Verilog, synthetisiert zu Logikgattern. Eingänge sitzen auf ',
        schematicDesc2: 'der linken Seite, Ausgänge auf der rechten; ein Kabel leuchtet mit dem Wert, den es trägt, ',
        schematicDesc3: 'während Sie die Uhr takten.',
        loadingSchematic: 'Lade die Schaltplan-Ansicht…',
        waveformsTitle: 'Wellenformen — die Ausgänge über die Zeit',
        waveformsDesc1: 'Das Design, ausgeführt vom Reset für einige Taktzyklen: jedes Ausgangs-Bit als ',
        waveformsDesc2: 'Rechteckwelle. Ein Zähler liest von unten nach oben — das niedrigste Bit wechselt jeden ',
        waveformsDesc3: 'Zyklus, das höchste am langsamsten.',
        loadingWaveform: 'Lade die Wellenform-Ansicht…',
        reachesBoard: 'Erreicht das Board (',
        pinArrow: ' → Pin ',
        terminalArrow: ' → Terminal ',
        sharesHardware: ' (teilt Onboard-Hardware)',
        nothingPlacedYet: 'Noch nichts platziert.',
        usableWithCaveat: 'Nutzbar, mit einem Vorbehalt (',
        cannotReachBoard: 'Kann das Board nicht erreichen (',
        clockTitle: 'Uhr',
        clockDesc1: 'Dieses Design wird getaktet auf ',
        clockDesc2: '. Takten Sie es, um das Design einen Zyklus nach dem anderen voranzutreiben und sehen Sie zu, wie die Ausgänge — und das Board — folgen.',
        stepClockBtn: 'Uhr takten ▸',
        resetBtn: 'Zurücksetzen',
        stopAutoRun: '⏸ Auto-Run stoppen',
        autoRun: '▶ Auto-Run',
        cycle: ' Zyklus',
        cycles: ' Zyklen',
        showLeds: '⎈ Zeige die LEDs in der Controller-Ansicht',
        showSeg7: '⧉ Als 7-Segment-Zahl zeigen',
        mirrorsPins: 'spiegelt Pins ',
        asIndicators: ' als Indikatoren und startet die Uhr',
        designInputsTitle: 'Design-Eingänge',
        nothingDrivesThese: 'Nichts treibt diese bisher an, also stellen Sie sie hier ein und sehen Sie zu, wie die Ausgänge folgen.',
        whatCircuitEngine: 'Was der Schaltungs-Engine mitgeteilt werden würde',
        high: ' HIGH',
        low: ' LOW',
        highZ: ' (High-Z: das Design liest es)',
        undriven: ' — ungetrieben: nichts modelliert bisher das Design, also gibt es keinen Wert, den man darauf legen könnte.',
        nothingToDrive: 'Nichts anzutreiben.',
        constraintsTitle: 'Constraints für die Gowin-Toolchain',
        constraintsDesc1: 'Kanonisches .cst, das nur die Ports abdeckt, die einen Header-Pin erreichen. ',
        constraintsDesc2: 'Das ist es, was für echtes Silizium abgeht.',
        plannedNext: 'Als nächstes geplant: Flashen eines produzierten Bitstreams aus der nativen App.',
        help: 'Hilfe',
        buildingOn: 'Synthese läuft auf ',
        mayTakeAMinute: ' … das kann bis zu einer Minute dauern.',
        workingInBrowser: 'Synthese in diesem Browser …',
        needsAttention: 'Braucht Aufmerksamkeit',
        synthFailedNext: 'Nächster Schritt: Design unter Entwerfen korrigieren (oder unter Erstellen das Ziel wechseln) und erneut synthetisieren.',
        headsUp: 'Achtung',
        notes: 'Hinweise',
        glossaryTitle: 'Begriffe',
        glossary: [
            ['Synthese', 'verwandelt Ihr Design in die Gatter und Leitungen, die ein FPGA aufnehmen kann.'],
            ['Netzliste', 'das synthetisierte Design als Liste von Gattern und Leitungen. Sie kann simuliert und heruntergeladen werden.'],
            ['Bitstream (.fs)', 'die Datei, die das echte Board konfiguriert. Nur der gehostete Dienst erzeugt eine.'],
            ['Pin-Zuordnungen (.cst)', 'welchen FPGA-Pin jeder Port Ihres Designs nutzt.']
        ],
        pinsHint: 'Welchen FPGA-Pin jeder Port des Designs nutzt. Die Voreinstellungen passen zu den Beispielen.',
        bitstreamReady: 'Bitstream fertig',
        netlistReady: 'Netzliste fertig',
        modules: 'Module',
        howToFlash: 'So flashen',
        flashing: 'Flashe…',
        flashFailed: 'Flashen fehlgeschlagen: ',
        nextSimulate: 'Weiter: Simulieren ▸',
        nextBuild: 'Weiter: Erstellen ▸',
        goBuild: 'Zu Erstellen',
        designHint: 'Beispiel wählen oder Gatter zeichnen, oder Verilog schreiben.',
        buildHint: 'Das Design in etwas Lauffähiges verwandeln: einen Bitstream für das Board oder eine Netzliste zum Simulieren.',
        simulateHint: 'Uhr takten, Eingänge schalten und die Ausgänge beobachten.',
        synthesising: 'Synthetisiere…',
        needDesignFirst: 'Laden Sie zuerst unter Entwerfen ein Beispiel oder schreiben Sie ein Design.',
        boardOptional: 'Optional: auf einem Breadboard ausprobieren.'
    }
};
const pickLocale = loc => (loc && L10N[String(loc).slice(0, 2)] ? String(loc).slice(0, 2) : 'en');


/**
 * The FPGA / HDL surface — TN2 and TN2b of docs/TANG-NANO.md.
 *
 * SHIPPED HIDDEN. Reached only when a build sets BW_ENABLE_FPGA=1; gui.jsx gates
 * both the <Tab> and this <TabPanel> on a webpack-substituted literal, so an off
 * build does not carry this file, the bridge, or the board JSON. Turning it on
 * by default is a separate, later decision that MAY NEVER BE TAKEN.
 *
 * WHY ITS OWN SURFACE. The Code tab's premise is blocks <-> pseudocode <->
 * Python/JS as representations of ONE program. Verilog is not a representation
 * of a Scratch script, and putting it there would imply a conversion that will
 * never exist.
 *
 * WHAT THIS DOES: answers "can these ports reach the board, and where" by
 * reading Gowin constraints against the real Tang Nano 20K part. That question
 * is answerable today, needs no toolchain, and is the piece that makes an FPGA
 * design meet the breadboard at all.
 *
 * WHAT IT DOES NOT DO, and must not imply: synthesis (TN3), gate-level
 * simulation (digitaljs), flashing (TN4), or any SoC (TN5a/TN5b).
 *
 * The plan, the phases and the decisions behind them: docs/TANG-NANO.md.
 */

const EXAMPLE = `// Gowin constraints. Pin numbers are the ones silkscreened
// on the board and used by a real .cst.
IO_LOC  "led" 73;
IO_PORT "led" IO_TYPE=LVCMOS33 DRIVE=8;

IO_LOC  "btn" 74;

// Pin 15 is also onboard LED0 — usable, but it moves the board's own LED too.
IO_LOC  "shared" 15;

// Pin 33 is an HDMI pair. Real silicon, not on a header.
IO_LOC  "video" 33;
`;

// The simulator is LAZY, and the flag alone was not enough.
//
// Everything else in this surface is pure ESM the flag-off build drops entirely
// — verified by grepping the shipped artifact. digitaljs is different: the alias
// points at its CommonJS build (the package exports no subpath, so there is no
// ESM one to point at), and webpack cannot tree-shake CommonJS. A static import
// therefore put ~25 KiB gz of it into the EAGER bundle even with the flag off,
// and the first-load guard caught it: 1325 KiB against a 1300 KiB budget.
//
// So it is a dynamic import, which is also how the debugger panel and the render
// fonts stay out of the boot chunk. One chunk, fetched only when a netlist is
// actually pasted.
let simModulePromise = null;
const loadSimulator = () => {
    if (!simModulePromise) {
        simModulePromise = Promise.all([
            import(/* webpackChunkName: "bw-fpga-sim" */ '../../lib/bw-fpga/sim.js'),
            import(/* webpackChunkName: "bw-fpga-sim" */ 'digitaljs')
        ]).then(([sim, engine]) => ({...sim, engine}));
    }
    return simModulePromise;
};

// The schematic view (Rung 1 of the FPGA visual analog): the synthesised design
// drawn as gates. Its own chunk, because it pulls elkjs (layout) and the netlist
// converter — loaded only when a design has been synthesised and the view shows.
const FpgaSchematic = React.lazy(() =>
    import(/* webpackChunkName: "bw-fpga-schematic" */ './fpga-schematic.jsx'));
// Rung 2 of the visual analog: the design's outputs as waveforms over time.
const FpgaWaveform = React.lazy(() =>
    import(/* webpackChunkName: "bw-fpga-waveform" */ './fpga-waveform.jsx'));
// The React Flow canvas (MIT): drag/zoom node editor, its own chunk. The old
// hand-rolled SVG builder (fpga-gate-builder.jsx) was retired from the tab — this
// canvas superseded it; two stacked builders were redundant and confusing.
const FpgaGateBuilderRf = React.lazy(() =>
    import(/* webpackChunkName: "bw-fpga-rf" */ './fpga-gate-builder-rf.jsx'));

// A copyleft source needs the local tier, and asking the selector for that
// capability is how the refusal comes back NAMED rather than as a mystery.
const needsLocalTier = hdl => hdl.trim()
    ? screenForHostedSynthesis([{name: 'design.v', source: hdl}]).refusals.length > 0
    : false;

const Row = ({tone, children}) => (
    <li style={{
        margin: '0.25rem 0', padding: '0.4rem 0.6rem', borderRadius: 4,
        borderLeft: `3px solid ${tone}`, background: 'rgba(127,127,127,0.08)'
    }}>{children}</li>
);

// Share Robot Lab's anchored popup and compact controls, including Escape and
// outside-press dismissal. Only explanatory prose belongs here; refusals and
// warnings stay in the workspace's always-visible status area.
const FpgaInfo = ({id, label, children}) => {
    const [open, setOpen] = React.useState(false);
    return <Popup id={`fpga-${id}`} label={label} open={open}
        onToggle={() => setOpen(value => !value)} onClose={() => setOpen(false)}
        closeOnPick={false} width={420} testId={`bw-fpga-info-${id}`}
        button={<button type="button" data-testid={`bw-fpga-info-${id}-button`}
            style={toolStyles(false).button}><span aria-hidden="true">ⓘ</span> {label}</button>}>
        <div style={{padding: '0.4rem 0.6rem', lineHeight: 1.5}}>{children}</div>
    </Popup>;
};

const FPGA_AUTOSAVE_KEY = 'bw-fpga-autosave';

const workspaceModes = [['design', 'build'], ['build', 'chip'], ['simulate', 'simulate']];

const FpgaTab = (props) => {
    const T = L10N[pickLocale(props.locale)];
    const tools = toolStyles(false);
    const toolbar = {display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
        padding: '0.4rem', border: '1px solid #cbd5e1', borderRadius: 8, background: '#f8fafc', marginBottom: '0.75rem'};
    const selector = {height: 32, maxWidth: '100%', border: '1px solid #94a3b8', borderRadius: 6,
        background: '#fff', padding: '0 0.4rem', color: '#1e293b', font: 'inherit', fontSize: 12};
    const field = {display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: 12};
    // These select presentation only. Keep the canvas, waveform and schematic
    // mounted when switching workspaces so their design/session state survives.
    const [workspace, setWorkspace] = React.useState('design');
    const [workspaceMenuOpen, setWorkspaceMenuOpen] = React.useState(false);
    const [editor, setEditor] = React.useState('canvas');
    const [exampleId, setExampleId] = React.useState(EXAMPLES[0].id);
    const [realization, setRealization] = React.useState('demo');
    const [buildTarget, setBuildTarget] = React.useState('service');
    const [simulationView, setSimulationView] = React.useState('schematic');
    const [controllerDisplay, setControllerDisplay] = React.useState('leds');
    const selectedExample = EXAMPLES.find(example => example.id === exampleId) || EXAMPLES[0];

    // Autosave: the Verilog and constraints survive a reload (as Code and Circuit do).
    const saved = React.useMemo(() => {
        try { return JSON.parse(localStorage.getItem(FPGA_AUTOSAVE_KEY) || 'null'); } catch (e) { return null; }
    }, []);
    const [text, setText] = React.useState(saved && typeof saved.text === 'string' ? saved.text : EXAMPLE);
    const [netlistText, setNetlistText] = React.useState('');
    const [inputs, setInputs] = React.useState({});
    // How many clock edges the sequential design has been stepped by. A clocked
    // design is combinational-until-clocked: at 0 the flops hold reset, and each
    // "Step" advances one whole cycle so the board can be read between clicks.
    const [clockCycles, setClockCycles] = React.useState(0);
    // A free-running clock: tick on an interval so the design advances on its
    // own. The Controller/Widgets view is a right-pane dock on OTHER tabs, so a
    // user cannot step the clock here and watch the mirrored LEDs there at the
    // same time — a self-running clock decouples the two. This tab is
    // force-rendered (gui.jsx keeps every TabPanel mounted), so the interval
    // keeps advancing while the user watches the Controller view.
    const [autoRun, setAutoRun] = React.useState(false);
    // Whether the design's outputs have been mirrored into the Controller/Widgets
    // view yet — the last step of the first-run guide.
    const [mirrored, setMirrored] = React.useState(false);
    // One-click demo board: wiring a Tang Nano + 4 LEDs so a synthesised counter
    // has something to light. Feedback only — the wiring happens on the live board.
    const [demoMsg, setDemoMsg] = React.useState(null);
    const [cmosGate, setCmosGate] = React.useState('nand'); // which gate to realise as transistors
    const [icGate, setIcGate] = React.useState('and'); // which gate to realise as a 74HC chip
    const [icCircuit, setIcCircuit] = React.useState('half_adder'); // which multi-chip circuit to build
    // The first-run guide tracks the three steps through the tab's real state and
    // stays until the user hides it (or opts out for good in this browser).
    const [guideDismissed, setGuideDismissed] = React.useState(() => {
        try { return localStorage.getItem('bw-fpga-guide-done') === '1'; } catch { return false; }
    });
    const [sim, setSim] = React.useState({values: {}, note: null, problems: []});
    const [hdl, setHdl] = React.useState(saved && typeof saved.hdl === 'string' ? saved.hdl : '');
    React.useEffect(() => {
        const timer = setTimeout(() => {
            try {
                localStorage.setItem(FPGA_AUTOSAVE_KEY, JSON.stringify({hdl, text}));
            } catch (e) { /* storage full or private mode: the editor keeps working */ }
        }, 800);
        return () => clearTimeout(timer);
    }, [hdl, text]);
    // Project save carries this design (lib/bw-project-bundle.js `fpga`): flush it
    // now, not 800 ms later; a loaded project replaces it in place.
    const designRef = React.useRef({hdl, text});
    designRef.current = {hdl, text};
    React.useEffect(() => {
        const collect = () => {
            try {
                localStorage.setItem(FPGA_AUTOSAVE_KEY, JSON.stringify(designRef.current));
            } catch (e) { /* the save carries the last autosave instead */ }
        };
        const loaded = () => {
            let next = null;
            try { next = JSON.parse(localStorage.getItem(FPGA_AUTOSAVE_KEY) || 'null'); } catch (e) { next = null; }
            setHdl(next && typeof next.hdl === 'string' ? next.hdl : '');
            setText(next && typeof next.text === 'string' ? next.text : EXAMPLE);
        };
        window.addEventListener('bw-project-bundle-collect', collect);
        window.addEventListener('bw-project-bundle-loaded', loaded);
        return () => {
            window.removeEventListener('bw-project-bundle-collect', collect);
            window.removeEventListener('bw-project-bundle-loaded', loaded);
        };
    }, []);
    const [seed, setSeed] = React.useState(null);
    const [synth, setSynth] = React.useState(null);
    const [backend, setBackend] = React.useState('auto');
    const [probe, setProbe] = React.useState({available: [], probes: []});
    // TN4. Flashing needs the native app; a browser can only download the .fs.
    // Probed fail-closed, so a Flash button appears only where it actually works.
    const [flash, setFlash] = React.useState({available: false});
    const [flashMsg, setFlashMsg] = React.useState(null);
    // TN6a. `localAvailable: false` was hard-coded below, which made the local
    // backend permanently unofferable however capable the browser was. The
    // worker answers it now — and answers `not-downloaded` until someone
    // consents to 78 MB, which is an honest state and not a failure.
    const [local, setLocal] = React.useState(null);
    const [localBusy, setLocalBusy] = React.useState(false);
    // The hosted build is a network round trip of seconds to a minute; without
    // this the button looked dead and a failure was silent.
    const [building, setBuilding] = React.useState(false);

    // THE CODE TAB HANDS A CIRCUIT OVER HERE. A pseudocode line that is a
    // boolean over 1-bit inputs can be lowered to a gate model
    // (lib/bw-fpga/pseudocode-expr.js); the Code tab lowers it, dispatches the
    // model, and switches to this tab. Seeding through an EVENT rather than a
    // prop keeps the two tabs from having to share state through gui.jsx for a
    // one-shot handoff — the same shape `bw-activate-tab` already uses.
    React.useEffect(() => {
        const onSeed = e => {
            const model = e && e.detail && e.detail.model;
            if (model && Array.isArray(model.nodes)) setSeed(model);
        };
        window.addEventListener('bw-fpga-seed-model', onSeed);
        return () => window.removeEventListener('bw-fpga-seed-model', onSeed);
    }, []);

    // Probe once. Nothing is offered that was not actually found, and an absent
    // backend is shown WITH ITS REASON rather than omitted — "no synthesis
    // service is configured" is more useful to a reader than an empty list.
    const catalog = React.useMemo(() => defaultCatalog({
        hostedEndpoint: process.env.BW_SYNTHESIS_ENDPOINT || null,
        locale: props.locale
    }), [props.locale]);
    // One client for the life of the tab: it owns the worker, and the worker
    // owns whether 78 MB is already here. A new one per render would forget.
    const localClient = React.useMemo(() => createLocalClient({
        spawn: () => new Worker(new URL('../../lib/bw-fpga/yosys-worker.js', import.meta.url),
            {type: 'module'}),
        onState: m => setLocal(m.state)
    }), []);
    React.useEffect(() => {
        let live = true;
        localClient.init().then(r => live && setLocal(r.state));
        return () => { live = false; localClient.terminate(); };
    }, [localClient]);

    React.useEffect(() => {
        let live = true;
        probeBackends({catalog, localAvailable: Boolean(local && local.available)})
            .then(r => live && setProbe(r));
        return () => { live = false; };
    }, [catalog, local]);

    React.useEffect(() => {
        let live = true;
        probeFlash().then(r => live && setFlash(r));
        return () => { live = false; };
    }, []);

    // The licence screen is worth running as you type: it is the one part of
    // TN3 that works without a service, and it answers a question the user
    // cannot answer by looking.
    const selection = React.useMemo(() => selectBackend({
        backend,
        requiredCapabilities: needsLocalTier(hdl) ? ['copyleft-sources'] : [],
        available: probe.available,
        catalog
    }), [backend, hdl, probe, catalog]);

    const hdlScreen = React.useMemo(
        () => screenForHostedSynthesis(hdl.trim() ? [{name: 'design.v', source: hdl}] : []),
        [hdl]);

    // A successful synthesis was, until now, invisible: `synth` was rendered only
    // when NOT ok, so a working build stranded its bitstream (hosted) or netlist
    // (local) in state with no way to reach it. Browsers CAN save a Blob (unlike
    // the artifact sandbox), so a successful result becomes a download here. The
    // object URLs are revoked when the result changes, so they do not leak.
    const artefacts = React.useMemo(() => {
        if (!synth || !synth.ok) return null;
        const out = {};
        if (synth.bitstream) {
            const bin = atob(synth.bitstream);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            out.bitstream = {url: URL.createObjectURL(new Blob([bytes],
                {type: 'application/octet-stream'})), bytes: bytes.length};
        }
        if (synth.netlist) {
            out.netlist = {url: URL.createObjectURL(new Blob(
                [JSON.stringify(synth.netlist)], {type: 'application/json'})),
            modules: Object.keys(synth.netlist.modules || {}).length};
        }
        return out;
    }, [synth]);
    React.useEffect(() => () => {
        if (artefacts && artefacts.bitstream) URL.revokeObjectURL(artefacts.bitstream.url);
        if (artefacts && artefacts.netlist) URL.revokeObjectURL(artefacts.netlist.url);
    }, [artefacts]);

    // Load and run the simulator when there is something to simulate. Nothing is
    // fetched until a netlist is actually pasted.
    React.useEffect(() => {
        let live = true;
        const trimmed = netlistText.trim();
        if (!trimmed) {
            setSim({values: {}, note: null, problems: []});
            return () => { live = false; };
        }
        let parsed;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            return () => { live = false; };   // the memo already reports bad JSON
        }
        loadSimulator().then(({GateLevelSim, fromYosys, engine}) => {
            if (!live) return;
            const {circuit, problems} = fromYosys(parsed);
            if (!circuit) return setSim({values: {}, note: null, problems});
            try {
                const s = new GateLevelSim(circuit, engine);
                const {ports} = readPorts(parsed);
                const clockPort = detectClockPort(ports);
                for (const [name, p] of Object.entries(ports)) {
                    if (p.direction !== 'input') continue;
                    // The clock is driven by tickClock below, not held at a level here.
                    if (name === clockPort) continue;
                    s.setInput(name, inputs[name] ? 1 : 0, p.width || 1);
                }
                // Settle the reset state first; then, if the design has a clock and
                // the user has stepped it, advance that many whole cycles. Both are
                // bounded, so a combinational loop reports rather than hangs.
                const settled = (clockPort && clockCycles > 0)
                    ? s.tickClock(clockPort, clockCycles)
                    : s.settle();
                if (!settled.settled) {
                    return setSim({values: {}, note: null,
                        problems: [{code: 'did-not-settle', reason: settled.reason}]});
                }
                const read = s.outputValues(ports);
                const note = clockPort
                    ? `${clockCycles} clock(s) — settled in ${settled.steps} step(s)`
                    : `settled in ${settled.steps} step(s)`;
                setSim({values: read.values, note, problems: read.problems});
            } catch (e) {
                setSim({values: {}, note: null, problems: [{code: 'simulation-failed',
                    reason: `The design could not be simulated: ${e.message}`}]});
            }
        }).catch(e => live && setSim({values: {}, note: null,
            problems: [{code: 'simulator-unavailable',
                reason: `The gate-level simulator could not be loaded: ${e.message}`}]}));
        return () => { live = false; };
    }, [netlistText, inputs, clockCycles]);
    // A new netlist is a new design: its flops start at reset, so the step count
    // from the previous design must not fast-forward it. Resetting here keeps the
    // clock control honest when an example is loaded or the design is re-synthesised.
    React.useEffect(() => { setClockCycles(0); }, [netlistText]);
    const {bindings, refusals, warnings, plan, top, canonical, clockPort, inputPorts, simNote} =
            React.useMemo(() => {
        const {constraints, problems} = parseCst(text);

        // The netlist is OPTIONAL. Without it the bridge can still say where a
        // port lands; with it, it can also say whether the port exists -- which
        // is how a rename that silently unplugs a signal gets caught.
        let netlistPorts = null;
        let parsedNetlist = null;
        let top = null;
        const netlistProblems = [];
        const trimmed = netlistText.trim();
        if (trimmed) {
            try {
                parsedNetlist = JSON.parse(trimmed);
                const read = readPorts(parsedNetlist);
                netlistPorts = Object.keys(read.ports).length ? read.ports : null;
                top = read.top;
                netlistProblems.push(...read.problems);
            } catch (e) {
                netlistProblems.push({code: 'netlist-not-json',
                    reason: `The netlist is not valid JSON: ${e.message}`});
            }
        }

        const out = bridge({constraints, part: TANG_NANO_20K, netlistPorts});
        if (netlistPorts) netlistProblems.push(...checkWidths(netlistPorts, out.bindings));
        problems.push(...netlistProblems);

        // The design's own values arrive asynchronously, from the lazy chunk.
        const values = sim.values;
        const simNote = sim.note;
        problems.push(...sim.problems);
        // Dry run: the same call the circuit engine would take, against a
        // recorder instead of a board. With no values -- because nothing models
        // the fabric yet -- every output comes back as "undriven", which is the
        // honest picture rather than a row of zeroes.
        const ops = [];
        const {unset} = applyPortValues({setPin: (...a) => ops.push(a)}, out.bindings, values);
        // Canonical .cst for the real Gowin toolchain. Only the placements that
        // actually reach the board: handing openFPGALoader a constraint naming a
        // pin this board does not bring out would be wrong in a new way rather
        // than incomplete.
        const reachable = constraintsFromBindings(out.bindings, constraints);
        const canonical = emitCst(reachable,
            {header: 'Generated by Brickwright from the constraints above.\nOnly ports that reach a header pin are included.'});
        return {...out, refusals: [...problems, ...out.refusals], plan: {ops, unset},
            top, canonical, clockPort: netlistPorts ? detectClockPort(netlistPorts) : null,
            inputPorts: netlistPorts
                ? Object.entries(netlistPorts)
                    .filter(([n, p]) => p.direction === 'input' && n !== detectClockPort(netlistPorts))
                    .map(([n]) => n)
                : [], simNote};
    }, [text, netlistText, sim]);

    // The header pins the design DRIVES (outputs), for mirroring into the
    // Controller/Widgets view. Inputs are excluded — a mirrored indicator shows
    // what the design puts out, not what the breadboard feeds in.
    const outputPins = React.useMemo(() => {
        const pins = (bindings || [])
            .filter(b => b.direction !== 'input' && typeof b.pin === 'number')
            .map(b => b.pin);
        return [...new Set(pins)].sort((a, b) => a - b);
    }, [bindings]);
    // The demo-board builder runs from async callbacks (it may wait for the
    // Circuit tab to mount), so it reads the latest output pins through a ref
    // rather than a stale closure — the board then matches whatever design is
    // loaded when the button is pressed. Only trust the pins once a netlist
    // exists: without one, port DIRECTIONS are unknown, so an input (a clock)
    // would be miscounted as an output and get an LED. No netlist → the
    // builder's own default (15–18) applies.
    const outputPinsRef = React.useRef([]);
    outputPinsRef.current = netlistText.trim() ? outputPins : [];
    // The header pins the design READS (inputs), excluding the clock (the FPGA
    // ticks its own clock, not a breadboard switch). The demo board puts a switch
    // on each so the loop runs both ways.
    const inputPins = React.useMemo(() => {
        const pins = (bindings || [])
            .filter(b => b.direction === 'input' && b.base !== clockPort && b.port !== clockPort && typeof b.pin === 'number')
            .map(b => b.pin);
        return [...new Set(pins)].sort((a, b) => a - b);
    }, [bindings, clockPort]);
    const inputPinsRef = React.useRef([]);
    inputPinsRef.current = netlistText.trim() ? inputPins : [];
    // Once a board with input switches is wired, poll them into the design (below).
    const [boardDriven, setBoardDriven] = React.useState(false);
    // What the schematic lights: the values we actually know — the design's
    // inputs (set below) and its outputs (from the sim). Internal nets stay
    // neutral until Rung 1's follow-up reads them from the live circuit.
    const netValues = React.useMemo(() => {
        const nv = {};
        for (const [k, v] of Object.entries(inputs || {})) nv[k] = v;
        for (const [k, v] of Object.entries(sim.values || {})) nv[k] = v;
        return nv;
    }, [inputs, sim.values]);

    // Drive the on-screen board with the design's outputs, through the live
    // Circuit model.
    //
    // The handle is `window.__circuit`: circuit-tab.jsx's onCircuitReady publishes
    // the live Circuit there (and mirrors it to vm.runtime.circuitModel), and it
    // PERSISTS — the model outlives the designer. That is the whole point here.
    // window.__bwCircuit (CircuitDesigner's mount effect) is a fallback only: it is
    // DELETED when the designer unmounts, which it does whenever a non-Circuit tab
    // — this one — is active under the default debugger dock. So driving through it
    // meant the handle was gone exactly when the FPGA tab needed it: a real-browser
    // drive found the seam dead though every source gate passed (the §7.4 lesson,
    // again). window.__circuit survives the tab switch, so the design actually
    // lights the placed board.
    //
    // Guarded: with no circuit ever loaded, or no bound ports, this no-ops.
    React.useEffect(() => {
        const c = (typeof window !== 'undefined') && (window.__circuit || window.__bwCircuit);
        if (!c || typeof c.setPin !== 'function' || !bindings.length) return undefined;
        try {
            const {applied} = applyPortValues(c, bindings, sim.values);
            // Broadcast the driven output pins so the Controller/Widgets view can
            // mirror them (gui.jsx owns the panel; it only needs pin -> level).
            const leds = applied
                .filter(a => a.mode === 'pushpull')
                .map(a => ({pin: a.pin, high: Boolean(a.driveHigh)}));
            if (leds.length && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bw-fpga-output', {detail: {leds}}));
            }
        } catch (e) { /* the board may not have the Tang Nano placed or pins wired */ }
        return undefined;
    }, [sim.values, bindings]);

    // The READ half of the loop: once a demo board with input switches is wired,
    // poll the board's input pins and feed them into the design's inputs, so a
    // press on the breadboard drives the FPGA logic (which then drives the LEDs
    // through the effect above). Gated on boardDriven so it never clobbers the
    // manual input controls before a bidirectional board exists.
    React.useEffect(() => {
        if (!boardDriven || !bindings.length || typeof window === 'undefined') return undefined;
        const getBoard = () => {
            const c = window.__circuit || window.__bwCircuit;
            if (c && c.board && typeof c.board.readPin === 'function') return c.board;
            if (window.__board && typeof window.__board.readPin === 'function') return window.__board;
            return null;
        };
        const poll = () => {
            const board = getBoard();
            if (!board) return;
            const boardInputs = readBoardInputs(bindings, board);
            if (!Object.keys(boardInputs).length) return;
            setInputs(prev => {
                let changed = false;
                const next = {...prev};
                for (const [k, v] of Object.entries(boardInputs)) if (next[k] !== v) { next[k] = v; changed = true; }
                return changed ? next : prev;
            });
        };
        const id = setInterval(poll, 400);
        return () => clearInterval(id);
    }, [boardDriven, bindings]);

    // The free-running clock (see autoRun). Ticking clockCycles re-runs the sim
    // effect, which drives the board and broadcasts the outputs above.
    React.useEffect(() => {
        if (!autoRun) return undefined;
        const id = setInterval(() => setClockCycles(c => c + 1), 600);
        return () => clearInterval(id);
    }, [autoRun]);

    // Wire the demo board — out of the box, from this tab, with no detour.
    //
    // The board only exists once the Circuit tab's designer has mounted and
    // published `window.__circuit` (see the drive effect above). A user who lands
    // straight on this tab has never opened Circuit, so that handle is absent and a
    // naive click had nothing to build on. Rather than reach across tabs to force a
    // hidden designer to mount (fragile: the designer's render() omits itself under
    // the default debugger dock when this tab is the visible one), we ASK the app to
    // make the Circuit tab visible — the one reliable path that mounts the designer,
    // runs onCircuitReady, and shows the wired board. gui.jsx owns the tab list and
    // listens for `bw-activate-tab`; we only know the index. Then we wait for the
    // handle to appear and build. The board persists, so the user can switch right
    // back here and drive it.
    const CIRCUIT_TAB_INDEX = 4;
    const liveCircuit = () => (typeof window !== 'undefined'
        ? (window.__circuit && typeof window.__circuit.addPart === 'function' ? window.__circuit : null)
        : null);
    const buildOnCircuit = React.useCallback(c => {
        try {
            // Wire LEDs on the pins the LOADED design drives, so the board matches
            // whatever example is open — not always 15–18. With no design yet, the
            // builder's own default (pins 15–18) applies, which is where the
            // “Counting sequence” and chaser examples put their LEDs.
            const pins = outputPinsRef.current;
            const inPins = inputPinsRef.current;
            const result = buildDemoBoard(c, {
                ...(pins.length ? {pins} : {}),
                ...(inPins.length ? {inputPins: inPins} : {})
            });
            // With input switches on the board, poll them into the design so a
            // press drives the FPGA logic (the loop, both ways).
            if (inPins.length) setBoardDriven(true);
            // Make the designer RENDER what we built. Mutating the live circuit
            // model alone does NOT re-render it — the designer reacts only to its
            // own edits or a fresh circuitData prop — so hand it the built
            // circuit's JSON and load it the way a saved circuit loads.
            if (typeof c.toJSON === 'function' && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bw-load-circuit-data', {detail: {data: c.toJSON()}}));
            }
            const loc = props.locale;
            const litPins = result.leds.map(l => l.pin);
            const nSw = (result.switches || []).length;
            setDemoMsg({ok: true, text: tr(loc, 'demo.wired', {
                leds: tn(loc, 'count.leds', litPins.length),
                pins: tn(loc, 'count.pins', litPins.length, {list: litPins.join(', ')})
            }) + (nSw ? tr(loc, 'demo.switches', {
                switches: tn(loc, 'count.switches', nSw),
                pins: tn(loc, 'count.pins', nSw, {list: inPins.join(', ')})
            }) : '') + tr(loc, pins.length ? 'demo.nextDesign' : 'demo.nextLoad')});
        } catch (e) {
            setDemoMsg({ok: false, text: tr(props.locale, 'demo.failed', {message: e.message})});
        }
    }, [props.locale]);
    // Realise a single gate as its CMOS transistor circuit — the same "show it in
    // Circuits" path, but building nmos/pmos instead of a driven-LED demo board.
    const buildGateOnCircuit = React.useCallback((c, gateType) => {
        try {
            const r = buildCmosGate(c, gateType);
            if (typeof c.toJSON === 'function' && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bw-load-circuit-data', {detail: {data: c.toJSON()}}));
            }
            setDemoMsg({ok: true, text: tr(props.locale, 'gate.cmos', {
                gate: gateType.toUpperCase(),
                transistors: tn(props.locale, 'count.transistors', r.transistors.length)
            })});
        } catch (e) {
            setDemoMsg({ok: false, text: tr(props.locale, 'gate.failed', {message: e.message})});
        }
    }, [props.locale]);
    // Shared "reach the live circuit (showing the Circuit tab if needed), then run
    // fn(circuit)" — used by both the demo board and the transistor realisation.
    const onLiveCircuit = React.useCallback(fn => {
        const now = liveCircuit();
        if (now) { fn(now); return; }
        if (typeof window === 'undefined') return;
        setDemoMsg({pending: true, text: tr(props.locale, 'circuit.pending')});
        window.dispatchEvent(new CustomEvent('bw-activate-tab', {detail: {index: CIRCUIT_TAB_INDEX}}));
        const deadline = Date.now() + 8000;
        const tick = () => {
            const c = liveCircuit();
            if (c) { fn(c); return; }
            if (Date.now() > deadline) {
                setDemoMsg({ok: false, text: tr(props.locale, 'circuit.open')});
                return;
            }
            setTimeout(tick, 150);
        };
        setTimeout(tick, 150);
    }, [props.locale]);
    const wireDemoBoard = React.useCallback(() => onLiveCircuit(buildOnCircuit), [onLiveCircuit, buildOnCircuit]);
    const realizeGate = React.useCallback(gateType => onLiveCircuit(c => buildGateOnCircuit(c, gateType)),
        [onLiveCircuit, buildGateOnCircuit]);
    // The middle rung: realise the gate as a real 74HC logic chip — the part you
    // solder, between the abstract gate and its transistors.
    const buildIcGateOnCircuit = React.useCallback((c, gateType) => {
        try {
            buildLogicIcGate(c, gateType);
            if (typeof c.toJSON === 'function' && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bw-load-circuit-data', {detail: {data: c.toJSON()}}));
            }
            const spec = gateToLogicIc(gateType);
            setDemoMsg({ok: true, text: tr(props.locale, 'gate.ic', {
                gate: gateType.toUpperCase(), label: spec.label, desc: spec.desc
            })});
        } catch (e) {
            setDemoMsg({ok: false, text: tr(props.locale, 'gate.failed', {message: e.message})});
        }
    }, [props.locale]);
    const realizeIcGate = React.useCallback(gateType => onLiveCircuit(c => buildIcGateOnCircuit(c, gateType)),
        [onLiveCircuit, buildIcGateOnCircuit]);
    // A MULTI-gate circuit: several chips sharing the input switches, an LED per
    // named output. The half adder is the first one — the step from "a gate
    // works" to "these gates together compute something".
    const buildIcCircuitOnCircuit = React.useCallback((c, key) => {
        try {
            const built = buildLogicIcCircuit(c, IC_CIRCUITS[key]);
            if (typeof c.toJSON === 'function' && typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('bw-load-circuit-data', {detail: {data: c.toJSON()}}));
            }
            const spec = IC_CIRCUITS[key];
            const loc = props.locale;
            // Report the PACKAGES, which is what you buy — not one line per
            // gate. Twenty gates of a 4-bit adder are five parts.
            const byKind = {};
            for (const pk of built.packages) byKind[pk.label] = (byKind[pk.label] || 0) + 1;
            const bill = Object.entries(byKind).map(([label, n]) => `${n}× ${label}`).join(', ');
            // A list of names is commas then a conjunction — never "a and b and
            // c and d". The conjunction is a word, so it comes from the table.
            const names = built.outputs.map(o => o.name);
            const outs = names.length > 1
                ? `${names.slice(0, -1).join(', ')} ${tr(loc, 'list.and')} ${names[names.length - 1]}`
                : names[0];
            // A single-part circuit has no gates to count — "0 gates in 1 chip"
            // is not a sentence anybody wants to read.
            setDemoMsg({ok: true, text: tr(loc, built.chips.length ? 'build.circuit' : 'build.chip', {
                label: circuitLabel(spec, loc),
                gates: built.chips.length,
                chips: tn(loc, 'count.chips', built.packages.length),
                bill,
                switches: tn(loc, 'count.switches', built.inputs.length),
                outputs: outs,
                hint: circuitHint(spec, loc)
            })});
        } catch (e) {
            setDemoMsg({ok: false, text: tr(props.locale, 'build.circuitFailed', {message: e.message})});
        }
    }, [props.locale]);
    const realizeIcCircuit = React.useCallback(key => onLiveCircuit(c => buildIcCircuitOnCircuit(c, key)),
        [onLiveCircuit, buildIcCircuitOnCircuit]);

    const ui = viewStyles(tools);
    const view = deriveView({T, building, selection, localBusy, local, hdlScreen, refusals, warnings,
        synth, hdl, clockCycles});

    return (
        <div data-testid="bw-fpga-workspace" style={{position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, overflowY: 'auto',
            padding: '0.75rem', lineHeight: 1.5, boxSizing: 'border-box'}}>
            <div data-fpga-toolbar style={{...toolbar, position: 'sticky', top: 0, zIndex: 5,
                containerType: 'inline-size', flexWrap: 'nowrap'}}>
                <strong style={{fontSize: 14, marginRight: '0.25rem'}}>{T.fpgaTitle}</strong>
                <nav data-fpga-toolbar-navigation aria-label={T.workspace}>
                    {workspaceModes.map(([mode], index) => (
                        <button key={mode} type="button" data-testid={`bw-fpga-workspace-${mode}`}
                            aria-pressed={workspace === mode} aria-controls={`bw-fpga-panel-${mode}`}
                            onClick={() => setWorkspace(mode)} style={workspace === mode ? tools.pressed : ui.secondary}>
                            <span aria-hidden="true" style={ui.stepBadge(view.stepDone[mode])}>{view.stepDone[mode] ? '✓' : index + 1}</span>
                            {T[`${mode}Workspace`]}
                        </button>
                    ))}
                </nav>
                <span data-fpga-active-workspace>{T[`${workspace}Workspace`]}</span>
                <span style={{flex: '1 1 0', minWidth: 0}} />
                <div data-fpga-toolbar-overflow>
                    <Popup id="fpga-more" label={T.more} overflowMenu align="right" width={270}
                        open={workspaceMenuOpen}
                        onToggle={() => setWorkspaceMenuOpen(open => !open)}
                        onClose={() => setWorkspaceMenuOpen(false)}
                        button={<button type="button" data-testid="bw-fpga-more" aria-label={T.more}
                            title={T.more} style={tools.button}><Icon name="more" /></button>}>
                        {workspaceModes.map(([mode, icon]) => (
                            <button key={mode} type="button" data-overflow-action aria-pressed={workspace === mode}
                                aria-controls={`bw-fpga-panel-${mode}`} onClick={() => setWorkspace(mode)}>
                                <Icon name={icon} />
                                <span>{T[`${mode}Workspace`]}</span>
                            </button>
                        ))}
                    </Popup>
                </div>
                <FpgaInfo id="help" label={T.help}>
                    <strong>{T.labInfo}</strong>
                    <p style={{margin: '0.25rem 0 0.6rem'}}>
                        {T.fpgaDesc1}{T.fpgaDesc2}{T.fpgaDesc3}{T.fpgaDesc4}
                    </p>
                    <strong>{T.glossaryTitle}</strong>
                    <dl style={{margin: '0.25rem 0 0.6rem'}}>
                        {T.glossary.map(([term, meaning]) => (
                            <React.Fragment key={term}>
                                <dt style={{fontWeight: 600, marginTop: '0.2rem'}}>{term}</dt>
                                <dd style={{margin: 0}}>{meaning}</dd>
                            </React.Fragment>
                        ))}
                    </dl>
                    <strong>{T.gettingStarted}</strong>
                    {guideDismissed ? (
                        <div style={{marginTop: '0.25rem'}}>
                            <button type="button" style={ui.secondary} onClick={() => {
                                try { localStorage.removeItem('bw-fpga-guide-done'); } catch (e) { /* private mode */ }
                                setGuideDismissed(false);
                            }}>{T.showGuide}</button>
                        </div>
                    ) : (() => {
                        // Progress is READ from the tab's real state, so a step ticks when
                        // the user actually does it — not a scripted tour that lies.
                        const steps = [
                            {done: Boolean(demoMsg && demoMsg.ok), label: T.wireDemoBoard, hint: T.wireDemoBoardHint},
                            {done: Boolean((synth && synth.ok) || netlistText.trim()), label: T.loadDesign, hint: T.loadDesignHint},
                            {done: clockCycles > 0, label: T.stepClock, hint: T.stepClockHint},
                            {done: mirrored, label: T.seeInController, hint: T.seeInControllerHint}
                        ];
                        const allDone = steps.every(s => s.done);
                        const hide = () => {
                            try { localStorage.setItem('bw-fpga-guide-done', '1'); } catch (e) { /* private mode */ }
                            setGuideDismissed(true);
                        };
                        return (
                            <div>
                                <p style={{margin: '0.25rem 0 0'}}>{allDone ? T.allDone : T.newToFpga}</p>
                                <ol style={{margin: '0.4rem 0 0.25rem', paddingLeft: '1.4rem'}}>
                                    {steps.map((s, i) => (
                                        <li key={i} style={{opacity: s.done ? 0.55 : 1, margin: '0.15rem 0'}}>
                                            {s.done ? '✓ ' : ''}{s.label}
                                            <span style={{opacity: 0.7}}>{` — ${s.hint}`}</span>
                                        </li>
                                    ))}
                                </ol>
                                <p style={{margin: '0.35rem 0 0.15rem', fontSize: '0.85rem', opacity: 0.85}}>
                                    {netlistText.trim() ? (
                                        <>
                                            <strong>{T.threeWaysToSee}</strong>
                                            {T.designDrawnAs}<em>{T.gateSchematic}</em>
                                            {T.andAs}<em>{T.waveforms}</em>{T.belowAndYouCan}
                                            <em>{T.buildYourOwnLogic}</em>{T.byPlacingGates}
                                            {T.noHdlTyped}
                                        </>
                                    ) : (
                                        <>
                                            {T.preferNoTyping}<em>{T.buildItVisuallyQuote}</em>
                                            {T.underVerilog}
                                        </>
                                    )}
                                </p>
                                <button type="button" onClick={hide} style={{...ui.secondary, marginTop: '0.35rem'}}>
                                    {allDone ? T.done : T.hideThis}
                                </button>
                            </div>
                        );
                    })()}
                </FpgaInfo>
            </div>

            {/* One status area for every workspace: what is running, what went
                wrong and the next step, then the finished result. Blockers are
                always open; heads-ups are one click away so they cannot bury the
                controls (they used to stack above every workspace). */}
            <div aria-live="polite" data-testid="bw-fpga-status" style={{maxWidth: '64rem'}}>
                {view.busyText ? (
                    <div role="status" data-testid="bw-fpga-busy" style={{...ui.card, borderColor: '#6366f1', background: '#eef2ff'}}>
                        <div style={ui.row}><span aria-hidden="true">⏳</span><strong>{view.busyText}</strong></div>
                        <progress aria-label={view.busyText} style={{width: '100%', marginTop: '0.35rem'}} />
                    </div>
                ) : null}
                {demoMsg ? (
                    <p style={{...ui.card, margin: '0 0 0.6rem', borderColor: demoMsg.ok ? '#86efac' : (demoMsg.pending ? '#cbd5e1' : '#fca5a5'),
                        color: demoMsg.ok ? '#166534' : (demoMsg.pending ? '#475569' : '#991b1b')}}>{demoMsg.text}</p>
                ) : null}
                {view.hasBlockers ? (
                    <div role="alert" data-testid="bw-fpga-problems" style={{...ui.card, borderColor: '#fca5a5', background: '#fef2f2'}}>
                        <strong>{T.needsAttention}</strong>
                        <ul style={{listStyle: 'none', padding: 0, margin: '0.35rem 0 0'}}>
                            {hdlScreen.refusals.map((r, i) => (
                                <Row key={`sr${i}`} tone="#b34747">
                                    <strong>{r.spdx || 'copyleft'}</strong>{`: ${r.reason}`}
                                </Row>
                            ))}
                            {view.localFailed ? (
                                <Row tone="#b34747"><strong>{local.code || local.state}</strong>{`: ${local.reason}`}</Row>
                            ) : null}
                            {synth && !synth.ok ? (
                                <Row tone="#b34747">
                                    <strong>{synth.code}</strong>{`: ${synth.reason}`}
                                    <div style={ui.hint}>{T.synthFailedNext}</div>
                                </Row>
                            ) : null}
                        </ul>
                    </div>
                ) : null}
                {view.notesCount ? (
                    <details data-testid="bw-fpga-headsup" style={{...ui.card, borderColor: '#fcd34d', background: '#fffbeb', padding: '0.35rem 0.75rem'}}>
                        <summary style={{cursor: 'pointer', fontWeight: 600, fontSize: 13}}>{`${T.notes} (${view.notesCount})`}</summary>
                        {view.headsUp.length ? (
                            <>
                                <strong style={{fontSize: 13}}>{`${T.headsUp} (${view.headsUp.length})`}</strong>
                                <ul style={{listStyle: 'none', padding: 0, margin: '0.25rem 0 0.5rem'}}>
                                    {view.headsUp.map((w, i) => (
                                        <Row key={`${w.key}${i}`} tone="#b8860b">
                                            {w.who ? <strong>{w.who}</strong> : null}{w.who ? `: ${w.reason}` : w.reason}
                                        </Row>
                                    ))}
                                </ul>
                            </>
                        ) : null}
                        {refusals.length ? (
                            <>
                                <strong style={{fontSize: 13}}>{`${T.cannotReachBoard}${refusals.length})`}</strong>
                                <ul style={{listStyle: 'none', padding: 0, margin: '0.25rem 0 0.25rem'}}>
                                    {refusals.map((r, i) => (
                                        <Row key={i} tone="#7a7a7a">
                                            <strong>{r.port || `line ${r.lineNumber}`}</strong>{`: ${r.reason}`}
                                        </Row>
                                    ))}
                                </ul>
                            </>
                        ) : null}
                    </details>
                ) : null}
                {synth && synth.ok && artefacts ? (
                    <div data-testid="bw-fpga-result" style={{...ui.card, borderColor: '#86efac', background: '#f0fdf4'}}>
                        {artefacts.bitstream ? (
                            <>
                                <div style={ui.row}>
                                    <strong>{`✓ ${T.bitstreamReady} (${artefacts.bitstream.bytes.toLocaleString()} bytes)`}</strong>
                                    <a href={artefacts.bitstream.url} download="design.fs" style={{...ui.secondary, textDecoration: 'none'}}>{T.downloadFs}</a>
                                    {flash.available ? (
                                        <button type="button" style={tools.primary} onClick={() => {
                                            setFlashMsg(T.flashing);
                                            flashBitstream(synth.bitstream)
                                                .then(r => setFlashMsg(`✓ ${r}`))
                                                .catch(e => setFlashMsg(`${T.flashFailed}${e.message}`));
                                        }}>{T.flashToBoard}</button>
                                    ) : null}
                                    {flashMsg ? <span style={{opacity: 0.85}}>{flashMsg}</span> : null}
                                    <FpgaInfo id="flash" label={T.howToFlash}>
                                        {flash.available ? (
                                            <p style={{margin: 0}}>{T.flashingRuns}</p>
                                        ) : (
                                            <>
                                                <p style={{margin: 0}}>
                                                    {T.browserCannotFlash1}
                                                    <code>{'bw-fpga flash ./design.fs'}</code>{T.browserCannotFlash2}
                                                    <code>{'openFPGALoader -b tangnano20k design.fs'}</code>{T.browserCannotFlash3}
                                                </p>
                                                {webUsbSupported() ? <p style={{marginBottom: 0}}>{T.browserHasWebUsb}</p> : null}
                                            </>
                                        )}
                                    </FpgaInfo>
                                </div>
                            </>
                        ) : artefacts.netlist ? (
                            <div style={ui.row}>
                                <strong>{`✓ ${T.netlistReady} (${artefacts.netlist.modules} ${T.modules})`}</strong>
                                <a href={artefacts.netlist.url} download="design.json" style={{...ui.secondary, textDecoration: 'none'}}>{T.downloadNetlist}</a>
                            </div>
                        ) : <strong>{T.doneFeedback}</strong>}
                        {workspace !== 'simulate' ? (
                            <div style={{...ui.row, marginTop: '0.4rem'}}>
                                <button type="button" data-testid="bw-fpga-next-simulate" style={tools.primary}
                                    onClick={() => setWorkspace('simulate')}>{T.nextSimulate}</button>
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </div>

            <section id="bw-fpga-panel-design" data-testid="bw-fpga-panel-design" hidden={workspace !== 'design'} aria-label={T.designWorkspace}>
                <div style={ui.card}>
                    <h2 style={ui.stepTitle}>{`1 · ${T.designWorkspace}`}</h2>
                    <p style={{...ui.hint, margin: '0 0 0.5rem'}}>{T.designHint}</p>
                    <div style={ui.row}>
                        <label style={field}>{T.exampleLabel}
                            <select data-testid="bw-fpga-example" value={exampleId} style={selector}
                                onChange={event => setExampleId(event.target.value)}>
                                {EXAMPLES.map(ex => <option key={ex.id} value={ex.id}>{ex.label}</option>)}
                            </select>
                        </label>
                        <button type="button" data-testid="bw-fpga-load-example" style={ui.secondary}
                            onClick={() => { const ex = selectedExample; setHdl(ex.verilog); setText(ex.cst); setSynth(null); setSeed(ex.model); }}>
                            {T.loadExample}
                        </button>
                        <FpgaInfo id="example" label={T.exampleInfo}><p>{selectedExample.blurb}</p></FpgaInfo>
                        <span style={{flex: '1 1 0'}} />
                        <label style={field}>{T.editorLabel}
                            <select data-testid="bw-fpga-editor" value={editor} style={selector}
                                onChange={event => setEditor(event.target.value)}>
                                <option value="canvas">{T.canvasEditor}</option>
                                <option value="verilog">{T.verilogEditor}</option>
                            </select>
                        </label>
                    </div>
                </div>

                <div hidden={editor !== 'canvas'} data-testid="bw-fpga-canvas-editor">
                    <React.Suspense fallback={<p style={{opacity: 0.7}}>{T.loadingCanvas}</p>}>
                        <FpgaGateBuilderRf seed={seed} locale={props.locale} onUseVerilog={(v, cst) => { setHdl(v); if (cst) setText(cst); setSynth(null); }} />
                    </React.Suspense>
                </div>
                <div hidden={editor !== 'verilog'} data-testid="bw-fpga-verilog-editor" style={{maxWidth: '64rem'}}>
                    <div style={{...ui.row, justifyContent: 'space-between', marginBottom: '0.25rem'}}>
                        <h3 style={{margin: 0}}>{T.verilogTitle}</h3>
                        <button type="button" style={ui.secondary}
                            onClick={() => {
                                const {model} = verilogToModel(hdl);
                                if (model) setSeed(model);
                            }}>{T.parseToCanvas}</button>
                    </div>
                    <textarea
                        aria-label={T.verilogTitle}
                        data-testid="bw-fpga-verilog"
                        value={hdl}
                        onChange={e => setHdl(e.target.value)}
                        spellCheck={false}
                        placeholder={'// SPDX-License-Identifier: MIT\nmodule blink(output led);\n  assign led = 1\'b1;\nendmodule'}
                        style={{width: '100%', minHeight: '9rem', fontFamily: 'monospace',
                            fontSize: '0.85rem', padding: '0.6rem', boxSizing: 'border-box'}}
                    />
                </div>

                <div style={{...ui.card, marginTop: '0.6rem'}}>
                    <div style={ui.row}>
                        <label style={field}>{T.circuitModel}
                            <select data-testid="bw-fpga-realization" style={selector} value={realization}
                                onChange={event => setRealization(event.target.value)}>
                                <option value="demo">{T.demoModel}</option>
                                <option value="transistors">{T.transistorModel}</option>
                                <option value="ic">{T.chipModel}</option>
                                <option value="circuit">{T.circuitModelOption}</option>
                            </select>
                        </label>
                        {realization === 'demo' ? (
                            <button type="button" onClick={() => wireDemoBoard()} style={ui.secondary}>{T.wireDemoBoardBtn}</button>
                        ) : null}
                        {realization === 'transistors' ? (
                            <span style={field}>
                                <select aria-label={T.gateLabel} value={cmosGate} onChange={e => setCmosGate(e.target.value)}
                                    data-testid="bw-fpga-cmos-gate" style={selector}>
                                    {['not', 'buffer', 'nand', 'nor', 'and', 'or'].map(g =>
                                        <option key={g} value={g}>{g.toUpperCase()}</option>)}
                                </select>
                                <button type="button" data-testid="bw-fpga-build-transistors"
                                    onClick={() => realizeGate(cmosGate)}
                                    title={tr(props.locale, 'tip.buildTransistors')}
                                    style={ui.secondary}>{T.buildTransistorsBtn}</button>
                            </span>
                        ) : null}
                        {realization === 'ic' ? (
                            <span style={field}>
                                <select aria-label={T.gateLabel} value={icGate} onChange={e => setIcGate(e.target.value)}
                                    data-testid="bw-fpga-ic-gate" style={selector}>
                                    {LOGIC_IC_GATES.map(g =>
                                        <option key={g} value={g}>{g.toUpperCase()}</option>)}
                                </select>
                                <button type="button" data-testid="bw-fpga-build-ic"
                                    onClick={() => realizeIcGate(icGate)}
                                    title={tr(props.locale, 'tip.buildIc')}
                                    style={ui.secondary}>{T.buildIcBtn}</button>
                            </span>
                        ) : null}
                        {realization === 'circuit' ? (
                            <span style={field}>
                                <select aria-label={T.circuitLabel} value={icCircuit} onChange={e => setIcCircuit(e.target.value)}
                                    data-testid="bw-fpga-ic-circuit" style={selector}>
                                    {Object.entries(IC_CIRCUITS).map(([k, spec]) =>
                                        <option key={k} value={k}>{circuitLabel(spec, props.locale)}</option>)}
                                </select>
                                <button type="button" data-testid="bw-fpga-build-circuit"
                                    onClick={() => realizeIcCircuit(icCircuit)}
                                    title={tr(props.locale, 'tip.buildCircuit')}
                                    style={ui.secondary}>{T.buildCircuitBtn}</button>
                            </span>
                        ) : null}
                        <FpgaInfo id="circuits" label={T.circuitInfo}><p>{T.circuitHelp}</p></FpgaInfo>
                    </div>
                    <p style={ui.hint}>{`${T.boardOptional} ${T.replacesCircuit}`}</p>
                </div>

                <details style={{maxWidth: '64rem', marginTop: '0.25rem'}}>
                    <summary style={{cursor: 'pointer'}}>{T.constraintsEditor}</summary>
                    <p style={ui.hint}>{T.pinsHint}</p>
                    <textarea
                        aria-label={T.constraintsEditor}
                        data-testid="bw-fpga-constraints"
                        value={text}
                        onChange={e => setText(e.target.value)}
                        spellCheck={false}
                        style={{width: '100%', minHeight: '9rem', fontFamily: 'monospace',
                            fontSize: '0.85rem', padding: '0.6rem', boxSizing: 'border-box'}}
                    />
                    {canonical ? (
                        <details style={{marginTop: '0.4rem'}}>
                            <summary style={{cursor: 'pointer'}}>{T.constraintsTitle}</summary>
                            <p style={ui.hint}>{T.constraintsDesc1}{T.constraintsDesc2}</p>
                            <pre style={{background: 'rgba(127,127,127,0.1)', padding: '0.7rem',
                                borderRadius: 4, overflowX: 'auto', fontSize: '0.82rem'}}>{canonical}</pre>
                        </details>
                    ) : null}
                </details>

                <div style={{...ui.row, maxWidth: '64rem', marginTop: '0.6rem'}}>
                    <button type="button" data-testid="bw-fpga-next-build" style={ui.next}
                        onClick={() => setWorkspace('build')}>{T.nextBuild}</button>
                </div>
            </section>

            <section id="bw-fpga-panel-build" data-testid="bw-fpga-panel-build" hidden={workspace !== 'build'}
                aria-label={T.buildWorkspace} style={{maxWidth: '64rem'}}>
                <div style={ui.card}>
                    <h2 style={ui.stepTitle}>{`2 · ${T.buildWorkspace}`}</h2>
                    <p style={{...ui.hint, margin: '0 0 0.5rem'}}>{T.buildHint}</p>
                    <div style={ui.row}>
                        <label style={field}>{T.buildTarget}
                            <select data-testid="bw-fpga-build-target" value={buildTarget} style={selector}
                                onChange={event => setBuildTarget(event.target.value)}>
                                <option value="service">{T.serviceBuild}</option>
                                <option value="browser">{T.browserBuild}</option>
                            </select>
                        </label>
                        <FpgaInfo id="synthesis" label={T.buildInfo}><p>{T.yosysRunsHere1}{T.yosysRunsHere2}{T.yosysRunsHere3}</p></FpgaInfo>
                        <FpgaInfo id="backends" label={T.backendInfo}>
                            {catalog.map(entry => <p key={entry.id}><strong>{entry.label}</strong><br />{entry.description}</p>)}
                        </FpgaInfo>
                    </div>
                </div>

                <div hidden={buildTarget !== 'service'} data-testid="bw-fpga-service-build" style={ui.card}>
                    <div style={ui.row}>
                        <strong>{T.whereBuiltTitle}</strong>
                        {offerable(catalog, probe.available).length > 1 ? (
                            <label style={field}>
                                {T.backendLabel}
                                <select data-testid="bw-fpga-backend" style={selector} value={backend} onChange={ev => setBackend(ev.target.value)}>
                                    <option value="auto">{T.autoOption}</option>
                                    {offerable(catalog, probe.available).map(en => (
                                        <option key={en.id} value={en.id}>{en.label}</option>
                                    ))}
                                </select>
                            </label>
                        ) : null}
                    </div>
                    <ul style={{listStyle: 'none', padding: 0, margin: '0.35rem 0'}}>
                        {catalog.map(entry => {
                            const pr = probe.probes.find(x => x.id === entry.id);
                            const isAvailable = probe.available.includes(entry.id);
                            return (
                                <Row key={entry.id} tone={isAvailable ? '#3a8a3a' : '#7a7a7a'}>
                                    <strong>{entry.label}</strong>
                                    {isAvailable ? ` — ${T.available}` : ` — ${T.unavailable}: ${pr ? pr.reason : T.notProbed}`}
                                </Row>
                            );
                        })}
                    </ul>
                    <p style={ui.hint}>
                        {selection.accepted
                            ? <span title={selection.reason}>{T.buildsOn}<strong>{selection.selected.label}</strong></span>
                            : <><strong>{selection.code}</strong>{`: ${selection.reason}`}</>}
                    </p>
                    <div style={{...ui.row, marginTop: '0.5rem'}}>
                        <button
                            type="button"
                            style={{...tools.primary, opacity: !hdl.trim() || !selection.accepted || building ? 0.45 : 1}}
                            onClick={() => {
                                setBuilding(true);
                                setSynth(null);
                                return synthesise({
                                    files: [{name: 'design.v', source: hdl}],
                                    constraints: text,
                                    endpoint: selection.accepted ? selection.selected.endpoint : null
                                }).then(r => {
                                    setSynth(r);
                                    // Drive the board from the design: feed the GENERIC sim
                                    // netlist (not the Gowin-mapped `netlist`, which the sim
                                    // cannot read) into the simulator's input.
                                    if (r && r.ok && r.simNetlist) {
                                        setNetlistText(JSON.stringify(r.simNetlist, null, 2));
                                    }
                                }).catch(e => setSynth({ok: false, code: 'synthesis-failed', reason: e && e.message ? e.message : String(e)}))
                                    .finally(() => setBuilding(false));
                            }}
                            disabled={!hdl.trim() || !selection.accepted || building}
                        >{building ? T.synthesising : T.synthesiseBtn}</button>
                        {!hdl.trim() ? <span style={ui.hint}>{T.needDesignFirst}</span> : null}
                    </div>
                </div>

                <div hidden={buildTarget !== 'browser'} data-testid="bw-fpga-browser-build" style={ui.card}>
                    <p style={{margin: '0 0 0.35rem'}}><strong>{T.browserLimit}</strong></p>
                    <p style={{margin: '0 0 0.5rem'}}>
                        {local && local.code !== 'not-downloaded' ? <strong>{`${local.code || local.state}: `}</strong> : null}
                        {local ? local.reason : T.starting}
                    </p>
                    <div style={ui.row}>
                        <button
                            type="button"
                            style={ui.secondary}
                            onClick={() => {
                                setLocalBusy(true);
                                localClient.download({consent: true})
                                    .then(r => setLocal(r.result && r.result.ok
                                        ? {state: 'ready', available: true, ok: true,
                                            reason: tr(props.locale, 'toolchain.downloaded')}
                                        : r.result))
                                    .finally(() => setLocalBusy(false));
                            }}
                            disabled={localBusy || !local || local.code !== 'not-downloaded'}
                        >{localBusy ? T.downloading : T.downloadToolchain}</button>
                        <button
                            type="button"
                            style={{...tools.primary, opacity: localBusy || !hdl.trim() || !local || !local.available ? 0.45 : 1}}
                            onClick={() => {
                                setLocalBusy(true);
                                return localClient.synthesise({files: [{name: 'design.v', source: hdl}]})
                                    .then(r => {
                                        setSynth(r.result);
                                        // Feed the GENERIC sim netlist into the simulator. It must
                                        // be simNetlist, not netlist: the synth_gowin `netlist` is
                                        // Gowin-mapped and the sim cannot read it. The textarea
                                        // drives the sim, so setting it is all it takes.
                                        if (r.result && r.result.ok && r.result.simNetlist) {
                                            setNetlistText(JSON.stringify(r.result.simNetlist, null, 2));
                                        }
                                    })
                                    .finally(() => setLocalBusy(false));
                            }}
                            disabled={localBusy || !hdl.trim() || !local || !local.available}
                        >{T.synthesiseHereBtn}</button>
                    </div>
                </div>
            </section>

            <section id="bw-fpga-panel-simulate" data-testid="bw-fpga-panel-simulate" hidden={workspace !== 'simulate'}
                aria-label={T.simulateWorkspace}>
                <div style={ui.card}>
                    <h2 style={ui.stepTitle}>{`3 · ${T.simulateWorkspace}`}</h2>
                    <p style={{...ui.hint, margin: '0 0 0.5rem'}}>{T.simulateHint}</p>
                    <div style={ui.row}>
                        <label style={field}>{T.simulationView}
                            <select data-testid="bw-fpga-simulation-view" value={simulationView} style={selector}
                                onChange={event => setSimulationView(event.target.value)}>
                                <option value="schematic">{T.schematicView}</option>
                                <option value="waveforms">{T.waveformView}</option>
                                <option value="pins">{T.pinsView}</option>
                            </select>
                        </label>
                        <FpgaInfo id="simulation" label={T.simulateInfo}>
                            <p style={{marginTop: 0, opacity: 0.8}}>
                                {T.schematicDesc1}{T.schematicDesc2}{T.schematicDesc3}
                            </p>
                            <p style={{marginTop: 0, opacity: 0.8}}>
                                {T.waveformsDesc1}{T.waveformsDesc2}{T.waveformsDesc3}
                            </p>
                            <p style={{marginTop: 0, opacity: 0.8}}>
                                {T.clockDesc1}<code>{clockPort}</code>{T.clockDesc2}
                            </p>
                            <p>{T.checkPinsDesc1}{T.checkPinsDesc2}{T.checkPinsDesc3}</p>
                        </FpgaInfo>
                    </div>
                </div>
                {netlistText.trim() ? null : (
                    <div style={{...ui.card, background: '#f8fafc'}}>
                        <p style={{margin: '0 0 0.5rem'}}>{T.emptySimulation}</p>
                        <button type="button" data-testid="bw-fpga-goto-build" style={tools.primary}
                            onClick={() => setWorkspace('build')}>{T.goBuild}</button>
                    </div>
                )}
                {clockPort ? (
                    <div style={ui.card}>
                        <div style={ui.row}>
                            <strong>{T.clockTitle}</strong>
                            <code>{clockPort}</code>
                            <button type="button" onClick={() => setClockCycles(c => c + 1)} style={tools.primary}>{T.stepClockBtn}</button>
                            <button type="button" onClick={() => setClockCycles(c => c + 8)} style={ui.secondary}>{'+8'}</button>
                            <button type="button" disabled={clockCycles === 0} onClick={() => setClockCycles(0)}
                                style={{...ui.secondary, opacity: clockCycles === 0 ? 0.45 : 1}}>{T.resetBtn}</button>
                            <button type="button" onClick={() => setAutoRun(v => !v)}
                                style={autoRun ? tools.stop : ui.secondary} aria-pressed={autoRun}>
                                {autoRun ? T.stopAutoRun : T.autoRun}
                            </button>
                            <span style={{opacity: 0.8}}>
                                {clockCycles}{clockCycles === 1 ? T.cycle : T.cycles}
                            </span>
                        </div>
                        {/* Mirror the output pins into the Controller/Widgets view, so the
                            synthesised design's LEDs are visible there too — not only on
                            the placed board. gui.jsx owns the panel; we hand it the pins. */}
                        {outputPins.length ? (
                            <details style={{marginTop: '0.5rem'}}>
                                <summary style={{cursor: 'pointer', fontSize: 13}}>{T.controllerDisplay}</summary>
                                <div style={{...ui.row, marginTop: '0.4rem'}}>
                                    <select aria-label={T.controllerDisplay} data-testid="bw-fpga-controller-display" value={controllerDisplay} style={selector}
                                        onChange={event => setControllerDisplay(event.target.value)}>
                                        <option value="leds">{T.ledsDisplay}</option>
                                        <option value="seg7">{T.sevenSegmentDisplay}</option>
                                    </select>
                                    {controllerDisplay === 'leds' ? (
                                        <button type="button" style={ui.secondary}
                                            onClick={() => {
                                                window.dispatchEvent(new CustomEvent('bw-fpga-leds',
                                                    {detail: {pins: outputPins}}));
                                                setAutoRun(true);
                                                setMirrored(true);
                                            }}>{T.showLeds}</button>
                                    ) : (
                                        <button type="button" data-testid="bw-fpga-show-seg7" style={ui.secondary}
                                            onClick={() => {
                                                // Mirror the SAME outputs, folded into one number on a
                                                // seven-segment widget (a counter then reads 0,1,2,3…).
                                                window.dispatchEvent(new CustomEvent('bw-fpga-leds',
                                                    {detail: {pins: outputPins}}));
                                                window.dispatchEvent(new CustomEvent('bw-fpga-seg7',
                                                    {detail: {pins: outputPins}}));
                                                setAutoRun(true);
                                                setMirrored(true);
                                            }}>{T.showSeg7}</button>
                                    )}
                                    <span style={ui.hint}>{`${T.mirrorsPins}${outputPins.join(', ')}${T.asIndicators}`}</span>
                                </div>
                            </details>
                        ) : null}
                    </div>
                ) : null}

                {inputPorts.length ? (
                    <div style={ui.card}>
                        <h3 style={{margin: '0 0 0.25rem', fontSize: 14}}>{T.designInputsTitle}</h3>
                        <div style={{display: 'flex', gap: '0.75rem', flexWrap: 'wrap'}}>
                            {inputPorts.map(name => (
                                <label key={name} style={{display: 'flex', alignItems: 'center', gap: '0.35rem'}}>
                                    <input
                                        type="checkbox"
                                        checked={Boolean(inputs[name])}
                                        onChange={e => setInputs({...inputs, [name]: e.target.checked})}
                                    />
                                    <code>{name}</code>
                                </label>
                            ))}
                        </div>
                        <p style={ui.hint}>{T.nothingDrivesThese}</p>
                    </div>
                ) : null}

                {netlistText.trim() ? (
                    <div hidden={simulationView !== 'schematic'} data-testid="bw-fpga-schematic-view">
                        <h3>{T.schematicTitle}</h3>
                        <React.Suspense fallback={<p style={{opacity: 0.7}}>{T.loadingSchematic}</p>}>
                            <FpgaSchematic netlistText={netlistText} netValues={netValues} inputs={inputs} clockCycles={clockCycles} />
                        </React.Suspense>
                    </div>
                ) : null}

                {netlistText.trim() ? (
                    <div hidden={simulationView !== 'waveforms'} data-testid="bw-fpga-waveform-view">
                        <h3>{T.waveformsTitle}</h3>
                        <React.Suspense fallback={<p style={{opacity: 0.7}}>{T.loadingWaveform}</p>}>
                            <FpgaWaveform netlistText={netlistText} inputs={inputs} />
                        </React.Suspense>
                    </div>
                ) : null}

                <div hidden={simulationView !== 'pins'} data-testid="bw-fpga-pins-view" style={{maxWidth: '64rem'}}>
                    <details>
                        <summary style={{cursor: 'pointer', fontWeight: 'bold'}}>
                            {`${T.checkPinsTitle}${bindings.length}${T.placed}`}
                            {refusals.length ? `, ${refusals.length}${T.cannot}` : ''}{')'}
                        </summary>
                        <h3>{`${T.reachesBoard}${bindings.length})`}</h3>
                        <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                            {bindings.map(b => (
                                <Row key={`${b.port}-${b.pin}`} tone="#3a8a3a">
                                    <code>{b.port}</code>{T.pinArrow}<code>{b.pin}</code>
                                    {T.terminalArrow}<code>{b.terminal}</code>
                                    {b.sharedWith ? <em style={{opacity: 0.8}}>{T.sharesHardware}</em> : null}
                                </Row>
                            ))}
                            {bindings.length ? null : <li style={{opacity: 0.7}}>{T.nothingPlacedYet}</li>}
                        </ul>
                        <h3>
                            {T.whatCircuitEngine}
                            {simNote ? <span style={{opacity: 0.7, fontWeight: 'normal'}}>{` — ${simNote}`}</span> : null}
                        </h3>
                        <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                            {plan.ops.map(([terminal, mode, driveHigh], i) => (
                                <Row key={i} tone="#4a6fa5">
                                    <code>{terminal}</code>{` → ${mode}`}
                                    {mode === 'pushpull' ? <strong>{driveHigh ? T.high : T.low}</strong> : null}
                                    {mode === 'input' ? <em style={{opacity: 0.8}}>{T.highZ}</em> : null}
                                </Row>
                            ))}
                            {plan.unset.map((u, i) => (
                                <Row key={`u${i}`} tone="#7a7a7a">
                                    <code>{u.terminal}</code>
                                    {T.undriven}
                                </Row>
                            ))}
                            {plan.ops.length || plan.unset.length ? null : <li style={{opacity: 0.7}}>{T.nothingToDrive}</li>}
                        </ul>
                    </details>
                </div>

                <details style={{margin: '0.75rem 0', maxWidth: '64rem'}}>
                    <summary style={{cursor: 'pointer'}}>
                        {T.importNetlist}
                        {top ? <strong>{`${T.topModule}${top}`}</strong> : null}
                    </summary>
                    <textarea
                        aria-label={T.importNetlist}
                        data-testid="bw-fpga-netlist"
                        value={netlistText}
                        onChange={e => setNetlistText(e.target.value)}
                        spellCheck={false}
                        placeholder={'yosys -p \'synth_gowin -json out.json\' design.v'}
                        style={{width: '100%', minHeight: '7rem', fontFamily: 'monospace',
                            fontSize: '0.8rem', padding: '0.6rem', marginTop: '0.4rem', boxSizing: 'border-box'}}
                    />
                    <div style={{textAlign: 'right', marginTop: '0.2rem'}}>
                        <button type="button" style={ui.secondary}
                            onClick={() => {
                                try {
                                    const {model} = yosysToModel(netlistText);
                                    if (model) setSeed(model);
                                } catch (e) {
                                    console.error('Failed to parse yosys JSON', e);
                                }
                            }}>{T.importYosysToCanvas}</button>
                    </div>
                </details>
            </section>
        </div>
    );
};

export default connect(state => ({locale: state.locales && state.locales.locale}))(FpgaTab);
