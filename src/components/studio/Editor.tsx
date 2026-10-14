"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Bold, Heading2, Italic, Quote, Sparkles, Scissors, Wand2 } from "lucide-react";
import { db, saveDocContent, snapshotDoc } from "@/lib/db";
import { useUI } from "@/lib/store";
import { useShallow } from "zustand/react/shallow";
import { useStudioData } from "@/hooks/useStudioData";
import type { AiTask, Doc } from "@/lib/types";

const AUTOSNAP_MS = 8 * 60 * 1000;

export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .replace(/\r/g, "")
    .trim()
    .split(/\n\s*\n/)
    .map((para) => `<p>${esc(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function Editor({ doc }: { doc: Doc }) {
  const ui = useUI(useShallow((s) => ({ setSelection: s.setSelection, setDockTab: s.setDockTab, insertQueue: s.insertQueue, clearInsert: s.clearInsert, focusMode: s.focusMode })));
  const { craft, work } = useStudioData();
  const [saved, setSaved] = useState<"saved" | "saving" | "idle">("idle");
  const [goal, setGoal] = useState(doc.goal ?? "");
  const [toolbar, setToolbar] = useState<{ x: number; y: number } | null>(null);
  const saveTimer = useRef<number | null>(null);
  const lastSnap = useRef<number>(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isVerse = craft.id === "poetry" || craft.id === "lyrics";

  const { docs } = useStudioData();
  const chapterIndex = docs.filter((d) => !d.parentId).findIndex((d) => d.id === doc.id);
  const chapterCount = docs.filter((d) => !d.parentId).length;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: craft.placeholder }),
      CharacterCount,
    ],
    content: doc.html || "",
    editorProps: {
      attributes: {
        class: "sf-prose min-h-[60vh] outline-none",
        "data-craft": craft.id,
        spellcheck: "true",
      },
      handleKeyDown: (_view, event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          window.dispatchEvent(new CustomEvent("sf:companion", { detail: { task: "continue" as AiTask } }));
          return true;
        }
        // In verse, Enter makes a line break; a blank line (Enter twice) makes a new stanza.
        if (isVerse && event.key === "Enter" && !event.shiftKey) {
          return false;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      setSaved("saving");
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(async () => {
        const html = editor.getHTML();
        const text = editor.getText({ blockSeparator: "\n\n" });
        await saveDocContent(doc.id, html, text);
        setSaved("saved");
        if (!lastSnap.current) lastSnap.current = Date.now();
        if (Date.now() - lastSnap.current > AUTOSNAP_MS) {
          lastSnap.current = Date.now();
          snapshotDoc(doc.id, "Autosave");
        }
      }, 600);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection;
      const text = empty ? "" : editor.state.doc.textBetween(from, to, "\n");
      ui.setSelection(text);
      markFocusBlock(editor.view);
      if (!empty && text.trim().length > 0) {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        const rect = wrapRef.current?.getBoundingClientRect();
        if (rect) setToolbar({ x: (start.left + end.left) / 2 - rect.left, y: Math.min(start.top, end.top) - rect.top + (wrapRef.current?.scrollTop ?? 0) });
      } else setToolbar(null);
    },
  });

  // Save on unmount / doc switch with anything pending.
  useEffect(() => {
    return () => {
      if (saveTimer.current && editor) {
        window.clearTimeout(saveTimer.current);
        saveDocContent(doc.id, editor.getHTML(), editor.getText({ blockSeparator: "\n\n" }));
      }
    };
  }, [editor, doc.id]);

  // Companion insertions.
  useEffect(() => {
    if (!editor || !ui.insertQueue) return;
    const { text, mode } = ui.insertQueue;
    const html = textToHtml(text);
    snapshotDoc(doc.id, mode === "replace" ? "Before companion replace" : "Before companion insert").then(() => {
      if (mode === "replace" && !editor.state.selection.empty) {
        editor.chain().focus().deleteSelection().insertContent(html).run();
      } else {
        editor.chain().focus("end").insertContent(html).run();
        requestAnimationFrame(() => wrapRef.current?.scrollTo({ top: wrapRef.current.scrollHeight, behavior: "smooth" }));
      }
      ui.clearInsert();
    });
  }, [editor, ui.insertQueue, ui, doc.id]);

  const words = doc.wordCount;
  const pageWidth = craft.pageWidth;
  const goalWords = work?.wordGoal;
  const reading = useMemo(() => Math.max(1, Math.round(words / 230)), [words]);

  function ask(task: AiTask) {
    window.dispatchEvent(new CustomEvent("sf:companion", { detail: { task } }));
    ui.setDockTab("companion");
  }

  return (
    <div className="sf-page relative flex min-h-0 flex-1 flex-col">
      <div ref={wrapRef} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto px-4 pb-40 pt-8 sm:px-6 sm:pt-12" style={{ maxWidth: pageWidth + 48 }}>
          <div className="mb-8 text-center">
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#a39dbd]">
              {work?.title ?? ""}
              {chapterIndex >= 0 && chapterCount > 1 ? ` · ${craft.unitLabel} ${chapterIndex + 1} of ${chapterCount}` : doc.forkLabel ? " · branch" : ""}
            </div>
            <h1 className="font-display mt-2 text-[2rem] font-medium leading-tight text-[#221c3d] sm:text-[2.4rem]" style={{ fontVariationSettings: '"opsz" 96, "SOFT" 60, "WONK" 1' }}>
              {doc.title}
            </h1>
            <div className="mx-auto mt-4 h-px w-16 bg-gradient-to-r from-transparent via-[#c9971c] to-transparent" />
          </div>
          <input
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onBlur={() => db.docs.update(doc.id, { goal: goal.trim() || undefined })}
            data-tip="A private note about what this piece must do. The companion reads it; readers never see it."
            data-tip-side="bottom"
            placeholder={`What this ${craft.unitLabel.toLowerCase()} must do (optional)`}
            className="mb-6 w-full bg-transparent text-sm italic text-[#8a84ad] outline-none placeholder:text-[#b3aecb]"
            aria-label="Goal"
          />
          <EditorContent editor={editor} />
        </div>

        {toolbar && editor && !ui.focusMode && (
          <div
            className="sf-enter absolute z-20 flex -translate-x-1/2 -translate-y-[calc(100%+10px)] items-center gap-0.5 rounded-[10px] border border-[#d9d2ee] bg-white p-1 shadow-[0_12px_30px_-12px_rgba(27,23,64,0.4)]"
            style={{ left: toolbar.x, top: toolbar.y }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <TB label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><Bold size={14} /></TB>
            <TB label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic size={14} /></TB>
            <TB label="Heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></TB>
            <TB label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote size={14} /></TB>
            <span className="mx-1 h-5 w-px bg-[#e5dff3]" />
            <TB label="Rewrite this passage with the companion: same meaning, better sentences" onClick={() => ask("rewrite")} tone="aurora"><Wand2 size={14} /></TB>
            <TB label="Tighten this passage: cut filler, keep the muscle" onClick={() => ask("tighten")} tone="aurora"><Scissors size={14} /></TB>
            <TB label="Expand this passage: slow down, add detail" onClick={() => ask("expand")} tone="aurora"><Sparkles size={14} /></TB>
          </div>
        )}
      </div>

      <footer className="flex h-9 shrink-0 items-center gap-3 overflow-hidden border-t border-[#eae5f3] bg-[#fbf9f2] px-3 text-[11px] text-[#8a84ad] sm:gap-4 sm:px-4">
        <span className="tabular-nums text-[#4b4570]">{words.toLocaleString()} words</span>
        <span>{reading} min read</span>
        {goalWords ? (
          <span className="flex items-center gap-2">
            <span className="h-1 w-24 overflow-hidden rounded-full bg-[#e5dff3]">
              <span className="block h-full rounded-full bg-[#c9971c]" style={{ width: `${Math.min(100, (totalOf(doc, words) / goalWords) * 100)}%` }} />
            </span>
            goal {goalWords.toLocaleString()}
          </span>
        ) : null}
        <span className="ml-auto">{saved === "saving" ? "Saving…" : saved === "saved" ? "Saved" : "Autosave on"}</span>
        <span className="hidden lg:inline">
          <kbd className="sf-kbd">Ctrl ↵</kbd> continue
        </span>
      </footer>
    </div>
  );
}

function totalOf(_doc: Doc, words: number) {
  return words;
}

function TB({ label, active, onClick, tone, children }: { label: string; active?: boolean; onClick: () => void; tone?: "aurora"; children: React.ReactNode }) {
  return (
    <button
      data-tip={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md ${
        active ? "bg-[#1b1740] text-white" : tone === "aurora" ? "text-[#0f9d84] hover:bg-[#0f9d84]/10" : "text-[#4b4570] hover:bg-[#f0ecf9]"
      }`}
    >
      {children}
    </button>
  );
}

/** Focus mode helper: marks the top-level block that holds the cursor. */
function markFocusBlock(view: { dom: HTMLElement; state: { selection: { from: number } }; domAtPos: (p: number) => { node: Node } }) {
  const root = view.dom;
  let node: Node | null = view.domAtPos(view.state.selection.from).node;
  while (node && node.parentNode !== root) node = node.parentNode;
  root.querySelectorAll(".has-focus").forEach((el) => el.classList.remove("has-focus"));
  if (node instanceof HTMLElement) node.classList.add("has-focus");
}
