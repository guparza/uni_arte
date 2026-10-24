// src/routes/pedidos.js - API para Gestión de Pedidos UniArte
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Helper para convertir el número de estado a texto descriptivo
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

// 1. GET /api/pedidos/precio-unitario - Consultar precio según lista asignada al cliente
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

    if (rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Artículo no encontrado.' });
    }

    res.json({
      success: true,
      precio: parseFloat(rows[0].precio_unitario) || 0,
      lista: rows[0].lista_nombre || 'Precio Base'
    });
  } catch (error) {
    console.error('❌ Error al obtener precio unitario:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar la lista de precios.' });
  }
});

// 2. GET /api/pedidos - Listar pedidos con búsqueda
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

// 3. GET /api/pedidos/:control - Obtener detalle de un pedido
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
      `SELECT pd.*, a.descripcion AS articulo_desc 
       FROM pedidos_deta pd 
       LEFT JOIN articulos a ON pd.articulo = a.codigo 
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

// 4. POST /api/pedidos - Crear nuevo pedido
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
      return res.status(400).json({ success: false, mensaje: 'El pedido debe incluir al menos un artículo.' });
    }

    // Obtener próximo número de control correlativo
    const [maxControlRows] = await connection.query('SELECT COALESCE(MAX(control), 0) + 1 AS proximoControl FROM pedidos');
    const proximoControl = maxControlRows[0].proximoControl;

    // Obtener un punto de venta válido
    const [pvRows] = await connection.query('SELECT orden FROM puntos_venta ORDER BY orden ASC LIMIT 1');
    const puntoVentaId = pvRows.length > 0 ? pvRows[0].orden : 1;

    // Formatear fechas correctamente (YYYY-MM-DD)
    const fechaHoy = new Date().toISOString().split('T')[0];
    const fechaFinal = fecha && fecha.trim() !== '' ? fecha : fechaHoy;
    const fechaEntregaFinal = fecha_entrega && fecha_entrega.trim() !== '' ? fecha_entrega : null;

    // Insertar Cabecera en pedidos
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

    // Insertar Renglones en pedidos_deta
    const sqlDetalle = `
      INSERT INTO pedidos_deta (control, articulo, precio_unit, dscto, cantidad, total) 
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    for (const item of detalles) {
      await connection.query(sqlDetalle, [
        proximoControl,
        item.articulo,
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

// 5. PUT /api/pedidos/:control - Actualizar pedido existente
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
        INSERT INTO pedidos_deta (control, articulo, precio_unit, dscto, cantidad, total) 
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      for (const item of detalles) {
        await connection.query(sqlDetalle, [
          control,
          item.articulo,
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

// 6. DELETE /api/pedidos/:control - Eliminar pedido
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

module.exports = router;