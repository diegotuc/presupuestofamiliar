const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

const DATA_FILE = path.join(__dirname, 'data.json');

// Middlewares para procesar JSON y servir la carpeta pública
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Función para leer el archivo JSON de forma segura
function leerDatos() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify({ movimientos: [] }, null, 2));
        }
        const data = fs.readFileSync(DATA_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error al leer el archivo JSON:", error);
        return { movimientos: [] };
    }
}

// Función para escribir en el archivo JSON
function guardarDatos(datos) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(datos, null, 2), 'utf-8');
    } catch (error) {
        console.error("Error al guardar en el archivo JSON:", error);
    }
}

// Ruta para obtener todos los movimientos y balances
app.get('/api/finanzas', (req, res) => {
    res.json(leerDatos());
});

// Ruta para agregar un nuevo movimiento (gasto o ingreso)
app.post('/api/finanzas', (req, res) => {
    const { tipo, usuario, monto, descripcion } = req.body;
    
    if (!tipo || !usuario || isNaN(monto) || !descripcion) {
        return res.status(400).json({ error: "Datos faltantes o inválidos." });
    }

    const datos = leerDatos();
    const nuevoMovimiento = {
        id: Date.now(),
        fecha: new Date().toLocaleDateString('es-AR'),
        tipo,
        usuario,
        monto: parseFloat(monto),
        descripcion
    };

    datos.movimientos.unshift(nuevoMovimiento); // Los más nuevos primero
    guardarDatos(datos);

    res.status(201).json(nuevoMovimiento);
});

// Ruta para eliminar un movimiento del historial por ID
app.delete('/api/finanzas/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const datos = leerDatos();
    const longitudInicial = datos.movimientos.length;
    
    datos.movimientos = datos.movimientos.filter(mov => mov.id !== id);

    if (datos.movimientos.length === longitudInicial) {
        return res.status(404).json({ error: "Movimiento no encontrado." });
    }

    guardarDatos(datos);
    res.json({ mensaje: "Movimiento eliminado con éxito." });
});

// Arrancar el servidor en el puerto 3000
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(`🚀 Servidor listo para la familia Saltor Martínez`);
    console.log(`💻 Acceso local: http://localhost:${PORT}`);
    console.log(`==================================================`);
});
