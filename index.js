// --- 1. IMPORTACIONES ---
const express = require('express');
const cors = require('cors');
const { db, setupDatabase } = require('./database.js'); // Importamos la DB y la función de setup
const bcrypt = require('bcryptjs');

// --- 2. CONFIGURACIÓN INICIAL ---
const app = express();
// Railway nos dará el puerto, pero usamos 3000 como alternativa para desarrollo local
const PORT = process.env.PORT || 3000;

// --- 3. MIDDLEWARES ---
app.use(cors());          // Permite la comunicación entre front-end y back-end
app.use(express.json());  // Permite al servidor entender el formato JSON

// --- 4. RUTAS DE LA API ---

// Ruta de bienvenida para verificar que el servidor está vivo
app.get('/', (req, res) => {
  res.send('🚀 ¡Servidor de GreenHaul funcionando y listo para recibir peticiones!');
});

/**
 * @route   POST /api/register
 * @desc    Registra un nuevo usuario de forma segura
 */
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, whatsapp } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nombre, email y contraseña son campos obligatorios.' });
    }
    if (whatsapp && (whatsapp.length !== 10 || !/^\d+$/.test(whatsapp))) {
        return res.status(400).json({ message: 'El número de WhatsApp debe tener 10 dígitos.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const sql = 'INSERT INTO users (name, email, password, whatsapp) VALUES ($1, $2, $3, $4) RETURNING id';
    const values = [name, email, hashedPassword, whatsapp];
    
    const result = await db.query(sql, values);
    
    console.log(`✅ Usuario registrado con éxito. ID: ${result.rows[0].id}`);
    res.status(201).json({ 
        message: 'Usuario registrado con éxito.', 
        userId: result.rows[0].id 
    });

  } catch (err) {
    // Si el error es por 'email' duplicado
    if (err.code === '23505') { // Código de error de PostgreSQL para violación de unicidad
        return res.status(400).json({ message: 'El correo electrónico ya está registrado.' });
    }
    console.error("Error en /api/register:", err.message);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});

/**
 * @route   POST /api/login
 * @desc    Autentica (inicia sesión) a un usuario
 */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
          return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
        }

        const sql = 'SELECT * FROM users WHERE email = $1';
        const result = await db.query(sql, [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Credenciales inválidas.' });
        }

        res.json({
            message: 'Inicio de sesión exitoso',
            user: { id: user.id, name: user.name, email: user.email }
        });

    } catch(err) {
        console.error("Error en /api/login:", err.message);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
});


// --- 5. FUNCIÓN PARA INICIAR TODO ---
async function startApp() {
  // Primero, nos aseguramos de que la base de datos esté conectada y lista
  await setupDatabase();
  
  // Solo después, encendemos el servidor para que empiece a escuchar peticiones
  app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en el puerto ${PORT}`);
  });
}

// --- Ejecutamos la función para iniciar la aplicación ---
startApp();