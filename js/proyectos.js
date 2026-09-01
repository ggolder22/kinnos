// ═══════════════════════════════════════════════════
//  Proyectos — helpers de render compartidos (profesor + alumno)
// ═══════════════════════════════════════════════════
const Proyectos = {
  STATUS_LABEL: {
    in_progress:  '<span class="badge badge-practice">En curso</span>',
    approved:     '<span class="badge badge-active">✓ Aprobado</span>',
    not_approved: '<span class="badge" style="background:rgba(239,68,68,.15);color:#fca5a5">No aprobado</span>',
  },

  renderTimeline(updates) {
    if (!updates.length) {
      return '<div style="padding:20px;text-align:center;color:var(--text-3);font-size:.85rem">Todavía no hay publicaciones.</div>';
    }
    return updates.map(u => this.renderUpdateCard(u)).join('');
  },

  renderUpdateCard(u) {
    const esProfe = u.author_type === 'professor';
    const attachments = Array.isArray(u.attachments) ? u.attachments : [];
    const archivos = attachments.map(a => {
      if ((a.type || '').startsWith('image/')) {
        return `<a href="${a.url}" target="_blank" rel="noopener"><img src="${a.url}" alt="${a.name}" style="width:90px;height:90px;object-fit:cover;border-radius:6px;border:1px solid var(--border)"></a>`;
      }
      if ((a.type || '').startsWith('video/')) {
        return `<video src="${a.url}" controls style="width:160px;height:90px;border-radius:6px;border:1px solid var(--border)"></video>`;
      }
      return `<a href="${a.url}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">📄 ${a.name || 'Archivo'}</a>`;
    }).join('');

    return `
      <div style="padding:12px 14px;border-left:3px solid ${esProfe ? 'var(--accent)' : 'var(--border)'};background:var(--bg-base);border-radius:0 8px 8px 0;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-size:.82rem;font-weight:600;color:${esProfe ? 'var(--accent)' : 'var(--text-1)'}">
            ${esProfe ? '👨‍🏫 ' : ''}${u.author_name}
          </div>
          <div style="font-size:.7rem;color:var(--text-3)">${Utils.formatDate(u.created_at)}</div>
        </div>
        ${u.message ? `<div style="font-size:.85rem;color:var(--text-2);margin-bottom:8px;white-space:pre-wrap">${u.message}</div>` : ''}
        ${archivos ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${archivos}</div>` : ''}
      </div>`;
  },

  async subirAdjuntos(files, groupId) {
    const attachments = [];
    for (const file of files) {
      const path = `proyectos/${groupId}/${Date.now()}-${file.name}`;
      const { data: uploadData, error } = await sb.storage
        .from('materiales').upload(path, file, { contentType: file.type, upsert: true });
      if (error) return { error, attachments };
      const { data: { publicUrl } } = sb.storage.from('materiales').getPublicUrl(uploadData.path);
      attachments.push({ name: file.name, url: publicUrl, type: file.type });
    }
    return { error: null, attachments };
  },
};
