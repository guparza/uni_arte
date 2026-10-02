const express = require('express');
const path = require('path');
const app = express();

// 1. Middlewares de lectura (JSON y formularios)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Archivos Estáticos (ACÁ VA LA SENTENCIA) ----------------------
app.use(express.static('public')); 

// ⚡ Servir la carpeta de imágenes subidas con caché de 1 día
app.use('/uploads', express.static('uploads', { maxAge: '1d' }));
// ------------------------------------------------------------------

// 3. Importar y montar las Rutas API (DEBAJO de los archivos estáticos)
const articulosRoutes = require('./src/routes/articulos');
const rubrosRoutes = require('./src/routes/rubros');

app.use('/api/articulos', articulosRoutes);
app.use('/api/rubros', rubrosRoutes);

// 4. Iniciar Servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
