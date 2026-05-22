const PLAN_SECCIONES_ANTES = [
  {
    id:          'fundamentacion',
    label:       '1. Fundamentación',
    placeholder: 'Justificación de la materia en el contexto de la carrera, su relevancia para la formación técnico-profesional del estudiante y articulación con otras materias del plan…',
    rows: 5,
  },
  {
    id:          'objetivos',
    label:       '2. Objetivos de aprendizaje',
    placeholder: 'Al finalizar el cursado, el estudiante será capaz de:\n- Identificar y aplicar…\n- Analizar…\n- Resolver…',
    rows: 5,
  },
];

const PLAN_SECCIONES_DESPUES = [
  {
    id:          'metodologia',
    label:       '4. Metodología y estrategias didácticas',
    placeholder: 'Clases teóricas expositivas, resolución de problemas, trabajos prácticos, laboratorio, estudios de caso…',
    rows: 4,
  },
  {
    id:          'evaluacion',
    label:       '5. Evaluación',
    placeholder: 'Criterios de evaluación:\n- …\n\nInstrumentos: parciales, TPs, informes…\n\nCondiciones de acreditación y promoción:\n- Nota mínima: …\n- Asistencia mínima: …',
    rows: 6,
  },
  {
    id:          'bibliografia',
    label:       '6. Bibliografía',
    placeholder: 'Obligatoria:\n- Autor, Título, Editorial, Año.\n\nComplementaria:\n- …',
    rows: 4,
  },
  {
    id:          'cronograma',
    label:       '7. Cronograma tentativo',
    placeholder: 'Marzo:   Unidad 1 — …\nAbril:   Unidad 2 — …\nMayo:    Unidad 3 — …\nJunio:   1° Parcial\n…',
    rows: 6,
  },
];

const UNIT_TAGS = [
  '', 'Teórica', 'Práctica', 'Laboratorio', 'Taller',
  'Trabajo Práctico', 'Seminario', 'Evaluación', 'Introducción', 'Repaso',
];

const ProfesorPlanificacion = {
  _planning:       null,
  _removedUnitIds: [],

  async init() {
    const el = document.getElementById('planificacion-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    this._removedUnitIds = [];

    const session = Auth.session();
    const materia = ProfesorState.materia;
    const ciclo   = new Date().getFullYear();

    const [
      { data: planning },
      { data: units },
      { data: subject },
    ] = await Promise.all([
      sb.from('subject_plannings')
        .select('*')
        .eq('professor_id', session.id)
        .eq('subject_id', materia.id)
        .eq('anio_academico', ciclo)
        .maybeSingle(),
      sb.from('units')
        .select('id, unit_num, title, tag, topics')
        .eq('subject_id', materia.id)
        .order('unit_num'),
      sb.from('subjects')
        .select('hs_semana, hs_total')
        .eq('id', materia.id)
        .single(),
    ]);

    this._planning = planning;
    this._render(planning, units || [], subject);
  },

  _render(planning, units, subject) {
    const el      = document.getElementById('planificacion-content');
    const materia = ProfesorState.materia;
    const session = Auth.session();
    const ciclo   = new Date().getFullYear();

    const inst    = materia.careers?.institutions?.name || '—';
    const carrera = materia.careers?.name               || '—';
    const yearStr = materia.year ? `${materia.year}° Año` : '—';
    const hsSem   = subject?.hs_semana ? `${subject.hs_semana} hs/sem` : '—';
    const hsTot   = subject?.hs_total  ? `${subject.hs_total} hs tot.` : '—';

    const seccAntes   = PLAN_SECCIONES_ANTES.map(s   => this._sectionHtml(s, planning?.[s.id] || '')).join('');
    const seccDespues = PLAN_SECCIONES_DESPUES.map(s => this._sectionHtml(s, planning?.[s.id] || '')).join('');
    const unitsHtml   = units.map((u, i) => this._unitRowHtml(i, u)).join('');

    const lastSaved = planning?.updated_at
      ? `<span style="font-size:.75rem;color:var(--text-3)">Último guardado: ${Utils.formatDate(planning.updated_at)}</span>`
      : '<span style="font-size:.75rem;color:var(--text-3)">Sin guardar</span>';

    el.innerHTML = `
      <div class="plan-header-card">
        <div class="plan-meta-grid">
          <div><span class="plan-meta-label">Institución</span><span class="plan-meta-val">${inst}</span></div>
          <div><span class="plan-meta-label">Carrera</span><span class="plan-meta-val">${carrera}</span></div>
          <div><span class="plan-meta-label">Espacio curricular</span><span class="plan-meta-val">${materia.name}</span></div>
          <div><span class="plan-meta-label">Año</span><span class="plan-meta-val">${yearStr}</span></div>
          <div><span class="plan-meta-label">Profesor/a</span><span class="plan-meta-val">${session.nombre || 'DNI ' + session.dni}</span></div>
          <div><span class="plan-meta-label">Ciclo lectivo</span><span class="plan-meta-val">${ciclo}</span></div>
          <div><span class="plan-meta-label">Carga horaria</span><span class="plan-meta-val">${hsSem} · ${hsTot}</span></div>
        </div>
      </div>

      <div class="plan-sections">
        ${seccAntes}

        <div class="plan-section">
          <div class="plan-section-label">3. Contenidos — Unidades</div>
          <div class="plan-section-hint">
            Definí las unidades del programa. Al guardar se sincronizan automáticamente con la pestaña Unidades.
          </div>
          <div id="plan-units-container">${unitsHtml}</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="ProfesorPlanificacion.addUnit()">
            + Agregar unidad
          </button>
        </div>

        ${seccDespues}
      </div>

      <div class="plan-actions">
        ${lastSaved}
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="ProfesorPlanificacion.imprimir()">Imprimir / PDF</button>
          <button class="btn btn-primary" id="plan-save-btn" onclick="ProfesorPlanificacion.save()">Guardar planificación</button>
        </div>
      </div>
    `;
  },

  _sectionHtml(s, val) {
    return `
      <div class="plan-section">
        <div class="plan-section-label">${s.label}</div>
        <textarea class="plan-textarea" id="plan-${s.id}"
          placeholder="${s.placeholder.replace(/"/g, '&quot;')}"
          rows="${s.rows}">${val}</textarea>
      </div>`;
  },

  _unitRowHtml(idx, unit) {
    const tagOpts = UNIT_TAGS.map(v =>
      `<option value="${v}" ${unit.tag === v ? 'selected' : ''}>${v || '— Sin etiqueta —'}</option>`
    ).join('');
    const topicsVal = Array.isArray(unit.topics) ? unit.topics.join('\n') : (unit.topics || '');
    return `
      <div class="plan-unit-row" data-unit-id="${unit.id || ''}" data-idx="${idx}">
        <div class="plan-unit-header">
          <span class="plan-unit-num">Unidad ${idx + 1}</span>
          <button class="btn btn-danger btn-sm plan-unit-row-remove" onclick="ProfesorPlanificacion.removeUnit(${idx})">✕</button>
        </div>
        <div class="plan-unit-body">
          <div style="display:grid;grid-template-columns:1fr 170px;gap:8px;align-items:start">
            <div class="form-group" style="margin:0">
              <label>Título *</label>
              <input type="text" class="plan-unit-title" placeholder="Ej: Fundamentos de la materia…"
                value="${(unit.title || '').replace(/"/g, '&quot;')}">
            </div>
            <div class="form-group" style="margin:0">
              <label>Etiqueta</label>
              <select class="plan-unit-tag">${tagOpts}</select>
            </div>
          </div>
          <div class="form-group" style="margin:8px 0 0">
            <label>Temas (uno por línea)</label>
            <textarea class="plan-unit-topics" rows="2"
              placeholder="Tema 1&#10;Tema 2&#10;…">${topicsVal}</textarea>
          </div>
        </div>
      </div>`;
  },

  addUnit() {
    const container = document.getElementById('plan-units-container');
    const idx = container.querySelectorAll('.plan-unit-row').length;
    const div = document.createElement('div');
    div.innerHTML = this._unitRowHtml(idx, { id: '', title: '', tag: '', topics: [] });
    container.appendChild(div.firstElementChild);
  },

  removeUnit(idx) {
    const rows  = document.querySelectorAll('.plan-unit-row');
    const row   = rows[idx];
    if (!row) return;
    const unitId = row.dataset.unitId;
    if (unitId) this._removedUnitIds.push(unitId);
    row.remove();
    document.querySelectorAll('.plan-unit-row').forEach((r, i) => {
      r.dataset.idx = i;
      r.querySelector('.plan-unit-num').textContent = `Unidad ${i + 1}`;
      r.querySelector('.plan-unit-row-remove').setAttribute('onclick', `ProfesorPlanificacion.removeUnit(${i})`);
    });
  },

  _getUnitsFromEditor() {
    return Array.from(document.querySelectorAll('.plan-unit-row')).map((row, i) => ({
      id:       row.dataset.unitId || null,
      unit_num: i + 1,
      title:    row.querySelector('.plan-unit-title').value.trim(),
      tag:      row.querySelector('.plan-unit-tag').value,
      topics:   row.querySelector('.plan-unit-topics').value
                  .split('\n').map(t => t.trim()).filter(Boolean),
    }));
  },

  async save() {
    const btn     = document.getElementById('plan-save-btn');
    const session = Auth.session();
    const materia = ProfesorState.materia;
    const ciclo   = new Date().getFullYear();

    const allUnits   = this._getUnitsFromEditor();
    const validUnits = allUnits.filter(u => u.title);

    // Auto-generate contenidos text for the DB field
    const contenidosAuto = validUnits.map(u => {
      const topics = u.topics.length ? '\n' + u.topics.map(t => `  - ${t}`).join('\n') : '';
      return `Unidad ${u.unit_num}: ${u.title}${topics}`;
    }).join('\n\n');

    const payload = {
      professor_id:   session.id,
      subject_id:     materia.id,
      anio_academico: ciclo,
      contenidos:     contenidosAuto || null,
      updated_at:     new Date().toISOString(),
    };
    for (const s of [...PLAN_SECCIONES_ANTES, ...PLAN_SECCIONES_DESPUES]) {
      payload[s.id] = document.getElementById(`plan-${s.id}`)?.value.trim() || null;
    }

    Utils.btnLoading(btn, true);

    let error;
    if (this._planning) {
      ({ error } = await sb.from('subject_plannings').update(payload).eq('id', this._planning.id));
    } else {
      ({ error } = await sb.from('subject_plannings').insert(payload));
    }

    if (!error) {
      error = await this._syncUnits(validUnits, materia.id);
    }

    Utils.btnLoading(btn, false);
    if (error) { Utils.toast('Error al guardar: ' + (error.message || error), 'error'); return; }
    Utils.toast('Planificación y unidades guardadas');
    this.init();
  },

  async _syncUnits(units, subjectId) {
    if (this._removedUnitIds.length) {
      const { error } = await sb.from('units').delete().in('id', this._removedUnitIds);
      if (error) return error;
      this._removedUnitIds = [];
    }
    for (const u of units) {
      const payload = {
        subject_id: subjectId,
        unit_num:   u.unit_num,
        title:      u.title,
        tag:        u.tag || null,
        topics:     u.topics,
        updated_at: new Date().toISOString(),
      };
      let error;
      if (u.id) {
        ({ error } = await sb.from('units').update(payload).eq('id', u.id));
      } else {
        ({ error } = await sb.from('units').insert({ ...payload, content: null, pdf_url: null }));
      }
      if (error) return error;
    }
    return null;
  },

  imprimir() {
    const materia = ProfesorState.materia;
    const session = Auth.session();
    const ciclo   = new Date().getFullYear();

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('pp-inst',    materia.careers?.institutions?.name || '—');
    set('pp-carrera', materia.careers?.name || '—');
    set('pp-materia', materia.name);
    set('pp-year',    materia.year ? `${materia.year}° Año` : '—');
    set('pp-prof',    session.nombre || 'DNI ' + session.dni);
    set('pp-ciclo',   String(ciclo));

    const units = this._getUnitsFromEditor().filter(u => u.title);
    const contenidosText = units.map(u => {
      const topics = u.topics.length ? '\n' + u.topics.map(t => `  - ${t}`).join('\n') : '';
      return `Unidad ${u.unit_num}: ${u.title}${u.tag ? ' [' + u.tag + ']' : ''}${topics}`;
    }).join('\n\n') || '(sin unidades definidas)';

    const renderSec = s => {
      const val = document.getElementById(`plan-${s.id}`)?.value || '';
      return `<div class="plan-print-section"><h3>${s.label}</h3><p>${val || '(sin completar)'}</p></div>`;
    };

    const beforeHtml   = PLAN_SECCIONES_ANTES.map(renderSec).join('');
    const contenidosHtml = `<div class="plan-print-section"><h3>3. Contenidos</h3><p>${contenidosText}</p></div>`;
    const afterHtml    = PLAN_SECCIONES_DESPUES.map(renderSec).join('');

    document.getElementById('pp-body').innerHTML = beforeHtml + contenidosHtml + afterHtml;
    window.print();
  },
};
