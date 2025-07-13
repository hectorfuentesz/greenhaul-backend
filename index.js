const express = require('express');
const cors = require('cors');
const { db, connectAndSetupDatabase } = require('./database.js');
const bcrypt = require('bcryptjs');

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

// Ruta para iniciar sesión
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Correo no registrado.' });
    }
    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Contraseña incorrecta.' });
    }

    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      user: { id: user.id, name: user.name, email: user.email, whatsapp: user.whatsapp }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor.' });
  }
});

// ==========================================================
// ===== RUTA PARA ACTUALIZAR PERFIL (AÑADIDA Y FUNCIONAL) =====
// ==========================================================
app.put('/api/users/:id', async (req, res) => {
    try {
        const { email, whatsapp } = req.body;
        const { id } = req.params;

        if (!email && !whatsapp) {
            return res.status(400).json({ message: 'No hay datos para actualizar.' });
        }

        // Construir la consulta SQL dinámicamente para actualizar solo los campos enviados
        let updates = [];
        const values = [];
        let queryIndex = 1;

        if (email) {
            updates.push(`email = $${queryIndex++}`);
            values.push(email);
        }
        if (whatsapp) {
            updates.push(`whatsapp = $${queryIndex++}`);
            values.push(whatsapp);
        }

        const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = $${queryIndex} RETURNING *`;
        values.push(id);

        const result = await db.query(sql, values);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        
        res.status(200).json({ 
            message: 'Perfil actualizado con éxito.',
            user: result.rows[0]
        });

    } catch (err) {
        // Manejo de error si el nuevo email ya está en uso
        if (err.code === '23505') { // Código de error de PostgreSQL para violación de unicidad
            return res.status(400).json({ message: 'El correo electrónico ya está en uso por otra cuenta.' });
        }
        console.error("Error en /api/users/:id :", err);
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