// public/js/pedidos.js - Módulo de Gestión de Pedidos UniArte

let modoEdicionPedido = false;
let itemsDetallePedido = [];
let timerBusquedaPedido = null;
let catalogoArticulosMap = {};
let clientesMap = {};
let clienteListaPreciosActiva = null; // 🟢 Guarda la lista de precios del cliente seleccionado

// 🛡️ Helpers seguros para el modal de pedidos
function getModalEl(id) {
  return document.getElementById(id) || 
         document.querySelector(`#modalPedido #${id}`) || 
         document.querySelector(`#modalPedido [name="${id}"]`);
}

function getFieldValue(ids) {
  const lista = Array.isArray(ids) ? ids : [ids];
  for (const id of lista) {
    const el = getModalEl(id);
    if (el && el.value !== undefined) return el.value.trim();
  }
  return '';
}

function setFieldValue(ids, valor) {
  const lista = Array.isArray(ids) ? ids : [ids];
  const valLimpio = (valor !== null && valor !== undefined) ? valor : '';
  for (const id of lista) {
    const el = getModalEl(id);
    if (el) {
      el.value = valLimpio;
      return true;
    }
  }
  return false;
}

// 🟢 1. Definición global de cotizarPrecioArticuloPedido
async function cotizarPrecioArticuloPedido(codigoArticulo) {
  const inputPrecio = document.getElementById('item_precio') || getModalEl('item_precio');
  if (!codigoArticulo) return;

  const clienteCod = getFieldValue(['pedido_cliente', 'cliente']) || clientesMap[getFieldValue('input_pedido_cliente')];

  try {
    let url = `/api/pedidos/precio-unitario?cliente=${encodeURIComponent(clienteCod || '')}&articulo=${encodeURIComponent(codigoArticulo)}`;
    let res = await fetch(url);
    let data = await res.json();

    if (!data.success) {
      url = `/api/articulos/${encodeURIComponent(codigoArticulo)}/precio?lista_precios=${clienteListaPreciosActiva || ''}`;
      res = await fetch(url);
      data = await res.json();
    }

    if (data.success && inputPrecio) {
      inputPrecio.value = Math.round(Number(data.precio || data.dato?.precio_venta || data.dato?.precio || 0));
    }
  } catch (err) {
    console.error('❌ Error al obtener cotización del artículo:', err);
  }
}

// Alias de compatibilidad
async function cotizarItemPedido() {
  const inputArt = getModalEl('input_item_articulo');
  if (!inputArt) return;
  const texto = inputArt.value.trim();
  const codigoArticulo = texto.includes(' - ') ? texto.split(' - ')[0] : texto;
  if (codigoArticulo) {
    await cotizarPrecioArticuloPedido(codigoArticulo);
  }
}

// 🟢 2. Detección segura de Enter en la casilla de Cantidad
function habilitarNavegacionEnterModal() {
  const modal = document.getElementById('modalPedido');
  if (!modal) return;

  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (e.target.id === 'pedido_obs' || e.target.name === 'obs') {
        if (e.shiftKey) return;
      }

      e.preventDefault();

      const inputArt = getModalEl('input_item_articulo');
      const inputObs = getModalEl('pedido_obs') || getModalEl('obs');

      // A. Detección flexible de la casilla de Cantidad
      const esInputCantidad = (e.target.id === 'item_cantidad' || 
                               e.target.id === 'cantidad' || 
                               e.target.name === 'item_cantidad' || 
                               e.target.name === 'cantidad');

      if (esInputCantidad) {
        agregarItemADetalle();
        return;
      }

      // B. Si el Buscador de Artículo está VACÍO -> Salta a Observaciones
      if (e.target === inputArt && !inputArt.value.trim()) {
        if (inputObs) {
          inputObs.focus();
          if (typeof inputObs.select === 'function') inputObs.select();
        }
        return;
      }

      // C. Navegación secuencial estándar
      const controles = Array.from(
        modal.querySelectorAll('input:not([readonly]):not([type="hidden"]), select, textarea, button.btn-primary')
      ).filter(el => el.offsetParent !== null);

      const index = controles.indexOf(e.target);
      if (index > -1 && index < controles.length - 1) {
        const siguiente = controles[index + 1];
        siguiente.focus();
        if (typeof siguiente.select === 'function') siguiente.select();
      } else if (index === controles.length - 1) {
        guardarPedido();
      }
    }
  });
}

// 🟢 2. Obtener lista de precios del cliente seleccionado
async function actualizarListaPreciosClienteActivo(codigoCliente) {
  clienteListaPreciosActiva = null;
  if (!codigoCliente) return;

  try {
    const res = await fetch(`/api/clientes/${encodeURIComponent(codigoCliente)}`);
    const data = await res.json();
    if (data.success && data.dato) {
      const c = Array.isArray(data.dato) ? data.dato : data.dato;
      clienteListaPreciosActiva = c.lista_precios || null;
      console.log(`👤 Cliente: ${c.nombre} | Lista Precios: ${clienteListaPreciosActiva || 'Referencia'}`);
    }
  } catch (err) {
    console.warn('⚠️ No se pudo obtener la lista de precios del cliente:', err);
  }
}

// 2. Alternar vista entre Artículo y Concepto de Venta
function alternarTipoItemPedido() {
  const tipo = getFieldValue('item_tipo_selector');
  const divArt = document.getElementById('div_articulo_input');
  const divConc = document.getElementById('div_concepto_input');
  const inputPrecio = getModalEl('item_precio');

  if (tipo === 'concepto') {
    if (divArt) divArt.classList.add('d-none');
    if (divConc) divConc.classList.remove('d-none');
    if (inputPrecio) {
      inputPrecio.value = '0.00';
      inputPrecio.focus();
      if (typeof inputPrecio.select === 'function') inputPrecio.select();
    }
  } else {
    if (divConc) divConc.classList.add('d-none');
    if (divArt) divArt.classList.remove('d-none');
    if (inputPrecio) inputPrecio.value = '0.00';
  }
}

// 🟢 3. Lectura directa de la cantidad ingresada y agregar ítem
function agregarItemADetalle() {
  const tipo = getFieldValue('item_tipo_selector');
  const precio = parseFloat(getFieldValue('item_precio')) || 0;

  // Captura directa de la casilla de cantidad (soporta id "item_cantidad" o "cantidad")
  const elCant = document.getElementById('item_cantidad') || 
                 document.getElementById('cantidad') || 
                 getModalEl('item_cantidad');
  
  const cantidadVal = elCant ? elCant.value : getFieldValue(['item_cantidad', 'cantidad']);
  const cantidad = parseInt(cantidadVal, 10);

  if (isNaN(cantidad) || cantidad <= 0) {
    alert('Ingrese una cantidad válida mayor a cero.');
    return;
  }

  if (tipo === 'articulo') {
    const inputTextoArt = getFieldValue('input_item_articulo');
    const artObj = catalogoArticulosMap[inputTextoArt] || catalogoArticulosMap[getFieldValue('item_articulo')];

    if (!artObj) {
      alert('Seleccione un artículo válido de la lista predictiva.');
      return;
    }

    const codigoArt = artObj.codigo;
    const subtotal = precio * cantidad;

    const indexExistente = itemsDetallePedido.findIndex(i => i.articulo === codigoArt);
    if (indexExistente > -1) {
      itemsDetallePedido[indexExistente].cantidad += cantidad;
      itemsDetallePedido[indexExistente].total = itemsDetallePedido[indexExistente].cantidad * itemsDetallePedido[indexExistente].precio_unit;
    } else {
      itemsDetallePedido.push({
        articulo: codigoArt,
        concepto: null,
        descripcion: artObj.descripcion || codigoArt,
        precio_unit: precio,
        dscto: 0,
        cantidad: cantidad,
        total: subtotal
      });
    }

    // Limpiar inputs de carga
    setFieldValue('input_item_articulo', '');
    setFieldValue('item_articulo', '');
  } else {
    // Modo Concepto de Venta
    const selectConcepto = getModalEl('select_item_concepto');
    const codigoConcepto = selectConcepto?.value;
    const descOption = selectConcepto?.options[selectConcepto.selectedIndex]?.text || '';

    if (!codigoConcepto) {
      alert('Seleccione un concepto de venta de la lista.');
      return;
    }

    if (precio <= 0) {
      alert('Ingrese un precio unitario válido para el concepto.');
      return;
    }

    const subtotal = precio * cantidad;
    const codNum = parseInt(codigoConcepto);

    const indexExistente = itemsDetallePedido.findIndex(i => i.concepto === codNum);
    if (indexExistente > -1) {
      itemsDetallePedido[indexExistente].cantidad += cantidad;
      itemsDetallePedido[indexExistente].precio_unit = precio;
      itemsDetallePedido[indexExistente].total = itemsDetallePedido[indexExistente].cantidad * precio;
    } else {
      itemsDetallePedido.push({
        articulo: null,
        concepto: codNum,
        descripcion: descOption,
        precio_unit: precio,
        dscto: 0,
        cantidad: cantidad,
        total: subtotal
      });
    }

    if (selectConcepto) selectConcepto.value = '';
  }

  setFieldValue('item_precio', '0');
  setFieldValue('item_cantidad', '1');

  renderizarDetallePedido();

  // Reenfocar automáticamente en el buscador para el siguiente artículo
  setTimeout(() => {
    const inputArt = getModalEl('input_item_articulo');
    if (inputArt && tipo === 'articulo') {
      inputArt.focus();
      if (typeof inputArt.select === 'function') inputArt.select();
    }
  }, 50);
}

let timerBusquedaArticuloDinamico = null;

// 🟢 Búsqueda dinámica de artículos para el autocompletado de pedidos
async function buscarArticulosDinamicoPedido(query) {
  const dlArticulos = document.getElementById('dl_articulos');
  if (!dlArticulos) return;

  try {
    const res = await fetch(`/api/articulos?buscar=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      let htmlArt = '';
      data.datos.forEach(a => {
        const texto = `${a.codigo} - ${a.descripcion}`;
        
        catalogoArticulosMap[texto] = a;
        catalogoArticulosMap[a.codigo] = a;

        const precioEntero = Math.round(a.precio_venta || a.precio || 0);
        htmlArt += `<option value="${texto}">$ ${precioEntero}</option>`;
      });

      dlArticulos.innerHTML = htmlArt;
    }
  } catch (error) {
    console.warn('⚠️ Error en la búsqueda dinámica de artículos para pedido:', error);
  }
}

// 1. Cargar Auxiliares (Clientes, Artículos y Conceptos de Venta)
async function cargarAuxiliaresPedidos() {
  try {
    // Clientes
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

    // Artículos
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
        htmlArt += `<option value="${texto}">$ ${a.precio_venta || a.precio || 0}</option>`;
      });
      dlArticulos.innerHTML = htmlArt;
    }

    // Conceptos de Venta
    const resConc = await fetch('/api/pedidos/conceptos-ventas');
    const dataConc = await resConc.json();
    const selectConc = getModalEl('select_item_concepto');

    if (selectConc && dataConc.success && Array.isArray(dataConc.datos)) {
      let htmlConc = '<option value="">-- Seleccionar Concepto --</option>';
      dataConc.datos.forEach(c => {
        htmlConc += `<option value="${c.codigo}">${c.codigo} - ${c.descripcion}</option>`;
      });
      selectConc.innerHTML = htmlConc;
    }
  } catch (error) {
    console.error('❌ Error al cargar auxiliares de pedidos:', error);
  }
}

// 3. Cargar Grilla de Pedidos
async function cargarPedidos(buscar = '') {
  const tbody = document.getElementById('tbodyPedidos');
  if (!tbody) return;

  try {
    const res = await fetch(`/api/pedidos?buscar=${encodeURIComponent(buscar)}`);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      if (data.datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No se encontraron pedidos registrados.</td></tr>';
        return;
      }

      let html = '';
      data.datos.forEach(p => {
        const fechaFmt = p.fecha ? new Date(p.fecha).toLocaleDateString('es-AR') : '-';
        const totalFmt = Number(p.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        let badgeColor = 'bg-warning text-dark';
        if (p.estado === '2') badgeColor = 'bg-success';
        if (p.estado === '4') badgeColor = 'bg-danger';
        if (p.estado === '1') badgeColor = 'bg-info text-dark';

        html += `
          <tr>
            <td class="fw-bold align-middle">#${p.control}</td>
            <td class="align-middle small">${fechaFmt}</td>
            <td class="align-middle fw-semibold">${p.cliente_nombre || 'Cliente #' + p.cliente}</td>
            <td class="align-middle text-center"><span class="badge ${badgeColor}">${p.estado_desc || p.estado}</span></td>
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

// 4. Renderizar Grilla Interna del Modal
function renderizarDetallePedido() {
  const tbody = document.getElementById('tbodyPedidoDetalle');
  const lblTotal = document.getElementById('lblTotalPedido');

  if (!tbody) return;

  if (itemsDetallePedido.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-2">No se han agregado ítems al pedido.</td></tr>';
    if (lblTotal) lblTotal.innerText = '$ 0.00';
    return;
  }

  let totalAcumulado = 0;
  let html = '';

  itemsDetallePedido.forEach((item, index) => {
    totalAcumulado += item.total;
    const precioFmt = Number(item.precio_unit).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const subtotalFmt = Number(item.total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const badgeTipo = item.articulo 
      ? `<span class="badge bg-secondary">${item.articulo}</span>` 
      : `<span class="badge bg-warning text-dark">CONCEPTO #${item.concepto}</span>`;

    html += `
      <tr>
        <td class="align-middle">${badgeTipo}</td>
        <td class="align-middle fw-semibold">${item.descripcion}</td>
        <td class="align-middle text-end fw-bold">${item.cantidad}</td>
        <td class="align-middle text-end">$ ${precioFmt}</td>
        <td class="align-middle text-end fw-bold text-success">$ ${subtotalFmt}</td>
        <td class="text-center align-middle">
          <button type="button" class="btn btn-sm btn-outline-danger py-0 px-1" title="Quitar ítem" onclick="quitarItemADetalle(${index})">🗑️</button>
        </td>
      </tr>`;
  });

  tbody.innerHTML = html;
  if (lblTotal) {
    lblTotal.innerText = `$ ${totalAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

// 5. Abrir Modal Crear
async function abrirModalCrearPedido() {
  modoEdicionPedido = false;
  itemsDetallePedido = [];
  clienteListaPreciosActiva = null;

  const form = document.getElementById('formPedido') || document.querySelector('#modalPedido form');
  if (form) form.reset();

  setFieldValue(['pedido_control', 'control'], 'Auto');
  setFieldValue(['pedido_cliente', 'cliente'], '');
  setFieldValue(['input_pedido_cliente', 'cliente_texto'], '');
  setFieldValue(['pedido_fecha', 'fecha'], new Date().toISOString().split('T')[0]);
  setFieldValue(['pedido_estado', 'estado'], '0');
  setFieldValue(['pedido_obs', 'obs', 'observaciones'], '');

  const alerta = document.getElementById('alertaPedidoModal');
  if (alerta) alerta.innerHTML = '';

  setFieldValue('item_tipo_selector', 'articulo');
  alternarTipoItemPedido();

  renderizarDetallePedido();
  await cargarAuxiliaresPedidos();

  const modalEl = document.getElementById('modalPedido');
  if (modalEl && typeof bootstrap !== 'undefined') {
    const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
    modal.show();
  }
}

// 7. Quitar Ítem
function quitarItemADetalle(index) {
  itemsDetallePedido.splice(index, 1);
  renderizarDetallePedido();
}

// 8. Cargar Pedido para Edición
async function prepararEdicionPedido(control) {
  try {
    modoEdicionPedido = true;
    await cargarAuxiliaresPedidos();

    const res = await fetch(`/api/pedidos/${control}`);
    const data = await res.json();

    if (data.success && data.dato) {
      const p = data.dato;

      setFieldValue(['pedido_control', 'control'], p.control);
      setFieldValue(['pedido_cliente', 'cliente'], p.cliente);
      setFieldValue(['input_pedido_cliente', 'cliente_texto'], `${p.cliente} - ${p.cliente_nombre || ''}`);
      
      await actualizarListaPreciosClienteActivo(p.cliente);
      
      if (p.fecha) {
        const fechaLimpia = p.fecha.includes('T') ? p.fecha.split('T')[0] : p.fecha;
        setFieldValue(['pedido_fecha', 'fecha'], fechaLimpia);
      }

      setFieldValue(['pedido_estado', 'estado'], String(p.estado));
      setFieldValue(['pedido_obs', 'obs', 'observaciones'], p.obs || '');

      itemsDetallePedido = (p.detalles || []).map(d => ({
        articulo: d.articulo || null,
        concepto: d.concepto || null,
        descripcion: d.articulo ? (d.articulo_desc || d.articulo) : (d.concepto_desc || `Concepto #${d.concepto}`),
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

// 9. Guardar Pedido
async function guardarPedido() {
  const alerta = document.getElementById('alertaPedidoModal');
  if (alerta) alerta.innerHTML = '';

  const inputClienteTexto = getFieldValue('input_pedido_cliente');
  const clienteId = clientesMap[inputClienteTexto] || getFieldValue('pedido_cliente');
  const fecha = getFieldValue('pedido_fecha');
  const estado = getFieldValue('pedido_estado');
  const obs = getFieldValue(['pedido_obs', 'obs', 'observaciones']);
  const control = getFieldValue('pedido_control');

  if (!clienteId) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-warning py-1 small">Seleccione un cliente válido de la lista predictiva.</div>';
    return;
  }

  if (itemsDetallePedido.length === 0) {
    if (alerta) alerta.innerHTML = '<div class="alert alert-danger py-1 small">Agregue al menos un ítem (Artículo o Concepto) al pedido.</div>';
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

// 10. Eliminar Pedido
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
  habilitarNavegacionEnterModal();

  const inputBuscar = document.getElementById('inputBuscarPedido');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      clearTimeout(timerBusquedaPedido);
      timerBusquedaPedido = setTimeout(() => {
        cargarPedidos(inputBuscar.value.trim());
      }, 200);
    });
  }

  // 🟢 Listener para detectar cambio en el cliente seleccionado
  const inputCliente = getModalEl('input_pedido_cliente');
  if (inputCliente) {
    inputCliente.addEventListener('change', async () => {
      const texto = inputCliente.value;
      const clienteId = clientesMap[texto];
      if (clienteId) {
        setFieldValue(['pedido_cliente', 'cliente'], clienteId);
        await actualizarListaPreciosClienteActivo(clienteId);
      } else {
        clienteListaPreciosActiva = null;
      }
    });
  }

  // 🟢 Búsqueda dinámica y cotización automática al escribir o seleccionar un artículo
  const inputItemArt = getModalEl('input_item_articulo');
  if (inputItemArt) {

    // A. Búsqueda en tiempo real mientras el usuario escribe
    inputItemArt.addEventListener('input', async () => {
      const texto = inputItemArt.value.trim();

      if (catalogoArticulosMap[texto]) {
        const art = catalogoArticulosMap[texto];
        setFieldValue('item_articulo', art.codigo);
        await cotizarPrecioArticuloPedido(art.codigo);
        return;
      }

      if (texto.length >= 2) {
        clearTimeout(timerBusquedaArticuloDinamico);
        timerBusquedaArticuloDinamico = setTimeout(() => {
          buscarArticulosDinamicoPedido(texto);
        }, 250);
      }
    });

    // B. Confirmación al seleccionar la opción de la lista desplegable
    inputItemArt.addEventListener('change', async () => {
      const texto = inputItemArt.value.trim();
      const art = catalogoArticulosMap[texto];

      if (art) {
        setFieldValue('item_articulo', art.codigo);
        await cotizarPrecioArticuloPedido(art.codigo);
      } else if (texto.includes(' - ')) {
        const codigo = texto.split(' - ')[0];
        setFieldValue('item_articulo', codigo);
        await cotizarPrecioArticuloPedido(codigo);
      }
    });
  }

  // Escuchar cambio de tipo (Artículo / Concepto)
  const selectorTipo = document.getElementById('item_tipo_selector');
  if (selectorTipo) {
    selectorTipo.addEventListener('change', alternarTipoItemPedido);
  }

  document.querySelectorAll('#modalPedido input').forEach(input => {
    input.addEventListener('focus', function () { this.select(); });
  });
});

// Exposiciones globales al final del archivo
window.abrirModalCrearPedido = abrirModalCrearPedido;
window.prepararEdicionPedido = prepararEdicionPedido;
window.guardarPedido = guardarPedido;
window.eliminarPedido = eliminarPedido;
window.agregarItemADetalle = agregarItemADetalle;
window.quitarItemADetalle = quitarItemADetalle;
window.alternarTipoItemPedido = alternarTipoItemPedido;
window.renderizarDetallePedido = renderizarDetallePedido;
window.cargarPedidos = cargarPedidos;
window.cotizarItemPedido = cotizarItemPedido;
window.cotizarPrecioArticuloPedido = cotizarPrecioArticuloPedido;
window.habilitarNavegacionEnterModal = habilitarNavegacionEnterModal;