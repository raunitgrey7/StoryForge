import Link from "next/link";
import { CRAFT_LIST } from "@/lib/crafts";
import { LandingSky } from "@/components/landing/LandingSky";

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#120f2a] text-[#ede8ff]">
      <LandingSky />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          StoryForge
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/atlas" className="rounded-[10px] px-3 py-2 text-[#b9b1e0] hover:bg-white/5 hover:text-white">
            Atlas
          </Link>
          <Link href="/studio" className="rounded-[10px] bg-[#e8b84a] px-4 py-2 font-medium text-[#241a02] hover:brightness-110">
            Open the studio
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-16 sm:px-8 sm:pt-28">
        <h1 className="font-display max-w-4xl text-[clamp(2.6rem,7vw,6rem)] font-medium leading-[0.98] tracking-[-0.02em]" style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60, "WONK" 1' }}>
          Your words, as a world you can walk through.
        </h1>
        <p className="mt-8 max-w-xl text-lg leading-relaxed text-[#b9b1e0]">
          A writing studio for novels, romance, fan fiction, poems and posts, on your phone or your desk. A companion that learns your voice and writes at the heat you choose, a story bible that keeps you honest, a Muse that recommends your next character, chapter or whole book, and an atlas where everything you have ever written hangs in the same sky.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link href="/studio" className="rounded-[12px] bg-[#e8b84a] px-6 py-3.5 text-[15px] font-medium text-[#241a02] shadow-[0_18px_40px_-18px_#e8b84a] hover:brightness-110">
            Start writing
          </Link>
          <Link href="/commission" className="rounded-[12px] border border-white/15 px-6 py-3.5 text-[15px] font-medium text-white hover:bg-white/5">
            Commission a story
          </Link>
          <Link href="/atlas" className="rounded-[12px] px-4 py-3.5 text-[15px] text-[#b9b1e0] hover:text-white">
            Wander the atlas
          </Link>
          <span className="ml-1 text-sm text-[#7f78ab]">Works without an account. Sign in to sync across devices.</span>
        </div>
      </section>

      <section className="relative z-10 border-t border-white/10 bg-[#0c0a1f]/70 backdrop-blur">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-2 lg:grid-cols-4">
          <Pillar
            title="The studio"
            body="A quiet page that adapts to the craft. A novel gets a chapter rail and a cast. A poem gets a narrower column and a meter scanner. A blog post gets headline and hook tools. Autosave, version history, sprints, focus mode."
          />
          <Pillar
            title="The companion"
            body="It writes inside your voice: StoryForge measures how you actually write and hands that to the model before every suggestion. Set a rating and a heat level per work, from closed door to fully explicit, and the companion follows it. Continue, tighten, turn up the heat, check canon against your fandom, fork the story six ways, or ask for an honest critique."
          />
          <Pillar
            title="Commissions"
            body="Or hand over the whole idea. Pick a book, a story, a poem, a scene or a song; set the heat from none to hardcore, the English from classic to modern, the length in chapters and words; write your imagination; and it is written, chapter by chapter, saved to your library, ready to read aloud or download as a typeset PDF in five editions."
          />
          <Pillar
            title="The atlas"
            body="Every work is a star. Chapters orbit it. Characters, places and themes drift between the chapters they appear in. Fly through your whole body of work, spot the character you dropped in chapter four, and jump straight back into the page."
          />
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="font-display text-3xl font-medium leading-tight sm:text-4xl">A companion for every kind of writer.</h2>
        <ul className="mt-8 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {CRAFT_LIST.map((c) => (
            <li key={c.id} className="border-t border-white/10 pt-4">
              <div className="font-display text-xl font-medium">{c.label}</div>
              <p className="mt-1 text-sm leading-relaxed text-[#b9b1e0]">{c.tagline}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="relative z-10 border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl font-medium">Yours, on every device.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#b9b1e0]">
              Your manuscript lives on your device first and works offline. Sign in and it syncs privately to your account, so tomorrow you open your phone and the chapter is where you left it. Export to Markdown, Word, HTML or a full backup whenever you like. Nothing is used to train anything.
            </p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-medium">Adult fiction, written for adults.</h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#b9b1e0]">
              Romance, dark romance, kink, fan fiction for every franchise. Rate each work, confirm you are an adult once, and the companion writes intimacy as frankly as the genre asks, without lectures. Two lines never move: every character in a sexual scene is an adult, and no real people.
            </p>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-[#7f78ab] sm:px-8">
          <span>StoryForge</span>
          <span>Open source. Bring your own free Gemini key.</span>
        </div>
      </footer>
    </main>
  );
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-display text-2xl font-medium">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-[#b9b1e0]">{body}</p>
    </div>
  );
}
