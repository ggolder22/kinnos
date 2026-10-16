const PreceptorNotas = {
  _alumnoActual: null,

  async init() {
    if (this._alumnoActual) return this._renderAlumno();
    this._renderBuscador();
  },

  _renderBuscador() {
    const el = document.getElementById('notas-content');
    el.innerHTML = `
      <div class="page-header"><h3>Notas</h3>
        <button class="btn btn-ghost btn-sm" onclick="PreceptorNotas.descargarTodo()">⬇ Descargar notas de la institución (CSV)</button>
      </div>
      <div class="card" style="max-width:480px">
        <div class="form-group" style="margin-bottom:10px">
          <label>Buscar alumno por nombre o DNI</label>
          <input type="text" id="prec-notas-buscar" placeholder="Ej: Pérez o 40123456"
            oninput="PreceptorNotas._buscar(this.value)">
        </div>
        <div id="prec-notas-resultados"></div>
      </div>`;
  },

  async _buscar(q) {
    const cont = document.getElementById('prec-notas-resultados');
    const texto = q.trim().toLowerCase();
    if (texto.length < 2) { cont.innerHTML = ''; return; }

    const session = Auth.session();
    const { data } = await sb.from('students').select('*')
      .eq('institution_id', session.inst)
      .or(`dni.ilike.%${texto}%,full_name.ilike.%${texto}%`)
      .limit(10);

    const resultados = data || [];
    cont.innerHTML = resultados.length
      ? resultados.map(a => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="font-size:.85rem;color:var(--text-1)">${Utils.nombrePlanilla(a)} <span style="color:var(--text-3)">· DNI ${a.dni}</span></div>
            <button class="btn btn-primary btn-sm" onclick="PreceptorNotas.verAlumno('${a.id}')">Ver</button>
          </div>`).join('')
      : '<div style="color:var(--text-3);font-size:.85rem;padding:8px 0">Sin resultados.</div>';
  },

  async verAlumno(studentId) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-notas').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-notas').classList.add('active');
    document.getElementById('topbar-title').textContent = 'Notas';

    const { data: alumno } = await sb.from('students').select('*').eq('id', studentId).single();
    if (!alumno) { Utils.toast('No se encontró el alumno', 'error'); return; }
    this._alumnoActual = alumno;
    await this._renderAlumno();
  },

  volverBuscador() {
    this._alumnoActual = null;
    this._renderBuscador();
  },

  async _renderAlumno() {
    const el = document.getElementById('notas-content');
    el.innerHTML = `<div class="page-header"><h3>Notas</h3></div><div class="loading">Cargando…</div>`;
    const a = this._alumnoActual;

    const { data: resultados } = await sb
      .from('exam_results')
      .select('*, exams(title, subject_id, subjects(name))')
      .eq('student_id', a.id)
      .neq('status', 'in_progress')
      .order('submitted_at', { ascending: false });

    const filas = (resultados || []).map(r => {
      const finalScore = r.professor_score ?? r.score;
      const grade = Math.round(finalScore / 10 * 10) / 10;
      const color = grade >= 6 ? 'var(--success)' : 'var(--danger)';
      const materia = r.exams?.subjects?.name || '—';
      const estado = r.status === 'confirmed'
        ? '<span class="badge badge-active">Confirmado</span>'
        : '<span class="badge badge-practice">⏳ Pendiente</span>';
      return `
        <tr>
          <td>${materia}</td>
          <td class="text-main">${r.exams?.title || '—'}</td>
          <td style="text-align:center;font-weight:700;color:${color}">${grade}</td>
          <td>${estado}</td>
          <td>${Utils.formatDate(r.submitted_at)}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="PreceptorNotas.volverBuscador()">← Buscar otro alumno</button>
      <div class="page-header">
        <h3>${Utils.nombrePlanilla(a)}</h3>
        <button class="btn btn-ghost btn-sm" onclick="PreceptorNotas.descargarAlumno()">⬇ Descargar (CSV)</button>
      </div>
      <div style="font-size:.78rem;color:var(--text-3);margin-bottom:14px">DNI ${a.dni} · ${a.anio ? a.anio + '°' : ''} ${a.division || ''}</div>
      ${resultados?.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Materia</th><th>Examen</th><th style="text-align:center">Nota</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>` : '<div class="empty-state"><div class="icon">📝</div><p>Sin exámenes rendidos todavía.</p></div>'}`;

    this._resultadosActuales = resultados || [];
  },

  descargarAlumno() {
    if (!this._alumnoActual) return;
    const a = this._alumnoActual;
    const filas = (this._resultadosActuales || []).map(r => {
      const finalScore = r.professor_score ?? r.score;
      const grade = Math.round(finalScore / 10 * 10) / 10;
      return [Utils.nombrePlanilla(a), a.dni, r.exams?.subjects?.name || '', r.exams?.title || '', grade, r.status, r.submitted_at || ''];
    });
    Utils.descargarCsv(`notas_${a.dni}.csv`, ['Alumno', 'DNI', 'Materia', 'Examen', 'Nota', 'Estado', 'Fecha'], filas);
  },

  async descargarTodo() {
    const session = Auth.session();
    const { data: alumnos } = await sb.from('students').select('id, full_name, first_name, last_name, dni').eq('institution_id', session.inst);
    const alumnoIds = (alumnos || []).map(a => a.id);
    if (!alumnoIds.length) { Utils.toast('No hay alumnos cargados', 'error'); return; }

    const alumnoPorId = {};
    alumnos.forEach(a => { alumnoPorId[a.id] = a; });

    const { data: resultados } = await sb
      .from('exam_results')
      .select('*, exams(title, subjects(name))')
      .in('student_id', alumnoIds)
      .neq('status', 'in_progress');

    if (!resultados?.length) { Utils.toast('No hay notas cargadas todavía', 'error'); return; }

    const filas = resultados.map(r => {
      const a = alumnoPorId[r.student_id];
      const finalScore = r.professor_score ?? r.score;
      const grade = Math.round(finalScore / 10 * 10) / 10;
      return [Utils.nombrePlanilla(a), a?.dni || '', r.exams?.subjects?.name || '', r.exams?.title || '', grade, r.status, r.submitted_at || ''];
    });

    Utils.descargarCsv('notas_institucion.csv', ['Alumno', 'DNI', 'Materia', 'Examen', 'Nota', 'Estado', 'Fecha'], filas);
  },

};
