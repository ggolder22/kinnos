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
    this._tieneCurso = !!(alumno?.anio && alumno?.division);

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
            <option value="">Año…</option>
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

    if (!combo) {
      divSel.style.display = 'none';
      divSel.innerHTML = '';
    } else if (!combo.divisiones.length) {
      divSel.style.display = 'none';
      divSel.innerHTML = '';
    } else {
      divSel.style.display = '';
      // Sin división preseleccionada: si venía marcada la "A", un alumno de B que
      // tocaba "Ver mi horario" sin mirar quedaba guardado como A por error.
      divSel.innerHTML = '<option value="">División…</option>' +
        combo.divisiones.map(d => `<option value="${d}">${d}</option>`).join('');
    }
  },

  async _guardarCurso() {
    const anio = parseInt(document.getElementById('alumno-anio-select').value);
    const divSel = document.getElementById('alumno-division-select');
    const division = divSel.style.display === 'none' ? null : divSel.value;
    if (!anio) { Utils.toast('Elegí tu año', 'error'); return; }
    if (divSel.style.display !== 'none' && !division) { Utils.toast('Elegí tu división', 'error'); return; }

    // El curso se guarda solo la primera vez. Después lo cambia únicamente
    // preceptoría o el administrador (define en qué materias puede anotarse);
    // acá el alumno solo puede mirar el horario de otro curso.
    if (!this._tieneCurso) {
      const session = Auth.session();
      const { error } = await sb.from('students').update({ anio, division }).eq('id', session.id);
      if (error) { Utils.toast('Error al guardar: ' + error.message, 'error'); return; }
      this._tieneCurso = !!(anio && division);
    }
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
          <button class="btn btn-ghost btn-sm" onclick="AlumnoHorarios._cambiarCurso()">Ver el horario de otro curso</button>
          ${this._tieneCurso ? `<div style="font-size:.73rem;color:var(--text-3);margin-top:6px">Si tu curso está mal, pedí en Preceptoría que lo corrijan.</div>` : ''}
        </div>
      </div>`;
  },

  // Solo muestra el selector: el curso guardado no se borra hasta que el
  // alumno elija otro y toque "Ver mi horario".
  async _cambiarCurso() {
    this._mostrarSelector();
  },
};
