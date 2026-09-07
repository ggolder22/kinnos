const ProfesorAlumnos = {
  _todos: [],
  _filtroAnio: '',
  _filtroDivision: '',

  async init() {
    const el = document.getElementById('alumnos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('student_subjects')
      .select('enrolled_at, students(id, full_name, dni, email, phone, anio, division)')
      .eq('subject_id', ProfesorState.materia.id)
      .order('enrolled_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar alumnos', 'error'); return; }
    this._todos = data || [];
    this._render(this._aplicarFiltros());
  },

  _aplicarFiltros() {
    return this._todos.filter(r => {
      const a = r.students;
      if (!a) return false;
      if (this._filtroAnio && String(a.anio || '') !== this._filtroAnio) return false;
      if (this._filtroDivision && (a.division || '') !== this._filtroDivision) return false;
      return true;
    });
  },

  filtrar(campo, value) {
    if (campo === 'anio')     this._filtroAnio     = value;
    if (campo === 'division') this._filtroDivision = value;
    this._render(this._aplicarFiltros());
  },

  _render(data) {
    const el = document.getElementById('alumnos-content');
    const division = ProfesorState.materia.division;
    const addForm = `
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
          <div class="form-group" style="margin:0;flex:1;min-width:160px">
            <label>Agregar alumno por DNI</label>
            <input type="text" id="alumno-dni-input" placeholder="Ej: 40123456" inputmode="numeric"
              onkeydown="if(event.key==='Enter') ProfesorAlumnos.agregarPorDNI()">
          </div>
          <button class="btn btn-primary" onclick="ProfesorAlumnos.agregarPorDNI()">Agregar</button>
        </div>
        <p style="font-size:.75rem;color:var(--text-3);margin-top:8px">
          El alumno debe estar registrado en Kinnos para poder inscribirlo.
          El código de la materia es <strong style="color:var(--accent)">${ProfesorState.materia.join_code}</strong>
        </p>
        <div style="display:flex;align-items:center;gap:10px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <label style="margin:0;font-size:.78rem;color:var(--text-3);text-transform:none;font-weight:400">¿A quién le doy esta materia?</label>
          <select id="materia-division-select" onchange="ProfesorAlumnos.cambiarDivision(this.value)" style="width:auto;padding:5px 10px">
            <option value="" ${!division ? 'selected' : ''}>Ambas divisiones (A y B)</option>
            <option value="A" ${division === 'A' ? 'selected' : ''}>Solo división A</option>
            <option value="B" ${division === 'B' ? 'selected' : ''}>Solo división B</option>
          </select>
        </div>
        <p style="font-size:.72rem;color:var(--text-3);margin-top:6px">
          Si elegís una división, solo van a poder inscribirse (por código o desde "Explorar materias")
          los alumnos que hayan indicado ese mismo año y división en su perfil.
        </p>
      </div>`;

    const totalInscriptos = this._todos.length;
    const filterBar = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:14px">
        <label style="font-size:.78rem;color:var(--text-3)">Filtrar por curso:</label>
        <select onchange="ProfesorAlumnos.filtrar('anio', this.value)" style="width:auto;padding:5px 10px">
          <option value="">Todos los años</option>
          ${[1,2,3,4].map(y => `<option value="${y}" ${this._filtroAnio === String(y) ? 'selected' : ''}>${y}°</option>`).join('')}
        </select>
        <select onchange="ProfesorAlumnos.filtrar('division', this.value)" style="width:auto;padding:5px 10px">
          <option value="">Ambas divisiones</option>
          <option value="A" ${this._filtroDivision === 'A' ? 'selected' : ''}>División A</option>
          <option value="B" ${this._filtroDivision === 'B' ? 'selected' : ''}>División B</option>
        </select>
        ${(this._filtroAnio || this._filtroDivision) ? `<span style="font-size:.78rem;color:var(--text-3)">${data.length} de ${totalInscriptos} alumnos</span>` : ''}
      </div>`;

    if (!totalInscriptos) {
      el.innerHTML = `<div class="page-header"><h3>Alumnos</h3></div>${addForm}
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos inscriptos todavía.</p></div>`;
      return;
    }

    const rows = data.map(r => {
      const a = r.students;
      if (!a) return '';
      const curso = a.anio ? `${a.anio}°${a.division ? ' ' + a.division : ''}` : '—';
      return `
        <tr>
          <td class="text-main">${a.full_name}</td>
          <td>${a.dni}</td>
          <td>${curso}</td>
          <td>${a.email || '—'}</td>
          <td>${a.phone || '—'}</td>
          <td>${Utils.formatDate(r.enrolled_at)}</td>
          <td>
            <button class="btn btn-danger btn-sm"
              onclick="ProfesorAlumnos.remover('${a.id}','${a.full_name.replace(/'/g, "\\'")}')">
              Quitar
            </button>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Alumnos <span style="font-weight:400;font-size:.9rem;color:var(--text-3)">(${totalInscriptos})</span></h3></div>
      ${addForm}
      ${filterBar}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>DNI</th><th>Curso</th><th>Email</th><th>Teléfono</th><th>Inscripto</th><th></th></tr></thead>
          <tbody>${rows.length ? rows : `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-3)">Ningún alumno coincide con el filtro.</td></tr>`}</tbody>
        </table>
      </div>`;
  },

  async cambiarDivision(value) {
    const division = value || null;
    const { error } = await sb.from('subjects').update({ division }).eq('id', ProfesorState.materia.id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    ProfesorState.materia.division = division;
    Utils.toast(division ? `Materia limitada a división ${division}` : 'Materia abierta a ambas divisiones');
  },

  async agregarPorDNI() {
    const dni = document.getElementById('alumno-dni-input').value.trim();
    if (!dni) { Utils.toast('Ingresá un DNI', 'error'); return; }

    // Buscar alumno
    const { data: alumno } = await sb.from('students').select('id, full_name').eq('dni', dni).maybeSingle();
    if (!alumno) {
      Utils.toast(`No existe alumno con DNI ${dni}. Debe registrarse primero.`, 'error');
      return;
    }

    // Verificar si ya está inscripto
    const { data: existe } = await sb.from('student_subjects')
      .select('student_id')
      .eq('student_id', alumno.id)
      .eq('subject_id', ProfesorState.materia.id)
      .maybeSingle();

    if (existe) { Utils.toast(`${alumno.full_name} ya está inscripto en esta materia.`, 'info'); return; }

    const { error } = await sb.from('student_subjects')
      .insert({ student_id: alumno.id, subject_id: ProfesorState.materia.id });

    if (error) { Utils.toast('Error al inscribir: ' + error.message, 'error'); return; }
    Utils.toast(`${alumno.full_name} inscripto correctamente`);
    this.init();
  },

  async remover(studentId, nombre) {
    if (!await Utils.confirmar(`¿Quitar a ${nombre} de esta materia?`)) return;
    const { error } = await sb.from('student_subjects')
      .delete()
      .eq('student_id', studentId)
      .eq('subject_id', ProfesorState.materia.id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(`${nombre} removido de la materia`);
    this.init();
  },
};
