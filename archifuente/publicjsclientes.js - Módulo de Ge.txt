// public/js/clientes.js - Módulo de Gestión de Clientes UniArte

let modoEdicionCliente = false;
let timerBusquedaCliente = null;

// Helper flexible de lectura de inputs (Prueba múltiples IDs hasta encontrar el valor)
function getVal(ids) {
  const lista = Array.isArray(ids) ? ids : [ids, 'cliente_' + ids, 'codigo_' + ids, ids.replace('cliente_', '').replace('codigo_', '')];
  for (const id of lista) {
    if (!id) continue;
    const el = document.getElementById(id);
    if (el && el.value !== undefined && el.value !== null) {
      const val = el.value.trim();
      if (val !== '') return val;
    }
  }
  return '';
}

// Helper flexible para escribir valores en inputs
function setVal(ids, valor) {
  const lista = Array.isArray(ids) ? ids : [ids, 'cliente_' + ids, 'codigo_' + ids, ids.replace('cliente_', '').replace('codigo_', '')];
  const valLimpio = (valor !== null && valor !== undefined) ? valor : '';
  for (const id of lista) {
    if (!id) continue;
    const el = document.getElementById(id);
    if (el) {
      el.value = valLimpio;
      return true;
    }
  }
  return false;
}

// 1. Cargar Listas de Precios (Cabecera)
async function cargarListasPreciosCabecera() {
  const select = document.getElementById('cliente_lista_precios') || document.getElementById('lista_precios');
  if (!select) return;

  try {
    const res = await fetch('/api/clientes/listas-cabecera');
    if (!res.ok) return;
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      let html = '<option value="">-- Lista Predeterminada (Sin Descuento) --</option>';
      data.datos.forEach(l => {
        html += `<option value="${l.orden}">${l.orden} - ${l.descripcion}</option>`;
      });
      select.innerHTML = html;
    }
  } catch (error) {
    console.warn('⚠️ Error al cargar listas de precios:', error);
  }
}

// 2. Cargar Auxiliares (IVA y Condición de Venta)
async function cargarAuxiliaresClientes() {
  await cargarListasPreciosCabecera();

  try {
    const resIva = await fetch('/api/clientes/situacionesiva');
    if (resIva.ok) {
      const dataIva = await resIva.json();
      const selectIva = document.getElementById('cliente_situacioniva') || document.getElementById('situacioniva');

      if (selectIva && dataIva.success && Array.isArray(dataIva.datos)) {
        let html = '<option value="">-- Seleccionar --</option>';
        dataIva.datos.forEach(i => {
          html += `<option value="${i.codigo}">${i.descripcion}</option>`;
        });
        selectIva.innerHTML = html;
      }
    }
  } catch (err) {}

  try {
    const resCond = await fetch('/api/clientes/condicionesventa');
    if (resCond.ok) {
      const dataCond = await resCond.json();
      const selectCond = document.getElementById('cliente_condicion_venta') || document.getElementById('condicion_venta');

      if (selectCond && dataCond.success && Array.isArray(dataCond.datos)) {
        let html = '<option value="">-- Seleccionar --</option>';
        dataCond.datos.forEach(c => {
          html += `<option value="${c.codigo}">${c.descripcion}</option>`;
        });
        selectCond.innerHTML = html;
      }
    }
  } catch (err) {}
}

// 3. Cargar Tabla de Clientes con Filtro de Búsqueda
async function cargarClientes(buscar = '') {
  const tbody = document.getElementById('tbodyClientes');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/clientes?buscar=${encodeURIComponent(buscar)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      if (data.datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-3">No se encontraron clientes registrados.</td></tr>';
        return;
      }

      let html = '';
      data.datos.forEach(item => {
        const c = Array.isArray(item) ? item[0] : item;
        if (!c || typeof c !== 'object') return;

        const cod = c.codigo !== undefined && c.codigo !== null ? c.codigo : '-';
        const nom = c.nombre || 'Sin Nombre';
        const iva = c.situacioniva_desc || c.situacioniva || '-';
        const tel = c.telefono || c.celular || '-';
        const mail = c.mail || '-';
        const lista = c.lista_nombre 
          ? `<span class="badge bg-info text-dark">${c.lista_nombre}</span>` 
          : '<span class="text-muted small">Predeterminada</span>';

        html += `
          <tr>
            <td class="fw-bold align-middle">${cod}</td>
            <td class="align-middle fw-semibold">${nom}</td>
            <td class="align-middle small">${c.cuit || '-'}</td>
            <td class="align-middle small">${iva}</td>
            <td class="align-middle small">${tel}</td>
            <td class="align-middle small">${mail}</td>
            <td class="align-middle text-center">${lista}</td>
            <td class="text-end align-middle">
              <button class="btn btn-sm btn-outline-primary me-1 px-2 py-0" title="Editar" onclick="prepararEdicionCliente('${cod}')">✏️</button>
              <button class="btn btn-sm btn-outline-danger px-2 py-0" title="Eliminar" onclick="eliminarCliente('${cod}')">🗑️</button>
            </td>
          </tr>`;
      });
      tbody.innerHTML = html;
    }
  } catch (error) {
    console.error('❌ Error al consultar clientes:', error);
  }
}

// 4. Abrir Modal para Crear Cliente
async function abrirModalCrearCliente() {
  modoEdicionCliente = false;

  const form = document.getElementById('formCliente');
  if (form) form.reset();

  const inputCodigo = document.getElementById('cliente_codigo') || document.getElementById('codigo_cliente') || document.getElementById('codigo');
  if (inputCodigo) inputCodigo.readOnly = false;

  const alerta = document.getElementById('alertaClienteModal');
  if (alerta) alerta.innerHTML = '';

  await cargarAuxiliaresClientes();

  const modalEl = document.getElementById('modalCliente');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
  }
}

// 5. ✏️ Cargar Cliente para Edición (Código en sólo lectura)
async function prepararEdicionCliente(codigo) {
  try {
    modoEdicionCliente = true;
    await cargarAuxiliaresClientes();

    const res = await fetch(`/api/clientes/${codigo}`);
    const data = await res.json();

    if (data.success && data.dato) {
      let cliente = data.dato;
      if (Array.isArray(cliente) && cliente.length > 0) {
        cliente = cliente[0];
      }

      if (!cliente || typeof cliente !== 'object') {
        alert('❌ No se encontraron los datos del cliente.');
        return;
      }

      // Asignar Código y bloquearlo para edición
      setVal(['cliente_codigo', 'codigo_cliente', 'codigo'], cliente.codigo);
      const inputCodigo = document.getElementById('cliente_codigo') || document.getElementById('codigo_cliente') || document.getElementById('codigo');
      if (inputCodigo) inputCodigo.readOnly = true;

      // Cargar demás campos
      setVal(['cliente_nombre', 'nombre_cliente', 'nombre'], cliente.nombre);
      setVal(['cliente_nombre_fantasia', 'nombre_fantasia'], cliente.nombre_fantasia);
      setVal(['cliente_cuit', 'cuit'], cliente.cuit);
      setVal(['cliente_situacioniva', 'situacioniva'], cliente.situacioniva || cliente.situacion_iva);
      setVal(['cliente_condicion_venta', 'condicion_venta'], cliente.condicion_venta);
      setVal(['cliente_lista_precios', 'lista_precios'], cliente.lista_precios);
      setVal(['cliente_telefono', 'telefono'], cliente.telefono);
      setVal(['cliente_celular', 'celular'], cliente.celular);
      setVal(['cliente_contacto', 'contacto'], cliente.contacto);
      setVal(['cliente_mail', 'mail'], cliente.mail);
      setVal(['cliente_web', 'web'], cliente.web);
      setVal(['cliente_direccion', 'direccion'], cliente.direccion);
      setVal(['cliente_cod_postal', 'cod_postal'], cliente.cod_postal);
      setVal(['cliente_obs', 'obs'], cliente.obs);

      const alerta = document.getElementById('alertaClienteModal');
      if (alerta) alerta.innerHTML = '';

      const modalEl = document.getElementById('modalCliente');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
      }
    }
  } catch (error) {
    console.error('❌ Error al obtener datos del cliente:', error);
  }
}

// 6. Guardar Cliente (Alta o Edición)
async function guardarCliente() {
  const alerta = document.getElementById('alertaClienteModal');
  if (alerta) alerta.innerHTML = '';

  const codigo = getVal(['cliente_codigo', 'codigo_cliente', 'codigo']);
  const nombre = getVal(['cliente_nombre', 'nombre_cliente', 'nombre']);

  if (!codigo || !nombre) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">El código y la razón social son obligatorios.</div>';
    return;
  }

  const payload = {
    codigo: parseInt(codigo),
    nombre: nombre.toUpperCase(),
    nombre_fantasia: getVal(['cliente_nombre_fantasia', 'nombre_fantasia']).toUpperCase(),
    cuit: getVal(['cliente_cuit', 'cuit']),
    situacioniva: getVal(['cliente_situacioniva', 'situacioniva']) || null,
    condicion_venta: getVal(['cliente_condicion_venta', 'condicion_venta']) || null,
    lista_precios: getVal(['cliente_lista_precios', 'lista_precios']) || null,
    telefono: getVal(['cliente_telefono', 'telefono']),
    celular: getVal(['cliente_celular', 'celular']),
    contacto: getVal(['cliente_contacto', 'contacto']).toUpperCase(),
    mail: getVal(['cliente_mail', 'mail']),
    web: getVal(['cliente_web', 'web']),
    direccion: getVal(['cliente_direccion', 'direccion']).toUpperCase(),
    cod_postal: getVal(['cliente_cod_postal', 'cod_postal']),
    obs: getVal(['cliente_obs', 'obs']).toUpperCase()
  };

  const url = modoEdicionCliente ? `/api/clientes/${codigo}` : '/api/clientes';
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
    }
  } catch (error) {
    console.error('❌ Error al guardar cliente:', error);
  }
}

// 7. Eliminar Cliente
async function eliminarCliente(codigo) {
  if (!confirm(`¿Está seguro de eliminar al cliente #${codigo}?`)) return;

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

// 8. Inicialización
document.addEventListener('DOMContentLoaded', () => {
  cargarClientes();

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

// Exposición global
window.abrirModalCrearCliente = abrirModalCrearCliente;
window.prepararEdicionCliente = prepararEdicionCliente;
window.guardarCliente = guardarCliente;
window.eliminarCliente = eliminarCliente;
window.cargarClientes = cargarClientes;