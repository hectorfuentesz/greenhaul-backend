// Archivo: database.js (Versión Final, Completa y Consolidada con pg.Pool)

const { Pool } = require('pg'); // ¡Importamos SOLO Pool, no Client!

// Configuración de la Pool de conexiones a PostgreSQL.
// Una Pool es el método preferido para manejar conexiones en aplicaciones web concurrentes,
// ya que reutiliza las conexiones de manera eficiente.
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

// --- Definiciones de tablas SQL ---
// Estas sentencias SQL se ejecutarán al iniciar la aplicación para asegurar que las tablas existan.

// Tabla 'users':
const createTableQueryUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    surname VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(100) NOT NULL,
    whatsapp VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Tabla 'addresses':
const createTableQueryAddresses = `
  CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255),
    street VARCHAR(255) NOT NULL,
    neighborhood VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    "references" TEXT,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    country VARCHAR(100) DEFAULT 'México',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`;

// Tabla 'orders':
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'activo',
    order_folio VARCHAR(50) UNIQUE NOT NULL
  );
`;

// Tabla 'order_items':
const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL
  );
`;

/**
 * Función asíncrona para conectar a la base de datos y configurar las tablas.
 * Obtiene un cliente de la Pool, ejecuta todas las queries de setup en él, y luego lo libera.
 * Esto asegura que el setup se haga en una conexión dedicada y liberada correctamente.
 */
async function connectAndSetupDatabase() {
  let clientForSetup; // Declaramos una variable para el cliente específico de setup
  try {
    // Obtener un cliente de la pool para la configuración inicial de las tablas.
    clientForSetup = await pool.connect(); // ¡Ahora pool.connect() está correcto!

    // Ejecutar la creación de tablas usando el cliente obtenido de la Pool.
    // La cláusula `IF NOT EXISTS` previene errores si las tablas ya existen.
    
    // ATENCIÓN: Si tu base de datos ya tiene tablas existentes que no coinciden
    // con estas definiciones (ej. columnas faltantes, tipos de datos, NOT NULLs),
    // DEBES ejecutar comandos ALTER TABLE manualmente en tu consola SQL de Railway
    // (o en tu herramienta de gestión de bases de datos) para actualizar el esquema.
    // Ejemplos de comandos ALTER TABLE:
    /*
    -- Añadir o corregir columnas en 'users' si hubo errores de tipografía
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);
    ALTER TABLE users ALTER COLUMN name SET NOT NULL;

    -- Para eliminar columnas de 'addresses' si ya no las quieres y existían
    ALTER TABLE addresses DROP COLUMN IF EXISTS latitude;
    ALTER TABLE addresses DROP COLUMN IF EXISTS longitude;
    
    -- Para añadir o corregir columnas en 'addresses'
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT;
    -- Asegurar que sean NULLABLE si no quieres que sean obligatorias:
    ALTER TABLE addresses ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN neighborhood DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN "references" DROP NOT NULL;

    -- Para la tabla 'orders'
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'activo';
    ALTER TABLE orders ALTER COLUMN status DROP NOT NULL; -- Si quieres que status sea NULLABLE
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_folio VARCHAR(50) UNIQUE; -- Añadir order_folio si falta
    ALTER TABLE orders ALTER COLUMN order_folio SET NOT NULL; -- Asegurar que sea NOT NULL y UNIQUE
    -- Si ya tienes órdenes y necesitas generar folios para ellas (antes de hacer order_folio NOT NULL):
    -- UPDATE orders SET order_folio = 'GRNHL-' || LPAD(id::text, 6, '0') WHERE order_folio IS NULL OR order_folio = '';
    */

    await clientForSetup.query(createTableQueryUsers);
    console.log("Tabla 'users' verificada/creada.");
    await clientForSetup.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' verificada/creada.");
    await clientForSetup.query(createTableQueryOrders);
    console.log("Tabla 'orders' verificada/creada.");
    await clientForSetup.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' verificada/creada.");

    console.log('✅ Base de datos PostgreSQL en Railway verificada/configurada (Pool usada para setup).');

  } catch (err) {
    console.error("❌ Error al conectar o configurar la base de datos:", err.stack);
    process.exit(1); 
  } finally {
    // ¡IMPORTANTE! Liberar el cliente de la Pool después de usarlo en el setup.
    if (clientForSetup) {
      clientForSetup.release(); 
    }
  }
}

// Exporta la Pool de conexiones. Esta es la instancia principal de la DB que index.js debe usar.
module.exports = {
  db: pool, // Exportamos la Pool (correctamente llamada 'pool' aquí)
  connectAndSetupDatabase
};