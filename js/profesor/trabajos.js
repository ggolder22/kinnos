const ProfesorTrabajos = {
  _tpActual: null, // { id, title } del TP con entregas abiertas

  // ── Lista principal ──────────────────────────────────────

  async init() {
    const el = document.getElementById('trabajos-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('assignments')
      .select('*, assignment_submissions(count)')
      .eq('subject_id', ProfesorState.materia.id)
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar trabajos prácticos', 'error'); return; }

    // Alumnos inscriptos, para saber cuántos faltan entregar
    const { count: totalAlumnos } = await sb
      .from('student_subjects')
      .select('*', { count: 'exact', head: true })
      .eq('subject_id', ProfesorState.materia.id);

    this._render(data || [], totalAlumnos || 0);
  },

  _render(data, totalAlumnos) {
    const el = document.getElementById('trabajos-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="ProfesorTrabajos.openModal()">+ Nuevo trabajo práctico</button>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Trabajos Prácticos</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">📎</div><p>No hay trabajos prácticos creados.</p></div>`;
      return;
    }

    const rows = data.map(tp => {
      const entregados = tp.assignment_submissions?.[0]?.count ?? 0;
      const vencido = tp.due_date && new Date(tp.due_date) < new Date();
      const fechaBadge = tp.due_date
        ? `<span class="badge ${vencido ? 'badge-inactive' : 'badge-active'}" style="font-size:.65rem">
             ${vencido ? 'Venció' : 'Vence'} ${Utils.formatDate(tp.due_date)}
           </span>`
        : '<span class="badge badge-practice" style="font-size:.65rem">Sin fecha límite</span>';

      return `
        <tr>
          <td class="text-main">${tp.title}</td>
          <td>${fechaBadge}</td>
          <td style="text-align:center">${entregados} / ${totalAlumnos}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-ghost btn-sm" onclick="ProfesorTrabajos.verEntregas('${tp.id}','${tp.title.replace(/'/g,"\\'")}')">
                Entregas${entregados > 0 ? ` <span class="badge badge-practice" style="font-size:.62rem;margin-left:4px">${entregados}</span>` : ''}
              </button>
              <button class="btn btn-ghost btn-sm" onclick="ProfesorTrabajos.openModal(${JSON.stringify(tp).replace(/"/g,'&quot;')})">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="ProfesorTrabajos.delete('${tp.id}','${tp.title.replace(/'/g,"\\'")}')">Eliminar</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Trabajos Prácticos</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Título</th><th>Fecha límite</th><th style="text-align:center">Entregados</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  // ── Modal crear / editar ──────────────────────────────────

  openModal(item = null) {
    document.getElementById('tp-modal-title').textContent = item ? 'Editar trabajo práctico' : 'Nuevo trabajo práctico';
    document.getElementById('tp-modal-id').value         = item?.id          || '';
    document.getElementById('tp-modal-nombre').value     = item?.title       || '';
    document.getElementById('tp-modal-desc').value       = item?.description || '';
    document.getElementById('tp-modal-fecha').value      = item?.due_date ? item.due_date.slice(0, 16) : '';
    document.getElementById('tp-modal-pdf-file').value   = '';

    const pdfActual = document.getElementById('tp-pdf-actual');
    if (item?.pdf_url) {
      pdfActual.style.display = 'flex';
      document.getElementById('tp-pdf-link').href          = item.pdf_url;
      document.getElementById('tp-pdf-nombre').textContent = this._nombreArchivo(item.pdf_url);
    } else {
      pdfActual.style.display = 'none';
    }

    document.getElementById('tp-modal').classList.remove('hidden');
    document.getElementById('tp-modal-nombre').focus();
  },

  closeModal() {
    document.getElementById('tp-modal').classList.add('hidden');
  },

  async save() {
    const btn    = document.getElementById('tp-modal-save');
    const id     = document.getElementById('tp-modal-id').value;
    const title  = document.getElementById('tp-modal-nombre').value.trim();
    const desc   = document.getElementById('tp-modal-desc').value.trim();
    const fecha  = document.getElementById('tp-modal-fecha').value;
    const file   = document.getElementById('tp-modal-pdf-file').files[0];

    if (!title) { Utils.toast('El título es obligatorio', 'error'); return; }

    Utils.btnLoading(btn, true);

    let pdf_url;
    if (file) {
      const ext  = file.name.split('.').pop();
      const path = `tp/${ProfesorState.materia.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('materiales')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) {
        Utils.btnLoading(btn, false);
        Utils.toast('Error al subir el enunciado: ' + uploadError.message, 'error');
        return;
      }
      const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(uploadData.path);
      pdf_url = publicUrl;
    }

    const payload = {
      title, description: desc || null,
      due_date: fecha ? new Date(fecha).toISOString() : null,
      subject_id: ProfesorState.materia.id,
      ...(pdf_url ? { pdf_url } : {}),
    };

    const { error } = id
      ? await sb.from('assignments').update(payload).eq('id', id)
      : await sb.from('assignments').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Trabajo práctico actualizado' : 'Trabajo práctico creado');
    this.closeModal();
    this.init();
  },

  async delete(id, title) {
    if (!await Utils.confirmar(`¿Eliminar "${title}"? Se borrarán también las entregas de los alumnos.`)) return;
    const { error } = await sb.from('assignments').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Trabajo práctico eliminado');
    this.init();
  },

  // ── Panel de entregas ─────────────────────────────────────

  async verEntregas(tpId, tpTitle) {
    this._tpActual = { id: tpId, title: tpTitle };
    document.getElementById('tp-entregas-title').textContent = `Entregas — ${tpTitle}`;
    document.getElementById('tp-entregas-modal').classList.remove('hidden');
    await this._loadEntregas();
  },

  cerrarEntregas() {
    document.getElementById('tp-entregas-modal').classList.add('hidden');
  },

  async _loadEntregas() {
    const el = document.getElementById('tp-entregas-body');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: entregas } = await sb
      .from('assignment_submissions')
      .select('*, students(full_name, dni)')
      .eq('assignment_id', this._tpActual.id)
      .order('submitted_at', { ascending: false });

    this._renderEntregas(entregas || []);
  },

  _renderEntregas(entregas) {
    const el = document.getElementById('tp-entregas-body');

    if (!entregas.length) {
      el.innerHTML = `<div style="padding:32px;text-align:center;color:var(--text-3);font-size:.85rem">
        Ningún alumno entregó este trabajo todavía.
      </div>`;
      return;
    }

    const rows = entregas.map(e => {
      const nombre = e.students?.full_name || 'Alumno';
      const revisado = e.status === 'reviewed';
      return `
        <div style="padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:160px">
              <div style="font-size:.875rem;font-weight:500;color:var(--text-1)">${nombre}</div>
              <div style="font-size:.73rem;color:var(--text-3)">Entregado: ${Utils.formatDate(e.submitted_at)}</div>
            </div>
            <a href="${e.file_url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">📄 ${e.file_name || 'Ver PDF'}</a>
            <span class="badge ${revisado ? 'badge-active' : 'badge-practice'}" style="font-size:.65rem">
              ${revisado ? '✓ Revisado' : '⏳ Pendiente'}
            </span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">
            <input type="number" id="tp-grade-${e.id}" placeholder="Nota (0-10)" value="${e.grade ?? ''}" min="0" max="10" step="0.5"
              style="width:110px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-base);color:var(--text-1);font-size:.85rem">
            <input type="text" id="tp-notes-${e.id}" placeholder="Observaciones…" value="${(e.professor_notes || '').replace(/"/g,'&quot;')}"
              style="flex:1;min-width:160px;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--bg-base);color:var(--text-1);font-size:.85rem">
            <button class="btn btn-primary btn-sm" onclick="ProfesorTrabajos._guardarRevision('${e.id}')">Guardar</button>
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `<div style="font-size:.73rem;color:var(--text-3);margin-bottom:8px;text-align:right">${entregas.length} entrega${entregas.length !== 1 ? 's' : ''}</div>${rows}`;
  },

  async _guardarRevision(subId) {
    const grade = document.getElementById(`tp-grade-${subId}`).value;
    const notes = document.getElementById(`tp-notes-${subId}`).value.trim();

    const { error } = await sb.from('assignment_submissions').update({
      grade: grade !== '' ? parseFloat(grade.replace(',', '.')) : null,
      professor_notes: notes || null,
      status: 'reviewed',
    }).eq('id', subId);

    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Revisión guardada');
    this._loadEntregas();
  },

  _nombreArchivo(url) {
    try { return decodeURIComponent(url.split('/').pop().split('?')[0]); }
    catch { return 'archivo.pdf'; }
  },
};
