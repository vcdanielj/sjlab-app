// ============================================
// SJ Lab — Pruebas de pedidos con múltiples prótesis
// ============================================
// Nota: Este archivo está preparado para ejecutarse con Vitest.
// Para correr las pruebas, instala vitest: npm install -D vitest

import { describe, expect, it } from 'vitest';
import {
  buildOrderProgressSummary,
  canMarkOrderAsCompleted,
  formatIncompleteOrderProsthesisJobs,
  getIncompleteOrderProsthesisJobs,
  normalizeOrderProsthesisJobs,
} from '../lib/order-prosthesis';

describe('Pedidos con múltiples prótesis', () => {
  it('permite crear trabajos de distintas categorías asociados al mismo paciente por defecto', () => {
    const result = normalizeOrderProsthesisJobs(
      [
        { productId: 'corona-zirconio' },
        { productId: 'protesis-removible' },
        { productId: 'ferula-nocturna' },
      ],
      'Mariana Perez'
    );

    expect(result.error).toBeUndefined();
    expect(result.jobs).toHaveLength(3);
    expect(result.jobs.every((job) => job.patientName === 'Mariana Perez')).toBe(true);
    expect(result.jobs.every((job) => job.isPatientException === false)).toBe(true);
    expect(result.jobs.every((job) => job.exceptionReason === null)).toBe(true);
  });

  it('permite crear trabajos sin paciente principal cuando no se especifica ninguno', () => {
    const result = normalizeOrderProsthesisJobs(
      [
        { productId: 'corona-zirconio' },
        { productId: 'protesis-removible' },
      ],
      ''
    );

    expect(result.error).toBeUndefined();
    expect(result.jobs).toHaveLength(2);
    expect(result.jobs.every((job) => job.patientName === '')).toBe(true);
    expect(result.jobs.every((job) => job.isPatientException === false)).toBe(true);
    expect(result.jobs.every((job) => job.exceptionReason === null)).toBe(true);
  });

  it('bloquea el estado listo cuando existe al menos un trabajo incompleto', () => {
    const jobs = [
      { id: '1', patientName: 'Mariana Perez', status: 'completed' as const, productName: 'Corona', categoryName: 'Fija' },
      { id: '2', patientName: 'Mariana Perez', status: 'pending' as const, productName: 'Protesis Removible', categoryName: 'Removible' },
      { id: '3', patientName: 'Mariana Perez', status: 'pending' as const, productName: 'Ferula', categoryName: 'Guarda' },
    ];

    expect(canMarkOrderAsCompleted(jobs)).toBe(false);

    const incompleteJobs = getIncompleteOrderProsthesisJobs(jobs);
    expect(formatIncompleteOrderProsthesisJobs(incompleteJobs)).toEqual([
      'Protesis Removible (Removible) - Mariana Perez',
      'Ferula (Guarda) - Mariana Perez',
    ]);
  });

  it('activa el estado listo cuando todas las prótesis están finalizadas', () => {
    const jobs = [
      { id: '1', patientName: 'Mariana Perez', status: 'completed' as const, productName: 'Corona', categoryName: 'Fija' },
      { id: '2', patientName: 'Mariana Perez', status: 'completed' as const, productName: 'Protesis Removible', categoryName: 'Removible' },
      { id: '3', patientName: 'Mariana Perez', status: 'completed' as const, productName: 'Ferula', categoryName: 'Guarda' },
    ];

    expect(canMarkOrderAsCompleted(jobs)).toBe(true);
    expect(buildOrderProgressSummary(jobs)).toEqual({
      total: 3,
      completed: 3,
      pending: 0,
      percent: 100,
      ready: true,
    });
  });
});
