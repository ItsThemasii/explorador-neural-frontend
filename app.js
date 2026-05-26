// app.js — orquestador principal
// Conecta SceneManager + módulos de escena + UI overlays

// Cache-bust propagado desde index.html (?v=timestamp) — fuerza recarga
// fresca de todos los sub-módulos en desarrollo
const V = new URL(import.meta.url).searchParams.get('v') || '';
const B = V ? `?v=${V}` : '';

const { SceneManager } = await import(`./scene/SceneManager.js${B}`);
const { Background }   = await import(`./scene/Background.js${B}`);
const { OrionNebula }  = await import(`./scene/OrionNebula.js${B}`);
const { Comets }       = await import(`./scene/Comets.js${B}`);
const { Sun }          = await import(`./scene/Sun.js${B}`);
const { Planet }       = await import(`./scene/Planet.js${B}`);
const { NeuralNetwork }= await import(`./scene/NeuralNetwork.js${B}`);
const { Pulses }       = await import(`./scene/Pulses.js${B}`);
const { Controls }     = await import(`./scene/Controls.js${B}`);
const { Interaction }  = await import(`./scene/Interaction.js${B}`);
const { PostFX }       = await import(`./scene/PostFX.js${B}`);

const { SearchBar }    = await import(`./ui/SearchBar.js${B}`);
const { Tooltip }      = await import(`./ui/Tooltip.js${B}`);
const { SidePanel }    = await import(`./ui/SidePanel.js${B}`);
const { ContextMenu }  = await import(`./ui/ContextMenu.js${B}`);

const API_BASE = 'http://localhost:3001/api';

// ---- Escena 3D ----
const container = document.getElementById('scene-container');
const sceneMgr = new SceneManager(container);
const background = new Background(sceneMgr.scene);
const orion = new OrionNebula(sceneMgr.scene);
const comets = new Comets(sceneMgr.scene);
const planet = new Planet(sceneMgr.scene);
// El Sun apunta hacia la Tierra para crear un terminador día/noche visible
const sun = new Sun(sceneMgr.scene, { target: planet.group.position.clone() });
const network = new NeuralNetwork(sceneMgr.scene);
const pulses = new Pulses(sceneMgr.scene, network);
const controls = new Controls(sceneMgr.camera, sceneMgr.renderer.domElement);
const interaction = new Interaction(sceneMgr.camera, sceneMgr.renderer.domElement, network, controls);
const postfx = new PostFX(sceneMgr.renderer, sceneMgr.scene, sceneMgr.camera);
sceneMgr.setComposer(postfx.composer);

// Hookear el resize del composer al resize global
const origResize = sceneMgr.onResize.bind(sceneMgr);
sceneMgr.onResize = function () {
  origResize();
  postfx.setSize(this.width, this.height);
};

// Updaters cada frame
sceneMgr.addUpdater((dt, t) => background.update(dt, t));
sceneMgr.addUpdater((dt, t) => orion.update(dt, t));
sceneMgr.addUpdater((dt, t) => sun.update(dt, t));
sceneMgr.addUpdater((dt, t) => comets.update(dt, t));
sceneMgr.addUpdater((dt, t) => planet.update(dt, t));
sceneMgr.addUpdater((dt, t) => network.update(dt, t));
sceneMgr.addUpdater((dt, t) => pulses.update(dt, t));
sceneMgr.addUpdater((dt, t) => interaction.update(dt, t));
sceneMgr.addUpdater(() => controls.update());

sceneMgr.start();

// ---- UI ----
const searchBar = new SearchBar(
  document.getElementById('search-form'),
  document.getElementById('search-input'),
  document.getElementById('search-button'),
  document.getElementById('search-status'),
  API_BASE,
  document.getElementById('chrono-button')
);

const tooltip = new Tooltip(document.getElementById('tooltip'));
const sidePanel = new SidePanel(document.getElementById('side-panel'), API_BASE);

// Menú contextual (click derecho sobre el canvas) → cambia la forma de la red
const contextMenu = new ContextMenu(sceneMgr.renderer.domElement);
contextMenu.addEventListener('select', e => {
  const layout = e.detail.layout;
  network.setLayout(layout);
  pulses.rebuild();
});
// Bloquear el contextmenu del navegador en toda la página
window.addEventListener('contextmenu', e => e.preventDefault());

// ---- Estado cronológico ----
// chronoOrder: array de nodos ordenados por orden_cronologico (de inicio a fin)
let chronoOrder = [];

function getChronoIndexOf(nodeId) {
  return chronoOrder.findIndex(n => n.id === nodeId);
}

function updateChronoProgressForNode(nodeData) {
  if (!nodeData || chronoOrder.length === 0) {
    sidePanel.setChronoProgress(0, 0, false, false);
    return;
  }
  const idx = getChronoIndexOf(nodeData.id);
  if (idx === -1) {
    sidePanel.setChronoProgress(0, chronoOrder.length, false, false);
    return;
  }
  const hasPrev = idx > 0;
  const hasNext = idx < chronoOrder.length - 1;
  sidePanel.setChronoProgress(idx + 1, chronoOrder.length, hasPrev, hasNext);
}

// ---- Cableado de eventos ----

// Cuando llega análisis de Groq, rellenar la red y rebuild de pulsos + ajustar luces
searchBar.addEventListener('analyzed', e => {
  const data = e.detail;
  network.setData(data);
  pulses.rebuild();
  if (data.colores) {
    sceneMgr.setLightColors(data.colores.primary, data.colores.accent);
    background.setColors(data.colores.primary, data.colores.accent);
    orion.setTint(data.colores.primary);
    planet.setTint(data.colores.primary);
    document.documentElement.style.setProperty('--primary', data.colores.primary);
    document.documentElement.style.setProperty('--accent', data.colores.accent);
  }
  // Construir orden cronológico (inicio → fin)
  chronoOrder = [...(data.nodos || [])].sort(
    (a, b) => (a.orden_cronologico ?? 999) - (b.orden_cronologico ?? 999)
  );
  searchBar.enableChrono(chronoOrder.length > 0);
  // Pasar el tema al panel — sirve como contexto para mejorar búsqueda de imágenes
  sidePanel.setContext(data.tema || '');
  interaction.resetCamera();
  sidePanel.close();
  tooltip.hide();
});

// Click en botón "Cronológico" → enviar al primer nodo (INICIO del recorrido)
searchBar.addEventListener('cronologico', () => {
  if (chronoOrder.length === 0) return;
  const firstId = chronoOrder[0].id;
  interaction.selectNodeById(firstId);
});

// Botón "Siguiente" en el panel → próximo nodo en orden cronológico
sidePanel.addEventListener('next', e => {
  const current = e.detail.current;
  if (!current || chronoOrder.length === 0) return;
  const idx = getChronoIndexOf(current.id);
  if (idx === -1 || idx >= chronoOrder.length - 1) return;
  interaction.selectNodeById(chronoOrder[idx + 1].id);
});

// Botón "Anterior" → nodo previo
sidePanel.addEventListener('prev', e => {
  const current = e.detail.current;
  if (!current || chronoOrder.length === 0) return;
  const idx = getChronoIndexOf(current.id);
  if (idx <= 0) return;
  interaction.selectNodeById(chronoOrder[idx - 1].id);
});

// Hover de nodos -> tooltip
interaction.addEventListener('hover', e => {
  const node = e.detail.node;
  if (node) tooltip.show(node, e.detail.event);
  else tooltip.hide();
});

// Mover tooltip con el cursor cuando está visible
window.addEventListener('pointermove', e => {
  if (tooltip.visible) tooltip.move(e);
});

// Click (o selección programática) en nodo -> abrir panel lateral con su info
interaction.addEventListener('select', e => {
  const node = e.detail.node;
  if (node && node.userData) {
    sidePanel.open(node.userData);
    updateChronoProgressForNode(node.userData);
    tooltip.hide();
  }
});

// Cerrar panel -> resetear cámara
sidePanel.addEventListener('closed', () => {
  interaction.resetCamera();
});

// ---- Carga inicial ----
// Mostrar mensaje de bienvenida y dejar la escena vacía (solo core + fondo) esperando input
searchBar.setStatus('Escribe un tema y presiona Enter');
setTimeout(() => {
  // Análisis automático opcional para demo — comentado por defecto
  // searchBar.analyze('Universo');
}, 600);

console.log('%c⚡ Explorador Neural · Inmersivo', 'color:#6366f1;font-size:14px;font-weight:bold');
console.log('Backend:', API_BASE);

// Debug refs
window.__neural = { sceneMgr, network, pulses, searchBar, interaction };
