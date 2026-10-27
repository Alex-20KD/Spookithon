import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Las pruebas cubren lógica pura (modelo, store, formato, datos); no necesitan DOM.
    // Antes era 'jsdom', que no está instalado y hacía fallar todas las pruebas.
    environment: 'node'
  }
});
