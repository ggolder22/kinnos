// ═══════════════════════════════════════════════════
//  Ideas — tablero compartido (admin + profesores + preceptores)
//  Notas con ideas para desarrollar en la app: quién y cuándo la
//  escribió, adjuntos (archivos y capturas pegadas con Ctrl+V) y un
//  tilde de "hecha". No se carga en el panel del alumno.
//  Tabla: dev_notes (sql/ideas-module.sql) · Archivos: materiales/ideas/<nota>/
// ═══════════════════════════════════════════════════
const Ideas = {
  MAX_MB: 20,
  ROL_LABEL: { admin: 'Admin', profesor: 'Profesor', preceptor: 'Preceptor' },

  _el: null,
  _notas: [],
  _filtro: 'pendientes', // 'pendientes' | 'hechas' | 'todas'
  _pendientesAdjuntar: [], // File[] elegidos para la nota nueva (todavía sin subir)

  async init(containerId = 'ideas-content') {
    this._el = document.getElementById(containerId);
    this._el.innerHTML = '<div class="loading">Cargando…</div>';
    this._pendientesAdjuntar = [];

    const { data, error } = await sb.from('dev_notes').select('*').order('created_at', { ascending: false });
    if (error) {
      this._el.innerHTML = `<div class="empty-state"><div class="icon">💡</div><p>No se pudieron cargar las ideas: ${this._esc(error.message)}</p></div>`;
      return;
    }
    this._notas = data || [];
    this._render();
  },

  // Quién está escribiendo — el admin no tiene id ni nombre en la sesión
  _autor() {
    const s = Auth.session();
    return {
      role: s.rol,
      id: s.rol === 'admin' ? null : s.id,
      name: s.rol === 'admin' ? 'Germán Golder' : (s.nombre || `DNI ${s.dni}`),
    };
  },

  _esc(t) {
    return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  _fechaHora(iso) {
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  _tamano(bytes) {
    if (!bytes) return '';
    return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  },

  // ── Render ───────────────────────────────────────────

  _render() {
    // Lo que se estaba escribiendo no se pierde al tildar/borrar/filtrar
    const borrador = document.getElementById('ideas-texto')?.value || '';
    const pendientes = this._notas.filter(n => !n.is_done).length;
    const hechas = this._notas.length - pendientes;
    const visibles = this._notas.filter(n =>
      this._filtro === 'todas' || (this._filtro === 'hechas' ? n.is_done : !n.is_done));

    const chip = (val, label) => `
      <button class="btn btn-sm ${this._filtro === val ? 'btn-primary' : 'btn-ghost'}" onclick="Ideas.filtrar('${val}')">${label}</button>`;

    this._el.innerHTML = `
      <div class="page-header">
        <h3>💡 Ideas para la app</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${chip('pendientes', `Pendientes (${pendientes})`)}
          ${chip('hechas', `Hechas (${hechas})`)}
          ${chip('todas', `Todas (${this._notas.length})`)}
        </div>
      </div>
      <p style="font-size:.8rem;color:var(--text-3);margin:-10px 0 16px">
        Lo ven el administrador, los profesores y los preceptores. Los alumnos no.
      </p>
      ${this._formHtml()}
      <div id="ideas-lista">
        ${visibles.length
          ? visibles.map(n => this._notaHtml(n)).join('')
          : `<div class="empty-state"><div class="icon">💡</div><p>${this._filtro === 'hechas' ? 'Todavía no hay ideas tildadas como hechas.' : 'No hay ideas pendientes.'}</p></div>`}
      </div>`;

    document.getElementById('ideas-texto').value = borrador;
    this._bindForm();
  },

  _formHtml() {
    return `
      <div class="card" style="margin-bottom:20px;padding:18px" id="ideas-form">
        <textarea id="ideas-texto" rows="3" placeholder="Escribí una idea… (podés pegar capturas de pantalla con Ctrl+V)"
          style="width:100%;resize:vertical;min-height:72px"></textarea>
        <div id="ideas-adjuntos-nuevos" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:10px;flex-wrap:wrap">
          <label class="btn btn-ghost btn-sm" style="cursor:pointer;margin:0">
            📎 Adjuntar archivos
            <input type="file" id="ideas-file" multiple style="display:none">
          </label>
          <span style="font-size:.74rem;color:var(--text-3);flex:1">También podés arrastrar archivos acá. Máx. ${this.MAX_MB} MB cada uno.</span>
          <button class="btn btn-primary btn-sm" id="ideas-guardar" onclick="Ideas.guardar()">Publicar idea</button>
        </div>
      </div>`;
  },

  _notaHtml(n) {
    const autor = this._autor();
    const puedeBorrar = autor.role === 'admin' || (n.author_role === autor.role && n.author_id && n.author_id === autor.id);
    const adj = Array.isArray(n.attachments) ? n.attachments : [];
    const imagenes = adj.filter(a => (a.type || '').startsWith('image/'));
    const otros = adj.filter(a => !(a.type || '').startsWith('image/'));

    return `
      <div class="card" style="margin-bottom:12px;padding:16px;${n.is_done ? 'opacity:.75;' : ''}border-left:3px solid ${n.is_done ? 'var(--success)' : 'var(--accent)'}">
        <div style="display:flex;gap:12px;align-items:flex-start">
          <label title="${n.is_done ? 'Marcar como pendiente' : 'Marcar como hecha'}" style="margin:2px 0 0;cursor:pointer">
            <input type="checkbox" ${n.is_done ? 'checked' : ''} onchange="Ideas.tildar('${n.id}', this.checked)" style="width:18px;height:18px;cursor:pointer">
          </label>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:.78rem;color:var(--text-3)">
              <strong style="color:var(--text-1);font-size:.85rem">${this._esc(n.author_name)}</strong>
              <span class="badge badge-indigo" style="font-size:.65rem">${this.ROL_LABEL[n.author_role] || n.author_role}</span>
              <span>${this._fechaHora(n.created_at)}</span>
              ${puedeBorrar ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:.72rem;padding:2px 8px" onclick="Ideas.borrar('${n.id}')">Borrar</button>` : ''}
            </div>
            <div style="margin-top:8px;color:var(--text-1);font-size:.9rem;white-space:pre-wrap;word-break:break-word;${n.is_done ? 'text-decoration:line-through;text-decoration-color:var(--text-3);' : ''}">${this._esc(n.body)}</div>
            ${imagenes.length ? `
              <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
                ${imagenes.map(a => `
                  <a href="${this._esc(a.url)}" target="_blank" rel="noopener" title="${this._esc(a.name)}">
                    <img src="${this._esc(a.url)}" alt="${this._esc(a.name)}" loading="lazy"
                      style="width:120px;height:90px;object-fit:cover;border-radius:6px;border:1px solid var(--border)">
                  </a>`).join('')}
              </div>` : ''}
            ${otros.length ? `
              <div style="display:flex;flex-direction:column;gap:4px;margin-top:10px">
                ${otros.map(a => `
                  <a href="${this._esc(a.url)}" target="_blank" rel="noopener" style="color:var(--accent);font-size:.82rem">
                    📄 ${this._esc(a.name)} <span style="color:var(--text-3)">${this._tamano(a.size)}</span>
                  </a>`).join('')}
              </div>` : ''}
            ${n.is_done ? `
              <div style="margin-top:10px;font-size:.75rem;color:var(--success)">
                ✓ Hecha${n.done_by_name ? ' — la tildó ' + this._esc(n.done_by_name) : ''}${n.done_at ? ' el ' + this._fechaHora(n.done_at) : ''}
              </div>` : ''}
          </div>
        </div>
      </div>`;
  },

  // ── Formulario: archivos, pegar capturas, arrastrar ──

  _bindForm() {
    const form = document.getElementById('ideas-form');
    const texto = document.getElementById('ideas-texto');

    document.getElementById('ideas-file').addEventListener('change', e => {
      this._agregarArchivos([...e.target.files]);
      e.target.value = '';
    });

    // Ctrl+V con una captura de pantalla en el portapapeles
    texto.addEventListener('paste', e => {
      const imgs = [...(e.clipboardData?.items || [])]
        .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
        .map(i => i.getAsFile()).filter(Boolean);
      if (!imgs.length) return;
      e.preventDefault();
      const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      this._agregarArchivos(imgs.map((f, i) =>
        new File([f], `captura-${ts}${imgs.length > 1 ? '-' + (i + 1) : ''}.${(f.type.split('/')[1] || 'png')}`, { type: f.type })));
    });

    form.addEventListener('dragover', e => { e.preventDefault(); form.style.borderColor = 'var(--accent)'; });
    form.addEventListener('dragleave', () => { form.style.borderColor = ''; });
    form.addEventListener('drop', e => {
      e.preventDefault();
      form.style.borderColor = '';
      this._agregarArchivos([...(e.dataTransfer?.files || [])]);
    });

    this._renderAdjuntosNuevos();
  },

  _agregarArchivos(files) {
    for (const f of files) {
      if (f.size > this.MAX_MB * 1048576) {
        Utils.toast(`"${f.name}" pesa más de ${this.MAX_MB} MB`, 'error');
        continue;
      }
      this._pendientesAdjuntar.push(f);
    }
    this._renderAdjuntosNuevos();
  },

  quitarAdjunto(i) {
    const f = this._pendientesAdjuntar[i];
    if (f?._preview) URL.revokeObjectURL(f._preview);
    this._pendientesAdjuntar.splice(i, 1);
    this._renderAdjuntosNuevos();
  },

  _renderAdjuntosNuevos() {
    const el = document.getElementById('ideas-adjuntos-nuevos');
    if (!el) return;
    el.innerHTML = this._pendientesAdjuntar.map((f, i) => {
      const esImg = f.type.startsWith('image/');
      if (esImg && !f._preview) f._preview = URL.createObjectURL(f);
      return `
        <div style="position:relative;display:flex;align-items:center;gap:6px;padding:4px 8px 4px 4px;background:var(--bg-base);border:1px solid var(--border);border-radius:6px;font-size:.75rem;max-width:220px">
          ${esImg
            ? `<img src="${f._preview}" alt="" style="width:40px;height:30px;object-fit:cover;border-radius:4px">`
            : '<span style="font-size:1.1rem;padding:0 4px">📄</span>'}
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-2)">${this._esc(f.name)}</span>
          <button onclick="Ideas.quitarAdjunto(${i})" title="Quitar"
            style="background:none;border:none;color:var(--text-3);cursor:pointer;font-size:.9rem;padding:0 2px">✕</button>
        </div>`;
    }).join('');
  },

  // ── Acciones ─────────────────────────────────────────

  async guardar() {
    const btn = document.getElementById('ideas-guardar');
    const body = document.getElementById('ideas-texto').value.trim();
    if (!body && !this._pendientesAdjuntar.length) { Utils.toast('Escribí la idea o adjuntá algo', 'error'); return; }

    Utils.btnLoading(btn, true);
    const autor = this._autor();
    const id = crypto.randomUUID();

    // Primero los archivos: si alguno falla, no se publica la nota a medias
    const attachments = [];
    for (const f of this._pendientesAdjuntar) {
      const limpio = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_');
      const path = `ideas/${id}/${Date.now()}-${limpio}`;
      const { data: up, error } = await sb.storage.from('materiales').upload(path, f, { contentType: f.type || 'application/octet-stream' });
      if (error) {
        Utils.btnLoading(btn, false);
        if (attachments.length) await sb.storage.from('materiales').remove(attachments.map(a => a.path));
        Utils.toast(`No se pudo subir "${f.name}": ${error.message}`, 'error');
        return;
      }
      const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(up.path);
      attachments.push({ url: publicUrl, path: up.path, name: f.name, type: f.type || '', size: f.size });
    }

    const { error } = await sb.from('dev_notes').insert({
      id,
      body: body || '(sin texto)',
      author_role: autor.role,
      author_id: autor.id,
      author_name: autor.name,
      attachments,
    });
    Utils.btnLoading(btn, false);

    if (error) {
      if (attachments.length) await sb.storage.from('materiales').remove(attachments.map(a => a.path));
      Utils.toast('Error al publicar: ' + error.message, 'error');
      return;
    }

    this._pendientesAdjuntar.forEach(f => f._preview && URL.revokeObjectURL(f._preview));
    document.getElementById('ideas-texto').value = '';
    Utils.toast('Idea publicada');
    if (this._filtro === 'hechas') this._filtro = 'pendientes';
    this.init(this._el.id);
  },

  async tildar(id, hecha) {
    const autor = this._autor();
    const payload = hecha
      ? { is_done: true, done_at: new Date().toISOString(), done_by_name: autor.name }
      : { is_done: false, done_at: null, done_by_name: null };
    const { error } = await sb.from('dev_notes').update(payload).eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); this._render(); return; }
    const n = this._notas.find(x => x.id === id);
    if (n) Object.assign(n, payload);
    Utils.toast(hecha ? '✓ Marcada como hecha' : 'Marcada como pendiente');
    this._render();
  },

  async borrar(id) {
    const n = this._notas.find(x => x.id === id);
    if (!n) return;
    if (!await Utils.confirmar('¿Borrar esta idea y sus archivos adjuntos?')) return;
    const { error } = await sb.from('dev_notes').delete().eq('id', id);
    if (error) { Utils.toast('Error al borrar: ' + error.message, 'error'); return; }
    const paths = (n.attachments || []).map(a => a.path).filter(Boolean);
    if (paths.length) await sb.storage.from('materiales').remove(paths);
    this._notas = this._notas.filter(x => x.id !== id);
    Utils.toast('Idea borrada');
    this._render();
  },

  filtrar(f) {
    this._filtro = f;
    this._render();
  },
};
