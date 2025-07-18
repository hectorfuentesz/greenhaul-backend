// Archivo: index.js (Versión Final y Completa)

// Importa módulos necesarios
const express = require('express');        // Framework web para construir APIs REST
const cors = require('cors');              // Middleware para manejar peticiones de diferentes orígenes (frontend)
const { db, connectAndSetupDatabase } = require('./database.js'); // db ahora es la Pool de conexiones
const bcrypt = require('bcryptjs');        // Librería para hashear y comparar contraseñas de forma segura

// Inicializa la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;     // Define el puerto del servidor. Usa el que asigne el entorno (Railway) o 3000 por defecto.

// Middlewares globales de Express
app.use(cors());             // Habilita el intercambio de recursos entre orígenes (CORS) para permitir que tu frontend se conecte.
app.use(express.json());     // Middleware para parsear los cuerpos de las peticiones que vienen en formato JSON.

// --- Ruta Raíz del API ---
// Una ruta simple para verificar que el servidor backend está corriendo y accesible.
app.get('/', (req, res) => {
  res.send('✅ Backend GreenHaul funcionando correctamente 🚛');
});

// --- RUTA DE REGISTRO DE USUARIO ---
// Permite a un nuevo usuario crear una cuenta en la aplicación.
app.post('/api/register', async (req, res) => {
  // Desestructura los datos del usuario del cuerpo de la petición.
  const { name, surname, email, password, whatsapp } = req.body;

  // Validación básica: Asegura que los campos obligatorios estén presentes.
  if (!name || !surname || !email || !password) {
    return res.status(400).json({ message: 'Nombre, apellido, correo y contraseña son obligatorios para el registro.' });
  }

  try {
    // Genera un hash seguro de la contraseña antes de almacenarla. Esto es crucial para la seguridad.
    const hashedPassword = await bcrypt.hash(password, 10); // '10' es el factor de costo (cuán intensivo es el hashing).

    // Define la sentencia SQL para insertar un nuevo usuario.
    // 'RETURNING id' hace que la base de datos devuelva el ID del nuevo registro insertado.
    const sql = 'INSERT INTO users (name, surname, email, password, whatsapp) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const values = [name, surname, email, hashedPassword, whatsapp];
    
    // Ejecuta la consulta SQL en la base de datos (usando db, que ahora es la Pool).
    const result = await db.query(sql, values);

    // Envía una respuesta de éxito con el ID del usuario recién creado.
    res.status(201).json({ message: 'Usuario registrado con éxito.', userId: result.rows[0].id });
  } catch (err) {
    // Manejo de errores específicos, por ejemplo, si el correo ya está registrado (violación de la restricción UNIQUE).
    if (err.code === '23505') { // '23505' es el código de error de PostgreSQL para una violación de restricción de unicidad.
      return res.status(400).json({ message: 'El correo electrónico ya está registrado. Por favor, intenta iniciar sesión o usa otro correo.' });
    }
    console.error("❌ Error en POST /api/register:", err); // Loggea el error completo para depuración.
    res.status(500).json({ message: 'Error interno del servidor al intentar registrar usuario.' });
  }
});

// --- RUTA DE INICIO DE SESIÓN DE USUARIO ---
// Permite a un usuario existente iniciar sesión y obtener sus datos de perfil (sin la contraseña).
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Busca al usuario en la base de datos por su correo electrónico (usando db, que ahora es la Pool).
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Si no se encuentra ningún usuario con ese correo, devuelve un error de autenticación.
      return res.status(401).json({ message: 'Correo no registrado o credenciales incorrectas.' });
    }

    const user = result.rows[0]; // Obtiene los datos del usuario.
    // Compara la contraseña proporcionada por el usuario con el hash almacenado en la base de datos.
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Si la contraseña no coincide, devuelve un error de autenticación.
      return res.status(401).json({ message: 'Contraseña incorrecta o credenciales inválidas.' });
    }

    // Si la autenticación es exitosa, devuelve los datos esenciales del usuario (sin la contraseña hashed).
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
// Permite obtener los datos de perfil de un usuario específico usando su ID.
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params; // Extrae el ID del usuario de los parámetros de la URL.

    // Consulta la base de datos para seleccionar los campos relevantes del usuario (usando db, que ahora es la Pool).
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

// --- RUTA DE ACTUALIZACIÓN DE PERFIL DE USUARIO ---
// Permite a un usuario actualizar su información de perfil.
app.put('/api/users/:id', async (req, res) => {
  try {
    // Desestructura los campos que se pueden actualizar desde el cuerpo de la petición.
    const { name, surname, email, whatsapp } = req.body;
    const { id } = req.params; // Extrae el ID del usuario a actualizar de los parámetros de la URL.

    const updates = []; // Array para construir dinámicamente las cláusulas SET de la consulta SQL.
    const values = [];  // Array para almacenar los valores que se enlazarán a los parámetros de la consulta ($1, $2, etc.).
    let queryIndex = 1; // Un contador para generar los índices de los parámetros de la consulta SQL.

    // Agrega campos al array 'updates' y 'values' solo si el valor correspondiente está presente y definido en el cuerpo de la petición.
    // Esto permite que el cliente envíe solo los campos que desea actualizar.
    if (name !== undefined) { updates.push(`name = $${queryIndex++}`); values.push(name); }
    if (surname !== undefined) { updates.push(`surname = $${queryIndex++}`); values.push(surname); }
    if (email !== undefined) { updates.push(`email = $${queryIndex++}`); values.push(email); }
    if (whatsapp !== undefined) { updates.push(`whatsapp = $${queryIndex++}`); values.push(whatsapp); }

    if (updates.length === 0) {
      // Si no se proporcionaron campos para actualizar, devuelve un error 400.
      return res.status(400).json({ message: 'No se proporcionaron datos válidos para actualizar el perfil.' });
    }

    // Construye la sentencia SQL UPDATE dinámicamente.
    // 'RETURNING id, name, surname, email, whatsapp' devuelve los datos actualizados del usuario.
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${queryIndex} RETURNING id, name, surname, email, whatsapp`;
    values.push(id); // Añade el ID del usuario al final de la lista de valores, para la cláusula WHERE.

    const result = await db.query(sql, values); // Ejecuta la consulta (usando db, que ahora es la Pool).

    if (result.rowCount === 0) {
      // Si no se encontró ningún usuario con el ID proporcionado, devuelve un error 404.
      return res.status(404).json({ message: 'Usuario no encontrado para actualizar.' });
    }
    
    // Devuelve el objeto del usuario con sus datos actualizados.
    const updatedUser = result.rows[0];
    res.status(200).json({
      message: 'Perfil actualizado con éxito.',
      user: updatedUser
    });

  } catch (err) {
    // Manejo de error específico para cuando se intenta cambiar el email a uno que ya existe.
    if (err.code === '23505') { 
      return res.status(400).json({ message: 'El correo electrónico proporcionado ya está en uso por otra cuenta.' });
    }
    console.error("❌ Error en PUT /api/users/:id :", err);
    res.status(500).json({ message: 'Error interno del servidor al actualizar el perfil.' });
  }
});

// --- RUTA: OBTENER ESTADÍSTICAS CONSOLIDADAS DEL DASHBOARD PARA UN USUARIO ---
// Esta nueva ruta agrupa varias consultas para proporcionar todos los datos necesarios para el dashboard del frontend.
app.get('/api/users/:userId/dashboard', async (req, res) => {
  const { userId } = req.params; // Extrae el ID del usuario de los parámetros de la URL.

  try {
    // 1. Contar el número de pedidos con estado 'activo' para el usuario.
    const activeOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'activo'", // (usando db, que ahora es la Pool).
      [userId]
    );
    const pedidos_activos = parseInt(activeOrdersResult.rows[0].count) || 0;

    // 2. Contar el número de pedidos con estado 'completado' para el usuario.
    const completedOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'completado'", // (usando db, que ahora es la Pool).
      [userId]
    );
    const pedidos_completados = parseInt(completedOrdersResult.rows[0].count) || 0;

    // 3. Contar el número de direcciones guardadas por el usuario.
    const addressesResult = await db.query(
      'SELECT COUNT(*) FROM addresses WHERE user_id = $1', // (usando db, que ahora es la Pool).
      [userId]
    );
    const direcciones = parseInt(addressesResult.rows[0].count) || 0;

    // 4. Obtener los 3 pedidos más recientes del usuario para mostrar un resumen.
    // Se seleccionan campos específicos y se les asignan alias para coincidir con la expectativa del frontend.
    const recentOrdersResult = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status, order_folio FROM orders WHERE user_id = $1 ORDER BY order_date DESC LIMIT 3', // (usando db, que ahora es la Pool).
      [userId]
    );
    // Mapea los resultados de la base de datos a un formato más amigable para el frontend.
    const recent_orders = recentOrdersResult.rows.map(order => ({
      // Aquí se devuelve el order_folio para la visualización en el dashboard si lo necesitas
      id: order.order_folio, // Asegúrate que el frontend espera 'id' o ajusta aquí.
      total: parseFloat(order.total).toFixed(2), 
      date: new Date(order.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), 
      status: order.status
    }));

    // --- 5. PLACEHOLDERS (Datos Simulados) PARA AHORRO DE CO2 ---
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
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", country FROM addresses WHERE user_id = $1 ORDER BY id DESC', // (usando db, que ahora es la Pool).
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
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", country FROM addresses WHERE id = $1', // (usando db, que ahora es la Pool).
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
      'INSERT INTO addresses (user_id, name, street, neighborhood, city, state, postal_code, "references") VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, name, street, neighborhood, city, state, postal_code, "references", country', // (usando db, que ahora es la Pool).
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
       RETURNING id, name, street, neighborhood, city, state, postal_code, "references", country`, // (usando db, que ahora es la Pool).
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
      'DELETE FROM addresses WHERE id = $1 RETURNING *', // (usando db, que ahora es la Pool).
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
// Devuelve una lista de todos los pedidos realizados por un usuario específico.
app.get('/api/users/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  try {
    // Selecciona las órdenes del usuario, incluyendo el nuevo campo 'status' y 'order_folio'
    const result = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status, order_folio FROM orders WHERE user_id = $1 ORDER BY order_date DESC', // (usando db, que ahora es la Pool).
      [userId]
    );
    // Mapea y formatea los resultados para que sean compatibles con el frontend.
    const formattedOrders = result.rows.map(order => ({
      id: order.order_folio, // ¡IMPORTANTE! Aquí se usa el order_folio para el "id" visible en el frontend
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


// --- Crear una nueva orden (¡AMPLIADA para guardar order_items y usar la Pool!) ---
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
    // Esta es la forma correcta de obtener un cliente individual de la Pool para una transacción.
    clientDbTransaction = await db.connect(); 
    // 2. Iniciar la transacción. Todos los comandos SQL que sigan serán parte de esta transacción.
    await clientDbTransaction.query('BEGIN'); 

    // --- Generar el número de folio ---
    // Usaremos un timestamp (milisegundos desde 1970) y un número aleatorio para mayor unicidad.
    // Esto es simple; para una solución de producción a gran escala, se podría usar UUIDs o secuencias de DB dedicadas.
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000); // Número aleatorio entre 0 y 9999
    const generatedOrderFolio = `GRNHL-${timestamp}-${randomSuffix}`; 

    // 3. Insertar la orden principal en la tabla 'orders'.
    // Ahora también insertamos el 'order_folio' generado.
    // 'RETURNING id, order_folio' es crucial para obtener ambos valores para la respuesta al frontend y para los ítems.
    const orderInsertQuery = 'INSERT INTO orders (user_id, total_amount, status, order_date, order_folio) VALUES ($1, $2, $3, $4, $5) RETURNING id, order_folio';
    const orderInsertValues = [user_id, total_amount, status, new Date(), generatedOrderFolio]; 
    
    const orderResult = await clientDbTransaction.query(orderInsertQuery, orderInsertValues);
    const orderId = orderResult.rows[0].id; // El ID numérico interno de la orden.
    const orderFolio = orderResult.rows[0].order_folio; // El folio generado.

    // 4. Iterar sobre cada ítem del carrito y insertarlo en la tabla 'order_items'.
    for (const item of cartItems) {
      // Validación básica para cada ítem individual del carrito.
      // Se asegura que el nombre, la cantidad y el precio del producto sean válidos.
      if (!item.name || item.name.trim() === '' || item.quantity === undefined || item.price === undefined || item.price < 0) {
          throw new Error(`Ítem del carrito con ID ${item.id || 'desconocido'} tiene datos inválidos (nombre, cantidad o precio).`);
      }

      const itemInsertQuery = `
        INSERT INTO order_items (order_id, product_name, quantity, price)
        VALUES ($1, $2, $3, $4) RETURNING id;
      `;
      // Convertimos 'price' a float para asegurar que la base de datos lo maneje correctamente.
      const itemInsertValues = [orderId, item.name, item.quantity, parseFloat(item.price)];
      
      await clientDbTransaction.query(itemInsertQuery, itemInsertValues);
    }

    // 5. Si todas las inserciones fueron exitosas, confirmar la transacción (guardar todos los cambios permanentemente).
    await clientDbTransaction.query('COMMIT'); 
    
    // 6. Devolver una respuesta de éxito con el ID de la orden (el folio) y un mensaje.
    // Enviamos el 'orderFolio' en la propiedad 'id' porque es lo que el frontend espera mostrar.
    res.status(201).json({ message: 'Orden creada correctamente y todos los ítems guardados.', order: { id: orderFolio } });

  } catch (err) {
    // Si algo falla en cualquier punto de la transacción, se revierte todo.
    if (clientDbTransaction) {
      await clientDbTransaction.query('ROLLBACK'); // Revertir todos los cambios realizados en la transacción.
    }
    console.error("❌ Error POST /api/orders:", err);
    // Manejo de errores específicos para el folio duplicado.
    if (err.code === '23505' && err.detail && err.detail.includes('order_folio')) {
        res.status(500).json({ message: `Error al crear la orden: El número de folio generado ya existe. Por favor, intenta de nuevo.` });
    } else {
        // Devuelve un mensaje de error detallado al cliente, incluyendo el mensaje original del error si está disponible.
        res.status(500).json({ message: `Error al crear la orden: ${err.message || 'Error interno del servidor.'}` });
    }
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