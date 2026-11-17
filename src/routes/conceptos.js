const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/conceptos-ventas - Listar todos los conceptos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT codigo, descripcion FROM conceptos_ventas ORDER BY codigo ASC');
    res.json({ success: true, datos: rows });
  } catch (error) {
    console.error('❌ Error al consultar conceptos:', error);
    res.status(500).json({ success: false, mensaje: 'Error al consultar conceptos de venta.' });
  }
});

// POST /api/conceptos-ventas - Crear nuevo concepto
router.post('/', async (req, res) => {
  try {
    const { codigo, descripcion } = req.body;
    const codNum = parseInt(codigo);
    const descText = (descripcion || '').trim().toUpperCase();

    if (isNaN(codNum) || codNum <= 0 || !descText) {
      return res.status(400).json({ success: false, mensaje: 'El código debe ser numérico mayor a cero y la descripción es obligatoria.' });
    }

    await db.query('INSERT INTO conceptos_ventas (codigo, descripcion) VALUES (?, ?)', [codNum, descText]);
    res.json({ success: true, mensaje: 'Concepto creado exitosamente.' });
  } catch (error) {
    console.error('❌ Error al guardar concepto:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, mensaje: 'El código de concepto ya existe.' });
    }
    res.status(500).json({ success: false, mensaje: 'Error al guardar el concepto.' });
  }
});

// PUT /api/conceptos-ventas/:codigo - Modificar la descripción sin perder el código
router.put('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;
    const descText = (req.body.descripcion || '').trim().toUpperCase();

    if (!descText) {
      return res.status(400).json({ success: false, mensaje: 'La descripción es obligatoria.' });
    }

    const [result] = await db.query('UPDATE conceptos_ventas SET descripcion = ? WHERE codigo = ?', [descText, codigo]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, mensaje: 'Concepto no encontrado.' });
    }

    res.json({ success: true, mensaje: 'Concepto actualizado correctamente.' });
  } catch (error) {
    console.error('❌ Error al actualizar concepto:', error);
    res.status(500).json({ success: false, mensaje: 'Error en la base de datos.' });
  }
});

// DELETE /api/conceptos-ventas/:codigo - Eliminar concepto con protección de pedidos
router.delete('/:codigo', async (req, res) => {
  try {
    const { codigo } = req.params;

    const [uso] = await db.query('SELECT COUNT(*) AS cant FROM pedidos_deta WHERE concepto = ?', [codigo]);
    if (uso[0].cant > 0) {
      return res.status(400).json({ 
        success: false, 
        mensaje: `No se puede eliminar el concepto #${codigo} porque se utiliza en ${uso[0].cant} pedido(s).` 
      });
    }

    await db.query('DELETE FROM conceptos_ventas WHERE codigo = ?', [codigo]);
    res.json({ success: true, mensaje: 'Concepto eliminado correctamente.' });
  } catch (error) {
    console.error('❌ Error al eliminar concepto:', error);
    res.status(500).json({ success: false, mensaje: 'Error al eliminar el concepto.' });
  }
});

module.exports = router;