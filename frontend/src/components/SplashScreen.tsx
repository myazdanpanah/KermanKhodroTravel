import { useEffect, useRef, useState } from 'react'
import { useBrandLogo } from '../store/brandingStore'

type Phase = 'glow' | 'flash' | 'done'

interface SplashScreenProps {
  /** While true the overlay stays up, glowing. Set false to play the flash and exit. */
  show: boolean
  /** Minimum visible time, so a fast API call doesn't cause a flicker. */
  minMs?: number
  /** Fired once the flash finishes — unmount the splash here. */
  onExited?: () => void
}

export default function SplashScreen({ show, minMs = 900, onExited }: SplashScreenProps) {
  const mountedAt = useRef(Date.now())
  const exitedRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('glow')
  const logo = useBrandLogo()

  // Loading finished: hold for the minimum time, then flash.
  useEffect(() => {
    if (show || phase !== 'glow') return
    const remaining = Math.max(0, minMs - (Date.now() - mountedAt.current))
    const t = window.setTimeout(() => setPhase('flash'), remaining)
    return () => window.clearTimeout(t)
  }, [show, phase, minMs])

  // Flash plays, then hand control back so the parent can unmount.
  useEffect(() => {
    if (phase !== 'flash') return
    const t = window.setTimeout(() => {
      setPhase('done')
      if (!exitedRef.current) {
        exitedRef.current = true
        onExited?.()
      }
    }, 420)
    return () => window.clearTimeout(t)
  }, [phase, onExited])

  if (phase === 'done') return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-50 dark:bg-nx-navy transition-colors duration-300"
      role="status"
      aria-live="polite"
      aria-label="در حال بارگذاری"
    >
      <div className="relative flex flex-col items-center px-8">
        <div className="nx-splash-halo pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full" />
        <img
          src={logo}
          alt="Nexivo"
          draggable={false}
          className="nx-splash-mark relative h-24 w-auto select-none"
        />
        <div className="nx-splash-bar relative mt-10 h-[3px] w-40 overflow-hidden rounded-full bg-slate-300 dark:bg-white/10">
          <div className="nx-splash-bar-fill h-full w-1/3 rounded-full bg-nx-teal" />
        </div>
        <p className="relative mt-4 text-xs tracking-wide text-slate-500 dark:text-nx-mist/70">در حال بارگذاری…</p>
      </div>
      {phase === 'flash' && (
        <div className="nx-splash-flash pointer-events-none absolute inset-0 bg-white" />
      )}
    </div>
  )
}
