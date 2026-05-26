// Tooltip.js — div que sigue al cursor mostrando el título_corto del nodo
export class Tooltip {
  constructor(el) {
    this.el = el;
    this.visible = false;
  }

  show(node, event) {
    const data = node.userData;
    this.el.innerHTML =
      `<span class="tooltip-category">${(data.categoria || '').toUpperCase()}</span>` +
      `${data.titulo_corto || data.id || 'Nodo'}`;
    this.el.classList.add('visible');
    this.el.setAttribute('aria-hidden', 'false');
    this.visible = true;
    if (event) this.move(event);
  }

  move(event) {
    if (!this.visible || !event) return;
    const padding = 14;
    const rect = this.el.getBoundingClientRect();
    let x = event.clientX + padding;
    let y = event.clientY + padding;
    // Evitar salirse de la pantalla
    if (x + rect.width > window.innerWidth - 8) x = event.clientX - rect.width - padding;
    if (y + rect.height > window.innerHeight - 8) y = event.clientY - rect.height - padding;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  hide() {
    this.el.classList.remove('visible');
    this.el.setAttribute('aria-hidden', 'true');
    this.visible = false;
  }
}
