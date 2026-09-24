import { createContext, useContext } from 'react'
import { MENU_BY_ID, type MenuItem } from '../data/menu'

export type CartState = Record<string, number>

export type CartAction =
  | { type: 'add'; itemId: string; qty?: number }
  | { type: 'decrement'; itemId: string }
  | { type: 'clear' }

export function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'add':
      return { ...state, [action.itemId]: (state[action.itemId] ?? 0) + (action.qty ?? 1) }
    case 'decrement': {
      const next = { ...state }
      const qty = (next[action.itemId] ?? 0) - 1
      if (qty > 0) next[action.itemId] = qty
      else delete next[action.itemId]
      return next
    }
    case 'clear':
      return {}
  }
}

export interface CartLine {
  item: MenuItem
  qty: number
}

export interface CartApi {
  lines: CartLine[]
  count: number
  subtotal: number
  qtyOf: (itemId: string) => number
  add: (itemId: string, qty?: number) => void
  decrement: (itemId: string) => void
  clear: () => void
}

export function deriveLines(state: CartState): CartLine[] {
  return Object.entries(state).map(([id, qty]) => ({ item: MENU_BY_ID[id], qty }))
}

export const CartContext = createContext<CartApi | null>(null)

export function useCart(): CartApi {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}

export const FREE_DELIVERY_THRESHOLD = 199

export function computeBill(subtotal: number) {
  const deliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : 39
  const platformFee = 5
  const taxes = Math.round(subtotal * 0.05)
  return { subtotal, deliveryFee, platformFee, taxes, total: subtotal + deliveryFee + platformFee + taxes }
}

export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`
}
