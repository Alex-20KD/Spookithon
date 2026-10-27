# ⚡ INICIO RÁPIDO - PLAGA ZOMBIE: Manabí

## 🚀 Opción 1: Script Automático (Windows)

Simplemente haz doble clic en:

```
start.bat
```

Esto instalará todo y abrirá el juego automáticamente.

---

## 🔧 Opción 2: Manual

### Paso 1: Instalar Dependencias

```bash
npm install
```

### Paso 2: Ejecutar el Juego

```bash
npm run dev
```

### Paso 3: Abrir en Navegador

Abre: http://localhost:3000

---

## 🎮 CONTROLES

### Menú Principal
- **Click** en "MODO GOBIERNO" o "MODO VIRUS"

### En el Juego

#### Mapa:
- **Click en cantón** = Ver detalles y acciones
- **Click fuera** = Deseleccionar

#### Velocidad:
- **⏸ Pausa** = Detener simulación
- **▶ Normal** = 1 día cada 2 segundos
- **⏩ Rápido** = 1 día cada 0.5 segundos
- **⏭ Ultra** = 1 día cada 0.1 segundos

#### Modo Gobierno:
- **Click en acciones** = Aplicar medidas (requiere presupuesto)
- Monitorea tu presupuesto y progreso de cura

#### Modo Virus:
- **Click en mutaciones** = Desbloquear con puntos de evolución
- Acumula puntos infectando población

---

## 📖 PRIMEROS PASOS

### Tu Primera Partida como Gobierno:

1. ✅ Selecciona **MODO GOBIERNO**
2. ✅ Verás a **Manta** (costa) con el Paciente Cero (1 zombie)
3. ✅ **Click en Manta** para ver detalles
4. ✅ Aplica **Cuarentena** ($50k) inmediatamente
5. ✅ Si tienes presupuesto, despliega **Militares** ($100k)
6. ✅ **Click en Portoviejo** (ciudad conectada)
7. ✅ Bloquea la carretera entre Manta y Portoviejo ($30k)
8. ✅ Usa velocidad **Normal** o **Rápido**
9. ✅ Monitorea el panel de **Estadísticas**
10. ✅ Cuando tengas $200k+, invierte en **Investigación de Cura**

**Objetivo:** Llegar a 100% de cura antes de que Manabí caiga.

### Tu Primera Partida como Virus:

1. ✅ Selecciona **MODO VIRUS**
2. ✅ Observa cómo el virus se expande desde Manta
3. ✅ Usa velocidad **Rápido** para acumular puntos
4. ✅ Cuando tengas 10 pts, desbloquea **Infección Rápida**
5. ✅ Acumula más puntos
6. ✅ Desbloquea **Vagabundo** (12 pts) para expansión
7. ✅ Luego **Resistencia** (15 pts) para sobrevivir
8. ✅ Finalmente **Sigiloso** (20 pts) si el gobierno reacciona

**Objetivo:** Infectar todos los 23 cantones de Manabí.

---

## 🎯 OBJETIVOS DE VICTORIA

### Modo Gobierno:
- ✅ **Cura al 100%** = Victoria
- ❌ **80%+ población infectada** = Derrota

### Modo Virus:
- ✅ **Todos los cantones con >50% zombies** = Victoria
- ❌ **Virus erradicado (0 zombies)** = Derrota

---

## 📊 ENTENDIENDO LAS ESTADÍSTICAS

### Colores del Mapa:
- 🟢 **Verde:** Sin infección
- 🟡 **Amarillo:** < 20% infectados (Alerta)
- 🟠 **Naranja:** 20-50% infectados (Peligro)
- 🔴 **Rojo:** 50-80% infectados (Crítico)
- 🩸 **Rojo Sangre:** > 80% infectados (Apocalipsis)

### Indicadores en Cantones:
- 🔒 = Cuarentena activa
- ⚔️ = Presencia militar
- 🚧 = (en carreteras) Bloqueo activo

### Panel de Estadísticas:
- **Línea Verde:** Población sana (debería mantenerse alta en Gobierno)
- **Línea Roja:** Zombies activos (debería crecer en Virus)
- **Línea Gris:** Eliminados (zombies destruidos)

---

## 💡 TIPS Y ESTRATEGIAS

### Como Gobierno:

#### Estrategia Defensiva (Recomendada):
1. Contener el brote inicial con cuarentena
2. Bloquear carreteras desde cantones infectados
3. Desplegar militares en focos críticos
4. Invertir constantemente en cura
5. Usar campañas en cantones frontera

#### Estrategia Agresiva:
1. Desplegar militares masivamente
2. Eliminar zombies rápidamente
3. Menos inversión en cura
4. Riesgo: Si falla, es catastrófico

### Como Virus:

#### Estrategia Silenciosa:
1. Dejar crecer sin mutar al inicio
2. Acumular muchos puntos (20+)
3. Mutar todo de golpe
4. Expansión explosiva final

#### Estrategia Agresiva:
1. Mutar "Infección Rápida" inmediatamente
2. Luego "Vagabundo"
3. Expansión constante desde el inicio
4. Presión continua al gobierno

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### El juego no carga:
```bash
# Limpiar e reinstalar
npm install
npm run dev
```

### Puerto 3000 ocupado:
- Vite usará automáticamente 3001, 3002, etc.
- Mira la terminal para ver el puerto asignado

### Error de PowerShell:
- Usa el archivo `start.bat` en lugar de comandos manuales
- O ejecuta: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

### El mapa no se ve:
- Asegúrate de que tu navegador soporte Canvas 2D
- Usa Chrome, Firefox o Edge actualizado
- Presiona F12 y revisa Console por errores

---

## 📚 MÁS INFORMACIÓN

- **README.md** - Documentación completa
- **INSTALL.md** - Guía de instalación detallada
- **PHASE1_SUMMARY.md** - Resumen técnico de la Fase 1
- **ROADMAP.md** - Plan de fases futuras 2-6

---

## 🎊 ¡LISTO PARA JUGAR!

Ya tienes todo lo necesario para:
- 🏛️ Defender Manabí como Gobierno
- 🦠 Infectar Manabí como Virus
- 🧟 Disfrutar del apocalipsis zombie

**¡Que comience la plaga!** 🔥

---

**Desarrollado para Hackathon**  
**PLAGA ZOMBIE: Manabí - Fase 1**
