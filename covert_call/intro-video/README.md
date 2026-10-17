# QuickBite intro video

The animated intro for the QuickBite demo video, built with [Remotion](https://www.remotion.dev/) (React
components rendered to video). The composition is in `src/Composition.tsx` and its timing in `src/timing.ts`.
The background clip, voiceover and app screenshots it uses are in `public/`.

```bash
cd covert_call/intro-video
npm install
npm run dev               # preview in Remotion Studio
npx remotion render       # render the video
```

Remotion's license terms: https://github.com/remotion-dev/remotion/blob/main/LICENSE.md
