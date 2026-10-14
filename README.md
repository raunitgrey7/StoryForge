# StoryForge

A mobile-first writing companion for every kind of writer: novels, short stories, romance, fan fiction for any franchise, poetry, blog posts, essays, screenplays, lyrics, journals, newsletters and children's stories. Adult fiction is a first-class citizen. Your work is saved on your device and, with an account, synced so you can come back tomorrow on any screen.

## What it does

**The studio.** A quiet page that reshapes itself around the craft: chapters and a cast for a novel, a narrow column and a meter scanner for a poem, headline and hook tools for a post, canon checks and ship tags for fan fiction, heat controls for romance. On a phone it is one column with a bottom bar: Works, Write, Companion, Muse. Autosave, version history, sprints, focus mode, a command palette.

**The companion.** Streams from Gemini with key rotation and model failover, and writes inside your voice: StoryForge measures how you actually write and hands that "voice card" to the model before every suggestion. Continue, rewrite, tighten, expand, sensory pass, dialogue polish, critique, brainstorm, turn the heat up or down, raise the tension, map the romance beats, check canon, suggest archive tags, scan meter, find rhymes, write hooks and loglines, or fork the story six ways.

**Ratings and adult content.** Every work carries a rating (Everyone, Teen, Mature, Explicit) and a heat level from closed door to fully explicit. You confirm once that you are an adult; the confirmation lives in your profile. At Mature and Explicit the companion writes sex, desire, kink and violence frankly, with Gemini's safety filters turned off. Two lines never move: every character in a sexual scene is an adult, and no sexual content about real people. Gemini's own policy still often declines graphic sex, so an optional second provider (OpenRouter) can serve explicit-rated works; see `.env.example`.

**The Muse.** Tell it your tastes: genres, tropes, fandoms, preferred heat, what you enjoy and what you never want. It recommends characters, plots, stories to write next, the next chapter of the work you are in, or lays out a whole book (title, blurb, chapters with openings, cast) as a new work you can start writing in immediately.

**The story bible.** Characters, places, objects, themes and facts, extracted by the companion or added by hand, mentions counted locally across every piece. A continuity check reads a chapter against the bible and quotes every contradiction.

**Pulse.** Instant, local analysis: tension curve by paragraph, sentence rhythm, readability, dialogue ratio, adverb and passive rates, clichés, leaned-on words, sensory coverage, syllables per line and rhyme scheme for verse.

**Commissions.** At `/commission` the writer hands over the whole brief: a book, a story, a poem, a scene or a song; genre and fandom; sexual content from none to hardcore (adults only, confirmed once); classic, modern, lyrical, plain or noir English, or the writer's own voice; point of view and tense; chapters and words; and the full imagination. A book is planned first (title, blurb, chapter outline, cast), then written chapter by chapter with a recap carried forward. Everything is saved as a work in the library.

**PDF editions.** Any work downloads as a real, typeset PDF with the font embedded: classic hardback (EB Garamond, drop caps, fleurons), modern paperback (Literata), manuscript (Courier, double-spaced), gothic (Cormorant) or phone reader. Paper is aged old-book cream with darkened edges and foxing by default, or plain cream or white. Illustrations, when drawn, sit at chapter heads.

**Read aloud.** The reader and the commission desk read any piece aloud with the device's own voices (free, offline), paragraph by paragraph with the current one highlighted, with voice and speed controls.

**Illustrations.** One picture per chapter, drawn from the chapter's own text in a style suited to the craft. Providers, in order: an OpenAI-compatible image endpoint you configure, Gemini's image model (needs billing on the key; the free tier has no image quota), then the keyless Pollinations service. Mature and explicit chapters get sensual, editorial imagery; no exposed nudity or sexual acts are requested from any provider.

**Reader.** A clean reading view of any work at `/read/<work>`, with a table of contents, adjustable type, content warnings, an adult gate for rated works, and a saved reading position.

**The atlas.** A 3D sky. Every work is a star, its chapters orbit it, branches orbit chapters, and characters, places and themes drift between the pieces they appear in. Fly to anything and jump into the page.

**Local-first with sync.** Everything lives in the browser's IndexedDB and works offline. Sign in (Google or an emailed link) and every row syncs privately to your Supabase project; deletions travel too. Export to Markdown, Word, HTML, plain text, or a full JSON backup.

## Run it

```bash
npm install
cp .env.example .env.local   # add at least GOOGLE_API_KEY_1
npm run dev
```

Open http://localhost:3000. Free Gemini keys come from https://aistudio.google.com/apikey.

### Accounts and sync (optional)

1. Create a free project at https://supabase.com.
2. In the SQL editor, run `supabase/schema.sql`.
3. Under Authentication, enable Email (magic link) and, if you like, Google. Add your site URL (and `http://localhost:3000` for development) to the redirect allow-list.
4. Put the project URL and anon key in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Row-level security means each account only ever sees its own rows.

### Explicit work (optional)

Set `OPENROUTER_API_KEY` and `STORYFORGE_EXPLICIT_MODEL` to route Mature and Explicit works to a model whose terms allow adult fiction. Gemini remains the fallback with its filters off.

## Deploy

Any Node host works.

- Render: `render.yaml` in the repo defines the web service (Node 22, `npm ci && npm run build`, `npm run start`, health check at `/api/health`). Set the `GOOGLE_API_KEY_*` secrets in the dashboard.
- Vercel: import the repo, add the environment variables above, deploy.

## Models and quotas

Prose leads with `gemini-2.5-flash` (a passage in two to four seconds on the free tier), structured tasks with `gemini-3.5-flash-lite`, and both step down the ladder the moment a key is rate-limited: two rate-limited keys on a model and the next model takes over. Free-tier daily quotas are small; five keys give roughly five times the headroom. `scripts/stream-probe.mjs` checks that a model streams and closes cleanly:

```bash
node --env-file=.env.local scripts/stream-probe.mjs gemini-2.5-flash
```

## Keyboard

| Keys | Does |
| --- | --- |
| Ctrl K | Jump to any piece, panel or action |
| Ctrl Enter | Ask the companion to continue |
| Ctrl S | Save a snapshot |
| Ctrl Shift F | Focus mode |
| Ctrl \ | Show or hide the companion dock |

## Layout

```
src/
  app/               routes: / (landing), /studio, /atlas, /read/[workId], /commission, /api/ai/*, /api/health
  components/
    studio/          shell (mobile and desktop), rail, editor, dock and its panels, dialogs
    atlas/           3D atlas scene and HUD
    reader/          reading view, read-aloud controls, PDF dialog
    commission/      the commission wizard
    account/         sign-in and sync status
    three/           landing constellation
    ui/              primitives, tag input, toasts
  lib/
    ai/              provider pool (Gemini + optional OpenRouter), prompt system with ratings, client stream hook
    cloud/           Supabase client and the sync engine
    analysis.ts      local pulse metrics
    commission.ts    the brief model and its option catalogues
    pdf.ts           typeset PDF editions with embedded fonts and aged paper
    tts.ts           read-aloud with the Web Speech API
    illustrate.ts    chapter illustrations
    voice.ts         voice card
    crafts.ts        what each craft gets
    db.ts            Dexie schema, profile, tombstones, helpers
    entities.ts      story bible linking
    export.ts        md / docx / html / txt / backup
    demo.ts          the demo universe
supabase/schema.sql  tables and row-level security for sync
```

## Stack

Next.js 16, React 19, TypeScript, Tailwind 4, Tiptap, Dexie, Zustand, react-three-fiber + drei, Vercel AI SDK with `@ai-sdk/google` and `@ai-sdk/openai-compatible`, Supabase, docx, jsPDF, Web Speech API. Fonts in `public/fonts` are OFL-licensed (EB Garamond, Literata, Instrument Sans, Courier Prime, Cormorant Garamond).
