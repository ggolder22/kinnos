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
    return new Date(iso).toLocaleDateString('es-AR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
    });
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
