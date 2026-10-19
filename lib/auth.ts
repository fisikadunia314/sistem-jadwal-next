import crypto from "crypto";
import { cookies } from "next/headers";
import db from "./db";
const SECRET = "sistem-jadwal-next-secret";
export type User = { id: number; username: string; display_name: string; role: string; teacher_id: number | null };
export function makeToken(u: User): string {
  const payload = Buffer.from(JSON.stringify({ id: u.id, exp: Date.now() + 7 * 864e5 })).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export async function currentUser(): Promise<User | null> {
  const c = await cookies();
  const raw = c.get("sid")?.value;
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  const expect = crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (sig !== expect) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (data.exp < Date.now()) return null;
    return (db.prepare("SELECT id,username,display_name,role,teacher_id FROM users WHERE id=?").get(data.id) as User) || null;
  } catch { return null; }
}
