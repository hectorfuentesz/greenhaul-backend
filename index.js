const express = require('express');
const cors = require('cors');
// Importamos la función de configuración de la base de datos
const { connectAndSetupDatabase } = require('./database.js'); 
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// Función principal asíncrona para iniciar toda la aplicación
async function startApp() {
    // 1. Conecta y configura la base de datos y obtén el cliente
    const db = await connectAndSetupDatabase();
    
    // 2. Solo después de que la BD esté lista, configura los middlewares
    app.use(cors());
    app.use(express.json());

    // --- 3. RUTAS DE LA API ---

    app.get('/', (req, res) => {
      res.send('🚀 Servidor de GreenHaul funcionando y conectado a la base de datos!');
    });

    app.post('/api/register', async (req, res) => {
        try {
            const { name, email, password, whatsapp } = req.body;
            if (!name || !email || !password) {
                return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
            }
            const hashedPassword = await bcrypt.hash(password, 10);
            const sql = 'INSERT INTO users (name, email, password, whatsapp) VALUES ($1, $2, $3, $4) RETURNING id';
            const values = [name, email, hashedPassword, whatsapp];
            const result = await db.query(sql, values);
            res.status(201).json({ message: 'Usuario registrado.', userId: result.rows[0].id });
        } catch (err) {
            res.status(400).json({ message: 'El correo ya está registrado.' });
        }
    });
    
    // Aquí puedes añadir la ruta /api/login si la necesitas

    // 4. Finalmente, enciende el servidor para que escuche peticiones
    app.listen(PORT, () => {
        console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
    });
}

// --- Inicia todo el proceso ---
startApp();