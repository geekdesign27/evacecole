import { useEffect } from "react";
import type React from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Heading, Italic, List, ListOrdered, Redo2, RemoveFormatting, Underline, Undo2 } from "lucide-react";
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
      { key: "b", aria: "Gras", icon: <Bold size={20} />, active: state?.bold, run: () => chain()?.toggleBold().run() },
      { key: "i", aria: "Italique", icon: <Italic size={20} />, active: state?.italic, run: () => chain()?.toggleItalic().run() },
      { key: "u", aria: "Souligné", icon: <Underline size={20} />, active: state?.underline, run: () => chain()?.toggleUnderline().run() },
    ],
    [
      { key: "h", aria: "Sous-titre", icon: <Heading size={20} />, active: state?.heading, run: () => chain()?.toggleHeading({ level: 3 }).run() },
      { key: "ul", aria: "Liste à puces", icon: <List size={20} />, active: state?.bullet, run: () => chain()?.toggleBulletList().run() },
      { key: "ol", aria: "Liste numérotée", icon: <ListOrdered size={20} />, active: state?.ordered, run: () => chain()?.toggleOrderedList().run() },
    ],
    [
      { key: "clear", aria: "Effacer la mise en forme", icon: <RemoveFormatting size={20} />, run: () => chain()?.unsetAllMarks().clearNodes().run() },
      { key: "undo", aria: "Annuler", icon: <Undo2 size={20} />, disabled: !state?.canUndo, run: () => chain()?.undo().run() },
      { key: "redo", aria: "Rétablir", icon: <Redo2 size={20} />, disabled: !state?.canRedo, run: () => chain()?.redo().run() },
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
