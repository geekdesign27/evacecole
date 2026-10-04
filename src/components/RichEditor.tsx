import { useEffect } from "react";
import type React from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { toEditorHtml } from "../domain/rich";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (html: string) => void;
  minRows?: number;
}

/** TipTap editor with a classic toolbar: bold, italic, underline, sub-heading, lists, clear, undo. Output is whitelisted on render. */
export function RichEditor({ id, label, value, onChange, minRows = 4 }: Props) {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        heading: { levels: [3] },
        blockquote: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        link: false,
        dropcursor: false,
      }),
    ],
    content: toEditorHtml(value),
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class: "rich-content px-3 py-2 outline-none",
        style: `min-height: ${minRows * 1.6}em`,
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.isEmpty ? "" : e.getHTML()),
  });

  // Follow outside changes (server sync, « Insérer les suggestions ») when not typing.
  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = toEditorHtml(value);
    if (next !== editor.getHTML())
      editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e?.isActive("bold") ?? false,
      italic: e?.isActive("italic") ?? false,
      underline: e?.isActive("underline") ?? false,
      heading: e?.isActive("heading", { level: 3 }) ?? false,
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  });

  const chain = () => editor?.chain().focus();
  const groups: Tool[][] = [
    [
      { key: "b", aria: "Gras", icon: <span className="font-bold">B</span>, active: state?.bold, run: () => chain()?.toggleBold().run() },
      { key: "i", aria: "Italique", icon: <span className="font-serif italic">I</span>, active: state?.italic, run: () => chain()?.toggleItalic().run() },
      { key: "u", aria: "Souligné", icon: <span className="underline">U</span>, active: state?.underline, run: () => chain()?.toggleUnderline().run() },
    ],
    [
      { key: "h", aria: "Sous-titre", icon: <span className="font-bold">T</span>, active: state?.heading, run: () => chain()?.toggleHeading({ level: 3 }).run() },
      { key: "ul", aria: "Liste à puces", icon: <Icon d={ICONS.bullets} />, active: state?.bullet, run: () => chain()?.toggleBulletList().run() },
      { key: "ol", aria: "Liste numérotée", icon: <Icon d={ICONS.numbers} />, active: state?.ordered, run: () => chain()?.toggleOrderedList().run() },
    ],
    [
      { key: "clear", aria: "Effacer la mise en forme", icon: <Icon d={ICONS.clear} />, run: () => chain()?.unsetAllMarks().clearNodes().run() },
      { key: "undo", aria: "Annuler", icon: <Icon d={ICONS.undo} />, disabled: !state?.canUndo, run: () => chain()?.undo().run() },
      { key: "redo", aria: "Rétablir", icon: <Icon d={ICONS.redo} />, disabled: !state?.canRedo, run: () => chain()?.redo().run() },
    ],
  ];

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium" onClick={() => editor?.commands.focus()}>
        {label}
      </label>
      <div className="rich-editor overflow-hidden rounded-xl border-2 border-line bg-white focus-within:border-ink">
        <div
          role="toolbar"
          aria-label={`Mise en forme : ${label}`}
          className="flex flex-nowrap items-center gap-0.5 overflow-x-auto border-b-2 border-line bg-bg px-1 py-1"
        >
          {groups.map((g, gi) => (
            <div key={gi} className="flex shrink-0 items-center gap-0.5">
              {gi > 0 && <span aria-hidden className="mx-1 h-7 w-px bg-line" />}
              {g.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  title={t.aria}
                  aria-label={t.aria}
                  aria-pressed={t.active === undefined ? undefined : t.active}
                  disabled={t.disabled}
                  onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
                  onClick={t.run}
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg text-lg disabled:opacity-35 ${
                    t.active ? "bg-ink text-white" : "text-ink hover:bg-line"
                  }`}
                >
                  {t.icon}
                </button>
              ))}
            </div>
          ))}
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

interface Tool {
  key: string;
  aria: string;
  icon: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  run: () => void;
}

// Simple stroke icons (24x24 grid).
const ICONS = {
  bullets: "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  numbers: "M10 6h10M10 12h10M10 18h10M4 5l1.5-1v4.5M3.5 14h2.5l-2.5 3h2.5",
  clear: "M6 5h12M12 5l-3 14M4 21L20 3",
  undo: "M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3",
  redo: "M15 14l5-5-5-5M20 9H10a6 6 0 000 12h3",
};

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}
