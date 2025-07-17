// Archivo: database.js (Versión Final y Completa)

const { Client } = require('pg');

// Configuración de la conexión a PostgreSQL.
// Utiliza la variable de entorno DATABASE_URL proporcionada por Railway o tu entorno.
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Es importante configurar SSL para conexiones a bases de datos en la nube como Railway.
    // rejectUnauthorized: false es común en entornos de desarrollo o si no tienes un certificado CA.
    // Para producción, se recomienda una configuración SSL más estricta si es posible.
    rejectUnauthorized: false 
  }
});

// --- Definiciones de tablas ---
// Cada bloque `CREATE TABLE IF NOT EXISTS` asegura que la tabla solo se creará
// si aún no existe en la base de datos.
// Esto evita errores si el script se ejecuta múltiples veces.

// Tabla 'users': Almacena la información de los usuarios registrados.
const createTableQueryUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    name VARCHAR(100) NOT NULL,   -- Nombre del usuario
    surname VARCHAR(100) NOT NULL, -- Apellido del usuario
    email VARCHAR(100) NOT NULL UNIQUE, -- Correo electrónico (debe ser único)
    password VARCHAR(100) NOT NULL, -- Contraseña del usuario (hashed)
    whatsapp VARCHAR(20),         -- Número de WhatsApp (opcional)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Marca de tiempo de creación
  );
`;

// Tabla 'addresses': Almacena las direcciones asociadas a los usuarios.
// Incluye los nuevos campos 'name', 'neighborhood', '"references"', 'latitude', 'longitude'.
// "references" está entre comillas dobles porque es una palabra clave reservada en SQL.
const createTableQueryAddresses = `
  CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- ID del usuario, borra direcciones si el usuario es eliminado
    name VARCHAR(255),            -- Nombre descriptivo de la dirección (ej. "Casa", "Oficina")
    street VARCHAR(255) NOT NULL, -- Calle y número
    neighborhood VARCHAR(255),    -- Colonia/Barrio
    city VARCHAR(100) NOT NULL,   -- Ciudad
    state VARCHAR(100),           -- Estado
    postal_code VARCHAR(20),      -- Código Postal
    "references" TEXT,            -- ¡CORRECCIÓN CLAVE! Ahora entre comillas dobles. Referencias adicionales (texto más largo)
    latitude NUMERIC(10, 7),      -- Latitud de la dirección (precisión 7 decimales para Leaflet)
    longitude NUMERIC(10, 7),     -- Longitud de la dirección (precisión 7 decimales para Leaflet)
    country VARCHAR(100) DEFAULT 'México', -- País (valor por defecto)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Marca de tiempo de creación
  );
`;

// Tabla 'orders': Almacena información general sobre los pedidos/mudanzas.
// Se añadió la columna 'status' con un valor por defecto.
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- ID del usuario, permite NULL si el usuario es borrado
    total_amount NUMERIC(10, 2) NOT NULL, -- Monto total del pedido
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Fecha y hora del pedido
    status VARCHAR(50) DEFAULT 'activo' -- Estado del pedido (ej. 'activo', 'completado', 'cancelado')
  );
`;

// Tabla 'order_items': Almacena los ítems individuales de cada pedido.
const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, -- ID del pedido al que pertenece el ítem
    product_name VARCHAR(255) NOT NULL, -- Nombre del producto/servicio
    quantity INTEGER NOT NULL,    -- Cantidad del ítem
    price NUMERIC(10, 2) NOT NULL -- Precio unitario del ítem
  );
`;

/**
 * Función para conectar a la base de datos y configurar las tablas.
 * Se ejecuta al iniciar el servidor.
 */
async function connectAndSetupDatabase() {
  try {
    await client.connect();
    console.log('✅ Conectado exitosamente a la base de datos PostgreSQL en Railway.');
    
    // Ejecutar la creación de tablas.
    // NOTA IMPORTANTE: `CREATE TABLE IF NOT EXISTS` solo crea la tabla si no existe.
    // Si necesitas agregar columnas a tablas EXISTENTES sin borrar datos (lo más común),
    // DEBES ejecutar sentencias ALTER TABLE manualmente en tu base de datos
    // o usar una herramienta de migración de base de datos.
    // Aquí están los comandos ALTER TABLE para añadir las nuevas columnas a las tablas existentes:
    /*
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT; -- ¡Con comillas!
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'activo';
    */

    await client.query(createTableQueryUsers);
    console.log("Tabla 'users' verificada/creada.");
    await client.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' verificada/creada.");
    await client.query(createTableQueryOrders);
    console.log("Tabla 'orders' verificada/creada.");
    await client.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' verificada/creada.");

  } catch (err) {
    console.error("❌ Error al conectar o configurar la base de datos:", err.stack);
    // Terminar el proceso si no se puede conectar a la base de datos,
    // ya que la aplicación no puede funcionar sin ella.
    process.exit(1); 
  }
}

// Exporta el cliente de la base de datos y la función de conexión/setup
module.exports = {
  db: client,
  connectAndSetupDatabase
};