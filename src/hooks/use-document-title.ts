import { useEffect } from 'react'

/** Título de la pestaña por pantalla ("Deudas · Saldá"): lo anuncian los lectores de pantalla al navegar. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previo = document.title
    document.title = `${title} · Saldá`
    return () => {
      document.title = previo
    }
  }, [title])
}
