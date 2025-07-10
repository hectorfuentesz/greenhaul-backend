const express = require('express');
const cors = require('cors');
// Importamos los dos elementos de database.js
const { db, connectAndSetupDatabase } = require('./database.js'); 
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- RUTAS DE LA API (SIN CAMBIOS) ---
app.get('/', (req, res) => {
  res.send('¡Servidor de GreenHaul funcionando!');
});

app.post('/api/register', async (req, res) => {
    const { name, email, password, whatsapp } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Campos obligatorios.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (name, email, password, whatsapp) VALUES ($1, $2, $3, $4) RETURNING id';
    const values = [name, email, hashedPassword, whatsapp];
    try {
        const result = await db.query(sql, values);
        res.status(201).json({ message: 'Usuario registrado.', userId: result.rows[0].id });
    } catch (err) {
        res.status(400).json({ message: 'El correo ya está registrado.' });
    }
});

// ... (Aquí iría la ruta de /api/login que ya funciona)


// --- FUNCIÓN PARA INICIAR EL SERVIDOR ---
async function startServer() {
  // 1. Conecta y configura la base de datos
  await connectAndSetupDatabase();
  
  // 2. Una vez que la BD está lista, enciende el servidor
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
}

// --- Inicia todo el proceso ---
startServer();