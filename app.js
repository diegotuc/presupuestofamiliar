// Variable de Estado del Filtro Activo: 'hoy', 'mes', o 'archivo'
let filtroActivo = 'hoy';
let mesSeleccionadoArchivo = '';
let transaccionesMemoria = []; // Caché local para búsquedas y filtros rápidos

document.addEventListener("DOMContentLoaded", () => {
    inicializarArchivo();
    cargarMovimientos();
    
    // Escuchar el cambio en el selector de operaciones (Ingreso/Gasto) para adaptar las etiquetas
    const tipoSelect = document.getElementById("tipo");
    if (tipoSelect) {
        tipoSelect.addEventListener("change", alternarCamposPago);
    }
});

// NAVEGACIÓN ENTRE PÁGINAS (Dashboard <=> Historial)
function navegarA(pantalla) {
    const vistaDashboard = document.getElementById("vista-dashboard");
    const vistaHistorial = document.getElementById("vista-historial");
    
    if (pantalla === 'dashboard') {
        vistaDashboard.style.display = "grid";
        vistaHistorial.style.display = "none";
        filtroActivo = 'hoy';
    } else if (pantalla === 'historial') {
        vistaDashboard.style.display = "none";
        vistaHistorial.style.display = "block";
        filtroActivo = 'mes'; // Por defecto al ir al historial muestra el mes en curso
    }
    
    // Sincronizar estados visuales de las pestañas
    document.querySelectorAll(".btn-tab").forEach(btn => btn.classList.remove("activo"));
    const tabActivo = document.getElementById(`tab-${filtroActivo}`);
    if (tabActivo) tabActivo.classList.add("activo");
    
    procesarYRenderizarTablas();
}

// CONTROL DINÁMICO DE CAMPOS DEL FORMULARIO
function alternarCamposPago() {
    const tipo = document.getElementById("tipo").value;
    const labelMedioPago = document.getElementById("label-medio-pago");
    
    if (labelMedioPago) {
        labelMedioPago.innerText = tipo === 'ingreso' ? 'Medio de Depósito:' : 'Medio de Pago:';
    }
    alternarUbicacionEfectivo();
}

function alternarUbicacionEfectivo() {
    const medioPago = document.getElementById("medio-pago").value;
    const contenedorUbicacion = document.getElementById("contenedor-ubicacion-efectivo");
    const inputUbicacion = document.getElementById("ubicacion-efectivo");
    
    if (medioPago === 'Efectivo') {
        contenedorUbicacion.style.display = "block";
        if (inputUbicacion) inputUbicacion.required = true;
    } else {
        contenedorUbicacion.style.display = "none";
        if (inputUbicacion) {
            inputUbicacion.required = false;
            inputUbicacion.value = ""; // Limpiar residuo
        }
    }
}
// 1. REGISTRAR O EDITAR MOVIMIENTO (POST / REEMPLAZO)
const formTransaccion = document.getElementById("form-transaccion");
if (formTransaccion) {
    formTransaccion.addEventListener("submit", async (e) => {
        e.preventDefault();

        const idEdicion = document.getElementById("edit-id").value;
        const hoy = new Date();
        const fechaFormateada = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
        const llaveMesActual = `${String(hoy.getMonth() + 1).padStart(2, '0')}-${hoy.getFullYear()}`;

        const movimiento = {
            id: idEdicion ? parseInt(idEdicion) : Date.now(),
            fecha: fechaFormateada,
            llaveMes: llaveMesActual,
            tipo: document.getElementById("tipo").value,
            usuario: document.getElementById("usuario").value, 
            monto: parseFloat(document.getElementById("monto").value),
            descripcion: document.getElementById("descripcion").value,
            medioPago: document.getElementById("medio-pago").value,
            ubicacionEfectivo: document.getElementById("ubicacion-efectivo").value || ""
        };

        try {
            // SI ESTAMOS EDITANDO: Eliminamos primero el registro anterior de forma transparente
            if (idEdicion) {
                const resDelete = await fetch(`/api/server?id=${idEdicion}`, { method: 'DELETE' });
                if (!resDelete.ok) {
                    alert("Error interno al procesar la actualización.");
                    return;
                }
            }

            // GUARDAR NUEVO / CORREGIDO
            const res = await fetch('/api/server', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(movimiento)
            });

            if (res.ok) {
                alert(idEdicion ? "¡Movimiento editado con éxito!" : "¡Movimiento guardado con éxito!");
                cancelarEdicion(); // Restablece el formulario a su modo normal
                cargarMovimientos();
            } else {
                alert("Error en el servidor al procesar la operación.");
            }
        } catch (error) {
            console.error("Error al registrar movimiento:", error);
        }
    });
}

// ACTIVAR MODO EDICIÓN (✏️)
function prepararEdicion(id) {
    const mov = transaccionesMemoria.find(m => m.id === id);
    if (!mov) return;

    // Regresar al panel principal si el usuario estaba en el historial
    navegarA('dashboard');

    // Forzar cambios en el formulario
    document.getElementById("edit-id").value = mov.id;
    document.getElementById("tipo").value = mov.tipo;
    document.getElementById("usuario").value = mov.usuario;
    document.getElementById("monto").value = mov.monto;
    document.getElementById("descripcion").value = mov.descripcion;
    document.getElementById("medio-pago").value = mov.medioPago || "Mercado Pago";
    
    alternarCamposPago(); // Actualiza etiquetas y despliega campo de efectivo si corresponde

    if (mov.medioPago === 'Efectivo') {
        document.getElementById("ubicacion-efectivo").value = mov.ubicacionEfectivo || "";
    }

    // Cambiar la interfaz del formulario para indicar edición
    document.getElementById("form-titulo").innerText = "⚠️ Editando Movimiento";
    document.getElementById("btn-submit-form").innerText = "Guardar Cambios";
    document.getElementById("btn-submit-form").style.backgroundColor = "#e67e22";
    document.getElementById("btn-cancelar-edit").style.display = "block";
}

function cancelarEdicion() {
    if(formTransaccion) formTransaccion.reset();
    document.getElementById("edit-id").value = "";
    document.getElementById("form-titulo").innerText = "📝 Registrar Nuevo Movimiento";
    document.getElementById("btn-submit-form").innerText = "Guardar Movimiento";
    document.getElementById("btn-submit-form").style.backgroundColor = "var(--primary-color)";
    document.getElementById("btn-cancelar-edit").style.display = "none";
    alternarCamposPago();
}

// 2. CARGAR MOVIMIENTOS DESDE MONGODB (GET)
async function cargarMovimientos() {
    try {
        const res = await fetch('/api/server');
        const datos = await res.json();
        transaccionesMemoria = datos.movimientos || [];
        
        actualizarTodosLosBalances(transaccionesMemoria);
        procesarYRenderizarTablas();
    } catch (error) {
        console.error("Error al cargar los movimientos:", error);
    }
}

// 3. ELIMINAR MOVIMIENTO (DELETE)
async function eliminarMovimiento(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este movimiento definitivamente?")) return;
    
    try {
        const res = await fetch(`/api/server?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
            cargarMovimientos();
        } else {
            alert("No se pudo eliminar el movimiento.");
        }
    } catch (error) {
        console.error("Error al eliminar movimiento:", error);
    }
}
// ACTUALIZAR RETICULA DE BALANCES EN TIEMPO REAL
function actualizarTodosLosBalances(movimientosMesActual) {
    const hoyStr = obtenerFechaHoyString();
    let acumuladoGlobal = 0;
    
    // Sumar acumulados del archivo local histórico
    const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
    Object.values(archivoHistorico).forEach(listaMes => {
        listaMes.forEach(mov => {
            acumuladoGlobal += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
        });
    });

    // Sumar activos de MongoDB
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

// FILTRADO DINÁMICO E INYECCIÓN DE TABLAS
function procesarYRenderizarTablas() {
    // 1. Renderizar siempre la tabla resumida de "Hoy" en el Dashboard principal
    const hoyStr = obtenerFechaHoyString();
    const movimientosHoy = transaccionesMemoria.filter(mov => mov.fecha === hoyStr);
    renderizarFilaTablaCorta(movimientosHoy);

    // 2. Controlar la tabla grande del panel Histórico
    filtrarHistorial();
}

function filtrarHistorial() {
    let movimientosAMostrar = [];
    const btnCerrarMes = document.getElementById("btn-cerrar-mes");
    const divSelectorArchivo = document.getElementById("contenedor-selector-archivo");

    if (divSelectorArchivo) divSelectorArchivo.className = "selector-archivo-oculto";
    if (btnCerrarMes) btnCerrarMes.style.display = "none";

    // Clasificar origen por pestaña seleccionada
    if (filtroActivo === 'mes') {
        movimientosAMostrar = [...transaccionesMemoria];
        if (btnCerrarMes) btnCerrarMes.style.display = "block";
    } 
    else if (filtroActivo === 'archivo') {
        if (divSelectorArchivo) divSelectorArchivo.className = "selector-archivo-visible";
        const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
        movimientosAMostrar = archivoHistorico[mesSeleccionadoArchivo] || [];
    }

    // Aplicar Filtro de búsqueda por texto (Detalle)
    const textoBusqueda = document.getElementById("buscar-texto") ? document.getElementById("buscar-texto").value.toLowerCase() : "";
    if (textoBusqueda) {
        movimientosAMostrar = movimientosAMostrar.filter(mov => 
            mov.descripcion && mov.descripcion.toLowerCase().includes(textoBusqueda)
        );
    }

    // Aplicar Filtro Avanzado de Billeteras/Medio de pago
    const medioFiltrar = document.getElementById("filtro-medio") ? document.getElementById("filtro-medio").value : "todos";
    if (medioFiltrar !== "todos") {
        movimientosAMostrar = movimientosAMostrar.filter(mov => mov.medioPago === medioFiltrar);
    }

    renderizarFilaTablaLarga(movimientosAMostrar);
}

// INYECTAR TABLA COMPACTA (Dashboard Principal)
function renderizarFilaTablaCorta(movimientos) {
    const listaHoyContenedor = document.getElementById("lista-hoy");
    if (!listaHoyContenedor) return;
    
    listaHoyContenedor.innerHTML = "";

    if (movimientos.length === 0) {
        listaHoyContenedor.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#7f8c8d;">No hay operaciones registradas hoy.</td></tr>`;
        return;
    }

    movimientos.forEach(mov => {
        const tr = document.createElement("tr");
        const detalleMedio = mov.medioPago === 'Efectivo' 
            ? `💵 Efectivo (${mov.ubicacionEfectivo || 'No especificada'})` 
            : `${obtenerIconoMedio(mov.medioPago)} ${mov.medioPago || 'Transferencia'}`;

        tr.innerHTML = `
            <td style="text-transform: capitalize; font-weight: 500;">${mov.usuario}</td>
            <td>${mov.descripcion}</td>
            <td style="font-size: 0.85rem; color: #566573;">${detalleMedio}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">
                ${mov.tipo === 'ingreso' ? '+' : '-'}$${mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </td>
            <td>
                <button class="btn-editar" onclick="prepararEdicion(${mov.id})">✏️</button>
                <button class="btn-borrar" onclick="eliminarMovimiento(${mov.id})">❌</button>
            </td>
        `;
        listaHoyContenedor.appendChild(tr);
    });
}

// INYECTAR TABLA EXTENDIDA (Historial Completo)
function renderizarFilaTablaLarga(movimientos) {
    const listaHistorialContenedor = document.getElementById("lista-transacciones");
    if (!listaHistorialContenedor) return;
    
    listaHistorialContenedor.innerHTML = ""; 

    if (movimientos.length === 0) {
        listaHistorialContenedor.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#7f8c8d;">Ningún registro coincide con los filtros aplicados.</td></tr>`;
        return;
    }

    movimientos.forEach(mov => {
        const tr = document.createElement("tr");
        const detalleMedio = mov.medioPago === 'Efectivo' 
            ? `💵 Efectivo (${mov.ubicacionEfectivo || 'Físico'})` 
            : `${obtenerIconoMedio(mov.medioPago)} ${mov.medioPago || 'Transferencia'}`;

        const celdaAcciones = (filtroActivo === 'archivo') 
            ? `<td>🔒 Archivo</td>` 
            : `<td>
                <button class="btn-editar" onclick="prepararEdicion(${mov.id})">✏️</button>
                <button class="btn-borrar" onclick="eliminarMovimiento(${mov.id})">❌</button>
               </td>`;

        tr.innerHTML = `
            <td>${mov.fecha}</td>
            <td style="text-transform: capitalize; font-weight: 500;">${mov.usuario}</td>
            <td>${mov.descripcion}</td>
            <td style="font-size: 0.85rem; color: #566573;">${detalleMedio}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">${mov.tipo.toUpperCase()}</td>
            <td class="${mov.tipo === 'ingreso' ? 'txt-ingreso' : 'txt-gasto'}">
                ${mov.tipo === 'ingreso' ? '+' : '-'}$${mov.monto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </td>
            ${celdaAcciones}
        `;
        listaHistorialContenedor.appendChild(tr);
    });
}

function obtenerIconoMedio(medio) {
    switch (medio) {
        case 'Mercado Pago': return '📱';
        case 'Naranja X': return '🍊';
        case 'Banco Galicia': return '🦁';
        case 'Banco Santander': return '🔴';
        default: return '💳';
    }
}

// CONTROL DE FILTROS DE PESTAÑA
function cambiarFiltro(nuevoFiltro) {
    filtroActivo = nuevoFiltro;
    document.querySelectorAll(".btn-tab").forEach(btn => btn.classList.remove("activo"));
    const tabBtn = document.getElementById(`tab-${nuevoFiltro}`);
    if (tabBtn) tabBtn.classList.add("activo");
    
    if(document.getElementById("filtro-medio")) document.getElementById("filtro-medio").value = "todos";
    if(document.getElementById("buscar-texto")) document.getElementById("buscar-texto").value = "";
    
    filtrarHistorial();
}

// CIERRE MENSUAL HISTÓRICO LOCAL PREVENTIVO
function ejecutarCierreMensual() {
    if (transaccionesMemoria.length === 0) {
        alert("No hay movimientos activos en el servidor para cerrar.");
        return;
    }

    const fechaRef = transaccionesMemoria.llaveMes || '01-' + new Date().getFullYear();
    
    if (confirm(`¿Estás seguro de cerrar el período de este mes (${fechaRef})?\nSe archivará localmente y se limpiará la visualización.`)) {
        const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
        archivoHistorico[fechaRef] = [...transaccionesMemoria];
        localStorage.setItem('archivo_historico', JSON.stringify(archivoHistorico));
        
        alert(`Período ${fechaRef} guardado en el archivo histórico local con éxito.`);
        actualizarSelectMeses();
        cambiarFiltro('archivo');
    }
}

function inicializarArchivo() {
    if (!localStorage.getItem('archivo_historico')) {
        localStorage.setItem('archivo_historico', JSON.stringify({}));
    }
    actualizarSelectMeses();
}

function actualizarSelectMeses() {
    const selector = document.getElementById("selector-meses");
    if (!selector) return;
    
    selector.innerHTML = "";
    const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
    const meses = Object.keys(archivoHistorico);
    
    if (meses.length === 0) {
        selector.innerHTML = `<option value="">No hay meses cerrados</option>`;
        mesSeleccionadoArchivo = "";
        return;
    }
    
    meses.forEach(mes => {
        const option = document.createElement("option");
        option.value = mes;
        option.innerText = `Mes: ${mes}`;
        selector.appendChild(option);
    });
    mesSeleccionadoArchivo = meses[0] || "";
}

function cargarMesArchivado() {
    const selector = document.getElementById("selector-meses");
    if(selector) mesSeleccionadoArchivo = selector.value;
    filtrarHistorial();
}

// EXPORTACIÓN A EXCEL ADAPTADA
function exportarExcel() {
    alert("Función de exportación de datos en cola...");
}

// UTILIDADES AUXILIARES
function obtenerFechaHoyString() {
    var hoy = new Date();
    var dia = String(hoy.getDate()).padStart(2, '0');
    var mes = String(hoy.getMonth() + 1).padStart(2, '0');
    var anio = hoy.getFullYear();
    return dia + '/' + mes + '/' + anio;
}

function formatMoneda(valor) {
    if (typeof valor !== 'number') {
        valor = parseFloat(valor) || 0;
    }
    var signo = valor >= 0 ? '' : '-';
    var numeroFormateado = Math.abs(valor).toLocaleString('es-AR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
    return signo + '$' + numeroFormateado;
}
