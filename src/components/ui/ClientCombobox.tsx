// ============================================
// SJ Lab — Client Combobox (Searchable + Create)
// ============================================

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import styles from './ClientCombobox.module.css';

interface Client {
  id: string;
  name: string;
  clinicName: string | null;
}

interface ClientComboboxProps {
  clients: Client[];
  value: string;
  onChange: (clientId: string) => void;
  onClientCreated: (client: Client) => void;
}

export function ClientCombobox({ clients, value, onChange, onClientCreated }: ClientComboboxProps) {
  const { addToast } = useToast();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newClinic, setNewClinic] = useState('');

  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Selected client display
  const selectedClient = clients.find((c) => c.id === value);

  // Filtered list
  const filtered = query.trim()
    ? clients.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.clinicName && c.clinicName.toLowerCase().includes(q))
        );
      })
    : clients;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Keyboard nav
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
          setOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
            selectClient(filtered[highlightedIndex]);
          }
          break;
        case 'Escape':
          setOpen(false);
          break;
      }
    },
    [open, filtered, highlightedIndex]
  );

  function selectClient(client: Client) {
    onChange(client.id);
    setQuery('');
    setOpen(false);
    setHighlightedIndex(-1);
  }

  function clearSelection() {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  }

  function avatarColor(name: string): string {
    return `hsl(${name.charCodeAt(0) * 37 % 360}, 55%, 50%)`;
  }

  // Create client
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      addToast('Nombre y email son requeridos', 'warning');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim().toLowerCase(),
          phone: newPhone.trim() || undefined,
          clinicName: newClinic.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'Error al crear cliente', 'error');
        return;
      }

      const created: Client = {
        id: data.data.id,
        name: newName.trim(),
        clinicName: newClinic.trim() || null,
      };

      onClientCreated(created);
      onChange(created.id);
      setShowCreate(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setNewClinic('');
      addToast(`Cliente "${created.name}" creado`, 'success');
    } catch {
      addToast('Error de red al crear cliente', 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <label className={styles.label}>Cliente *</label>

      <div className={styles.inputWrap}>
        <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        <input
          ref={inputRef}
          className={`${styles.input} ${selectedClient ? styles.inputSelected : ''}`}
          placeholder={selectedClient ? '' : 'Buscar cliente por nombre o clínica...'}
          value={selectedClient ? `${selectedClient.name}${selectedClient.clinicName ? ` — ${selectedClient.clinicName}` : ''}` : query}
          onChange={(e) => {
            if (selectedClient) {
              clearSelection();
            }
            setQuery(e.target.value);
            setOpen(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => {
            if (!selectedClient) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />

        {(selectedClient || query) && (
          <button type="button" className={styles.clearBtn} onClick={clearSelection}>
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && !selectedClient && (
        <div className={styles.dropdown}>
          {filtered.length === 0 && (
            <div className={styles.noResults}>
              No se encontraron clientes
            </div>
          )}

          {filtered.slice(0, 8).map((c, idx) => (
            <div
              key={c.id}
              className={`${styles.option} ${idx === highlightedIndex ? styles.optionHighlighted : ''}`}
              onClick={() => selectClient(c)}
              onMouseEnter={() => setHighlightedIndex(idx)}
            >
              <div className={styles.optionAvatar} style={{ background: avatarColor(c.name) }}>
                {c.name.charAt(0)}
              </div>
              <div className={styles.optionInfo}>
                <div className={styles.optionName}>{c.name}</div>
                {c.clinicName && <div className={styles.optionClinic}>{c.clinicName}</div>}
              </div>
              {c.id === value && <span className={styles.optionCheck}>✓</span>}
            </div>
          ))}

          {/* Create new client button */}
          <button
            type="button"
            className={styles.createBtn}
            onClick={() => {
              setShowCreate(true);
              setOpen(false);
              if (query.trim()) setNewName(query.trim());
            }}
          >
            <span className={styles.createIcon}>+</span>
            Crear nuevo cliente{query.trim() ? `: "${query.trim()}"` : ''}
          </button>
        </div>
      )}

      {/* Quick Create Modal */}
      {showCreate && (
        <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <form className={styles.modal} onSubmit={handleCreate}>
            <h3 className={styles.modalTitle}>Crear Cliente Rápido</h3>
            <div className={styles.modalFields}>
              <Input
                label="Nombre *"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Dr. Juan Pérez"
                autoFocus
                required
              />
              <Input
                label="Email *"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="juan@clinica.com"
                required
              />
              <div className={styles.modalRow}>
                <Input
                  label="Teléfono"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+58 412..."
                />
                <Input
                  label="Clínica"
                  value={newClinic}
                  onChange={(e) => setNewClinic(e.target.value)}
                  placeholder="Clínica Dental..."
                />
              </div>
            </div>
            <div className={styles.modalActions}>
              <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={creating}>
                Crear Cliente
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
