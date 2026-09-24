export type TodoStatus = 'pending' | 'in_progress' | 'completed';

export interface Todo {
  id: string;
  title: string;
  status: TodoStatus;
  userId: string;
  stepsGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActionStep {
  id: string;
  todoId: string;
  title: string;
  description: string;
  order: number;
  isCompleted: boolean;
  createdAt: string;
}

export interface TodoWithSteps extends Todo {
  steps: ActionStep[];
}

export interface CreateTodoInput {
  title: string;
  userId: string;
}

export interface UpdateTodoInput {
  title?: string;
  status?: TodoStatus;
  stepsGenerated?: boolean;
}

export interface CreateActionStepInput {
  id?: string;
  todoId: string;
  title: string;
  description: string;
  order: number;
}

export interface UpdateActionStepInput {
  isCompleted: boolean;
}
