/**
 * Blocks ⇄ fe and blocks ⇄ Tcl for the Code tab (bw-lang/fe.js, bw-lang/tcl.js).
 *
 * Three claims, each checked without running an interpreter (the bench test,
 * code-tab-fe-tcl-bench.test.mjs, runs the shipped fe.exe and jim.exe):
 *
 *   1. FIXED POINT. pseudocode → project → text A → reader → pseudocode' →
 *      project' → text B, and A === B byte for byte. Resemblance is not the
 *      bar: the generator numbers its loop counters deterministically, so
 *      identical text means the reader recovered the same blocks.
 *   2. REFUSAL BY NAME. What an interpreter cannot run as Scratch would is
 *      refused with the reason (fe joining text, a second WHEN
 *      script, a block with no console meaning), never emitted half-right.
 *      Tcl the blocks cannot say is not refused: it is kept, exactly as
 *      written, in a grey `raw` block that the generator writes back.
 *   3. THE TAB IS WIRED. The importer treats both as two-way languages in
 *      every place a language has to be registered — asserted on the source,
 *      as nqc-code-tab.test.mjs does, since the component cannot be mounted here.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync} from 'node:fs';

import {SOURCE, REPO} from './helpers/bw-integrated.mjs';
import {DOS_LANG_CORPUS} from './helpers/dos-lang-corpus.mjs';
import {codeDocumentEditorClass, codeDocumentLabels, codeEditorMethod} from './helpers/code-document-editor.mjs';
import {scopeAfter} from './helpers/js-scope.mjs';
import tclToPseudocode, {generateTcl} from '../overlay/scratch-gui/src/lib/bw-lang/tcl.js';
import feToPseudocode, {generateFe} from '../overlay/scratch-gui/src/lib/bw-lang/fe.js';

const SB3Creator = (await import(path.join(SOURCE, 'src/lib/sb3-creator.js'))).default;

const project = src => {
    const c = new SB3Creator();
    c.parse(src);
    return c.project;
};
const LANGS = {
    tcl: {generate: p => generateTcl(p), read: tclToPseudocode, key: 'tcl'},
    fe: {generate: p => generateFe(p), read: feToPseudocode, key: 'fe'}
};

for (const [name, prog] of Object.entries(DOS_LANG_CORPUS)) {
    for (const [lang, L] of Object.entries(LANGS)) {
        if (prog.out[lang]) {
            test(`${lang}: "${name}" round-trips to the same ${lang} text`, () => {
                const a = L.generate(project(prog.src));
                assert.equal(a.ok, true, a.reasons.join('; '));
                const back = L.read(a[L.key]);
                assert.deepEqual(back.warnings, [], `the reader degraded:\n${back.pseudocode}`);
                // The reader's pseudocode is real pseudocode: it parses without
                // a single unread line (parse() throws on one).
                const b = L.generate(project(back.pseudocode));
                assert.equal(b.ok, true, b.reasons.join('; '));
                assert.equal(b[L.key], a[L.key]);
            });
        } else {
            test(`${lang}: "${name}" is refused by name`, () => {
                const r = L.generate(project(prog.src));
                assert.equal(r.ok, false);
                assert.equal(r[L.key], '');
                assert.ok(r.reasons.some(x => x.includes(prog.refuse[lang])),
                    `expected a reason naming "${prog.refuse[lang]}", got ${JSON.stringify(r.reasons)}`);
            });
        }
    }
}

// ---- the generated text, as text ------------------------------------

test('tcl: plain Tcl 8 — variables fenced ahead of the program, no helper procs', () => {
    const plain = generateTcl(project('GLOBAL n\nWHEN flag clicked:\n  set n to 1\n  say n\n'));
    assert.equal(plain.tcl, [
        '# --- variables ---', 'set n 0',
        '# --- program ---', 'set n 1', 'puts $n', ''
    ].join('\n'));
    const full = generateTcl(project(DOS_LANG_CORPUS.branches.src)).tcl;
    assert.match(full, /^if \{\(\$a > 3\) && \(!\(\$b == 4\)\)\} \{$/m);
    assert.match(full, /^\} else \{$/m);
    assert.doesNotMatch(full, /^proc /m, 'no scaffolding procs');
});

test('tcl: repeat n is a for loop; a computed limit is evaluated once', () => {
    const t = generateTcl(project('GLOBAL n\nWHEN flag clicked:\n  REPEAT 3:\n    say 1\n  REPEAT n + 1:\n    say 2\n')).tcl;
    assert.match(t, /^for \{set _r1 0\} \{\$_r1 < 3\} \{incr _r1\} \{\n {4}puts 1\n\}$/m);
    assert.match(t, /^set _n2 \[expr \{\$n \+ 1\}\]\nfor \{set _r2 0\} \{\$_r2 < \$_n2\} \{incr _r2\} \{$/m);
});

test('tcl: text is quoted with every special character escaped; a join is one quoted word', () => {
    const t = generateTcl(project('GLOBAL n\nWHEN flag clicked:\n  say "cost $5 [x] {y}"\n  say ("n is " join n)\n')).tcl;
    // braces too: an unescaped { inside a proc or loop body unbalances it
    assert.match(t, /^puts "cost \\\$5 \\\[x\\\] \\\{y\\\}"$/m);
    assert.match(t, /^puts "n is \$\{n\}"$/m);
});

test('tcl: Scratch numbers stay what they are; integer division is the one warned difference', () => {
    const r = generateTcl(project('GLOBAL n\nWHEN flag clicked:\n  set n to 2.5\n  set n to 40000\n  say n / 2\n' +
        '  say (pick random 1 to 6)\n  wait 0.5 secs\n  say (round n)\n'));
    assert.equal(r.ok, true);
    assert.match(r.tcl, /^set n 2\.5\nset n 40000\nputs \[expr \{\$n \/ 2\}\]$/m);
    assert.match(r.tcl, /^puts \[expr \{int\(rand\(\) \* \(6 - 1 \+ 1\)\) \+ 1\}\]\nafter 500\nputs \[expr \{round\(\$n\)\}\]$/m);
    assert.deepEqual(r.warnings, ['Tcl divides two integers as integers (7 / 2 is 3); Scratch gives 3.5']);
});

test('fe: comparisons are written with <, is and not; if/else as two do bodies', () => {
    const f = generateFe(project(DOS_LANG_CORPUS.branches.src)).fe;
    assert.match(f, /^\(if \(and \(< 3 a\) \(not \(is b 4\)\)\)$/m);
    assert.match(f, /^ {2}\(do\n {4}\(print "yes"\)\)\n {2}\(do\n {4}\(print "no"\)\)\)$/m);
    assert.doesNotMatch(f, /^\(= mod/m, 'mod was never used');
});

test('fe: counters inside a custom block are let-bound (recursion keeps its own)', () => {
    const f = generateFe(project(DOS_LANG_CORPUS.procedures.src)).fe;
    assert.match(f, /^\(= twice\n {2}\(fn \(word\)\n {4}\(let _r\d+ 0\)/m);
    const top = generateFe(project(DOS_LANG_CORPUS.counting.src)).fe;
    assert.match(top, /^\(= _r\d+ 0\)$/m, 'top-level let is a no-op in fe, so top-level counters use =');
    assert.doesNotMatch(top, /\(let /);
});

test('both: two WHEN scripts and hats other than the flag are refused by name', () => {
    const two = project('WHEN flag clicked:\n  say 1\nWHEN flag clicked:\n  say 2\n');
    for (const [lang, L] of Object.entries(LANGS)) {
        const r = L.generate(two);
        assert.equal(r.ok, false, lang);
        assert.ok(r.reasons.some(x => /2 "when flag clicked" scripts/.test(x)), `${lang}: ${r.reasons}`);
    }
    const key = project('WHEN space key pressed:\n  say 1\n');
    for (const [lang, L] of Object.entries(LANGS)) {
        const r = L.generate(key);
        assert.equal(r.ok, false, lang);
        assert.ok(r.reasons.some(x => /event_whenkeypressed/.test(x)), `${lang}: ${r.reasons}`);
    }
});

test('both: blocks with no console meaning are refused, naming the opcode', () => {
    const p = project('WHEN flag clicked:\n  move 10 steps\n');
    for (const L of Object.values(LANGS)) {
        const r = L.generate(p);
        assert.equal(r.ok, false);
        assert.ok(r.reasons.some(x => x.includes('motion_movesteps')), r.reasons.join('; '));
    }
});

// ---- the readers, on code a person wrote ------------------------------

test('tcl reader: partcl (the earlier Tcl tab\'s dialect) still reads — the #693 demo comes through whole', () => {
    const demo = [
        'puts "partcl on DOS (8086)"',
        'set x 6',
        'puts [* $x 7]',
        'proc fact {n} { if {<= $n 1} {return 1} {return [* $n [fact [- $n 1]]]} }',
        'puts [fact 5]'
    ].join('\n');
    const r = tclToPseudocode(demo);
    assert.deepEqual(r.warnings, []);
    assert.equal(r.pseudocode, [
        'GLOBAL x__',
        'GLOBAL fact_result',
        '',
        'DEFINE fact (n):',
        '  IF (not (n > 1)) THEN:',
        '    set fact_result to 1',
        '    stop this script',
        '  ELSE:',
        '    fact (n - 1)',
        '    set fact_result to (n * fact_result)',
        '    stop this script',
        '',
        'WHEN flag clicked:',
        '  say "partcl on DOS (8086)"',
        '  set x__ to 6',
        '  say (x__ * 7)',
        '  fact 5',
        '  say fact_result',
        ''
    ].join('\n'));
    // …and writes back as Tcl 8 that returns its value, x as x again.
    const t = generateTcl(project(r.pseudocode));
    assert.equal(t.ok, true, t.reasons.join('; '));
    assert.match(t.tcl, /^ {8}set fact_result \[fact \[expr \{\$n - 1\}\]\]\n {8}return \[expr \{\$n \* \$fact_result\}\]$/m);
    assert.match(t.tcl, /^set x 6\nputs \[expr \{\$x \* 7\}\]$/m);
    assert.match(t.tcl, /^set fact_result \[fact 5\]\nputs \$fact_result$/m);
});

test('tcl reader: real Tcl — expr, incr, for, if/elseif/else, defaults, global, escapes', () => {
    const r = tclToPseudocode([
        'package require Tcl 8.5',
        'set total 0',
        'proc bump {{by 2}} { global total; incr total $by }',
        'for {set i 1} {$i <= 3} {incr i} {',
        '    if {$i % 2 == 0} then { bump } elseif {$i == 3} { bump 10 } else { incr total }',
        '}',
        'puts "total:\\t$total"',
        'puts [expr {2 ** 3 + abs(-1)}]'
    ].join('\n'));
    assert.deepEqual(r.warnings, []);
    assert.equal(r.pseudocode, [
        'GLOBAL total',
        'GLOBAL i',
        '',
        'DEFINE bump (by):',
        '  raw "global total"',
        '  change total by by',
        '',
        'WHEN flag clicked:',
        '  set total to 0',
        '  set i to 1',
        '  REPEAT UNTIL (i > 3):',
        '    IF ((i mod 2) = 0) THEN:',
        '      bump 2',
        '    ELSE:',
        '      IF (i = 3) THEN:',
        '        bump 10',
        '      ELSE:',
        '        change total by 1',
        '    change i by 1',
        '  say ("total:\\t" join total)',
        '  say ((2 to the power of 3) + (abs of (-1)))',
        ''
    ].join('\n'));
    assert.doesNotThrow(() => project(r.pseudocode));
});

test('tcl reader: a proc\'s variables are its own; Tcl a block cannot say stays raw, in place', () => {
    const r = tclToPseudocode([
        'proc count {n} {',
        '    set total 0',
        '    while {$n > 0} { incr total $n; incr n -1 }',
        '    return $total',
        '}',
        'puts [count 4]'
    ].join('\n'));
    // blocks cannot assign to an argument: that one command is kept as Tcl
    assert.deepEqual(r.warnings, ['kept as Tcl (line 3): assigning to the argument "n" — blocks cannot']);
    assert.match(r.pseudocode, /^DEFINE count \(n\):\n {2}set count_total to 0\n {2}REPEAT UNTIL \(not \(n > 0\)\):\n {4}change count_total by n\n {4}raw "incr n -1"$/m);
    const t = generateTcl(project(r.pseudocode));
    assert.equal(t.ok, true, t.reasons.join('; '));
    // count_total is the proc's local `total` again
    assert.match(t.tcl, /^proc count \{n\} \{\n {4}set total 0\n {4}while \{\$n > 0\} \{\n {8}set total \[expr \{\$total \+ \$n\}\]\n {8}incr n -1\n/m);
    assert.doesNotMatch(t.tcl, /^set (count_)?total 0$/m, 'a local gets no global initialiser');
});

test('tcl reader: what blocks cannot say is kept as raw Tcl, by line, with the reason', () => {
    const r = tclToPseudocode([
        'puts {start}',
        'puts [lsort {c a b}]',
        'set arr(1) 5',
        'puts {*}$args',
        'set f {$x + 1}',
        'puts [expr $f]',
        'puts {end}'
    ].join('\n'));
    const why = r.warnings.join('\n');
    assert.match(why, /line 2\): no block for the Tcl command \[lsort\]/);
    assert.match(why, /line 3\): array element arr\(1\)/);
    assert.match(why, /line 4\): \{\*\} argument expansion/);
    assert.match(why, /line 6\): expr of a computed expression/);
    assert.match(r.pseudocode, /^ {2}say "start"\n {2}raw "puts \[lsort \{c a b\}\]"\n {2}raw "set arr\(1\) 5"$/m);
    assert.match(r.pseudocode, /^ {2}say "end"$/m);
    // …and the raw lines come back verbatim.
    const t = generateTcl(project(r.pseudocode));
    assert.match(t.tcl, /^puts \[lsort \{c a b\}\]\nset arr\(1\) 5\nputs \{\*\}\$args$/m);
});

test('tcl reader: Tcl lists are Scratch lists — lappend, lindex, llength, lset, in, foreach', () => {
    const src = [
        'set primes {}',
        'for {set n 2} {$n < 20} {incr n} {',
        '    set isPrime 1',
        '    foreach p $primes {',
        '        if {$n % $p == 0} { set isPrime 0 }',
        '    }',
        '    if {$isPrime} { lappend primes $n }',
        '}',
        'puts "[llength $primes] primes, last [lindex $primes end], first [lindex $primes 0]"',
        'lset primes 0 two',
        'if {"two" in $primes} { puts $primes }'
    ].join('\n');
    const r = tclToPseudocode(src);
    assert.deepEqual(r.warnings, []);
    assert.match(r.pseudocode, /^GLOBAL LIST primes$/m);
    assert.match(r.pseudocode, /^ {4}set _f1 to 0\n {4}REPEAT \(length of primes\):\n {6}change _f1 by 1\n {6}set p to \(item _f1 of primes\)$/m);
    // `if {$isPrime}` is Tcl's truth test (0 and false are false) and comes back as one
    assert.match(r.pseudocode, /^ {4}IF \(not \(\(isPrime = 0\) or \(isPrime = "false"\)\)\) THEN:\n {6}add n to primes$/m);
    assert.match(r.pseudocode, /\(item "last" of primes\)/);
    assert.match(r.pseudocode, /^ {2}replace item 1 of primes with "two"$/m);
    assert.match(r.pseudocode, /^ {2}IF \(primes contains "two"\) THEN:$/m);
    const t = generateTcl(project(r.pseudocode)).tcl;
    assert.match(t, /^set primes \[list\]$/m);
    assert.match(t, /^ {4}foreach p \$primes \{$/m);
    assert.match(t, /^ {4}if \{\$isPrime\} \{\n {8}lappend primes \$n$/m);
    assert.match(t, /\[lindex \$primes end\]/);
    assert.match(t, /^lset primes 0 two$/m);
    assert.equal(generateTcl(project(tclToPseudocode(t).pseudocode)).tcl, t, 'fixed point');
});

test('tcl reader: names pseudocode reads as something else are renamed and come back', () => {
    const r = tclToPseudocode('set size 3\nset Answer 4\nset y [expr {$size * $Answer}]\nputs $y\n');
    assert.match(r.pseudocode, /^ {2}set size__ to 3\n {2}set Answer__ to 4\n {2}set y__ to \(size__ \* Answer__\)$/m);
    const t = generateTcl(project(r.pseudocode)).tcl;
    assert.match(t, /^set size 3\nset Answer 4\nset y \[expr \{\$size \* \$Answer\}\]\nputs \$y$/m);
});

test('tcl reader: a double stays a double (4 / 2.0 is not integer division)', () => {
    const r = tclToPseudocode('set d 5\nputs [expr {$d / 2.0 + 1e3}]\n');
    assert.match(r.pseudocode, /say \(\(d \/ 2\.0\) \+ 1000\.0\)/);
    assert.match(generateTcl(project(r.pseudocode)).tcl, /^puts \[expr \{\(\$d \/ 2\.0\) \+ 1000\.0\}\]$/m);
});

test('tcl reader: a proc with default arguments that raw Tcl calls short stays raw itself', () => {
    const r = tclToPseudocode([
        'proc greet {who {greeting hello}} { puts "$greeting $who" }',
        'greet you',
        'lmap w {a b} { greet $w }'
    ].join('\n'));
    assert.match(r.pseudocode, /^ {2}raw "proc greet/m);
    assert.doesNotMatch(r.pseudocode, /^DEFINE greet/m);
});

test('tcl reader: the partcl marker switches backslashes off; real Tcl escapes', () => {
    // What the earlier partcl generator wrote starts with `proc # {} {}`.
    assert.match(tclToPseudocode('proc # {} {}\nputs "A\\B"').pseudocode, /^ {2}say "A\\\\B"$/m);
    assert.match(tclToPseudocode('puts "A\\B"').pseudocode, /^ {2}say "AB"$/m);
    const g = generateTcl(project('WHEN flag clicked:\n  say "A\\\\B"\n')).tcl;
    assert.match(g, /^puts "A\\\\B"$/m);
    assert.match(tclToPseudocode(g).pseudocode, /^ {2}say "A\\\\B"$/m);
});

test('tcl generator: a custom block that changes a global gets a global line', () => {
    const r = generateTcl(project('GLOBAL flag\nDEFINE stop_it:\n  set flag to 0\nWHEN flag clicked:\n  set flag to 1\n  stop_it\n  say flag\n'));
    assert.equal(r.ok, true, r.reasons.join('; '));
    assert.match(r.tcl, /^proc stop_it \{\} \{\n {4}global flag\n {4}set flag 0\n\}$/m);
});

test('tcl reader: unbalanced input throws (the reader contract), it is not guessed at', () => {
    assert.throws(() => tclToPseudocode('puts {oops'), /unbalanced \{/);
    assert.throws(() => tclToPseudocode('puts "oops'), /unclosed "/);
});

test('fe reader: hand-written fe, including the native if chain and variadic math', () => {
    const r = feToPseudocode([
        '; a comment',
        '(= n 10)',
        '(= total (+ n 1 2))',
        '(while (< 0 n)',
        '  (= n (- n 3))',
        '  (if (< n 2) (print "small" n) (is n 4) (print "four") (print n)))',
        '(= hello (fn (who) (print "hi" who)))',
        '(hello "you")'
    ].join('\n'));
    assert.deepEqual(r.warnings, []);
    assert.equal(r.pseudocode, [
        'GLOBAL n',
        'GLOBAL total',
        '',
        'DEFINE hello (who):',
        '  say (("hi" join " ") join who)',
        '',
        'WHEN flag clicked:',
        '  set n to 10',
        '  set total to ((n + 1) + 2)',
        '  REPEAT UNTIL (not (n > 0)):',
        '    set n to (n - 3)',
        '    IF (n < 2) THEN:',
        '      say (("small" join " ") join n)',
        '    ELSE:',
        '      IF (n = 4) THEN:',
        '        say "four"',
        '      ELSE:',
        '        say n',
        '  hello "you"',
        ''
    ].join('\n'));
    assert.doesNotThrow(() => project(r.pseudocode));
});

test('fe reader: the dos-compile demo degrades by name (a function used for its value)', () => {
    const r = feToPseudocode([
        '(print "fe on the bench")',
        '(print (* 6 7))',
        '(= fact (fn (n) (if (<= n 1) 1 (* n (fact (- n 1))))))',
        '(print (fact 5))'
    ].join('\n'));
    assert.ok(r.warnings.some(w => /reporter custom blocks/.test(w)), JSON.stringify(r.warnings));
    assert.match(r.pseudocode, /^ {2}say \(6 \* 7\)$/m);
    assert.doesNotThrow(() => project(r.pseudocode));
});

test('fe reader: unbalanced input throws', () => {
    assert.throws(() => feToPseudocode('(print 1'), /unclosed \(/);
    assert.throws(() => feToPseudocode('(print 1))'), /stray \)/);
    assert.throws(() => feToPseudocode('(print "x)'), /unclosed string/);
});

// ---- the Code tab ----------------------------------------------------

const importer = readFileSync(
    path.join(REPO, 'overlay/scratch-gui/src/components/tw-pseudocode/pseudocode-importer.jsx'), 'utf8');

test('the importer treats fe and Tcl as two-way languages everywhere one must be registered', () => {
    // Two-way is also what makes the editor writable for them: a tab neither
    // TWO_WAY nor EDITABLE_ONE_WAY is read-only.
    assert.match(importer, /const TWO_WAY = new Set\(\[[^\]]*'fe', 'tcl', 'forth'\]\)/);
    assert.match(importer, /nqc: 'NQC', fe: 'fe \(Lisp\)', tcl: 'Tcl', forth: 'Forth'\}/, 'LANG_LABEL');
    // Source replacement and edits now share the document adapter. Exercise
    // that boundary, so a missing tab buffer still fails even though the old
    // five inline reset expressions no longer exist.
    assert.match(scopeAfter(importer, 'codeDocumentState (document)'),
        /restoreCodeDocumentState\(document, Object\.keys\(LANG_LABEL\)\)/);
    const Editor = codeDocumentEditorClass(importer, codeEditorMethod(importer, 'setActiveCode (text) {'));
    const editor = Object.assign(new Editor(), {
        state: {}, invalidateArcadeReport () {},
        setState (update) { Object.assign(this.state, typeof update === 'function' ? update(this.state) : update); }
    });
    for (const lang of ['fe', 'tcl', 'forth']) {
        editor.state = editor.authoredCodeState(lang, 'original source');
        editor.setActiveCode('edited source');
        assert.deepEqual(Object.keys(editor.state.buffers).sort(), Object.keys(codeDocumentLabels).sort());
        assert.equal(editor.state.codeDocument.lang, lang);
        assert.equal(editor.state.codeDocument.code, 'edited source');
        for (const [key, value] of Object.entries(editor.state.buffers)) {
            assert.equal(value, key === lang ? 'edited source' : '', `${lang} edit: ${key} buffer`);
        }
    }
    assert.doesNotMatch(importer, /buffers: \{pseudocode: ''/, 'a hand-written buffer list is back');
    assert.match(importer, /return this\.state\.buffers\[this\.state\.lang\] \?\? '';/);
    // fe and Tcl are offered from the "+" menu at the end of the tab row
    // (#786), remembered per browser, and stay visible while open or holding text.
    assert.match(importer, /const BW_OPTIONAL_LANGS = \[\['fe', 'λ fe', [^\]]*\], \['tcl', '○ Tcl', [^\]]*\], \['forth', '🔺 Forth', [^\]]*\]\];/);
    assert.match(importer, /\.\.\.this\.visibleOptionalLangs\(\)/);
    assert.match(importer, /data-testid="bw-lang-more"/);
    // compile() reads them, and both regenerate paths write them.
    assert.match(importer, /\} else if \(DOS_LANG\[lang\]\) \{\n\s+const res = \(await DOS_LANG\[lang\]\.load\(\)\)\.default\(source\);/);
    // ⇦ To blocks clears the other fe/Tcl buffers (they re-derive when opened);
    // it must not await their lazily loaded generators: on a slow runner that
    // overwrote an edit typed meanwhile, or reloaded the project after a
    // machine had started.
    assert.match(importer, /for \(const l of Object\.keys\(DOS_LANG\)\) if \(l !== lang\) nb\[l\] = '';/);
    const compileStart = importer.indexOf('async compile ({strict = false, pseudocode = null} = {})');
    const compileEnd = importer.indexOf('async fromBlocks ()', compileStart);
    assert.doesNotMatch(importer.slice(compileStart, compileEnd), /dosLangBuffersFor|generateDosLangs|\.generate\(await/,
        'compile() runs no fe/Tcl generator (reading the open fe/Tcl tab is its input, not a regeneration)');
    assert.match(scopeAfter(importer, 'async fromBlocks ()'), /\.\.\.\(await dosLangBuffersFor\(project, lang\)\)/);
    // A tab switch derives through them in both directions — before this,
    // switching INTO fe or Tcl fell through to generateJavaScript.
    const derive = scopeAfter(importer, 'async deriveBuffer (src, from, to)');
    assert.match(derive, /else if \(DOS_LANG\[from\]\) read = \(await DOS_LANG\[from\]\.load\(\)\)\.default\(src\);/);
    assert.match(derive, /const pseudo = read \? this\.convertedSource\(read\) : src;/);
    assert.match(importer, /\} else if \(DOS_LANG\[to\]\) \{\n\s+code = DOS_LANG\[to\]\.generate/);
    // The reference panel says what each subset is.
    assert.match(importer, /\n {4}tcl: \[\n {8}\['Overview', \['Jim Tcl/);
    assert.match(importer, /\n {4}fe: \[\n {8}\['Overview', \['fe \(rxi\)/);
});

test('the DOS_LANG table points at modules that export what it calls', async () => {
    const tcl = await import('../overlay/scratch-gui/src/lib/bw-lang/tcl.js');
    const fe = await import('../overlay/scratch-gui/src/lib/bw-lang/fe.js');
    assert.equal(typeof tcl.default, 'function');
    assert.equal(typeof tcl.generateTcl, 'function');
    assert.equal(typeof fe.default, 'function');
    assert.equal(typeof fe.generateFe, 'function');
    assert.match(importer, /'\.\.\/\.\.\/lib\/bw-lang\/fe\.js'/);
    assert.match(importer, /'\.\.\/\.\.\/lib\/bw-lang\/tcl\.js'/);
    assert.match(importer, /const r = m\.generateFe\(proj\);\n\s+return r\.ok \? r\.fe :/);
    assert.match(importer, /const r = m\.generateTcl\(proj\);\n\s+return r\.ok \? r\.tcl :/);
});

test('both: repeat until not C is written as while C (no double negation)', () => {
    const p = project('GLOBAL i\nWHEN flag clicked:\n  REPEAT UNTIL not (i > 3):\n    change i by 1\n');
    assert.match(generateTcl(p).tcl, /^while \{\$i > 3\} \{$/m);
    assert.match(generateFe(p).fe, /^\(while \(< 3 i\)$/m);
    // …and a hand-written while survives a trip through blocks as written.
    const hand = 'set i 0\nwhile {$i < 3} {\n    incr i\n}\n';
    const back = generateTcl(project(tclToPseudocode(hand).pseudocode)).tcl;
    assert.match(back, /^while \{\$i < 3\} \{\n {4}incr i\n\}$/m);
});
