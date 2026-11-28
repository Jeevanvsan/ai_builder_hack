// Blog & news: one entry per article or press mention (newest first). `href` is the full article (e.g. Medium);
// `image` lives in public/blog/.
type Post = { title: string; summary: string; date: string; source: string; image: string; href?: string; readTime?: string }

const POSTS: Post[] = [
  {
    title: "It Looks Like an Ordinary Order. It's a Call for Help.",
    summary:
      'How we built QuickOne, a disguised two-way emergency line on the Gemini Live API, Firebase and Google Maps Platform: the four ways in, how Mia teaches the code inside the call, what broke and what it taught us.',
    date: 'November 2026',
    source: 'Medium',
    readTime: '12 min read',
    image: '/blog/quickone-cover.jpg',
    href: 'https://medium.com/@jeevanvsan/quickone-a33aceda9ab1',
  },
]

export default function Blog() {
  return (
    <main className="pp blog">
      <div className="container pp-inner">
        <a href="/" className="pp-back">← Back to QuickOne</a>
        <span className="eyebrow">Blog &amp; news</span>
        <h1>Stories from building QuickOne</h1>
        <p className="muted blog-lead">How it works, what we learned, and where QuickOne has been featured.</p>
        <div className="blog-list">
          {POSTS.map((p) => {
            const body = (
              <>
                <img src={p.image} alt="" className="blog-img" loading="lazy" />
                <div className="blog-body">
                  <span className="blog-meta">{p.source} · {p.date}{p.readTime ? ` · ${p.readTime}` : ''}</span>
                  <h2>{p.title}</h2>
                  <p>{p.summary}</p>
                  {p.href && <span className="blog-more">Read on {p.source} ↗</span>}
                </div>
              </>
            )
            return p.href
              ? <a key={p.title} className="blog-card" href={p.href} target="_blank" rel="noreferrer">{body}</a>
              : <article key={p.title} className="blog-card">{body}</article>
          })}
        </div>
      </div>
    </main>
  )
}
