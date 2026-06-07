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

export type ExamSessionStatus = 'ACTIVE' | 'ENDED' | 'ABANDONED';

export interface RemainingTime {
  totalSeconds: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isWarning: boolean;
}

export interface ExamMonitorItem {
  id: number;
  userId: number;
  username: string;
  name: string;
  status: string;
  startTime: Date | null;
  submitTime: Date | null;
  enterCount: number;
  totalActiveTime: number;
  examDuration: number;
  isAbnormal: boolean;
  abnormalReasons: string[];
  sessions: ExamSessionItem[];
}

export interface ExamSessionItem {
  id: number;
  enterTime: Date;
  exitTime: Date | null;
  ipAddress: string | null;
  duration: number;
}

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

export interface ScoreDistributionItem {
  range: string;
  min: number;
  max: number;
  count: number;
  percentage: number;
}

export interface QuestionStatItem {
  questionId: number;
  sortOrder: number;
  type: string;
  content: string;
  score: number;
  difficulty: string;
  subject: string;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  ungradedCount: number;
  accuracyRate: number;
  avgScore: number;
  scoreRate: number;
  isObjective: boolean;
}

export interface DimensionStatItem {
  name: string;
  questionCount: number;
  totalScore: number;
  correctCount: number;
  ungradedCount: number;
  accuracyRate: number;
  avgScore: number;
  scoreRate: number;
}

export interface ExamStatistics {
  exam: {
    id: number;
    title: string;
    startTime: Date;
    endTime: Date;
    status: string;
    paper: {
      id: number;
      title: string;
      totalScore: number;
      duration: number;
      totalQuestions: number;
    };
  };
  overview: {
    totalStudents: number;
    submittedCount: number;
    submittedRate: number;
    avgScore: number;
    highestScore: number;
    lowestScore: number;
    medianScore: number;
    passRate: number;
    passScore: number;
    standardDeviation: number;
  };
  scoreDistribution: ScoreDistributionItem[];
  questionStats: QuestionStatItem[];
  typeStats: DimensionStatItem[];
  difficultyStats: DimensionStatItem[];
  subjectStats: DimensionStatItem[];
}
