/* CrispBASIC source transport for the full SDL interpreter core.
 * Tokenisation is performed by BBCSDL's own lexan. Callers prepare explicit
 * increasing line numbers and Latin-1 source bytes. BSD-3-Clause. */
#ifndef CRISP_SDL_SOURCE_LOADER_H
#define CRISP_SDL_SOURCE_LOADER_H
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
extern char *lexan(char *, char *, unsigned char);
static int crisp_sdl_source_error(unsigned long line, const char *message)
{
    fprintf(stderr, "CrispBASIC SDL source line %lu: %s\n", line, message);
    return 0;
}
static int crisp_sdl_load_source(const char *filename, unsigned char *destination, size_t capacity)
{
    FILE *source = fopen(filename, "rb");
    char *line = NULL;
    size_t allocated = 0, total = 0, used = 0;
    unsigned long previous = 0;
    ssize_t length;
    int ok = 1;
    if (!source) return crisp_sdl_source_error(0, "Cannot open source file");
    while ((length = getline(&line, &allocated, source)) >= 0) {
        char *body, *end;
        unsigned long number;
        char input[4098], tokens[16400];
        size_t body_length, token_length;
        total += (size_t)length;
        if (total > (4u << 20)) { ok = crisp_sdl_source_error(previous, "Source exceeds 4 MiB"); break; }
        while (length && (line[length - 1] == '\n' || line[length - 1] == '\r')) --length;
        if (!length) continue;
        if (length > 4096 || memchr(line, 0, (size_t)length)) {
            ok = crisp_sdl_source_error(previous, "Invalid source line length or NUL byte"); break;
        }
        line[length] = 0;
        errno = 0;
        number = strtoul(line, &end, 10);
        if (errno || end == line || !number || number > 65279 || number <= previous) {
            ok = crisp_sdl_source_error(number, "Expected increasing line numbers in 1..65279"); break;
        }
        previous = number;
        body = end;
        while (*body == ' ' || *body == '\t') ++body;
        {
            int quoted = 0, comment = 0;
            for (char *p = body; *p; ++p) {
                unsigned char c = (unsigned char)*p;
                if ((c < 32 && c != '\t') || c == 127) {
                    ok = crisp_sdl_source_error(number, "Control byte in source"); break;
                }
                if (!comment && c == '"') quoted = !quoted;
                if (!quoted && !comment && !strncmp(p, "REM", 3) &&
                    (p == body || p[-1] == ' ' || p[-1] == ':')) comment = 1;
                if (!quoted && !comment && c >= 128) {
                    ok = crisp_sdl_source_error(number, "Non-ASCII byte outside string or comment"); break;
                }
                if (!quoted && !comment && c == '\t') *p = ' ';
            }
        }
        if (!ok) break;
        body_length = strlen(body);
        memcpy(input, body, body_length);
        input[body_length] = '\r'; input[body_length + 1] = 0;
        token_length = (size_t)(lexan(input, tokens, 1) - tokens);
        if (token_length + 3 > 255 || used + token_length + 4 >= capacity) {
            ok = crisp_sdl_source_error(number, "Tokenized line or program exceeds capacity"); break;
        }
        destination[used++] = (unsigned char)(token_length + 3);
        destination[used++] = (unsigned char)number;
        destination[used++] = (unsigned char)(number >> 8);
        memcpy(destination + used, tokens, token_length); used += token_length;
    }
    if (ferror(source)) ok = crisp_sdl_source_error(previous, "Error reading source");
    if (capacity) destination[used] = 0;
    free(line); fclose(source); return ok;
}
#endif
