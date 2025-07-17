// Archivo: index.js (Versión Final y Completa)

// Importa módulos necesarios
const express = require('express');        // Framework web para construir APIs REST
const cors = require('cors');              // Middleware para manejar peticiones de diferentes orígenes (frontend)
const { db, connectAndSetupDatabase } = require('./database.js'); // Importa el cliente de la base de datos y la función de setup
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
    
    // Ejecuta la consulta SQL en la base de datos.
    const result = await db.query(sql, values);

    // Envía una respuesta de éxito con el ID del usuario recién creado.
    res.status(201).json({ message: 'Usuario registrado con éxito.', userId: result.rows[0].id });
  } catch (err) {
    // Manejo de errores específicos, por ejemplo, si el correo electrónico ya existe (violación de la restricción UNIQUE).
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
    // Busca al usuario en la base de datos por su correo electrónico.
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

    // Consulta la base de datos para seleccionar los campos relevantes del usuario (excluyendo la contraseña).
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

    // Añade campos al array 'updates' y 'values' solo si el valor correspondiente está presente y definido en el cuerpo de la petición.
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

    const result = await db.query(sql, values);

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
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'activo'",
      [userId]
    );
    const pedidos_activos = parseInt(activeOrdersResult.rows[0].count) || 0;

    // 2. Contar el número de pedidos con estado 'completado' para el usuario.
    const completedOrdersResult = await db.query(
      "SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'completado'",
      [userId]
    );
    const pedidos_completados = parseInt(completedOrdersResult.rows[0].count) || 0;

    // 3. Contar el número de direcciones guardadas por el usuario.
    const addressesResult = await db.query(
      'SELECT COUNT(*) FROM addresses WHERE user_id = $1',
      [userId]
    );
    const direcciones = parseInt(addressesResult.rows[0].count) || 0;

    // 4. Obtener los 3 pedidos más recientes del usuario para mostrar un resumen.
    // Se seleccionan campos específicos y se les asignan alias para coincidir con la expectativa del frontend.
    const recentOrdersResult = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status FROM orders WHERE user_id = $1 ORDER BY order_date DESC LIMIT 3',
      [userId]
    );
    // Mapea los resultados de la base de datos a un formato más amigable para el frontend.
    const recent_orders = recentOrdersResult.rows.map(order => ({
      id: order.id,
      total: parseFloat(order.total).toFixed(2), // Formatea el total a 2 decimales.
      date: new Date(order.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' }), // Formato de fecha legible.
      status: order.status
    }));

    // --- 5. PLACEHOLDERS (Datos Simulados) PARA AHORRO DE CO2 ---
    // Estos valores son estáticos y simulados para que el gráfico y los widgets de ahorro funcionen en el frontend.
    // En una aplicación real, esta lógica debería ser más compleja y basarse en datos reales de los servicios completados.
    const ahorro_kg_co2 = 120.5; // Ejemplo de kilogramos de CO2 ahorrados.
    const arboles_equivalentes = Math.floor(ahorro_kg_co2 / 21); // Equivalencia aproximada: 1 árbol maduro/año absorbe ~21 kg de CO2.
    const km_equivalentes = Math.floor(ahorro_kg_co2 / 0.12);   // Equivalencia aproximada: 1 km recorrido en auto emite ~0.12 kg de CO2.

    // Datos históricos de ahorro (simulados para el gráfico de Chart.js en el frontend).
    // Representan un ahorro acumulativo a lo largo de los meses.
    const ahorro_historico = [
      { fecha: 'Ene', ahorro: 10 },
      { fecha: 'Feb', ahorro: 25 },
      { fecha: 'Mar', ahorro: 40 },
      { fecha: 'Abr', ahorro: 70 },
      { fecha: 'May', ahorro: 95 },
      { fecha: 'Jun', ahorro: 120.5 }
    ];

    // Envía todos los datos consolidados del dashboard en una única respuesta JSON.
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
    res.status(500).json({ message: 'Error al obtener los datos del dashboard. Por favor, intenta de nuevo más tarde.' });
  }
});


// =============== RUTAS PARA GESTIÓN DE DIRECCIONES ===============

// --- Obtener todas las direcciones de un usuario ---
// Devuelve una lista de todas las direcciones guardadas para un usuario específico.
app.get('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  try {
    // Consulta la base de datos para seleccionar todos los campos relevantes de las direcciones.
    // Se usa comillas dobles en "references" para manejar el nombre de columna que coincide con una palabra clave SQL.
    const result = await db.query(
      'SELECT id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude FROM addresses WHERE user_id = $1 ORDER BY id DESC',
      [userId]
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ Error GET /api/users/:userId/addresses:", err);
    res.status(500).json({ message: 'Error al obtener las direcciones del usuario.' });
  }
});

// --- Obtener una dirección específica por ID ---
// Devuelve los detalles de una única dirección usando su ID.
app.get('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Consulta la dirección por su ID, incluyendo todos los campos.
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
    res.status(500).json({ message: 'Error al obtener la dirección específica.' });
  }
});

// --- Crear una nueva dirección para un usuario ---
// Permite a un usuario añadir una nueva dirección a su lista.
app.post('/api/users/:userId/addresses', async (req, res) => {
  const { userId } = req.params;
  // Desestructura todos los campos de la dirección desde el cuerpo de la petición.
  const { name, street, neighborhood, city, state, postal_code, references, latitude, longitude } = req.body;

  // Validación básica para campos obligatorios.
  if (!street || !city) {
      return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para guardar una dirección.' });
  }

  try {
    // Inserta la nueva dirección en la base de datos con todos los campos proporcionados.
    // Los nombres de columna deben coincidir con la definición de la tabla, usando comillas para "references".
    const result = await db.query(
      'INSERT INTO addresses (user_id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, name, street, neighborhood, city, state, postal_code, "references", latitude, longitude',
      [userId, name, street, neighborhood, city, state, postal_code, references, latitude, longitude]
    );
    res.status(201).json({ message: 'Dirección guardada correctamente.', address: result.rows[0] });
  } catch (err) {
    console.error("❌ Error POST /api/users/:userId/addresses:", err);
    res.status(500).json({ message: 'Error al intentar guardar la nueva dirección.' });
  }
});

// --- Actualizar una dirección existente ---
// Permite modificar los detalles de una dirección ya guardada.
app.put('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  // Desestructura todos los campos que pueden ser actualizados desde el cuerpo de la petición.
  const { name, street, neighborhood, city, state, postal_code, references, latitude, longitude } = req.body;

  // Validación básica.
  if (!street || !city) {
      return res.status(400).json({ message: 'La calle y la ciudad son obligatorias para actualizar la dirección.' });
  }

  try {
    // Actualiza los campos de la dirección en la base de datos.
    // Los nombres de columna deben coincidir, usando comillas para "references".
    const result = await db.query(
      `UPDATE addresses SET 
        name = $1, 
        street = $2, 
        neighborhood = $3,
        city = $4, 
        state = $5, 
        postal_code = $6, 
        "references" = $7, -- ¡CORRECCIÓN CLAVE! Nombre de columna escapado.
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
    res.status(500).json({ message: 'Error al intentar actualizar la dirección existente.' });
  }
});

// --- Eliminar una dirección ---
// Permite a un usuario eliminar una de sus direcciones guardadas.
app.delete('/api/addresses/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Ejecuta la sentencia DELETE para eliminar la dirección por su ID.
    // 'RETURNING *' es opcional, pero útil para verificar si se eliminó alguna fila.
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

// =============== RUTAS PARA GESTIÓN DE ÓRDENES/PEDIDOS ===============

// --- Obtener todas las órdenes de un usuario ---
// Devuelve una lista de todos los pedidos realizados por un usuario específico.
app.get('/api/users/:userId/orders', async (req, res) => {
  const { userId } = req.params;
  try {
    // Consulta las órdenes del usuario, seleccionando campos específicos y renombrándolos para el frontend.
    // Ordena las órdenes por fecha descendente (las más recientes primero).
    const result = await db.query(
      'SELECT id, total_amount AS total, order_date AS date, status FROM orders WHERE user_id = $1 ORDER BY order_date DESC',
      [userId]
    );
    // Mapea y formatea los resultados para que sean compatibles con el frontend.
    const formattedOrders = result.rows.map(order => ({
      id: order.id,
      total: parseFloat(order.total).toFixed(2), // Formatea el total a 2 decimales para visualización.
      date: new Date(order.date).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }), // Formatea la fecha y hora.
      status: order.status
    }));
    res.status(200).json(formattedOrders);
  } catch (err) {
    console.error("❌ Error GET /api/users/:userId/orders:", err);
    res.status(500).json({ message: 'Error al obtener las órdenes del usuario.' });
  }
});


// --- Crear una nueva orden ---
// Permite crear un nuevo registro de pedido en la base de datos.
app.post('/api/orders', async (req, res) => {
  const { user_id, total_amount, status = 'activo' } = req.body; // 'status' tiene un valor por defecto.

  // Validación básica para campos obligatorios.
  if (!user_id || !total_amount) {
    return res.status(400).json({ message: 'El ID de usuario y el monto total son obligatorios para crear una orden.' });
  }

  try {
    // Inserta una nueva orden en la base de datos con los datos proporcionados.
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
// Esta es la función principal que inicia la aplicación.
// Primero, intenta conectar y configurar la base de datos, luego inicia el servidor Express.
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