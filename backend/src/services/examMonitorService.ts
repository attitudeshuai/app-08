import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import {
  MonitorLogType,
  ExamMonitorDetail,
  ExamAbnormalDetail,
  ExamMonitorStats,
  ExamAbnormalSummary,
  ExamMonitorConfig,
} from '../types';

interface RecordMonitorLogOptions {
  examId: number;
  userId: number;
  examRecordId: number;
  type: MonitorLogType;
  description?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  extraData?: Record<string, unknown>;
}

export async function recordMonitorLog(options: RecordMonitorLogOptions) {
  const { examId, userId, examRecordId, type, description, ipAddress, userAgent, extraData } = options;

  const log = await prisma.examMonitorLog.create({
    data: {
      examId,
      userId,
      examRecordId,
      type,
      description: description || null,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      extraData: extraData ? (extraData as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  return log;
}

export async function recordTabSwitch(
  examId: number,
  userId: number,
  ipAddress?: string | null,
  userAgent?: string | null
) {
  const examRecord = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
  });

  if (!examRecord) {
    throw new Error('考试记录不存在');
  }

  if (examRecord.status !== 'IN_PROGRESS') {
    throw new Error('考试未进行中');
  }

  const updatedRecord = await prisma.examRecord.update({
    where: { id: examRecord.id },
    data: { tabSwitchCount: { increment: 1 } },
  });

  await recordMonitorLog({
    examId,
    userId,
    examRecordId: examRecord.id,
    type: 'TAB_SWITCH',
    description: '学生切屏',
    ipAddress,
    userAgent,
    extraData: { tabSwitchCount: updatedRecord.tabSwitchCount },
  });

  await checkAndUpdateSuspiciousStatus(examId, userId);

  return {
    tabSwitchCount: updatedRecord.tabSwitchCount,
  };
}

export async function checkIpChange(
  examId: number,
  userId: number,
  currentIp: string | null
): Promise<{ changed: boolean; ipChangeCount: number }> {
  if (!currentIp) {
    return { changed: false, ipChangeCount: 0 };
  }

  const examRecord = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
    include: {
      sessions: {
        orderBy: { enterTime: 'desc' },
        take: 2,
        select: { ipAddress: true },
      },
    },
  });

  if (!examRecord) {
    return { changed: false, ipChangeCount: 0 };
  }

  const previousIps = examRecord.sessions
    .map((s) => s.ipAddress)
    .filter((ip): ip is string => ip !== null && ip !== undefined);

  const uniqueIps = new Set(previousIps);
  if (currentIp) {
    uniqueIps.add(currentIp);
  }

  const ipChangeCount = uniqueIps.size - 1;

  const lastIp = previousIps[0] || null;
  const changed = lastIp !== null && currentIp !== lastIp;

  if (changed || ipChangeCount !== examRecord.ipChangeCount) {
    await prisma.examRecord.update({
      where: { id: examRecord.id },
      data: { ipChangeCount },
    });

    if (changed) {
      await recordMonitorLog({
        examId,
        userId,
        examRecordId: examRecord.id,
        type: 'IP_CHANGE',
        description: `IP地址从 ${lastIp} 变为 ${currentIp}`,
        ipAddress: currentIp,
        extraData: { oldIp: lastIp, newIp: currentIp, ipChangeCount },
      });
    }
  }

  return { changed, ipChangeCount };
}

export async function checkAndUpdateSuspiciousStatus(
  examId: number,
  userId: number
): Promise<{ isSuspicious: boolean; reasons: string[] }> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      monitorEnabled: true,
      maxTabSwitchCount: true,
      maxIpChangeCount: true,
    },
  });

  const examRecord = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
  });

  if (!exam || !examRecord) {
    return { isSuspicious: false, reasons: [] };
  }

  if (!exam.monitorEnabled) {
    return { isSuspicious: false, reasons: [] };
  }

  const reasons: string[] = [];

  if (examRecord.tabSwitchCount > exam.maxTabSwitchCount) {
    reasons.push(
      `切屏次数${examRecord.tabSwitchCount}次，超过阈值${exam.maxTabSwitchCount}次`
    );
  }

  if (examRecord.ipChangeCount > exam.maxIpChangeCount) {
    reasons.push(
      `IP地址变化${examRecord.ipChangeCount}次，超过阈值${exam.maxIpChangeCount}次`
    );
  }

  const isSuspicious = reasons.length > 0;

  await prisma.examRecord.update({
    where: { id: examRecord.id },
    data: {
      isSuspicious,
      suspiciousReasons: reasons.length > 0 ? (reasons as Prisma.InputJsonValue) : Prisma.JsonNull,
    },
  });

  return { isSuspicious, reasons };
}

export function getExamMonitorConfig(exam: any): ExamMonitorConfig {
  return {
    monitorEnabled: exam.monitorEnabled ?? true,
    maxTabSwitchCount: exam.maxTabSwitchCount ?? 10,
    maxIpChangeCount: exam.maxIpChangeCount ?? 3,
  };
}

export function calculateAbnormalDetails(
  record: any,
  examConfig: ExamMonitorConfig,
  examDurationMinutes: number
): ExamAbnormalDetail[] {
  const details: ExamAbnormalDetail[] = [];

  details.push({
    type: 'TAB_SWITCH',
    count: record.tabSwitchCount || 0,
    threshold: examConfig.maxTabSwitchCount,
    exceeded: (record.tabSwitchCount || 0) > examConfig.maxTabSwitchCount,
    description: '切屏次数',
  });

  details.push({
    type: 'IP_CHANGE',
    count: record.ipChangeCount || 0,
    threshold: examConfig.maxIpChangeCount,
    exceeded: (record.ipChangeCount || 0) > examConfig.maxIpChangeCount,
    description: 'IP地址变化次数',
  });

  details.push({
    type: 'ENTER_COUNT',
    count: record.enterCount || 0,
    threshold: 3,
    exceeded: (record.enterCount || 0) > 3,
    description: '进入考试次数',
  });

  const examDurationSeconds = examDurationMinutes * 60;
  if (record.totalActiveTime && record.totalActiveTime > 0) {
    const activeTimeExceeded = record.totalActiveTime > examDurationSeconds * 1.2;
    details.push({
      type: 'ACTIVE_TIME',
      count: record.totalActiveTime,
      threshold: Math.floor(examDurationSeconds * 1.2),
      exceeded: activeTimeExceeded,
      description: '累计答题时长（秒）',
    });
  }

  return details;
}

export function extractIpAddresses(sessions: any[]): string[] {
  const ips = new Set<string>();
  sessions.forEach((session) => {
    if (session.ipAddress) {
      ips.add(session.ipAddress);
    }
  });
  return Array.from(ips);
}

export async function getExamMonitorDetail(
  examId: number,
  userId: number
): Promise<ExamMonitorDetail | null> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { paper: { select: { duration: true } } },
  });

  if (!exam) {
    return null;
  }

  const record = await prisma.examRecord.findUnique({
    where: { examId_userId: { examId, userId } },
    include: {
      user: { select: { id: true, username: true, name: true } },
      sessions: {
        orderBy: { enterTime: 'asc' },
        select: {
          id: true,
          enterTime: true,
          exitTime: true,
          ipAddress: true,
        },
      },
    },
  });

  if (!record) {
    return null;
  }

  const examConfig = getExamMonitorConfig(exam);
  const examDuration = exam.paper?.duration || 0;

  const sessionsWithDuration = record.sessions.map((session: any) => {
    const endTime = session.exitTime ? new Date(session.exitTime) : new Date();
    const duration = Math.floor(
      (endTime.getTime() - new Date(session.enterTime).getTime()) / 1000
    );
    return {
      id: session.id,
      enterTime: session.enterTime,
      exitTime: session.exitTime,
      ipAddress: session.ipAddress,
      duration,
    };
  });

  const { isAbnormal, reasons } = calculateAbnormalStatusLegacy(record, examDuration);
  const abnormalDetails = calculateAbnormalDetails(record, examConfig, examDuration);
  const ipAddresses = extractIpAddresses(record.sessions);

  const suspiciousReasons: string[] = [];
  if (record.isSuspicious && record.suspiciousReasons) {
    const reasonsArr = record.suspiciousReasons as unknown;
    if (Array.isArray(reasonsArr)) {
      suspiciousReasons.push(...(reasonsArr as string[]));
    }
  }

  return {
    id: record.id,
    userId: record.userId,
    username: record.user.username,
    name: record.user.name,
    status: record.status,
    startTime: record.startTime,
    submitTime: record.submitTime,
    enterCount: record.enterCount || 0,
    totalActiveTime: record.totalActiveTime || 0,
    totalActiveTimeFormatted: formatDuration(record.totalActiveTime || 0),
    examDuration,
    isAbnormal,
    abnormalReasons: reasons,
    sessions: sessionsWithDuration,
    tabSwitchCount: record.tabSwitchCount || 0,
    ipChangeCount: record.ipChangeCount || 0,
    isSuspicious: record.isSuspicious || false,
    suspiciousReasons,
    ipAddresses,
    abnormalDetails,
  };
}

export async function getExamMonitorList(examId: number): Promise<{
  exam: any;
  stats: ExamMonitorStats;
  list: ExamMonitorDetail[];
}> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: { paper: { select: { id: true, title: true, duration: true, totalScore: true } } },
  });

  if (!exam) {
    throw new Error('考试不存在');
  }

  const examConfig = getExamMonitorConfig(exam);
  const examDuration = exam.paper?.duration || 0;

  const records = await prisma.examRecord.findMany({
    where: { examId },
    include: {
      user: { select: { id: true, username: true, name: true } },
      sessions: {
        orderBy: { enterTime: 'asc' },
        select: {
          id: true,
          enterTime: true,
          exitTime: true,
          ipAddress: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });

  const monitorList: ExamMonitorDetail[] = records.map((record: any) => {
    const sessionsWithDuration = record.sessions.map((session: any) => {
      const endTime = session.exitTime ? new Date(session.exitTime) : new Date();
      const duration = Math.floor(
        (endTime.getTime() - new Date(session.enterTime).getTime()) / 1000
      );
      return {
        id: session.id,
        enterTime: session.enterTime,
        exitTime: session.exitTime,
        ipAddress: session.ipAddress,
        duration,
      };
    });

    const { isAbnormal, reasons } = calculateAbnormalStatusLegacy(record, examDuration);
    const abnormalDetails = calculateAbnormalDetails(record, examConfig, examDuration);
    const ipAddresses = extractIpAddresses(record.sessions);

    const suspiciousReasons: string[] = [];
    if (record.isSuspicious && record.suspiciousReasons) {
      const reasonsArr = record.suspiciousReasons as unknown;
      if (Array.isArray(reasonsArr)) {
        suspiciousReasons.push(...(reasonsArr as string[]));
      }
    }

    return {
      id: record.id,
      userId: record.userId,
      username: record.user.username,
      name: record.user.name,
      status: record.status,
      startTime: record.startTime,
      submitTime: record.submitTime,
      enterCount: record.enterCount || 0,
      totalActiveTime: record.totalActiveTime || 0,
      totalActiveTimeFormatted: formatDuration(record.totalActiveTime || 0),
      examDuration,
      isAbnormal,
      abnormalReasons: reasons,
      sessions: sessionsWithDuration,
      tabSwitchCount: record.tabSwitchCount || 0,
      ipChangeCount: record.ipChangeCount || 0,
      isSuspicious: record.isSuspicious || false,
      suspiciousReasons,
      ipAddresses,
      abnormalDetails,
    };
  });

  const stats = calculateMonitorStats(monitorList);

  return {
    exam: {
      id: exam.id,
      title: exam.title,
      startTime: exam.startTime,
      endTime: exam.endTime,
      status: exam.status,
      paper: exam.paper,
      monitorConfig: examConfig,
    },
    stats,
    list: monitorList,
  };
}

export function calculateMonitorStats(monitorList: ExamMonitorDetail[]): ExamMonitorStats {
  const totalStudents = monitorList.length;
  const inProgressCount = monitorList.filter((m) => m.status === 'IN_PROGRESS').length;
  const submittedCount = monitorList.filter(
    (m) => m.status === 'SUBMITTED' || m.status === 'GRADED'
  ).length;
  const notStartedCount = monitorList.filter((m) => m.status === 'NOT_STARTED').length;
  const suspiciousCount = monitorList.filter((m) => m.isSuspicious).length;
  const abnormalCount = monitorList.filter((m) => m.isAbnormal).length;
  const totalTabSwitches = monitorList.reduce((sum, m) => sum + m.tabSwitchCount, 0);
  const totalIpChanges = monitorList.reduce((sum, m) => sum + m.ipChangeCount, 0);

  return {
    totalStudents,
    inProgressCount,
    submittedCount,
    notStartedCount,
    suspiciousCount,
    abnormalCount,
    totalTabSwitches,
    totalIpChanges,
  };
}

export async function getExamAbnormalSummary(examId: number): Promise<ExamAbnormalSummary> {
  const { exam, stats, list } = await getExamMonitorList(examId);

  const sortedByAbnormal = [...list].sort((a, b) => {
    const aScore = a.tabSwitchCount + a.ipChangeCount * 3 + a.enterCount;
    const bScore = b.tabSwitchCount + b.ipChangeCount * 3 + b.enterCount;
    return bScore - aScore;
  });

  const topAbnormalStudents = sortedByAbnormal.slice(0, 10);
  const suspiciousStudents = list.filter((m) => m.isSuspicious);

  const recentLogs = await prisma.examMonitorLog.findMany({
    where: { examId },
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      user: { select: { id: true, username: true, name: true } },
    },
  });

  return {
    exam,
    stats,
    topAbnormalStudents,
    suspiciousStudents,
    recentLogs: recentLogs.map((log: any) => ({
      id: log.id,
      type: log.type as MonitorLogType,
      description: log.description,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      extraData: log.extraData,
      createdAt: log.createdAt,
      examId: log.examId,
      userId: log.userId,
      examRecordId: log.examRecordId,
      userName: log.user?.name,
      userUsername: log.user?.username,
    })),
  };
}

export async function getStudentMonitorLogs(
  examId: number,
  userId: number,
  options?: { type?: string; page?: number; pageSize?: number }
) {
  const { type, page = 1, pageSize = 20 } = options || {};
  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const where: any = { examId, userId };
  if (type) where.type = type;

  const [total, logs] = await Promise.all([
    prisma.examMonitorLog.count({ where }),
    prisma.examMonitorLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
  ]);

  return {
    list: logs as any[],
    total,
    page,
    pageSize,
  };
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}小时${minutes}分${secs}秒`;
  }
  if (minutes > 0) {
    return `${minutes}分${secs}秒`;
  }
  return `${secs}秒`;
}

function calculateAbnormalStatusLegacy(
  record: any,
  examDurationMinutes: number
): { isAbnormal: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const examDurationSeconds = examDurationMinutes * 60;

  if (record.enterCount && record.enterCount > 3) {
    reasons.push(`进入考试${record.enterCount}次，超过正常范围`);
  }

  if (record.totalActiveTime && record.totalActiveTime > 0) {
    if (record.totalActiveTime > examDurationSeconds * 1.2) {
      reasons.push('答题用时明显超过考试规定时长');
    }
    if (
      record.totalActiveTime < examDurationSeconds * 0.2 &&
      record.status === 'SUBMITTED'
    ) {
      reasons.push('答题用时明显过短，可能存在异常');
    }
  }

  if (record.status === 'IN_PROGRESS' && record.startTime) {
    const now = new Date();
    const elapsed = Math.floor(
      (now.getTime() - new Date(record.startTime).getTime()) / 1000
    );
    if (elapsed > examDurationSeconds * 1.5) {
      reasons.push('考试进行时间远超规定时长');
    }
  }

  return {
    isAbnormal: reasons.length > 0,
    reasons,
  };
}
