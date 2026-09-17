import Dexie from 'dexie'

// ---------------------------------------------------------------------------
// Base de datos local (IndexedDB a traves de Dexie).
// Todo vive en el dispositivo. No hay servidor ni internet involucrado.
// ---------------------------------------------------------------------------

export const db = new Dexie('FarmaciaDB')

// Los indices son los campos por los que se puede BUSCAR rapido.
// Los demas campos existen igual, solo que no estan indexados.
db.version(1).stores({
  productos:
    '++id, nombreComercial, principioActivo, codigoBarras, categoriaId, esControlado, activo',
  lotes: '++id, productoId, fechaVencimiento, numeroLote, compraId, cantidadActual',
  compras: '++id, proveedorId, fecha',
  ventas: '++id, fecha, turnoId, cajero',
  dispensaciones: '++id, ventaId, fecha, pacienteCarnet, tipoReceta',
  turnos: '++id, estado, fechaApertura',
  proveedores: '++id, nombre, activo',
  categorias: '++id, nombre',
  movimientos: '++id, fecha, productoId, loteId, tipo',
  config: 'clave',
})

// ---------------------------------------------------------------------------
// Valores por defecto de configuracion
// ---------------------------------------------------------------------------

export const CONFIG_DEFECTO = {
  nombreLocal: 'Mi Farmacia',
  direccion: '',
  telefono: '',
  nit: '',
  diasAlertaVencimiento: 90,
  diasAlertaVencimientoCritico: 30,
  diasSinMovimiento: 60,
  diasRecordatorioRespaldo: 7,
  ultimoRespaldo: null,
  permitirVenderVencido: false,
}

export const TIPOS_CONTROLADO = {
  ninguno: 'No controlado',
  psicotropico: 'Psicotropico (receta archivada)',
  estupefaciente: 'Estupefaciente (receta valorada)',
}

export const TIPOS_MOVIMIENTO = {
  compra: 'Ingreso por compra',
  venta: 'Salida por venta',
  ajuste: 'Ajuste manual',
  baja: 'Baja por vencimiento o merma',
  devolucion: 'Devolucion',
}

// Listas cerradas para los selects de Productos. Se pueden ampliar aqui
// sin tocar el schema, porque no son campos indexados.
export const PRESENTACIONES = [
  'Caja',
  'Blister',
  'Frasco',
  'Frasco ampolla',
  'Tubo',
  'Ampolla',
  'Sobre',
  'Unidad',
  'Otro',
]

export const UNIDADES_MEDIDA = ['mg', 'g', 'ml', 'mcg', 'UI', 'unidad']

// ---------------------------------------------------------------------------
// Lectura y escritura de configuracion
// ---------------------------------------------------------------------------

export async function leerConfig() {
  const filas = await db.config.toArray()
  const guardada = {}
  filas.forEach((f) => {
    guardada[f.clave] = f.valor
  })
  return { ...CONFIG_DEFECTO, ...guardada }
}

export async function guardarConfig(cambios) {
  const entradas = Object.entries(cambios).map(([clave, valor]) => ({
    clave,
    valor,
  }))
  await db.config.bulkPut(entradas)
  return leerConfig()
}

// ---------------------------------------------------------------------------
// Primera vez que se abre el sistema: categorias iniciales tipicas de farmacia.
// Se puede editar o borrar todo despues desde Configuracion.
// ---------------------------------------------------------------------------

const CATEGORIAS_INICIALES = [
  'Analgesicos y antiinflamatorios',
  'Antibioticos',
  'Antigripales y tos',
  'Gastrointestinales',
  'Cardiovascular y presion',
  'Diabetes',
  'Dermatologicos',
  'Oftalmicos y oticos',
  'Vitaminas y suplementos',
  'Salud sexual y anticonceptivos',
  'Materno infantil',
  'Material de curacion',
  'Higiene y cuidado personal',
  'Otros',
]

export async function inicializarBase() {
  const yaIniciada = await db.config.get('inicializada')
  if (yaIniciada?.valor) return

  await db.transaction('rw', db.categorias, db.config, async () => {
    const cuantas = await db.categorias.count()
    if (cuantas === 0) {
      await db.categorias.bulkAdd(
        CATEGORIAS_INICIALES.map((nombre) => ({ nombre }))
      )
    }
    await db.config.put({ clave: 'inicializada', valor: true })
  })
}

// ---------------------------------------------------------------------------
// Respaldo: exportar e importar toda la base en un archivo JSON.
// ---------------------------------------------------------------------------

const TABLAS_RESPALDO = [
  'productos',
  'lotes',
  'compras',
  'ventas',
  'dispensaciones',
  'turnos',
  'proveedores',
  'categorias',
  'movimientos',
  'config',
]

export async function exportarRespaldo() {
  const datos = {}
  for (const tabla of TABLAS_RESPALDO) {
    datos[tabla] = await db[tabla].toArray()
  }
  return {
    version: 1,
    generado: new Date().toISOString(),
    datos,
  }
}

export async function importarRespaldo(archivo, { reemplazar = true } = {}) {
  if (!archivo || !archivo.datos) {
    throw new Error('El archivo no tiene el formato de un respaldo valido.')
  }
  await db.transaction('rw', TABLAS_RESPALDO.map((t) => db[t]), async () => {
    for (const tabla of TABLAS_RESPALDO) {
      if (!archivo.datos[tabla]) continue
      if (reemplazar) await db[tabla].clear()
      await db[tabla].bulkPut(archivo.datos[tabla])
    }
  })
}

export async function borrarTodo() {
  await db.transaction('rw', TABLAS_RESPALDO.map((t) => db[t]), async () => {
    for (const tabla of TABLAS_RESPALDO) {
      await db[tabla].clear()
    }
  })
  await inicializarBase()
}
