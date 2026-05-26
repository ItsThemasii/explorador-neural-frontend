// SidePanel.js — panel lateral con info detallada + fetch Wikipedia + navegación cronológica
export class SidePanel extends EventTarget {
  constructor(panelEl, apiBase) {
    super();
    this.panel = panelEl;
    this.apiBase = apiBase;
    this.imageEl = panelEl.querySelector('#side-image');
    this.categoryEl = panelEl.querySelector('#side-category');
    this.titleEl = panelEl.querySelector('#side-title');
    this.descriptionEl = panelEl.querySelector('#side-description');
    this.wikiExtractEl = panelEl.querySelector('#side-wiki-extract');
    this.wikiLinkEl = panelEl.querySelector('#side-wiki-link');
    this.closeBtn = panelEl.querySelector('#side-close');
    this.prevBtn = panelEl.querySelector('#side-prev');
    this.nextBtn = panelEl.querySelector('#side-next');
    this.progressEl = panelEl.querySelector('#side-progress');
    this._currentFetchToken = 0;
    this._currentNodeData = null;
    this._context = ''; // tema actual, usado para mejorar la búsqueda de imágenes

    this.closeBtn.addEventListener('click', () => this.close());
    document.addEventListener('keydown', e => {
      if (this.panel.classList.contains('open')) {
        if (e.key === 'Escape') this.close();
        if (e.key === 'ArrowRight' && !this.nextBtn.disabled) {
          this.dispatchEvent(new CustomEvent('next', { detail: { current: this._currentNodeData } }));
        }
        if (e.key === 'ArrowLeft' && !this.prevBtn.disabled) {
          this.dispatchEvent(new CustomEvent('prev', { detail: { current: this._currentNodeData } }));
        }
      }
    });

    if (this.prevBtn) this.prevBtn.addEventListener('click', () => {
      if (!this.prevBtn.disabled) {
        this.dispatchEvent(new CustomEvent('prev', { detail: { current: this._currentNodeData } }));
      }
    });
    if (this.nextBtn) this.nextBtn.addEventListener('click', () => {
      if (!this.nextBtn.disabled) {
        this.dispatchEvent(new CustomEvent('next', { detail: { current: this._currentNodeData } }));
      }
    });
  }

  // Setear el contexto (tema actual) para que la búsqueda de imágenes sea más relevante
  setContext(tema) {
    this._context = tema || '';
  }

  // Actualizar el estado de los botones según la posición cronológica
  // pos: índice 1-based, total: cantidad total. hasPrev/hasNext: booleanos
  setChronoProgress(pos, total, hasPrev, hasNext) {
    if (this.progressEl) {
      this.progressEl.textContent = total > 0 ? `${pos} / ${total}` : '— / —';
    }
    if (this.prevBtn) this.prevBtn.disabled = !hasPrev;
    if (this.nextBtn) this.nextBtn.disabled = !hasNext;
  }

  async open(nodeData) {
    const data = nodeData;
    this._currentNodeData = data;
    const initials = (data.titulo_corto || data.id || '?').slice(0, 2).toUpperCase();

    // Render inmediato con info del nodo
    this.categoryEl.textContent = data.categoria || '';
    this.titleEl.textContent = data.titulo_corto || '—';
    this.descriptionEl.textContent = data.descripcion_larga || '';
    this.imageEl.className = 'side-image placeholder';
    this.imageEl.style.backgroundImage = '';
    this.imageEl.textContent = initials;
    this.wikiExtractEl.textContent = 'Cargando información de Wikipedia...';
    this.wikiExtractEl.className = 'side-wiki-extract empty';
    this.wikiLinkEl.style.display = 'none';

    this.panel.classList.add('open');
    this.panel.setAttribute('aria-hidden', 'false');

    // Fetch wiki (cancelable por token si el usuario abre otro nodo)
    const myToken = ++this._currentFetchToken;
    try {
      const keyword = data.keyword_wiki || data.titulo_corto;
      const ctx = this._context ? `?context=${encodeURIComponent(this._context)}` : '';
      const res = await fetch(`${this.apiBase}/wiki/${encodeURIComponent(keyword)}${ctx}`);
      if (myToken !== this._currentFetchToken) return; // se abrió otro nodo
      const wiki = await res.json();

      if (wiki.thumbnail) {
        this.imageEl.className = 'side-image';
        this.imageEl.textContent = '';
        this.imageEl.style.backgroundImage = `url("${wiki.thumbnail}")`;
      }

      if (wiki.extract) {
        this.wikiExtractEl.textContent = wiki.extract;
        this.wikiExtractEl.className = 'side-wiki-extract';
      } else {
        this.wikiExtractEl.textContent = 'No se encontró información en Wikipedia para este término.';
        this.wikiExtractEl.className = 'side-wiki-extract empty';
      }

      if (wiki.url) {
        this.wikiLinkEl.href = wiki.url;
        this.wikiLinkEl.style.display = 'inline-block';
      } else {
        this.wikiLinkEl.style.display = 'none';
      }
    } catch (err) {
      if (myToken !== this._currentFetchToken) return;
      console.error('wiki fetch error', err);
      this.wikiExtractEl.textContent = 'Error consultando Wikipedia.';
      this.wikiExtractEl.className = 'side-wiki-extract empty';
    }
  }

  close() {
    this.panel.classList.remove('open');
    this.panel.setAttribute('aria-hidden', 'true');
    this._currentFetchToken++; // invalida fetch en vuelo
    this.dispatchEvent(new CustomEvent('closed'));
  }
}
