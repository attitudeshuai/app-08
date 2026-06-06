import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const existingAdmin = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (existingAdmin) {
    console.log('Seed data already exists, skipping...');
    return;
  }

  const hashedPassword = await bcrypt.hash('123456', 10);

  const admin = await prisma.user.create({
    data: { username: 'admin', password: hashedPassword, role: 'ADMIN', name: '系统管理员' },
  });

  const teacher1 = await prisma.user.create({
    data: { username: 'teacher1', password: hashedPassword, role: 'TEACHER', name: '王老师' },
  });

  const teacher2 = await prisma.user.create({
    data: { username: 'teacher2', password: hashedPassword, role: 'TEACHER', name: '李老师' },
  });

  const student1 = await prisma.user.create({
    data: { username: 'student1', password: hashedPassword, role: 'STUDENT', name: '张三' },
  });

  const student2 = await prisma.user.create({
    data: { username: 'student2', password: hashedPassword, role: 'STUDENT', name: '李四' },
  });

  const student3 = await prisma.user.create({
    data: { username: 'student3', password: hashedPassword, role: 'STUDENT', name: '王五' },
  });

  const questions = await Promise.all([
    prisma.question.create({
      data: {
        type: 'SINGLE_CHOICE',
        content: '在TCP/IP协议栈中，HTTP协议属于哪一层？',
        options: ['网络层', '传输层', '应用层', '数据链路层'],
        answer: 'C',
        score: 2,
        analysis: 'HTTP协议是应用层协议，用于在Web浏览器和服务器之间传输超文本数据。',
        subject: '计算机科学',
        difficulty: 'EASY',
        createdBy: teacher1.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'SINGLE_CHOICE',
        content: '下列哪种排序算法的平均时间复杂度为O(n log n)？',
        options: ['冒泡排序', '快速排序', '插入排序', '选择排序'],
        answer: 'B',
        score: 2,
        analysis: '快速排序的平均时间复杂度为O(n log n)，是常见的基于比较的高效排序算法。',
        subject: '计算机科学',
        difficulty: 'MEDIUM',
        createdBy: teacher1.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'SINGLE_CHOICE',
        content: '在关系数据库中，用于唯一标识每条记录的是？',
        options: ['外键', '主键', '索引', '视图'],
        answer: 'B',
        score: 2,
        analysis: '主键（Primary Key）用于唯一标识关系数据库表中的每条记录。',
        subject: '计算机科学',
        difficulty: 'EASY',
        createdBy: teacher2.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'MULTIPLE_CHOICE',
        content: '以下哪些是面向对象编程的基本特征？',
        options: ['封装', '继承', '多态', '递归'],
        answer: 'A,B,C',
        score: 4,
        analysis: '面向对象编程的三大基本特征是封装、继承和多态。递归是一种编程技巧，不属于OOP基本特征。',
        subject: '计算机科学',
        difficulty: 'MEDIUM',
        createdBy: teacher1.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'MULTIPLE_CHOICE',
        content: '以下哪些属于Linux常用命令？',
        options: ['ls', 'grep', 'cd', 'paint'],
        answer: 'A,B,C',
        score: 4,
        analysis: 'ls、grep、cd都是Linux常用命令，paint是Windows程序。',
        subject: '计算机科学',
        difficulty: 'EASY',
        createdBy: teacher2.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'MULTIPLE_CHOICE',
        content: '关于二叉树，以下说法正确的是？',
        options: ['每个节点最多有两个子节点', '二叉搜索树的中序遍历是有序的', '满二叉树一定是完全二叉树', '二叉树至少有一个节点'],
        answer: 'A,B,C',
        score: 4,
        analysis: 'A、B、C都是正确的。二叉树可以为空（没有节点），所以D不正确。',
        subject: '计算机科学',
        difficulty: 'HARD',
        createdBy: teacher1.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'TRUE_FALSE',
        content: 'TCP协议是面向连接的可靠传输协议。',
        answer: '正确',
        score: 2,
        analysis: 'TCP（传输控制协议）是面向连接的、可靠的传输层协议，通过三次握手建立连接，保证数据可靠传输。',
        subject: '计算机科学',
        difficulty: 'EASY',
        createdBy: teacher1.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'TRUE_FALSE',
        content: 'Python是一种编译型语言。',
        answer: '错误',
        score: 2,
        analysis: 'Python是解释型语言，代码在运行时由解释器逐行解释执行，而不是预先编译成机器码。',
        subject: '计算机科学',
        difficulty: 'EASY',
        createdBy: teacher2.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'FILL_BLANK',
        content: '在计算机中，1KB等于____字节。',
        answer: '1024',
        score: 2,
        analysis: '1KB（千字节）= 1024字节，这是计算机存储的基本单位换算。',
        subject: '计算机科学',
        difficulty: 'EASY',
        createdBy: teacher1.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'FILL_BLANK',
        content: 'HTTP状态码____表示"未找到资源"。',
        answer: '404',
        score: 2,
        analysis: 'HTTP 404状态码表示服务器无法找到请求的资源，是最常见的HTTP错误状态码之一。',
        subject: '计算机科学',
        difficulty: 'EASY',
        createdBy: teacher2.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'FILL_BLANK',
        content: '在SQL中，使用____语句从表中查询数据。',
        answer: 'SELECT',
        score: 2,
        analysis: 'SELECT是SQL中最常用的查询语句，用于从一个或多个表中检索数据。',
        subject: '计算机科学',
        difficulty: 'EASY',
        createdBy: teacher1.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'SHORT_ANSWER',
        content: '请简述什么是死锁，以及死锁产生的四个必要条件。',
        answer: '死锁是指两个或多个进程在执行过程中，因争夺资源而造成的一种互相等待的现象。死锁产生的四个必要条件是：1.互斥条件 2.请求和保持条件 3.不剥夺条件 4.环路等待条件。',
        score: 6,
        analysis: '理解死锁的四个必要条件是操作系统课程的核心知识点，也是预防死锁的理论基础。',
        subject: '计算机科学',
        difficulty: 'HARD',
        createdBy: teacher1.id,
      },
    }),
    prisma.question.create({
      data: {
        type: 'SHORT_ANSWER',
        content: '请简述进程和线程的区别。',
        answer: '进程是资源分配的基本单位，线程是CPU调度的基本单位。进程拥有独立的地址空间，线程共享进程的地址空间。进程间通信需要IPC机制，线程间可以直接访问共享数据。进程创建和切换开销大，线程创建和切换开销小。',
        score: 6,
        analysis: '进程和线程的区别是操作系统的重要概念，理解它们的区别对于并发编程至关重要。',
        subject: '计算机科学',
        difficulty: 'MEDIUM',
        createdBy: teacher2.id,
      },
    }),
  ]);

  const paper1 = await prisma.paper.create({
    data: {
      title: '计算机科学基础测试卷',
      description: '涵盖计算机网络、数据结构、操作系统等基础知识',
      totalScore: 36,
      duration: 60,
      createdBy: teacher1.id,
      items: {
        create: [
          { questionId: questions[0].id, sortOrder: 1, score: 2 },
          { questionId: questions[1].id, sortOrder: 2, score: 2 },
          { questionId: questions[2].id, sortOrder: 3, score: 2 },
          { questionId: questions[3].id, sortOrder: 4, score: 4 },
          { questionId: questions[4].id, sortOrder: 5, score: 4 },
          { questionId: questions[6].id, sortOrder: 6, score: 2 },
          { questionId: questions[7].id, sortOrder: 7, score: 2 },
          { questionId: questions[8].id, sortOrder: 8, score: 2 },
          { questionId: questions[9].id, sortOrder: 9, score: 2 },
          { questionId: questions[11].id, sortOrder: 10, score: 6 },
          { questionId: questions[12].id, sortOrder: 11, score: 6 },
          { questionId: questions[5].id, sortOrder: 12, score: 2 },
        ],
      },
    },
  });

  const paper2 = await prisma.paper.create({
    data: {
      title: '数据库与SQL专项测验',
      description: '重点考察数据库基础知识和SQL语句掌握情况',
      totalScore: 14,
      duration: 30,
      createdBy: teacher2.id,
      items: {
        create: [
          { questionId: questions[2].id, sortOrder: 1, score: 2 },
          { questionId: questions[10].id, sortOrder: 2, score: 2 },
          { questionId: questions[4].id, sortOrder: 3, score: 4 },
          { questionId: questions[9].id, sortOrder: 4, score: 2 },
          { questionId: questions[8].id, sortOrder: 5, score: 2 },
          { questionId: questions[7].id, sortOrder: 6, score: 2 },
        ],
      },
    },
  });

  const now = new Date();
  const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

  await prisma.exam.create({
    data: {
      title: '2024年秋季计算机基础期末考试',
      startTime,
      endTime,
      status: 'PUBLISHED',
      paperId: paper1.id,
      createdBy: teacher1.id,
    },
  });

  console.log('Seed data created successfully!');
  console.log(`- Admin: admin / 123456`);
  console.log(`- Teachers: teacher1 / 123456, teacher2 / 123456`);
  console.log(`- Students: student1 / 123456, student2 / 123456, student3 / 123456`);
  console.log(`- ${questions.length} questions created`);
  console.log(`- 2 papers created`);
  console.log(`- 1 exam created`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
