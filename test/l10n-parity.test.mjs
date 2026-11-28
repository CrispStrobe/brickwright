import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { balancedAfter, scopeAfter } from './helpers/js-scope.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const overlay = resolve(here, '../overlay/scratch-gui/src');

/**
 * Extract L10N dict keys from a source file by parsing the L10N constant.
 * Returns { en: Set<string>, de: Set<string> } with flattened dot-paths for nested objects.
 */
function extractL10NKeys (src) {
    // Find the L10N object: const L10N = { en: { ... }, de: { ... } };
    const m = src.match(/const\s+L10N\s*=\s*\{([\s\S]*?)\n\};\s*\n/);
    if (!m) return null;
    const body = m[1];
    const result = {};
    for (const locale of ['en', 'de']) {
        const locRe = new RegExp(`${locale}:\\s*\\{([\\s\\S]*?)\\n    \\}`, 'g');
        const lm = locRe.exec(body);
        if (!lm) { result[locale] = new Set(); continue; }
        const keys = new Set();
        // Top-level keys: word followed by :
        for (const km of lm[1].matchAll(/^\s+(\w+)\s*:/gm)) {
            // Check if it's a nested object (h: { ... })
            const after = lm[1].slice(km.index + km[0].length);
            if (/^\s*\{/.test(after)) {
                // Nested object — extract sub-keys
                const nested = after.match(/\{([^}]*)\}/);
                if (nested) {
                    for (const sk of nested[1].matchAll(/(\w+)\s*:/g)) {
                        keys.add(`${km[1]}.${sk[1]}`);
                    }
                }
            } else {
                keys.add(km[1]);
            }
        }
        result[locale] = keys;
    }
    return result;
}

test('pseudocode-importer L10N: en and de have identical key sets', () => {
    const src = readFileSync(
        resolve(overlay, 'components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8'
    );
    const keys = extractL10NKeys(src);
    assert.ok(keys, 'L10N constant not found');
    assert.ok(keys.en.size > 0, 'en dict is empty');
    assert.ok(keys.de.size > 0, 'de dict is empty');

    const enOnly = [...keys.en].filter(k => !keys.de.has(k));
    const deOnly = [...keys.de].filter(k => !keys.en.has(k));

    if (enOnly.length) {
        assert.fail(`Keys in en but NOT in de: ${enOnly.join(', ')}`);
    }
    if (deOnly.length) {
        assert.fail(`Keys in de but NOT in en: ${deOnly.join(', ')}`);
    }
});

test('pseudocode-importer L10N: de dict has no broken umlauts', () => {
    const src = readFileSync(
        resolve(overlay, 'components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8'
    );
    // Common umlaut defects found historically
    const broken = [
        ['ausfuhren', 'ausführen'],
        ['zurückfuhren', 'zurückführen'],
        ['Blocke ', 'Blöcke '],
        ['geratespezifisch', 'gerätespezifisch']
    ];
    for (const [bad, fix] of broken) {
        assert.ok(!src.includes(bad), `Broken umlaut: "${bad}" should be "${fix}"`);
    }
});

test('microbit-sim-pane L10N: en and de have identical key sets', () => {
    const src = readFileSync(
        resolve(overlay, 'components/tw-pseudocode/microbit-sim-pane.jsx'), 'utf8'
    );
    const keys = extractL10NKeys(src);
    assert.ok(keys, 'L10N constant not found in microbit-sim-pane');
    const enOnly = [...keys.en].filter(k => !keys.de.has(k));
    const deOnly = [...keys.de].filter(k => !keys.en.has(k));
    if (enOnly.length) assert.fail(`en-only: ${enOnly.join(', ')}`);
    if (deOnly.length) assert.fail(`de-only: ${deOnly.join(', ')}`);
});

test('SUPPORTED has an asm entry (reference crash guard)', () => {
    const src = readFileSync(
        resolve(overlay, 'components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8'
    );
    assert.ok(/SUPPORTED\s*=\s*\{[\s\S]*?asm:\s*\[/.test(src),
        'SUPPORTED missing asm entry — clicking ASM Reference will crash');
});

/** Run the importer's actual reference renderer with inert surrounding services.
 * JSX is transformed normally; the element factory records its rendered children
 * so this gate checks the selected rows and safe empty state, not one spelling
 * of the null guard. The rest of the importer and its machine engines stay out.
 */
function referenceFixture (src) {
    const require = createRequire(resolve(here, '../packages/scratch-gui/package.json'));
    const babel = require('@babel/core');
    const readConstant = (name, open, close) => new Function(
        'return (' + balancedAfter(src, 'const ' + name + ' =', open, close) + ');'
    )();
    const supported = readConstant('SUPPORTED', '{', '}');
    const syntax = readConstant('SYNTAX', '[', ']');
    const method = 'renderCodeInfo (machine) ' + scopeAfter(src, 'renderCodeInfo (machine)');
    const code = babel.transformSync('class ReferenceView {' + method + '}', {
        babelrc: false, configFile: false,
        presets: [[require('@babel/preset-react'), {runtime: 'classic'}]]
    }).code;
    const React = {
        Fragment: Symbol('Fragment'),
        createElement: (type, props, ...children) => ({
            type, props: props || {},
            children: children.flat(Infinity).filter(child =>
                child !== false && child !== null && child !== undefined)
        })
    };
    const bindings = {
        React, SUPPORTED: supported, SYNTAX: syntax, Popup: 'Popup', Icon: 'Icon',
        pickLocale: locale => locale, toolStyles: () => ({button: {}}),
        representationNotice: () => '', TWO_WAY: new Set()
    };
    const ReferenceView = new Function(...Object.keys(bindings),
        code + '; return ReferenceView;')(...Object.values(bindings));
    const descendants = (node, type) => {
        if (!node || typeof node !== 'object') return [];
        return [...(node.type === type ? [node] : []),
            ...(node.children || []).flatMap(child => descendants(child, type))];
    };
    const render = (lang, standalone = null) => {
        const view = new ReferenceView();
        view.state = {lang, asmMode: 'source', codeNotices: [], showInfo: true, emptyTabOffer: null};
        view.props = {locale: 'en', isVisible: true};
        view.L = {infoAria: 'Code help', reference: 'Reference', h: {}};
        view.currentDevice = () => null;
        view.standaloneBasicProfile = () => standalone;
        view.selectedBasicProfile = () => null;
        const references = descendants(view.renderCodeInfo(null), 'details');
        return {
            count: references.length,
            rows: references.flatMap(reference => descendants(reference, 'strong').map((heading, index) => [
                heading.children.join(''),
                descendants(descendants(reference, 'ul')[index], 'code').map(item => item.children.join(''))
            ]))
        };
    };
    return {supported, syntax, render};
}

function assertReferenceBehavior (src) {
    const {supported, syntax, render} = referenceFixture(src);
    assert.ok(Array.isArray(supported.asm) && supported.asm.length,
        'ASM must retain nonempty reference rows');
    for (const [lang, rows] of Object.entries(supported)) {
        assert.deepEqual(render(lang), {count: rows.length ? 1 : 0, rows},
            'the rendered reference must use the selected ' + lang + ' rows');
    }
    assert.deepEqual(render('pseudocode'), {count: 1, rows: syntax},
        'pseudocode must use its own syntax reference');
    for (const lang of ['missing-reference-language', '', undefined, null]) {
        assert.deepEqual(render(lang), {count: 0, rows: []},
            'unknown languages must not render or map absent reference rows');
    }
    supported['empty-reference-language'] = [];
    assert.deepEqual(render('empty-reference-language'), {count: 0, rows: []},
        'an empty reference must not render an empty disclosure');
    for (const lang of ['python', 'basic', 'pseudocode', 'missing-reference-language']) {
        assert.deepEqual(render(lang, {dialect: 'piccolo'}), {count: 0, rows: []},
            'standalone dialects must not inherit an unrelated language reference');
    }
}

test('reference rendering selects supported rows and safely omits unknown, empty and standalone references', () => {
    const src = readFileSync(
        resolve(overlay, 'components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8'
    );
    assertReferenceBehavior(src);
});

test('reference behavior guard detects unsafe mapping, wrong languages and lost empty-state guards', () => {
    const src = readFileSync(
        resolve(overlay, 'components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8'
    );
    const mutations = [
        ['sections?.length > 0', 'sections.length > 0', error =>
            error instanceof TypeError && /length/.test(error.message)],
        ['SUPPORTED[lang]', 'SUPPORTED.python', error => error instanceof assert.AssertionError],
        ['standalone ? null : lang', 'false ? null : lang', error => error instanceof assert.AssertionError],
        ['sections?.length > 0', 'sections?.length >= 0', error => error instanceof assert.AssertionError]
    ];
    for (const [before, after, rejects] of mutations) {
        assert.equal(src.split(before).length, 2, 'mutation must change exactly one actual renderer expression');
        assert.throws(() => assertReferenceBehavior(src.replace(before, after)), rejects,
            'the reference guard must reject ' + after);
    }
});
