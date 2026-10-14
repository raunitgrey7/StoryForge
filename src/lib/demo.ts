"use client";

import { countWords, createDoc, createWork, db } from "./db";
import { upsertEntities } from "./entities";

const p = (...paras: string[]) => paras.map((t) => `<p>${t}</p>`).join("");
const text = (html: string) => html.replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "").trim();

/**
 * Seeds a small, real body of work so the Atlas has something to show and
 * every panel has something to chew on. Three works, three crafts.
 */
export async function seedDemo() {
  const existing = await db.works.count();
  if (existing > 0) return;

  // 1. A novel
  const novel = await createWork({
    title: "The Cartographer of Salt",
    craft: "novel",
    logline: "A mapmaker who cannot lie is hired to chart a city that changes shape every night.",
    hue: 38,
    wordGoal: 80000,
  });

  const ch1 = p(
    "Ilse Varga had drawn eleven cities and never once put a street where a street was not. It was the reason the Guild tolerated her and the reason no one invited her to dinner.",
    "The letter arrived folded into the shape of a bird. She unfolded it on the drafting table, weighted the corners with her brass compass and two cold cups of tea, and read it three times. Marrow wanted a map. Marrow, the salt city on the estuary, whose every guide book carried the same warning in the same apologetic type: <em>the streets are not where you left them.</em>",
    "“They can’t be mapped,” said Teodor from the doorway. He had been listening; he always was. “That’s the whole point of the place.”",
    "“Everything can be mapped,” Ilse said. “Some things just have to be mapped more often.”",
    "She packed the long case that night: vellum, the good pens, the box of silver nibs her mother had left her, the compass that pointed only ever north and had never, in her hands, been wrong. At the bottom of the case, wrapped in oilcloth, the first map she had ever made. A child’s map of a garden, drawn from memory, with a well in the corner that had not been there.",
    "That map was the only lie she had ever told. She carried it the way other people carried a stone in a shoe.",
  );
  const ch2 = p(
    "Marrow smelled of brine and lamp oil and something sweeter underneath, like fruit left too long in a warm room. The harbour master, a broad woman named Odile Ferrant, met the boat herself.",
    "“You’re the honest one,” Odile said, not as a compliment. “The Guild wrote ahead. They said you’d be difficult.”",
    "“I’m accurate,” Ilse said. “People find that difficult.”",
    "They walked. Ilse counted paces from the harbour steps to the salt exchange: three hundred and twelve. She wrote it down. At the exchange a boy was selling paper lanterns shaped like fish, and beyond him the street bent left toward a bell tower with a green copper roof. She wrote that down too. The tower had a clock with no hands.",
    "In the morning she walked the same three hundred and twelve paces and arrived at a bakery. The bell tower stood to the right now, its roof the dull red of old brick, and the clock had one hand, pointing at nothing.",
    "Ilse stood very still in the middle of the street with her notebook open and felt, for the first time in her adult life, the particular vertigo of a person who has written something down and cannot say whether it is true.",
  );
  const ch3 = p(
    "Teodor had followed her. Of course he had. He appeared on the fourth day at the salt exchange with a rucksack and an expression of injured innocence, and Odile Ferrant looked at him the way she looked at weather.",
    "“The city moves at night,” Ilse told him, because there was no point pretending. “Not all of it. The bones stay. The harbour, the exchange, the tower, though the tower changes its face. The streets between them re-thread themselves. Like someone unpicking stitches and sewing them back.”",
    "“So you map the bones.”",
    "“I map what’s there.” She showed him the notebook: seven days, seven maps, none of them the same. “The Guild will call this a failure. Seven contradictions.”",
    "Teodor turned the pages slowly. He was not a cartographer but he had an eye for patterns, which was a different and in some ways more dangerous thing. “They’re not contradictions,” he said at last. “Look. The bakery is always the same distance from the tower. The lantern boy is always three hundred paces from water. It isn’t random, Ilse. It’s a map of something else.”",
    "Outside, the clock with no hands began, for the first time in anyone’s memory, to strike.",
  );

  for (const [i, [title, html, goal]] of (
    [
      ["The Letter Folded Like a Bird", ch1, "Establish Ilse, her honesty, and the one lie she carries."],
      ["Three Hundred and Twelve Paces", ch2, "First contact with Marrow. The city moves; her certainty cracks."],
      ["The Bones Stay", ch3, "Teodor arrives. Reframe: the changes are a pattern, not chaos."],
    ] as const
  ).entries()) {
    await createDoc(novel.id, title, { html, text: text(html), wordCount: countWords(text(html)), order: i, goal, status: i < 2 ? "revising" : "draft" });
  }

  await upsertEntities(novel.id, [
    { kind: "character", name: "Ilse Varga", aliases: ["Ilse"], description: "A Guild cartographer who has never drawn a false street. Carries one childhood lie.", traits: ["precise", "lonely", "stubborn"] },
    { kind: "character", name: "Teodor", description: "Ilse's friend, a listener at doorways with an eye for patterns.", traits: ["curious", "loyal", "reckless"] },
    { kind: "character", name: "Odile Ferrant", aliases: ["Odile", "the harbour master"], description: "Marrow's harbour master. Blunt, weather-eyed, unimpressed by honesty.", traits: ["blunt", "watchful"] },
    { kind: "place", name: "Marrow", description: "A salt city on an estuary whose streets rearrange every night. The bones stay.", traits: ["shifting", "brine and lamp oil"] },
    { kind: "place", name: "the bell tower", aliases: ["bell tower", "the tower"], description: "A tower whose roof colour and clock change nightly. The clock has no hands, until it strikes.", traits: [] },
    { kind: "object", name: "the compass", aliases: ["brass compass"], description: "Ilse's brass compass. Points only ever north and has never been wrong.", traits: [] },
    { kind: "object", name: "the garden map", aliases: ["child's map"], description: "Ilse's first map, of a garden, with a well that was not there. Her only lie.", traits: [] },
    { kind: "theme", name: "Honesty versus truth", description: "Ilse records exactly what she sees; the city makes accuracy and truth diverge.", traits: [] },
    { kind: "fact", name: "312 paces", aliases: ["three hundred and twelve"], description: "Distance from harbour steps to the salt exchange on day one; leads to a bakery on day two.", traits: [] },
  ]);

  // 2. A poetry collection
  const poems = await createWork({
    title: "Small Hours",
    craft: "poetry",
    logline: "Poems written between two and four in the morning.",
    hue: 300,
  });
  const poem1 = p(
    "The kettle knows the hour before I do,",
    "ticking itself awake on the cold ring.",
    "Outside, the street has put away its blue",
    "and gone to charcoal. Nothing wants to sing.",
    "",
    "I count the houses where a window burns:",
    "a nurse, a baby, someone else’s grief.",
    "The night is full of small unpaid returns,",
    "each lamp a promise kept, however brief.",
  );
  const poem2 = p(
    "There is a drawer in every house",
    "for the things that have no drawer:",
    "the key to nothing, string, the mouse",
    "of a computer we don’t have any more.",
    "",
    "I keep you there. Not out of spite.",
    "It’s only that the other rooms are full,",
    "and you were always something I might",
    "need on a night like this, and pull",
    "",
    "out, and turn over, and put back.",
  );
  await createDoc(poems.id, "Kettle", { html: poem1, text: text(poem1), wordCount: countWords(text(poem1)), order: 0, status: "done" });
  await createDoc(poems.id, "The Drawer", { html: poem2, text: text(poem2), wordCount: countWords(text(poem2)), order: 1, status: "revising" });
  await upsertEntities(poems.id, [
    { kind: "theme", name: "Insomnia", description: "The small hours as a place where things are seen clearly.", traits: [] },
    { kind: "theme", name: "Kept things", description: "Objects and people held onto past their use.", traits: [] },
    { kind: "object", name: "the kettle", aliases: ["kettle"], description: "Wakes before the speaker; marks the hour.", traits: [] },
  ]);

  // 3. A blog
  const blog = await createWork({
    title: "Slow Software",
    craft: "blog",
    logline: "Notes on building tools that respect attention.",
    hue: 175,
  });
  const post1 = p(
    "Every notification is a tiny loan against your attention, and most apps never pay it back.",
    "I have spent the last year building tools for people who write for a living, and the single most requested feature was not a feature. It was silence. Writers wanted the app to stop talking to them.",
    "This post is about what that request taught me: that the most respectful thing software can do is wait to be asked.",
    "Here is the rule I now design by. If a feature would interrupt someone mid-sentence, it has to justify itself against the sentence. Almost nothing does.",
  );
  await createDoc(blog.id, "The app that waits", { html: post1, text: text(post1), wordCount: countWords(text(post1)), order: 0, status: "revising", goal: "Argue that restraint is a feature. End with the one design rule." });
  await upsertEntities(blog.id, [
    { kind: "theme", name: "Attention as a loan", description: "Interruptions borrow attention that is rarely repaid.", traits: [] },
    { kind: "fact", name: "The rule", description: "A feature that interrupts a sentence must justify itself against the sentence.", traits: [] },
  ]);

  return novel.id;
}
