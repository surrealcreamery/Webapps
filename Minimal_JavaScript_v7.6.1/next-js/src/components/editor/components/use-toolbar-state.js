import { useEditorState } from '@tiptap/react';

// ----------------------------------------------------------------------

export function useToolbarState(editor) {
  const toolbarState = useEditorState({
    editor,
    selector: (ctx) => {
      const canRun = ctx.editor.can().chain().focus();

      return {
        isBold: ctx.editor.isActive('bold'),
        isCode: ctx.editor.isActive('code'),
        isLink: ctx.editor.isActive('link'),
        isItalic: ctx.editor.isActive('italic'),
        isStrike: ctx.editor.isActive('strike'),
        isUnderline: ctx.editor.isActive('underline'),
        isCodeBlock: ctx.editor.isActive('codeBlock'),
        isBulletList: ctx.editor.isActive('bulletList'),
        isBlockquote: ctx.editor.isActive('blockquote'),
        isOrderedList: ctx.editor.isActive('orderedList'),
        isAlign: (value) => ctx.editor.isActive({ textAlign: value }),
        isTextTransform: (value) => ctx.editor.isActive('textTransform', { textTransform: value }),
        isTextLevel: (value) =>
          value
            ? ctx.editor.isActive('heading', { level: value })
            : ctx.editor.isActive('paragraph'),
        canUndo: canRun.undo().run(),
        canRedo: canRun.redo().run(),
      };
    },
  });

  return toolbarState;
}
