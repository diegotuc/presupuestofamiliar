// Variable de Estado del Filtro Activo: 'hoy', 'mes', o 'archivo'
let filtroActivo = 'hoy';
let mesSeleccionadoArchivo = '';

document.addEventListener("DOMContentLoaded", () => {
    inicializarArchivo();
    cargarMovimientos();
});

const formTransaccion = document.getElementById("form-transaccion");

formTransaccion.addEventListener("submit", (e) => {
    e.preventDefault();

    const hoy = new Date();
    const fechaFormateada = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
    const llaveMesActual = `${String(hoy.getMonth() + 1).padStart(2, '0')}-${hoy.getFullYear()}`; // Formato "MM-AAAA"

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
        // Los movimientos activos se guardan siempre en la lista del mes corriente
        const datosGuardados = localStorage.getItem('mis_movimientos');
        let movimientos = datosGuardados ? JSON.parse(datosGuardados) : [];

        movimientos.unshift(movimiento);
        localStorage.setItem('mis_movimientos', JSON.stringify(movimientos));

        formTransaccion.reset();
        
        // Si estábamos visualizando el archivo, forzamos la vista al día para ver el ingreso
        if (filtroActivo === 'archivo') {
            cambiarFiltro('hoy');
        } else {
            cargarMovimientos();
        }

    } catch (error) {
        console.error("Error al registrar movimiento:", error);
    }
});

function cargarMovimientos() {
    try {
        const datosGuardados = localStorage.getItem('mis_movimientos');
        const movimientosMesActual = datosGuardados ? JSON.parse(datosGuardados) : [];
        
        // Calcular y renderizar balances superiores fijos e interfaz global
        actualizarTodosLosBalances(movimientosMesActual);
        
        // Filtrar y renderizar la tabla según la pestaña activa
        procesarYRenderizarTabla(movimientosMesActual);

    } catch (error) {
        console.error("Error al cargar los movimientos:", error);
    }
}

function actualizarTodosLosBalances(movimientosMesActual) {
    const hoyStr = obtenerFechaHoyString();
    
    // 1. Balance Global Histórico (Mes Actual + Meses Archivados Históricos)
    let acumuladoGlobal = 0;
    
    // Sumar meses archivados en el pasado
    const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
    Object.values(archivoHistorico).forEach(listaMes => {
        listaMes.forEach(mov => {
            acumuladoGlobal += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
        });
    });
    // Sumar mes actual en curso
    movimientosMesActual.forEach(mov => {
        acumuladoGlobal += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
    });

    // 2. Balance Neto Diario (Específico de HOY)
    let acumuladoDiario = 0;
    movimientosMesActual.filter(mov => mov.fecha === hoyStr).forEach(mov => {
        acumuladoDiario += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
    });

    // 3. Balances Mensuales Individuales del Mes en Curso
    let acumuladoDiego = 0;
    let acumuladoRomina = 0;
    movimientosMesActual.forEach(mov => {
        if (mov.usuario === 'Diego') acumuladoDiego += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
        if (mov.usuario === 'Romina') acumuladoRomina += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
    });

    // Renderizado en Elementos de Pantalla
    document.getElementById("total-global").innerText = formatMoneda(acumuladoGlobal);
    document.getElementById("total-diario").innerText = formatMoneda(acumuladoDiario);
    document.getElementById("total-usuario-a").innerText = formatMoneda(acumuladoDiego);
    document.getElementById("total-usuario-b").innerText = formatMoneda(acumuladoRomina);
}

function procesarYRenderizarTabla(movimientosMesActual) {
    let movimientosAMostrar = [];
    const btnCerrarMes = document.getElementById("btn-cerrar-mes");
    const divSelectorArchivo = document.getElementById("contenedor-selector-archivo");

    // Ocultar selectores por defecto
    divSelectorArchivo.className = "selector-archivo-oculto";
    btnCerrarMes.style.display = "none";

    if (filtroActivo === 'hoy') {
        const hoyStr = obtenerFechaHoyString();
        movimientosAMostrar = movimientosMesActual.filter(mov => mov.fecha === hoyStr);
    } 
    else if (filtroActivo === 'mes') {
        movimientosAMostrar = movimientosMesActual;
        btnCerrarMes.style.display = "block"; // El botón de cierre solo aparece en el mes en curso
    } 
    else if (filtroActivo === 'archivo') {
        divSelectorArchivo.className = "selector-archivo-visible";
        const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
        movimientosAMostrar = archivoHistorico[mesSeleccionadoArchivo] || [];
    }

    renderizarFilasTabla(movimientosAMostrar);
}

function renderizarFilasTabla(movimientos) {
    const listaContenedor = document.getElementById("lista-transacciones");
    listaContenedor.innerHTML = ""; 

    if (movimientos.length === 0) {
        listaContenedor.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#7f8c8d;">No hay movimientos registrados para este período.</td></tr>`;
        return;
    }

    movimientos.forEach(mov => {
        const tr = document.createElement("tr");
        // El botón borrar se bloquea/oculta si estamos visualizando el archivo histórico cerrado
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

// Cambiar de Pestaña de Filtros
function cambiarFiltro(nuevoFiltro) {
    filtroActivo = nuevoFiltro;
    
    document.querySelectorAll(".btn-tab").forEach(btn => btn.classList.remove("activo"));
    document.getElementById(`tab-${nuevoFiltro}`).classList.add("activo");

    if (nuevoFiltro === 'archivo') {
        actualizarSelectMesesArchivados();
    }
    cargarMovimientos();
}

// Cierre Mensual: Mueve la lista actual al almacén histórico permanente
function ejecutarCierreMensual() {
    const datosGuardados = localStorage.getItem('mis_movimientos');
    const movimientos = datosGuardados ? JSON.parse(datosGuardados) : [];

    if (movimientos.length === 0) {
        alert("No hay movimientos en el mes actual para cerrar.");
        return;
    }

    // Identificar el nombre del mes que cerramos basado en el primer elemento o fecha actual
    const fechaRef = movimientos[0].llaveMes || obtenerLlaveMesActualString();
    
    if (confirm(`¿Estás seguro de cerrar el período de este mes (${fechaRef})?\nSe archivará de manera definitiva y el listado mensual se limpiará.`)) {
        const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
        
        // Guardar o fusionar en el contenedor histórico
        archivoHistorico[fechaRef] = movimientos;
        localStorage.setItem('archivo_historico', JSON.stringify(archivoHistorico));

        // Vaciar la lista del mes corriente
        localStorage.setItem('mis_movimientos', JSON.stringify([]));

        alert(`Período ${fechaRef} cerrado con éxito.`);
        cambiarFiltro('hoy');
    }
}

// Funciones Auxiliares de Archivo Pasado
function inicializarArchivo() {
    if (!localStorage.getItem('archivo_historico')) {
        localStorage.setItem('archivo_historico', JSON.stringify({}));
    }
}

function actualizarSelectMesesArchivados() {
    const select = document.getElementById("selector-meses");
    select.innerHTML = "";
    
    const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
    const llavesMeses = Object.keys(archivoHistorico);

    if (llavesMeses.length === 0) {
        select.innerHTML = `<option value="">No hay meses cerrados aún</option>`;
        mesSeleccionadoArchivo = '';
        return;
    }

    llavesMeses.forEach(mes => {
        const option = document.createElement("option");
        option.value = mes;
        option.innerText = `Mes Cerrado: ${mes}`;
        select.appendChild(option);
    });

    if (!mesSeleccionadoArchivo || !archivoHistorico[mesSeleccionadoArchivo]) {
        mesSeleccionadoArchivo = llavesMeses[0];
    }
    select.value = mesSeleccionadoArchivo;
}

function cargarMesArchivado() {
    mesSeleccionadoArchivo = document.getElementById("selector-meses").value;
    cargarMovimientos();
}

// Función para Exportar la Tabla que esté visible en Pantalla a EXCEL (CSV)
function exportarExcel() {
    const tabla = document.querySelector("table");
    let filas = Array.from(tabla.rows);
    
    // Cabecera de texto CSV estándar
    let contenidoCsv = "Fecha,Miembro,Detalle / Concepto,Tipo,Monto\n";

    // Omitimos la primera fila (encabezado) y recorremos los registros mostrados
    for (let i = 1; i < filas.length; i++) {
        let celdas = filas[i].cells;
        // Si la tabla muestra la fila de "No hay movimientos", no exportamos contenido vacío
