const ProfesorAsistencia = {
  _vista:    'hoy',
  _fecha:    null,
  _horarios: [],
  _roster:   [],
  _sesion:   null,
  _records:  {}, // { student_id: record }

  async init() {
    this._vista = 'hoy';
    await this._render();
  },

  _tabsHtml() {
    const tab = (key, label) => `
      <button class="btn ${this._vista === key ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="ProfesorAsistencia.cambiarVista('${key}')">${label}</button>`;
    return `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">${tab('hoy', 'Hoy')}${tab('resumen', 'Resumen')}${tab('historial', 'Historial')}</div>`;
  },

  cambiarVista(v) {
    this._vista = v;
    this._render();
  },

  async _render() {
    if (this._vista === 'hoy')       return this._renderHoy();
    if (this._vista === 'resumen')   return this._renderResumen();
    if (this._vista === 'historial') return this._renderHistorial();
  },

  // ── Cargar roster + horarios + sesión + registros de una fecha ───

  async _cargarHorarios() {
    this._horarios = await Asistencia.cargarHorariosDeMateria(ProfesorState.materia);
  },

  async _cargar(fecha) {
    this._fecha = fecha;
    const { data: inscriptos } = await sb
      .from('student_subjects').select('students(id, full_name, dni)').eq('subject_id', ProfesorState.materia.id);
    this._roster = (inscriptos || []).map(r => r.students).filter(Boolean)
      .sort((a, b) => a.full_name.localeCompare(b.full_name));

    const { data: sesion } = await sb
      .from('attendance_sessions').select('*')
      .eq('subject_id', ProfesorState.materia.id).eq('session_date', fecha).maybeSingle();
    this._sesion = sesion || null;

    this._records = {};
    if (sesion) {
      const { data } = await sb.from('attendance_records').select('*').eq('session_id', sesion.id);
      (data || []).forEach(r => { this._records[r.student_id] = r; });
    }
  },

  // ── Hoy: informativo (la ventana la calcula el sistema solo) ─────

  async _renderHoy() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}<div class="loading">Cargando…</div>`;

    const hoy = Utils.hoyLocal();
    await this._cargarHorarios();
    await this._cargar(hoy);

    if (!this._roster.length) {
      el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos inscriptos en esta materia todavía.</p></div>`;
      return;
    }

    if (!this._horarios.length) {
      el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}
        <div class="card" style="max-width:480px">
          <div style="font-weight:600;color:var(--text-1);margin-bottom:6px">No encontramos el horario de esta materia</div>
          <p style="font-size:.85rem;color:var(--text-2)">
            La ventana de asistencia se calcula sola a partir del cronograma, buscando una materia con el mismo nombre y año.
            Si el nombre en el cronograma es distinto al de esta materia (por ejemplo, una tilde o una abreviatura),
            pedile al administrador que los vincule desde su panel.
          </p>
        </div>`;
      return;
    }

    const ventana = Asistencia.ventanaDeHoy(this._horarios);
    const estado = Asistencia.estadoVentana(ventana);

    const bannerMap = {
      sin_clase: `<div class="card">No hay clase programada hoy (${Asistencia.diaDeHoy()}) para esta materia según el cronograma.</div>`,
      antes:     `<div class="card">La ventana de asistencia se habilita sola a las <strong>${Asistencia.horaCorta(ventana.start)}</strong> y dura ${Asistencia.VENTANA_MIN} minutos.</div>`,
      abierta:   `<div class="card" style="border-color:var(--success)">🟢 Ventana abierta — se cierra a las <strong>${Asistencia.horaCorta(ventana.end)}</strong>. Los alumnos ya pueden tildarse solos.</div>`,
      vencida:   `<div class="card" style="border-color:#f59e0b">La ventana de hoy cerró a las ${Asistencia.horaCorta(ventana.end)}. Quien no se haya marcado figura ausente — podés corregirlo abajo (tardanza avalada por Preceptoría, justificación, etc.).</div>`,
    };

    el.innerHTML = `
      <div class="page-header"><h3>Asistencia</h3></div>
      ${this._tabsHtml()}
      ${bannerMap[estado]}
      <div style="font-size:.8rem;color:var(--text-3);margin:12px 0">${this._resumenCorto()} · ${Utils.formatDate(hoy)}</div>
      ${this._listaConCorreccion()}`;
  },

  _resumenCorto() {
    const vals = Object.values(this._records).map(r => r.status);
    const n = st => vals.filter(v => v === st).length;
    return `${n('presente')} presentes · ${n('tarde')} tarde · ${n('ausente')} ausentes · ${n('justificada')} justificadas`;
  },

  _listaConCorreccion() {
    const rows = this._roster.map(a => {
      const rec = this._records[a.id];
      const estadoActual = rec?.status;
      const quien = { student: 'Se marcó solo', professor: 'Corregido por el docente', system: 'Marcado automáticamente' };

      return `
        <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">${a.full_name}</div>
            <div style="font-size:.72rem;color:var(--text-3)">
              ${rec
                ? `${quien[rec.marked_by_role] || ''}${rec.marked_at ? ' a las ' + Asistencia.horaCorta(new Date(rec.marked_at)) : ''}`
                : 'Todavía no hay registro'}
            </div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            ${['presente', 'tarde', 'ausente', 'justificada'].map(st => `
              <button type="button" onclick="ProfesorAsistencia._corregir('${a.id}','${st}')"
                style="padding:5px 10px;border-radius:6px;font-size:.7rem;font-weight:600;cursor:pointer;
                  border:1px solid ${st === estadoActual ? Asistencia.COLOR[st] : 'var(--border)'};
                  background:${st === estadoActual ? Asistencia.COLOR[st] : 'var(--bg-base)'};
                  color:${st === estadoActual ? '#fff' : 'var(--text-3)'}">
                ${Asistencia.LABEL[st]}
              </button>`).join('')}
          </div>
        </div>`;
    }).join('');

    return `
      <p style="font-size:.76rem;color:var(--text-3);margin:12px 0 8px">
        El registro normal lo hace el alumno solo, dentro de la ventana. Estos botones son para corregir manualmente.
      </p>
      <div style="max-height:440px;overflow-y:auto">${rows}</div>`;
  },

  async _corregir(studentId, status) {
    const session = Auth.session();

    let sesionId = this._sesion?.id;
    if (!sesionId) {
      const { data: sesion, error } = await sb.from('attendance_sessions')
        .upsert({ subject_id: ProfesorState.materia.id, session_date: this._fecha }, { onConflict: 'subject_id,session_date' })
        .select().single();
      if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
      sesionId = sesion.id;
      this._sesion = sesion;
    }

    const { error } = await sb.from('attendance_records').upsert({
      session_id: sesionId,
      student_id: studentId,
      status,
      marked_by_role: 'professor',
      marked_by: session.id,
      marked_at: new Date().toISOString(),
    }, { onConflict: 'session_id,student_id' });

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    await this._cargar(this._fecha);
    if (this._vista === 'hoy') this._renderHoy();
    else this._verDiaRefresh();
  },

  _verDiaRefresh() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = `
      <div class="page-header"><h3>Asistencia</h3></div>
      ${this._tabsHtml()}
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ProfesorAsistencia.cambiarVista('historial')">← Volver al historial</button>
      <div class="card" style="margin-bottom:16px">
        <div style="font-weight:600;color:var(--text-1)">${Utils.formatDate(this._fecha)}</div>
        <div style="font-size:.8rem;color:var(--text-3);margin-top:2px">${this._resumenCorto()}</div>
      </div>
      ${this._listaConCorreccion()}`;
  },

  // ── Completa como "ausente" (marked_by_role: system) a los inscriptos
  //    que no tengan registro en sesiones cuya ventana ya venció. Se corre
  //    sola al entrar a Resumen/Historial — nadie tiene que accionarla. ──

  async _backfillVencidas() {
    const { data: inscriptos } = await sb.from('student_subjects').select('student_id').eq('subject_id', ProfesorState.materia.id);
    const rosterIds = (inscriptos || []).map(r => r.student_id);
    if (!rosterIds.length) return;

    await this._cargarHorarios();
    if (!this._horarios.length) return; // no se encontró el horario de esta materia en el cronograma

    const { data: sesiones } = await sb.from('attendance_sessions').select('id, session_date').eq('subject_id', ProfesorState.materia.id);
    if (!sesiones?.length) return;

    const ahora = new Date();
    for (const s of sesiones) {
      const ventana = Asistencia.ventanaDeFecha(s.session_date, this._horarios);
      if (!ventana || ahora <= ventana.end) continue;

      const { data: existentes } = await sb.from('attendance_records').select('student_id').eq('session_id', s.id);
      const yaTienen = new Set((existentes || []).map(r => r.student_id));
      const faltantes = rosterIds.filter(id => !yaTienen.has(id));
      if (!faltantes.length) continue;

      await sb.from('attendance_records').insert(
        faltantes.map(student_id => ({ session_id: s.id, student_id, status: 'ausente', marked_by_role: 'system', marked_by: null }))
      );
    }
  },

  // ── Resumen con % y semáforo de regularidad ───────────────

  async _renderResumen() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}<div class="loading">Cargando…</div>`;

    await this._backfillVencidas();

    const { data: inscriptos } = await sb
      .from('student_subjects').select('students(id, full_name, dni)').eq('subject_id', ProfesorState.materia.id);
    const roster = (inscriptos || []).map(r => r.students).filter(Boolean);

    const { data: sesiones } = await sb
      .from('attendance_sessions').select('id').eq('subject_id', ProfesorState.materia.id);
    const sessionIds = (sesiones || []).map(s => s.id);

    let registros = [];
    if (sessionIds.length) {
      const { data } = await sb.from('attendance_records').select('student_id, status').in('session_id', sessionIds);
      registros = data || [];
    }

    if (!roster.length) {
      el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos inscriptos en esta materia todavía.</p></div>`;
      return;
    }

    const porAlumno = {};
    roster.forEach(a => { porAlumno[a.id] = []; });
    registros.forEach(r => { if (porAlumno[r.student_id]) porAlumno[r.student_id].push(r); });

    const filas = roster.map(a => {
      const { pct } = Asistencia.calcular(porAlumno[a.id]);
      return { a, pct };
    }).sort((x, y) => (x.pct ?? 101) - (y.pct ?? 101));

    const rows = filas.map(({ a, pct }) => `
      <tr>
        <td class="text-main">${a.full_name}</td>
        <td>${a.dni}</td>
        <td>${Asistencia.badge(pct)}</td>
      </tr>`).join('');

    const totalSesiones = sessionIds.length;

    el.innerHTML = `
      <div class="page-header"><h3>Asistencia</h3></div>
      ${this._tabsHtml()}
      <div style="font-size:.78rem;color:var(--text-3);margin-bottom:10px">
        ${totalSesiones} clase${totalSesiones !== 1 ? 's' : ''} registrada${totalSesiones !== 1 ? 's' : ''} · umbral de regularidad: ${Asistencia.UMBRAL}%
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Alumno</th><th>DNI</th><th>Asistencia</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  // ── Historial de clases ────────────────────────────────────

  async _renderHistorial() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}<div class="loading">Cargando…</div>`;

    await this._backfillVencidas();

    const { data: sesiones, error } = await sb
      .from('attendance_sessions')
      .select('id, session_date, attendance_records(status)')
      .eq('subject_id', ProfesorState.materia.id)
      .order('session_date', { ascending: false });

    if (error) { Utils.toast('Error al cargar el historial', 'error'); return; }

    if (!sesiones?.length) {
      el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}
        <div class="empty-state"><div class="icon">🗓️</div><p>Todavía no hay clases registradas en esta materia.</p></div>`;
      return;
    }

    const rows = sesiones.map(s => {
      const recs = s.attendance_records || [];
      const n = st => recs.filter(r => r.status === st).length;
      return `
        <div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">${Utils.formatDate(s.session_date)}</div>
            <div style="font-size:.73rem;color:var(--text-3);margin-top:2px">
              ${n('presente')} presentes · ${n('tarde')} tarde · ${n('ausente')} ausentes · ${n('justificada')} justificadas
            </div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="ProfesorAsistencia._verDia('${s.session_date}')">Ver / corregir</button>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Asistencia</h3></div>
      ${this._tabsHtml()}
      <div>${rows}</div>`;
  },

  async _verDia(fecha) {
    await this._cargarHorarios();
    await this._cargar(fecha);
    this._verDiaRefresh();
  },
};
