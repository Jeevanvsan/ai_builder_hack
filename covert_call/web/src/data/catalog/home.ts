// QuickOne home services catalog (Epic 33): repair and cleaning visits. The 11 coded services take their names from
// the home cover pack (shared/covers/home.ts); switch repair and bathroom cleaning are ordinary services.
// Photos: assets/home/, CC0 / Public Domain (see CREDITS.md there).

import { COVERS } from '../../../../shared/covers/index.ts'
import type { MenuItem } from '../menu'
import ac from '../../assets/home/ac.jpg'
import bathroom from '../../assets/home/bathroom.jpg'
import ceilingFan from '../../assets/home/ceiling-fan.jpg'
import cleaning from '../../assets/home/cleaning.jpg'
import fridge from '../../assets/home/fridge.jpg'
import inverter from '../../assets/home/inverter.jpg'
import light from '../../assets/home/light.jpg'
import painting from '../../assets/home/painting.jpg'
import sink from '../../assets/home/sink.jpg'
import socket from '../../assets/home/switch.jpg'
import tap from '../../assets/home/tap.jpg'
import washingMachine from '../../assets/home/washing-machine.jpg'
import waterHeater from '../../assets/home/water-heater.jpg'

const c = COVERS.home.codes

export const HOME_ITEMS: MenuItem[] = [
  { id: 'h-ac', service: 'home', category: 'appliances', name: c.weapon.label, description: 'Gas check, deep cleaning and repair of split and window ACs.', price: 499, image: ac, code: 'weapon', rating: 4.6, ratingCount: '3.4k', bestseller: true },
  { id: 'h-water-heater', service: 'home', category: 'appliances', name: c.followed.label, description: 'Geyser not heating, leaking or tripping? Diagnosis and repair.', price: 349, image: waterHeater, code: 'followed', rating: 4.5, ratingCount: '1.2k' },
  { id: 'h-washing-machine', service: 'home', category: 'appliances', name: c.taken.label, description: 'Not spinning, not draining or noisy: front and top load.', price: 399, image: washingMachine, code: 'taken', rating: 4.4, ratingCount: '1.9k' },
  { id: 'h-fridge', service: 'home', category: 'appliances', name: c.confined.label, description: 'Not cooling, ice build-up or gas refill for all brands.', price: 399, image: fridge, code: 'confined', rating: 4.4, ratingCount: '1.5k' },
  { id: 'h-tap', service: 'home', category: 'plumbing', name: c['harmed-now'].label, description: 'Dripping taps, leaking pipes and loose fittings fixed.', price: 199, image: tap, code: 'harmed-now', rating: 4.5, ratingCount: '2.6k' },
  { id: 'h-sink', service: 'home', category: 'plumbing', name: c.domestic.label, description: 'Blocked kitchen sink cleared and drain cleaned.', price: 249, image: sink, code: 'domestic', rating: 4.3, ratingCount: '980' },
  { id: 'h-ceiling-fan', service: 'home', category: 'electrical', name: c.injured.label, description: 'Noisy, slow or wobbly fan repaired or replaced.', price: 199, image: ceilingFan, code: 'injured', rating: 4.4, ratingCount: '1.4k' },
  { id: 'h-switch', service: 'home', category: 'electrical', name: 'Switch & Socket Repair', description: 'Loose, sparking or dead switches and sockets.', price: 99, image: socket, rating: 4.5, ratingCount: '2.1k' },
  { id: 'h-light', service: 'home', category: 'electrical', name: c['child-danger'].label, description: 'New light, lamp or fixture fitted safely.', price: 149, image: light, code: 'child-danger', rating: 4.3, ratingCount: '620' },
  { id: 'h-inverter', service: 'home', category: 'electrical', name: c.hazard.label, description: 'Inverter health check, battery top-up and wiring check.', price: 299, image: inverter, code: 'hazard', rating: 4.2, ratingCount: '540' },
  { id: 'h-cleaning', service: 'home', category: 'cleaning', name: c['crime-witnessed'].label, description: 'Top-to-bottom cleaning of every room, kitchen and bathroom.', price: 2999, image: cleaning, code: 'crime-witnessed', rating: 4.6, ratingCount: '1.8k' },
  { id: 'h-bathroom', service: 'home', category: 'cleaning', name: 'Bathroom Cleaning', description: 'Tiles, fittings and floor scrubbed and descaled.', price: 499, image: bathroom, rating: 4.5, ratingCount: '2.7k', bestseller: true },
  { id: 'h-painting', service: 'home', category: 'cleaning', name: c['group-fight'].label, description: 'Interior painting with a free colour consultation. Price per room from.', price: 3999, image: painting, code: 'group-fight', rating: 4.4, ratingCount: '760' },
]
