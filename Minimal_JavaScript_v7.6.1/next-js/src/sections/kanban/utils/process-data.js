// ----------------------------------------------------------------------

export const TASK_KEY = Symbol('task');
export const TASK_DROP_TARGET_KEY = Symbol('task-drop-target');
export const COLUMN_KEY = Symbol('column');

// Task data
export function getTaskData(data) {
  return { [TASK_KEY]: true, ...data };
}

export function isTaskData(value) {
  return Boolean(value[TASK_KEY]);
}

// Drop target data for tasks
export function getTaskDropTargetData(data) {
  return { [TASK_DROP_TARGET_KEY]: true, ...data };
}

export function isTaskDropTargetData(value) {
  return Boolean(value[TASK_DROP_TARGET_KEY]);
}

// Column data
export function getColumnData(data) {
  return { [COLUMN_KEY]: true, ...data };
}

export function isColumnData(value) {
  return Boolean(value[COLUMN_KEY]);
}
