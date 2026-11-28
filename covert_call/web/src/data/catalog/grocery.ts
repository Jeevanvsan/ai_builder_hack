// QuickOne grocery catalog (Epic 33). The 11 coded items take their names from the grocery cover pack
// (shared/covers/grocery.ts), so the tap-to-order path, the long-press meaning and Mia's spoken words always match.
// Bananas and milk are ordinary items. Photos: assets/grocery/, CC0 / Public Domain (see CREDITS.md there).

import { COVERS } from '../../../../shared/covers/index.ts'
import type { MenuItem } from '../menu'
import bananas from '../../assets/grocery/bananas.jpg'
import biscuits from '../../assets/grocery/biscuits.jpg'
import bread from '../../assets/grocery/bread.jpg'
import cereal from '../../assets/grocery/cereal.jpg'
import chips from '../../assets/grocery/chips.jpg'
import dishSoap from '../../assets/grocery/dish-soap.jpg'
import eggs from '../../assets/grocery/eggs.jpg'
import ice from '../../assets/grocery/ice.jpg'
import iceCream from '../../assets/grocery/ice-cream.jpg'
import milk from '../../assets/grocery/milk.jpg'
import onions from '../../assets/grocery/onions.jpg'
import rice from '../../assets/grocery/rice.jpg'
import tea from '../../assets/grocery/tea.jpg'

const c = COVERS.grocery.codes

export const GROCERY_ITEMS: MenuItem[] = [
  { id: 'g-onions', service: 'grocery', category: 'fruits-veg', name: c.weapon.label, description: 'Fresh red onions, sorted and cleaned.', price: 45, image: onions, code: 'weapon', rating: 4.3, ratingCount: '1.8k' },
  { id: 'g-bananas', service: 'grocery', category: 'fruits-veg', name: 'Robusta Bananas — 6 pcs', description: 'Ripe, sweet bananas for the week.', price: 48, image: bananas, rating: 4.4, ratingCount: '2.3k', bestseller: true },
  { id: 'g-eggs', service: 'grocery', category: 'dairy', name: c['harmed-now'].label, description: 'Farm-fresh brown eggs, tray of 12.', price: 96, image: eggs, code: 'harmed-now', rating: 4.5, ratingCount: '3.1k', bestseller: true },
  { id: 'g-bread', service: 'grocery', category: 'dairy', name: c.followed.label, description: 'Soft white sandwich bread, baked this morning. 400 g.', price: 45, image: bread, code: 'followed', rating: 4.2, ratingCount: '1.4k' },
  { id: 'g-milk', service: 'grocery', category: 'dairy', name: 'Toned Milk — 1 L', description: 'Fresh pasteurised milk, delivered chilled.', price: 68, image: milk, rating: 4.4, ratingCount: '2.9k' },
  { id: 'g-ice-cream', service: 'grocery', category: 'dairy', name: c.domestic.label, description: 'Classic vanilla, family tub. 700 ml.', price: 199, image: iceCream, code: 'domestic', rating: 4.3, ratingCount: '860' },
  { id: 'g-rice', service: 'grocery', category: 'staples', name: c.taken.label, description: 'Long-grain aged basmati rice.', price: 139, image: rice, code: 'taken', rating: 4.4, ratingCount: '1.1k' },
  { id: 'g-tea', service: 'grocery', category: 'staples', name: c.confined.label, description: 'Strong Assam leaf tea for everyday chai.', price: 125, image: tea, code: 'confined', rating: 4.5, ratingCount: '980' },
  { id: 'g-cereal', service: 'grocery', category: 'staples', name: c['child-danger'].label, description: 'Crunchy chocolate breakfast cereal. 375 g.', price: 185, image: cereal, code: 'child-danger', rating: 4.1, ratingCount: '640' },
  { id: 'g-biscuits', service: 'grocery', category: 'snacks', name: c['crime-witnessed'].label, description: 'Butter biscuits, family value pack.', price: 60, image: biscuits, code: 'crime-witnessed', rating: 4.2, ratingCount: '1.5k' },
  { id: 'g-chips', service: 'grocery', category: 'snacks', name: c['group-fight'].label, description: 'Salted potato chips, party size.', price: 99, image: chips, code: 'group-fight', rating: 4.3, ratingCount: '1.2k' },
  { id: 'g-ice', service: 'grocery', category: 'snacks', name: c.hazard.label, description: 'Crystal-clear ice cubes for drinks and coolers.', price: 35, image: ice, code: 'hazard', rating: 4.0, ratingCount: '410' },
  { id: 'g-dish-soap', service: 'grocery', category: 'household', name: c.injured.label, description: 'Lemon dishwash liquid that cuts through grease. 500 ml.', price: 110, image: dishSoap, code: 'injured', rating: 4.4, ratingCount: '1.7k' },
]
