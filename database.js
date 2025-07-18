// Archivo: database.js (Versión Final y Completa - USANDO PG.POOL)

const { Pool } = require('pg'); // ¡Cambiado de Client a Pool!

// Configuración de la Pool de conexiones a PostgreSQL.
// Una Pool es mejor para aplicaciones web concurrentes.
const pool = new Pool({ // ¡Cambiado de client a pool!
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
    status VARCHAR(50) DEFAULT 'activo'
  );
`;

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
 * Ahora usa la Pool para ejecutar las queries de setup.
 */
async function connectAndSetupDatabase() {
  try {
    // La Pool no necesita un .connect() explícito al inicio para ejecutar queries.
    // Simplemente usamos pool.query().
    
    // Ejecutar la creación de tablas usando la Pool.
    await pool.query(createTableQueryUsers); // ¡Cambiado de client.query a pool.query!
    console.log("Tabla 'users' verificada/creada.");
    await pool.query(createTableQueryAddresses); // ¡Cambiado de client.query a pool.query!
    console.log("Tabla 'addresses' verificada/creada.");
    await pool.query(createTableQueryOrders); // ¡Cambiado de client.query a pool.query!
    console.log("Tabla 'orders' verificada/creada.");
    await pool.query(createTableQueryOrderItems); // ¡Cambiado de client.query a pool.query!
    console.log("Tabla 'order_items' verificada/creada.");
    console.log('✅ Conectado exitosamente a la base de datos PostgreSQL en Railway (Pool iniciada).');


    // NOTA IMPORTANTE: Mantener las instrucciones de migración manual aquí para referencia.
    /*
    -- Para eliminar columnas si ya no las quieres y existían
    ALTER TABLE addresses DROP COLUMN IF EXISTS latitude;
    ALTER TABLE addresses DROP COLUMN IF EXISTS longitude;
    
    -- Para añadir columnas si faltan y asegurar que permitan NULLs
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT;
    ALTER TABLE addresses ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN neighborhood DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN "references" DROP NOT NULL;

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'activo';
    ALTER TABLE orders ALTER COLUMN status DROP NOT NULL;
    */

  } catch (err) {
    console.error("❌ Error al conectar o configurar la base de datos (Pool):", err.stack);
    process.exit(1); 
  }
}

// Exporta la Pool (`pool`) para que pueda ser utilizada en `index.js`
module.exports = {
  db: pool, // ¡Cambiado de client a pool!
  connectAndSetupDatabase
};