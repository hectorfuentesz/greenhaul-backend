// Archivo: database.js (Versión Final con Migraciones Automáticas TEMPORALES)

const { Pool } = require('pg');

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
    product_name VARCHAR(255) NOT NULL,
    quantity INTEGER NOT NULL,
    price NUMERIC(10, 2) NOT NULL
  );
`;

/**
 * Función asíncrona para conectar a la base de datos y configurar las tablas.
 * Incluye un bloque de migración TEMPORAL para agregar columnas existentes.
 */
async function connectAndSetupDatabase() {
  let clientForSetup; // Cliente de la Pool para el setup y las migraciones
  try {
    // Obtener un cliente de la pool para la configuración inicial de las tablas.
    clientForSetup = await pool.connect(); 

    // 1. Ejecutar la creación de tablas (CREATE TABLE IF NOT EXISTS)
    await clientForSetup.query(createTableQueryUsers);
    console.log("Tabla 'users' verificada/creada.");
    await clientForSetup.query(createTableQueryAddresses);
    console.log("Tabla 'addresses' verificada/creada.");
    await clientForSetup.query(createTableQueryOrders);
    console.log("Tabla 'orders' verificada/creada.");
    await clientForSetup.query(createTableQueryOrderItems);
    console.log("Tabla 'order_items' verificada/creada.");

    // --- INICIO: BLOQUE DE MIGRACIÓN AUTOMÁTICA TEMPORAL ---
    // ESTE CÓDIGO DEBE SER ELIMINADO DESPUÉS DE QUE LA MIGRACIÓN SE EJECUTE CON ÉXITO UNA VEZ.
    console.log('🔄 Ejecutando migraciones de columna automáticas TEMPORALES...');

    const migrations = [
      // Migraciones para 'addresses' (si faltan)
      'ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);',
      'ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);',
      'ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT;',
      'ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);',
      'ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);',
      // Asegurarse de que las columnas de addresses sean NULLABLE si es tu intención (DROP NOT NULL)
      'ALTER TABLE addresses ALTER COLUMN IF EXISTS name DROP NOT NULL;',
      'ALTER TABLE addresses ALTER COLUMN IF EXISTS neighborhood DROP NOT NULL;',
      'ALTER TABLE addresses ALTER COLUMN IF NOT EXISTS "references" DROP NOT NULL;',
      'ALTER TABLE addresses ALTER COLUMN IF NOT EXISTS latitude DROP NOT NULL;',
      'ALTER TABLE addresses ALTER COLUMN IF NOT EXISTS longitude DROP NOT NULL;',

      // Migraciones para 'orders' (si faltan)
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT \'activo\';',
      'ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_folio VARCHAR(50) UNIQUE;', // Se añade UNIQUE aquí, NOT NULL se hace después
      // Asegurar que la columna 'status' sea NULLABLE si es tu intención
      'ALTER TABLE orders ALTER COLUMN IF EXISTS status DROP NOT NULL;',
      // Hacer 'order_folio' NOT NULL. Si hay nulls, fallará aquí.
      // Si tienes nulls, primero genera folios con UPDATE y luego ejecuta esta línea manualmente en DB o quita el NOT NULL temporalmente.
      'ALTER TABLE orders ALTER COLUMN IF EXISTS order_folio SET NOT NULL;' 
      // Si ya hay folios generados, el UNIQUE está bien.
    ];

    for (const migrationQuery of migrations) {
      try {
        await clientForSetup.query(migrationQuery);
        console.log(`  ✅ Migración ejecutada: ${migrationQuery.substring(0, 50)}...`);
      } catch (migrationErr) {
        // Ignorar "column already exists" que es esperado con IF NOT EXISTS
        if (migrationErr.code === '42P07' || migrationErr.message.includes('already exists')) {
          console.log(`  ℹ️ Migración ya aplicada (o columna ya existe): ${migrationQuery.substring(0, 50)}...`);
        } else if (migrationErr.code === '23502') { // not_null_violation
            console.warn(`  ⚠️ Advertencia de migración: Falló SET NOT NULL. Hay valores NULL en la columna. Necesitas UPDATE first. ${migrationQuery.substring(0, 50)}... Error: ${migrationErr.message}`);
        } else {
          console.error(`  ❌ Error en migración: ${migrationQuery.substring(0, 50)}... Error: ${migrationErr.message}`);
          // No hacemos process.exit(1) aquí para que otras migraciones puedan intentarse
        }
      }
    }
    console.log('✅ Migraciones de columna automáticas TEMPORALES completadas.');
    // --- FIN: BLOQUE DE MIGRACIÓN AUTOMÁTICA TEMPORAL ---


  } catch (err) {
    console.error("❌ Error CRÍTICO al conectar o configurar la base de datos (antes de migraciones):", err.stack);
    process.exit(1); 
  } finally {
    // ¡IMPORTANTE! Siempre libera el cliente de la Pool después de usarlo.
    if (clientForSetup) {
      clientForSetup.release(); 
    }
  }
}

// Exporta la Pool de conexiones. Esta es la instancia principal de la DB que index.js debe usar para todas sus operaciones.
module.exports = {
  db: pool, 
  connectAndSetupDatabase
};