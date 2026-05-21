// Gestión de Profesores + solicitudes pendientes + asignación a materias
const AdminProfessors = {

  async init() {
    await this._loadProfessors();
  },

  async _loadProfessors() {
    const el = document.getElementById('prof-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const [{ data: pendientes }, { data: activos, error }] = await Promise.all([
      sb.from('professors').select('*, institutions(name)').eq('status', 'pending').order('created_at'),
      sb.from('professors').select('*').eq('status', 'active').order('full_name'),
    ]);

    if (error) { Utils.toast('Error al cargar profesores', 'error'); return; }
    this._render(pendientes || [], activos || []);
  },

  _render(pendientes, activos) {
    const el = document.getElementById('prof-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="AdminProfessors.openModal()">+ Nuevo profesor</button>`;

    // ── Solicitudes pendientes ──
    let pendientesHtml = '';
    if (pendientes.length) {
      const rows = pendientes.map(p => `
        <tr>
          <td class="text-main">${p.full_name}</td>
          <td>${p.dni}</td>
          <td>${p.email || '—'}</td>
          <td>${p.institutions?.name || '—'}</td>
          <td>${Utils.formatDate(p.created_at)}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-primary btn-sm" onclick="AdminProfessors.aprobar('${p.id}','${p.full_name.replace(/'/g, "\\'")}')">Aprobar</button>
              <button class="btn btn-danger btn-sm"  onclick="AdminProfessors.rechazar('${p.id}','${p.full_name.replace(/'/g, "\\'")}')">Rechazar</button>
            </div>
          </td>
        </tr>`).join('');

      pendientesHtml = `
        <div style="margin-bottom:28px">
          <div class="page-header" style="margin-bottom:12px">
            <h3>Solicitudes pendientes <span class="badge badge-indigo" style="font-size:.75rem;vertical-align:middle">${pendientes.length}</span></h3>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nombre</th><th>DNI</th><th>Email</th><th>Institución</th><th>Fecha</th><th>Acciones</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }

    // ── Profesores activos ──
    let activosHtml = '';
    if (!activos.length) {
      activosHtml = `<div class="empty-state"><div class="icon">👨‍🏫</div><p>No hay profesores activos todavía.</p></div>`;
    } else {
      const rows = activos.map(p => `
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

      activosHtml = `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>DNI</th><th>Email</th><th>Teléfono</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    }

    el.innerHTML = `
      ${pendientesHtml}
      <div class="page-header"><h3>Profesores activos</h3>${addBtn}</div>
      ${activosHtml}`;
  },

  async aprobar(id, nombre) {
    if (!await Utils.confirmar(`¿Aprobar el acceso de ${nombre}?`)) return;
    const { error } = await sb.from('professors').update({ status: 'active' }).eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(`${nombre} aprobado — ya puede ingresar`);
    this._loadProfessors();
  },

  async rechazar(id, nombre) {
    if (!await Utils.confirmar(`¿Rechazar la solicitud de ${nombre}? Esta acción no se puede deshacer.`)) return;
    const { error } = await sb.from('professors').update({ status: 'rejected' }).eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(`Solicitud de ${nombre} rechazada`, 'info');
    this._loadProfessors();
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
      // Admin crea profesores directamente como activos
      ({ error } = await sb.from('professors').insert({ full_name: name, dni, email, phone, status: 'active' }));
    }
    Utils.btnLoading(btn, false);

    if (error) {
      Utils.toast(error.message.includes('unique') ? 'Ya existe un profesor con ese DNI.' : error.message, 'error');
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

    const { data: asignadas } = await sb
      .from('professor_subjects')
      .select('subject_id, is_primary, subjects(name, careers(name))')
      .eq('professor_id', this._asignProfId);

    const asignadasIds = new Set((asignadas || []).map(a => a.subject_id));

    const { data: todas } = await sb
      .from('subjects')
      .select('id, name, career_id, careers(name, institutions(name))')
      .order('name');

    if (!todas?.length) {
      el.innerHTML = '<div style="color:var(--text-3);font-size:.85rem;padding:8px 0">No hay materias cargadas.</div>';
      return;
    }

    el.innerHTML = todas.map(s => {
      const asignada  = asignadasIds.has(s.id);
      const isPrimary = asignadas?.find(a => a.subject_id === s.id)?.is_primary;
      const label     = `${s.careers?.institutions?.name || ''} › ${s.careers?.name || ''} › ${s.name}`;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem">
          <span style="color:${asignada ? 'var(--text-1)' : 'var(--text-3)'}">${label}</span>
          <div style="display:flex;gap:6px;align-items:center">
            ${asignada && isPrimary ? '<span class="badge badge-indigo" style="font-size:.7rem">principal</span>' : ''}
            ${asignada
              ? `<button class="btn btn-danger btn-sm" onclick="AdminProfessors.desasignar('${s.id}')">Quitar</button>`
              : `<button class="btn btn-ghost btn-sm"  onclick="AdminProfessors.asignar('${s.id}')">Asignar</button>`
            }
          </div>
        </div>`;
    }).join('');
  },

  async asignar(subjectId) {
    const { error } = await sb.from('professor_subjects')
      .insert({ professor_id: this._asignProfId, subject_id: subjectId });
    if (error) { Utils.toast('Error al asignar', 'error'); return; }
    Utils.toast('Materia asignada');
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
