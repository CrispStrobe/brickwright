/* Original CrispBASIC code, BSD-3-Clause.
 * Executable overlay format v1: source, UTF-8 metadata, LE32 source length,
 * LE32 metadata length, 16-byte magic. It does not change BBCSDL tokenization.
 */
#ifndef CRISP_BUNDLE_H
#define CRISP_BUNDLE_H

#define CRISP_BUNDLE_FOOTER_SIZE 24
#define CRISP_BUNDLE_METADATA_LIMIT (1024 * 1024)
/* Retained in the ELF so packagers reject hosts without overlay support. */
const char crisp_bundle_host_abi[] = "CRISPBASIC-BUNDLE-HOST-V1";

static uint32_t crisp_bundle_u32(const unsigned char *p)
{
    return (uint32_t)p[0] | (uint32_t)p[1] << 8 |
           (uint32_t)p[2] << 16 | (uint32_t)p[3] << 24;
}

/* Return 1 for a bundle, 0 for an ordinary interpreter, -1 for corruption.
 * /proc/self/exe identifies the running ELF even after rename/unlink and does
 * not depend on cwd, PATH, argv[0], or writing an extracted source file.
 */
static int crisp_bundle_read(char **source, size_t *source_length, char **metadata)
{
    unsigned char footer[CRISP_BUNDLE_FOOTER_SIZE];
    static const unsigned char magic[16] = "CRISPBASICBNDL1\0";
    FILE *file = fopen("/proc/self/exe", "rb");
    if (!file) return 0;
    if (fseeko(file, 0, SEEK_END) != 0) { fclose(file); return 0; }
    off_t size = ftello(file);
    if (size < CRISP_BUNDLE_FOOTER_SIZE ||
        fseeko(file, -CRISP_BUNDLE_FOOTER_SIZE, SEEK_END) != 0 ||
        fread(footer, 1, sizeof footer, file) != sizeof footer) {
        fclose(file); return 0;
    }
    if (memcmp(footer + 8, magic, sizeof magic) != 0) { fclose(file); return 0; }
    uint32_t source_size = crisp_bundle_u32(footer);
    uint32_t metadata_size = crisp_bundle_u32(footer + 4);
    uint64_t payload_size = (uint64_t)source_size + metadata_size + sizeof footer;
    if (source_size > SOURCE_LIMIT || metadata_size > CRISP_BUNDLE_METADATA_LIMIT ||
        !metadata_size || payload_size > (uint64_t)size ||
        fseeko(file, size - (off_t)payload_size, SEEK_SET) != 0) {
        fclose(file); return -1;
    }
    char *program = malloc((size_t)source_size + 1);
    char *info = malloc((size_t)metadata_size + 1);
    if (!program || !info || fread(program, 1, source_size, file) != source_size ||
        fread(info, 1, metadata_size, file) != metadata_size) {
        free(program); free(info); fclose(file); return -1;
    }
    fclose(file);
    program[source_size] = 0;
    info[metadata_size] = 0;
    *source = program;
    *source_length = source_size;
    *metadata = info;
    return 1;
}

#endif
