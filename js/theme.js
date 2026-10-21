// ═══════════════════════════════════════════════════
//  Modo día / noche — compartido por toda la app.
//  El atributo data-theme ya se setea antes de esto (ver snippet
//  inline en el <head> de cada página) para que no haya flash del
//  tema incorrecto al cargar.
// ═══════════════════════════════════════════════════
const Theme = {
  KEY: 'kinnos_theme',

  init() {
    this._pintarBotones(this.actual());
  },

  actual() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  },

  toggle() {
    const nuevo = this.actual() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nuevo);
    try { localStorage.setItem(this.KEY, nuevo); } catch {}
    this._pintarBotones(nuevo);
  },

  _pintarBotones(theme) {
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.textContent = theme === 'dark' ? '🌙' : '☀️';
      btn.title = theme === 'dark' ? 'Cambiar a modo día' : 'Cambiar a modo noche';
    });
  },
};

Theme.init();
