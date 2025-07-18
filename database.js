// Archivo: database.js (Versión Final, Consolidada y Corregida de connectAndSetupDatabase)

const { Pool } = require('pg'); // ¡Importamos SOLO Pool!

// Configuración de la Pool de conexiones a PostgreSQL.
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: {
    rejectUnauthorized: false 
  }
});

// --- Definiciones de tablas SQL ---
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

const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_folio VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL
  );
`;

/**
 * Función asíncrona para conectar a la base de datos y configurar las tablas.
 * Ahora usa directamente `pool.query()` para el setup, que es el método correcto.
 */
async function connectAndSetupDatabase() {
  try {
    // La Pool no necesita un .connect() explícito al inicio para ejecutar queries de setup.
    // pool.query() ya obtiene y libera una conexión automáticamente para cada query.
    
    // Ejecutar la creación de tablas.
    await pool.query(createTableQueryUsers); // Usar pool.query directamente
    console.log("Tabla 'users' verificada/creada.");
    await pool.query(createTableQueryAddresses); // Usar pool.query directamente
    console.log("Tabla 'addresses' verificada/creada.");
    await pool.query(createTableQueryOrders); // Usar pool.query directamente
    console.log("Tabla 'orders' verificada/creada.");
    await pool.query(createTableQueryOrderItems); // Usar pool.query directamente
    console.log("Tabla 'order_items' verificada/creada.");

    console.log('✅ Base de datos PostgreSQL en Railway verificada/configurada.');

    // NOTA IMPORTANTE: Las instrucciones de migración manual son para si las tablas
    // ya existían en tu DB de Railway con un esquema diferente. Si no las has hecho
    // y tu aplicación falla en runtime por columnas faltantes, DEBES ejecutarlas.
    /*
    -- Ejemplo: Añadir order_folio a la tabla 'orders' si no existe y rellenar folios antiguos.
    -- Luego hacerla NOT NULL.
    -- ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_folio VARCHAR(50) UNIQUE;
    -- UPDATE orders SET order_folio = 'GRNHL-' || LPAD(id::text, 6, '0') WHERE order_folio IS NULL OR order_folio = '';
    -- ALTER TABLE orders ALTER COLUMN order_folio SET NOT NULL;
    
    -- Ejemplo: Añadir order_folio a order_items si no existe y rellenar si ya había datos.
    -- ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_folio VARCHAR(50);
    -- UPDATE order_items oi SET order_folio = o.order_folio FROM orders o WHERE oi.order_id = o.id AND oi.order_folio IS NULL;
    -- ALTER TABLE order_items ALTER COLUMN order_folio SET NOT NULL;
    */

  } catch (err) {
    console.error("❌ Error CRÍTICO al conectar o configurar la base de datos (setup):", err.stack);
    process.exit(1); 
  }
  // No hay bloque finally con .release() aquí porque pool.query() lo maneja internamente.
}

// Exporta la Pool de conexiones. Esta es la instancia principal de la DB que index.js debe usar.
module.exports = {
  db: pool, 
  connectAndSetupDatabase
};
