const { Client } = require('pg');

// Función asíncrona para conectar a la base de datos y preparar la tabla
async function connectAndSetupDatabase() {
    // Crea una nueva instancia del cliente DENTRO de la función
    // para asegurarse de que las variables de entorno ya estén cargadas.
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    try {
        // 1. Conecta el cliente a la base de datos de Railway
        await client.connect();
        console.log('✅ Conexión exitosa a la base de datos PostgreSQL en Railway.');

        // 2. Define la estructura de la tabla de usuarios
        const createTableQuery = `
          CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            whatsapp VARCHAR(20)
          );
        `;
        
        // 3. Ejecuta la consulta para crear la tabla
        await client.query(createTableQuery);
        console.log("👍 Tabla 'users' verificada y lista para usarse.");

        // 4. Devuelve el cliente ya conectado y listo
        return client;

    } catch (err) {
        console.error("❌ ERROR: No se pudo conectar o configurar la base de datos.");
        console.error(err.stack);
        // Si hay un error aquí, detenemos el proceso para que el log de Railway muestre el error claramente
        process.exit(1);
    }
}

// Exportamos únicamente la función que inicia todo
module.exports = { connectAndSetupDatabase };