import { useSyncExternalStore } from 'react'

/** Evento no estándar de Chrome/Edge/Android para instalar la PWA. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallState = 'disponible' | 'instalada' | 'ios' | 'no-disponible'

let deferred: BeforeInstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

/** Se llama al arrancar (main.tsx): el evento llega antes de que se abra la pantalla Más. */
export function listenForInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred = e as BeforeInstallPromptEvent
    emit()
  })
  window.addEventListener('appinstalled', () => {
    installed = true
    deferred = null
    emit()
  })
}

function snapshot(): InstallState {
  if (installed || isStandalone()) return 'instalada'
  if (deferred) return 'disponible'
  if (isIos()) return 'ios'
  return 'no-disponible'
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribe, snapshot, () => 'no-disponible')
}

/** Abre el diálogo de instalación del navegador. Devuelve true si el usuario aceptó. */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false
  const e = deferred
  deferred = null
  await e.prompt()
  const { outcome } = await e.userChoice
  emit()
  return outcome === 'accepted'
}
