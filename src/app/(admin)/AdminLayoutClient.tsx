'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { ToastProvider } from '@/components/ui/Toast';
import { BimonetaryCalculator } from '@/components/layout/BimonetaryCalculator';
import styles from './admin-layout.module.css';

interface AdminLayoutClientProps {
  userName: string;
  userRole: string;
  children: React.ReactNode;
}

export function AdminLayoutClient({ userName, userRole, children }: AdminLayoutClientProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Global keyboard shortcut (Alt/Option + C) to toggle calculator
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === 'c' || e.key === 'C' || e.key === 'ç' || e.key === '©')) {
        e.preventDefault();
        setIsCalculatorOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ToastProvider>
      <div className={styles.layout}>
        <Sidebar
          userName={userName}
          userRole={userRole}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed(!collapsed)}
          onToggleCalculator={() => setIsCalculatorOpen((prev) => !prev)}
        />
        <main className={`${styles.main} ${collapsed ? styles.mainCollapsed : ''}`}>
          {children}
        </main>
        
        {/* Global Bimonetary Calculator Drawer */}
        <BimonetaryCalculator
          isOpen={isCalculatorOpen}
          onClose={() => setIsCalculatorOpen(false)}
        />
      </div>
    </ToastProvider>
  );
}
