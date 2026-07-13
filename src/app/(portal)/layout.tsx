import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { PortalLayoutClient } from './PortalLayoutClient';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  if (session.role !== 'client') {
    redirect('/dashboard');
  }

  return (
    <PortalLayoutClient
      userName={session.name}
      clinicName={session.clinicName}
      mustChangePassword={session.mustChangePassword || false}
    >
      {children}
    </PortalLayoutClient>
  );
}

