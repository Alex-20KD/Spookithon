# 🧟 PLAGA ZOMBIE: MANABÍ

Un videojuego web ambicioso que combina simulación estratégica tipo Plague Inc con modos de acción 2D. Estética gótica y de terror, nivel profesional.

## 🎬 MEJORAS PROFESIONALES

### ✅ BLOQUE 1: CINEMÁTICA DE INTRO
Sistema de cinemáticas tipo cómic animado profesional:
- 5 escenas con efectos de cámara (zoom, paneo)
- Texto narrado letra por letra con efecto typewriter
- Transiciones suaves entre escenas
- Pantalla de título final con efecto de sangre
- Botón de saltar siempre visible
- Sistema de audio preparado
- **Ver:** `BLOQUE1_CINEMATICA.md` para detalles completos

## 🎮 FASE 1: SIMULADOR ESTRATÉGICO ✅ IMPLEMENTADA

### Características Implementadas:

#### Simulación Matemática
- **Modelo SZR (Sanos, Zombies, Removidos)** completamente funcional
- Propagación realista entre cantones basada en población y transporte
- Sistema de migraciones con efectos de cuarentenas y bloqueos
- Parámetros ajustables (beta, gamma, mu) para infecciosidad, eliminación y movilidad

#### Mapa Interactivo
- **23 cantones reales de Manabí, Ecuador** con datos demográficos
- Mapa interactivo dibujado en Canvas con:
  - Colores dinámicos según nivel de infección
  - Efectos de brillo para cantones infectados
  - Indicadores visuales de cuarentena y presencia militar
  - Sistema de conexiones por carreteras
  - Leyenda de colores

#### Modo Gobierno 🏛️
**Objetivo:** Salvar a Manabí del apocalipsis zombie

Recursos disponibles:
- **Presupuesto:** $1,000,000 inicial + $50,000 por día
- **Acciones:**
  - 🔒 **Cuarentena** ($50,000): Reduce transmisión en 70%
  - ⚔️ **Despliegue Militar** ($100,000): Aumenta eliminación en 80%
  - 🚧 **Bloqueo de Carreteras** ($30,000): Reduce migración en 90%
  - 📢 **Campaña de Prevención** ($20,000): Información a la población
  - 🔬 **Investigación de Cura** (variable): Progreso hacia la cura definitiva

#### Modo Virus 🦠
**Objetivo:** Infectar todos los cantones de Manabí

Mecánicas:
- **Puntos de Evolución:** Ganados según número de infectados (1 punto por cada 10,000 zombies)
- **Sistema de Mutaciones:**
  - **Infección Rápida** (10 pts): +50% velocidad de transmisión
  - **Resistencia** (15 pts): -30% tasa de eliminación
  - **Vagabundo** (12 pts): +80% movilidad entre cantones
  - **Sigiloso** (20 pts): +20% transmisión, reduce efectividad de cuarentenas

#### Interfaz y UX
- **Panel de Estadísticas Globales** con gráficas en tiempo real
- **Panel de Noticias** con eventos dinámicos generados según la simulación
- **Panel de Detalles por Cantón** con estadísticas específicas
- **Controles de Velocidad:** Pausa, Normal, Rápido, Ultra
- **Contador de Días** con simulación día a día

#### Diseño Gótico y Terror
- Paleta de colores oscura: negros, morados (#9d4edd) y rojos sangre (#8b0000)
- Efectos visuales: brillos, sombras, niebla
- Tipografía dramática (Metal Mania, Nosifer)
- Animaciones sutiles (pulse, flicker)
- Tema oscuro profesional en toda la interfaz

### Tecnologías Utilizadas

- **React 18** con TypeScript para la interfaz
- **Zustand** para gestión de estado global
- **Canvas API** para el mapa interactivo
- **Recharts** para visualización de datos
- **Vite** para build y desarrollo rápido
- **CSS3** con animaciones y efectos avanzados

## 🚀 Instalación y Ejecución

```bash
# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Compilar para producción
npm run build

# Preview de producción
npm run preview

# Ejecutar tests
npm test
```

## 📁 Estructura del Proyecto

```
src/
├── data/
│   └── manabi-data.ts          # Datos de cantones de Manabí
├── simulation/
│   └── szr-model.ts             # Modelo matemático SZR
├── store/
│   └── game-store.ts            # Estado global con Zustand
├── components/
│   ├── MainMenu.tsx             # Menú principal
│   ├── SimulatorGame.tsx        # Juego simulador
│   ├── MapCanvas.tsx            # Mapa interactivo
│   ├── ControlPanel.tsx         # Controles y recursos
│   ├── StatsPanel.tsx           # Estadísticas globales
│   ├── NewsPanel.tsx            # Panel de noticias
│   └── CantonDetailPanel.tsx   # Detalles de cantón
├── App.tsx                      # Aplicación principal
└── main.tsx                     # Punto de entrada
```

## 🎯 Modelo Matemático SZR

El modelo implementado simula la propagación de infección zombie usando ecuaciones diferenciales discretas:

### Variables por Cantón:
- **S (Susceptible):** Población sana
- **Z (Zombie):** Población infectada activa
- **R (Removed):** Zombies eliminados permanentemente

### Ecuaciones:
```
ΔZ = β * S * (Z/N) - γ * Z
ΔS = -β * S * (Z/N)
ΔR = γ * Z
```

Donde:
- **β (beta):** Tasa de transmisión (default: 0.3)
- **γ (gamma):** Tasa de eliminación (default: 0.1)
- **μ (mu):** Tasa de movilidad entre cantones (default: 0.05)
- **N:** Población total del cantón

### Modificadores:
- **Cuarentena:** Reduce β en 70%
- **Militares:** Aumenta γ en 80%
- **Bloqueo de carreteras:** Reduce μ en 90%

## 📊 Datos de Manabí

El juego incluye 23 cantones reales de Manabí con:
- Datos demográficos aproximados
- Conexiones por carreteras reales
- Coordenadas geográficas (simplificadas para el mapa)

### Cantones Incluidos:
Manta, Portoviejo, Montecristi, Jipijapa, Chone, El Carmen, Pedernales, Jama, San Vicente, Sucre, Tosagua, Rocafuerte, Junín, Bolívar, Pichincha, Flavio Alfaro, Santa Ana, 24 de Mayo, Olmedo, Puerto López, Puerto Cayo, Paján, Jaramijó.

## 🎨 Diseño Visual

### Paleta de Colores:
- **Fondo:** Gradiente negro a morado oscuro
- **Acentos:** Morado (#9d4edd) y rojo sangre (#8b0000)
- **Texto:** Gris claro (#e0e0e0)
- **Sanos:** Verde oscuro (#4a8c2a)
- **Infectados:** Rojo (#ff0000)
- **Eliminados:** Gris (#666)

### Efectos Visuales:
- Sombras y brillos con efecto neón
- Animaciones de pulsación
- Efectos de parpadeo (flicker)
- Bordes luminosos en elementos interactivos

## 🔜 FASES FUTURAS

### FASE 2: Modo Supervivencia por Oleadas
- Acción 2D con Phaser 3
- Multijugador online (1-4 jugadores)
- Sistema de oleadas
- Tienda de armas
- Conversión zombie de jugadores caídos

### FASE 3: Tipos de Zombies y Jefes
- Gótica, E-girl Viral, Corredor, Tanque, Escupidor, Enjambre
- Jefes: Reina del Luto, Matriarca Viral, Abominación, Paciente Cero

### FASE 4: Modo Historia
- 5 capítulos narrativos
- Misiones de acción
- Cinemáticas

### FASE 5: Battle Royale
- Mapa con zona tóxica
- Sobrevivientes vs Zombies
- Multijugador masivo

### FASE 6: Inteligencia Artificial
- Narrador con Amazon Bedrock
- Asesor estratégico
- Noticias generadas dinámicamente

## 🏗️ Infraestructura Futura (AWS)

Para fases multijugador:
- **API Gateway WebSockets** para comunicación en tiempo real
- **AWS Lambda** para lógica de servidor
- **DynamoDB** para persistencia de datos
- **Amazon Cognito** para autenticación
- **AWS Amplify** para hosting y deployment

## 📝 Notas de Desarrollo

### Tests
El modelo matemático debe ser testeado para asegurar:
- ✅ Conservación de población (S + Z + R = constante)
- ✅ Valores no negativos
- ✅ Efectos correctos de modificadores
- ✅ Migración balanceada entre cantones

### Optimizaciones Futuras
- WebWorkers para simulación pesada
- Memoización de cálculos repetitivos
- Compresión de historial de datos
- Caché de renderizado en Canvas

## 🎮 Cómo Jugar

### Modo Gobierno:
1. Monitorea el mapa de Manabí
2. Selecciona cantones infectados
3. Aplica medidas de control estratégicamente
4. Administra tu presupuesto
5. Invierte en la cura
6. **¡Salva Manabí antes de que sea tarde!**

### Modo Virus:
1. Observa cómo tu plaga se expande
2. Gana puntos de evolución
3. Desbloquea mutaciones letales
4. Supera las defensas del gobierno
5. **¡Infecta todos los cantones!**

## 👨‍💻 Autor

**PLAGA ZOMBIE: Manabí** - Fase 1 Completa
Simulador Estratégico Profesional

---

**¡Que comience el apocalipsis zombie en Manabí!** 🧟‍♂️🧟‍♀️
