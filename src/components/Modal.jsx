import { useEffect } from 'react'
import { X } from 'lucide-react'

// Modal con altura maxima y scroll propio: el boton de accion nunca queda
// fuera de la pantalla ni tapado por el teclado del celular.
export default function Modal({
  abierto,
  alCerrar,
  titulo,
  children,
  pie = null,
  ancho = 'max-w-lg',
}) {
  useEffect(() => {
    if (!abierto) return
    const alPresionar = (e) => {
      if (e.key === 'Escape') alCerrar?.()
    }
    document.addEventListener('keydown', alPresionar)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', alPresionar)
      document.body.style.overflow = ''
    }
  }, [abierto, alCerrar])

  if (!abierto) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-tinta/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) alCerrar?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`flex max-h-[90dvh] w-full ${ancho} flex-col rounded-t-2xl bg-white sm:rounded-2xl`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-borde px-4 py-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button className="btn-icono" onClick={alCerrar} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>

        {pie && (
          <div className="shrink-0 border-t border-borde px-4 py-3 area-segura-abajo">
            {pie}
          </div>
        )}
      </div>
    </div>
  )
}
