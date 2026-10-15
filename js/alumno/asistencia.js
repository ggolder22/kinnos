const AlumnoAsistencia = {
  _horarios:      [],
  _ventana:       null,
  _sesionHoy:     null,
  _miRegistroHoy: null,

  async init() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();
    const hoy = Utils.hoyLocal();

    this._horarios = await Asistencia.cargarHorariosDeMateria(AlumnoState.materia);
    this._ventana = Asistencia.ventanaDeHoy(this._horarios);

    this._sesionHoy = null;
    this._miRegistroHoy = null;
    if (this._ventana) {
      const { data: sesion } = await sb.from('attendance_sessions').select('*')
        .eq('subject_id', AlumnoState.materia.id).eq('session_date', hoy).maybeSingle();
      this._sesionHoy = sesion || null;
      if (this._sesionHoy) {
        const { data: reg } = await sb.from('attendance_records').select('*')
          .eq('session_id', this._sesionHoy.id).eq('student_id', session.id).maybeSingle();
        this._miRegistroHoy = reg || null;
      }

      // Autocorrección silenciosa: si la ventana ya venció y nunca me marqué,
      // y existe sesión (alguien más de la clase sí se marcó), quedo como ausente.
      if (Asistencia.estadoVentana(this._ventana) === 'vencida' && this._sesionHoy && !this._miRegistroHoy) {
        await sb.from('attendance_records').upsert({
          session_id: this._sesionHoy.id, student_id: session.id,
          status: 'ausente', marked_by_role: 'system', marked_by: null,
        }, { onConflict: 'session_id,student_id', ignoreDuplicates: true });
        this._miRegistroHoy = { status: 'ausente' };
      }
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

  _banner() {
    if (!this._horarios.length) {
      return `<div class="card" style="margin-bottom:18px">
        <div style="font-size:.85rem;color:var(--text-3)">Esta materia todavía no tiene horario vinculado en el cronograma — avisale al profesor para que lo pida al administrador.</div>
      </div>`;
    }

    const estado = Asistencia.estadoVentana(this._ventana);

    if (this._miRegistroHoy) {
      const esPresente = this._miRegistroHoy.status === 'presente' || this._miRegistroHoy.status === 'tarde';
      return `<div class="card" style="margin-bottom:18px;border-color:${esPresente ? 'var(--success)' : 'var(--danger)'}">
        <div style="font-weight:600;color:${esPresente ? 'var(--success)' : 'var(--danger)'}">
          ${esPresente ? '✓ Ya marcaste tu asistencia hoy' : '✗ Figurás ausente hoy'}
        </div>
        <div style="font-size:.8rem;color:var(--text-3);margin-top:2px">
          ${this._miRegistroHoy.marked_at ? 'Registrada a las ' + Asistencia.horaCorta(new Date(this._miRegistroHoy.marked_at)) : 'No tildaste dentro de la ventana habilitada'}
        </div>
      </div>`;
    }

    if (estado === 'sin_clase') {
      return `<div class="card" style="margin-bottom:18px">
        <div style="font-size:.85rem;color:var(--text-3)">No hay clase programada hoy (${Asistencia.diaDeHoy()}) para esta materia.</div>
      </div>`;
    }
    if (estado === 'antes') {
      return `<div class="card" style="margin-bottom:18px">
        <div style="font-size:.85rem;color:var(--text-2)">
          La asistencia se habilita a las <strong>${Asistencia.horaCorta(this._ventana.start)}</strong>
          y dura ${Asistencia.VENTANA_MIN} minutos.
        </div>
      </div>`;
    }
    if (estado === 'abierta') {
      return `<div class="card" style="margin-bottom:18px;border-color:var(--accent);text-align:center">
        <div style="font-weight:600;color:var(--text-1);margin-bottom:4px">🟢 Podés marcar tu asistencia</div>
        <div style="font-size:.8rem;color:var(--text-3);margin-bottom:14px">La ventana se cierra a las ${Asistencia.horaCorta(this._ventana.end)}</div>
        <button class="btn btn-primary" style="padding:12px 28px;font-size:1rem" onclick="AlumnoAsistencia.marcar()">✓ Marcar mi asistencia</button>
      </div>`;
    }
    // vencida
    return `<div class="card" style="margin-bottom:18px;border-color:var(--danger)">
      <div style="font-weight:600;color:var(--danger)">La ventana de hoy ya cerró</div>
      <div style="font-size:.8rem;color:var(--text-3);margin-top:4px">
        Se cerró a las ${Asistencia.horaCorta(this._ventana.end)}. Si llegaste tarde, pedí el presente en Preceptoría.
      </div>
    </div>`;
  },

  _render(sesiones, registros) {
    const el = document.getElementById('asistencia-content');
    const banner = this._banner();

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
        Si ves un error en algún registro, hablalo con tu profesor o con Preceptoría — vos no podés modificarlo.
      </p>`;
  },

  async marcar() {
    if (Asistencia.estadoVentana(this._ventana) !== 'abierta') {
      Utils.toast('La ventana de asistencia no está abierta', 'error');
      return;
    }

    const session = Auth.session();
    const hoy = Utils.hoyLocal();

    let sesionId = this._sesionHoy?.id;
    if (!sesionId) {
      const { data: sesion, error } = await sb.from('attendance_sessions')
        .upsert({ subject_id: AlumnoState.materia.id, session_date: hoy }, { onConflict: 'subject_id,session_date' })
        .select().single();
      if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
      sesionId = sesion.id;
    }

    const { error } = await sb.from('attendance_records').upsert({
      session_id: sesionId,
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
