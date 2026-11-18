const ProfesorCalificaciones = {
  _items: [],
  _itemActual: null,   // instancia abierta (cargar o ver)
  _roster: [],          // alumnos inscriptos en la materia
  _notas: {},            // student_id -> fila de manual_grades (si existe)

  async init() {
    this._itemActual = null;
    await this._loadItems();
  },

  async _loadItems() {
    const el = document.getElementById('calificaciones-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: items, error } = await sb
      .from('manual_grade_items')
      .select('*')
      .eq('subject_id', ProfesorState.materia.id)
      .order('fecha', { ascending: false });

    if (error) { Utils.toast('Error al cargar calificaciones', 'error'); return; }

    const { count: totalAlumnos } = await sb
      .from('student_subjects')
      .select('*', { count: 'exact', head: true })
      .eq('subject_id', ProfesorState.materia.id);

    const itemIds = (items || []).map(i => i.id);
    let cargadas = {};
    if (itemIds.length) {
      const { data: notas } = await sb.from('manual_grades').select('item_id').in('item_id', itemIds);
      (notas || []).forEach(n => { cargadas[n.item_id] = (cargadas[n.item_id] || 0) + 1; });
    }

    this._items = items || [];
    this._renderLista(totalAlumnos || 0, cargadas);
  },

  _renderLista(totalAlumnos, cargadas) {
    const el = document.getElementById('calificaciones-content');
    const addBtn = `<div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarCondicion()" title="Listado de alumnos con su condición académica (PDF o Excel)">📋 Condición académica</button>
      <button class="btn btn-primary btn-sm" onclick="ProfesorCalificaciones.abrirModal()">+ Nueva instancia</button>
    </div>`;

    if (!this._items.length) {
      el.innerHTML = `
        <div class="page-header"><h3>Calificaciones</h3>${addBtn}</div>
        <p style="color:var(--text-3);font-size:.85rem;margin-bottom:16px">
          Cargá acá notas de parciales en papel, trabajos de cátedra o conceptos — sin necesidad de armar un examen en la app.
        </p>
        <div class="empty-state"><div class="icon">📋</div><p>No hay ninguna instancia de calificación cargada todavía.</p></div>`;
      return;
    }

    const rows = this._items.map(i => {
      const n = cargadas[i.id] || 0;
      const tipoLabel = i.tipo === 'numerica' ? 'Numérica (0–10)' : 'Conceptual';
      return `
        <tr>
          <td class="text-main">${i.title}</td>
          <td><span class="badge badge-inactive">${tipoLabel}</span></td>
          <td>${i.fecha ? Utils.formatDate(i.fecha) : '—'}</td>
          <td style="text-align:center">${n} / ${totalAlumnos}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.verNotas('${i.id}')">Ver</button>
              <button class="btn btn-primary btn-sm" onclick="ProfesorCalificaciones.abrirCarga('${i.id}')">Cargar notas</button>
              <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarCsvDesdeLista('${i.id}')" title="Descargar CSV">⬇ CSV</button>
              <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarActaDesdeLista('${i.id}')" title="Descargar acta (PDF o Excel)">📄 Acta</button>
              <button class="btn btn-ghost btn-sm" onclick='ProfesorCalificaciones.abrirModal(${JSON.stringify(i).replace(/'/g, "&#39;")})'>Editar</button>
              <button class="btn btn-danger btn-sm" onclick="ProfesorCalificaciones.eliminar('${i.id}','${i.title.replace(/'/g, "\\'")}')">Eliminar</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Calificaciones</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Instancia</th><th>Tipo</th><th>Fecha</th><th style="text-align:center">Cargadas</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  // ── Modal crear / editar instancia ──────────────────────────

  abrirModal(item = null) {
    document.getElementById('califmod-title').textContent      = item ? 'Editar instancia' : 'Nueva instancia de calificación';
    document.getElementById('califmod-id').value                = item?.id || '';
    document.getElementById('califmod-nombre').value             = item?.title || '';
    document.getElementById('califmod-tipo').value               = item?.tipo || 'numerica';
    document.getElementById('califmod-fecha').value              = item?.fecha || '';
    document.getElementById('calif-modal').classList.remove('hidden');
    document.getElementById('califmod-nombre').focus();
  },

  cerrarModal() {
    document.getElementById('calif-modal').classList.add('hidden');
  },

  async guardar() {
    const btn   = document.getElementById('califmod-save');
    const id    = document.getElementById('califmod-id').value;
    const title = document.getElementById('califmod-nombre').value.trim();
    const tipo  = document.getElementById('califmod-tipo').value;
    const fecha = document.getElementById('califmod-fecha').value || null;

    if (!title) { Utils.toast('Ponele un nombre a la instancia', 'error'); return; }

    Utils.btnLoading(btn, true);
    const payload = { title, tipo, fecha, subject_id: ProfesorState.materia.id };
    const { error } = id
      ? await sb.from('manual_grade_items').update(payload).eq('id', id)
      : await sb.from('manual_grade_items').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Instancia actualizada' : 'Instancia creada');
    this.cerrarModal();
    this._loadItems();
  },

  async eliminar(id, title) {
    if (!await Utils.confirmar(`¿Eliminar "${title}"? Se borran también todas las notas cargadas ahí.`)) return;
    const { error } = await sb.from('manual_grade_items').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Instancia eliminada');
    this._loadItems();
  },

  // ── Datos compartidos (carga, vista, CSV, PDF) ────────────

  async _fetchDatos(itemId) {
    const item = this._items.find(i => i.id === itemId) || (await sb.from('manual_grade_items').select('*').eq('id', itemId).single()).data;

    const [{ data: roster }, { data: notas }, cond] = await Promise.all([
      sb.from('student_subjects').select('students(id, full_name, first_name, last_name, dni)')
        .eq('subject_id', item.subject_id),
      sb.from('manual_grades').select('*').eq('item_id', itemId),
      sb.from('student_academic_conditions').select('student_id, condicion')
        .eq('subject_id', item.subject_id).eq('anio_academico', Actas.anioLectivo()),
    ]);

    // Condición académica (una por alumno y materia, vale para todas las instancias)
    this._condiciones = {};
    this._condicionesDisponibles = !cond.error;
    (cond.data || []).forEach(c => { this._condiciones[c.student_id] = c.condicion; });

    const rosterOrdenado = (roster || []).map(r => r.students).filter(Boolean)
      .sort((a, b) => Utils.nombrePlanilla(a).localeCompare(Utils.nombrePlanilla(b)));
    const notasPorAlumno = {};
    (notas || []).forEach(n => { notasPorAlumno[n.student_id] = n; });

    return { item, roster: rosterOrdenado, notas: notasPorAlumno };
  },

  // ── Ver (solo lectura) ─────────────────────────────────────

  async verNotas(itemId) {
    const el = document.getElementById('calificaciones-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { item, roster, notas } = await this._fetchDatos(itemId);
    this._itemActual = item; this._roster = roster; this._notas = notas;

    if (!roster.length) {
      el.innerHTML = `
        <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ProfesorCalificaciones._volver()">← Volver</button>
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos inscriptos en esta materia todavía.</p></div>`;
      return;
    }

    const rows = roster.map(a => {
      const n = notas[a.id];
      const nota = n?.score ?? n?.concepto ?? '—';
      return `
        <tr>
          <td class="text-main">${Utils.nombrePlanilla(a)}</td>
          <td>${a.dni}</td>
          <td style="font-weight:700">${nota}</td>
          <td style="color:var(--text-2)">${n?.observaciones || '—'}</td>
          <td>${this._condiciones[a.id] || '—'}</td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ProfesorCalificaciones._volver()">← Volver</button>
      <div class="page-header">
        <h3>${item.title} <span style="font-size:.8rem;font-weight:400;color:var(--text-3)">(${item.tipo === 'numerica' ? 'numérica' : 'conceptual'}${item.fecha ? ' · ' + Utils.formatDate(item.fecha) : ''})</span></h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarCsv()">⬇ CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarActa()">📄 Acta</button>
          <button class="btn btn-primary btn-sm" onclick="ProfesorCalificaciones.abrirCarga('${item.id}')">Cargar / editar</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Alumno</th><th>DNI</th><th>Nota</th><th>Observaciones</th><th>Condición</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  // ── Carga de notas por alumno ─────────────────────────────

  async abrirCarga(itemId) {
    const el = document.getElementById('calificaciones-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { item, roster, notas } = await this._fetchDatos(itemId);
    this._itemActual = item; this._roster = roster; this._notas = notas;
    this._renderCarga();
  },

  _renderCarga() {
    const el = document.getElementById('calificaciones-content');
    const item = this._itemActual;
    const esNumerica = item.tipo === 'numerica';

    if (!this._roster.length) {
      el.innerHTML = `
        <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ProfesorCalificaciones._volver()">← Volver</button>
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos inscriptos en esta materia todavía.</p></div>`;
      return;
    }

    const CONCEPTOS = ['Muy Bueno', 'Bueno', 'Regular', 'Insuficiente'];

    const rows = this._roster.map(a => {
      const nota = this._notas[a.id];
      const campoNota = esNumerica
        ? `<input type="number" min="0" max="10" step="0.1" id="nota-${a.id}" value="${nota?.score ?? ''}" placeholder="—" style="width:90px">`
        : `<select id="nota-${a.id}" style="width:auto">
             <option value="">—</option>
             ${CONCEPTOS.map(c => `<option value="${c}" ${nota?.concepto === c ? 'selected' : ''}>${c}</option>`).join('')}
           </select>`;
      return `
        <tr>
          <td class="text-main">${Utils.nombrePlanilla(a)}</td>
          <td>${a.dni}</td>
          <td>${campoNota}</td>
          <td><input type="text" id="obs-${a.id}" value="${nota?.observaciones ? nota.observaciones.replace(/"/g, '&quot;') : ''}" placeholder="Observaciones (opcional)" style="width:100%"></td>
          <td>
            <select id="cond-${a.id}" style="width:auto" ${this._condicionesDisponibles ? '' : 'disabled title="Falta correr sql/condicion-academica-alumno.sql en Supabase"'}>
              <option value="">—</option>
              ${Actas.CONDICIONES.map(c => `<option value="${c}" ${this._condiciones[a.id] === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ProfesorCalificaciones._volver()">← Volver</button>
      <div class="page-header">
        <h3>${item.title} <span style="font-size:.8rem;font-weight:400;color:var(--text-3)">(${item.tipo === 'numerica' ? 'numérica' : 'conceptual'}${item.fecha ? ' · ' + Utils.formatDate(item.fecha) : ''})</span></h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarCsv()">⬇ CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarActa()">📄 Acta</button>
          <button class="btn btn-primary btn-sm" id="calif-save-all" onclick="ProfesorCalificaciones.guardarTodas()">Guardar notas</button>
        </div>
      </div>
      <p style="font-size:.78rem;color:var(--text-3);margin:-4px 0 10px">
        La <strong>condición académica</strong> (Regular / Promocional / Libre) es una por alumno para toda la materia:
        se guarda con el botón "Guardar notas" y se usa en el listado de condición y para filtrar las actas.
      </p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Alumno</th><th>DNI</th><th>Nota</th><th>Observaciones</th><th>Condición</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  _volver() {
    this._itemActual = null;
    this._loadItems();
  },

  async guardarTodas() {
    const btn = document.getElementById('calif-save-all');
    const item = this._itemActual;
    const esNumerica = item.tipo === 'numerica';

    const payload = this._roster.map(a => {
      const rawNota = document.getElementById(`nota-${a.id}`).value;
      const obs = document.getElementById(`obs-${a.id}`).value.trim();
      return {
        item_id: item.id,
        student_id: a.id,
        score: esNumerica ? (rawNota === '' ? null : parseFloat(rawNota)) : null,
        concepto: esNumerica ? null : (rawNota || null),
        observaciones: obs || null,
        updated_at: new Date().toISOString(),
      };
    }).filter(r => r.score !== null || r.concepto !== null || r.observaciones !== null);

    // Condición académica: se guarda la que esté elegida y se borra la que se dejó en "—"
    const condUpsert = [], condBorrar = [];
    if (this._condicionesDisponibles) {
      this._roster.forEach(a => {
        const v = document.getElementById(`cond-${a.id}`)?.value || '';
        if (v && v !== this._condiciones[a.id]) {
          condUpsert.push({
            subject_id: item.subject_id, student_id: a.id, anio_academico: Actas.anioLectivo(),
            condicion: v, updated_at: new Date().toISOString(),
          });
        } else if (!v && this._condiciones[a.id]) {
          condBorrar.push(a.id);
        }
      });
    }

    if (!payload.length && !condUpsert.length && !condBorrar.length) {
      Utils.toast('No hay ninguna nota para guardar', 'error'); return;
    }

    Utils.btnLoading(btn, true);
    const errores = [];
    if (payload.length) {
      const { error } = await sb.from('manual_grades').upsert(payload, { onConflict: 'item_id,student_id' });
      if (error) errores.push(error.message);
    }
    if (condUpsert.length) {
      const { error } = await sb.from('student_academic_conditions')
        .upsert(condUpsert, { onConflict: 'subject_id,student_id,anio_academico' });
      if (error) errores.push('condición: ' + error.message);
    }
    if (condBorrar.length) {
      const { error } = await sb.from('student_academic_conditions').delete()
        .eq('subject_id', item.subject_id).eq('anio_academico', Actas.anioLectivo()).in('student_id', condBorrar);
      if (error) errores.push('condición: ' + error.message);
    }
    Utils.btnLoading(btn, false);

    if (errores.length) { Utils.toast('Error al guardar: ' + errores.join(' · '), 'error'); return; }
    const cambiosCond = condUpsert.length + condBorrar.length;
    Utils.toast([
      payload.length ? `${payload.length} notas guardadas` : null,
      cambiosCond ? `${cambiosCond} condición${cambiosCond !== 1 ? 'es' : ''} actualizada${cambiosCond !== 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(' · '));
    this.abrirCarga(item.id);
  },

  // ── Exportaciones (desde la vista abierta) ────────────────

  exportarCsv() {
    this._exportarCsvDatos(this._itemActual, this._roster, this._notas);
  },

  exportarActa() {
    this.exportarActaDesdeLista(this._itemActual.id);
  },

  // ── Exportaciones directas desde la lista (sin entrar a la instancia) ──

  async exportarCsvDesdeLista(itemId) {
    const { item, roster, notas } = await this._fetchDatos(itemId);
    this._exportarCsvDatos(item, roster, notas);
  },

  // Acta oficial (formato modelo_actas) — se elige qué alumnos y PDF/Excel
  exportarActaDesdeLista(itemId) {
    const item = this._items.find(i => i.id === itemId) || this._itemActual;
    Actas.elegir({
      titulo: 'Descargar acta',
      descripcion: item ? `Instancia: ${item.title}` : '',
      onDescargar: (formato, filtro, win) => Actas.descargarActaExamen({
        subjectId: ProfesorState.materia.id,
        instancia: { tipo: 'manual', id: itemId },
        filtro, formato, win,
      }),
    });
  },

  // Listado de condición académica de la materia
  exportarCondicion() {
    Actas.elegir({
      titulo: 'Condición académica',
      descripcion: `${ProfesorState.materia.name} — listado de alumnos con su condición`,
      onDescargar: (formato, filtro, win) => Actas.descargarCondicion({
        subjectId: ProfesorState.materia.id, filtro, formato, win,
      }),
    });
  },

  _exportarCsvDatos(item, roster, notas) {
    const filas = roster.map(a => {
      const n = notas[a.id];
      return [Utils.nombrePlanilla(a), a.dni, n?.score ?? n?.concepto ?? '', n?.observaciones ?? ''];
    });
    Utils.descargarCsv(`${item.title.replace(/[^a-z0-9]+/gi, '_')}.csv`, ['Alumno', 'DNI', 'Nota', 'Observaciones'], filas);
  },
};
