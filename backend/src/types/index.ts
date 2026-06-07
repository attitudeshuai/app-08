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

export type NotificationType =
  | 'SYSTEM'
  | 'EXAM_REMINDER_24H'
  | 'EXAM_REMINDER_1H'
  | 'EXAM_REMINDER_15M'
  | 'EXAM_START'
  | 'EXAM_RESULT';

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

export interface ImportErrorItem {
  rowIndex: number;
  rowData: Record<string, unknown>;
  errors: string[];
}

export interface QuestionImportResult {
  successCount: number;
  failCount: number;
  totalCount: number;
  successItems: {
    id: number;
    type: string;
    content: string;
    subject: string;
  }[];
  errorItems: ImportErrorItem[];
}

export interface RawQuestionData {
  type?: string;
  content?: string;
  options?: string;
  answer?: string;
  score?: string | number;
  analysis?: string;
  subject?: string;
  difficulty?: string;
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

export interface ExamReservation {
  id: number;
  examId: number;
  userId: number;
  createdAt: Date;
  updatedAt: Date;
  exam?: {
    id: number;
    title: string;
    startTime: Date;
    endTime: Date;
    status: string;
    paper?: {
      id: number;
      title: string;
      duration: number;
      totalScore: number;
    };
  };
}

export interface Notification {
  id: number;
  title: string;
  content: string;
  type: string;
  isRead: boolean;
  relatedId: number | null;
  createdAt: Date;
  userId: number;
}

export interface ExamWithReservation {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  status: string;
  autoSubmit: boolean;
  paperId: number;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
  reservationCount?: number;
  isReserved?: boolean;
}

export interface QuestionHistoryItem {
  id: number;
  questionId: number;
  type: string;
  content: string;
  options?: unknown;
  answer: string;
  score: number;
  analysis?: string | null;
  subject: string;
  difficulty: string;
  version: number;
  remark?: string | null;
  createdAt: Date;
  modifiedBy: number;
  modifier?: {
    id: number;
    name: string;
  };
}

export interface QuestionDiff {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface QuestionHistoryDetail extends QuestionHistoryItem {
  diff?: QuestionDiff[];
}

export interface LearningOverview {
  overview: LearningOverviewStats;
  recentStats: RecentLearningStats;
  scoreTrend: ScoreTrendItem[];
  subjectStats: SubjectLearningStat[];
  wrongQuestionStats: WrongQuestionStat;
  activityCalendar: ActivityCalendarItem[];
}

export interface LearningOverviewStats {
  totalExamsTaken: number;
  totalQuestionsAnswered: number;
  totalWrongQuestions: number;
  totalStudyTime: number;
  avgScore: number;
  accuracyRate: number;
  passRate: number;
}

export interface RecentLearningStats {
  days: number;
  examsTaken: number;
  questionsAnswered: number;
  studyTime: number;
  avgScore: number;
  wrongQuestions: number;
}

export interface ScoreTrendItem {
  examId: number;
  examTitle: string;
  score: number;
  totalScore: number;
  scoreRate: number;
  submitTime: Date;
}

export interface SubjectLearningStat {
  subject: string;
  examsTaken: number;
  questionsAnswered: number;
  wrongQuestionCount: number;
  avgScore: number;
  accuracyRate: number;
}

export interface WrongQuestionStat {
  totalCount: number;
  bySubject: { subject: string; count: number }[];
  byDifficulty: { difficulty: string; count: number }[];
}

export interface ActivityCalendarItem {
  date: string;
  hasActivity: boolean;
  examCount: number;
  questionCount: number;
  studyTime: number;
}

export interface QuestionTag {
  id: number;
  name: string;
  color: string | null;
  createdAt: Date;
  updatedAt?: Date;
  count?: number;
}

export interface FavoriteQuestionItem {
  id: number;
  createdAt: Date;
  question: {
    id: number;
    type: string;
    content: string;
    options?: unknown;
    score: number;
    analysis?: string | null;
    subject: string;
    difficulty: string;
  };
  tags: QuestionTag[];
}

export interface FavoriteStatus {
  isFavorited: boolean;
  tags?: QuestionTag[];
}

export interface FavoriteSubjectItem {
  subject: string;
  count: number;
}
