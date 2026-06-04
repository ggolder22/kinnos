const AlumnoUnidades = {
  async init() {
    const el = document.getElementById('unidades-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('units')
      .select('*')
      .eq('subject_id', AlumnoState.materia.id)
      .order('unit_num');

    if (error) { Utils.toast('Error al cargar unidades', 'error'); return; }
    this._render(data);
  },

  _render(data) {
    const el = document.getElementById('unidades-content');

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Unidades</h3></div>
        <div class="empty-state"><div class="icon">📚</div><p>No hay unidades publicadas todavía.</p></div>`;
      return;
    }

    const cards = data.map(u => {
      const topics = Array.isArray(u.topics) && u.topics.length
        ? `<div class="topics-list">${u.topics.map(t => `<span class="topic-chip">${t}</span>`).join('')}</div>`
        : '';
      const content = u.content
        ? `<div class="unidad-content-text">${this._escapeHtml(u.content)}</div>` : '';
      const pdf = u.pdf_url
        ? `<button class="pdf-link" onclick="AlumnoUnidades.openPdf(${JSON.stringify(u.pdf_url).replace(/"/g,'&quot;')},${JSON.stringify(u.title).replace(/"/g,'&quot;')})">📄 Ver PDF</button>` : '';
      const ejercBtn = `<button class="btn btn-ghost btn-sm ej-open-btn" onclick="event.stopPropagation();AlumnoEjercicios.abrir('${u.id}',${JSON.stringify(u.title).replace(/"/g,'&quot;')})">Ejercicios</button>`;
      const meta = [u.tag, u.year ? `Año ${u.year}` : null].filter(Boolean).join(' · ');

      return `
        <div class="unidad-card" id="uni-card-${u.id}">
          <div class="unidad-header" onclick="AlumnoUnidades.toggle('${u.id}')">
            <div class="unidad-num">${u.unit_num}</div>
            <div class="unidad-info">
              <div class="unidad-titulo">${u.title}</div>
              ${meta ? `<div class="unidad-meta">${meta}</div>` : ''}
            </div>
            <span class="unidad-chevron">›</span>
          ${ejercBtn}
          </div>
          <div class="unidad-body">
            ${topics}
            ${content}
            ${pdf}
            ${!topics && !content && !pdf ? '<p style="color:var(--text-3);font-size:.85rem">Sin contenido adicional.</p>' : ''}
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `<div class="page-header"><h3>Unidades</h3></div>${cards}`;
  },

  toggle(id) {
    document.getElementById(`uni-card-${id}`).classList.toggle('open');
  },

  openPdf(url, titulo) {
    document.getElementById('pdf-modal-titulo').textContent = titulo;
    document.getElementById('pdf-modal-frame').src = url;
    document.getElementById('pdf-modal-download').href = url;
    document.getElementById('pdf-modal').classList.remove('hidden');
  },

  closePdf() {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.getElementById('pdf-modal-frame').src = '';
  },

  _escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
};
