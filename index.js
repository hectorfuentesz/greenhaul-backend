// Archivo: index.js (GreenHaul backend robusto con integración Mercado Pago v2.x, inventario y correos corporativos)

// --- Dependencias ---
const express = require('express');
const cors = require('cors');
const { db, connectAndSetupDatabase } = require('./database.js');
const bcrypt = require('bcryptjs');
const mercadopago = require('mercadopago');
const nodemailer = require('nodemailer');

// --------- INTEGRACIÓN MERCADO PAGO ----------
mercadopago.access_token = 'APP_USR-3573758142529800-072110-0c1e16835004f530dcbf57bc0dbca8fe-692524464';

// --------- CONFIGURACIÓN CORREO CORPORATIVO (AJUSTA CON TUS DATOS SMTP) ----------
const transporter = nodemailer.createTransport({
  host: 'smtp.greenhaul.com', // Cambia por tu host SMTP real
  port: 465,
  secure: true,
  auth: {
    user: 'notificaciones@greenhaul.com',
    pass: 'TU_CONTRASEÑA_SMTP'
  }
});

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- Ruta Raíz ---
app.get('/', (req, res) => {
  res.send('✅ Backend GreenHaul funcionando correctamente 🚛');
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
    // Enviar correo de bienvenida
    try {
      await transporter.sendMail({
        from: '"GreenHaul" <notificaciones@greenhaul.com>',
        to: email,
        subject: '¡Bienvenido a GreenHaul!',
        html: `<h2>¡Bienvenido, ${name}!</h2><p>Tu cuenta ha sido creada correctamente. Ahora puedes comenzar a rentar y comprar con nosotros.</p>`
      });
    } catch (mailErr) {
      console.warn('No se pudo enviar correo de bienvenida:', mailErr);
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

// --- DASHBOARD DEL USUARIO ---
app.get('/api/users/:userId/dashboard', async (req, res) => {
  const { userId } = req.params;
  try {
    const activeOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'activo'", [userId]
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

// =============== RUTAS PARA GESTIÓN DE DIRECCIONES ===============

// Obtener todas las direcciones de un usuario
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

// Obtener una dirección específica por ID
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

// Crear una nueva dirección para un usuario
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

// Crear una nueva dirección (POST /api/addresses)
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

// Actualizar una dirección existente
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

// Eliminar una dirección
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

// =============== NUEVA TABLA: order_addresses ===============
// CREATE TABLE IF NOT EXISTS order_addresses (
//   id SERIAL PRIMARY KEY,
//   order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
//   order_folio VARCHAR(50) NOT NULL REFERENCES orders(order_folio) ON DELETE CASCADE,
//   delivery_address_id INTEGER REFERENCES addresses(id),
//   pickup_address_id INTEGER REFERENCES addresses(id),
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

// --- Obtener las direcciones asociadas a una orden (por folio o por ID) ---
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

// Obtener todas las órdenes de un usuario
app.get('/api/users/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      `SELECT id, total_amount AS total, order_date AS date, status, order_folio 
       FROM orders WHERE user_id = $1 ORDER BY order_date DESC`,
      [userId]
    );
    const formattedOrders = result.rows.map(order => ({
      id: order.order_folio,
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

// Crear una nueva orden (con vinculación en order_addresses)
app.post('/api/orders', async (req, res) => {
  const { user_id, total_amount, rentalDates, cartItems, status = 'activo', delivery_address_id, pickup_address_id } = req.body; 
  if (!user_id || total_amount === undefined || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ message: 'El ID de usuario, el monto total y al menos un ítem de carrito son obligatorios para crear una orden.' });
  }
  if (!delivery_address_id || !pickup_address_id) {
    return res.status(400).json({ message: 'Debes proporcionar los IDs de las direcciones de entrega y recolección.' });
  }
  let clientDbTransaction;
  try {
    clientDbTransaction = await db.connect();
    await clientDbTransaction.query('BEGIN');
    // Validar inventario antes de crear la orden
    for (const item of cartItems) {
      const prodRes = await db.query('SELECT stock FROM products WHERE id = $1', [item.id]);
      const stock = prodRes.rows[0]?.stock ?? 0;
      if (stock < item.quantity) {
        throw new Error(`No hay suficiente inventario para ${item.name}. Quedan ${stock} pieza(s).`);
      }
    }
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const generatedOrderFolio = `GRNHL-${timestamp}-${randomSuffix}`;
    // 1. Insertar en orders
    const orderInsertQuery = 'INSERT INTO orders (user_id, total_amount, status, order_date, order_folio) VALUES ($1, $2, $3, $4, $5) RETURNING id, order_folio';
    const orderInsertValues = [user_id, total_amount, status, new Date(), generatedOrderFolio]; 
    const orderResult = await clientDbTransaction.query(orderInsertQuery, orderInsertValues);
    const orderId = orderResult.rows[0].id;
    const orderFolio = orderResult.rows[0].order_folio;
    // 2. Insertar vínculo en order_addresses
    const oaQuery = `INSERT INTO order_addresses (order_id, order_folio, delivery_address_id, pickup_address_id)
                     VALUES ($1, $2, $3, $4) RETURNING id;`;
    await clientDbTransaction.query(oaQuery, [orderId, orderFolio, delivery_address_id, pickup_address_id]);
    // 3. Insertar los items y descontar inventario
    for (const item of cartItems) {
      if (!item.name || item.name.trim() === '' || item.quantity === undefined || item.price === undefined || item.price < 0) {
        throw new Error(`Ítem del carrito con ID ${item.id || 'desconocido'} tiene datos inválidos (nombre, cantidad o precio).`);
      }
      await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
      const itemInsertQuery = `
        INSERT INTO order_items (order_id, product_name, quantity, price)
        VALUES ($1, $2, $3, $4) RETURNING id;
      `;
      const itemInsertValues = [orderId, item.name, item.quantity, parseFloat(item.price)];
      await clientDbTransaction.query(itemInsertQuery, itemInsertValues);
    }
    await clientDbTransaction.query('COMMIT');
    res.status(201).json({ message: 'Orden creada correctamente y direcciones vinculadas.', order: { id: orderFolio } });
  } catch (err) {
    if (clientDbTransaction) await clientDbTransaction.query('ROLLBACK');
    console.error("❌ Error POST /api/orders:", err);
    res.status(500).json({ message: `Error al crear la orden: ${err.message || 'Error interno del servidor.'}` });
  } finally {
    if (clientDbTransaction) clientDbTransaction.release();
  }
});

// =============== PAGO MERCADO PAGO ===============
// Endpoint para recibir el token, procesar el pago y guardar la orden SOLO si el pago es exitoso
app.post('/api/mercadopago', async (req, res) => {
  const { mercadoPagoToken, monto, user_id, email, nombre, cartItems, delivery_address_id, pickup_address_id, rentalDates } = req.body;

  console.log({
    mercadoPagoToken,
    monto,
    user_id,
    email,
    nombre,
    cartItems,
    delivery_address_id,
    pickup_address_id
  });

  if (!mercadoPagoToken) return res.status(400).json({ message: 'Falta el token de pago de Mercado Pago.' });
  if (!monto) return res.status(400).json({ message: 'Falta el monto.' });
  if (!user_id) return res.status(400).json({ message: 'Falta el usuario.' });
  if (!email) return res.status(400).json({ message: 'Falta el email.' });
  if (!nombre) return res.status(400).json({ message: 'Falta el nombre.' });
  if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) return res.status(400).json({ message: 'Faltan los items del carrito.' });
  if (!delivery_address_id) return res.status(400).json({ message: 'Falta la dirección de entrega.' });
  if (!pickup_address_id) return res.status(400).json({ message: 'Falta la dirección de recolección.' });

  try {
    for (const item of cartItems) {
      const prodRes = await db.query('SELECT stock FROM products WHERE id = $1', [item.id]);
      const stock = prodRes.rows[0]?.stock ?? 0;
      if (stock < item.quantity) {
        throw new Error(`No hay suficiente inventario para ${item.name}. Quedan ${stock} pieza(s).`);
      }
    }
    const payment_data = {
      transaction_amount: monto,
      token: mercadoPagoToken,
      description: 'Pago GreenHaul',
      installments: 1,
      payer: {
        email: email,
        first_name: nombre
      }
    };
    const payment = await mercadopago.payment.create(payment_data);
    if (payment.body.status === 'approved') {
      let clientDbTransaction;
      try {
        clientDbTransaction = await db.connect();
        await clientDbTransaction.query('BEGIN');
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 10000);
        const generatedOrderFolio = `GRNHL-${timestamp}-${randomSuffix}`;
        const orderInsertQuery = 'INSERT INTO orders (user_id, total_amount, status, order_date, order_folio) VALUES ($1, $2, $3, $4, $5) RETURNING id, order_folio';
        const orderInsertValues = [user_id, monto, 'pagado', new Date(), generatedOrderFolio];
        const orderResult = await clientDbTransaction.query(orderInsertQuery, orderInsertValues);
        const orderId = orderResult.rows[0].id;
        const orderFolio = orderResult.rows[0].order_folio;
        const oaQuery = `INSERT INTO order_addresses (order_id, order_folio, delivery_address_id, pickup_address_id)
                          VALUES ($1, $2, $3, $4) RETURNING id;`;
        await clientDbTransaction.query(oaQuery, [orderId, orderFolio, delivery_address_id, pickup_address_id]);
        for (const item of cartItems) {
          if (!item.name || item.name.trim() === '' || item.quantity === undefined || item.price === undefined || item.price < 0) {
            throw new Error(`Ítem del carrito con ID ${item.id || 'desconocido'} tiene datos inválidos (nombre, cantidad o precio).`);
          }
          await db.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.quantity, item.id]);
          const itemInsertQuery = `
            INSERT INTO order_items (order_id, product_name, quantity, price)
            VALUES ($1, $2, $3, $4) RETURNING id;
          `;
          const itemInsertValues = [orderId, item.name, item.quantity, parseFloat(item.price)];
          await clientDbTransaction.query(itemInsertQuery, itemInsertValues);
        }
        await clientDbTransaction.query('COMMIT');
        try {
          await transporter.sendMail({
            from: '"GreenHaul" <notificaciones@greenhaul.com>',
            to: email,
            subject: '¡Tu pedido en GreenHaul fue procesado!',
            html: `<h2>¡Gracias por tu compra, ${nombre}!</h2>
            <p>Tu pedido ha sido recibido y confirmado.<br>
            <b>Folio de orden:</b> ${orderFolio}<br>
            <b>Total pagado:</b> $${monto.toFixed(2)}</p>
            <p>Un asesor se contactará contigo para el seguimiento.</p>`
          });
        } catch (mailErr) {
          console.warn('No se pudo enviar correo de confirmación de orden:', mailErr);
        }
        res.status(200).json({
          message: 'Pago procesado y orden guardada correctamente.',
          order_id: orderId,
          order_folio: orderFolio,
          mercado_pago: payment.body
        });
      } catch (err) {
        if (clientDbTransaction) await clientDbTransaction.query('ROLLBACK');
        console.error("❌ Error al guardar orden después de pago Mercado Pago:", err);
        res.status(500).json({ message: `El pago fue exitoso pero hubo un error al guardar la orden: ${err.message}` });
      } finally {
        if (clientDbTransaction) clientDbTransaction.release();
      }
    } else {
      res.status(400).json({ message: `El pago no fue aprobado: ${payment.body.status_detail}` });
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
      await transporter.sendMail({
        from: '"GreenHaul" <notificaciones@greenhaul.com>',
        to: email,
        subject: '¡Gracias por contactar a GreenHaul!',
        html: `<h2>¡Hola, ${full_name}!</h2>
        <p>Recibimos tu mensaje. Pronto te contactaremos.</p>`
      });
    } catch (mailErr) {
      console.warn('No se pudo enviar correo de contacto:', mailErr);
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
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    console.log(`🌐 Accede a: http://localhost:${PORT}`);
    console.log(`📅 Fecha y hora del servidor: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} (CST)`);
  });
}
startServer();