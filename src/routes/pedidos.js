// src/routes/pedidos.js - API para Gestión de Pedidos UniArte
const express = require('express');
const router = express.Router();
const db = require('../config/db');

const mapearEstado = (num) => {
  const estados = {
    '0': 'Pendiente',
    '1': 'En proceso',
    '2': 'Facturado',
    '3': 'Presupuestado',
    '4': 'Cancelado'
  };
  return estados[String(num)] || 'Pendiente';
};

// 1. GET /api/pedidos/conceptos-ventas - Catálogo de Conceptos de Venta
router.get('/conceptos-ventas', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT codigo, descripcion FROM conceptos_ventas ORDER BY descripcion ASC');
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('❌ Error al obtener conceptos de venta:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar conceptos de venta.' });
  }
});

// 2. GET /api/pedidos/precio-unitario - Cotización según la lista del cliente
router.get('/precio-unitario', async (req, res) => {
  try {
    const { cliente, articulo } = req.query;

    if (!cliente || !articulo) {
      return res.status(400).json({ success: false, mensaje: 'Cliente y Artículo son requeridos.' });
    }

    const sql = `
      SELECT 
        COALESCE(lp.precio, a.precio_venta, 0) AS precio_unitario,
        lpc.descripcion AS lista_nombre
      FROM articulos a
      LEFT JOIN clientes_listas_precios clp ON clp.cliente = ?
      LEFT JOIN listas_precios lp ON lp.articulo = a.codigo AND lp.lista_precios = clp.lista_precios
      LEFT JOIN listas_precios_cabecera lpc ON lpc.orden = clp.lista_precios
      WHERE a.codigo = ?
      ORDER BY clp.prioridad ASC
      LIMIT 1
    `;

    const [rows] = await db.query(sql, [cliente, articulo]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado.' });
    }

    res.json({
      success: true,
      precio: parseFloat(rows[0].precio_unitario) || 0,
      lista: rows[0].lista_nombre || 'Precio de Referencia'
    });
  } catch (error) {
    console.error('❌ Error al obtener precio unitario:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar la lista de precios.' });
  }
});

// 3. GET /api/pedidos - Listar pedidos
router.get('/', async (req, res) => {
  try {
    const { buscar } = req.query;
    let sql = `
      SELECT p.control, p.punto_venta, p.cliente, p.fecha, p.fecha_entrega, p.total, p.obs, p.estado,
             c.nombre AS cliente_nombre
      FROM pedidos p
      LEFT JOIN clientes c ON p.cliente = c.codigo
    `;
    let params = [];

    if (buscar && buscar.trim() !== '') {
      sql += ` WHERE p.control LIKE ? OR c.nombre LIKE ? OR p.obs LIKE ?`;
      const term = `%${buscar.trim()}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY p.control DESC LIMIT 100`;

    const [rows] = await db.query(sql, params);

    const datosFormateados = rows.map(p => ({
      ...p,
      estado_desc: mapearEstado(p.estado)
    }));

    res.json({ success: true, datos: datosFormateados });
  } catch (error) {
    console.error('❌ Error al consultar pedidos:', error);
    res.status(500).json({ success: false, mensaje: 'Error al obtener la lista de pedidos.' });
  }
});

// 4. GET /api/pedidos/:control - Obtener detalle (Artículos o Conceptos)
router.get('/:control', async (req, res) => {
  try {
    const { control } = req.params;

    const [cabeceraRows] = await db.query(
      `SELECT p.*, c.nombre AS cliente_nombre 
       FROM pedidos p 
       LEFT JOIN clientes c ON p.cliente = c.codigo 
       WHERE p.control = ?`,
      [control]
    );

    if (cabeceraRows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Pedido no encontrado.' });
    }

    const [detalleRows] = await db.query(
      `SELECT pd.*, 
              a.descripcion AS articulo_desc,
              cv.descripcion AS concepto_desc
       FROM pedidos_deta pd 
       LEFT JOIN articulos a ON pd.articulo = a.codigo 
       LEFT JOIN conceptos_ventas cv ON pd.concepto = cv.codigo 
       WHERE pd.control = ?`,
      [control]
    );

    res.json({
      success: true,
      dato: {
        ...cabeceraRows[0],
        detalles: detalleRows
      }
    });
  } catch (error) {
    console.error('❌ Error al obtener pedido:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar el detalle del pedido.' });
  }
});

// 5. POST /api/pedidos - Crear pedido
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { cliente, fecha, fecha_entrega, total, obs, estado, detalles } = req.body;

    if (!cliente || parseInt(cliente) <= 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, mensaje: 'Debe seleccionar un cliente válido.' });
    }

    if (!Array.isArray(detalles) || detalles.length === 0) {
      await connection.rollback();
      return res.status(400).json({ success: false, mensaje: 'El pedido debe incluir al menos un ítem.' });
    }

    const [maxControlRows] = await connection.query('SELECT COALESCE(MAX(control), 0) + 1 AS proximoControl FROM pedidos');
    const proximoControl = maxControlRows[0].proximoControl;

    const [pvRows] = await connection.query('SELECT orden FROM puntos_venta ORDER BY orden ASC LIMIT 1');
    const puntoVentaId = pvRows.length > 0 ? pvRows[0].orden : 1;

    const fechaHoy = new Date().toISOString().split('T')[0];
    const fechaFinal = fecha && fecha.trim() !== '' ? fecha : fechaHoy;
    const fechaEntregaFinal = fecha_entrega && fecha_entrega.trim() !== '' ? fecha_entrega : null;

    const sqlCabecera = `
      INSERT INTO pedidos (control, punto_venta, cliente, fecha, fecha_entrega, total, obs, estado) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await connection.query(sqlCabecera, [
      proximoControl,
      puntoVentaId,
      parseInt(cliente),
      fechaFinal,
      fechaEntregaFinal,
      parseFloat(total) || 0,
      (obs || '').toUpperCase(),
      String(estado || '0')
    ]);

    const sqlDetalle = `
      INSERT INTO pedidos_deta (control, articulo, concepto, precio_unit, dscto, cantidad, total) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    for (const item of detalles) {
      await connection.query(sqlDetalle, [
        proximoControl,
        item.articulo && item.articulo !== '' ? item.articulo : null,
        item.concepto && parseInt(item.concepto) > 0 ? parseInt(item.concepto) : null,
        parseFloat(item.precio_unit) || 0,
        parseFloat(item.dscto) || 0,
        parseInt(item.cantidad) || 1,
        parseFloat(item.total) || 0
      ]);
    }

    await connection.commit();
    res.json({ success: true, mensaje: `Pedido #${proximoControl} guardado con éxito.`, control: proximoControl });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al guardar pedido:', error);
    res.status(500).json({ success: false, mensaje: 'Error al registrar el pedido en la base de datos.' });
  } finally {
    connection.release();
  }
});

// 6. PUT /api/pedidos/:control - Actualizar pedido
router.put('/:control', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { control } = req.params;
    const { cliente, fecha, fecha_entrega, total, obs, estado, detalles } = req.body;

    const fechaHoy = new Date().toISOString().split('T')[0];
    const fechaFinal = fecha && fecha.trim() !== '' ? fecha : fechaHoy;
    const fechaEntregaFinal = fecha_entrega && fecha_entrega.trim() !== '' ? fecha_entrega : null;

    const sqlCabecera = `
      UPDATE pedidos 
      SET cliente = ?, fecha = ?, fecha_entrega = ?, total = ?, obs = ?, estado = ? 
      WHERE control = ?
    `;
    await connection.query(sqlCabecera, [
      parseInt(cliente),
      fechaFinal,
      fechaEntregaFinal,
      parseFloat(total) || 0,
      (obs || '').toUpperCase(),
      String(estado || '0'),
      control
    ]);

    await connection.query('DELETE FROM pedidos_deta WHERE control = ?', [control]);

    if (Array.isArray(detalles)) {
      const sqlDetalle = `
        INSERT INTO pedidos_deta (control, articulo, concepto, precio_unit, dscto, cantidad, total) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      for (const item of detalles) {
        await connection.query(sqlDetalle, [
          control,
          item.articulo && item.articulo !== '' ? item.articulo : null,
          item.concepto && parseInt(item.concepto) > 0 ? parseInt(item.concepto) : null,
          parseFloat(item.precio_unit) || 0,
          parseFloat(item.dscto) || 0,
          parseInt(item.cantidad) || 1,
          parseFloat(item.total) || 0
        ]);
      }
    }

    await connection.commit();
    res.json({ success: true, mensaje: `Pedido #${control} actualizado con éxito.` });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al actualizar pedido:', error);
    res.status(500).json({ success: false, mensaje: 'Error al modificar el pedido.' });
  } finally {
    connection.release();
  }
});

// 7. DELETE /api/pedidos/:control - Eliminar pedido
router.delete('/:control', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { control } = req.params;

    await connection.query('DELETE FROM pedidos_deta WHERE control = ?', [control]);
    const [result] = await connection.query('DELETE FROM pedidos WHERE control = ?', [control]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, mensaje: 'Pedido no encontrado.' });
    }

    await connection.commit();
    res.json({ success: true, mensaje: `Pedido #${control} eliminado correctamente.` });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al eliminar pedido:', error);
    res.status(500).json({ success: false, mensaje: 'Error al eliminar el pedido.' });
  } finally {
    connection.release();
  }
});

// GET /api/pedidos/:control/pdf - Generar comprobante imprimible de pedido
router.get('/:control/pdf', async (req, res) => {
  try {
    const { control } = req.params;

    // 1. Consultar encabezado del pedido y datos del cliente
    const [rows] = await db.query(`
      SELECT p.*, c.nombre AS cliente_nombre 
      FROM pedidos p 
      LEFT JOIN clientes c ON c.codigo = p.cliente 
      WHERE p.control = ?
    `, [control]);

    if (!rows || rows.length === 0) {
      return res.status(404).send('Pedido no encontrado');
    }

    // 🟢 CORRECCIÓN CLAVE: Extraer el objeto del primer resultado con [0]
    const pedido = rows[0]; 

    // 2. Consultar detalle de artículos/conceptos desde 'pedidos_deta'
    const [detalles] = await db.query(`
      SELECT pd.*, a.descripcion AS articulo_desc, cv.descripcion AS concepto_desc
      FROM pedidos_deta pd
      LEFT JOIN articulos a ON a.codigo = pd.articulo
      LEFT JOIN conceptos_ventas cv ON cv.codigo = pd.concepto
      WHERE pd.control = ?
    `, [control]);

    // 3. Formato seguro de Fecha
    let fechaFmt = '-';
    if (pedido.fecha) {
      const fechaObj = new Date(pedido.fecha);
      if (!isNaN(fechaObj.getTime())) {
        fechaFmt = fechaObj.toLocaleDateString('es-AR');
      } else {
        const fechaStr = String(pedido.fecha).split('T')[0];
        const partes = fechaStr.split('-');
        if (partes.length === 3) {
          fechaFmt = `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
      }
    }

    const totalFmt = Number(pedido.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // 4. Armar filas de la tabla de ítems
    let filasHtml = '';
    detalles.forEach(d => {
      const codigo = d.articulo || (d.concepto ? `CONCEPTO #${d.concepto}` : '-');
      const desc = d.articulo ? (d.articulo_desc || d.articulo) : (d.concepto_desc || `Concepto #${d.concepto}`);
      const precioFmt = Number(d.precio_unit || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const subtotalFmt = Number(d.total || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      filasHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${codigo}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">${desc}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold;">${d.cantidad}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">$ ${precioFmt}</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right; font-weight: bold;">$ ${subtotalFmt}</td>
        </tr>`;
    });

    // 5. Plantilla HTML imprimible
    const html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Pedido #${pedido.control} - UniArte</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0d6efd; padding-bottom: 10px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: bold; color: #0d6efd; }
          .info-box { background: #f8f9fa; padding: 12px; border-radius: 5px; margin-bottom: 20px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #0d6efd; color: white; padding: 10px; text-align: left; font-size: 14px; }
          .total-box { text-align: right; font-size: 18px; font-weight: bold; margin-top: 15px; color: #198754; }
          .obs-box { margin-top: 25px; padding: 10px; border: 1px dashed #ccc; background: #fffbe6; border-radius: 5px; }
          @media print {
            .btn-imprimir { display: none; }
          }
        </style>
      </head>
      <body>

        <div style="text-align: right; margin-bottom: 10px;">
          <button class="btn-imprimir" onclick="window.print()" style="padding: 8px 16px; background: #0d6efd; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">🖨️ Imprimir / Guardar PDF</button>
        </div>

        <div class="header">
          <div>
            <div class="title">🎨 UniArte</div>
            <small>Comprobante de Orden de Pedido</small>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; color: #333;">PEDIDO #${pedido.control}</h2>
            <small>Fecha: ${fechaFmt}</small>
          </div>
        </div>

        <div class="info-box">
          <div>
            <strong>Cliente:</strong> ${pedido.cliente_nombre || 'Cliente #' + pedido.cliente}<br>
            <strong>Código Cliente:</strong> #${pedido.cliente}
          </div>
          <div>
            <strong>Estado:</strong> ${pedido.estado === '2' ? 'FINALIZADO' : (pedido.estado === '4' ? 'CANCELADO' : 'PENDIENTE')}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>CÓDIGO</th>
              <th>DESCRIPCIÓN</th>
              <th style="text-align: center;">CANT.</th>
              <th style="text-align: right;">PRECIO UNIT.</th>
              <th style="text-align: right;">SUBTOTAL</th>
            </tr>
          </thead>
          <tbody>
            ${filasHtml}
          </tbody>
        </table>

        <div class="total-box">
          TOTAL PEDIDO: $ ${totalFmt}
        </div>

        ${pedido.obs ? `
          <div class="obs-box">
            <strong>Observaciones de Trabajo:</strong><br>
            ${pedido.obs}
          </div>
        ` : ''}
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('❌ Error al generar PDF de pedido:', error);
    res.status(500).send('Error interno al generar el comprobante.');
  }
});

module.exports = router;