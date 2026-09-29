import { MotionConfig } from 'motion/react'
import { useState } from 'react'
import { Bento, DeepDives } from './components/Features'
import Hero from './components/Hero'
import Privacy from './components/Privacy'
import { Compare, DemoSlider, Disguise, Download, Footer, HowItWorks, Marquee, Nav, Problem, SplitView } from './components/Sections'
import { LINKS, Modal } from './components/ui'

export default function App() {
  const [apkOpen, setApkOpen] = useState(false)
  const openApk = () => setApkOpen(true)
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
      <Modal open={apkOpen} onClose={() => setApkOpen(false)}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🤖</div>
        <h3>Android APK is on its way</h3>
        <p>The React Native build is still being finished. In the meantime the full experience runs in your browser with nothing to install.</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setApkOpen(false)}>Close</button>
          <a className="btn btn-primary" href={LINKS.web} target="_blank" rel="noreferrer">Open web app →</a>
        </div>
      </Modal>
    </MotionConfig>
  )
}
