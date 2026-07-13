'use client';

import { useState, type FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shaking, setShaking] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión');
        triggerShake();
        return;
      }

      router.push(data.data.redirectTo);
    } catch {
      setError('Error de conexión');
      triggerShake();
    } finally {
      setLoading(false);
    }
  }

  function triggerShake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  return (
    <main className={styles.main}>
      <div ref={cardRef} className={`${styles.card} ${shaking ? styles.shake : ''}`}>
        <div className={styles.logo}>
          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
            <rect width="52" height="52" rx="14" fill="#111" />
            <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="white" fontSize="18" fontWeight="700" fontFamily="Inter, sans-serif">SJ</text>
          </svg>
        </div>
        <h1 className={styles.title}>SJ Lab</h1>
        <p className={styles.subtitle}>Sistema de Gestión</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@sjlabdental.com"
            required
            autoComplete="email"
            autoFocus
          />

          <div className={styles.passwordWrap}>
            <Input
              label="Contraseña"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M2.5 2.5l13 13M7.3 7.3a2.4 2.4 0 003.4 3.4M3 9s2.5-4.5 6-4.5c.8 0 1.5.2 2.2.5M15 9s-1 1.8-2.8 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M9 4.5C5.5 4.5 3 9 3 9s2.5 4.5 6 4.5 6-4.5 6-4.5-2.5-4.5-6-4.5z" stroke="currentColor" strokeWidth="1.3" />
                  <circle cx="9" cy="9" r="2.25" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              )}
            </button>
          </div>

          {error && (
            <p className={styles.error}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.3" />
                <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
              {error}
            </p>
          )}

          <Button type="submit" fullWidth loading={loading} size="lg">
            Iniciar sesión
          </Button>
        </form>
      </div>

      <p className={styles.footer}>
        Laboratorio Dental SJ Lab — Sistema interno
        <span className={styles.version}>v1.0</span>
      </p>
    </main>
  );
}
