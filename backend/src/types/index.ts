export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

export interface PaginatedResponse<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface JwtPayload {
  id: number;
  username: string;
  role: UserRole;
}

export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT';

export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

export type ExamStatus = 'DRAFT' | 'PUBLISHED' | 'ENDED';

export type ExamRecordStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'GRADED';

export interface PaginationQuery {
  page: number;
  pageSize: number;
}

export interface UserResponse {
  id: number;
  username: string;
  role: string;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface LoginResponse {
  token: string;
  user: UserResponse;
}
