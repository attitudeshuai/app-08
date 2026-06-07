import prisma from '../lib/prisma';

const REMINDER_INTERVAL = 60 * 1000;
let reminderTimer: NodeJS.Timeout | null = null;

interface ReminderConfig {
  type: string;
  minutesBefore: number;
  title: string;
  contentTemplate: (examTitle: string, timeStr: string) => string;
}

const reminderConfigs: ReminderConfig[] = [
  {
    type: 'EXAM_REMINDER_24H',
    minutesBefore: 24 * 60,
    title: '考试即将开始（24小时提醒）',
    contentTemplate: (title, timeStr) => `您预约的考试「${title}」将于 ${timeStr} 开始，请提前做好准备。`,
  },
  {
    type: 'EXAM_REMINDER_1H',
    minutesBefore: 60,
    title: '考试即将开始（1小时提醒）',
    contentTemplate: (title, timeStr) => `您预约的考试「${title}」将于 ${timeStr} 开始，请提前进入考试页面准备。`,
  },
  {
    type: 'EXAM_REMINDER_15M',
    minutesBefore: 15,
    title: '考试马上开始（15分钟提醒）',
    contentTemplate: (title, timeStr) => `您预约的考试「${title}」将于 ${timeStr} 开始，请马上进入考试页面等候。`,
  },
];

function formatTime(date: Date): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function processExamReminders(): Promise<{
  processed: number;
  failed: number;
}> {
  const now = new Date();
  let processed = 0;
  let failed = 0;

  const exams = await prisma.exam.findMany({
    where: {
      status: 'PUBLISHED',
      startTime: { gt: now },
    },
    orderBy: { startTime: 'asc' },
  });

  for (const exam of exams) {
    const startTime = new Date(exam.startTime);
    const timeUntilStart = startTime.getTime() - now.getTime();
    const minutesUntilStart = timeUntilStart / (1000 * 60);

    for (const config of reminderConfigs) {
      if (minutesUntilStart <= config.minutesBefore && minutesUntilStart > config.minutesBefore - 5) {
        try {
          const reservations = await prisma.examReservation.findMany({
            where: { examId: exam.id },
            select: { userId: true },
          });

          const userIds = reservations.map((r) => r.userId);

          for (const userId of userIds) {
            try {
              const existing = await prisma.notification.findFirst({
                where: {
                  userId,
                  relatedId: exam.id,
                  type: config.type,
                },
              });

              if (!existing) {
                const timeStr = formatTime(startTime);
                await prisma.notification.create({
                  data: {
                    userId,
                    title: config.title,
                    content: config.contentTemplate(exam.title, timeStr),
                    type: config.type,
                    relatedId: exam.id,
                    isRead: false,
                  },
                });
                processed++;
              }
            } catch (err) {
              console.error(`Failed to create reminder for user ${userId}, exam ${exam.id}:`, err);
              failed++;
            }
          }
        } catch (err) {
          console.error(`Failed to process reminders for exam ${exam.id}:`, err);
          failed++;
        }
      }
    }
  }

  if (processed > 0) {
    console.log(`[ExamReminder] Sent ${processed} reminders, ${failed} failed`);
  }

  return { processed, failed };
}

export function startExamReminderService(): void {
  if (reminderTimer) {
    return;
  }

  console.log('[ExamReminder] Service started (interval: 60s)');
  reminderTimer = setInterval(() => {
    processExamReminders().catch((err) => {
      console.error('[ExamReminder] Error in reminder process:', err);
    });
  }, REMINDER_INTERVAL);
}

export function stopExamReminderService(): void {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
    console.log('[ExamReminder] Service stopped');
  }
}

export async function sendReservationSuccessNotification(
  userId: number,
  exam: any
): Promise<void> {
  const timeStr = formatTime(new Date(exam.startTime));
  await prisma.notification.create({
    data: {
      userId,
      title: '考试预约成功',
      content: `您已成功预约考试「${exam.title}」，考试时间：${timeStr}。我们会在考试开始前提醒您。`,
      type: 'SYSTEM',
      relatedId: exam.id,
      isRead: false,
    },
  });
}

export async function sendReservationCancelNotification(
  userId: number,
  exam: any
): Promise<void> {
  const timeStr = formatTime(new Date(exam.startTime));
  await prisma.notification.create({
    data: {
      userId,
      title: '考试预约已取消',
      content: `您已取消预约考试「${exam.title}」，原考试时间：${timeStr}。`,
      type: 'SYSTEM',
      relatedId: exam.id,
      isRead: false,
    },
  });
}
