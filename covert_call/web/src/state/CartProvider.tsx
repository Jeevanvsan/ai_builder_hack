import { useMemo, useReducer, type ReactNode } from 'react'
import { CartContext, cartReducer, deriveLines, type CartApi } from './cart'

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {})

  const api = useMemo<CartApi>(() => {
    const lines = deriveLines(state)
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
