// Datos de los 22 cantones de Manabí, Ecuador
// Sincronizados con public/assets/mapa/manabi-cantones.geojson
// (una prueba en manabi-data.test.ts verifica que coincidan).

export interface Canton {
  id: string;
  name: string;
  population: number;
  connections: string[]; // "vecinos" del GeoJSON: cantones que comparten frontera
  centro: [number, number]; // [longitud, latitud]
  area_km2: number;
}

export const MANABI_CANTONS: Canton[] = [
  {
    id: 'manta',
    name: 'Manta',
    population: 250000,
    centro: [-80.8203, -1.0376],
    area_km2: 306.9,
    connections: ['montecristi', 'jaramijo']
  },
  {
    id: 'portoviejo',
    name: 'Portoviejo',
    population: 280000,
    centro: [-80.4201, -1.0697],
    area_km2: 967.5,
    connections: ['montecristi', 'jaramijo', 'jipijapa', 'sucre', 'rocafuerte', 'junin', 'bolivar', 'pichincha', 'santa-ana']
  },
  {
    id: 'montecristi',
    name: 'Montecristi',
    population: 75000,
    centro: [-80.6634, -1.0964],
    area_km2: 734.2,
    connections: ['manta', 'portoviejo', 'jaramijo', 'jipijapa']
  },
  {
    id: 'jaramijo',
    name: 'Jaramijó',
    population: 20000,
    centro: [-80.5935, -0.9720],
    area_km2: 10.8,
    connections: ['manta', 'portoviejo', 'montecristi']
  },
  {
    id: 'jipijapa',
    name: 'Jipijapa',
    population: 80000,
    centro: [-80.6086, -1.3214],
    area_km2: 1413.1,
    connections: ['portoviejo', 'montecristi', 'santa-ana', '24-de-mayo', 'puerto-lopez', 'pajan']
  },
  {
    id: 'chone',
    name: 'Chone',
    population: 130000,
    centro: [-80.0593, -0.6295],
    area_km2: 3570,
    connections: ['el-carmen', 'pedernales', 'jama', 'san-vicente', 'sucre', 'tosagua', 'bolivar', 'pichincha', 'flavio-alfaro']
  },
  {
    id: 'el-carmen',
    name: 'El Carmen',
    population: 95000,
    centro: [-79.5350, -0.3534],
    area_km2: 1229.2,
    connections: ['chone', 'flavio-alfaro']
  },
  {
    id: 'pedernales',
    name: 'Pedernales',
    population: 60000,
    centro: [-79.8342, 0.1371],
    area_km2: 1969.7,
    connections: ['chone', 'jama']
  },
  {
    id: 'jama',
    name: 'Jama',
    population: 25000,
    centro: [-80.1856, -0.1999],
    area_km2: 563.8,
    connections: ['chone', 'pedernales', 'san-vicente', 'sucre']
  },
  {
    id: 'san-vicente',
    name: 'San Vicente',
    population: 30000,
    centro: [-80.3471, -0.5063],
    area_km2: 707.2,
    connections: ['chone', 'jama', 'sucre']
  },
  {
    id: 'sucre',
    name: 'Sucre',
    population: 60000,
    centro: [-80.4205, -0.7304],
    area_km2: 757.3,
    connections: ['portoviejo', 'chone', 'jama', 'san-vicente', 'tosagua', 'rocafuerte']
  },
  {
    id: 'tosagua',
    name: 'Tosagua',
    population: 45000,
    centro: [-80.2677, -0.7796],
    area_km2: 377.4,
    connections: ['chone', 'sucre', 'rocafuerte', 'junin', 'bolivar']
  },
  {
    id: 'rocafuerte',
    name: 'Rocafuerte',
    population: 35000,
    centro: [-80.4171, -0.9017],
    area_km2: 260,
    connections: ['portoviejo', 'sucre', 'tosagua', 'junin']
  },
  {
    id: 'junin',
    name: 'Junín',
    population: 22000,
    centro: [-80.2242, -0.9381],
    area_km2: 257.7,
    connections: ['portoviejo', 'tosagua', 'rocafuerte', 'bolivar']
  },
  {
    id: 'bolivar',
    name: 'Bolívar',
    population: 42000,
    centro: [-79.9859, -0.9060],
    area_km2: 619,
    connections: ['portoviejo', 'chone', 'tosagua', 'junin', 'pichincha']
  },
  {
    id: 'pichincha',
    name: 'Pichincha',
    population: 32000,
    centro: [-79.7877, -0.7853],
    area_km2: 434.4,
    connections: ['portoviejo', 'chone', 'bolivar', 'santa-ana']
  },
  {
    id: 'flavio-alfaro',
    name: 'Flavio Alfaro',
    population: 30000,
    centro: [-79.7695, -0.2183],
    area_km2: 916,
    connections: ['chone', 'el-carmen']
  },
  {
    id: 'santa-ana',
    name: 'Santa Ana',
    population: 50000,
    centro: [-80.1571, -1.1942],
    area_km2: 967.3,
    connections: ['portoviejo', 'jipijapa', 'pichincha', '24-de-mayo', 'olmedo']
  },
  {
    id: '24-de-mayo',
    name: '24 de Mayo',
    population: 30000,
    centro: [-80.3487, -1.3930],
    area_km2: 499.1,
    connections: ['jipijapa', 'santa-ana', 'pajan', 'olmedo']
  },
  {
    id: 'puerto-lopez',
    name: 'Puerto López',
    population: 22000,
    centro: [-80.7513, -1.5958],
    area_km2: 431,
    connections: ['jipijapa']
  },
  {
    id: 'pajan',
    name: 'Paján',
    population: 40000,
    centro: [-80.4127, -1.6378],
    area_km2: 1086.9,
    connections: ['jipijapa', '24-de-mayo', 'olmedo']
  },
  {
    id: 'olmedo',
    name: 'Olmedo',
    population: 12000,
    centro: [-80.2102, -1.3556],
    area_km2: 185.3,
    connections: ['santa-ana', '24-de-mayo', 'pajan']
  }
];

// Mapa de cantones por ID para acceso rápido
export const CANTONS_MAP = new Map<string, Canton>(
  MANABI_CANTONS.map(canton => [canton.id, canton])
);

export { formatNumber, formatMoney, formatPercent } from '../utils/format';
