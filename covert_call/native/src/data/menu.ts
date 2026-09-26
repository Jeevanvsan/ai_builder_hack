// Native menu data (Epic 12.2). Mirrors the web menu's items and their coded meanings, but without bundled images
// (add require()'d assets later). The `code` field ties an item to a coded meaning in shared/codes.ts.
export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  veg: boolean
  category: string
  code?: string
}

export const MENU: MenuItem[] = [
  { id: 'margherita', name: 'Margherita Pizza', description: 'Classic tomato, mozzarella, basil.', price: 249, veg: true, category: 'Pizza' },
  { id: 'chicken-tikka-pizza', name: 'Chicken Tikka Pizza', description: 'Tandoori chicken, onion, peppers.', price: 399, veg: false, category: 'Pizza' },
  { id: 'family-combo', name: 'Family Combo — Large', description: 'Two pizzas, garlic bread, a drink.', price: 699, veg: false, category: 'Pizza', code: 'crime-witnessed' },
  { id: 'party-platter', name: 'Party Platter', description: 'Four large pizzas for a crowd.', price: 899, veg: false, category: 'Pizza', code: 'group-fight' },
  { id: 'chicken-burger', name: 'Crispy Chicken Burger', description: 'Fried chicken, lettuce, peri mayo.', price: 199, veg: false, category: 'Burgers' },
  { id: 'kids-meal', name: "Kids' Meal Box", description: 'Mini burger, fries, a small treat.', price: 199, veg: true, category: 'Burgers', code: 'child-danger' },
  { id: 'chicken-biryani', name: 'Chicken Dum Biryani', description: 'Slow-cooked basmati and chicken.', price: 299, veg: false, category: 'Biryani' },
  { id: 'garlic-bread', name: 'Cheesy Garlic Bread', description: 'Garlic butter, herbs, mozzarella.', price: 129, veg: true, category: 'Sides', code: 'followed' },
  { id: 'fries', name: 'Salted Fries', description: 'Golden, crispy, lightly salted.', price: 99, veg: true, category: 'Sides' },
  { id: 'lava-cake', name: 'Choco Lava Cake', description: 'Warm cake, molten centre.', price: 109, veg: true, category: 'Desserts', code: 'domestic' },
  { id: 'lemonade', name: 'Mint Lemonade', description: 'Lime, mint and soda over ice.', price: 79, veg: true, category: 'Drinks', code: 'hazard' },
  { id: 'extra-pepperoni', name: 'Extra Pepperoni', description: 'Add extra pepperoni to any pizza.', price: 49, veg: false, category: 'Add-ons', code: 'weapon' },
  { id: 'extra-spicy', name: 'Extra Spicy', description: 'Make any order extra spicy.', price: 0, veg: true, category: 'Add-ons', code: 'harmed-now' },
  { id: 'extra-cheese', name: 'Extra Cheese', description: 'An extra layer of melted cheese.', price: 49, veg: true, category: 'Add-ons', code: 'confined' },
  { id: 'extra-napkins', name: 'Extra Napkins', description: 'A pack of extra napkins.', price: 0, veg: true, category: 'Add-ons', code: 'injured' },
  { id: 'to-go-box', name: 'Sealed To-Go Box', description: 'Extra sealed packaging.', price: 19, veg: true, category: 'Add-ons', code: 'taken' },
]

export const MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(MENU.map((m) => [m.id, m]))

export const DELIVERY_ADDRESS = { label: 'Home', line: '12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru' }
export const OUTLET = { name: 'QuickBite Kitchen', area: 'Indiranagar', eta: '18–25 min' }

export const formatRupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`
