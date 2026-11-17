import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '../store/themeStore'

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { dark, toggle } = useThemeStore()

  return (
    <button
      onClick={toggle}
      className={`p-2 rounded-xl transition ${dark ? 'bg-nx-navy text-nx-warning-400 hover:bg-nx-muted' : 'bg-nx-mist/10 text-nx-muted hover:bg-nx-mist/20'} ${className}`}
      title={dark ? 'حالت روشن' : 'حالت تاریک'}
    >
      {dark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}
