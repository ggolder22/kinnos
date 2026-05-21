const AdminAlumnos = {
  _todos: [],

  async init() {
    const el = document.getElementById('alumnos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('students')
      .select('*, institutions(name)')
      .order('full_name');

    if (error) { Utils.toast('Error al cargar alumnos', 'error'); return; }
    this._todos = data || [];
    this._render(this._todos);
  },

  _render(data) {
    const el = document.getElementById('alumnos-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="AdminAlumnos.openModal()">+ Nuevo alumno</button>`;

    const searchBar = `
      <div style="margin-bottom:16px">
        <input type="text" id="alumno-search" placeholder="Buscar por nombre o DNI…"
          oninput="AdminAlumnos._filtrar(this.value)"
          style="width:100%;max-width:340px;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-1);font-size:.875rem;outline:none">
      </div>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Alumnos</h3>${addBtn}</div>${searchBar}
        <div class="empty-state"><div class="icon">👥</div><p>No se encontraron alumnos.</p></div>`;
      return;
    }

    const rows = data.map(a => `
      <tr>
        <td class="text-main">${a.full_name}</td>
        <td>${a.dni}</td>
        <td>${a.email || '—'}</td>
        <td>${a.phone || '—'}</td>
        <td>${a.institutions?.name || '<span style="color:var(--danger);font-size:.8rem">Sin institución</span>'}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="AdminAlumnos.openModal(${JSON.stringify(a).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="AdminAlumnos.delete('${a.id}','${a.full_name.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Alumnos <span style="font-size:.85rem;font-weight:400;color:var(--text-3)">(${data.length})</span></h3>${addBtn}</div>
      ${searchBar}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>DNI</th><th>Email</th><th>Teléfono</th><th>Institución</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _filtrar(q) {
    const lower = q.toLowerCase();
    const filtrados = this._todos.filter(a =>
      a.full_name.toLowerCase().includes(lower) || a.dni.includes(lower)
    );
    this._render(filtrados);
    // Restaurar el valor del input ya que _render lo recrea
    const inp = document.getElementById('alumno-search');
    if (inp) { inp.value = q; inp.focus(); }
  },

  async openModal(item = null) {
    // Cargar instituciones al abrir
    const { data: insts } = await sb.from('institutions').select('id, name').order('name');
    const sel = document.getElementById('alumno-modal-inst');
    sel.innerHTML = '<option value="">Sin institución asignada</option>' +
      (insts || []).map(i => `<option value="${i.id}"${item?.institution_id === i.id ? ' selected' : ''}>${i.name}</option>`).join('');

    document.getElementById('alumno-modal-title').textContent = item ? 'Editar alumno' : 'Nuevo alumno';
    document.getElementById('alumno-modal-id').value    = item?.id        || '';
    document.getElementById('alumno-modal-name').value  = item?.full_name || '';
    document.getElementById('alumno-modal-dni').value   = item?.dni       || '';
    document.getElementById('alumno-modal-email').value = item?.email     || '';
    document.getElementById('alumno-modal-phone').value = item?.phone     || '';
    document.getElementById('alumno-modal').classList.remove('hidden');
    document.getElementById('alumno-modal-name').focus();
  },

  closeModal() {
    document.getElementById('alumno-modal').classList.add('hidden');
  },

  async save() {
    const btn    = document.getElementById('alumno-modal-save');
    const id     = document.getElementById('alumno-modal-id').value;
    const name   = document.getElementById('alumno-modal-name').value.trim();
    const dni    = document.getElementById('alumno-modal-dni').value.trim();
    const email  = document.getElementById('alumno-modal-email').value.trim();
    const phone  = document.getElementById('alumno-modal-phone').value.trim();
    const instId = document.getElementById('alumno-modal-inst').value;

    if (!name || !dni) { Utils.toast('Nombre y DNI son obligatorios', 'error'); return; }

    Utils.btnLoading(btn, true);
    const payload = { full_name: name, dni, email: email || null, phone: phone || null, institution_id: instId || null };
    let error;
    if (id) {
      ({ error } = await sb.from('students').update(payload).eq('id', id));
    } else {
      ({ error } = await sb.from('students').insert(payload));
    }
    Utils.btnLoading(btn, false);

    if (error) {
      Utils.toast(error.message.includes('unique') ? 'Ya existe un alumno con ese DNI.' : error.message, 'error');
      return;
    }
    Utils.toast(id ? 'Alumno actualizado' : 'Alumno creado');
    this.closeModal();
    this.init();
  },

  async delete(id, name) {
    if (!await Utils.confirmar(`¿Eliminar al alumno "${name}"? Se perderán todas sus inscripciones y resultados de exámenes.`)) return;
    const { error } = await sb.from('students').delete().eq('id', id);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Alumno eliminado');
    this.init();
  },
};
