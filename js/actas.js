// ═══════════════════════════════════════════════════
//  Actas oficiales — Kinnos
//
//  Formato ÚNICO para todo lo que se descarga como acta, copiado del
//  modelo modelo_actas/ACTAS DE PRÁCTICA PROFESIONALIZANTE.xlsx:
//    · Hoja "PP I"        → Acta de examen        (descargarActaExamen)
//    · Hoja "COND ACADEM" → Condición académica   (descargarCondicion)
//
//  Ambas salen en PDF (ventana de impresión) y en Excel (.xlsx real, con
//  bordes, celdas combinadas y logos, vía ExcelJS). Papel: Legal (oficio).
//  La cantidad de filas se ajusta a los alumnos; si no entran en una hoja,
//  se corta en hojas completas (encabezado + firmas en cada una).
//
//  Libro, Folio y Vocales quedan en blanco para completar a mano.
//  Requiere sql/condicion-academica-alumno.sql (condición de cada alumno).
// ═══════════════════════════════════════════════════

const Actas = {
  MINISTERIO: ['MINISTERIO DE EDUCACION', 'SECRETARIA DE EDUCACION', 'DIRECCIÓN DE EDUCACIÓN SUPERIOR '],
  NIVEL: 'Superior',
  ESCUDO_URL: '/img/actas/escudo.png',
  EXCELJS_URL: 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',

  FILAS_POR_HOJA: 30,     // acta de examen: alumnos por hoja Legal
  NOTA_APROBACION: 6,     // para el conteo de Aprobados / Desaprobados

  CONDICIONES: ['Regular', 'Promocional', 'Libre'],
  FILTROS: [
    { v: 'todos',       l: 'Todos los alumnos' },
    { v: 'Promocional', l: 'Promocionales' },
    { v: 'Regular',     l: 'Regulares' },
    { v: 'Libre',       l: 'Libres' },
  ],
  PLURAL: { Promocional: 'PROMOCIONALES', Regular: 'REGULARES', Libre: 'LIBRES' },

  _filtroElegido: 'todos',

  anioLectivo() { return new Date().getFullYear(); },

  // ── Selector previo a la descarga ─────────────────────────
  // onDescargar(formato, filtro, win) — formato 'pdf' | 'xlsx'. Para PDF
  // la ventana se abre YA en el click (si se abre después de esperar a la
  // base, el navegador la bloquea como popup) y se pasa como `win`.
  // extraHtml: campos adicionales (ej. el preceptor elige materia/instancia).
  elegir({ titulo = 'Descargar acta', descripcion = '', extraHtml = '', onDescargar }) {
    document.getElementById('actas-modal')?.remove();
    const div = document.createElement('div');
    div.id = 'actas-modal';
    div.className = 'modal-backdrop';
    div.innerHTML = `
      <div class="modal" style="max-width:420px">
        <h4>${titulo}</h4>
        ${descripcion ? `<p style="font-size:.82rem;color:var(--text-3);margin:-10px 0 16px">${descripcion}</p>` : ''}
        ${extraHtml}
        <div class="form-group">
          <label>Alumnos a incluir</label>
          <select id="actas-filtro">
            ${this.FILTROS.map(f => `<option value="${f.v}" ${f.v === this._filtroElegido ? 'selected' : ''}>${f.l}</option>`).join('')}
          </select>
        </div>
        <p style="font-size:.75rem;color:var(--text-3);margin:0">
          Se filtra por la condición académica que el profesor carga en Calificaciones. Papel: Legal (oficio).
        </p>
        <div class="modal-actions">
          <button class="btn btn-ghost" data-accion="cancelar">Cancelar</button>
          <button class="btn btn-ghost" data-accion="xlsx">📊 Excel</button>
          <button class="btn btn-primary" data-accion="pdf">📄 PDF</button>
        </div>
      </div>`;
    document.body.appendChild(div);

    div.addEventListener('click', async ev => {
      const accion = ev.target.closest('[data-accion]')?.dataset.accion;
      if (ev.target === div || accion === 'cancelar') { div.remove(); return; }
      if (accion !== 'pdf' && accion !== 'xlsx') return;

      const filtro = document.getElementById('actas-filtro').value;
      this._filtroElegido = filtro;
      const win = accion === 'pdf' ? window.open('', '_blank') : null;
      if (win) win.document.write('<p style="font-family:Arial;padding:30px">Generando acta…</p>');

      const btns = div.querySelectorAll('button');
      btns.forEach(b => { b.disabled = true; });
      try {
        const ok = await onDescargar(accion, filtro, win);
        if (ok === false) { win?.close(); return; }
        div.remove();
      } catch (e) {
        console.error(e);
        win?.close();
        Utils.toast('No se pudo generar el acta: ' + (e.message || e), 'error');
      } finally {
        btns.forEach(b => { b.disabled = false; });
      }
    });
  },

  // ── Datos ─────────────────────────────────────────────────

  async _contextoMateria(subjectId) {
    const [{ data: materia }, { data: profes }, { data: insc }, cond] = await Promise.all([
      sb.from('subjects').select('id, name, year, division, careers(name, institutions(*))').eq('id', subjectId).single(),
      sb.from('professor_subjects').select('is_primary, professors(full_name)').eq('subject_id', subjectId),
      sb.from('student_subjects').select('students(id, full_name, first_name, last_name, dni, division)').eq('subject_id', subjectId),
      sb.from('student_academic_conditions').select('student_id, condicion')
        .eq('subject_id', subjectId).eq('anio_academico', this.anioLectivo()),
    ]);
    if (!materia) throw new Error('No se encontró la materia');

    const principal = (profes || []).find(p => p.is_primary) || (profes || [])[0];
    const condiciones = {};
    (cond.data || []).forEach(c => { condiciones[c.student_id] = c.condicion; });

    const roster = (insc || []).map(r => r.students).filter(Boolean)
      .sort((a, b) => this.nombre(a).localeCompare(this.nombre(b), 'es'));

    return {
      materia,
      carrera: materia.careers?.name || '',
      institucion: materia.careers?.institutions || {},
      presidente: principal?.professors?.full_name || '',
      roster,
      condiciones,
      condicionesDisponibles: !cond.error,
    };
  },

  // instancia = { tipo: 'manual' | 'examen', id }
  // Devuelve { titulo, fecha, division, notas: { student_id: { num, letra, aprobado } } }
  async _notasInstancia(instancia) {
    const notas = {};
    if (instancia.tipo === 'manual') {
      const [{ data: item }, { data: filas }] = await Promise.all([
        sb.from('manual_grade_items').select('title, fecha, tipo').eq('id', instancia.id).single(),
        sb.from('manual_grades').select('student_id, score, concepto').eq('item_id', instancia.id),
      ]);
      (filas || []).forEach(n => {
        if (n.score !== null && n.score !== undefined) {
          const s = Number(n.score);
          notas[n.student_id] = { num: this._fmtNum(s), letra: Utils.numeroALetras(s), aprobado: s >= this.NOTA_APROBACION };
        } else if (n.concepto) {
          notas[n.student_id] = { num: '', letra: n.concepto, aprobado: n.concepto !== 'Insuficiente' };
        }
      });
      return { titulo: item?.title || '', fecha: item?.fecha || null, division: null, notas };
    }

    const [{ data: exam }, { data: res }] = await Promise.all([
      sb.from('exams').select('title, division').eq('id', instancia.id).single(),
      sb.from('exam_results').select('student_id, score, professor_score, status').eq('exam_id', instancia.id).eq('status', 'confirmed'),
    ]);
    (res || []).forEach(r => {
      const s = Utils.notaFinal(r).score;
      notas[r.student_id] = { num: this._fmtNum(s), letra: Utils.numeroALetras(s), aprobado: s >= this.NOTA_APROBACION };
    });
    return { titulo: exam?.title || '', fecha: null, division: exam?.division || null, notas };
  },

  _filtrar(ctx, filtro) {
    if (filtro !== 'todos' && !ctx.condicionesDisponibles) {
      throw new Error('Falta crear la tabla de condición académica en Supabase (sql/condicion-academica-alumno.sql)');
    }
    return filtro === 'todos' ? ctx.roster : ctx.roster.filter(a => ctx.condiciones[a.id] === filtro);
  },

  // ── Acta de examen ────────────────────────────────────────

  async descargarActaExamen({ subjectId, instancia, filtro = 'todos', formato = 'pdf', win = null, libro = '', folio = '' }) {
    const [ctx, inst] = await Promise.all([this._contextoMateria(subjectId), this._notasInstancia(instancia)]);

    let alumnos = this._filtrar(ctx, filtro);
    if (inst.division) alumnos = alumnos.filter(a => !a.division || a.division === inst.division);
    if (!alumnos.length) {
      Utils.toast(filtro === 'todos' ? 'No hay alumnos inscriptos en esta materia'
        : `No hay alumnos ${this.PLURAL[filtro].toLowerCase()} — cargá la condición en Calificaciones`, 'error');
      return false;
    }

    const filas = alumnos.map((a, i) => {
      const n = inst.notas[a.id];
      return { orden: i + 1, nombre: this.nombre(a), dni: a.dni || '', num: n ? n.num : '', letra: n ? n.letra : 'Ausente' };
    });
    const evaluados = alumnos.filter(a => inst.notas[a.id]).length;
    const aprobados = alumnos.filter(a => inst.notas[a.id]?.aprobado).length;

    const datos = {
      titulo: 'ACTA DE EXAMEN' + (filtro === 'todos' ? '' : ' - ALUMNOS ' + this.PLURAL[filtro]),
      institucion: ctx.institucion.name || '',
      institucionOficial: ctx.institucion.nombre_oficial || ctx.institucion.name || '',
      logoUrl: ctx.institucion.logo_url || '',
      modalidad: this._modalidad(ctx.carrera),
      curso: this._curso(ctx.materia, inst.division),
      libro, folio,
      presidente: ctx.presidente,
      fecha: inst.fecha ? Utils.formatDate(inst.fecha) : '',
      unidad: (ctx.materia.name || '').toUpperCase(),
      instancia: inst.titulo,
      filas,
      totales: {
        Inscriptos: filas.length, Evaluados: evaluados, Aprobados: aprobados,
        Ausentes: filas.length - evaluados, Desaprobados: evaluados - aprobados,
      },
    };

    const archivo = this._archivo(['Acta', ctx.materia.name, inst.titulo, filtro === 'todos' ? '' : this.PLURAL[filtro]]);
    if (formato === 'xlsx') await this._actaExcel(datos, archivo);
    else await this._actaPDF(datos, win, archivo);
    return true;
  },

  // ── Listado de condición académica ────────────────────────

  async descargarCondicion({ subjectId, filtro = 'todos', formato = 'pdf', win = null }) {
    const ctx = await this._contextoMateria(subjectId);
    if (!ctx.condicionesDisponibles) {
      throw new Error('Falta crear la tabla de condición académica en Supabase (sql/condicion-academica-alumno.sql)');
    }
    const alumnos = this._filtrar(ctx, filtro);
    if (!alumnos.length) {
      Utils.toast(filtro === 'todos' ? 'No hay alumnos inscriptos en esta materia' : `No hay alumnos ${this.PLURAL[filtro].toLowerCase()}`, 'error');
      return false;
    }

    const datos = {
      lineas: [
        ctx.institucion.nombre_oficial || ctx.institucion.name || '',
        this._cursoEnLetras(ctx.materia),
        `ALUMNOS ${filtro === 'todos' ? 'INSCRIPTOS' : this.PLURAL[filtro]} EN ${(ctx.materia.name || '').toUpperCase()} -${this.anioLectivo()}`,
      ].filter(Boolean),
      filas: alumnos.map((a, i) => ({
        orden: i + 1, nombre: this.nombre(a), dni: a.dni || '',
        condicion: ctx.condiciones[a.id] ? ctx.condiciones[a.id].toUpperCase() : '----------------',
      })),
    };

    const archivo = this._archivo(['Condicion_academica', ctx.materia.name, filtro === 'todos' ? '' : this.PLURAL[filtro]]);
    if (formato === 'xlsx') await this._condicionExcel(datos, archivo);
    else await this._condicionPDF(datos, win, archivo);
    return true;
  },

  // ── Helpers de formato ────────────────────────────────────

  // "Apellido Nombre" sin coma, como en el modelo
  nombre(a) {
    if (!a) return '';
    if (a.last_name && a.first_name) return `${a.last_name} ${a.first_name}`;
    return a.full_name || '';
  },

  _fmtNum(n) { return String(n).replace('.', ','); },

  // "Tecnicatura Superior en Electrotecnia" → "Tecnicatura Superior"
  _modalidad(carrera) {
    const m = (carrera || '').split(/\s+en\s+/i)[0].trim();
    return m || 'Tecnicatura Superior';
  },

  _curso(materia, division) {
    const d = division || materia.division;
    return materia.year ? `${materia.year}° ${d || ''}`.trim() : '';
  },

  _cursoEnLetras(materia) {
    const ORD = ['', 'PRIMER', 'SEGUNDO', 'TERCER', 'CUARTO', 'QUINTO', 'SEXTO'];
    if (!materia.year) return '';
    return `${ORD[materia.year] || materia.year + '°'} AÑO${materia.division ? ` "${materia.division}"` : ''}`;
  },

  _archivo(partes) {
    return partes.filter(Boolean).join('_')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
  },

  _esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _trozos(arr, n) {
    const out = [];
    for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out.length ? out : [[]];
  },

  // Imagen → { dataUrl, ext, w, h } (null si no se pudo cargar)
  async _imagen(url) {
    if (!url) return null;
    try {
      const resp = await fetch(new URL(url, location.origin).href);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      const dataUrl = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob);
      });
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
      const ext = /image\/jpe?g/.test(blob.type) ? 'jpeg' : (/image\/gif/.test(blob.type) ? 'gif' : 'png');
      return { dataUrl, ext, w: img.naturalWidth, h: img.naturalHeight };
    } catch (e) {
      console.warn('No se pudo cargar la imagen', url, e);
      return null;
    }
  },

  // Tamaño que entra en una caja manteniendo la proporción
  _encajar(img, maxW, maxH) {
    const k = Math.min(maxW / img.w, maxH / img.h);
    return { width: Math.round(img.w * k), height: Math.round(img.h * k) };
  },

  _cargarExcelJS() {
    if (window.ExcelJS) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = this.EXCELJS_URL;
      s.onload = resolve;
      s.onerror = () => reject(new Error('No se pudo cargar la librería de Excel (¿sin conexión?)'));
      document.head.appendChild(s);
    });
  },

  async _bajarExcel(wb, archivo) {
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = archivo + '.xlsx';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    Utils.toast('Excel descargado');
  },

  // Escribe el HTML en la ventana, espera a las imágenes y abre "Imprimir"
  async _imprimir(win, html) {
    if (!win || win.closed) win = window.open('', '_blank');
    if (!win) { Utils.toast('El navegador bloqueó la ventana del acta — permití ventanas emergentes', 'error'); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
    await Promise.all([...win.document.images].map(i => i.decode ? i.decode().catch(() => {}) : null));
    win.focus();
    win.print();
  },

  _CSS_PAPEL: `
    @page { size: legal portrait; margin: 12mm 14mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: Calibri, Carlito, 'Segoe UI', Arial, sans-serif; color: #000; font-size: 11pt;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    td, th { border: 1px solid #000; padding: 1pt 4pt; font-size: 11pt; line-height: 1.15; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .sb { border: none; }
    .c { text-align: center; }
    @media screen {
      body { background: #8a8a8a; padding: 20px 0; }
      .hoja, .listado { background: #fff; width: 8.5in; margin: 0 auto 20px; padding: 12mm 14mm; box-shadow: 0 2px 10px rgba(0,0,0,.4); }
      .hoja { height: 14in; }
    }`,

  // ── Acta de examen: PDF ───────────────────────────────────

  async _actaPDF(d, win, archivo) {
    const [escudo, logo] = await Promise.all([this._imagen(this.ESCUDO_URL), this._imagen(d.logoUrl)]);
    const hojas = this._trozos(d.filas, this.FILAS_POR_HOJA);
    const e = v => this._esc(v);
    const col = '<colgroup><col style="width:5.3%"><col style="width:40.2%"><col style="width:17.3%"><col style="width:16%"><col style="width:21.2%"></colgroup>';

    const hojaHtml = (filas, idx) => {
      const ultima = idx === hojas.length - 1;
      return `
      <div class="hoja">
        <div class="cab">
          <div class="cab-izq">
            ${escudo ? `<img src="${escudo.dataUrl}" class="escudo">` : '<div style="height:44pt"></div>'}
            <div class="ministerio">${this.MINISTERIO.map(e).join('<br>')}</div>
          </div>
          <div class="cab-der">
            ${logo ? `<img src="${logo.dataUrl}" class="logo">` : ''}
            <div class="inst">${e(d.institucionOficial.toUpperCase())}</div>
          </div>
        </div>

        <table class="datos">${col}
          <tr><td colspan="5" class="c b">${e(d.titulo)}</td></tr>
          <tr><td colspan="2" class="c b">Nivel:</td><td colspan="2" class="b">${e(this.NIVEL)}</td><td class="b">Libro N°: ${e(d.libro)}</td></tr>
          <tr><td colspan="2" class="c b">Institución Educativa:</td><td colspan="2" class="b">${e(d.institucion)}</td><td class="b">Folio N°: ${e(d.folio)}</td></tr>
          <tr><td colspan="2" class="c b">Modalidad:</td><td colspan="2" class="b">${e(d.modalidad)}</td><td class="b">Curso: ${e(d.curso)}</td></tr>
          <tr><td colspan="5" class="sb esp"></td></tr>
          <tr><td colspan="3" class="b">Presidente: ${e(d.presidente)}</td><td class="b" style="border-right:none">Fecha</td><td class="b">${e(d.fecha)}</td></tr>
          <tr><td colspan="3" class="b">Vocal:</td><td colspan="2" class="sb"></td></tr>
          <tr><td colspan="3" class="b">Vocal:</td><td colspan="2" class="sb"></td></tr>
          <tr><td colspan="5" class="sb esp"></td></tr>
          <tr><td colspan="5" class="b">Unidad Curricular: ${e(d.unidad)}</td></tr>
          <tr><td colspan="5" class="sb esp"></td></tr>
        </table>

        <table class="alumnos">${col}
          <tr><td>N°</td><td class="c">Apellido y Nombre</td><td class="c">D.N.I</td><td class="c">Calif. En Núm.</td><td class="c">Calif. En Letra</td></tr>
          ${filas.map(f => `<tr>
            <td>${f.orden}</td><td>${e(f.nombre)}</td><td>${e(f.dni)}</td>
            <td class="c">${e(f.num)}</td><td>${e(f.letra)}</td></tr>`).join('')}
        </table>

        <div class="pie">
          ${ultima
            ? `<div class="totales">${Object.entries(d.totales).map(([k, v]) => `<div><div>${k}</div><div class="num">${v}</div></div>`).join('')}</div>`
            : '<div class="continua">Continúa en la hoja siguiente</div>'}
          <div class="firmas">
            <div><div class="linea"></div>Vocal</div>
            <div><div class="linea"></div>Presidente</div>
            <div><div class="linea"></div>Vocal</div>
          </div>
          ${hojas.length > 1 ? `<div class="nro-hoja">Hoja ${idx + 1} de ${hojas.length}</div>` : ''}
        </div>
      </div>`;
    };

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${e(archivo)}</title>
      <style>${this._CSS_PAPEL}
        .hoja { display: flex; flex-direction: column; height: calc(355.6mm - 24mm - 1mm); overflow: hidden;
                page-break-after: always; break-after: page; }
        .hoja:last-child { page-break-after: auto; break-after: auto; }
        .cab { display: flex; justify-content: space-between; align-items: flex-start; height: 92pt; }
        .cab-izq { padding-left: 34pt; }
        .escudo { height: 44pt; display: block; margin-left: 8pt; }
        .ministerio { font-size: 8pt; font-weight: bold; line-height: 1.35; margin-top: 4pt; margin-left: -26pt; }
        .cab-der { width: 42%; text-align: center; }
        .logo { height: 46pt; display: block; margin: 0 auto 2pt; }
        .inst { font-size: 8pt; font-weight: bold; line-height: 1.25; }
        .b { font-weight: bold; }
        .datos td { height: 15pt; white-space: normal; }
        .datos td.esp { height: 13pt; }
        .alumnos td { height: 15.75pt; }
        .pie { margin-top: auto; padding-top: 10pt; }
        .totales { display: flex; justify-content: space-around; text-align: center; font-size: 11pt; }
        .totales .num { font-weight: bold; margin-top: 3pt; }
        .continua { text-align: center; font-size: 9pt; font-style: italic; color: #333; }
        .firmas { display: flex; justify-content: space-between; text-align: center; margin-top: 52pt; font-size: 11pt; }
        .firmas > div { width: 30%; }
        .firmas .linea { border-top: 1px dashed #000; margin: 0 10% 3pt; }
        .nro-hoja { text-align: right; font-size: 8pt; margin-top: 6pt; color: #333; }
      </style></head><body>${hojas.map(hojaHtml).join('')}</body></html>`;

    await this._imprimir(win, html);
  },

  // ── Acta de examen: Excel ─────────────────────────────────

  async _actaExcel(d, archivo) {
    await this._cargarExcelJS();
    const [escudo, logo] = await Promise.all([this._imagen(this.ESCUDO_URL), this._imagen(d.logoUrl)]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Acta', {
      pageSetup: {
        paperSize: 5, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true,
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
    });
    ws.columns = [{ width: 4.86 }, { width: 36.57 }, { width: 15.71 }, { width: 14.57 }, { width: 19.29 }];

    const imgEscudo = escudo ? wb.addImage({ base64: escudo.dataUrl.split(',')[1], extension: escudo.ext }) : null;
    const imgLogo   = logo   ? wb.addImage({ base64: logo.dataUrl.split(',')[1],   extension: logo.ext })   : null;

    const F  = (o = {}) => ({ name: 'Calibri', size: 11, ...o });
    const hojas = this._trozos(d.filas, this.FILAS_POR_HOJA);
    let r0 = 1; // primera fila de la hoja actual

    hojas.forEach((filas, idx) => {
      const ultima = idx === hojas.length - 1;
      const R = n => r0 + n - 1;                 // fila relativa (1 = primera de la hoja)
      const cell = (n, c) => ws.getCell(R(n), c);

      // Encabezado (filas 1-6): escudo + ministerio a la izquierda, logo + institución a la derecha
      if (imgEscudo !== null) ws.addImage(imgEscudo, { tl: { col: 1.25, row: R(1) - 1 + 0.15 }, ext: this._encajar(escudo, 40, 44) });
      if (imgLogo   !== null) ws.addImage(imgLogo,   { tl: { col: 4.35, row: R(1) - 1 + 0.05 }, ext: this._encajar(logo, 80, 44) });
      this.MINISTERIO.forEach((t, i) => {
        const c = cell(4 + i, 1);
        c.value = (i < 2 ? '      ' : '') + t;
        c.font = F({ size: 8, bold: true });
      });
      ws.mergeCells(R(4), 4, R(6), 5);
      Object.assign(cell(4, 4), {
        value: d.institucionOficial.toUpperCase(),
        font: F({ size: 8, bold: true }),
        alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      });

      // Título y datos de la mesa (filas 7-10)
      this._xMerge(ws, R(7), 1, R(7), 5, d.titulo, F({ bold: true }), { horizontal: 'center' });
      [['Nivel:', this.NIVEL, `Libro N°: ${d.libro}`],
       ['Institución Educativa:', d.institucion, `Folio N°: ${d.folio}`],
       ['Modalidad:', d.modalidad, `Curso: ${d.curso}`]].forEach(([a, b, c], i) => {
        const r = R(8 + i);
        this._xMerge(ws, r, 1, r, 2, a, F({ bold: true }), { horizontal: 'center' });
        this._xMerge(ws, r, 3, r, 4, b, F({ bold: true }), { horizontal: 'left', shrinkToFit: true });
        this._xMerge(ws, r, 5, r, 5, c, F({ bold: true }), {});
      });

      // Tribunal (filas 12-14)
      this._xMerge(ws, R(12), 1, R(12), 3, `Presidente: ${d.presidente}`, F({ bold: true }), { horizontal: 'left' });
      this._xMerge(ws, R(12), 4, R(12), 4, 'Fecha', F({ bold: true }), {});
      cell(12, 4).border = { left: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'thin' } };
      this._xMerge(ws, R(12), 5, R(12), 5, d.fecha, F({ bold: true }), {});
      this._xMerge(ws, R(13), 1, R(13), 3, 'Vocal:', F({ bold: true }), { horizontal: 'left' });
      this._xMerge(ws, R(14), 1, R(14), 3, 'Vocal:', F({ bold: true }), { horizontal: 'left' });

      // Unidad curricular (fila 16)
      ws.getRow(R(15)).height = 15.75;
      ws.getRow(R(16)).height = 15.75;
      this._xMerge(ws, R(16), 1, R(16), 5, `Unidad Curricular: ${d.unidad}`, F({ bold: true }), { horizontal: 'left' });

      // Tabla de alumnos (fila 18 = encabezado)
      ['N°', 'Apellido y Nombre', 'D.N.I', 'Calif. En Núm.', 'Calif. En Letra'].forEach((t, i) => {
        this._xMerge(ws, R(18), i + 1, R(18), i + 1, t, F(), i ? { horizontal: 'center' } : {});
      });
      filas.forEach((f, i) => {
        const r = R(19 + i);
        ws.getRow(r).height = 15.75;
        this._xMerge(ws, r, 1, r, 1, f.orden, F(), { horizontal: 'left' });
        this._xMerge(ws, r, 2, r, 2, f.nombre, F(), { shrinkToFit: true });
        this._xMerge(ws, r, 3, r, 3, f.dni, F(), {});
        this._xMerge(ws, r, 4, r, 4, f.num, F(), { horizontal: 'center' });
        this._xMerge(ws, r, 5, r, 5, f.letra, F(), { shrinkToFit: true });
      });

      // Pie: totales (solo última hoja) + firmas
      let rp = R(19 + filas.length) + 1;
      if (ultima) {
        const t = Object.entries(d.totales).map(([k, v]) => `${k}: ${v}`).join('        ');
        ws.mergeCells(rp, 1, rp, 5);
        Object.assign(ws.getCell(rp, 1), { value: t, font: F(), alignment: { horizontal: 'center' } });
      } else {
        ws.mergeCells(rp, 1, rp, 5);
        Object.assign(ws.getCell(rp, 1), { value: 'Continúa en la hoja siguiente', font: F({ size: 9, italic: true }), alignment: { horizontal: 'center' } });
      }
      rp += 4;
      const lin = '----------------------------------';
      ws.getCell(rp, 2).value = lin;
      ws.mergeCells(rp, 3, rp, 4); ws.getCell(rp, 3).value = lin;
      ws.getCell(rp, 5).value = lin;
      ws.getCell(rp + 1, 2).value = 'Vocal';
      ws.mergeCells(rp + 1, 3, rp + 1, 4); ws.getCell(rp + 1, 3).value = 'Presidente';
      ws.getCell(rp + 1, 5).value = 'Vocal';
      [rp, rp + 1].forEach(r => [2, 3, 5].forEach(c => {
        Object.assign(ws.getCell(r, c), { font: F(), alignment: { horizontal: 'center' } });
      }));
      let ultimaFila = rp + 1;
      if (hojas.length > 1) {
        ultimaFila = rp + 2;
        Object.assign(ws.getCell(ultimaFila, 5), { value: `Hoja ${idx + 1} de ${hojas.length}`, font: F({ size: 8 }), alignment: { horizontal: 'right' } });
      }

      if (!ultima) ws.getRow(ultimaFila).addPageBreak();
      r0 = ultimaFila + 1;
    });

    await this._bajarExcel(wb, archivo);
  },

  // Combina (si hace falta), escribe y pone borde exterior fino al rango
  _xMerge(ws, r1, c1, r2, c2, value, font, alignment) {
    if (r1 !== r2 || c1 !== c2) ws.mergeCells(r1, c1, r2, c2);
    const c = ws.getCell(r1, c1);
    c.value = value ?? '';
    c.font = font;
    c.alignment = { vertical: 'middle', ...alignment };
    const thin = { style: 'thin' };
    for (let r = r1; r <= r2; r++) {
      for (let k = c1; k <= c2; k++) {
        const b = {};
        if (r === r1) b.top = thin;
        if (r === r2) b.bottom = thin;
        if (k === c1) b.left = thin;
        if (k === c2) b.right = thin;
        // En ExcelJS las celdas combinadas comparten el objeto style con la
        // principal: se copia para que cada una tenga SU borde (si no, el
        // último borde asignado pisa a todos y el recuadro queda incompleto).
        const cel = ws.getCell(r, k);
        cel.style = { ...cel.style, border: b };
      }
    }
  },

  // ── Condición académica: PDF ──────────────────────────────

  async _condicionPDF(d, win, archivo) {
    const e = v => this._esc(v);
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${e(archivo)}</title>
      <style>${this._CSS_PAPEL}
        thead { display: table-header-group; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        .titulo td { border: 1px solid #000; white-space: normal; text-align: center; vertical-align: top;
                     font-weight: bold; font-size: 11pt; height: 60pt; padding-top: 4pt; line-height: 1.3; }
        .cols td { font-size: 10pt; height: 15.75pt; }
        .cols td:last-child { font-size: 11pt; }
        tbody td { height: 16.5pt; vertical-align: middle; }
        tbody td.al { font-family: Arial, sans-serif; font-weight: bold; font-size: 12pt; }
        .leyenda { margin-top: 26pt; width: 66%; margin-left: 9%; page-break-inside: avoid; }
        .leyenda td { font-size: 11pt; }
      </style></head><body>
      <div class="listado">
        <table>
          <colgroup><col style="width:9.6%"><col style="width:50%"><col style="width:16.3%"><col style="width:24.1%"></colgroup>
          <thead>
            <tr class="titulo"><td colspan="4">${d.lineas.map(e).join('<br>')}</td></tr>
            <tr class="cols"><td class="c">Orden</td><td>Apellido y Nombre</td><td>D.N.I:</td><td>Condición Académica</td></tr>
          </thead>
          <tbody>${d.filas.map(f => `<tr>
            <td class="c">${f.orden}</td><td class="al">${e(f.nombre)}</td><td class="al">${e(f.dni)}</td><td>${e(f.condicion)}</td></tr>`).join('')}
          </tbody>
        </table>
        <table class="leyenda">
          <colgroup><col style="width:60%"><col style="width:40%"></colgroup>
          <tr><td style="border-right:none">CONDICION ACADEMICA</td><td>REGULAR</td></tr>
          <tr><td class="sb"></td><td>PROMOCIONAL</td></tr>
          <tr><td class="sb"></td><td>LIBRE</td></tr>
          <tr><td class="sb"></td><td>……………………..</td></tr>
        </table>
      </div></body></html>`;
    await this._imprimir(win, html);
  },

  // ── Condición académica: Excel ────────────────────────────

  async _condicionExcel(d, archivo) {
    await this._cargarExcelJS();
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('COND ACADEM', {
      pageSetup: {
        paperSize: 5, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        horizontalCentered: true, printTitlesRow: '1:5',
        margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75, header: 0.3, footer: 0.3 },
      },
    });
    ws.columns = [{ width: 8.43 }, { width: 43.29 }, { width: 14.14 }, { width: 20 }];
    const F = (o = {}) => ({ name: 'Calibri', size: 11, ...o });
    const ARIAL = { name: 'Arial', size: 12, bold: true };

    this._xMerge(ws, 1, 1, 4, 4, d.lineas.join('\n'), F({ bold: true }), { horizontal: 'center', vertical: 'top', wrapText: true });
    ws.getRow(5).height = 15.75;
    this._xMerge(ws, 5, 1, 5, 1, 'Orden', F({ size: 10 }), { horizontal: 'center' });
    this._xMerge(ws, 5, 2, 5, 2, 'Apellido y Nombre', F({ size: 10 }), {});
    this._xMerge(ws, 5, 3, 5, 3, 'D.N.I:', F({ size: 10 }), {});
    this._xMerge(ws, 5, 4, 5, 4, 'Condición Académica', F(), {});

    d.filas.forEach((f, i) => {
      const r = 6 + i;
      ws.getRow(r).height = 16.5;
      this._xMerge(ws, r, 1, r, 1, f.orden, F(), { horizontal: 'center' });
      this._xMerge(ws, r, 2, r, 2, f.nombre, ARIAL, { vertical: 'middle', shrinkToFit: true });
      this._xMerge(ws, r, 3, r, 3, /^\d+$/.test(f.dni) ? Number(f.dni) : f.dni, ARIAL, { vertical: 'middle', horizontal: 'left' });
      this._xMerge(ws, r, 4, r, 4, f.condicion, F(), {});
    });

    const rl = 6 + d.filas.length + 2;
    this._xMerge(ws, rl, 2, rl, 2, 'CONDICION ACADEMICA ', F(), {});
    ws.getCell(rl, 2).border = { left: { style: 'thin' }, top: { style: 'thin' }, bottom: { style: 'thin' } };
    ['REGULAR', 'PROMOCIONAL', 'LIBRE', '……………………..'].forEach((t, i) => {
      this._xMerge(ws, rl + i, 3, rl + i, 3, t, F(), {});
    });

    await this._bajarExcel(wb, archivo);
  },
};
