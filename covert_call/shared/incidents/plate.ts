// Epic 22.3: Indian number-plate helpers. Offline only: the prefix tells a responder where a vehicle is
// registered. There is deliberately NO owner lookup; owner details belong to VAHAN and authorised agencies.

const STATES: Record<string, string> = {
  AN: 'Andaman & Nicobar', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar', CG: 'Chhattisgarh',
  CH: 'Chandigarh', DD: 'Dadra & Nagar Haveli and Daman & Diu', DL: 'Delhi', GA: 'Goa', GJ: 'Gujarat', HP: 'Himachal Pradesh',
  HR: 'Haryana', JH: 'Jharkhand', JK: 'Jammu & Kashmir', KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep',
  MH: 'Maharashtra', ML: 'Meghalaya', MN: 'Manipur', MP: 'Madhya Pradesh', MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha',
  PB: 'Punjab', PY: 'Puducherry', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TR: 'Tripura', TS: 'Telangana',
  UK: 'Uttarakhand', UP: 'Uttar Pradesh', WB: 'West Bengal',
}

// District-level RTO codes for the areas the demo runs in. Anything else falls back to the state name.
const RTOS: Record<string, string> = {
  KL01: 'Thiruvananthapuram', KL02: 'Kollam', KL03: 'Pathanamthitta', KL04: 'Alappuzha', KL05: 'Kottayam', KL06: 'Idukki',
  KL07: 'Ernakulam', KL08: 'Thrissur', KL09: 'Palakkad', KL10: 'Malappuram', KL11: 'Kozhikode', KL12: 'Wayanad',
  KL13: 'Kannur', KL14: 'Kasaragod',
  KA01: 'Bengaluru Central', KA02: 'Bengaluru West', KA03: 'Bengaluru East', KA04: 'Bengaluru North', KA05: 'Bengaluru South',
}

// "kl 04 ab 1234", "KL-04-AB-1234" and "kl04ab1234" all become "KL 04 AB 1234". A partial plate ("KL 04") is
// kept as heard, since part of a plate is still useful evidence. Returns null if it doesn't look like a plate.
export function normalisePlate(raw: string): string | null {
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (compact.length < 3) return null
  const bh = compact.match(/^(\d{2})BH(\d{4})([A-Z]{1,2})$/)
  if (bh) return `${bh[1]} BH ${bh[2]} ${bh[3]}`
  const m = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{0,4})$/)
  if (!m) return raw.trim().toUpperCase()
  return [m[1], m[2].padStart(2, '0'), m[3], m[4]].filter(Boolean).join(' ')
}

export function decodePlateRegion(plate: string): string | null {
  if (/\bBH\b/.test(plate)) return 'Bharat series (nationwide registration)'
  const m = plate.toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]{2})(\d{1,2})?/)
  if (!m) return null
  const state = STATES[m[1]]
  if (!state) return null
  const rto = m[2] ? RTOS[`${m[1]}${m[2].padStart(2, '0')}`] : undefined
  return rto ? `${rto}, ${state}` : state
}
