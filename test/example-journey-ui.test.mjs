import {packageSourceFile} from './helpers/package-source.mjs';
// The example journey: browse, pick a device, see which example you are in.
//
// Three owner-reported defects (Lane U in docs/LANGUAGE-DEVICE-MATRIX-PLAN.md),
// and each one is about a fact reaching the place it is needed.
//
//   U1-1  Picking a device AFTER loading an example left the authored board
//         under a retargeted program. The Code tab already resolves the matching
//         bench and refuses a device the example has no circuit for — but only
//         `if (this._lastCatalogExample)`, which only the importer's own
//         catalogue path ever set. The Examples browser's path left it null, so
//         the check was skipped entirely.
//   U1-2  The catalogue narrowed and annotated by the CURRENTLY selected device,
//         which is chosen after the example. The importer's copy did not merely
//         annotate — it FILTERED, which also made its own "Needs:" label
//         unreachable and its sort comment describe an impossible ordering.
//   U1-3  Loading an example overwrites the PROJECT NAME, and nothing said which
//         example that name came from.
//
// ASSERTED ON SOURCE, because this repo's tests read .jsx as text — no test
// imports a component. So these are structural claims, and the browser gate
// (scripts/verify-example-journey.mjs) is where the behaviour is proved. Said
// plainly rather than implied: this file cannot tell you the UI works.
//
// COMMENTS ARE STRIPPED FIRST. Every forbidden token below now appears in a
// comment explaining why it is forbidden — the fix for U1-2 is documented in the
// file it changed. A rule matching the plain text of what it forbids goes red on
// its own explanation, which this repo has hit three times in two days.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve, dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gui = join(repo, 'overlay/scratch-gui/src');
const read = p => readFileSync(p.startsWith('bw-circuit-ui/') ? packageSourceFile(p) : join(gui, p), 'utf8');
const code = text => text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

/** Code with comments AND string literals removed — 'STC12' is a value, not a name. */
const bare = text => code(text)
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');

test('the comment stripper strips, and only comments', () => {
    // Pinned both ways: a stripper that returns the text unchanged puts every
    // assertion below back on comments, and one that strips too much makes them
    // pass on absent code.
    assert.equal(code('a(); // deviceCompat here\nb();').includes('deviceCompat'), false);
    assert.equal(code('/* catalogNeeds */ keep();').includes('catalogNeeds'), false);
    assert.equal(code("const u = 'https://x/y'; // c").includes('https://x/y'), true);
    assert.equal(code('const a = 1;').includes('const a = 1'), true);
});

test('Circuit examples stay general, while Code matches the selected target', () => {
    const browser = code(read('bw-circuit-ui/components/ExamplesBrowser.jsx'));
    assert.ok(browser.length > 2000, 'the catalogue source did not load');
    assert.doesNotMatch(browser, /deviceCompat\s*\(|deviceCompatReason/);

    const importer = code(read('components/tw-pseudocode/pseudocode-importer.jsx'));
    assert.match(importer, /devices\.some\(target => this\._normDevice\(target\) === selected\)/);
    assert.match(importer, /this\.loadCatalogExample\(ex, device\)/);
    assert.match(importer, /Open full examples library/);
    assert.doesNotMatch(importer, /data-testid="bw-catalog-device"/);
});

test('U1-1: the active example reaches the Code tab from BOTH load paths', () => {
    const circuitTab = code(read('components/tw-pseudocode/circuit-tab.jsx'));
    assert.match(circuitTab, /new CustomEvent\('bw-example-loaded'/,
        'circuit-tab no longer publishes which example was loaded, so a device picked afterwards '
        + 'skips the bench check and leaves the authored board under a retargeted program');
    assert.match(circuitTab, /window\.__bwActiveExample\s*=/,
        'the last-loaded example is not stashed, so a consumer mounting later starts blind');

    const importer = code(read('components/tw-pseudocode/pseudocode-importer.jsx'));
    assert.match(importer, /addEventListener\('bw-example-loaded'/,
        'the importer does not listen, so the Examples browser path still leaves it blind');
    assert.match(importer, /removeEventListener\('bw-example-loaded'/,
        'the listener is never removed; a remounted importer would accumulate handlers');
    assert.match(importer, /_lastCatalogExample = detail/,
        'the event is heard but not recorded, so setDevice still sees null');
    // The check it feeds must still be there — this fix is worthless if the
    // refusal it enables was removed.
    assert.match(importer, /resolveExampleBench\(ex, deviceId, sourceDevice\)/,
        'setDevice no longer resolves the bench, so nothing refuses a device the example has no '
        + 'circuit for — which is the behaviour this whole lane exists to reach');
});

test('U1-3: one intro renderer, imported by both readers', () => {
    const shared = code(read('bw-circuit-ui/intro-doc.jsx'));
    for (const sym of ['parseIntro', 'renderMarkdown', 'INTRO_L10N']) {
        assert.ok(new RegExp(`export (const|function) ${sym}\\b`).test(shared),
            `intro-doc does not export ${sym}`);
    }
    const browser = code(read('bw-circuit-ui/components/ExamplesBrowser.jsx'));
    const button = code(read('components/menu-bar/example-intro-button.jsx'));
    for (const [name, src] of [['ExamplesBrowser', browser], ['example-intro-button', button]]) {
        assert.match(src, /from '(?:\.\.?\/|bw-circuit-ui\/)intro-doc\.jsx'/,
            `${name} does not import the shared intro module`);
        assert.ok(!/function (parseIntro|renderMarkdown)\b/.test(src),
            `${name} defines its own ${'parseIntro/renderMarkdown'} again. Two renderers for one `
            + 'markdown file is two things to keep in agreement, which is the defect shape this '
            + 'repo has spent the week cataloguing.');
    }
});

test('U1-3: the (i) is mounted beside the title field and is absent without an example', () => {
    const menu = code(read('components/menu-bar/menu-bar.jsx'));
    assert.match(menu, /<ExampleIntroButton/, 'the button is not mounted in the menu bar');
    // Beside the title field specifically — the name shown there IS the
    // example's, which is the whole reason the affordance belongs at that spot.
    const near = menu.slice(menu.indexOf('<ProjectTitleInput'), menu.indexOf('<ProjectTitleInput') + 700);
    assert.match(near, /<ExampleIntroButton/,
        'the button is mounted somewhere else; it must sit with the project name it explains');

    const button = code(read('components/menu-bar/example-intro-button.jsx'));
    assert.match(button, /if \(!example\) return null;/,
        'the button renders even with no example loaded. An affordance that is usually inert '
        + 'teaches people to ignore it; absence is the honest state for a project that is not '
        + 'an example.');
    assert.match(button, /data-testid="bw-example-intro"/, 'no stable handle for the browser gate');
    assert.match(button, /examples\/\$\{example\.id\}\/intro/,
        'the intro path no longer keys on the example id, which is the directory convention the '
        + 'catalogue uses');
});

test('nothing an edited file uses went missing when code moved between files', () => {
    // THE ASSERTION THAT WOULD HAVE SAVED A CI RUN, added after it did not exist.
    //
    // Extracting the intro renderer took CATEGORY_COLORS and DIFFICULTY_LABELS
    // with it — catalogue concerns that happened to sit inside the line span I
    // moved. ExamplesBrowser kept using them, so it referenced two undefined
    // identifiers. Webpack COMPILED IT ANYWAY (a bare identifier is only a
    // ReferenceError at run time), so the build was green and the browser gates
    // failed in a heap with no obvious cause.
    //
    // An extraction by SPAN cannot know what it took; only a check of what the
    // file still needs can. This walks every SCREAMING_CASE constant a file
    // mentions and requires it to be defined or imported there.
    const files = [
        'bw-circuit-ui/components/ExamplesBrowser.jsx',
        'bw-circuit-ui/intro-doc.jsx',
        'components/menu-bar/example-intro-button.jsx'
    ];
    const missing = [];
    for (const rel of files) {
        const src = bare(read(rel));
        const used = new Set(src.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) || []);
        // Import names collected ONCE, linearly. A per-name regex across the
        // whole file backtracks catastrophically on a 700-line component — the
        // first version of this check hung the suite rather than failing it,
        // which is its own small lesson about gates.
        const imported = new Set(
            // `[^'"]*` and not `+`: string literals are blanked to '' before this
            // runs, so a module path is empty by the time the matcher sees it.
            // Requiring one character made every import invisible and reported
            // four correctly-imported names as missing.
            (src.match(/^import\s+[\s\S]*?from\s+['"][^'"]*['"]/gm) || [])
                .flatMap(line => line.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) || []));
        for (const name of used) {
            const defined = new RegExp(`(export )?(const|let|function|class)\\s+${name}\\b`).test(src);
            // Globals and DOM/JS builtins are not this file's to define.
            const builtin = /^(NaN|Infinity|JSON|Math|Object|Array|String|Number|Boolean|Promise|Map|Set|RegExp|Error|URL|URLSearchParams|Intl|Symbol|Reflect|Proxy|WeakMap|WeakSet|Date|BigInt|TRUE|FALSE|NULL)$/.test(name);
            if (!defined && !imported.has(name) && !builtin) missing.push(`${rel}: ${name}`);
        }
    }
    assert.deepEqual(missing, [],
        'these files reference constants they neither define nor import — webpack compiles that '
        + 'and the browser throws ReferenceError at render:\n  ' + missing.join('\n  '));
});
