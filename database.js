// Archivo: database.js (Versión Final, Completa y con order_folio)

const { Client } = require('pg'); // Importamos Client, aunque para la Pool usaremos Pool

// Configuración de la conexión a PostgreSQL.
// Utiliza la variable de entorno DATABASE_URL proporcionada por Railway o tu entorno local.
const client = new Client({ // Esta es la configuración original con Client, se mantiene para compatibilidad
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false 
  }
});

// --- Definiciones de tablas SQL ---
// Cada bloque `CREATE TABLE IF NOT EXISTS` asegura que la tabla solo se creará
// si aún no existe en la base de datos. Esto previene errores en ejecuciones posteriores.

// Tabla 'users': Almacena la información de los usuarios registrados.
const createTableQueryUsers = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental para el usuario
    name VARCHAR(100) NOT NULL,   -- Nombre del usuario
    surname VARCHAR(100) NOT NULL, -- Apellido del usuario
    email VARCHAR(100) NOT NULL UNIQUE, -- Correo electrónico del usuario (debe ser único en la tabla)
    password VARCHAR(100) NOT NULL, -- Contraseña del usuario (almacenada como hash por seguridad)
    whatsapp VARCHAR(20),         -- Número de WhatsApp del usuario (campo opcional)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Marca de tiempo de cuándo fue creado el registro
  );
`;

// Tabla 'addresses': Almacena las direcciones asociadas a los usuarios.
const createTableQueryAddresses = `
  CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental para la dirección
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Clave foránea al ID del usuario; si el usuario se elimina, sus direcciones también
    name VARCHAR(255),            -- Nombre descriptivo de la dirección (ej. "Casa", "Oficina de trabajo")
    street VARCHAR(255) NOT NULL, -- Calle y número de la dirección
    neighborhood VARCHAR(255),    -- Colonia/Barrio de la dirección
    city VARCHAR(100) NOT NULL,   -- Ciudad de la dirección
    state VARCHAR(100),           -- Estado de la dirección
    postal_code VARCHAR(20),      -- Código Postal de la dirección
    "references" TEXT,            -- Descripción o referencias adicionales sobre la ubicación (escapado con comillas dobles)
    latitude NUMERIC(10, 7),      -- Latitud de la ubicación geográfica (precisión 7 decimales para mapas), es OPCIONAL
    longitude NUMERIC(10, 7),     -- Longitud de la ubicación geográfica (precisión 7 decimales para mapas), es OPCIONAL
    country VARCHAR(100) DEFAULT 'México', -- País (valor por defecto 'México')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Marca de tiempo de cuándo fue creada esta dirección
  );
`;

// Tabla 'orders': Almacena información general sobre los pedidos/mudanzas de los usuarios.
// Se añadió la columna 'status' y 'order_folio'.
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental para la orden
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Clave foránea al ID del usuario; si el usuario se elimina, user_id se hace NULL
    total_amount NUMERIC(10, 2) NOT NULL, -- Monto total del pedido
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Fecha y hora de creación del pedido
    status VARCHAR(50) DEFAULT 'activo', -- Estado actual del pedido (ej. 'activo', 'completado', 'cancelado', 'pendiente')
    order_folio VARCHAR(50) UNIQUE NOT NULL -- ¡NUEVO! Folio único del pedido
  );
`;

// Tabla 'order_items': Almacena los ítems individuales que componen cada pedido.
const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental para el ítem de la orden
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, -- Clave foránea al ID de la orden; si la orden se elimina, sus ítems también
    product_name VARCHAR(255) NOT NULL, -- Nombre del producto o servicio en el ítem
    quantity INTEGER NOT NULL,    -- Cantidad de este producto/servicio en el ítem
    price NUMERIC(10, 2) NOT NULL -- Precio unitario de este producto/servicio
  );
`;

/**
 * Función asíncrona para establecer la conexión a la base de datos
 * y verificar/crear todas las tablas si no existen.
 * Es crucial que esta función se ejecute antes de que el servidor comience a manejar peticiones.
 */
async function connectAndSetupDatabase() {
  try {
    // Para la Pool, usamos 'pool.query()' directamente, no 'client.connect()' aquí.
    // La Pool manejará las conexiones automáticamente.
    
    // Ejecutar la creación de tablas. Cada `client.query` ejecuta la sentencia SQL.
    // La cláusula `IF NOT EXISTS` previene errores si las tablas ya existen.
    
    // ATENCIÓN: Si ya tenías tu base de datos creada en Railway con columnas antiguas
    // o con restricciones NOT NULL que ya no deseas,
    // DEBES ejecutar manualmente comandos ALTER TABLE en tu consola SQL de Railway
    // (o en tu herramienta de gestión de bases de datos) para actualizar el esquema.
    // Ejemplos de comandos ALTER TABLE que podrías necesitar ejecutar para asegurar
    // que tu esquema de DB en Railway coincida con este database.js:
    /*
    -- Para la tabla 'users':
    -- Si la columna 'name' fue creada con el '-' extra o con otra definición, puedes corregirla:
    -- ALTER TABLE users RENAME COLUMN "-name" TO name; -- Si la creó con el nombre incorrecto
    -- ALTER TABLE users ALTER COLUMN name TYPE VARCHAR(100); -- Si el tipo de dato es incorrecto
    -- ALTER TABLE users ALTER COLUMN name SET NOT NULL; -- Si quieres asegurarte de que sea NOT NULL

    -- Para la tabla 'addresses' si tiene columnas de lat/lng que quieres eliminar
    ALTER TABLE addresses DROP COLUMN IF EXISTS latitude;
    ALTER TABLE addresses DROP COLUMN IF EXISTS longitude;
    
    -- Para añadir columnas a 'addresses' si faltan y asegurar que permitan NULLs
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT; -- ¡Con comillas!
    -- Si estas columnas ya existían pero como NOT NULL, cámbialas a NULLABLE:
    ALTER TABLE addresses ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN neighborhood DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN "references" DROP NOT NULL;

    -- Para la tabla 'orders':
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'activo';
    ALTER TABLE orders ALTER COLUMN status DROP NOT NULL; -- Si quieres que status sea NULLABLE
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_folio VARCHAR(50) UNIQUE; -- Añadir order_folio si falta
    ALTER TABLE orders ALTER COLUMN order_folio SET NOT NULL; -- Hacerlo NOT NULL si fue creado como NULLABLE
    -- Si ya tienes órdenes y necesitas generar folios para ellas (antes de hacer order_folio NOT NULL y UNIQUE):
    -- UPDATE orders SET order_folio = 'GRNHL-' || LPAD(id::text, 6, '0') WHERE order_folio IS NULL OR order_folio = 'TEMP_FOLIO';
    */

    // Se asume que 'db' en index.js es una Pool, no un Client.
    // Para ejecutar queries de setup usando la Pool:
    const poolClient = await client.connect(); // Obtenemos un cliente de la pool para ejecutar el setup
    try {
        await poolClient.query(createTableQueryUsers);
        console.log("Tabla 'users' verificada/creada.");
        await poolClient.query(createTableQueryAddresses);
        console.log("Tabla 'addresses' verificada/creada.");
        await poolClient.query(createTableQueryOrders);
        console.log("Tabla 'orders' verificada/creada.");
        await poolClient.query(createTableQueryOrderItems);
        console.log("Tabla 'order_items' verificada/creada.");
        console.log('✅ Base de datos PostgreSQL en Railway verificada/configurada.');
    } finally {
        poolClient.release(); // Liberar el cliente de vuelta a la pool
    }

  } catch (err) {
    console.error("❌ Error al conectar o configurar la base de datos:", err.stack);
    process.exit(1); 
  }
}

// Exporta el cliente de la base de datos (`client`) para que pueda ser utilizado en `index.js`.
// En index.js, cuando se usa `db.query()` o `db.connect()` para transacciones,
// se espera que `db` sea una Pool. Aquí 'client' es de tipo Client, lo cual es incorrecto para ese patrón.
// ¡CORRECCIÓN CRÍTICA! Debemos exportar una Pool, no un Client directo, para la gestión de transacciones.
const { Pool } = require('pg'); // Re-importamos Pool para usarla

const pool = new Pool({ // Creación de la Pool
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = {
  db: pool, // Exportamos la Pool
  connectAndSetupDatabase
};