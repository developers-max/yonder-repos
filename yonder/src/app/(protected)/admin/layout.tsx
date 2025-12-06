import { requireAdmin } from "@/lib/auth/admin-guard";
import { Sidebar } from "./components/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdmin();

  return (
    <div className="flex h-screen bg-white">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50 pt-14 md:pt-0">
        {children}
      </main>
    </div>
  );
}
