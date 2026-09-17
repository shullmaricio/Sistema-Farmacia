import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Download, Upload, Trash2, ShieldAlert } from 'lucide-react'
import {
  leerConfig,
  guardarConfig,
  exportarRespaldo,
  importarRespaldo,
  borrarTodo,
} from '../db/db'
import { fechaHora, diasHasta } from '../utils/formato'
import Modal from '../components/Modal'

export default function Configuracion() {
  const [config, setConfig] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmarBorrado, setConfirmarBorrado] = useState(false)
  const [textoConfirmacion, setTextoConfirmacion] = useState('')

  useEffect(() => {
    leerConfig().then(setConfig)
  }, [])

  if (!config) return <p className="text-tinta-suave">Cargando...</p>

  const cambiar = (clave, valor) => setConfig((c) => ({ ...c, [clave]: valor }))

  async function guardar() {
    setGuardando(true)
    try {
      const { inicializada, ...aGuardar } = config
      const actualizada = await guardarConfig(aGuardar)
      setConfig(actualizada)
      toast.success('Cambios guardados')
    } catch (e) {
      toast.error('No se pudieron guardar los cambios: ' + e.message)
    } finally {
      setGuardando(false)
    }
  }

  async function descargarRespaldo() {
    try {
      const respaldo = await exportarRespaldo()
      const blob = new Blob([JSON.stringify(respaldo, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const hoy = new Date()
      const sello = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
      a.href = url
      a.download = `respaldo-farmacia-${sello}.json`
      a.click()
      URL.revokeObjectURL(url)
      const actualizada = await guardarConfig({
        ultimoRespaldo: new Date().toISOString(),
      })
      setConfig(actualizada)
      toast.success('Respaldo descargado')
    } catch (e) {
      toast.error('No se pudo generar el respaldo: ' + e.message)
    }
  }

  async function subirRespaldo(evento) {
    const archivo = evento.target.files?.[0]
    evento.target.value = ''
    if (!archivo) return
    if (
      !window.confirm(
        'Esto va a reemplazar TODOS los datos actuales por los del archivo. ¿Continuar?'
      )
    )
      return
    try {
      const texto = await archivo.text()
      await importarRespaldo(JSON.parse(texto))
      const actualizada = await leerConfig()
      setConfig(actualizada)
      toast.success('Respaldo restaurado')
    } catch (e) {
      toast.error('El archivo no se pudo leer: ' + e.message)
    }
  }

  async function ejecutarBorrado() {
    try {
      await borrarTodo()
      setConfirmarBorrado(false)
      setTextoConfirmacion('')
      setConfig(await leerConfig())
      toast.success('Todos los datos fueron borrados')
    } catch (e) {
      toast.error('No se pudo borrar: ' + e.message)
    }
  }

  const diasDesdeRespaldo = config.ultimoRespaldo
    ? Math.abs(diasHasta(config.ultimoRespaldo))
    : null
  const respaldoAtrasado =
    diasDesdeRespaldo === null ||
    diasDesdeRespaldo > (config.diasRecordatorioRespaldo ?? 7)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Configuracion</h1>

      {respaldoAtrasado && (
        <div className="flex gap-3 rounded-xl border border-ambar/30 bg-ambar-claro p-4">
          <ShieldAlert className="mt-0.5 shrink-0 text-ambar" size={20} />
          <div>
            <p className="font-medium text-ambar">
              {diasDesdeRespaldo === null
                ? 'Todavia no hiciste ningun respaldo'
                : `Tu ultimo respaldo fue hace ${diasDesdeRespaldo} dias`}
            </p>
            <p className="mt-1 text-sm text-tinta-suave">
              Los datos viven solo en este dispositivo. Si se pierde el celular o
              se borran los datos del navegador, no hay forma de recuperarlos.
              Descarga el respaldo y guardalo en tu correo o en Drive.
            </p>
          </div>
        </div>
      )}

      {/* Datos del local */}
      <section className="tarjeta p-5">
        <h2 className="text-lg font-semibold">Datos del local</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Aparecen en el comprobante de venta.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="nombreLocal">
              Nombre de la farmacia
            </label>
            <input
              id="nombreLocal"
              className="campo"
              value={config.nombreLocal || ''}
              onChange={(e) => cambiar('nombreLocal', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="telefono">
              Telefono
            </label>
            <input
              id="telefono"
              className="campo"
              inputMode="tel"
              value={config.telefono || ''}
              onChange={(e) => cambiar('telefono', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="etiqueta" htmlFor="direccion">
              Direccion
            </label>
            <input
              id="direccion"
              className="campo"
              value={config.direccion || ''}
              onChange={(e) => cambiar('direccion', e.target.value)}
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="nit">
              NIT
            </label>
            <input
              id="nit"
              className="campo"
              inputMode="numeric"
              value={config.nit || ''}
              onChange={(e) => cambiar('nit', e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Alertas */}
      <section className="tarjeta p-5">
        <h2 className="text-lg font-semibold">Alertas</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Cuando el sistema te avisa que algo esta por vencer o por acabarse.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="etiqueta" htmlFor="venc">
              Avisar vencimiento con (dias)
            </label>
            <input
              id="venc"
              type="number"
              min="1"
              className="campo"
              value={config.diasAlertaVencimiento}
              onChange={(e) =>
                cambiar('diasAlertaVencimiento', Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="vencCrit">
              Marcar como urgente con (dias)
            </label>
            <input
              id="vencCrit"
              type="number"
              min="1"
              className="campo"
              value={config.diasAlertaVencimientoCritico}
              onChange={(e) =>
                cambiar('diasAlertaVencimientoCritico', Number(e.target.value))
              }
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="sinMov">
              Considerar "sin movimiento" tras (dias)
            </label>
            <input
              id="sinMov"
              type="number"
              min="1"
              className="campo"
              value={config.diasSinMovimiento}
              onChange={(e) => cambiar('diasSinMovimiento', Number(e.target.value))}
            />
          </div>
          <div>
            <label className="etiqueta" htmlFor="recRespaldo">
              Recordar respaldo cada (dias)
            </label>
            <input
              id="recRespaldo"
              type="number"
              min="1"
              className="campo"
              value={config.diasRecordatorioRespaldo}
              onChange={(e) =>
                cambiar('diasRecordatorioRespaldo', Number(e.target.value))
              }
            />
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0 rounded border-borde text-farmacia focus:ring-farmacia"
            checked={!!config.permitirVenderVencido}
            onChange={(e) => cambiar('permitirVenderVencido', e.target.checked)}
          />
          <span className="text-sm">
            Permitir vender lotes vencidos con autorizacion
            <span className="mt-0.5 block text-tinta-suave">
              Recomendado dejarlo apagado. Si lo activas, el sistema va a pedir
              una confirmacion extra en vez de bloquear la venta.
            </span>
          </span>
        </label>
      </section>

      <button
        className="btn-principal w-full sm:w-auto"
        onClick={guardar}
        disabled={guardando}
      >
        {guardando ? 'Guardando...' : 'Guardar cambios'}
      </button>

      {/* Respaldo */}
      <section className="tarjeta p-5">
        <h2 className="text-lg font-semibold">Respaldo</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Ultimo respaldo: {config.ultimoRespaldo ? fechaHora(config.ultimoRespaldo) : 'nunca'}
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button className="btn-principal" onClick={descargarRespaldo}>
            <Download size={18} />
            Descargar respaldo
          </button>
          <label className="btn-secundario cursor-pointer">
            <Upload size={18} />
            Restaurar desde archivo
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={subirRespaldo}
            />
          </label>
        </div>
      </section>

      {/* Zona de riesgo */}
      <section className="rounded-xl border border-peligro/30 bg-peligro-claro p-5">
        <h2 className="text-lg font-semibold text-peligro">Borrar todo</h2>
        <p className="mt-1 text-sm text-tinta-suave">
          Elimina productos, lotes, ventas y dispensaciones de este dispositivo.
          No se puede deshacer. Descarga un respaldo antes.
        </p>
        <button
          className="btn-peligro mt-4"
          onClick={() => setConfirmarBorrado(true)}
        >
          <Trash2 size={18} />
          Borrar todos los datos
        </button>
      </section>

      <Modal
        abierto={confirmarBorrado}
        alCerrar={() => {
          setConfirmarBorrado(false)
          setTextoConfirmacion('')
        }}
        titulo="Confirmar borrado total"
        pie={
          <div className="flex gap-3">
            <button
              className="btn-secundario flex-1"
              onClick={() => {
                setConfirmarBorrado(false)
                setTextoConfirmacion('')
              }}
            >
              Cancelar
            </button>
            <button
              className="btn-peligro flex-1"
              disabled={textoConfirmacion.trim().toUpperCase() !== 'BORRAR'}
              onClick={ejecutarBorrado}
            >
              Borrar todo
            </button>
          </div>
        }
      >
        <p className="text-sm">
          Vas a perder todo el inventario, las ventas y el historial de
          dispensacion controlada guardados en este dispositivo.
        </p>
        <label className="etiqueta mt-4" htmlFor="confirmar">
          Escribe BORRAR para confirmar
        </label>
        <input
          id="confirmar"
          className="campo"
          value={textoConfirmacion}
          onChange={(e) => setTextoConfirmacion(e.target.value)}
          autoComplete="off"
        />
      </Modal>
    </div>
  )
}
