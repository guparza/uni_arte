// public/js/clientes.js - Módulo de Gestión de Clientes

let modoEdicionCliente = false;
let timerBusquedaCliente = null;

async function cargarAuxiliaresClientes() {
  try {
    const res = await fetch('/api/clientes/auxiliares');
    const data = await res.json();

    if (data.success) {
      const selectIva = document.getElementById('situacioniva');
      const selectCond = document.getElementById('condicion_venta');

      if (selectIva && Array.isArray(data.situacionesIva)) {
        let htmlIva = '<option value="">-- Seleccionar Sit. IVA --</option>';
        data.situacionesIva.forEach(s => {
          htmlIva += `<option value="${s.codigo}">${s.descripcion}</option>`;
        });
        selectIva.innerHTML = htmlIva;
      }

      if (selectCond && Array.isArray(data.condicionesVenta)) {
        let htmlCond = '<option value="">-- Seleccionar Condición --</option>';
        data.condicionesVenta.forEach(c => {
          htmlCond += `<option value="${c.codigo}">${c.descripcion}</option>`;
        });
        selectCond.innerHTML = htmlCond;
      }
    }
  } catch (error) {
    console.error('❌ Error al cargar auxiliares de clientes:', error);
  }
}

async function cargarClientes(buscar = '') {
  const tbody = document.getElementById('tbodyClientes');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/clientes?buscar=${encodeURIComponent(buscar)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      if (data.datos.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center text-muted py-3">
              No se encontraron clientes registrados.
            </td>
          </tr>`;
        return;
      }

      let html = '';
      data.datos.forEach(c => {
        html += `
          <tr>
            <td class="fw-bold align-middle">${c.codigo}</td>
            <td class="align-middle fw-semibold">${c.nombre || '-'}</td>
            <td class="align-middle small text-muted">${c.cuit || '-'}</td>
            <td class="align-middle small">${c.situacion_iva_desc || '-'}</td>
            <td class="align-middle small">${c.telefono || c.celular || '-'}</td>
            <td class="align-middle small text-lowercase">${c.mail || '-'}</td>
            <td class="text-end align-middle">
              <button class="btn btn-sm btn-outline-primary me-1 px-2 py-0" title="Editar" onclick="prepararEdicionCliente(${c.codigo})">✏️</button>
              <button class="btn btn-sm btn-outline-danger px-2 py-0" title="Eliminar" onclick="eliminarCliente(${c.codigo})">🗑️</button>
            </td>
          </tr>`;
      });
      tbody.innerHTML = html;
    }
  } catch (error) {
    console.error('❌ Error al consultar clientes:', error);
  }
}

async function abrirModalCrearCliente() {
  modoEdicionCliente = false;

  const form = document.getElementById('formCliente');
  if (form) form.reset();

  const inputCodigo = document.getElementById('codigo_cliente');
  if (inputCodigo) {
    inputCodigo.value = '';
    inputCodigo.readOnly = false;
  }

  const alerta = document.getElementById('alertaClienteModal');
  if (alerta) alerta.innerHTML = '';

  await cargarAuxiliaresClientes();

  const modalEl = document.getElementById('modalCliente');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();

    setTimeout(() => {
      document.getElementById('codigo_cliente')?.focus();
    }, 350);
  }
}

async function prepararEdicionCliente(codigo) {
  try {
    modoEdicionCliente = true;
    await cargarAuxiliaresClientes();

    const res = await fetch(`/api/clientes/${codigo}`);
    const data = await res.json();

    if (data.success && data.dato) {
      const c = Array.isArray(data.dato) ? data.dato[0] : data.dato;

      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val !== null && val !== undefined ? val : '';
      };

      setVal('codigo_cliente', c.codigo);
      setVal('nombre_cliente', c.nombre);
      setVal('nombre_fantasia', c.nombre_fantasia);
      setVal('cuit', c.cuit);
      setVal('situacioniva', c.situacioniva);
      setVal('condicion_venta', c.condicion_venta);
      setVal('telefono', c.telefono);
      setVal('celular', c.celular);
      setVal('contacto', c.contacto);
      setVal('mail', c.mail);
      setVal('web', c.web);
      setVal('direccion', c.direccion);
      setVal('cod_postal', c.cod_postal);
      setVal('obs', c.obs);

      const inputCodigo = document.getElementById('codigo_cliente');
      if (inputCodigo) inputCodigo.readOnly = true;

      const alerta = document.getElementById('alertaClienteModal');
      if (alerta) alerta.innerHTML = '';

      const modalEl = document.getElementById('modalCliente');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
      }
    }
  } catch (error) {
    console.error('❌ Error al obtener cliente para edición:', error);
  }
}

async function guardarCliente() {
  const alerta = document.getElementById('alertaClienteModal');
  if (alerta) alerta.innerHTML = '';

  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const codigoVal = getVal('codigo_cliente');
  const nombreVal = getVal('nombre_cliente');

  if (!codigoVal || parseInt(codigoVal) <= 0) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-danger py-1 small">Debe ingresar un Código de Cliente válido.</div>';
    document.getElementById('codigo_cliente')?.focus();
    return;
  }

  if (!nombreVal) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">La Razón Social / Nombre es obligatoria.</div>';
    document.getElementById('nombre_cliente')?.focus();
    return;
  }

  const payload = {
    codigo: parseInt(codigoVal),
    nombre: nombreVal,
    nombre_fantasia: getVal('nombre_fantasia'),
    cuit: getVal('cuit'),
    situacioniva: getVal('situacioniva'),
    condicion_venta: getVal('condicion_venta'),
    telefono: getVal('telefono'),
    celular: getVal('celular'),
    contacto: getVal('contacto'),
    mail: getVal('mail'),
    web: getVal('web'),
    direccion: getVal('direccion'),
    cod_postal: getVal('cod_postal'),
    obs: getVal('obs')
  };

  const url = modoEdicionCliente ? `/api/clientes/${encodeURIComponent(codigoVal)}` : '/api/clientes';
  const metodo = modoEdicionCliente ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resultado = await res.json();

    if (resultado.success) {
      const modalEl = document.getElementById('modalCliente');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      await cargarClientes();
    } else {
      if (alerta) alerta.innerHTML = `<div class="alert alert-danger py-1 small">${resultado.mensaje}</div>`;
      if (resultado.mensaje.toLowerCase().includes('código') || resultado.mensaje.toLowerCase().includes('existe')) {
        const inputCod = document.getElementById('codigo_cliente');
        if (inputCod) {
          inputCod.focus();
          inputCod.select();
        }
      }
    }
  } catch (error) {
    console.error('❌ Error al guardar cliente:', error);
  }
}

async function eliminarCliente(codigo) {
  if (!confirm(`¿Está seguro de que desea eliminar al cliente #${codigo}?`)) return;

  try {
    const res = await fetch(`/api/clientes/${codigo}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      await cargarClientes();
    } else {
      alert(data.mensaje || 'No se pudo eliminar el cliente.');
    }
  } catch (error) {
    console.error('❌ Error al eliminar cliente:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  cargarClientes();
  habilitarSaltoEnter('formCliente', guardarCliente);

  const inputBuscar = document.getElementById('inputBuscarCliente');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      clearTimeout(timerBusquedaCliente);
      timerBusquedaCliente = setTimeout(() => {
        cargarClientes(inputBuscar.value.trim());
      }, 200);
    });
  }

  document.querySelectorAll('#modalCliente input').forEach(input => {
    input.addEventListener('focus', function () { this.select(); });
  });
});

window.abrirModalCrearCliente = abrirModalCrearCliente;
window.prepararEdicionCliente = prepararEdicionCliente;
window.guardarCliente = guardarCliente;
window.eliminarCliente = eliminarCliente;
window.cargarAuxiliaresClientes = cargarAuxiliaresClientes;
window.cargarClientes = cargarClientes;