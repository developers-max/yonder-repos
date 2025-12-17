import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { usersTable } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function requireRealtor() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const [user] = await db
    .select({ role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, session.user.id))
    .limit(1);

  if (!user || (user.role !== "realtor" && user.role !== "admin")) {
    // Redirect non-realtor/non-admin users to chat
    redirect("/chat");
  }

  return session;
}
