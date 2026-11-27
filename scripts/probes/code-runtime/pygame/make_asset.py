"""Create the probe's original 8x8 RGBA PNG using only the standard library."""

from pathlib import Path
import struct
import zlib


def chunk(kind, payload):
    return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))


def main():
    rows = []
    for y in range(8):
        row = bytearray([0])
        for x in range(8):
            if x in (0, 7) or y in (0, 7):
                pixel = (0, 0, 0, 0)
            elif (x, y) in ((2, 2), (5, 2)):
                pixel = (255, 255, 255, 255)
            else:
                pixel = (30, 190, 220, 255)
            row.extend(pixel)
        rows.append(row)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", 8, 8, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(b"".join(rows), level=9))
    png += chunk(b"IEND", b"")
    path = Path(__file__).resolve().parent / "assets" / "hero.png"
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(png)
    print(path)


if __name__ == "__main__":
    main()
