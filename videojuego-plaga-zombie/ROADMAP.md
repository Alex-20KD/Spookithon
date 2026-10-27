# 🗺️ ROADMAP - PLAGA ZOMBIE: Manabí

## ✅ FASE 1: SIMULADOR ESTRATÉGICO - COMPLETADA

### Características Implementadas:
- ✅ Modelo matemático SZR completo con propagación
- ✅ Mapa interactivo de 23 cantones de Manabí
- ✅ Modo Gobierno con presupuesto y acciones
- ✅ Modo Virus con sistema de mutaciones
- ✅ Panel de estadísticas con gráficas en tiempo real
- ✅ Sistema de noticias dinámicas
- ✅ Diseño gótico y estética de terror
- ✅ Tests unitarios para el modelo matemático
- ✅ Interfaz responsive

---

## 🔜 FASE 2: MODO SUPERVIVENCIA POR OLEADAS

### Objetivo:
Acción 2D vista desde arriba con Phaser 3, multijugador online para 1-4 jugadores.

### Características a Implementar:

#### 2.1 Motor de Juego con Phaser 3
- [ ] Integrar Phaser 3 en el proyecto React
- [ ] Crear escena de juego 2D top-down
- [ ] Sistema de física y colisiones
- [ ] Sistema de sprites y animaciones

#### 2.2 Jugabilidad Core
- [ ] Control de personaje (WASD + mouse)
- [ ] Sistema de disparo en 8 direcciones
- [ ] Sistema de vida y daño
- [ ] Interfaz de juego (HUD con vida, munición, ronda)

#### 2.3 Sistema de Oleadas
- [ ] Spawn de zombies por oleadas
- [ ] Dificultad incremental (más zombies, más fuertes)
- [ ] Contador de rondas
- [ ] Tiempo de descanso entre oleadas
- [ ] Ranking de supervivencia

#### 2.4 Arsenal de Armas
- [ ] **Pistola:** Arma inicial, munición infinita
- [ ] **Escopeta:** Alto daño, corto alcance
- [ ] **Rifle:** Medio alcance, cadencia rápida
- [ ] **Lanzallamas:** Área de efecto, daño continuo
- [ ] **Ballesta:** Daño alto, cadencia lenta
- [ ] Sistema de recarga y munición

#### 2.5 Tienda entre Rondas
- [ ] Menú de compra de armas
- [ ] Sistema de mejoras:
  - Daño aumentado
  - Cargador ampliado
  - Velocidad de disparo
- [ ] Moneda ganada por eliminar zombies
- [ ] Precios balanceados

#### 2.6 Multijugador (1-4 Jugadores)
- [ ] Integración con AWS API Gateway WebSockets
- [ ] Lambda functions para lógica de servidor
- [ ] Sincronización de posiciones
- [ ] Sincronización de enemigos
- [ ] Sistema de lobby y matchmaking
- [ ] Chat de voz/texto

#### 2.7 Conversión Zombie
- [ ] Si un jugador muere, revive como zombie
- [ ] Control de zombie con habilidades especiales
- [ ] Ataca a antiguos compañeros
- [ ] Balance de poder zombie vs humanos

#### 2.8 Selección de Cantón
- [ ] Desde el mapa del simulador, entrar a un cantón infectado
- [ ] Diferentes mapas según el cantón
- [ ] Escenarios ambientados en Manabí

### Tecnologías Necesarias:
- Phaser 3 (ya incluido)
- AWS API Gateway WebSockets
- AWS Lambda
- DynamoDB para estado del juego

---

## 🧟 FASE 3: TIPOS DE ZOMBIES Y JEFES

### Objetivo:
Variedad de enemigos con diseños únicos y mecánicas especiales.

### 3.1 Tipos de Zombies Comunes

#### Gótica
- [ ] Sprite y animaciones
- [ ] Sigilosa, casi invisible de noche
- [ ] Baja vida, alto daño de emboscada
- [ ] Carta con ilustración e información

#### E-girl Viral
- [ ] Sprite y animaciones
- [ ] "Transmite en vivo" atrayendo hordas
- [ ] Puede teletransportarse a cantones lejanos
- [ ] Aumenta spawn rate temporalmente
- [ ] Carta con ilustración e información

#### Corredor
- [ ] Sprite y animaciones
- [ ] Zombie muy rápido
- [ ] Baja vida, difícil de apuntar
- [ ] Carta con ilustración e información

#### Tanque Deforme
- [ ] Sprite grande y animaciones
- [ ] Muy resistente, lento
- [ ] Requiere múltiples jugadores
- [ ] Carta con ilustración e información

#### Escupidor
- [ ] Sprite y animaciones
- [ ] Ataque a distancia con ácido
- [ ] Zona de daño continuo
- [ ] Carta con ilustración e información

#### Enjambre
- [ ] Múltiples sprites coordinados
- [ ] Horda que ataca en grupo
- [ ] Bonus al estar cerca unos de otros
- [ ] Carta con ilustración e información

### 3.2 Jefes con Entrada Dramática

#### La Reina del Luto
- [ ] Boss fight elaborado
- [ ] Entrada cinemática
- [ ] Barra de vida especial
- [ ] Potencia a zombies góticas cercanas
- [ ] Fases de combate (3 fases)
- [ ] Drops especiales

#### La Matriarca Viral
- [ ] Boss fight elaborado
- [ ] Causa brotes en varios cantones simultáneamente
- [ ] Convoca e-girls virales
- [ ] Mecánica de "transmisión" que debe interrumpirse

#### La Abominación
- [ ] Boss fight elaborado
- [ ] Fusión grotesca de múltiples cuerpos
- [ ] Múltiples puntos débiles
- [ ] Habilidades variadas según fase

#### El Paciente Cero (Jefe Final)
- [ ] Boss fight épico de múltiples fases
- [ ] Combina habilidades de todos los jefes
- [ ] Cinemática de introducción
- [ ] Cinemática de victoria/derrota

### 3.3 Sistema de Cartas Coleccionables
- [ ] UI para colección de cartas
- [ ] Ilustraciones profesionales para cada tipo
- [ ] Descripciones lore-friendly
- [ ] Estadísticas detalladas
- [ ] Progreso de colección

---

## 📖 FASE 4: MODO HISTORIA CORTO

### Objetivo:
Campaña narrativa de 5 capítulos que mezcla cinemáticas con acción.

### 4.1 Capítulo 1: Manta - El Arribo
- [ ] Cinemática de introducción
- [ ] El barco llega al puerto
- [ ] Descubrimiento del Paciente Cero
- [ ] Misión: Investigar el puerto de noche
- [ ] Tutorial de mecánicas

### 4.2 Capítulo 2: Montecristi - La Reina del Luto
- [ ] Cinemática del brote
- [ ] El virus se esparce desde Manta
- [ ] Aparición de La Reina del Luto
- [ ] Misión: Rescatar sobrevivientes
- [ ] Boss fight contra La Reina

### 4.3 Capítulo 3: Portoviejo - Caos en la Capital
- [ ] Cinemática de la ciudad cayendo
- [ ] La Matriarca Viral transmite el caos
- [ ] Misión: Evacuar el hospital central
- [ ] Misión: Destruir antenas de transmisión
- [ ] Boss fight contra La Matriarca

### 4.4 Capítulo 4: Jipijapa - El Laboratorio Secreto
- [ ] Cinemática del descubrimiento
- [ ] Laboratorio gubernamental secreto
- [ ] Origen del virus revelado
- [ ] La Abominación es un experimento fallido
- [ ] Misión: Infiltrar el laboratorio
- [ ] Boss fight contra La Abominación

### 4.5 Capítulo 5: Final - Salvar Manabí
- [ ] Cinemática del enfrentamiento final
- [ ] Encontrar a El Paciente Cero
- [ ] Misión: Llegar al epicentro
- [ ] Boss fight épico final
- [ ] Múltiples finales según desempeño
- [ ] Cinemática de cierre

### 4.6 Sistema Narrativo
- [ ] Motor de cinemáticas con diálogos
- [ ] Sistema de decisiones (opcional)
- [ ] Cutscenes con ilustraciones
- [ ] Voces en off o texto dramatizado
- [ ] Música temática por capítulo

---

## ⚔️ FASE 5: MODO BATTLE ROYALE

### Objetivo:
Multijugador masivo, sobrevivientes vs zombies en mapa que se reduce.

### 5.1 Mecánicas Core
- [ ] Mapa grande del simulador adaptado
- [ ] 20-50 jugadores por partida
- [ ] Zona segura que se reduce con niebla tóxica
- [ ] Sistema de loot aleatorio
- [ ] Inventario de armas y recursos

### 5.2 Sistema de Facciones
- [ ] Al inicio: elegir Sobreviviente o Zombie
- [ ] **Sobrevivientes:**
  - Buscan armas y recursos
  - Pueden combatir entre sí o cooperar
  - Infectados se convierten en zombies
- [ ] **Zombies:**
  - Empiezan sin armas pero con habilidades
  - Infectan a sobrevivientes
  - Ganan si infectan a todos

### 5.3 Condiciones de Victoria
- [ ] **Sobrevivientes:** Último humano vivo
- [ ] **Zombies:** Infectar a todos los sobrevivientes
- [ ] Ranking de kills y supervivencia

### 5.4 Zona Tóxica
- [ ] Niebla que avanza desde los bordes
- [ ] Daño incremental fuera de la zona
- [ ] Marcadores visuales y de audio
- [ ] Fases de cierre programadas

### 5.5 Sistema de Loot
- [ ] Cajas de armas aleatorias
- [ ] Rareza: Común, Raro, Épico, Legendario
- [ ] Consumibles: Botiquines, munición, granadas
- [ ] Mapa de loot destacado

### 5.6 Infraestructura Multijugador
- [ ] Matchmaking regional
- [ ] Servidor dedicado por partida
- [ ] Ping y latencia optimizados
- [ ] Sistema anti-cheat básico
- [ ] Replay y estadísticas

---

## 🤖 FASE 6: INTELIGENCIA ARTIFICIAL

### Objetivo:
IA generativa para narrativa dinámica y asesoramiento estratégico.

### 6.1 Narrador con IA (Amazon Bedrock)
- [ ] Integración con Amazon Bedrock
- [ ] Generación de noticias contextuales según partida
- [ ] Diálogos dinámicos para Modo Historia
- [ ] Descripciones de eventos únicos
- [ ] Personalización según acciones del jugador

### 6.2 Asesor Estratégico (Modo Gobierno)
- [ ] Sistema de recomendaciones inteligentes
- [ ] Análisis de riesgo por cantón
- [ ] Sugerencias de medidas a tomar
- [ ] Predicciones de propagación
- [ ] Chat interactivo para consultas

### 6.3 Generador de Eventos Dinámicos
- [ ] Eventos aleatorios influenciados por IA
- [ ] Mutaciones únicas generadas proceduralmente
- [ ] Descripciones lore-friendly

### 6.4 Sistema de Tutorial Inteligente
- [ ] IA detecta dificultades del jugador
- [ ] Tips contextuales
- [ ] Ajuste dinámico de dificultad

---

## 🏗️ INFRAESTRUCTURA AWS

### Servicios a Implementar:

#### API Gateway WebSockets
- [ ] Configuración de endpoints
- [ ] Manejo de conexiones
- [ ] Broadcast de mensajes

#### AWS Lambda
- [ ] Funciones para matchmaking
- [ ] Lógica de servidor de juego
- [ ] Sincronización de estado
- [ ] Gestión de partidas

#### DynamoDB
- [ ] Tabla de usuarios
- [ ] Tabla de partidas activas
- [ ] Tabla de estadísticas
- [ ] Tabla de progreso de campaña

#### Amazon Cognito
- [ ] Registro de usuarios
- [ ] Autenticación
- [ ] Perfiles de jugador
- [ ] OAuth social (opcional)

#### AWS Amplify
- [ ] Hosting del frontend
- [ ] CI/CD automático
- [ ] Dominio personalizado
- [ ] SSL/HTTPS

#### Amazon Bedrock (IA)
- [ ] Configuración de modelo
- [ ] Prompts optimizados
- [ ] Rate limiting
- [ ] Cache de respuestas

---

## 📊 MÉTRICAS Y ANALÍTICAS

### A implementar en todas las fases:

- [ ] AWS CloudWatch para logs
- [ ] Métricas de usuarios activos
- [ ] Retención de jugadores
- [ ] Tiempo promedio de juego
- [ ] Tasa de conversión (tutorial → juego completo)
- [ ] Eventos de analytics con Amplify Analytics

---

## 🎨 DISEÑO Y ARTE

### Assets Pendientes:

#### Sprites y Animaciones
- [ ] 6 tipos de zombies + variaciones
- [ ] 4 jefes con múltiples fases
- [ ] Jugadores (4 skins diferentes)
- [ ] Armas (5 armas + efectos)
- [ ] Efectos de partículas
- [ ] Tiles para mapas de cantones

#### Ilustraciones
- [ ] Cartas de zombies (10 cartas)
- [ ] Cartas de jefes (4 cartas)
- [ ] Cinemáticas del Modo Historia (15-20 escenas)
- [ ] Fondos para menús
- [ ] Iconografía UI

#### Audio
- [ ] Música de menú (gótica, ambiental)
- [ ] Música de combate (intensa)
- [ ] Música de jefes (épica)
- [ ] SFX de armas (5 armas × 3 sonidos)
- [ ] SFX de zombies (gemidos, ataques)
- [ ] SFX de ambiente (niebla, viento, pasos)

---

## 🚀 LANZAMIENTO

### Pre-Lanzamiento
- [ ] Beta cerrada con testers
- [ ] Balanceo de dificultad
- [ ] Optimización de rendimiento
- [ ] Testing de carga de servidores
- [ ] Traducción a inglés

### Lanzamiento
- [ ] Landing page
- [ ] Trailer de lanzamiento
- [ ] Presencia en redes sociales
- [ ] Marketing en comunidades de gaming
- [ ] Press kit

### Post-Lanzamiento
- [ ] Actualizaciones de contenido
- [ ] Eventos especiales temporales
- [ ] Sistema de temporadas
- [ ] DLC o expansiones

---

## 📅 ESTIMACIÓN DE TIEMPOS

| Fase | Complejidad | Tiempo Estimado |
|------|-------------|-----------------|
| Fase 1 | Alta | ✅ Completada |
| Fase 2 | Muy Alta | 4-6 semanas |
| Fase 3 | Alta | 3-4 semanas |
| Fase 4 | Media | 2-3 semanas |
| Fase 5 | Muy Alta | 5-7 semanas |
| Fase 6 | Media | 2-3 semanas |
| **TOTAL** | - | **16-23 semanas** |

*Estimaciones para un equipo de 2-3 desarrolladores*

---

## 🎯 PRIORIDADES

### Críticas (Para Beta Jugable):
1. Fase 2 completa (Supervivencia)
2. Al menos 3 tipos de zombies (Fase 3)
3. Sistema de armas completo

### Importantes (Para Lanzamiento):
1. Modo Historia (Fase 4)
2. Todos los tipos de zombies y jefes (Fase 3)
3. IA básica (Fase 6)

### Opcionales (Post-Lanzamiento):
1. Battle Royale (Fase 5)
2. IA avanzada (Fase 6)
3. Eventos y temporadas

---

**¡El desarrollo continúa! La Fase 1 es solo el comienzo del apocalipsis...** 🧟‍♂️🔥
