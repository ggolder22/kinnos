const AlumnoExamenes = {
  _exam:          null,
  _preguntas:     [],
  _timerInterval: null,

  // ── Lista de exámenes ─────────────────────────────────────

  async init() {
    const el = document.getElementById('examenes-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    const { data: examenes, error } = await sb
      .from('exams')
      .select('*, exam_questions(count)')
      .eq('subject_id', AlumnoState.materia.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar exámenes', 'error'); return; }

    const examIds = (examenes || []).map(e => e.id);
    let resultados = {};
    if (examIds.length) {
      const { data: res } = await sb
        .from('exam_results')
        .select('*')
        .eq('student_id', session.id)
        .in('exam_id', examIds);
      (res || []).forEach(r => { resultados[r.exam_id] = r; });
    }

    this._render(examenes || [], resultados);
  },

  _render(examenes, resultados) {
    const el = document.getElementById('examenes-content');

    if (!examenes.length) {
      el.innerHTML = `<div class="page-header"><h3>Exámenes</h3></div>
        <div class="empty-state"><div class="icon">📝</div><p>No hay exámenes disponibles en este momento.</p></div>`;
      return;
    }

    const cards = examenes.map(e => {
      const cantPreg  = e.exam_questions?.[0]?.count ?? 0;
      const resultado = resultados[e.id];

      let accionHtml = '';
      if (e.is_practice) {
        accionHtml = `<button class="btn btn-primary btn-sm" onclick="AlumnoExamenes.abrir('${e.id}')">
          Practicar
        </button>`;
      } else if (!resultado || resultado.status === 'in_progress') {
        accionHtml = `<button class="btn btn-primary btn-sm" onclick="AlumnoExamenes.abrir('${e.id}')">
          Rendir
        </button>`;
      } else if (resultado.status === 'submitted') {
        accionHtml = `<div style="text-align:right">
          <div style="font-size:.82rem;font-weight:600;color:var(--accent)">⏳ En revisión</div>
          <div style="font-size:.72rem;color:var(--text-3);margin-top:2px">El docente está corrigiendo</div>
        </div>`;
      } else if (resultado.status === 'confirmed') {
        const finalScore = resultado.professor_score ?? resultado.score;
        const grade      = Math.round(finalScore / 10 * 10) / 10;
        const color      = grade >= 6 ? 'var(--success)' : 'var(--danger)';
        accionHtml = `<div style="text-align:right">
          <div style="font-size:1.4rem;font-weight:700;color:${color}">${grade}<span style="font-size:.8rem;font-weight:400">/10</span></div>
          <button class="btn btn-ghost btn-sm" style="font-size:.72rem;margin-top:4px"
            onclick="AlumnoExamenes.verResultado('${resultado.id}')">Ver corrección</button>
        </div>`;
      }

      const tipoBadge = e.is_practice
        ? '<span class="badge badge-practice">Práctica</span>'
        : '<span class="badge badge-active">Formal</span>';
      const meta = [
        `${cantPreg} pregunta${cantPreg !== 1 ? 's' : ''}`,
        e.time_limit ? `${e.time_limit} min` : null,
      ].filter(Boolean).join(' · ');

      const pdfBtn = e.pdf_url
        ? `<a href="${e.pdf_url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="font-size:.75rem">📄 Enunciado PDF</a>`
        : '';

      return `
        <div class="examen-card">
          <div class="examen-card-info">
            <div class="exam-title">${e.title}</div>
            <div class="exam-meta">${tipoBadge} &nbsp; ${meta}${pdfBtn ? ' &nbsp; ' + pdfBtn : ''}</div>
          </div>
          ${accionHtml}
        </div>`;
    }).join('');

    el.innerHTML = `<div class="page-header"><h3>Exámenes</h3></div>${cards}`;
  },

  // ── Abrir / iniciar examen ────────────────────────────────

  async abrir(examId) {
    const { data: exam } = await sb.from('exams').select('*').eq('id', examId).single();
    const { data: preguntas } = await sb
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('order_num');

    if (!preguntas?.length) { Utils.toast('Este examen no tiene preguntas cargadas.', 'info'); return; }

    this._exam     = exam;
    this._preguntas = preguntas;
    const session  = Auth.session();

    if (exam.is_practice) {
      await sb.from('exam_results').upsert({
        student_id:  session.id,
        exam_id:     examId,
        status:      'in_progress',
        started_at:  new Date().toISOString(),
        answers:     {},
        score:       0,
        professor_score: null,
        professor_notes: null,
        professor_adjustments: {},
      }, { onConflict: 'student_id,exam_id' });
    } else {
      const { data: existing } = await sb
        .from('exam_results')
        .select('id, status')
        .eq('student_id', session.id)
        .eq('exam_id', examId)
        .maybeSingle();

      if (existing && existing.status !== 'in_progress') {
        Utils.toast('Ya enviaste este examen. Esperá la corrección del docente.', 'info');
        return;
      }
      if (!existing) {
        await sb.from('exam_results').insert({
          student_id: session.id,
          exam_id:    examId,
          status:     'in_progress',
          started_at: new Date().toISOString(),
        });
      }
    }

    document.getElementById('exam-overlay-titulo').textContent = exam.title;
    document.getElementById('exam-instrucciones').textContent  = exam.instructions || '';
    document.getElementById('exam-instrucciones').style.display = exam.instructions ? 'block' : 'none';
    document.getElementById('exam-form-view').style.display    = 'block';
    document.getElementById('exam-result-view').style.display  = 'none';

    this._renderPreguntas();
    this._startTimer(exam.time_limit);
    document.getElementById('exam-overlay').classList.add('active');
  },

  _renderPreguntas() {
    const container = document.getElementById('exam-preguntas');
    container.innerHTML = this._preguntas.map((p, i) => {
      let input = '';
      if (p.type === 'truefalse') {
        input = `<div class="opciones">
          <label class="opcion-label"><input type="radio" name="preg_${p.id}" value="Verdadero"> Verdadero</label>
          <label class="opcion-label"><input type="radio" name="preg_${p.id}" value="Falso"> Falso</label>
        </div>`;
      } else if (p.type === 'multiple') {
        const opciones = Array.isArray(p.options) ? p.options : [];
        input = `<div class="opciones">
          ${opciones.map(op => `
            <label class="opcion-label">
              <input type="radio" name="preg_${p.id}" value="${op.replace(/"/g, '&quot;')}">
              ${op}
            </label>`).join('')}
        </div>`;
      } else {
        input = `<input class="short-input" id="short_${p.id}" type="text" placeholder="Tu respuesta…">`;
      }

      return `
        <div class="pregunta-block">
          <div class="preg-num">Pregunta ${i + 1} de ${this._preguntas.length} · ${p.points} ${p.points == 1 ? 'punto' : 'puntos'}</div>
          <div class="preg-texto">${p.question_text}</div>
          ${input}
        </div>`;
    }).join('');
  },

  // ── Temporizador ──────────────────────────────────────────

  _startTimer(limitMinutes) {
    clearInterval(this._timerInterval);
    const timerEl = document.getElementById('exam-timer');
    timerEl.textContent = '';

    if (!limitMinutes || this._exam?.is_practice) return;

    let secondsLeft = limitMinutes * 60;

    const tick = () => {
      const m = Math.floor(secondsLeft / 60);
      const s = secondsLeft % 60;
      timerEl.textContent = `${m}:${String(s).padStart(2, '0')}`;
      timerEl.style.color = secondsLeft <= 300 ? 'var(--danger)' : 'var(--accent)';

      if (secondsLeft <= 0) {
        clearInterval(this._timerInterval);
        Utils.toast('¡Tiempo! El examen fue enviado automáticamente.', 'info');
        this.enviar();
        return;
      }
      secondsLeft--;
    };

    tick();
    this._timerInterval = setInterval(tick, 1000);
  },

  // ── Entregar examen ───────────────────────────────────────

  async enviar() {
    clearInterval(this._timerInterval);
    document.getElementById('exam-timer').textContent = '';

    const respuestas = {};
    for (const p of this._preguntas) {
      if (p.type === 'multiple' || p.type === 'truefalse') {
        const sel = document.querySelector(`input[name="preg_${p.id}"]:checked`);
        respuestas[p.id] = sel ? sel.value : null;
      } else {
        respuestas[p.id] = document.getElementById(`short_${p.id}`)?.value.trim() || null;
      }
    }

    // Auto-corrección: multiple y truefalse exacto; short = comparación case-insensitive
    let puntosObtenidos = 0, puntosTotal = 0;
    for (const p of this._preguntas) {
      puntosTotal += Number(p.points) || 0;
      const ans = respuestas[p.id] || '';
      const isCorrect = p.type === 'short'
        ? ans.trim().toLowerCase() === p.correct_answer.trim().toLowerCase()
        : ans === p.correct_answer;
      if (isCorrect) puntosObtenidos += Number(p.points) || 0;
    }

    const score      = puntosTotal > 0 ? Math.round(puntosObtenidos / puntosTotal * 100) : 0;
    const isPractice = this._exam.is_practice;
    const session    = Auth.session();

    const { error } = await sb
      .from('exam_results')
      .update({
        answers:      respuestas,
        score,
        status:       isPractice ? 'confirmed' : 'submitted',
        submitted_at: new Date().toISOString(),
        ...(isPractice ? { confirmed_at: new Date().toISOString() } : {}),
      })
      .eq('student_id', session.id)
      .eq('exam_id', this._exam.id);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }

    if (isPractice) {
      this._mostrarResultadoPractica(score, puntosObtenidos, puntosTotal);
    } else {
      this._mostrarEsperandoRevision();
    }
  },

  _mostrarEsperandoRevision() {
    document.getElementById('exam-form-view').style.display = 'none';
    const rv = document.getElementById('exam-result-view');
    rv.style.display = 'block';
    rv.innerHTML = `
      <div class="result-overlay">
        <div style="font-size:3rem;margin-bottom:20px">📬</div>
        <h3 style="color:var(--text-1);margin-bottom:10px">Examen enviado</h3>
        <p style="color:var(--text-2);font-size:.925rem;max-width:420px;margin:0 auto 10px">
          Tu examen fue enviado correctamente. El docente va a revisar tus respuestas y te va a liberar la nota cuando esté listo.
        </p>
        <p style="color:var(--text-3);font-size:.8rem;margin-bottom:36px">
          Podés ver el estado en la pestaña Exámenes.
        </p>
        <button class="btn btn-primary" onclick="AlumnoExamenes.cerrarOverlay()">Volver</button>
      </div>`;
  },

  _mostrarResultadoPractica(score, obtenidos, total) {
    document.getElementById('exam-form-view').style.display = 'none';
    const rv      = document.getElementById('exam-result-view');
    rv.style.display = 'block';
    const grade   = Math.round(score / 10 * 10) / 10;
    const aprobado = grade >= 6;
    const color   = aprobado ? 'var(--success)' : 'var(--danger)';

    rv.innerHTML = `
      <div class="result-overlay">
        <div class="result-score ${aprobado ? 'aprobado' : 'desaprobado'}">${grade}<span style="font-size:1.5rem">/10</span></div>
        <p style="color:var(--text-2);margin-bottom:6px">${obtenidos} / ${total} puntos</p>
        <p style="color:var(--text-3);font-size:.875rem;margin-bottom:36px">
          ${aprobado ? '¡Muy bien! Práctica aprobada.' : 'Seguí practicando, podés volver a intentarlo.'}
        </p>
        <button class="btn btn-primary" onclick="AlumnoExamenes.cerrarOverlay()">Volver a exámenes</button>
      </div>`;
  },

  // ── Ver corrección (examen formal confirmado) ─────────────

  async verResultado(resultId) {
    document.getElementById('exam-form-view').style.display  = 'none';
    document.getElementById('exam-result-view').style.display = 'block';
    document.getElementById('exam-result-view').innerHTML    =
      '<div class="loading" style="padding:40px;text-align:center">Cargando corrección…</div>';
    document.getElementById('exam-timer').textContent        = '';
    document.getElementById('exam-overlay').classList.add('active');

    const { data: resultado } = await sb
      .from('exam_results')
      .select('*, exams(title)')
      .eq('id', resultId)
      .single();

    const { data: preguntas } = await sb
      .from('exam_questions')
      .select('*')
      .eq('exam_id', resultado.exam_id)
      .order('order_num');

    document.getElementById('exam-overlay-titulo').textContent = resultado.exams?.title || 'Examen';

    const finalScore = resultado.professor_score ?? resultado.score;
    const grade      = Math.round(finalScore / 10 * 10) / 10;
    const color      = grade >= 6 ? 'var(--success)' : 'var(--danger)';
    const answers    = resultado.answers || {};
    const adj        = resultado.professor_adjustments || {};

    const qRows = (preguntas || []).map((p, i) => {
      const studentAns = answers[p.id] ?? '—';
      let isCorrect;
      if (p.id in adj) {
        isCorrect = adj[p.id];
      } else if (p.type === 'short') {
        isCorrect = studentAns !== '—' && studentAns.trim().toLowerCase() === p.correct_answer.trim().toLowerCase();
      } else {
        isCorrect = studentAns === p.correct_answer;
      }

      const icon        = isCorrect ? '✓' : '✗';
      const iconColor   = isCorrect ? 'var(--success)' : 'var(--danger)';
      const borderColor = isCorrect ? 'var(--success)' : 'var(--danger)';
      const bg          = isCorrect ? 'rgba(34,197,94,.06)' : 'rgba(239,68,68,.06)';

      return `
        <div style="background:${bg};border-left:3px solid ${borderColor};padding:12px 14px;border-radius:0 7px 7px 0;margin-bottom:9px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div style="flex:1">
              <div style="font-size:.72rem;color:var(--text-3);margin-bottom:4px">#${p.order_num} · ${p.points} pt</div>
              <div style="font-size:.9rem;color:var(--text-1);margin-bottom:8px">${p.question_text}</div>
              <div style="display:flex;gap:16px;flex-wrap:wrap;font-size:.82rem">
                <div><span style="color:var(--text-3)">Tu respuesta: </span><strong>${studentAns}</strong></div>
                ${!isCorrect ? `<div><span style="color:var(--text-3)">Correcta: </span><strong style="color:var(--success)">${p.correct_answer}</strong></div>` : ''}
              </div>
            </div>
            <span style="font-size:1.15rem;font-weight:700;color:${iconColor};flex-shrink:0">${icon}</span>
          </div>
        </div>`;
    }).join('');

    const notas = resultado.professor_notes
      ? `<div style="margin:14px 0;padding:12px 16px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;font-size:.875rem;color:var(--text-2)">
           <strong>Observaciones del docente:</strong><br>${resultado.professor_notes}
         </div>`
      : '';

    document.getElementById('exam-result-view').innerHTML = `
      <div style="max-width:680px;margin:0 auto;padding:28px 24px">
        <div style="text-align:center;margin-bottom:28px">
          <div style="font-size:3rem;font-weight:700;color:${color};line-height:1">${grade}<span style="font-size:1.2rem">/10</span></div>
          <div style="font-size:.9rem;color:var(--text-2);margin-top:6px">${grade >= 6 ? '✓ Aprobado' : '✗ Desaprobado'}</div>
        </div>
        ${notas}
        <div style="margin-bottom:24px">${qRows}</div>
        <div style="text-align:center">
          <button class="btn btn-primary" onclick="AlumnoExamenes.cerrarOverlay()">Volver a exámenes</button>
        </div>
      </div>`;
  },

  // ── Cerrar overlay ────────────────────────────────────────

  cerrarOverlay() {
    clearInterval(this._timerInterval);
    document.getElementById('exam-overlay').classList.remove('active');
    document.getElementById('exam-result-view').style.display = 'none';
    document.getElementById('exam-form-view').style.display   = 'block';
    document.getElementById('exam-timer').textContent         = '';
    this._exam      = null;
    this._preguntas = [];
    this.init();
  },
};
