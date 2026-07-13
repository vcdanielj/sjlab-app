'use client';

import { useState, Fragment } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import styles from './sidebar.module.css';

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    roles: ['admin'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    label: 'Pedidos',
    href: '/orders',
    roles: ['admin', 'tech'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 4h14M3 8h14M3 12h10M3 16h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Clientes',
    href: '/clients',
    roles: ['admin', 'tech'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3.5 17.5c0-3.59 2.91-6.5 6.5-6.5s6.5 2.91 6.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Finanzas',
    href: '/finances',
    roles: ['admin'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="5" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 5V3.5a1.5 1.5 0 011.5-1.5h5A1.5 1.5 0 0114 3.5V5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9v4M8 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: 'Gastos',
    href: '/expenses',
    roles: ['admin'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 3h12a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 7h8M6 10h6M6 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 7l-1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    label: 'Delivery',
    href: '/delivery',
    roles: ['admin', 'tech', 'delivery'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 13h2m0 0a2 2 0 104 0m-4 0a2 2 0 114 0m0 0h6m0 0a2 2 0 104 0m-4 0a2 2 0 114 0m0 0h2V8l-3-3h-4v8zM3 13V6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: 'Configuración',
    href: '/settings',
    roles: ['admin'],
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 2v2.5M10 15.5V18M18 10h-2.5M4.5 10H2M15.66 4.34l-1.77 1.77M6.11 13.89l-1.77 1.77M15.66 15.66l-1.77-1.77M6.11 6.11L4.34 4.34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

interface SidebarProps {
  userName: string;
  userRole: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onToggleCalculator: () => void;
}

export function Sidebar({ userName, userRole, collapsed, onToggleCollapse, onToggleCalculator }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    tech: 'Técnico',
    delivery: 'Delivery',
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className={styles.hamburger}
        onClick={() => setMobileOpen(true)}
        aria-label="Abrir menú"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {/* Mobile calculator shortcut */}
      <button
        className={styles.calculatorShortcutMobile}
        onClick={onToggleCalculator}
        aria-label="Abrir calculadora"
        title="Abrir calculadora"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
          <line x1="9" y1="22" x2="9" y2="16" />
          <line x1="15" y1="22" x2="15" y2="16" />
          <line x1="9" y1="16" x2="15" y2="16" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="16" y2="14" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className={styles.overlay}
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''} ${mobileOpen ? styles.mobileOpen : ''}`}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.logoIcon}>
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect width="28" height="28" rx="7" fill="#111" />
                <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif">SJ</text>
              </svg>
            </div>
            {!collapsed && <span className={styles.brandText}>SJ Lab</span>}
          </div>
          
          <div className={styles.headerActions}>
            <button
              className={styles.calculatorBtn}
              onClick={onToggleCalculator}
              title="Abrir calculadora (Alt + C)"
              aria-label="Abrir calculadora"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="22" x2="9" y2="16" />
                <line x1="15" y1="22" x2="15" y2="16" />
                <line x1="9" y1="16" x2="15" y2="16" />
                <line x1="8" y1="6" x2="16" y2="6" />
                <line x1="8" y1="10" x2="16" y2="10" />
                <line x1="8" y1="14" x2="16" y2="14" />
              </svg>
            </button>
            <button
              className={styles.collapseBtn}
              onClick={() => { onToggleCollapse(); setMobileOpen(false); }}
              aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d={collapsed ? 'M6 3l5 5-5 5' : 'M10 3L5 8l5 5'}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className={styles.nav}>
          {NAV_ITEMS.filter(item => item.roles.includes(userRole)).map((item, index, filteredItems) => {
            const isActive = pathname.startsWith(item.href);
            const isLastItem = index === filteredItems.length - 1;
            return (
              <Fragment key={item.href}>
                {isLastItem && <div className={styles.navSeparator} />}
                <a
                  href={item.href}
                  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(item.href);
                    setMobileOpen(false);
                  }}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                  {collapsed && <span className={styles.tooltip}>{item.label}</span>}
                </a>
              </Fragment>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.user}>
            <div className={styles.avatar}>
              {userName.charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className={styles.userInfo}>
                <span className={styles.userName}>{userName}</span>
                <span className={styles.userRole}>{roleLabels[userRole] || userRole}</span>
              </div>
            )}
          </div>
          <button className={styles.logoutBtn} onClick={handleLogout} title="Cerrar sesión">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M6.75 15.75H3.75a1.5 1.5 0 01-1.5-1.5V3.75a1.5 1.5 0 011.5-1.5h3M12.75 12.75L15.75 9l-3-3.75M15.75 9H6.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {!collapsed && <span className={styles.sidebarVersion}>v1.0</span>}
        </div>
      </aside>
    </>
  );
}
