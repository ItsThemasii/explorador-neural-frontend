# Explorador Neural · Frontend

Visualización 3D inmersiva de temas analizados por IA. Cada concepto se representa como una neurona en una red interactiva con conexiones curvas, señales viajeras y un núcleo central pulsante.

![Three.js](https://img.shields.io/badge/three.js-r160-000?logo=three.js)
![Vanilla JS](https://img.shields.io/badge/JavaScript-ES2022-f7df1e?logo=javascript)
![No build](https://img.shields.io/badge/build-none-blue)

## Características

- **Red neuronal 3D** con nodos multi-capa (núcleo emisivo + membrana translúcida + halo difuso)
- **Conexiones curvas** entre el core y cada nodo + entre nodos vecinos (Bezier orgánicas)
- **Señales viajeras** con cabeza brillante y estela que recorren todas las conexiones
- **4 layouts intercambiables** (click derecho sobre la escena): Esfera · Plano 2D · Tetraedro · Aleatorio
- **Escena espacial** completa: planeta Tierra, Sol con plasma shader, nebulosa de Orión, cometas, postFX bloom
- **Búsqueda inteligente**: cualquier tema es analizado por el backend (Groq AI) y desplegado como red 3D
- **Modo cronológico**: recorre los nodos en orden temporal con un click
- **Panel lateral** con descripción + extracto de Wikipedia + imagen del concepto

## Stack

- **Three.js** r160 (importmap desde unpkg CDN — sin bundler)
- **Vanilla JS** ES2022 con módulos nativos
- **PostFX**: UnrealBloomPass + EffectComposer
- **OrbitControls** para navegación de cámara

## Cómo correr

Requiere el [backend](https://github.com/ItsThemasii/explorador-neural-backend) corriendo en el puerto **3001**.

```bash
# Desde la carpeta del frontend, cualquier server estático:
python -m http.server 3000
# o
npx http-server -p 3000
```

Abre http://localhost:3000 en el navegador (WebGL requerido).

## Controles

| Acción | Resultado |
|---|---|
| Click + arrastrar | Rotar cámara |
| Scroll | Zoom |
| Hover sobre nodo | Tooltip con título |
| Click sobre nodo | Abre panel con info detallada + Wikipedia |
| **Click derecho** | Menú: cambiar forma de la red (Esfera / Plano / Tetraedro / Aleatorio) |
| Botón "Cronológico" | Recorre los nodos en orden temporal |

## Estructura

```
frontend/
├── index.html              ← Entry point
├── styles.css              ← Estilos glass-morphism
├── app.js                  ← Orquestador principal
├── scene/                  ← Módulos de la escena 3D
│   ├── SceneManager.js     ← Renderer + cámara + loop
│   ├── NeuralNetwork.js    ← Nodos + conexiones + layouts
│   ├── Pulses.js           ← Señales viajeras con estela
│   ├── Background.js       ← Estrellas + nebulosas de fondo
│   ├── OrionNebula.js      ← Nebulosa de Orión decorativa
│   ├── Sun.js              ← Sol con shader de plasma
│   ├── Planet.js           ← Tierra con shader día/noche
│   ├── Comets.js           ← Cometas con estela
│   ├── PostFX.js           ← Bloom + composer
│   ├── Controls.js         ← OrbitControls envuelto
│   └── Interaction.js      ← Raycasting hover/click sobre nodos
└── ui/
    ├── SearchBar.js        ← Input + análisis + botón cronológico
    ├── Tooltip.js          ← Tooltip flotante
    ├── SidePanel.js        ← Panel lateral con info de nodo
    └── ContextMenu.js      ← Menú de click derecho (layouts)
```

## Layouts de la red neuronal

| Layout | Distribución |
|---|---|
| **Esfera** | Fibonacci sphere — nodos uniformes en la superficie de una esfera |
| **Plano 2D** | Espiral de Vogel sobre el plano XY (z=0) |
| **Tetraedro** | Vértices + caras de un tetraedro regular |
| **Aleatorio** | Posiciones dispersas dentro de un cubo de ±28 con repulsión mínima |

Al cambiar de layout, los nodos se reposicionan y todas las conexiones (core→nodo + inter-nodos por vecinos más cercanos) se reconstruyen automáticamente.

## Backend esperado

El frontend hace fetch a `http://localhost:3001/api`:

- `POST /api/analyze` → devuelve `{ tema, nodos[], colores }` analizado por Groq AI
- `GET /api/wikipedia?titulo=…` → devuelve extracto + imagen del concepto

Ver el [repo del backend](https://github.com/ItsThemasii/explorador-neural-backend) (privado).

## Licencia

MIT
