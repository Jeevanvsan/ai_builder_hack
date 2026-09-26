import AsyncStorage from '@react-native-async-storage/async-storage'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// Disguise personalisation (Epic 13). The user can change the app's display name and pick an icon preset; the
// choice is persisted so it survives restarts and never flashes back to "QuickBite" on launch.
//
// IMPORTANT (untested scaffold): the in-app name below applies everywhere inside the app immediately. Changing the
// HOME-SCREEN icon and label is an OS-level operation:
//   - iOS: `setAlternateIcon` (via a lib such as expo-alternate-app-icons); the label under the icon cannot be
//     changed at all on iOS.
//   - Android: alternate icons are activity-aliases chosen at build time; the home-screen label can only be one of
//     the preset names, not arbitrary text.
// So `iconId` selects a preset here, and the native icon switch is wired where marked in setIcon().

export interface IconPreset {
  id: string
  label: string
}

// Preset disguises the user can switch between (Epic 13.1).
export const ICON_PRESETS: IconPreset[] = [
  { id: 'quickbite', label: 'QuickBite' },
  { id: 'grocery', label: 'FreshCart' },
  { id: 'pharmacy', label: 'MediGo' },
  { id: 'cab', label: 'RideNow' },
  { id: 'notes', label: 'Notes' },
  { id: 'weather', label: 'Weather' },
]

interface Appearance {
  ready: boolean
  name: string
  iconId: string
  setName: (name: string) => void
  setIcon: (iconId: string) => void
}

const NAME_KEY = 'qb.appearance.name'
const ICON_KEY = 'qb.appearance.icon'

const AppearanceContext = createContext<Appearance | null>(null)

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [name, setNameState] = useState('QuickBite')
  const [iconId, setIconState] = useState('quickbite')

  // Load the saved choice BEFORE the first screen renders (Epic 13.2), so "QuickBite" never flashes on launch.
  useEffect(() => {
    void (async () => {
      try {
        const [savedName, savedIcon] = await Promise.all([AsyncStorage.getItem(NAME_KEY), AsyncStorage.getItem(ICON_KEY)])
        if (savedName) setNameState(savedName)
        if (savedIcon) setIconState(savedIcon)
      } catch {
        // Fall back to defaults if storage is unavailable.
      } finally {
        setReady(true)
      }
    })()
  }, [])

  const setName = (next: string) => {
    setNameState(next)
    void AsyncStorage.setItem(NAME_KEY, next).catch(() => {})
  }

  const setIcon = (next: string) => {
    setIconState(next)
    void AsyncStorage.setItem(ICON_KEY, next).catch(() => {})
    // TODO (native, untested): switch the OS home-screen icon here, e.g.
    //   import { setAlternateAppIcon } from 'expo-alternate-app-icons'
    //   setAlternateAppIcon(next === 'quickbite' ? null : next)
    // Requires the icon assets + a config plugin (see app.json). No-op until then.
  }

  return (
    <AppearanceContext.Provider value={{ ready, name, iconId, setName, setIcon }}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance(): Appearance {
  const ctx = useContext(AppearanceContext)
  if (!ctx) throw new Error('useAppearance must be used inside AppearanceProvider')
  return ctx
}
