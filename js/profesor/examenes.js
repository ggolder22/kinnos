const ProfesorExamenes = {
  _examActual: null,    // { id, title } del examen abierto en preguntas/resultados
  _revisionData: null,  // { resultado, preguntas } de la revisión en curso
  _importData: null,    // datos parseados del archivo importado

  // ── Lista principal ──────────────────────────────────────

  async init() {
    const el = document.getElementById('examenes-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('exams')
      .select('*, exam_questions(count)')
      .eq('subject_id', ProfesorState.materia.id)
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar exámenes', 'error'); return; }

    // Cargar conteo de resultados pendientes por examen
    const examIds = (data || []).map(e => e.id);
    let pendientes = {};
    if (examIds.length) {
      const { data: res } = await sb
        .from('exam_results')
        .select('exam_id, status')
        .in('exam_id', examIds)
        .eq('status', 'submitted');
      (res || []).forEach(r => {
        pendientes[r.exam_id] = (pendientes[r.exam_id] || 0) + 1;
      });
    }

    this._render(data || [], pendientes);
  },

  _render(data, pendientes = {}) {
    const el  = document.getElementById('examenes-content');
    const addBtn = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="ProfesorExamenes.importarDesdeArchivo()" title="Importar desde PDF o Word con formato Kinnos">
          📥 Importar desde archivo
        </button>
        <button class="btn btn-primary btn-sm" onclick="ProfesorExamenes.openModal()">+ Nuevo examen</button>
      </div>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Exámenes</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">📝</div><p>No hay exámenes creados.</p></div>`;
      return;
    }

    const rows = data.map(e => {
      const cantPreg  = e.exam_questions?.[0]?.count ?? 0;
      const pend      = pendientes[e.id] || 0;
      const estadoBadge = e.is_practice
        ? '<span class="badge badge-practice">Práctica</span>'
        : e.is_active
          ? '<span class="badge badge-active">Activo</span>'
          : '<span class="badge badge-inactive">Inactivo</span>';
      const pendBadge = pend > 0
        ? `<span class="badge badge-practice" style="font-size:.65rem;margin-left:6px">${pend} para revisar</span>`
        : '';

      return `
        <tr>
          <td class="text-main">${e.title}</td>
          <td>${estadoBadge}</td>
          <td style="text-align:center">${cantPreg}</td>
          <td>${e.time_limit ? `${e.time_limit} min` : '—'}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-ghost btn-sm" onclick="ProfesorExamenes.verPreguntas('${e.id}','${e.title.replace(/'/g,"\\'")}')">Preguntas</button>
              <button class="btn btn-ghost btn-sm" onclick="ProfesorExamenes.verResultados('${e.id}','${e.title.replace(/'/g,"\\'")}')">
                Resultados${pendBadge}
              </button>
              ${!e.is_practice
                ? `<button class="btn ${e.is_active ? 'btn-ghost' : 'btn-ghost'} btn-sm" onclick="ProfesorExamenes.toggleActivo('${e.id}',${e.is_active})">
                    ${e.is_active ? 'Desactivar' : 'Activar'}
                   </button>`
                : ''}
              <button class="btn btn-ghost btn-sm" onclick="ProfesorExamenes.openModal(${JSON.stringify(e).replace(/"/g,'&quot;')})">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="ProfesorExamenes.delete('${e.id}','${e.title.replace(/'/g,"\\'")}')">Eliminar</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Exámenes</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Título</th><th>Estado</th><th style="text-align:center">Preguntas</th><th>Tiempo</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  // ── Modal crear / editar examen ──────────────────────────

  openModal(item = null) {
    document.getElementById('exam-modal-title').textContent = item ? 'Editar examen' : 'Nuevo examen';
    document.getElementById('exam-modal-id').value          = item?.id           || '';
    document.getElementById('exam-modal-nombre').value      = item?.title        || '';
    document.getElementById('exam-modal-tiempo').value      = item?.time_limit   || '';
    document.getElementById('exam-modal-instruc').value     = item?.instructions || '';
    document.getElementById('exam-modal-practica').checked  = item?.is_practice  || false;
    document.getElementById('exam-modal-pdf-file').value    = '';

    const pdfActual = document.getElementById('exam-pdf-actual');
    if (item?.pdf_url) {
      pdfActual.style.display = 'flex';
      document.getElementById('exam-pdf-link').href          = item.pdf_url;
      document.getElementById('exam-pdf-nombre').textContent = this._nombreArchivo(item.pdf_url);
    } else {
      pdfActual.style.display = 'none';
    }

    this._toggleTiempo();
    document.getElementById('exam-modal').classList.remove('hidden');
    document.getElementById('exam-modal-nombre').focus();
  },

  closeModal() {
    document.getElementById('exam-modal').classList.add('hidden');
  },

  _toggleTiempo() {
    const esPractica = document.getElementById('exam-modal-practica').checked;
    document.getElementById('exam-tiempo-row').style.display = esPractica ? 'none' : '';
  },

  async save() {
    const btn        = document.getElementById('exam-modal-save');
    const id         = document.getElementById('exam-modal-id').value;
    const title      = document.getElementById('exam-modal-nombre').value.trim();
    const time_limit = parseInt(document.getElementById('exam-modal-tiempo').value) || null;
    const instruc    = document.getElementById('exam-modal-instruc').value.trim();
    const is_practice = document.getElementById('exam-modal-practica').checked;
    const fileInput  = document.getElementById('exam-modal-pdf-file');
    const file       = fileInput.files[0];

    if (!title) { Utils.toast('El título es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);

    let pdf_url;
    if (file) {
      const ext  = file.name.split('.').pop();
      const path = `exams/${ProfesorState.materia.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('materiales')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) {
        Utils.btnLoading(btn, false);
        Utils.toast('Error al subir PDF: ' + uploadError.message, 'error');
        return;
      }
      const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(uploadData.path);
      pdf_url = publicUrl;
    }

    const payload = {
      title,
      time_limit: is_practice ? null : time_limit,
      instructions: instruc || null,
      is_practice,
      subject_id: ProfesorState.materia.id,
      ...(pdf_url ? { pdf_url } : {}),
    };

    const { error } = id
      ? await sb.from('exams').update(payload).eq('id', id)
      : await sb.from('exams').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Examen actualizado' : 'Examen creado');
    this.closeModal();
    this.init();
  },

  async toggleActivo(id, current) {
    const { error } = await sb.from('exams').update({ is_active: !current }).eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(current ? 'Examen desactivado' : 'Examen activado');
    this.init();
  },

  async delete(id, title) {
    if (!await Utils.confirmar(`¿Eliminar el examen "${title}"? Se borrarán también preguntas y resultados.`)) return;
    const { error } = await sb.from('exams').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Examen eliminado');
    this.init();
  },

  // ── Panel de preguntas ────────────────────────────────────

  async verPreguntas(examId, examTitle) {
    this._examActual = { id: examId, title: examTitle };
    document.getElementById('exam-pregs-title').textContent = `Preguntas — ${examTitle}`;
    document.getElementById('exam-pregs-modal').classList.remove('hidden');
    document.getElementById('exampreg-form').classList.add('hidden');
    await this._loadPreguntas();
  },

  cerrarPreguntas() {
    document.getElementById('exam-pregs-modal').classList.add('hidden');
  },

  async _loadPreguntas() {
    const el = document.getElementById('exam-pregs-body');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: preguntas } = await sb
      .from('exam_questions')
      .select('*')
      .eq('exam_id', this._examActual.id)
      .order('order_num');

    this._renderPreguntas(preguntas || []);
  },

  _renderPreguntas(preguntas) {
    const el = document.getElementById('exam-pregs-body');
    const typeLabel = { multiple: 'Múltiple', truefalse: 'V / F', short: 'Corta' };

    const rows = preguntas.map(p => {
      const truncated = p.question_text.length > 90
        ? p.question_text.slice(0, 90) + '…' : p.question_text;
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.68rem;font-weight:700;color:var(--text-3);min-width:22px;padding-top:2px">#${p.order_num}</span>
          <div style="flex:1;min-width:0">
            <div style="margin-bottom:3px">
              <span class="badge badge-inactive" style="font-size:.65rem">${typeLabel[p.type] || p.type}</span>
              <span style="font-size:.72rem;color:var(--accent);margin-left:6px">${p.points} pt${p.points != 1 ? 's' : ''}</span>
            </div>
            <div style="font-size:.85rem;color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${truncated}</div>
            <div style="font-size:.73rem;color:var(--text-3);margin-top:2px">Correcta: <strong>${p.correct_answer}</strong></div>
          </div>
          <button class="btn btn-danger btn-sm" style="flex-shrink:0" onclick="ProfesorExamenes.eliminarPregunta('${p.id}')">✕</button>
        </div>`;
    }).join('');

    const totalPts = preguntas.reduce((s, p) => s + (Number(p.points) || 0), 0);

    el.innerHTML = preguntas.length
      ? `<div style="font-size:.73rem;color:var(--text-3);margin-bottom:8px;text-align:right">${preguntas.length} pregunta${preguntas.length !== 1 ? 's' : ''} · ${totalPts} puntos en total</div>${rows}`
      : `<div style="padding:24px;text-align:center;color:var(--text-3);font-size:.85rem">No hay preguntas. Agregá la primera.</div>`;
  },

  abrirPreguntaForm() {
    const f = document.getElementById('exampreg-form');
    f.classList.remove('hidden');
    document.getElementById('exampreg-type').value     = 'multiple';
    document.getElementById('exampreg-texto').value    = '';
    document.getElementById('exampreg-correcta').value = '';
    document.getElementById('exampreg-points').value   = '1';
    document.getElementById('exampreg-opciones').value = '';
    this._togglePregType();
    document.getElementById('exampreg-texto').focus();
  },

  _togglePregType() {
    const type = document.getElementById('exampreg-type').value;
    document.getElementById('exampreg-opciones-row').style.display = type === 'multiple'  ? '' : 'none';
    document.getElementById('exampreg-vf-hint').style.display      = type === 'truefalse' ? '' : 'none';
    document.getElementById('exampreg-short-hint').style.display   = type === 'short'     ? '' : 'none';
  },

  async guardarPregunta() {
    const btn      = document.getElementById('exampreg-save');
    const type     = document.getElementById('exampreg-type').value;
    const texto    = document.getElementById('exampreg-texto').value.trim();
    const correcta = document.getElementById('exampreg-correcta').value.trim();
    const points   = parseFloat(document.getElementById('exampreg-points').value.replace(',', '.')) || 1;

    if (!texto)    { Utils.toast('El enunciado es obligatorio', 'error'); return; }
    if (!correcta) { Utils.toast('La respuesta correcta es obligatoria', 'error'); return; }

    const { count } = await sb.from('exam_questions')
      .select('*', { count: 'exact', head: true })
      .eq('exam_id', this._examActual.id);

    const payload = {
      exam_id: this._examActual.id,
      order_num: (count || 0) + 1,
      type, question_text: texto, correct_answer: correcta, points,
    };

    if (type === 'multiple') {
      const opts = document.getElementById('exampreg-opciones').value
        .split('\n').map(s => s.trim()).filter(Boolean);
      if (opts.length < 2) { Utils.toast('Ingresá al menos 2 opciones', 'error'); return; }
      payload.options = opts;
    }

    Utils.btnLoading(btn, true);
    const { error } = await sb.from('exam_questions').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Pregunta agregada');
    document.getElementById('exampreg-form').classList.add('hidden');
    this._loadPreguntas();
  },

  async eliminarPregunta(id) {
    if (!await Utils.confirmar('¿Eliminar esta pregunta?')) return;
    const { error } = await sb.from('exam_questions').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Pregunta eliminada');
    this._loadPreguntas();
  },

  // ── Panel de resultados ───────────────────────────────────

  async verResultados(examId, examTitle) {
    this._examActual   = { id: examId, title: examTitle };
    this._revisionData = null;
    document.getElementById('exam-res-title').textContent = `Resultados — ${examTitle}`;
    document.getElementById('exam-res-modal').classList.remove('hidden');
    document.getElementById('exam-revision-view').classList.add('hidden');
    document.getElementById('exam-res-list').classList.remove('hidden');
    await this._loadResultados();
  },

  cerrarResultados() {
    document.getElementById('exam-res-modal').classList.add('hidden');
  },

  async _loadResultados() {
    const el = document.getElementById('exam-res-body');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: resultados } = await sb
      .from('exam_results')
      .select('*, students(full_name)')
      .eq('exam_id', this._examActual.id)
      .neq('status', 'in_progress')
      .order('submitted_at', { ascending: false });

    if (!resultados?.length) {
      el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-3);font-size:.85rem">
        Ningún alumno ha enviado el examen todavía.
      </div>`;
      return;
    }

    const rows = resultados.map(r => {
      const nombre     = r.students?.full_name || 'Alumno';
      const finalScore = r.professor_score ?? r.score;
      const grade      = Math.round(finalScore / 10 * 10) / 10;
      const color      = grade >= 6 ? 'var(--success)' : 'var(--danger)';

      const statusBadge = r.status === 'confirmed'
        ? '<span class="badge badge-active" style="font-size:.65rem">Confirmado</span>'
        : '<span class="badge badge-practice" style="font-size:.65rem">⏳ Pendiente</span>';

      return `
        <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.875rem;font-weight:500;color:var(--text-1);margin-bottom:2px">${nombre}</div>
            <div style="font-size:.73rem;color:var(--text-3)">${statusBadge}&nbsp;&nbsp;Enviado: ${Utils.formatDate(r.submitted_at)}</div>
          </div>
          <div style="text-align:right;min-width:60px">
            <span style="font-size:1.1rem;font-weight:700;color:${color}">${grade}</span>
            <span style="font-size:.73rem;color:var(--text-3)">/10</span>
          </div>
          <button class="btn ${r.status === 'confirmed' ? 'btn-ghost' : 'btn-primary'} btn-sm"
            onclick="ProfesorExamenes.abrirRevision('${r.id}')">
            ${r.status === 'confirmed' ? 'Ver' : 'Revisar'}
          </button>
        </div>`;
    }).join('');

    el.innerHTML = rows;
  },

  // ── Revisión individual ───────────────────────────────────

  async abrirRevision(resultId) {
    document.getElementById('exam-res-list').classList.add('hidden');
    const revView = document.getElementById('exam-revision-view');
    revView.classList.remove('hidden');
    revView.innerHTML = '<div class="loading" style="padding:40px;text-align:center">Cargando…</div>';

    const { data: resultado } = await sb
      .from('exam_results')
      .select('*, students(full_name, dni)')
      .eq('id', resultId)
      .single();

    const { data: preguntas } = await sb
      .from('exam_questions')
      .select('*')
      .eq('exam_id', resultado.exam_id)
      .order('order_num');

    this._revisionData = { resultado, preguntas: preguntas || [] };
    this._renderRevision();
  },

  _calcAutoGrade() {
    const { resultado, preguntas } = this._revisionData;
    const adj     = resultado.professor_adjustments || {};
    const answers = resultado.answers || {};
    let autoScore = 0, totalPts = 0;

    for (const p of preguntas) {
      totalPts += Number(p.points) || 0;
      let isCorrect;
      if (p.id in adj) {
        isCorrect = adj[p.id];
      } else if (p.type === 'short') {
        isCorrect = (answers[p.id] || '').trim().toLowerCase() === p.correct_answer.trim().toLowerCase();
      } else {
        isCorrect = (answers[p.id] || '') === p.correct_answer;
      }
      if (isCorrect) autoScore += Number(p.points) || 0;
    }

    return totalPts > 0 ? Math.round(autoScore / totalPts * 100) : 0;
  },

  _renderRevision() {
    const { resultado, preguntas } = this._revisionData;
    const el = document.getElementById('exam-revision-view');

    // Preserve nota manually typed by professor during current session
    const existingInput = document.getElementById('rev-nota-final');
    const preservedNota = existingInput ? existingInput.value : null;

    const adj      = resultado.professor_adjustments || {};
    const answers  = resultado.answers || {};
    const autoGrade = this._calcAutoGrade();
    const finalScore = preservedNota !== null
      ? parseInt(preservedNota) || 0
      : (resultado.professor_score ?? autoGrade);
    const grade  = Math.round(finalScore / 10 * 10) / 10;
    const color  = grade >= 6 ? 'var(--success)' : 'var(--danger)';
    const nombre = resultado.students?.full_name || 'Alumno';
    const dniStr = resultado.students?.dni ? ` · DNI ${resultado.students.dni}` : '';

    const typeLabel = { multiple: 'M', truefalse: 'V/F', short: 'Corta' };

    const qRows = preguntas.map(p => {
      const studentAns = answers[p.id] ?? '—';
      let isCorrect;
      if (p.id in adj) {
        isCorrect = adj[p.id];
      } else if (p.type === 'short') {
        isCorrect = studentAns !== '—' && studentAns.trim().toLowerCase() === p.correct_answer.trim().toLowerCase();
      } else {
        isCorrect = studentAns === p.correct_answer;
      }

      const icon   = isCorrect ? '✓' : '✗';
      const iColor = isCorrect ? 'var(--success)' : 'var(--danger)';
      const bg     = isCorrect ? 'rgba(34,197,94,.07)' : 'rgba(239,68,68,.07)';
      const border = isCorrect ? 'var(--success)' : 'var(--danger)';

      return `
        <div style="background:${bg};border-left:3px solid ${border};padding:11px 14px;border-radius:0 7px 7px 0;margin-bottom:9px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div style="flex:1">
              <div style="font-size:.68rem;font-weight:700;color:var(--text-3);margin-bottom:4px">
                #${p.order_num} · ${typeLabel[p.type] || p.type} · ${p.points} pt
              </div>
              <div style="font-size:.85rem;color:var(--text-1);margin-bottom:8px">${p.question_text}</div>
              <div style="display:flex;gap:18px;flex-wrap:wrap;font-size:.8rem">
                <div><span style="color:var(--text-3)">Alumno: </span><strong>${studentAns}</strong></div>
                <div><span style="color:var(--text-3)">Correcta: </span><strong style="color:var(--accent)">${p.correct_answer}</strong></div>
              </div>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:5px;flex-shrink:0">
              <span style="font-size:1.15rem;font-weight:700;color:${iColor}">${icon}</span>
              <button class="btn btn-ghost btn-sm" style="font-size:.68rem;padding:3px 8px"
                onclick="ProfesorExamenes._toggleRespuesta('${p.id}',${!isCorrect})">
                ${isCorrect ? 'Marcar ✗' : 'Marcar ✓'}
              </button>
            </div>
          </div>
        </div>`;
    }).join('');

    const isConfirmed = resultado.status === 'confirmed';

    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid var(--border)">
        <button class="btn btn-ghost btn-sm" onclick="ProfesorExamenes._volverLista()">← Volver</button>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;color:var(--text-1)">${nombre}</div>
          <div style="font-size:.75rem;color:var(--text-3)">${dniStr}</div>
        </div>
        <div style="text-align:right">
          <span style="font-size:1.3rem;font-weight:700;color:${color}">${grade}</span>
          <span style="font-size:.8rem;color:var(--text-3)">/10</span>
        </div>
      </div>

      <div style="max-height:340px;overflow-y:auto;padding-right:4px;margin-bottom:14px">${qRows}</div>

      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">
          <div>
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px">Nota automática</div>
            <div style="font-size:.95rem;font-weight:600;color:var(--text-2)">${Math.round(autoGrade/10*10)/10}/10</div>
          </div>
          <div>
            <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px">Nota final (0–100)</div>
            <input type="number" id="rev-nota-final" value="${finalScore}" min="0" max="100" step="1"
              ${isConfirmed ? 'disabled' : ''}
              style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-base);color:var(--text-1);font-size:.95rem">
          </div>
        </div>
        <div>
          <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);margin-bottom:4px">Observaciones para el alumno</div>
          <textarea id="rev-notas" rows="2" ${isConfirmed ? 'disabled' : ''}
            style="width:100%;font-family:inherit;font-size:.875rem;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-base);color:var(--text-1);resize:vertical;box-sizing:border-box"
            placeholder="Observaciones opcionales…">${resultado.professor_notes || ''}</textarea>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;align-items:center;flex-wrap:wrap">
        ${isConfirmed
          ? '<span style="font-size:.8rem;color:var(--success);font-weight:500">✓ Resultado ya visible para el alumno</span>'
          : `<button class="btn btn-ghost btn-sm" id="rev-draft-btn" onclick="ProfesorExamenes._guardarBorrador('${resultado.id}')">Guardar borrador</button>
             <button class="btn btn-primary" id="rev-confirm-btn" onclick="ProfesorExamenes.confirmarResultado('${resultado.id}')">✓ Confirmar y liberar</button>`
        }
      </div>`;
  },

  async _toggleRespuesta(qId, setCorrect) {
    if (!this._revisionData) return;
    const adj = { ...(this._revisionData.resultado.professor_adjustments || {}) };
    adj[qId] = setCorrect;
    this._revisionData.resultado.professor_adjustments = adj;
    this._renderRevision();
  },

  _volverLista() {
    document.getElementById('exam-revision-view').classList.add('hidden');
    document.getElementById('exam-res-list').classList.remove('hidden');
    this._revisionData = null;
    this._loadResultados();
  },

  async _guardarBorrador(resultId) {
    const btn        = document.getElementById('rev-draft-btn');
    const notaFinal  = parseInt(document.getElementById('rev-nota-final')?.value) || 0;
    const notas      = document.getElementById('rev-notas')?.value.trim();
    const adj        = this._revisionData?.resultado?.professor_adjustments || {};

    Utils.btnLoading(btn, true);
    const { error } = await sb.from('exam_results').update({
      professor_score: notaFinal,
      professor_notes: notas || null,
      professor_adjustments: adj,
    }).eq('id', resultId);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Borrador guardado');

    if (this._revisionData) {
      this._revisionData.resultado.professor_score       = notaFinal;
      this._revisionData.resultado.professor_notes       = notas || null;
      this._revisionData.resultado.professor_adjustments = adj;
    }
  },

  async confirmarResultado(resultId) {
    if (!await Utils.confirmar('¿Confirmar y liberar el resultado al alumno? No se puede deshacer.')) return;

    const btn       = document.getElementById('rev-confirm-btn');
    const notaFinal = parseInt(document.getElementById('rev-nota-final')?.value) || 0;
    const notas     = document.getElementById('rev-notas')?.value.trim();
    const adj       = this._revisionData?.resultado?.professor_adjustments || {};

    Utils.btnLoading(btn, true);
    const { error } = await sb.from('exam_results').update({
      professor_score: notaFinal,
      professor_notes: notas || null,
      professor_adjustments: adj,
      status: 'confirmed',
      confirmed_at: new Date().toISOString(),
    }).eq('id', resultId);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Resultado confirmado. El alumno ya puede verlo.');

    if (this._revisionData) {
      this._revisionData.resultado.status             = 'confirmed';
      this._revisionData.resultado.professor_score    = notaFinal;
      this._revisionData.resultado.professor_notes    = notas || null;
      this._revisionData.resultado.professor_adjustments = adj;
    }
    this._renderRevision();
  },

  _nombreArchivo(url) {
    try { return decodeURIComponent(url.split('/').pop().split('?')[0]); }
    catch { return 'archivo.pdf'; }
  },

  // ════════════════════════════════════════════════════════
  //  IMPORTAR EXAMEN DESDE ARCHIVO (PDF / Word)
  // ════════════════════════════════════════════════════════

  _PROMPT_IA: `Necesito que generes un examen para importar a la plataforma educativa Kinnos.
Usá EXACTAMENTE el siguiente formato (no cambies los marcadores en mayúsculas):

EXAMEN: [Título del examen]
TIEMPO: [duración en minutos]
INSTRUCCIONES: [instrucciones para los alumnos]

P1. [enunciado de la pregunta de opción múltiple]
a) [primera opción]
b) [segunda opción]
c) [tercera opción]
d) [cuarta opción]
CORRECTA: c
PUNTOS: 1

P2. [afirmación para responder verdadero o falso]
CORRECTA: Verdadero
PUNTOS: 1

P3. [pregunta de respuesta corta]
CORRECTA: [respuesta esperada]
PUNTOS: 2

Reglas que debés respetar sin excepción:
- Para opción múltiple: CORRECTA debe tener solo la letra (a, b, c o d)
- Para verdadero/falso: CORRECTA debe ser exactamente "Verdadero" o "Falso"
- Para respuesta corta: no pongas opciones, solo CORRECTA con la respuesta esperada
- No agregues texto extra, explicaciones ni numeración fuera del formato
- Cada pregunta termina con CORRECTA: y opcionalmente PUNTOS:

---
Mis instrucciones para el examen:
[escribí acá: materia, tema, cantidad y tipo de preguntas, nivel de dificultad, año/curso, etc.]`,

  copiarPromptIA() {
    navigator.clipboard.writeText(this._PROMPT_IA).then(() => {
      Utils.toast('Prompt copiado. Pegalo en ChatGPT, Claude o la IA que uses.');
      const btn = document.getElementById('btn-copiar-prompt');
      if (btn) {
        const orig = btn.textContent;
        btn.textContent = '✓ Copiado';
        setTimeout(() => { btn.textContent = orig; }, 2000);
      }
    }).catch(() => {
      // Fallback para navegadores sin clipboard API
      const ta = document.createElement('textarea');
      ta.value = this._PROMPT_IA;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      Utils.toast('Prompt copiado.');
    });
  },

  importarDesdeArchivo() {
    document.getElementById('exam-import-overlay').style.display = 'flex';
    document.getElementById('exam-import-save').style.display    = 'none';
    document.getElementById('exam-import-count').textContent     = '';
    this._mostrarGuia();
  },

  _mostrarGuia() {
    document.getElementById('exam-import-body').innerHTML = `
      <div style="max-width:600px;margin:0 auto;text-align:center;padding:12px 0 32px">

        <div style="font-size:2.5rem;margin-bottom:16px">🤖</div>
        <h3 style="color:var(--text-1);margin-bottom:10px;font-size:1.1rem">Creá el examen con cualquier IA</h3>
        <p style="color:var(--text-2);font-size:.9rem;margin-bottom:28px;line-height:1.65">
          Copiá el prompt, pegalo en <strong>ChatGPT, Claude, Gemini</strong> o cualquier asistente de IA.<br>
          Agregá tus instrucciones (materia, temas, cantidad de preguntas, dificultad).<br>
          La IA genera el examen en el formato que Kinnos puede leer automáticamente.
        </p>

        <button id="btn-copiar-prompt" class="btn btn-primary" style="min-width:220px;margin-bottom:12px"
          onclick="ProfesorExamenes.copiarPromptIA()">
          📋 Copiar prompt para la IA
        </button>

        <div style="color:var(--text-3);font-size:.78rem;margin-bottom:32px">
          El prompt incluye el formato exacto y las reglas para que la IA no cometa errores.
        </div>

        <div style="border-top:1px solid var(--border);padding-top:28px">
          <p style="color:var(--text-3);font-size:.82rem;margin-bottom:16px">
            ¿Ya tenés el archivo generado por la IA?<br>
            Guardalo como <strong>.txt, .pdf o .docx</strong> y subilo acá:
          </p>
          <button class="btn btn-ghost" onclick="ProfesorExamenes._elegirArchivo()">
            📂 Elegir archivo
          </button>
        </div>
      </div>`;
  },

  _elegirArchivo() {
    const input = document.createElement('input');
    input.type  = 'file';
    input.accept = '.pdf,.doc,.docx,.txt';
    input.onchange = e => { if (e.target.files[0]) this._procesarArchivo(e.target.files[0]); };
    input.click();
  },

  async _procesarArchivo(file) {
    const overlay = document.getElementById('exam-import-overlay');
    overlay.style.display = 'flex';
    document.getElementById('exam-import-body').innerHTML =
      '<div class="loading" style="padding:60px;text-align:center">Leyendo archivo…</div>';

    try {
      let texto = '';
      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === 'pdf') {
        texto = await this._leerPDF(file);
      } else if (ext === 'docx' || ext === 'doc') {
        texto = await this._leerWord(file);
      } else {
        texto = await file.text();
      }

      const datos = this._parsearTexto(texto);

      if (!datos.questions.length) {
        document.getElementById('exam-import-body').innerHTML = `
          <div style="padding:40px;text-align:center">
            <div style="font-size:2rem;margin-bottom:16px">⚠️</div>
            <p style="color:var(--text-2);margin-bottom:8px">No se encontraron preguntas en el archivo.</p>
            <p style="color:var(--text-3);font-size:.85rem;margin-bottom:20px">
              Verificá que el archivo siga el formato Kinnos.<br>
              Las preguntas deben estar marcadas como <code>P1.</code>, <code>P2.</code>, etc.
            </p>
            <button class="btn btn-ghost" onclick="ProfesorExamenes._cerrarImport()">Cerrar</button>
            <button class="btn btn-primary" style="margin-left:8px" onclick="ProfesorExamenes.descargarPlantilla()">
              Descargar plantilla
            </button>
          </div>`;
        return;
      }

      this._importData = datos;
      this._renderPreviewImport();

    } catch (e) {
      document.getElementById('exam-import-body').innerHTML = `
        <div style="padding:40px;text-align:center">
          <p style="color:var(--danger)">Error al leer el archivo: ${e.message}</p>
          <button class="btn btn-ghost" style="margin-top:16px" onclick="ProfesorExamenes._cerrarImport()">Cerrar</button>
        </div>`;
    }
  },

  // ── Lectores de archivo ───────────────────────────────────

  async _leerPDF(file) {
    await this._cargarLibreria(
      'pdfjsLib',
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let texto = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page    = await pdf.getPage(i);
      const content = await page.getTextContent();
      // Reconstruir líneas respetando posición Y
      let lastY = null;
      for (const item of content.items) {
        if (lastY !== null && Math.abs(item.transform[5] - lastY) > 2) texto += '\n';
        texto += item.str;
        lastY = item.transform[5];
      }
      texto += '\n';
    }
    return texto;
  },

  async _leerWord(file) {
    await this._cargarLibreria(
      'mammoth',
      'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js'
    );
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  },

  _cargarLibreria(globalName, src) {
    if (window[globalName]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  },

  // ── Parser del formato Kinnos ─────────────────────────────

  _parsearTexto(rawText) {
    // Normalizar: insertar saltos de línea antes de cada marcador clave
    // Esto maneja PDFs que colapsan todo en pocas líneas
    let text = rawText
      .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
      .replace(/\s*(EXAMEN\s*:)/gi,       '\nEXAMEN:')
      .replace(/\s*(TIEMPO\s*:)/gi,        '\nTIEMPO:')
      .replace(/\s*(INSTRUCCIONES\s*:)/gi, '\nINSTRUCCIONES:')
      .replace(/\s*(CORRECTA\s*:)/gi,      '\nCORRECTA:')
      .replace(/\s*(PUNTOS?\s*:)/gi,       '\nPUNTOS:')
      .replace(/\s*(P\s*\d+\s*[.\-:])/gi,  '\n$1')
      .replace(/\n([a-dA-D])\s*[).\-]\s+/g, '\n$1) ');

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const result = { title: '', time_limit: null, instructions: '', questions: [] };
    let currentQ = null;

    for (const line of lines) {
      if (/^EXAMEN\s*:/i.test(line)) {
        result.title = line.replace(/^EXAMEN\s*:\s*/i, '').trim();

      } else if (/^TIEMPO\s*:/i.test(line)) {
        result.time_limit = parseInt(line.replace(/^TIEMPO\s*:\s*/i, '')) || null;

      } else if (/^INSTRUCCIONES\s*:/i.test(line)) {
        result.instructions = line.replace(/^INSTRUCCIONES\s*:\s*/i, '').trim();

      } else if (/^P\s*\d+\s*[.\-:]/i.test(line)) {
        if (currentQ) result.questions.push(this._finalizarPregunta(currentQ));
        currentQ = {
          question_text: line.replace(/^P\s*\d+\s*[.\-:]\s*/i, '').trim(),
          type:          'short',
          options:       [],
          _rawCorrect:   '',
          points:        1,
        };

      } else if (/^[a-d]\)\s+/i.test(line) && currentQ) {
        currentQ.type = 'multiple';
        currentQ.options.push(line.replace(/^[a-d]\)\s+/i, '').trim());

      } else if (/^CORRECTA\s*:/i.test(line) && currentQ) {
        currentQ._rawCorrect = line.replace(/^CORRECTA\s*:\s*/i, '').trim();

      } else if (/^PUNTOS?\s*:/i.test(line) && currentQ) {
        currentQ.points = parseFloat(
          line.replace(/^PUNTOS?\s*:\s*/i, '').replace(',', '.')
        ) || 1;

      } else if (currentQ && line.length > 0 && !currentQ.question_text) {
        currentQ.question_text = line;
      }
    }

    if (currentQ) result.questions.push(this._finalizarPregunta(currentQ));
    return result;
  },

  _finalizarPregunta(q) {
    const raw = (q._rawCorrect || '').trim();

    if (q.type === 'multiple' && q.options.length > 0) {
      if (/^[a-d]$/i.test(raw)) {
        const idx = raw.toLowerCase().charCodeAt(0) - 97;
        q.correct_answer = q.options[idx] ?? raw;
      } else {
        q.correct_answer = raw;
      }
    } else if (/^(verdadero|falso|true|false)$/i.test(raw)) {
      q.type = 'truefalse';
      q.correct_answer = /^(verdadero|true)$/i.test(raw) ? 'Verdadero' : 'Falso';
    } else {
      q.type = 'short';
      q.correct_answer = raw;
    }

    delete q._rawCorrect;
    return q;
  },

  // ── Preview de importación ────────────────────────────────

  _renderPreviewImport() {
    document.getElementById('exam-import-save').style.display = '';
    const datos = this._importData;
    const typeLabel = { multiple: 'Múltiple', truefalse: 'V / F', short: 'Corta' };

    const qRows = datos.questions.map((p, i) => {
      const opts = p.type === 'multiple'
        ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
             ${p.options.map((o, oi) => {
               const isCorrect = o === p.correct_answer;
               return `<span style="padding:3px 10px;border-radius:6px;font-size:.8rem;
                 background:${isCorrect ? 'rgba(34,197,94,.15)' : 'var(--bg-base)'};
                 border:1px solid ${isCorrect ? 'var(--success)' : 'var(--border)'};
                 color:${isCorrect ? 'var(--success)' : 'var(--text-2)'}">
                 ${'abcd'[oi]}) ${o}
               </span>`;
             }).join('')}
           </div>`
        : '';

      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:12px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.68rem;font-weight:700;color:var(--text-3);min-width:24px;padding-top:2px">#${i + 1}</span>
          <div style="flex:1;min-width:0">
            <div style="margin-bottom:4px">
              <span class="badge badge-inactive" style="font-size:.65rem">${typeLabel[p.type]}</span>
              <span style="font-size:.72rem;color:var(--accent);margin-left:6px">${p.points} pt</span>
            </div>
            <div style="font-size:.875rem;color:var(--text-1);margin-bottom:6px">${p.question_text}</div>
            ${opts}
            ${p.type !== 'multiple'
              ? `<div style="font-size:.78rem;color:var(--text-3);margin-top:6px">Correcta: <strong style="color:var(--accent)">${p.correct_answer || '—'}</strong></div>`
              : `<div style="font-size:.78rem;color:var(--text-3);margin-top:4px">Correcta: <strong style="color:var(--success)">${p.correct_answer}</strong></div>`}
          </div>
          <button class="btn btn-danger btn-sm" style="flex-shrink:0" onclick="ProfesorExamenes._eliminarPreguntaPreview(${i})">✕</button>
        </div>`;
    }).join('');

    const totalPts = datos.questions.reduce((s, q) => s + (Number(q.points) || 0), 0);

    document.getElementById('exam-import-count').textContent =
      `${datos.questions.length} pregunta${datos.questions.length !== 1 ? 's' : ''} detectadas · ${totalPts} puntos en total`;

    document.getElementById('exam-import-body').innerHTML = `
      <!-- Encabezado editable -->
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:20px 24px;margin-bottom:24px">
        <div style="display:grid;grid-template-columns:1fr 140px;gap:14px;margin-bottom:12px">
          <div class="form-group" style="margin:0">
            <label>Título del examen</label>
            <input type="text" id="imp-titulo" value="${datos.title || ''}" placeholder="Título del examen">
          </div>
          <div class="form-group" style="margin:0">
            <label>Tiempo (min)</label>
            <input type="number" id="imp-tiempo" value="${datos.time_limit || ''}" placeholder="—" min="1">
          </div>
        </div>
        ${datos.instructions
          ? `<div style="font-size:.82rem;color:var(--text-3);font-style:italic">Instrucciones: ${datos.instructions}</div>`
          : ''}
        <div style="margin-top:12px;display:flex;align-items:center;gap:8px">
          <input type="checkbox" id="imp-practica" style="width:auto">
          <label for="imp-practica" style="text-transform:none;font-size:.875rem;cursor:pointer">Es examen de práctica (sin nota, repetible)</label>
        </div>
      </div>

      <!-- Lista de preguntas -->
      <div id="imp-preguntas-list">${qRows}</div>

      <!-- Advertencia si no hay título -->
      <div id="imp-warn" style="display:none;color:var(--danger);font-size:.85rem;margin-top:12px">
        ⚠ El título es obligatorio para crear el examen.
      </div>`;
  },

  _eliminarPreguntaPreview(idx) {
    if (!this._importData) return;
    this._importData.questions.splice(idx, 1);
    this._renderPreviewImport();
  },

  async _crearDesdeImport() {
    const btn   = document.getElementById('exam-import-save');
    const title = document.getElementById('imp-titulo')?.value.trim();

    if (!title) {
      document.getElementById('imp-warn').style.display = 'block';
      return;
    }

    const preguntas = this._importData?.questions || [];
    if (!preguntas.length) { Utils.toast('No hay preguntas para guardar.', 'error'); return; }

    const time_limit   = parseInt(document.getElementById('imp-tiempo')?.value) || null;
    const instructions = this._importData.instructions || null;
    const is_practice  = document.getElementById('imp-practica')?.checked || false;

    Utils.btnLoading(btn, true);

    // 1. Crear el examen
    const { data: exam, error: examErr } = await sb.from('exams').insert({
      subject_id: ProfesorState.materia.id,
      title,
      time_limit: is_practice ? null : time_limit,
      instructions,
      is_practice,
    }).select().single();

    if (examErr) {
      Utils.btnLoading(btn, false);
      Utils.toast('Error al crear examen: ' + examErr.message, 'error');
      return;
    }

    // 2. Insertar todas las preguntas
    const payload = preguntas.map((p, i) => ({
      exam_id:       exam.id,
      order_num:     i + 1,
      type:          p.type,
      question_text: p.question_text,
      correct_answer: p.correct_answer,
      points:        p.points || 1,
      options:       p.type === 'multiple' ? p.options : null,
    }));

    const { error: qErr } = await sb.from('exam_questions').insert(payload);
    Utils.btnLoading(btn, false);

    if (qErr) {
      Utils.toast('Examen creado pero error al guardar preguntas: ' + qErr.message, 'error');
    } else {
      Utils.toast(`Examen creado con ${preguntas.length} preguntas.`);
    }

    this._cerrarImport();
    this.init();
  },

  _cerrarImport() {
    document.getElementById('exam-import-overlay').style.display = 'none';
    this._importData = null;
  },
};
