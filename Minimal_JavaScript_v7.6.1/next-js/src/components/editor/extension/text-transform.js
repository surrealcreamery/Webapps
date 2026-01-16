import { Mark } from '@tiptap/core';

// ----------------------------------------------------------------------

const isHTMLElement = (node) => node instanceof HTMLElement;

const isValidTextTransform = (value, allowed) =>
  typeof value === 'string' && allowed.includes(value);

// ----------------------------------------------------------------------

export const TextTransform = Mark.create({
  name: 'textTransform',
  /********/
  addOptions() {
    return {
      allowedValues: ['uppercase', 'lowercase', 'capitalize'],
      defaultValue: undefined,
    };
  },
  /********/
  addAttributes() {
    return {
      textTransform: {
        default: this.options.defaultValue,
        parseHTML: (element) => {
          if (!isHTMLElement(element)) return undefined;

          const rawValue =
            element.style.textTransform ||
            element.getAttribute('style')?.match(/text-transform:\s*(\w+)/)?.[1];

          return isValidTextTransform(rawValue, this.options.allowedValues) ? rawValue : undefined;
        },
        renderHTML: (attributes) => {
          if (!attributes.textTransform) return {};
          return {
            style: `text-transform: ${attributes.textTransform}`,
          };
        },
      },
    };
  },
  /********/
  parseHTML() {
    return [
      {
        tag: 'span[style]',
        getAttrs: (node) => {
          if (!isHTMLElement(node)) return null;

          const styleValue = node.style.textTransform;
          return isValidTextTransform(styleValue, this.options.allowedValues) ? {} : false;
        },
      },
    ];
  },
  /********/
  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
  /********/
  addCommands() {
    return {
      /**
       * ➤ Set the text transform
       */
      setTextTransform:
        (value) =>
        ({ commands }) => {
          if (!isValidTextTransform(value, this.options.allowedValues)) return false;

          return commands.setMark(this.name, { textTransform: value });
        },
      /**
       * ➤ Unset the text transform
       */
      unsetTextTransform:
        () =>
        ({ commands }) =>
          commands.unsetMark(this.name),
      /**
       * ➤ Toggle the text transform
       */
      toggleTextTransform:
        (value) =>
        ({ editor, commands }) => {
          if (!isValidTextTransform(value, this.options.allowedValues)) return false;

          const isActive = editor.isActive(this.name, { textTransform: value });
          return isActive ? commands.unsetTextTransform() : commands.setTextTransform(value);
        },
    };
  },
});
