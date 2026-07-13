import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import DeliveryDashboardClient from './DeliveryDashboardClient';

export default async function DeliveryPage() {
  const session = await getSession();
  if (!session || !['admin', 'tech', 'delivery'].includes(session.role)) {
    redirect('/dashboard');
  }

  return <DeliveryDashboardClient userRole={session.role} />;
}
