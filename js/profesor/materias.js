// Estado global compartido entre todos los módulos del profesor
const ProfesorState = {
  materia: null,   // objeto subject completo
  seccion: null,   // tab activo
};

const ProfesorMaterias = {
  async init() {
    const session = Auth.session();
    document.getElementById('prof-greeting').textContent = session.nombre || `DNI ${session.dni}`;

    const { data, error } = await sb
      .from('professor_subjects')
      .select('is_primary, subjects(id, name, year, join_code, careers(name, institutions(name)))')
      .eq('professor_id', session.id)
      .order('is_primary', { ascending: false });

    if (error) { Utils.toast('Error al cargar materias', 'error'); return; }

    const materias = (data || []).map(r => r.subjects).filter(Boolean);

    if (!materias.length) {
      document.getElementById('sidebar-materias').innerHTML =
        '<div style="padding:12px 20px;font-size:.8rem;color:var(--text-3)">Sin materias asignadas.</div>';
      return;
    }

    const html = materias.map(m => `
      <div class="nav-item" id="nav-mat-${m.id}" onclick="ProfesorMaterias.seleccionar('${m.id}')">
        <span class="icon">📚</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.name}</span>
        <span class="join-code">${m.join_code}</span>
      </div>`).join('');

    document.getElementById('sidebar-materias').innerHTML = html;

    // Si solo tiene una materia, la seleccionamos automáticamente
    if (materias.length === 1) this.seleccionar(materias[0].id);
  },

  async seleccionar(subjectId) {
    // Cargar materia completa
    const { data: m } = await sb
      .from('subjects')
      .select('id, name, year, join_code, career_id, careers(name, institutions(name))')
      .eq('id', subjectId)
      .single();

    if (!m) return;
    ProfesorState.materia = m;

    // Actualizar sidebar
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navEl = document.getElementById(`nav-mat-${subjectId}`);
    if (navEl) navEl.classList.add('active');

    // Actualizar topbar
    document.getElementById('topbar-materia').textContent = m.name;
    const sub = [m.careers?.institutions?.name, m.careers?.name, m.year ? `Año ${m.year}` : null]
      .filter(Boolean).join(' › ');
    document.getElementById('topbar-sub').textContent = sub;

    // Mostrar tabs
    document.getElementById('tabs-bar').classList.remove('hidden');

    // Ir a unidades por defecto (o mantener la sección actual)
    showTab(ProfesorState.seccion || 'unidades');
  },
};
