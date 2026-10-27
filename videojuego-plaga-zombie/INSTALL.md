# 🚀 Guía de Instalación - PLAGA ZOMBIE: Manabí

## Requisitos Previos

- **Node.js** versión 18 o superior
- **npm** o **yarn**
- Navegador web moderno (Chrome, Firefox, Edge)

## Pasos de Instalación

### 1. Verificar Node.js y npm

Abre una terminal y ejecuta:

```bash
node --version
npm --version
```

Si no tienes Node.js instalado, descárgalo desde: https://nodejs.org/

### 2. Instalar Dependencias

En la carpeta del proyecto, ejecuta:

```bash
npm install
```

O si usas yarn:

```bash
yarn install
```

Esto instalará todas las dependencias necesarias:
- React 18.3.1
- TypeScript 5.5.3
- Vite 5.3.1
- Phaser 3.80.1
- Zustand 4.5.2
- Recharts 2.12.7
- Vitest 1.6.0

### 3. Ejecutar en Modo Desarrollo

```bash
npm run dev
```

El servidor de desarrollo se iniciará en: http://localhost:3000

### 4. Compilar para Producción

```bash
npm run build
```

Los archivos compilados estarán en la carpeta `dist/`

### 5. Preview de Producción

```bash
npm run preview
```

### 6. Ejecutar Tests

```bash
npm test
```

## Troubleshooting

### Error: Scripts deshabilitados en Windows PowerShell

Si encuentras el error "la ejecución de scripts está deshabilitada", ejecuta:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Luego intenta de nuevo con `npm install`.

### Error: Puerto 3000 en uso

Si el puerto 3000 está ocupado, Vite automáticamente usará el siguiente puerto disponible (3001, 3002, etc).

### Problemas con Canvas o Phaser

Asegúrate de estar usando un navegador moderno. Si usas navegadores antiguos, puede haber problemas con Canvas 2D y WebGL.

## Estructura de Carpetas Post-Instalación

```
Hackaton-Videojuego/
├── node_modules/           # Dependencias (se crea con npm install)
├── src/                    # Código fuente
│   ├── components/         # Componentes React
│   ├── data/               # Datos de cantones
│   ├── simulation/         # Modelo matemático
│   └── store/              # Estado global
├── dist/                   # Build de producción (se crea con npm run build)
├── package.json            # Configuración del proyecto
├── tsconfig.json           # Configuración de TypeScript
├── vite.config.ts          # Configuración de Vite
└── README.md               # Documentación principal
```

## Verificación de Instalación

Una vez instalado y ejecutando, deberías ver:

1. **Menú Principal** con opciones:
   - Modo Gobierno
   - Modo Virus
   - Próximamente (fases futuras)

2. **Simulador** al seleccionar un modo:
   - Mapa de Manabí con 23 cantones
   - Panel de estadísticas
   - Panel de control
   - Panel de noticias

## Próximos Pasos

Una vez que el proyecto esté funcionando:

1. Explora el **Modo Gobierno** y trata de contener la infección
2. Prueba el **Modo Virus** e infecta todos los cantones
3. Experimenta con diferentes estrategias
4. Revisa el código en `src/` para entender la arquitectura

## Soporte

Si encuentras problemas:
1. Verifica que Node.js y npm estén correctamente instalados
2. Borra `node_modules` y `package-lock.json` y vuelve a instalar
3. Asegúrate de estar en la carpeta correcta del proyecto
4. Revisa la consola del navegador para errores específicos

---

**¡Listo para comenzar el apocalipsis zombie en Manabí!** 🧟‍♂️
