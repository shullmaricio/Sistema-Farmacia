import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import toast from 'react-hot-toast'
import {
  Plus,
  Search,
  Pencil,
  Boxes,
  Ban,
  CheckCircle2,
  PackagePlus,
  Minus,
} from 'lucide-react'
import { db, leerConfig, TIPOS_CONTROLADO, PRESENTACIONES, UNIDADES_MEDIDA } from '../db/db'
import {
  crearProducto,
  actualizarProducto,
  cambiarEstadoProducto,
  resumenPorProducto,
  listarLotesDeProducto,
  crearLoteManual,
  incrementarLote,
  restarLoteManual,
  crearProveedorRapido,
  crearCategoriaRapida,
} from '../db/operaciones'
import {
  UNIDADES_BASE,
  formasVentaCompletas,
  formaVentaPorDefecto,
  aUnidadesBase,
  costoUnitarioDesde,
  formatearStock,
  revisarFormasVenta,
} from '../db/empaque'
import { bs, estadoVencimiento, claseInsigniaVencimiento, aInputFecha } from '../utils/formato'
import Modal from '../components/Modal'

const FILTROS = [
  { id: 'todos', etiqueta: 'Todos' },
  { id: 'stock-bajo', etiqueta: 'Stock bajo' },
  { id: 'sin-stock', etiqueta: 'Sin stock' },
  { id: 'por-vencer', etiqueta: 'Por vencer' },
  { id: 'vencidos', etiqueta: 'Vencidos' },
  { id: 'inactivos', etiqueta: 'Inactivos' },
]

const TIPOS_AJUSTE = [
  { id: 'ajuste', etiqueta: 'Correccion de conteo' },
  { id: 'baja', etiqueta: 'Vencimiento / producto danado' },
  { id: 'devolucion', etiqueta: 'Devolucion a proveedor' },
]

const PRODUCTO_VACIO = {
  nombreComercial: '',
  principioActivo: '',
  categoriaId: '',
  laboratorio: '',
  presentacion: '',
  concentracion: '',
  unidadMedida: '',
  codigoBarras: '',
  codigoInterno: '',
  precioCompra: '',
  precioVenta: '',
  stockMinimo: '5',
  ubicacion: '',
  proveedorPrincipalId: '',
  requiereReceta: false,
  esControlado: 'ninguno',
  activo: true,
  unidadBase: 'Unidad',
  permiteFraccionar: true,
  formasVenta: [],
}

export default function Inventario() {
  const productos = useLiveQuery(() => db.productos.toArray(), [])
  const lotes = useLiveQuery(() => db.lotes.toArray(), [])
  const categorias = useLiveQuery(() => db.categorias.toArray(), [])
  const proveedores = useLiveQuery(() => db.proveedores.toArray(), [])
  const config = useLiveQuery(() => leerConfig(), [])

  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('todos')
  const [productoEditar, setProductoEditar] = useState(null) // null=cerrado, {}=nuevo, obj=editar
  const [productoLotes, setProductoLotes] = useState(null)

  const cargando = !productos || !lotes || !categorias || !proveedores || !config

  const categoriaNombre = useMemo(() => {
    const mapa = new Map()
    ;(categorias || []).forEach((c) => mapa.set(c.id, c.nombre))
    return mapa
  }, [categorias])

  const resumen = useMemo(() => resumenPorProducto(lotes || []), [lotes])

  const filas = useMemo(() => {
    if (!productos) return []
    const q = busqueda.trim().toLowerCase()
    return productos
      .map((producto) => {
        const r = resumen.get(producto.id) || { stock: 0, proximoVencimiento: null }
        const estado = estadoVencimiento(r.proximoVencimiento, config)
        return { producto, ...r, estado }
      })
      .filter(({ producto, stock, estado }) => {
        if (q) {
          const enTexto =
            producto.nombreComercial?.toLowerCase().includes(q) ||
            producto.principioActivo?.toLowerCase().includes(q) ||
            producto.codigoBarras?.toLowerCase().includes(q) ||
            producto.codigoInterno?.toLowerCase().includes(q)
          if (!enTexto) return false
        }
        if (filtro === 'stock-bajo') return stock > 0 && stock <= (producto.stockMinimo || 0)
        if (filtro === 'sin-stock') return stock <= 0
        if (filtro === 'por-vencer') return estado.nivel === 'aviso' || estado.nivel === 'critico'
        if (filtro === 'vencidos') return estado.nivel === 'vencido'
        if (filtro === 'inactivos') return !producto.activo
        return producto.activo
      })
      .sort((a, b) => a.producto.nombreComercial.localeCompare(b.producto.nombreComercial))
  }, [productos, resumen, busqueda, filtro, config])

  async function guardarProducto(datos) {
    try {
      if (datos.id) {
        await actualizarProducto(datos.id, datos)
        toast.success('Producto actualizado')
      } else {
        await crearProducto(datos)
        toast.success('Producto creado')
      }
      setProductoEditar(null)
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function alternarActivo(producto) {
    try {
      await cambiarEstadoProducto(producto.id, !producto.activo)
      toast.success(producto.activo ? 'Producto desactivado' : 'Producto activado')
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (cargando) return <p className="text-tinta-suave">Cargando inventario...</p>

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Inventario</h1>
        <button
          className="btn-principal"
          onClick={() => setProductoEditar({ ...PRODUCTO_VACIO })}
        >
          <Plus size={18} />
          Nuevo producto
        </button>
      </div>

      <div className="tarjeta p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-tinta-suave"
            size={18}
          />
          <input
            className="campo pl-10"
            placeholder="Buscar por nombre, principio activo o codigo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filtro === f.id
                  ? 'border-farmacia bg-farmacia-claro text-farmacia-oscuro'
                  : 'border-borde text-tinta-suave hover:bg-papel'
              }`}
            >
              {f.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="tarjeta">
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoria</th>
                <th>Precio venta</th>
                <th>Stock</th>
                <th>Vencimiento</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-tinta-suave">
                    {busqueda || filtro !== 'todos'
                      ? 'No se encontraron productos con ese criterio.'
                      : 'Todavia no registraste ningun producto.'}
                  </td>
                </tr>
              )}
              {filas.map(({ producto, stock, estado }) => (
                <tr key={producto.id} className={producto.activo ? '' : 'opacity-60'}>
                  <td>
                    <p className="font-medium">
                      {producto.nombreComercial}
                      {!producto.activo && (
                        <span className="insignia-neutra ml-2">Inactivo</span>
                      )}
                    </p>
                    <p className="text-xs text-tinta-suave">
                      {producto.principioActivo || 'Sin principio activo registrado'}
                    </p>
                  </td>
                  <td className="text-tinta-suave">
                    {categoriaNombre.get(producto.categoriaId) || '—'}
                  </td>
                  <td className="dato">{bs(producto.precioVenta)}</td>
                  <td>
                    <span
                      className={
                        stock <= 0
                          ? 'insignia-peligro'
                          : stock <= (producto.stockMinimo || 0)
                          ? 'insignia-aviso'
                          : 'insignia-neutra'
                      }
                    >
                      {formatearStock(stock, producto)}
                    </span>
                  </td>
                  <td>
                    <span className={claseInsigniaVencimiento(estado.nivel)}>{estado.texto}</span>
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <button
                        className="btn-icono"
                        title="Lotes"
                        onClick={() => setProductoLotes(producto)}
                      >
                        <Boxes size={18} />
                      </button>
                      <button
                        className="btn-icono"
                        title="Editar"
                        onClick={() => setProductoEditar(producto)}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="btn-icono"
                        title={producto.activo ? 'Desactivar' : 'Activar'}
                        onClick={() => alternarActivo(producto)}
                      >
                        {producto.activo ? <Ban size={18} /> : <CheckCircle2 size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {productoEditar && (
        <FormularioProducto
          producto={productoEditar}
          categorias={categorias}
          proveedores={proveedores}
          alGuardar={guardarProducto}
          alCerrar={() => setProductoEditar(null)}
        />
      )}

      {productoLotes && (
        <ModalLotes
          producto={productoLotes}
          proveedores={proveedores}
          alCerrar={() => setProductoLotes(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formulario de alta / edicion de producto
// ---------------------------------------------------------------------------

function FormularioProducto({ producto, categorias, proveedores, alGuardar, alCerrar }) {
  const [datos, setDatos] = useState(() => ({ ...PRODUCTO_VACIO, ...producto }))
  const [guardando, setGuardando] = useState(false)
  const [nuevaCategoria, setNuevaCategoria] = useState('')
  const [nuevoProveedor, setNuevoProveedor] = useState('')

  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }))

  async function agregarCategoria() {
    if (!nuevaCategoria.trim()) return
    try {
      const id = await crearCategoriaRapida(nuevaCategoria)
      cambiar('categoriaId', id)
      setNuevaCategoria('')
      toast.success('Categoria agregada')
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function agregarProveedor() {
    if (!nuevoProveedor.trim()) return
    try {
      const id = await crearProveedorRapido(nuevoProveedor)
      cambiar('proveedorPrincipalId', id)
      setNuevoProveedor('')
      toast.success('Proveedor agregado')
    } catch (e) {
      toast.error(e.message)
    }
  }

  async function enviar(e) {
    e.preventDefault()
    const avisos = revisarFormasVenta(datos)
    const bloqueante = avisos.find((a) => a.bloquea)
    if (bloqueante) {
      toast.error(bloqueante.texto)
      return
    }
    setGuardando(true)
    try {
      await alGuardar({
        ...datos,
        categoriaId: datos.categoriaId || null,
        proveedorPrincipalId: datos.proveedorPrincipalId || null,
      })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={producto.id ? 'Editar producto' : 'Nuevo producto'}
      ancho="max-w-2xl"
      pie={
        <div className="flex gap-3">
          <button className="btn-secundario flex-1" onClick={alCerrar} type="button">
            Cancelar
          </button>
          <button className="btn-principal flex-1" form="form-producto" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar producto'}
          </button>
        </div>
      }
    >
      <form id="form-producto" onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="etiqueta">Nombre comercial *</label>
            <input
              className="campo"
              value={datos.nombreComercial}
              onChange={(e) => cambiar('nombreComercial', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="etiqueta">Principio activo</label>
            <input
              className="campo"
              value={datos.principioActivo}
              onChange={(e) => cambiar('principioActivo', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta">Laboratorio</label>
            <input
              className="campo"
              value={datos.laboratorio}
              onChange={(e) => cambiar('laboratorio', e.target.value)}
            />
          </div>

          <div>
            <label className="etiqueta">Categoria</label>
            <select
              className="campo"
              value={datos.categoriaId || ''}
              onChange={(e) =>
                cambiar('categoriaId', e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Sin categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                className="campo"
                placeholder="Nueva categoria..."
                value={nuevaCategoria}
                onChange={(e) => setNuevaCategoria(e.target.value)}
              />
              <button type="button" className="btn-secundario shrink-0" onClick={agregarCategoria}>
                Agregar
              </button>
            </div>
          </div>

          <div>
            <label className="etiqueta">Presentacion</label>
            <select
              className="campo"
              value={datos.presentacion}
              onChange={(e) => cambiar('presentacion', e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {PRESENTACIONES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="etiqueta">Concentracion</label>
            <input
              className="campo"
              placeholder="Ej: 500 mg"
              value={datos.concentracion}
              onChange={(e) => cambiar('concentracion', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta">Unidad de medida</label>
            <select
              className="campo"
              value={datos.unidadMedida}
              onChange={(e) => cambiar('unidadMedida', e.target.value)}
            >
              <option value="">Seleccionar...</option>
              {UNIDADES_MEDIDA.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="etiqueta">Codigo de barras</label>
            <input
              className="campo"
              value={datos.codigoBarras}
              onChange={(e) => cambiar('codigoBarras', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta">Codigo interno</label>
            <input
              className="campo"
              placeholder="Se genera automatico si lo dejas vacio"
              value={datos.codigoInterno}
              onChange={(e) => cambiar('codigoInterno', e.target.value)}
            />
          </div>

          <div>
            <label className="etiqueta">Precio de compra (Bs)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="campo"
              value={datos.precioCompra}
              onChange={(e) => cambiar('precioCompra', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta">Precio de venta (Bs) *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="campo"
              value={datos.precioVenta}
              onChange={(e) => cambiar('precioVenta', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="etiqueta">Stock minimo</label>
            <input
              type="number"
              min="0"
              className="campo"
              value={datos.stockMinimo}
              onChange={(e) => cambiar('stockMinimo', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta">Ubicacion / rack</label>
            <input
              className="campo"
              value={datos.ubicacion}
              onChange={(e) => cambiar('ubicacion', e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="etiqueta">Proveedor principal</label>
            <select
              className="campo"
              value={datos.proveedorPrincipalId || ''}
              onChange={(e) =>
                cambiar('proveedorPrincipalId', e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <div className="mt-2 flex gap-2">
              <input
                className="campo"
                placeholder="Nuevo proveedor (solo nombre por ahora)..."
                value={nuevoProveedor}
                onChange={(e) => setNuevoProveedor(e.target.value)}
              />
              <button type="button" className="btn-secundario shrink-0" onClick={agregarProveedor}>
                Agregar
              </button>
            </div>
          </div>

          <div>
            <label className="etiqueta">Control</label>
            <select
              className="campo"
              value={datos.esControlado}
              onChange={(e) => cambiar('esControlado', e.target.value)}
            >
              {Object.entries(TIPOS_CONTROLADO).map(([clave, texto]) => (
                <option key={clave} value={clave}>
                  {texto}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-borde text-farmacia focus:ring-farmacia"
                checked={!!datos.requiereReceta}
                onChange={(e) => cambiar('requiereReceta', e.target.checked)}
              />
              <span className="text-sm">Requiere receta</span>
            </label>
          </div>
        </div>

        <SeccionEmpaque
          precioVenta={datos.precioVenta}
          unidadBase={datos.unidadBase}
          permiteFraccionar={datos.permiteFraccionar}
          formasVenta={datos.formasVenta}
          onUnidadBase={(v) => cambiar('unidadBase', v)}
          onPermiteFraccionar={(v) => cambiar('permiteFraccionar', v)}
          onFormasVenta={(v) => cambiar('formasVenta', v)}
        />
      </form>
    </Modal>
  )
}

// ---------------------------------------------------------------------------
// Empaque: la unidad mas chica que se vende, y las formas de venta extra
// (Blister, Caja, etc), cada una con su propio precio. El precio de venta
// de arriba (precioVenta) siempre es el precio de la unidad base: eso no
// cambia. Esto solo agrega formas MAS GRANDES para vender lo mismo.
// ---------------------------------------------------------------------------

function SeccionEmpaque({
  precioVenta,
  unidadBase,
  permiteFraccionar,
  formasVenta,
  onUnidadBase,
  onPermiteFraccionar,
  onFormasVenta,
}) {
  const productoParaAvisos = { precioVenta, unidadBase, permiteFraccionar, formasVenta }
  const avisos = revisarFormasVenta(productoParaAvisos)

  const cambiarForma = (id, cambios) =>
    onFormasVenta(formasVenta.map((f) => (f.id === id ? { ...f, ...cambios } : f)))

  const agregarForma = () =>
    onFormasVenta([
      ...formasVenta,
      {
        id: `f-${Date.now()}`,
        etiqueta: '',
        factor: '',
        precio: '',
        codigoBarras: '',
        activa: true,
      },
    ])

  const quitarForma = (id) => onFormasVenta(formasVenta.filter((f) => f.id !== id))

  return (
    <div className="space-y-3 border-t border-borde pt-4">
      <div>
        <h3 className="font-medium">Empaque: como se vende</h3>
        <p className="text-sm text-tinta-suave">
          El stock siempre se cuenta en la unidad mas chica. La caja y el blister son solo
          otra forma de cobrar esa misma cantidad, con su propio precio.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="etiqueta">La unidad mas chica que vendes</label>
          <select className="campo" value={unidadBase} onChange={(e) => onUnidadBase(e.target.value)}>
            {UNIDADES_BASE.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-borde text-farmacia focus:ring-farmacia"
              checked={permiteFraccionar !== false}
              onChange={(e) => onPermiteFraccionar(e.target.checked)}
            />
            <span className="text-sm">
              Se puede vender fraccionado (destildalo para un antibiotico o un jarabe que solo
              sale en envase cerrado)
            </span>
          </label>
        </div>
      </div>

      {formasVenta.length > 0 && (
        <div className="tabla-scroll">
          <table className="tabla">
            <thead>
              <tr>
                <th>Se vende como</th>
                <th>Equivale a</th>
                <th>Precio (Bs)</th>
                <th>Codigo de barras</th>
                <th>Activa</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {formasVenta.map((f) => (
                <tr key={f.id}>
                  <td>
                    <input
                      className="campo"
                      placeholder="Ej: Blister, Caja"
                      value={f.etiqueta}
                      onChange={(e) => cambiarForma(f.id, { etiqueta: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="2"
                      className="campo"
                      placeholder={unidadBase.toLowerCase() + 's'}
                      value={f.factor}
                      onChange={(e) => cambiarForma(f.id, { factor: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="campo"
                      value={f.precio}
                      onChange={(e) => cambiarForma(f.id, { precio: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="campo"
                      placeholder="opcional"
                      value={f.codigoBarras}
                      onChange={(e) => cambiarForma(f.id, { codigoBarras: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border-borde text-farmacia focus:ring-farmacia"
                      checked={f.activa !== false}
                      onChange={(e) => cambiarForma(f.id, { activa: e.target.checked })}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-icono"
                      title="Quitar"
                      onClick={() => quitarForma(f.id)}
                    >
                      <Ban size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button type="button" className="btn-secundario" onClick={agregarForma}>
        <Plus size={18} />
        Agregar forma de venta (Blister, Caja...)
      </button>

      {avisos.length > 0 && (
        <ul className="space-y-1">
          {avisos.map((a, i) => (
            <li key={i} className={a.bloquea ? 'text-sm text-peligro' : 'text-sm text-ambar'}>
              {a.texto}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lotes de un producto: listado + alta manual + ajustes
// ---------------------------------------------------------------------------

function ModalLotes({ producto, proveedores, alCerrar }) {
  const lotes = useLiveQuery(() => listarLotesDeProducto(producto.id), [producto.id])
  const [mostrarNuevo, setMostrarNuevo] = useState(false)
  const [loteAjustar, setLoteAjustar] = useState(null)

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={`Lotes de ${producto.nombreComercial}`}
      ancho="max-w-2xl"
    >
      <div className="space-y-4">
        <button className="btn-secundario" onClick={() => setMostrarNuevo(true)}>
          <PackagePlus size={18} />
          Nuevo lote
        </button>

        {!lotes && <p className="text-tinta-suave">Cargando lotes...</p>}
        {lotes && lotes.length === 0 && (
          <p className="text-tinta-suave">Este producto todavia no tiene lotes registrados.</p>
        )}

        {lotes && lotes.length > 0 && (
          <div className="tabla-scroll">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Lote</th>
                  <th>Vencimiento</th>
                  <th>Cantidad</th>
                  <th>Costo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => {
                  const estado = estadoVencimiento(l.fechaVencimiento)
                  return (
                    <tr key={l.id}>
                      <td className="dato">{l.numeroLote || '—'}</td>
                      <td>
                        <span className={claseInsigniaVencimiento(estado.nivel)}>
                          {estado.texto}
                        </span>
                      </td>
                      <td className="dato">
                        {l.cantidadActual} / {l.cantidadInicial}
                      </td>
                      <td className="dato">{bs(l.costoUnitario)}</td>
                      <td>
                        <button
                          className="btn-icono"
                          title="Ajustar cantidad"
                          onClick={() => setLoteAjustar(l)}
                        >
                          <Minus size={18} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mostrarNuevo && (
        <FormularioLote
          producto={producto}
          proveedores={proveedores}
          alCerrar={() => setMostrarNuevo(false)}
        />
      )}

      {loteAjustar && (
        <FormularioAjusteLote
          lote={loteAjustar}
          producto={producto}
          alCerrar={() => setLoteAjustar(null)}
        />
      )}
    </Modal>
  )
}

function FormularioLote({ producto, proveedores, alCerrar }) {
  const formas = formasVentaCompletas(producto)
  const formaInicial = formaVentaPorDefecto(producto)

  const [datos, setDatos] = useState({
    numeroLote: '',
    fechaVencimiento: '',
    fechaIngreso: aInputFecha(new Date()),
    cantidad: '',
    formaVentaId: formaInicial?.id || 'unidad',
    costoDeLaForma: '',
    proveedorId: producto.proveedorPrincipalId || '',
  })
  const [guardando, setGuardando] = useState(false)

  const cambiar = (campo, valor) => setDatos((d) => ({ ...d, [campo]: valor }))

  const formaElegida = formas.find((f) => f.id === datos.formaVentaId) || formas[0]
  const cantidadEnUnidades = aUnidadesBase(datos.cantidad, formaElegida)

  async function enviar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      await crearLoteManual({
        productoId: producto.id,
        numeroLote: datos.numeroLote,
        fechaVencimiento: datos.fechaVencimiento,
        fechaIngreso: datos.fechaIngreso,
        cantidadInicial: cantidadEnUnidades,
        costoUnitario: costoUnitarioDesde(datos.costoDeLaForma, formaElegida),
        proveedorId: datos.proveedorId || null,
      })
      toast.success('Lote agregado')
      alCerrar()
    } catch (e2) {
      toast.error(e2.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo="Nuevo lote"
      pie={
        <div className="flex gap-3">
          <button className="btn-secundario flex-1" onClick={alCerrar} type="button">
            Cancelar
          </button>
          <button className="btn-principal flex-1" form="form-lote" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar lote'}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-tinta-suave">
        Esto registra una entrada manual de stock. Cuando el modulo de Compras este listo,
        los lotes se van a crear automaticamente al confirmar una compra.
      </p>
      <form id="form-lote" onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta">Numero de lote</label>
            <input
              className="campo"
              value={datos.numeroLote}
              onChange={(e) => cambiar('numeroLote', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta">Fecha de vencimiento *</label>
            <input
              type="date"
              className="campo"
              value={datos.fechaVencimiento}
              onChange={(e) => cambiar('fechaVencimiento', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="etiqueta">Fecha de ingreso</label>
            <input
              type="date"
              className="campo"
              value={datos.fechaIngreso}
              onChange={(e) => cambiar('fechaIngreso', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta">Cantidad *</label>
            <input
              type="number"
              min="1"
              className="campo"
              value={datos.cantidad}
              onChange={(e) => cambiar('cantidad', e.target.value)}
              required
            />
          </div>
          <div>
            <label className="etiqueta">Entra como</label>
            {formas.length > 1 ? (
              <select
                className="campo"
                value={datos.formaVentaId}
                onChange={(e) => cambiar('formaVentaId', e.target.value)}
              >
                {formas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.etiqueta}
                    {f.factor > 1 ? ` (${f.factor} ${producto.unidadBase.toLowerCase()}s)` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div className="campo bg-papel text-tinta-suave">{formaElegida?.etiqueta}</div>
            )}
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta">
              Costo por {(formaElegida?.etiqueta || 'unidad').toLowerCase()} (Bs)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className="campo"
              value={datos.costoDeLaForma}
              onChange={(e) => cambiar('costoDeLaForma', e.target.value)}
            />
            {Number(datos.cantidad) > 0 && (
              <p className="mt-1.5 text-sm text-tinta-suave">
                Esto va a sumar {cantidadEnUnidades} {producto.unidadBase.toLowerCase()}
                {cantidadEnUnidades === 1 ? '' : 's'} al stock.
              </p>
            )}
          </div>
          <div>
            <label className="etiqueta">Proveedor</label>
            <select
              className="campo"
              value={datos.proveedorId || ''}
              onChange={(e) =>
                cambiar('proveedorId', e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function FormularioAjusteLote({ lote, producto, alCerrar }) {
  const [direccion, setDireccion] = useState('restar')
  const [tipo, setTipo] = useState('ajuste')
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setGuardando(true)
    try {
      if (direccion === 'sumar') {
        await incrementarLote({ loteId: lote.id, productoId: producto.id, cantidad, motivo })
      } else {
        await restarLoteManual({
          loteId: lote.id,
          productoId: producto.id,
          cantidad,
          tipo,
          motivo,
        })
      }
      toast.success('Stock ajustado')
      alCerrar()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      abierto
      alCerrar={alCerrar}
      titulo={`Ajustar lote ${lote.numeroLote || lote.id}`}
      pie={
        <div className="flex gap-3">
          <button className="btn-secundario flex-1" onClick={alCerrar} type="button">
            Cancelar
          </button>
          <button className="btn-principal flex-1" form="form-ajuste" disabled={guardando}>
            {guardando ? 'Guardando...' : 'Confirmar ajuste'}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-tinta-suave">
        Cantidad actual en este lote: <strong>{lote.cantidadActual}</strong>
      </p>
      <form id="form-ajuste" onSubmit={enviar} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className={direccion === 'restar' ? 'btn-peligro' : 'btn-secundario'}
            onClick={() => setDireccion('restar')}
          >
            Restar stock
          </button>
          <button
            type="button"
            className={direccion === 'sumar' ? 'btn-principal' : 'btn-secundario'}
            onClick={() => setDireccion('sumar')}
          >
            Sumar stock
          </button>
        </div>

        {direccion === 'restar' && (
          <div>
            <label className="etiqueta">Motivo del ajuste</label>
            <select className="campo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_AJUSTE.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.etiqueta}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="etiqueta">Cantidad *</label>
          <input
            type="number"
            min="1"
            max={direccion === 'restar' ? lote.cantidadActual : undefined}
            className="campo"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="etiqueta">Detalle / motivo *</label>
          <input
            className="campo"
            placeholder="Ej: conteo fisico de fin de mes"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            required
          />
        </div>
      </form>
    </Modal>
  )
}
