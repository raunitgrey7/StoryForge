import type { AiTask, CraftId } from "./types";

export interface CraftTool {
  task: AiTask;
  label: string;
  hint: string;
  needsSelection?: boolean;
  /** Tools that produce advice rather than prose are rendered as notes, not inserted. */
  advisory?: boolean;
}

export interface Craft {
  id: CraftId;
  label: string;
  unitLabel: string; // what a doc is called: chapter, poem, post...
  unitPlural: string;
  tagline: string;
  placeholder: string;
  pageWidth: number; // px, the prose column width
  tools: CraftTool[];
  pulse: ("tension" | "rhythm" | "readability" | "dialogue" | "sound" | "clarity")[];
}

const shared: CraftTool[] = [
  { task: "continue", label: "Continue", hint: "Write the next beat in your voice" },
  { task: "rewrite", label: "Rewrite", hint: "Same meaning, better sentences", needsSelection: true },
  { task: "tighten", label: "Tighten", hint: "Cut the fat, keep the muscle", needsSelection: true },
  { task: "expand", label: "Expand", hint: "Give this moment more room", needsSelection: true },
  { task: "critique", label: "Critique", hint: "An honest editor's read", advisory: true },
  { task: "brainstorm", label: "Brainstorm", hint: "Ten directions this could go", advisory: true },
];

export const CRAFTS: Record<CraftId, Craft> = {
  novel: {
    id: "novel",
    label: "Novel",
    unitLabel: "Chapter",
    unitPlural: "Chapters",
    tagline: "Long-form fiction with a cast that must stay consistent.",
    placeholder: "The chapter opens on...",
    pageWidth: 720,
    tools: [
      ...shared,
      { task: "sensory", label: "Sensory pass", hint: "Add sight, sound, smell, touch", needsSelection: true },
      { task: "dialogue", label: "Sharpen dialogue", hint: "Subtext, rhythm, fewer tags", needsSelection: true },
      { task: "summarize", label: "Chapter recap", hint: "What happened, for your notes", advisory: true },
      { task: "outline", label: "Beat sheet", hint: "Where this chapter is heading", advisory: true },
    ],
    pulse: ["tension", "rhythm", "dialogue", "readability"],
  },
  short: {
    id: "short",
    label: "Short story",
    unitLabel: "Story",
    unitPlural: "Stories",
    tagline: "One arc, one turn, no wasted line.",
    placeholder: "It began with...",
    pageWidth: 680,
    tools: [
      ...shared,
      { task: "sensory", label: "Sensory pass", hint: "Add sight, sound, smell, touch", needsSelection: true },
      { task: "dialogue", label: "Sharpen dialogue", hint: "Subtext, rhythm, fewer tags", needsSelection: true },
      { task: "titles", label: "Title ideas", hint: "Twelve titles, none obvious", advisory: true },
    ],
    pulse: ["tension", "rhythm", "dialogue", "readability"],
  },
  romance: {
    id: "romance",
    label: "Romance",
    unitLabel: "Chapter",
    unitPlural: "Chapters",
    tagline: "Two people, one obstacle, and a heat level you set.",
    placeholder: "The first time they met...",
    pageWidth: 700,
    tools: [
      ...shared,
      { task: "tension", label: "Raise the tension", hint: "More longing, more subtext", needsSelection: true },
      { task: "heat_up", label: "Turn up the heat", hint: "Hotter, to the work's rating", needsSelection: true },
      { task: "heat_down", label: "Cool it down", hint: "Same scene, closed door", needsSelection: true },
      { task: "dialogue", label: "Sharpen dialogue", hint: "Banter, subtext, fewer tags", needsSelection: true },
      { task: "sensory", label: "Sensory pass", hint: "Touch, breath, heat, sound", needsSelection: true },
      { task: "beats", label: "Romance beats", hint: "Where you are on the arc", advisory: true },
      { task: "summarize", label: "Chapter recap", hint: "What happened, for your notes", advisory: true },
    ],
    pulse: ["tension", "rhythm", "dialogue", "readability"],
  },
  fanfic: {
    id: "fanfic",
    label: "Fan fiction",
    unitLabel: "Chapter",
    unitPlural: "Chapters",
    tagline: "Your fandom, your ships, your rules. The companion knows the canon.",
    placeholder: "Set the scene in your fandom...",
    pageWidth: 700,
    tools: [
      ...shared,
      { task: "canon", label: "Canon check", hint: "Voices, facts, timeline against the source", advisory: true },
      { task: "tension", label: "Ship tension", hint: "More charge between them", needsSelection: true },
      { task: "heat_up", label: "Turn up the heat", hint: "Hotter, to the work's rating", needsSelection: true },
      { task: "heat_down", label: "Cool it down", hint: "Same scene, closed door", needsSelection: true },
      { task: "dialogue", label: "In-character dialogue", hint: "Make them sound like themselves", needsSelection: true },
      { task: "tags", label: "Suggest tags", hint: "Archive-style tags and warnings", advisory: true },
      { task: "summarize", label: "Chapter recap", hint: "What happened, for your notes", advisory: true },
    ],
    pulse: ["tension", "rhythm", "dialogue", "readability"],
  },
  poetry: {
    id: "poetry",
    label: "Poetry",
    unitLabel: "Poem",
    unitPlural: "Poems",
    tagline: "Sound, line, image. The companion listens for meter.",
    placeholder: "First line...",
    pageWidth: 560,
    tools: [
      { task: "continue", label: "Next stanza", hint: "Carry the poem forward" },
      { task: "imagery", label: "Sharpen image", hint: "Concrete, surprising, specific", needsSelection: true },
      { task: "meter", label: "Scan meter", hint: "Stress pattern and where it breaks", advisory: true },
      { task: "rhyme", label: "Rhyme & slant", hint: "Options for the line you point at", needsSelection: true, advisory: true },
      { task: "tighten", label: "Compress", hint: "Fewer words, more weight", needsSelection: true },
      { task: "critique", label: "Workshop read", hint: "How a careful reader hears it", advisory: true },
      { task: "titles", label: "Title ideas", hint: "Twelve titles, none obvious", advisory: true },
    ],
    pulse: ["sound", "rhythm", "clarity"],
  },
  blog: {
    id: "blog",
    label: "Blog post",
    unitLabel: "Post",
    unitPlural: "Posts",
    tagline: "Clear, skimmable, findable.",
    placeholder: "Start with the one thing your reader needs to know...",
    pageWidth: 700,
    tools: [
      ...shared,
      { task: "hook", label: "Opening hooks", hint: "Five first paragraphs", advisory: true },
      { task: "outline", label: "Outline", hint: "Headings and the flow between them", advisory: true },
      { task: "seo", label: "Headline & SEO", hint: "Titles, description, keywords", advisory: true },
      { task: "summarize", label: "TL;DR", hint: "Three-sentence summary" , advisory: true },
    ],
    pulse: ["readability", "clarity", "rhythm"],
  },
  essay: {
    id: "essay",
    label: "Essay",
    unitLabel: "Essay",
    unitPlural: "Essays",
    tagline: "An argument that earns its conclusion.",
    placeholder: "The claim I want to make is...",
    pageWidth: 700,
    tools: [
      ...shared,
      { task: "outline", label: "Argument map", hint: "Claims, evidence, counterpoints", advisory: true },
      { task: "hook", label: "Openings", hint: "Five ways in", advisory: true },
      { task: "summarize", label: "Abstract", hint: "The essay in a paragraph", advisory: true },
    ],
    pulse: ["clarity", "readability", "rhythm"],
  },
  screenplay: {
    id: "screenplay",
    label: "Screenplay",
    unitLabel: "Scene",
    unitPlural: "Scenes",
    tagline: "Only what the camera sees and the actor says.",
    placeholder: "INT. KITCHEN - NIGHT",
    pageWidth: 640,
    tools: [
      { task: "continue", label: "Next beat", hint: "Action and dialogue that moves" },
      { task: "dialogue", label: "Punch dialogue", hint: "Cut on-the-nose lines", needsSelection: true },
      { task: "tighten", label: "Tighten action", hint: "Lean, present tense, visual", needsSelection: true },
      { task: "logline", label: "Logline", hint: "One sentence that sells it", advisory: true },
      { task: "outline", label: "Scene beats", hint: "Goal, conflict, turn", advisory: true },
      { task: "critique", label: "Script notes", hint: "A reader's coverage", advisory: true },
    ],
    pulse: ["dialogue", "tension", "rhythm"],
  },
  lyrics: {
    id: "lyrics",
    label: "Song lyrics",
    unitLabel: "Song",
    unitPlural: "Songs",
    tagline: "Verse, chorus, bridge. Made for the mouth.",
    placeholder: "Verse 1...",
    pageWidth: 560,
    tools: [
      { task: "continue", label: "Next section", hint: "Verse, chorus or bridge" },
      { task: "rhyme", label: "Rhyme options", hint: "Perfect and slant rhymes", needsSelection: true, advisory: true },
      { task: "imagery", label: "Stronger image", hint: "Concrete over abstract", needsSelection: true },
      { task: "hook", label: "Hook lines", hint: "Ten chorus hooks", advisory: true },
      { task: "meter", label: "Singability", hint: "Syllables per line, stresses", advisory: true },
      { task: "critique", label: "Listen back", hint: "What lands, what drags", advisory: true },
    ],
    pulse: ["sound", "rhythm", "clarity"],
  },
  journal: {
    id: "journal",
    label: "Journal",
    unitLabel: "Entry",
    unitPlural: "Entries",
    tagline: "A private page. The companion asks, never judges.",
    placeholder: "Today...",
    pageWidth: 640,
    tools: [
      { task: "prompt", label: "Ask me something", hint: "A question to keep going", advisory: true },
      { task: "summarize", label: "What I said", hint: "Reflect it back", advisory: true },
      { task: "expand", label: "Go deeper", hint: "Unfold this moment", needsSelection: true },
      { task: "titles", label: "Name this entry", hint: "Short, honest titles", advisory: true },
    ],
    pulse: ["clarity", "rhythm"],
  },
  newsletter: {
    id: "newsletter",
    label: "Newsletter",
    unitLabel: "Issue",
    unitPlural: "Issues",
    tagline: "Written for one reader, sent to many.",
    placeholder: "Hi, ...",
    pageWidth: 660,
    tools: [
      ...shared,
      { task: "hook", label: "Subject lines", hint: "Ten subject lines and preheaders", advisory: true },
      { task: "outline", label: "Sections", hint: "The issue's shape", advisory: true },
      { task: "summarize", label: "In one line", hint: "The takeaway", advisory: true },
    ],
    pulse: ["readability", "clarity", "rhythm"],
  },
  children: {
    id: "children",
    label: "Children's story",
    unitLabel: "Story",
    unitPlural: "Stories",
    tagline: "Simple words, big feelings, a page that wants to be read aloud.",
    placeholder: "Once, in a house at the edge of the woods...",
    pageWidth: 600,
    tools: [
      { task: "continue", label: "What happens next", hint: "Gentle, vivid, read-aloud friendly" },
      { task: "rewrite", label: "Simpler words", hint: "Age-appropriate, still lovely", needsSelection: true },
      { task: "imagery", label: "Picture it", hint: "Details an illustrator could draw", needsSelection: true },
      { task: "brainstorm", label: "Story ideas", hint: "Ten small adventures", advisory: true },
      { task: "critique", label: "Read-aloud check", hint: "Rhythm, repetition, page turns", advisory: true },
    ],
    pulse: ["readability", "sound", "rhythm"],
  },
};

export const CRAFT_LIST = Object.values(CRAFTS);

export function craftOf(id: CraftId | undefined): Craft {
  return CRAFTS[id ?? "novel"] ?? CRAFTS.novel;
}
