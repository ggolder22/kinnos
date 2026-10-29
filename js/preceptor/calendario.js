const PreceptorCalendario = {
  _dias: [],
  _mesVista: null, // { year, month } (month 0-based) — mes que muestra el calendario visual

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
    this._dias = dias || [];

    if (!this._mesVista) {
      const hoy = new Date();
      this._mesVista = { year: hoy.getFullYear(), month: hoy.getMonth() };
    }

    this._render();
  },

  _etiquetaAlcance(d) {
    if (d.anio === null && d.division === null) return 'Toda la institución';
    if (d.anio !== null && d.division === null) return `${d.anio}° (A y B)`;
    if (d.anio !== null && d.division !== null) return `${d.anio}° ${d.division}`;
    return `División ${d.division}`; // caso raro: división sin año
  },

  _render() {
    const el = document.getElementById('calendario-content');
    const hoy = Utils.hoyLocal();
    const dias = this._dias;

    const rows = dias.map(d => {
      const esPasado = d.day_date < hoy;
      const esHoy = d.day_date === hoy;
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">
              ${Utils.formatDate(d.day_date)} ${esHoy ? '<span class="badge badge-practice" style="font-size:.65rem">Hoy</span>' : ''}
              <span class="badge badge-indigo" style="font-size:.65rem">${this._etiquetaAlcance(d)}</span>
            </div>
            <div style="font-size:.72rem;color:var(--text-3)">${d.reason || 'Sin motivo especificado'}${esPasado ? ' · ya pasó' : ''}</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="PreceptorCalendario.quitar('${d.id}')">Quitar</button>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Calendario</h3></div>
      <p style="font-size:.82rem;color:var(--text-2);margin-bottom:16px;max-width:680px">
        Un día cargado acá bloquea la asistencia de <strong>toda la institución</strong>, o solo de un año/división si
        elegís un alcance acotado — nadie afectado puede tildar presente ni corregir asistencia ese día. Usalo para
        feriados cargados con anticipación o para algo imprevisto (corte de servicios, paro, etc.). Si elegís una
        fecha de hoy o anterior, se justifica automáticamente a los alumnos afectados que ya tuvieran algo registrado.
      </p>

      <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;margin-bottom:28px">
        <div class="card" style="flex:1;min-width:320px;max-width:520px">
          <div class="form-group">
            <label>Fecha</label>
            <input type="date" id="cal-fecha" value="${hoy}">
          </div>
          <div class="form-group">
            <label>Motivo</label>
            <input type="text" id="cal-motivo" placeholder="Ej: Corte de agua de red, Feriado nacional…">
          </div>
          <div class="form-group">
            <label>Alcance</label>
            <select id="cal-alcance" onchange="PreceptorCalendario._toggleAlcance()">
              <option value="institucion">Toda la institución</option>
              <option value="acotado">Año y división específicos</option>
            </select>
          </div>
          <div id="cal-alcance-detalle" style="display:none;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group">
              <label>Año</label>
              <select id="cal-anio">
                ${[1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}">${n}°</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>División</label>
              <select id="cal-division">
                <option value="">Ambas (A y B)</option>
                <option value="A">Solo A</option>
                <option value="B">Solo B</option>
              </select>
            </div>
          </div>
          <button class="btn btn-primary" id="cal-save-btn" onclick="PreceptorCalendario.declarar()">Declarar día sin clases</button>
        </div>

        <div style="flex:1;min-width:320px">
          ${this._renderCalendarioMensual()}
        </div>
      </div>

      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">
        Días cargados (${dias.length})
      </div>
      ${dias.length ? rows : '<div style="color:var(--text-3);font-size:.85rem;padding:12px 0">Todavía no cargaste ningún día.</div>'}`;
  },

  _toggleAlcance() {
    const es = document.getElementById('cal-alcance').value === 'acotado';
    document.getElementById('cal-alcance-detalle').style.display = es ? 'grid' : 'none';
  },

  async declarar() {
    const btn = document.getElementById('cal-save-btn');
    const fecha = document.getElementById('cal-fecha').value;
    const motivo = document.getElementById('cal-motivo').value.trim();
    const esAcotado = document.getElementById('cal-alcance').value === 'acotado';
    const anio = esAcotado ? parseInt(document.getElementById('cal-anio').value) : null;
    const division = esAcotado ? (document.getElementById('cal-division').value || null) : null;

    if (!fecha) { Utils.toast('Elegí una fecha', 'error'); return; }

    const session = Auth.session();
    Utils.btnLoading(btn, true);

    // No se usa upsert con onConflict porque ahora puede haber varias filas por
    // fecha (una por cada alcance) — se busca a mano si ya existe ESTE alcance exacto.
    let existeQuery = sb.from('no_class_days').select('id')
      .eq('institution_id', session.inst).eq('day_date', fecha);
    existeQuery = anio === null ? existeQuery.is('anio', null) : existeQuery.eq('anio', anio);
    existeQuery = division === null ? existeQuery.is('division', null) : existeQuery.eq('division', division);
    const { data: existente } = await existeQuery.maybeSingle();

    const payload = { institution_id: session.inst, day_date: fecha, reason: motivo || null, created_by: session.id, anio, division };
    const { error } = existente
      ? await sb.from('no_class_days').update(payload).eq('id', existente.id)
      : await sb.from('no_class_days').insert(payload);

    if (error) {
      Utils.btnLoading(btn, false);
      Utils.toast('Error: ' + error.message, 'error');
      return;
    }

    const hoy = Utils.hoyLocal();
    let justificados = 0;
    if (fecha <= hoy) {
      justificados = await this._justificarMasivo(session.inst, fecha, motivo, anio, division);
    }

    Utils.btnLoading(btn, false);
    Utils.toast(justificados
      ? `Día declarado sin clases — se justificaron ${justificados} registros existentes`
      : 'Día declarado sin clases');
    this.init();
  },

  // Recorre las materias del alcance elegido (todas, o solo las de ese año/división)
  // y pone "justificada" a todos sus inscriptos para esa fecha (crea la sesión y
  // los registros si hacía falta).
  async _justificarMasivo(institutionId, fecha, motivo, scopeAnio, scopeDivision) {
    const session = Auth.session();

    const { data: carreras } = await sb.from('careers').select('id').eq('institution_id', institutionId);
    const careerIds = (carreras || []).map(c => c.id);
    if (!careerIds.length) return 0;

    let materiasQuery = sb.from('subjects').select('id').in('career_id', careerIds);
    if (scopeAnio !== null)     materiasQuery = materiasQuery.eq('year', scopeAnio);
    if (scopeDivision !== null) materiasQuery = materiasQuery.eq('division', scopeDivision);
    const { data: materias } = await materiasQuery;
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

  // ── Calendario mensual (solo visual — la lista de arriba es la que manda) ──

  cambiarMes(delta) {
    let { year, month } = this._mesVista;
    month += delta;
    if (month < 0) { month = 11; year--; }
    if (month > 11) { month = 0; year++; }
    this._mesVista = { year, month };
    this._render();
  },

  _renderCalendarioMensual() {
    const { year, month } = this._mesVista;
    const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const DIAS_SEM = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const hoy = Utils.hoyLocal();

    const porFecha = {};
    this._dias.forEach(d => { (porFecha[d.day_date] = porFecha[d.day_date] || []).push(d); });

    const primerDia = new Date(year, month, 1);
    const ultimoDia = new Date(year, month + 1, 0);
    const offsetInicial = primerDia.getDay(); // 0=domingo
    const totalDias = ultimoDia.getDate();

    const celdas = [];
    for (let i = 0; i < offsetInicial; i++) celdas.push(null);
    for (let d = 1; d <= totalDias; d++) celdas.push(d);
    while (celdas.length % 7 !== 0) celdas.push(null);

    const celdasHtml = celdas.map(d => {
      if (d === null) return '<div></div>';
      const fechaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const declarados = porFecha[fechaStr] || [];
      const esHoy = fechaStr === hoy;
      const tieneDeclaracion = declarados.length > 0;
      const titulo = declarados.map(x => `${this._etiquetaAlcance(x)}: ${x.reason || 'sin motivo'}`).join(' | ');
      return `
        <div title="${titulo}" style="min-height:62px;border-radius:8px;padding:6px;
          background:${tieneDeclaracion ? 'rgba(239,68,68,.12)' : 'var(--bg-base)'};
          border:1px solid ${esHoy ? 'var(--accent)' : 'var(--border)'};">
          <div style="font-size:.75rem;font-weight:${esHoy ? '700' : '500'};color:${esHoy ? 'var(--accent)' : 'var(--text-2)'}">${d}</div>
          ${declarados.slice(0, 2).map(x => `
            <div style="font-size:.6rem;color:var(--danger);background:rgba(239,68,68,.15);border-radius:4px;padding:1px 4px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
              ${this._etiquetaAlcance(x)}
            </div>`).join('')}
          ${declarados.length > 2 ? `<div style="font-size:.6rem;color:var(--text-3);margin-top:2px">+${declarados.length - 2} más</div>` : ''}
        </div>`;
    }).join('');

    return `
      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:10px">
        Vista mensual
      </div>
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px;max-width:760px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <button class="btn btn-ghost btn-sm" onclick="PreceptorCalendario.cambiarMes(-1)">← Anterior</button>
          <div style="font-weight:600;color:var(--text-1)">${NOMBRES_MES[month]} ${year}</div>
          <button class="btn btn-ghost btn-sm" onclick="PreceptorCalendario.cambiarMes(1)">Siguiente →</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
          ${DIAS_SEM.map(d => `<div style="text-align:center;font-size:.68rem;font-weight:700;color:var(--text-3);text-transform:uppercase">${d}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
          ${celdasHtml}
        </div>
      </div>`;
  },
};
