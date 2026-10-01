const ProfesorAsistencia = {
  _vista:   'hoy',
  _sesion:  null, // sesión de asistencia de hoy (o null si no existe)
  _roster:  [],
  _records: {},   // { student_id: record }

  async init() {
    this._vista = 'hoy';
    await this._render();
  },

  _hoy() {
    return new Date().toISOString().slice(0, 10);
  },

  _tabsHtml() {
    const tab = (key, label) => `
      <button class="btn ${this._vista === key ? 'btn-primary' : 'btn-ghost'} btn-sm" onclick="ProfesorAsistencia.cambiarVista('${key}')">${label}</button>`;
    return `<div style="display:flex;gap:8px;margin-bottom:16px">${tab('hoy', 'Clase de hoy')}${tab('resumen', 'Resumen')}${tab('historial', 'Historial')}</div>`;
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

  // ── Cargar roster + sesión + registros de una fecha ───────

  async _cargar(fecha) {
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

  _estaAbierta() {
    return this._sesion?.status === 'abierta' && new Date() < new Date(this._sesion.closes_at);
  },

  _ventanaVencida() {
    return this._sesion?.status === 'abierta' && new Date() >= new Date(this._sesion.closes_at);
  },

  // ── Clase de hoy: abrir / cerrar / ver en vivo ────────────

  async _renderHoy() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}<div class="loading">Cargando…</div>`;

    const hoy = this._hoy();
    await this._cargar(hoy);

    if (!this._roster.length) {
      el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}
        <div class="empty-state"><div class="icon">👥</div><p>No hay alumnos inscriptos en esta materia todavía.</p></div>`;
      return;
    }

    // Caso 1: no hay clase abierta hoy todavía
    if (!this._sesion || (this._sesion.status === 'cerrada' && !this._sesion.opened_at)) {
      el.innerHTML = `
        <div class="page-header"><h3>Asistencia</h3></div>
        ${this._tabsHtml()}
        <div class="card" style="max-width:420px">
          <div style="font-weight:600;color:var(--text-1);margin-bottom:6px">Clase de hoy — ${Utils.formatDate(hoy)}</div>
          <p style="font-size:.85rem;color:var(--text-2);margin-bottom:14px">
            Al abrir la clase, tus alumnos van a poder tildar su propia asistencia desde la app durante el tiempo que elijas.
          </p>
          <div class="form-group">
            <label>Minutos que queda abierta</label>
            <input type="number" id="asis-minutos" value="15" min="1" max="180" style="width:100px">
          </div>
          <button class="btn btn-primary" onclick="ProfesorAsistencia._abrir()">🟢 Abrir asistencia de hoy</button>
        </div>`;
      return;
    }

    // Caso 2: la ventana venció pero todavía no se finalizó
    if (this._ventanaVencida()) {
      el.innerHTML = `
        <div class="page-header"><h3>Asistencia</h3></div>
        ${this._tabsHtml()}
        <div class="card" style="max-width:460px;border-color:#f59e0b">
          <div style="font-weight:600;color:var(--text-1);margin-bottom:6px">⏱ La ventana de hoy venció</div>
          <p style="font-size:.85rem;color:var(--text-2);margin-bottom:14px">
            Se cerró automáticamente a las ${this._hora(this._sesion.closes_at)}. Finalizá la clase para marcar como ausente
            a quien no haya tildado su presencia.
          </p>
          <button class="btn btn-primary" onclick="ProfesorAsistencia._finalizar()">Finalizar y completar ausentes</button>
        </div>`;
      return;
    }

    // Caso 3: abierta y dentro de la ventana — vista en vivo
    if (this._estaAbierta()) {
      el.innerHTML = `
        <div class="page-header"><h3>Asistencia</h3></div>
        ${this._tabsHtml()}
        <div class="card" style="margin-bottom:16px;border-color:var(--success);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-weight:600;color:var(--success)">🟢 Asistencia abierta</div>
            <div style="font-size:.8rem;color:var(--text-3)">Se cierra a las ${this._hora(this._sesion.closes_at)} — los alumnos ya pueden tildar su presencia</div>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="ProfesorAsistencia._renderHoy()">🔄 Actualizar</button>
            <button class="btn btn-danger btn-sm" onclick="ProfesorAsistencia._finalizar()">Cerrar ahora</button>
          </div>
        </div>
        ${this._listaConCorreccion()}`;
      return;
    }

    // Caso 4: ya cerrada (finalizada) — mostrar resultado del día con opción de corregir
    el.innerHTML = `
      <div class="page-header"><h3>Asistencia</h3></div>
      ${this._tabsHtml()}
      <div class="card" style="margin-bottom:16px">
        <div style="font-weight:600;color:var(--text-1)">Clase de hoy — ${Utils.formatDate(hoy)} (cerrada)</div>
        <div style="font-size:.8rem;color:var(--text-3);margin-top:2px">${this._resumenCorto()}</div>
      </div>
      ${this._listaConCorreccion()}`;
  },

  _hora(iso) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
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
      const autogestion = rec?.marked_by_role === 'student';

      return `
        <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">${a.full_name}</div>
            <div style="font-size:.72rem;color:var(--text-3)">
              ${rec
                ? `${autogestion ? 'Se marcó solo' : 'Corregido por el docente'} a las ${this._hora(rec.marked_at)}`
                : 'Todavía no tildó su presencia'}
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
      <p style="font-size:.76rem;color:var(--text-3);margin-bottom:8px">
        Estos botones son para corregir manualmente (tardanza, justificación, o alguien que se olvidó de tildar). El registro normal lo hace el alumno desde su panel.
      </p>
      <div style="max-height:440px;overflow-y:auto">${rows}</div>`;
  },

  async _abrir() {
    const minutos = parseInt(document.getElementById('asis-minutos').value) || 15;
    const session = Auth.session();
    const ahora = new Date();
    const cierra = new Date(ahora.getTime() + minutos * 60000);

    const { error } = await sb.from('attendance_sessions').upsert({
      subject_id: ProfesorState.materia.id,
      session_date: this._hoy(),
      status: 'abierta',
      opened_at: ahora.toISOString(),
      closes_at: cierra.toISOString(),
      closed_at: null,
      created_by: session.id,
    }, { onConflict: 'subject_id,session_date' });

    if (error) { Utils.toast('Error al abrir la asistencia: ' + error.message, 'error'); return; }
    Utils.toast(`Asistencia abierta hasta las ${this._hora(cierra.toISOString())}`);
    this._renderHoy();
  },

  async _finalizar() {
    if (!this._sesion) return;

    // Completa como "ausente" a todo inscripto que no haya tildado nada
    const faltantes = this._roster.filter(a => !this._records[a.id]);
    if (faltantes.length) {
      const payload = faltantes.map(a => ({
        session_id: this._sesion.id,
        student_id: a.id,
        status: 'ausente',
        marked_by_role: 'professor',
        marked_by: Auth.session().id,
      }));
      await sb.from('attendance_records').insert(payload);
    }

    const { error } = await sb.from('attendance_sessions')
      .update({ status: 'cerrada', closed_at: new Date().toISOString() })
      .eq('id', this._sesion.id);

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Clase finalizada');
    this._renderHoy();
  },

  async _corregir(studentId, status) {
    if (!this._sesion) return;
    const session = Auth.session();
    const { error } = await sb.from('attendance_records').upsert({
      session_id: this._sesion.id,
      student_id: studentId,
      status,
      marked_by_role: 'professor',
      marked_by: session.id,
      marked_at: new Date().toISOString(),
    }, { onConflict: 'session_id,student_id' });

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    if (this._vista === 'hoy') this._renderHoy();
  },

  // ── Resumen con % y semáforo de regularidad ───────────────

  async _renderResumen() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}<div class="loading">Cargando…</div>`;

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

    const { data: sesiones, error } = await sb
      .from('attendance_sessions')
      .select('id, session_date, status, attendance_records(status)')
      .eq('subject_id', ProfesorState.materia.id)
      .order('session_date', { ascending: false });

    if (error) { Utils.toast('Error al cargar el historial', 'error'); return; }

    if (!sesiones?.length) {
      el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}
        <div class="empty-state"><div class="icon">🗓️</div><p>Todavía no abriste ninguna clase en esta materia.</p></div>`;
      return;
    }

    const rows = sesiones.map(s => {
      const recs = s.attendance_records || [];
      const n = st => recs.filter(r => r.status === st).length;
      const estadoBadge = s.status === 'abierta'
        ? '<span class="badge badge-practice">🟢 Abierta</span>'
        : '<span class="badge badge-inactive">Cerrada</span>';
      return `
        <div style="display:flex;align-items:center;gap:14px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">${Utils.formatDate(s.session_date)} ${estadoBadge}</div>
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
    const el = document.getElementById('asistencia-content');
    el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${this._tabsHtml()}<div class="loading">Cargando…</div>`;
    await this._cargar(fecha);

    el.innerHTML = `
      <div class="page-header"><h3>Asistencia</h3></div>
      ${this._tabsHtml()}
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="ProfesorAsistencia.cambiarVista('historial')">← Volver al historial</button>
      <div class="card" style="margin-bottom:16px">
        <div style="font-weight:600;color:var(--text-1)">${Utils.formatDate(fecha)}</div>
        <div style="font-size:.8rem;color:var(--text-3);margin-top:2px">${this._resumenCorto()}</div>
      </div>
      ${this._listaConCorreccion()}`;
  },
};
