const AlumnoExamenes = {
  _exam: null,
  _preguntas: [],

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

    // Cargar resultados del alumno para esta materia
    const examIds = (examenes || []).map(e => e.id);
    let resultados = {};
    if (examIds.length) {
      const { data: res } = await sb
        .from('exam_results')
        .select('exam_id, score, taken_at')
        .eq('student_id', session.id)
        .in('exam_id', examIds)
        .not('taken_at', 'is', null);
      (res || []).forEach(r => { resultados[r.exam_id] = r; });
    }

    this._render(examenes || [], resultados);
  },

  _render(examenes, resultados) {
    const el = document.getElementById('examenes-content');

    if (!examenes.length) {
      el.innerHTML = `<div class="page-header"><h3>Exámenes</h3></div>
        <div class="empty-state"><div class="icon">📝</div><p>No hay exámenes disponibles.</p></div>`;
      return;
    }

    const cards = examenes.map(e => {
      const cantPreg = e.exam_questions?.[0]?.count ?? 0;
      const resultado = resultados[e.id];
      const yaRendido = !e.is_practice && resultado;

      let accionHtml = '';
      if (e.is_practice) {
        accionHtml = `<button class="btn btn-primary btn-sm" onclick="AlumnoExamenes.abrir('${e.id}')">Practicar</button>`;
      } else if (yaRendido) {
        const pct = Math.round(resultado.score ?? 0);
        const color = pct >= 60 ? 'var(--success)' : 'var(--danger)';
        accionHtml = `<div style="text-align:right">
          <div style="font-size:1.4rem;font-weight:700;color:${color}">${pct}%</div>
          <div style="font-size:.72rem;color:var(--text-3)">${Utils.formatDate(resultado.taken_at)}</div>
        </div>`;
      } else {
        accionHtml = `<button class="btn btn-primary btn-sm" onclick="AlumnoExamenes.abrir('${e.id}')">Rendir</button>`;
      }

      const tipoBadge = e.is_practice
        ? '<span class="badge badge-practice">Práctica</span>'
        : '<span class="badge badge-active">Formal</span>';
      const meta = [
        `${cantPreg} preguntas`,
        e.time_limit ? `${e.time_limit} min` : null,
      ].filter(Boolean).join(' · ');

      return `
        <div class="examen-card">
          <div class="examen-card-info">
            <div class="exam-title">${e.title}</div>
            <div class="exam-meta">${tipoBadge} &nbsp; ${meta}</div>
          </div>
          ${accionHtml}
        </div>`;
    }).join('');

    el.innerHTML = `<div class="page-header"><h3>Exámenes</h3></div>${cards}`;
  },

  async abrir(examId) {
    const { data: exam } = await sb.from('exams').select('*').eq('id', examId).single();
    const { data: preguntas } = await sb
      .from('exam_questions')
      .select('*')
      .eq('exam_id', examId)
      .order('order_num');

    if (!preguntas?.length) { Utils.toast('Este examen no tiene preguntas cargadas.', 'info'); return; }

    this._exam = exam;
    this._preguntas = preguntas;

    // Registrar started_at
    const session = Auth.session();
    await sb.from('exam_results').insert({
      student_id: session.id,
      exam_id: examId,
      started_at: new Date().toISOString(),
    });

    this._renderOverlay();
    document.getElementById('exam-overlay').classList.add('active');
  },

  _renderOverlay() {
    const e = this._exam;
    document.getElementById('exam-overlay-titulo').textContent = e.title;
    document.getElementById('exam-instrucciones').textContent = e.instructions || '';
    document.getElementById('exam-instrucciones').style.display = e.instructions ? 'block' : 'none';

    const container = document.getElementById('exam-preguntas');
    container.innerHTML = this._preguntas.map((p, i) => {
      let input = '';
      if (p.type === 'multiple' || p.type === 'truefalse') {
        const opciones = p.type === 'truefalse'
          ? ['Verdadero', 'Falso']
          : (Array.isArray(p.options) ? p.options : []);
        input = `<div class="opciones">
          ${opciones.map(op => `
            <label class="opcion-label">
              <input type="radio" name="preg_${p.id}" value="${op}">
              ${op}
            </label>`).join('')}
        </div>`;
      } else {
        input = `<input class="short-input" id="short_${p.id}" type="text" placeholder="Tu respuesta…">`;
      }
      return `
        <div class="pregunta-block">
          <div class="preg-num">Pregunta ${i + 1} · ${p.points} ${p.points === 1 ? 'punto' : 'puntos'}</div>
          <div class="preg-texto">${p.question_text}</div>
          ${input}
        </div>`;
    }).join('');
  },

  cerrarOverlay() {
    document.getElementById('exam-overlay').classList.remove('active');
    document.getElementById('exam-result-view').style.display = 'none';
    document.getElementById('exam-form-view').style.display = 'block';
    this._exam = null;
    this._preguntas = [];
    this.init();
  },

  async enviar() {
    // Recolectar respuestas
    const respuestas = {};
    for (const p of this._preguntas) {
      if (p.type === 'multiple' || p.type === 'truefalse') {
        const sel = document.querySelector(`input[name="preg_${p.id}"]:checked`);
        respuestas[p.id] = sel ? sel.value : null;
      } else {
        respuestas[p.id] = document.getElementById(`short_${p.id}`)?.value.trim() || null;
      }
    }

    // Calcular puntaje
    let puntosObtenidos = 0;
    let puntosTotal = 0;
    for (const p of this._preguntas) {
      puntosTotal += Number(p.points) || 0;
      if (p.type !== 'short' && respuestas[p.id] === p.correct_answer) {
        puntosObtenidos += Number(p.points) || 0;
      }
    }
    const score = puntosTotal > 0 ? (puntosObtenidos / puntosTotal) * 100 : 0;

    // Guardar resultado (UPDATE el registro creado al abrir)
    const session = Auth.session();
    const { error } = await sb
      .from('exam_results')
      .update({ score, answers: respuestas, taken_at: new Date().toISOString() })
      .eq('student_id', session.id)
      .eq('exam_id', this._exam.id)
      .is('taken_at', null);

    if (error) { Utils.toast('Error al guardar resultado: ' + error.message, 'error'); return; }

    this._mostrarResultado(Math.round(score), puntosObtenidos, puntosTotal);
  },

  _mostrarResultado(pct, obtenidos, total) {
    document.getElementById('exam-form-view').style.display = 'none';
    const rv = document.getElementById('exam-result-view');
    rv.style.display = 'block';

    const aprobado = pct >= 60;
    rv.innerHTML = `
      <div class="result-overlay">
        <div class="result-score ${aprobado ? 'aprobado' : 'desaprobado'}">${pct}%</div>
        <p style="color:var(--text-2);margin-bottom:8px">${obtenidos} / ${total} puntos</p>
        <p style="color:var(--text-3);font-size:.875rem;margin-bottom:32px">
          ${aprobado ? '¡Muy bien! Examen aprobado.' : 'Examen desaprobado. ¡Seguí practicando!'}
        </p>
        <button class="btn btn-primary" onclick="AlumnoExamenes.cerrarOverlay()">Volver a exámenes</button>
      </div>`;
  },
};
