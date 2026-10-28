import test from "node:test";
import assert from "node:assert/strict";
import {
  clampDia,
  escalaVariable,
  nivelRiesgo,
  sectoresDelDia,
  totalesDelDia,
} from "../src/utils/epidemiologia.ts";
import type { TrayectoriaResponse } from "../src/types/trayectoria.ts";

const punto = (dia: number, zombis: number, acum: number, nuevos: number) => ({
  dia, zombis_activos: zombis, infectados_acumulados: acum, nuevos_contagios: nuevos, inmunes: 0,
  primer_dia_infeccion: null,
});

const trayectoria: TrayectoriaResponse = {
  aviso: "DATOS SIMULADOS",
  estrategia: "Nada",
  semilla: 42,
  dias: 3,
  parametros_efectivos: {},
  infectados_totales: 112,
  eventos: [],
  serie_global: [0, 1, 2, 3].map((d) => ({
    dia: d, SANO: 0, INCUBANDO: 0, PORTADOR: 0, INMUNE: 0,
    ZOMBI: [0, 30, 65, 25][d],
    nuevos_contagios: [1, 39, 70, 2][d],
    dosis_dia: 0, lugares_cerrados: 0, movimientos: [], nuevos_focos: [],
    contagios_por_lugar: [], eventos: [],
  })),
  serie_por_barrio: [
    {
      id: "A", nombre: "Sector A", lat: -0.95, lng: -80.72, poblacion: 1000, primer_dia_infeccion: 0,
      puntos: [punto(0, 0, 1, 1), punto(1, 30, 40, 39), punto(2, 60, 100, 60), punto(3, 20, 100, 0)],
    },
    {
      id: "B", nombre: "Sector B", lat: -0.96, lng: -80.71, poblacion: 500, primer_dia_infeccion: 2,
      puntos: [punto(0, 0, 0, 0), punto(1, 0, 0, 0), punto(2, 5, 10, 10), punto(3, 5, 12, 2)],
    },
  ],
};

test("nivel de riesgo según zombis activos por 1.000 habitantes", () => {
  assert.equal(nivelRiesgo(0, 0, 1000), "sin");
  assert.equal(nivelRiesgo(5, 20, 1000), "bajo");
  assert.equal(nivelRiesgo(40, 30, 1000), "medio");
  assert.equal(nivelRiesgo(100, 60, 1000), "alto");
  assert.equal(nivelRiesgo(100, 200, 1000), "critico");
  assert.equal(nivelRiesgo(10, 5, 0), "bajo");
});

test("el día se recorta al horizonte de la trayectoria", () => {
  assert.equal(clampDia(-3, 3), 0);
  assert.equal(clampDia(9, 3), 3);
  assert.equal(clampDia(2.4, 3), 2);
  assert.equal(clampDia(Number.NaN, 3), 0);
});

test("cada día usa exactamente sus propios datos", () => {
  const dia2 = sectoresDelDia(trayectoria, 2, "zombis");
  assert.equal(dia2[0].valor, 60);
  assert.equal(dia2[1].valor, 5);
  assert.equal(dia2[0].riesgo, "alto");
  assert.equal(dia2[1].riesgo, "bajo");

  const dia1 = sectoresDelDia(trayectoria, 1, "acumulados");
  assert.equal(dia1[0].valor, 40);
  assert.equal(dia1[1].valor, 0);
  assert.equal(dia1[1].riesgo, "sin");
});

test("las sumas por sector coinciden con la serie global de cada día", () => {
  for (let d = 0; d <= trayectoria.dias; d++) {
    const t = totalesDelDia(sectoresDelDia(trayectoria, d, "zombis"));
    assert.equal(t.zombis, trayectoria.serie_global[d].ZOMBI, `zombis día ${d}`);
    assert.equal(t.nuevos, trayectoria.serie_global[d].nuevos_contagios, `nuevos día ${d}`);
  }
});

test("indicadores de nuevos contagios y zonas en el día 2", () => {
  const t = totalesDelDia(sectoresDelDia(trayectoria, 2, "zombis"));
  assert.equal(t.zonasInfectadas, 2);
  assert.equal(t.zonasConZombis, 2);
  assert.equal(t.acumulados, 110);
});

test("el sector solo aparece como nuevo el día de su contagio", () => {
  assert.equal(sectoresDelDia(trayectoria, 1, "nuevos")[1].nuevo, false);
  assert.equal(sectoresDelDia(trayectoria, 2, "nuevos")[1].nuevo, true);
});

test("la escala de cada variable es el máximo de toda la trayectoria", () => {
  assert.equal(escalaVariable(trayectoria, "zombis"), 60);
  assert.equal(escalaVariable(trayectoria, "acumulados"), 100);
  assert.equal(escalaVariable(trayectoria, "nuevos"), 60);
});

test("un sector sin población no produce tasa", () => {
  const t = structuredClone(trayectoria);
  t.serie_por_barrio[0].poblacion = 0;
  assert.equal(sectoresDelDia(t, 2, "zombis")[0].tasa, 0);
});
