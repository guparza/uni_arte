// server.js - Servidor Principal UniArte
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
require('dotenv').config();

const db = require('./src/config/db');
const app = express();
const PORT = process.env.PORT || 3000;

// 1. Middlewares para lectura de JSON y formularios
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 2. Archivos Estáticos (DEBE IR ANTES DE LAS RUTAS API)
app.use(express.static(path.join(__dirname, 'public')));

// Crear carpeta física de uploads si no existe
const dirUploads = path.join(__dirname, 'public', 'uploads', 'articulos');
if (!fs.existsSync(dirUploads)) {
  fs.mkdirSync(dirUploads, { recursive: true });
}

// Servir la carpeta de imágenes públicamente con caché de 1 día
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads'), { maxAge: '1d' }));

// Configurar Multer para guardar la foto siempre como CODIGO.png
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dirUploads),
  filename: (req, file, cb) => {
    const codigo = (req.body.codigo || 'temp').toUpperCase().trim();
    cb(null, `${codigo}.png`); // 👈 Estandarizado a .png
  }
});
const upload = multer({ storage });

// 3. Montar Rutas API
const articulosRoutes = require('./src/routes/articulos');
const rubrosRoutes = require('./src/routes/rubros');
const clientesRoutes = require('./src/routes/clientes');
const pedidosRoutes = require('./src/routes/pedidos');

app.use('/api/articulos', articulosRoutes);
app.use('/api/rubros', rubrosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/pedidos', pedidosRoutes);

// Endpoint de subida física de fotografía de producto
app.post('/api/articulos/upload', upload.single('imagen'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, mensaje: 'No se recibió ninguna imagen.' });
  }
  res.json({ success: true, mensaje: 'Imagen guardada correctamente.' });
});

// 4. Iniciar Servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor UniArte ejecutándose en http://localhost:${PORT}`);
});
