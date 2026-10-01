const AlumnoAsistencia = {
  _sesionHoy: null,
  _miRegistroHoy: null,

  async init() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();
    const hoy = Utils.hoyLocal();

    const { data: sesionHoy } = await sb
      .from('attendance_sessions').select('*')
      .eq('subject_id', AlumnoState.materia.id).eq('session_date', hoy).maybeSingle();
    this._sesionHoy = sesionHoy || null;

    this._miRegistroHoy = null;
    if (this._sesionHoy) {
      const { data } = await sb.from('attendance_records').select('*')
        .eq('session_id', this._sesionHoy.id).eq('student_id', session.id).maybeSingle();
      this._miRegistroHoy = data || null;
    }

    const { data: sesiones, error } = await sb
      .from('attendance_sessions')
      .select('id, session_date')
      .eq('subject_id', AlumnoState.materia.id)
      .order('session_date', { ascending: false });

    if (error) { Utils.toast('Error al cargar la asistencia', 'error'); return; }

    const sessionIds = (sesiones || []).map(s => s.id);
    let registros = [];
    if (sessionIds.length) {
      const { data } = await sb
        .from('attendance_records')
        .select('session_id, status')
        .eq('student_id', session.id)
        .in('session_id', sessionIds);
      registros = data || [];
    }

    this._render(sesiones || [], registros);
  },

  _estaAbierta() {
    return this._sesionHoy?.status === 'abierta' && new Date() < new Date(this._sesionHoy.closes_at);
  },

  _hora(iso) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  },

  _render(sesiones, registros) {
    const el = document.getElementById('asistencia-content');

    // ── Banner de la clase de hoy ──
    let banner = '';
    if (this._miRegistroHoy) {
      banner = `
        <div class="card" style="margin-bottom:18px;border-color:var(--success)">
          <div style="font-weight:600;color:var(--success)">✓ Ya marcaste tu asistencia hoy</div>
          <div style="font-size:.8rem;color:var(--text-3);margin-top:2px">Registrada a las ${this._hora(this._miRegistroHoy.marked_at)}</div>
        </div>`;
    } else if (this._estaAbierta()) {
      banner = `
        <div class="card" style="margin-bottom:18px;border-color:var(--accent);text-align:center">
          <div style="font-weight:600;color:var(--text-1);margin-bottom:4px">🟢 Tu profesor abrió la asistencia</div>
          <div style="font-size:.8rem;color:var(--text-3);margin-bottom:14px">Se cierra a las ${this._hora(this._sesionHoy.closes_at)}</div>
          <button class="btn btn-primary" style="padding:12px 28px;font-size:1rem" onclick="AlumnoAsistencia.marcar()">✓ Marcar mi asistencia</button>
        </div>`;
    } else {
      banner = `
        <div class="card" style="margin-bottom:18px">
          <div style="font-size:.85rem;color:var(--text-3)">No hay una clase abierta para marcar asistencia en este momento.</div>
        </div>`;
    }

    if (!sesiones.length) {
      el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div>${banner}`;
      return;
    }

    const porSesion = {};
    registros.forEach(r => { porSesion[r.session_id] = r.status; });

    const { pct, computadas, total } = Asistencia.calcular(
      sesiones.map(s => ({ status: porSesion[s.id] })).filter(r => r.status)
    );

    const rows = sesiones.map(s => {
      const status = porSesion[s.id];
      if (!status) return '';
      return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:.85rem;color:var(--text-1)">${Utils.formatDate(s.session_date)}</div>
          <span class="badge" style="background:${Asistencia.COLOR_BG[status]};color:${Asistencia.COLOR[status]}">
            ${Asistencia.LABEL[status]}
          </span>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Asistencia</h3></div>
      ${banner}
      <div class="card" style="margin-bottom:18px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-size:.78rem;color:var(--text-3);text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:4px">Tu asistencia</div>
            ${Asistencia.badge(pct)}
          </div>
          <div style="font-size:.78rem;color:var(--text-3);text-align:right">
            ${computadas} clase${computadas !== 1 ? 's' : ''} computada${computadas !== 1 ? 's' : ''} de ${total} registrada${total !== 1 ? 's' : ''}<br>
            Necesitás ${Asistencia.UMBRAL}% para regularizar
          </div>
        </div>
      </div>
      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">Detalle por clase</div>
      <div>${rows}</div>
      <p style="font-size:.73rem;color:var(--text-3);margin-top:14px">
        Si ves un error en algún registro, hablalo con tu profesor — fuera de la ventana que él habilita, no se puede modificar.
      </p>`;
  },

  async marcar() {
    if (!this._estaAbierta()) { Utils.toast('La ventana de asistencia ya no está abierta', 'error'); return; }

    const session = Auth.session();
    const { error } = await sb.from('attendance_records').upsert({
      session_id: this._sesionHoy.id,
      student_id: session.id,
      status: 'presente',
      marked_by_role: 'student',
      marked_by: session.id,
      marked_at: new Date().toISOString(),
    }, { onConflict: 'session_id,student_id', ignoreDuplicates: true });

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('¡Asistencia registrada!');
    this.init();
  },
};
