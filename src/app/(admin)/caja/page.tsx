// ============================================
// SJ Lab — Caja / Cierre Redirect -> Tesorería
// ============================================

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CajaRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/tesoreria');
  }, [router]);

  return (
    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
      <p>Redirigiendo al módulo de Tesorería...</p>
    </div>
  );
}
