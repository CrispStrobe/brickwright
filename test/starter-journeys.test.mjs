import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const readJson = async path => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));

test('starter journeys point at complete shipped examples', async () => {
    const journeys = await readJson('../overlay/scratch-gui/src/components/gui/starter-journeys.json');
    const index = await readJson('../overlay/scratch-gui/examples/index.json');
    const list = Array.isArray(index) ? index : index.examples;
    const examples = new Map(list.map(example => [example.id, example]));

    assert.deepEqual(journeys.map(journey => journey.id),
        ['circuit', 'board', 'game', 'lego', 'technic', 'cad-robot']);
    const exampleJourneys = journeys.filter(journey => !journey.action);
    assert.equal(new Set(exampleJourneys.map(journey => journey.exampleId)).size, exampleJourneys.length);

    for (const journey of exampleJourneys) {
        const example = examples.get(journey.exampleId);
        assert.ok(example, `${journey.id} example ${journey.exampleId} is in the shipped index`);
        assert.ok(journey.copy.en?.title && journey.copy.de?.title,
            `${journey.id} has English and German copy`);
        assert.ok([3, 4].includes(journey.editorTab), `${journey.id} opens a supported editor tab`);
        if (journey.mode === 'circuit-only') {
            assert.ok(example.files?.circuit, `${journey.id} ships a circuit`);
        } else if (journey.mode === 'program-and-circuit') {
            assert.ok(example.files?.program && example.files?.circuit,
                `${journey.id} ships a program and circuit`);
        } else if (journey.mode === 'program-only') {
            assert.ok(example.files?.program, `${journey.id} ships a program`);
        } else {
            assert.fail(`${journey.id} has unknown mode ${journey.mode}`);
        }
    }
});

test('surface journeys open the Robot Lab or a complete CAD robot project', async () => {
    const journeys = await readJson('../overlay/scratch-gui/src/components/gui/starter-journeys.json');
    const actions = journeys.filter(journey => journey.action);
    assert.deepEqual(actions.map(journey => journey.action), ['robot-lab', 'cad-robot']);
    for (const journey of actions) {
        assert.ok(journey.copy.en?.title && journey.copy.de?.title, `${journey.id} has English and German copy`);
        assert.equal(journey.exampleId, undefined, `${journey.id} does not load an example`);
    }
    const cad = actions.find(journey => journey.action === 'cad-robot');
    assert.equal(cad.requires, 'cad', 'the CAD card is hidden in builds without the CAD editor');
    const catalog = await readFile(new URL('../overlay/scratch-gui/src/lib/bw-cad-robot-catalog.js', import.meta.url), 'utf8');
    assert.match(catalog, new RegExp(`id:'${cad.projectId}'`), 'the CAD card opens a shipped robot project');
    const gui = await readFile(new URL('../overlay/scratch-gui/src/components/gui/gui.jsx', import.meta.url), 'utf8');
    for (const action of ['robot-lab', 'cad-robot']) {
        assert.ok(gui.includes(`journey.action === '${action}'`), `gui.jsx handles ${action}`);
    }
});

test('LEGO marks carry their symbols and the dialog states non-endorsement', async () => {
    const journeys = await readJson('../overlay/scratch-gui/src/components/gui/starter-journeys.json');
    for (const journey of journeys) {
        for (const [lang, copy] of Object.entries(journey.copy)) {
            const text = `${copy.title} ${copy.description} ${copy.meta}`;
            assert.doesNotMatch(text, /LEGO(?!®)/, `${journey.id}/${lang}: LEGO is written LEGO®`);
            assert.doesNotMatch(text, /SPIKE(?!™)/, `${journey.id}/${lang}: SPIKE is written SPIKE™`);
            assert.doesNotMatch(text, /Technic(?!™)/, `${journey.id}/${lang}: Technic is written Technic™`);
        }
    }
    const dialog = await readFile(new URL('../overlay/scratch-gui/src/components/gui/starter-journeys.jsx', import.meta.url), 'utf8');
    assert.match(dialog, /trademarks of the LEGO Group, which does not ' \+\s*'sponsor, authorize or endorse/);
    assert.match(dialog, /Marken der LEGO Gruppe/);
});
