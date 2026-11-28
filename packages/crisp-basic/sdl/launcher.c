/* CrispBASIC full SDL bundle launcher. Original implementation, BSD-3-Clause.
 * Extract regular files privately, preserve caller cwd, wait and clean up. */
#define _GNU_SOURCE
#include <sys/types.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <dirent.h>
#include <errno.h>
#include <signal.h>
#include <limits.h>
static const unsigned char marker[16] = "CRISPSDLBNDL1";
static volatile sig_atomic_t child_pid;
static void forward_signal(int signo) { if (child_pid > 0) kill((pid_t)child_pid, signo); }
static uint32_t u32(const unsigned char *p) {
    return (uint32_t)p[0] | (uint32_t)p[1] << 8 | (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}
static uint64_t u64(const unsigned char *p) { return u32(p) | (uint64_t)u32(p + 4) << 32; }
static int read_all(FILE *f, void *p, size_t n) { return fread(p, 1, n, f) == n; }
static int safe_path(const char *path) {
    const char *part = path;
    if (!*path || *path == '/' || strchr(path, '\\')) return 0;
    for (const char *p = path; ; ++p) {
        if (*p && (unsigned char)*p < 32) return 0;
        if (!*p || *p == '/') {
            size_t n = (size_t)(p - part);
            if (!n || (n == 1 && *part == '.') || (n == 2 && part[0] == '.' && part[1] == '.')) return 0;
            if (!*p) return 1;
            part = p + 1;
        }
    }
}
static int parents(char *path, size_t start) {
    for (char *p = path + start; *p; ++p) if (*p == '/') {
        *p = 0; int result = mkdir(path, 0700); *p = '/';
        if (result && errno != EEXIST) return 0;
    }
    return 1;
}
static void remove_tree(const char *path) {
    struct stat info;
    if (lstat(path, &info)) return;
    if (!S_ISDIR(info.st_mode)) { unlink(path); return; }
    DIR *dir = opendir(path);
    if (!dir) return;
    struct dirent *entry;
    while ((entry = readdir(dir))) {
        if (!strcmp(entry->d_name, ".") || !strcmp(entry->d_name, "..")) continue;
        char *next = NULL;
        if (asprintf(&next, "%s/%s", path, entry->d_name) < 0) continue;
        remove_tree(next); free(next);
    }
    closedir(dir); rmdir(path);
}
static int extract(FILE *file, uint64_t bytes, const char *root) {
    unsigned char header[16], buffer[65536];
    if (bytes < 4 || !read_all(file, header, 4)) return 0;
    uint32_t count = u32(header); bytes -= 4;
    if (count > 10000) return 0;
    for (uint32_t i = 0; i < count; ++i) {
        if (bytes < 16 || !read_all(file, header, 16)) return 0;
        bytes -= 16;
        uint32_t pathlen = u32(header), mode = u32(header + 4);
        uint64_t size = u64(header + 8);
        char name[1025], *path = NULL;
        if (!pathlen || pathlen > 1024 || size > bytes || pathlen > bytes - size ||
            !read_all(file, name, pathlen)) return 0;
        name[pathlen] = 0;
        if (strlen(name) != pathlen || !safe_path(name) || (mode != 0600 && mode != 0700)) return 0;
        bytes -= pathlen + size;
        if (asprintf(&path, "%s/%s", root, name) < 0) return 0;
        if (!parents(path, strlen(root) + 1)) { free(path); return 0; }
        int fd = open(path, O_WRONLY | O_CREAT | O_EXCL | O_NOFOLLOW, mode);
        free(path);
        if (fd < 0) return 0;
        while (size) {
            size_t amount = size < sizeof(buffer) ? (size_t)size : sizeof(buffer);
            if (!read_all(file, buffer, amount)) { close(fd); return 0; }
            size_t written = 0;
            while (written < amount) {
                ssize_t n = write(fd, buffer + written, amount - written);
                if (n < 0 && errno == EINTR) continue;
                if (n <= 0) { close(fd); return 0; }
                written += (size_t)n;
            }
            size -= amount;
        }
        if (close(fd)) return 0;
    }
    return bytes == 0;
}
int main(int argc, char **argv) {
    FILE *file = fopen("/proc/self/exe", "rb");
    unsigned char footer[32];
    char *directory = NULL, *runtime = NULL, *source = NULL, *libraries = NULL, *working_directory = NULL;
    int result = 125, created = 0;
    if (!file || fseeko(file, 0, SEEK_END)) goto fail;
    off_t total = ftello(file);
    if (total < 32 || fseeko(file, total - 32, SEEK_SET) || !read_all(file, footer, 32) ||
        memcmp(footer, marker, 16)) goto fail;
    uint64_t payload = u64(footer + 16), metadata = u64(footer + 24);
    if (payload > (512u << 20) || metadata > (8u << 20) || payload + metadata > (uint64_t)total - 32) goto fail;
    if (argc == 2 && !strcmp(argv[1], "--bundle-info")) {
        if (fseeko(file, total - 32 - (off_t)metadata, SEEK_SET)) goto fail;
        while (metadata--) { int c = fgetc(file); if (c == EOF) goto fail; putchar(c); }
        putchar('\n'); fclose(file); return 0;
    }
    const char *tmp = getenv("TMPDIR");
    if (!tmp || !*tmp) tmp = "/tmp";
    if (asprintf(&directory, "%s/crispbasic-sdl-XXXXXX", tmp) < 0) goto fail;
    if (!mkdtemp(directory)) goto fail;
    created = 1;
    char *absolute_directory = realpath(directory, NULL);
    if (!absolute_directory) goto fail;
    free(directory); directory = absolute_directory;
    if (fseeko(file, total - 32 - (off_t)metadata - (off_t)payload, SEEK_SET) ||
        !extract(file, payload, directory)) goto fail;
    fclose(file); file = NULL;
    if (asprintf(&runtime, "%s/runtime/bbcsdl", directory) < 0 ||
        asprintf(&source, "%s/program/main.bas", directory) < 0 ||
        asprintf(&libraries, "%s/runtime%s%s", directory,
            getenv("LD_LIBRARY_PATH") ? ":" : "", getenv("LD_LIBRARY_PATH") ? getenv("LD_LIBRARY_PATH") : "") < 0) goto fail;
    if (strlen(source) > 240) { fprintf(stderr, "CrispBASIC: TMPDIR path is too long for the SDL host\n"); goto fail; }
    working_directory = getcwd(NULL, 0);
    if (!working_directory) goto fail;
    /* Explicit emulator argv for cross-target qualification, without a shell. */
    const char *runner = getenv("CRISP_BASIC_SDL_RUNNER_EXE");
    unsigned long runner_count = 0;
    if (runner && *runner) {
        const char *count_text = getenv("CRISP_BASIC_SDL_RUNNER_ARGC"); char *end;
        if (!count_text) count_text = "0";
        errno = 0; runner_count = strtoul(count_text, &end, 10);
        if (errno || *end || runner_count > 64) goto fail;
    } else runner = NULL;
    size_t offset = runner ? runner_count + 1 : 0;
    char **arguments = calloc((size_t)argc + 2 + offset, sizeof(char *));
    if (!arguments) goto fail;
    if (runner) {
        arguments[0] = (char *)runner;
        for (unsigned long i = 0; i < runner_count; ++i) {
            char name[64]; snprintf(name, sizeof(name), "CRISP_BASIC_SDL_RUNNER_ARG_%lu", i);
            arguments[i + 1] = getenv(name);
            if (!arguments[i + 1]) { free(arguments); goto fail; }
        }
    }
    arguments[offset] = runtime; arguments[offset + 1] = source;
    for (int i = 1; i < argc; ++i) arguments[offset + i + 1] = argv[i];
    struct sigaction action = {0};
    action.sa_handler = forward_signal; sigemptyset(&action.sa_mask);
    sigaction(SIGINT, &action, NULL); sigaction(SIGTERM, &action, NULL); sigaction(SIGHUP, &action, NULL);
    pid_t child = fork();
    if (!child) {
        signal(SIGINT, SIG_DFL); signal(SIGTERM, SIG_DFL); signal(SIGHUP, SIG_DFL);
        setenv("CRISP_BASIC_SOURCE", source, 1);
        setenv("CRISP_BASIC_PROGRAM_PATH", source, 1);
        setenv("CRISP_BASIC_BATCH", "1", 1);
        setenv("CRISP_BASIC_CWD", working_directory, 1);
        setenv("LD_LIBRARY_PATH", libraries, 1);
        if (runner) execvp(runner, arguments); else execv(runtime, arguments);
        perror("CrispBASIC SDL runtime"); _exit(126);
    }
    free(arguments);
    if (child < 0) goto fail;
    child_pid = child;
    int status;
    while (waitpid(child, &status, 0) < 0) if (errno != EINTR) goto fail;
    child_pid = 0;
    result = WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
    goto done;
fail:
    fprintf(stderr, "CrispBASIC: invalid full SDL bundle or failed extraction/launch\n");
done:
    if (file) fclose(file);
    if (created) remove_tree(directory);
    free(directory); free(runtime); free(source); free(libraries); free(working_directory);
    return result;
}
