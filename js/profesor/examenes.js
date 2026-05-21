const ProfesorExamenes = {
  async init() {
    const el = document.getElementById('examenes-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { data, error } = await sb
      .from('exams')
      .select('*, exam_questions(count)')
      .eq('subject_id', ProfesorState.materia.id)
      .order('created_at', { ascending: false });

    if (error) { Utils.toast('Error al cargar exámenes', 'error'); return; }
    this._render(data);
  },

  _render(data) {
    const el = document.getElementById('examenes-content');
    const addBtn = `<button class="btn btn-primary btn-sm" onclick="ProfesorExamenes.openModal()">+ Nuevo examen</button>`;

    if (!data.length) {
      el.innerHTML = `<div class="page-header"><h3>Exámenes</h3>${addBtn}</div>
        <div class="empty-state"><div class="icon">📝</div><p>No hay exámenes creados.</p></div>`;
      return;
    }

    const rows = data.map(e => {
      const cantPreg = e.exam_questions?.[0]?.count ?? 0;
      const estadoBadge = e.is_practice
        ? '<span class="badge badge-practice">Práctica</span>'
        : e.is_active
          ? '<span class="badge badge-active">Activo</span>'
          : '<span class="badge badge-inactive">Inactivo</span>';

      return `
        <tr>
          <td class="text-main">${e.title}</td>
          <td>${estadoBadge}</td>
          <td style="text-align:center">${cantPreg}</td>
          <td>${e.time_limit ? `${e.time_limit} min` : '—'}</td>
          <td>
            <div class="td-actions">
              <button class="btn btn-ghost btn-sm" onclick="ProfesorExamenes.verPreguntas('${e.id}','${e.title.replace(/'/g, "\\'")}')">Preguntas</button>
              ${!e.is_practice
                ? `<button class="btn btn-ghost btn-sm" onclick="ProfesorExamenes.toggleActivo('${e.id}',${e.is_active})">
                    ${e.is_active ? 'Desactivar' : 'Activar'}
                   </button>`
                : ''}
              <button class="btn btn-ghost btn-sm" onclick="ProfesorExamenes.openModal(${JSON.stringify(e).replace(/"/g,'&quot;')})">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="ProfesorExamenes.delete('${e.id}','${e.title.replace(/'/g,"\\'")}')">Eliminar</button>
            </div>
          </td>
        </tr>`;
    }).join('');

    el.innerHTML = `
      <div class="page-header"><h3>Exámenes</h3>${addBtn}</div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Título</th><th>Estado</th><th style="text-align:center">Preguntas</th><th>Tiempo</th><th>Acciones</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  },

  openModal(item = null) {
    document.getElementById('exam-modal-title').textContent = item ? 'Editar examen' : 'Nuevo examen';
    document.getElementById('exam-modal-id').value           = item?.id           || '';
    document.getElementById('exam-modal-nombre').value       = item?.title        || '';
    document.getElementById('exam-modal-tiempo').value       = item?.time_limit   || '';
    document.getElementById('exam-modal-instruc').value      = item?.instructions || '';
    document.getElementById('exam-modal-practica').checked   = item?.is_practice  || false;
    this._toggleTiempo();
    document.getElementById('exam-modal').classList.remove('hidden');
    document.getElementById('exam-modal-nombre').focus();
  },

  closeModal() {
    document.getElementById('exam-modal').classList.add('hidden');
  },

  _toggleTiempo() {
    const esPractica = document.getElementById('exam-modal-practica').checked;
    document.getElementById('exam-tiempo-row').style.display = esPractica ? 'none' : '';
  },

  async save() {
    const btn        = document.getElementById('exam-modal-save');
    const id         = document.getElementById('exam-modal-id').value;
    const title      = document.getElementById('exam-modal-nombre').value.trim();
    const time_limit = parseInt(document.getElementById('exam-modal-tiempo').value) || null;
    const instruc    = document.getElementById('exam-modal-instruc').value.trim();
    const is_practice = document.getElementById('exam-modal-practica').checked;

    if (!title) { Utils.toast('El título es obligatorio', 'error'); return; }

    const payload = {
      title,
      time_limit: is_practice ? null : time_limit,
      instructions: instruc || null,
      is_practice,
      subject_id: ProfesorState.materia.id,
    };

    Utils.btnLoading(btn, true);
    const { error } = id
      ? await sb.from('exams').update(payload).eq('id', id)
      : await sb.from('exams').insert(payload);
    Utils.btnLoading(btn, false);

    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    Utils.toast(id ? 'Examen actualizado' : 'Examen creado');
    this.closeModal();
    this.init();
  },

  async toggleActivo(id, current) {
    const { error } = await sb.from('exams').update({ is_active: !current }).eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast(current ? 'Examen desactivado' : 'Examen activado');
    this.init();
  },

  async delete(id, title) {
    if (!await Utils.confirmar(`¿Eliminar el examen "${title}"? Se borrarán también sus preguntas.`)) return;
    const { error } = await sb.from('exams').delete().eq('id', id);
    if (error) { Utils.toast('Error: ' + error.message, 'error'); return; }
    Utils.toast('Examen eliminado');
    this.init();
  },

  verPreguntas(examId, examTitle) {
    // Se implementa en el próximo sprint (gestión de preguntas + IA)
    Utils.toast('Gestión de preguntas — próximamente', 'info');
  },
};
