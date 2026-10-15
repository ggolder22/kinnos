// Gestión de Instituciones → Carreras → Materias (drill-down)
const AdminInstitutions = {
  // Estado de navegación actual
  state: {
    nivel: 'inst',        // 'inst' | 'carrera' | 'materia'
    instId: null,
    instName: '',
    carreraId: null,
    carreraName: '',
  },

  init() {
    this.goInstituciones();
  },

  // ── Navegación ──────────────────────────────────────────────

  goInstituciones() {
    this.state = { nivel: 'inst', instId: null, instName: '', carreraId: null, carreraName: '' };
    this._renderBreadcrumb();
    this._loadInstituciones();
  },

  goCarreras(instId, instName) {
    this.state = { nivel: 'carrera', instId, instName, carreraId: null, carreraName: '' };
    this._renderBreadcrumb();
    this._loadCarreras();
  },

  goMaterias(carreraId, carreraName) {
    this.state.nivel = 'materia';
    this.state.carreraId = carreraId;
    this.state.carreraName = carreraName;
    this._renderBreadcrumb();
    this._loadMaterias();
  },

  _renderBreadcrumb() {
    const s = this.state;
    const bc = document.getElementById('inst-breadcrumb');
    let html = `<span class="crumb ${s.nivel === 'inst' ? 'active' : ''}"
                  onclick="AdminInstitutions.goInstituciones()">Instituciones</span>`;
    if (s.nivel !== 'inst') {
      html += `<span class="sep">›</span>
               <span class="crumb ${s.nivel === 'carrera' ? 'active' : ''}"
                 onclick="AdminInstitutions.goCarreras('${s.instId}','${s.instName.replace(/'/g, "\\'")}')">
                 ${s.instName}</span>`;
    }
    if (s.nivel === 'materia') {
      html += `<span class="sep">›</span>
               <span class="crumb active">${s.carreraName}</span>`;
    }
    bc.innerHTML = html;
  },

  // ── Instituciones ────────────────────────────────────────────

  async _loadInstituciones() {
    const el = document.getElementById('inst-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const { data, error } = await sb.from('institutions').select('*').order('name');
    if (error) { Utils.toast('Error al cargar instituciones', 'error'); return; }
    this._renderInstituciones(data);
  },

  _renderInstituciones(data) {
    const el = document.getElementById('inst-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="AdminInstitutions.openInstModal()">+ Nueva institución</button>`;
    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Instituciones</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">🏫</div><p>No hay instituciones todavía.</p></div>`;
      return;
    }
    const rows = data.map(i => `
      <tr>
        <td class="text-main">
          <span class="row-link" onclick="AdminInstitutions.goCarreras('${i.id}','${i.name.replace(/'/g, "\\'")}')">
            ${i.name} <span class="arrow">›</span>
          </span>
        </td>
        <td>${i.address || '—'}</td>
        <td>${Utils.formatDate(i.created_at)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="AdminInstitutions.openInstModal(${JSON.stringify(i).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="AdminInstitutions.deleteInst('${i.id}','${i.name.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');
    el.innerHTML = `
      <div class="page-header"><h3>Instituciones</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Dirección</th><th>Alta</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  openInstModal(item = null) {
    document.getElementById('inst-modal-title').textContent = item ? 'Editar institución' : 'Nueva institución';
    document.getElementById('inst-modal-id').value    = item?.id    || '';
    document.getElementById('inst-modal-name').value  = item?.name  || '';
    document.getElementById('inst-modal-addr').value  = item?.address || '';
    document.getElementById('inst-modal').classList.remove('hidden');
    document.getElementById('inst-modal-name').focus();
  },

  closeInstModal() {
    document.getElementById('inst-modal').classList.add('hidden');
  },

  async saveInst() {
    const btn  = document.getElementById('inst-modal-save');
    const id   = document.getElementById('inst-modal-id').value;
    const name = document.getElementById('inst-modal-name').value.trim();
    const addr = document.getElementById('inst-modal-addr').value.trim();
    if (!name) { Utils.toast('El nombre es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);
    let error;
    if (id) {
      ({ error } = await sb.from('institutions').update({ name, address: addr }).eq('id', id));
    } else {
      ({ error } = await sb.from('institutions').insert({ name, address: addr }));
    }
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Institución actualizada' : 'Institución creada');
    this.closeInstModal();
    this._loadInstituciones();
  },

  async deleteInst(id, name) {
    if (!await Utils.confirmar(`¿Eliminar "${name}"? Se borrarán también sus carreras y materias.`)) return;
    const { error } = await sb.from('institutions').delete().eq('id', id);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Institución eliminada');
    this._loadInstituciones();
  },

  // ── Carreras ─────────────────────────────────────────────────

  async _loadCarreras() {
    const el = document.getElementById('inst-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const { data, error } = await sb.from('careers')
      .select('*').eq('institution_id', this.state.instId).order('name');
    if (error) { Utils.toast('Error al cargar carreras', 'error'); return; }
    this._renderCarreras(data);
  },

  _renderCarreras(data) {
    const el  = document.getElementById('inst-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="AdminInstitutions.openCarreraModal()">+ Nueva carrera</button>`;
    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Carreras</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">🎓</div><p>No hay carreras en esta institución.</p></div>`;
      return;
    }
    const rows = data.map(c => `
      <tr>
        <td class="text-main">
          <span class="row-link" onclick="AdminInstitutions.goMaterias('${c.id}','${c.name.replace(/'/g, "\\'")}')">
            ${c.name} <span class="arrow">›</span>
          </span>
        </td>
        <td>${c.description || '—'}</td>
        <td>${Utils.formatDate(c.created_at)}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="AdminInstitutions.openCarreraModal(${JSON.stringify(c).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="AdminInstitutions.deleteCarrera('${c.id}','${c.name.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');
    el.innerHTML = `
      <div class="page-header"><h3>Carreras · ${this.state.instName}</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Carrera</th><th>Descripción</th><th>Alta</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  openCarreraModal(item = null) {
    document.getElementById('carrera-modal-title').textContent = item ? 'Editar carrera' : 'Nueva carrera';
    document.getElementById('carrera-modal-id').value   = item?.id   || '';
    document.getElementById('carrera-modal-name').value = item?.name || '';
    document.getElementById('carrera-modal-desc').value = item?.description || '';
    document.getElementById('carrera-modal').classList.remove('hidden');
    document.getElementById('carrera-modal-name').focus();
  },

  closeCarreraModal() {
    document.getElementById('carrera-modal').classList.add('hidden');
  },

  async saveCarrera() {
    const btn  = document.getElementById('carrera-modal-save');
    const id   = document.getElementById('carrera-modal-id').value;
    const name = document.getElementById('carrera-modal-name').value.trim();
    const desc = document.getElementById('carrera-modal-desc').value.trim();
    if (!name) { Utils.toast('El nombre es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);
    let error;
    if (id) {
      ({ error } = await sb.from('careers').update({ name, description: desc }).eq('id', id));
    } else {
      ({ error } = await sb.from('careers').insert({ name, description: desc, institution_id: this.state.instId }));
    }
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Carrera actualizada' : 'Carrera creada');
    this.closeCarreraModal();
    this._loadCarreras();
  },

  async deleteCarrera(id, name) {
    if (!await Utils.confirmar(`¿Eliminar "${name}"? Se borrarán también sus materias.`)) return;
    const { error } = await sb.from('careers').delete().eq('id', id);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Carrera eliminada');
    this._loadCarreras();
  },

  // ── Materias ─────────────────────────────────────────────────

  async _loadMaterias() {
    const el = document.getElementById('inst-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const { data, error } = await sb.from('subjects')
      .select('*').eq('career_id', this.state.carreraId).order('year').order('name');
    if (error) { Utils.toast('Error al cargar materias', 'error'); return; }
    this._renderMaterias(data);
  },

  _renderMaterias(data) {
    const el  = document.getElementById('inst-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="AdminInstitutions.openMateriaModal()">+ Nueva materia</button>`;
    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Plan de estudios</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">📚</div><p>No hay materias en esta carrera.</p></div>`;
      return;
    }
    const rows = data.map(m => `
      <tr>
        <td class="text-main">${m.name}</td>
        <td>${m.year ? `${m.year}°` : '—'}</td>
        <td>${m.division ? `<span class="badge badge-indigo">${m.division}</span>` : 'Ambas'}</td>
        <td>${m.despliegue || '—'}</td>
        <td>${m.campo_formacion
              ? `<span class="badge ${this._badgeCampo(m.campo_formacion)}">${m.campo_formacion}</span>`
              : '—'}</td>
        <td style="text-align:center">${m.hs_semana ?? '—'}</td>
        <td style="text-align:center">${m.hs_total ?? '—'}</td>
        <td><span class="badge badge-code">${m.join_code}</span></td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="AdminInstitutions.abrirHorarios('${m.id}','${m.name.replace(/'/g, "\\'")}',${m.year || 'null'},${m.division ? `'${m.division}'` : 'null'})">Horarios</button>
            <button class="btn btn-ghost btn-sm" onclick="AdminInstitutions.openMateriaModal(${JSON.stringify(m).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="AdminInstitutions.deleteMateria('${m.id}','${m.name.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');
    el.innerHTML = `
      <div class="page-header"><h3>Plan de estudios · ${this.state.carreraName}</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr>
            <th>Espacio curricular</th><th>Año</th><th>División</th><th>Despliegue</th>
            <th>Campo</th><th>Hs/sem</th><th>Hs total</th><th>Código</th><th>Acciones</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _badgeCampo(campo) {
    const map = {
      'General': 'badge-indigo',
      'Específica': '',
      'Fundamento': 'badge-code',
      'P. Profesionalizantes': '',
    };
    return map[campo] || '';
  },

  openMateriaModal(item = null) {
    document.getElementById('materia-modal-title').textContent     = item ? 'Editar materia' : 'Nueva materia';
    document.getElementById('materia-modal-id').value              = item?.id              || '';
    document.getElementById('materia-modal-name').value            = item?.name            || '';
    document.getElementById('materia-modal-year').value            = item?.year            || '';
    document.getElementById('materia-modal-despliegue').value      = item?.despliegue      || '';
    document.getElementById('materia-modal-division').value        = item?.division        || '';
    document.getElementById('materia-modal-campo').value           = item?.campo_formacion || '';
    document.getElementById('materia-modal-hs-semana').value       = item?.hs_semana       || '';
    document.getElementById('materia-modal-hs-total').value        = item?.hs_total        || '';
    document.getElementById('materia-modal').classList.remove('hidden');
    document.getElementById('materia-modal-name').focus();
  },

  closeMateriaModal() {
    document.getElementById('materia-modal').classList.add('hidden');
  },

  async saveMateria() {
    const btn       = document.getElementById('materia-modal-save');
    const id        = document.getElementById('materia-modal-id').value;
    const name      = document.getElementById('materia-modal-name').value.trim();
    const year      = parseInt(document.getElementById('materia-modal-year').value) || null;
    const despliegue     = document.getElementById('materia-modal-despliegue').value || null;
    const division       = document.getElementById('materia-modal-division').value || null;
    const campo_formacion = document.getElementById('materia-modal-campo').value || null;
    const hs_semana = parseInt(document.getElementById('materia-modal-hs-semana').value) || null;
    const hs_total  = parseInt(document.getElementById('materia-modal-hs-total').value)  || null;
    if (!name) { Utils.toast('El nombre es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);
    const payload = { name, year, despliegue, division, campo_formacion, hs_semana, hs_total };
    let error;
    if (id) {
      ({ error } = await sb.from('subjects').update(payload).eq('id', id));
    } else {
      ({ error } = await sb.from('subjects').insert({ ...payload, career_id: this.state.carreraId }));
    }
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Materia actualizada' : 'Materia creada — se generó el código automáticamente');
    this.closeMateriaModal();
    this._loadMaterias();
  },

  async deleteMateria(id, name) {
    if (!await Utils.confirmar(`¿Eliminar la materia "${name}"?`)) return;
    const { error } = await sb.from('subjects').delete().eq('id', id);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Materia eliminada');
    this._loadMaterias();
  },

  // ── Vincular horarios del cronograma con la materia ───────────
  // Por defecto el sistema matchea solo por nombre + año (sin que nadie
  // tenga que hacer nada). Esto es solo para los casos en que el nombre
  // en el cronograma no coincide exactamente con el de la materia.

  _horariosMateria: null, // { id, name, year, division }

  async abrirHorarios(id, name, year, division) {
    this._horariosMateria = { id, name, year, division };
    document.getElementById('horarios-modal-title').textContent = `Horarios — ${name}`;
    document.getElementById('horarios-modal').classList.remove('hidden');
    await this._renderHorarios();
  },

  cerrarHorarios() {
    document.getElementById('horarios-modal').classList.add('hidden');
  },

  async _renderHorarios() {
    const el = document.getElementById('horarios-modal-body');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const m = this._horariosMateria;

    const { data: vinculados } = await sb.from('schedules').select('*')
      .eq('subject_id', m.id).order('day').order('time_start');

    const { data: candidatos } = await sb.from('schedules').select('*')
      .is('subject_id', null).eq('anio', m.year || 0).order('day').order('time_start');

    const vinculadosHtml = (vinculados || []).length
      ? vinculados.map(h => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;font-size:.85rem;color:var(--text-1)">${h.day} · ${h.time_start}–${h.time_end}${h.is_consulta ? ' (consulta)' : ''}</div>
          <button class="btn btn-danger btn-sm" onclick="AdminInstitutions._quitarHorario('${h.id}')">Quitar</button>
        </div>`).join('')
      : `<div style="padding:12px 0;color:var(--text-3);font-size:.85rem">
           Sin vínculo explícito — mientras el nombre de la materia coincida con el del cronograma (${m.year ? m.year + '° año' : 'mismo año'}),
           el sistema ya lo matchea solo y no hace falta vincular nada acá.
         </div>`;

    const candidatosHtml = (candidatos || []).length
      ? candidatos.map(h => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;font-size:.85rem;color:var(--text-1)">
            ${h.day} · ${h.time_start}–${h.time_end}
            <span style="color:var(--text-3)"> — "${h.subject_name}" en el cronograma</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="AdminInstitutions._vincularHorario('${h.id}')">Vincular</button>
        </div>`).join('')
      : '<div style="padding:12px 0;color:var(--text-3);font-size:.85rem">No hay horarios de ese año sin vincular.</div>';

    el.innerHTML = `
      <p style="font-size:.82rem;color:var(--text-2);margin-bottom:16px">
        La ventana de asistencia se calcula a partir de estos horarios. Por defecto el sistema matchea
        automáticamente por nombre y año — usá esto solo si una materia no quedó bien vinculada
        (nombre distinto en el cronograma, abreviatura, etc.). Si la clase ocupa varias horas seguidas
        el mismo día, vinculá todos esos bloques.
      </p>
      <div class="page-header" style="margin-top:4px"><h3 style="font-size:.95rem">Vínculo explícito</h3></div>
      ${vinculadosHtml}
      <div class="page-header" style="margin-top:20px"><h3 style="font-size:.95rem">Vincular desde el cronograma</h3></div>
      ${candidatosHtml}`;
  },

  async _vincularHorario(scheduleId) {
    const { error } = await sb.from('schedules').update({ subject_id: this._horariosMateria.id }).eq('id', scheduleId);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Horario vinculado');
    this._renderHorarios();
  },

  async _quitarHorario(scheduleId) {
    const { error } = await sb.from('schedules').update({ subject_id: null }).eq('id', scheduleId);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Vínculo quitado — ahora se matchea de nuevo por nombre, si corresponde');
    this._renderHorarios();
  },
};
