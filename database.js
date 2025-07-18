// Archivo: database.js (Versión Final y Limpia)

const { Pool } = require('pg'); // Importamos SOLO Pool, que es la forma recomendada para aplicaciones web

// Configuración de la Pool de conexiones a PostgreSQL.
// Una Pool es el método preferido para manejar conexiones en aplicaciones web concurrentes,
// ya que reutiliza las conexiones de manera eficiente.
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, // La URL de conexión a tu DB en Railway
  ssl: {
    rejectUnauthorized: false // Permite conexiones SSL sin validación estricta de certificados (común en desarrollo/ciertos hosts)
  }
});

// --- Definiciones de tablas SQL ---
// Estas sentencias SQL se ejecutarán al iniciar la aplicación para asegurar que las tablas existan.
// La cláusula `IF NOT EXISTS` previene errores si las tablas ya existen en la base de datos.

// Tabla 'users': Almacena la información de los usuarios registrados.
const createTableQueryUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    name VARCHAR(100) NOT NULL,   -- Nombre del usuario (obligatorio)
    surname VARCHAR(100) NOT NULL, -- Apellido del usuario (obligatorio)
    email VARCHAR(100) NOT NULL UNIQUE, -- Correo electrónico (obligatorio y único)
    password VARCHAR(100) NOT NULL, -- Contraseña del usuario (almacenada como hash, obligatoria)
    whatsapp VARCHAR(20),         -- Número de WhatsApp (opcional)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Marca de tiempo de creación
  );
`;

// Tabla 'addresses': Almacena las direcciones asociadas a los usuarios.
const createTableQueryAddresses = `
  CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Clave foránea al ID del usuario, si el usuario se elimina, sus direcciones también
    name VARCHAR(255),            -- Nombre descriptivo de la dirección (ej. "Casa", "Oficina")
    street VARCHAR(255) NOT NULL, -- Calle y número (obligatorio)
    neighborhood VARCHAR(255),    -- Colonia/Barrio (opcional)
    city VARCHAR(100) NOT NULL,   -- Ciudad (obligatorio)
    state VARCHAR(100),           -- Estado (opcional)
    postal_code VARCHAR(20),      -- Código Postal (opcional)
    "references" TEXT,            -- Referencias adicionales (¡escapado con comillas dobles!, opcional)
    latitude NUMERIC(10, 7),      -- Latitud (opcional, sin NOT NULL)
    longitude NUMERIC(10, 7),     -- Longitud (opcional, sin NOT NULL)
    country VARCHAR(100) DEFAULT 'México', -- País (valor por defecto)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Marca de tiempo de creación
  );
`;

// Tabla 'orders': Almacena información general sobre los pedidos/mudanzas.
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Clave foránea al ID del usuario
    total_amount NUMERIC(10, 2) NOT NULL, -- Monto total del pedido (obligatorio)
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Fecha y hora del pedido
    status VARCHAR(50) DEFAULT 'activo', -- Estado del pedido (valor por defecto 'activo')
    order_folio VARCHAR(50) UNIQUE NOT NULL -- ¡CRÍTICO! Folio único del pedido, obligatorio
  );
`;

// Tabla 'order_items': Almacena los ítems individuales que componen cada pedido.
const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, -- Clave foránea al ID de la orden
    product_name VARCHAR(255) NOT NULL, -- Nombre del producto (obligatorio)
    quantity INTEGER NOT NULL,    -- Cantidad del producto (obligatorio)
    price NUMERIC(10, 2) NOT NULL -- Precio unitario (obligatorio)
  );
`;

/**
 * Función asíncrona para establecer la conexión a la base de datos y configurar las tablas.
 * Obtiene un cliente de la Pool, ejecuta todas las queries de setup en él, y luego lo libera.
 * Esto asegura que el setup se haga en una conexión dedicada y liberada correctamente.
 */
async function connectAndSetupDatabase() {
  let clientForSetup; // Cliente de la Pool para el setup
  try {
    // Obtener un cliente de la pool para la configuración inicial de las tablas.
    clientForSetup = await pool.connect(); 

    // Ejecutar la creación de tablas. Cada `clientForSetup.query` ejecuta la sentencia SQL.
    // La cláusula `IF NOT EXISTS` previene errores si las tablas ya existen.
    // Una vez que las migraciones temporales han sido ejecutadas exitosamente, este bloque
    // asegura que las tablas existan con el esquema final esperado.
    
    await clientForSetup.query(createTableQueryUsers);
    console.log("Tabla 'users' verificada/creada.");
    await clientForSetup.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' verificada/creada.");
    await clientForSetup.query(createTableQueryOrders);
    console.log("Tabla 'orders' verificada/creada.");
    await clientForSetup.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' verificada/creada.");

    console.log('✅ Base de datos PostgreSQL en Railway verificada/configurada.');

  } catch (err) {
    console.error("❌ Error CRÍTICO al conectar o configurar la base de datos (setup):", err.stack);
    // Termina el proceso si hay un error crítico en la configuración de la DB al inicio
    process.exit(1); 
  } finally {
    // ¡IMPORTANTE! Siempre libera el cliente de la Pool después de usarlo.
    if (clientForSetup) {
      clientForSetup.release(); 
    }
  }
}

// Exporta la Pool de conexiones. Esta es la instancia principal de la DB que index.js debe usar.
module.exports = {
  db: pool, 
  connectAndSetupDatabase
};