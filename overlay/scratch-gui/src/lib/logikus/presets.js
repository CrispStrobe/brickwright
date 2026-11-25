import {CONTACT_BANKS, contactEndpoint, createEmptyProgram, validateProgram} from './model.js';

/**
 * Each product term gets its own contacts. Reusing a partly wired contact in
 * another output can create a reverse feed, so even logically repeated terms
 * use independent banks. Only Q and the intended lamp junctions are shared.
 * These are new educational circuits inspired by Logikus, not copied scans.
 */
function fromTerms (title, outputs, {switchLabels = [], lampLabels = [], test = false} = {}) {
    const program = createEmptyProgram();
    program.title = title;
    switchLabels.forEach((label, i) => { program.switchLabels[i] = label; });
    lampLabels.forEach((label, i) => { program.lampLabels[i] = label; });
    const used = Array.from({length: 10}, () => [0, 0]);
    let nextId = 1;
    const wire = (from, to) => program.wires.push({id: `w${String(nextId++).padStart(3, '0')}`, from, to});
    if (test) wire('Q', 'Ta');
    outputs.forEach((terms, lamp) => {
        terms.forEach(term => {
            let previous = test ? 'Tb' : 'Q';
            for (const [index, state] of term) {
                const bank = used[index][state]++;
                if (bank >= CONTACT_BANKS.length) throw new Error(`Preset exceeds S${index} contact capacity.`);
                const row = CONTACT_BANKS[bank][state ? 0 : 1];
                wire(previous, contactEndpoint(index, row, 'a'));
                previous = contactEndpoint(index, row, 'b');
            }
            wire(previous, `L${lamp}`);
        });
    });
    return validateProgram(program);
}

const presets = [
    {
        id: 'lamp', usedSwitches: [0],
        copy: {
            en: {title: 'A switch and a lamp', summary: 'Make a complete path from Q through S0 to L0.',
                challenge: 'Predict the lamp before moving S0. Unplug one wire: does the switch still work?',
                hint: 'At 1, S0 connects Aa to Ab. The lamp needs a complete path back to Q.'},
            de: {title: 'Ein Schalter und eine Lampe', summary: 'Verbinde Q über S0 mit L0.',
                challenge: 'Sage den Lampenzustand voraus, bevor du S0 umlegst. Entferne einen Draht: Funktioniert der Schalter noch?',
                hint: 'Bei 1 verbindet S0 die Kontakte Aa und Ab. Die Lampe braucht einen durchgehenden Weg zu Q.'}
        },
        program: fromTerms('A switch and a lamp', [[[[0, 1]]]], {lampLabels: ['Lamp']})
    },
    {
        id: 'and', usedSwitches: [0, 1],
        copy: {
            en: {title: 'AND: two keys to launch', summary: 'Two contacts in series make both switches necessary.',
                challenge: 'Try all four input settings. Which single setting completes the path?',
                hint: 'Both S0 AND S1 must close. One open contact breaks the entire route.'},
            de: {title: 'UND: zwei Schlüssel zum Start', summary: 'Zwei Kontakte in Reihe machen beide Schalter nötig.',
                challenge: 'Probiere alle vier Eingaben. Welche einzige Kombination schließt den Stromkreis?',
                hint: 'S0 UND S1 müssen schließen. Ein offener Kontakt unterbricht den ganzen Weg.'}
        },
        program: fromTerms('AND: two keys to launch', [[[[0, 1], [1, 1]]]],
            {switchLabels: ['Key A', 'Key B'], lampLabels: ['Launch']})
    },
    {
        id: 'or', usedSwitches: [0, 1],
        copy: {
            en: {title: 'OR: two ways to ring', summary: 'Parallel branches let either switch light the lamp.',
                challenge: 'Will the lamp stay on if both switches are 1? Open one branch and test again.',
                hint: 'OR includes both. One complete branch is enough; two complete branches also work.'},
            de: {title: 'ODER: zwei Wege zur Klingel', summary: 'Bei parallelen Zweigen kann jeder Schalter die Lampe einschalten.',
                challenge: 'Leuchtet die Lampe auch bei zweimal 1? Öffne einen Zweig und teste erneut.',
                hint: 'ODER schließt beide ein. Ein geschlossener Zweig genügt; zwei funktionieren ebenfalls.'}
        },
        program: fromTerms('OR: two ways to ring', [[[[0, 1]], [[1, 1]]]],
            {switchLabels: ['Front door', 'Side door'], lampLabels: ['Bell']})
    },
    {
        id: 'not', usedSwitches: [0],
        copy: {
            en: {title: 'NOT: the opposite contact', summary: 'The lower contact closes when its switch is 0.',
                challenge: 'Move both leads from row B to row A. How does the truth table change?',
                hint: 'NOT needs the opposite mechanical contact, not a separate electronic inverter.'},
            de: {title: 'NICHT: der Gegenkontakt', summary: 'Der untere Kontakt schließt bei Schalterstellung 0.',
                challenge: 'Stecke beide Drähte von Reihe B nach A um. Wie ändert sich die Wahrheitstabelle?',
                hint: 'NICHT nutzt den entgegengesetzten mechanischen Kontakt, keinen zusätzlichen elektronischen Inverter.'}
        },
        program: fromTerms('NOT: the opposite contact', [[[[0, 0]]]],
            {switchLabels: ['Door closed'], lampLabels: ['Door open']})
    },
    {
        id: 'xor', usedSwitches: [0, 1],
        copy: {
            en: {title: 'XOR: exactly one', summary: 'Two alternative paths detect different switch settings.',
                challenge: 'Find the difference between this circuit and OR when both inputs are 1.',
                hint: 'One path is S0 AND NOT S1; the other is NOT S0 AND S1.'},
            de: {title: 'XOR: genau einer', summary: 'Zwei alternative Wege erkennen unterschiedliche Schalterstellungen.',
                challenge: 'Was unterscheidet diese Schaltung von ODER, wenn beide Eingaben 1 sind?',
                hint: 'Ein Weg ist S0 UND NICHT S1; der andere ist NICHT S0 UND S1.'}
        },
        program: fromTerms('XOR: exactly one', [[[[0, 1], [1, 0]], [[0, 0], [1, 1]]]],
            {switchLabels: ['A', 'B'], lampLabels: ['Different']})
    },
    {
        id: 'half-adder', usedSwitches: [0, 1],
        copy: {
            en: {title: 'Half adder: 1 + 1 = 10', summary: 'Combine XOR and AND to add two binary digits.',
                challenge: 'Read the answer as carry then sum. Why does 1 + 1 light carry but not sum?',
                hint: 'L0 is the sum bit; L1 is the carry bit. Read L1 L0: 00, 01 or 10.'},
            de: {title: 'Halbaddierer: 1 + 1 = 10', summary: 'Kombiniere XOR und UND, um zwei Binärziffern zu addieren.',
                challenge: 'Lies das Ergebnis als Übertrag und dann Summe. Warum leuchtet bei 1 + 1 nur der Übertrag?',
                hint: 'L0 ist das Summenbit, L1 der Übertrag. Lies L1 L0: 00, 01 oder 10.'}
        },
        program: fromTerms('Half adder: 1 + 1 = 10', [
            [[[0, 1], [1, 0]], [[0, 0], [1, 1]]], [[[0, 1], [1, 1]]]
        ], {switchLabels: ['A', 'B'], lampLabels: ['Sum (1)', 'Carry (2)']})
    },
    {
        id: 'majority', usedSwitches: [0, 1, 2],
        copy: {
            en: {title: 'Majority vote', summary: 'The motion passes when at least two of three voters say yes.',
                challenge: 'Predict all eight cases. Does a unanimous yes still count as a majority?',
                hint: 'Wire AB OR AC OR BC. The three yes case completes more than one branch.'},
            de: {title: 'Mehrheitsentscheid', summary: 'Der Antrag gilt, wenn mindestens zwei von drei Stimmen Ja sagen.',
                challenge: 'Sage alle acht Fälle voraus. Zählt ein einstimmiges Ja ebenfalls als Mehrheit?',
                hint: 'Verdrahte AB ODER AC ODER BC. Bei dreimal Ja schließen mehrere Zweige.'}
        },
        program: fromTerms('Majority vote', [[[[0, 1], [1, 1]], [[0, 1], [2, 1]], [[1, 1], [2, 1]]]],
            {switchLabels: ['Voter A', 'Voter B', 'Voter C'], lampLabels: ['Motion passes']})
    },
    {
        id: 'river', usedSwitches: [0, 1, 2, 3],
        copy: {
            en: {title: 'Wolf, goat and cabbage', summary: 'Use 0 for the left bank and 1 for the right. Lamps detect an unsupervised pair.',
                challenge: 'Cross safely with the farmer and at most one passenger. The circuit checks danger, not boat rules.',
                hint: 'Danger means wolf with goat OR goat with cabbage, on the bank without the farmer.'},
            de: {title: 'Wolf, Ziege und Kohl', summary: '0 bedeutet linkes, 1 rechtes Ufer. Lampen erkennen unbeaufsichtigte Paare.',
                challenge: 'Setze den Bauern mit höchstens einem Begleiter sicher über. Die Schaltung prüft Gefahr, nicht die Bootsregeln.',
                hint: 'Gefahr bedeutet Wolf mit Ziege ODER Ziege mit Kohl am Ufer ohne Bauern.'}
        },
        program: fromTerms('Wolf, goat and cabbage', [
            [[[0, 1], [1, 0], [2, 0]], [[0, 1], [2, 0], [3, 0]]],
            [[[0, 0], [1, 1], [2, 1]], [[0, 0], [2, 1], [3, 1]]]
        ], {switchLabels: ['Farmer', 'Wolf', 'Goat', 'Cabbage'], lampLabels: ['Danger left', 'Danger right']})
    },
    {
        id: 'railway', usedSwitches: [0, 1, 2, 3, 4],
        copy: {
            en: {title: 'Railway crossing interlock', summary: 'Two routes share one crossing. A green signal needs a request, a clear crossing and a clear exit.',
                challenge: 'Request both routes: both must stop. Bypass a crossing contact, then find an unsafe state. Is a circuit that always stops useful?',
                hint: 'A = S0 AND NOT S1 AND NOT S2 AND NOT S3. B = S1 AND NOT S0 AND NOT S2 AND NOT S4. The circuit checks the current state; it does not reserve routes.'},
            de: {title: 'Verriegelung einer Gleiskreuzung', summary: 'Zwei Fahrwege teilen eine Kreuzung. Grün braucht eine Anforderung, eine freie Kreuzung und eine freie Ausfahrt.',
                challenge: 'Fordere beide Fahrwege an: Beide müssen halten. Überbrücke einen Kreuzungskontakt und finde einen unsicheren Zustand. Ist ständiges Halt sinnvoll?',
                hint: 'A = S0 UND NICHT S1 UND NICHT S2 UND NICHT S3. B = S1 UND NICHT S0 UND NICHT S2 UND NICHT S4. Die Schaltung prüft den aktuellen Zustand; sie reserviert keine Fahrwege.'}
        },
        program: fromTerms('Railway crossing interlock', [
            [[[0, 1], [1, 0], [2, 0], [3, 0]]],
            [[[1, 1], [0, 0], [2, 0], [4, 0]]]
        ], {switchLabels: ['Request A', 'Request B', 'Crossing occupied', 'Exit A occupied', 'Exit B occupied'],
            lampLabels: ['A may proceed', 'B may proceed']})
    },
    {
        id: 'code-lock', usedSwitches: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], usesButton: true,
        copy: {
            en: {title: 'The ten-bit code lock', summary: 'Set 1011101101 from S0 to S9, then hold Test to check the code.',
                challenge: 'Change one bit. Does the lock still open? Ten independent binary switches allow 1024 combinations.',
                hint: 'All ten conditions are in series with Test. To choose a new code, change the upper/lower contact for that bit.'},
            de: {title: 'Das Zehn-Bit-Zahlenschloss', summary: 'Stelle S0 bis S9 auf 1011101101 und halte Test gedrückt.',
                challenge: 'Ändere ein Bit. Öffnet das Schloss noch? Zehn unabhängige Binärschalter erlauben 1024 Kombinationen.',
                hint: 'Alle zehn Bedingungen liegen in Reihe mit Test. Für einen neuen Code wähle je Bit den oberen oder unteren Kontakt.'}
        },
        program: fromTerms('The ten-bit code lock', [[Array.from('1011101101', (bit, i) => [i, Number(bit)])]],
            {lampLabels: ['Unlocked'], test: true})
    }
];

const freeze = value => {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
};
export const LOGIKUS_PRESETS = freeze(presets);

/** Editing one returned design must never mutate the catalog or another copy. */
export function getPreset (id) {
    const preset = LOGIKUS_PRESETS.find(item => item.id === id);
    if (!preset) throw new Error(`Unknown Logikus preset: ${id}.`);
    return JSON.parse(JSON.stringify(preset));
}
