// ============================================
// SJ Lab — Bimonetary Calculator Component
// ============================================

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchRatesWithCache, Rates } from '@/lib/rates-client';
import styles from './calculator.module.css';

interface BimonetaryCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const safeEval = (expr: string): number => {
  let sanitized = expr;

  // Replace visual math symbols
  sanitized = sanitized
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/=/g, '');

  // Strip anything that is not math-related (allow numbers, operators, parenthesis, dots, spaces)
  sanitized = sanitized.replace(/[^0-9+\-*/().]/g, '');

  const balanceAndEval = (str: string): number => {
    let openCount = 0;
    for (const char of str) {
      if (char === '(') openCount++;
      if (char === ')') openCount--;
    }
    let balanced = str;
    if (openCount > 0) {
      balanced = balanced + ')'.repeat(openCount);
    } else if (openCount < 0) {
      balanced = '('.repeat(Math.abs(openCount)) + balanced;
    }
    
    if (!balanced.trim()) return 0;
    
    const fn = new Function(`return (${balanced})`);
    const val = fn();
    return typeof val === 'number' && !isNaN(val) ? val : 0;
  };

  try {
    return balanceAndEval(sanitized);
  } catch {
    // Attempt recovery by stripping trailing operators/parentheses and balancing
    let clean = sanitized.trim();
    while (clean && /[\+\-\*/\(]$/.test(clean)) {
      clean = clean.slice(0, -1).trim();
      try {
        return balanceAndEval(clean);
      } catch {
        // continue stripping
      }
    }
    throw new Error('Invalid expression');
  }
};

export function BimonetaryCalculator({ isOpen, onClose }: BimonetaryCalculatorProps) {
  const [display, setDisplay] = useState<string>('0');
  const [formula, setFormula] = useState<string>('');
  const [resetOnNext, setResetOnNext] = useState<boolean>(false);

  // Exchange rates states (initialized to empty for hydration safety)
  const [ratesDate, setRatesDate] = useState<string>('');
  const [rates, setRates] = useState<Rates | null>(null);
  const [loadingRates, setLoadingRates] = useState<boolean>(false);
  const [errorRates, setErrorRates] = useState<string>('');

  const drawerRef = useRef<HTMLDivElement>(null);

  // Set today's date in Caracas timezone on client-side mount only
  useEffect(() => {
    const timer = setTimeout(() => {
      const getCaracasDateString = () => {
        try {
          const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Caracas',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          return formatter.format(new Date());
        } catch {
          return new Date().toISOString().split('T')[0];
        }
      };
      setRatesDate(getCaracasDateString());
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Fetch exchange rates when date changes
  useEffect(() => {
    if (ratesDate) {
      const timer = setTimeout(() => {
        setLoadingRates(true);
        setErrorRates('');
        fetchRatesWithCache(ratesDate)
          .then((data) => {
            setRates(data);
          })
          .catch((err) => {
            console.error('Error loading rates in calculator:', err);
            setErrorRates('No se pudieron obtener las tasas');
            setRates(null);
          })
          .finally(() => {
            setLoadingRates(false);
          });
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [ratesDate]);

  // Handle calculator digits
  const handleDigit = useCallback((digit: string) => {
    if (resetOnNext) {
      if (digit === '.') {
        setDisplay('0.');
      } else {
        setDisplay(digit);
      }
      setFormula('');
      setResetOnNext(false);
    } else {
      if (digit === '.') {
        // Avoid double decimals in the active number
        const match = display.match(/[0-9.]*$/);
        const lastNumber = match ? match[0] : '';
        if (lastNumber.includes('.')) return;

        // If the expression ends with something that's not a digit (or is empty), append 0.
        if (!display || display === '0' || /[\+\-\*\/ \(\)]$/.test(display)) {
          setDisplay((prev) => (prev === '0' ? '0.' : prev + '0.'));
        } else {
          setDisplay((prev) => prev + '.');
        }
      } else {
        setDisplay((prev) => (prev === '0' ? digit : prev + digit));
      }
    }
  }, [display, resetOnNext]);

  // Handle operations
  const handleOperator = useCallback((op: string) => {
    const visualOp = op === '*' ? '×' : op === '/' ? '÷' : op;
    const formattedOp = ` ${visualOp} `;

    if (resetOnNext) {
      if (display === 'Error') {
        setDisplay('0' + formattedOp);
      } else {
        setDisplay(display + formattedOp);
      }
      setFormula('');
      setResetOnNext(false);
    } else {
      // Check if expression ends with an operator (e.g. " + ", " - ", " × ", " ÷ ")
      const endsWithOpMatch = display.match(/ [+\-×÷] $/);
      if (endsWithOpMatch) {
        setDisplay((prev) => prev.slice(0, -3) + formattedOp);
      } else {
        if (display === '0' && op === '-') {
          setDisplay('-');
        } else {
          setDisplay((prev) => prev + formattedOp);
        }
      }
    }
  }, [display, resetOnNext]);

  // Handle parenthesis insertion
  const handleParenthesis = useCallback((paren: '(' | ')') => {
    if (resetOnNext) {
      if (paren === '(') {
        setDisplay('(');
        setFormula('');
        setResetOnNext(false);
      }
      return;
    }

    if (paren === '(') {
      if (display === '0') {
        setDisplay('(');
      } else {
        const lastChar = display.slice(-1);
        // If last character is a digit or closing parenthesis, insert implicit multiplication
        if (/[0-9\)]/.test(lastChar)) {
          setDisplay((prev) => prev + ' × (');
        } else {
          setDisplay((prev) => prev + '(');
        }
      }
    } else {
      // Only allow closing parenthesis if we have open parenthesis
      const openCount = (display.match(/\(/g) || []).length;
      const closeCount = (display.match(/\)/g) || []).length;
      if (openCount > closeCount) {
        setDisplay((prev) => prev + ')');
      }
    }
  }, [display, resetOnNext]);

  const handleClear = useCallback(() => {
    setDisplay('0');
    setFormula('');
    setResetOnNext(false);
  }, []);

  const handleBackspace = useCallback(() => {
    if (resetOnNext) {
      handleClear();
      return;
    }
    setDisplay((prev) => {
      if (prev.endsWith(' ')) {
        const sliced = prev.slice(0, -3);
        return sliced || '0';
      }
      const sliced = prev.slice(0, -1);
      return sliced || '0';
    });
  }, [resetOnNext, handleClear]);

  const handleEquals = useCallback(() => {
    if (resetOnNext) return;
    if (display === '0' || !display.trim()) return;

    try {
      const evalResult = safeEval(display);
      const formatted = Number(evalResult.toFixed(6)).toString();
      setFormula(display + ' =');
      setDisplay(formatted);
      setResetOnNext(true);
    } catch {
      setFormula(display + ' =');
      setDisplay('Error');
      setResetOnNext(true);
    }
  }, [display, resetOnNext]);

  const handleConvert = useCallback((rate: number, label: string, operator: 'multiply' | 'divide') => {
    if (!rate) return;
    let baseVal = 0;
    
    try {
      baseVal = resetOnNext ? parseFloat(display) : safeEval(display);
      if (isNaN(baseVal)) baseVal = 0;
    } catch {
      baseVal = 0;
    }

    let finalVal = 0;
    let newFormula = '';

    if (operator === 'multiply') {
      finalVal = baseVal * rate;
      newFormula = `${Number(baseVal.toFixed(4))} × ${label} (${rate})`;
    } else {
      finalVal = baseVal / rate;
      newFormula = `${Number(baseVal.toFixed(4))} ÷ ${label} (${rate})`;
    }

    setDisplay(Number(finalVal.toFixed(4)).toString());
    setFormula(newFormula);
    setResetOnNext(true);
  }, [display, resetOnNext]);

  const handleInsertRate = useCallback((rate: number) => {
    if (!rate) return;
    const rateStr = rate.toString();
    if (resetOnNext) {
      setDisplay(rateStr);
      setFormula('');
      setResetOnNext(false);
    } else {
      if (display === '0') {
        setDisplay(rateStr);
      } else {
        const lastChar = display.slice(-1);
        if (/[0-9\)]/.test(lastChar)) {
          setDisplay((prev) => prev + ' × ' + rateStr);
        } else {
          setDisplay((prev) => prev + rateStr);
        }
      }
    }
  }, [display, resetOnNext]);

  // Keyboard events inside drawer
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is editing the date input
      if (document.activeElement?.tagName === 'INPUT' && (document.activeElement as HTMLInputElement).type === 'date') {
        if (e.key === 'Escape') {
          onClose();
        }
        return;
      }

      const key = e.key;

      if (/[0-9]/.test(key)) {
        e.preventDefault();
        handleDigit(key);
      } else if (key === '.') {
        e.preventDefault();
        handleDigit('.');
      } else if (['+', '-', '*', '/'].includes(key)) {
        e.preventDefault();
        handleOperator(key);
      } else if (key === '(' || key === ')') {
        e.preventDefault();
        handleParenthesis(key as '(' | ')');
      } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        handleEquals();
      } else if (key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (key.toLowerCase() === 'c') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleDigit, handleOperator, handleEquals, handleBackspace, handleClear, handleParenthesis, onClose]);

  // Click outside drawer to close
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay Backdrop */}
      <div
        className={`${styles.overlay} ${isOpen ? styles.overlayOpen : ''}`}
        onClick={handleOverlayClick}
      />

      {/* Drawer Container */}
      <aside
        ref={drawerRef}
        className={`${styles.drawer} ${isOpen ? styles.drawerOpen : ''}`}
        aria-label="Calculadora Bimonetaria"
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <h2 className={styles.title}>Calculadora Bimonetaria</h2>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Cerrar calculadora">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>

          <div className={styles.dateSelectorBlock}>
            <span className={styles.dateLabel}>Tasas de cambio del día:</span>
            <input
              type="date"
              className={styles.dateInput}
              value={ratesDate}
              onChange={(e) => setRatesDate(e.target.value)}
              aria-label="Seleccionar fecha de tasa de cambio"
            />
          </div>
        </div>

        {/* Rates Display */}
        <div className={styles.ratesSection}>
          <div className={styles.ratesTitle}>Tasas Disponibles</div>
          {loadingRates ? (
            <div className={styles.ratesGrid}>
              {[1, 2, 3].map((n) => (
                <div key={n} className={styles.rateCard} style={{ opacity: 0.6 }}>
                  <span className={styles.rateName}>Cargando...</span>
                  <span className={styles.rateValue}>—</span>
                </div>
              ))}
            </div>
          ) : errorRates ? (
            <div style={{ fontSize: '11px', color: 'var(--color-danger-dark)', textAlign: 'center' }}>
              {errorRates}
            </div>
          ) : rates ? (
            <div className={styles.ratesGrid}>
              <div className={styles.rateCard}>
                <span className={styles.rateName}>USD Paralelo</span>
                <span className={styles.rateValue}>{rates.usdParallel.toFixed(2)}</span>
              </div>
              <div className={styles.rateCard}>
                <span className={styles.rateName}>USD BCV</span>
                <span className={styles.rateValue}>{rates.usdBcv.toFixed(2)}</span>
              </div>
              <div className={styles.rateCard}>
                <span className={styles.rateName}>EUR BCV</span>
                <span className={styles.rateValue}>{rates.eurBcv.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
              No hay tasas para este día.
            </div>
          )}
        </div>

        {/* Calculator Display Screen */}
        <div className={styles.display}>
          <div className={styles.formula}>{formula}</div>
          <div className={styles.result}>{display}</div>
        </div>

        {/* Conversion Buttons */}
        <div className={styles.conversionSection}>
          <div className={styles.conversionTitle}>Conversión de Divisas</div>
          <div className={styles.conversionGrid}>
            <button
              className={styles.convertBtn}
              onClick={() => rates && handleConvert(rates.usdParallel, 'Paralelo', 'multiply')}
              disabled={!rates}
            >
              <span>× Paralelo</span>
              <span className={styles.convertBtnSub}>USD → VES</span>
            </button>
            <button
              className={styles.convertBtn}
              onClick={() => rates && handleInsertRate(rates.usdParallel)}
              disabled={!rates}
            >
              <span>Tasa Paralelo</span>
              <span className={styles.convertBtnSub}>{rates ? `${rates.usdParallel.toFixed(2)} Bs.` : 'Ingresar'}</span>
            </button>

            <button
              className={styles.convertBtn}
              onClick={() => rates && handleConvert(rates.usdBcv, 'USD BCV', 'multiply')}
              disabled={!rates}
            >
              <span>× USD BCV</span>
              <span className={styles.convertBtnSub}>USD → VES</span>
            </button>
            <button
              className={styles.convertBtn}
              onClick={() => rates && handleInsertRate(rates.usdBcv)}
              disabled={!rates}
            >
              <span>Tasa USD BCV</span>
              <span className={styles.convertBtnSub}>{rates ? `${rates.usdBcv.toFixed(2)} Bs.` : 'Ingresar'}</span>
            </button>

            <button
              className={styles.convertBtn}
              onClick={() => rates && handleConvert(rates.eurBcv, 'EUR BCV', 'multiply')}
              disabled={!rates}
            >
              <span>× EUR BCV</span>
              <span className={styles.convertBtnSub}>EUR → VES</span>
            </button>
            <button
              className={styles.convertBtn}
              onClick={() => rates && handleInsertRate(rates.eurBcv)}
              disabled={!rates}
            >
              <span>Tasa EUR BCV</span>
              <span className={styles.convertBtnSub}>{rates ? `${rates.eurBcv.toFixed(2)} Bs.` : 'Ingresar'}</span>
            </button>
          </div>
        </div>

        {/* Pad Keypad */}
        <div className={styles.keypad}>
          <button className={`${styles.key} ${styles.keyClear}`} onClick={handleClear}>C</button>
          <button className={`${styles.key} ${styles.keyOperator}`} onClick={() => handleParenthesis('(')}>(</button>
          <button className={`${styles.key} ${styles.keyOperator}`} onClick={() => handleParenthesis(')')}>)</button>
          <button className={`${styles.key} ${styles.keyOperator}`} onClick={handleBackspace}>⌫</button>

          <button className={styles.key} onClick={() => handleDigit('7')}>7</button>
          <button className={styles.key} onClick={() => handleDigit('8')}>8</button>
          <button className={styles.key} onClick={() => handleDigit('9')}>9</button>
          <button className={`${styles.key} ${styles.keyOperator}`} onClick={() => handleOperator('/')}>÷</button>

          <button className={styles.key} onClick={() => handleDigit('4')}>4</button>
          <button className={styles.key} onClick={() => handleDigit('5')}>5</button>
          <button className={styles.key} onClick={() => handleDigit('6')}>6</button>
          <button className={`${styles.key} ${styles.keyOperator}`} onClick={() => handleOperator('*')}>×</button>

          <button className={styles.key} onClick={() => handleDigit('1')}>1</button>
          <button className={styles.key} onClick={() => handleDigit('2')}>2</button>
          <button className={styles.key} onClick={() => handleDigit('3')}>3</button>
          <button className={`${styles.key} ${styles.keyOperator}`} onClick={() => handleOperator('-')}>-</button>

          <button className={styles.key} onClick={() => handleDigit('0')}>0</button>
          <button className={styles.key} onClick={() => handleDigit('.')}>.</button>
          <button className={`${styles.key} ${styles.keyOperator}`} onClick={() => handleOperator('+')}>+</button>
          <button className={`${styles.key} ${styles.keyEquals}`} onClick={handleEquals}>=</button>
        </div>

        {/* Shortcuts indicator */}
        <div className={styles.shortcutHint}>
          Atajo global: <kbd style={{ background: '#fff', border: '1px solid #ccc', padding: '1px 4px', borderRadius: '3px', fontSize: '9px' }}>Alt</kbd> + <kbd style={{ background: '#fff', border: '1px solid #ccc', padding: '1px 4px', borderRadius: '3px', fontSize: '9px' }}>C</kbd>
        </div>
      </aside>
    </>
  );
}
