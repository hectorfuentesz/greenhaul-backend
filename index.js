// Archivo: index.js (Versión Final y Completa)

// Importa módulos necesarios
const express = require('express');        // Framework web para Node.js
const cors = require('cors');              // Middleware para habilitar Cross-Origin Resource Sharing
const { db, connectAndSetupDatabase } = require('./database.js'); // Importa el cliente DB y la función de setup
const bcrypt = require('bcryptjs');        // Para hashear contraseñas

// Inicializa la aplicación Express
const app = express();
const PORT = process.env.PORT || 3000;     // Puerto del servidor, usa el de entorno o 3000 por defecto

// Middlewares
app.use(cors());             // Habilita CORS para permitir peticiones desde diferentes orígenes (frontend)
app.use(express.json());     // Habilita el parsing de JSON en el cuerpo de las peticiones

// --- Ruta Raíz ---
// Una simple ruta para verificar que el backend está funcionando.
app.get('/', (req, res) => {
  res.send('✅ Backend GreenHaul funcionando correctamente 🚛');
});

// --- RUTA DE REGISTRO DE USUARIO ---
app.post('/api/register', async (req, res) => {
  const { name, surname, email, password, whatsapp } = req.body;

  // Validación básica de campos obligatorios
  if (!name || !surname || !email || !password) {
    return res.status(400).json({ message: 'Nombre, apellido, correo y contraseña son obligatorios.' });
  }

  try {
    // Hashear la contraseña antes de guardarla en la base de datos por seguridad
    const hashedPassword = await bcrypt.hash(password, 10); // 10 es el costo del salt

    // SQL para insertar un nuevo usuario. RETURNING id devuelve el ID del nuevo registro.
    const sql = 'INSERT INTO users (name, surname, email, password, whatsapp) VALUES ($1, $2, $3, $4, $5) RETURNING id';
    const values = [name, surname, email, hashedPassword, whatsapp];
    const result = await db.query(sql, values);

    // Envía una respuesta de éxito con el ID del nuevo usuario
    res.status(201).json({ message: 'Usuario registrado con éxito.', userId: result.rows[0].id });
  } catch (err) {
    // Manejo de errores, por ejemplo, si el correo ya está registrado (violación de UNIQUE constraint)
    if (err.code === '23505') { // Código de error de PostgreSQL para unique_violation
      return res.status(400).json({ message: 'El correo ya está registrado. Por favor, usa otro.' });
    }
    console.error("❌ Error en POST /api/register:", err);
    res.status(500).json({ message: 'Error interno del servidor al registrar usuario.' });
  }
});

// --- RUTA DE LOGIN DE USUARIO ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Busca el usuario por su correo electrónico
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      // Si no se encuentra el usuario, devuelve un error 401 (No autorizado)
      return res.status(401).json({ message: 'Correo no registrado.' });
    }

    const user = result.rows[0]; // El usuario encontrado
    // Compara la contraseña proporcionada con la contraseña hasheada en la BD
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Si la contraseña no coincide, devuelve un error 401
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    // Si las credenciales son válidas, devuelve los datos del usuario (sin la contraseña)
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
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión.' });
  }
});

// --- RUTA: OBTENER USUARIO POR ID ---
// Útil para cargar los datos completos del perfil de un usuario.
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params; // Obtiene el ID del usuario de los parámetros de la URL

    // Consulta para seleccionar los datos del usuario, excluyendo la contraseña
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
    res.status(500).json({ message: 'Error interno del servidor al obtener usuario.' });
  }
});

// --- RUTA DE ACTUALIZACIÓN DE PERFIL DE USUARIO ---
app.put('/api/users/:id', async (req, res) => {
  try {
    // Desestructura los campos que pueden ser actualizados del cuerpo de la petición
    const { name, surname, email, whatsapp } = req.body;
    const { id } = req.params; // Obtiene el ID del usuario a actualizar

    const updates = []; // Array para construir las partes de la query SQL (ej. "name = $1")
    const values = [];  // Array para los valores de los parámetros de la query
    let queryIndex = 1; // Índice para los parámetros de la query ($1, $2, etc.)

    // Agrega campos al array 'updates' y 'values' solo si están presentes en el body
    // Esto permite actualizaciones parciales del perfil.
    // Nota: El frontend actual solo envía email y whatsapp, pero mantenemos flexibilidad para el futuro.
    if (name !== undefined) { updates.push(`name = $${queryIndex++}`); values.push(name); }
    if (surname !== undefined) { updates.push(`surname = $${queryIndex++}`); values.push(surname); }
    if (email !== undefined) { updates.push(`email = $${queryIndex++}`); values.push(email); }
    if (whatsapp !== undefined) { updates.push(`whatsapp = $${queryIndex++}`); values.push(whatsapp); }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No hay datos para actualizar.' });
    }

    // Construye la sentencia SQL UPDATE dinámicamente
    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${queryIndex} RETURNING id, name, surname, email, whatsapp`;
    values.push(id); // Añade el ID del usuario al final de los valores

    const result = await db.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado para actualizar.' });
    }
    
    // Devuelve los datos actualizados del usuario
    const updatedUser = result.rows[0];
    res.status(200).json({
      message: 'Perfil actualizado con éxito.',
      user: updatedUser
    });

  } catch (err) {
    // Manejo de error si el email ya existe (unique_violation)
    if (err.code === '23505') { 
      return res.status(400).json({ message: 'El correo electrónico ya está en uso por otra cuenta.' });
    }
    console.error("❌ Error en PUT /api/users/:id :", err);
    res.status(500).json({ message: 'Error interno del servidor al actualizar perfil.' });
  }
});

// --- RUTA: OBTENER ESTADÍSTICAS CONSOLIDADAS DEL DASHBOARD PARA UN USUARIO ---
// Proporciona datos para los widgets y gráficos del resumen de la cuenta.
app.get('/api/users/:userId/dashboard', async (req, res) => {
  const { userId } = req.params; // ID del usuario del que se obtendrán los datos

  try {
    // 1. Contar pedidos activos
    const activeOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'activo'",
      [userId]
    );
    const pedidos_activos = parseInt(activeOrdersResult.rows[0].count) || 0;

    // 2. Contar pedidos completados
    const completedOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'completado'",
      [userId]
    );
    const pedidos_completados = parseInt(completedOrdersResult.rows[0].count) || 0;

    // 3. Contar direcciones guardadas
    const addressesResult = await db.query(
      'SELECT COUNT(*) FROM addresses WHERE user_id = $1',
      [userId]
    );
    const direcciones = parseInt(addressesResult.rows[0].count) || 0;

    // 4. Obtener los últimos 3 pedidos para el resumen rápido del dashboard
    const recentOrdersResult = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status FROM orders WHERE user_id = $1 ORDER BY order_date DESC LIMIT 3',
      [userId]
    );
    // Mapea los resultados para formatear el total y la fecha como espera el frontend
    const recent_orders = recentOrdersResult.rows.map(order => ({
      id: order.id,
      total: parseFloat(order.total).toFixed(2), // Formatear a 2 decimales
      date: new Date(order.date).toLocaleDateString('es-MX'), // Formato de fecha localizado (ej. "15 de julio de 2024")
      status: order.status
    }));

    // --- 5. PLACEHOLDERS (Datos Simulados) PARA AHORRO DE CO2 ---
    // NOTA: La lógica real para calcular estos valores debería basarse en los
    // servicios completados por el usuario y su impacto ambiental (ej. peso transportado, distancia, tipo de vehículo).
    // Estos valores son solo para que el frontend pueda renderizar los widgets
    // y el gráfico sin errores hasta que la lógica real sea implementada.
    const ahorro_kg_co2 = 120.5; // Ejemplo: 120.5 kg de CO2 ahorrados
    const arboles_equivalentes = Math.floor(ahorro_kg_co2 / 21); // Equivalencia aproximada: 1 árbol maduro/año absorbe ~21 kg de CO2
    const km_equivalentes = Math.floor(ahorro_kg_co2 / 0.12);   // Equivalencia aproximada: 1 km en auto emite ~0.12 kg de CO2

    // Datos históricos de ahorro (simulados para el gráfico del frontend)
    // Deberían representar el ahorro acumulado a lo largo del tiempo.
    const ahorro_historico = [
      { fecha: 'Ene', ahorro: 10 },
      { fecha: 'Feb', ahorro: 25 },
      { fecha: 'Mar', ahorro: 40 },
      { fecha: 'Abr', ahorro: 70 },
      { fecha: 'May', ahorro: 95 },
      { fecha: 'Jun', ahorro: 120.5 }
    ];

    // Envía todos los datos consolidados del dashboard en una sola respuesta JSON
    res.status(200).json({
      pedidos_activos,
      pedidos_completados,
      direcciones,
      ahorro_kg_co2,
      arboles_equivalentes,
      km_equivalentes,
      ahorro_historico,
      recent_orders
    });

  } catch (err) {
    console.error("❌ Error en GET /api/users/:userId/dashboard:", err);
    res.status(500).json({ message: 'Error al obtener datos del dashboard. Por favor, contacta a soporte.' });
  }
});


// =============== RUTAS PARA DIRECCIONES ===============

// --- Obtener todas las direcciones de un usuario ---
app.get('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  try {
    // Selecciona todos los campos de la tabla 'addresses' para un usuario específico,
    // incluyendo los nuevos campos y el correcto escape de "references".
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude FROM addresses WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error GET /api/users/:userId/addresses:", err);
    res.status(500).json({ message: 'Error al obtener direcciones del usuario.' });
  }
});

// --- Obtener una dirección específica por ID ---
app.get('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Selecciona una dirección por su ID, con todos los campos incluyendo "references".
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude FROM addresses WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dirección no encontrada.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error GET /api/addresses/:id:", err);
    res.status(500).json({ message: 'Error al obtener dirección específica.' });
  }
});

// --- Crear una nueva dirección para un usuario ---
app.post('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  // Desestructura todos los campos de la dirección del cuerpo de la petición, incluyendo los nuevos.
  const { name, street, neighborhood, city, state, postal_code, references, latitude, longitude } = req.body;

  // Validación básica para los campos obligatorios.
  if (!street || !city) {
      return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para la dirección.' });
  }

  try {
    // Inserta la nueva dirección con todos sus campos.
    // Los nombres de columna con comillas dobles son necesarios para "references".
    const result = await db.query(
      'INSERT INTO addresses (user_id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude',
      [userId, name, street, neighborhood, city, state, postal_code, references, latitude, longitude]
    );
    res.status(201).json({ message: 'Dirección guardada correctamente.', address: result.rows[0] });
  } catch (err) {
    console.error("❌ Error POST /api/users/:userId/addresses:", err);
    res.status(500).json({ message: 'Error al guardar la nueva dirección.' });
  }
});

// --- Actualizar una dirección existente ---
app.put('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  // Desestructura todos los campos actualizables del cuerpo de la petición.
  const { name, street, neighborhood, city, state, postal_code, references, latitude, longitude } = req.body;

  // Validación básica.
  if (!street || !city) {
      return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para la dirección.' });
  }

  try {
    // Actualiza la dirección con los nuevos valores.
    // Se usa "references" entre comillas dobles en la sentencia SQL.
    const result = await db.query(
      `UPDATE addresses SET 
        name = $1, 
        street = $2, 
        neighborhood = $3,
        city = $4, 
        state = $5, 
        postal_code = $6, 
        "references" = $7, -- ¡CORRECCIÓN CLAVE!
        latitude = $8,
        longitude = $9
       WHERE id = $10 
       RETURNING id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude`,
      [name, street, neighborhood, city, state, postal_code, references, latitude, longitude, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dirección no encontrada para actualizar.' });
    }
    res.status(200).json({ message: 'Dirección actualizada correctamente.', address: result.rows[0] });
  } catch (err) {
    console.error("❌ Error PUT /api/addresses/:id:", err);
    res.status(500).json({ message: 'Error al actualizar dirección existente.' });
  }
});

// --- Eliminar una dirección ---
app.delete('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Elimina la dirección por su ID.
    const result = await db.query(
      'DELETE FROM addresses WHERE id = $1 RETURNING *', // RETURNING * opcional para verificar que se eliminó algo
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Dirección no encontrada para eliminar.' });
    }
    res.status(200).json({ message: 'Dirección eliminada con éxito.' });
  } catch (err) {
    console.error("❌ Error DELETE /api/addresses/:id:", err);
    res.status(500).json({ message: 'Error al eliminar dirección.' });
  }
});

// =============== RUTAS PARA ÓRDENES/PEDIDOS ===============

// --- Obtener todas las órdenes de un usuario ---
app.get('/api/users/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  try {
    // Selecciona las órdenes del usuario, incluyendo el nuevo campo 'status'
    // Y renombra las columnas para que coincidan con lo que espera el frontend ('total', 'date').
    const result = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status FROM orders WHERE user_id = $1 ORDER BY order_date DESC',
      [userId]
    );
    // Mapea los resultados para formatear el total a 2 decimales y la fecha a un formato legible.
    const formattedOrders = result.rows.map(order => ({
      id: order.id,
      total: parseFloat(order.total).toFixed(2),
      date: new Date(order.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      status: order.status
    }));
    res.status(200).json(formattedOrders);
  } catch (err) {
    console.error("❌ Error GET /api/users/:userId/orders:", err);
    res.status(500).json({ message: 'Error al obtener órdenes del usuario.' });
  }
});


// --- Crear una nueva orden ---
app.post('/api/orders', async (req, res) => {
  const { user_id, total_amount, status = 'activo' } = req.body; // Permite status opcional, por defecto 'activo'

  // Validación básica.
  if (!user_id || !total_amount) {
    return res.status(400).json({ message: 'El ID de usuario y el monto total son obligatorios para crear una orden.' });
  }

  try {
    // Inserta una nueva orden con user_id, total_amount y status.
    const result = await db.query(
      'INSERT INTO orders (user_id, total_amount, status) VALUES ($1, $2, $3) RETURNING *',
      [user_id, total_amount, status]
    );
    res.status(201).json({ message: 'Orden creada correctamente.', order: result.rows[0] });
  } catch (err) {
    console.error("❌ Error POST /api/orders:", err);
    res.status(500).json({ message: 'Error al crear la orden.' });
  }
});


// --- Función para iniciar el servidor ---
// Esta función asíncrona primero conecta y configura la base de datos,
// y luego inicia el servidor Express.
async function startServer() {
  await connectAndSetupDatabase(); // Conecta a la BD antes de empezar a escuchar peticiones
  app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    console.log(`🌐 Accede a: http://localhost:${PORT}`);
  });
}

// Llama a la función para iniciar el servidor
startServer();