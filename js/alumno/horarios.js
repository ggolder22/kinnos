const AlumnoHorarios = {
  _cursoActual: null,

  abrir() {
    document.getElementById('tabs-bar').classList.add('hidden');
    document.getElementById('topbar-materia').textContent = 'Horarios';
    document.getElementById('topbar-sub').textContent = '';
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-horarios').classList.add('active');
    this.init();
  },

  async init() {
    const el = document.getElementById('horarios-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';
    const session = Auth.session();

    const { data: alumno } = await sb.from('students').select('curso').eq('id', session.id).single();
    this._cursoActual = alumno?.curso || null;

    if (this._cursoActual) {
      await this._mostrarHorario(this._cursoActual);
    } else {
      await this._mostrarSelector();
    }
  },

  async _mostrarSelector() {
    const el = document.getElementById('horarios-content');
    const cursos = await Horarios.listarCursos(sb);

    if (!cursos.length) {
      el.innerHTML = `<div class="empty-state"><div class="icon">🕒</div><p>Todavía no hay horarios cargados para ningún curso.</p></div>`;
      return;
    }

    el.innerHTML = `
      <div class="horario-wrap">
        <div class="horario-header">
          <h2>¿Cuál es tu curso?</h2>
          <p>Elegilo una vez y la próxima vez te va a mostrar tu horario directamente.</p>
        </div>
        <div class="horario-selector">
          <select id="alumno-curso-select">
            ${cursos.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" onclick="AlumnoHorarios._guardarCurso()">Ver mi horario</button>
        </div>
      </div>`;
  },

  async _guardarCurso() {
    const curso = document.getElementById('alumno-curso-select').value;
    const session = Auth.session();
    const { error } = await sb.from('students').update({ curso }).eq('id', session.id);
    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    this._cursoActual = curso;
    await this._mostrarHorario(curso);
  },

  async _mostrarHorario(curso) {
    const el = document.getElementById('horarios-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { rows, periodo } = await Horarios.cargar(sb, curso);

    el.innerHTML = `
      <div class="horario-wrap">
        <div class="horario-header">
          <h2>${curso}</h2>
          <p>${periodo || ''}</p>
        </div>
        ${Horarios.renderTabla(rows)}
        <div style="text-align:center;margin-top:14px">
          <button class="btn btn-ghost btn-sm" onclick="AlumnoHorarios._cambiarCurso()">¿No es tu curso? Cambiar</button>
        </div>
      </div>`;
  },

  async _cambiarCurso() {
    const session = Auth.session();
    await sb.from('students').update({ curso: null }).eq('id', session.id);
    this._cursoActual = null;
    this._mostrarSelector();
  },
};
