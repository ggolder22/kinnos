const ProfesorProyectos = {
  _grupoActual: null, // { id, name, tracking_code, status }

  // ── Lista de grupos ────────────────────────────────────────

  async init() {
    const el = document.getElementById('proyectos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: grupos, error } = await sb
      .from('project_groups')
      .select('*, project_group_members(count), project_updates(count)')
      .eq('subject_id', ProfesorState.materia.id)
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar los proyectos', 'error'); return; }
    this._renderLista(grupos || []);
  },

  _renderLista(grupos) {
    const el = document.getElementById('proyectos-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="ProfesorProyectos.openModalCrear()">+ Nuevo grupo</button>`;

    if (!grupos.length) {
      el.innerHTML = `<div class="page-header"><h3>Proyectos</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">🛠️</div><p>No hay grupos de trabajo creados todavía.</p></div>`;
      return;
    }

    const rows = grupos.map(g => {
      const miembros = g.project_group_members?.[0]?.count ?? 0;
      const posts    = g.project_updates?.[0]?.count ?? 0;
      return `
        <tr>
          <td class="text-main">${g.name}</td>
          <td><span class="badge badge-code">${g.tracking_code}</span></td>
          <td>${Proyectos.STATUS_LABEL[g.status] || ''}</td>
          <td style="text-align:center">${miembros}</td>
          <td style="text-align:center">${posts}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-ghost btn-sm" onclick="ProfesorProyectos.abrirGrupo('${g.id}')">Ver grupo</button>
              <button class="btn btn-danger btn-sm" onclick="ProfesorProyectos.eliminarGrupo('${g.id}','${g.name.replace(/'/g,"\\'")}')">Eliminar</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Proyectos</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Grupo</th><th>Código</th><th>Estado</th><th style="text-align:center">Integrantes</th><th style="text-align:center">Publicaciones</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  // ── Crear grupo ─────────────────────────────────────────────

  openModalCrear() {
    document.getElementById('grupo-modal-nombre').value = '';
    document.getElementById('grupo-modal-desc').value   = '';
    document.getElementById('grupo-modal').classList.remove('hidden');
    document.getElementById('grupo-modal-nombre').focus();
  },

  closeModalCrear() {
    document.getElementById('grupo-modal').classList.add('hidden');
  },

  async crearGrupo() {
    const btn  = document.getElementById('grupo-modal-save');
    const name = document.getElementById('grupo-modal-nombre').value.trim();
    const desc = document.getElementById('grupo-modal-desc').value.trim();
    if (!name) { Utils.toast('El nombre del grupo es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);
    const { error } = await sb.from('project_groups')
      .insert({ subject_id: ProfesorState.materia.id, name, description: desc || null });
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Grupo creado');
    this.closeModalCrear();
    this.init();
  },

  async eliminarGrupo(id, name) {
    if (!await Utils.confirmar(`¿Eliminar el grupo "${name}"? Se borra toda su bitácora y archivos subidos.`)) return;
    const { error } = await sb.from('project_groups').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Grupo eliminado');
    this.init();
  },

  // ── Detalle del grupo ───────────────────────────────────────

  async abrirGrupo(groupId) {
    document.getElementById('proyecto-detalle-modal').classList.remove('hidden');
    document.getElementById('proyecto-detalle-body').innerHTML = '<div class="loading" style="padding:40px;text-align:center">Cargando…</div>';

    const { data: grupo } = await sb.from('project_groups').select('*').eq('id', groupId).single();
    if (!grupo) return;
    this._grupoActual = grupo;
    await this._renderDetalle();
  },

  cerrarGrupo() {
    document.getElementById('proyecto-detalle-modal').classList.add('hidden');
    this._grupoActual = null;
    this.init();
  },

  async _renderDetalle() {
    const g  = this._grupoActual;
    const el = document.getElementById('proyecto-detalle-body');

    const [{ data: miembros }, { data: inscriptos }, { data: updates }] = await Promise.all([
      sb.from('project_group_members').select('student_id, students(id, full_name, dni)').eq('group_id', g.id),
      sb.from('student_subjects').select('students(id, full_name)').eq('subject_id', ProfesorState.materia.id),
      sb.from('project_updates').select('*').eq('group_id', g.id).order('created_at', { ascending: false }),
    ]);

    const miembrosIds = new Set((miembros || []).map(m => m.student_id));
    const disponibles = (inscriptos || []).map(r => r.students).filter(s => s && !miembrosIds.has(s.id));

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px">
        <div>
          <h4 style="margin:0 0 4px">${g.name}</h4>
          ${g.description ? `<div style="font-size:.85rem;color:var(--text-2)">${g.description}</div>` : ''}
        </div>
        <button class="btn btn-ghost btn-sm" onclick="ProfesorProyectos.cerrarGrupo()">✕ Cerrar</button>
      </div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;padding:10px 14px;background:var(--bg-base);border:1px solid var(--border);border-radius:8px">
        <div style="flex:1;min-width:180px">
          <div style="font-size:.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">Código de seguimiento</div>
          <div style="font-size:1rem;font-weight:700;color:var(--accent);font-family:monospace">${g.tracking_code}</div>
        </div>
        <select id="grupo-estado-select" onchange="ProfesorProyectos._cambiarEstado(this.value)">
          <option value="in_progress" ${g.status === 'in_progress' ? 'selected' : ''}>En curso</option>
          <option value="approved" ${g.status === 'approved' ? 'selected' : ''}>✓ Aprobado</option>
          <option value="not_approved" ${g.status === 'not_approved' ? 'selected' : ''}>No aprobado</option>
        </select>
      </div>

      <div style="margin-bottom:18px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">
          Integrantes (${(miembros || []).length})
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          ${(miembros || []).map(m => `
            <span class="badge badge-indigo" style="display:flex;align-items:center;gap:6px">
              ${m.students?.full_name || '—'}
              <span style="cursor:pointer" onclick="ProfesorProyectos._quitarMiembro('${m.student_id}')">✕</span>
            </span>`).join('') || '<span style="color:var(--text-3);font-size:.82rem">Sin integrantes todavía</span>'}
        </div>
        ${disponibles.length ? `
          <div style="display:flex;gap:8px">
            <select id="grupo-agregar-select" style="flex:1">
              ${disponibles.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('')}
            </select>
            <button class="btn btn-ghost btn-sm" onclick="ProfesorProyectos._agregarMiembro()">+ Agregar</button>
          </div>` : ''}
      </div>

      <div>
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">
          Bitácora del proyecto
        </div>
        <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px">
          <textarea id="update-mensaje" rows="2" placeholder="Comentario, avance, devolución…" style="width:100%;font-family:inherit;font-size:.85rem;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-1);resize:vertical;box-sizing:border-box;margin-bottom:8px"></textarea>
          <input type="file" id="update-files" multiple accept="image/*,video/*,.pdf,application/pdf" style="font-size:.82rem">
          <div style="text-align:right;margin-top:8px">
            <button class="btn btn-primary btn-sm" id="update-save-btn" onclick="ProfesorProyectos._publicar()">Publicar</button>
          </div>
        </div>
        <div id="update-timeline">${Proyectos.renderTimeline(updates || [])}</div>
      </div>`;
  },

  async _cambiarEstado(status) {
    const payload = { status };
    if (status !== 'in_progress') payload.approved_at = new Date().toISOString();
    const { error } = await sb.from('project_groups').update(payload).eq('id', this._grupoActual.id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    this._grupoActual.status = status;
    Utils.toast('Estado actualizado');
  },

  async _agregarMiembro() {
    const studentId = document.getElementById('grupo-agregar-select').value;
    if (!studentId) return;
    const { error } = await sb.from('project_group_members').insert({ group_id: this._grupoActual.id, student_id: studentId });
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    this._renderDetalle();
  },

  async _quitarMiembro(studentId) {
    await sb.from('project_group_members').delete().eq('group_id', this._grupoActual.id).eq('student_id', studentId);
    this._renderDetalle();
  },

  async _publicar() {
    const btn     = document.getElementById('update-save-btn');
    const mensaje = document.getElementById('update-mensaje').value.trim();
    const files   = Array.from(document.getElementById('update-files').files || []);

    if (!mensaje && !files.length) { Utils.toast('Escribí un mensaje o adjuntá un archivo', 'error'); return; }

    Utils.btnLoading(btn, true);

    const { error: uploadError, attachments } = await Proyectos.subirAdjuntos(files, this._grupoActual.id);
    if (uploadError) {
      Utils.btnLoading(btn, false);
      Utils.toast('Error al subir el archivo: ' + uploadError.message, 'error');
      return;
    }

    const session = Auth.session();
    const { error } = await sb.from('project_updates').insert({
      group_id: this._grupoActual.id,
      author_type: 'professor',
      author_id: session.id,
      author_name: session.nombre || 'Docente',
      message: mensaje || null,
      attachments,
    });

    Utils.btnLoading(btn, false);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }

    document.getElementById('update-mensaje').value = '';
    document.getElementById('update-files').value = '';
    this._renderDetalle();
  },
};
