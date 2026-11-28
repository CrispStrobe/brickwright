/* Original CrispBASIC transport instrumentation, BSD-3-Clause.
 * The interpreter writes once; the browser reads the committed byte count.
 * SDL still receives every VDU byte through its unchanged event queue.
 */
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten/emscripten.h>
#include <SDL.h>
extern int putkey(char);
extern int crisp_sdl_main(int, char **);

#define CRISP_SDL_CAPTURE_LIMIT (16u * 1024u * 1024u)
static unsigned char crisp_capture[CRISP_SDL_CAPTURE_LIMIT];
static uint32_t crisp_capture_length;
static uint32_t crisp_capture_overflow;
static uint32_t crisp_finished;
static uint32_t crisp_ready_for_input;
static int32_t crisp_exit_code;
static int crisp_capture_enabled;
static int crisp_startup_failed;

void crisp_sdl_capture(unsigned char byte) {
    if (!crisp_capture_enabled) return;
    uint32_t length = __atomic_load_n(&crisp_capture_length, __ATOMIC_RELAXED);
    if (length == CRISP_SDL_CAPTURE_LIMIT) {
        __atomic_store_n(&crisp_capture_overflow, 1, __ATOMIC_RELEASE);
        return;
    }
    crisp_capture[length] = byte;
    __atomic_store_n(&crisp_capture_length, length + 1, __ATOMIC_RELEASE);
}

void crisp_sdl_complete(int32_t code) {
    crisp_exit_code = code;
    __atomic_store_n(&crisp_finished, 1, __ATOMIC_RELEASE);
}

void crisp_sdl_input_ready(void) {
    const char *capture = getenv("CRISP_BASIC_CAPTURE_VDU");
    crisp_capture_enabled = capture && strcmp(capture, "1") == 0;
    __atomic_store_n(&crisp_ready_for_input, 1, __ATOMIC_RELEASE);
}

EMSCRIPTEN_KEEPALIVE unsigned char *crisp_sdl_output(void) { return crisp_capture; }
EMSCRIPTEN_KEEPALIVE uint32_t crisp_sdl_output_length(void) {
    return __atomic_load_n(&crisp_capture_length, __ATOMIC_ACQUIRE);
}
EMSCRIPTEN_KEEPALIVE uint32_t crisp_sdl_output_overflow(void) {
    return __atomic_load_n(&crisp_capture_overflow, __ATOMIC_ACQUIRE);
}
EMSCRIPTEN_KEEPALIVE uint32_t crisp_sdl_finished(void) {
    return __atomic_load_n(&crisp_finished, __ATOMIC_ACQUIRE);
}
EMSCRIPTEN_KEEPALIVE int32_t crisp_sdl_exit_code(void) { return crisp_exit_code; }
EMSCRIPTEN_KEEPALIVE int crisp_sdl_startup_failed(void) { return crisp_startup_failed; }
EMSCRIPTEN_KEEPALIVE int crisp_sdl_write_key(int value) {
    if (!__atomic_load_n(&crisp_ready_for_input, __ATOMIC_ACQUIRE)) return 0;
    return putkey((char)value);
}
EMSCRIPTEN_KEEPALIVE void crisp_sdl_stop(void) {
    emscripten_cancel_main_loop();
    SDL_PauseAudio(1);
}

int main(int argc, char **argv) {
    /* Successful startup enters emscripten_set_main_loop and unwinds.
     * Early return must publish failure despite noExitRuntime=true. */
    int code = crisp_sdl_main(argc, argv);
    crisp_startup_failed = 1;
    crisp_sdl_complete(code);
    return code;
}
