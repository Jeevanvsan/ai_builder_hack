// Demo recording: drive a LIVE call's camera and background sound from the laptop.
// The caller's phone must have opened the app with ?demoInject=1 (https://quickbite-5cde0.web.app/?demoInject=1).
//
// From covert_call/eval/:
//   npm run demo -- --list                          clips and sounds available
//   npm run demo -- INC-XXXX --video knife          camera now shows the knife clip (Mia + dashboard see it)
//   npm run demo -- INC-XXXX --video knife --once   play it once, then back to the real camera
//   npm run demo -- INC-XXXX --video off            back to the real camera
//   npm run demo -- INC-XXXX --sound gunshot        play a sound into the call once (again = plays again)
//   npm run demo -- INC-XXXX --sound shouting --loop   keep it playing; --sound off stops it
//   npm run demo -- latest --video fire             "latest" = the newest live call
// Needs RESPONDER_EMAIL / RESPONDER_PASSWORD in eval/.env.local. Clips live in web/public/demo/.
import { readdirSync } from 'node:fs'
import { getApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import { collection, doc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { db } from './firebaseNode.ts'

const PUBLIC = new URL('../web/public/demo/', import.meta.url)
const names = (dir: string, ext: string) => {
  try { return readdirSync(new URL(`${dir}/`, PUBLIC)).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)) } catch { return [] }
}
const videos = names('video', '.mp4')
const sounds = names('sound', '.mp3')
// The staging control page (/demo-control) reads this list of clips.
async function writeManifest() {
  const { writeFileSync } = await import('node:fs')
  writeFileSync(new URL('manifest.json', PUBLIC), JSON.stringify({ videos: names('video', '.mp4'), sounds: names('sound', '.mp3') }, null, 2))
}

const args = process.argv.slice(2)
const opt = (k: string) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined }

// npm run demo -- add "C:\path\clip.mp4" fight     → web/public/demo/video/fight.mp4 (phone camera size)
// npm run demo -- add "C:\path\bang.wav" bang      → web/public/demo/sound/bang.mp3
// Then deploy the web app (cd ../web && npm run deploy) so the phone can load it.
if (args[0] === 'add') {
  const [, src, name] = args
  if (!src || !name || !/^[a-z0-9-]+$/.test(name)) throw new Error('Usage: npm run demo -- add "<file>" <name>   (name: lowercase letters, digits, dashes)')
  const { execFileSync } = await import('node:child_process')
  const { createRequire } = await import('node:module')
  const ffmpeg = createRequire(import.meta.url)('ffmpeg-static') as string
  const isSound = /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(src)
  const out = new URL(isSound ? `sound/${name}.mp3` : `video/${name}.mp4`, PUBLIC)
  const { mkdirSync } = await import('node:fs')
  mkdirSync(new URL('.', out), { recursive: true })
  execFileSync(ffmpeg, isSound
    ? ['-loglevel', 'error', '-y', '-i', src, '-ac', '1', '-b:a', '96k', '-t', '60', out.pathname.slice(1)]
    // 640x480 crop (like a phone camera frame), 15 fps, no audio, max 20 s, small enough to load fast on mobile.
    : ['-loglevel', 'error', '-y', '-i', src, '-t', '20', '-vf', 'scale=640:480:force_original_aspect_ratio=increase,crop=640:480,fps=15',
        '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-pix_fmt', 'yuv420p', '-an', '-movflags', '+faststart', out.pathname.slice(1)])
  await writeManifest()
  console.log(`✓ ${name} → web/public/demo/${isSound ? 'sound' : 'video'}/${name}.${isSound ? 'mp3' : 'mp4'}  (add its source to web/public/demo/CREDITS.md, then deploy web)`)
  process.exit(0)
}
if (args.includes('--list') || !args.length) {
  await writeManifest()
  console.log(`videos: ${videos.join(', ') || '(none yet: add web/public/demo/video/<name>.mp4)'}`)
  console.log(`sounds: ${sounds.join(', ') || '(none yet: add web/public/demo/sound/<name>.mp3)'}`)
  process.exit(0)
}

if (!process.env.RESPONDER_EMAIL || !process.env.RESPONDER_PASSWORD) throw new Error('Set RESPONDER_EMAIL and RESPONDER_PASSWORD in eval/.env.local.')
await signInWithEmailAndPassword(getAuth(getApp()), process.env.RESPONDER_EMAIL, process.env.RESPONDER_PASSWORD)

let id = args[0]
if (id === 'latest') {
  // Newest live call, real or demo collection.
  const live = []
  for (const col of ['incidents', 'demoIncidents']) {
    // Sorted here, not in the query: where + orderBy on different fields would need a composite index.
    const s = await getDocs(query(collection(db, col), where('callState', '==', 'active'))).catch(() => null)
    for (const d of s?.docs ?? []) live.push({ id: d.id, at: String(d.data().sessionStartedAt) })
  }
  live.sort((a, b) => b.at.localeCompare(a.at))
  if (!live[0]) throw new Error('No live call found.')
  id = live[0].id
}
if (!/^INC-/.test(id)) throw new Error('First argument: an incident id (INC-…) or "latest".')

const video = opt('--video')
const sound = opt('--sound')
const patch: Record<string, unknown> = {}
if (video) {
  if (video !== 'off' && !videos.includes(video)) throw new Error(`Unknown video "${video}". Available: ${videos.join(', ')}`)
  patch.video = video === 'off' ? null : video
  patch.videoAt = Date.now()
  patch.loopVideo = !args.includes('--once') // --once: play the clip once, then back to the real camera
}
if (sound) {
  if (sound !== 'off' && !sounds.includes(sound)) throw new Error(`Unknown sound "${sound}". Available: ${sounds.join(', ')}`)
  patch.sound = sound === 'off' ? null : sound
  patch.soundAt = Date.now()
  patch.loopSound = args.includes('--loop')
}
if (!Object.keys(patch).length) throw new Error('Nothing to send: use --video <name|off> and/or --sound <name|off>.')
await setDoc(doc(db, 'demoControl', id), patch, { merge: true })
console.log(`→ ${id}: ${JSON.stringify(patch)}`)
process.exit(0)
