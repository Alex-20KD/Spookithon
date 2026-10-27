import { describe, it, expect } from 'vitest';
import geojsonText from '../../public/assets/mapa/manabi-cantones.geojson?raw';
import { MANABI_CANTONS } from './manabi-data';

interface CantonFeature {
  properties: {
    id: string;
    nombre: string;
    poblacion: number;
    centro: [number, number];
    area_km2: number;
    vecinos: string[];
  };
}

const geojson = JSON.parse(geojsonText) as { features: CantonFeature[] };

describe('manabi-data coincide con el GeoJSON', () => {
  it('tiene los mismos 22 cantones', () => {
    expect(geojson.features).toHaveLength(22);
    expect(MANABI_CANTONS).toHaveLength(22);
    expect(MANABI_CANTONS.map(c => c.id).sort()).toEqual(geojson.features.map(f => f.properties.id).sort());
  });

  it('nombre, población, centro, área y vecinos coinciden', () => {
    for (const f of geojson.features) {
      const p = f.properties;
      const canton = MANABI_CANTONS.find(c => c.id === p.id)!;
      expect(canton.name).toBe(p.nombre);
      expect(canton.population).toBe(p.poblacion);
      expect(canton.area_km2).toBe(p.area_km2);
      expect(canton.centro[0]).toBeCloseTo(p.centro[0], 4);
      expect(canton.centro[1]).toBeCloseTo(p.centro[1], 4);
      expect([...canton.connections].sort()).toEqual([...p.vecinos].sort());
    }
  });
});
