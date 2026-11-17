// No user-facing string may be hardcoded in a component we own.
//
// This is repo-wide on purpose. A per-feature check only protects the feature
// somebody remembered to write it for, and the strings that actually went
// missing were the ones nobody was looking at: tooltips and aria-labels, which
// render only on hover or to a screen reader, so no amount of clicking through
// the UI reveals them.
//
// Three mechanisms are legitimate, and lib/bw-i18n.js says which to use when:
//   - react-intl (defineMessages/formatMessage) for scratch-gui's own tree,
//   - a local table read with the store's locale, for ours,
//   - a shared table (lib/bw-fpga/l10n.js) for modules with no props.
// What is NOT legitimate is a literal.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve, dirname, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Walk the tree directly rather than asking `git ls-files`: this gate should
// not depend on a tool resolved from PATH, and it should still work in a
// checkout that is not a git repository.
const walk = dir => {
    const out = [];
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) out.push(...walk(full));
        else if (entry.name.endsWith('.jsx')) out.push(relative(root, full));
    }
    return out;
};
const files = [
    ...walk(resolve(root, 'overlay/scratch-gui/src/components')),
    ...walk(resolve(root, 'overlay/scratch-gui/src/containers'))
];

/** Read actual JSX attributes, not CSS selectors or other JavaScript strings. */
const babel = createRequire(resolve(root, 'packages/scratch-gui/package.json'))('@babel/core');
const literalAttributes = text => {
    const ast = babel.parseSync(text, {babelrc: false, configFile: false, parserOpts: {plugins: ['jsx']}});
    const found = [];
    const visit = node => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'JSXAttribute' && ['title', 'aria-label', 'placeholder'].includes(node.name?.name)) {
            const value = node.value?.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
            if (value?.type === 'StringLiteral' && /^[A-Z][\s\S]{4,}$/.test(value.value)) found.push(value.value);
        }
        for (const [key, value] of Object.entries(node)) {
            if (key === 'loc' || key === 'tokens' || key === 'comments') continue;
            if (Array.isArray(value)) value.forEach(visit);
            else if (value && typeof value === 'object') visit(value);
        }
    };
    visit(ast);
    return found;
};

/** Brand names are the same in every language and are not translated. */
const BRANDS = new Set(['Scratch', 'BrickWright', 'Arduboy']);

test('attribute inventory distinguishes rendered literals from selector text and translated expressions', () => {
    const source = `const s = '[aria-label="Stop program"]'; const obj = {title: 'Ignored object'};
      const panel = <div title="Hardcoded tooltip" aria-label="Hardcoded label" placeholder="Search here" />;
      const shadowed = <div title={'Hidden literal'} />;
      const translated = <div title={translate('Hardcoded tooltip')} aria-label={labels.title} />;`;
    assert.deepEqual(literalAttributes(source), ['Hardcoded tooltip', 'Hardcoded label', 'Search here', 'Hidden literal']);
});

test('no component hardcodes a title, aria-label or placeholder', () => {
    const offenders = [];
    for (const rel of files) {
        const text = readFileSync(resolve(root, rel), 'utf8');
        for (const value of literalAttributes(text)) {
            if (BRANDS.has(value)) continue;
            offenders.push(`${rel.replace('overlay/scratch-gui/src/', '')}: ${value.slice(0, 50)}`);
        }
    }
    assert.deepEqual(offenders, [],
        'these render to a person and cannot be translated — see lib/bw-i18n.js');
});

/**
 * THE SHAPE THE ATTRIBUTE RULE ABOVE CANNOT SEE, and the directory it does not
 * walk.
 *
 * That rule matches JSX attributes (title=, aria-label=, placeholder=) under
 * components/ and containers/. A user-facing sentence written as an OBJECT
 * FIELD — `hint: 'Swipe the reactor to slide every tile.'` — in lib/ is invisible
 * to it twice over. That is how the whole gate-builder palette stayed
 * English-only while the surface around it was bilingual: 19 labels in
 * lib/bw-fpga/palette-catalog.js, a file the walk never reached and a shape the
 * regex never matched (#305).
 *
 * PROPER NOUNS ARE NOT TRANSLATED, and the exemption is by file with a reason
 * rather than by a clever regex: device names (STC12, Arduino Uno), gate names
 * (AND, XOR — GATE_DEFS names them the way a schematic does, in every
 * language), language names (Python, BASIC), opcode mnemonics, and example
 * titles, which are content rather than UI.
 */
const PROPER_NOUN_FILES = [
    'lib/device-labels.js',              // STC12, Arduino Uno — product names
    'lib/bw-matrix/capabilities.js',     // Python, BASIC — language names
    'lib/bw-fpga/gate-builder.js',       // AND, XOR — schematic names, every language
    'lib/bw-debug/opcodes.js',           // mnemonics
    'lib/bw-debug/riscv-programs.js',    // program names, content not UI
    'lib/bw-fpga/builtins.js',           // block names, content not UI
    'lib/bw-asm/examples.js',            // example titles, content not UI
    'lib/bw-asm/examples-i8086.js',      // example titles, content not UI
    'lib/bw-fpga/examples.js',           // example titles, content not UI
    // Five route descriptors, each a language-and-compiler name: 'GW-BASIC (on
    // DOS)', 'Pascal / C / Modula-2 (ACK, via CP/M)'. Nothing renders them —
    // no component reads .label off DOS_/CPM_/HOSTED_TOOLCHAINS; they reach
    // only tests and bw-asm/assemble-route.js, which re-exports them. If a
    // route picker is ever built, delete this line: it will then be a surface.
    'lib/bw-debug/dos-toolchain-routes.js'
];

/**
 * The population that exists today, per file. A RATCHET, not a blessing: it may
 * only shrink. Each of these renders an English sentence to a reader whose
 * surface is otherwise translated; fixing one means moving its strings into a
 * locale table and lowering the number here in the same commit.
 */
const KNOWN_UNTRANSLATED = {
    // EMPTY, and it got here by shrinking: backends.js and target-kinds.js
    // moved to locale tables, scratchlink-transport.js grew one of its own
    // (its whole panel, not only the four fields this rule counts), and
    // dos-toolchain-routes.js turned out to be names nothing renders. The
    // ratchet stays for the next one; it may still only shrink.
};

/**
 * A user-facing sentence written as an object field, not a JSX attribute.
 *
 * THIS SHAPE IS NOT THE ONLY ONE. A rule built around one syntax is blind to
 * the same defect in another: status text is a POSITIONAL ARGUMENT in lowercase
 * prose (`setStatus('ready', 'compiling…')`), which neither the field name nor
 * the leading capital below will ever match. 68 such strings lived in
 * lib/bw-debug/debug-runner.js, 52 of them English, while this rule's ratchet
 * stood at zero. They have their own census and ratchet — see
 * scripts/measure-status-strings.mjs and test/runner-status-l10n.test.mjs.
 */
const FIELD = /(?:hint|label|title|placeholder|summary):\s*'([A-Z][^']{8,})'/g;

const libFiles = () => {
    const out = [];
    const walkJs = dir => {
        for (const entry of readdirSync(dir, {withFileTypes: true})) {
            const full = resolve(dir, entry.name);
            if (entry.isDirectory()) walkJs(full);
            else if (entry.name.endsWith('.js')) out.push(relative(root, full));
        }
    };
    walkJs(resolve(root, 'overlay/scratch-gui/src/lib'));
    return out;
};

test('no lib module hardcodes a user-facing sentence, beyond the known population', () => {
    const counts = {};
    // THE SKIPPED SET IS COLLECTED, not silently dropped. A curated exemption
    // that names a file which no longer exists would otherwise sit here forever
    // looking like coverage, and the whole point of this rule is that an
    // unexamined file is a fact, not an absence of one.
    const exempted = [];
    const translating = [];
    for (const rel of libFiles()) {
        const short = rel.replace('overlay/scratch-gui/src/', '');
        if (PROPER_NOUN_FILES.includes(short)) {
            exempted.push(short);
            continue;
        }
        const text = readFileSync(resolve(root, rel), 'utf8');
        // A file translates if it imports the shared helpers OR carries its own
        // locale table. THE SECOND HALF WAS MISSING and the count was wrong for
        // it: lib/native-web-bluetooth.js and lib/bw-debug/condition-editor.js
        // each hold an inline {en, de} table, so the regex was matching strings
        // INSIDE a translation and reporting them as untranslated — four of the
        // sixteen this list claimed. A population that counts the cure as the
        // disease sends someone to "fix" finished work.
        if (/bw-i18n\.js|bw-fpga\/l10n\.js/.test(text) || /^\s+de:\s*[{O]/m.test(text)) {
            translating.push(short);   // it translates; the other rules cover it
            continue;
        }
        const n = [...text.matchAll(FIELD)].length;
        if (n) counts[short] = n;
    }
    const goneExemptions = PROPER_NOUN_FILES.filter(f => !exempted.includes(f));
    assert.deepEqual(goneExemptions, [],
        'PROPER_NOUN_FILES names file(s) the walk never saw — delete them, or the exemption is '
        + 'protecting nothing: ' + goneExemptions.join(', '));
    assert.ok(translating.length > 0,
        'no lib file was found to translate at all — the helper check is broken, and every file '
        + 'is being measured as if it had no locale table');
    const grown = Object.entries(counts)
        .filter(([f, n]) => n > (KNOWN_UNTRANSLATED[f] || 0))
        .map(([f, n]) => `${f}: ${n} (known ${KNOWN_UNTRANSLATED[f] || 0})`);
    assert.deepEqual(grown, [],
        'new hardcoded user-facing sentence(s) in lib/ — put them in a locale table '
        + '(lib/bw-fpga/l10n.js or lib/bw-i18n.js), or if they are proper nouns add the file to '
        + 'PROPER_NOUN_FILES with the reason:\n  ' + grown.join('\n  '));
    // The ratchet must also not rot the other way: a file that was fixed should
    // leave the list, so a stale entry is reported rather than silently kept.
    const stale = Object.keys(KNOWN_UNTRANSLATED).filter(f => !(f in counts));
    assert.deepEqual(stale, [],
        'these are in KNOWN_UNTRANSLATED but no longer hardcode anything — delete them from the list: '
        + stale.join(', '));
});

test('THE RULE CAN FAIL: the palette shape and the lib directory are both covered', () => {
    // The two halves of the blind spot, asserted on synthetic text so this
    // cannot pass by accident when the real tree happens to be clean.
    const sample = "sections.push({id: 'mem', label: 'Memory bank for the canvas'});";
    assert.equal([...sample.matchAll(FIELD)].length, 1, 'an object-field sentence must match');
    assert.ok(libFiles().some(f => f.includes('lib/bw-fpga/')),
        'the lib walk must actually reach lib/bw-fpga — an empty walk would make this vacuous');
    assert.ok(libFiles().length > 20, `the lib walk found only ${libFiles().length} files`);
});

test('the audit actually walks the tree', () => {
    // A guard that scanned nothing would pass. The count is a floor, not a
    // fixture: it only has to prove the walk happened.
    assert.ok(files.length > 50, `expected to scan the component tree, saw ${files.length} files`);
    assert.ok(files.some(f => f.includes('stage-header')), 'including scratch-gui components');
    assert.ok(files.some(f => f.includes('tw-pseudocode')), 'and our own');
});

test('the shared machinery documents which mechanism to use', () => {
    // Three patterns in one codebase is how strings go missing. The rule has to
    // live somewhere a person will find it, next to the thing it describes.
    const doc = readFileSync(resolve(root, 'overlay/scratch-gui/src/lib/bw-i18n.js'), 'utf8');
    assert.match(doc, /react-intl/, 'it names the upstream mechanism');
    assert.match(doc, /do NOT move those/i, 'and warns against absorbing scratch-gui strings');
    assert.match(doc, /state\.locales\.locale/, 'it names where the locale comes from');
    assert.match(doc, /lib\/bw-fpga\/l10n\.js/, 'and points at the shared-table example');
});

test('nobody reimplements locale-picking or interpolation any more', () => {
    // Every component used to carry its own pickLocale and its own template
    // literals, which is exactly how they drifted apart.
    const copies = [];
    for (const rel of files) {
        const text = readFileSync(resolve(root, rel), 'utf8');
        if (/const pickLocale = /.test(text) && !/from '.*bw-i18n\.js'/.test(text)) {
            copies.push(rel.replace('overlay/scratch-gui/src/', ''));
        }
    }
    // Existing copies are grandfathered; the count must not GROW.
    assert.ok(copies.length <= 8,
        `${copies.length} components still define their own pickLocale: ${copies.join(', ')}`);
});

test('no component reads a locale identifier it does not have', () => {
    // Twice now, an i18n edit reached for a locale that was not in scope:
    //   props.locale inside `({onUseVerilog, seed, locale}) => …`  (props undefined)
    //   at(locale, …) inside `({vm}) => …`                        (locale undefined)
    // Both are ReferenceErrors at RENDER, which unmount the React tree — the
    // app comes up blank, and the flag-off build never compiles the file, so
    // nothing else says a word. The first version of this guard covered three
    // files by name; the second bug landed in a file it did not list. It now
    // walks everything.
    const offenders = [];
    for (const rel of files) {
        const text = readFileSync(resolve(root, rel), 'utf8');
        // Only files that actually translate. Scope-tracking by regex is crude
        // (a `constructor(props)` or a multi-line parameter list fools it), and
        // a guard that cries wolf on untouched files gets switched off. Both
        // real bugs were in files that import these helpers, which is the
        // population this needs to cover.
        if (!/bw-i18n\.js|bw-fpga\/l10n\.js/.test(text)) continue;
        const lines = text.split('\n');
        const moduleHasLocale = /^(?:const|let|var|function)\s+locale\b/m.test(text);
        let params = null;          // parameter text of the innermost component
        lines.forEach((line, i) => {
            const decl = /^(?:export\s+)?(?:const|function)\s+[A-Z][A-Za-z0-9_]*\s*=?\s*(?:function\s*)?\(([^)]*)\)/.exec(line);
            if (decl) params = decl[1];
            if (params === null || /^\s*[*/]/.test(line)) return;
            const hasPropsParam = /\bprops\b/.test(params);
            const hasLocaleParam = /\blocale\b/.test(params);
            // `this.props.x` is a class component reading its own props and is
            // fine; only a BARE `props.x` needs a parameter called props.
            if (/(?<!this\.)\bprops\.\w/.test(line) && !hasPropsParam) {
                offenders.push(`${rel}:${i + 1} reads props.x with no props param`);
            }
            // A bare `locale` argument, where nothing defines one.
            if (/\b(?:at|t|tr|pt)\(\s*locale\s*,/.test(line) && !hasLocaleParam && !moduleHasLocale) {
                offenders.push(`${rel}:${i + 1} reads a bare locale that is not in scope`);
            }
        });
    }
    assert.deepEqual(offenders, [], 'these throw at render and blank the app');
});
