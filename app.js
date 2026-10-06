document.addEventListener("DOMContentLoaded", cargarMovimientos);

const formTransaccion = document.getElementById("form-transaccion");

formTransaccion.addEventListener("submit", (e) => {
    e.preventDefault();

    // Obtener la fecha de hoy formateada (DD/MM/AAAA)
    const hoy = new Date();
    const fechaFormateada = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;

    // Estructura del movimiento con ID único y fecha
    const movimiento = {
        id: Date.now(), // Genera un ID numérico único basado en el tiempo
        fecha: fechaFormateada,
        tipo: document.getElementById("tipo").value,
        usuario: document.getElementById("usuario").value, 
        monto: parseFloat(document.getElementById("monto").value),
        descripcion: document.getElementById("descripcion").value
    };

    try {
        // Leer los movimientos existentes en localStorage
        const datosGuardados = localStorage.getItem('mis_movimientos');
        let movimientos = datosGuardados ? JSON.parse(datosGuardados) : [];

        // Agregar el nuevo movimiento al principio de la lista
        movimientos.unshift(movimiento);

        // Guardar la lista actualizada en el navegador
        localStorage.setItem('mis_movimientos', JSON.stringify(movimientos));

        // Limpiar el formulario y recargar la interfaz
        formTransaccion.reset();
        cargarMovimientos();

    } catch (error) {
        console.error("Error al registrar movimiento:", error);
    }
});

function cargarMovimientos() {
    try {
        // Leer los datos directamente desde el almacenamiento local
        const datosGuardados = localStorage.getItem('mis_movimientos');
        const movimientos = datosGuardados ? JSON.parse(datosGuardados) : [];
        
        actualizarInterfaz(movimientos);
    } catch (error) {
        console.error("Error al cargar los movimientos del almacenamiento local:", error);
    }
}

function actualizarInterfaz(movimientos) {
    let totalGlobal = 0;
    let totalDiego = 0;
    let totalRomina = 0;

    const listaContenedor = document.getElementById("lista-transacciones");
    listaContenedor.innerHTML = ""; 

    movimientos.forEach(mov => {
        // Validación retroactiva mantenida de tu código original
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
            <td>${mov.fecha || '-'}</td>
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

function eliminarMovimiento(id) {
    if (confirm("¿Estás seguro de que querés borrar este movimiento?")) {
        try {
            // Leer la lista actual
            const datosGuardados = localStorage.getItem('mis_movimientos');
            let movimientos = datosGuardados ? JSON.parse(datosGuardados) : [];

            // Filtrar la lista para quitar el elemento que coincida con el ID
            movimientos = movimientos.filter(mov => mov.id !== id);

            // Guardar la nueva lista limpia en el navegador
            localStorage.setItem('mis_movimientos', JSON.stringify(movimientos));

            // Volver a renderizar la tabla
            cargarMovimientos();
        } catch (error) {
            console.error("Error al intentar eliminar el registro:", error);
        }
    }
}
