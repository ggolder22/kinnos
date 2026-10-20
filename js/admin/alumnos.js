const AdminAlumnos = {
  _todos: [],
  _instituciones: [], // [{id, name}] distintas entre los alumnos cargados

  async init() {
    const el = document.getElementById('alumnos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('students')
      .select('*, institutions(name)');

    if (error) { Utils.toast('Error al cargar alumnos', 'error'); return; }
    // Orden alfabético por apellido (criterio ministerio), con los que todavía no lo tienen separado al final
    this._todos = (data || []).sort((a, b) => Utils.nombrePlanilla(a).localeCompare(Utils.nombrePlanilla(b)));

    const vistos = new Map();
    this._todos.forEach(a => { if (a.institution_id && !vistos.has(a.institution_id)) vistos.set(a.institution_id, a.institutions?.name || '—'); });
    this._instituciones = [...vistos.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));

    this._render();
  },

  _render() {
    const el = document.getElementById('alumnos-content');
    const addBtn = `
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="AdminAlumnosImport.abrir()">📥 Importar desde Excel</button>
        <button class="btn btn-primary btn-sm" onclick="AdminAlumnos.openModal()">+ Nuevo alumno</button>
      </div>`;

    const filtrosBar = `
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
        <input type="text" id="alumno-search" placeholder="Buscar por nombre o DNI…"
          oninput="AdminAlumnos._aplicarFiltros()"
          style="flex:1;min-width:200px;max-width:340px;padding:8px 12px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-1);font-size:.875rem;outline:none">
        <select id="alumno-filtro-anio" onchange="AdminAlumnos._aplicarFiltros()" style="width:auto;padding:7px 10px">
          <option value="">Todos los años</option>
          ${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${n}°</option>`).join('')}
        </select>
        <select id="alumno-filtro-division" onchange="AdminAlumnos._aplicarFiltros()" style="width:auto;padding:7px 10px">
          <option value="">Todas las divisiones</option>
          <option value="A">División A</option>
          <option value="B">División B</option>
        </select>
        <select id="alumno-filtro-inst" onchange="AdminAlumnos._aplicarFiltros()" style="width:auto;padding:7px 10px">
          <option value="">Todas las instituciones</option>
          <option value="__sin__">Sin institución</option>
          ${this._instituciones.map(i => `<option value="${i.id}">${i.name}</option>`).join('')}
        </select>
        <button class="btn btn-ghost btn-sm" onclick="AdminAlumnos._limpiarFiltros()">Limpiar filtros</button>
      </div>`;

    el.innerHTML = `
      <div class="page-header"><h3>Alumnos</h3>${addBtn}</div>
      ${filtrosBar}
      <div id="alumnos-tabla"></div>`;

    this._renderTabla(this._todos);
  },

  _renderTabla(data) {
    const el = document.getElementById('alumnos-tabla');
    const header = document.querySelector('#alumnos-content .page-header h3');
    if (header) header.innerHTML = `Alumnos <span style="font-size:.85rem;font-weight:400;color:var(--text-3)">(${data.length})</span>`;

    if (!data.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">👥</div><p>No se encontraron alumnos.</p></div>`;
      return;
    }

    const rows = data.map(a => `
      <tr>
        <td class="text-main">${Utils.nombrePlanilla(a)}</td>
        <td>${a.dni}</td>
        <td>${a.email || '—'}</td>
        <td>${a.phone || '—'}</td>
        <td>${a.anio ? `${a.anio}°${a.division ? ' ' + a.division : ''}` : '—'}</td>
        <td>${a.institutions?.name || '<span style="color:var(--danger);font-size:.8rem">Sin institución</span>'}</td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="AdminAlumnos.openModal(${JSON.stringify(a).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="AdminAlumnos.delete('${a.id}','${a.full_name.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>DNI</th><th>Email</th><th>Teléfono</th><th>Curso</th><th>Institución</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _aplicarFiltros() {
    const q        = document.getElementById('alumno-search').value.toLowerCase();
    const anio     = document.getElementById('alumno-filtro-anio').value;
    const division = document.getElementById('alumno-filtro-division').value;
    const inst     = document.getElementById('alumno-filtro-inst').value;

    const filtrados = this._todos.filter(a => {
      if (q && !(a.full_name.toLowerCase().includes(q) || a.dni.includes(q))) return false;
      if (anio && String(a.anio || '') !== anio) return false;
      if (division && a.division !== division) return false;
      if (inst === '__sin__' && a.institution_id) return false;
      if (inst && inst !== '__sin__' && a.institution_id !== inst) return false;
      return true;
    });

    this._renderTabla(filtrados);
  },

  _limpiarFiltros() {
    document.getElementById('alumno-search').value = '';
    document.getElementById('alumno-filtro-anio').value = '';
    document.getElementById('alumno-filtro-division').value = '';
    document.getElementById('alumno-filtro-inst').value = '';
    this._renderTabla(this._todos);
  },

  async openModal(item = null) {
    document.getElementById('alumno-modal-title').textContent = item ? 'Editar alumno' : 'Nuevo alumno';
    document.getElementById('alumno-modal-id').value       = item?.id         || '';
    document.getElementById('alumno-modal-nombre').value   = item?.first_name || '';
    document.getElementById('alumno-modal-apellido').value = item?.last_name  || '';
    document.getElementById('alumno-modal-dni').value   = item?.dni       || '';

    // Alumno cargado antes de separar nombre/apellido: mostrar aviso con el nombre actual
    const hint = document.getElementById('alumno-modal-legacy-hint');
    if (item && !item.first_name && !item.last_name && item.full_name) {
      hint.style.display = 'block';
      document.getElementById('alumno-modal-legacy-name').textContent = item.full_name;
    } else {
      hint.style.display = 'none';
    }
    document.getElementById('alumno-modal-email').value = item?.email     || '';
    document.getElementById('alumno-modal-phone').value = item?.phone     || '';
    document.getElementById('alumno-modal-anio').value     = item?.anio     || '';
    document.getElementById('alumno-modal-division').value = item?.division || '';

    // Cargar instituciones
    const { data: insts } = await sb.from('institutions').select('id, name').order('name');
    const selInst = document.getElementById('alumno-modal-inst');
    selInst.innerHTML = '<option value="">Sin institución asignada</option>' +
      (insts || []).map(i => `<option value="${i.id}"${item?.institution_id === i.id ? ' selected' : ''}>${i.name}</option>`).join('');

    // Cargar carreras si ya tiene institución
    if (item?.institution_id) {
      await this.onInstChange(item.career_id);
    } else {
      document.getElementById('alumno-modal-carrera').innerHTML = '<option value="">Primero seleccioná institución</option>';
      document.getElementById('alumno-modal-carrera').disabled = true;
    }

    document.getElementById('alumno-modal').classList.remove('hidden');
    document.getElementById('alumno-modal-nombre').focus();
  },

  async onInstChange(preselect = null) {
    const instId  = document.getElementById('alumno-modal-inst').value;
    const selCar  = document.getElementById('alumno-modal-carrera');
    if (!instId) {
      selCar.innerHTML = '<option value="">Primero seleccioná institución</option>';
      selCar.disabled = true;
      return;
    }
    selCar.innerHTML = '<option value="">Cargando…</option>';
    selCar.disabled = true;
    const { data: carreras } = await sb.from('careers')
      .select('id, name').eq('institution_id', instId).order('name');
    if (!carreras?.length) {
      selCar.innerHTML = '<option value="">Sin carreras</option>';
      return;
    }
    selCar.innerHTML = '<option value="">Sin carrera asignada</option>' +
      carreras.map(c => `<option value="${c.id}"${preselect === c.id ? ' selected' : ''}>${c.name}</option>`).join('');
    selCar.disabled = false;
  },

  closeModal() {
    document.getElementById('alumno-modal').classList.add('hidden');
  },

  async save() {
    const btn      = document.getElementById('alumno-modal-save');
    const id       = document.getElementById('alumno-modal-id').value;
    const nombre   = document.getElementById('alumno-modal-nombre').value.trim();
    const apellido = document.getElementById('alumno-modal-apellido').value.trim();
    const dni    = document.getElementById('alumno-modal-dni').value.trim();
    const email  = document.getElementById('alumno-modal-email').value.trim();
    const phone  = document.getElementById('alumno-modal-phone').value.trim();
    const instId    = document.getElementById('alumno-modal-inst').value;
    const carreraId = document.getElementById('alumno-modal-carrera').value;
    const anio      = parseInt(document.getElementById('alumno-modal-anio').value) || null;
    const division  = document.getElementById('alumno-modal-division').value || null;

    // Si es un alumno existente y dejaron nombre/apellido en blanco (porque están
    // editando otra cosa, ej: el teléfono), no le tocamos el nombre para no perderlo.
    const existente = id ? this._todos.find(a => a.id === id) : null;
    const dejaronVacio = !nombre && !apellido;

    if (!id && dejaronVacio) { Utils.toast('Nombre y apellido son obligatorios', 'error'); return; }
    if (!dni) { Utils.toast('El DNI es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);
    const nombrePayload = dejaronVacio && existente
      ? { full_name: existente.full_name, first_name: existente.first_name, last_name: existente.last_name }
      : { full_name: `${nombre} ${apellido}`.trim(), first_name: nombre || null, last_name: apellido || null };

    const payload = {
      ...nombrePayload, dni, email: email || null, phone: phone || null,
      institution_id: instId || null, career_id: carreraId || null,
      anio, division,
    };
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
