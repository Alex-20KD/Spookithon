import { describe, it, expect } from 'vitest';
import { formatNumber, formatMoney, formatPercent, formatCompact } from './format';

describe('formato de números', () => {
  it('usa punto como separador de miles', () => {
    expect(formatNumber(1000000)).toBe('1.000.000');
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(1234567.6)).toBe('1.234.568');
    expect(formatNumber(-50000)).toBe('-50.000');
  });

  it('formatea dinero como $1.000.000', () => {
    expect(formatMoney(1000000)).toBe('$1.000.000');
    expect(formatMoney(50000)).toBe('$50.000');
    expect(formatMoney(0)).toBe('$0');
  });

  it('formatea porcentajes con coma decimal sin ocultar brotes pequeños', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.125)).toBe('12,5%');
    expect(formatPercent(0.0105)).toBe('1,05%');
    expect(formatPercent(0.0001)).toBe('0,010%');
    expect(formatPercent(0.5, 0)).toBe('50%');
  });

  it('formatea ejes compactos', () => {
    expect(formatCompact(1500000)).toBe('1,5 M');
    expect(formatCompact(1000000)).toBe('1 M');
    expect(formatCompact(25000)).toBe('25 mil');
    expect(formatCompact(800)).toBe('800');
  });
});
