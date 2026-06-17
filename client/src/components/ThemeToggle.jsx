import { Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme'

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className={`
        group pixel-button pixel-button--small flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300
        ${theme === 'dark' 
          ? 'bg-retro-surface border-retro-border hover:border-retro-cyan hover:bg-retro-cyan/10' 
          : 'bg-retro-surface border-retro-border hover:border-retro-cyan hover:bg-retro-cyan/10 shadow-sm'
        }
      `}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon className="w-5 h-5 text-retro-text opacity-70 group-hover:opacity-100 transition-colors" />
      ) : (
        <Sun className="w-5 h-5 text-retro-yellow opacity-80 group-hover:opacity-100 transition-colors" />
      )}
    </button>
  )
}

export default ThemeToggle
