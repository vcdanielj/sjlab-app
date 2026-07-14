import { describe, expect, it } from 'vitest';
import { safeEval } from '../components/layout/BimonetaryCalculator';

describe('Calculadora Bimonetaria - Evaluador Matemático safeEval', () => {
  it('debe realizar operaciones matemáticas básicas', () => {
    expect(safeEval('5 + 3')).toBe(8);
    expect(safeEval('10 - 4')).toBe(6);
    expect(safeEval('4 * 5')).toBe(20);
    expect(safeEval('20 / 4')).toBe(5);
  });

  it('debe respetar la prioridad de los operadores', () => {
    expect(safeEval('2 + 3 * 4')).toBe(14);
    expect(safeEval('2 * 3 + 4')).toBe(10);
    expect(safeEval('12 / 3 - 1')).toBe(3);
  });

  it('debe soportar y priorizar paréntesis', () => {
    expect(safeEval('(2 + 3) * 4')).toBe(20);
    expect(safeEval('2 * (3 + 4)')).toBe(14);
    expect(safeEval('((2 + 3) * 2) + 5')).toBe(15);
  });

  it('debe mapear correctamente caracteres visuales de multiplicación y división', () => {
    expect(safeEval('10 × 5')).toBe(50);
    expect(safeEval('20 ÷ 4')).toBe(5);
    expect(safeEval('(5 + 5) × 2')).toBe(20);
  });

  it('debe balancear automáticamente paréntesis abiertos', () => {
    expect(safeEval('(5 + 3')).toBe(8);
    expect(safeEval('((2 + 2) * 2')).toBe(8);
    expect(safeEval('(((2 + 2')).toBe(4);
  });

  it('debe balancear automáticamente paréntesis de cierre sobrantes', () => {
    expect(safeEval('5 + 3)')).toBe(8);
    expect(safeEval('2 * 3) + 4')).toBe(10);
  });

  it('debe recuperarse de operadores colgantes al final de la expresión', () => {
    expect(safeEval('5 + 3 + ')).toBe(8);
    expect(safeEval('5 × 2 × ')).toBe(10);
    expect(safeEval('(5 + 3) * ')).toBe(8);
    expect(safeEval('(5 + ')).toBe(5);
  });

  it('debe manejar entradas vacías o basura', () => {
    expect(safeEval('')).toBe(0);
    expect(safeEval('   ')).toBe(0);
    expect(safeEval('abc')).toBe(0); // se sanitiza a vacío
  });

  it('debe lanzar error ante expresiones totalmente inválidas e irrecuperables', () => {
    expect(() => safeEval('(()')).toThrow();
    expect(() => safeEval(')/')).toThrow();
  });
});
