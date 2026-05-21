const AlumnoState = {
  materia: null,
  seccion: null,
};

const AlumnoMaterias = {
  async init() {
    const session = Auth.session();
    document.getElementById('alumno-greeting').textContent = session.nombre || `DNI ${session.dni}`;
    await this._loadMaterias();
  },

  async _loadMaterias() {
    const session = Auth.session();
    const { data, error } = await sb
      .from('student_subjects')
      .select('subjects(id, name, year, join_code, careers(name, institutions(name)))')
      .eq('student_id', session.id);

    if (error) { Utils.toast('Error al cargar materias', 'error'); return; }

    const materias = (data || []).map(r => r.subjects).filter(Boolean);
    this._renderSidebar(materias);

    if (materias.length === 1) this.seleccionar(materias[0].id);
  },

  _renderSidebar(materias) {
    const el = document.getElementById('sidebar-materias');
    if (!materias.length) {
      el.innerHTML = '<div style="padding:12px 20px;font-size:.8rem;color:var(--text-3)">No estás inscripto en ninguna materia.</div>';
      return;
    }
    el.innerHTML = materias.map(m => `
      <div class="nav-item" id="nav-mat-${m.id}" onclick="AlumnoMaterias.seleccionar('${m.id}')">
        <span class="icon">📚</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name}</span>
      </div>`).join('');
  },

  async seleccionar(subjectId) {
    const { data: m } = await sb
      .from('subjects')
      .select('id, name, year, join_code, careers(name, institutions(name))')
      .eq('id', subjectId)
      .single();
    if (!m) return;
    AlumnoState.materia = m;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`nav-mat-${subjectId}`)?.classList.add('active');

    document.getElementById('topbar-materia').textContent = m.name;
    const sub = [m.careers?.institutions?.name, m.careers?.name, m.year ? `Año ${m.year}` : null]
      .filter(Boolean).join(' › ');
    document.getElementById('topbar-sub').textContent = sub;

    document.getElementById('tabs-bar').classList.remove('hidden');
    showTab(AlumnoState.seccion || 'unidades');
  },

  async unirse() {
    const input = document.getElementById('join-code-input');
    const codigo = input.value.trim().toUpperCase();
    if (!codigo) { Utils.toast('Ingresá el código de la materia', 'error'); return; }

    const { data: materia } = await sb
      .from('subjects').select('id, name').eq('join_code', codigo).maybeSingle();

    if (!materia) { Utils.toast('Código incorrecto. Verificá con tu profesor.', 'error'); return; }

    const session = Auth.session();
    const { data: yaInscripto } = await sb
      .from('student_subjects')
      .select('student_id')
      .eq('student_id', session.id)
      .eq('subject_id', materia.id)
      .maybeSingle();

    if (yaInscripto) { Utils.toast(`Ya estás inscripto en ${materia.name}`, 'info'); return; }

    const { error } = await sb.from('student_subjects')
      .insert({ student_id: session.id, subject_id: materia.id });
    if (error) { Utils.toast('Error al inscribirse: ' + error.message, 'error'); return; }

    Utils.toast(`¡Inscripto en ${materia.name}!`);
    input.value = '';
    await this._loadMaterias();
    this.seleccionar(materia.id);
  },
};
