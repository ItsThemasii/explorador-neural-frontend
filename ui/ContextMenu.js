// ContextMenu.js — menú contextual (click derecho) para cambiar la forma
// de distribución de los nodos de la red neuronal.
const LAYOUTS = [
  { id: 'sphere',      label: 'Esfera',     icon: '◯' },
  { id: 'plane',       label: 'Plano 2D',   icon: '▭' },
  { id: 'tetrahedron', label: 'Tetraedro',  icon: '▲' },
  { id: 'random',      label: 'Aleatorio',  icon: '✦' },
];

function injectStyles() {
  if (document.getElementById('ctx-menu-styles')) return;
  const style = document.createElement('style');
  style.id = 'ctx-menu-styles';
  style.textContent = `
    .ctx-menu {
      position: fixed;
      display: none;
      z-index: 1000;
      min-width: 180px;
      padding: 6px 0;
      background: rgba(15, 18, 32, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(99,102,241,0.08);
      color: #e7e8ee;
      font-family: inherit;
      font-size: 13px;
      user-select: none;
      animation: ctx-pop 0.12s ease-out;
    }
    @keyframes ctx-pop {
      from { opacity: 0; transform: scale(0.96) translateY(-2px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    .ctx-title {
      padding: 6px 14px 8px;
      font-size: 10px;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.42);
    }
    .ctx-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 14px;
      cursor: pointer;
      transition: background 0.12s ease, color 0.12s ease;
      line-height: 1;
    }
    .ctx-item:hover { background: rgba(99, 102, 241, 0.22); color: #fff; }
    .ctx-item.active { background: rgba(99, 102, 241, 0.18); color: #fff; }
    .ctx-item .ctx-ico {
      width: 16px;
      text-align: center;
      font-size: 14px;
      opacity: 0.85;
      color: var(--primary, #6366f1);
    }
    .ctx-item.active .ctx-ico { opacity: 1; }
  `;
  document.head.appendChild(style);
}

export class ContextMenu extends EventTarget {
  constructor(target) {
    super();
    injectStyles();

    this.activeLayout = 'sphere';

    this.el = document.createElement('div');
    this.el.className = 'ctx-menu';
    this.el.innerHTML = `
      <div class="ctx-title">Forma de la red</div>
      ${LAYOUTS.map(l => `
        <div class="ctx-item" data-layout="${l.id}">
          <span class="ctx-ico">${l.icon}</span>
          <span>${l.label}</span>
        </div>
      `).join('')}
    `;
    document.body.appendChild(this.el);

    // Eventos del menú
    this.el.querySelectorAll('.ctx-item').forEach(item => {
      item.addEventListener('click', () => {
        const layout = item.dataset.layout;
        this.setActive(layout);
        this.dispatchEvent(new CustomEvent('select', { detail: { layout } }));
        this.close();
      });
    });

    // Abrir con click derecho sobre el target
    target.addEventListener('contextmenu', e => {
      e.preventDefault();
      this.open(e.clientX, e.clientY);
    });

    // Cerrar al hacer click fuera o pulsar Escape
    document.addEventListener('mousedown', e => {
      if (!this.el.contains(e.target)) this.close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.close();
    });
  }

  setActive(layout) {
    this.activeLayout = layout;
    this.el.querySelectorAll('.ctx-item').forEach(item => {
      item.classList.toggle('active', item.dataset.layout === layout);
    });
  }

  open(x, y) {
    // Mostrar primero (en off-screen) para medir el tamaño
    this.el.style.display = 'block';
    const rect = this.el.getBoundingClientRect();
    const maxX = window.innerWidth  - rect.width  - 8;
    const maxY = window.innerHeight - rect.height - 8;
    this.el.style.left = Math.max(8, Math.min(x, maxX)) + 'px';
    this.el.style.top  = Math.max(8, Math.min(y, maxY)) + 'px';
    this.setActive(this.activeLayout);
  }

  close() {
    this.el.style.display = 'none';
  }
}
