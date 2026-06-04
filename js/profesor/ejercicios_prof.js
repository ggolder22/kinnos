const ProfesorEjercicios = {
  _unitId:    null,
  _unitTitle: '',
  _tab:       'ejercicios',

  async abrir(unitId, unitTitle) {
    this._unitId    = unitId;
    this._unitTitle = unitTitle;
    this._tab       = 'ejercicios';
    document.getElementById('ejerc-prof-title').textContent = `Ejercicios — ${unitTitle}`;
    document.getElementById('ejerc-form-area').classList.add('hidden');
    document.getElementById('ejerc-prof-modal').classList.remove('hidden');
    this.switchTab('ejercicios');
  },

  cerrar() {
    document.getElementById('ejerc-prof-modal').classList.add('hidden');
  },

  switchTab(tab) {
    this._tab = tab;
    document.querySelectorAll('.ejerc-tab').forEach(t =>
      t.classList.toggle('active', t.dataset.tab === tab)
    );
    document.getElementById('ejerc-list-header').style.display  = tab === 'ejercicios' ? '' : 'none';
    document.getElementById('ejerc-form-area').classList.add('hidden');
    if (tab === 'ejercicios') this._loadEjercicios();
    else                      this._loadResultados();
  },

  // ── Ejercicios ────────────────────────────────────────────

  async _loadEjercicios() {
    const el = document.getElementById('ejerc-prof-body');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: ejercicios } = await sb.from('unit_exercises')
      .select('*').eq('unit_id', this._unitId).order('order_num');

    const exIds = (ejercicios || []).map(e => e.id);
    let stats = {};

    if (exIds.length) {
      const { data: attempts } = await sb.from('student_exercise_attempts')
        .select('exercise_id, is_correct').in('exercise_id', exIds);
      for (const a of (attempts || [])) {
        if (!stats[a.exercise_id]) stats[a.exercise_id] = { total: 0, correct: 0 };
        stats[a.exercise_id].total++;
        if (a.is_correct) stats[a.exercise_id].correct++;
      }
    }

    this._renderEjercicios(ejercicios || [], stats);
  },

  _renderEjercicios(ejercicios, stats) {
    const el = document.getElementById('ejerc-prof-body');

    const rows = ejercicios.map(e => {
      const s   = stats[e.id] || { total: 0, correct: 0 };
      const pct = s.total > 0 ? Math.round(s.correct / s.total * 100) : null;
      const tag = e.type === 'find_error'
        ? '<span class="badge badge-practice" style="font-size:.65rem">Análisis</span>'
        : '<span class="badge badge-active"   style="font-size:.65rem">Resolución</span>';
      const statsText = s.total > 0
        ? `${s.total} intento${s.total > 1 ? 's' : ''} · ${pct}% correctos`
        : 'Sin intentos aún';
      const stmt = e.statement.replace(/\n/g,' ');
      const truncated = stmt.length > 90 ? stmt.slice(0, 90) + '…' : stmt;
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:.68rem;font-weight:700;color:var(--text-3);min-width:22px">#${e.order_num}</span>
          <div style="flex:1;min-width:0">
            <div style="margin-bottom:3px">${tag}</div>
            <div style="font-size:.85rem;color:var(--text-1);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${truncated}</div>
            <div style="font-size:.73rem;color:var(--text-3);margin-top:2px">${statsText}</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="ProfesorEjercicios.eliminar('${e.id}')">✕</button>
        </div>`;
    }).join('');

    el.innerHTML = ejercicios.length
      ? rows
      : '<div style="padding:24px;text-align:center;color:var(--text-3);font-size:.85rem">No hay ejercicios. Agregá el primero.</div>';
  },

  // ── Resultados ────────────────────────────────────────────

  async _loadResultados() {
    const el = document.getElementById('ejerc-prof-body');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: ejercicios } = await sb.from('unit_exercises')
      .select('id').eq('unit_id', this._unitId);

    if (!ejercicios?.length) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">No hay ejercicios cargados para esta unidad.</div>';
      return;
    }

    const { data: attempts } = await sb.from('student_exercise_attempts')
      .select('student_id, exercise_id, is_correct, students(full_name)')
      .in('exercise_id', ejercicios.map(e => e.id));

    if (!attempts?.length) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3)">Ningún alumno ha resuelto ejercicios todavía.</div>';
      return;
    }

    const total = ejercicios.length;
    const byStudent = {};
    for (const a of attempts) {
      if (!byStudent[a.student_id]) {
        byStudent[a.student_id] = { name: a.students?.full_name || '—', intentos: 0, correctos: 0 };
      }
      byStudent[a.student_id].intentos++;
      if (a.is_correct) byStudent[a.student_id].correctos++;
    }

    const rows = Object.values(byStudent)
      .sort((a, b) => (b.correctos / b.intentos) - (a.correctos / a.intentos))
      .map(s => {
        const pct   = s.intentos > 0 ? Math.round(s.correctos / s.intentos * 100) : 0;
        const color = pct >= 70 ? 'var(--success)' : pct >= 50 ? '#fbbf24' : 'var(--danger)';
        return `
          <div style="display:flex;align-items:center;gap:14px;padding:11px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1;min-width:0">
              <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">${s.name}</div>
              <div style="font-size:.73rem;color:var(--text-3);margin-top:2px">
                ${s.correctos} correctos de ${s.intentos} intentados
                <span style="margin-left:6px;opacity:.6">(${total} ejercicios totales)</span>
              </div>
            </div>
            <div style="text-align:right;min-width:70px">
              <div style="font-size:1.05rem;font-weight:700;color:${color}">${pct}%</div>
              <div style="height:4px;width:70px;background:var(--border);border-radius:4px;margin-top:4px">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width .3s"></div>
              </div>
            </div>
          </div>`;
      }).join('');

    el.innerHTML = `
      <div style="font-size:.72rem;color:var(--text-3);margin-bottom:10px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">
        ${Object.keys(byStudent).length} alumno${Object.keys(byStudent).length > 1 ? 's' : ''} · ${total} ejercicios
      </div>
      ${rows}`;
  },

  // ── Agregar ejercicio ──────────────────────────────────────

  abrirFormulario() {
    const area = document.getElementById('ejerc-form-area');
    area.classList.remove('hidden');
    document.getElementById('ejerc-form-type').value      = 'solve';
    document.getElementById('ejerc-form-statement').value = '';
    document.getElementById('ejerc-form-answer').value    = '';
    document.getElementById('ejerc-form-numeric').value   = '';
    document.getElementById('ejerc-form-steps').value     = '';
    document.getElementById('ejerc-form-error-exp').value = '';
    this._toggleFormFields();
    document.getElementById('ejerc-form-statement').focus();
  },

  _toggleFormFields() {
    const type = document.getElementById('ejerc-form-type').value;
    document.getElementById('ejerc-form-solve-fields').style.display      = type === 'solve'      ? '' : 'none';
    document.getElementById('ejerc-form-error-fields').style.display      = type === 'find_error' ? '' : 'none';
  },

  async guardar() {
    const btn       = document.getElementById('ejerc-form-save');
    const type      = document.getElementById('ejerc-form-type').value;
    const statement = document.getElementById('ejerc-form-statement').value.trim();
    if (!statement) { Utils.toast('El enunciado es obligatorio', 'error'); return; }

    const { count } = await sb.from('unit_exercises')
      .select('*', { count: 'exact', head: true }).eq('unit_id', this._unitId);

    const payload = { unit_id: this._unitId, order_num: (count || 0) + 1, type, statement };

    if (type === 'solve') {
      payload.answer         = document.getElementById('ejerc-form-answer').value.trim()  || null;
      payload.answer_numeric = parseFloat(document.getElementById('ejerc-form-numeric').value.replace(',','.')) || null;
      const steps            = document.getElementById('ejerc-form-steps').value.trim();
      payload.solution_steps = steps ? steps.split('\n').map(s => s.trim()).filter(Boolean) : null;
    } else {
      payload.has_error         = true;
      payload.error_explanation = document.getElementById('ejerc-form-error-exp').value.trim() || null;
    }

    Utils.btnLoading(btn, true);
    const { error } = await sb.from('unit_exercises').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Ejercicio agregado');
    document.getElementById('ejerc-form-area').classList.add('hidden');
    this._loadEjercicios();
  },

  async eliminar(id) {
    if (!await Utils.confirmar('¿Eliminar este ejercicio?')) return;
    const { error } = await sb.from('unit_exercises').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Ejercicio eliminado');
    this._loadEjercicios();
  },
};
