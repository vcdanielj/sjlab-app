'use client';

import { useEffect, useState } from 'react';
import styles from './install-prompt.module.css';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = 'sjlab-install-dismissed';
const DISMISS_DAYS = 14;

function checkStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari-specific
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function checkIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function checkDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

function persistDismiss() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function DownloadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed] = useState(() => checkStandalone());
  const [dismissed, setDismissed] = useState(() => checkDismissed());
  const [showIOSHint] = useState(() => checkIOS());

  useEffect(() => {
    if (installed || dismissed || showIOSHint) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setDeferred(null);
      persistDismiss();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);

    // Registrar service worker (necesario para que Chrome/Edge considere la app instalable)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        /* ignore */
      });
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, [installed, dismissed, showIOSHint]);

  if (installed || dismissed) return null;

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') {
      setDeferred(null);
    }
    persistDismiss();
    setDismissed(true);
  }

  function handleDismiss() {
    persistDismiss();
    setDismissed(true);
  }

  // iOS: no hay API programática, mostrar instrucciones
  if (showIOSHint) {
    return (
      <div className={styles.banner} role="dialog" aria-label="Instalar app">
        <div className={styles.icon} aria-hidden="true">
          <ShareIcon />
        </div>
        <div className={styles.text}>
          <strong>Instalar SJ Lab</strong>
          <span>
            Toca <kbd>⎋</kbd> Compartir y luego{' '}
            <em>&ldquo;Añadir a pantalla de inicio&rdquo;</em> <kbd>➕</kbd>
          </span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.close}
            aria-label="Cerrar"
            onClick={handleDismiss}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (!deferred) return null;

  return (
    <div className={styles.banner} role="dialog" aria-label="Instalar app">
      <div className={styles.icon} aria-hidden="true">
        <DownloadIcon />
      </div>
      <div className={styles.text}>
        <strong>Instalar SJ Lab</strong>
        <span>Acceso rápido desde tu pantalla de inicio</span>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.installBtn} onClick={handleInstall}>
          Instalar
        </button>
        <button
          type="button"
          className={styles.close}
          aria-label="Cerrar"
          onClick={handleDismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}
