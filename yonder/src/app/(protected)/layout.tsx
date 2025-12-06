import { getSession } from '@/lib/dal/authDal';
import { redirect } from 'next/navigation';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This will redirect to /login if user is not authenticated
  const session = await getSession();
  
  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main
        className="flex-1 min-h-0 overflow-hidden relative">
        {children}
      </main>
    </div>
  );
}