// Starter produksi: cari port kosong mulai dari 3000 agar tidak EADDRINUSE
// bila server lama masih berjalan. Jalankan via `npm run start`.
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const START_PORT = Number(process.env.PORT || 3000);

function portFree(port) {
  return new Promise(resolve => {
    const s = createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "0.0.0.0");
  });
}

let port = START_PORT;
while (!(await portFree(port))) {
  console.log(`⚠️  Port ${port} sudah dipakai (server lain masih berjalan), mencoba port berikutnya…`);
  port++;
  if (port > START_PORT + 20) { console.error("❌ Tidak ada port kosong di kisaran yang dicoba."); process.exit(1); }
}
if (port !== START_PORT) console.log(`ℹ️  Server akan berjalan di port ${port}.`);
console.log(`🌐 Buka di browser: http://localhost:${port}`);

const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const mode = process.argv.includes("--dev") ? "dev" : "start";
const child = spawn(process.execPath, [nextBin, mode, "-H", "0.0.0.0", "-p", String(port)], { cwd: root, stdio: "inherit" });
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", code => process.exit(code ?? 0));
