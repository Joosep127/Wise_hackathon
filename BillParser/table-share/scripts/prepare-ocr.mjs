import { copyFile, mkdir } from "node:fs/promises";
const dest = new URL("../public/ocr/", import.meta.url);
await mkdir(dest, { recursive: true });
for (const [source, name] of [
  ["tesseract.js/dist/worker.min.js", "worker.min.js"],
  ...["lstm", "simd-lstm", "relaxedsimd-lstm"].map(variant => {
    const name = `tesseract-core-${variant}.wasm.js`;
    return ["tesseract.js-core/" + name, name];
  }),
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
]) {
  await copyFile(new URL("../node_modules/" + source, import.meta.url), new URL(name, dest));
}
