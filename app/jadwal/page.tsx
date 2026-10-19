import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import Board from "@/components/Board";
export const dynamic = "force-dynamic";
export default async function JadwalPage() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return <Board />;
}
