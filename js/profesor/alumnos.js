const ProfesorAlumnos = {
  async init() {
    const el = document.getElementById('alumnos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('student_subjects')
      .select('enrolled_at, students(id, full_name, dni, email, phone)')
      .eq('subject_id', ProfesorState.materia.id)
      .order('enrolled_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar alumnos', 'error'); return; }
    this._render(data);
  },

  _render(data) {
    const el = document.getElementById('alumnos-content');
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
      </div>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Alumnos</h3></div>${addForm}
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos inscriptos todavía.</p></div>`;
      return;
    }

    const rows = data.map(r => {
      const a = r.students;
      if (!a) return '';
      return `
        <tr>
          <td class="text-main">${a.full_name}</td>
          <td>${a.dni}</td>
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
      <div class="page-header"><h3>Alumnos <span style="font-weight:400;font-size:.9rem;color:var(--text-3)">(${data.length})</span></h3></div>
      ${addForm}
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>DNI</th><th>Email</th><th>Teléfono</th><th>Inscripto</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
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
