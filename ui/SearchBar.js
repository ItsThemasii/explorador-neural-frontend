// SearchBar.js — input flotante que dispara /api/analyze
export class SearchBar extends EventTarget {
  constructor(formEl, inputEl, buttonEl, statusEl, apiBase, chronoButtonEl = null) {
    super();
    this.form = formEl;
    this.input = inputEl;
    this.button = buttonEl;
    this.status = statusEl;
    this.apiBase = apiBase;
    this.chronoBtn = chronoButtonEl;
    this.isLoading = false;

    this.form.addEventListener('submit', e => {
      e.preventDefault();
      const tema = this.input.value.trim();
      if (tema && !this.isLoading) this.analyze(tema);
    });

    if (this.chronoBtn) {
      this.chronoBtn.addEventListener('click', () => {
        if (!this.chronoBtn.disabled) {
          this.dispatchEvent(new CustomEvent('cronologico'));
        }
      });
    }
  }

  enableChrono(enabled) {
    if (this.chronoBtn) this.chronoBtn.disabled = !enabled;
  }

  setStatus(text, type = '') {
    this.status.className = 'search-status' + (type ? ' ' + type : '');
    this.status.innerHTML = type === 'loading' ? `<span class="spinner"></span>${text}` : text;
  }

  async analyze(tema) {
    this.isLoading = true;
    this.button.disabled = true;
    this.setStatus(`Analizando "${tema}"...`, 'loading');
    this.dispatchEvent(new CustomEvent('analyzing', { detail: { tema } }));

    try {
      const res = await fetch(`${this.apiBase}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tema }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detalles || err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      this.setStatus(`✓ Red generada · ${data.nodos?.length || 0} nodos`, 'success');
      setTimeout(() => this.setStatus(''), 3500);
      this.dispatchEvent(new CustomEvent('analyzed', { detail: data }));
    } catch (err) {
      console.error('analyze error', err);
      this.setStatus(`Error: ${err.message}`, 'error');
    } finally {
      this.isLoading = false;
      this.button.disabled = false;
    }
  }
}
