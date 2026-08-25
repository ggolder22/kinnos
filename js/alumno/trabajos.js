const AlumnoTrabajos = {
  async init() {
    const el = document.getElementById('trabajos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    const { data: trabajos, error } = await sb
      .from('assignments')
      .select('*')
      .eq('subject_id', AlumnoState.materia.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar trabajos prácticos', 'error'); return; }

    const tpIds = (trabajos || []).map(t => t.id);
    let entregas = {};
    if (tpIds.length) {
      const { data: subs } = await sb
        .from('assignment_submissions')
        .select('*')
        .eq('student_id', session.id)
        .in('assignment_id', tpIds);
      (subs || []).forEach(s => { entregas[s.assignment_id] = s; });
    }

    this._render(trabajos || [], entregas);
  },

  _render(trabajos, entregas) {
    const el = document.getElementById('trabajos-content');

    if (!trabajos.length) {
      el.innerHTML = `<div class="page-header"><h3>Trabajos Prácticos</h3></div>
        <div class="empty-state"><div class="icon">📎</div><p>No hay trabajos prácticos publicados todavía.</p></div>`;
      return;
    }

    const cards = trabajos.map(tp => {
      const entrega = entregas[tp.id];
      const vencido = tp.due_date && new Date(tp.due_date) < new Date();

      const fechaLine = tp.due_date
        ? `<div style="font-size:.78rem;color:${vencido && !entrega ? 'var(--danger)' : 'var(--text-3)'}">
             ${vencido ? 'Venció' : 'Entrega hasta'}: ${Utils.formatDate(tp.due_date)}
           </div>`
        : '';

      const enunciadoBtn = tp.pdf_url
        ? `<a href="${tp.pdf_url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">📄 Ver enunciado</a>`
        : '';

      let entregaHtml;
      if (entrega) {
        const revisado = entrega.status === 'reviewed';
        entregaHtml = `
          <div style="margin-top:10px;padding:10px 12px;background:var(--bg-base);border:1px solid var(--border);border-radius:8px">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <a href="${entrega.file_url}" target="_blank" rel="noopener" style="color:var(--accent);font-size:.85rem;flex:1;min-width:120px">
                📄 ${entrega.file_name || 'Tu entrega'}
              </a>
              <span class="badge ${revisado ? 'badge-active' : 'badge-practice'}" style="font-size:.65rem">
                ${revisado ? '✓ Revisado' : '⏳ En revisión'}
              </span>
            </div>
            <div style="font-size:.73rem;color:var(--text-3);margin-top:4px">Entregado: ${Utils.formatDate(entrega.submitted_at)}</div>
            ${revisado ? `
              <div style="margin-top:8px;display:flex;gap:14px;align-items:center;flex-wrap:wrap">
                ${entrega.grade != null ? `<div style="font-size:1rem;font-weight:700;color:var(--accent)">${entrega.grade}/10</div>` : ''}
                ${entrega.professor_notes ? `<div style="font-size:.8rem;color:var(--text-2)"><strong>Docente:</strong> ${entrega.professor_notes}</div>` : ''}
              </div>` : ''}
            <div style="margin-top:10px">
              <input type="file" id="tp-file-${tp.id}" accept=".pdf,application/pdf" style="font-size:.8rem">
              <button class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="AlumnoTrabajos.entregar('${tp.id}')">Reemplazar entrega</button>
            </div>
          </div>`;
      } else {
        entregaHtml = `
          <div style="margin-top:10px;padding:10px 12px;background:var(--bg-base);border:1px solid var(--border);border-radius:8px">
            <input type="file" id="tp-file-${tp.id}" accept=".pdf,application/pdf" style="font-size:.8rem">
            <button class="btn btn-primary btn-sm" style="margin-top:6px" onclick="AlumnoTrabajos.entregar('${tp.id}')">Entregar PDF</button>
          </div>`;
      }

      return `
        <div class="examen-card" style="flex-direction:column;align-items:stretch">
          <div class="examen-card-info">
            <div class="exam-title">${tp.title}</div>
            ${tp.description ? `<div style="font-size:.82rem;color:var(--text-2);margin-top:4px">${tp.description}</div>` : ''}
            <div class="exam-meta" style="margin-top:6px">${fechaLine}${enunciadoBtn ? ' &nbsp; ' + enunciadoBtn : ''}</div>
          </div>
          ${entregaHtml}
        </div>`;
    }).join('');

    el.innerHTML = `<div class="page-header"><h3>Trabajos Prácticos</h3></div>${cards}`;
  },

  async entregar(tpId) {
    const fileInput = document.getElementById(`tp-file-${tpId}`);
    const file = fileInput.files[0];
    if (!file) { Utils.toast('Elegí un archivo PDF primero', 'error'); return; }
    if (file.type !== 'application/pdf') { Utils.toast('El archivo debe ser un PDF', 'error'); return; }

    const session = Auth.session();
    const path = `tp/${AlumnoState.materia.id}/entregas/${tpId}/${session.id}-${Date.now()}.pdf`;

    const { data: uploadData, error: uploadError } = await sb.storage
      .from('materiales')
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadError) { Utils.toast('Error al subir: ' + uploadError.message, 'error'); return; }

    const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(uploadData.path);

    const { error } = await sb.from('assignment_submissions').upsert({
      assignment_id: tpId,
      student_id: session.id,
      file_url: publicUrl,
      file_name: file.name,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'assignment_id,student_id' });

    if (error) { Utils.toast('Error al guardar la entrega: ' + error.message, 'error'); return; }
    Utils.toast('Trabajo entregado correctamente');
    this.init();
  },
};
