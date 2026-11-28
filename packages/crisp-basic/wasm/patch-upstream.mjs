// CrispBASIC's restricted WASM profile. These patches apply only to generated,
// SHA-256-verified copies of the locked upstream sources, never the checkout.
// Restrictions are enforced where BBCSDL executes/evaluates an operation, so
// EVAL and normal ON ERROR handling have the same behavior as literal source.
import {patchUpstream} from '../native/patch-upstream.mjs';

export function patchWasmUpstream(path, original) {
    let source = patchUpstream(path, original);
    const replace = (before, after, expected = 1) => {
        const count = source.split(before).length - 1;
        if (count !== expected) {
            throw new Error(path + ': WASM patch expected ' + expected + ' match(es), found ' + count);
        }
        source = source.split(before).join(after);
    };
    const deny = (token, message, expected = 1) => {
        const before = 'case ' + token + ':';
        replace(before, before + '\n\t\t\t\terror (255, "' + message + ' is not available in the CrispBASIC WASM backend");', expected);
    };

    if (path === 'src/bbmain.c') {
        // getdef() accepts FN(address) and PROC(address) as well as names.
        replace("if (al == '(')\n\t    {\n\t\tvoid *n = (void *) (size_t) itemi () ;",
            "if (al == '(')\n\t    {\n\t\terror (255, \"Indirect FN/PROC is not available in the CrispBASIC WASM backend\");\n\t\tvoid *n = (void *) (size_t) itemi () ;");
        // locate() handles @% above this branch. Other @variables expose
        // writable interpreter/host pointers and are deliberately unavailable.
        replace("if (al == '@')\n\t    {\n\t\tebx = NULL ;",
            "if (al == '@')\n\t    {\n\t\terror (255, \"System variables are not available in the CrispBASIC WASM backend\");\n\t\tebx = NULL ;");
        // Ordinary FN/PROC calls use getdef() directly. Exposing their pointer
        // as a variable also permits LOCAL/INPUT/READ to modify that pointer.
        replace('ebx = locate (ptype) ;\n\tif ((*ptype == 0) || (ebx == NULL))',
            'ebx = locate (ptype) ;\n\tif (*ptype == 36) error (255, "Function pointer variables are not available in the CrispBASIC WASM backend");\n\tif ((*ptype == 0) || (ebx == NULL))');
        // All prefix forms, including indirect CR/NUL-terminated strings,
        // numeric widths and the 64-bit ] operator, go through getvar().
        replace("if ((al == '$') || (al == '?') || (al == '!') || (al == '|') || (al == ']'))\n\t    {",
            "if ((al == '$') || (al == '?') || (al == '!') || (al == '|') || (al == ']'))\n\t    {\n\t\terror (255, \"Memory indirection is not available in the CrispBASIC WASM backend\");");
        // Infix byte/word indirection is a separate path (e.g. address%?0).
        replace("if ((((al = *esi) == '!') || (al == '?')) && (*ptype < 128))\n\t    {",
            "if ((((al = *esi) == '!') || (al == '?')) && (*ptype < 128))\n\t    {\n\t\terror (255, \"Memory indirection is not available in the CrispBASIC WASM backend\");");
    } else if (path === 'src/bbexec.c') {
        replace('#include "BBC.h"', '#include "BBC.h"\nvoid crisp_simulation_callsite(signed char *, signed char *);');
        // Keep public simulation calls as ordinary library PROC/FN frames.
        // Capture the original caller before argument evaluation recurses,
        // then record it only once all ordinary argument transfer completes.
        replace('esi-- ;\t\t// Point to TFN or TPROC token\n\toldesi = esi ;',
            'esi-- ;\t\t// Point to TFN or TPROC token\n\tsigned char *crisp_call_site = esi;\n\toldesi = esi ;');
        replace('*(void **)resesp = esi ;\n\tesi = ebx ;',
            '*(void **)resesp = esi ;\n\tcrisp_simulation_callsite(crisp_call_site, ebx);\n\tesi = ebx ;');
        // Numeric SYS, CALL and USR bypass symbol lookup in upstream. Denying
        // only sysadr() would therefore still expose the WASM function table.
        deny('TSYS', 'SYS', 2); // Includes ON SYS, whose host event is unavailable.
        deny('TCALL', 'CALL');
        deny('TSOUND', 'SOUND');
        deny('TENVEL', 'ENVELOPE');
        deny('TPAGEL', 'Changing PAGE');
        deny('TLOMEML', 'Changing LOMEM');
        deny('THIMEML', 'Changing HIMEM');
        // Internal cleanup calls osshut(NULL); explicit CLOSE#0 must still
        // report the profile's missing file capability rather than a no-op.
        replace('\n\t\t\tcase TCLOSE:', '\n\t\t\tcase TCLOSE:\n\t\t\t\terror (255, "File I/O is not available in the CrispBASIC WASM backend");');
        // Retain PTR# for a future virtual-file host, but prevent descriptor
        // retargeting through PTR(string/array/structure/function)=address.
        const ptrStart = source.indexOf('case TPTRL:');
        const ptrEnd = source.indexOf('/************************************  EXT', ptrStart);
        if (ptrStart < 0 || ptrEnd < 0) throw new Error(path + ': missing PTR statement boundaries');
        const ptrBlock = source.slice(ptrStart, ptrEnd);
        const ptrBefore = "if (*esi == '(')\n\t\t\t\t    {";
        if (ptrBlock.split(ptrBefore).length !== 2) throw new Error(path + ': unexpected PTR statement');
        replace(ptrBlock, ptrBlock.replace(ptrBefore, ptrBefore + '\n\t\t\t\t\terror (255, "Pointer assignment is not available in the CrispBASIC WASM backend");'));
        // FNname=integer can write a function pointer without using PTR().
        deny('36', 'Function pointer assignment');
        // These ON traps have no corresponding host event source. Match their
        // nested switch indentation so ordinary MOVE and CLOSE remain intact.
        for (const token of ['TTIMER', 'TCLOSE', 'TMOVE', 'TMOUSE']) {
            const before = '\n\t\t\t\t\tcase ' + token + ':';
            replace(before, before + '\n\t\t\t\t\t\terror (255, "Host event handlers are not available in the CrispBASIC WASM backend");');
        }
    } else if (path === 'src/bbeval.c') {
        replace('#include "BBC.h"', '#include "BBC.h"\nint crisp_simulation_function(VAR *);\nheapptr crisp_simulation_origin(signed char *);\nVAR crisp_simulation_eval(heapptr);');
        replace('case TFN:\n', 'case TFN:\n\t\t\tif (crisp_simulation_function(&v)) return v;\n');
        // EVAL's tokens live on the BASIC stack, and ENDFN can leave curlin
        // pointing there. Scope a stable authored origin across the entire
        // expression, restoring it even when an error/END/QUIT longjmps out.
        replace('signed char *oldesi ;\n\t\t\theapptr *oldesp ;\n\t\t\tv = items () ;',
            'signed char *oldesi ;\n\t\t\theapptr *oldesp ;\n\t\t\theapptr crisp_eval_origin = crisp_simulation_origin(esi - 1);\n\t\t\tv = items () ;');
        replace('esi = (signed char *) esp ;\n\t\t\tv = expr () ;\n\t\t\tesi = oldesi ;',
            'esi = (signed char *) esp ;\n\t\t\tv = crisp_simulation_eval(crisp_eval_origin);\n\t\t\tesi = oldesi ;');
        deny('TUSR', 'USR');
        deny('TSYS', 'SYS');
        // Unary ^ returns an address; binary exponentiation is unaffected.
        replace("/***************************** Address-of operator *****************************/\n\n\t\tcase '^':",
            "/***************************** Address-of operator *****************************/\n\n\t\tcase '^':\n\t\t\terror (255, \"Address-of is not available in the CrispBASIC WASM backend\");");
        const ptrStart = source.indexOf('case TPTRR:');
        const ptrEnd = source.indexOf('/************************************* EXT', ptrStart);
        if (ptrStart < 0 || ptrEnd < 0) throw new Error(path + ': missing PTR expression boundaries');
        const ptrBlock = source.slice(ptrStart, ptrEnd);
        const ptrBefore = "if (*esi == '(')\n\t\t\t    {";
        if (ptrBlock.split(ptrBefore).length !== 2) throw new Error(path + ': unexpected PTR expression');
        replace(ptrBlock, ptrBlock.replace(ptrBefore, ptrBefore + '\n\t\t\terror (255, "Pointer queries are not available in the CrispBASIC WASM backend");'));
        // Upstream EVAL accepts raw internal fast-variable tokens constructed
        // with CHR$(). Those bypass source validation and address BASIC memory
        // by index. Require expression text before the original tokenizer,
        // preserving Latin-1 quoted literals and ordinary expression syntax.
        replace('fixs (v) ;\n\t\t\tlexan (accs, accs, 0) ; // assumes string gets no longer',
            `fixs (v) ;
            {
                int crisp_quoted = 0, crisp_comment = 0;
                for (unsigned int crisp_i = 0; crisp_i < v.s.l; crisp_i++) {
                    unsigned char crisp_c = (unsigned char)accs[crisp_i];
                    if ((crisp_c < 32 && crisp_c != '\\t') || crisp_c == 127)
                        error (255, "EVAL requires text source in the CrispBASIC WASM backend");
                    if (!crisp_comment && crisp_c == '"') crisp_quoted = !crisp_quoted;
                    if (!crisp_quoted && !crisp_comment && crisp_i + 2 < v.s.l &&
                        strncmp(accs + crisp_i, "REM", 3) == 0 &&
                        (crisp_i == 0 || accs[crisp_i - 1] == ' ' || accs[crisp_i - 1] == ':'))
                        crisp_comment = 1;
                    if (!crisp_quoted && !crisp_comment && crisp_c >= 128)
                        error (255, "EVAL requires text source in the CrispBASIC WASM backend");
                    if (!crisp_quoted && !crisp_comment && crisp_c == '\\t') accs[crisp_i] = ' ';
                }
            }
            lexan (accs, accs, 0) ; // assumes string gets no longer`);
    } else if (path === 'bin/wasm/BBC.h') {
        // This is the actual upstream WASM header: its globals use packed
        // offsets into the WASM data arrays, unlike the native extern symbols.
        replace('// Constants:\n', '#include <stddef.h>\n#include <stdint.h>\n#if !defined(__EMSCRIPTEN__)\n#error "CrispBASIC WASM data layout requires Emscripten"\n#endif\n_Static_assert(sizeof(void *) == 4, "CrispBASIC requires wasm32 pointers");\n\n// Constants:\n');
        replace('} STR, *LPSTR ;', '} STR, *LPSTR ;\n_Static_assert(sizeof(heapptr) == 4, "BASIC heap pointers must be 32 bits");\n_Static_assert(sizeof(VAR) == 16, "Unexpected upstream WASM variant layout");\n_Static_assert(sizeof(STR) == 8, "Unexpected WASM string descriptor layout");');
    } else if (path === 'src/bbdata_wasm32.c') {
        // Preserve only the interpreter's actual WASM data layout. The full
        // SDL app also exports fonts, renderer handles and callable @fn%()
        // entries here; no such facilities belong in the restricted profile.
        const declarations = [
            'int stavar[27+54+64] = {0} ;',
            'node *flist[33] = {0} ;',
            'STR tmps = {0} ;',
            'int vduvar[64] = {0} ;',
            'unsigned int lastick = 0 ;',
            'unsigned char fvtab[7] = { 1, 4, 8, 10, STYPE, 40, 136 } ;'
        ];
        for (const declaration of declarations) {
            if (source.split(declaration).length !== 2) throw new Error(path + ': unexpected WASM data declaration: ' + declaration);
        }
        const marker = '#include <stdlib.h>';
        if (source.split(marker).length !== 2) throw new Error(path + ': unexpected WASM data preamble');
        source = source.slice(0, source.indexOf(marker)) + '#include <stdint.h>\n#include "BBC.h"\n\n' +
            declarations.join('\n') + '\n\n// Reserved layout used by BBC.h; @system variables are unavailable.\nint sysvar[128] = {0};\n';
    }
    if (source !== original) source = '/* Modified for CrispBASIC restricted WASM: see wasm/patch-upstream.mjs. */\n' + source;
    return source;
}
