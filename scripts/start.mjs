// Starter produksi: cari port kosong mulai dari PORT/3000 agar tidak EADDRINUSE
// bila server lama masih berjalan. Jalankan via `npm run start` atau `npm run dev`.
//
// Catatan soal alamat:
//   HOST default 0.0.0.0 = "dengarkan di semua antarmuka jaringan". Itu WAJIB
//   kalau mau diakses dari HP/LAN, container, atau layanan preview — tapi
//   0.0.0.0 bukan alamat yang bisa dibuka di browser. Karena itu skrip ini
//   mencetak localhost + IP LAN yang benar-benar bisa diklik/diketik.
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const START_PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const MAX_TRIES = 20;

function portFree(port) {
  return new Promise(resolve => {
    const s = createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, HOST);
  });
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const ni of list || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

let port = START_PORT;
while (!(await portFree(port))) {
  console.log(`⚠️  Port ${port} sudah dipakai (server lain masih berjalan), mencoba port berikutnya…`);
  port++;
  if (port > START_PORT + MAX_TRIES) {
    console.error(`❌ Tidak ada port kosong di ${START_PORT}–${START_PORT + MAX_TRIES}.`);
    process.exit(1);
  }
}
if (port !== START_PORT) console.log(`ℹ️  Server akan berjalan di port ${port}.`);

console.log(`\n🌐 Di komputer ini : http://localhost:${port}`);
if (HOST === "0.0.0.0" || HOST === "::") {
  for (const ip of lanAddresses()) console.log(`📱 Dari HP/LAN     : http://${ip}:${port}`);
  console.log("   (jangan buka http://0.0.0.0 — itu alamat bind, bukan alamat tujuan)\n");
} else {
  console.log("");
}

const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const mode = process.argv.includes("--dev") ? "dev" : "start";
const child = spawn(
  process.execPath,
  [nextBin, mode, "-H", HOST, "-p", String(port)],
  { cwd: root, stdio: "inherit" }
);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));
child.on("exit", code => process.exit(code ?? 0));
