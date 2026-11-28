// CrispBASIC modifications to pinned BBCSDL sources. Original files remain
// hash-verified in the checkout; only generated build copies are modified.
// Exact-match checks make upstream drift fail rather than silently mispatch.
export function patchUpstream(path, original) {
    let source = original;
    const replace = (before, after, expected = 1) => {
        const count = source.split(before).length - 1;
        if (count !== expected) throw new Error(path + ': patch expected ' + expected + ' match(es), found ' + count);
        source = source.split(before).join(after);
    };
    if (path === 'src/bbccon.c') {
        replace('int main (int argc, char* argv[])', 'int crisp_unused_console_main (int argc, char* argv[])');
        replace('static void *mymap (uintptr_t size)', 'void *crisp_find_mapping (uintptr_t size)');
        replace('base = mymap (MaximumRAM)', 'base = crisp_find_mapping (MaximumRAM)');
        replace('"BBC BASIC for "PLATFORM" Console "VERSION', '"CrispBASIC native (BBCSDL "VERSION")"');
        for (const declaration of [
            'void oswrch (unsigned char vdu)',
            'void osline (char *buffer)',
            'unsigned char osrdch (void)',
            'int oskey (int wait)',
            'void getcsr(int *px, int *py)',
            'void sound (short chan, signed char ampl, unsigned char pitch, unsigned char duration)',
            'void envel (signed char *env)'
        ]) {
            replace(declaration, declaration.replace(/(oswrch|osline|osrdch|oskey|getcsr|sound|envel)/, 'crisp_unused_$1'));
        }
        // The old definitions still contain calls; declare replacement hooks.
        replace('#include "bbccon.h"', '#include "bbccon.h"\nvoid oswrch(unsigned char);\nvoid osline(char *);\nunsigned char osrdch(void);\nint oskey(int);');
        replace('xeqvdu (0x1700, 0, 0x1F) ;', '/* CrispBASIC: no ANSI terminal initialisation in raw VDU mode. */');
        replace('vflags = UTF8 ;', 'vflags = 0 ;');
    } else if (path === 'src/bbmain.c') {
        replace('#include <setjmp.h>', '#include <setjmp.h>\nvoid crisp_runtime_error(int, const char *, unsigned short);\nvoid crisp_set_exit(int);');
        replace('int basic (void *ecx, void *edx, void *prompt)\n{',
            'int basic (void *ecx, void *edx, void *prompt)\n{\n\tconst int crisp_batch = (prompt == (void *)-1);');
        // ON ERROR changes prompt, so preserve the original batch decision.
        replace('if (prompt == (void *) -1)', 'if (crisp_batch)', 2);
        replace('if (errcode < 0)\n\t\treturn ~errcode ;',
            'if (errcode < 0) { crisp_set_exit(~errcode); return ~errcode; }');
        replace('unsigned short lino ;\n\t\t\ttracen = 0 ;',
            'unsigned short lino ;\n\t\t\tif (crisp_batch) {\n\t\t\t\tcrisp_runtime_error(errcode, errtxt, report());\n\t\t\t\treturn errcode;\n\t\t\t}\n\t\t\ttracen = 0 ;');
    }
    if (source !== original) source = '/* Modified for CrispBASIC: see native/patch-upstream.mjs. */\n' + source;
    return source;
}
