// Archivo: index.js (Versión Modificada para Direcciones Simplificadas)

const express = require('express');
const cors = require('cors');
const { db, connectAndSetupDatabase } = require('./database.js');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('✅ Backend GreenHaul funcionando correctamente 🚛');
});

// --- RUTAS DE USUARIOS Y AUTENTICACIÓN (SIN CAMBIOS RELEVANTES AQUÍ) ---

app.post('/api/register', async (req, res) => {
  const { name, surname, email, password, whatsapp } = req.body;
  if (!name || !surname || !email || !password) {
    return res.status(400).json({ message: 'Nombre, apellido, correo y contraseña son obligatorios.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (name, surname, email, password, whatsapp) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const values = [name, surname, email, hashedPassword, whatsapp];
    const result = await db.query(sql, values);
    res.status(201).json({ message: 'Usuario registrado con éxito.', userId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') { 
      return res.status(400).json({ message: 'El correo electrónico ya está registrado. Por favor, intenta iniciar sesión o usa otro correo.' });
    }
    console.error("❌ Error en POST /api/register:", err);
    res.status(500).json({ message: 'Error interno del servidor al intentar registrar usuario.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Correo no registrado o credenciales incorrectas.' });
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Contraseña incorrecta o credenciales inválidas.' });
    }
    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      user: { 
        id: user.id, 
        name: user.name, 
        surname: user.surname,
        email: user.email, 
        whatsapp: user.whatsapp 
      }
    });
  } catch (err) {
    console.error("❌ Error en POST /api/login:", err);
    res.status(500).json({ message: 'Error en el servidor al intentar iniciar sesión.' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, name, surname, email, whatsapp FROM users WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error("❌ Error en GET /api/users/:id :", err);
    res.status(500).json({ message: 'Error interno del servidor al obtener el usuario por ID.' });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, surname, email, whatsapp } = req.body;
    const { id } = req.params;
    const updates = [];
    const values = [];
    let queryIndex = 1;
    if (name !== undefined) { updates.push(`name = $${queryIndex++}`); values.push(name); }
    if (surname !== undefined) { updates.push(`surname = $${queryIndex++}`); values.push(surname); }
    if (email !== undefined) { updates.push(`email = $${queryIndex++}`); values.push(email); }
    if (whatsapp !== undefined) { updates.push(`whatsapp = $${queryIndex++}`); values.push(whatsapp); }
    if (updates.length === 0) {
      return res.status(400).json({ message: 'No se proporcionaron datos válidos para actualizar el perfil.' });
    }
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${queryIndex} RETURNING id, name, surname, email, whatsapp`;
    values.push(id);
    const result = await db.query(sql, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado para actualizar.' });
    }
    const updatedUser = result.rows[0];
    res.status(200).json({
      message: 'Perfil actualizado con éxito.',
      user: updatedUser
    });
  } catch (err) {
    if (err.code === '23505') { 
      return res.status(400).json({ message: 'El correo electrónico ya está en uso por otra cuenta.' });
    }
    console.error("❌ Error en PUT /api/users/:id :", err);
    res.status(500).json({ message: 'Error interno del servidor al actualizar el perfil.' });
  }
});

// --- RUTA: OBTENER ESTADÍSTICAS CONSOLIDADAS DEL DASHBOARD PARA UN USUARIO (sin cambios) ---
app.get('/api/users/:userId/dashboard', async (req, res) => {
  const { userId } = req.params;
  try {
    const activeOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'activo'",
      [userId]
    );
    const pedidos_activos = parseInt(activeOrdersResult.rows[0].count) || 0;
    const completedOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'completado'",
      [userId]
    );
    const pedidos_completados = parseInt(completedOrdersResult.rows[0].count) || 0;
    const addressesResult = await db.query(
      'SELECT COUNT(*) FROM addresses WHERE user_id = $1',
      [userId]
    );
    const direcciones = parseInt(addressesResult.rows[0].count) || 0;
    const recentOrdersResult = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status FROM orders WHERE user_id = $1 ORDER BY order_date DESC LIMIT 3',
      [userId]
    );
    const recent_orders = recentOrdersResult.rows.map(order => ({
      id: order.id,
      total: parseFloat(order.total).toFixed(2),
      date: new Date(order.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }),
      status: order.status
    }));
    const ahorro_kg_co2 = 120.5;
    const arboles_equivalentes = Math.floor(ahorro_kg_co2 / 21);
    const km_equivalentes = Math.floor(ahorro_kg_co2 / 0.12);
    const ahorro_historico = [
      { fecha: 'Ene', ahorro: 10 }, { fecha: 'Feb', ahorro: 25 }, { fecha: 'Mar', ahorro: 40 },
      { fecha: 'Abr', ahorro: 70 }, { fecha: 'May', ahorro: 95 }, { fecha: 'Jun', ahorro: 120.5 }
    ];
    res.status(200).json({
      pedidos_activos, pedidos_completados, direcciones,
      ahorro_kg_co2, arboles_equivalentes, km_equivalentes, ahorro_historico,
      recent_orders
    });
  } catch (err) {
    console.error("❌ Error en GET /api/users/:userId/dashboard:", err);
    res.status(500).json({ message: 'Error al obtener los datos del dashboard. Por favor, intenta de nuevo más tarde.' });
  }
});


// =============== RUTAS PARA GESTIÓN DE DIRECCIONES - ¡ACTUALIZADAS! ===============

// --- Obtener todas las direcciones de un usuario ---
app.get('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  try {
    // Selecciona SOLO las columnas deseadas. Eliminamos latitude y longitude de la SELECT.
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", country FROM addresses WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error GET /api/users/:userId/addresses:", err);
    res.status(500).json({ message: 'Error al obtener las direcciones del usuario.' });
  }
});

// --- Obtener una dirección específica por ID ---
app.get('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Selecciona SOLO las columnas deseadas. Eliminamos latitude y longitude de la SELECT.
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", country FROM addresses WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dirección no encontrada.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error GET /api/addresses/:id:", err);
    res.status(500).json({ message: 'Error al obtener la dirección específica.' });
  }
});

// --- Crear una nueva dirección para un usuario ---
app.post('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  // Desestructura SOLO las columnas deseadas del body. Eliminamos latitude y longitude.
  const { name, street, neighborhood, city, state, postal_code, references } = req.body;

  if (!street || !city) {
      return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para guardar una dirección.' });
  }

  try {
    // Inserta SOLO en las columnas deseadas. Eliminamos latitude y longitude de la INSERT.
    const result = await db.query(
      'INSERT INTO addresses (user_id, name, street, neighborhood, city, state, postal_code, "references") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, street, neighborhood, city, state, postal_code, "references", country',
      [userId, name, street, neighborhood, city, state, postal_code, references]
    );
    res.status(201).json({ message: 'Dirección guardada correctamente.', address: result.rows[0] });
  } catch (err) {
    console.error("❌ Error POST /api/users/:userId/addresses:", err);
    res.status(500).json({ message: 'Error al intentar guardar la nueva dirección.' });
  }
});

// --- Actualizar una dirección existente ---
app.put('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  // Desestructura SOLO las columnas deseadas del body. Eliminamos latitude y longitude.
  const { name, street, neighborhood, city, state, postal_code, references } = req.body;

  if (!street || !city) {
      return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para actualizar la dirección.' });
  }

  try {
    // Actualiza SOLO las columnas deseadas. Eliminamos latitude y longitude de la UPDATE.
    const result = await db.query(
      `UPDATE addresses SET 
        name = $1, 
        street = $2, 
        neighborhood = $3,
        city = $4, 
        state = $5, 
        postal_code = $6, 
        "references" = $7
       WHERE id = $8 
       RETURNING id, name, street, neighborhood, city, state, postal_code, "references", country`,
      [name, street, neighborhood, city, state, postal_code, references, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dirección no encontrada para actualizar.' });
    }
    res.status(200).json({ message: 'Dirección actualizada correctamente.', address: result.rows[0] });
  } catch (err) {
    console.error("❌ Error PUT /api/addresses/:id:", err);
    res.status(500).json({ message: 'Error al intentar actualizar la dirección existente.' });
  }
});

// --- Eliminar una dirección (sin cambios relevantes) ---
app.delete('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM addresses WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dirección no encontrada para eliminar.' });
    }
    res.status(200).json({ message: 'Dirección eliminada con éxito.' });
  } catch (err) {
    console.error("❌ Error DELETE /api/addresses/:id:", err);
    res.status(500).json({ message: 'Error al intentar eliminar la dirección.' });
  }
});

// =============== RUTAS PARA GESTIÓN DE ÓRDENES/PEDIDOS (sin cambios relevantes) ===============

app.get('/api/users/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status FROM orders WHERE user_id = $1 ORDER BY order_date DESC',
      [userId]
    );
    const formattedOrders = result.rows.map(order => ({
      id: order.id,
      total: parseFloat(order.total).toFixed(2),
      date: new Date(order.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: order.status
    }));
    res.status(200).json(formattedOrders);
  } catch (err) {
    console.error("❌ Error GET /api/users/:userId/orders:", err);
    res.status(500).json({ message: 'Error al obtener las órdenes del usuario.' });
  }
});

app.post('/api/orders', async (req, res) => {
  const { user_id, total_amount, status = 'activo' } = req.body;
  if (!user_id || !total_amount) {
    return res.status(400).json({ message: 'El ID de usuario y el monto total son obligatorios para crear una orden.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING *',
      [user_id, total_amount, status]
    );
    res.status(201).json({ message: 'Orden creada correctamente.', order: result.rows[0] });
  } catch (err) {
    console.error("❌ Error POST /api/orders:", err);
    res.status(500).json({ message: 'Error al intentar crear la orden.' });
  }
});


// --- Función para iniciar el servidor ---
async function startServer() {
  await connectAndSetupDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    console.log(`🌐 Accede a: http://localhost:${PORT}`);
    console.log(`📅 Fecha y hora del servidor: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} (CST)`);
  });
}

startServer();