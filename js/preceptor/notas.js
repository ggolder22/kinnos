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
          <button class="btn btn-ghost btn-sm" onclick="PreceptorNotas.descargarActaPDF()">📄 Actas / Condición</button>
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

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="PreceptorNotas.volverBuscador()">← Volver</button>
      <div class="page-header">
        <h3>${Utils.nombrePlanilla(a)}</h3>
        <button class="btn btn-ghost btn-sm" onclick="PreceptorNotas.descargarAlumno()">⬇ Descargar (CSV)</button>
      </div>
      <div style="font-size:.78rem;color:var(--text-3);margin-bottom:14px">DNI ${a.dni} · ${a.anio ? a.anio + '°' : ''} ${a.division || ''}</div>
      ${this._renderPorMateria(filasUnificadas)}`;

    this._resultadosActuales = filasUnificadas;
  },

  // Agrupa las notas por materia — una tarjeta por materia, con su promedio
  // (de las notas numéricas) y el detalle de cada instancia adentro.
  _renderPorMateria(filasUnificadas) {
    if (!filasUnificadas.length) {
      return '<div class="empty-state"><div class="icon">📝</div><p>Sin calificaciones cargadas todavía.</p></div>';
    }

    const porMateria = {};
    filasUnificadas.forEach(f => { (porMateria[f.materia] = porMateria[f.materia] || []).push(f); });

    const grupos = Object.entries(porMateria).map(([materia, filas]) => {
      const numericas = filas.map(f => f.notaNumerica).filter(n => n !== null && n !== undefined);
      const promedio = numericas.length ? Math.round(numericas.reduce((a, b) => a + b, 0) / numericas.length * 10) / 10 : null;
      return { materia, filas: filas.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')), promedio };
    }).sort((a, b) => (a.promedio ?? 11) - (b.promedio ?? 11)); // peor promedio primero, sin nota numérica al final

    return `
      <div style="display:flex;flex-direction:column;gap:14px">
        ${grupos.map(g => {
          const colorProm = g.promedio === null ? 'var(--text-3)' : (g.promedio >= 6 ? 'var(--success)' : 'var(--danger)');
          const filasHtml = g.filas.map(f => `
            <tr>
              <td class="text-main">${f.titulo}</td>
              <td style="text-align:center;font-weight:700;color:${f.color}">${f.notaTexto}</td>
              <td>${f.estadoBadge}</td>
              <td>${f.fecha ? Utils.formatDate(f.fecha) : '—'}</td>
            </tr>`).join('');

          return `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px 18px">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
                <div style="font-weight:600;color:var(--text-1)">${g.materia}</div>
                <div style="font-size:.78rem;color:var(--text-3)">
                  ${g.promedio !== null ? `Promedio: <strong style="color:${colorProm};font-size:.95rem">${g.promedio}</strong>` : 'Sin notas numéricas'}
                </div>
              </div>
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Instancia</th><th style="text-align:center">Nota</th><th>Estado</th><th>Fecha</th></tr></thead>
                  <tbody>${filasHtml}</tbody>
                </table>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  },

  // Junta exam_results (exámenes de la app) + manual_grades (parciales en papel,
  // conceptos) en un mismo formato de fila, para mostrar y exportar todo junto.
  _unificarNotas(resultados, manuales) {
    const deExamenes = resultados.map(r => {
      const { score: grade } = Utils.notaFinal(r);
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
        const tieneScore = n.score !== null;
        return {
          materia: item?.subjects?.name || '—',
          titulo: item?.title || '—',
          origen: 'Manual',
          notaTexto: tieneScore ? String(n.score) : (n.concepto || '—'),
          notaNumerica: tieneScore ? Number(n.score) : null,
          color: tieneScore ? (Number(n.score) >= 6 ? 'var(--success)' : 'var(--danger)') : 'var(--text-3)',
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

  // Actas oficiales (formato modelo_actas): el preceptor elige materia y
  // documento (acta de una instancia, o listado de condición académica).
  // Las materias se acotan por el filtro de año/división de la pantalla.
  async descargarActaPDF() {
    const session = Auth.session();
    let q = sb.from('subjects').select('id, name, year, division, careers!inner(institution_id)')
      .eq('careers.institution_id', session.inst);
    if (this._filtroAnio)     q = q.eq('year', parseInt(this._filtroAnio));
    if (this._filtroDivision) q = q.or(`division.eq.${this._filtroDivision},division.is.null`);
    const { data: materias, error } = await q;
    if (error) { Utils.toast('Error al cargar materias: ' + error.message, 'error'); return; }
    if (!materias?.length) { Utils.toast('No hay materias para este año/división', 'error'); return; }

    materias.sort((a, b) => (a.year || 0) - (b.year || 0) || a.name.localeCompare(b.name));
    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

    Actas.elegir({
      titulo: 'Actas y condición académica',
      extraHtml: `
        <div class="form-group">
          <label>Materia</label>
          <select id="acta-prec-materia" onchange="PreceptorNotas._actaCargarInstancias()">
            ${materias.map(m => `<option value="${m.id}">${m.year ? m.year + '° ' : ''}${m.division ? m.division + ' — ' : ''}${esc(m.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Documento</label>
          <select id="acta-prec-doc" onchange="PreceptorNotas._actaCargarInstancias()">
            <option value="acta">Acta de examen</option>
            <option value="condicion">Listado de condición académica</option>
          </select>
        </div>
        <div class="form-group" id="acta-prec-inst-wrap">
          <label>Instancia (examen / calificación)</label>
          <select id="acta-prec-inst"><option value="">Cargando…</option></select>
        </div>`,
      onDescargar: (formato, filtro, win) => {
        const subjectId = document.getElementById('acta-prec-materia').value;
        if (document.getElementById('acta-prec-doc').value === 'condicion') {
          return Actas.descargarCondicion({ subjectId, filtro, formato, win });
        }
        const inst = document.getElementById('acta-prec-inst').value;
        if (!inst) { Utils.toast('Esta materia no tiene exámenes ni calificaciones cargadas', 'error'); return false; }
        const [tipo, id] = inst.split(':');
        return Actas.descargarActaExamen({ subjectId, instancia: { tipo, id }, filtro, formato, win });
      },
    });
    this._actaCargarInstancias();
  },

  async _actaCargarInstancias() {
    const wrap = document.getElementById('acta-prec-inst-wrap');
    const sel  = document.getElementById('acta-prec-inst');
    if (!wrap || !sel) return;
    const esActa = document.getElementById('acta-prec-doc').value === 'acta';
    wrap.style.display = esActa ? '' : 'none';
    if (!esActa) return;

    const subjectId = document.getElementById('acta-prec-materia').value;
    sel.innerHTML = '<option value="">Cargando…</option>';
    const [{ data: items }, { data: exams }] = await Promise.all([
      sb.from('manual_grade_items').select('id, title, fecha').eq('subject_id', subjectId).order('fecha', { ascending: false }),
      sb.from('exams').select('id, title, is_practice').eq('subject_id', subjectId),
    ]);
    if (document.getElementById('acta-prec-materia')?.value !== subjectId) return; // cambió mientras cargaba

    const esc = t => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const opts = [
      ...(exams || []).filter(e => !e.is_practice).map(e => `<option value="examen:${e.id}">Examen: ${esc(e.title)}</option>`),
      ...(items || []).map(i => `<option value="manual:${i.id}">${esc(i.title)}${i.fecha ? ' (' + Utils.formatDate(i.fecha) + ')' : ''}</option>`),
    ];
    sel.innerHTML = opts.length ? opts.join('') : '<option value="">Sin exámenes ni calificaciones cargadas</option>';
  },
};
