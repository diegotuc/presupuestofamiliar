// Variable de Estado del Filtro Activo: 'hoy', 'mes', o 'archivo'
let filtroActivo = 'hoy';
let mesSeleccionadoArchivo = '';

document.addEventListener("DOMContentLoaded", () => {
    inicializarArchivo();
    cargarMovimientos();
});

const formTransaccion = document.getElementById("form-transaccion");

// 1. REGISTRAR MOVIMIENTO (POST)
if (formTransaccion) {
    formTransaccion.addEventListener("submit", async (e) => {
        e.preventDefault();

        const hoy = new Date();
        const fechaFormateada = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
        const llaveMesActual = `${String(hoy.getMonth() + 1).padStart(2, '0')}-${hoy.getFullYear()}`;

        const movimiento = {
            id: Date.now(),
            fecha: fechaFormateada,
            llaveMes: llaveMesActual,
            tipo: document.getElementById("tipo").value,
            usuario: document.getElementById("usuario").value, 
            monto: parseFloat(document.getElementById("monto").value),
            descripcion: document.getElementById("descripcion").value
        };

        try {
            const res = await fetch('https://onrender.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movimiento)
            });

            if (res.ok) {
                formTransaccion.reset();
                cargarMovimientos();
            } else {
                alert("Error en el servidor al guardar.");
            }
        } catch (error) {
            console.error("Error al registrar movimiento:", error);
        }
    });
}

// 2. CARGAR MOVIMIENTOS (GET)
async function cargarMovimientos() {
    try {
        const res = await fetch('https://onrender.com');
        const datos = await res.json();
        const movimientosMesActual = datos.movimientos || [];
        
        actualizarTodosLosBalances(movimientosMesActual);
        procesarYRenderizarTabla(movimientosMesActual);
    } catch (error) {
        console.error("Error al cargar los movimientos:", error);
    }
}

// 3. ELIMINAR MOVIMIENTO (DELETE)
async function eliminarMovimiento(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este movimiento?")) return;
    
    try {
        const res = await fetch(`https://onrender.com?id=${id}`, {
            method: 'DELETE'
        });

        if (res.ok) {
            cargarMovimientos();
        } else {
            alert("No se pudo eliminar el movimiento.");
        }
    } catch (error) {
        console.error("Error al eliminar movimiento:", error);
    }
}

function actualizarTodosLosBalances(movimientosMesActual) {
    const hoyStr = obtenerFechaHoyString();
    let acumuladoGlobal = 0;
    
    const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
    Object.values(archivoHistorico).forEach(listaMes => {
        listaMes.forEach(mov => {
            acumuladoGlobal += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
        });
    });

    movimientosMesActual.forEach(mov => {
        acumuladoGlobal += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
    });

    let acumuladoDiario = 0;
    movimientosMesActual.filter(mov => mov.fecha === hoyStr).forEach(mov => {
        acumuladoDiario += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
    });

    let acumuladoDiego = 0;
    let acumuladoRomina = 0;
    movimientosMesActual.forEach(mov => {
        if (mov.usuario === 'Diego') acumuladoDiego += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
        if (mov.usuario === 'Romina') acumuladoRomina += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
    });

    if(document.getElementById("total-global")) document.getElementById("total-global").innerText = formatMoneda(acumuladoGlobal);
    if(document.getElementById("total-diario")) document.getElementById("total-diario").innerText = formatMoneda(acumuladoDiario);
    if(document.getElementById("total-usuario-a")) document.getElementById("total-usuario-a").innerText = formatMoneda(acumuladoDiego);
    if(document.getElementById("total-usuario-b")) document.getElementById("total-usuario-b").innerText = formatMoneda(acumuladoRomina);
}

function procesarYRenderizarTabla(movimientosMesActual) {
    let movimientosAMostrar = [];
    const btnCerrarMes = document.getElementById("btn-cerrar-mes");
    const divSelectorArchivo = document.getElementById("contenedor-selector-archivo");

    if (divSelectorArchivo) divSelectorArchivo.className = "selector-archivo-oculto";
    if (btnCerrarMes) btnCerrarMes.style.display = "none";

    if (filtroActivo === 'hoy') {
        const hoyStr = obtenerFechaHoyString();
        movimientosAMostrar = movimientosMesActual.filter(mov => mov.fecha === hoyStr);
    } 
    else if (filtroActivo === 'mes') {
        movimientosAMostrar = movimientosMesActual;
        if (btnCerrarMes) btnCerrarMes.style.display = "block";
    } 
    else if (filtroActivo === 'archivo') {
        if (divSelectorArchivo) divSelectorArchivo.className = "selector-archivo-visible";
        const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
        movimientosAMostrar = archivoHistorico[mesSeleccionadoArchivo] || [];
    }

    renderizarFilasTabla(movimientosAMostrar);
}

function renderizarFilasTabla(movimientos) {
    const listaContenedor = document.getElementById("lista-transacciones");
    if (!listaContenedor) return;
    
    listaContenedor.innerHTML = ""; 

    if (movimientos.length === 0) {
        listaContenedor.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#7f8c8d;">No hay movimientos registrados para este período.</td></tr>`;
        return;
    }

    movimientos.forEach(mov => {
        const tr = document.createElement("tr");
        const celdaAccion = (filtroActivo === 'archivo') 
            ? `<td>🔒 Archivo</td>` 
            : `<td><button class="btn-borrar" onclick="eliminarMovimiento(${mov.id})">❌</button></td>`;

        tr.innerHTML = `
            <td>${mov.fecha}</td>
            <td style="text-transform: capitalize; font-weight: 500;">${mov.usuario}</td>
            <td>${mov.descripcion}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">${mov.tipo.toUpperCase()}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">
                ${mov.tipo === 'ingreso' ? '+' : '-'}$${mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </td>
            ${celdaAccion}
        `;
        listaContenedor.appendChild(tr);
    });
}

function cambiarFiltro(nuevoFiltro) {
    filtroActivo = nuevoFiltro;
    document.querySelectorAll(".btn-tab").forEach(btn => btn.classList.remove("activo"));
    const tabBtn = document.getElementById(`tab-${nuevoFiltro}`);
    if (tabBtn) tabBtn.classList.add("activo");
    cargarMovimientos();
}

function inicializarArchivo() {
    if (!localStorage.getItem('archivo_historico')) {
        localStorage.setItem('archivo_historico', JSON.stringify({}));
    }
}

function obtenerFechaHoyString() {
    const hoy = new Date();
    return `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
}

function formatMoneda(valor) {
    return (valor >= 0 ? '' : '-') + '\$' + Math.abs(valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
