document.addEventListener("DOMContentLoaded", cargarMovimientos);

const formTransaccion = document.getElementById("form-transaccion");

// Evento para capturar el formulario y mandarlo al backend Node
formTransaccion.addEventListener("submit", async (e) => {
    e.preventDefault();

    const movimiento = {
        tipo: document.getElementById("tipo").value,
        usuario: document.getElementById("usuario").value,
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
            cargarMovimientos(); // Recargar de forma reactiva e instantánea
        }
    } catch (error) {
        console.error("Error al registrar movimiento:", error);
    }
});

// Cargar movimientos directo desde la API de Node
async function cargarMovimientos() {
    try {
        const res = await fetch('/api/finanzas');
        const datos = await res.json();
        actualizarInterfaz(datos.movimientos || []);
    } catch (error) {
        console.error("Error al cargar los movimientos del servidor:", error);
    }
}

// Calcular balances y pintar la UI
function actualizarInterfaz(movimientos) {
    let totalGlobal = 0;
    let totalEsposo = 0;
    let totalEsposa = 0;

    const listaContenedor = document.getElementById("lista-transacciones");
    listaContenedor.innerHTML = ""; // Reset de la tabla

    movimientos.forEach(mov => {
        if (mov.tipo === "ingreso") {
            totalGlobal += mov.monto;
            if (mov.usuario === "esposo") totalEsposo += mov.monto;
            if (mov.usuario === "esposa") totalEsposa += mov.monto;
        } else if (mov.tipo === "gasto") {
            totalGlobal -= mov.monto;
            if (mov.usuario === "esposo") totalEsposo -= mov.monto;
            if (mov.usuario === "esposa") totalEsposa -= mov.monto;
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${mov.fecha}</td>
            <td style="text-transform: capitalize;">${mov.usuario}</td>
            <td>${mov.descripcion}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">${mov.tipo.toUpperCase()}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">
                ${mov.tipo === 'ingreso' ? '+' : '-'}$${mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td><button class="btn-borrar" onclick="eliminarMovimiento(${mov.id})">❌</button></td>
        `;
        listaContenedor.appendChild(tr);
    });

    // Formatear visualmente las tarjetas en pantalla
    document.getElementById("total-global").innerText = `$${totalGlobal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("total-usuario-a").innerText = `$${totalEsposo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById("total-usuario-b").innerText = `$${totalEsposa.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Petición DELETE a la API de Node
async function eliminarMovimiento(id) {
    if (confirm("¿Estás seguro de que querés borrar de forma permanente este movimiento del registro?")) {
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
