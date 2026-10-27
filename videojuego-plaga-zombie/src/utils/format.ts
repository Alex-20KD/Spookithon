// Formato numérico único para todo el juego: punto para miles, coma para decimales.
// Ejemplos: 1.000.000 · $1.000.000 · 12,5%
// Se implementa a mano (sin toLocaleString) para que el resultado sea idéntico
// en todos los navegadores y en Node, y para que 4 cifras también lleven punto (1.000).

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Entero redondeado con separador de miles: 1234567.8 → "1.234.568" */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value);
  const sign = rounded < 0 ? '-' : '';
  return sign + groupThousands(String(Math.abs(rounded)));
}

/** Dinero: 1000000 → "$1.000.000" */
export function formatMoney(amount: number): string {
  const text = formatNumber(amount);
  return text.startsWith('-') ? '-$' + text.slice(1) : '$' + text;
}

/**
 * Porcentaje a partir de una fracción (0.125 → "12,5%").
 * Si no se indican decimales, se eligen según la magnitud para que un brote
 * pequeño no se muestre como 0%: 0.0001 → "0,010%".
 */
export function formatPercent(fraction: number, decimals?: number): string {
  if (!Number.isFinite(fraction) || fraction <= 0) return '0%';
  const pct = fraction * 100;
  const d = decimals ?? (pct < 0.1 ? 3 : pct < 10 ? 2 : 1);
  const [int, dec] = pct.toFixed(d).split('.');
  return groupThousands(int) + (dec ? ',' + dec : '') + '%';
}

/** Número compacto para ejes de gráficas: 1.500.000 → "1,5 M", 25.000 → "25 mil" */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return (value / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '') + ' M';
  if (abs >= 10_000) return formatNumber(value / 1000) + ' mil';
  return formatNumber(value);
}
