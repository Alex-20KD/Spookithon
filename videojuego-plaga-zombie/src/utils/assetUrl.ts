// Construye la URL de un asset respetando el 'base' de Vite.
// En dev base = "/", en build de produccion base = "/juego/".
// Uso: assetUrl("assets/mapa/manabi-cantones.geojson")  (sin barra inicial).
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL; // siempre termina en "/"
  const limpio = path.replace(/^\/+/, ""); // quita barras iniciales
  return base + limpio;
}
