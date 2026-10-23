import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import ResetClient from "./ResetClient";
export const dynamic = "force-dynamic";
export default async function Page() {
  const u = await currentUser();
  if (!u) redirect("/login");
  if (u.role !== "admin") redirect("/jadwal");
  return <ResetClient />;
}
