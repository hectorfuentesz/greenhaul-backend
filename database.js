// Archivo: database.js (Versión Final, Completa y con order_folio en order_items)

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
    name VARCHAR(255),            -- Nombre descriptivo de la dirección
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
// ¡NUEVO CAMPO order_folio aquí!
const createTableQueryOrderItems = `
  CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, -- Clave foránea al ID de la orden
    order_folio VARCHAR(50) NOT NULL, -- ¡NUEVO! Folio de la orden asociada, obligatorio
    product_name VARCHAR(255) NOT NULL, -- Nombre del producto (obligatorio)
    quantity INTEGER NOT NULL,    -- Cantidad (obligatorio)
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
    // Esto asegura que las queries de CREATE TABLE se ejecuten de forma segura.
    clientForSetup = await pool.connect(); 

    // Ejecutar la creación de tablas. Cada `clientForSetup.query` ejecuta la sentencia SQL.
    // La cláusula `IF NOT EXISTS` previene errores si las tablas ya existen.
    // Una vez que las migraciones temporales han sido ejecutadas exitosamente, este bloque
    // asegura que las tablas existan con el esquema final esperado.
    
    // ATENCIÓN: Si tu base de datos ya tiene tablas existentes que no coinciden
    // con estas definiciones (ej. columnas faltantes, tipos de datos incorrectos,
    // o restricciones NOT NULL que ya no deseas),
    // DEBES ejecutar comandos ALTER TABLE manualmente en tu consola SQL de Railway
    // (o en tu herramienta de gestión de bases de datos) para actualizar el esquema.
    // Ejemplos de comandos ALTER TABLE que podrías necesitar ejecutar para asegurar
    // que tu esquema de DB en Railway coincida perfectamente con este database.js:
    /*
    -- Migraciones de ejemplo para tabla 'users' (si hubo errores iniciales o cambios)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(100);
    ALTER TABLE users ALTER COLUMN name SET NOT NULL; -- Si quieres que sea obligatorio
    -- ... (otros ALTER TABLE para users)

    -- Migraciones de ejemplo para tabla 'addresses'
    ALTER TABLE addresses DROP COLUMN IF EXISTS latitude;  -- Eliminar si no la quieres
    ALTER TABLE addresses DROP COLUMN IF EXISTS longitude; -- Eliminar si no la quieres
    
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT; -- ¡Con comillas!
    -- Asegurar que sean NULLABLE si no quieres que sean obligatorias:
    ALTER TABLE addresses ALTER COLUMN name DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN neighborhood DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN "references" DROP NOT NULL;

    -- Migraciones de ejemplo para tabla 'orders'
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'activo';
    ALTER TABLE orders ALTER COLUMN status DROP NOT NULL; -- Si quieres que status sea NULLABLE
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_folio VARCHAR(50) UNIQUE; -- Añadir order_folio si falta
    ALTER TABLE orders ALTER COLUMN order_folio SET NOT NULL; -- ¡CRÍTICO! Hazlo NOT NULL para que el backend funcione
    -- Si ya tenías órdenes y necesitas generar folios para ellas (antes de hacer order_folio NOT NULL):
    -- UPDATE orders SET order_folio = 'GRNHL-' || LPAD(id::text, 6, '0') WHERE order_folio IS NULL OR order_folio = '';

    -- Migraciones de ejemplo para tabla 'order_items'
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS order_folio VARCHAR(50); -- Añadir order_folio si falta
    ALTER TABLE order_items ALTER COLUMN order_folio SET NOT NULL; -- Asegurar que sea NOT NULL
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(255);
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS quantity INTEGER;
    ALTER TABLE order_items ADD COLUMN IF NOT EXISTS price NUMERIC(10, 2);
    -- Si necesitas que sean NOT NULL (como en este schema.js):
    ALTER TABLE order_items ALTER COLUMN product_name SET NOT NULL;
    ALTER TABLE order_items ALTER COLUMN quantity SET NOT NULL;
    ALTER TABLE order_items ALTER COLUMN price SET NOT NULL;
    -- Si ya tenías order_items y necesitas rellenar el order_folio:
    -- UPDATE order_items oi SET order_folio = o.order_folio FROM orders o WHERE oi.order_id = o.id AND oi.order_folio IS NULL;
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
    console.error("❌ Error CRÍTICO al conectar o configurar la base de datos:", err.stack);
    // Termina el proceso si hay un error crítico en la configuración de la DB al inicio
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