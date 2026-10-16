const Utils = {
  toast(msg, tipo = 'success') {
    const c = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${tipo}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  },

  async confirmar(msg) {
    return window.confirm(msg);
  },

  formatDate(iso) {
    if (!iso) return '—';
    // Fecha "pelada" (sin hora), ej: columnas `date` como session_date o due_date.
    // new Date('2026-10-01') la interpreta como medianoche UTC, y al mostrarla en huso
    // horario argentino (UTC-3) se corre un día para atrás. Acá se formatea directo,
    // sin pasar por conversión de huso horario.
    const soloFecha = /^\d{4}-\d{2}-\d{2}$/.test(iso);
    if (soloFecha) {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    }
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
  },

  // Fecha de HOY según el reloj del dispositivo (hora local), no UTC —
  // evita que entre las 21:00 y las 23:59 (Argentina, UTC-3) la app crea
  // que ya es "mañana".
  hoyLocal() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  // Muestra el spinner de un botón y lo devuelve al estado original al terminar
  btnLoading(btn, loading) {
    if (loading) {
      btn._txt = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Guardando…';
    } else {
      btn.disabled = false;
      btn.textContent = btn._txt || 'Guardar';
    }
  },

  // Nombre de un alumno en formato "Apellido, Nombre", como exige el ministerio
  // en planillas (asistencia, actas de examen, listados). Si el alumno todavía
  // no tiene nombre/apellido separados (registro viejo), muestra full_name tal
  // cual viene — no se puede partir un string a ciegas sin arriesgar un error.
  nombrePlanilla(alumno) {
    if (!alumno) return '';
    if (alumno.last_name && alumno.first_name) return `${alumno.last_name}, ${alumno.first_name}`;
    return alumno.full_name || '';
  },

  // Descarga un CSV: headers = ['Col1','Col2',...], filas = [[v1,v2,...], ...]
  descargarCsv(nombreArchivo, headers, filas) {
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(esc).join(','), ...filas.map(f => f.map(esc).join(','))].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // Renderiza <option> en un <select>
  fillSelect(selectId, items, valueKey, labelKey, placeholderText) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = `<option value="">${placeholderText}</option>`;
    items.forEach(i => {
      const o = document.createElement('option');
      o.value = i[valueKey];
      o.textContent = i[labelKey];
      sel.appendChild(o);
    });
  },
};
