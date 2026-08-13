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
    const el       = document.getElementById('unidades-content');
    const planLink = `<span style="font-size:.78rem;color:var(--text-3)">
      Las unidades se definen en la pestaña <strong style="color:var(--text-2);cursor:pointer" onclick="showTab('planificacion')">Planificación</strong>.
    </span>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Unidades</h3>${planLink}</div>
        <div class="empty-state">
          <div class="icon">📋</div>
          <p>Definí las unidades en la pestaña <strong style="cursor:pointer" onclick="showTab('planificacion')">Planificación</strong> y aparecerán aquí.</p>
        </div>`;
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
          ${(() => {
            const pdfs = this._pdfListFromItem(u);
            if (!pdfs.length) return '<span style="color:var(--text-3);font-size:.8rem">Sin PDF</span>';
            if (pdfs.length === 1) return `<a href="${pdfs[0].url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">📄 Ver PDF</a>`;
            return `<span style="color:var(--text-3);font-size:.8rem">📄 ${pdfs.length} archivos</span>`;
          })()}
        </td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="ProfesorEjercicios.abrir('${u.id}','${u.title.replace(/'/g, "\\'")}')">Ejercicios</button>
            <button class="btn btn-ghost btn-sm" onclick="ProfesorUnidades.openModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">Editar</button>
            <button class="btn btn-danger btn-sm" onclick="ProfesorUnidades.delete('${u.id}','${u.title.replace(/'/g, "\\'")}')">Eliminar</button>
          </div>
        </td>
      </tr>`).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Unidades</h3>${planLink}</div>
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

    // Lista de PDFs ya cargados (editable dentro del modal)
    this._modalPdfs = this._pdfListFromItem(item);
    this._renderPdfList();

    document.getElementById('uni-modal').classList.remove('hidden');
    document.getElementById('uni-modal-titulo').focus();
  },

  // Devuelve [{name, url}, ...] soportando también el viejo campo único pdf_url
  _pdfListFromItem(item) {
    if (Array.isArray(item?.pdf_urls) && item.pdf_urls.length) return item.pdf_urls;
    if (item?.pdf_url) return [{ name: this._nombreArchivo(item.pdf_url), url: item.pdf_url }];
    return [];
  },

  _renderPdfList() {
    const el = document.getElementById('uni-pdf-list');
    if (!this._modalPdfs.length) { el.innerHTML = ''; return; }
    el.innerHTML = this._modalPdfs.map((p, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-base);border:1px solid var(--border);border-radius:6px;font-size:.85rem">
        <a href="${p.url}" target="_blank" rel="noopener" style="color:var(--accent);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</a>
        <button type="button" class="btn btn-danger btn-sm" onclick="ProfesorUnidades._quitarPdfModal(${i})">✕</button>
      </div>`).join('');
  },

  _quitarPdfModal(idx) {
    this._modalPdfs.splice(idx, 1);
    this._renderPdfList();
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
    const files = Array.from(fileInput.files || []);

    if (!title || !num) { Utils.toast('Número y título son obligatorios', 'error'); return; }

    Utils.btnLoading(btn, true);

    // Subir los PDFs nuevos seleccionados (se agregan a los ya existentes, no los reemplazan)
    const pdfUrls = [...(this._modalPdfs || [])];
    for (const file of files) {
      const ext  = file.name.split('.').pop();
      const path = `${ProfesorState.materia.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('materiales')
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        Utils.btnLoading(btn, false);
        Utils.toast('Error al subir "' + file.name + '": ' + uploadError.message, 'error');
        return;
      }
      const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(uploadData.path);
      pdfUrls.push({ name: file.name, url: publicUrl });
    }

    const payload = {
      unit_num: num, title, tag: tag || null, topics,
      content: content || null, subject_id: ProfesorState.materia.id,
      updated_at: new Date().toISOString(),
      pdf_urls: pdfUrls,
      pdf_url: null, // el campo único queda en desuso; todo vive en pdf_urls
    };

    const { error } = id
      ? await sb.from('units').update(payload).eq('id', id)
      : await sb.from('units').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Unidad actualizada' : 'Unidad creada');
    this.closeModal();
    this.init();
  },

  async delete(id, title) {
    if (!await Utils.confirmar(`¿Eliminar la unidad "${title}"?`)) return;

    // Eliminar todos los PDFs de Storage
    const { data: unit } = await sb.from('units').select('pdf_url, pdf_urls').eq('id', id).single();
    const pdfs  = this._pdfListFromItem(unit);
    const paths = pdfs.map(p => this._pathDesdeUrl(p.url)).filter(Boolean);
    if (paths.length) await sb.storage.from('materiales').remove(paths);

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
