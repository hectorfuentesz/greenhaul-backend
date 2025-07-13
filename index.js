const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { db, connectAndSetupDatabase } = require('./database.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares para permitir la comunicación y entender JSON
app.use(cors());
app.use(express.json());

// Ruta de prueba para confirmar que el backend funciona
app.get('/', (req, res) => {
  res.send('✅ Backend GreenHaul funcionando correctamente 🚛');
});

// Ruta para registrar un nuevo usuario
app.post('/api/register', async (req, res) => {
  const { name, email, password, whatsapp } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios.' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const sql = 'INSERT INTO users (name, email, password, whatsapp) VALUES ($1, $2, $3, $4) RETURNING id';
    const values = [name, email, hashedPassword, whatsapp];
    const result = await db.query(sql, values);
    res.status(201).json({ message: 'Usuario registrado.', userId: result.rows[0].id });
  } catch (err) {
    res.status(400).json({ message: 'El correo ya está registrado.' });
  }
});

// ==========================================================
// ===== RUTA DE LOGIN (CORREGIDA Y MÁS ROBUSTA) =====
// ==========================================================
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Correo y contraseña son obligatorios.' });
  }

  try {
    const sql = 'SELECT * FROM users WHERE email = $1';
    const result = await db.query(sql, [email]);

    // Si no se encuentra ningún usuario con ese email
    if (result.rows.length === 0) {
      // Enviamos un error 401 (No autorizado) para que el front-end lo sepa
      return res.status(401).json({ message: 'Credenciales inválidas.' }); 
    }

    const user = result.rows[0];
    
    // Comparamos la contraseña enviada con la encriptada en la base de datos
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      // Si la contraseña no coincide, enviamos el mismo error genérico
      return res.status(401).json({ message: 'Credenciales inválidas.' });
    }

    // Si todo es correcto, enviamos los datos del usuario para que el front-end los guarde
    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        whatsapp: user.whatsapp 
      }
    });
  } catch (err) {
    console.error("Error en el servidor durante el login:", err);
    res.status(500).json({ message: 'Error interno del servidor.' });
  }
});


// Función que asegura que la base de datos esté lista antes de iniciar el servidor
async function startServer() {
  await connectAndSetupDatabase();
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
  });
}

// Inicia la aplicación
startServer();