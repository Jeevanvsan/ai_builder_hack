import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { MENU_BY_ID, type MenuItem } from '../data/menu'

// Cart state, ported from the web app (same shape and reducer, RN context).
type CartState = Record<string, number>
type CartAction = { type: 'add'; itemId: string; qty?: number } | { type: 'decrement'; itemId: string } | { type: 'clear' }

function reducer(state: CartState, action: CartAction): CartState {
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

export interface CartLine { item: MenuItem; qty: number }
export interface CartApi {
  lines: CartLine[]
  count: number
  subtotal: number
  qtyOf: (id: string) => number
  add: (id: string, qty?: number) => void
  decrement: (id: string) => void
  clear: () => void
}

const CartContext = createContext<CartApi | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {})
  const api = useMemo<CartApi>(() => {
    const lines = Object.entries(state).map(([id, qty]) => ({ item: MENU_BY_ID[id], qty }))
    return {
      lines,
      count: lines.reduce((n, l) => n + l.qty, 0),
      subtotal: lines.reduce((n, l) => n + l.qty * l.item.price, 0),
      qtyOf: (id) => state[id] ?? 0,
      add: (itemId, qty) => dispatch({ type: 'add', itemId, qty }),
      decrement: (itemId) => dispatch({ type: 'decrement', itemId }),
      clear: () => dispatch({ type: 'clear' }),
    }
  }, [state])
  return <CartContext.Provider value={api}>{children}</CartContext.Provider>
}

export function useCart(): CartApi {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
