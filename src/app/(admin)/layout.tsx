import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { AdminLayoutClient } from './AdminLayoutClient';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  if (session.role === 'client') {
    redirect('/portal');
  }

  return (
    <AdminLayoutClient userName={session.name} userRole={session.role}>
      {children}
    </AdminLayoutClient>
  );
}
