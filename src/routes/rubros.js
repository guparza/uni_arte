// src/routes/rubros.js (BACKEND)
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// 1. Obtener todos los rubros ordenados por código numérico
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM articulos_rubros ORDER BY CAST(codigo AS UNSIGNED) ASC');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error al obtener rubros:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar la base de datos.' });
  }
});

// 2. Obtener un rubro específico por código
router.get('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const [rows] = await db.query('SELECT * FROM articulos_rubros WHERE codigo = ?', [codigo]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, mensaje: 'Rubro no encontrado.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error al buscar rubro:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor.' });
  }
});

// 3. Crear un nuevo rubro con código manual
router.post('/', async (req, res) => {
  try {
    const { codigo, descripcion } = req.body;
    const codigoNum = parseInt(codigo);
    const descLimpia = (descripcion || '').trim().toUpperCase();

    if (isNaN(codigoNum) || codigoNum < 0) {
      return res.status(400).json({ success: false, mensaje: 'Debes ingresar un código numérico válido.' });
    }
    if (!descLimpia) {
      return res.status(400).json({ success: false, mensaje: 'La descripción del rubro es obligatoria.' });
    }

    const sql = `
      INSERT INTO articulos_rubros (codigo, descripcion, imprimir_lista_precios, llevar_stock) 
      VALUES (?, ?, 'S', 'S')
    `;
    await db.query(sql, [codigoNum, descLimpia]);

    res.json({ success: true, mensaje: 'Rubro creado exitosamente.' });
  } catch (error) {
    console.error('Error al guardar rubro:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, mensaje: `El código de rubro ${req.body.codigo} ya existe.` });
    }
    res.status(500).json({ success: false, mensaje: 'Error al insertar el rubro en la base de datos.' });
  }
});

// 4. Actualizar un rubro existente
router.put('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const descLimpia = (req.body.descripcion || '').trim().toUpperCase();

    if (!descLimpia) {
      return res.status(400).json({ success: false, mensaje: 'La descripción es obligatoria.' });
    }

    const sql = `UPDATE articulos_rubros SET descripcion = ? WHERE codigo = ?`;
    const [result] = await db.query(sql, [descLimpia, codigo]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: 'Rubro no encontrado.' });
    }

    res.json({ success: true, mensaje: 'Rubro actualizado exitosamente.' });
  } catch (error) {
    console.error('Error al actualizar rubro:', error);
    res.status(500).json({ success: false, mensaje: 'Error interno del servidor.' });
  }
});

// 5. Eliminar un rubro
router.delete('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const [result] = await db.query('DELETE FROM articulos_rubros WHERE codigo = ?', [codigo]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: 'El rubro no existe o ya fue eliminado.' });
    }

    res.json({ success: true, mensaje: 'Rubro eliminado exitosamente.' });
  } catch (error) {
    console.error('Error al eliminar rubro:', error);
    if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
      return res.status(400).json({ 
        success: false, 
        mensaje: 'No se puede eliminar este rubro porque hay artículos asociados a él.' 
      });
    }
    res.status(500).json({ success: false, mensaje: 'Error interno en el servidor.' });
  }
});

module.exports = router;