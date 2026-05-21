// Gestión de Profesores + asignación a materias
const AdminProfessors = {

  async init() {
    await this._loadProfessors();
  },

  async _loadProfessors() {
    const el = document.getElementById('prof-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb.from('professors').select('*').order('full_name');
    if (error) { Utils.toast('Error al cargar profesores', 'error'); return; }
    this._render(data);
  },

  _render(data) {
    const el = document.getElementById('prof-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="AdminProfessors.openModal()">+ Nuevo profesor</button>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Profesores</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">👨‍🏫</div><p>No hay profesores registrados.</p></div>`;
      return;
    }

    const rows = data.map(p => `
      <tr>
        <td class="text-main">${p.full_name}</td>
        <td>${p.dni}</td>
        <td>${p.email || '—'}</td>
        <td>${p.phone || '—'}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="AdminProfessors.openAsignModal('${p.id}','${p.full_name.replace(/'/g, "\\'")}')">Materias</button>
            <button class="btn btn-ghost btn-sm" onclick="AdminProfessors.openModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="AdminProfessors.delete('${p.id}','${p.full_name.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Profesores</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>DNI</th><th>Email</th><th>Teléfono</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  openModal(item = null) {
    document.getElementById('prof-modal-title').textContent = item ? 'Editar profesor' : 'Nuevo profesor';
    document.getElementById('prof-modal-id').value    = item?.id        || '';
    document.getElementById('prof-modal-name').value  = item?.full_name || '';
    document.getElementById('prof-modal-dni').value   = item?.dni       || '';
    document.getElementById('prof-modal-email').value = item?.email     || '';
    document.getElementById('prof-modal-phone').value = item?.phone     || '';
    document.getElementById('prof-modal').classList.remove('hidden');
    document.getElementById('prof-modal-name').focus();
  },

  closeModal() {
    document.getElementById('prof-modal').classList.add('hidden');
  },

  async save() {
    const btn   = document.getElementById('prof-modal-save');
    const id    = document.getElementById('prof-modal-id').value;
    const name  = document.getElementById('prof-modal-name').value.trim();
    const dni   = document.getElementById('prof-modal-dni').value.trim();
    const email = document.getElementById('prof-modal-email').value.trim();
    const phone = document.getElementById('prof-modal-phone').value.trim();

    if (!name || !dni) { Utils.toast('Nombre y DNI son obligatorios', 'error'); return; }

    Utils.btnLoading(btn, true);
    let error;
    if (id) {
      ({ error } = await sb.from('professors').update({ full_name: name, dni, email, phone }).eq('id', id));
    } else {
      ({ error } = await sb.from('professors').insert({ full_name: name, dni, email, phone }));
    }
    Utils.btnLoading(btn, false);

    if (error) {
      const msg = error.message.includes('unique') ? 'Ya existe un profesor con ese DNI.' : error.message;
      Utils.toast(msg, 'error');
      return;
    }
    Utils.toast(id ? 'Profesor actualizado' : 'Profesor creado');
    this.closeModal();
    this._loadProfessors();
  },

  async delete(id, name) {
    if (!await Utils.confirmar(`¿Eliminar al profesor "${name}"?`)) return;
    const { error } = await sb.from('professors').delete().eq('id', id);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Profesor eliminado');
    this._loadProfessors();
  },

  // ── Asignación de materias ────────────────────────────────────

  _asignProfId: null,

  async openAsignModal(profId, profName) {
    this._asignProfId = profId;
    document.getElementById('asign-modal-title').textContent = `Materias de ${profName}`;
    document.getElementById('asign-modal').classList.remove('hidden');
    await this._loadAsignaciones();
  },

  closeAsignModal() {
    document.getElementById('asign-modal').classList.add('hidden');
    this._asignProfId = null;
  },

  async _loadAsignaciones() {
    const el = document.getElementById('asign-list');
    el.innerHTML = '<div style="color:var(--text-3);font-size:.85rem;padding:8px 0">Cargando…</div>';

    // Materias ya asignadas
    const { data: asignadas } = await sb
      .from('professor_subjects')
      .select('subject_id, is_primary, subjects(name, careers(name))')
      .eq('professor_id', this._asignProfId);

    const asignadasIds = new Set((asignadas || []).map(a => a.subject_id));

    // Todas las materias
    const { data: todas } = await sb
      .from('subjects')
      .select('id, name, career_id, careers(name, institutions(name))')
      .order('name');

    if (!todas?.length) {
      el.innerHTML = '<div style="color:var(--text-3);font-size:.85rem;padding:8px 0">No hay materias cargadas.</div>';
      return;
    }

    const rows = todas.map(s => {
      const asignada = asignadasIds.has(s.id);
      const isPrimary = asignadas?.find(a => a.subject_id === s.id)?.is_primary;
      const label = `${s.careers?.institutions?.name || ''} › ${s.careers?.name || ''} › ${s.name}`;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem">
          <span style="color:${asignada ? 'var(--text-1)' : 'var(--text-3)'}">${label}</span>
          <div style="display:flex;gap:6px;align-items:center">
            ${asignada && isPrimary ? '<span class="badge badge-indigo" style="font-size:.7rem">principal</span>' : ''}
            ${asignada
              ? `<button class="btn btn-danger btn-sm" onclick="AdminProfessors.desasignar('${s.id}')">Quitar</button>`
              : `<button class="btn btn-ghost btn-sm" onclick="AdminProfessors.asignar('${s.id}')">Asignar</button>`
            }
          </div>
        </div>`;
    }).join('');
    el.innerHTML = rows;
  },

  async asignar(subjectId) {
    const { error } = await sb.from('professor_subjects')
      .insert({ professor_id: this._asignProfId, subject_id: subjectId });
    if (error) { Utils.toast('Error al asignar', 'error'); return; }
    Utils.toast('Materia asignada', 'success');
    await this._loadAsignaciones();
  },

  async desasignar(subjectId) {
    const { error } = await sb.from('professor_subjects')
      .delete()
      .eq('professor_id', this._asignProfId)
      .eq('subject_id', subjectId);
    if (error) { Utils.toast('Error al quitar', 'error'); return; }
    Utils.toast('Materia removida', 'info');
    await this._loadAsignaciones();
  },
};
