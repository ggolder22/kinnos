const AlumnoNovedades = {
  async init() {
    const el = document.getElementById('novedades-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('announcements')
      .select('*')
      .eq('subject_id', AlumnoState.materia.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar novedades', 'error'); return; }
    this._render(data);
  },

  _render(data) {
    const el = document.getElementById('novedades-content');

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Novedades</h3></div>
        <div class="empty-state"><div class="icon">📢</div><p>Sin novedades por el momento.</p></div>`;
      return;
    }

    const cards = data.map(n => `
      <div class="novedad-card ${n.is_pinned ? 'pinned' : ''}">
        <div class="nov-title">${n.is_pinned ? '📌 ' : ''}${n.title}</div>
        ${n.body ? `<div class="nov-body">${n.body}</div>` : ''}
        <div class="nov-meta">${Utils.formatDate(n.created_at)}</div>
      </div>`).join('');

    el.innerHTML = `<div class="page-header"><h3>Novedades</h3></div>${cards}`;
  },
};
