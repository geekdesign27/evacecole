import { useEffect } from "react";
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

/** Small WYSIWYG editor: bold, italic, bullet and numbered lists. Output is whitelisted on render. */
export function RichEditor({ id, label, value, onChange, minRows = 4 }: Props) {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        heading: false,
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
        class: "rich-content field",
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
      bullet: e?.isActive("bulletList") ?? false,
      ordered: e?.isActive("orderedList") ?? false,
      canUndo: e?.can().undo() ?? false,
      canRedo: e?.can().redo() ?? false,
    }),
  });

  const tools: {
    key: string;
    label: string;
    aria: string;
    active?: boolean;
    disabled?: boolean;
    run: () => void;
    cls?: string;
  }[] = [
    {
      key: "b",
      label: "G",
      aria: "Gras",
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
      cls: "font-bold",
    },
    {
      key: "i",
      label: "I",
      aria: "Italique",
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
      cls: "italic font-serif",
    },
    {
      key: "ul",
      label: "• Liste",
      aria: "Liste à puces",
      active: state?.bullet,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      key: "ol",
      label: "1. Liste",
      aria: "Liste numérotée",
      active: state?.ordered,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      key: "undo",
      label: "↶",
      aria: "Annuler",
      disabled: !state?.canUndo,
      run: () => editor?.chain().focus().undo().run(),
    },
    {
      key: "redo",
      label: "↷",
      aria: "Rétablir",
      disabled: !state?.canRedo,
      run: () => editor?.chain().focus().redo().run(),
    },
  ];

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={id}
        className="font-medium"
        onClick={() => editor?.commands.focus()}
      >
        {label}
      </label>
      <div
        role="toolbar"
        aria-label={`Mise en forme : ${label}`}
        className="flex flex-wrap gap-1"
      >
        {tools.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-label={t.aria}
            aria-pressed={t.active === undefined ? undefined : t.active}
            disabled={t.disabled}
            onMouseDown={(e) => e.preventDefault()} // keep the selection in the editor
            onClick={t.run}
            className={`min-h-12 min-w-12 rounded-lg border-2 px-2 disabled:opacity-40 ${
              t.active
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-ink"
            } ${t.cls ?? ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
