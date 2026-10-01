import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { Bento, DeepDives } from './components/Features'
import Hero from './components/Hero'
import Manual from './components/Manual'
import Privacy from './components/Privacy'
import { Compare, DemoSlider, Disguise, Download, Footer, HowItWorks, Marquee, Nav, Problem, SplitView } from './components/Sections'
import { APK_URL, LINKS, Modal } from './components/ui'

export default function App() {
  const [apkOpen, setApkOpen] = useState(false)
  // Starts the APK download (GitHub serves release files as attachments, so the page stays put), then shows how
  // to install it, since Android asks to allow installs from the browser.
  const openApk = () => {
    // A user-initiated navigation to an attachment response downloads the file and leaves this page in place.
    window.location.href = APK_URL
    setApkOpen(true)
  }
  if (window.location.pathname.replace(/\/$/, '') === '/manual') {
    document.title = 'User manual · Covert Call'
    return (
      <MotionConfig reducedMotion="user">
        <Nav onDownload={openApk} />
        <Manual />
        <Footer />
        <ApkModal open={apkOpen} onClose={() => setApkOpen(false)} />
      </MotionConfig>
    )
  }
  if (window.location.pathname.replace(/\/$/, '') === '/privacy') {
    document.title = 'Privacy Policy · Covert Call'
    return (
      <>
        <Privacy />
        <Footer />
      </>
    )
  }
  return (
    <MotionConfig reducedMotion="user">
      <Nav onDownload={openApk} />
      <main>
        <Hero onDownload={openApk} />
        <Problem />
        <Disguise />
        <HowItWorks />
        <DeepDives />
        <Bento />
        <Compare />
        <DemoSlider />
        <SplitView />
        <Marquee />
        <Download onDownload={openApk} />
      </main>
      <Footer />
      <ApkModal open={apkOpen} onClose={() => setApkOpen(false)} />
    </MotionConfig>
  )
}

function ApkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
      <Modal open={open} onClose={onClose}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>📦</div>
        <h3>Your download has started</h3>
        <p>QuickBite.apk (about 150 MB). To install: open the file, then allow installs from your browser when Android asks. Prefer not to install? The full experience also runs in your browser.</p>
        <div className="modal-actions">
          <a className="btn btn-ghost" href={APK_URL} download="QuickBite.apk">Download again</a>
          <a className="btn btn-primary" href={LINKS.web} target="_blank" rel="noreferrer">Open web app →</a>
        </div>
      </Modal>
  )
}
