// ============================================
// SJ Lab — Portal Layout Client
// ============================================

'use client';

import { useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ToastProvider } from '@/components/ui/Toast';
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal';
import styles from './portal-layout.module.css';

interface PortalLayoutClientProps {
  userName: string;
  clinicName: string | null;
  mustChangePassword: boolean;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { label: 'Mis Pedidos', href: '/portal' },
  { label: 'Mi Cuenta', href: '/portal/account' },
];

export function PortalLayoutClient({
  userName,
  clinicName,
  mustChangePassword,
  children,
}: PortalLayoutClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [showPasswordModal, setShowPasswordModal] = useState(mustChangePassword);
  const [showOptionalPasswordModal, setShowOptionalPasswordModal] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const handleForcedPasswordSuccess = useCallback(() => {
    setShowPasswordModal(false);
    // Reload to get fresh session
    router.refresh();
  }, [router]);

  const handleOptionalPasswordSuccess = useCallback(() => {
    setShowOptionalPasswordModal(false);
  }, []);

  return (
    <ToastProvider>
      <div className={styles.layout}>
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.logo}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="7" fill="#111" />
                <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif">SJ</text>
              </svg>
            </div>
            <div className={styles.headerInfo}>
              <span className={styles.headerName}>{userName}</span>
              {clinicName && <span className={styles.headerClinic}>{clinicName}</span>}
            </div>
          </div>
          <nav className={styles.nav}>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${isActive ? styles.active : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(item.href);
                  }}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>
          <div className={styles.headerActions}>
            <button
              className={styles.passwordBtn}
              onClick={() => setShowOptionalPasswordModal(true)}
              title="Cambiar contraseña"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="8" width="9" height="6" rx="1.5" />
                <path d="M5.5 8V5.5a2.5 2.5 0 015 0V8" />
              </svg>
            </button>
            <button className={styles.logoutBtn} onClick={handleLogout}>
              Salir
            </button>
          </div>
        </header>
        <main className={styles.main}>{children}</main>
      </div>

      {/* Forced first-login password change */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        isForced
        onSuccess={handleForcedPasswordSuccess}
      />

      {/* Optional password change from profile */}
      <ChangePasswordModal
        isOpen={showOptionalPasswordModal}
        onClose={() => setShowOptionalPasswordModal(false)}
        onSuccess={handleOptionalPasswordSuccess}
      />
    </ToastProvider>
  );
}
