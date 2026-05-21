const _FRASES_MOTIVADORAS = [
  'El conocimiento es el único bien que se multiplica al compartirse.',
  'Cada clase es un paso más hacia quien querés ser.',
  'No importa lo lento que avances, siempre que no te detengas.',
  'La educación es el pasaporte hacia el futuro.',
  'El esfuerzo de hoy construye el profesional de mañana.',
  'Aprender es la única forma de crecer sin límites.',
  'El estudio de hoy es la libertad de mañana.',
];

const AlumnoNovedades = {

  // Renderiza el banner superior (siempre visible al seleccionar materia)
  async renderBanner() {
    const banner = document.getElementById('novedades-banner');
    banner.classList.remove('hidden');
    banner.innerHTML = '<div style="color:var(--text-3);font-size:.85rem">Cargando…</div>';

    const { data } = await sb
      .from('announcements')
      .select('*')
      .eq('subject_id', AlumnoState.materia.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5);

    if (data?.length) {
      this._renderBannerItems(data);
    } else {
      this._renderBienvenida();
    }
  },

  _renderBannerItems(data) {
    const banner = document.getElementById('novedades-banner');
    const items = data.map(n => `
      <div class="nov-banner-item${n.is_pinned ? ' pinned' : ''}">
        <div class="nov-banner-titulo">${n.title}</div>
        ${n.body ? `<div class="nov-banner-cuerpo">${n.body}</div>` : ''}
        <div class="nov-banner-meta">${Utils.formatDate(n.created_at)}</div>
      </div>`).join('');

    banner.innerHTML = `
      <div class="nov-banner-header">
        <span class="nov-banner-label">Novedades</span>
      </div>
      <div class="nov-banner-list">${items}</div>`;
  },

  _renderBienvenida() {
    const banner  = document.getElementById('novedades-banner');
    const session = Auth.session();
    const m       = AlumnoState.materia;
    const info    = [
      m.careers?.institutions?.name,
      m.careers?.name,
      m.year ? `Año ${m.year}` : null,
    ].filter(Boolean).join(' › ');

    const frase = _FRASES_MOTIVADORAS[Math.floor(Math.random() * _FRASES_MOTIVADORAS.length)];

    banner.innerHTML = `
      <div class="bienvenida-card">
        <div class="bienvenida-nombre">Bienvenido/a, ${session.nombre || 'alumno'}</div>
        <div class="bienvenida-info">${info}</div>
        <div class="bienvenida-frase">"${frase}"</div>
      </div>`;
  },
};
