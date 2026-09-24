import { createContext, useContext } from 'react'

type ResponderContext = { name: string; setName: (name: string) => void }

export const ResponderCtx = createContext<ResponderContext>({ name: '', setName: () => {} })

export const useResponder = () => useContext(ResponderCtx)
