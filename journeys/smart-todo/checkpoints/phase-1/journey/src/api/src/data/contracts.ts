import type {
  ActionStep,
  CreateActionStepInput,
  CreateTodoInput,
  Todo,
  UpdateActionStepInput,
  UpdateTodoInput,
} from '../models/index.js';

export interface TodoRepository {
  getAll(userId: string): Promise<Todo[]>;
  getById(id: string): Promise<Todo | null>;
  create(input: CreateTodoInput): Promise<Todo>;
  update(id: string, updates: UpdateTodoInput): Promise<Todo>;
  delete(id: string): Promise<void>;
}

export interface ActionStepRepository {
  getByTodoId(todoId: string): Promise<ActionStep[]>;
  getByTodoIds(todoIds: string[]): Promise<ActionStep[]>;
  create(step: CreateActionStepInput): Promise<ActionStep>;
  update(id: string, updates: UpdateActionStepInput): Promise<ActionStep>;
  deleteByTodoId(todoId: string): Promise<void>;
}

export interface DataStore {
  todos: TodoRepository;
  actionSteps: ActionStepRepository;
  initialize(): Promise<void>;
  close?(): Promise<void>;
}
