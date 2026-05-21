const ProfesorUnidades = {
  async init() {
    const el = document.getElementById('unidades-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('units')
      .select('*')
      .eq('subject_id', ProfesorState.materia.id)
      .order('unit_num');

    if (error) { Utils.toast('Error al cargar unidades', 'error'); return; }
    this._render(data);
  },

  _render(data) {
    const el = document.getElementById('unidades-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="ProfesorUnidades.openModal()">+ Nueva unidad</button>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Unidades</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">📚</div><p>No hay unidades todavía.</p></div>`;
      return;
    }

    const rows = data.map(u => `
      <tr>
        <td style="width:48px;text-align:center;font-weight:700;color:var(--accent)">${u.unit_num}</td>
        <td class="text-main">${u.title}</td>
        <td>${u.tag ? `<span class="badge badge-indigo">${u.tag}</span>` : '—'}</td>
        <td style="font-size:.8rem;color:var(--text-3)">
          ${Array.isArray(u.topics) ? u.topics.slice(0,3).join(', ') + (u.topics.length > 3 ? '…' : '') : '—'}
        </td>
        <td>
          ${u.pdf_url
            ? `<a href="${u.pdf_url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">📄 Ver PDF</a>`
            : '<span style="color:var(--text-3);font-size:.8rem">Sin PDF</span>'}
        </td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="ProfesorUnidades.openModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="ProfesorUnidades.delete('${u.id}','${u.title.replace(/'/g, "\\'")}','${u.pdf_url || ''}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Unidades</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Título</th><th>Etiqueta</th><th>Temas</th><th>PDF</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  async openModal(item = null) {
    document.getElementById('uni-modal-title').textContent = item ? 'Editar unidad' : 'Nueva unidad';
    document.getElementById('uni-modal-id').value      = item?.id    || '';
    document.getElementById('uni-modal-titulo').value  = item?.title || '';
    document.getElementById('uni-modal-topics').value  = Array.isArray(item?.topics) ? item.topics.join('\n') : '';

    // Auto-incrementar número si es nueva unidad
    if (item) {
      document.getElementById('uni-modal-num').value = item.unit_num;
    } else {
      const { count } = await sb.from('units')
        .select('*', { count: 'exact', head: true })
        .eq('subject_id', ProfesorState.materia.id);
      document.getElementById('uni-modal-num').value = (count || 0) + 1;
    }

    // Etiqueta: select con opción guardada pre-seleccionada
    const tagSel = document.getElementById('uni-modal-tag');
    tagSel.value = item?.tag || '';
    document.getElementById('uni-modal-content').value = item?.content  || '';
    document.getElementById('uni-modal-pdf-file').value = '';

    // Mostrar PDF actual si existe
    const pdfActual = document.getElementById('uni-pdf-actual');
    if (item?.pdf_url) {
      pdfActual.style.display = 'flex';
      document.getElementById('uni-pdf-nombre').textContent = this._nombreArchivo(item.pdf_url);
      document.getElementById('uni-pdf-link').href = item.pdf_url;
    } else {
      pdfActual.style.display = 'none';
    }

    document.getElementById('uni-modal').classList.remove('hidden');
    document.getElementById('uni-modal-titulo').focus();
  },

  closeModal() {
    document.getElementById('uni-modal').classList.add('hidden');
  },

  async save() {
    const btn    = document.getElementById('uni-modal-save');
    const id     = document.getElementById('uni-modal-id').value;
    const num    = parseInt(document.getElementById('uni-modal-num').value);
    const title  = document.getElementById('uni-modal-titulo').value.trim();
    const tag    = document.getElementById('uni-modal-tag').value.trim();
    const topics = document.getElementById('uni-modal-topics').value
      .split('\n').map(t => t.trim()).filter(Boolean);
    const content = document.getElementById('uni-modal-content').value.trim();
    const fileInput = document.getElementById('uni-modal-pdf-file');
    const file = fileInput.files[0];

    if (!title || !num) { Utils.toast('Número y título son obligatorios', 'error'); return; }

    Utils.btnLoading(btn, true);

    // Subir PDF si se seleccionó uno
    let pdf_url = null;
    if (file) {
      const ext  = file.name.split('.').pop();
      const path = `${ProfesorState.materia.id}/${Date.now()}.${ext}`;
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('materiales')
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        Utils.btnLoading(btn, false);
        Utils.toast('Error al subir el PDF: ' + uploadError.message, 'error');
        return;
      }
      const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(uploadData.path);
      pdf_url = publicUrl;
    }

    const payload = {
      unit_num: num, title, tag: tag || null, topics,
      content: content || null, subject_id: ProfesorState.materia.id,
      updated_at: new Date().toISOString(),
      ...(pdf_url ? { pdf_url } : {}),  // solo actualiza si subió archivo nuevo
    };

    const { error } = id
      ? await sb.from('units').update(payload).eq('id', id)
      : await sb.from('units').insert({ ...payload, pdf_url });
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Unidad actualizada' : 'Unidad creada');
    this.closeModal();
    this.init();
  },

  async delete(id, title, pdfUrl) {
    if (!await Utils.confirmar(`¿Eliminar la unidad "${title}"?`)) return;

    // Eliminar archivo de Storage si existe
    if (pdfUrl) {
      const path = this._pathDesdeUrl(pdfUrl);
      if (path) await sb.storage.from('materiales').remove([path]);
    }

    const { error } = await sb.from('units').delete().eq('id', id);
    if (error) { Utils.toast('Error al eliminar: ' + error.message, 'error'); return; }
    Utils.toast('Unidad eliminada');
    this.init();
  },

  _nombreArchivo(url) {
    try { return decodeURIComponent(url.split('/').pop().split('?')[0]); }
    catch { return 'archivo.pdf'; }
  },

  _pathDesdeUrl(url) {
    try {
      const match = url.match(/\/materiales\/(.+)/);
      return match ? match[1] : null;
    } catch { return null; }
  },
};
