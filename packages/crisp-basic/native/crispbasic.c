/* CrispBASIC native batch host, 2026.
 * Runs the pinned BBCSDL interpreter; it does not implement a BASIC dialect.
 * One process owns one interpreter. This trusted local backend is not a sandbox.
 */
#define _GNU_SOURCE
#include <errno.h>
#include <limits.h>
#include <poll.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/mman.h>
#include <unistd.h>
#include "bbccon.h"

#if !defined(__linux__) || !(defined(__x86_64__) || defined(__aarch64__) || defined(__arm__))
#error "CrispBASIC native requires Linux x64, ARM64 or ARMv7 hard-float"
#endif
#ifdef __arm__
#if __ARM_ARCH < 7 || !defined(__ARM_PCS_VFP)
#error "The 32-bit ARM port requires ARMv7-A with the hard-float ABI"
#endif
_Static_assert(sizeof(void *) == 4, "ARMv7 requires the 32-bit upstream layout");
#else
_Static_assert(sizeof(void *) == 8, "x64 and ARM64 require the 64-bit upstream layout");
#endif

#define SOURCE_LINE_LIMIT 4096
#define SOURCE_LIMIT (4 * 1024 * 1024)
#define BASIC_LINE_MAX 65279

extern int entry(void *);
extern char *lexan(char *, char *, unsigned char);
extern void error(int, const char *);
extern unsigned char errnum;
extern intptr_t MaximumRAM;
extern void *crisp_find_mapping(uintptr_t);
extern unsigned int GetTicks(void);
extern char *szCmdLine, *szLoadDir, *szLibrary, *szUserDir, *szTempDir;

static int failed = 0, failure_code = 0, failure_line = 0, completed_exit = 0;
static char failure_message[1024];
static int cursor_x = 0, cursor_y = 0, vdu_command = 0, vdu_left = 0, vdu_size = 0;
static unsigned char vdu_args[9];
static int pending_lf = 0;

/* Called only for an unhandled interpreter error, after ON ERROR processing. */
void crisp_runtime_error(int code, const char *message, unsigned short line)
{
    failed = 1;
    failure_code = code;
    failure_line = line;
    snprintf(failure_message, sizeof failure_message, "%s", message ? message : "BASIC error");
}

void crisp_set_exit(int code) { completed_exit = code; }

static void json_string(FILE *stream, const char *value)
{
    fputc('"', stream);
    for (const unsigned char *p = (const unsigned char *) value; *p; ++p) {
        if (*p == '"' || *p == '\\') { fputc('\\', stream); fputc(*p, stream); }
        else if (*p < 32 || *p >= 127) fprintf(stream, "\\u%04x", *p);
        else fputc(*p, stream);
    }
    fputc('"', stream);
}

#ifdef CRISP_BUNDLE
/* Standalone bundle: the program is appended to this executable (see
 * src/bundle.mjs). There is no parent process and no descriptor-3 protocol;
 * an unhandled error is reported on stderr in the CLI's own format. */
static const char *bundle_filename = "program.bas";
static unsigned int *bundle_map = NULL; /* pairs: BASIC line, editor line */
static unsigned long bundle_map_count = 0;
static FILE *protocol(void) { return NULL; }
#else
static FILE *protocol(void)
{
    /* dup keeps each event independent from the lifetime of descriptor 3. */
    int fd = dup(3);
    return fd < 0 ? NULL : fdopen(fd, "w");
}
#endif

static void input_event(const char *method)
{
    FILE *stream = protocol();
    if (!stream) return;
    fprintf(stream, "{\"type\":\"input\",\"version\":1,\"method\":\"%s\"}\n", method);
    fclose(stream);
}

static void result_event(void)
{
#ifdef CRISP_BUNDLE
    if (failed) {
        unsigned int line = 0;
        for (unsigned long i = 0; i < bundle_map_count; ++i)
            if (bundle_map[2 * i] == (unsigned int)failure_line) { line = bundle_map[2 * i + 1]; break; }
        if (line) fprintf(stderr, "CrispBASIC: %s:%u: %s\n", bundle_filename, line, failure_message);
        else fprintf(stderr, "CrispBASIC: %s: %s\n", bundle_filename, failure_message);
    }
    return;
#endif
    FILE *stream = protocol();
    if (!stream) return;
    fprintf(stream, "{\"type\":\"result\",\"version\":1,\"status\":\"%s\",\"exitCode\":%d",
            failed ? "error" : "completed", failed ? 1 : (completed_exit & 255));
    if (failed) {
        fprintf(stream, ",\"error\":{\"code\":%d,\"message\":", failure_code);
        json_string(stream, failure_message);
        fprintf(stream, ",\"basicLine\":%d}", failure_line);
    }
    fputs("}\n", stream);
    fclose(stream);
}

/* The upstream console translates VDU to ANSI. CrispBASIC streams the original
 * bytes for a host renderer, retaining basic text cursor queries locally. */
void oswrch(unsigned char byte)
{
    if (fwrite(&byte, 1, 1, stdout) != 1) error(189, "Output stream closed");
    if (vdu_left) {
        vdu_args[vdu_size - vdu_left--] = byte;
        if (!vdu_left) {
            if (vdu_command == 22) { modeno = vdu_args[0]; cursor_x = cursor_y = 0; }
            if (vdu_command == 31) { cursor_x = vdu_args[0]; cursor_y = vdu_args[1]; }
        }
        return;
    }
    if (byte >= 32) { if (byte != 127) cursor_x++; return; }
    static const unsigned char lengths[32] = {
        0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,2,5,0,0,1,9,8,5,0,1,4,4,0,2
    };
    vdu_command = byte;
    vdu_left = vdu_size = lengths[byte];
    switch (byte) {
    case 8: if (cursor_x) cursor_x--; break;
    case 9: cursor_x++; break;
    case 10: cursor_y++; break;
    case 11: if (cursor_y) cursor_y--; break;
    case 12: case 30: cursor_x = cursor_y = 0; break;
    case 13: cursor_x = 0; break;
    }
}

void getcsr(int *x, int *y)
{
    if (x) *x = cursor_x;
    if (y) *y = cursor_y;
}

static int read_input(void)
{
    int c = fgetc(stdin);
    if (pending_lf) {
        pending_lf = 0;
        if (c == '\n') c = fgetc(stdin);
    }
    if (c == EOF) error(254, ferror(stdin) ? "Input stream failed" : "End of input");
    return c;
}

void osline(char *buffer)
{
    input_event("line");
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
        buffer[length++] = (char) c;
    }
}

unsigned char osrdch(void)
{
    input_event("key");
    return (unsigned char) read_input();
}

int oskey(int wait)
{
    if (wait < 0) return wait == -256 ? 's' : 0;
    unsigned int start = GetTicks();
    unsigned int timeout = wait > INT_MAX / 10 ? INT_MAX : (unsigned int)wait * 10;
    for (;;) {
        unsigned int elapsed = GetTicks() - start;
        int remaining = elapsed < timeout ? (int)(timeout - elapsed) : 0;
        struct pollfd pfd = { STDIN_FILENO, POLLIN, 0 };
        int available = poll(&pfd, 1, remaining);
        if (available < 0 && errno == EINTR) continue;
        if (available < 0) error(254, "Input stream failed");
        if (!available) return -1;
        int c = fgetc(stdin);
        if (c == EOF) {
            if (ferror(stdin)) error(254, "Input stream failed");
            return -1; /* INKEY is a query; a closed stream has no key. */
        }
        if (pending_lf) {
            pending_lf = 0;
            if (c == '\n') continue; /* Repoll within the original deadline. */
        }
        return c;
    }
}

/* Sound is advertised as unsupported. Do not silently accept a no-op. */
void sound(short channel, signed char amplitude, unsigned char pitch, unsigned char duration)
{
    (void)channel; (void)amplitude; (void)pitch; (void)duration;
    error(255, "SOUND is not available in the CrispBASIC native backend");
}

void envel(signed char *parameters)
{
    (void)parameters;
    error(255, "ENVELOPE is not available in the CrispBASIC native backend");
}

static int source_error(int code, const char *message, unsigned short line)
{
    crisp_runtime_error(code, message, line);
    return 0;
}

/* Loading through the actual upstream tokenizer preserves BBCSDL semantics.
 * The JS frontend supplies explicit, increasing line numbers and Latin-1. */
static int load_source_stream(FILE *source)
{
    char *line = NULL;
    size_t capacity = 0, total = 0;
    unsigned int previous = 0;
    unsigned char *destination = progRAM;
    ssize_t length;
    int ok = 1;
    while ((length = getline(&line, &capacity, source)) >= 0) {
        total += (size_t) length;
        if (total > SOURCE_LIMIT) { ok = source_error(0, "Source exceeds 4 MiB limit", 0); break; }
        while (length && (line[length - 1] == '\n' || line[length - 1] == '\r')) --length;
        if (!length) continue;
        if (length > SOURCE_LINE_LIMIT) { ok = source_error(19, "Source line exceeds 4096 bytes", 0); break; }
        if (memchr(line, 0, (size_t)length)) { ok = source_error(16, "NUL in BASIC source", 0); break; }
        line[length] = 0;
        char *body;
        errno = 0;
        unsigned long number = strtoul(line, &body, 10);
        if (errno || body == line || number == 0 || number > BASIC_LINE_MAX || number <= previous) {
            ok = source_error(41, "Source must have increasing line numbers in 1..65279", 0); break;
        }
        previous = (unsigned int)number;
        while (*body == ' ' || *body == '\t') ++body;
        int quoted = 0, comment = 0;
        for (char *p = body; *p; ++p) {
            unsigned char c = (unsigned char)*p;
            if ((c < 32 && c != '\t') || c == 127) {
                ok = source_error(16, "Control byte in BASIC source", (unsigned short)number); break;
            }
            if (!comment && c == '"') quoted = !quoted;
            if (!quoted && !comment && strncmp(p, "REM", 3) == 0 &&
                (p == body || p[-1] == ' ' || p[-1] == ':')) comment = 1;
            if (!quoted && !comment && c >= 128) {
                ok = source_error(16, "Non-ASCII byte outside a string or comment", (unsigned short)number); break;
            }
            if (!quoted && !comment && c == '\t') *p = ' ';
        }
        if (!ok) break;
        char input[SOURCE_LINE_LIMIT + 2];
        char tokenized[4 * SOURCE_LINE_LIMIT + 16];
        size_t body_length = strlen(body);
        memcpy(input, body, body_length);
        input[body_length] = '\r'; input[body_length + 1] = 0;
        size_t token_length = (size_t)(lexan(input, tokenized, 1) - tokenized);
        if (token_length + 3 > 255) {
            ok = source_error(19, "Tokenized BASIC line exceeds 255 bytes", (unsigned short)number); break;
        }
        if (destination + token_length + 4 >= (unsigned char *)userTOP) {
            ok = source_error(0, "No room for BASIC program", (unsigned short)number); break;
        }
        *destination++ = (unsigned char)(token_length + 3);
        *destination++ = (unsigned char)number;
        *destination++ = (unsigned char)(number >> 8);
        memcpy(destination, tokenized, token_length);
        destination += token_length;
    }
    if (ferror(source)) ok = source_error(189, "Failed reading BASIC source", 0);
    *destination = 0;
    free(line);
    fclose(source);
    return ok;
}

#ifndef CRISP_BUNDLE
static int load_source(const char *filename)
{
    FILE *source = fopen(filename, "rb");
    if (!source) return source_error(214, "Cannot open BASIC source", 0);
    return load_source_stream(source);
}
#else
#define BUNDLE_MAGIC "CRISPBASICBUNDLE"
static unsigned char *bundle_payload = NULL;

static unsigned long long le64(const unsigned char *p)
{
    unsigned long long v = 0;
    for (int i = 7; i >= 0; --i) v = (v << 8) | p[i];
    return v;
}

/* Payload: "CRISPBASIC-BUNDLE 1\n", "filename <name>\n", "map <n>\n" then n
 * "basic editor\n" lines, "source <bytes>\n" <numbered source>, "notices <bytes>\n"
 * <text>. Trailer: payload length (u64 LE) then the 16-byte magic. */
static int load_bundle(void)
{
    FILE *self = fopen("/proc/self/exe", "rb");
    if (!self) return source_error(214, "Cannot open bundled executable", 0);
    unsigned char trailer[24];
    if (fseek(self, -24, SEEK_END) || fread(trailer, 1, 24, self) != 24 ||
        memcmp(trailer + 8, BUNDLE_MAGIC, 16)) {
        fclose(self);
        return source_error(214, "No CrispBASIC program is bundled in this executable", 0);
    }
    unsigned long long length = le64(trailer);
    long end = ftell(self);
    if (length > SOURCE_LIMIT * 4ULL || (long long)length > end - 24 ||
        fseek(self, end - 24 - (long)length, SEEK_SET)) {
        fclose(self);
        return source_error(214, "Corrupt CrispBASIC bundle", 0);
    }
    bundle_payload = malloc(length + 1);
    if (!bundle_payload || fread(bundle_payload, 1, length, self) != length) {
        fclose(self);
        return source_error(214, "Cannot read CrispBASIC bundle", 0);
    }
    fclose(self);
    bundle_payload[length] = 0;
    char *p = (char *)bundle_payload, *limit = (char *)bundle_payload + length;
    char *eol = memchr(p, '\n', limit - p);
    if (!eol || strncmp(p, "CRISPBASIC-BUNDLE 1\n", 20)) return source_error(214, "Unsupported CrispBASIC bundle", 0);
    p = eol + 1;
    eol = memchr(p, '\n', limit - p);
    if (!eol || strncmp(p, "filename ", 9)) return source_error(214, "Corrupt CrispBASIC bundle", 0);
    *eol = 0; bundle_filename = p + 9; p = eol + 1;
    char *after;
    if (strncmp(p, "map ", 4)) return source_error(214, "Corrupt CrispBASIC bundle", 0);
    bundle_map_count = strtoul(p + 4, &after, 10);
    if (*after != '\n' || bundle_map_count > BASIC_LINE_MAX) return source_error(214, "Corrupt CrispBASIC bundle", 0);
    p = after + 1;
    bundle_map = calloc(bundle_map_count ? bundle_map_count * 2 : 1, sizeof *bundle_map);
    if (!bundle_map) return source_error(0, "No room", 0);
    for (unsigned long i = 0; i < bundle_map_count; ++i) {
        bundle_map[2 * i] = (unsigned int)strtoul(p, &after, 10);
        if (*after != ' ') return source_error(214, "Corrupt CrispBASIC bundle", 0);
        bundle_map[2 * i + 1] = (unsigned int)strtoul(after + 1, &after, 10);
        if (*after != '\n') return source_error(214, "Corrupt CrispBASIC bundle", 0);
        p = after + 1;
    }
    if (strncmp(p, "source ", 7)) return source_error(214, "Corrupt CrispBASIC bundle", 0);
    unsigned long size = strtoul(p + 7, &after, 10);
    if (*after != '\n' || size > (unsigned long)(limit - after - 1)) return source_error(214, "Corrupt CrispBASIC bundle", 0);
    p = after + 1;
    if (getenv("CRISPBASIC_BUNDLE_NOTICES")) {
        char *notices = p + size;
        if (strncmp(notices, "notices ", 8) == 0) {
            unsigned long n = strtoul(notices + 8, &after, 10);
            if (*after == '\n' && n <= (unsigned long)(limit - after - 1)) fwrite(after + 1, 1, n, stderr);
        }
        exit(0);
    }
    if (size == 0) return 1; /* An empty program runs and completes. */
    FILE *source = fmemopen(p, size, "rb");
    if (!source) return source_error(214, "Cannot read bundled BASIC source", 0);
    return load_source_stream(source);
}
#endif

int main(int argc, char **argv)
{
#ifdef CRISP_BUNDLE
    (void)argc; (void)argv;
#else
    if (argc != 2) {
        fprintf(stderr, "Usage: crispbasic-native numbered-program.bas\n");
        return 2;
    }
#endif
    setvbuf(stdout, NULL, _IONBF, 0);
    setvbuf(stdin, NULL, _IONBF, 0);
    /* Isolated local native backend, including upstream's native SYS/CALL.
     * A future WASM backend will use a separate restricted host implementation. */
    MaximumRAM = DEFAULT_RAM;
    void *base = crisp_find_mapping((uintptr_t)MaximumRAM);
    userRAM = base ? mmap(base, (size_t)MaximumRAM, PROT_READ | PROT_WRITE | PROT_EXEC,
                         MAP_PRIVATE | MAP_ANONYMOUS | MAP_FIXED_NOREPLACE, -1, 0) : MAP_FAILED;
    if (userRAM == MAP_FAILED) {
        userRAM = NULL;
        source_error(0, "Cannot allocate interpreter memory", 0);
        result_event();
        return 1;
    }
    userTOP = (char *)userRAM + MaximumRAM;
    progRAM = (char *)userRAM + PAGE_OFFSET;
    szCmdLine = (char *)progRAM - 0x100;
    szTempDir = szCmdLine - 0x100;
    szUserDir = szTempDir - 0x100;
    szLibrary = szUserDir - 0x100;
    szLoadDir = szLibrary - 0x100;
    strcpy(szLoadDir, "./"); strcpy(szLibrary, "./");
    strcpy(szUserDir, "./"); strcpy(szTempDir, "./");
    *szCmdLine = 0;
    platform = sizeof(void *) == 8 ? 0x41 : 1; /* Linux; upstream bit 6 denotes 64-bit. */
    liston = 0x30;
#ifdef CRISP_BUNDLE
    if (load_bundle()) {
#else
    if (load_source(argv[1])) {
#endif
        flags = 0;
        (void)entry((void *)-1);
    }
    result_event();
    munmap(userRAM, (size_t)MaximumRAM);
    return failed ? 1 : (completed_exit & 255);
}
