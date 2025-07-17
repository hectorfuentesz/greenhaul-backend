// Archivo: database.js (Versión Final, Completa y Corregida para NULLS)

const { Client } = require('pg');

// Configuración de la conexión a PostgreSQL.
// Utiliza la variable de entorno DATABASE_URL proporcionada por Railway o tu entorno local.
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Es importante configurar SSL para conexiones a bases de datos en la nube como Railway.
    // En desarrollo, `rejectUnauthorized: false` puede ser necesario si no tienes un certificado CA validado.
    // Para producción, se recomienda una configuración SSL más estricta si es posible y si el proveedor de DB lo permite.
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
// Se han añadido columnas para 'name', 'neighborhood', '"references"', 'latitude', y 'longitude'.
// Nota: "references" está entre comillas dobles porque 'REFERENCES' es una palabra clave reservada en SQL.
// ¡IMPORTANTE! 'latitude' y 'longitude' NO tienen 'NOT NULL', permitiendo que sean opcionales.
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
    "references" TEXT,            -- ¡CORRECCIÓN CLAVE! Descripción o referencias adicionales sobre la ubicación.
    latitude NUMERIC(10, 7),      -- Latitud de la ubicación geográfica (precisión 7 decimales para mapas), AHORA ES OPCIONAL
    longitude NUMERIC(10, 7),     -- Longitud de la ubicación geográfica (precisión 7 decimales para mapas), AHORA ES OPCIONAL
    country VARCHAR(100) DEFAULT 'México', -- País (valor por defecto 'México')
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP -- Marca de tiempo de cuándo fue creada esta dirección
  );
`;

// Tabla 'orders': Almacena información general sobre los pedidos/mudanzas de los usuarios.
// Se ha añadido la columna 'status' con un valor por defecto.
const createTableQueryOrders = `
  CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,        -- Identificador único auto-incremental para la orden
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Clave foránea al ID del usuario; si el usuario se elimina, user_id se hace NULL
    total_amount NUMERIC(10, 2) NOT NULL, -- Monto total del pedido
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Fecha y hora de creación del pedido
    status VARCHAR(50) DEFAULT 'activo' -- Estado actual del pedido (ej. 'activo', 'completado', 'cancelado', 'pendiente')
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
    await client.connect();
    console.log('✅ Conectado exitosamente a la base de datos PostgreSQL en Railway.');
    
    // Ejecutar la creación de tablas. Cada `client.query` ejecuta la sentencia SQL.
    // La cláusula `IF NOT EXISTS` previene errores si las tablas ya existen.
    
    // ATENCIÓN: Si ya tenías tu base de datos creada en Railway con las columnas
    // 'latitude' y 'longitude' definidas como NOT NULL, y deseas que sean opcionales,
    // DEBES ejecutar manualmente los comandos ALTER TABLE en tu consola SQL de Railway.
    // Aquí están los comandos ALTER TABLE que necesitarías ejecutar para que sean NULLABLE:
    /*
    ALTER TABLE addresses ALTER COLUMN latitude DROP NOT NULL;
    ALTER TABLE addresses ALTER COLUMN longitude DROP NOT NULL;
    */
    // (Asegúrate también de que 'name', 'neighborhood', y "references" existan y permitan NULLs si es tu intención).
    // Comandos completos para añadir y asegurar NULLABLE para todas las nuevas columnas:
    /*
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(255);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS "references" TEXT;
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7);
    ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

    ALTER TABLE addresses ALTER COLUMN name DROP NOT NULL; -- Haz que sea NULLABLE si fue creada con NOT NULL por defecto
    ALTER TABLE addresses ALTER COLUMN neighborhood DROP NOT NULL; -- Haz que sea NULLABLE
    ALTER TABLE addresses ALTER COLUMN "references" DROP NOT NULL; -- Haz que sea NULLABLE
    ALTER TABLE addresses ALTER COLUMN latitude DROP NOT NULL; -- Haz que sea NULLABLE
    ALTER TABLE addresses ALTER COLUMN longitude DROP NOT NULL; -- Haz que sea NULLABLE

    ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'activo';
    ALTER TABLE orders ALTER COLUMN status DROP NOT NULL; -- Si quieres que status sea NULLABLE además de tener default
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
    // Si la conexión o configuración de la base de datos falla, el proceso debe salir
    // para evitar que la aplicación intente funcionar sin una DB funcional.
    process.exit(1); 
  }
}

// Exporta el cliente de la base de datos (`db`) para que pueda ser utilizado en `index.js`
// y la función `connectAndSetupDatabase` para iniciar la conexión.
module.exports = {
  db: client,
  connectAndSetupDatabase
};