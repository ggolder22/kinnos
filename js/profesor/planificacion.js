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
    await this._cargarCondicion();
  },

  // ── Condición de la materia (Regular / Promocional) ──────────────
  // Se carga una vez por ciclo lectivo y queda bloqueada; para cambiarla
  // el profesor pide autorización y la resuelve un preceptor.
  // Tablas: subject_conditions + condition_change_requests (sql/condicion-materia.sql)

  CONDICIONES: ['Regular', 'Promocional'],
  _condicion:  null,
  _solicitud:  null, // la última solicitud de cambio de este ciclo (pendiente o resuelta)

  async _cargarCondicion() {
    const materia = ProfesorState.materia;
    const ciclo   = new Date().getFullYear();
    const [{ data: cond }, { data: sols }] = await Promise.all([
      sb.from('subject_conditions').select('*')
        .eq('subject_id', materia.id).eq('anio_academico', ciclo).maybeSingle(),
      sb.from('condition_change_requests').select('*')
        .eq('subject_id', materia.id).eq('anio_academico', ciclo)
        .order('requested_at', { ascending: false }).limit(1),
    ]);
    this._condicion = cond || null;
    this._solicitud = sols?.[0] || null;
    this._renderCondicion();
  },

  _renderCondicion(mostrarFormSolicitud = false) {
    const el = document.getElementById('plan-condicion');
    if (!el) return;
    const c = this._condicion, s = this._solicitud;
    const esc = t => String(t ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

    // Todavía no se cargó: desplegable + guardar
    if (!c) {
      el.innerHTML = `
        <div class="plan-section-label">Condición de la materia</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <select id="plan-condicion-select" style="width:auto;min-width:200px">
            <option value="">Elegí la condición…</option>
            ${this.CONDICIONES.map(o => `<option value="${o}">${o}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" id="plan-condicion-btn" onclick="ProfesorPlanificacion.guardarCondicion()">Guardar condición</button>
        </div>
        <div class="plan-section-hint" style="margin-top:8px">
          ⚠ Una vez guardada <strong>no se puede cambiar</strong>: para modificarla vas a tener que pedir autorización a Preceptoría.
        </div>`;
      return;
    }

    const pendiente = s?.status === 'pending' ? s : null;
    const resuelta  = s && s.status !== 'pending' ? s : null;

    let solicitudHtml = '';
    if (pendiente) {
      solicitudHtml = `
        <div style="margin-top:12px;padding:10px 12px;border:1px solid var(--warning);border-radius:8px;font-size:.82rem">
          <div style="color:var(--warning);font-weight:600">⏳ Pediste cambiarla a ${pendiente.condicion_nueva} — esperando a Preceptoría</div>
          <div style="color:var(--text-3);margin-top:4px">Motivo: ${esc(pendiente.motivo)} · ${Utils.formatDate(pendiente.requested_at)}</div>
          <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="ProfesorPlanificacion.cancelarSolicitud()">Cancelar solicitud</button>
        </div>`;
    } else if (mostrarFormSolicitud) {
      const nueva = this.CONDICIONES.find(o => o !== c.condicion);
      solicitudHtml = `
        <div style="margin-top:12px;padding:12px;border:1px solid var(--border);border-radius:8px">
          <div style="font-size:.85rem;color:var(--text-1);margin-bottom:8px">Pedir cambio de <strong>${c.condicion}</strong> a <strong>${nueva}</strong></div>
          <textarea id="plan-condicion-motivo" rows="2" placeholder="Motivo del cambio (obligatorio)" style="width:100%"></textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-ghost btn-sm" onclick="ProfesorPlanificacion._renderCondicion(false)">Cancelar</button>
            <button class="btn btn-primary btn-sm" id="plan-condicion-sol-btn" onclick="ProfesorPlanificacion.enviarSolicitud()">Enviar a Preceptoría</button>
          </div>
        </div>`;
    } else {
      solicitudHtml = `
        ${resuelta ? `
          <div style="margin-top:10px;font-size:.8rem;color:${resuelta.status === 'approved' ? 'var(--success)' : 'var(--danger)'}">
            ${resuelta.status === 'approved' ? '✓ Aprobado' : '✗ Rechazado'} el pedido de cambio a ${resuelta.condicion_nueva}
            ${resuelta.resolved_by_name ? '— ' + esc(resuelta.resolved_by_name) : ''}${resuelta.resolved_at ? ', ' + Utils.formatDate(resuelta.resolved_at) : ''}
            ${resuelta.respuesta ? `<div style="color:var(--text-3);margin-top:2px">"${esc(resuelta.respuesta)}"</div>` : ''}
          </div>` : ''}
        <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="ProfesorPlanificacion._renderCondicion(true)">Solicitar cambio</button>`;
    }

    el.innerHTML = `
      <div class="plan-section-label">Condición de la materia</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <span class="badge ${c.condicion === 'Promocional' ? 'badge-green' : 'badge-indigo'}" style="font-size:.85rem;padding:4px 14px">🔒 ${c.condicion}</span>
        <span style="font-size:.75rem;color:var(--text-3)">Cargada por ${esc(c.set_by_name || '—')} el ${Utils.formatDate(c.set_at)}</span>
      </div>
      ${solicitudHtml}`;
  },

  async guardarCondicion() {
    const valor = document.getElementById('plan-condicion-select').value;
    if (!valor) { Utils.toast('Elegí Regular o Promocional', 'error'); return; }
    if (!await Utils.confirmar(`¿Guardar la condición "${valor}"?\n\nDespués no se puede cambiar sin autorización de Preceptoría.`)) return;

    const session = Auth.session();
    const btn = document.getElementById('plan-condicion-btn');
    Utils.btnLoading(btn, true);
    const { error } = await sb.from('subject_conditions').insert({
      subject_id: ProfesorState.materia.id,
      anio_academico: new Date().getFullYear(),
      condicion: valor,
      set_by_professor_id: session.id,
      set_by_name: session.nombre || `DNI ${session.dni}`,
    });
    Utils.btnLoading(btn, false);
    if (error) {
      // Otro profesor de la misma materia la cargó recién
      Utils.toast(error.code === '23505' ? 'La condición ya había sido cargada por otro profesor.' : 'Error: ' + error.message, 'error');
    } else {
      Utils.toast(`Condición guardada: ${valor}`);
    }
    await this._cargarCondicion();
  },

  async enviarSolicitud() {
    const motivo = document.getElementById('plan-condicion-motivo').value.trim();
    if (!motivo) { Utils.toast('Escribí el motivo del cambio', 'error'); return; }
    const session = Auth.session();
    const c = this._condicion;
    const btn = document.getElementById('plan-condicion-sol-btn');
    Utils.btnLoading(btn, true);
    const { error } = await sb.from('condition_change_requests').insert({
      subject_id: c.subject_id,
      anio_academico: c.anio_academico,
      condicion_actual: c.condicion,
      condicion_nueva: this.CONDICIONES.find(o => o !== c.condicion),
      motivo,
      requested_by_professor_id: session.id,
      requested_by_name: session.nombre || `DNI ${session.dni}`,
    });
    Utils.btnLoading(btn, false);
    if (error) {
      Utils.toast(error.code === '23505' ? 'Ya hay una solicitud pendiente para esta materia.' : 'Error: ' + error.message, 'error');
    } else {
      Utils.toast('Solicitud enviada a Preceptoría');
    }
    await this._cargarCondicion();
  },

  async cancelarSolicitud() {
    if (!await Utils.confirmar('¿Cancelar la solicitud de cambio?')) return;
    const { error } = await sb.from('condition_change_requests').delete()
      .eq('id', this._solicitud.id).eq('status', 'pending');
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Solicitud cancelada');
    await this._cargarCondicion();
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

      <div class="plan-section" id="plan-condicion" style="margin-top:18px;padding:16px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px">
        <div class="loading">Cargando condición…</div>
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
    set('pp-condicion', this._condicion?.condicion || '(sin cargar)');

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
