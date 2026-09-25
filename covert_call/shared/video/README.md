# Shared live video (Epic 7.1)

This is a free, peer-to-peer back-camera feed from the QuickBite app to the Monitoring Dashboard. Video flows directly from the phone to each dashboard over WebRTC. Firestore only carries the connection handshake, and Google's public STUN servers let the two ends locate each other across networks. There's no media server and nothing to pay for.

The sender side is Person A's app:

```ts
import { startVideoPublisher } from '../../shared/video/publisher.ts'

const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: 'environment' } }, audio: false })
const stop = await startVideoPublisher(db, incidentId, stream)   // incident shows "Live video" on the dashboard
// ...later: call ended or zero-trace exit
await stop()                                                     // closes all connections, marks the feed ended
```

- **Back camera only, no preview on the sender's screen** (plan §4). The dev test page shows a preview only because it's a test tool.
- **React Native:** `react-native-webrtc` provides the same `RTCPeerConnection` API. Call its `registerGlobals()` first.
- **Limitation:** there's no TURN relay, since a relay costs money. On very strict networks (some corporate or carrier NATs) the connection can fail, and the dashboard then shows "Couldn't connect" with a retry button.
- **Testing without the app:** open `/dev/camera` on the dashboard site on a phone or laptop, pick an open incident and start the camera. Then open that incident on the dashboard.
