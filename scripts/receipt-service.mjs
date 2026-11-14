import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const runtime = path.join(root, ".sites-runtime");
mkdirSync(runtime, { recursive: true });
const executable = path.join(runtime, "receipt-vision");
execFileSync("xcrun", ["clang", "-fobjc-arc", "-O2", "-framework", "Foundation",
  "-framework", "Vision", "-framework", "ImageIO", "-framework", "CoreGraphics",
  path.join(root, "scripts/receipt-vision.m"), "-o", executable]);

let active = 0;
const limit = 8 * 1024 * 1024;
createServer(async (req, res) => {
  const finish = (status, body = "") => {
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
  };
  if (req.url !== "/scan" || req.method !== "POST") return finish(404);
  if (active >= 2) return finish(503);
  active++;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > limit) return finish(413);
      chunks.push(chunk);
    }
    const text = await new Promise((resolve, reject) => {
      const child = spawn(executable, [], { stdio: ["pipe", "pipe", "ignore"], timeout: 8000 });
      let output = "";
      child.stdout.setEncoding("utf8").on("data", chunk => { output += chunk; });
      child.once("error", reject);
      child.once("close", code => code === 0 ? resolve(output) : reject(new Error("Unreadable image")));
      child.stdin.on("error", reject);
      child.stdin.end(Buffer.concat(chunks, size));
    });
    finish(200, text);
  } catch {
    finish(422);
  } finally {
    active--;
  }
}).listen(8796, "127.0.0.1", () => console.log("Local receipt recognition is ready"));
