const PreceptorCalendario = {
  async init() {
    const el = document.getElementById('calendario-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    if (!session.inst) {
      el.innerHTML = '<div class="empty-state"><p>Tu perfil no tiene institución asignada.</p></div>';
      return;
    }

    const { data: dias, error } = await sb
      .from('no_class_days')
      .select('*')
      .eq('institution_id', session.inst)
      .order('day_date', { ascending: false });

    if (error) { Utils.toast('Error al cargar el calendario', 'error'); return; }
    this._render(dias || []);
  },

  _render(dias) {
    const el = document.getElementById('calendario-content');
    const hoy = Utils.hoyLocal();

    const rows = dias.map(d => {
      const esPasado = d.day_date < hoy;
      const esHoy = d.day_date === hoy;
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">
              ${Utils.formatDate(d.day_date)} ${esHoy ? '<span class="badge badge-practice" style="font-size:.65rem">Hoy</span>' : ''}
            </div>
            <div style="font-size:.72rem;color:var(--text-3)">${d.reason || 'Sin motivo especificado'}${esPasado ? ' · ya pasó' : ''}</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="PreceptorCalendario.quitar('${d.id}')">Quitar</button>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Calendario</h3></div>
      <p style="font-size:.82rem;color:var(--text-2);margin-bottom:16px;max-width:620px">
        Un día cargado acá bloquea la asistencia de <strong>toda la institución, en todas las materias</strong>, ese día —
        nadie puede tildar presente ni corregir asistencia. Usalo para feriados cargados con anticipación o para algo
        imprevisto (corte de servicios, paro, etc.). Si elegís una fecha de hoy o anterior, se justifica automáticamente
        a todos los alumnos que ya tuvieran algo registrado ese día.
      </p>

      <div class="card" style="max-width:480px;margin-bottom:28px">
        <div class="form-group">
          <label>Fecha</label>
          <input type="date" id="cal-fecha" value="${hoy}">
        </div>
        <div class="form-group">
          <label>Motivo</label>
          <input type="text" id="cal-motivo" placeholder="Ej: Corte de agua de red, Feriado nacional…">
        </div>
        <button class="btn btn-primary" id="cal-save-btn" onclick="PreceptorCalendario.declarar()">Declarar día sin clases</button>
      </div>

      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">
        Días cargados (${dias.length})
      </div>
      ${dias.length ? rows : '<div style="color:var(--text-3);font-size:.85rem;padding:12px 0">Todavía no cargaste ningún día.</div>'}`;
  },

  async declarar() {
    const btn = document.getElementById('cal-save-btn');
    const fecha = document.getElementById('cal-fecha').value;
    const motivo = document.getElementById('cal-motivo').value.trim();
    if (!fecha) { Utils.toast('Elegí una fecha', 'error'); return; }

    const session = Auth.session();
    Utils.btnLoading(btn, true);

    const { error } = await sb.from('no_class_days').upsert({
      institution_id: session.inst, day_date: fecha, reason: motivo || null, created_by: session.id,
    }, { onConflict: 'institution_id,day_date' });

    if (error) {
      Utils.btnLoading(btn, false);
      Utils.toast('Error: ' + error.message, 'error');
      return;
    }

    const hoy = Utils.hoyLocal();
    let justificados = 0;
    if (fecha <= hoy) {
      justificados = await this._justificarMasivo(session.inst, fecha, motivo);
    }

    Utils.btnLoading(btn, false);
    Utils.toast(justificados
      ? `Día declarado sin clases — se justificaron ${justificados} registros existentes`
      : 'Día declarado sin clases');
    this.init();
  },

  // Recorre todas las materias de la institución y pone "justificada" a todos
  // sus inscriptos para esa fecha (crea la sesión y los registros si hacía falta).
  async _justificarMasivo(institutionId, fecha, motivo) {
    const session = Auth.session();

    const { data: carreras } = await sb.from('careers').select('id').eq('institution_id', institutionId);
    const careerIds = (carreras || []).map(c => c.id);
    if (!careerIds.length) return 0;

    const { data: materias } = await sb.from('subjects').select('id').in('career_id', careerIds);
    const subjectIds = (materias || []).map(m => m.id);
    if (!subjectIds.length) return 0;

    let total = 0;

    for (const subjectId of subjectIds) {
      const { data: inscriptos } = await sb.from('student_subjects').select('student_id').eq('subject_id', subjectId);
      const studentIds = (inscriptos || []).map(r => r.student_id);
      if (!studentIds.length) continue;

      let { data: sesion } = await sb.from('attendance_sessions').select('id')
        .eq('subject_id', subjectId).eq('session_date', fecha).maybeSingle();

      if (!sesion) {
        const { data: nueva, error } = await sb.from('attendance_sessions')
          .insert({ subject_id: subjectId, session_date: fecha }).select().single();
        if (error) continue;
        sesion = nueva;
      }

      const payload = studentIds.map(student_id => ({
        session_id: sesion.id,
        student_id,
        status: 'justificada',
        marked_by_role: 'preceptor',
        marked_by: session.id,
        notes: motivo || null,
        marked_at: new Date().toISOString(),
      }));

      const { error: upsertError } = await sb.from('attendance_records')
        .upsert(payload, { onConflict: 'session_id,student_id' });
      if (!upsertError) total += payload.length;
    }

    return total;
  },

  async quitar(id) {
    if (!await Utils.confirmar('¿Quitar este día del calendario? No deshace ninguna justificación ya aplicada, solo libera la fecha para que se pueda volver a tomar asistencia normalmente.')) return;
    const { error } = await sb.from('no_class_days').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Día quitado del calendario');
    this.init();
  },
};
