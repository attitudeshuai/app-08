const http = require('http');

const BASE_URL = 'http://localhost:3008';
let adminToken = '';
let teacherToken = '';
let studentToken = '';
const results = [];

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = 'Bearer ' + token;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    if (body) {
      req.write(JSON.stringify(body));
    }

    req.end();
  });
}

function test(name, method, path, body = null, token = null, expectedCode = 0, expectedStatus = 200) {
  return request(method, path, body, token)
    .then((res) => {
      const passed = res.statusCode === expectedStatus && res.body.code === expectedCode;
      results.push({
        name,
        method,
        path,
        statusCode: res.statusCode,
        code: res.body.code,
        message: res.body.message,
        passed,
      });
      const status = passed ? 'PASS' : 'FAIL';
      const color = passed ? '\x1b[32m' : '\x1b[31m';
      console.log(`${color}[${status}]\x1b[0m ${name} (${method} ${path})`);
      if (!passed) {
        console.log(`  Expected: HTTP ${expectedStatus}, code ${expectedCode}`);
        console.log(`  Got: HTTP ${res.statusCode}, code ${res.body.code} - ${res.body.message}`);
      }
      return res.body;
    })
    .catch((err) => {
      results.push({
        name,
        method,
        path,
        statusCode: 0,
        code: -999,
        message: err.message,
        passed: false,
      });
      console.log(`\x1b[31m[FAIL]\x1b[0m ${name} (${method} ${path})`);
      console.log(`  Error: ${err.message}`);
      return null;
    });
}

async function runTests() {
  console.log('\x1b[36m========================================\x1b[0m');
  console.log('\x1b[36m  在线考试系统 API 测试\x1b[0m');
  console.log('\x1b[36m========================================\x1b[0m');
  console.log(`Base URL: ${BASE_URL}\n`);

  // 1. Health check
  console.log('\x1b[36m--- 1. 健康检查 ---\x1b[0m');
  await test('健康检查', 'GET', '/api/health');

  // 2. Auth
  console.log('\n\x1b[36m--- 2. 认证模块 ---\x1b[0m');
  
  const adminLogin = await test(
    '管理员登录',
    'POST',
    '/api/auth/login',
    { username: 'admin', password: '123456' }
  );
  if (adminLogin && adminLogin.data && adminLogin.data.token) {
    adminToken = adminLogin.data.token;
    console.log('  Admin Token 已获取');
  }

  const teacherLogin = await test(
    '教师登录',
    'POST',
    '/api/auth/login',
    { username: 'teacher1', password: '123456' }
  );
  if (teacherLogin && teacherLogin.data && teacherLogin.data.token) {
    teacherToken = teacherLogin.data.token;
    console.log('  Teacher Token 已获取');
  }

  const studentLogin = await test(
    '学生登录',
    'POST',
    '/api/auth/login',
    { username: 'student1', password: '123456' }
  );
  if (studentLogin && studentLogin.data && studentLogin.data.token) {
    studentToken = studentLogin.data.token;
    console.log('  Student Token 已获取');
  }

  await test(
    '登录失败-错误密码',
    'POST',
    '/api/auth/login',
    { username: 'admin', password: 'wrong' },
    null,
    -1,
    400
  );

  await test('获取当前用户信息', 'GET', '/api/auth/profile', null, adminToken);
  await test('无Token访问Profile', 'GET', '/api/auth/profile', null, null, -1, 401);

  // 3. Users
  console.log('\n\x1b[36m--- 3. 用户管理 ---\x1b[0m');
  await test('获取用户列表(管理员)', 'GET', '/api/users?page=1&pageSize=5', null, adminToken);
  await test('获取用户列表(教师)', 'GET', '/api/users?page=1&pageSize=5', null, teacherToken);
  await test('学生获取用户列表(应被拒绝)', 'GET', '/api/users', null, studentToken, -1, 403);

  const newUser = await test(
    '创建用户',
    'POST',
    '/api/users',
    { username: 'testuser_api', password: 'test123', role: 'STUDENT', name: '测试用户API' },
    adminToken
  );

  if (newUser && newUser.data && newUser.data.id) {
    const userId = newUser.data.id;
    await test(
      '更新用户',
      'PUT',
      '/api/users/' + userId,
      { name: '测试用户更新' },
      adminToken
    );
    await test('删除用户', 'DELETE', '/api/users/' + userId, null, adminToken);
  }

  // 4. Questions
  console.log('\n\x1b[36m--- 4. 题库管理 ---\x1b[0m');
  await test('获取题目列表(公开)', 'GET', '/api/questions?page=1&pageSize=5');
  await test('按类型筛选题目', 'GET', '/api/questions?type=SINGLE_CHOICE&pageSize=3');
  await test('按难度筛选题目', 'GET', '/api/questions?difficulty=EASY&pageSize=3');
  await test('关键词搜索题目', 'GET', '/api/questions?keyword=TCP&pageSize=3');
  await test('获取题目详情', 'GET', '/api/questions/1');

  const newQuestion = await test(
    '创建题目',
    'POST',
    '/api/questions',
    {
      type: 'SINGLE_CHOICE',
      content: '测试题目：1+1等于几？',
      options: ['1', '2', '3', '4'],
      answer: 'B',
      score: 2,
      analysis: '1+1=2',
      subject: '数学',
      difficulty: 'EASY',
    },
    teacherToken
  );

  if (newQuestion && newQuestion.data && newQuestion.data.id) {
    const qId = newQuestion.data.id;
    await test(
      '更新题目',
      'PUT',
      '/api/questions/' + qId,
      { content: '测试题目更新：2+2等于几？', answer: 'C' },
      teacherToken
    );
    await test('删除题目', 'DELETE', '/api/questions/' + qId, null, teacherToken);
  }

  await test(
    '无Token创建题目(应被拒绝)',
    'POST',
    '/api/questions',
    { type: 'SINGLE_CHOICE', content: 'test', answer: 'A', subject: 'test' },
    null,
    -1,
    401
  );

  // 5. Papers
  console.log('\n\x1b[36m--- 5. 试卷管理 ---\x1b[0m');
  await test('获取试卷列表(公开)', 'GET', '/api/papers?page=1&pageSize=5');
  await test('获取试卷详情', 'GET', '/api/papers/1');

  const questionsResp = await request('GET', '/api/questions?pageSize=5');
  if (questionsResp.body && questionsResp.body.data && questionsResp.body.data.list) {
    const qs = questionsResp.body.data.list;
    if (qs.length > 0) {
      const items = qs.slice(0, 3).map((q, i) => ({
        questionId: q.id,
        score: 2,
        sortOrder: i + 1,
      }));

      const newPaper = await test(
        '创建试卷(手动组卷)',
        'POST',
        '/api/papers',
        { title: '测试试卷API', description: '测试描述', duration: 30, items },
        teacherToken
      );

      if (newPaper && newPaper.data && newPaper.data.id) {
        const paperId = newPaper.data.id;
        await test(
          '更新试卷',
          'PUT',
          '/api/papers/' + paperId,
          { title: '测试试卷更新' },
          teacherToken
        );
        await test('删除试卷', 'DELETE', '/api/papers/' + paperId, null, teacherToken);
      }
    }
  }

  const autoPaper = await test(
    '自动生成试卷',
    'POST',
    '/api/papers/auto-generate',
    {
      subject: '计算机科学',
      questionTypes: ['SINGLE_CHOICE', 'TRUE_FALSE'],
      totalScore: 10,
      difficulty: 'EASY',
      title: '自动生成测试卷',
    },
    teacherToken
  );

  if (autoPaper && autoPaper.data && autoPaper.data.id) {
    await test(
      '删除自动生成的试卷',
      'DELETE',
      '/api/papers/' + autoPaper.data.id,
      null,
      teacherToken
    );
  }

  // 6. Exams
  console.log('\n\x1b[36m--- 6. 考试管理 ---\x1b[0m');
  await test('获取考试列表(管理员)', 'GET', '/api/exams?page=1&pageSize=5', null, adminToken);
  await test('获取考试列表(学生)', 'GET', '/api/exams?page=1&pageSize=5', null, studentToken);
  await test('获取考试详情', 'GET', '/api/exams/1', null, adminToken);

  const papersResp = await request('GET', '/api/papers?pageSize=1');
  if (papersResp.body && papersResp.body.data && papersResp.body.data.list && papersResp.body.data.list.length > 0) {
    const paper = papersResp.body.data.list[0];
    const startTime = new Date(Date.now() - 3600000).toISOString();
    const endTime = new Date(Date.now() + 86400000).toISOString();

    const newExam = await test(
      '创建考试',
      'POST',
      '/api/exams',
      {
        title: 'API测试考试',
        paperId: paper.id,
        startTime: startTime,
        endTime: endTime,
        status: 'PUBLISHED',
      },
      teacherToken
    );

    if (newExam && newExam.data && newExam.data.id) {
      const examId = newExam.data.id;

      await test(
        '更新考试',
        'PUT',
        '/api/exams/' + examId,
        { title: 'API测试考试更新' },
        teacherToken
      );

      await test('学生开始考试', 'POST', '/api/exams/' + examId + '/start', null, studentToken);

      await test(
        '学生提交考试',
        'POST',
        '/api/exams/' + examId + '/submit',
        { answers: { 1: 'C', 2: 'B' } },
        studentToken
      );

      await test('查看考试成绩', 'GET', '/api/exams/' + examId + '/result', null, studentToken);
      await test('查看考试记录(教师)', 'GET', '/api/exams/' + examId + '/records', null, teacherToken);
      await test(
        '学生查看考试记录(应被拒绝)',
        'GET',
        '/api/exams/' + examId + '/records',
        null,
        studentToken,
        -1,
        403
      );

      await test('删除考试', 'DELETE', '/api/exams/' + examId, null, teacherToken);
    }
  }

  await test(
    '学生创建考试(应被拒绝)',
    'POST',
    '/api/exams',
    {},
    studentToken,
    -1,
    403
  );

  // Summary
  console.log('\n\x1b[36m========================================\x1b[0m');
  console.log('\x1b[36m  测试结果汇总\x1b[0m');
  console.log('\x1b[36m========================================\x1b[0m');

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  console.log(`\n总计: ${total} 个测试`);
  console.log(`\x1b[32m通过: ${passed} 个\x1b[0m`);
  console.log(`\x1b[31m失败: ${failed} 个\x1b[0m`);

  if (failed > 0) {
    console.log('\n\x1b[31m--- 失败的测试 ---\x1b[0m');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.name} (${r.method} ${r.path})`);
        console.log(`    HTTP ${r.statusCode}: ${r.message}`);
      });
  }

  console.log('');
  if (failed === 0) {
    console.log('\x1b[32m所有测试通过！\x1b[0m');
  } else {
    console.log(`\x1b[33m有 ${failed} 个测试失败，请检查。\x1b[0m`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch((err) => {
  console.error('测试运行失败:', err);
  process.exit(1);
});
