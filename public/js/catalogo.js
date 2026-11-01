// public/js/catalogo.js - Lógica del Catálogo Visual Agrupado por Familia

let timerBusquedaCatalogo = null;

// 🟢 1. Cargar datos del Catálogo desde la API
async function cargarCatalogoVisual() {
  const grilla = document.getElementById('grillaCatalogo');
  if (!grilla) return;

  const buscar = document.getElementById('buscar_catalogo')?.value.trim() || '';
  const rubro = parseInt(document.getElementById('select_rubro_catalogo')?.value) || 0;
  const listaPrecios = parseInt(document.getElementById('select_lista_precio_catalogo')?.value) || 7;

  const url = `/api/articulos/catalogo?rubro=${rubro}&buscar=${encodeURIComponent(buscar)}&lista_precios=${listaPrecios}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.success && Array.isArray(data.datos)) {
      const familias = agruparPorFamilia(data.datos);
      actualizarContadorCatalogo(data.datos.length, familias.length);
      renderizarTarjetasCatalogo(familias);
    } else {
      actualizarContadorCatalogo(0, 0);
      grilla.innerHTML = `<div class="col-12 text-center text-muted py-5">No se encontraron productos disponibles.</div>`;
    }
  } catch (error) {
    console.error('❌ Error al cargar el catálogo:', error);
    grilla.innerHTML = `<div class="col-12 text-center text-danger py-5">Error de conexión con el servidor.</div>`;
  }
}

// 🟢 2. Agrupar artículos por Prefijo y capturar fotoUrl
function agruparPorFamilia(articulos) {
  const mapaFamilias = {};

  articulos.forEach(art => {
    const prefijo = (art.codigo_prefijo && art.codigo_prefijo.trim() !== '') 
      ? art.codigo_prefijo.trim().toUpperCase() 
      : art.codigo.trim().toUpperCase();

    if (!mapaFamilias[prefijo]) {
      mapaFamilias[prefijo] = {
        prefijoKey: prefijo,
        rubroDesc: art.rubro_desc || 'General',
        descripcionBase: art.descripcion || 'Sin Descripción',
        primerCodigo: art.codigo,
        fotoUrl: art.fotoUrl || '/uploads/articulos/sin-foto.png',
        variantes: []
      };
    }

    // Si alguna variante de la familia tiene una foto asignada real, la priorizamos
    if (art.fotoUrl && !art.fotoUrl.includes('sin-foto.png')) {
      mapaFamilias[prefijo].fotoUrl = art.fotoUrl;
    }

    mapaFamilias[prefijo].variantes.push(art);
  });

  return Object.values(mapaFamilias);
}

// 🟢 3. Renderizar Tarjetas usando fotoUrl validada desde el Backend
function renderizarTarjetasCatalogo(familias) {
  const grilla = document.getElementById('grillaCatalogo');
  if (!grilla) return;

  if (familias.length === 0) {
    grilla.innerHTML = `<div class="col-12 text-center text-muted py-5">No hay productos que coincidan con los filtros seleccionados.</div>`;
    return;
  }

  let html = '';

  familias.forEach(f => {
    // 🟢 Utiliza la URL de la imagen validada previamente en Node.js
    const fotoUrl = f.fotoUrl || (f.variantes[0] && f.variantes[0].fotoUrl) || '/uploads/articulos/sin-foto.png';

    let filasVariantes = '';
    f.variantes.forEach(v => {
      const codigoCompleto = (v.codigo || '').trim().toUpperCase();
      const precioFmt = Number(v.precio_venta || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });

      filasVariantes += `
        <tr>
          <td class="small fw-bold text-secondary py-1">${codigoCompleto}</td>
          <td class="small fw-bold text-success text-end py-1">$ ${precioFmt}</td>
        </tr>`;
    });

    html += `
      <div class="col">
        <div class="card h-100 border-0 shadow-sm">
          
          <!-- Contenedor de la Imagen Validada -->
          <div class="text-center bg-white p-3 border-bottom position-relative" style="height: 180px; display: flex; align-items: center; justify-content: center;">
            <span class="position-absolute top-0 start-0 m-2 badge bg-dark opacity-75">${f.rubroDesc}</span>
            <img src="${fotoUrl}" 
                 class="img-fluid rounded" 
                 alt="${f.prefijoKey}"
                 style="max-height: 150px; object-fit: contain;"
                 onerror="this.onerror=null; this.src='/uploads/articulos/sin-foto.png';">
          </div>

          <!-- Cuerpo de la Tarjeta -->
          <div class="card-body p-2 d-flex flex-column">
            <h6 class="fw-bold mb-1 text-dark">${f.descripcionBase}</h6>
            <p class="text-muted extra-small mb-2">${f.variantes.length} variante(s)</p>

            <div class="table-responsive border rounded bg-light mt-auto">
              <table class="table table-sm table-borderless align-middle mb-0">
                <thead class="table-secondary text-uppercase extra-small border-bottom">
                  <tr>
                    <th>Código</th>
                    <th class="text-end">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  ${filasVariantes}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>`;
  });

  grilla.innerHTML = html;
}

// 🟢 4. Cargar Desplegable de Rubros (Excluyendo Rubro 0)
async function cargarSelectRubrosCatalogo() {
  const select = document.getElementById('select_rubro_catalogo');
  if (!select) return;

  try {
    const res = await fetch('/api/rubros');
    const data = await res.json();
    const lista = data.data || data.datos || (Array.isArray(data) ? data : []);

    let options = '<option value="0">🎨 Todos los Rubros</option>';
    lista.forEach(r => {
      if (parseInt(r.codigo) === 0) return; // Filtra rubro 0
      options += `<option value="${r.codigo}">${r.descripcion}</option>`;
    });

    select.innerHTML = options;
  } catch (err) {
    console.warn('⚠️ Error al cargar select de rubros:', err);
  }
}

// 🟢 5. Cargar Desplegable de Listas de Precios
async function cargarSelectListasPreciosCatalogo() {
  const select = document.getElementById('select_lista_precio_catalogo');
  if (!select) return;

  try {
    const res = await fetch('/api/clientes/listas-cabecera');
    const data = await res.json();
    const listas = data.datos || data.data || [];

    let options = '';
    listas.forEach(l => {
      const selected = (l.orden === 7) ? 'selected' : '';
      options += `<option value="${l.orden}" ${selected}>🏷️ Lista: ${l.descripcion}</option>`;
    });

    select.innerHTML = options || '<option value="7">🏷️ Lista: Minorista</option>';
  } catch (err) {
    console.warn('⚠️ Error al cargar listas de precios:', err);
  }
}

// 🟢 6. Actualizar Contador de Productos
function actualizarContadorCatalogo(totalItems, totalFamilias) {
  const badge = document.getElementById('cant-items-catalogo');
  if (badge) {
    badge.textContent = `${totalItems} Productos (${totalFamilias} Familias)`;
  }
}

// 🟢 7. Funciones Auxiliares de Filtrado
function filtrarCatalogo() {
  cargarCatalogoVisual();
}

function limpiarFiltrosCatalogo() {
  const inputBuscar = document.getElementById('buscar_catalogo');
  const selectRubro = document.getElementById('select_rubro_catalogo');
  const selectLista = document.getElementById('select_lista_precio_catalogo');

  if (inputBuscar) inputBuscar.value = '';
  if (selectRubro) selectRubro.value = '0';
  if (selectLista) selectLista.value = '7';

  cargarCatalogoVisual();
}

// 🟢 8. Inicialización
document.addEventListener('DOMContentLoaded', () => {
  cargarSelectRubrosCatalogo();
  cargarSelectListasPreciosCatalogo();

  const inputBuscar = document.getElementById('buscar_catalogo');
  if (inputBuscar) {
    inputBuscar.addEventListener('input', () => {
      clearTimeout(timerBusquedaCatalogo);
      timerBusquedaCatalogo = setTimeout(() => {
        cargarCatalogoVisual();
      }, 250);
    });
  }
});

// Exposición global
window.cargarCatalogoVisual = cargarCatalogoVisual;
window.filtrarCatalogo = filtrarCatalogo;
window.limpiarFiltrosCatalogo = limpiarFiltrosCatalogo;