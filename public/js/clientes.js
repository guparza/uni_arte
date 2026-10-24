// public/js/clientes.js - Módulo de Gestión de Clientes UniArte

let modoEdicionCliente = false;
let timerBusquedaCliente = null;

// Helper flexible para asignar valores aceptando tanto "cliente_campo" como "campo"
function setVal(id, val) {
  let el = document.getElementById(id);
  if (!el && id.startsWith('cliente_')) {
    el = document.getElementById(id.replace('cliente_', ''));
  } else if (!el) {
    el = document.getElementById('cliente_' + id);
  }
  if (el) {
    el.value = (val !== null && val !== undefined) ? val : '';
  }
}

// Helper flexible para leer valores de inputs
function getVal(id) {
  let el = document.getElementById(id);
  if (!el && id.startsWith('cliente_')) {
    el = document.getElementById(id.replace('cliente_', ''));
  } else if (!el) {
    el = document.getElementById('cliente_' + id);
  }
  return el ? el.value.trim() : '';
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
        const c = Array.isArray(item) ? item : item;
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
              <button class="btn btn-sm btn-outline-primary me-1 px-2 py-0" title="Editar" onclick="prepararEdicionCliente('${String(cod).trim()}')">✏️</button>
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

  const inputCodigo = document.getElementById('cliente_codigo') || document.getElementById('codigo_cliente');
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

async function prepararEdicionCliente(codigo) {
  try {
    modoEdicionCliente = true;
    await cargarAuxiliaresClientes();

    //console.log("🔍 Consultando API para editar cliente:", codigo);
    const res = await fetch(`/api/clientes/${codigo}`);
    const data = await res.json();
    
    console.log("📦 Datos devueltos por el servidor:", data);

    if (!data.success || !data.dato) {
      alert('❌ El servidor no devolvió datos válidos para este cliente.');
      return;
    }

    let cliente = data.dato;
    if (Array.isArray(cliente) && cliente.length > 0) {
      cliente = cliente[0];
    }

    if (!cliente || typeof cliente !== 'object') {
      alert('❌ El formato del cliente recibido no es un objeto válido.');
      return;
    }

    // Asignación de valores al formulario
    setVal('codigo_cliente', cliente.codigo);

    const inputCodigo = document.getElementById('codigo_cliente') || document.getElementById('cliente_codigo');
    if (inputCodigo) inputCodigo.readOnly = true;

    setVal('nombre_cliente', cliente.nombre);
    setVal('nombre_fantasia', cliente.nombre_fantasia);
    setVal('cuit', cliente.cuit);
    setVal('cliente_situacioniva', cliente.situacioniva);
    setVal('cliente_condicion_venta', cliente.condicion_venta);
    setVal('cliente_lista_precios', cliente.lista_precios);
    setVal('telefono', cliente.telefono);
    setVal('celular', cliente.celular);
    setVal('contacto', cliente.contacto);
    setVal('mail', cliente.mail);
    setVal('web', cliente.web);
    setVal('direccion', cliente.direccion);
    setVal('cod_postal', cliente.cod_postal);
    setVal('obs', cliente.obs || cliente.observaciones);

    const alerta = document.getElementById('alertaClienteModal');
    if (alerta) alerta.innerHTML = '';

    // Apertura forzada del modal de Bootstrap
    const modalEl = document.getElementById('modalCliente');
    if (modalEl && typeof bootstrap !== 'undefined') {
      const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
      modal.show();
    } else {
      alert('❌ Error: No se encontró el modal #modalCliente o Bootstrap no está cargado.');
    }

  } catch (error) {
    console.error('❌ Error crítico al preparar la edición:', error);
    alert('❌ Ocurrió un error en la consola al intentar editar el cliente.');
  }
}

// 6. Guardar Cliente (Alta o Edición)
async function guardarCliente() {
  const alerta = document.getElementById('alertaClienteModal');
  if (alerta) alerta.innerHTML = '';

  const codigo = getVal('cliente_codigo');
  const nombre = getVal('cliente_nombre');

  if (!codigo || !nombre) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">El código y la razón social son obligatorios.</div>';
    return;
  }

  const payload = {
    codigo: parseInt(codigo),
    nombre: nombre.toUpperCase(),
    nombre_fantasia: getVal('cliente_nombre_fantasia').toUpperCase(),
    cuit: getVal('cliente_cuit'),
    situacioniva: getVal('cliente_situacioniva') || null,
    condicion_venta: getVal('cliente_condicion_venta') || null,
    lista_precios: getVal('cliente_lista_precios') || null,
    telefono: getVal('cliente_telefono'),
    celular: getVal('cliente_celular'),
    contacto: getVal('cliente_contacto').toUpperCase(),
    mail: getVal('cliente_mail'),
    web: getVal('cliente_web'),
    direccion: getVal('cliente_direccion').toUpperCase(),
    cod_postal: getVal('cliente_cod_postal'),
    obs: getVal('cliente_obs').toUpperCase()
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

// 8. Inicialización de eventos al cargar la vista
document.addEventListener('DOMContentLoaded', () => {
  cargarClientes();

  // Escucha del Buscador en Tiempo Real con re-intento si el elemento se renderiza tarde
  const inicializarBuscadorClientes = () => {
    const inputBuscar = document.getElementById('inputBuscarCliente');
    if (inputBuscar && !inputBuscar.dataset.listenerAsignado) {
      inputBuscar.dataset.listenerAsignado = "true";
      inputBuscar.addEventListener('input', () => {
        clearTimeout(timerBusquedaCliente);
        timerBusquedaCliente = setTimeout(() => {
          cargarClientes(inputBuscar.value.trim());
        }, 200);
      });
    }
  };

  inicializarBuscadorClientes();

  // Por si acaso, re-verificamos al hacer clic en la pestaña de clientes
  const btnClientes = document.getElementById('btnNavClientes');
  if (btnClientes) {
    btnClientes.addEventListener('click', () => {
      setTimeout(inicializarBuscadorClientes, 100);
    });
  }

  // Foco con auto-selección
  document.querySelectorAll('#modalCliente input').forEach(input => {
    input.addEventListener('focus', function () { this.select(); });
  });
});

// Exposición global para llamados HTML
window.abrirModalCrearCliente = abrirModalCrearCliente;
window.prepararEdicionCliente = prepararEdicionCliente;
window.guardarCliente = guardarCliente;
window.eliminarCliente = eliminarCliente;
window.cargarClientes = cargarClientes;