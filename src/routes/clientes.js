// src/routes/clientes.js - API para Gestión de Clientes UniArte
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Helper para desempaquetar filas de MySQL
const extraerFilaUnica = (rows) => {
  let r = rows;
  while (Array.isArray(r) && r.length > 0) {
    r = r;
  }
  return r;
};

// 1. GET /api/clientes/listas-cabecera
router.get('/listas-cabecera', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT orden, descripcion FROM listas_precios_cabecera ORDER BY orden ASC');
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('❌ Error al obtener listas de precios:', error);
    res.status(500).json({ success: false, mensaje: 'Error al obtener listas de precios.' });
  }
});

// 2. GET /api/clientes/situacionesiva
router.get('/situacionesiva', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT codigo, descripcion FROM situacionesiva ORDER BY descripcion ASC');
    res.json({ success: true, datos: rows });
  } catch (error) {
    res.json({ success: false, datos: [] });
  }
});

// 3. GET /api/clientes/condicionesventa
router.get('/condicionesventa', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT codigo, descripcion FROM condiciones_venta ORDER BY descripcion ASC');
    res.json({ success: true, datos: rows });
  } catch (error) {
    res.json({ success: false, datos: [] });
  }
});

// 4. GET /api/clientes
router.get('/', async (req, res) => {
  try {
    const { buscar } = req.query;
    let sql = `
      SELECT c.codigo, c.nombre, c.nombre_fantasia, c.cuit, c.situacioniva, c.condicion_venta, 
             c.telefono, c.celular, c.contacto, c.mail, c.web, c.direccion, c.cod_postal, c.obs,
             clp.lista_precios, lpc.descripcion AS lista_nombre,
             siva.descripcion AS situacioniva_desc
      FROM clientes c
      LEFT JOIN clientes_listas_precios clp ON clp.cliente = c.codigo
      LEFT JOIN listas_precios_cabecera lpc ON lpc.orden = clp.lista_precios
      LEFT JOIN situacionesiva siva ON siva.codigo = c.situacioniva
    `;
    let params = [];

    if (buscar && buscar.trim() !== '') {
      sql += ` WHERE c.codigo LIKE ? OR c.nombre LIKE ? OR c.cuit LIKE ? OR c.nombre_fantasia LIKE ?`;
      const term = `%${buscar.trim()}%`;
      params.push(term, term, term, term);
    }

    sql += ` ORDER BY c.nombre ASC`;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('❌ Error al consultar clientes:', error);
    res.status(500).json({ success: false, mensaje: 'Error al obtener la lista de clientes.' });
  }
});

// 5. GET /api/clientes/:codigo
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    console.log("📥 Servidor recibió petición para el cliente:", codigo);
    
    const sql = `
      SELECT c.*, clp.lista_precios 
      FROM clientes c 
      LEFT JOIN clientes_listas_precios clp ON clp.cliente = c.codigo 
      WHERE c.codigo = ?
    `;
    const [rows] = await db.query(sql, [codigo]);
    console.log("✅ Consulta SQL ejecutada con éxito. Registros encontrados:", rows ? rows.length : 0);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Cliente no encontrado.' });
    }

    // Extracción directa y segura sin usar extraerFilaUnica para evitar bloqueos
    const clienteObj = Array.isArray(rows[0]) ? rows[0] : rows[0];

    console.log("📤 Enviando respuesta JSON al cliente con éxito.");
    return res.json({ success: true, dato: clienteObj });

  } catch (error) {
    console.error('❌ Error crítico al consultar cliente:', error);
    return res.status(500).json({ success: false, mensaje: 'Error al obtener datos del cliente.' });
  }
});
// 6. POST /api/clientes
router.post('/', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { codigo, nombre, nombre_fantasia, cuit, situacioniva, condicion_venta, telefono, celular, contacto, mail, web, direccion, cod_postal, obs, lista_precios } = req.body;

    const sqlCliente = `
      INSERT INTO clientes (codigo, nombre, nombre_fantasia, cuit, situacioniva, condicion_venta, telefono, celular, contacto, mail, web, direccion, cod_postal, obs)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await connection.query(sqlCliente, [
      codigo, nombre, nombre_fantasia || '', cuit || '', situacioniva || null, condicion_venta || null,
      telefono || '', celular || '', contacto || '', mail || '', web || '', direccion || '', cod_postal || '', obs || ''
    ]);

    if (lista_precios && parseInt(lista_precios) > 0) {
      await connection.query(
        'INSERT INTO clientes_listas_precios (cliente, lista_precios, prioridad) VALUES (?, ?, 1)',
        [codigo, parseInt(lista_precios)]
      );
    }

    await connection.commit();
    res.json({ success: true, mensaje: 'Cliente registrado correctamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al crear cliente:', error);
    res.status(500).json({ success: false, mensaje: 'Error al guardar el cliente.' });
  } finally {
    connection.release();
  }
});

// 7. PUT /api/clientes/:codigo
router.put('/:codigo', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { codigo } = req.params;
    const { nombre, nombre_fantasia, cuit, situacioniva, condicion_venta, telefono, celular, contacto, mail, web, direccion, cod_postal, obs, lista_precios } = req.body;

    const sqlCliente = `
      UPDATE clientes 
      SET nombre = ?, nombre_fantasia = ?, cuit = ?, situacioniva = ?, condicion_venta = ?, 
          telefono = ?, celular = ?, contacto = ?, mail = ?, web = ?, direccion = ?, cod_postal = ?, obs = ?
      WHERE codigo = ?
    `;
    await connection.query(sqlCliente, [
      nombre, nombre_fantasia || '', cuit || '', situacioniva || null, condicion_venta || null,
      telefono || '', celular || '', contacto || '', mail || '', web || '', direccion || '', cod_postal || '', obs || '',
      codigo
    ]);

    await connection.query('DELETE FROM clientes_listas_precios WHERE cliente = ?', [codigo]);

    if (lista_precios && parseInt(lista_precios) > 0) {
      await connection.query(
        'INSERT INTO clientes_listas_precios (cliente, lista_precios, prioridad) VALUES (?, ?, 1)',
        [codigo, parseInt(lista_precios)]
      );
    }

    await connection.commit();
    res.json({ success: true, mensaje: 'Cliente actualizado correctamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al actualizar cliente:', error);
    res.status(500).json({ success: false, mensaje: 'Error al actualizar el cliente.' });
  } finally {
    connection.release();
  }
});

// 8. DELETE /api/clientes/:codigo
router.delete('/:codigo', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    const { codigo } = req.params;

    await connection.query('DELETE FROM clientes_listas_precios WHERE cliente = ?', [codigo]);
    const [result] = await connection.query('DELETE FROM clientes WHERE codigo = ?', [codigo]);

    if (result.affectedRows === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, mensaje: 'Cliente no encontrado.' });
    }

    await connection.commit();
    res.json({ success: true, mensaje: 'Cliente eliminado correctamente.' });
  } catch (error) {
    await connection.rollback();
    console.error('❌ Error al eliminar cliente:', error);
    res.status(500).json({ success: false, mensaje: 'Error al eliminar el cliente.' });
  } finally {
    connection.release();
  }
});

module.exports = router;