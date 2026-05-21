const ProfesorNovedades = {
  async init() {
    const el = document.getElementById('novedades-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('announcements')
      .select('*')
      .eq('subject_id', ProfesorState.materia.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar novedades', 'error'); return; }
    this._render(data);
  },

  _render(data) {
    const el = document.getElementById('novedades-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="ProfesorNovedades.openModal()">+ Nueva novedad</button>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Novedades</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">📢</div><p>No hay novedades publicadas.</p></div>`;
      return;
    }

    const rows = data.map(n => `
      <tr class="${n.is_pinned ? 'novedad-pinned' : ''}">
        <td class="text-main">${n.is_pinned ? '📌 ' : ''}${n.title}</td>
        <td style="max-width:320px;font-size:.82rem;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
          ${n.body || '—'}
        </td>
        <td>${Utils.formatDate(n.created_at)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="ProfesorNovedades.togglePin('${n.id}', ${n.is_pinned})" title="${n.is_pinned ? 'Desfijar' : 'Fijar'}">
              ${n.is_pinned ? '📌' : '📍'}
            </button>
            <button class="btn btn-ghost btn-sm" onclick="ProfesorNovedades.openModal(${JSON.stringify(n).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="ProfesorNovedades.delete('${n.id}','${n.title.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Novedades</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Título</th><th>Cuerpo</th><th>Fecha</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  openModal(item = null) {
    document.getElementById('nov-modal-title').textContent = item ? 'Editar novedad' : 'Nueva novedad';
    document.getElementById('nov-modal-id').value     = item?.id        || '';
    document.getElementById('nov-modal-titulo').value = item?.title     || '';
    document.getElementById('nov-modal-body').value   = item?.body      || '';
    document.getElementById('nov-modal-pin').checked  = item?.is_pinned || false;
    document.getElementById('nov-modal').classList.remove('hidden');
    document.getElementById('nov-modal-titulo').focus();
  },

  closeModal() {
    document.getElementById('nov-modal').classList.add('hidden');
  },

  async save() {
    const btn      = document.getElementById('nov-modal-save');
    const id       = document.getElementById('nov-modal-id').value;
    const title    = document.getElementById('nov-modal-titulo').value.trim();
    const body     = document.getElementById('nov-modal-body').value.trim();
    const is_pinned = document.getElementById('nov-modal-pin').checked;

    if (!title) { Utils.toast('El título es obligatorio', 'error'); return; }

    const payload = { title, body: body || null, is_pinned, subject_id: ProfesorState.materia.id };

    Utils.btnLoading(btn, true);
    const { error } = id
      ? await sb.from('announcements').update(payload).eq('id', id)
      : await sb.from('announcements').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Novedad actualizada' : 'Novedad publicada');
    this.closeModal();
    this.init();
  },

  async togglePin(id, current) {
    const { error } = await sb.from('announcements').update({ is_pinned: !current }).eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(current ? 'Novedad desfijada' : 'Novedad fijada');
    this.init();
  },

  async delete(id, title) {
    if (!await Utils.confirmar(`¿Eliminar la novedad "${title}"?`)) return;
    const { error } = await sb.from('announcements').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Novedad eliminada');
    this.init();
  },
};
