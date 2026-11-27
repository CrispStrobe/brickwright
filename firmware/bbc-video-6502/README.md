# BBC-style video on 6502

In Machines, open **6502 → BBC-style video on 6502**. Click the Controller screen and press **0–6** to change display modes. The 65C02 draws the title, colour bars, and bottom-right marker directly into screen RAM.

| Key | Active pixels | 8×8 cells | Logical colours | Screen RAM start |
| --- | --- | --- | --- | --- |
| 0 | 640×256 | 80×32 | 2 | `$3000` |
| 1 | 320×256 | 40×32 | 4 | `$3000` |
| 2 | 160×256 | 20×32 | 16 | `$3000` |
| 3 | 640×200 | 80×25 | 2 | `$4000` |
| 4 | 320×256 | 40×32 | 2 | `$5800` |
| 5 | 160×256 | 20×32 | 4 | `$5800` |
| 6 | 320×200 | 40×25 | 2 | `$6000` |

The scanout uses the BBC Micro's packed colour planes and interleaves eight raster lines within each byte column. The Controller presents the active image at 4:3. The 25-row layouts omit the historical blank rasters between text rows. [Acorn BBC Microcomputer Service Manual, §3.3](https://acorn.huininga.nl/pub/unsorted/manuals/BBC%20Microcomputer%20Service%20Manual-HTML/BBCServiceManual.html)

The lesson uses a virtual 2 MHz 65C02 with 32 KiB of RAM. Brickwright's mode register at `$8000` accepts 0–6 and blanks on any other value. At `$8001`, the high nibble selects a logical colour and bits 0–2 enable red, green and blue. The keyboard FIFO is readable at `$9004`. The framebuffer refreshes at 50 Hz. MOS, teletext, palette flashing and cycle-level video timing are outside this lesson's model.

Rebuild the BSD-3-Clause ROM from the repository root with ca65 and ld65.

```sh
ca65 -o /tmp/bbc-video-6502.o firmware/bbc-video-6502/main.s
ld65 -C firmware/bbc-video-6502/rom.cfg -o /tmp/bbc-video-6502.rom /tmp/bbc-video-6502.o
cmp /tmp/bbc-video-6502.rom overlay/scratch-gui/static/roms/bbc-video-6502.rom
```
