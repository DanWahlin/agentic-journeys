import type { ActionStep, Todo } from '../models/index.js';

export interface SeedData {
  todos: Todo[];
  actionSteps: ActionStep[];
}

export function getSeedData(): SeedData {
  const createdAt = '2026-01-01T00:00:00.000Z';
  const todos: Todo[] = [
    { id: 'todo-1', title: 'Prepare conference talk', status: 'pending', userId: 'user-1', stepsGenerated: false, createdAt, updatedAt: createdAt },
    { id: 'todo-2', title: 'Set up home office', status: 'in_progress', userId: 'user-1', stepsGenerated: true, createdAt, updatedAt: createdAt },
    { id: 'todo-3', title: 'Plan weekend hiking trip', status: 'completed', userId: 'user-1', stepsGenerated: true, createdAt, updatedAt: createdAt },
  ];
  const step = (
    id: string,
    todoId: string,
    title: string,
    description: string,
    order: number,
    isCompleted: boolean,
  ): ActionStep => ({ id, todoId, title, description, order, isCompleted, createdAt });
  const actionSteps = [
    step('step-2-1', 'todo-2', 'Choose a desk and chair', 'Compare ergonomic options and select a desk and chair.', 1, true),
    step('step-2-2', 'todo-2', 'Set up monitor and peripherals', 'Connect the monitor, keyboard, mouse, and other peripherals.', 2, true),
    step('step-2-3', 'todo-2', 'Organize cable management', 'Route and secure power and data cables.', 3, false),
    step('step-2-4', 'todo-2', 'Set up lighting', 'Position task lighting to reduce glare.', 4, false),
    step('step-3-1', 'todo-3', 'Pick a trail', 'Choose a trail suitable for the group.', 1, true),
    step('step-3-2', 'todo-3', 'Check weather forecast', 'Review the forecast and trail conditions.', 2, true),
    step('step-3-3', 'todo-3', 'Pack gear and supplies', 'Pack water, food, navigation, and safety gear.', 3, true),
  ];
  return {
    todos: todos.map((todo) => ({ ...todo })),
    actionSteps: actionSteps.map((actionStep) => ({ ...actionStep })),
  };
}
