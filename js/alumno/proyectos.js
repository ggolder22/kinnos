const AlumnoProyectos = {
  _miGrupo: null,

  async init() {
    const el = document.getElementById('proyectos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    // ¿Ya estoy en un grupo de esta materia?
    const { data: miMembresia } = await sb
      .from('project_group_members')
      .select('group_id, project_groups!inner(*)')
      .eq('student_id', session.id)
      .eq('project_groups.subject_id', AlumnoState.materia.id)
      .maybeSingle();

    if (miMembresia) {
      this._miGrupo = miMembresia.project_groups;
      await this._renderGrupo();
    } else {
      this._miGrupo = null;
      await this._renderSelector();
    }
  },

  // ── Sin grupo todavía: elegir uno o crear ──────────────────

  async _renderSelector() {
    const el = document.getElementById('proyectos-content');
    const { data: grupos } = await sb
      .from('project_groups')
      .select('*, project_group_members(count)')
      .eq('subject_id', AlumnoState.materia.id)
      .order('created_at', { ascending: false });

    const lista = (grupos || []).map(g => {
      const miembros = g.project_group_members?.[0]?.count ?? 0;
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--bg-base);border:1px solid var(--border);border-radius:8px;margin-bottom:8px">
          <div>
            <div style="font-weight:600;color:var(--text-1);font-size:.9rem">${g.name}</div>
            ${g.description ? `<div style="font-size:.78rem;color:var(--text-3)">${g.description}</div>` : ''}
            <div style="font-size:.72rem;color:var(--text-3);margin-top:2px">${miembros} integrante${miembros !== 1 ? 's' : ''}</div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="AlumnoProyectos.unirme('${g.id}')">Unirme</button>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Proyectos</h3></div>
      <div class="card" style="margin-bottom:20px">
        <p style="font-size:.85rem;color:var(--text-2);margin-bottom:10px">Todavía no estás en ningún grupo de trabajo.</p>
        <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;flex:1;min-width:180px">
            <label>Nombre de tu grupo</label>
            <input type="text" id="grupo-nuevo-nombre" placeholder="Ej: Calentador solar de agua">
          </div>
          <button class="btn btn-primary" onclick="AlumnoProyectos.crearGrupo()">+ Crear grupo</button>
        </div>
      </div>
      ${grupos?.length ? `
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">
          O sumate a un grupo existente
        </div>
        ${lista}` : ''}`;
  },

  async crearGrupo() {
    const input = document.getElementById('grupo-nuevo-nombre');
    const name  = input.value.trim();
    if (!name) { Utils.toast('Ponele un nombre a tu grupo', 'error'); return; }

    const session = Auth.session();
    const { data: grupo, error } = await sb.from('project_groups')
      .insert({ subject_id: AlumnoState.materia.id, name })
      .select().single();
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }

    await sb.from('project_group_members').insert({ group_id: grupo.id, student_id: session.id });
    Utils.toast('¡Grupo creado! Código de seguimiento: ' + grupo.tracking_code);
    this.init();
  },

  async unirme(groupId) {
    const session = Auth.session();
    const { error } = await sb.from('project_group_members').insert({ group_id: groupId, student_id: session.id });
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('¡Te uniste al grupo!');
    this.init();
  },

  // ── Ya tengo grupo: bitácora ───────────────────────────────

  async _renderGrupo() {
    const g  = this._miGrupo;
    const el = document.getElementById('proyectos-content');
    const session = Auth.session();

    const [{ data: miembros }, { data: updates }] = await Promise.all([
      sb.from('project_group_members').select('student_id, students(id, full_name)').eq('group_id', g.id),
      sb.from('project_updates').select('*').eq('group_id', g.id).order('created_at', { ascending: false }),
    ]);

    el.innerHTML = `
      <div class="page-header"><h3>${g.name}</h3></div>

      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:16px;padding:10px 14px;background:var(--bg-base);border:1px solid var(--border);border-radius:8px">
        <div style="flex:1;min-width:180px">
          <div style="font-size:.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em">Código de seguimiento</div>
          <div style="font-size:1rem;font-weight:700;color:var(--accent);font-family:monospace">${g.tracking_code}</div>
        </div>
        ${Proyectos.STATUS_LABEL[g.status] || ''}
      </div>

      <div style="margin-bottom:18px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">
          Integrantes
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${(miembros || []).map(m => `<span class="badge badge-indigo">${m.students?.full_name || '—'}</span>`).join('')}
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="AlumnoProyectos.salirDelGrupo()">Salir del grupo</button>
      </div>

      <div>
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">
          Bitácora del proyecto
        </div>
        <div style="background:var(--bg-base);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:14px">
          <textarea id="update-mensaje" rows="2" placeholder="Contá un avance, subí fotos del prototipo…" style="width:100%;font-family:inherit;font-size:.85rem;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card);color:var(--text-1);resize:vertical;box-sizing:border-box;margin-bottom:8px"></textarea>
          <input type="file" id="update-files" multiple accept="image/*,video/*,.pdf,application/pdf" style="font-size:.82rem">
          <div style="text-align:right;margin-top:8px">
            <button class="btn btn-primary btn-sm" id="update-save-btn" onclick="AlumnoProyectos._publicar()">Publicar</button>
          </div>
        </div>
        <div id="update-timeline">${Proyectos.renderTimeline(updates || [])}</div>
      </div>`;
  },

  async salirDelGrupo() {
    if (!await Utils.confirmar('¿Salir de este grupo de trabajo?')) return;
    const session = Auth.session();
    await sb.from('project_group_members').delete().eq('group_id', this._miGrupo.id).eq('student_id', session.id);
    this._miGrupo = null;
    this.init();
  },

  async _publicar() {
    const btn     = document.getElementById('update-save-btn');
    const mensaje = document.getElementById('update-mensaje').value.trim();
    const files   = Array.from(document.getElementById('update-files').files || []);

    if (!mensaje && !files.length) { Utils.toast('Escribí un mensaje o adjuntá un archivo', 'error'); return; }

    Utils.btnLoading(btn, true);

    const { error: uploadError, attachments } = await Proyectos.subirAdjuntos(files, this._miGrupo.id);
    if (uploadError) {
      Utils.btnLoading(btn, false);
      Utils.toast('Error al subir el archivo: ' + uploadError.message, 'error');
      return;
    }

    const session = Auth.session();
    const { error } = await sb.from('project_updates').insert({
      group_id: this._miGrupo.id,
      author_type: 'student',
      author_id: session.id,
      author_name: session.nombre || 'Alumno',
      message: mensaje || null,
      attachments,
    });

    Utils.btnLoading(btn, false);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }

    document.getElementById('update-mensaje').value = '';
    document.getElementById('update-files').value = '';
    this._renderGrupo();
  },
};
