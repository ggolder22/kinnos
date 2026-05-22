const PLAN_SECCIONES = [
  {
    id:          'fundamentacion',
    label:       '1. Fundamentación',
    placeholder: 'Justificación de la materia en el contexto de la carrera, su relevancia para la formación técnico-profesional del estudiante y articulación con otras materias del plan de estudios…',
    rows: 5,
  },
  {
    id:          'objetivos',
    label:       '2. Objetivos de aprendizaje',
    placeholder: 'Al finalizar el cursado, el estudiante será capaz de:\n- Identificar y aplicar…\n- Analizar…\n- Resolver…',
    rows: 5,
  },
  {
    id:          'contenidos',
    label:       '3. Contenidos',
    placeholder: 'Unidad 1: …\n  - Tema 1\n  - Tema 2\n\nUnidad 2: …',
    rows: 8,
  },
  {
    id:          'metodologia',
    label:       '4. Metodología y estrategias didácticas',
    placeholder: 'Clases teóricas expositivas, resolución de problemas, trabajos prácticos, laboratorio, estudios de caso, trabajo grupal…',
    rows: 4,
  },
  {
    id:          'evaluacion',
    label:       '5. Evaluación',
    placeholder: 'Criterios de evaluación:\n- …\n\nInstrumentos: parciales escritos, trabajos prácticos, informes de laboratorio…\n\nCondiciones de acreditación y promoción:\n- Nota mínima de aprobación: …\n- Asistencia mínima: …',
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
    placeholder: 'Marzo:     Unidad 1 — …\nAbril:     Unidad 2 — …\nMayo:      Unidad 3 — …\nJunio:     1° Parcial\n…',
    rows: 6,
  },
];

const ProfesorPlanificacion = {
  _planning: null,

  async init() {
    const el      = document.getElementById('planificacion-content');
    el.innerHTML  = '<div class="loading">Cargando…</div>';

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
        .select('unit_num, title, topics')
        .eq('subject_id', materia.id)
        .order('unit_num'),
      sb.from('subjects')
        .select('hs_semana, hs_total')
        .eq('id', materia.id)
        .single(),
    ]);

    this._planning = planning;

    // Pre-populate contenidos from existing units if no planning yet
    let contenidosDefault = '';
    if (!planning && units?.length) {
      contenidosDefault = units.map(u => {
        const topics = Array.isArray(u.topics) && u.topics.length
          ? u.topics.map(t => `  - ${t}`).join('\n')
          : '';
        return `Unidad ${u.unit_num}: ${u.title}${topics ? '\n' + topics : ''}`;
      }).join('\n\n');
    }

    this._render(planning, contenidosDefault, subject);
  },

  _render(planning, contenidosDefault, subject) {
    const el      = document.getElementById('planificacion-content');
    const materia = ProfesorState.materia;
    const session = Auth.session();
    const ciclo   = new Date().getFullYear();

    const inst    = materia.careers?.institutions?.name || '—';
    const carrera = materia.careers?.name               || '—';
    const yearStr = materia.year ? `${materia.year}° Año` : '—';
    const hsSem   = subject?.hs_semana ? `${subject.hs_semana} hs/semana` : '—';
    const hsTot   = subject?.hs_total  ? `${subject.hs_total} hs totales` : '—';

    const sectionsHtml = PLAN_SECCIONES.map(s => {
      const val = planning
        ? (planning[s.id] || '')
        : (s.id === 'contenidos' ? contenidosDefault : '');
      return `
        <div class="plan-section">
          <div class="plan-section-label">${s.label}</div>
          <textarea class="plan-textarea" id="plan-${s.id}"
            placeholder="${s.placeholder.replace(/"/g, '&quot;')}"
            rows="${s.rows}">${val}</textarea>
        </div>`;
    }).join('');

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

      <div class="plan-sections">${sectionsHtml}</div>

      <div class="plan-actions">
        ${lastSaved}
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" onclick="ProfesorPlanificacion.imprimir()">Imprimir / PDF</button>
          <button class="btn btn-primary" id="plan-save-btn" onclick="ProfesorPlanificacion.save()">Guardar planificación</button>
        </div>
      </div>
    `;
  },

  async save() {
    const btn     = document.getElementById('plan-save-btn');
    const session = Auth.session();
    const materia = ProfesorState.materia;
    const ciclo   = new Date().getFullYear();

    const payload = {
      professor_id:   session.id,
      subject_id:     materia.id,
      anio_academico: ciclo,
      updated_at:     new Date().toISOString(),
    };
    for (const s of PLAN_SECCIONES) {
      payload[s.id] = document.getElementById(`plan-${s.id}`)?.value.trim() || null;
    }

    Utils.btnLoading(btn, true);
    let error;
    if (this._planning) {
      ({ error } = await sb.from('subject_plannings').update(payload).eq('id', this._planning.id));
    } else {
      ({ error } = await sb.from('subject_plannings').insert(payload));
    }
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast('Planificación guardada');
    this.init();
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

    let bodyHtml = '';
    for (const s of PLAN_SECCIONES) {
      const val = document.getElementById(`plan-${s.id}`)?.value || '';
      bodyHtml += `
        <div class="plan-print-section">
          <h3>${s.label}</h3>
          <p>${val || '(sin completar)'}</p>
        </div>`;
    }
    document.getElementById('pp-body').innerHTML = bodyHtml;

    window.print();
  },
};
