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

// CONTROL DINÁMICO DE CAMPOS DEL FORMULARIO (SOPORTA TRASPASOS)
function alternarCamposPago() {
    const tipo = document.getElementById("tipo").value;
    const labelMedioPago = document.getElementById("label-medio-pago");
    const contenedorDestino = document.getElementById("contenedor-destino");
    const medioDestino = document.getElementById("medio-destino");
    
    if (tipo === 'traspaso') {
        if (labelMedioPago) labelMedioPago.innerText = '¿Desde dónde sale el dinero? (Origen):';
        if (contenedorDestino) contenedorDestino.style.display = "block";
        if (medioDestino) medioDestino.required = true;
    } else {
        if (labelMedioPago) labelMedioPago.innerText = tipo === 'ingreso' ? 'Medio de Depósito:' : 'Medio de Pago:';
        if (contenedorDestino) contenedorDestino.style.display = "none";
        if (medioDestino) {
            medioDestino.required = false;
            medioDestino.value = "Mercado Pago";
        }
    }
    alternarUbicacionEfectivo();
    alternarUbicacionEfectivoDestino();
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
            inputUbicacion.value = "";
        }
    }
}

function alternarUbicacionEfectivoDestino() {
    const tipo = document.getElementById("tipo").value;
    const medioDestino = document.getElementById("medio-destino").value;
    const contenedorUbicacionDestino = document.getElementById("contenedor-ubicacion-efectivo-destino");
    const inputUbicacionDestino = document.getElementById("ubicacion-efectivo-destino");
    
    if (tipo === 'traspaso' && medioDestino === 'Efectivo') {
        contenedorUbicacionDestino.style.display = "block";
        if (inputUbicacionDestino) inputUbicacionDestino.required = true;
    } else {
        contenedorUbicacionDestino.style.display = "none";
        if (inputUbicacionDestino) {
            inputUbicacionDestino.required = false;
            inputUbicacionDestino.value = "";
        }
    }
}


// 1. REGISTRAR O EDITAR MOVIMIENTO (POST / REEMPLAZO)
// 1. REGISTRAR O EDITAR MOVIMIENTO (POST / REEMPLAZO - ACTUALIZADO CON TRASPASOS)
const formTransaccion = document.getElementById("form-transaccion");
if (formTransaccion) {
    formTransaccion.addEventListener("submit", async (e) => {
        e.preventDefault();

        const idEdicion = document.getElementById("edit-id").value;
        const hoy = new Date();
        const fechaFormateada = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;
        const llaveMesActual = `${String(hoy.getMonth() + 1).padStart(2, '0')}-${hoy.getFullYear()}`;

        // Aquí empaquetamos todos los datos (incluyendo origen y destino del traspaso)
        const movimiento = {
            id: idEdicion ? parseInt(idEdicion) : Date.now(),
            fecha: fechaFormateada,
            llaveMes: llaveMesActual,
            tipo: document.getElementById("tipo").value,
            usuario: document.getElementById("usuario").value, 
            monto: parseFloat(document.getElementById("monto").value),
            descripcion: document.getElementById("descripcion").value,
            medioPago: document.getElementById("medio-pago").value,
            ubicacionEfectivo: document.getElementById("ubicacion-efectivo").value || "",
            medioDestino: document.getElementById("medio-destino").value || "",
            ubicacionEfectivoDestino: document.getElementById("ubicacion-efectivo-destino").value || ""
        };

        try {
            // SI ESTAMOS EDITANDO: Eliminamos primero el registro viejo de forma transparente
            if (idEdicion) {
                const resDelete = await fetch(`/api/server?id=${idEdicion}`, { method: 'DELETE' });
                if (!resDelete.ok) {
                    alert("Error interno al procesar la actualización.");
                    return;
                }
            }

            // GUARDAR NUEVO O CORREGIDO EN MONGODB
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

// ACTIVAR MODO EDICIÓN (✏️ - ACTUALIZADO CON TRASPASOS)
function prepararEdicion(id) {
    const mov = transaccionesMemoria.find(m => m.id === id);
    if (!mov) return;

    // Regresar al panel principal si el usuario estaba en el historial
    navegarA('dashboard');

    // Volver a cargar todos los datos en los casilleros del formulario
    document.getElementById("edit-id").value = mov.id;
    document.getElementById("tipo").value = mov.tipo;
    document.getElementById("usuario").value = mov.usuario;
    document.getElementById("monto").value = mov.monto;
    document.getElementById("descripcion").value = mov.descripcion;
    document.getElementById("medio-pago").value = mov.medioPago || "Mercado Pago";
    
    // Cargar los campos nuevos de traspaso por si era un traspaso lo que se erró
    document.getElementById("medio-destino").value = mov.medioDestino || "Mercado Pago";
    document.getElementById("ubicacion-efectivo-destino").value = mov.ubicacionEfectivoDestino || "";
    
    alternarCamposPago(); // Actualiza etiquetas y despliega campos si corresponde

    if (mov.medioPago === 'Efectivo') {
        document.getElementById("ubicacion-efectivo").value = mov.ubicacionEfectivo || "";
    }

    // Cambiar el diseño del formulario para avisar que estamos editando
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
function actualizarTodosLosBalances(movimientosMesActual) {
    const hoyStr = obtenerFechaHoyString();
    let acumuladoGlobal = 0;
    
    let saldoMercadoPago = 0;
    let saldoNaranjaX = 0;
    let saldoEfectivo = 0;

    // Procesar función matemática de impacto
    const procesarImpactoBilleteras = (mov) => {
        if (mov.tipo === 'ingreso') {
            if (mov.medioPago === 'Mercado Pago') saldoMercadoPago += mov.monto;
            if (mov.medioPago === 'Naranja X') saldoNaranjaX += mov.monto;
            if (mov.medioPago === 'Efectivo') saldoEfectivo += mov.monto;
        } 
        else if (mov.tipo === 'gasto') {
            if (mov.medioPago === 'Mercado Pago') saldoMercadoPago -= mov.monto;
            if (mov.medioPago === 'Naranja X') saldoNaranjaX -= mov.monto;
            if (mov.medioPago === 'Efectivo') saldoEfectivo -= mov.monto;
        } 
        else if (mov.tipo === 'traspaso') {
            // Restar al origen
            if (mov.medioPago === 'Mercado Pago') saldoMercadoPago -= mov.monto;
            if (mov.medioPago === 'Naranja X') saldoNaranjaX -= mov.monto;
            if (mov.medioPago === 'Efectivo') saldoEfectivo -= mov.monto;
            // Sumar al destino
            if (mov.medioDestino === 'Mercado Pago') saldoMercadoPago += mov.monto;
            if (mov.medioDestino === 'Naranja X') saldoNaranjaX += mov.monto;
            if (mov.medioDestino === 'Efectivo') saldoEfectivo += mov.monto;
        }
    };

    // 1. Histórico local
    const archivoHistorico = JSON.parse(localStorage.getItem('archivo_historico') || '{}');
    Object.values(archivoHistorico).forEach(listaMes => {
        listaMes.forEach(mov => {
            if (mov.tipo !== 'traspaso') {
                acumuladoGlobal += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
            }
            procesarImpactoBilleteras(mov);
        });
    });

    // 2. MongoDB activos
    movimientosMesActual.forEach(mov => {
        if (mov.tipo !== 'traspaso') {
            acumuladoGlobal += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
        }
        procesarImpactoBilleteras(mov);
    });

    // 3. Totales mensuales de usuario y diarios (Los traspasos no suman como ingreso ni gasto mensual)
    let acumuladoDiario = 0;
    movimientosMesActual.filter(mov => mov.fecha === hoyStr).forEach(mov => {
        if (mov.tipo !== 'traspaso') acumuladoDiario += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
    });

    let acumuladoDiego = 0;
    let acumuladoRomina = 0;
    movimientosMesActual.forEach(mov => {
        if (mov.tipo !== 'traspaso') {
            if (mov.usuario === 'Diego') acumuladoDiego += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
            if (mov.usuario === 'Romina') acumuladoRomina += (mov.tipo === 'ingreso' ? mov.monto : -mov.monto);
        }
    });

    if(document.getElementById("total-global")) document.getElementById("total-global").innerText = formatMoneda(acumuladoGlobal);
    if(document.getElementById("total-diario")) document.getElementById("total-diario").innerText = formatMoneda(acumuladoDiario);
    if(document.getElementById("total-usuario-a")) document.getElementById("total-usuario-a").innerText = formatMoneda(acumuladoDiego);
    if(document.getElementById("total-usuario-b")) document.getElementById("total-usuario-b").innerText = formatMoneda(acumuladoRomina);
    
    if(document.getElementById("saldo-mp")) document.getElementById("saldo-mp").innerText = formatMoneda(saldoMercadoPago);
    if(document.getElementById("saldo-nx")) document.getElementById("saldo-nx").innerText = formatMoneda(saldoNaranjaX);
    if(document.getElementById("saldo-efectivo")) document.getElementById("saldo-efectivo").innerText = formatMoneda(saldoEfectivo);
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
        // Reemplaza la definición de detalleMedio en ambas funciones de renderizado por esto:
const detalleMedio = "";
if (mov.tipo === 'traspaso') {
    detalleMedio = `🔄 De: ${mov.medioPago} a ${mov.medioDestino}`;
} else {
    detalleMedio = mov.medioPago === 'Efectivo' 
        ? `💵 Efectivo (${mov.ubicacionEfectivo || 'Físico'})` 
        : `${obtenerIconoMedio(mov.medioPago)} ${mov.medioPago || 'Transferencia'}`;
}


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
        // Reemplaza la definición de detalleMedio en ambas funciones de renderizado por esto:
const detalleMedio = "";
if (mov.tipo === 'traspaso') {
    detalleMedio = `🔄 De: ${mov.medioPago} a ${mov.medioDestino}`;
} else {
    detalleMedio = mov.medioPago === 'Efectivo' 
        ? `💵 Efectivo (${mov.ubicacionEfectivo || 'Físico'})` 
        : `${obtenerIconoMedio(mov.medioPago)} ${mov.medioPago || 'Transferencia'}`;
}


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
