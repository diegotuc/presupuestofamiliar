// --- CONFIGURACIÓN DE ENDPOINTS (Mantiene compatibilidad con Render) ---
const API_URL = '/api/server';

// Variables de estado de la aplicación (Versión 2.1)
// CORRECCIÓN EN LA LÍNEA 5 DE APP.JS
let transaccionesGlobal = [];

let filtroPeriodoActual = 'mes'; // 'mes' o 'archivo'
let filtroHoySeleccionado = 'todos'; // 'todos', 'ingreso', 'gasto'

// Al cargar el documento, iniciamos la app
document.addEventListener('DOMContentLoaded', () => {
    inicializarFormulario();
    cargarMovimientos();
});

// NAVEGACIÓN ENTRE DASHBOARD E HISTORIAL
function navegarA(vista) {
    const dashboard = document.getElementById('vista-dashboard');
    const historial = document.getElementById('vista-historial');

    if (vista === 'dashboard') {
        dashboard.style.display = 'grid';
        historial.style.display = 'none';
        cargarMovimientos(); // Refresca balances al volver
    } else if (vista === 'historial') {
        dashboard.style.display = 'none';
        historial.style.display = 'grid';
        // Reiniciamos selectores a por defecto al entrar al historial
        document.getElementById('filtro-miembro').value = 'todos';
        document.getElementById('filtro-tipo-historial').value = 'todos';
        document.getElementById('filtro-medio').value = 'todos';
        document.getElementById('buscar-texto').value = '';
        cambiarFiltro('mes'); // Por defecto arranca en el mes en curso
    }
}

// CONTROL DE FILTROS EN PESTAÑAS DEL HISTORIAL (Mes vs Archivo)
function cambiarFiltro(periodo) {
    filtroPeriodoActual = periodo;
    
    const tabMes = document.getElementById('tab-mes');
    const tabArchivo = document.getElementById('tab-archivo');
    const selectorArchivo = document.getElementById('contenedor-selector-archivo');

    if (periodo === 'mes') {
        tabMes.classList.add('activo');
        tabArchivo.classList.remove('activo');
        selectorArchivo.className = 'selector-archivo-oculto';
        filtrarHistorial();
    } else {
        tabMes.classList.remove('activo');
        tabArchivo.classList.add('activo');
        selectorArchivo.className = 'selector-archivo-visible';
        generarOpcionesMesesArchivados();
    }
}
// INICIALIZACIÓN DEL FORMULARIO
function inicializarFormulario() {
    const form = document.getElementById('form-transaccion');
    form.addEventListener('submit', guardarMovimiento);
    alternarCamposPago(); // Seteo inicial de campos
}

// PUNTO 1: LÓGICA DE EFECTIVO UX OPTIMIZADA
// Controla la visibilidad de los medios de pago origen/destino y campos físicos
function alternarCamposPago() {
    const tipo = document.getElementById('tipo').value;
    const contenedorOrigen = document.getElementById('contenedor-origen');
    const labelMedioPago = document.getElementById('label-medio-pago');
    const contenedorDestino = document.getElementById('contenedor-destino');

    if (tipo === 'traspaso') {
        labelMedioPago.innerHTML = '¿Desde qué cuenta se saca el dinero? (Origen):';
        contenedorOrigen.style.display = 'block';
        contenedorDestino.style.display = 'block';
        document.getElementById('medio-destino').required = true;
    } else {
        labelMedioPago.innerHTML = tipo === 'ingreso' ? 'Medio de Depósito:' : 'Medio de Pago / Cuenta:';
        contenedorOrigen.style.display = 'block';
        contenedorDestino.style.display = 'none';
        document.getElementById('medio-destino').required = false;
        
        // Limpiamos campos de destino por seguridad
        document.getElementById('medio-destino').value = 'Mercado Pago';
    }

    // Evaluamos la visibilidad de los lugares físicos de efectivo
    alternarUbicacionEfectivo();
    alternarUbicacionEfectivoDestino();
}

// Evalúa efectivo origen (SOLO OBLIGATORIO EN INGRESO + EFECTIVO)
function alternarUbicacionEfectivo() {
    const tipo = document.getElementById('tipo').value;
    const medioPago = document.getElementById('medio-pago').value;
    const contenedorUbicacion = document.getElementById('contenedor-ubicacion-efectivo');
    const inputUbicacion = document.getElementById('ubicacion-efectivo');

    // Modificación V2.1: Solo se pregunta ubicación en INGRESO de EFECTIVO
    if (tipo === 'ingreso' && medioPago === 'Efectivo') {
        contenedorUbicacion.style.display = 'block';
        inputUbicacion.required = true;
    } else {
        contenedorUbicacion.style.display = 'none';
        inputUbicacion.required = false;
        inputUbicacion.value = ''; // Limpia el campo automáticamente
    }
}

// Evalúa efectivo destino (SIEMPRE OCULTO EN V2.1 SEGÚN REQUERIMIENTO)
function alternarUbicacionEfectivoDestino() {
    const contenedorDestinoFisico = document.getElementById('contenedor-ubicacion-efectivo-destino');
    const inputDestinoFisico = document.getElementById('ubicacion-efectivo-destino');
    
    // Al quitar la pregunta en traspasos internos de efectivo, este campo va siempre oculto
    contenedorDestinoFisico.style.display = 'none';
    inputDestinoFisico.required = false;
    inputDestinoFisico.value = '';
}
// OBTENER MOVIMIENTOS DESDE EL BACKEND (Render)
async function cargarMovimientos() {
    try {
        const respuesta = await fetch(API_URL);
        if (!respuesta.ok) throw new Error('Error al conectar con el servidor');
        
        const datos = await respuesta.json();
        transaccionesGlobal = datos.movimientos || [];
        
        // Ejecutamos el recálculo y actualización de toda la interfaz
        procesarYRenderizarTodo();
    } catch (error) {
        console.error("Error cargando datos:", error);
    }
}

// PROCESAMIENTO CENTRAL DE BALANCES Y RENDERIZADO DEL DASHBOARD
function procesarYRenderizarTodo() {
    // 1. Inicialización de contadores y acumuladores matemáticos
    let fondoTotalAcumulado = 0;
    let balanceDiegoMes = 0;
    let balanceRominaMes = 0;
    let saldoMercadoPago = 0;
    let saldoNaranjaX = 0;
    let saldoGalicia = 0;
    let saldoSantander = 0;
    let saldoEfectivoTotal = 0;

    let totalIngresosHoy = 0;
    let totalGastosHoy = 0;

    // Obtener marcas de tiempo para controlar "Hoy" y el "Mes En Curso"
    const hoyStr = new Date().toLocaleDateString('es-AR');
    const mesActualAño = new Date().getMonth();
    const añoActual = new Date().getFullYear();

    // Procesamos el listado completo de transacciones en orden cronológico inverso
    transaccionesGlobal.forEach(t => {
        const monto = parseFloat(t.monto) || 0;
        const fechaT = new Date(t.id);
        const esMesEnCurso = fechaT.getMonth() === mesActualAño && fechaT.getFullYear() === añoActual;
        const esHoy = new Date(t.id).toLocaleDateString('es-AR') === hoyStr;

        // --- LÓGICA DE FONDO TOTAL ACUMULADO Y BALANCES MENSUALES ---
        if (t.tipo === 'ingreso') {
            fondoTotalAcumulado += monto;
            if (esMesEnCurso) {
                if (t.usuario === 'Diego') balanceDiegoMes += monto;
                if (t.usuario === 'Romina') balanceRominaMes += monto;
            }
        } else if (t.tipo === 'gasto') {
            fondoTotalAcumulado -= monto;
            if (esMesEnCurso) {
                if (t.usuario === 'Diego') balanceDiegoMes -= monto;
                if (t.usuario === 'Romina') balanceRominaMes -= monto;
            }
        }

        // --- LÓGICA DE LIQUIDEZ Y MEDIOS DE PAGO (DINERO REAL) ---
        if (t.tipo === 'ingreso') {
            if (t.medioPago === 'Mercado Pago') saldoMercadoPago += monto;
            else if (t.medioPago === 'Naranja X') saldoNaranjaX += monto;
            else if (t.medioPago === 'Banco Galicia') saldoGalicia += monto;
            else if (t.medioPago === 'Banco Santander') saldoSantander += monto;
            else if (t.medioPago === 'Efectivo') saldoEfectivoTotal += monto;
        } else if (t.tipo === 'gasto') {
            if (t.medioPago === 'Mercado Pago') saldoMercadoPago -= monto;
            else if (t.medioPago === 'Naranja X') saldoNaranjaX -= monto;
            else if (t.medioPago === 'Banco Galicia') saldoGalicia -= monto;
            else if (t.medioPago === 'Banco Santander') saldoSantander -= monto;
            else if (t.medioPago === 'Efectivo') saldoEfectivoTotal -= monto;
        } else if (t.tipo === 'traspaso') {
            // Restamos del Origen
            if (t.medioPago === 'Mercado Pago') saldoMercadoPago -= monto;
            else if (t.medioPago === 'Naranja X') saldoNaranjaX -= monto;
            else if (t.medioPago === 'Banco Galicia') saldoGalicia -= monto;
            else if (t.medioPago === 'Banco Santander') saldoSantander -= monto;
            else if (t.medioPago === 'Efectivo') saldoEfectivoTotal -= monto;

            // Sumamos al Destino (t.medioDestino)
            if (t.medioDestino === 'Mercado Pago') saldoMercadoPago += monto;
            else if (t.medioDestino === 'Naranja X') saldoNaranjaX += monto;
            else if (t.medioDestino === 'Banco Galicia') saldoGalicia += monto;
            else if (t.medioDestino === 'Banco Santander') saldoSantander += monto;
            else if (t.medioDestino === 'Efectivo') saldoEfectivoTotal += monto;
        }

        // --- LÓGICA DE CONTROL DIARIO (HOY) ---
        if (esHoy) {
            if (t.tipo === 'ingreso') totalIngresosHoy += monto;
            if (t.tipo === 'gasto') totalGastosHoy += monto;
        }
    });

    // PUNTO 2: Dinero Real Disponible es la suma de todas las disponibilidades líquidas reales
    const dineroRealDisponible = saldoMercadoPago + saldoNaranjaX + saldoGalicia + saldoSantander + saldoEfectivoTotal;
    const balanceNetoHoy = totalIngresosHoy - totalGastosHoy;

    // 2. Renderizado de las 3 Cards Tops Principales
    document.getElementById('total-global').innerHTML = `$${fondoTotalAcumulado.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-real').innerHTML = `$${dineroRealDisponible.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-diario').innerHTML = `$${balanceNetoHoy.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 3. Renderizado de Tarjetas del Dashboard Izquierdo
    document.getElementById('total-usuario-a').innerHTML = `$${balanceDiegoMes.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-usuario-b').innerHTML = `$${balanceRominaMes.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('saldo-mp').innerHTML = `$${saldoMercadoPago.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('saldo-nx').innerHTML = `$${saldoNaranjaX.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('saldo-efectivo').innerHTML = `$${saldoEfectivoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 4. Renderizado de Mini-Cards Diarias Dinámicas (Punto 4)
    document.getElementById('mini-ingreso-hoy').innerHTML = `$${totalIngresosHoy.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('mini-gasto-hoy').innerHTML = `$${totalGastosHoy.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // 5. Dibujar la tabla de movimientos de hoy respetando filtros aplicados
    renderizarTablaHoy(totalIngresosHoy, totalGastosHoy);
}
// CONTROL DE FILTROS EN EL DASHBOARD PRINCIPAL (TABLA DE HOY)
function filtrarHoy(tipo) {
    filtroHoySeleccionado = tipo;
    
    // Cambiar clases activas en las pestañas
    document.getElementById('tab-hoy-todos').classList.remove('activo');
    document.getElementById('tab-hoy-ingresos').classList.remove('activo');
    document.getElementById('tab-hoy-gastos').classList.remove('activo');
    
    if (tipo === 'todos') document.getElementById('tab-hoy-todos').classList.add('activo');
    else if (tipo === 'ingreso') document.getElementById('tab-hoy-ingresos').classList.add('activo');
    else if (tipo === 'gasto') document.getElementById('tab-hoy-gastos').classList.add('activo');

    // Ejecutamos el renderizado de la tabla con los totales ya calculados
    cargarMovimientos(); 
}

// RENDERIZAR TABLA CORTA (MOVIMIENTOS DE HOY)
function renderizarTablaHoy() {
    const tbody = document.getElementById('lista-hoy');
    tbody.innerHTML = '';
    
    const hoyStr = new Date().toLocaleDateString('es-AR');
    
    // Filtrar movimientos pertenecientes al día de hoy
    let movimientosHoy = transaccionesGlobal.filter(t => new Date(t.id).toLocaleDateString('es-AR') === hoyStr);
    
    // Aplicar el filtro por tipo seleccionado en las pestañas del dashboard
    if (filtroHoySeleccionado !== 'todos') {
        movimientosHoy = movimientosHoy.filter(t => t.tipo === filtroHoySeleccionado);
    }

    // PUNTO 4: Ocultar o mostrar las mini-cards de forma inteligente según la pestaña activa
    const cardIngreso = document.getElementById('mini-card-hoy-ingreso');
    const cardGasto = document.getElementById('mini-card-hoy-gasto');

    if (filtroHoySeleccionado === 'todos') {
        cardIngreso.style.display = 'flex';
        cardGasto.style.display = 'flex';
    } else if (filtroHoySeleccionado === 'ingreso') {
        cardIngreso.style.display = 'flex';
        cardGasto.style.display = 'none';
    } else if (filtroHoySeleccionado === 'gasto') {
        cardIngreso.style.display = 'none';
        cardGasto.style.display = 'flex';
    }

    if (movimientosHoy.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#7f8c8d;">No hay movimientos registrados hoy.</td></tr>`;
        return;
    }

    movimientosHoy.forEach(t => {
        const tr = document.createElement('tr');
        const esIngreso = t.tipo === 'ingreso';
        const esTraspaso = t.tipo === 'traspaso';
        
        let medioTexto = t.medioPago;
        if (t.medioPago === 'Efectivo' && t.ubicacionEfectivo) {
            medioTexto += ` (${t.ubicacionEfectivo})`;
        }
        if (esTraspaso) {
            medioTexto = `🔄 ${t.medioPago} ➡️ ${t.medioDestino}`;
        }

        let claseMonto = esIngreso ? 'txt-ingreso' : 'txt-gasto';
        if (esTraspaso) claseMonto = ''; 

        let signo = esIngreso ? '+' : (esTraspaso ? '' : '-');

        tr.innerHTML = `
            <td>${t.usuario}</td>
            <td>${t.descripcion}</td>
            <td>${medioTexto}</td>
            <td class="${claseMonto}">${signo}$${parseFloat(t.monto).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
            <td>
                <button class="btn-editar" onclick="prepararEdicion(${t.id})">✏️</button>
                <button class="btn-borrar" onclick="eliminarMovimiento(${t.id})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// PUNTO 5: SÚPER FILTROS CRUZADOS Y PANEL DE TOTALES DINÁMICOS EN HISTORIAL
function filtrarHistorial() {
    const textoBusqueda = document.getElementById('buscar-texto').value.toLowerCase();
    const miembroSelected = document.getElementById('filtro-miembro').value;
    const tipoSelected = document.getElementById('filtro-tipo-historial').value;
    const medioSelected = document.getElementById('filtro-medio').value;

    let registros = [...transaccionesGlobal];
    const mesActualAño = new Date().getMonth();
    const añoActual = new Date().getFullYear();

    // 1. Filtrado por Pestaña de Tiempo (Mes en Curso vs Histórico)
    if (filtroPeriodoActual === 'mes') {
        registros = registros.filter(t => {
            const f = new Date(t.id);
            return f.getMonth() === mesActualAño && f.getFullYear() === añoActual;
        });
    } else {
        const selector = document.getElementById('selector-meses');
        if (selector.value) {
            const [año, mes] = selector.value.split('-');
            registros = registros.filter(t => {
                const f = new Date(t.id);
                return f.getFullYear() === parseInt(año) && f.getMonth() === parseInt(mes);
            });
        }
    }

    // 2. Filtro Cruzado: Búsqueda por Texto Libre
    if (textoBusqueda) {
        registros = registros.filter(t => t.descripcion.toLowerCase().includes(textoBusqueda));
    }

    // 3. Filtro Cruzado: Por Miembro de la Familia
    if (miembroSelected !== 'todos') {
        registros = registros.filter(t => t.usuario === miembroSelected);
    }

    // 4. Filtro Cruzado: Por Tipo de Operación
    if (tipoSelected !== 'todos') {
        registros = registros.filter(t => t.tipo === tipoSelected);
    }

    // 5. Filtro Cruzado: Por Medio de Pago (Evalúa Origen o Destino en traspasos)
    if (medioSelected !== 'todos') {
        registros = registros.filter(t => t.medioPago === medioSelected || (t.tipo === 'traspaso' && t.medioDestino === medioSelected));
    }

    // --- CÁLCULO DE LOS TOTALES EN BASE A LOS REGISTROS FILTRADOS ---
    let sumaIngresos = 0;
    let sumaGastos = 0;

    registros.forEach(t => {
        const m = parseFloat(t.monto) || 0;
        if (t.tipo === 'ingreso') sumaIngresos += m;
        if (t.tipo === 'gasto') sumaGastos += m;
    });

    const balanceNetoFiltrado = sumaIngresos - sumaGastos;

    // --- INTERFAZ INTELIGENTE DE TOTALES: MOSTRAR/OCULTAR DINÁMICAMENTE ---
    const cardNeto = document.getElementById('card-total-neto-historial');
    const cardIngresos = document.getElementById('card-total-ingresos-historial');
    const cardGastos = document.getElementById('card-total-gastos-historial');

    // Inyectamos valores calculados
    document.getElementById('total-neto-historial').innerHTML = `$${balanceNetoFiltrado.toLocaleString('es-AR', {minimumFractionDigits:2})}`;
    document.getElementById('total-ingresos-historial').innerHTML = `$${sumaIngresos.toLocaleString('es-AR', {minimumFractionDigits:2})}`;
    document.getElementById('total-gastos-historial').innerHTML = `$${sumaGastos.toLocaleString('es-AR', {minimumFractionDigits:2})}`;

    // Lógica inteligente de visualización limpia según selección
    if (tipoSelected === 'todos' || tipoSelected === 'traspaso') {
        cardNeto.style.display = 'flex';
        cardIngresos.style.display = 'flex';
        cardGastos.style.display = 'flex';
    } else if (tipoSelected === 'ingreso') {
        cardNeto.style.display = 'none';
        cardIngresos.style.display = 'flex';
        cardGastos.style.display = 'none';
    } else if (tipoSelected === 'gasto') {
        cardNeto.style.display = 'none';
        cardIngresos.style.display = 'none';
        cardGastos.style.display = 'flex';
    }

    // Renderizar cuerpo de la tabla del Historial
    renderizarTablaHistorialCompleto(registros);
}

// DIBUJAR TABLA DEL HISTORIAL COMPLETO
function renderizarTablaHistorialCompleto(registros) {
    const tbody = document.getElementById('lista-transacciones');
    tbody.innerHTML = '';

    if (registros.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:#7f8c8d;">No se encontraron registros históricos con los filtros aplicados.</td></tr>`;
        return;
    }

    registros.forEach(t => {
        const tr = document.createElement('tr');
        const fechaFormateada = new Date(t.id).toLocaleDateString('es-AR', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit'});
        
        const esIngreso = t.tipo === 'ingreso';
        const esTraspaso = t.tipo === 'traspaso';

        let medioTexto = t.medioPago;
        if (t.medioPago === 'Efectivo' && t.ubicacionEfectivo) medioTexto += ` (${t.ubicacionEfectivo})`;
        if (esTraspaso) medioTexto = `🔄 ${t.medioPago} ➡️ ${t.medioDestino}`;

        let claseMonto = esIngreso ? 'txt-ingreso' : 'txt-gasto';
        let tipoLabel = esIngreso ? '🟢 Ingreso' : '🔴 Gasto';
        if (esTraspaso) {
            claseMonto = '';
            tipoLabel = '🔄 Traspaso';
        }

        let signo = esIngreso ? '+' : (esTraspaso ? '' : '-');

        tr.innerHTML = `
            <td>${fechaFormateada}</td>
            <td>${t.usuario}</td>
            <td>${t.descripcion}</td>
            <td>${medioTexto}</td>
            <td>${tipoLabel}</td>
            <td class="${claseMonto}">${signo}$${parseFloat(t.monto).toLocaleString('es-AR', {minimumFractionDigits:2})}</td>
            <td>
                <button class="btn-editar" onclick="prepararEdicion(${t.id})">✏️</button>
                <button class="btn-borrar" onclick="eliminarMovimiento(${t.id})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// GUARDAR NUEVO MOVIMIENTO / CONFIRMAR EDICIÓN
async function guardarMovimiento(e) {
    e.preventDefault();

    const editId = document.getElementById('edit-id').value;
    const tipo = document.getElementById('tipo').value;
    const usuario = document.getElementById('usuario').value;
    const medioPago = document.getElementById('medio-pago').value;
    const ubicacionEfectivo = document.getElementById('ubicacion-efectivo').value;
    const medioDestino = document.getElementById('medio-destino').value;
    const monto = parseFloat(document.getElementById('monto').value);
    const descripcion = document.getElementById('descripcion').value;

    const transaccion = {
        id: editId ? parseInt(editId) : Date.now(),
        tipo,
            id: editId ? parseInt(editId) : Date.now(),
        tipo,
        usuario,
        medioPago,
        ubicacionEfectivo: (tipo === 'ingreso' && medioPago === 'Efectivo') ? ubicacionEfectivo : '',
        medioDestino: tipo === 'traspaso' ? medioDestino : '',
        monto,
        descripcion
    };

    try {
        // Si estábamos editando, eliminamos el registro viejo primero mediante DELETE
        if (editId) {
            await fetch(`${API_URL}?id=${editId}`, { method: 'DELETE' });
        }

        // Enviamos el registro nuevo o corregido por POST a Render
        const respuesta = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaccion)
        });

        if (!respuesta.ok) throw new Error('Error al guardar en el servidor');

        // Limpieza y reseteo completo del formulario
        cancelarEdicion();
        // Recargar los movimientos y actualizar balances en tiempo real
        cargarMovimientos();
    } catch (error) {
        console.error("Error al guardar:", error);
        alert("Hubo un problema al guardar el movimiento en el servidor.");
    }
}

// PREPARAR PANEL PARA EDICIÓN (✏️)
function prepararEdicion(id) {
    const t = transaccionesGlobal.find(item => item.id === id);
    if (!t) return;

    // Volvemos automáticamente al dashboard principal si estábamos parados en el historial
    document.getElementById('vista-dashboard').style.display = 'grid';
    document.getElementById('vista-historial').style.display = 'none';

    // Inyectamos los datos en los campos del formulario
    document.getElementById('edit-id').value = t.id;
    document.getElementById('tipo').value = t.tipo;
    document.getElementById('usuario').value = t.usuario;
    
    // Configuramos los campos dinámicos según el tipo de operación que se recuperó
    alternarCamposPago(); 

    document.getElementById('medio-pago').value = t.medioPago;
    if (t.tipo === 'ingreso' && t.medioPago === 'Efectivo') {
        document.getElementById('contenedor-ubicacion-efectivo').style.display = 'block';
        document.getElementById('ubicacion-efectivo').value = t.ubicacionEfectivo || '';
    }
    if (t.tipo === 'traspaso') {
        document.getElementById('medio-destino').value = t.medioDestino || 'Mercado Pago';
    }

    document.getElementById('monto').value = t.monto;
    document.getElementById('descripcion').value = t.descripcion;

    // Cambiar la estética visual del formulario para avisar que se está editando
    document.getElementById('form-titulo').innerHTML = '✏️ Editar Movimiento Seleccionado';
    document.getElementById('btn-submit-form').innerHTML = 'Confirmar Modificación';
    document.getElementById('btn-cancelar-edit').style.display = 'block';

    // Desplazamiento suave de pantalla hacia el formulario
    window.scrollTo({ top: document.getElementById('form-titulo').offsetTop - 20, behavior: 'smooth' });
}

// CANCELAR EDICIÓN Y REINICIAR FORMULARIO DE CARGA
function cancelarEdicion() {
    document.getElementById('form-transaccion').reset();
    document.getElementById('edit-id').value = '';
    
    document.getElementById('form-titulo').innerHTML = '📝 Registrar Nuevo Movimiento';
    document.getElementById('btn-submit-form').innerHTML = 'Guardar Movimiento';
    document.getElementById('btn-cancelar-edit').style.display = 'none';
    
    alternarCamposPago();
}

// ELIMINAR MOVIMIENTO DEL SISTEMA (🗑️)
async function eliminarMovimiento(id) {
    if (!confirm('¿Estás seguro de que deseas eliminar permanentemente este registro?')) return;

    try {
        const respuesta = await fetch(`${API_URL}?id=${id}`, { method: 'DELETE' });
        if (!respuesta.ok) throw new Error('Error al eliminar en el servidor');

        // Volver a consultar la base de datos para recalcular todos los balances
        cargarMovimientos();
    } catch (error) {
        console.error("Error al eliminar:", error);
        alert("No se pudo eliminar el movimiento.");
    }
}
// GENERAR SELECTOR DINÁMICO DE ARCHIVOS HISTÓRICOS (Agrupa por Año y Mes)
function generarOpcionesMesesArchivados() {
    const selector = document.getElementById('selector-meses');
    if (!selector) return;
    
    selector.innerHTML = '';

    const mesesNombres = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const mapaMeses = {};

    // Buscamos todos los meses que tengan al menos un movimiento en la base de datos
    transaccionesGlobal.forEach(t => {
        const f = new Date(t.id);
        const clave = `${f.getFullYear()}-${f.getMonth()}`;
        mapaMeses[clave] = { año: f.getFullYear(), mes: f.getMonth() };
    });

    // Ordenamos cronológicamente de más reciente a más antiguo
    const ordenados = Object.keys(mapaMeses).sort((a, b) => b.localeCompare(a));

    if (ordenados.length === 0) {
        selector.innerHTML = '<option value="">No hay registros históricos</option>';
        return;
    }

    ordenados.forEach(clave => {
        const item = mapaMeses[clave];
        const option = document.createElement('option');
        option.value = clave;
        option.innerHTML = `${mesesNombres[item.mes]} ${item.año}`;
        selector.appendChild(option);
    });

    // Ejecuta el filtro inmediato con el mes que quedó seleccionado por defecto
    filtrarHistorial();
}

// MANEJAR CAMBIO DE SELECCIÓN EN EL SELECTOR DE MESES ARCHIVADOS
function cargarMesArchivado() {
    filtrarHistorial();
}

// EXPORTACIÓN A EXCEL EN FORMATO CSV UNIVERSAL (Punto 5)
function exportarExcel() {
    // Encabezados del archivo CSV
    let contenido = "Fecha,Miembro,Detalle,Medio / Ubicacion,Tipo,Monto\n";
    
    // Obtenemos todas las filas renderizadas actualmente en la tabla del historial
    const filas = document.querySelectorAll("#lista-transacciones tr");
    
    if (filas.length === 0) {
        alert("No hay datos filtrados disponibles para exportar.");
        return;
    }

    // Recorremos cada fila celda por celda limpiando comas para no romper las columnas
    filas.forEach(fila => {
        const c = fila.cells;
        // Validamos que sea una fila con datos fidedignos y no el mensaje de "no se encontraron registros"
        if (c && c.length >= 6) {
            const fecha = c[0].innerText.replace(/,/g, '');
            const miembro = c[1].innerText.replace(/,/g, '');
            const detalle = c[2].innerText.replace(/,/g, '');
            const medio = c[3].innerText.replace(/,/g, '');
            const tipo = c[4].innerText.replace(/,/g, '');
            // Limpiamos el signo \$ y los puntos de miles, dejando solo el formato numérico limpio
            const monto = c[5].innerText.replace(/[^0-9.-]/g, '');

            contenido += `${fecha},${miembro},${detalle},${medio},${tipo},${monto}\n`;
        }
    });

    // Crear archivo descargable con BOM UTF-8 para que Excel reconozca los emojis y tildes correctamente
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), contenido], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    
    // Nombre dinámico del reporte según el período seleccionado
    const nombreArchivo = `Historial_Saltor_Martinez_${filtroPeriodoActual}.csv`;
    link.setAttribute("download", nombreArchivo);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ACCIÓN DE CIERRE MENSUAL SIMULADO DESDE EL FRONTEND
function ejecutarCierreMensual() {
    if (!confirm("🔒 ¿Estás seguro de que deseas archivar y cerrar el mes en curso? Esto consolidará los reportes.")) return;
    
    alert("🔒 El mes actual ha sido guardado y archivado correctamente en el Panel Histórico.");
    cambiarFiltro('archivo');
}
    
