// Archivo: index.js (Versión Final y Completa - CORRECCIÓN DE CLIENTE DE DB PARA TRANSACCIONES)

// Importa módulos necesarios
const express = require('express');        
const cors = require('cors');              
const { db, connectAndSetupDatabase } = require('./database.js'); // db ahora es la Pool
const bcrypt = require('bcryptjs');        

// Inicializa la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;     

// Middlewares globales de Express
app.use(cors());             
app.use(express.json());     

// --- Ruta Raíz del API ---
app.get('/', (req, res) => {
  res.send('✅ Backend GreenHaul funcionando correctamente 🚛');
});

// --- RUTA DE REGISTRO DE USUARIO ---
app.post('/api/register', async (req, res) => {
  const { name, surname, email, password, whatsapp } = req.body;
  if (!name || !surname || !email || !password) {
    return res.status(400).json({ message: 'Nombre, apellido, correo y contraseña son obligatorios para el registro.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (name, surname, email, password, whatsapp) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const values = [name, surname, email, hashedPassword, whatsapp];
    const result = await db.query(sql, values); // db.query directamente en la Pool
    res.status(201).json({ message: 'Usuario registrado con éxito.', userId: result.rows[0].id });
  } catch (err) {
    if (err.code === '23505') { 
      return res.status(400).json({ message: 'El correo electrónico ya está registrado. Por favor, intenta iniciar sesión o usa otro correo.' });
    }
    console.error("❌ Error en POST /api/register:", err);
    res.status(500).json({ message: 'Error interno del servidor al intentar registrar usuario.' });
  }
});

// --- RUTA DE INICIO DE SESIÓN DE USUARIO ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]); // db.query directamente en la Pool
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

// --- RUTA: OBTENER DATOS DE USUARIO POR ID ---
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT id, name, surname, email, whatsapp FROM users WHERE id = $1', // db.query directamente en la Pool
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

// --- RUTA DE ACTUALIZACIÓN DE PERFIL DE USUARIO ---
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
    const result = await db.query(sql, values); // db.query directamente en la Pool
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

// --- RUTA: OBTENER ESTADÍSTICAS CONSOLIDADAS DEL DASHBOARD PARA UN USUARIO ---
app.get('/api/users/:userId/dashboard', async (req, res) => {
  const { userId } = req.params;
  try {
    const activeOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'activo'", // db.query directamente en la Pool
      [userId]
    );
    const pedidos_activos = parseInt(activeOrdersResult.rows[0].count) || 0;
    const completedOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'completado'", // db.query directamente en la Pool
      [userId]
    );
    const pedidos_completados = parseInt(completedOrdersResult.rows[0].count) || 0;
    const addressesResult = await db.query(
      'SELECT COUNT(*) FROM addresses WHERE user_id = $1', // db.query directamente en la Pool
      [userId]
    );
    const direcciones = parseInt(addressesResult.rows[0].count) || 0;
    const recentOrdersResult = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status FROM orders WHERE user_id = $1 ORDER BY order_date DESC LIMIT 3', // db.query directamente en la Pool
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


// =============== RUTAS PARA GESTIÓN DE DIRECCIONES ===============

// --- Obtener todas las direcciones de un usuario ---
app.get('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", country FROM addresses WHERE user_id = $1 ORDER BY id DESC', // db.query directamente en la Pool
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
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", country FROM addresses WHERE id = $1', // db.query directamente en la Pool
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
  const { name, street, neighborhood, city, state, postal_code, references } = req.body;

  if (!street || !city) {
      return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para guardar una dirección.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO addresses (user_id, name, street, neighborhood, city, state, postal_code, "references") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, street, neighborhood, city, state, postal_code, "references", country', // db.query directamente en la Pool
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
  const { name, street, neighborhood, city, state, postal_code, references } = req.body;

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
        "references" = $7
       WHERE id = $8 
       RETURNING id, name, street, neighborhood, city, state, postal_code, "references", country`, // db.query directamente en la Pool
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

// --- Eliminar una dirección ---
app.delete('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      'DELETE FROM addresses WHERE id = $1 RETURNING *', // db.query directamente en la Pool
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

// =============== RUTAS PARA GESTIÓN DE ÓRDENES/PEDIDOS ===============

// --- Obtener todas las órdenes de un usuario ---
app.get('/api/users/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  try {
    const result = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status FROM orders WHERE user_id = $1 ORDER BY order_date DESC', // db.query directamente en la Pool
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


// --- Crear una nueva orden (¡AMPLIADA para guardar order_items!) ---
// Esta ruta ahora es una transacción atómica: o se guarda la orden completa con sus ítems, o nada.
app.post('/api/orders', async (req, res) => {
  // Desestructura los datos principales de la orden del cuerpo de la petición.
  const { user_id, total_amount, rentalDates, cartItems, status = 'activo' } = req.body; 

  // Validación: Asegura que los campos obligatorios para la orden principal y los ítems estén presentes.
  if (!user_id || total_amount === undefined || !cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
    return res.status(400).json({ message: 'El ID de usuario, el monto total y al menos un ítem de carrito son obligatorios para crear una orden.' });
  }

  let clientDbTransaction; // Declara una variable para el cliente de la base de datos de la transacción.

  try {
    // 1. Obtener un cliente de conexión de la pool para usarlo en la transacción.
    // ¡CORRECCIÓN CLAVE AQUÍ! Usamos db.connect() para obtener un cliente de la pool para la transacción.
    clientDbTransaction = await db.connect(); 
    // 2. Iniciar la transacción. Todos los comandos SQL que sigan serán parte de esta transacción.
    await clientDbTransaction.query('BEGIN'); 

    // 3. Insertar la orden principal en la tabla 'orders'.
    const orderInsertQuery = 'INSERT INTO orders (user_id, total_amount, status, order_date) VALUES ($1, $2, $3, $4) RETURNING id';
    const orderInsertValues = [user_id, total_amount, status, new Date()]; 
    
    const orderResult = await clientDbTransaction.query(orderInsertQuery, orderInsertValues);
    const orderId = orderResult.rows[0].id; // El ID de la orden principal.

    // 4. Iterar sobre cada ítem del carrito y insertarlo en la tabla 'order_items'.
    for (const item of cartItems) {
      // Validación básica para cada ítem individual del carrito.
      if (!item.name || item.name.trim() === '' || item.quantity === undefined || item.price === undefined || item.price < 0) {
          throw new Error(`Ítem del carrito con ID ${item.id || 'desconocido'} tiene datos inválidos (nombre, cantidad o precio).`);
      }

      const itemInsertQuery = `
        INSERT INTO order_items (order_id, product_name, quantity, price)
        VALUES ($1, $2, $3, $4) RETURNING id;
      `;
      const itemInsertValues = [orderId, item.name, item.quantity, parseFloat(item.price)];
      
      await clientDbTransaction.query(itemInsertQuery, itemInsertValues);
    }

    // 5. Si todas las inserciones fueron exitosas, confirmar la transacción (guardar todos los cambios permanentemente).
    await clientDbTransaction.query('COMMIT'); 
    
    // 6. Devolver una respuesta de éxito con el ID de la orden creada.
    res.status(201).json({ message: 'Orden creada correctamente y todos los ítems guardados.', order: { id: orderId } });

  } catch (err) {
    // Si algo falla en cualquier punto de la transacción, se revierte todo.
    if (clientDbTransaction) {
      await clientDbTransaction.query('ROLLBACK'); // Revertir todos los cambios realizados en la transacción.
    }
    console.error("❌ Error POST /api/orders:", err);
    // Devuelve un mensaje de error detallado al cliente.
    res.status(500).json({ message: `Error al crear la orden: ${err.message || 'Error interno del servidor.'}` });
  } finally {
    // 7. Liberar el cliente de la base de datos de vuelta a la pool de conexiones. Esto es crucial para la eficiencia.
    if (clientDbTransaction) {
      clientDbTransaction.release();
    }
  }
});

// --- Función para iniciar el servidor ---
// Esta función asíncrona primero conecta y configura la base de datos,
// y luego inicia el servidor Express.
async function startServer() {
  await connectAndSetupDatabase(); // Espera a que la base de datos esté lista.
  app.listen(PORT, () => {
    // Callback que se ejecuta una vez que el servidor está escuchando.
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    console.log(`🌐 Accede a: http://localhost:${PORT}`);
    console.log(`📅 Fecha y hora del servidor: ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} (CST)`);
  });
}

// Llama a la función `startServer` para iniciar la aplicación backend.
startServer();