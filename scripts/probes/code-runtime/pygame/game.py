"""Hand-authored deterministic pygame backend/packaging probe.

This is not output from the Brickwright compiler. It deliberately avoids fonts,
real input, audio, elapsed time, randomness, and GPU-dependent effects.
"""

import hashlib
import json
import os
from pathlib import Path
import sys

os.environ.setdefault("PYGAME_HIDE_SUPPORT_PROMPT", "1")
import pygame


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def run():
    pygame.init()
    screen = pygame.display.set_mode((96, 64))
    asset = Path(__file__).resolve().parent / "assets" / "hero.png"
    hero_image = pygame.image.load(str(asset)).convert_alpha()
    target = pygame.Rect(48, 28, 8, 8)
    trace = []
    resets = 0
    total_hits = 0

    def reset():
        return pygame.Rect(8, 28, 8, 8), 0, True

    hero, score, target_alive = reset()
    for frame in range(24):
        pygame.event.pump()
        if frame == 12:
            hero, score, target_alive = reset()
            resets += 1
        # Two identical authored play cycles, separated by a real state reset.
        if frame % 12 < 10:
            hero.x += 4
        if target_alive and hero.colliderect(target):
            score += 1
            total_hits += 1
            target_alive = False

        screen.fill((17, 23, 31))
        pygame.draw.rect(screen, (40, 50, 60), (0, 36, 96, 2))
        if target_alive:
            pygame.draw.rect(screen, (240, 65, 75), target)
        screen.blit(hero_image, hero)
        for index in range(score):
            pygame.draw.rect(screen, (255, 220, 40), (4 + index * 5, 4, 3, 3))
        pygame.display.flip()
        trace.append({
            "frame": frame,
            "x": hero.x,
            "score": score,
            "target_alive": target_alive,
            "resets": resets,
            "frame_sha256": hashlib.sha256(pygame.image.tobytes(screen, "RGBA")).hexdigest(),
        })

    assert trace[8]["score"] == 1
    assert trace[11]["score"] == 1
    assert trace[12]["score"] == 0 and trace[12]["target_alive"]
    assert trace[20]["score"] == 1 and total_hits == 2
    assert [item["frame_sha256"] for item in trace[:12]] == [item["frame_sha256"] for item in trace[12:]]
    result = {
        "schema": 1,
        "fixture": "authored-move-collide-score-restart",
        "size": list(screen.get_size()),
        "asset_sha256": hashlib.sha256(asset.read_bytes()).hexdigest(),
        "hits": total_hits,
        "resets": resets,
        "frames": trace,
        "trace_sha256": hashlib.sha256(canonical(trace).encode()).hexdigest(),
    }
    metadata = {
        "python": sys.version.split()[0],
        "pygame_ce": pygame.version.ver,
        "sdl": list(pygame.get_sdl_version()),
        "video_driver": pygame.display.get_driver(),
        "frozen": bool(getattr(sys, "frozen", False)),
        "executable": sys.executable,
        "bundle_root": getattr(sys, "_MEIPASS", None),
        "path_env": os.environ.get("PATH"),
        "python_search_path": list(sys.path),
        "pygame_module": pygame.__file__,
        "mapped_libpython": sorted({
            line.split()[-1]
            for line in Path("/proc/self/maps").read_text().splitlines()
            if "libpython" in line and line.split()[-1].startswith("/")
        }),
    }
    pygame.quit()
    print(canonical({"result": result, "metadata": metadata}))


if __name__ == "__main__":
    run()
