const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;
const uri = process.env.MONGODB_URI;

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const rootPath = path.join(__dirname, '../');
app.use(express.static(rootPath));

let client;
let db;

async function conectarDB() {
    if (client && db) {
        return db.collection('movimientos');
    }
    // CONEXIÓN MODERNA OBLIGATORIA: Sin parámetros obsoletos que causan el error 500
    client = new MongoClient(uri);
    await client.connect();
    db = client.db('PresupuestoHogar');
    return db.collection('movimientos');
}

// 1. OBTENER MOVIMIENTOS (GET)
app.get('/api/server', async (req, res) => {
    try {
        const coleccion = await conectarDB();
        const movimientos = await coleccion.find({}).sort({ id: -1 }).toArray();
        return res.status(200).json({ movimientos });
    } catch (error) {
        console.error("Error en GET:", error);
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
        console.error("Error en POST:", error);
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
        console.error("Error en DELETE:", error);
        return res.status(500).json({ error: error.message });
    }
});

// Enrutamiento estático universal
app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.join(rootPath, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`==> Servidor corriendo en el puerto ${PORT}`);
});
