const { Client } = require('pg');

const client = new Client({
  // Esta línea lee la URL de conexión que Railway te da automáticamente
  connectionString: process.env.DATABASE_URL,
  // Necesario para las conexiones en entornos de producción como Railway
  ssl: {
    rejectUnauthorized: false
  }
});

client.connect()
  .then(() => console.log('Conectado exitosamente a la base de datos PostgreSQL en Railway.'))
  .catch(err => console.error('Error en la conexión a la base de datos:', err.stack));

module.exports = client;