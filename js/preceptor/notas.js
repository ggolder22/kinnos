const PreceptorNotas = {
  _alumnoActual: null,
  _filtroAnio: '',
  _filtroDivision: '',
  _filtroQ: '',

  async init() {
    if (this._alumnoActual) return this._renderAlumno();
    await this._renderBuscador();
  },

  async _renderBuscador() {
    const el = document.getElementById('notas-content');
    el.innerHTML = `
      <div class="page-header"><h3>Calificaciones</h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="PreceptorNotas.descargarTodo()">⬇ Excel (CSV)</button>
          <button class="btn btn-ghost btn-sm" onclick="PreceptorNotas.descargarActaPDF()">📄 Acta (PDF)</button>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end">
          <div class="form-group" style="margin:0;min-width:200px;flex:1">
            <label>Buscar por nombre o DNI</label>
            <input type="text" id="prec-notas-buscar" placeholder="Ej: Pérez o 40123456" value="${this._filtroQ}"
              oninput="PreceptorNotas._filtrar('q', this.value)">
          </div>
          <div class="form-group" style="margin:0">
            <label>Año</label>
            <select id="prec-notas-anio" onchange="PreceptorNotas._filtrar('anio', this.value)" style="width:auto;padding:7px 10px">
              <option value="">Todos</option>
              ${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${this._filtroAnio === String(n) ? 'selected' : ''}>${n}°</option>`).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label>División</label>
            <select id="prec-notas-division" onchange="PreceptorNotas._filtrar('division', this.value)" style="width:auto;padding:7px 10px">
              <option value="">Todas</option>
              <option value="A" ${this._filtroDivision === 'A' ? 'selected' : ''}>A</option>
              <option value="B" ${this._filtroDivision === 'B' ? 'selected' : ''}>B</option>
            </select>
          </div>
        </div>
      </div>
      <div id="prec-notas-resultados"></div>`;

    await this._listar();
  },

  _filtrar(campo, value) {
    if (campo === 'q')        this._filtroQ        = value;
    if (campo === 'anio')     this._filtroAnio     = value;
    if (campo === 'division') this._filtroDivision = value;
    this._listar();
  },

  async _alumnosFiltradosDB() {
    const session = Auth.session();
    let query = sb.from('students').select('id, full_name, first_name, last_name, dni, anio, division')
      .eq('institution_id', session.inst);
    if (this._filtroAnio)     query = query.eq('anio', parseInt(this._filtroAnio));
    if (this._filtroDivision) query = query.eq('division', this._filtroDivision);
    if (this._filtroQ.trim().length >= 2) {
      const t = this._filtroQ.trim();
      query = query.or(`dni.ilike.%${t}%,full_name.ilike.%${t}%`);
    }
    const { data } = await query;
    return data || [];
  },

  async _listar() {
    const cont = document.getElementById('prec-notas-resultados');
    if (!this._filtroAnio && !this._filtroDivision && this._filtroQ.trim().length < 2) {
      cont.innerHTML = '<div style="color:var(--text-3);font-size:.85rem;padding:16px 0">Elegí un año y/o división, o buscá un alumno por nombre/DNI.</div>';
      return;
    }

    cont.innerHTML = '<div class="loading">Cargando…</div>';
    const resultados = (await this._alumnosFiltradosDB())
      .sort((a, b) => Utils.nombrePlanilla(a).localeCompare(Utils.nombrePlanilla(b)));

    cont.innerHTML = resultados.length
      ? `<div class="table-wrap">
          <table>
            <thead><tr><th>Alumno</th><th>DNI</th><th>Curso</th><th></th></tr></thead>
            <tbody>${resultados.map(a => `
              <tr>
                <td class="text-main">${Utils.nombrePlanilla(a)}</td>
                <td>${a.dni}</td>
                <td>${a.anio ? a.anio + '°' : '—'}${a.division ? ' ' + a.division : ''}</td>
                <td><button class="btn btn-primary btn-sm" onclick="PreceptorNotas.verAlumno('${a.id}')">Ver notas</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`
      : '<div style="color:var(--text-3);font-size:.85rem;padding:8px 0">Sin resultados.</div>';
  },

  async verAlumno(studentId) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-notas').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-notas').classList.add('active');
    document.getElementById('topbar-title').textContent = 'Calificaciones';

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
    el.innerHTML = `<div class="page-header"><h3>Calificaciones</h3></div><div class="loading">Cargando…</div>`;
    const a = this._alumnoActual;

    const { data: resultados } = await sb
      .from('exam_results')
      .select('*, exams(title, subject_id, subjects(name))')
      .eq('student_id', a.id)
      .neq('status', 'in_progress')
      .order('submitted_at', { ascending: false });

    const { data: manuales } = await sb
      .from('manual_grades')
      .select('*, manual_grade_items(title, fecha, tipo, subjects(name))')
      .eq('student_id', a.id)
      .order('updated_at', { ascending: false });

    const filasUnificadas = this._unificarNotas(resultados || [], manuales || []);

    const filas = filasUnificadas.map(f => `
      <tr>
        <td>${f.materia}</td>
        <td class="text-main">${f.titulo}</td>
        <td style="text-align:center;font-weight:700;color:${f.color}">${f.notaTexto}</td>
        <td>${f.estadoBadge}</td>
        <td>${f.fecha ? Utils.formatDate(f.fecha) : '—'}</td>
      </tr>`).join('');

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="PreceptorNotas.volverBuscador()">← Volver</button>
      <div class="page-header">
        <h3>${Utils.nombrePlanilla(a)}</h3>
        <button class="btn btn-ghost btn-sm" onclick="PreceptorNotas.descargarAlumno()">⬇ Descargar (CSV)</button>
      </div>
      <div style="font-size:.78rem;color:var(--text-3);margin-bottom:14px">DNI ${a.dni} · ${a.anio ? a.anio + '°' : ''} ${a.division || ''}</div>
      ${filasUnificadas.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Materia</th><th>Instancia</th><th style="text-align:center">Nota</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>${filas}</tbody>
          </table>
        </div>` : '<div class="empty-state"><div class="icon">📝</div><p>Sin calificaciones cargadas todavía.</p></div>'}`;

    this._resultadosActuales = filasUnificadas;
  },

  // Junta exam_results (exámenes de la app) + manual_grades (parciales en papel,
  // conceptos) en un mismo formato de fila, para mostrar y exportar todo junto.
  _unificarNotas(resultados, manuales) {
    const deExamenes = resultados.map(r => {
      const finalScore = r.professor_score ?? r.score;
      const grade = Math.round(finalScore / 10 * 10) / 10;
      return {
        materia: r.exams?.subjects?.name || '—',
        titulo: r.exams?.title || '—',
        origen: 'Examen (app)',
        notaTexto: String(grade),
        notaNumerica: grade,
        color: grade >= 6 ? 'var(--success)' : 'var(--danger)',
        estado: r.status,
        estadoBadge: r.status === 'confirmed'
          ? '<span class="badge badge-active">Confirmado</span>'
          : '<span class="badge badge-practice">⏳ Pendiente</span>',
        fecha: r.submitted_at,
      };
    });

    const deManuales = manuales
      .filter(n => n.score !== null || n.concepto !== null)
      .map(n => {
        const item = n.manual_grade_items;
        const esNumerica = item?.tipo === 'numerica';
        return {
          materia: item?.subjects?.name || '—',
          titulo: item?.title || '—',
          origen: 'Manual',
          notaTexto: esNumerica ? String(n.score) : (n.concepto || '—'),
          notaNumerica: esNumerica ? Number(n.score) : null,
          color: esNumerica ? (Number(n.score) >= 6 ? 'var(--success)' : 'var(--danger)') : 'var(--text-1)',
          estado: 'confirmed',
          estadoBadge: '<span class="badge badge-indigo">Manual</span>',
          fecha: item?.fecha ? item.fecha + 'T00:00:00' : n.updated_at,
        };
      });

    return [...deExamenes, ...deManuales].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  },

  descargarAlumno() {
    if (!this._alumnoActual) return;
    const a = this._alumnoActual;
    const filas = (this._resultadosActuales || []).map(f =>
      [Utils.nombrePlanilla(a), a.dni, f.materia, f.titulo, f.origen, f.notaTexto, f.estado, f.fecha || '']);
    Utils.descargarCsv(`notas_${a.dni}.csv`, ['Alumno', 'DNI', 'Materia', 'Instancia', 'Origen', 'Nota', 'Estado', 'Fecha'], filas);
  },

  // ── Exportaciones masivas (respetan los filtros de año/división/búsqueda) ──

  async descargarTodo() {
    const alumnos = await this._alumnosFiltradosDB();
    if (!alumnos.length) { Utils.toast('No hay alumnos para este filtro', 'error'); return; }

    const alumnoPorId = {};
    alumnos.forEach(a => { alumnoPorId[a.id] = a; });
    const alumnoIds = alumnos.map(a => a.id);

    const { data: resultados } = await sb
      .from('exam_results')
      .select('*, exams(title, subjects(name))')
      .in('student_id', alumnoIds)
      .neq('status', 'in_progress');

    const { data: manuales } = await sb
      .from('manual_grades')
      .select('*, manual_grade_items(title, fecha, tipo, subjects(name))')
      .in('student_id', alumnoIds);

    const unificadas = alumnoIds.flatMap(id => this._unificarNotas(
      (resultados || []).filter(r => r.student_id === id),
      (manuales || []).filter(n => n.student_id === id),
    ).map(f => ({ ...f, studentId: id })));

    if (!unificadas.length) { Utils.toast('No hay notas cargadas para este filtro', 'error'); return; }

    const filas = unificadas.map(f => {
      const a = alumnoPorId[f.studentId];
      const curso = a?.anio ? `${a.anio}°${a.division ? ' ' + a.division : ''}` : '';
      return [Utils.nombrePlanilla(a), a?.dni || '', curso, f.materia, f.titulo, f.origen, f.notaTexto, f.estado, f.fecha || ''];
    });

    Utils.descargarCsv('calificaciones.csv', ['Alumno', 'DNI', 'Curso', 'Materia', 'Instancia', 'Origen', 'Nota', 'Estado', 'Fecha'], filas);
  },

  _numeroALetras(n) {
    const PALABRAS = ['Cero', 'Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez'];
    const entero  = Math.floor(n);
    const decimal = Math.round((n - entero) * 10);
    const base = PALABRAS[entero] ?? String(entero);
    if (!decimal) return base;
    return `${base} con ${(PALABRAS[decimal] ?? String(decimal)).toLowerCase()}`;
  },

  async descargarActaPDF() {
    const alumnos = await this._alumnosFiltradosDB();
    if (!alumnos.length) { Utils.toast('No hay alumnos para este filtro', 'error'); return; }

    const alumnoPorId = {};
    alumnos.forEach(a => { alumnoPorId[a.id] = a; });
    const alumnoIds = alumnos.map(a => a.id);

    const { data: resultados } = await sb
      .from('exam_results')
      .select('*, exams(title, subjects(name))')
      .in('student_id', alumnoIds)
      .eq('status', 'confirmed');

    const { data: manuales } = await sb
      .from('manual_grades')
      .select('*, manual_grade_items(title, fecha, tipo, subjects(name))')
      .in('student_id', alumnoIds);

    const unificadas = alumnoIds.flatMap(id => this._unificarNotas(
      (resultados || []).filter(r => r.student_id === id),
      (manuales || []).filter(n => n.student_id === id),
    ).map(f => ({ ...f, studentId: id })));

    if (!unificadas.length) { Utils.toast('No hay notas confirmadas todavía para este filtro', 'error'); return; }

    const session = Auth.session();
    const { data: inst } = await sb.from('institutions').select('name').eq('id', session.inst).single();

    const porMateria = {};
    unificadas.forEach(f => {
      (porMateria[f.materia] = porMateria[f.materia] || []).push(f);
    });

    const filtroTxt = [
      this._filtroAnio ? `${this._filtroAnio}° año` : null,
      this._filtroDivision ? `División ${this._filtroDivision}` : null,
    ].filter(Boolean).join(' · ') || 'Todos los años y divisiones';

    const seccionesHtml = Object.entries(porMateria).sort(([a], [b]) => a.localeCompare(b)).map(([materia, filas]) => {
      const ordenadas = [...filas].sort((a, b) =>
        Utils.nombrePlanilla(alumnoPorId[a.studentId]).localeCompare(Utils.nombrePlanilla(alumnoPorId[b.studentId])));

      const rowsHtml = ordenadas.map((f, i) => {
        const a = alumnoPorId[f.studentId];
        const letras = f.notaNumerica !== null ? this._numeroALetras(f.notaNumerica) : f.notaTexto;
        return `<tr>
          <td>${i + 1}</td>
          <td>${Utils.nombrePlanilla(a)}</td>
          <td>${a?.dni || ''}</td>
          <td>${f.titulo} <span style="color:#888;font-size:.75em">(${f.origen})</span></td>
          <td style="text-align:center">${f.notaTexto}</td>
          <td>${letras}</td>
        </tr>`;
      }).join('');

      return `
        <h3 style="margin:22px 0 6px;font-size:.95rem">${materia}</h3>
        <table>
          <thead><tr><th>#</th><th>Apellido y Nombre</th><th>DNI</th><th>Instancia</th><th>Nota</th><th>Nota en letras</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Calificaciones — ${inst?.name || 'Institución'}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 36px; color: #111; }
        .header { text-align: center; margin-bottom: 18px; }
        .header h1 { font-size: 1.15rem; margin-bottom: 2px; }
        .header p { font-size: .85rem; color: #444; margin: 1px 0; }
        .meta { text-align: center; font-size: .85rem; margin: 14px 0 6px; border-top: 1px solid #999; border-bottom: 1px solid #999; padding: 8px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #999; padding: 5px 8px; font-size: .8rem; text-align: left; }
        th { background: #eee; }
        .firmas { display: flex; justify-content: center; margin-top: 70px; }
        .firma { width: 260px; text-align: center; font-size: .82rem; }
        .firma .linea { border-top: 1px solid #333; margin-bottom: 4px; padding-top: 4px; }
      </style></head><body>
        <div class="header">
          <h1>${inst?.name || 'Institución'}</h1>
          <p>Informe de calificaciones</p>
        </div>
        <div class="meta">${filtroTxt} · Emitido: ${Utils.formatDate(Utils.hoyLocal())}</div>
        ${seccionesHtml}
        <div class="firmas">
          <div class="firma"><div class="linea">&nbsp;</div>Firma y aclaración — Preceptoría</div>
        </div>
      </body></html>`);
    win.document.close();
    win.print();
  },
};
