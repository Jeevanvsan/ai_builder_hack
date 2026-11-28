// QuickOne pharmacy catalog (Epic 33). The 11 coded items take their names from the pharmacy cover pack
// (shared/covers/pharmacy.ts); paracetamol and the thermometer are ordinary items. Photos: assets/pharmacy/,
// CC0 / Public Domain (see CREDITS.md there).

import { COVERS } from '../../../../shared/covers/index.ts'
import type { MenuItem } from '../menu'
import antacid from '../../assets/pharmacy/antacid.jpg'
import cotton from '../../assets/pharmacy/cotton.jpg'
import coughSyrup from '../../assets/pharmacy/cough-syrup.jpg'
import faceWash from '../../assets/pharmacy/face-wash.jpg'
import hotWaterBag from '../../assets/pharmacy/hot-water-bag.jpg'
import kidsSyrup from '../../assets/pharmacy/kids-syrup.jpg'
import lipBalm from '../../assets/pharmacy/lip-balm.jpg'
import ors from '../../assets/pharmacy/ors.jpg'
import paracetamol from '../../assets/pharmacy/paracetamol.jpg'
import sanitiser from '../../assets/pharmacy/sanitiser.jpg'
import thermometer from '../../assets/pharmacy/thermometer.jpg'
import tissues from '../../assets/pharmacy/tissues.jpg'
import vitaminC from '../../assets/pharmacy/vitamin-c.jpg'

const c = COVERS.pharmacy.codes

export const PHARMACY_ITEMS: MenuItem[] = [
  { id: 'p-paracetamol', service: 'pharmacy', category: 'medicines', name: 'Paracetamol 500 mg — 15 tablets', description: 'For fever and everyday aches.', price: 30, image: paracetamol, rating: 4.6, ratingCount: '4.2k', bestseller: true },
  { id: 'p-antacid', service: 'pharmacy', category: 'medicines', name: c.weapon.label, description: 'Quick relief from acidity and heartburn. Strip of 10.', price: 45, image: antacid, code: 'weapon', rating: 4.4, ratingCount: '1.9k' },
  { id: 'p-cough-syrup', service: 'pharmacy', category: 'medicines', name: c['harmed-now'].label, description: 'Soothing cough syrup with honey. 100 ml.', price: 98, image: coughSyrup, code: 'harmed-now', rating: 4.3, ratingCount: '2.4k' },
  { id: 'p-ors', service: 'pharmacy', category: 'medicines', name: c.hazard.label, description: 'Oral rehydration salts, orange flavour. Pack of 5.', price: 60, image: ors, code: 'hazard', rating: 4.5, ratingCount: '1.3k' },
  { id: 'p-vitamin-c', service: 'pharmacy', category: 'wellness', name: c.followed.label, description: 'Chewable vitamin C 500 mg. Bottle of 60.', price: 120, image: vitaminC, code: 'followed', rating: 4.5, ratingCount: '2.0k', bestseller: true },
  { id: 'p-hot-water-bag', service: 'pharmacy', category: 'wellness', name: c.taken.label, description: 'Rubber hot water bag with a soft cover. 2 L.', price: 199, image: hotWaterBag, code: 'taken', rating: 4.2, ratingCount: '720' },
  { id: 'p-lip-balm', service: 'pharmacy', category: 'personal', name: c.confined.label, description: 'Moisturising lip balm with SPF 15.', price: 85, image: lipBalm, code: 'confined', rating: 4.3, ratingCount: '1.1k' },
  { id: 'p-sanitiser', service: 'pharmacy', category: 'personal', name: c.injured.label, description: '70% alcohol hand sanitiser. 200 ml.', price: 75, image: sanitiser, code: 'injured', rating: 4.4, ratingCount: '3.3k' },
  { id: 'p-face-wash', service: 'pharmacy', category: 'personal', name: c.domestic.label, description: 'Gentle daily face wash for all skin types. 100 ml.', price: 149, image: faceWash, code: 'domestic', rating: 4.2, ratingCount: '890' },
  { id: 'p-thermometer', service: 'pharmacy', category: 'family', name: 'Digital Thermometer', description: 'Fast, accurate readings in about 60 seconds.', price: 249, image: thermometer, rating: 4.5, ratingCount: '1.6k' },
  { id: 'p-tissues', service: 'pharmacy', category: 'family', name: c['crime-witnessed'].label, description: 'Soft facial tissues, 3 boxes.', price: 99, image: tissues, code: 'crime-witnessed', rating: 4.3, ratingCount: '760' },
  { id: 'p-cotton', service: 'pharmacy', category: 'family', name: c['group-fight'].label, description: 'Absorbent cotton wool roll. 400 g.', price: 70, image: cotton, code: 'group-fight', rating: 4.1, ratingCount: '530' },
  { id: 'p-kids-syrup', service: 'pharmacy', category: 'family', name: c['child-danger'].label, description: 'Daily multivitamin syrup for children, strawberry flavour. 200 ml.', price: 165, image: kidsSyrup, code: 'child-danger', rating: 4.4, ratingCount: '940' },
]
