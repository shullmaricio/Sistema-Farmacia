import { useEffect, useState } from 'react';

const SESSION_FLAG = 'billar_splash_shown_v1';
const DURATION_MS = 1600;

// Se muestra una sola vez por sesión: la primera vez que se abre la app
// (o cada vez que se abrió de nuevo después de haber cerrado la ventana/
// pestaña por completo). Mientras la ventana sigue abierta y el usuario
// solo navega entre pantallas adentro de la app, no vuelve a aparecer.
export function shouldShowSplash() {
  try {
    return !sessionStorage.getItem(SESSION_FLAG);
  } catch {
    return false;
  }
}

function markSplashShown() {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1');
  } catch {
    /* si falla, simplemente no se persiste, no rompe nada */
  }
}

export default function SplashScreen({ onDone }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), DURATION_MS);
    const doneTimer = setTimeout(() => {
      markSplashShown();
      onDone();
    }, DURATION_MS + 300);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <img src="./logo-crealoia.png" alt="Crealo.ia" className="w-48 sm:w-56" />
      <p className="mt-3 text-xs tracking-widest text-gray-400 uppercase">by crealo.ia</p>
    </div>
  );
}
