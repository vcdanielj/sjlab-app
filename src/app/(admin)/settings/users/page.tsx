// ============================================
// SJ Lab — Users Management Page
// ============================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { formatDate } from '@/lib/utils';
import styles from './page.module.css';

// ---------- Types ----------

interface User {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  clinicName: string | null;
  role: string;
  isActive: boolean;
  createdAt: number;
}

// ---------- Constants ----------

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  tech: 'Técnico',
  client: 'Cliente',
  delivery: 'Delivery',
};

const ROLE_STYLES: Record<string, string> = {
  admin: 'roleAdmin',
  tech: 'roleTech',
  client: 'roleClient',
  delivery: 'roleDelivery',
};

// ---------- Component ----------

export default function UsersPage() {
  const { addToast } = useToast();
  const [usersList, setUsersList] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState('client');
  const [formPhone, setFormPhone] = useState('');
  const [formClinic, setFormClinic] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      const res = await fetch(`/api/users?${params}`);
      const data = await res.json();
      if (data.data) setUsersList(data.data);
    } catch {
      addToast('Error al cargar usuarios', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, addToast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  function openCreateModal() {
    setEditingId(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('client');
    setFormPhone('');
    setFormClinic('');
    setFormAddress('');
    setShowModal(true);
  }

  function openEditModal(user: User) {
    setEditingId(user.id);
    setFormName(user.name);
    setFormEmail(user.email);
    setFormPassword('');
    setFormRole(user.role);
    setFormPhone(user.phone || '');
    setFormClinic(user.clinicName || '');
    // We don't have address in User interface yet, but we will fetch it or assume it's added.
    // Let's assume we will add address to the API.
    setFormAddress((user as any).address || '');
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim() || (!editingId && !formPassword)) {
      addToast('Nombre, email y contraseña son requeridos', 'warning');
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/users/${editingId}` : '/api/users';
      const method = editingId ? 'PUT' : 'POST';
      const body: any = {
        name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        phone: formPhone.trim() || undefined,
        address: formAddress.trim() || undefined,
        clinicName: formClinic.trim() || undefined,
      };
      if (formPassword) {
        body.password = formPassword;
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'Error al guardar', 'error');
        return;
      }
      addToast(editingId ? `Usuario actualizado` : `Usuario "${formName.trim()}" creado`, 'success');
      setShowModal(false);
      fetchUsers();
    } catch {
      addToast('Error de red', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (res.ok) {
        addToast(`Usuario ${user.isActive ? 'desactivado' : 'activado'}`, 'success');
        fetchUsers();
      }
    } catch {
      addToast('Error al cambiar estado', 'error');
    }
  }

  function avatarColor(name: string): string {
    return `hsl(${name.charCodeAt(0) * 37 % 360}, 55%, 50%)`;
  }

  return (
    <div>
      <a href="/settings" className={styles.backBtn}>← Configuración</a>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Usuarios</h1>
          <p className={styles.subtitle}>Gestión de usuarios, roles y accesos — {usersList.length} usuarios</p>
        </div>
        <Button onClick={openCreateModal}>+ Crear Usuario</Button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.searchWrap}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className={styles.searchInput}
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="tech">Técnico</option>
          <option value="client">Cliente</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.loadingWrap}><div className={styles.spinner} /></div>
      ) : usersList.length === 0 ? (
        <EmptyState
          title="Sin usuarios"
          description={search || roleFilter ? 'Intenta con otros filtros.' : 'Crea el primer usuario para comenzar.'}
          action={!search ? <Button onClick={openCreateModal}>Crear Usuario</Button> : undefined}
        />
      ) : (
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Teléfono</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usersList.map((u) => (
                <tr key={u.id} className={styles.row}>
                  <td>
                    <div className={styles.userCell}>
                      <div className={styles.avatar} style={{ background: avatarColor(u.name) }}>
                        {u.name.charAt(0)}
                      </div>
                      <div>
                        <div className={styles.userName}>{u.name}</div>
                        <div className={styles.userEmail}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.roleBadge} ${styles[ROLE_STYLES[u.role] || 'roleClient']}`}>
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)' }}>
                    {u.phone || '—'}
                  </td>
                  <td>
                    <span className={u.isActive ? styles.statusActive : styles.statusInactive}>
                      {u.isActive ? '● Activo' : '○ Inactivo'}
                    </span>
                  </td>
                  <td style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
                    {formatDate(u.createdAt)}
                  </td>
                  <td>
                    <button className={styles.toggleBtn} style={{ marginRight: '8px' }} onClick={() => openEditModal(u)}>
                      Editar
                    </button>
                    <button className={styles.toggleBtn} onClick={() => toggleActive(u)}>
                      {u.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <form className={styles.modal} onSubmit={handleSave}>
            <h3 className={styles.modalTitle}>{editingId ? 'Editar Usuario' : 'Crear Usuario'}</h3>
            <div className={styles.modalFields}>
              <Input label="Nombre *" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Dr. Juan Pérez" autoFocus required />
              <Input label="Email *" type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="juan@clinica.com" required />
              <div className={styles.modalRow}>
                <Input label={editingId ? 'Contraseña (dejar en blanco para no cambiar)' : 'Contraseña *'} type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required={!editingId} />
                <Select label="Rol *" value={formRole} onChange={(e) => setFormRole(e.target.value)} required>
                  <option value="client">Cliente</option>
                  <option value="tech">Técnico</option>
                  <option value="admin">Administrador</option>
                  <option value="delivery">Delivery</option>
                </Select>
              </div>
              <div className={styles.modalRow}>
                <Input label="Teléfono" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+58 412..." />
                <Input label="Dirección" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="Av. Principal..." />
              </div>
              <Input label="Clínica" value={formClinic} onChange={(e) => setFormClinic(e.target.value)} placeholder="Clínica Dental..." />
            </div>
            <div className={styles.modalActions}>
              <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" loading={saving}>{editingId ? 'Guardar' : 'Crear Usuario'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
