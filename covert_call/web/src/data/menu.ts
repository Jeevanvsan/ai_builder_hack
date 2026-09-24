import margherita from '../assets/food/margherita.jpg'
import farmhouse from '../assets/food/farmhouse.jpg'
import chickenTikkaPizza from '../assets/food/chicken-tikka-pizza.jpg'
import familyCombo from '../assets/food/family-combo.jpg'
import vegBurger from '../assets/food/veg-burger.jpg'
import chickenBurger from '../assets/food/chicken-burger.jpg'
import chickenBiryani from '../assets/food/chicken-biryani.jpg'
import vegBiryani from '../assets/food/veg-biryani.jpg'
import garlicBread from '../assets/food/garlic-bread.jpg'
import fries from '../assets/food/fries.jpg'
import lavaCake from '../assets/food/lava-cake.jpg'
import coldCoffee from '../assets/food/cold-coffee.jpg'
import lemonade from '../assets/food/lemonade.jpg'
import hotSauce from '../assets/food/hot-sauce.jpg'
import cheeseDip from '../assets/food/cheese-dip.jpg'

export type CategoryId = 'pizza' | 'burgers' | 'biryani' | 'sides' | 'desserts' | 'drinks' | 'addons'

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'pizza', label: 'Pizza' },
  { id: 'burgers', label: 'Burgers' },
  { id: 'biryani', label: 'Biryani' },
  { id: 'sides', label: 'Sides' },
  { id: 'desserts', label: 'Desserts' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'addons', label: 'Add-ons' },
]

export interface MenuItem {
  id: string
  name: string
  description: string
  price: number
  image: string
  veg: boolean
  category: CategoryId
  rating?: number
  ratingCount?: string
  bestseller?: boolean
}

export const MENU: MenuItem[] = [
  {
    id: 'margherita',
    name: 'Margherita Pizza',
    description: 'Classic tomato sauce, fresh mozzarella and basil on a hand-stretched base. Serves 1–2.',
    price: 249,
    image: margherita,
    veg: true,
    category: 'pizza',
    rating: 4.4,
    ratingCount: '2.1k',
    bestseller: true,
  },
  {
    id: 'farmhouse',
    name: 'Farmhouse Veggie Pizza',
    description: 'Capsicum, onion, tomato, mushroom and sweet corn with a double layer of cheese.',
    price: 349,
    image: farmhouse,
    veg: true,
    category: 'pizza',
    rating: 4.3,
    ratingCount: '980',
  },
  {
    id: 'chicken-tikka-pizza',
    name: 'Chicken Tikka Pizza',
    description: 'Tandoori-spiced chicken tikka, red onion and peppers on a spicy tomato base.',
    price: 399,
    image: chickenTikkaPizza,
    veg: false,
    category: 'pizza',
    rating: 4.5,
    ratingCount: '1.6k',
    bestseller: true,
  },
  {
    id: 'family-combo',
    name: 'Family Combo — Large',
    description: 'Two medium pizzas of your choice, cheesy garlic bread and a 1.25L soft drink. Feeds a group.',
    price: 699,
    image: familyCombo,
    veg: false,
    category: 'pizza',
    rating: 4.6,
    ratingCount: '740',
  },
  {
    id: 'veg-burger',
    name: 'Classic Veg Burger',
    description: 'Crispy bean-and-veg patty, lettuce, tomato and our house mayo in a toasted bun.',
    price: 149,
    image: vegBurger,
    veg: true,
    category: 'burgers',
    rating: 4.1,
    ratingCount: '1.2k',
  },
  {
    id: 'chicken-burger',
    name: 'Crispy Chicken Burger',
    description: 'Buttermilk-fried chicken fillet, lettuce and peri-peri mayo in a sesame bun.',
    price: 199,
    image: chickenBurger,
    veg: false,
    category: 'burgers',
    rating: 4.4,
    ratingCount: '1.9k',
    bestseller: true,
  },
  {
    id: 'chicken-biryani',
    name: 'Chicken Dum Biryani',
    description: 'Slow-cooked basmati and tender chicken, sealed and dum-cooked. Served with raita.',
    price: 299,
    image: chickenBiryani,
    veg: false,
    category: 'biryani',
    rating: 4.5,
    ratingCount: '3.4k',
    bestseller: true,
  },
  {
    id: 'veg-biryani',
    name: 'Veg Dum Biryani',
    description: 'Fragrant basmati layered with seasonal vegetables and whole spices. Served with raita.',
    price: 229,
    image: vegBiryani,
    veg: true,
    category: 'biryani',
    rating: 4.2,
    ratingCount: '860',
  },
  {
    id: 'garlic-bread',
    name: 'Cheesy Garlic Bread',
    description: 'Oven-baked baguette with garlic butter, herbs and melted mozzarella.',
    price: 129,
    image: garlicBread,
    veg: true,
    category: 'sides',
    rating: 4.3,
    ratingCount: '1.1k',
  },
  {
    id: 'fries',
    name: 'Salted Fries',
    description: 'Golden, crispy and lightly salted. Comes with a ketchup dip.',
    price: 99,
    image: fries,
    veg: true,
    category: 'sides',
    rating: 4.2,
    ratingCount: '2.5k',
  },
  {
    id: 'lava-cake',
    name: 'Choco Lava Cake',
    description: 'Warm chocolate cake with a molten centre. Best eaten straight away.',
    price: 109,
    image: lavaCake,
    veg: true,
    category: 'desserts',
    rating: 4.6,
    ratingCount: '2.8k',
    bestseller: true,
  },
  {
    id: 'cold-coffee',
    name: 'Cold Coffee',
    description: 'Chilled, creamy coffee blended with milk and a touch of sugar.',
    price: 129,
    image: coldCoffee,
    veg: true,
    category: 'drinks',
    rating: 4.3,
    ratingCount: '690',
  },
  {
    id: 'lemonade',
    name: 'Mint Lemonade',
    description: 'Fresh lime, mint and soda over ice.',
    price: 79,
    image: lemonade,
    veg: true,
    category: 'drinks',
    rating: 4.1,
    ratingCount: '420',
  },
  {
    id: 'hot-sauce',
    name: 'Extra Hot Sauce',
    description: 'Add-on, goes with any order.',
    price: 0,
    image: hotSauce,
    veg: true,
    category: 'addons',
  },
  {
    id: 'cheese-dip',
    name: 'Cheese Dip',
    description: 'Creamy cheddar dip. Add-on, goes with any order.',
    price: 39,
    image: cheeseDip,
    veg: true,
    category: 'addons',
  },
]

export const MENU_BY_ID: Record<string, MenuItem> = Object.fromEntries(MENU.map((m) => [m.id, m]))

export const OUTLET = {
  name: 'QuickBite Kitchen',
  area: 'Indiranagar',
  cuisines: 'Pizzas · Burgers · Biryani',
  rating: 4.4,
  ratingCount: '12k+',
  eta: '18–25 min',
}

export const DELIVERY_ADDRESS = {
  label: 'Home',
  line: '12th Main Rd, HAL 2nd Stage, Indiranagar, Bengaluru',
}
