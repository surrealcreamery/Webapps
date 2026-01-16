/**
 * Bind multiple event listeners to a target.
 * https://github.com/alexreardon/bind-event-listener/tree/master
 */

// ----------------------------------------------------------------------

function toOptions(value) {
  if (typeof value === 'undefined') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return {
      capture: value,
    };
  }

  return value;
}

function getBinding(original, sharedOptions) {
  if (sharedOptions == null) {
    return original;
  }

  const binding = {
    ...original,
    options: {
      ...toOptions(sharedOptions),
      ...toOptions(original.options),
    },
  };
  return binding;
}

/**
 * Binds a single event listener to a target and returns an unbind function
 */
export function bind(target, { type, listener, options }) {
  target.addEventListener(type, listener, options);

  return function unbind() {
    target.removeEventListener(type, listener, options);
  };
}

/**
 * Binds multiple event listeners to a target and returns a function to unbind them all
 */
export function bindAll(target, bindings, sharedOptions) {
  const unbinds = bindings.map((original) => {
    const binding = getBinding(original, sharedOptions);
    return bind(target, binding);
  });

  return function unbindAll() {
    unbinds.forEach((unbind) => unbind());
  };
}
