const DOCS_PERSONALES = [
  { type: 'DNI',    label: 'Fotocopia DNI' },
  { type: 'CBU',    label: 'Comprobante CBU' },
  { type: 'ANSES',  label: 'Comprobante ANSES' },
  { type: 'DDJJ',   label: 'Declaración Jurada (DDJJ)' },
  { type: 'TITULO', label: 'Título Docente' },
  { type: 'CV',     label: 'Currículum Vitae' },
];

const ProfesorLegajo = {
  _prof:      null,
  _docs:      [],
  _subjects:  [],
  _plannings: [],

  async abrir() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-legajo').classList.add('active');
    document.getElementById('tabs-bar').classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-legajo').classList.add('active');

    document.getElementById('topbar-materia').textContent = 'Mi Legajo';
    document.getElementById('topbar-sub').textContent = '';

    const session = Auth.session();
    const el = document.getElementById('legajo-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const [
      { data: prof },
      { data: docs },
      { data: materias },
      { data: plannings },
    ] = await Promise.all([
      sb.from('professors').select('*').eq('id', session.id).single(),
      sb.from('professor_documents').select('*').eq('professor_id', session.id).order('uploaded_at'),
      sb.from('professor_subjects').select('subjects(id, name)').eq('professor_id', session.id),
      sb.from('subject_plannings').select('subject_id, updated_at').eq('professor_id', session.id),
    ]);

    this._prof      = prof;
    this._docs      = docs || [];
    this._subjects  = (materias || []).map(r => r.subjects).filter(Boolean);
    this._plannings = plannings || [];

    this._render();
  },

  _render() {
    const p  = this._prof;
    const el = document.getElementById('legajo-content');
    const legajoFmt = p.legajo_num ? String(p.legajo_num).padStart(5, '0') : '—';

    const byType = {};
    for (const d of this._docs) {
      (byType[d.doc_type] = byType[d.doc_type] || []).push(d);
    }

    const personalRows = DOCS_PERSONALES.map(def => {
      const docs = byType[def.type] || [];
      const docsHtml = docs.map(d => `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <a href="${d.file_url}" target="_blank" rel="noopener"
             style="flex:1;font-size:.85rem;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${d.file_name || def.label}
          </a>
          <span style="font-size:.72rem;color:var(--text-3)">${Utils.formatDate(d.uploaded_at)}</span>
          <button class="btn btn-danger btn-sm" onclick="ProfesorLegajo.eliminarDoc('${d.id}','${d.file_url.replace(/'/g, "\\'")}')">✕</button>
        </div>`).join('');
      return `
        <div class="legajo-doc-row">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span style="font-size:.875rem;font-weight:500;color:var(--text-1)">${def.label}</span>
            <button class="btn btn-ghost btn-sm" onclick="ProfesorLegajo.subirDoc('${def.type}', null)">
              ${docs.length ? 'Reemplazar' : '+ Subir'}
            </button>
          </div>
          ${docsHtml || '<div style="font-size:.8rem;color:var(--text-3);margin-top:4px">Sin documento</div>'}
        </div>`;
    }).join('');

    const planRows = this._subjects.map(s => {
      const planDocs   = (byType['PLANIFICACION'] || []).filter(d => d.subject_id === s.id);
      const planGuard  = this._plannings.find(p => p.subject_id === s.id);

      const statusHtml = planGuard
        ? `<span style="font-size:.75rem;color:var(--success)">✓ Guardada ${Utils.formatDate(planGuard.updated_at)}</span>`
        : `<span style="font-size:.75rem;color:var(--text-3)">Sin planificación</span>`;

      const docsHtml = planDocs.map(d => `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px">
          <a href="${d.file_url}" target="_blank" rel="noopener"
             style="flex:1;font-size:.85rem;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${d.file_name || 'Planificación PDF'}
          </a>
          <span style="font-size:.72rem;color:var(--text-3)">${Utils.formatDate(d.uploaded_at)}</span>
          <button class="btn btn-danger btn-sm" onclick="ProfesorLegajo.eliminarDoc('${d.id}','${d.file_url.replace(/'/g, "\\'")}')">✕</button>
        </div>`).join('');

      return `
        <div class="legajo-doc-row">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
            <div>
              <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">${s.name}</div>
              <div style="margin-top:3px">${statusHtml}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-primary btn-sm" onclick="ProfesorLegajo.irAPlanificacion('${s.id}')">
                ${planGuard ? 'Editar planificación' : 'Crear planificación'}
              </button>
              <button class="btn btn-ghost btn-sm" onclick="ProfesorLegajo.subirDoc('PLANIFICACION','${s.id}')" title="Subir PDF firmado">
                📎 PDF
              </button>
            </div>
          </div>
          ${docsHtml ? `<div style="margin-top:4px">${docsHtml}</div>` : ''}
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="legajo-profile-card">
        <div class="legajo-num-badge">Legajo N° ${legajoFmt}</div>
        <div class="legajo-fullname">${p.full_name}</div>
        <div class="legajo-meta">
          DNI ${p.dni}${p.email ? ' · ' + p.email : ''}${p.phone ? ' · ' + p.phone : ''}
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="ProfesorLegajo.abrirPerfil()">
          Editar perfil
        </button>
      </div>

      <div class="page-header" style="margin-top:28px"><h3>Documentación personal</h3></div>
      <div class="table-wrap" style="padding:0 0 4px">
        ${personalRows}
      </div>

      ${this._subjects.length ? `
        <div class="page-header" style="margin-top:28px"><h3>Planificaciones de materias</h3></div>
        <div class="table-wrap" style="padding:0 0 4px">
          ${planRows}
        </div>` : ''}
    `;
  },

  subirDoc(docType, subjectId) {
    const input = document.createElement('input');
    input.type   = 'file';
    input.accept = '.pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*';
    input.onchange = () => {
      if (input.files[0]) this._uploadDoc(docType, subjectId, input.files[0]);
    };
    input.click();
  },

  async _uploadDoc(docType, subjectId, file) {
    const session = Auth.session();
    const ext  = file.name.split('.').pop();
    const slug = subjectId ? `${docType.toLowerCase()}_${subjectId}` : docType.toLowerCase();
    const path = `${session.id}/${slug}_${Date.now()}.${ext}`;

    const { data: uploadData, error: uploadError } = await sb.storage
      .from('legajos')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) {
      Utils.toast('Error al subir: ' + uploadError.message, 'error');
      return;
    }

    const { data: { publicUrl } } = sb.storage.from('legajos').getPublicUrl(uploadData.path);

    const { error } = await sb.from('professor_documents').insert({
      professor_id: session.id,
      subject_id:   subjectId || null,
      doc_type:     docType,
      file_url:     publicUrl,
      file_name:    file.name,
    });

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast('Documento subido');
    this.abrir();
  },

  async eliminarDoc(docId, fileUrl) {
    if (!await Utils.confirmar('¿Eliminar este documento?')) return;
    const path = this._pathDesdeUrl(fileUrl);
    if (path) await sb.storage.from('legajos').remove([path]);
    const { error } = await sb.from('professor_documents').delete().eq('id', docId);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Documento eliminado');
    this.abrir();
  },

  abrirPerfil() {
    const p = this._prof;
    document.getElementById('perfil-modal-name').value  = p.full_name || '';
    document.getElementById('perfil-modal-email').value = p.email     || '';
    document.getElementById('perfil-modal-phone').value = p.phone     || '';
    document.getElementById('perfil-modal').classList.remove('hidden');
    document.getElementById('perfil-modal-name').focus();
  },

  async guardarPerfil() {
    const btn   = document.getElementById('perfil-modal-save');
    const name  = document.getElementById('perfil-modal-name').value.trim();
    const email = document.getElementById('perfil-modal-email').value.trim();
    const phone = document.getElementById('perfil-modal-phone').value.trim();
    if (!name) { Utils.toast('El nombre es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);
    const session = Auth.session();
    const { error } = await sb.from('professors')
      .update({ full_name: name, email: email || null, phone: phone || null })
      .eq('id', session.id);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }

    sessionStorage.setItem('kinnos_nombre', name);
    document.getElementById('prof-greeting').textContent = name;
    document.getElementById('perfil-modal').classList.add('hidden');
    Utils.toast('Perfil actualizado');
    this.abrir();
  },

  irAPlanificacion(subjectId) {
    ProfesorState.seccion = 'planificacion';
    ProfesorMaterias.seleccionar(subjectId);
    if (window.innerWidth <= 768) closeDrawer();
  },

  _pathDesdeUrl(url) {
    try {
      const match = url.match(/\/legajos\/(.+)/);
      return match ? match[1] : null;
    } catch { return null; }
  },
};
