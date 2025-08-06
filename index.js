// Archivo: index.js (GreenHaul backend robusto con integración MercadoPago v1.5.0 en modo SANDBOX)
// Versión optimizada para procesar el pago con MercadoPago PRIMERO antes de guardar la orden y enviar correo.
// Los correos se envían DESPUÉS de responder al cliente (flujo más rápido y fluido).
// AHORA usando RESEND para todos los correos (sin nodemailer).
// MODIFICADO: Ahora incluye notificación interna de pedidos a notifications_orders@greenhaul.com.mx
// MODIFICADO: El correo de soporte es soporte@greenhaul.com.mx y usado en el contacto
// MODIFICADO: Las confirmaciones de pedidos al cliente se envían desde confirmacion_pedido@greenhaul.com.mx
// MODIFICADO: La recuperación de contraseña se envía exclusivamente desde auth@greenhaul.com.mx por Resend
// MODIFICADO: Inventario ahora considera reservas por fechas y día extra de limpieza
// MODIFICADO: Se limita a 3 entregas y 3 recolecciones por día
// MODIFICADO: Endpoint para fechas bloqueadas por entregas/recolecciones
// MODIFICADO: Endpoint para estado de días del calendario (entregas/recolecciones por día para todo el año)
// MODIFICADO: Endpoint para consultar disponibilidad concreta de entregas y recolecciones en una fecha

require('dotenv').config();
console.log('RESEND_API_KEY:', process.env.RESEND_API_KEY);
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);
const express = require('express');
const cors = require('cors');
const { db, connectAndSetupDatabase } = require('./database.js');
const bcrypt = require('bcryptjs');
const mercadopago = require('mercadopago');
const crypto = require('crypto');

// --------- INTEGRACIÓN MERCADO PAGO SANDBOX ----------
mercadopago.configurations.setAccessToken('TEST-3573758142529800-072110-c4df12b415f0d9cd6bae9827221cef9e-692524464');

// --------- INICIALIZA RESEND ----------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/**
 * Definición de la composición de paquetes y accesorios que dependen de inventario de otros productos.
 * Los IDs deben coincidir con los de la base de datos.
 */
const bundleContents = {
  101: [
    { id: 201, quantity: 5 }, // Caja HDPE 15kg (chica)
    { id: 202, quantity: 5 }, // Caja Cozumel 20kg (mediana)
  ],
  102: [
    { id: 201, quantity: 5 },
    { id: 202, quantity: 5 },
    { id: 203, quantity: 2 }, // Caja PP 30L (grande)
    { id: 209, quantity: 1 }, // Diablito de carga
  ],
  103: [
    { id: 201, quantity: 10 },
    { id: 202, quantity: 10 },
    { id: 203, quantity: 5 },
    { id: 209, quantity: 2 },
    { id: 208, quantity: 2 }, // Cobija de mudanza
    { id: 205, quantity: 1 }, // Cinta adhesiva ecológica
  ]
};

// === Utility para sumar días a una fecha tipo string (YYYY-MM-DD) ===
function addDays(dateStr, days) {
  let d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getAvailableStock(productId, cantidadNecesaria, fechaInicio, fechaFin) {
  const fechaFinLimpieza = addDays(fechaFin, 1);
  const stockResult = await db.query('SELECT stock FROM products WHERE id = $1', [productId]);
  const stock = stockResult.rows[0]?.stock ?? 0;
  const reservasResult = await db.query(
    `SELECT COALESCE(SUM(cantidad), 0) AS reservadas 
     FROM reservas 
     WHERE product_id = $1 
       AND estado = 'activa'
       AND fecha_inicio <= $2
       AND (fecha_fin + INTERVAL '1 day') >= $3`,
    [productId, fechaFinLimpieza, fechaInicio]
  );
  const reservadas = reservasResult.rows[0]?.reservadas ?? 0;
  return { disponible: stock - reservadas >= cantidadNecesaria, cantidad_maxima: stock - reservadas };
}

// --- Ruta para consultar disponibilidad de producto por fechas y cantidad ---
app.get('/api/products/:id/availability', async (req, res) => {
  const productId = req.params.id;
  const { fecha_inicio, fecha_fin, cantidad } = req.query;
  if (!fecha_inicio || !fecha_fin || !cantidad) {
    return res.status(400).json({ message: 'Debes proporcionar fecha_inicio, fecha_fin y cantidad.' });
  }
  try {
    const result = await getAvailableStock(productId, parseInt(cantidad), fecha_inicio, fecha_fin);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Error al consultar disponibilidad.', error: err.message });
  }
});

// --- Endpoint para fechas bloqueadas de entregas y recolecciones ---
app.get('/api/calendar/blocked-dates', async (req, res) => {
  try {
    const entregasRes = await db.query(
      `SELECT delivery_date AS fecha, COUNT(*) AS total
       FROM orders
       WHERE delivery_date IS NOT NULL
       GROUP BY delivery_date
       HAVING COUNT(*) >= 3`
    );
    const recoleccionesRes = await db.query(
      `SELECT pickup_date AS fecha, COUNT(*) AS total
       FROM orders
       WHERE pickup_date IS NOT NULL
       GROUP BY pickup_date
       HAVING COUNT(*) >= 3`
    );
    const entregasBloqueadas = entregasRes.rows.map(r => r.fecha.toISOString().slice(0, 10));
    const recoleccionesBloqueadas = recoleccionesRes.rows.map(r => r.fecha.toISOString().slice(0, 10));
    res.json({ entregasBloqueadas, recoleccionesBloqueadas });
  } catch (err) {
    res.status(500).json({ message: 'Error al consultar fechas bloqueadas', error: err.message });
  }
});

// --- Endpoint para estado de entregas/recolecciones de TODO el año ---
app.get('/api/calendar/days-status', async (req, res) => {
  try {
    const entregasRes = await db.query(
      `SELECT delivery_date AS fecha, COUNT(*) AS entregas
       FROM orders
       WHERE delivery_date IS NOT NULL
       GROUP BY delivery_date`
    );
    const recoleccionesRes = await db.query(
      `SELECT pickup_date AS fecha, COUNT(*) AS recolecciones
       FROM orders
       WHERE pickup_date IS NOT NULL
       GROUP BY pickup_date`
    );
    const days = {};
    entregasRes.rows.forEach(r => {
      const dateStr = r.fecha.toISOString().slice(0, 10);
      days[dateStr] = { entregas: parseInt(r.entregas), recolecciones: 0 };
    });
    recoleccionesRes.rows.forEach(r => {
      const dateStr = r.fecha.toISOString().slice(0, 10);
      if (!days[dateStr]) days[dateStr] = { entregas: 0, recolecciones: 0 };
      days[dateStr].recolecciones = parseInt(r.recolecciones);
    });
    const daysArray = Object.entries(days).map(([fecha, info]) => ({
      fecha,
      entregas: info.entregas,
      recolecciones: info.recolecciones,
      entregas_disponibles: info.entregas < 3,
      recolecciones_disponibles: info.recolecciones < 3
    }));
    res.json({ days: daysArray });
  } catch (err) {
    console.error("❌ Error en /api/calendar/days-status:", err);
    res.status(500).json({ message: 'Error al consultar el estado de los días.', error: err.message });
  }
});

// --- Endpoint para consultar disponibilidad de entregas/recolecciones en una fecha concreta ---
app.get('/api/calendar/disponibilidad', async (req, res) => {
  const { fecha } = req.query;
  if (!fecha) {
    return res.status(400).json({ message: 'Debes proporcionar una fecha en formato YYYY-MM-DD.' });
  }
  try {
    // Checa entregas en esa fecha
    const entregasRes = await db.query(
      `SELECT COUNT(*) AS total FROM orders WHERE delivery_date = $1`,
      [fecha]
    );
    const entregas = parseInt(entregasRes.rows[0].total) || 0;
    // Checa recolecciones en esa fecha
    const recoleccionesRes = await db.query(
      `SELECT COUNT(*) AS total FROM orders WHERE pickup_date = $1`,
      [fecha]
    );
    const recolecciones = parseInt(recoleccionesRes.rows[0].total) || 0;
    res.json({
      fecha,
      entregas_disponibles: entregas < 3,
      recolecciones_disponibles: recolecciones < 3
    });
  } catch (err) {
    console.error("❌ Error en /api/calendar/disponibilidad:", err);
    res.status(500).json({ message: 'Error al consultar disponibilidad de esa fecha.', error: err.message });
  }
});

// --- Ruta Raíz ---
app.get('/', (req, res) => {
  res.send('✅ Backend GreenHaul funcionando correctamente 🚛 (SANDBOX)');
});

// --- Recuperación de contraseña ---
app.post('/api/recover-password', async (req, res) => {
  console.log('=> POST /api/recover-password llamado');
  console.log('Body recibido:', req.body);

  const { email, phone } = req.body;
  if (!email || !phone) {
    return res.status(400).json({ message: 'Correo y teléfono son obligatorios.' });
  }
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1 AND whatsapp = $2', [email, phone]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No existe ninguna cuenta con ese correo y teléfono.' });
    }

    const user = result.rows[0];
    const tempPassword = crypto.randomBytes(4).toString('hex');
    const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

    await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashedTempPassword, user.id]);

    try {
      console.log('Enviando correo de recuperación...');
      await resend.emails.send({
        from: 'auth@greenhaul.com.mx',
        to: email,
        subject: 'Recuperación de Contraseña - GreenHaul',
        html: `<h2>Recuperación de Contraseña</h2>
        <p>Hola ${user.name},</p>
        <p>Hemos generado una contraseña temporal para que puedas ingresar a tu cuenta:</p>
        <p><b>${tempPassword}</b></p>
        <p>Por seguridad, te recomendamos cambiarla desde tu perfil una vez que inicies sesión.</p>
        <br>
        <p>Gracias por usar GreenHaul.</p>`
      });
      console.log('Correo de recuperación enviado a:', email);
    } catch (err) {
      console.error('❌ Error enviando correo de recuperación:', err);
    }

    res.status(200).json({ message: 'Se ha enviado una contraseña temporal al correo indicado.' });
  } catch (err) {
    console.error('❌ Error en POST /api/recover-password:', err);
    res.status(500).json({ message: 'Error al procesar la solicitud de recuperación.' });
  }
});

// --- REGISTRO DE USUARIO ---
app.post('/api/register', async (req, res) => {
  const { name, surname, email, password, whatsapp } = req.body;
  if (!name || !surname || !email || !password) {
    return res.status(400).json({ message: 'Nombre, apellido, correo y contraseña son obligatorios para el registro.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (name, surname, email, password, whatsapp) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const values = [name, surname, email, hashedPassword, whatsapp];
    const result = await db.query(sql, values);
    try {
      console.log('Enviando correo de bienvenida...');
      await resend.emails.send({
        from: 'soporte@greenhaul.com.mx',
        to: email,
        subject: '¡Bienvenido a GreenHaul!',
        html: `<h2>¡Bienvenido, ${name}!</h2><p>Tu cuenta ha sido creada correctamente. Ahora puedes comenzar a rentar y comprar con nosotros.</p>`
      });
      console.log('Correo de bienvenida enviado a:', email);
    } catch (mailErr) {
      console.error('❌ Error enviando correo de bienvenida:', mailErr);
    }
    res.status(201).json({ message: 'Usuario registrado con éxito.', userId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ message: 'El correo electrónico ya está registrado. Por favor, intenta iniciar sesión o usa otro correo.' });
    }
    console.error("❌ Error en POST /api/register:", err);
    res.status(500).json({ message: 'Error interno del servidor al intentar registrar usuario.' });
  }
});

// --- INICIO DE SESIÓN ---
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

// --- OBTENER USUARIO POR ID ---
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

// --- ACTUALIZAR PERFIL DE USUARIO ---
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
      return res.status(400).json({ message: 'El correo electrónico proporcionado ya está en uso por otra cuenta.' });
    }
    console.error("❌ Error en PUT /api/users/:id :", err);
    res.status(500).json({ message: 'Error interno del servidor al actualizar el perfil.' });
  }
});

// --- Cambiar contraseña desde el perfil/seguridad ---
app.put('/api/users/:id/change-password', async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: 'Debes proporcionar la contraseña actual y la nueva contraseña.' });
  }
  try {
    const result = await db.query('SELECT password FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ message: 'La contraseña actual es incorrecta.' });
    }
    const newHashedPassword = await bcrypt.hash(newPassword, 10);
    await db.query('UPDATE users SET password = $1 WHERE id = $2', [newHashedPassword, id]);
    res.status(200).json({ message: 'Contraseña actualizada exitosamente.' });
  } catch (err) {
    console.error('❌ Error en PUT /api/users/:id/change-password:', err);
    res.status(500).json({ message: 'Error al cambiar la contraseña.' });
  }
});

// --- DASHBOARD DEL USUARIO ---
app.get('/api/users/:userId/dashboard', async (req, res) => {
  const { userId } = req.params;
  try {
    const activeOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status IN ('activo', 'pagado')", [userId]
    );
    const pedidos_activos = parseInt(activeOrdersResult.rows[0].count) || 0;
    const completedOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'completado'", [userId]
    );
    const pedidos_completados = parseInt(completedOrdersResult.rows[0].count) || 0;
    const addressesResult = await db.query(
      'SELECT COUNT(*) FROM addresses WHERE user_id = $1', [userId]
    );
    const direcciones = parseInt(addressesResult.rows[0].count) || 0;
    const recentOrdersResult = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status, order_folio FROM orders WHERE user_id = $1 ORDER BY order_date DESC LIMIT 3',
      [userId]
    );
    const recent_orders = recentOrdersResult.rows.map(order => ({
      id: order.order_folio,
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
    res.status(500).json({ message: 'Error al obtener los datos del dashboard.' });
  }
});

// =============== LISTAR ÓRDENES DE UN USUARIO (con los campos requeridos) ===============
app.get('/api/users/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  try {
    const ordersResult = await db.query(
      `SELECT 
         order_folio,
         TO_CHAR(order_date, 'YYYY-MM-DD') AS order_date,
         total_amount,
         status,
         TO_CHAR(pickup_date, 'YYYY-MM-DD') AS pickup_date
       FROM orders
       WHERE user_id = $1
       ORDER BY order_date DESC`,
      [userId]
    );
    res.status(200).json({ orders: ordersResult.rows });
  } catch (err) {
    console.error("❌ Error GET /api/users/:userId/orders:", err);
    res.status(500).json({ message: 'Error al obtener los pedidos del usuario.' });
  }
});

// =============== RUTAS PARA GESTIÓN DE DIRECCIONES ===============
app.get('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", country, latitude, longitude FROM addresses WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error GET /api/users/:userId/addresses:", err);
    res.status(500).json({ message: 'Error al obtener las direcciones del usuario.' });
  }
});

app.get('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", country, latitude, longitude FROM addresses WHERE id = $1',
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

app.post('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  const { name, street, neighborhood, city, state, postal_code, references, latitude, longitude } = req.body;
  if (!street || !city) {
    return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para guardar una dirección.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO addresses (user_id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id, name, street, neighborhood, city, state, postal_code, "references", country, latitude, longitude',
      [userId, name, street, neighborhood, city, state, postal_code, references, latitude, longitude]
    );
    res.status(201).json({ message: 'Dirección guardada correctamente.', address: result.rows[0] });
  } catch (err) {
    console.error("❌ Error POST /api/users/:userId/addresses:", err);
    res.status(500).json({ message: 'Error al intentar guardar la nueva dirección.' });
  }
});

app.post('/api/addresses', async (req, res) => {
  const { user_id, name, street, neighborhood, city, state, postal_code, references, latitude, longitude } = req.body;
  if (!user_id || !street || !city) {
    return res.status(400).json({ message: 'user_id, calle y ciudad son obligatorios para guardar una dirección.' });
  }
  try {
    const result = await db.query(
      'INSERT INTO addresses (user_id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *;',
      [user_id, name, street, neighborhood, city, state, postal_code, references, latitude, longitude]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error POST /api/addresses:", err);
    res.status(500).json({ message: 'Error interno al guardar la dirección.' });
  }
});

app.put('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  const { name, street, neighborhood, city, state, postal_code, references, latitude, longitude } = req.body;
  if (!street || !city) {
    return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para actualizar la dirección.' });
  }
  try {
    const result = await db.query(
      `UPDATE addresses SET 
        name = $1, 
        street = $2, 
        neighborhood = $3,
        city = $4, 
        state = $5, 
        postal_code = $6, 
        "references" = $7,
        latitude = $8,
        longitude = $9
       WHERE id = $10 
       RETURNING id, name, street, neighborhood, city, state, postal_code, "references", country, latitude, longitude`,
      [name, street, neighborhood, city, state, postal_code, references, latitude, longitude, id]
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

app.get('/api/orders/:orderFolio/addresses', async (req, res) => {
  const { orderFolio } = req.params;
  try {
    const result = await db.query(
      `SELECT oa.*, 
              da.name AS delivery_name, da.street AS delivery_street, da.neighborhood AS delivery_neighborhood, 
              da.city AS delivery_city, da.state AS delivery_state, da.postal_code AS delivery_postal_code, da."references" AS delivery_references,
              da.latitude AS delivery_latitude, da.longitude AS delivery_longitude,
              pa.name AS pickup_name, pa.street AS pickup_street, pa.neighborhood AS pickup_neighborhood,
              pa.city AS pickup_city, pa.state AS pickup_state, pa.postal_code AS pickup_postal_code, pa."references" AS pickup_references,
              pa.latitude AS pickup_latitude, pa.longitude AS pickup_longitude
         FROM order_addresses oa
    LEFT JOIN addresses da ON oa.delivery_address_id = da.id
    LEFT JOIN addresses pa ON oa.pickup_address_id = pa.id
        WHERE oa.order_folio = $1`,
      [orderFolio]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No hay direcciones vinculadas a ese pedido.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error GET /api/orders/:orderFolio/addresses:", err);
    res.status(500).json({ message: 'Error al obtener las direcciones de la orden.' });
  }
});

// =============== ÓRDENES ===============
app.post('/api/orders', async (req, res) => {
  const { user_id, total_amount, rentalDates, cartItems, status = 'activo', delivery_address_id, pickup_address_id, email, nombre, delivery_date, pickup_date } = req.body;
  if (!user_id || total_amount === undefined || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ message: 'El ID de usuario, el monto total y al menos un ítem de carrito son obligatorios para crear una orden.' });
  }
  if (!delivery_address_id || !pickup_address_id) {
    return res.status(400).json({ message: 'Debes proporcionar los IDs de las direcciones de entrega y recolección.' });
  }
  if (!rentalDates?.fecha_inicio || !rentalDates?.fecha_fin) {
    return res.status(400).json({ message: 'Debes proporcionar las fechas de renta (inicio y fin).' });
  }
  if (!delivery_date || !pickup_date) {
    return res.status(400).json({ message: 'Debes proporcionar las fechas de entrega y recolección.' });
  }
  let clientDbTransaction;
  try {
    clientDbTransaction = await db.connect();
    await clientDbTransaction.query('BEGIN');
    const inventoryCheck = {};
    for (const item of cartItems) {
      if (bundleContents[item.id]) {
        bundleContents[item.id].forEach(sub => {
          inventoryCheck[sub.id] = (inventoryCheck[sub.id] || 0) + (sub.quantity * item.quantity);
        });
      } else {
        inventoryCheck[item.id] = (inventoryCheck[item.id] || 0) + item.quantity;
      }
    }
    for (const prodId in inventoryCheck) {
      const disponible = await getAvailableStock(prodId, inventoryCheck[prodId], rentalDates.fecha_inicio, rentalDates.fecha_fin);
      if (!disponible.disponible) {
        throw new Error(`No hay suficiente inventario para el producto con ID ${prodId} en las fechas seleccionadas.`);
      }
    }
    const entregaCountRes = await db.query(
      `SELECT COUNT(*) AS total FROM orders WHERE delivery_date = $1`,
      [delivery_date]
    );
    if (parseInt(entregaCountRes.rows[0].total) >= 3) {
      throw new Error('Ya hay 3 entregas programadas para la fecha seleccionada. Selecciona otro día.');
    }
    const recoleccionCountRes = await db.query(
      `SELECT COUNT(*) AS total FROM orders WHERE pickup_date = $1`,
      [pickup_date]
    );
    if (parseInt(recoleccionCountRes.rows[0].total) >= 3) {
      throw new Error('Ya hay 3 recolecciones programadas para la fecha seleccionada. Selecciona otro día.');
    }
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const generatedOrderFolio = `GRNHL-${timestamp}-${randomSuffix}`;
    const orderInsertQuery = `INSERT INTO orders (user_id, total_amount, status, order_date, order_folio, delivery_date, pickup_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, order_folio`;
    const orderInsertValues = [user_id, total_amount, status, new Date(), generatedOrderFolio, delivery_date, pickup_date];
    const orderResult = await clientDbTransaction.query(orderInsertQuery, orderInsertValues);
    const orderId = orderResult.rows[0].id;
    const orderFolio = orderResult.rows[0].order_folio;
    const oaQuery = `INSERT INTO order_addresses (order_id, order_folio, delivery_address_id, pickup_address_id)
                     VALUES ($1, $2, $3, $4) RETURNING id;`;
    await clientDbTransaction.query(oaQuery, [orderId, orderFolio, delivery_address_id, pickup_address_id]);
    for (const prodId in inventoryCheck) {
      const reservaFin = addDays(rentalDates.fecha_fin, 1);
      await db.query(
        `INSERT INTO reservas (product_id, cantidad, fecha_inicio, fecha_fin, usuario_id, estado) 
         VALUES ($1, $2, $3, $4, $5, 'activa')`,
        [prodId, inventoryCheck[prodId], rentalDates.fecha_inicio, reservaFin, user_id]
      );
    }
    for (const item of cartItems) {
      const itemInsertQuery = `
        INSERT INTO order_items (order_id, product_name, quantity, price)
        VALUES ($1, $2, $3, $4) RETURNING id;
      `;
      const itemInsertValues = [orderId, item.name, item.quantity, parseFloat(item.price)];
      await clientDbTransaction.query(itemInsertQuery, itemInsertValues);
    }
    await clientDbTransaction.query('COMMIT');
    try {
      console.log('Enviando correo interno de pedido...');
      await resend.emails.send({
        from: 'notifications_orders@greenhaul.com.mx',
        to: 'notifications_orders@greenhaul.com.mx',
        subject: `Nuevo pedido recibido - Folio ${orderFolio}`,
        html: `
          <h2>Nuevo pedido realizado</h2>
          <p>Usuario ID: ${user_id}</p>
          <p>Folio: ${orderFolio}</p>
          <p>Total: $${parseFloat(total_amount).toFixed(2)}</p>
          <h3>Productos:</h3>
          <ul>
            ${cartItems.map(item => `<li>${item.name} (x${item.quantity}) - $${item.price}</li>`).join('')}
          </ul>
          <h3>Dirección de entrega:</h3>
          <p>ID: ${delivery_address_id}</p>
          <h3>Dirección de recolección:</h3>
          <p>ID: ${pickup_address_id}</p>
          <br>
          <p>Fechas de renta: ${JSON.stringify(rentalDates)}</p>
          <p>Fecha de entrega: ${delivery_date}</p>
          <p>Fecha de recolección: ${pickup_date}</p>
        `
      });
      console.log('Correo interno de pedido enviado.');
    } catch (mailErr) {
      console.error('No se pudo enviar correo interno de pedido:', mailErr);
    }
    if (email && nombre) {
      try {
        console.log('Enviando correo de confirmación de pedido...');
        await resend.emails.send({
          from: 'confirmacion_pedido@greenhaul.com.mx',
          to: email,
          subject: '¡Tu pedido en GreenHaul fue recibido!',
          html: `<h2>¡Gracias por tu compra, ${nombre}!</h2>
          <p>Tu pedido ha sido recibido y está en proceso.<br>
          <b>Folio de orden:</b> ${orderFolio}<br>
          <b>Total:</b> $${parseFloat(total_amount).toFixed(2)}</p>
          <p>Un asesor se contactará contigo para el seguimiento.</p>`
        });
        console.log('Correo de confirmación de pedido enviado a:', email);
      } catch (mailErr) {
        console.error('No se pudo enviar correo de confirmación de pedido al cliente:', mailErr);
      }
    }
    res.status(201).json({ message: 'Orden creada correctamente y direcciones vinculadas.', order: { id: orderFolio } });
  } catch (err) {
    if (clientDbTransaction) await clientDbTransaction.query('ROLLBACK');
    console.error("❌ Error POST /api/orders:", err);
    res.status(500).json({ message: `Error al crear la orden: ${err.message || 'Error interno del servidor.'}` });
  } finally {
    if (clientDbTransaction) clientDbTransaction.release();
  }
});

// =============== PAGO MERCADO PAGO OPTIMIZADO CON RESERVA POR FECHAS ===============
app.post('/api/mercadopago', async (req, res) => {
  const { mercadoPagoToken, monto, user_id, email, nombre, cartItems, delivery_address_id, pickup_address_id, rentalDates, delivery_date, pickup_date } = req.body;
  const token = typeof mercadoPagoToken === 'string' ? mercadoPagoToken : (mercadoPagoToken?.token || '');

  if (!token) return res.status(400).json({ message: 'Falta el token de pago de Mercado Pago.' });
  if (!monto) return res.status(400).json({ message: 'Falta el monto.' });
  if (!user_id) return res.status(400).json({ message: 'Falta el usuario.' });
  if (!email) return res.status(400).json({ message: 'Falta el email.' });
  if (!nombre) return res.status(400).json({ message: 'Falta el nombre.' });
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) return res.status(400).json({ message: 'Faltan los items del carrito.' });
  if (!delivery_address_id) return res.status(400).json({ message: 'Falta la dirección de entrega.' });
  if (!pickup_address_id) return res.status(400).json({ message: 'Falta la dirección de recolección.' });
  if (!rentalDates?.fecha_inicio || !rentalDates?.fecha_fin) return res.status(400).json({ message: 'Faltan las fechas de renta (inicio y fin).' });
  if (!delivery_date || !pickup_date) return res.status(400).json({ message: 'Faltan las fechas de entrega y recolección.' });

  try {
    const payment_data = {
      transaction_amount: Number(monto),
      token: token,
      description: 'Pago GreenHaul',
      installments: 1,
      payer: {
        email: email,
        first_name: nombre
      }
    };
    console.log('payment_data:', payment_data);
    const payment = await mercadopago.payment.save(payment_data);
    const paymentData = payment.response || payment.body || payment;

    if (paymentData.status === 'approved') {
      let clientDbTransaction;
      let orderId, orderFolio;
      try {
        clientDbTransaction = await db.connect();
        await clientDbTransaction.query('BEGIN');
        const inventoryCheck = {};
        for (const item of cartItems) {
          if (bundleContents[item.id]) {
            bundleContents[item.id].forEach(sub => {
              inventoryCheck[sub.id] = (inventoryCheck[sub.id] || 0) + (sub.quantity * item.quantity);
            });
          } else {
            inventoryCheck[item.id] = (inventoryCheck[item.id] || 0) + item.quantity;
          }
        }
        for (const prodId in inventoryCheck) {
          const disponible = await getAvailableStock(prodId, inventoryCheck[prodId], rentalDates.fecha_inicio, rentalDates.fecha_fin);
          if (!disponible.disponible) {
            throw new Error(`No hay suficiente inventario para el producto con ID ${prodId} en las fechas seleccionadas.`);
          }
        }
        const entregaCountRes = await db.query(
          `SELECT COUNT(*) AS total FROM orders WHERE delivery_date = $1`,
          [delivery_date]
        );
        if (parseInt(entregaCountRes.rows[0].total) >= 3) {
          throw new Error('Ya hay 3 entregas programadas para la fecha seleccionada. Selecciona otro día.');
        }
        const recoleccionCountRes = await db.query(
          `SELECT COUNT(*) AS total FROM orders WHERE pickup_date = $1`,
          [pickup_date]
        );
        if (parseInt(recoleccionCountRes.rows[0].total) >= 3) {
          throw new Error('Ya hay 3 recolecciones programadas para la fecha seleccionada. Selecciona otro día.');
        }
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 10000);
        const generatedOrderFolio = `GRNHL-${timestamp}-${randomSuffix}`;
        const orderInsertQuery = `INSERT INTO orders (user_id, total_amount, status, order_date, order_folio, delivery_date, pickup_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, order_folio`;
        const orderInsertValues = [user_id, monto, 'pagado', new Date(), generatedOrderFolio, delivery_date, pickup_date];
        const orderResult = await clientDbTransaction.query(orderInsertQuery, orderInsertValues);
        orderId = orderResult.rows[0].id;
        orderFolio = orderResult.rows[0].order_folio;
        const oaQuery = `INSERT INTO order_addresses (order_id, order_folio, delivery_address_id, pickup_address_id)
                          VALUES ($1, $2, $3, $4) RETURNING id;`;
        await clientDbTransaction.query(oaQuery, [orderId, orderFolio, delivery_address_id, pickup_address_id]);
        for (const prodId in inventoryCheck) {
          const reservaFin = addDays(rentalDates.fecha_fin, 1);
          await db.query(
            `INSERT INTO reservas (product_id, cantidad, fecha_inicio, fecha_fin, usuario_id, estado) 
             VALUES ($1, $2, $3, $4, $5, 'activa')`,
            [prodId, inventoryCheck[prodId], rentalDates.fecha_inicio, reservaFin, user_id]
          );
        }
        for (const item of cartItems) {
          const itemInsertQuery = `
            INSERT INTO order_items (order_id, product_name, quantity, price)
            VALUES ($1, $2, $3, $4) RETURNING id;
          `;
          const itemInsertValues = [orderId, item.name, item.quantity, parseFloat(item.price)];
          await clientDbTransaction.query(itemInsertQuery, itemInsertValues);
        }
        await clientDbTransaction.query('COMMIT');
      } catch (err) {
        if (clientDbTransaction) await clientDbTransaction.query('ROLLBACK');
        console.error("❌ Error al guardar orden después de pago Mercado Pago:", err);
        return res.status(500).json({ message: `El pago fue exitoso pero hubo un error al guardar la orden: ${err.message}` });
      } finally {
        if (clientDbTransaction) clientDbTransaction.release();
      }
      res.status(200).json({
        message: 'Pago procesado y orden guardada correctamente.',
        order_id: orderId,
        order_folio: orderFolio,
        mercado_pago: paymentData
      });
      // Correos de confirmación y notificación en segundo plano
      setImmediate(async () => {
        try {
          console.log('Enviando correo interno de pedido desde pago...');
          await resend.emails.send({
            from: 'notifications_orders@greenhaul.com.mx',
            to: 'notifications_orders@greenhaul.com.mx',
            subject: `Nuevo pedido recibido - Folio ${orderFolio}`,
            html: `
              <h2>Nuevo pedido realizado</h2>
              <p>Usuario ID: ${user_id}</p>
              <p>Folio: ${orderFolio}</p>
              <p>Total: $${parseFloat(monto).toFixed(2)}</p>
              <h3>Productos:</h3>
              <ul>
                ${cartItems.map(item => `<li>${item.name} (x${item.quantity}) - $${item.price}</li>`).join('')}
              </ul>
              <h3>Dirección de entrega:</h3>
              <p>ID: ${delivery_address_id}</p>
              <h3>Dirección de recolección:</h3>
              <p>ID: ${pickup_address_id}</p>
              <br>
              <p>Fechas de renta: ${JSON.stringify(rentalDates)}</p>
              <p>Fecha de entrega: ${delivery_date}</p>
              <p>Fecha de recolección: ${pickup_date}</p>
            `
          });
          console.log('Correo interno de pedido enviado desde pago.');
        } catch (mailErr) {
          console.error('No se pudo enviar correo interno de pedido desde pago:', mailErr);
        }
        if (email && nombre) {
          try {
            console.log('Enviando correo de confirmación de pedido desde pago...');
            await resend.emails.send({
              from: 'confirmacion_pedido@greenhaul.com.mx',
              to: email,
              subject: '¡Tu pedido en GreenHaul fue recibido!',
              html: `<h2>¡Gracias por tu compra, ${nombre}!</h2>
              <p>Tu pedido ha sido recibido y está en proceso.<br>
              <b>Folio de orden:</b> ${orderFolio}<br>
              <b>Total:</b> $${parseFloat(monto).toFixed(2)}</p>
              <p>Un asesor se contactará contigo para el seguimiento.</p>`
            });
            console.log('Correo de confirmación de pedido enviado a:', email);
          } catch (mailErr) {
            console.error('No se pudo enviar correo de confirmación de pedido al cliente desde pago:', mailErr);
          }
        }
      });
    } else {
      res.status(400).json({
        message: `El pago no fue aprobado: ${paymentData.status_detail || paymentData.status || 'Sin detalle'}`,
        status: paymentData.status,
        status_detail: paymentData.status_detail,
        mercado_pago: paymentData
      });
    }
  } catch (error) {
    console.error('❌ Error al procesar pago Mercado Pago:', error);
    let msg = 'Error al procesar el pago.';
    if (error.message) msg = error.message;
    res.status(400).json({ message: msg, error });
  }
});

// --- Mensajes de Contacto ---
app.post('/api/contact', async (req, res) => {
  const { full_name, email, message } = req.body;
  if (!full_name || !email || !message) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }
  try {
    await db.query(
      'INSERT INTO contact_messages (full_name, email, message) VALUES ($1, $2, $3)',
      [full_name, email, message]
    );
    try {
      console.log('Enviando correo de acuse al cliente...');
      await resend.emails.send({
        from: 'soporte@greenhaul.com.mx',
        to: email,
        subject: '¡Gracias por contactar a GreenHaul!',
        html: `<h2>¡Hola, ${full_name}!</h2>
        <p>Recibimos tu mensaje. Pronto te contactaremos.</p>`
      });
      console.log('Correo de acuse enviado a:', email);
    } catch (mailErr) {
      console.error('No se pudo enviar correo de acuse al cliente:', mailErr);
    }
    try {
      console.log('Enviando correo interno de contacto...');
      await resend.emails.send({
        from: 'soporte@greenhaul.com.mx',
        to: 'soporte@greenhaul.com.mx',
        subject: `Nuevo mensaje de contacto de ${full_name}`,
        html: `<h2>Nuevo mensaje de contacto</h2>
          <p>Nombre: ${full_name}</p>
          <p>Correo: ${email}</p>
          <p>Mensaje:</p>
          <p>${message}</p>`
      });
      console.log('Correo interno de contacto enviado.');
    } catch (mailErr) {
      console.error('No se pudo enviar correo interno de contacto:', mailErr);
    }
    res.status(201).json({ message: '¡Mensaje enviado correctamente! Pronto te contactaremos.' });
  } catch (err) {
    console.error('❌ Error al guardar mensaje de contacto:', err);
    res.status(500).json({ message: 'Error interno al enviar tu mensaje.' });
  }
});

// --- Inicia el servidor ---
async function startServer() {
  await connectAndSetupDatabase();
  app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT} (SANDBOX)`);
    console.log(`🌐 Accede a: http://localhost:${PORT}`);
    console.log(`📅 Fecha y hora del servidor: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} (CST)`);
  });
}
startServer();