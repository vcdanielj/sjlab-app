// ============================================
// SJ Lab — Settings Page (Redesigned)
// ============================================

import type { Metadata } from 'next';
import Link from 'next/link';
import styles from './page.module.css';

export const metadata: Metadata = { title: 'Configuración' };

const SETTINGS_CARDS = [
  {
    title: 'Flujos de Trabajo',
    description: 'Gestionar flujos y pasos de producción del laboratorio',
    href: '/settings/workflows',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="5" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="19" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7 12h3M14 12h3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    color: '#6366F1',
  },
  {
    title: 'Catálogo',
    description: 'Categorías y productos del laboratorio',
    href: '/settings/catalog',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
    color: '#10B981',
  },
  {
    title: 'Usuarios',
    description: 'Crear y administrar usuarios, roles y accesos',
    href: '/settings/users',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2 20c0-3.87 3.13-7 7-7s7 3.13 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M18 14c2.76 0 5 2.24 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    color: '#3B82F6',
  },
  {
    title: 'Categorías de Gastos',
    description: 'Crear y administrar las categorías para clasificar gastos',
    href: '/settings/expense-categories',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M4 7h16M4 12h10M4 17h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="17" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M18.5 15.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    color: '#F59E0B',
  },
  {
    title: 'Cobranza y Frecuencia',
    description: 'Configurar frecuencia y días de cobros automáticos',
    href: '/settings/billing',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M21 8.5H3M16.5 13.5h.01M12.5 13.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    color: '#EF4444',
  },
];

export default function SettingsPage() {
  return (
    <div>
      <h1 className={styles.title}>Configuración</h1>
      <p className={styles.subtitle}>Administra la configuración de tu laboratorio</p>
      <div className={styles.grid}>
        {SETTINGS_CARDS.map((card) => (
          <Link key={card.href} href={card.href} className={styles.card}>
            <div className={styles.cardIcon} style={{ color: card.color, background: `${card.color}15` }}>
              {card.icon}
            </div>
            <div className={styles.cardContent}>
              <h2 className={styles.cardTitle}>{card.title}</h2>
              <p className={styles.cardDesc}>{card.description}</p>
            </div>
            <svg className={styles.cardArrow} width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  );
}
