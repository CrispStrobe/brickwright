// Original transport instrumentation layered over the pinned full SDL host.
// No language implementation or graphics/audio behavior is replaced.
export function patchSDLWebSource(path, original) {
    let source = original;
    const replace = (before, after) => {
        const count = source.split(before).length - 1;
        if (count !== 1) throw new Error(`${path}: SDL web patch expected one match, found ${count}`);
        source = source.replace(before, after);
    };
    if (path === 'src/bbcmos.c') {
        replace('void oswrch (unsigned char vdu)\n{',
`extern void crisp_sdl_capture(unsigned char);
extern void crisp_sdl_input_ready(void);
void oswrch (unsigned char vdu)
{
    crisp_sdl_capture(vdu);`);
        replace('int crisp_result = basic(progRAM, userTOP,',
            'crisp_sdl_input_ready();\n    int crisp_result = basic(progRAM, userTOP,');
    } else if (path === 'src/bbcsdl.c') {
        replace('int main(int argc, char* argv[])', 'int crisp_sdl_main(int argc, char* argv[])');
        replace('static int exitcode = 0, running = 1 ;',
            'extern void crisp_sdl_complete(int);\nstatic int exitcode = 0, running = 1 ;');
        replace('exitcode = (size_t) ev.user.data2 ;',
            'exitcode = (size_t) ev.user.data2 ;\n                crisp_sdl_complete(exitcode);');
    } else if (path === 'src/bbasmb_wasm32.c') {
        // The pinned source tree does not contain the optional Box2D object.
        // Remove its name/address pair so SYS reports an unknown call, rather
        // than installing a stub which could silently pretend to work.
        replace('#define NSYS 144', '#define NSYS 143');
        replace('\t"B2D_GetProcAddress",\n', '');
        replace('\tB2D_GetProcAddress,\n', '');
    }
    return source === original ? original :
        '/* Modified by CrispBASIC: sdl/patch-web.mjs; original notice follows. */\n' + source;
}
