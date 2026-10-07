const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());

// Servir la vista (HTML/CSS/JS de la raíz) de forma automática
app.use(express.static(path.join(__dirname, '../')));

let client;
let db;

async function conectarDB() {
    if (client && db) {
        return db.collection('movimientos');
    }
    client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    await client.connect();
    db = client.db('PresupuestoHogar');
    console.log("==> Conectado con éxito a MongoDB Atlas");
    return db.collection('movimientos');
}

// 1. OBTENER MOVIMIENTOS (GET)
app.get('/api/server', async (req, res) => {
    try {
        const coleccion = await conectarDB();
        const movimientos = await coleccion.find({}).sort({ id: -1 }).toArray();
        return res.status(200).json({ movimientos });
    } catch (error) {
        console.error("Error en GET /api/server:", error);
        return res.status(500).json({ error: error.message });
    }
});

// 2. GUARDAR MOVIMIENTO (POST)
app.post('/api/server', async (req, res) => {
    try {
        const coleccion = await conectarDB();
        const nuevoMovimiento = req.body;

        if (!nuevoMovimiento.monto || !nuevoMovimiento.descripcion) {
            return res.status(400).json({ error: 'Datos incompletos' });
        }

        await coleccion.insertOne(nuevoMovimiento);
        return res.status(201).json({ mensaje: 'Movimiento guardado con éxito' });
    } catch (error) {
        console.error("Error en POST /api/server:", error);
        return res.status(500).json({ error: error.message });
    }
});

// 3. ELIMINAR MOVIMIENTO (DELETE)
app.delete('/api/server', async (req, res) => {
    try {
        const id = req.query.id;
        if (!id) {
            return res.status(400).json({ error: 'ID requerido' });
        }

        const coleccion = await conectarDB();
        await coleccion.deleteOne({ id: parseInt(id) });
        return res.status(200).json({ mensaje: 'Movimiento eliminado con éxito' });
    } catch (error) {
        console.error("Error en DELETE /api/server:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Si no es una ruta de la API, envía el index.html de forma directa y universal
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(PORT, () => {
    console.log(`==> Servidor corriendo en el puerto ${PORT}`);
});



app.listen(PORT, () => {
    console.log(`==> Servidor corriendo en el puerto ${PORT}`);
});
