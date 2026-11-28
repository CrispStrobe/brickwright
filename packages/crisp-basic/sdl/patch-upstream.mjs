// Adapt only transport and application lifetime. Retain the full upstream
// SDL host, graphics/audio, files, native calls, assembler and language core.
export function patchSDLSource(path, original) {
    let source = original;
    const replace = (before, after, expected = 1) => {
        const count = source.split(before).length - 1;
        if (count !== expected) throw new Error(`${path}: SDL patch expected ${expected} matches, found ${count}`);
        source = source.split(before).join(after);
    };
    if (path === 'src/bbcsdl.c') {
        replace('#include "bbcsdl.h"', '#include "bbcsdl.h"\n#include "source-loader.h"');
        replace('if (*szAutoRun && (NULL != (ProgFile = SDL_RWFromFile (szAutoRun, "rb"))))',
`const char *crisp_source = getenv("CRISP_BASIC_SOURCE");
if (crisp_source && *crisp_source)
{
    const char *crisp_program = getenv("CRISP_BASIC_PROGRAM_PATH");
    if (!crisp_program || !*crisp_program) crisp_program = crisp_source;
    if (strlen(crisp_program) >= MAX_PATH ||
        !crisp_sdl_load_source(crisp_source, progRAM, (size_t)(userTOP - progRAM)))
        return 65;
    strcpy(szAutoRun, crisp_program);
    immediate = 0;
}
else if (*szAutoRun && (NULL != (ProgFile = SDL_RWFromFile (szAutoRun, "rb"))))`);
        replace('SetDir (szAutoRun) ;',
`SetDir (szAutoRun) ;
/* Keep @dir$ at the program/resources while preserving external file cwd. */
const char *crisp_cwd = getenv("CRISP_BASIC_CWD");
if (crisp_cwd && *crisp_cwd && chdir(crisp_cwd))
{
    perror("CrispBASIC SDL working directory");
    return 66;
}`);
    } else if (path === 'src/bbcmos.c') {
        replace('void oswrch (unsigned char vdu)\n{',
`void oswrch (unsigned char vdu)
{
    /* Optional byte-exact VDU tee for source-versus-bundle evidence. */
    const char *crisp_capture = getenv("CRISP_BASIC_VDU_STDOUT");
    if (crisp_capture && strcmp(crisp_capture, "1") == 0) fputc(vdu, stdout);`);
        replace('pushev (EVT_QUIT, NULL, (void *)(intptr_t) basic (progRAM, userTOP, immediate)) ;',
`/* Batch lifetime is opt-in; ordinary BBCSDL REPL startup remains intact. */
    const char *crisp_batch = getenv("CRISP_BASIC_BATCH");
    int crisp_result = basic(progRAM, userTOP,
        crisp_batch && strcmp(crisp_batch, "1") == 0 ? (void *)-1 : immediate);
    fflush(stdout);
    pushev(EVT_QUIT, NULL, (void *)(intptr_t)(crisp_result == 256 ? 0 : crisp_result));`);
    } else if (path === 'src/bbmain.c') {
        replace('int basic (void *ecx, void *edx, void *prompt)\n{',
            'int basic (void *ecx, void *edx, void *prompt)\n{\n    const int crisp_batch = (prompt == (void *)-1);');
        replace('if (prompt == (void *) -1)', 'if (crisp_batch)', 2);
    } else if (path === 'src/bbdata_arm_64.s') {
        source = source.replace(/_([a-z]*)/g, '$1');
    }
    return source === original ? original :
        '/* Modified by CrispBASIC: sdl/patch-upstream.mjs; original notice follows. */\n' + source;
}
