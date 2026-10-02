document.addEventListener("DOMContentLoaded", cargarMovimientos);

const formTransaccion = document.getElementById("form-transaccion");

formTransaccion.addEventListener("submit", async (e) => {
    e.preventDefault();

    const movimiento = {
        tipo: document.getElementById("tipo").value,
        usuario: document.getElementById("usuario").value, // Captura "Diego" o "Romina"
        monto: parseFloat(document.getElementById("monto").value),
        descripcion: document.getElementById("descripcion").value
    };

    try {
        const res = await fetch('/api/finanzas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(movimiento)
        });

        if (res.ok) {
            formTransaccion.reset();
            cargarMovimientos();
        }
    } catch (error) {
        console.error("Error al registrar movimiento:", error);
    }
});

async function cargarMovimientos() {
    try {
        const res = await fetch('/api/finanzas');
        const datos = await res.json();
        actualizarInterfaz(datos.movimientos || []);
    } catch (error) {
        console.error("Error al cargar los movimientos del servidor:", error);
    }
}

function actualizarInterfaz(movimientos) {
    let totalGlobal = 0;
    let totalDiego = 0;
    let totalRomina = 0;

    const listaContenedor = document.getElementById("lista-transacciones");
    listaContenedor.innerHTML = ""; 

    movimientos.forEach(mov => {
        // Validación retroactiva: Si dice "esposo" va para Diego, si dice "esposa" va para Romina
        let usuarioNormalizado = mov.usuario;
        if (mov.usuario === "esposo") usuarioNormalizado = "Diego";
        if (mov.usuario === "esposa") usuarioNormalizado = "Romina";

        if (mov.tipo === "ingreso") {
            totalGlobal += mov.monto;
            if (usuarioNormalizado === "Diego") totalDiego += mov.monto;
            if (usuarioNormalizado === "Romina") totalRomina += mov.monto;
        } else if (mov.tipo === "gasto") {
            totalGlobal -= mov.monto;
            if (usuarioNormalizado === "Diego") totalDiego -= mov.monto;
            if (usuarioNormalizado === "Romina") totalRomina -= mov.monto;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${mov.fecha}</td>
            <td style="text-transform: capitalize; font-weight: 500;">${usuarioNormalizado}</td>
            <td>${mov.descripcion}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">${mov.tipo.toUpperCase()}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">
                ${mov.tipo === 'ingreso' ? '+' : '-'}$${mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td><button class="btn-borrar" onclick="eliminarMovimiento(${mov.id})">❌</button></td>
        `;
        listaContenedor.appendChild(tr);
    });

    document.getElementById("total-global").innerText = `$${totalGlobal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("total-usuario-a").innerText = `$${totalDiego.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("total-usuario-b").innerText = `$${totalRomina.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function eliminarMovimiento(id) {
    if (confirm("¿Estás seguro de que querés borrar este movimiento?")) {
        try {
            const res = await fetch(`/api/finanzas/${id}`, { method: 'DELETE' });
            if (res.ok) {
                cargarMovimientos();
            }
        } catch (error) {
            console.error("Error al intentar eliminar el registro:", error);
        }
    }
}
