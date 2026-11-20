// QuickOne services (Epic 33): what each tab of the home screen looks like and how its order flow is worded. Each
// service is also a cover pack (shared/covers/): its call button starts Mia in that service's words, and its coded
// catalog items carry the same code ids as the food menu (data/catalog/).
//
// Food keeps the original QuickBite wording everywhere, so the food tab looks exactly as before.

import type { Severity } from '../../../shared/incidents/types.ts'
import foodBanner from '../assets/food/banner.jpg'
import groceryBanner from '../assets/grocery/banner.jpg'
import homeBanner from '../assets/home/banner.jpg'
import pharmacyBanner from '../assets/pharmacy/banner.jpg'
import { FREE_DELIVERY_THRESHOLD } from '../state/cart'
import { CATEGORIES, OUTLET, serviceOf, type MenuItem } from './menu'

export type ServiceId = 'food' | 'grocery' | 'pharmacy' | 'home'

export const SERVICE_IDS: ServiceId[] = ['food', 'grocery', 'pharmacy', 'home']

export const isServiceId = (v: unknown): v is ServiceId => typeof v === 'string' && (SERVICE_IDS as string[]).includes(v)

export interface Service {
  // Also the cover pack id the call button passes (/call?service=<id>).
  id: ServiceId
  label: string
  outlet: { name: string; area: string; tagline: string; rating: number; ratingCount: string; eta: string }
  banner: string
  promo: { badge: string; title: string; line: string }
  categories: { id: string; label: string }[]
  search: string
  noMatch: string
  tryWords: string
  callLabel: string
  emptyCart: string
  browse: string
  policy: string
  // The checkout speed choice is also the urgency of a coded order (Epic 8.2): low, medium, high.
  speedTitle: string
  speeds: { id: Severity; label: string; hint: string }[]
  addressTitle: string
  etaLabel: string
  etaSub: string
  placeCta: string
  placingCta: string
  // Order status; mirrors the responder's progress on a coded order (Epic 8.3).
  steps: [string, string, string, string]
  placed: string
  thanks: string
  feeLabel: string
  freeFee: string
  charges: string
}

const STANDARD_SPEEDS = (fastest: string): Service['speeds'] => [
  { id: 'low', label: 'Standard', hint: 'Arrives in 30–40 min' },
  { id: 'medium', label: 'Priority', hint: 'Bumped up the queue, ~20 min' },
  { id: 'high', label: 'As soon as possible', hint: fastest },
]

const DELIVERY_STEPS: Service['steps'] = ['Order confirmed', 'Rider assigned', 'On the way', 'Delivered']

export const SERVICES: Record<ServiceId, Service> = {
  food: {
    id: 'food',
    label: 'Food',
    outlet: { name: OUTLET.name, area: OUTLET.area, tagline: OUTLET.cuisines, rating: OUTLET.rating, ratingCount: OUTLET.ratingCount, eta: OUTLET.eta },
    banner: foodBanner,
    promo: { badge: 'TODAY ONLY', title: `Free delivery over ₹${FREE_DELIVERY_THRESHOLD}`, line: 'Hot & fresh at your door in' },
    categories: CATEGORIES,
    search: 'Search for dishes',
    noMatch: 'No dishes match',
    tryWords: 'Try searching for pizza, biryani or burger.',
    callLabel: 'Call to order',
    emptyCart: 'Good food is always cooking. Go ahead, order some yummy items from the menu.',
    browse: 'Browse menu',
    policy: 'Review your order and address details to avoid cancellations. Orders cannot be cancelled once packed for delivery.',
    speedTitle: 'Delivery time',
    speeds: STANDARD_SPEEDS('Fastest available rider'),
    addressTitle: 'Deliver to',
    etaLabel: 'Delivery in',
    etaSub: 'Standard delivery',
    placeCta: 'Place order',
    placingCta: 'Placing…',
    steps: DELIVERY_STEPS,
    placed: 'Order placed!',
    thanks: 'Thanks for ordering from',
    feeLabel: 'Delivery fee',
    freeFee: 'free delivery',
    charges: 'GST & restaurant charges',
  },
  grocery: {
    id: 'grocery',
    label: 'Grocery',
    outlet: { name: 'QuickOne Mart', area: 'Indiranagar', tagline: 'Fruits & veg · Dairy · Staples · Household', rating: 4.5, ratingCount: '9k+', eta: '10–15 min' },
    banner: groceryBanner,
    promo: { badge: 'FRESH TODAY', title: `Free delivery over ₹${FREE_DELIVERY_THRESHOLD}`, line: 'Groceries at your door in' },
    categories: [
      { id: 'fruits-veg', label: 'Fruits & veg' },
      { id: 'dairy', label: 'Dairy, bread & eggs' },
      { id: 'staples', label: 'Staples' },
      { id: 'snacks', label: 'Snacks & drinks' },
      { id: 'household', label: 'Household' },
    ],
    search: 'Search groceries',
    noMatch: 'No items match',
    tryWords: 'Try searching for eggs, rice or milk.',
    callLabel: 'Call to order',
    emptyCart: 'Your basket is empty. Add fresh groceries and household essentials.',
    browse: 'Browse groceries',
    policy: 'Review your order and address details to avoid cancellations. Orders cannot be cancelled once packed for delivery.',
    speedTitle: 'Delivery time',
    speeds: [
      { id: 'low', label: 'Standard', hint: 'Arrives in 30–40 min' },
      { id: 'medium', label: 'Priority', hint: 'Bumped up the queue, ~15 min' },
      { id: 'high', label: 'As soon as possible', hint: 'Fastest available rider' },
    ],
    addressTitle: 'Deliver to',
    etaLabel: 'Delivery in',
    etaSub: 'Standard delivery',
    placeCta: 'Place order',
    placingCta: 'Placing…',
    steps: DELIVERY_STEPS,
    placed: 'Order placed!',
    thanks: 'Thanks for ordering from',
    feeLabel: 'Delivery fee',
    freeFee: 'free delivery',
    charges: 'GST & store charges',
  },
  pharmacy: {
    id: 'pharmacy',
    label: 'Pharmacy',
    outlet: { name: 'QuickOne Pharmacy', area: 'Indiranagar', tagline: 'Medicines · Wellness · Personal care', rating: 4.6, ratingCount: '7k+', eta: '20–30 min' },
    banner: pharmacyBanner,
    promo: { badge: 'OPEN 24×7', title: `Free delivery over ₹${FREE_DELIVERY_THRESHOLD}`, line: 'Medicines at your door in' },
    categories: [
      { id: 'medicines', label: 'Medicines' },
      { id: 'wellness', label: 'Wellness' },
      { id: 'personal', label: 'Personal care' },
      { id: 'family', label: 'Kids & family' },
    ],
    search: 'Search medicines & health products',
    noMatch: 'No products match',
    tryWords: 'Try searching for syrup, tablets or tissues.',
    callLabel: 'Call to order',
    emptyCart: 'Your cart is empty. Add medicines and health essentials.',
    browse: 'Browse pharmacy',
    policy: 'Review your order and address details to avoid cancellations. Medicines cannot be returned once delivered.',
    speedTitle: 'Delivery time',
    speeds: STANDARD_SPEEDS('Fastest available rider'),
    addressTitle: 'Deliver to',
    etaLabel: 'Delivery in',
    etaSub: 'Standard delivery',
    placeCta: 'Place order',
    placingCta: 'Placing…',
    steps: DELIVERY_STEPS,
    placed: 'Order placed!',
    thanks: 'Thanks for ordering from',
    feeLabel: 'Delivery fee',
    freeFee: 'free delivery',
    charges: 'GST & pharmacy charges',
  },
  home: {
    id: 'home',
    label: 'Home services',
    outlet: { name: 'QuickOne Home Services', area: 'Indiranagar', tagline: 'Repairs · Plumbing · Electrical · Cleaning', rating: 4.7, ratingCount: '5k+', eta: '45–60 min' },
    banner: homeBanner,
    promo: { badge: 'SAME DAY', title: `No visiting charge over ₹${FREE_DELIVERY_THRESHOLD}`, line: 'A verified technician at your door in' },
    categories: [
      { id: 'appliances', label: 'Appliance repair' },
      { id: 'plumbing', label: 'Plumbing' },
      { id: 'electrical', label: 'Electrical' },
      { id: 'cleaning', label: 'Cleaning & painting' },
    ],
    search: 'Search for a service',
    noMatch: 'No services match',
    tryWords: 'Try searching for AC, tap or fan.',
    callLabel: 'Call to book',
    emptyCart: 'No services added yet. Pick a repair or cleaning service to book a visit.',
    browse: 'Browse services',
    policy: 'Review the address before booking. Bookings can be rescheduled until a technician is assigned.',
    // Same words as the home cover's urgency question: this week = not urgent, today = soon, right now = urgent.
    speedTitle: 'Visit time',
    speeds: [
      { id: 'low', label: 'This week', hint: 'Pick a slot that suits you' },
      { id: 'medium', label: 'Today', hint: 'A technician visits today' },
      { id: 'high', label: 'Right now', hint: 'Nearest available technician' },
    ],
    addressTitle: 'Visit at',
    etaLabel: 'Technician arrives in',
    etaSub: 'Pick a visit time below',
    placeCta: 'Book visit',
    placingCta: 'Booking…',
    steps: ['Booking confirmed', 'Technician assigned', 'On the way', 'Job done'],
    placed: 'Booking confirmed!',
    thanks: 'Thanks for booking with',
    feeLabel: 'Visiting charge',
    freeFee: 'no visiting charge',
    charges: 'GST & service charges',
  },
}

// The service a cart belongs to (its first item's; the open tab's when empty). A cart that mixes services, possible
// if someone switches tabs mid-order, is flagged so the pages show the plain app name instead of one outlet.
export function cartService(lines: { item: MenuItem }[]): { service: Service; mixed: boolean } {
  const first = lines[0] ? serviceOf(lines[0].item) : readService()
  return { service: SERVICES[first], mixed: lines.some((l) => serviceOf(l.item) !== first) }
}

// The home screen remembers the open tab for the session, so coming back from the cart lands on the same service.
const KEY = 'qo.service'
export function readService(): ServiceId {
  try {
    const v = sessionStorage.getItem(KEY)
    return isServiceId(v) ? v : 'food'
  } catch {
    return 'food'
  }
}
export function saveService(id: ServiceId) {
  try {
    sessionStorage.setItem(KEY, id)
  } catch {
    // Private mode or storage blocked: the tab just resets to food.
  }
}
