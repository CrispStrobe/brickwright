/* CrispBASIC restricted headless host. Original code, BSD-3-Clause.
 * The tokenizer, expression evaluator and executor are the pinned BBCSDL C
 * core. This file replaces the console/SDL OS layer completely.
 */
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <limits.h>
#include <math.h>
#include <setjmp.h>
#include "BBC.h"
#include "crisp-host.h"

#define SOURCE_LINE_LIMIT 4096
#define SOURCE_LIMIT (4u * 1024u * 1024u)
#define BASIC_LINE_MAX 65279
#define PAGE_OFFSET (ACCSLEN + 0x1300)
#define BASIC_RAM_BYTES (PAGE_OFFSET + 16u * 1024u * 1024u)

_Static_assert(sizeof(void *) == 4, "This host requires the upstream WASM32 ABI");
_Static_assert(sizeof(heapptr) == 4, "BBCSDL heap pointers must be 32 bits");
_Static_assert(sizeof(VAR) == 16, "BBCSDL WASM32 variants must be 16 bytes");

extern int basic(void *, void *, void *);
extern char *lexan(char *, char *, unsigned char);
extern void error(int, const char *);
extern unsigned int rnd(void);
extern VAR expr(void);
extern signed char nxt(void);
extern void comma(void);
extern void braket(void);
extern unsigned short setlin(signed char *, char **);
extern jmp_buf env;

void *userRAM, *progRAM;
static void *userTOP;
char *szCmdLine, *szLoadDir, *szLibrary, *szUserDir, *szTempDir;
const char szNotice[] = "CrispBASIC restricted host (BBCSDL core)";

static int started, failed, completed_exit;
static uint32_t time_origin, time_offset;
static int cursor_x, cursor_y, vdu_command, vdu_left, vdu_size, pending_lf;
static unsigned char vdu_args[9];

/* The library occupies its own tokenized records, never user source lines or
 * BASIC's variable/stack arena. BBCSDL already searches libase before the
 * user's DEFs, so user definitions keep their ordinary overriding behavior.
 * Numeric dummies deliberately have no integer suffix: the bridge validates
 * exact integer values instead of silently truncating fractional arguments. */
static const unsigned char simulation_source[] =
    "1 DEF PROCpinMode(_crispPin,_crispMode$):LOCAL _crispResult:_crispResult=FN_crispSimulation(1,_crispPin,_crispMode$):ENDPROC\n"
    "2 DEF PROCdigitalWrite(_crispPin,_crispValue):LOCAL _crispResult:_crispResult=FN_crispSimulation(2,_crispPin,_crispValue):ENDPROC\n"
    "3 DEF FNdigitalRead(_crispPin)=FN_crispSimulation(3,_crispPin,0)\n"
    "4 DEF PROCdelay(_crispMilliseconds):LOCAL _crispResult:_crispResult=FN_crispSimulation(4,_crispMilliseconds,0):ENDPROC\n"
    "5 DEF FNmillis=FN_crispSimulation(5,0,0)\n";
static unsigned char simulation_library[4096];
static int simulation_enabled;
static heapptr simulation_callsite;
static heapptr simulation_eval_origin;

int crisp_simulation_abi(void) { return 1; }

static int in_simulation_library(const signed char *address)
{
    uintptr_t pointer = (uintptr_t)address;
    return pointer >= (uintptr_t)simulation_library &&
        pointer < (uintptr_t)simulation_library + sizeof(simulation_library);
}

/* EVAL executes tokenized text on BASIC's stack, outside either source area.
 * Prefer an actual authored address (including a user FN body called by EVAL),
 * then the dynamically scoped EVAL caller. Never retain a temporary token
 * pointer as source identity. The disabled profile needs no provenance scope. */
heapptr crisp_simulation_origin(signed char *address)
{
    if (!simulation_enabled) return 0;
    if (in_simulation_library(address)) return simulation_callsite;
    if (setlin(address, NULL)) return (heapptr)(address - (signed char *)zero);
    return simulation_eval_origin;
}

/* EVAL's origin is captured before its string argument is evaluated. Its
 * nested expression may suspend, call other functions/EVALs, or longjmp to an
 * ON ERROR handler. Forward every nonzero jump only after restoring the old
 * environment and numeric origin; no pointer to an unwound C frame survives.
 * This guard adds no BASIC error handler and preserves the original jump code. */
VAR crisp_simulation_eval(heapptr origin)
{
    if (!simulation_enabled) return expr();
    const heapptr previous = simulation_eval_origin;
    jmp_buf saved_env;
    memcpy(&saved_env, &env, sizeof(env));
    simulation_eval_origin = origin;
    int code = setjmp(env);
    if (code) {
        simulation_eval_origin = previous;
        memcpy(&env, &saved_env, sizeof(env));
        longjmp(env, code);
    }
    VAR result = expr();
    simulation_eval_origin = previous;
    memcpy(&env, &saved_env, sizeof(env));
    curlin = origin;
    return result;
}

/* Called after ordinary PROC/FN arguments have been evaluated. A nested call
 * in an argument therefore cannot replace the outer call's error location.
 * The trusted wrappers contain no nested public library calls of their own. */
void crisp_simulation_callsite(signed char *caller, signed char *target)
{
    if (simulation_enabled && in_simulation_library(target)) {
        simulation_callsite = crisp_simulation_origin(caller);
    }
}

static void simulation_error(int code, heapptr origin)
{
    static const char *const messages[] = {
        NULL,
        "Simulation invalid-pin: unknown or invalid logical pin",
        "Simulation invalid-mode: expected input, output or input-pullup",
        "Simulation invalid-level: expected numeric 0 or 1",
        "Simulation invalid-time: expected nonnegative integer milliseconds",
        "Simulation pin-not-output: pin is not configured as output",
        "Simulation floating-input: pin has no stimulus or pull-up",
        "Simulation disposed: host is disposed",
        "Simulation unavailable: host operation is unavailable",
        "Simulation invalid-operation: unknown bridge operation"
    };
    /* All callers supply an enum value, never an unbounded host message. */
    curlin = origin;
    error(200 + code, messages[code]);
}

static int simulation_integer(VAR value, int minimum, int maximum, int code, heapptr origin)
{
    if (value.s.t == -1) simulation_error(code, origin);
    if (value.i.t == 0) {
        if (value.i.n < minimum || value.i.n > maximum) simulation_error(code, origin);
        return (int)value.i.n;
    }
    if (!isfinite(value.f) || value.f < minimum || value.f > maximum ||
        trunc(value.f) != value.f) simulation_error(code, origin);
    return (int)value.f;
}

/* Narrow intrinsic used by the ordinary library above. This is not a new
 * keyword, generic host-call facility or address lookup. The evaluator calls
 * it only at a normal FN expression boundary, preserving its original parser
 * and stack behavior for every other function name. */
int crisp_simulation_function(VAR *result)
{
    static const char name[] = "_crispSimulation";
    const size_t length = sizeof(name) - 1;
    if (!simulation_enabled || strncmp((const char *)esi, name, length) != 0 ||
        (esi[length] != '(' && esi[length] != ' ')) return 0;
    heapptr origin = crisp_simulation_origin(esi - 1);
    esi += length;
    if (nxt() != '(') error(16, NULL);
    esi++;
    VAR operation_value = expr();
    comma();
    VAR first = expr();
    comma();
    /* Strings may refer to the shared expression accumulator. Consume and
     * validate the final argument without evaluating another expression. */
    VAR second = expr();
    braket();
    int operation = simulation_integer(operation_value, 1, 5,
        CRISP_SIM_INVALID_OPERATION, origin);
    int argument1 = 0, argument2 = 0;
    if (operation <= 3) argument1 = simulation_integer(first, 0, 65535, CRISP_SIM_INVALID_PIN, origin);
    else if (operation == 4) argument1 = simulation_integer(first, 0, INT_MAX, CRISP_SIM_INVALID_TIME, origin);
    else (void)simulation_integer(first, 0, 0, CRISP_SIM_INVALID_OPERATION, origin);
    if (operation == 1) {
        if (second.s.t != -1) simulation_error(CRISP_SIM_INVALID_MODE, origin);
        const char *mode = (const char *)zero + second.s.p;
        if (second.s.l == 5 && memcmp(mode, "input", 5) == 0) argument2 = 0;
        else if (second.s.l == 6 && memcmp(mode, "output", 6) == 0) argument2 = 1;
        else if (second.s.l == 12 && memcmp(mode, "input-pullup", 12) == 0) argument2 = 2;
        else simulation_error(CRISP_SIM_INVALID_MODE, origin);
    } else if (operation == 2) {
        argument2 = simulation_integer(second, 0, 1, CRISP_SIM_INVALID_LEVEL, origin);
    } else {
        (void)simulation_integer(second, 0, 0, CRISP_SIM_INVALID_OPERATION, origin);
    }
    int reply = crisp_host_simulation_request(operation, argument1, argument2);
    if (reply < 0) simulation_error(-reply, origin);
    result->i.n = reply;
    result->i.t = 0;
    return 1;
}

void crisp_runtime_error(int code, const char *message, unsigned short line)
{
    failed = 1;
    /* A diagnostic from trusted library internals must never impersonate a
     * user line with the same number. Domain errors above use the saved
     * actual caller; any other internal-library error has no editor line. */
    if (simulation_enabled && in_simulation_library(errlin + (signed char *)zero)) line = 0;
    crisp_host_error(code, message ? message : "BASIC error", line);
}

void crisp_set_exit(int code)
{
    completed_exit = code & 255;
    crisp_host_exit(completed_exit);
}

/* Unsupported language features raise normal catchable BASIC errors. The
 * parent owns cancellation, deadlines and output limits, which cannot be
 * bypassed by a BASIC ON ERROR handler. */
static void unavailable(const char *message) { error(255, message); }

void oswrch(unsigned char byte)
{
    crisp_host_output(byte);
    if (vdu_left) {
        vdu_args[vdu_size - vdu_left--] = byte;
        if (!vdu_left) {
            if (vdu_command == 22) { modeno = vdu_args[0]; cursor_x = cursor_y = 0; }
            if (vdu_command == 31) { cursor_x = vdu_args[0]; cursor_y = vdu_args[1]; }
        }
        return;
    }
    if (byte >= 32) { if (byte != 127 && cursor_x < INT_MAX) cursor_x++; return; }
    static const unsigned char lengths[32] = {
        0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,5,0,0,1,9,8,5,0,1,4,4,0,2
    };
    vdu_command = byte;
    vdu_left = vdu_size = lengths[byte];
    switch (byte) {
    case 8: if (cursor_x) cursor_x--; break;
    case 9: if (cursor_x < INT_MAX) cursor_x++; break;
    case 10: if (cursor_y < INT_MAX) cursor_y++; break;
    case 11: if (cursor_y) cursor_y--; break;
    case 12: case 30: cursor_x = cursor_y = 0; break;
    case 13: cursor_x = 0; break;
    }
}

void getcsr(int *x, int *y) { if (x) *x = cursor_x; if (y) *y = cursor_y; }
int getmodeno(void) { return (unsigned char)modeno; }

static int read_input(void)
{
    int c = crisp_host_read_byte(-1);
    if (pending_lf) {
        pending_lf = 0;
        if (c == '\n') c = crisp_host_read_byte(-1);
    }
    if (c < 0) error(254, "End of input");
    return c;
}

void osline(char *buffer)
{
    crisp_host_input_event(0);
    size_t length = 0;
    for (;;) {
        int c = read_input();
        if (c == '\r' || c == '\n') {
            pending_lf = c == '\r';
            buffer[length] = '\r';
            return;
        }
        if (length >= 255) error(19, "Input line too long");
        if (c == 0) error(254, "NUL is not supported in line input");
        buffer[length++] = (char)c;
    }
}

unsigned char osrdch(void)
{
    crisp_host_input_event(1);
    return (unsigned char)read_input();
}

int oskey(int wait)
{
    if (wait < 0) return wait == -256 ? 's' : 0;
    uint32_t start = crisp_host_now_ms();
    uint32_t timeout = wait > INT_MAX / 10 ? INT_MAX : (uint32_t)wait * 10;
    for (;;) {
        uint32_t elapsed = crisp_host_now_ms() - start;
        int remaining = elapsed < timeout ? (int)(timeout - elapsed) : 0;
        int c = crisp_host_read_byte(remaining);
        if (c < 0) return -1;
        if (pending_lf) {
            pending_lf = 0;
            if (c == '\n') continue;
        }
        return c;
    }
}

int getime(void) { return (int)((crisp_host_now_ms() - time_origin) / 10u + time_offset); }
void putime(int n) { time_origin = crisp_host_now_ms(); time_offset = (uint32_t)n; }
void oswait(int cs)
{
    int milliseconds = cs <= 0 ? 0 : cs > INT_MAX / 10 ? INT_MAX : cs * 10;
    crisp_host_sleep_ms(milliseconds);
}
int getims(void) { unavailable("TIME$ is unavailable in the restricted host"); return 0; }

/* No event, timer, terminal or process state is imported. */
void trap(void) {}
heapptr xtrap(void) { return 0; }
void reset(void) {}
void quiet(void) {}
void faterr(const char *message) { error(255, message); }

/* These stubs are a second boundary behind the evaluator's runtime guards.
 * They never forward a name, path, address or byte sequence to the OS. */
void oscli(char *command) { (void)command; unavailable("OSCLI is unavailable in the restricted host"); }
void assemble(void) { unavailable("Assembler is unavailable in the restricted host"); }
void *sysadr(char *name) { (void)name; unavailable("SYS is unavailable in the restricted host"); return NULL; }
int oscall(int address) { (void)address; unavailable("Native calls are unavailable in the restricted host"); return 0; }
size_t guicall(void *function, PARM *arguments) { (void)function; (void)arguments; unavailable("Native calls are unavailable in the restricted host"); return 0; }
long long apicall_(void *function, PARM *arguments) { (void)function; (void)arguments; unavailable("Native calls are unavailable in the restricted host"); return 0; }
double fltcall_(void *function, PARM *arguments) { (void)function; (void)arguments; unavailable("Native calls are unavailable in the restricted host"); return 0; }
heapptr oshwm(void *address, int settop) { (void)address; (void)settop; unavailable("Memory resizing is unavailable in the restricted host"); return 0; }

void *osopen(int mode, char *name) { (void)mode; (void)name; unavailable("File I/O is unavailable in the restricted host"); return NULL; }
unsigned char osbget(void *channel, int *eof) { (void)channel; (void)eof; unavailable("File I/O is unavailable in the restricted host"); return 0; }
void osbput(void *channel, unsigned char byte) { (void)channel; (void)byte; unavailable("File I/O is unavailable in the restricted host"); }
long long getptr(void *channel) { (void)channel; unavailable("File I/O is unavailable in the restricted host"); return 0; }
long long getext(void *channel) { (void)channel; unavailable("File I/O is unavailable in the restricted host"); return 0; }
long long geteof(void *channel) { (void)channel; unavailable("File I/O is unavailable in the restricted host"); return 0; }
void setptr(void *channel, long long value) { (void)channel; (void)value; unavailable("File I/O is unavailable in the restricted host"); }
void setext(void *channel, long long value) { (void)channel; (void)value; unavailable("File I/O is unavailable in the restricted host"); }
void osshut(void *channel) { if (channel) unavailable("File I/O is unavailable in the restricted host"); }
void osload(char *name, void *destination, unsigned int size) { (void)name; (void)destination; (void)size; unavailable("File I/O is unavailable in the restricted host"); }
void ossave(char *name, void *source, unsigned int size) { (void)name; (void)source; (void)size; unavailable("File I/O is unavailable in the restricted host"); }

void sound(short channel, signed char amplitude, unsigned char pitch, unsigned char duration) { (void)channel; (void)amplitude; (void)pitch; (void)duration; unavailable("SOUND is unavailable in the restricted host"); }
void envel(signed char *parameters) { (void)parameters; unavailable("ENVELOPE is unavailable in the restricted host"); }
void mouse(int *x, int *y, int *buttons) { (void)x; (void)y; (void)buttons; unavailable("MOUSE is unavailable in the restricted host"); }
void mouseon(int cursor) { (void)cursor; unavailable("MOUSE is unavailable in the restricted host"); }
void mouseoff(void) { unavailable("MOUSE is unavailable in the restricted host"); }
void mouseto(int x, int y) { (void)x; (void)y; unavailable("MOUSE is unavailable in the restricted host"); }
int adval(int channel) { (void)channel; unavailable("ADVAL is unavailable in the restricted host"); return 0; }
int vtint(int x, int y) { (void)x; (void)y; unavailable("Graphics queries are unavailable in the restricted host"); return 0; }
int vpoint(int x, int y) { (void)x; (void)y; unavailable("Graphics queries are unavailable in the restricted host"); return 0; }
int vgetc(int x, int y) { (void)x; (void)y; unavailable("Screen queries are unavailable in the restricted host"); return 0; }
int widths(char *value, int length) { (void)value; (void)length; unavailable("Graphics queries are unavailable in the restricted host"); return 0; }

static int source_error(int code, const char *message, unsigned short line)
{
    crisp_runtime_error(code, message, line);
    return 0;
}

/* Load bounded bytes through the original BBCSDL tokenizer. Source preparation
 * does not implement a dialect, substitute keywords, or select capabilities. */
static int load_source(const unsigned char *source, unsigned int size,
    unsigned char *destination, size_t capacity)
{
    if (size > SOURCE_LIMIT) return source_error(0, "Source exceeds 4 MiB limit", 0);
    unsigned int offset = 0, previous = 0;
    unsigned char *limit = destination + capacity;
    while (offset < size) {
        unsigned int start = offset;
        while (offset < size && source[offset] != '\n') offset++;
        unsigned int length = offset - start;
        if (offset < size) offset++;
        while (length && source[start + length - 1] == '\r') length--;
        if (!length) continue;
        if (length > SOURCE_LINE_LIMIT) return source_error(19, "Source line exceeds 4096 bytes", 0);
        if (memchr(source + start, 0, length)) return source_error(16, "NUL in BASIC source", 0);
        char line[SOURCE_LINE_LIMIT + 2];
        memcpy(line, source + start, length);
        line[length] = 0;
        char *body = line;
        unsigned int number = 0;
        if (*body < '0' || *body > '9') return source_error(41, "Source must have increasing line numbers in 1..65279", 0);
        while (*body >= '0' && *body <= '9') {
            number = number * 10u + (unsigned int)(*body++ - '0');
            if (number > BASIC_LINE_MAX) return source_error(41, "Source line number exceeds 65279", 0);
        }
        if (number == 0 || number <= previous) return source_error(41, "Source must have increasing line numbers in 1..65279", 0);
        previous = number;
        while (*body == ' ' || *body == '\t') body++;
        int quoted = 0, comment = 0;
        for (char *p = body; *p; p++) {
            unsigned char c = (unsigned char)*p;
            if ((c < 32 && c != '\t') || c == 127) return source_error(16, "Control byte in BASIC source", number);
            if (!comment && c == '"') quoted = !quoted;
            if (!quoted && !comment && strncmp(p, "REM", 3) == 0 &&
                    (p == body || p[-1] == ' ' || p[-1] == ':')) comment = 1;
            if (!quoted && !comment && c >= 128) return source_error(16, "Non-ASCII byte outside a string or comment", number);
            if (!quoted && !comment && c == '\t') *p = ' ';
        }
        char tokenized[4 * SOURCE_LINE_LIMIT + 16];
        size_t body_length = strlen(body);
        body[body_length] = '\r'; body[body_length + 1] = 0;
        size_t token_length = (size_t)(lexan(body, tokenized, 1) - tokenized);
        if (token_length + 3 > 255) return source_error(19, "Tokenized BASIC line exceeds 255 bytes", number);
        if ((size_t)(limit - destination) <= token_length + 4) return source_error(0, "No room for BASIC program", number);
        *destination++ = (unsigned char)(token_length + 3);
        *destination++ = (unsigned char)number;
        *destination++ = (unsigned char)(number >> 8);
        memcpy(destination, tokenized, token_length);
        destination += token_length;
    }
    *destination = 0;
    return 1;
}

int crisp_run(const unsigned char *source, unsigned int length, int enable_simulation)
{
    if (started) {
        crisp_host_error(255, "A fresh WASM instance is required for every run", 0);
        return 1;
    }
    started = 1;
    if (enable_simulation != 0 && enable_simulation != 1) {
        source_error(255, "Invalid simulation capability flag", 0);
        return 1;
    }
    simulation_enabled = enable_simulation;
    if (length > SOURCE_LIMIT) {
        source_error(0, "Source exceeds 4 MiB limit", 0);
        return 1;
    }
    userRAM = calloc(1, BASIC_RAM_BYTES);
    if (!userRAM) {
        source_error(0, "Cannot allocate interpreter memory", 0);
        return 1;
    }
    userTOP = (char *)userRAM + BASIC_RAM_BYTES;
    progRAM = (char *)userRAM + PAGE_OFFSET;
    accs = userRAM;
    buff = (char *)userRAM + ACCSLEN;
    szCmdLine = (char *)progRAM - 0x100;
    szTempDir = szCmdLine - 0x100;
    szUserDir = szTempDir - 0x100;
    szLibrary = szUserDir - 0x100;
    szLoadDir = szLibrary - 0x100;
    /* These unexposed compatibility strings never describe host directories. */
    time_origin = crisp_host_now_ms();
    prand.l = time_origin;
    prand.h = prand.l == 0;
    rnd();
    liston = 0x30;
    if (load_source(source, length, progRAM, (unsigned char *)userTOP - (unsigned char *)progRAM) &&
        (!simulation_enabled || load_source(simulation_source, sizeof(simulation_source) - 1,
            simulation_library, sizeof(simulation_library)))) {
        if (simulation_enabled) libase = (heapptr)(simulation_library - (unsigned char *)zero);
        flags = 0;
        (void)basic(progRAM, userTOP, (void *)-1);
    }
    /* Instance memory is discarded by the worker owner after this returns. */
    free(userRAM);
    userRAM = NULL;
    return failed ? 1 : completed_exit;
}
