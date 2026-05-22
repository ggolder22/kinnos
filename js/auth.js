const Auth = {
  session() {
    return {
      rol:    sessionStorage.getItem('kinnos_rol'),
      id:     sessionStorage.getItem('kinnos_id'),
      nombre: sessionStorage.getItem('kinnos_nombre'),
      dni:    sessionStorage.getItem('kinnos_dni'),
      inst:   sessionStorage.getItem('kinnos_inst'),
      career: sessionStorage.getItem('kinnos_career'),
    };
  },

  require(rol) {
    const s = this.session();
    if (!s.rol || s.rol !== rol) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  },

  logout() {
    sessionStorage.clear();
    window.location.href = 'index.html';
  },
};
