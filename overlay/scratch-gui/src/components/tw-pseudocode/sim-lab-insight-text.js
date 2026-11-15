// SPDX-License-Identifier: BSD-3-Clause
// Copyright (c) 2026 Brickwright contributors
//
// The Robot Lab's words for what is in a model and what is wrong with it, for
// children, in English and German (the pane's locale table for the issues
// list, the port labels and the "Show how it moves" overlay; sim-lab-pane.jsx
// reads it). Each issue code the model reader, the compiler or the pane can
// produce (lib/bw-sim/model, lib/bw-sim/mech, lib/bw-sim/sim-session.js) has a
// sentence here; test/bw-sim-model-insight.test.mjs finds the codes in those
// sources and fails on one without a sentence in both languages.
//
// Placeholders: {parts} the parts the issue is about ("the SPIKE medium angular
// motor"), {line} the LDraw line it was found on, {design} an LDD design number
// (an .lxf part the Robot Lab cannot map).

export const INSIGHT_TEXT = {
    en: {
        issues: {
            'bad-motor-direction': 'The motor direction setting on line {line} is unknown or repeated, so the robot cannot run. Check this setting in the model file.',
            'bad-rotor-model': 'The motor rotor setting on line {line} is unknown or repeated, so the robot cannot run. Use legacy or native once in the model file.',
            'bad-solver-preset': 'The solver setting on line {line} is unknown or repeated, so the robot cannot run. Use light-links once in the model file.',
            'bad-internal-edge-pair': 'A selected contact pair is invalid or repeated. Check that it names two different parts in this model before starting the robot.',
            'bad-slide': '{parts}: the sliding-hole instruction does not name a supported round hole. Check its connector name.',
            'bad-rotor': '{parts}: the saved motor angle is not valid. Use a finite angle for a supported motor.',
            'bad-drawing': 'The drawing surface instruction is incomplete or invalid. Check its surface, pen and dimensions.',
            'uj-not-square': '{parts}: the two fork pivots are not perpendicular. Rotate one fork by a quarter turn to fit the cross.',
            'uj-too-bent': '{parts}: this universal joint is bent too far for its forks to turn freely. Reduce the shaft angle.',
            'motor-without-port': '{parts} is not plugged into the hub yet: click here, then choose a port (A–F) on its label.',
            'sensor-without-port': '{parts} is not plugged into the hub yet: click here, then choose a port (A–F) on its label.',
            'motor-without-device': '{parts} is a motor the Robot Lab has no numbers for yet, so it cannot drive it.',
            'port-hub-unknown': '{parts} is plugged into a part that is not a hub, so it uses the first hub instead.',
            'no-motor': 'No motor is plugged into the hub, so the robot cannot move by itself. Give a motor a port (A–F).',
            'no-hub': 'There is no SPIKE hub in this model, so no SPIKE program can run it. Robot Lab blocks and lab words still turn its motors directly; to run a SPIKE program, add the hub from the parts list.',
            'falls-apart': 'This robot falls apart: some parts are not connected to the rest. Click here to see them, then fix them with pins or axles.',
            'empty-model': 'There is nothing to simulate yet: add some parts in Build.',
            'loose-part': '{parts}: not joined to the rest of the robot. Loose parts fall off: join them with a pin or an axle.',
            'gear-on-frame': '{parts} are stuck: one gear is fixed to the part that holds the other one, so they cannot turn. Put one gear on its own axle that turns.',
            'gear-frames-differ': '{parts} touch, but their axles sit in different parts, so they do not turn each other here. Hold both axles in the same beam.',
            'gear-not-on-hinge': '{parts} is not on an axle that can turn, so it cannot turn other gears.',
            'unsupported-gear': '{parts} do not work together in the Robot Lab yet (only round gears and bevel gears do).',
            'locked-hinges': '{parts}: connections in different directions make this assembly rigid. These parts move together; other joints can still turn.',
            'unknown-part': 'The Robot Lab does not know a part on line {line} yet: it is drawn, but it does not move or hold anything.',
            'ports-plugged': '{parts}: the file did not say which port they go in, so they are plugged into the hub\'s free ports.',
            'seated-loosely': '{parts}: their pins or axles do not quite fit where the file puts them, so they are joined where they almost fit.',
            'invalid-model': 'Something in the model is not right, so part of it is left out: {parts}',
            'bad-obstacle': 'One of the obstacles is not set up right and is left out.',
            'bad-load': 'One of the things to carry (like the pallet) is not set up right and is left out.',
            'rack-not-sliding': '{parts}: the gear touches the rack, but the rack cannot slide along, so the gear does not move it. Hold the rack on a part that slides, like the smooth toggle joint on an axle.',
            'chain-not-round-gears': '{parts}: this chain does not go round two gears, so it drives nothing. Lay it round both gears (select them, then Chain or tread round).',
            'chain-frames-differ': '{parts}: the chain goes round both gears, but their axles sit in different parts, so one cannot drive the other. Hold both axles in the same beam or frame.',
            'belt-not-round': '{parts}: a rubber band goes round a part it cannot hold on to, so it does nothing.',
            'belt-frames-differ': '{parts}: the rubber band goes round both, but their axles sit in different parts, so one cannot drive the other. Hold both axles in the same beam or frame.',
            'uj-too-bent': '{parts}: this universal joint is bent too far (more than 45°), so it would jam. Line the two axles up more.',
            'uj-not-square': '{parts}: these universal joint ends meet, but their forks are not at right angles, so the cross cannot fit. Turn one end a quarter turn on its axle.',
            'gear-loop-locked': '{parts}: two gear paths join the same axles but want different speeds, so the gears jam and nothing turns. Take one of the paths out.',
            'clutch-gear-fixed': '{parts}: the clutch gear sits fixed on the axle, so it always turns with it. Use a clutch gear with a round hole, which spins freely until the driving ring takes it.',
            'clutch-not-on-axle': '{parts}: the driving ring faces the clutch gear, but the gear is not on the ring\'s axle, so the ring cannot take it.',
            'fork-ring-not-sliding': '{parts}: the catch sits in the ring\'s groove, but the ring cannot slide, so shifting moves nothing. Put the driving ring on a ridged axle joiner.',
            'fork-not-on-hinge': '{parts}: the catch sits in the ring\'s groove but cannot swing, so it holds the ring in place. Put the catch on an axle that turns.',
            'screw-not-sliding': '{parts}: the spindle turns, but the piston cannot slide in the actuator, so it does not move. Put the piston back into its actuator.',
            'bad-port': 'The port on line {line} is not one of A–F, so it is ignored.',
            'bad-matrix': 'The part on line {line} is mirrored or stretched. Real bricks cannot be, so it is left out.',
            'unparsable': 'Line {line} of the file could not be read, so it is left out.',
            'loose-geometry': 'Line {line} is a loose drawing line, not a part, so it is left out.',
            'duplicate-id': '{parts} had the same name as another part and got a new one.',
            'bad-group': 'A group on line {line} is not written right, so it is left out.',
            'bad-belt': 'A rubber band on line {line} goes round parts the file does not have, so it is left out.',
            'bad-rope': 'A rope on line {line} runs round parts the file does not have, so it is left out.',
            'bad-hose': 'A hose on line {line} joins parts the file does not have, so it is left out.',
            'rope-not-tied': '{parts}: this rope is not tied to a round drum, so it does nothing. Select a bush or a wheel on an axle first.',
            'duplicate-group': 'A group on line {line} has the same name as another group, so it is left out.',
            'unknown-group': 'A part on line {line} belongs to a group that does not exist, so it is left ungrouped.',
            'cycle': 'A sub-model in the file is built from itself, so that copy is left out.',
            'too-deep': 'Line {line} puts sub-models inside sub-models too many times over, so that copy is left out.',
            'too-many-parts': 'This model has far too many parts for the Robot Lab, so it is not opened.',
            'out-of-range': 'Line {line} places a part much too far away, so it is left out.',
            'project-model-unreadable': 'The robot saved in this project could not be read, so the standard robot is shown.',
            'studio-only-part': 'Line {line} places a part only BrickLink Studio has (not in LDraw), so it is left out.',
            'lxf-unknown-design': 'The LEGO Digital Designer part {design} is not one the Robot Lab knows yet, so it is left out.',
            'lxf-bad-transform': 'The LEGO Digital Designer part {design} is mirrored or stretched, so it is left out.',
            'lxf-unknown-material': 'The LEGO Digital Designer part {design} has a colour LDraw does not know, so it is shown light grey.',
            'lxf-derived-frame': 'The LEGO Digital Designer part {design} was placed by measuring its shape, so check that it sits where you built it.',
            'lxf-snapped-frame': 'The LEGO Digital Designer part {design} was placed where its pins, holes and studs meet the parts around it, so check that it sits where you built it.',
            'lxf-unplaced-design': 'The LEGO Digital Designer part {design} connects to nothing the Robot Lab could find, so it is left out.',
            'lxf-part-of-element': 'The LEGO Digital Designer piece {design} belongs to a part that is placed whole (a motor\'s hub), so it is left out.',
            'lcd-hidden-piece': 'The LeoCAD part {design} is hidden in the project, so it is left out.',
            'lcd-unknown-colour': 'The LeoCAD part {design} has a colour LDraw does not know, so it is shown light grey.'
        },
        fallbackIssue: 'Something about this model needs a look.',
        and: 'and', part: 'the part {id}',
        blockersTitle: 'Before you press Run:',
        showPorts: 'Show ports', showMotion: 'Show how it moves',
        showPortsHelp: 'Show each motor’s and sensor’s hub port next to it (? means not plugged in)',
        showMotionHelp: 'Colour the parts that move together, draw the turning axes (red: motors) and the gear pairs',
        issueHelp: 'Click to show these parts',
        portLabel: '{part} on port {port}: click to change the port', portLabelNone: '{part} is not plugged in: click to choose a port',
        portPick: 'Port for {part}', portNone: 'none', close: 'Close'
    },
    de: {
        issues: {
            'bad-motor-direction': 'Die Einstellung für die Motordrehrichtung in Zeile {line} ist unbekannt oder steht mehrfach in der Datei. Darum kann der Roboter nicht starten. Prüfe diese Einstellung in der Modelldatei.',
            'bad-rotor-model': 'Die Einstellung für den Motorrotor in Zeile {line} ist unbekannt oder steht mehrfach in der Datei. Darum kann der Roboter nicht starten. Verwende legacy oder native genau einmal in der Modelldatei.',
            'bad-solver-preset': 'Die Solver-Einstellung in Zeile {line} ist unbekannt oder steht mehrfach in der Datei. Darum kann der Roboter nicht starten. Verwende light-links genau einmal in der Modelldatei.',
            'bad-internal-edge-pair': 'Ein ausgewähltes Kontaktpaar ist ungültig oder mehrfach vorhanden. Prüfe, ob es zwei verschiedene Teile dieses Modells nennt, bevor du den Roboter startest.',
            'bad-slide': '{parts}: Die Gleitbohrungsangabe nennt kein unterstütztes rundes Loch. Prüfe den Anschlussnamen.',
            'bad-rotor': '{parts}: Der gespeicherte Motorwinkel ist ungültig. Verwende einen endlichen Winkel für einen unterstützten Motor.',
            'bad-drawing': 'Die Zeichenflächenangabe ist unvollständig oder ungültig. Prüfe Fläche, Stift und Abmessungen.',
            'uj-not-square': '{parts}: Die Gabelzapfen stehen nicht senkrecht aufeinander. Drehe eine Gabel um eine Vierteldrehung, damit das Kreuz passt.',
            'uj-too-bent': '{parts}: Dieses Kardangelenk ist zu stark geknickt, um frei zu drehen. Verringere den Winkel zwischen den Wellen.',
            'motor-without-port': '{parts} steckt noch nicht im Hub: hier klicken, dann an seinem Schild einen Port (A–F) wählen.',
            'sensor-without-port': '{parts} steckt noch nicht im Hub: hier klicken, dann an seinem Schild einen Port (A–F) wählen.',
            'motor-without-device': '{parts} ist ein Motor, für den das Roboter-Labor noch keine Werte kennt, darum kann es ihn nicht antreiben.',
            'port-hub-unknown': '{parts} steckt in einem Teil, das kein Hub ist, darum nimmt es den ersten Hub.',
            'no-motor': 'Kein Motor steckt im Hub, darum kann sich der Roboter nicht von selbst bewegen. Gib einem Motor einen Port (A–F).',
            'no-hub': 'In diesem Modell ist kein SPIKE-Hub, darum kann kein SPIKE-Programm es steuern. Robot-Lab-Blöcke und lab-Wörter drehen seine Motoren trotzdem direkt; für ein SPIKE-Programm füge den Hub aus der Teileliste hinzu.',
            'falls-apart': 'Dieser Roboter fällt auseinander: Einige Teile hängen nicht am Rest. Hier klicken zeigt sie, dann mit Pins oder Achsen befestigen.',
            'empty-model': 'Noch gibt es nichts zu simulieren: Füge beim Bauen Teile hinzu.',
            'loose-part': '{parts}: nicht mit dem Rest des Roboters verbunden. Lose Teile fallen ab: Befestige sie mit einem Pin oder einer Achse.',
            'gear-on-frame': '{parts} klemmen: Ein Zahnrad sitzt fest an dem Teil, das das andere hält, darum können sie sich nicht drehen. Setz ein Zahnrad auf eine eigene Achse, die sich dreht.',
            'gear-frames-differ': '{parts} berühren sich, aber ihre Achsen stecken in verschiedenen Teilen, darum drehen sie sich hier nicht gegenseitig. Halte beide Achsen im selben Balken.',
            'gear-not-on-hinge': '{parts} sitzt nicht auf einer Achse, die sich drehen kann, darum dreht es keine anderen Zahnräder.',
            'unsupported-gear': '{parts} funktionieren im Roboter-Labor noch nicht zusammen (nur runde Zahnräder und Kegelzahnräder).',
            'locked-hinges': '{parts}: Verbindungen in verschiedenen Richtungen machen diese Baugruppe starr. Diese Teile bewegen sich gemeinsam; andere Gelenke können sich weiter drehen.',
            'unknown-part': 'Das Roboter-Labor kennt ein Teil in Zeile {line} noch nicht: Es wird gezeichnet, bewegt sich aber nicht und hält nichts.',
            'ports-plugged': '{parts}: Die Datei sagt nicht, in welchen Port sie gehören, darum stecken sie in den freien Ports des Hubs.',
            'seated-loosely': '{parts}: Ihre Pins oder Achsen passen nicht ganz dorthin, wo die Datei sie hinsetzt, darum sind sie dort verbunden, wo sie fast passen.',
            'invalid-model': 'Etwas im Modell stimmt nicht, darum wird ein Teil weggelassen: {parts}',
            'bad-obstacle': 'Eins der Hindernisse ist nicht richtig eingestellt und wird weggelassen.',
            'bad-load': 'Eins der Dinge zum Tragen (wie die Palette) ist nicht richtig eingestellt und wird weggelassen.',
            'rack-not-sliding': '{parts}: Das Zahnrad berührt die Zahnstange, aber die Zahnstange kann nicht gleiten, darum bewegt das Zahnrad sie nicht. Halte die Zahnstange an einem Teil, das gleitet, wie das glatte Kippgelenk auf einer Achse.',
            'chain-not-round-gears': '{parts}: Diese Kette läuft nicht um zwei Zahnräder, darum treibt sie nichts an. Leg sie um beide Zahnräder (beide wählen, dann Kette oder Raupe herum).',
            'chain-frames-differ': '{parts}: Die Kette läuft um beide Zahnräder, aber ihre Achsen sitzen in verschiedenen Teilen, darum kann eins das andere nicht antreiben. Halte beide Achsen im selben Balken oder Rahmen.',
            'belt-not-round': '{parts}: Ein Gummiband läuft um ein Teil, an dem es keinen Halt findet, darum tut es nichts.',
            'belt-frames-differ': '{parts}: Das Gummiband läuft um beide, aber ihre Achsen sitzen in verschiedenen Teilen, darum kann eins das andere nicht antreiben. Halte beide Achsen im selben Balken oder Rahmen.',
            'uj-too-bent': '{parts}: Dieses Kardangelenk ist zu stark geknickt (mehr als 45°), darum würde es klemmen. Richte die beiden Achsen gerader aus.',
            'uj-not-square': '{parts}: Diese Kardangelenk-Enden treffen sich, aber ihre Gabeln stehen nicht im rechten Winkel, darum passt das Kreuz nicht hinein. Dreh ein Ende eine Vierteldrehung auf seiner Achse.',
            'gear-loop-locked': '{parts}: Zwei Zahnrad-Wege verbinden dieselben Achsen, wollen aber verschiedene Geschwindigkeiten, darum klemmen die Zahnräder und nichts dreht sich. Nimm einen der Wege heraus.',
            'clutch-gear-fixed': '{parts}: Das Kupplungszahnrad sitzt fest auf der Achse und dreht sich darum immer mit. Nimm ein Kupplungszahnrad mit rundem Loch, das sich frei dreht, bis der Schaltring es greift.',
            'clutch-not-on-axle': '{parts}: Der Schaltring zeigt auf das Kupplungszahnrad, aber das Zahnrad sitzt nicht auf der Achse des Rings, darum kann der Ring es nicht greifen.',
            'fork-ring-not-sliding': '{parts}: Die Schaltgabel sitzt in der Rille des Rings, aber der Ring kann nicht gleiten, darum bewegt das Schalten nichts. Setz den Schaltring auf einen geriffelten Achsverbinder.',
            'fork-not-on-hinge': '{parts}: Die Schaltgabel sitzt in der Rille des Rings, kann sich aber nicht drehen, darum hält sie den Ring fest. Setz die Gabel auf eine Achse, die sich dreht.',
            'screw-not-sliding': '{parts}: Die Spindel dreht sich, aber der Kolben kann im Linearantrieb nicht gleiten, darum bewegt er sich nicht. Setze den Kolben wieder in seinen Linearantrieb.',
            'bad-port': 'Der Port in Zeile {line} ist keiner von A–F, darum wird er ignoriert.',
            'bad-matrix': 'Das Teil in Zeile {line} ist gespiegelt oder gestreckt. Echte Steine können das nicht, darum wird es weggelassen.',
            'unparsable': 'Zeile {line} der Datei konnte nicht gelesen werden, darum wird sie weggelassen.',
            'loose-geometry': 'Zeile {line} ist eine lose Zeichenlinie, kein Teil, darum wird sie weggelassen.',
            'duplicate-id': '{parts} hatte denselben Namen wie ein anderes Teil und hat einen neuen bekommen.',
            'bad-group': 'Eine Gruppe in Zeile {line} ist nicht richtig geschrieben, darum wird sie weggelassen.',
            'bad-belt': 'Ein Gummiband in Zeile {line} läuft um Teile, die die Datei nicht hat, darum wird es weggelassen.',
            'bad-rope': 'Ein Seil in Zeile {line} läuft um Teile, die die Datei nicht hat, darum wird es weggelassen.',
            'bad-hose': 'Ein Schlauch in Zeile {line} verbindet Teile, die die Datei nicht hat, darum wird er weggelassen.',
            'rope-not-tied': '{parts}: Dieses Seil hängt nicht an einer runden Trommel, darum tut es nichts. Wähle zuerst eine Buchse oder ein Rad auf einer Achse.',
            'duplicate-group': 'Eine Gruppe in Zeile {line} hat denselben Namen wie eine andere Gruppe, darum wird sie weggelassen.',
            'unknown-group': 'Ein Teil in Zeile {line} gehört zu einer Gruppe, die es nicht gibt, darum bleibt es ohne Gruppe.',
            'cycle': 'Ein Teilmodell in der Datei ist aus sich selbst gebaut, darum wird diese Kopie weggelassen.',
            'too-deep': 'Zeile {line} steckt Teilmodelle zu oft ineinander, darum wird diese Kopie weggelassen.',
            'too-many-parts': 'Dieses Modell hat viel zu viele Teile für das Roboter-Labor, darum wird es nicht geöffnet.',
            'out-of-range': 'Zeile {line} setzt ein Teil viel zu weit weg, darum wird es weggelassen.',
            'project-model-unreadable': 'Der in diesem Projekt gespeicherte Roboter konnte nicht gelesen werden, darum wird der Standard-Roboter gezeigt.',
            'studio-only-part': 'Zeile {line} setzt ein Teil, das nur BrickLink Studio kennt (nicht LDraw), darum wird es weggelassen.',
            'lxf-unknown-design': 'Das LEGO-Digital-Designer-Teil {design} kennt das Roboter-Labor noch nicht, darum wird es weggelassen.',
            'lxf-bad-transform': 'Das LEGO-Digital-Designer-Teil {design} ist gespiegelt oder gestreckt, darum wird es weggelassen.',
            'lxf-unknown-material': 'Das LEGO-Digital-Designer-Teil {design} hat eine Farbe, die LDraw nicht kennt, darum ist es hellgrau.',
            'lxf-derived-frame': 'Das LEGO-Digital-Designer-Teil {design} wurde anhand seiner Form eingesetzt. Prüfe, ob es dort sitzt, wo du es gebaut hast.',
            'lxf-snapped-frame': 'Das LEGO-Digital-Designer-Teil {design} wurde dort eingesetzt, wo seine Pins, Löcher und Noppen die Teile ringsum treffen. Prüfe, ob es so sitzt, wie du es gebaut hast.',
            'lxf-unplaced-design': 'Das LEGO-Digital-Designer-Teil {design} ist mit nichts verbunden, was das Roboter-Labor finden konnte, darum fehlt es.',
            'lxf-part-of-element': 'Das LEGO-Digital-Designer-Stück {design} gehört zu einem Teil, das ganz eingesetzt wird (die Nabe eines Motors), darum fehlt es.',
            'lcd-hidden-piece': 'Das LeoCAD-Teil {design} ist im Projekt ausgeblendet, darum fehlt es.',
            'lcd-unknown-colour': 'Das LeoCAD-Teil {design} hat eine Farbe, die LDraw nicht kennt, darum ist es hellgrau.'
        },
        fallbackIssue: 'Etwas an diesem Modell solltest du dir ansehen.',
        and: 'und', part: 'das Teil {id}',
        blockersTitle: 'Bevor du Start drückst:',
        showPorts: 'Ports zeigen', showMotion: 'Zeigen, wie es sich bewegt',
        showPortsHelp: 'Zeigt neben jedem Motor und Sensor seinen Hub-Port (? heißt: nicht eingesteckt)',
        showMotionHelp: 'Färbt Teile, die sich zusammen bewegen, zeichnet die Drehachsen (rot: Motoren) und die Zahnradpaare',
        issueHelp: 'Klicken zeigt diese Teile',
        portLabel: '{part} an Port {port}: klicken ändert den Port', portLabelNone: '{part} steckt nicht im Hub: klicken, um einen Port zu wählen',
        portPick: 'Port für {part}', portNone: 'keiner', close: 'Schließen'
    }
};

const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''));

/**
 * An issue in a child's words.
 * @param {object} text INSIGHT_TEXT[locale]
 * @param {{code: string, parts?: string[], line?: number}} issue
 * @param {(id: string) => string} nameOf a part id → its name in this language ("the SPIKE hub")
 */
export const issueSentence = (text, issue, nameOf) => {
    const counts = new Map();
    for (const id of issue.parts || []) {
        const name = nameOf(id);
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    const names = [...counts].map(([name, count]) => count > 1 ? `${count} × ${name}` : name);
    const parts = names.length <= 1 ? (names[0] || '') : `${names.slice(0, -1).join(', ')} ${text.and} ${names[names.length - 1]}`;
    const template = text.issues[issue.code] || text.fallbackIssue;
    const sentence = fill(template, {parts, line: issue.line ?? '', design: issue.design ?? ''});
    return sentence.charAt(0).toUpperCase() + sentence.slice(1);
};

export const fillText = fill;
