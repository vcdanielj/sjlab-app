// ============================================
// SJ Lab — Change Password Modal
// ============================================

'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/ui/Toast';
import styles from './ChangePasswordModal.module.css';

interface ChangePasswordModalProps {
  isOpen: boolean;
  isForced?: boolean; // True on first login
  onClose?: () => void; // Undefined when forced (can't close)
  onSuccess: () => void;
}

export function ChangePasswordModal({
  isOpen,
  isForced = false,
  onClose,
  onSuccess,
}: ChangePasswordModalProps) {
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError('');

    if (!currentPassword) {
      setError('La contraseña actual es requerida');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (currentPassword === newPassword) {
      setError('La nueva contraseña debe ser diferente a la actual');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al cambiar contraseña');
        return;
      }

      addToast('Contraseña actualizada correctamente', 'success');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess();
    } catch {
      setError('Error de red');
    } finally {
      setLoading(false);
    }
  }, [currentPassword, newPassword, confirmPassword, addToast, onSuccess]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={isForced ? undefined : onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            {isForced ? 'Cambio de Contraseña Obligatorio' : 'Cambiar Contraseña'}
          </h2>
          <p className={styles.modalDesc}>
            {isForced
              ? 'Debes cambiar tu contraseña temporal antes de continuar.'
              : 'Introduce tu contraseña actual y elige una nueva.'}
          </p>
        </div>

        {isForced && (
          <div className={styles.forceBanner}>
            <span className={styles.forceIcon}>⚠️</span>
            <span>Esta es tu primera vez ingresando. Por seguridad, crea una contraseña personal.</span>
          </div>
        )}

        <div className={styles.modalBody}>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Contraseña Actual</label>
            <input
              type="password"
              className={styles.fieldInput}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Nueva Contraseña</label>
            <input
              type="password"
              className={styles.fieldInput}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Confirmar Nueva Contraseña</label>
            <input
              type="password"
              className={styles.fieldInput}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repite la nueva contraseña"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        {error && <div className={styles.errorMsg}>{error}</div>}

        <div className={styles.modalFooter}>
          {!isForced && onClose && (
            <button className={styles.cancelBtn} onClick={onClose}>
              Cancelar
            </button>
          )}
          <button
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Cambiar Contraseña'}
          </button>
        </div>
      </div>
    </div>
  );
}
