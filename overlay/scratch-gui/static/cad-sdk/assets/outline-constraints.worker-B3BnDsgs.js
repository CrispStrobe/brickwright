const t = new URL("" + new URL("sketch-constraints.dart-OdXIy9LT.js", import.meta.url).href, import.meta.url);
let s;
self.onmessage = async ({ data: e }) => {
  try {
    await (s ?? (s = import(
      /* @vite-ignore */
      t.href
    ))), self.postMessage(JSON.parse(solveBrickwrightOutline(JSON.stringify(e))));
  } catch {
    self.postMessage({ status: "unavailable" });
  }
};
