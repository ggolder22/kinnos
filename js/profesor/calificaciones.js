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
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="ProfesorCalificaciones.abrirModal()">+ Nueva instancia</button>`;

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
              <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarActaDesdeLista('${i.id}')" title="Descargar acta en PDF">📄 PDF</button>
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

    const [{ data: roster }, { data: notas }] = await Promise.all([
      sb.from('student_subjects').select('students(id, full_name, first_name, last_name, dni)')
        .eq('subject_id', item.subject_id),
      sb.from('manual_grades').select('*').eq('item_id', itemId),
    ]);

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
        </tr>`;
    }).join('');

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ProfesorCalificaciones._volver()">← Volver</button>
      <div class="page-header">
        <h3>${item.title} <span style="font-size:.8rem;font-weight:400;color:var(--text-3)">(${item.tipo === 'numerica' ? 'numérica' : 'conceptual'}${item.fecha ? ' · ' + Utils.formatDate(item.fecha) : ''})</span></h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarCsv()">⬇ CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarActa()">📄 Acta (PDF)</button>
          <button class="btn btn-primary btn-sm" onclick="ProfesorCalificaciones.abrirCarga('${item.id}')">Cargar / editar</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Alumno</th><th>DNI</th><th>Nota</th><th>Observaciones</th></tr></thead>
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
        </tr>`;
    }).join('');

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ProfesorCalificaciones._volver()">← Volver</button>
      <div class="page-header">
        <h3>${item.title} <span style="font-size:.8rem;font-weight:400;color:var(--text-3)">(${item.tipo === 'numerica' ? 'numérica' : 'conceptual'}${item.fecha ? ' · ' + Utils.formatDate(item.fecha) : ''})</span></h3>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarCsv()">⬇ CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="ProfesorCalificaciones.exportarActa()">📄 Acta (PDF)</button>
          <button class="btn btn-primary btn-sm" id="calif-save-all" onclick="ProfesorCalificaciones.guardarTodas()">Guardar notas</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Alumno</th><th>DNI</th><th>Nota</th><th>Observaciones</th></tr></thead>
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

    if (!payload.length) { Utils.toast('No hay ninguna nota para guardar', 'error'); return; }

    Utils.btnLoading(btn, true);
    const { error } = await sb.from('manual_grades').upsert(payload, { onConflict: 'item_id,student_id' });
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(`${payload.length} notas guardadas`);
    this.abrirCarga(item.id);
  },

  // ── Exportaciones (desde la vista abierta) ────────────────

  exportarCsv() {
    this._exportarCsvDatos(this._itemActual, this._roster, this._notas);
  },

  exportarActa() {
    this._generarActaPDF(this._itemActual, this._roster, this._notas);
  },

  // ── Exportaciones directas desde la lista (sin entrar a la instancia) ──

  async exportarCsvDesdeLista(itemId) {
    const { item, roster, notas } = await this._fetchDatos(itemId);
    this._exportarCsvDatos(item, roster, notas);
  },

  async exportarActaDesdeLista(itemId) {
    const { item, roster, notas } = await this._fetchDatos(itemId);
    this._generarActaPDF(item, roster, notas);
  },

  _exportarCsvDatos(item, roster, notas) {
    const filas = roster.map(a => {
      const n = notas[a.id];
      return [Utils.nombrePlanilla(a), a.dni, n?.score ?? n?.concepto ?? '', n?.observaciones ?? ''];
    });
    Utils.descargarCsv(`${item.title.replace(/[^a-z0-9]+/gi, '_')}.csv`, ['Alumno', 'DNI', 'Nota', 'Observaciones'], filas);
  },

  _generarActaPDF(item, roster, notas) {
    const conNota = roster.filter(a => notas[a.id]);
    if (!conNota.length) { Utils.toast('Todavía no hay ninguna nota cargada en esta instancia', 'error'); return; }

    const m = ProfesorState.materia;
    const institucion = m.careers?.institutions?.name || '';
    const carrera     = m.careers?.name || '';
    const anioDiv = [m.year ? `${m.year}° año` : null, m.division ? `División ${m.division}` : null].filter(Boolean).join(' · ');

    const rowsHtml = conNota.map((a, i) => {
      const n = notas[a.id];
      const esNumerica = n.score !== null;
      const notaTexto = esNumerica ? n.score : (n.concepto || '—');
      const notaLetras = esNumerica ? Utils.numeroALetras(n.score) : (n.concepto || '—');
      return `<tr>
        <td>${i + 1}</td>
        <td>${Utils.nombrePlanilla(a)}</td>
        <td>${a.dni}</td>
        <td style="text-align:center">${notaTexto}</td>
        <td>${notaLetras}</td>
      </tr>`;
    }).join('');

    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Acta — ${item.title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 36px; color: #111; }
        .header { text-align: center; margin-bottom: 18px; }
        .header h1 { font-size: 1.15rem; margin-bottom: 2px; }
        .header p { font-size: .85rem; color: #444; margin: 1px 0; }
        .meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 6px; font-size: .85rem;
          margin: 18px 0 10px; border-top: 1px solid #999; border-bottom: 1px solid #999; padding: 8px 0; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { border: 1px solid #999; padding: 6px 10px; font-size: .85rem; text-align: left; }
        th { background: #eee; }
        .resumen { margin-top: 14px; font-size: .82rem; }
        .firmas { display: flex; justify-content: center; margin-top: 90px; }
        .firma { width: 260px; text-align: center; font-size: .82rem; }
        .firma .linea { border-top: 1px solid #333; margin-bottom: 4px; padding-top: 4px; }
      </style></head><body>
        <div class="header">
          <h1>${institucion || 'Institución'}</h1>
          ${carrera ? `<p>${carrera}</p>` : ''}
          <p>Acta de calificaciones${anioDiv ? ' — ' + anioDiv : ''}</p>
        </div>

        <div class="meta">
          <span>Materia: <strong>${m.name || ''}</strong></span>
          <span>Instancia: <strong>${item.title}</strong></span>
          <span>Fecha: ${item.fecha ? Utils.formatDate(item.fecha) : Utils.formatDate(Utils.hoyLocal())}</span>
        </div>

        <table>
          <thead><tr><th>#</th><th>Apellido y Nombre</th><th>DNI</th><th>Nota</th><th>Nota en letras</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>

        <div class="resumen">${conNota.length} alumno${conNota.length !== 1 ? 's' : ''} con nota cargada de ${roster.length} inscriptos.</div>

        <div class="firmas">
          <div class="firma"><div class="linea">&nbsp;</div>Firma y aclaración — Docente</div>
        </div>
      </body></html>`);
    win.document.close();
    win.print();
  },
};
