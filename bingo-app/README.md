# 🎱 Bingo App

Aplicación interactiva de Bingo para juego grupal, construida con **Angular 21** y **Tailwind CSS v4**. Permite una modalidad de juego presencial donde un anfitrión (host) controla la partida desde una pantalla central y cada jugador accede a su cartón individual desde su propio dispositivo móvil.

---

## 📋 Tabla de Contenidos

- [Requisitos Previos](#requisitos-previos)
- [Instalación](#instalación)
- [Arrancar el Proyecto](#arrancar-el-proyecto)
- [Cómo Jugar](#cómo-jugar)
- [Arquitectura](#arquitectura)
- [Estructura de Archivos](#estructura-de-archivos)
- [Rutas de la Aplicación](#rutas-de-la-aplicación)
- [Funcionalidades](#funcionalidades)
- [Stack Tecnológico](#stack-tecnológico)
- [Compilar para Producción](#compilar-para-producción)

---

## Requisitos Previos

- **Node.js** v18 o superior (se recomienda versión LTS/par)
- **npm** v9 o superior

> ⚠️ No es necesario instalar Angular CLI de forma global. El proyecto utiliza la versión local a través de `npx`.

---

## Instalación

1. Clonar el repositorio e ingresar a la carpeta del proyecto:

```bash
cd bingo-app
```

2. Instalar las dependencias:

```bash
npm install
```

---

## Arrancar el Proyecto

### Opción 1: Usando npm (recomendado)

```bash
npm start
```

### Opción 2: Usando npx

```bash
npx ng serve
```

### Opción 3: Especificando un puerto diferente

```bash
npx ng serve --port 4201
```

Una vez arrancado, abrir el navegador en:

👉 **http://localhost:4200**

> 💡 Si el puerto 4200 está ocupado, Angular preguntará si deseas usar otro puerto, o puedes especificarlo manualmente con `--port`.

---

## Cómo Jugar

### 1. Configuración Inicial

1. Abrir la aplicación en la pantalla principal del host (TV, proyector o PC).
2. En la pantalla de **Setup** (`/`), seleccionar el número de jugadores (2-20).
3. Presionar **"Iniciar Juego"**.

### 2. Pantalla del Host (`/host`)

1. Se mostrará el **dashboard del anfitrión** con:
   - Botón para extraer bolitas.
   - Tablero general con los 90 números.
   - Historial de las últimas bolitas extraídas.
   - **Códigos QR** individuales para cada jugador.
2. Los jugadores escanean su QR respectivo con su celular.
3. El host presiona **"Extraer Bolita"** para sacar números al azar.
4. Los números aparecen con animación y se marcan en el tablero general.

### 3. Pantalla del Jugador (`/player?player=ID`)

1. Cada jugador ve su **cartón único** con 15 números (del 1 al 90).
2. Al escuchar el número anunciado por el host, el jugador **toca el número** en su cartón para marcarlo.
3. Si se equivoca, puede **tocar de nuevo** para desmarcarlo (con confirmación).
4. El cartón muestra una **barra de progreso** con los números marcados.
5. En la esquina superior derecha se muestra la **última bolita extraída** por el host.
6. Al completar los 15 números, se activa una **animación de victoria** con confeti 🎉.

### 4. Flujo de Sincronización

- **Host → Jugadores**: Los números extraídos se guardan en `localStorage`. Los dispositivos de los jugadores leen periódicamente el estado del juego para mostrar la bolita actual.
- **Persistencia**: Tanto el host como los jugadores pueden refrescar la página sin perder su progreso.
- Si se cierra y reabre la app, la pantalla de Setup ofrecerá **"Reanudar Partida"** si existe una partida guardada.

---

## Arquitectura

La aplicación sigue una arquitectura basada en **componentes standalone** de Angular con un servicio central para la lógica del juego:

```
┌─────────────────────────────────────────┐
│              BingoService               │
│  (Estado centralizado con Signals)      │
│                                         │
│  • Generación de cartones              │
│  • Extracción de bolitas               │
│  • Marcado de números                  │
│  • Detección de victoria               │
│  • Persistencia en localStorage        │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────┐ ┌──────┐ ┌────────┐     │
│  │  Setup   │ │ Host │ │ Player │     │
│  │Component │ │Comp. │ │ Comp.  │     │
│  └──────────┘ └──────┘ └────────┘     │
│       /         /host    /player       │
└─────────────────────────────────────────┘
```

### Gestión de Estado

Se utiliza **Angular Signals** (`signal`, `computed`) para el manejo reactivo del estado:

- `players` — Lista de jugadores con sus cartones y marcaciones.
- `drawnNumbers` — Números ya extraídos.
- `currentBall` — Última bolita extraída.
- `winnerId` — ID del jugador ganador (si hay).
- `phase` — Fase actual del juego (`setup`, `host`, `player`).
- `isDrawing` — Estado de animación de extracción.

---

## Estructura de Archivos

```
bingo-app/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── setup/
│   │   │   │   ├── setup.component.ts       # Lógica del Setup
│   │   │   │   └── setup.component.html     # Template del Setup
│   │   │   ├── host/
│   │   │   │   ├── host.component.ts        # Lógica del Host
│   │   │   │   └── host.component.html      # Template del Host
│   │   │   └── player/
│   │   │       ├── player.component.ts      # Lógica del Jugador
│   │   │       └── player.component.html    # Template del Jugador
│   │   ├── services/
│   │   │   └── bingo.service.ts             # Servicio central del juego
│   │   ├── app.ts                           # Componente raíz
│   │   ├── app.html                         # Template raíz (router-outlet)
│   │   ├── app.config.ts                    # Configuración de providers
│   │   └── app.routes.ts                    # Definición de rutas
│   ├── styles.css                           # Estilos globales + Tailwind + animaciones
│   └── index.html                           # HTML principal
├── angular.json                             # Configuración Angular CLI
├── package.json                             # Dependencias y scripts
├── .postcssrc.json                          # Configuración PostCSS para Tailwind v4
└── tsconfig.json                            # Configuración TypeScript
```

---

## Rutas de la Aplicación

| Ruta | Componente | Descripción |
|------|-----------|-------------|
| `/` | `SetupComponent` | Selección de número de jugadores e inicio de partida |
| `/host` | `HostComponent` | Dashboard del anfitrión con extracción y tablero |
| `/player?player=ID` | `PlayerComponent` | Cartón individual del jugador |
| `/**` | Redirect → `/` | Cualquier ruta no válida redirige al inicio |

---

## Funcionalidades

### 🎯 Setup
- Selector de cantidad de jugadores (2-20) con botones +/-.
- Detección automática de partida previa guardada.
- Opción de reanudar o iniciar nueva partida.

### 🖥️ Host (Anfitrión)
- **Tema oscuro** profesional estilo dashboard.
- **Bolita 3D** animada con gradiente al extraer un número.
- **Tablero de 90 números** con resaltado de los ya extraídos.
- **Panel de estadísticas**: extraídas, restantes, jugadores.
- **Historial** de las últimas 5 bolitas.
- **Códigos QR** generados dinámicamente para cada jugador.
- **Botón de reset** con modal de confirmación.
- Animación de mezcla ("mixing") antes de revelar cada bolita.

### 📱 Jugador
- **Tema claro** optimizado para móvil y táctil.
- **Cartón de 15 números** únicos (1-90) en cuadrícula 5×3.
- **Marcado con un toque** — el número se resalta en indigo.
- **Modal de confirmación** personalizado para desmarcar (evita errores accidentales).
- **Barra de progreso** que muestra números marcados vs. total.
- **Indicador de última bolita** extraída por el host.
- **Animación de victoria** con confeti al completar el cartón.
- **Auto-sincronización** con el estado del host vía `localStorage`.

### 💾 Persistencia
- Estado del juego guardado en `localStorage`.
- El host puede refrescar sin perder la partida.
- Cada jugador guarda su progreso individualmente.
- Reanudación automática al volver a abrir la app.

---

## Stack Tecnológico

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| [Angular](https://angular.dev) | 21.x | Framework principal |
| [Tailwind CSS](https://tailwindcss.com) | 4.x | Estilos y diseño responsive |
| [PrimeNG](https://primeng.org) | 19.x | Librería de componentes UI |
| [PrimeIcons](https://primeng.org/icons) | 7.x | Iconografía |
| [QRCode](https://www.npmjs.com/package/qrcode) | 1.x | Generación de códigos QR |
| [TypeScript](https://www.typescriptlang.org) | 5.x | Lenguaje de programación |
| [PostCSS](https://postcss.org) | 8.x | Procesamiento CSS |

---

## Compilar para Producción

```bash
npx ng build
```

Los archivos compilados se generarán en la carpeta `dist/`. Para servir la build de producción localmente:

```bash
npx serve dist/bingo-app/browser
```

---

## Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm start` | Inicia el servidor de desarrollo en `localhost:4200` |
| `npm run build` | Compila la aplicación para producción |
| `npm test` | Ejecuta los tests unitarios con Vitest |

---

## Notas Técnicas

- **Standalone Components**: Todos los componentes son standalone para mejor modularidad.
- **Angular Signals**: Se usa el sistema reactivo de Signals en lugar de RxJS para el estado interno.
- **inject()**: Se utiliza `inject()` en el `HostComponent` para resolver problemas de orden de inicialización con propiedades `readonly`.
- **CommonJS Warning**: La librería `qrcode` usa formato CommonJS. Se añadió a `allowedCommonJsDependencies` en `angular.json` para suprimir advertencias.
- **Google Fonts**: Se utiliza la fuente **Inter** cargada desde Google Fonts.
- **Animaciones CSS**: Definidas en `styles.css` — incluyen bounce, pulse, slide-up, fade-in, spin y confetti.

---

## Licencia

Proyecto privado — Uso interno.
