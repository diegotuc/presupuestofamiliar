const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
let client;
let db;

async function conectarDB() {
    // Si ya existe la conexión, la reutilizamos para no saturar a MongoDB
    if (client && db) {
        return db.collection('movimientos');
    }
    
    // Configuración obligatoria para conexiones estables en la nube de Vercel
    client = new MongoClient(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    
    await client.connect();
    db = client.db('PresupuestoHogar'); // Tu base de datos original de Compass
    return db.collection('movimientos');
}

// Función para leer el cuerpo de la petición (body) en formato JSON
async function leerBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch (err) {
                resolve({});
            }
        });
        req.on('error', (err) => reject(err));
    });
}

module.exports = async (req, res) => {
    // Habilitar CORS para que tu celular y PC puedan conectarse sin bloqueos de red
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const coleccion = await conectarDB();

        // 1. OBTENER MOVIMIENTOS (GET)
        if (req.method === 'GET') {
            const movimientos = await coleccion.find({}).sort({ id: -1 }).toArray();
            return res.status(200).json({ movimientos });
        }

        // 2. GUARDAR MOVIMIENTO (POST)
        if (req.method === 'POST') {
            const nuevoMovimiento = await leerBody(req);
            
            // Validar que el movimiento tenga datos válidos antes de guardar
            if (!nuevoMovimiento.monto || !nuevoMovimiento.descripcion) {
                return res.status(400).json({ error: 'Datos incompletos' });
            }

            await coleccion.insertOne(nuevoMovimiento);
            return res.status(201).json({ mensaje: 'Movimiento guardado con éxito' });
        }

        // 3. ELIMINAR MOVIMIENTO (DELETE)
        if (req.method === 'DELETE') {
            const urlParams = new URL(req.url, `http://${req.headers.host}`);
            const id = urlParams.searchParams.get('id');
            
            if (!id) {
                return res.status(400).json({ error: 'ID requerido' });
            }

            await coleccion.deleteOne({ id: parseInt(id) });
            return res.status(200).json({ mensaje: 'Movimiento eliminado con éxito' });
        }

        return res.status(405).json({ error: 'Método no permitido' });

    } catch (error) {
        console.error("Error crítico en servidor Vercel:", error);
        return res.status(500).json({ error: error.message });
    }
};
