import { requireRealtor } from "@/lib/auth/realtor-guard";

export default async function RealtorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRealtor();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-3 md:px-4 py-3">
          <h1 className="text-sm md:text-base font-semibold text-gray-900">Realtor Panel</h1>
          <p className="text-[11px] md:text-xs text-gray-600">View and manage assigned outreach requests</p>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-3 md:p-4">
        {children}
      </main>
    </div>
  );
}
