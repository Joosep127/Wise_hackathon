import type { Worker } from "tesseract.js";

// Keep the short side legible on long receipts. Skip resizing when the
// original is already close to the target to avoid an extra image encode.
export async function prepareReceiptPhoto(file: File, forUpload = false): Promise<Blob> {
  if (!forUpload && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return file;
  if (forUpload && file.size < 300_000) return file;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const { naturalWidth: width, naturalHeight: height } = image;
    const scale = Math.min(1, Math.max(1400 / Math.min(width, height), Math.sqrt(3_000_000 / (width * height))));
    if (!forUpload && scale >= 0.9) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    try {
      return await new Promise<Blob>(resolve => canvas.toBlob(blob => resolve(blob && (!forUpload || blob.size < file.size) ? blob : file), "image/jpeg", forUpload ? 0.82 : 0.94));
    } finally {
      canvas.width = canvas.height = 0;
    }
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function createReceiptScanner(onProgress: (percent: number) => void) {
  let pending: Promise<Worker> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function release() {
    clearTimeout(timer);
    const current = pending;
    pending = undefined;
    void current?.then(worker => worker.terminate()).catch(() => {});
  }
  function idle() {
    clearTimeout(timer);
    timer = setTimeout(release, 90_000);
  }
  function acquire() {
    clearTimeout(timer);
    if (!pending) {
      const current = import("tesseract.js").then(({ createWorker }) => createWorker("eng", 1, {
        workerPath: "/ocr/worker.min.js", corePath: "/ocr", langPath: "/ocr",
        logger: m => { if (m.status === "recognizing text") onProgress(Math.round(100 * m.progress)); },
      }));
      pending = current;
      void current.catch(() => { if (pending === current) pending = undefined; });
    }
    return pending;
  }
  return { acquire, idle, release };
}
