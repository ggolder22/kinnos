const AlumnoHorarios = {
  _combinaciones: [],

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

    const { data: alumno } = await sb.from('students').select('anio, division').eq('id', session.id).single();

    if (alumno?.anio) {
      await this._mostrarHorario(alumno.anio, alumno.division || null);
    } else {
      await this._mostrarSelector();
    }
  },

  async _mostrarSelector() {
    const el = document.getElementById('horarios-content');
    this._combinaciones = await Horarios.listarCombinaciones(sb);

    if (!this._combinaciones.length) {
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
          <select id="alumno-anio-select" onchange="AlumnoHorarios._onAnioChange()">
            ${this._combinaciones.map(c => `<option value="${c.anio}">${c.anio}°</option>`).join('')}
          </select>
          <select id="alumno-division-select"></select>
          <button class="btn btn-primary btn-sm" onclick="AlumnoHorarios._guardarCurso()">Ver mi horario</button>
        </div>
      </div>`;

    this._onAnioChange();
  },

  _onAnioChange() {
    const anio = parseInt(document.getElementById('alumno-anio-select').value);
    const combo = this._combinaciones.find(c => c.anio === anio);
    const divSel = document.getElementById('alumno-division-select');

    if (!combo.divisiones.length) {
      divSel.style.display = 'none';
      divSel.innerHTML = '';
    } else {
      divSel.style.display = '';
      divSel.innerHTML = combo.divisiones.map(d => `<option value="${d}">${d}</option>`).join('');
    }
  },

  async _guardarCurso() {
    const anio = parseInt(document.getElementById('alumno-anio-select').value);
    const divSel = document.getElementById('alumno-division-select');
    const division = divSel.style.display === 'none' ? null : divSel.value;

    const session = Auth.session();
    const { error } = await sb.from('students').update({ anio, division }).eq('id', session.id);
    if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
    await this._mostrarHorario(anio, division);
  },

  async _mostrarHorario(anio, division) {
    const el = document.getElementById('horarios-content');
    el.innerHTML = '<div class="loading">Cargando…</div>';

    const { rows, periodo, curso } = await Horarios.cargar(sb, anio, division);

    el.innerHTML = `
      <div class="horario-wrap">
        <div class="horario-header">
          <h2>${curso ? curso + ' · ' : ''}${Horarios.etiqueta(anio, division)}</h2>
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
    await sb.from('students').update({ anio: null, division: null }).eq('id', session.id);
    this._mostrarSelector();
  },
};
