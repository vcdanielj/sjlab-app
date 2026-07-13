'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import styles from './page.module.css';

export default function CreateClientPage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Success state
  const [created, setCreated] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [createdName, setCreatedName] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!name.trim()) errs.name = 'El nombre es requerido';
    if (!email.trim()) errs.email = 'El email es requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Email inválido';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          phone: phone || undefined,
          address: address || undefined,
          clinicName: clinicName || undefined,
          taxId: taxId || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        addToast(data.error, 'error');
        return;
      }

      setCreatedName(data.data.name);
      setCreatedEmail(data.data.email);
      setTempPassword(data.data.tempPassword);
      setCreated(true);
    } catch {
      addToast('Error al crear cliente', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
      addToast('Contraseña copiada', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('No se pudo copiar. Copia manualmente.', 'warning');
    }
  }

  function getPortalUrl() {
    return typeof window !== 'undefined' ? `${window.location.origin}` : '';
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(getPortalUrl());
      setCopiedLink(true);
      addToast('Enlace copiado', 'success');
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      addToast('No se pudo copiar', 'warning');
    }
  }

  async function handleCopyMessage() {
    const url = getPortalUrl();
    const msg = `¡Hola ${createdName}! 👋\n\nYa tienes tu acceso al portal de SJ Lab para seguir tus pedidos en tiempo real.\n\n🔗 Enlace: ${url}\n📧 Usuario: ${createdEmail}\n🔑 Contraseña: ${tempPassword}\n\nAl entrar por primera vez se te pedirá cambiar la contraseña.\n\n¡Estamos para servirte!`;
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedMsg(true);
      addToast('Mensaje copiado al portapapeles', 'success');
      setTimeout(() => setCopiedMsg(false), 2000);
    } catch {
      addToast('No se pudo copiar', 'warning');
    }
  }

  if (created) {
    return (
      <div className={styles.container}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h2 className={styles.successTitle}>Cliente creado exitosamente</h2>
          <p className={styles.successText}>
            <strong>{createdName}</strong> ({createdEmail})
          </p>

          <div className={styles.credentialsGrid}>
            {/* Portal Link */}
            <div className={styles.credentialBox}>
              <label className={styles.passwordLabel}>Enlace del portal</label>
              <div className={styles.passwordBox}>
                <span className={styles.linkValue}>{getPortalUrl()}</span>
                <button className={styles.copyBtn} onClick={handleCopyLink}>
                  {copiedLink ? '✓' : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9H2.5A1.5 1.5 0 011 7.5v-6A1.5 1.5 0 012.5 0h6A1.5 1.5 0 0110 1.5V2" stroke="currentColor" strokeWidth="1.3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password */}
            <div className={styles.credentialBox}>
              <label className={styles.passwordLabel}>Contraseña temporal</label>
              <div className={styles.passwordBox}>
                <span className={styles.passwordValue}>{tempPassword}</span>
                <button className={styles.copyBtn} onClick={handleCopy}>
                  {copied ? '✓' : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3 9H2.5A1.5 1.5 0 011 7.5v-6A1.5 1.5 0 012.5 0h6A1.5 1.5 0 0110 1.5V2" stroke="currentColor" strokeWidth="1.3"/></svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className={styles.passwordHint}>
            El cliente usará su email y esta contraseña para entrar al portal. Se le pedirá cambiarla al iniciar sesión.
          </p>

          {/* Copy WhatsApp message */}
          <button className={styles.whatsappBtn} onClick={handleCopyMessage}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1a7 7 0 00-6.09 10.45L1 15l3.55-.91A7 7 0 108 1z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5.5 6.5c.17-.5.5-1 1-1s.83.5 1 1c.17.5-.33 1-.5 1.5s0 1.5.5 2c.5.5 1 .67 1.5.5s1-.67 1.5-.5.5.5 1 1-.5.83-1 1c-1.5.5-3-.5-4-1.5S4.5 7.5 5 6c.08-.25.25-.5.5-.5z" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            {copiedMsg ? '✓ Mensaje copiado' : 'Copiar mensaje para el cliente'}
          </button>

          <div className={styles.successActions}>
            <Button variant="secondary" onClick={() => router.push('/clients')}>
              Ir al Directorio
            </Button>
            <Button onClick={() => {
              setCreated(false);
              setName('');
              setEmail('');
              setPhone('');
              setAddress('');
              setClinicName('');
              setTaxId('');
              setTempPassword('');
            }}>
              Crear Otro
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.push('/clients')}>
          ← Volver
        </button>
        <h1 className={styles.title}>Nuevo Cliente</h1>
        <p className={styles.subtitle}>Registrar un nuevo odontólogo</p>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGrid}>
          <Input
            label="Nombre completo *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Juan Pérez"
            error={errors.name}
            autoFocus
          />
          <Input
            label="Email *"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="juan@clinica.com"
            error={errors.email}
          />
          <Input
            label="Teléfono"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+58 414 123 4567"
          />
          <Input
            label="Dirección"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Av. Principal, Edificio, Piso, Oficina"
          />
          <Input
            label="Clínica / Consultorio"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
            placeholder="Clínica Dental del Este"
          />
          <Input
            label="Cédula / RIF"
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="V-12345678 o J-12345678-9"
          />
        </div>

        <div className={styles.formActions}>
          <Button variant="secondary" type="button" onClick={() => router.push('/clients')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Crear Cliente
          </Button>
        </div>
      </form>
    </div>
  );
}
