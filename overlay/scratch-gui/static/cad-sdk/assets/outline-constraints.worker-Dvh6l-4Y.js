const e = new URL("" + new URL("sketch-constraints.dart-qnZmeGSY.js", import.meta.url).href, import.meta.url);
self.onmessage = async ({ data: s }) => {
  try {
    await import(
      /* @vite-ignore */
      e.href
    ), self.postMessage(JSON.parse(solveBrickwrightOutline(JSON.stringify(s))));
  } catch {
    self.postMessage({ status: "unavailable" });
  }
};
