const PreceptorDashboard = {
  _alumnos: [],
  _enriched: [], // [{ status, materia, anio, division, fecha, studentId }]
  _filtroAnio: '',
  _filtroDivision: '',
  _vista: 'asistencia', // 'asistencia' | 'alumnos'
  _cuatrimestreActual: null, // 'Cuatrimestre 1' | 'Cuatrimestre 2', de institutions.cuatrimestre_actual
  _periodoMateria: '',       // '' (todo el año) | 'Cuatrimestre 1' | 'Cuatrimestre 2' — solo para la sección "Por materia"

  // Casos puntuales a resolver con el preceptor — no entran en los cálculos de asistencia
  // hasta que se decida qué hacer. Agregar acá { studentId, motivo } cuando haga falta.
  _pendientes: [
    { studentId: '24ee0fc2-1221-484e-9fa3-416ba82a80bf', subjectName: 'Informática Aplicada', motivo: 'Anotado en "Informática Aplicada" (materia de 1°) siendo alumno de 3°A. Definir si adeuda la materia (recursante) o es un error de inscripción.' },
    { studentId: '517ee448-4017-4c5a-99ef-b9d23a6da820', subjectName: 'Prácticas Profesionalizantes I', motivo: 'Anotada en "Prácticas Profesionalizantes I" (materia de 1°B) siendo alumna de 2°A. Definir si adeuda la materia (recursante) o es un error de inscripción.' },
    { studentId: 'cb60bed2-691e-4154-9df9-e6b5137a5060', subjectName: 'Prácticas Profesionalizantes I', motivo: 'Anotado en "Prácticas Profesionalizantes I" (materia de 1°B) siendo alumno de 2°A. Definir si adeuda la materia (recursante) o es un error de inscripción.' },
    { studentId: '7f89c65e-5cee-4ecb-902a-91dbaee15fb1', subjectName: 'Práctica Profesionalizante II', motivo: 'Anotada en "Práctica Profesionalizante II" (materia de 2°A) siendo alumna de 3°A. Definir si adeuda la materia (recursante) o es un error de inscripción.' },
    { studentId: '016d524e-52b9-4d93-a042-db4ddde6f359', subjectName: 'Práctica Profesionalizante II', motivo: 'Anotado en "Práctica Profesionalizante II" (materia de 2°A) siendo alumno de 1°B. Definir si adeuda la materia (recursante) o es un error de inscripción.' },
  ],

  // Umbrales de 3 niveles (más matiz que el binario 70% del resto de la app)
  UMBRAL_OK: 80,
  UMBRAL_MEDIO: 70,

  async init() {
    const el = document.getElementById('dashboard-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    if (!session.inst) {
      el.innerHTML = '<div class="empty-state"><p>Tu perfil no tiene institución asignada. Pedile al administrador que te la cargue.</p></div>';
      return;
    }

    const { data: inst } = await sb.from('institutions').select('cuatrimestre_actual').eq('id', session.inst).single();
    this._cuatrimestreActual = inst?.cuatrimestre_actual || null;
    this._periodoMateria = this._cuatrimestreActual || '';

    const { data: alumnos } = await sb.from('students').select('id, full_name, first_name, last_name, dni, anio, division').eq('institution_id', session.inst);
    this._alumnos = alumnos || [];
    const alumnoPorId = {};
    this._alumnos.forEach(a => { alumnoPorId[a.id] = a; });

    const { data: carreras } = await sb.from('careers').select('id').eq('institution_id', session.inst);
    const careerIds = (carreras || []).map(c => c.id);
    let materias = [];
    if (careerIds.length) {
      const { data } = await sb.from('subjects').select('id, name, despliegue').in('career_id', careerIds);
      materias = data || [];
    }
    const materiaPorId = {};
    materias.forEach(m => { materiaPorId[m.id] = m; });
    const subjectIds = materias.map(m => m.id);

    let sesiones = [];
    if (subjectIds.length) {
      const { data } = await sb.from('attendance_sessions').select('id, subject_id, session_date').in('subject_id', subjectIds);
      sesiones = data || [];
    }
    const sesionPorId = {};
    sesiones.forEach(s => { sesionPorId[s.id] = s; });
    const sessionIds = sesiones.map(s => s.id);

    let registros = [];
    if (sessionIds.length) {
      const { data } = await sb.from('attendance_records').select('session_id, student_id, status').in('session_id', sessionIds);
      registros = data || [];
    }

    // Set de "studentId|nombreMateria" a excluir — solo esa combinación puntual,
    // no todo el historial del alumno (puede tener asistencia real en sus propias materias).
    const pendientesSet = new Set(this._pendientes.map(p => `${p.studentId}|${p.subjectName}`));

    this._enriched = registros.map(r => {
      const s = sesionPorId[r.session_id];
      const a = alumnoPorId[r.student_id];
      if (!s || !a) return null;
      const nombreMateria = materiaPorId[s.subject_id]?.name;
      if (pendientesSet.has(`${r.student_id}|${nombreMateria}`)) return null; // caso puntual sin resolver — no computa
      return {
        status: r.status,
        studentId: r.student_id,
        materiaId: s.subject_id,
        materia: materiaPorId[s.subject_id]?.name || '—',
        despliegue: materiaPorId[s.subject_id]?.despliegue || null, // 'Cuatrimestre 1' | 'Cuatrimestre 2' | 'Anual' | null
        anioNum: a.anio || null,
        anio: a.anio ? `${a.anio}°` : 'Sin año',
        division: a.division || 'Sin división',
        fecha: s.session_date,
      };
    }).filter(Boolean);

    this._render();
  },

  // ── Menú de vista ──────────────────────────────────────────

  cambiarVista(v) {
    this._vista = v;
    this._render();
  },

  _vistaMenu() {
    const tab = (val, label, icon) => `
      <button onclick="PreceptorDashboard.cambiarVista('${val}')"
        style="padding:8px 16px;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;
          border:1px solid ${this._vista === val ? 'var(--accent)' : 'var(--border)'};
          background:${this._vista === val ? 'var(--accent)' : 'var(--bg-card)'};
          color:${this._vista === val ? '#fff' : 'var(--text-2)'}">${icon} ${label}</button>`;
    return `
      <div style="display:flex;gap:8px;margin-bottom:18px">
        ${tab('asistencia', 'Asistencia', '📋')}
        ${tab('alumnos', 'Alumnos', '👥')}
      </div>`;
  },

  // ── Filtros ──────────────────────────────────────────────

  filtrar(campo, value) {
    if (campo === 'anio')     this._filtroAnio     = value;
    if (campo === 'division') this._filtroDivision = value;
    this._render();
  },

  cambiarPeriodoMateria(value) {
    this._periodoMateria = value;
    this._render();
  },

  _alumnosFiltrados() {
    return this._alumnos.filter(a => {
      if (this._filtroAnio && String(a.anio || '') !== this._filtroAnio) return false;
      if (this._filtroDivision && (a.division || '') !== this._filtroDivision) return false;
      return true;
    });
  },

  _enrichedFiltrado() {
    return this._enriched.filter(e => {
      if (this._filtroAnio && String(e.anioNum || '') !== this._filtroAnio) return false;
      if (this._filtroDivision && e.division !== this._filtroDivision) return false;
      return true;
    });
  },

  // Un registro "pertenece" a un cuatrimestre si la materia es anual, no tiene
  // despliegue cargado (no le ocultamos nada a nadie por un dato faltante), o
  // coincide con el período pedido.
  _coincidePeriodo(e, periodo) {
    if (!periodo) return true; // 'todo el año'
    return !e.despliegue || e.despliegue === 'Anual' || e.despliegue === periodo;
  },

  // Registros del cuatrimestre ACTUAL (según institutions.cuatrimestre_actual) — esto
  // es lo que alimenta el número principal, los stat tiles y las tarjetas de arriba.
  _enrichedCuatrimestreActual() {
    return this._enrichedFiltrado().filter(e => this._coincidePeriodo(e, this._cuatrimestreActual));
  },

  // ── Color / estado de 3 niveles ───────────────────────────

  _nivel(pct) {
    if (pct === null) return null;
    if (pct >= this.UMBRAL_OK) return 'ok';
    if (pct >= this.UMBRAL_MEDIO) return 'medio';
    return 'critico';
  },

  _colorNivel(nivel) {
    return { ok: 'var(--success)', medio: 'var(--warning)', critico: 'var(--danger)' }[nivel] || 'var(--text-3)';
  },

  _trackNivel(nivel) {
    return {
      ok:      'rgba(34,197,94,.18)',
      medio:   'rgba(245,158,11,.18)',
      critico: 'rgba(239,68,68,.18)',
    }[nivel] || 'var(--border)';
  },

  _iconoNivel(nivel) {
    return { ok: '✓', medio: '⚠', critico: '✗' }[nivel] || '–';
  },

  // ── Render ───────────────────────────────────────────────

  _chips() {
    const chip = (val, label, campo, actual) => `
      <button onclick="PreceptorDashboard.filtrar('${campo}','${val}')"
        style="padding:6px 14px;border-radius:999px;font-size:.78rem;font-weight:600;cursor:pointer;
          border:1px solid ${actual === val ? 'var(--accent)' : 'var(--border)'};
          background:${actual === val ? 'var(--accent)' : 'var(--bg-card)'};
          color:${actual === val ? '#fff' : 'var(--text-2)'}">${label}</button>`;

    return `
      <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:24px">
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${chip('', 'Todos los años', 'anio', this._filtroAnio)}
          ${[1, 2, 3, 4].map(y => chip(String(y), `${y}°`, 'anio', this._filtroAnio)).join('')}
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${chip('', 'Ambas divisiones', 'division', this._filtroDivision)}
          ${chip('A', 'División A', 'division', this._filtroDivision)}
          ${chip('B', 'División B', 'division', this._filtroDivision)}
        </div>
      </div>`;
  },

  _gaugeSvg(pct) {
    const nivel = this._nivel(pct);
    const color = this._colorNivel(nivel);
    const r = 70, c = 2 * Math.PI * r;
    const frac = pct === null ? 0 : Math.max(0, Math.min(100, pct)) / 100;
    const offset = c * (1 - frac);
    return `
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="var(--border)" stroke-width="16"/>
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="${color}" stroke-width="16"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
          transform="rotate(-90 90 90)" style="transition:stroke-dashoffset .4s"/>
        <text x="90" y="86" text-anchor="middle" style="font-size:2.1rem;font-weight:700;fill:var(--text-1)">${pct === null ? '—' : pct + '%'}</text>
        <text x="90" y="110" text-anchor="middle" style="font-size:.72rem;fill:var(--text-3);text-transform:uppercase;letter-spacing:.05em">asistencia</text>
      </svg>`;
  },

  _statTile(valor, label, color) {
    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px;flex:1;min-width:120px">
        <div style="font-size:1.6rem;font-weight:700;color:${color || 'var(--text-1)'}">${valor}</div>
        <div style="font-size:.74rem;color:var(--text-3);margin-top:2px">${label}</div>
      </div>`;
  },

  _meterRow(label, pct, total) {
    const nivel = this._nivel(pct);
    const color = this._colorNivel(nivel);
    const trackBg = this._trackNivel(nivel);
    const width = pct === null ? 0 : pct;

    let estadoTxt;
    if (total === 0) estadoTxt = '<span style="color:var(--text-3)">Sin datos</span>';
    else if (pct === null) estadoTxt = '<span style="color:var(--text-3)">Todo justificado</span>';
    else estadoTxt = `<span style="color:${color};font-weight:700">${this._iconoNivel(nivel)} ${pct}%</span>`;

    return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-size:.82rem;color:var(--text-1)">${label}</span>
          <span style="font-size:.78rem">${estadoTxt}</span>
        </div>
        <div style="height:8px;border-radius:999px;background:${trackBg}">
          <div style="height:100%;width:${width}%;border-radius:999px;background:${color};transition:width .4s"></div>
        </div>
      </div>`;
  },

  _grupoCard(titulo, grupos) {
    if (!grupos.length) return '';
    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:18px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:14px">${titulo}</div>
        ${grupos.map(g => this._meterRow(g.label, g.pct, g.total)).join('')}
      </div>`;
  },

  _agrupar(enriched, keyFn) {
    const grupos = {};
    enriched.forEach(e => { (grupos[keyFn(e)] = grupos[keyFn(e)] || []).push(e); });
    return Object.entries(grupos).map(([label, recs]) => {
      const { pct } = Asistencia.calcular(recs);
      return { label, pct, total: recs.length };
    }).sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1)); // peor primero
  },

  // ── Gauge / barras para conteo de alumnos (sin semántica de riesgo) ──

  _gaugeSvgCount(count, pct) {
    const color = 'var(--accent)';
    const r = 70, c = 2 * Math.PI * r;
    const frac = pct === null ? 0 : Math.max(0, Math.min(100, pct)) / 100;
    const offset = c * (1 - frac);
    return `
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="var(--border)" stroke-width="16"/>
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="${color}" stroke-width="16"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"
          transform="rotate(-90 90 90)" style="transition:stroke-dashoffset .4s"/>
        <text x="90" y="86" text-anchor="middle" style="font-size:1.9rem;font-weight:700;fill:var(--text-1)">${count}</text>
        <text x="90" y="110" text-anchor="middle" style="font-size:.72rem;fill:var(--text-3);text-transform:uppercase;letter-spacing:.05em">alumnos${pct !== null ? ' · ' + pct + '%' : ''}</text>
      </svg>`;
  },

  _meterRowCount(label, total, max) {
    const width = max ? Math.round(total / max * 100) : 0;
    return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
          <span style="font-size:.82rem;color:var(--text-1)">${label}</span>
          <span style="font-size:.78rem;font-weight:700;color:var(--text-1)">${total}</span>
        </div>
        <div style="height:8px;border-radius:999px;background:var(--border)">
          <div style="height:100%;width:${width}%;border-radius:999px;background:var(--accent);transition:width .4s"></div>
        </div>
      </div>`;
  },

  _grupoCardCount(titulo, grupos) {
    if (!grupos.length) return '';
    const max = Math.max(...grupos.map(g => g.total), 1);
    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:18px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:14px">${titulo}</div>
        ${grupos.map(g => this._meterRowCount(g.label, g.total, max)).join('')}
      </div>`;
  },

  _agruparAlumnos(alumnos, keyFn) {
    const grupos = {};
    alumnos.forEach(a => { const k = keyFn(a); (grupos[k] = grupos[k] || []).push(a); });
    return Object.entries(grupos)
      .map(([label, recs]) => ({ label, total: recs.length }))
      .sort((a, b) => b.total - a.total);
  },

  _renderAlumnos() {
    const el = document.getElementById('dashboard-content');
    const totalInst = this._alumnos.length;
    const alumnos = this._alumnosFiltrados();
    const count = alumnos.length;
    const pct = totalInst ? Math.round(count / totalInst * 100) : null;

    const sinAnio     = alumnos.filter(a => !a.anio).length;
    const sinDivision = alumnos.filter(a => !a.division).length;

    const porAnio          = this._agruparAlumnos(alumnos, a => a.anio ? `${a.anio}°` : 'Sin año');
    const porDivision       = this._agruparAlumnos(alumnos, a => a.division || 'Sin división');
    const porAnioDivision  = this._agruparAlumnos(alumnos, a => `${a.anio ? a.anio + '°' : 'Sin año'}${a.division ? ' ' + a.division : ''}`);

    const conError = alumnos
      .filter(a => !a.anio || !a.division)
      .sort((a, b) => Utils.nombrePlanilla(a).localeCompare(Utils.nombrePlanilla(b)));

    el.innerHTML = `
      <div class="page-header"><h3>Dashboard</h3></div>
      ${this._vistaMenu()}
      ${this._chips()}

      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-bottom:28px">
        <div style="flex-shrink:0">${this._gaugeSvgCount(count, pct)}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;flex:1;min-width:260px">
          ${this._statTile(totalInst, 'Total en la institución', 'var(--text-1)')}
          ${this._statTile(count, 'Alumnos en esta vista', 'var(--accent)')}
          ${this._statTile(sinAnio, 'Sin año cargado', sinAnio ? 'var(--warning)' : 'var(--success)')}
          ${this._statTile(sinDivision, 'Sin división cargada', sinDivision ? 'var(--warning)' : 'var(--success)')}
        </div>
      </div>

      ${count ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
          ${this._grupoCardCount('Por año', porAnio)}
          ${this._grupoCardCount('Por división', porDivision)}
          ${this._grupoCardCount('Por año y división', porAnioDivision)}
        </div>` : `
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos para este filtro.</p></div>`}

      ${this._listaConError(conError)}
      ${this._listaPendientes()}
    `;
  },

  _listaConError(conError) {
    if (!conError.length) return '';
    const rows = conError.map(a => {
      const motivo = !a.anio && !a.division
        ? 'Sin año ni división'
        : !a.anio ? 'Sin año' : 'Sin división';
      return `
        <tr>
          <td class="text-main">${Utils.nombrePlanilla(a)}</td>
          <td>${a.dni || '—'}</td>
          <td><span style="color:var(--warning);font-weight:600">⚠ ${motivo}</span></td>
        </tr>`;
    }).join('');

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-top:16px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:14px">
          Alumnos con datos incompletos (${conError.length})
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Alumno</th><th>DNI</th><th>Falta</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="font-size:.76rem;color:var(--text-3);margin-top:10px">Completalos desde el panel de Admin → Alumnos.</div>
      </div>`;
  },

  _listaPendientes() {
    if (!this._pendientes.length) return '';
    const alumnoPorId = {};
    this._alumnos.forEach(a => { alumnoPorId[a.id] = a; });

    const cards = this._pendientes.map(p => {
      const a = alumnoPorId[p.studentId];
      if (!a) return '';
      return `
        <div style="background:var(--bg-card);border:1px solid var(--warning);border-radius:12px;padding:16px;margin-top:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
            <div>
              <div style="font-weight:600;color:var(--text-1)">${Utils.nombrePlanilla(a)}</div>
              <div style="font-size:.75rem;color:var(--text-3)">DNI ${a.dni || '—'} · ${a.anio ? a.anio + '°' : '—'}${a.division ? ' ' + a.division : ''}</div>
            </div>
            <span style="color:var(--warning);font-weight:600;font-size:.8rem;white-space:nowrap">⏳ Pendiente</span>
          </div>
          <div style="font-size:.82rem;color:var(--text-2);margin-top:8px">${p.motivo}</div>
        </div>`;
    }).join('');

    return `
      <div style="margin-top:24px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--warning);margin-bottom:4px">
          Casos para resolver (${this._pendientes.length})
        </div>
        <div style="font-size:.76rem;color:var(--text-3)">No se cuentan en los cálculos de asistencia hasta que se decida qué hacer.</div>
        ${cards}
      </div>`;
  },

  _render() {
    if (this._vista === 'alumnos') { this._renderAlumnos(); return; }
    this._renderAsistencia();
  },

  _periodoMateriaChips() {
    const chip = (val, label) => `
      <button onclick="PreceptorDashboard.cambiarPeriodoMateria('${val}')"
        style="padding:6px 14px;border-radius:999px;font-size:.78rem;font-weight:600;cursor:pointer;
          border:1px solid ${this._periodoMateria === val ? 'var(--accent)' : 'var(--border)'};
          background:${this._periodoMateria === val ? 'var(--accent)' : 'var(--bg-base)'};
          color:${this._periodoMateria === val ? '#fff' : 'var(--text-2)'}">${label}</button>`;
    return `
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px">
        ${chip('', 'Todo el año (acumulado)')}
        ${chip('Cuatrimestre 1', '1er Cuatrimestre')}
        ${chip('Cuatrimestre 2', '2do Cuatrimestre')}
      </div>`;
  },

  _porMateriaPorAnio(enrichedPeriodo) {
    const anios = [...new Set(enrichedPeriodo.map(e => e.anio))].sort();
    return anios.map(anio => {
      const deEsteAnio = enrichedPeriodo.filter(e => e.anio === anio);
      const porMateria = this._agrupar(deEsteAnio, e => e.materia);
      return { anio, grupos: porMateria };
    });
  },

  _listaAlumnosRiesgo(porAlumno) {
    const alumnoPorId = {};
    this._alumnos.forEach(a => { alumnoPorId[a.id] = a; });

    const filas = Object.entries(porAlumno)
      .map(([studentId, recs]) => ({ alumno: alumnoPorId[studentId], ...Asistencia.calcular(recs) }))
      .filter(f => f.alumno && f.pct !== null && f.pct < this.UMBRAL_MEDIO)
      .sort((a, b) => a.pct - b.pct);

    if (!filas.length) return '';

    const rows = filas.map(f => `
      <tr>
        <td class="text-main">${Utils.nombrePlanilla(f.alumno)}</td>
        <td>${f.alumno.dni || '—'}</td>
        <td>${f.alumno.anio ? f.alumno.anio + '°' : '—'}${f.alumno.division ? ' ' + f.alumno.division : ''}</td>
        <td style="text-align:center;font-weight:700;color:var(--danger)">${f.pct}%</td>
        <td style="text-align:center">${f.computadas} / ${f.total}</td>
      </tr>`).join('');

    return `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:18px;margin-top:24px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--danger);margin-bottom:14px">
          ⚠ Alumnos en riesgo (${filas.length})
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Alumno</th><th>DNI</th><th>Curso</th><th style="text-align:center">Asistencia</th><th style="text-align:center">Clases</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  },

  _renderAsistencia() {
    const el = document.getElementById('dashboard-content');
    const alumnos = this._alumnosFiltrados();
    const enriched = this._enrichedCuatrimestreActual(); // SIEMPRE del cuatrimestre actual (gauge, tiles, resto de tarjetas)
    const global = Asistencia.calcular(enriched);

    // Alumnos en riesgo (su propio % < umbral medio), de los que tienen al menos un dato
    const porAlumno = {};
    enriched.forEach(e => { (porAlumno[e.studentId] = porAlumno[e.studentId] || []).push(e); });
    let alumnosEnRiesgo = 0;
    Object.values(porAlumno).forEach(recs => {
      const { pct } = Asistencia.calcular(recs);
      if (pct !== null && pct < this.UMBRAL_MEDIO) alumnosEnRiesgo++;
    });

    const porMateriaGlobal = this._agrupar(enriched, e => e.materia);
    const materiasEnRiesgo = porMateriaGlobal.filter(g => g.pct !== null && g.pct < this.UMBRAL_MEDIO).length;

    const porAnio = this._agrupar(enriched, e => e.anio);
    const porDivision = this._agrupar(enriched, e => e.division);
    const porDia = this._agrupar(enriched, e => Asistencia.diaDeFecha(e.fecha));

    const nombresMes = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const porMes = this._agrupar(enriched, e => e.fecha.slice(0, 7))
      .map(g => ({ ...g, label: `${nombresMes[parseInt(g.label.slice(5, 7)) - 1]} ${g.label.slice(0, 4)}` }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // "Por materia" tiene su propio selector de período (independiente del cuatrimestre actual)
    const enrichedMateria = this._enrichedFiltrado().filter(e => this._coincidePeriodo(e, this._periodoMateria));
    const porMateriaAnio = this._porMateriaPorAnio(enrichedMateria);

    el.innerHTML = `
      <div class="page-header"><h3>Dashboard</h3></div>
      ${this._vistaMenu()}
      ${this._chips()}

      <div style="font-size:.76rem;color:var(--text-3);margin:-12px 0 18px">
        Mostrando: <strong style="color:var(--text-2)">${this._cuatrimestreActual || 'todo el año'} (actual)</strong>
      </div>

      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-bottom:28px">
        <div style="flex-shrink:0">${this._gaugeSvg(global.pct)}</div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;flex:1;min-width:260px">
          ${this._statTile(alumnos.length, 'Alumnos en esta vista', 'var(--text-1)')}
          ${this._statTile(global.computadas + ' / ' + global.total, 'Registros computados / totales', 'var(--text-1)')}
          ${this._statTile(materiasEnRiesgo, 'Materias en riesgo (<' + this.UMBRAL_MEDIO + '%)', materiasEnRiesgo ? 'var(--danger)' : 'var(--success)')}
          ${this._statTile(alumnosEnRiesgo, 'Alumnos en riesgo (<' + this.UMBRAL_MEDIO + '%)', alumnosEnRiesgo ? 'var(--danger)' : 'var(--success)')}
        </div>
      </div>

      ${enriched.length ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
          ${this._grupoCard('Por año', porAnio)}
          ${this._grupoCard('Por división', porDivision)}
          ${this._grupoCard('Por día de la semana', porDia)}
          ${this._grupoCard('Por mes', porMes)}
        </div>` : `
        <div class="empty-state"><div class="icon">📊</div><p>No hay asistencia registrada todavía para este filtro.</p></div>`}

      <div style="margin-top:28px">
        <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:10px">Por materia</div>
        ${this._periodoMateriaChips()}
        ${porMateriaAnio.length ? `
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px">
            ${porMateriaAnio.map(g => this._grupoCard(g.anio, g.grupos)).join('')}
          </div>` : `
          <div class="empty-state"><div class="icon">📚</div><p>No hay asistencia registrada para este período.</p></div>`}
      </div>

      ${this._listaAlumnosRiesgo(porAlumno)}
    `;
  },
};
