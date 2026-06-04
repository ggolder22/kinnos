const AlumnoEjercicios = {
  _exercises:  [],
  _current:    0,
  _attempts:   {},  // { id: { answered, correct, studentAnswer } }
  _unitTitle:  '',

  async abrir(unitId, unitTitle) {
    this._unitTitle = unitTitle;
    this._current   = 0;
    this._attempts  = {};

    const el = document.getElementById('ejercicios-body');
    el.innerHTML = '<div class="loading">Cargando ejercicios…</div>';
    document.getElementById('ejercicios-modal').classList.remove('hidden');
    document.getElementById('ejercicios-modal-title').textContent = `Ejercicios — ${unitTitle}`;

    const { data, error } = await sb
      .from('unit_exercises')
      .select('*')
      .eq('unit_id', unitId)
      .order('order_num');

    if (error || !data?.length) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">No hay ejercicios cargados para esta unidad.</div>';
      return;
    }

    this._exercises = data;
    this._renderEjercicio();
  },

  cerrar() {
    document.getElementById('ejercicios-modal').classList.add('hidden');
    this._exercises = [];
    this._attempts  = {};
  },

  _renderEjercicio() {
    const total = this._exercises.length;
    const idx   = this._current;
    const ej    = this._exercises[idx];
    const intento = this._attempts[ej.id];

    // Progress bar
    const respondidos = Object.values(this._attempts).filter(a => a.answered).length;
    const pct = Math.round((respondidos / total) * 100);

    // Navigation
    const prevDisabled = idx === 0 ? 'disabled' : '';
    const nextDisabled = idx === total - 1 ? 'disabled' : '';

    // Answer area
    let answerHtml = '';
    let feedbackHtml = '';

    if (intento?.answered) {
      if (ej.type === 'find_error') {
        feedbackHtml = `
          <div class="ej-feedback ej-feedback-info">
            <div class="ej-feedback-icon">💡</div>
            <div>
              <div style="font-weight:600;margin-bottom:4px">El error en este ejercicio es:</div>
              <div>${ej.error_explanation}</div>
              ${intento.studentAnswer ? `<div style="margin-top:8px;font-size:.8rem;color:var(--text-3)">Tu respuesta: "${intento.studentAnswer}"</div>` : ''}
            </div>
          </div>`;
      } else if (intento.correct) {
        feedbackHtml = `
          <div class="ej-feedback ej-feedback-ok">
            <div class="ej-feedback-icon">✓</div>
            <div>
              <div style="font-weight:600">¡Correcto!</div>
              <div>Respuesta: <strong>${ej.answer}</strong></div>
              ${this._stepsHtml(ej.solution_steps)}
            </div>
          </div>`;
      } else {
        feedbackHtml = `
          <div class="ej-feedback ej-feedback-err">
            <div class="ej-feedback-icon">✗</div>
            <div>
              <div style="font-weight:600">Incorrecto</div>
              <div>Tu respuesta: <em>${intento.studentAnswer}</em></div>
              <div style="margin-top:6px">Respuesta correcta: <strong>${ej.answer}</strong></div>
              ${this._stepsHtml(ej.solution_steps)}
            </div>
          </div>`;
      }
      answerHtml = `
        <div style="display:flex;gap:8px;align-items:center;margin-top:14px;opacity:.6">
          <input type="text" class="ej-input" value="${(intento.studentAnswer || '').replace(/"/g, '&quot;')}" disabled>
          <button class="btn btn-primary" disabled>Verificar</button>
        </div>`;
    } else {
      const placeholder = ej.type === 'find_error'
        ? 'Escribí lo que notás en este ejercicio…'
        : 'Escribí tu respuesta con unidades (ej: 20 m/s)…';
      answerHtml = `
        <div style="display:flex;gap:8px;align-items:center;margin-top:14px">
          <input type="text" id="ej-input" class="ej-input" placeholder="${placeholder}"
            onkeydown="if(event.key==='Enter') AlumnoEjercicios.verificar()">
          <button class="btn btn-primary" onclick="AlumnoEjercicios.verificar()">Verificar</button>
        </div>`;
    }

    const typeTag = ej.type === 'find_error'
      ? '<span class="ej-type-tag ej-type-err">Análisis</span>'
      : '<span class="ej-type-tag">Resolución</span>';

    document.getElementById('ejercicios-progress-bar').style.width = pct + '%';
    document.getElementById('ejercicios-progress-text').textContent = `${respondidos} / ${total} completados`;

    document.getElementById('ejercicios-body').innerHTML = `
      <div class="ej-counter">${typeTag} Ejercicio ${idx + 1} de ${total}</div>
      <div class="ej-statement">${ej.statement.replace(/\n/g, '<br>')}</div>
      ${answerHtml}
      ${feedbackHtml}
    `;

    document.getElementById('ej-prev-btn').disabled = idx === 0;
    document.getElementById('ej-next-btn').disabled = idx === total - 1;

    // Focus input if not answered
    if (!intento?.answered) {
      setTimeout(() => document.getElementById('ej-input')?.focus(), 50);
    }
  },

  _stepsHtml(steps) {
    if (!Array.isArray(steps) || !steps.length) return '';
    return `<div class="ej-steps">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:4px">Procedimiento:</div>
      ${steps.map(s => `<div class="ej-step">→ ${s}</div>`).join('')}
    </div>`;
  },

  verificar() {
    const ej     = this._exercises[this._current];
    const input  = document.getElementById('ej-input');
    const raw    = input?.value.trim();
    if (!raw) { Utils.toast('Escribí una respuesta primero', 'error'); return; }

    let correct = false;

    if (ej.type === 'find_error') {
      // Always "reveal" — can't auto-grade descriptive answers
      correct = null;
    } else if (ej.answer_numeric !== null && ej.answer_numeric !== undefined) {
      // Extract number from student answer
      const match = raw.replace(',', '.').match(/-?\d+\.?\d*/);
      if (match) {
        const val = parseFloat(match[0]);
        const expected = parseFloat(ej.answer_numeric);
        const tol = expected === 0 ? 0.01 : Math.abs(expected * (ej.tolerance ?? 0.05));
        correct = Math.abs(val - expected) <= tol;
      }
    } else {
      // String comparison
      correct = raw.toLowerCase().replace(/\s/g, '') === (ej.answer || '').toLowerCase().replace(/\s/g, '');
    }

    this._attempts[ej.id] = { answered: true, correct, studentAnswer: raw };
    this._renderEjercicio();
  },

  siguiente() {
    if (this._current < this._exercises.length - 1) {
      this._current++;
      this._renderEjercicio();
    }
  },

  anterior() {
    if (this._current > 0) {
      this._current--;
      this._renderEjercicio();
    }
  },

  imprimir() {
    const container = document.getElementById('ejercicios-print-body');
    const rows = this._exercises.map((ej, i) => `
      <div class="eprint-row">
        <div class="eprint-num">${i + 1}.</div>
        <div class="eprint-content">
          <div class="eprint-statement">${ej.statement.replace(/\n/g, '<br>')}</div>
          <div class="eprint-answer-line">Respuesta: _____________________________________________</div>
        </div>
      </div>`).join('');

    container.innerHTML = `
      <div class="eprint-header">
        <div class="eprint-title">EJERCICIOS — ${this._unitTitle.toUpperCase()}</div>
        <div class="eprint-meta">Nombre y apellido: ____________________________ Fecha: ___________</div>
      </div>
      ${rows}`;

    window.print();
  },
};
