const PreceptorAsistencia = {
  _alumnoActual: null,
  _registros: [],
  _certRecordId: null, // registro de asistencia al que se le está subiendo el certificado (o null = certificado general)

  async init() {
    const el = document.getElementById('asistencia-content');
    if (this._alumnoActual) return this._renderAlumno();
    this._renderBuscador(el);
  },

  _renderBuscador(el) {
    el.innerHTML = `
      <div class="page-header"><h3>Asistencia</h3></div>
      <div class="card" style="max-width:480px">
        <div class="form-group" style="margin-bottom:10px">
          <label>Buscar alumno por nombre o DNI</label>
          <input type="text" id="prec-asis-buscar" placeholder="Ej: Pérez o 40123456"
            oninput="PreceptorAsistencia._buscar(this.value)">
        </div>
        <div id="prec-asis-resultados"></div>
      </div>`;
  },

  async _buscar(q) {
    const cont = document.getElementById('prec-asis-resultados');
    const texto = q.trim().toLowerCase();
    if (texto.length < 2) { cont.innerHTML = ''; return; }

    const session = Auth.session();
    const { data } = await sb.from('students').select('*')
      .eq('institution_id', session.inst)
      .or(`dni.ilike.%${texto}%,full_name.ilike.%${texto}%`)
      .limit(10);

    const resultados = data || [];
    cont.innerHTML = resultados.length
      ? resultados.map(a => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
            <div style="font-size:.85rem;color:var(--text-1)">${Utils.nombrePlanilla(a)} <span style="color:var(--text-3)">· DNI ${a.dni}</span></div>
            <button class="btn btn-primary btn-sm" onclick="PreceptorAsistencia.verAlumno('${a.id}')">Ver</button>
          </div>`).join('')
      : '<div style="color:var(--text-3);font-size:.85rem;padding:8px 0">Sin resultados.</div>';
  },

  async verAlumno(studentId) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-asistencia').classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-asistencia').classList.add('active');
    document.getElementById('topbar-title').textContent = 'Asistencia';

    const { data: alumno } = await sb.from('students').select('*').eq('id', studentId).single();
    if (!alumno) { Utils.toast('No se encontró el alumno', 'error'); return; }
    this._alumnoActual = alumno;
    await this._renderAlumno();
  },

  volverBuscador() {
    this._alumnoActual = null;
    this._renderBuscador(document.getElementById('asistencia-content'));
  },

  async _renderAlumno() {
    const el = document.getElementById('asistencia-content');
    el.innerHTML = `<div class="page-header"><h3>Asistencia</h3></div><div class="loading">Cargando…</div>`;
    const a = this._alumnoActual;

    const { data: registros } = await sb
      .from('attendance_records')
      .select('*, attendance_sessions(session_date, subject_id, subjects(name))')
      .eq('student_id', a.id)
      .order('marked_at', { ascending: false });
    this._registros = registros || [];

    const { data: certificados } = await sb
      .from('student_certificates').select('*')
      .eq('student_id', a.id).order('uploaded_at', { ascending: false });

    const { pct } = Asistencia.calcular(this._registros.map(r => ({ status: r.status })));

    const filas = this._registros.map(r => {
      const sesion = r.attendance_sessions;
      const materia = sesion?.subjects?.name || '—';
      const fecha = sesion?.session_date ? Utils.formatDate(sesion.session_date) : '—';
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1;min-width:0">
            <div style="font-size:.85rem;font-weight:500;color:var(--text-1)">${materia}</div>
            <div style="font-size:.72rem;color:var(--text-3)">${fecha}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            ${['presente', 'tarde', 'ausente', 'justificada'].map(st => `
              <button type="button" onclick="PreceptorAsistencia._corregir('${r.id}','${st}')"
                style="padding:5px 10px;border-radius:6px;font-size:.7rem;font-weight:600;cursor:pointer;
                  border:1px solid ${st === r.status ? Asistencia.COLOR[st] : 'var(--border)'};
                  background:${st === r.status ? Asistencia.COLOR[st] : 'var(--bg-base)'};
                  color:${st === r.status ? '#fff' : 'var(--text-3)'}">
                ${Asistencia.LABEL[st]}
              </button>`).join('')}
            <button class="btn btn-ghost btn-sm" onclick="PreceptorAsistencia.abrirCertificado('${r.id}')" title="Justificar con certificado">📎</button>
          </div>
        </div>`;
    }).join('');

    const certsHtml = (certificados || []).length
      ? certificados.map(c => `
          <div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-bottom:1px solid var(--border)">
            <a href="${c.file_url}" target="_blank" rel="noopener" style="flex:1;font-size:.82rem;color:var(--accent)">📎 ${c.file_name || 'Certificado'}</a>
            <span style="font-size:.72rem;color:var(--text-3)">${c.reason || ''} · ${Utils.formatDate(c.uploaded_at)}</span>
          </div>`).join('')
      : '<div style="color:var(--text-3);font-size:.82rem;padding:8px 0">Sin certificados cargados.</div>';

    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" style="margin-bottom:12px" onclick="PreceptorAsistencia.volverBuscador()">← Buscar otro alumno</button>
      <div class="page-header"><h3>${Utils.nombrePlanilla(a)}</h3></div>
      <div class="card" style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div>
          <div style="font-size:.78rem;color:var(--text-3)">DNI ${a.dni} · ${a.anio ? a.anio + '°' : ''} ${a.division || ''}</div>
          ${Asistencia.badge(pct)}
        </div>
        <button class="btn btn-primary btn-sm" onclick="PreceptorAsistencia.abrirCertificado(null)">+ Subir certificado</button>
      </div>

      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">Certificados</div>
      <div style="margin-bottom:20px">${certsHtml}</div>

      <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-3);margin-bottom:8px">Asistencia por materia (todas)</div>
      ${this._registros.length ? `<div style="max-height:440px;overflow-y:auto">${filas}</div>` : '<div style="color:var(--text-3);font-size:.85rem;padding:12px 0">Sin registros de asistencia todavía.</div>'}`;
  },

  async _corregir(recordId, status) {
    const session = Auth.session();
    const { error } = await sb.from('attendance_records').update({
      status, marked_by_role: 'preceptor', marked_by: session.id, marked_at: new Date().toISOString(),
    }).eq('id', recordId);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Asistencia corregida');
    this._renderAlumno();
  },

  // ── Certificados ───────────────────────────────────────────

  abrirCertificado(recordId) {
    this._certRecordId = recordId;
    document.getElementById('certificado-modal-alumno').textContent = Utils.nombrePlanilla(this._alumnoActual);
    document.getElementById('certificado-modal-motivo').value = '';
    document.getElementById('certificado-modal-file').value = '';
    document.getElementById('certificado-modal').classList.remove('hidden');
  },

  cerrarCertificado() {
    document.getElementById('certificado-modal').classList.add('hidden');
  },

  async subirCertificado() {
    const btn = document.getElementById('certificado-modal-save');
    const motivo = document.getElementById('certificado-modal-motivo').value.trim();
    const file = document.getElementById('certificado-modal-file').files[0];
    if (!file) { Utils.toast('Elegí un archivo primero', 'error'); return; }

    Utils.btnLoading(btn, true);
    const session = Auth.session();
    const a = this._alumnoActual;
    const path = `certificados/${a.id}/${Date.now()}-${file.name}`;

    const { data: uploadData, error: uploadError } = await sb.storage
      .from('materiales').upload(path, file, { contentType: file.type, upsert: true });
    if (uploadError) {
      Utils.btnLoading(btn, false);
      Utils.toast('Error al subir: ' + uploadError.message, 'error');
      return;
    }
    const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(uploadData.path);

    const { error } = await sb.from('student_certificates').insert({
      student_id: a.id, file_url: publicUrl, file_name: file.name, reason: motivo || null,
      attendance_record_id: this._certRecordId, uploaded_by: session.id,
    });

    if (!error && this._certRecordId) {
      await sb.from('attendance_records').update({
        status: 'justificada', marked_by_role: 'preceptor', marked_by: session.id, marked_at: new Date().toISOString(),
      }).eq('id', this._certRecordId);
    }

    Utils.btnLoading(btn, false);
    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }

    Utils.toast('Certificado subido');
    this.cerrarCertificado();
    this._renderAlumno();
  },
};
