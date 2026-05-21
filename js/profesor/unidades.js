const ProfesorUnidades = {
  async init() {
    const el = document.getElementById('unidades-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('units')
      .select('*')
      .eq('subject_id', ProfesorState.materia.id)
      .order('unit_num');

    if (error) { Utils.toast('Error al cargar unidades', 'error'); return; }
    this._render(data);
  },

  _render(data) {
    const el = document.getElementById('unidades-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="ProfesorUnidades.openModal()">+ Nueva unidad</button>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Unidades</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">📚</div><p>No hay unidades todavía.</p></div>`;
      return;
    }

    const rows = data.map(u => `
      <tr>
        <td style="width:48px;text-align:center;font-weight:700;color:var(--accent)">${u.unit_num}</td>
        <td class="text-main">${u.title}</td>
        <td>${u.tag ? `<span class="badge badge-indigo">${u.tag}</span>` : '—'}</td>
        <td style="font-size:.8rem;color:var(--text-3)">
          ${Array.isArray(u.topics) ? u.topics.slice(0,3).join(', ') + (u.topics.length > 3 ? '…' : '') : '—'}
        </td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="ProfesorUnidades.openModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="ProfesorUnidades.delete('${u.id}','${u.title.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Unidades</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Título</th><th>Etiqueta</th><th>Temas</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  openModal(item = null) {
    document.getElementById('uni-modal-title').textContent = item ? 'Editar unidad' : 'Nueva unidad';
    document.getElementById('uni-modal-id').value      = item?.id       || '';
    document.getElementById('uni-modal-num').value     = item?.unit_num || '';
    document.getElementById('uni-modal-titulo').value  = item?.title    || '';
    document.getElementById('uni-modal-tag').value     = item?.tag      || '';
    document.getElementById('uni-modal-topics').value  = Array.isArray(item?.topics) ? item.topics.join('\n') : '';
    document.getElementById('uni-modal-content').value = item?.content  || '';
    document.getElementById('uni-modal-pdf').value     = item?.pdf_url  || '';
    document.getElementById('uni-modal').classList.remove('hidden');
    document.getElementById('uni-modal-titulo').focus();
  },

  closeModal() {
    document.getElementById('uni-modal').classList.add('hidden');
  },

  async save() {
    const btn    = document.getElementById('uni-modal-save');
    const id     = document.getElementById('uni-modal-id').value;
    const num    = parseInt(document.getElementById('uni-modal-num').value);
    const title  = document.getElementById('uni-modal-titulo').value.trim();
    const tag    = document.getElementById('uni-modal-tag').value.trim();
    const topics = document.getElementById('uni-modal-topics').value
      .split('\n').map(t => t.trim()).filter(Boolean);
    const content = document.getElementById('uni-modal-content').value.trim();
    const pdf_url = document.getElementById('uni-modal-pdf').value.trim();

    if (!title || !num) { Utils.toast('Número y título son obligatorios', 'error'); return; }

    const payload = {
      unit_num: num, title, tag: tag || null, topics, content: content || null,
      pdf_url: pdf_url || null, subject_id: ProfesorState.materia.id, updated_at: new Date().toISOString(),
    };

    Utils.btnLoading(btn, true);
    const { error } = id
      ? await sb.from('units').update(payload).eq('id', id)
      : await sb.from('units').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Unidad actualizada' : 'Unidad creada');
    this.closeModal();
    this.init();
  },

  async delete(id, title) {
    if (!await Utils.confirmar(`¿Eliminar la unidad "${title}"?`)) return;
    const { error } = await sb.from('units').delete().eq('id', id);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Unidad eliminada');
    this.init();
  },
};
