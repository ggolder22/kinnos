const ProfesorBiblioteca = {
  _institutionId: null,
  _careers:       [],

  async _institucion() {
    if (this._institutionId) return this._institutionId;
    const session = Auth.session();
    const { data } = await sb.from('professors').select('institution_id').eq('id', session.id).single();
    this._institutionId = data?.institution_id || null;
    if (this._institutionId) {
      const { data: carreras } = await sb.from('careers').select('id, name').eq('institution_id', this._institutionId);
      this._careers = carreras || [];
    }
    return this._institutionId;
  },

  // ── Vista general (sidebar — toda la institución) ─────────

  async abrirGlobal() {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-biblioteca-global').classList.add('active');
    document.getElementById('tabs-bar').classList.add('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('nav-biblioteca').classList.add('active');

    document.getElementById('topbar-materia').textContent = 'Biblioteca';
    document.getElementById('topbar-sub').textContent = '';
    await this._loadGlobal();
  },

  async _loadGlobal() {
    const el = document.getElementById('biblioteca-global-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const instId = await this._institucion();
    if (!instId) {
      el.innerHTML = '<div class="empty-state"><p>No se pudo determinar tu institución.</p></div>';
      return;
    }

    const { data: recursos, error } = await sb
      .from('library_resources')
      .select('*, careers(name)')
      .eq('institution_id', instId)
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar la biblioteca', 'error'); return; }
    this._renderLista(el, recursos || [], { global: true });
  },

  // ── Vista por materia (pestaña dentro de la materia) ──────

  async init() {
    const el = document.getElementById('biblioteca-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data: links, error } = await sb
      .from('library_subject_links')
      .select('library_resources(*, careers(name))')
      .eq('subject_id', ProfesorState.materia.id);

    if (error) { Utils.toast('Error al cargar la biblioteca', 'error'); return; }
    const recursos = (links || []).map(l => l.library_resources).filter(Boolean);
    this._renderLista(el, recursos, { global: false });
  },

  // ── Render compartido ──────────────────────────────────────

  _renderLista(el, recursos, { global }) {
    const addBtns = global
      ? `<button class="btn btn-primary btn-sm" onclick="ProfesorBiblioteca.openModal()">+ Nuevo recurso</button>`
      : `<button class="btn btn-ghost btn-sm" onclick="ProfesorBiblioteca.abrirVincular()">🔗 Vincular existente</button>
         <button class="btn btn-primary btn-sm" onclick="ProfesorBiblioteca.openModal(null, true)">+ Subir nuevo para esta materia</button>`;

    const header = `<div class="page-header"><h3>Biblioteca${global ? '' : ' de la materia'}</h3><div style="display:flex;gap:8px">${addBtns}</div></div>`;

    if (!recursos.length) {
      el.innerHTML = `${header}<div class="empty-state"><div class="icon">📚</div><p>${global ? 'No hay recursos cargados todavía.' : 'No hay recursos vinculados a esta materia.'}</p></div>`;
      return;
    }

    const cards = recursos.map(r => {
      const alcance = r.career_id ? (r.careers?.name || 'Una carrera') : 'Toda la institución';
      const archivos = this._pdfListFromItem(r);
      const enlaces  = this._linksFromItem(r);
      const icon = archivos.length ? '📄' : (enlaces.some(l => l.type === 'video') ? '🎥' : '🔗');

      const archivosHtml = archivos.map(a =>
        `<a href="${a.url}" target="_blank" rel="noopener" style="color:var(--accent);font-size:.78rem">📄 ${a.name}</a>`).join('');
      const enlacesHtml = enlaces.map(l =>
        `<a href="${l.url}" target="_blank" rel="noopener" style="color:var(--accent);font-size:.78rem">${l.type === 'video' ? '🎥' : '🔗'} ${l.name || l.url}</a>`).join('');

      return `
        <div style="display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:1.4rem">${icon}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;color:var(--text-1)">${r.title}</div>
            ${r.description ? `<div style="font-size:.8rem;color:var(--text-2);margin-top:2px">${r.description}</div>` : ''}
            <div style="font-size:.72rem;color:var(--text-3);margin-top:4px">
              ${r.category ? `<span class="badge badge-indigo" style="font-size:.62rem">${r.category}</span> ` : ''}
              ${global ? alcance : ''}
            </div>
          </div>
          <div class="td-actions" style="flex-shrink:0;align-items:flex-end;flex-direction:column">
            <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;margin-bottom:6px">
              ${archivosHtml}${enlacesHtml}
            </div>
            <div style="display:flex;gap:6px">
              ${global
                ? `<button class="btn btn-ghost btn-sm" onclick="ProfesorBiblioteca.openModal(${JSON.stringify(r).replace(/"/g,'&quot;')})">Editar</button>
                   <button class="btn btn-danger btn-sm" onclick="ProfesorBiblioteca.delete('${r.id}','${r.title.replace(/'/g,"\\'")}')">Eliminar</button>`
                : `<button class="btn btn-danger btn-sm" onclick="ProfesorBiblioteca.desvincular('${r.id}','${r.title.replace(/'/g,"\\'")}')">Quitar de la materia</button>`}
            </div>
          </div>
        </div>`;
    }).join('');

    el.innerHTML = `${header}${cards}`;
  },

  // ── Modal crear / editar recurso ──────────────────────────

  async openModal(item = null, vincularAMateria = false) {
    await this._institucion();
    this._vincularAMateria = vincularAMateria;

    document.getElementById('bib-modal-title').textContent = item ? 'Editar recurso' : 'Nuevo recurso';
    document.getElementById('bib-modal-id').value       = item?.id          || '';
    document.getElementById('bib-modal-nombre').value   = item?.title       || '';
    document.getElementById('bib-modal-desc').value     = item?.description || '';
    document.getElementById('bib-modal-categoria').value = item?.category   || '';
    document.getElementById('bib-modal-pdf-file').value = '';
    document.getElementById('bib-link-nombre').value    = '';
    document.getElementById('bib-link-url').value       = '';

    const carreraSel = document.getElementById('bib-modal-carrera');
    carreraSel.innerHTML = `<option value="">Toda la institución</option>` +
      this._careers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    carreraSel.value = item?.career_id || (vincularAMateria ? (ProfesorState.materia.career_id || '') : '');

    this._modalFiles = this._pdfListFromItem(item);
    this._modalLinks = this._linksFromItem(item);
    this._renderPdfList();
    this._renderLinksList();

    document.getElementById('bib-modal').classList.remove('hidden');
    document.getElementById('bib-modal-nombre').focus();
  },

  closeModal() {
    document.getElementById('bib-modal').classList.add('hidden');
  },

  // Devuelve [{name, url}, ...] soportando también el viejo campo único file_url
  _pdfListFromItem(item) {
    if (Array.isArray(item?.file_urls) && item.file_urls.length) return item.file_urls;
    if (item?.file_url) return [{ name: this._nombreArchivo(item.file_url), url: item.file_url }];
    return [];
  },

  // Devuelve [{name, url, type}, ...] soportando los viejos campos únicos video_url/external_url
  _linksFromItem(item) {
    if (Array.isArray(item?.external_links) && item.external_links.length) return item.external_links;
    const legacy = [];
    if (item?.video_url)    legacy.push({ name: item.title, url: item.video_url, type: 'video' });
    if (item?.external_url) legacy.push({ name: item.title, url: item.external_url, type: 'link' });
    return legacy;
  },

  _renderPdfList() {
    const el = document.getElementById('bib-pdf-list');
    if (!this._modalFiles.length) { el.innerHTML = ''; return; }
    el.innerHTML = this._modalFiles.map((f, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-base);border:1px solid var(--border);border-radius:6px;font-size:.85rem">
        <a href="${f.url}" target="_blank" rel="noopener" style="color:var(--accent);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📄 ${f.name}</a>
        <button type="button" class="btn btn-danger btn-sm" onclick="ProfesorBiblioteca._quitarPdfModal(${i})">✕</button>
      </div>`).join('');
  },

  _quitarPdfModal(idx) {
    this._modalFiles.splice(idx, 1);
    this._renderPdfList();
  },

  _renderLinksList() {
    const el = document.getElementById('bib-links-list');
    if (!this._modalLinks.length) { el.innerHTML = ''; return; }
    el.innerHTML = this._modalLinks.map((l, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-base);border:1px solid var(--border);border-radius:6px;font-size:.85rem">
        <a href="${l.url}" target="_blank" rel="noopener" style="color:var(--accent);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${l.type === 'video' ? '🎥' : '🔗'} ${l.name || l.url}
        </a>
        <button type="button" class="btn btn-danger btn-sm" onclick="ProfesorBiblioteca._quitarLinkModal(${i})">✕</button>
      </div>`).join('');
  },

  _agregarLinkModal() {
    const nombreInput = document.getElementById('bib-link-nombre');
    const urlInput    = document.getElementById('bib-link-url');
    const nombre = nombreInput.value.trim();
    const url    = urlInput.value.trim();
    if (!url) { Utils.toast('Pegá una URL primero', 'error'); return; }

    const type = /youtube\.com|youtu\.be|vimeo\.com/i.test(url) ? 'video' : 'link';
    this._modalLinks.push({ name: nombre || url, url, type });
    nombreInput.value = '';
    urlInput.value    = '';
    this._renderLinksList();
  },

  _quitarLinkModal(idx) {
    this._modalLinks.splice(idx, 1);
    this._renderLinksList();
  },

  async save() {
    const btn      = document.getElementById('bib-modal-save');
    const id       = document.getElementById('bib-modal-id').value;
    const title    = document.getElementById('bib-modal-nombre').value.trim();
    const desc     = document.getElementById('bib-modal-desc').value.trim();
    const categoria = document.getElementById('bib-modal-categoria').value.trim();
    const careerId = document.getElementById('bib-modal-carrera').value || null;
    const files    = Array.from(document.getElementById('bib-modal-pdf-file').files || []);

    if (!title) { Utils.toast('El título es obligatorio', 'error'); return; }
    if (!files.length && !this._modalFiles.length && !this._modalLinks.length) {
      Utils.toast('Cargá al menos un documento o un link', 'error');
      return;
    }

    Utils.btnLoading(btn, true);

    const fileUrls = [...this._modalFiles];
    for (const file of files) {
      const ext  = file.name.split('.').pop();
      const path = `biblioteca/${this._institutionId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { data: uploadData, error: uploadError } = await sb.storage
        .from('materiales')
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) {
        Utils.btnLoading(btn, false);
        Utils.toast('Error al subir "' + file.name + '": ' + uploadError.message, 'error');
        return;
      }
      const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(uploadData.path);
      fileUrls.push({ name: file.name, url: publicUrl });
    }

    const session = Auth.session();
    const payload = {
      title, description: desc || null, category: categoria || null,
      institution_id: this._institutionId,
      career_id: careerId,
      file_urls: fileUrls,
      external_links: this._modalLinks,
      video_url: null, external_url: null, // los campos únicos quedan en desuso; todo vive en las listas
      ...(id ? {} : { created_by: session.id }),
    };

    const { data: saved, error } = id
      ? await sb.from('library_resources').update(payload).eq('id', id).select().single()
      : await sb.from('library_resources').insert(payload).select().single();

    if (error) {
      Utils.btnLoading(btn, false);
      Utils.toast('Error al guardar: ' + error.message, 'error');
      return;
    }

    // Si se creó desde la pestaña de la materia, se vincula automáticamente
    if (!id && this._vincularAMateria && ProfesorState.materia) {
      await sb.from('library_subject_links').insert({ resource_id: saved.id, subject_id: ProfesorState.materia.id });
    }

    Utils.btnLoading(btn, false);
    Utils.toast(id ? 'Recurso actualizado' : 'Recurso creado');
    this.closeModal();

    if (this._vincularAMateria) this.init(); else this._loadGlobal();
  },

  async delete(id, title) {
    if (!await Utils.confirmar(`¿Eliminar "${title}" de la biblioteca? Se quita de todas las materias donde esté vinculado.`)) return;

    const { data: recurso } = await sb.from('library_resources').select('file_url, file_urls').eq('id', id).single();
    const archivos = this._pdfListFromItem(recurso);
    const paths = archivos.map(a => this._pathDesdeUrl(a.url)).filter(Boolean);
    if (paths.length) await sb.storage.from('materiales').remove(paths);

    const { error } = await sb.from('library_resources').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Recurso eliminado');
    this._loadGlobal();
  },

  // ── Vincular recurso existente a la materia ───────────────

  async abrirVincular() {
    document.getElementById('bib-vincular-modal').classList.remove('hidden');
    const el = document.getElementById('bib-vincular-body');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const instId = await this._institucion();
    const { data: todos } = await sb.from('library_resources')
      .select('*').eq('institution_id', instId).order('title');
    const { data: yaVinculados } = await sb.from('library_subject_links')
      .select('resource_id').eq('subject_id', ProfesorState.materia.id);

    const vinculadosIds = new Set((yaVinculados || []).map(v => v.resource_id));
    const disponibles = (todos || []).filter(r => !vinculadosIds.has(r.id));

    if (!disponibles.length) {
      el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-3);font-size:.85rem">No hay más recursos institucionales para vincular.</div>';
      return;
    }

    el.innerHTML = disponibles.map(r => {
      const icon = this._pdfListFromItem(r).length ? '📄' : '🔗';
      return `
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:1.1rem">${icon}</div>
        <div style="flex:1;min-width:0;font-size:.85rem;color:var(--text-1)">${r.title}</div>
        <button class="btn btn-primary btn-sm" onclick="ProfesorBiblioteca._vincular('${r.id}')">Vincular</button>
      </div>`;
    }).join('');
  },

  cerrarVincular() {
    document.getElementById('bib-vincular-modal').classList.add('hidden');
  },

  async _vincular(resourceId) {
    const { error } = await sb.from('library_subject_links')
      .insert({ resource_id: resourceId, subject_id: ProfesorState.materia.id });
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Recurso vinculado');
    this.cerrarVincular();
    this.init();
  },

  async desvincular(resourceId, title) {
    if (!await Utils.confirmar(`¿Quitar "${title}" de esta materia? (sigue estando en la biblioteca general)`)) return;
    const { error } = await sb.from('library_subject_links')
      .delete().eq('resource_id', resourceId).eq('subject_id', ProfesorState.materia.id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Recurso desvinculado');
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
