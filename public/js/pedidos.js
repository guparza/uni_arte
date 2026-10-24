// public/js/pedidos.js - Módulo de Gestión de Pedidos UniArte

let modoEdicionPedido = false;
let itemsDetallePedido = [];
let timerBusquedaPedido = null;
let catalogoArticulosMap = {};
let clientesMap = {};

// 1. Cargar opciones predictivas
async function cargarAuxiliaresPedidos() {
  try {
    const resCli = await fetch('/api/clientes');
    const dataCli = await resCli.json();
    const dlClientes = document.getElementById('dl_clientes');

    if (dlClientes && dataCli.success && Array.isArray(dataCli.datos)) {
      let htmlCli = '';
      clientesMap = {};
      dataCli.datos.forEach(c => {
        const texto = `${c.codigo} - ${c.nombre}`;
        clientesMap[texto] = c.codigo;
        htmlCli += `<option value="${texto}"></option>`;
      });
      dlClientes.innerHTML = htmlCli;
    }

    const resArt = await fetch('/api/articulos');
    const dataArt = await resArt.json();
    const dlArticulos = document.getElementById('dl_articulos');

    if (dlArticulos && dataArt.success && Array.isArray(dataArt.datos)) {
      let htmlArt = '';
      catalogoArticulosMap = {};
      dataArt.datos.forEach(a => {
        const texto = `${a.codigo} - ${a.descripcion}`;
        catalogoArticulosMap[texto] = a;
        catalogoArticulosMap[a.codigo] = a;
        htmlArt += `<option value="${texto}">$ ${a.precio_venta}</option>`;
      });
      dlArticulos.innerHTML = htmlArt;
    }
  } catch (error) {
    console.error('❌ Error al cargar auxiliares de pedidos:', error);
  }
}

// 2. Cargar grilla de pedidos
async function cargarPedidos(buscar = '') {
  const tbody = document.getElementById('tbodyPedidos');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/pedidos?buscar=${encodeURIComponent(buscar)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      if (data.datos.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center text-muted py-3">No se encontraron pedidos registrados.</td>
          </tr>`;
        return;
      }

      let html = '';
      data.datos.forEach(p => {
        const fechaFmt = p.fecha ? new Date(p.fecha).toLocaleDateString('es-AR') : '-';
        const totalFmt = Number(p.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
        
        let badgeColor = 'bg-warning text-dark';
        if (p.estado === '2') badgeColor = 'bg-success';
        if (p.estado === '4') badgeColor = 'bg-danger';
        if (p.estado === '1') badgeColor = 'bg-info text-dark';

        html += `
          <tr>
            <td class="fw-bold align-middle">#${p.control}</td>
            <td class="align-middle small">${fechaFmt}</td>
            <td class="align-middle fw-semibold">${p.cliente_nombre || 'Cliente #' + p.cliente}</td>
            <td class="align-middle text-center"><span class="badge ${badgeColor}">${p.estado_desc}</span></td>
            <td class="align-middle text-end fw-bold">$ ${totalFmt}</td>
            <td class="text-end align-middle">
              <button class="btn btn-sm btn-outline-primary me-1 px-2 py-0" title="Editar" onclick="prepararEdicionPedido(${p.control})">✏️</button>
              <button class="btn btn-sm btn-outline-danger px-2 py-0" title="Eliminar" onclick="eliminarPedido(${p.control})">🗑️</button>
            </td>
          </tr>`;
      });
      tbody.innerHTML = html;
    }
  } catch (error) {
    console.error('❌ Error al consultar pedidos:', error);
  }
}

// 3. Renderizar grilla interna del modal
function renderizarDetallePedido() {
  const tbody = document.getElementById('tbodyPedidoDetalle');
  const lblTotal = document.getElementById('lblTotalPedido');

  if (!tbody) return;

  if (itemsDetallePedido.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-2">No se han agregado artículos al pedido.</td></tr>';
    if (lblTotal) lblTotal.innerText = '$ 0.00';
    return;
  }

  let totalAcumulado = 0;
  let html = '';

  itemsDetallePedido.forEach((item, index) => {
    totalAcumulado += item.total;
    const precioFmt = Number(item.precio_unit).toLocaleString('es-AR', { minimumFractionDigits: 2 });
    const subtotalFmt = Number(item.total).toLocaleString('es-AR', { minimumFractionDigits: 2 });

    html += `
      <tr>
        <td class="fw-bold align-middle">${item.articulo}</td>
        <td class="align-middle fw-semibold">${item.descripcion}</td>
        <td class="align-middle text-end fw-bold">${item.cantidad}</td>
        <td class="align-middle text-end">$ ${precioFmt}</td>
        <td class="align-middle text-end fw-bold text-success">$ ${subtotalFmt}</td>
        <td class="text-center align-middle">
          <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1" onclick="quitarItemADetalle(${index})">🗑️</button>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
  if (lblTotal) {
    lblTotal.innerText = `$ ${totalAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
  }
}

// 4. Abrir modal para crear pedido
async function abrirModalCrearPedido() {
  modoEdicionPedido = false;
  itemsDetallePedido = [];

  const form = document.getElementById('formPedido');
  if (form) form.reset();

  document.getElementById('pedido_control').value = 'Auto';
  document.getElementById('pedido_cliente').value = '';
  document.getElementById('input_pedido_cliente').value = '';
  document.getElementById('pedido_fecha').value = new Date().toISOString().split('T')[0];
  document.getElementById('pedido_estado').value = '0';
  document.getElementById('alertaPedidoModal').innerHTML = '';

  renderizarDetallePedido();
  await cargarAuxiliaresPedidos();

  const modalEl = document.getElementById('modalPedido');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
  }
}

// 5. Agregar artículo al detalle
function agregarItemADetalle() {
  const inputTextoArt = document.getElementById('input_item_articulo')?.value.trim();
  const inputPrecio = document.getElementById('item_precio');
  const inputCant = document.getElementById('item_cantidad');

  const artObj = catalogoArticulosMap[inputTextoArt];

  if (!artObj) {
    alert('Seleccione un artículo válido de la lista predictiva.');
    return;
  }

  const codigoArt = artObj.codigo;
  const precio = parseFloat(inputPrecio?.value) || 0;
  const cantidad = parseInt(inputCant?.value) || 1;
  const subtotal = precio * cantidad;

  const indexExistente = itemsDetallePedido.findIndex(i => i.articulo === codigoArt);
  if (indexExistente > -1) {
    itemsDetallePedido[indexExistente].cantidad += cantidad;
    itemsDetallePedido[indexExistente].total = itemsDetallePedido[indexExistente].cantidad * itemsDetallePedido[indexExistente].precio_unit;
  } else {
    itemsDetallePedido.push({
      articulo: codigoArt,
      descripcion: artObj.descripcion || codigoArt,
      precio_unit: precio,
      dscto: 0,
      cantidad: cantidad,
      total: subtotal
    });
  }

  document.getElementById('input_item_articulo').value = '';
  document.getElementById('item_articulo').value = '';
  document.getElementById('item_precio').value = '0.00';
  document.getElementById('item_cantidad').value = '1';

  renderizarDetallePedido();

  const inputArt = document.getElementById('input_item_articulo');
  if (inputArt) inputArt.focus();
}

// 6. Quitar ítem del detalle
function quitarItemADetalle(index) {
  itemsDetallePedido.splice(index, 1);
  renderizarDetallePedido();
}

// 7. Cargar pedido para edición
async function prepararEdicionPedido(control) {
  try {
    modoEdicionPedido = true;
    await cargarAuxiliaresPedidos();

    const res = await fetch(`/api/pedidos/${control}`);
    const data = await res.json();

    if (data.success && data.dato) {
      const p = data.dato;

      document.getElementById('pedido_control').value = p.control;
      document.getElementById('pedido_cliente').value = p.cliente;
      document.getElementById('input_pedido_cliente').value = `${p.cliente} - ${p.cliente_nombre || ''}`;
      
      if (p.fecha) {
        const fechaLimpia = p.fecha.includes('T') ? p.fecha.split('T')[0] : p.fecha;
        document.getElementById('pedido_fecha').value = fechaLimpia;
      }

      document.getElementById('pedido_estado').value = String(p.estado);
      document.getElementById('pedido_obs').value = p.obs || '';

      itemsDetallePedido = (p.detalles || []).map(d => ({
        articulo: d.articulo,
        descripcion: d.articulo_desc || d.articulo,
        precio_unit: parseFloat(d.precio_unit) || 0,
        dscto: parseFloat(d.dscto) || 0,
        cantidad: parseInt(d.cantidad) || 1,
        total: parseFloat(d.total) || 0
      }));

      renderizarDetallePedido();

      const modalEl = document.getElementById('modalPedido');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
      }
    }
  } catch (error) {
    console.error('❌ Error al preparar edición de pedido:', error);
  }
}

// 8. Guardar Pedido
async function guardarPedido() {
  const alerta = document.getElementById('alertaPedidoModal');
  if (alerta) alerta.innerHTML = '';

  const inputClienteTexto = document.getElementById('input_pedido_cliente')?.value;
  const clienteId = clientesMap[inputClienteTexto] || document.getElementById('pedido_cliente')?.value;
  const fecha = document.getElementById('pedido_fecha')?.value;
  const estado = document.getElementById('pedido_estado')?.value;
  const obs = document.getElementById('pedido_obs')?.value || '';
  const control = document.getElementById('pedido_control')?.value;

  if (!clienteId) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">Seleccione un cliente válido de la lista predictiva.</div>';
    return;
  }

  if (itemsDetallePedido.length === 0) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-danger py-1 small">Agregue al menos un artículo al pedido.</div>';
    return;
  }

  const totalCalculado = itemsDetallePedido.reduce((acc, curr) => acc + curr.total, 0);

  const payload = {
    cliente: parseInt(clienteId),
    fecha,
    total: totalCalculado,
    obs: obs.toUpperCase(),
    estado,
    detalles: itemsDetallePedido
  };

  const url = modoEdicionPedido ? `/api/pedidos/${control}` : '/api/pedidos';
  const metodo = modoEdicionPedido ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const resultado = await res.json();

    if (resultado.success) {
      const modalEl = document.getElementById('modalPedido');
      if (modalEl && typeof bootstrap !== 'undefined') {
        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
      await cargarPedidos();
    } else {
      if (alerta) alerta.innerHTML = `<div class="alert alert-danger py-1 small">${resultado.mensaje}</div>`;
    }
  } catch (error) {
    console.error('❌ Error al guardar pedido:', error);
  }
}

// 9. Eliminar Pedido
async function eliminarPedido(control) {
  if (!confirm(`¿Está seguro de eliminar el pedido #${control}?`)) return;

  try {
    const res = await fetch(`/api/pedidos/${control}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      await cargarPedidos();
    } else {
      alert(data.mensaje || 'No se pudo eliminar el pedido.');
    }
  } catch (error) {
    console.error('❌ Error al eliminar pedido:', error);
  }
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
  cargarPedidos();
  if (typeof habilitarSaltoEnter === 'function') {
    habilitarSaltoEnter('formPedido', guardarPedido);
  }

  const inputBuscar = document.getElementById('inputBuscarPedido');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      clearTimeout(timerBusquedaPedido);
      timerBusquedaPedido = setTimeout(() => {
        cargarPedidos(inputBuscar.value.trim());
      }, 200);
    });
  }

  const inputItemArt = document.getElementById('input_item_articulo');
  if (inputItemArt) {
    inputItemArt.addEventListener('change', async () => {
      const texto = inputItemArt.value;
      const art = catalogoArticulosMap[texto];
      const inputClienteTexto = document.getElementById('input_pedido_cliente')?.value;
      const clienteId = clientesMap[inputClienteTexto] || document.getElementById('pedido_cliente')?.value;
      const inputPrecio = document.getElementById('item_precio');

      if (!art) return;

      document.getElementById('item_articulo').value = art.codigo;

      if (clienteId && clienteId > 0) {
        try {
          const res = await fetch(`/api/pedidos/precio-unitario?cliente=${clienteId}&articulo=${art.codigo}`);
          const data = await res.json();
          
          if (data.success && inputPrecio) {
            inputPrecio.value = Number(data.precio).toFixed(2);
            return;
          }
        } catch (err) {
          console.error('Error al obtener precio personalizado:', err);
        }
      }

      if (inputPrecio) {
        inputPrecio.value = Number(art.precio_venta || 0).toFixed(2);
      }
    });
  }

  const inputArtSearch = document.getElementById('input_item_articulo');
  if (inputArtSearch) {
    inputArtSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (!inputArtSearch.value.trim()) {
          e.preventDefault();
          e.stopPropagation();
          document.getElementById('pedido_obs')?.focus();
        } else {
          e.preventDefault();
          e.stopPropagation();
          document.getElementById('item_cantidad')?.focus();
        }
      }
    });
  }

  const inputCant = document.getElementById('item_cantidad');
  if (inputCant) {
    inputCant.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        agregarItemADetalle();
      }
    });
  }

  document.querySelectorAll('#modalPedido input').forEach(input => {
    input.addEventListener('focus', function () { this.select(); });
  });
});

window.abrirModalCrearPedido = abrirModalCrearPedido;
window.prepararEdicionPedido = prepararEdicionPedido;
window.guardarPedido = guardarPedido;
window.eliminarPedido = eliminarPedido;
window.agregarItemADetalle = agregarItemADetalle;
window.quitarItemADetalle = quitarItemADetalle;
window.renderizarDetallePedido = renderizarDetallePedido;
window.cargarPedidos = cargarPedidos;