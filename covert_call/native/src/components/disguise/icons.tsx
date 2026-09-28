import { StyleSheet, Text, View } from 'react-native'
import { colors } from '../../theme'

// The web draws its icons as inline SVG. react-native-svg isn't a dependency here, and adding one for a handful
// of small glyphs would mean another native build — so these are drawn with text glyphs and plain Views, which
// render identically across Android versions and cost nothing.

// The green/red square-with-a-dot every Indian food app uses to mark vegetarian items.
export function VegMark({ veg, size = 14 }: { veg: boolean; size?: number }) {
  const color = veg ? colors.veg : colors.nonveg
  return (
    <View style={[styles.vegBox, { width: size, height: size, borderColor: color }]}>
      <View style={[styles.vegDot, { width: size / 2.6, height: size / 2.6, borderRadius: size, backgroundColor: color }]} />
    </View>
  )
}

export function StarIcon({ size = 12, color = colors.rating }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>★</Text>
}

export function HeartIcon({ size = 19, color = colors.ink }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>♡</Text>
}

export function UserIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>☰</Text>
}

export function PinIcon({ size = 14, color = colors.accent }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>◉</Text>
}

export function ClockIcon({ size = 13, color = colors.muted }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>◷</Text>
}

export function SearchIcon({ size = 16, color = colors.muted }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>⌕</Text>
}

export function ChevronLeftIcon({ size = 22, color = colors.ink }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>‹</Text>
}

export function ChevronRightIcon({ size = 18, color = '#fff' }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>›</Text>
}

export function ChevronDownIcon({ size = 14, color = colors.muted }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 2 }}>⌄</Text>
}

export function CloseIcon({ size = 18, color = colors.ink }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>✕</Text>
}

export function PhoneIcon({ size = 16, color = '#fff' }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>✆</Text>
}

export function MicIcon({ size = 22, color = colors.callInk }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>🎙</Text>
}

export function MicOffIcon({ size = 22, color = colors.callInk }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>🔇</Text>
}

export function SpeakerIcon({ size = 22, color = colors.callInk }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>🔊</Text>
}

const styles = StyleSheet.create({
  vegBox: { borderWidth: 1.5, borderRadius: 3, alignItems: 'center', justifyContent: 'center' },
  vegDot: {},
})

export function HomeIcon({ size = 18, color = colors.muted }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>⌂</Text>
}

export function WalletIcon({ size = 18, color = colors.muted }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 3 }}>▤</Text>
}

export function CheckIcon({ size = 30, color = '#fff' }: { size?: number; color?: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size + 4, fontWeight: '800' }}>✓</Text>
}
