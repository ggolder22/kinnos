const AdminPreceptors = {
  _todos: [],

  async init() {
    const el = document.getElementById('preceptores-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('preceptors')
      .select('*, institutions(name)')
      .order('full_name');

    if (error) { Utils.toast('Error al cargar preceptores', 'error'); return; }
    this._todos = data || [];
    this._render(this._todos);
  },

  _render(data) {
    const el = document.getElementById('preceptores-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="AdminPreceptors.openModal()">+ Nuevo preceptor</button>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Preceptores</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">🗂️</div><p>No hay preceptores cargados todavía.</p></div>`;
      return;
    }

    const rows = data.map(p => `
      <tr>
        <td class="text-main">${p.full_name}</td>
        <td>${p.dni}</td>
        <td>${p.email || '—'}</td>
        <td>${p.phone || '—'}</td>
        <td>${p.institutions?.name || '<span style="color:var(--danger);font-size:.8rem">Sin institución</span>'}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="AdminPreceptors.openModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="AdminPreceptors.delete('${p.id}','${p.full_name.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Preceptores <span style="font-size:.85rem;font-weight:400;color:var(--text-3)">(${data.length})</span></h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>DNI</th><th>Email</th><th>Teléfono</th><th>Institución</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  async openModal(item = null) {
    document.getElementById('preceptor-modal-title').textContent = item ? 'Editar preceptor' : 'Nuevo preceptor';
    document.getElementById('preceptor-modal-id').value    = item?.id        || '';
    document.getElementById('preceptor-modal-name').value  = item?.full_name || '';
    document.getElementById('preceptor-modal-dni').value   = item?.dni       || '';
    document.getElementById('preceptor-modal-email').value = item?.email     || '';
    document.getElementById('preceptor-modal-phone').value = item?.phone     || '';

    const { data: insts } = await sb.from('institutions').select('id, name').order('name');
    const sel = document.getElementById('preceptor-modal-inst');
    sel.innerHTML = '<option value="">Sin institución asignada</option>' +
      (insts || []).map(i => `<option value="${i.id}"${item?.institution_id === i.id ? ' selected' : ''}>${i.name}</option>`).join('');

    document.getElementById('preceptor-modal').classList.remove('hidden');
    document.getElementById('preceptor-modal-name').focus();
  },

  closeModal() {
    document.getElementById('preceptor-modal').classList.add('hidden');
  },

  async save() {
    const btn   = document.getElementById('preceptor-modal-save');
    const id    = document.getElementById('preceptor-modal-id').value;
    const name  = document.getElementById('preceptor-modal-name').value.trim();
    const dni   = document.getElementById('preceptor-modal-dni').value.trim();
    const email = document.getElementById('preceptor-modal-email').value.trim();
    const phone = document.getElementById('preceptor-modal-phone').value.trim();
    const instId = document.getElementById('preceptor-modal-inst').value;

    if (!name || !dni) { Utils.toast('Nombre y DNI son obligatorios', 'error'); return; }

    Utils.btnLoading(btn, true);
    const payload = { full_name: name, dni, email: email || null, phone: phone || null, institution_id: instId || null };
    const { error } = id
      ? await sb.from('preceptors').update(payload).eq('id', id)
      : await sb.from('preceptors').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) {
      Utils.toast(error.message.includes('unique') ? 'Ya existe un preceptor con ese DNI.' : error.message, 'error');
      return;
    }
    Utils.toast(id ? 'Preceptor actualizado' : 'Preceptor creado');
    this.closeModal();
    this.init();
  },

  async delete(id, name) {
    if (!await Utils.confirmar(`¿Eliminar al preceptor "${name}"?`)) return;
    const { error } = await sb.from('preceptors').delete().eq('id', id);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Preceptor eliminado');
    this.init();
  },
};
