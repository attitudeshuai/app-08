# 在线考试系统后端 API (Online Exam System Backend API)

一个功能完善的在线考试系统后端服务，提供题库管理、试卷管理、考试安排、自动评分等核心功能。采用 RESTful API 设计，可与任何前端系统或客户端应用进行数据交互。

## 技术栈

- **Node.js** + **Koa 2** - 轻量级 Web 框架
- **TypeScript** - 类型安全
- **Prisma** - 现代化 ORM
- **MySQL 8.0** - 关系型数据库
- **JWT** + **bcrypt** - 认证与密码加密
- **Docker** + **Docker Compose** - 容器化部署

## 核心功能

### 🔐 用户认证与权限管理
- JWT Token 认证机制
- bcrypt 密码加密
- 三种角色：管理员(ADMIN)、教师(TEACHER)、学生(STUDENT)
- 基于角色的访问控制 (RBAC)

### 📝 题库管理
- 支持 5 种题型：单选题、多选题、判断题、填空题、简答题
- 按类型、科目、难度筛选
- 题目解析支持
- 分页查询

### 📄 试卷管理
- 手动组卷：从题库中选择题目并设置分值
- 自动组卷：按科目、题型、难度、总分自动生成试卷
- 试卷详情查看
- 灵活的分值配置

### 🎯 考试管理
- 创建考试并关联试卷
- 设置考试起止时间
- 考试状态管理（草稿/已发布/已结束）
- 学生进入考试功能
- 答题提交与记录

### 📊 成绩与评分
- 客观题自动评分（单选、多选、判断、填空）
- 考试结果查看
- 答题详情对比
- 考试记录查询（教师/管理员）

## 快速开始

### 方式一：Docker Compose 一键部署（推荐）

```bash
docker-compose up -d --build
```

启动完成后：
- 后端 API：http://localhost:3008
- 健康检查：http://localhost:3008/api/health

### 方式二：本地开发

#### 前提条件
- Node.js >= 18
- MySQL >= 8.0
- npm 或 yarn

#### 安装与配置

```bash
cd backend

# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env
# 编辑 .env 文件，配置数据库连接等信息

# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate dev

# 初始化种子数据
npx prisma db seed
# 或
npm run seed

# 启动开发服务器
npm run dev
```

#### 生产构建

```bash
npm run build
npm start
```

### 默认演示账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | 123456 |
| 教师 | teacher1 | 123456 |
| 教师 | teacher2 | 123456 |
| 学生 | student1 | 123456 |
| 学生 | student2 | 123456 |
| 学生 | student3 | 123456 |

## 项目结构

```
backend/
├── prisma/
│   ├── schema.prisma       # 数据库模型定义
│   ├── seed.ts             # 种子数据
│   └── migrations/         # 数据库迁移文件
├── src/
│   ├── index.ts            # 应用入口
│   ├── config/
│   │   └── index.ts        # 配置管理
│   ├── lib/
│   │   └── prisma.ts       # Prisma 单例
│   ├── middleware/
│   │   └── auth.ts         # JWT认证与角色中间件
│   ├── routes/
│   │   ├── auth.ts         # 登录认证路由
│   │   ├── users.ts        # 用户管理路由
│   │   ├── questions.ts    # 题目管理路由
│   │   ├── papers.ts       # 试卷管理路由
│   │   └── exams.ts        # 考试管理路由
│   ├── services/
│   │   └── paperService.ts # 试卷业务逻辑（自动组卷、评分）
│   ├── types/
│   │   └── index.ts        # TypeScript 类型定义
│   └── utils/
│       ├── jwt.ts          # JWT 工具函数
│       ├── response.ts     # 统一响应格式
│       └── pagination.ts   # 分页工具
├── .env.example            # 环境变量示例
├── Dockerfile              # Docker 镜像构建
├── package.json
└── tsconfig.json
```

## 配置说明

### 环境变量

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `PORT` | 服务端口 | 3008 | 否 |
| `DATABASE_URL` | 数据库连接 URL | - | 生产环境必填 |
| `JWT_SECRET` | JWT 签名密钥 | exam-system-secret-key-2024 | 生产环境建议修改 |
| `JWT_EXPIRES_IN` | Token 过期时间 | 24h | 否 |
| `NODE_ENV` | 运行环境 | development | 否 |
| `CORS_ORIGIN` | CORS 允许的源 | * | 否 |

### 数据库连接 URL 格式

```
mysql://USER:PASSWORD@HOST:PORT/DATABASE
```

## API 接口文档

### 统一响应格式

所有 API 接口返回统一的 JSON 格式：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

- `code`: 状态码，0 表示成功，-1 表示失败
- `message`: 状态描述
- `data`: 响应数据（可选）

### 分页响应格式

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

### 认证方式

除登录接口外，所有需要认证的接口需在请求头中携带 JWT Token：

```
Authorization: Bearer <your-token>
```

---

### 1. 认证模块

#### 1.1 用户登录

- **方法**: `POST`
- **路径**: `/api/auth/login`
- **认证**: 无需
- **权限**: 所有用户

**请求体**:
```json
{
  "username": "admin",
  "password": "123456"
}
```

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 1,
      "username": "admin",
      "role": "ADMIN",
      "name": "系统管理员"
    }
  }
}
```

#### 1.2 获取当前用户信息

- **方法**: `GET`
- **路径**: `/api/auth/profile`
- **认证**: 需要
- **权限**: 所有登录用户

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "username": "admin",
    "role": "ADMIN",
    "name": "系统管理员",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 2. 用户管理

#### 2.1 获取用户列表

- **方法**: `GET`
- **路径**: `/api/users`
- **认证**: 需要
- **权限**: ADMIN, TEACHER

**查询参数**:
| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `page` | number | 页码 | 1 |
| `pageSize` | number | 每页数量 | 10 |
| `role` | string | 角色筛选 (ADMIN/TEACHER/STUDENT) | - |
| `keyword` | string | 关键词搜索（用户名/姓名） | - |

#### 2.2 创建用户

- **方法**: `POST`
- **路径**: `/api/users`
- **认证**: 需要
- **权限**: ADMIN, TEACHER

**请求体**:
```json
{
  "username": "newuser",
  "password": "123456",
  "role": "STUDENT",
  "name": "新用户"
}
```

#### 2.3 更新用户

- **方法**: `PUT`
- **路径**: `/api/users/:id`
- **认证**: 需要
- **权限**: ADMIN, TEACHER

**请求体**（均为可选）:
```json
{
  "password": "newpassword",
  "role": "TEACHER",
  "name": "新姓名"
}
```

#### 2.4 删除用户

- **方法**: `DELETE`
- **路径**: `/api/users/:id`
- **认证**: 需要
- **权限**: ADMIN

---

### 3. 题库管理

#### 3.1 获取题目列表

- **方法**: `GET`
- **路径**: `/api/questions`
- **认证**: 无需
- **权限**: 公开

**查询参数**:
| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `page` | number | 页码 | 1 |
| `pageSize` | number | 每页数量 | 10 |
| `type` | string | 题型：SINGLE_CHOICE/MULTIPLE_CHOICE/TRUE_FALSE/FILL_BLANK/SHORT_ANSWER | - |
| `subject` | string | 科目 | - |
| `difficulty` | string | 难度：EASY/MEDIUM/HARD | - |
| `keyword` | string | 关键词搜索 | - |

#### 3.2 获取题目详情

- **方法**: `GET`
- **路径**: `/api/questions/:id`
- **认证**: 无需
- **权限**: 公开

#### 3.3 创建题目

- **方法**: `POST`
- **路径**: `/api/questions`
- **认证**: 需要
- **权限**: 所有登录用户

**请求体**:
```json
{
  "type": "SINGLE_CHOICE",
  "content": "题目内容",
  "options": ["选项A", "选项B", "选项C", "选项D"],
  "answer": "A",
  "score": 2,
  "analysis": "题目解析",
  "subject": "计算机科学",
  "difficulty": "MEDIUM"
}
```

**题型说明**:
- `SINGLE_CHOICE` - 单选题：options 必填，answer 为单个选项字母
- `MULTIPLE_CHOICE` - 多选题：options 必填，answer 为逗号分隔的选项字母（如 "A,B,C"）
- `TRUE_FALSE` - 判断题：options 无需，answer 为 "正确" 或 "错误"
- `FILL_BLANK` - 填空题：options 无需，answer 为答案文本
- `SHORT_ANSWER` - 简答题：options 无需，answer 为参考答案（需人工评分）

#### 3.4 更新题目

- **方法**: `PUT`
- **路径**: `/api/questions/:id`
- **认证**: 需要
- **权限**: 所有登录用户

**请求体**（均为可选）: 同创建题目

#### 3.5 删除题目

- **方法**: `DELETE`
- **路径**: `/api/questions/:id`
- **认证**: 需要
- **权限**: 所有登录用户

---

### 4. 试卷管理

#### 4.1 获取试卷列表

- **方法**: `GET`
- **路径**: `/api/papers`
- **认证**: 无需
- **权限**: 公开

**查询参数**:
| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `page` | number | 页码 | 1 |
| `pageSize` | number | 每页数量 | 10 |
| `keyword` | string | 关键词搜索（标题） | - |

#### 4.2 获取试卷详情

- **方法**: `GET`
- **路径**: `/api/papers/:id`
- **认证**: 无需
- **权限**: 公开

#### 4.3 创建试卷（手动组卷）

- **方法**: `POST`
- **路径**: `/api/papers`
- **认证**: 需要
- **权限**: 所有登录用户

**请求体**:
```json
{
  "title": "试卷标题",
  "description": "试卷描述",
  "duration": 60,
  "items": [
    { "questionId": 1, "score": 2, "sortOrder": 1 },
    { "questionId": 2, "score": 4, "sortOrder": 2 }
  ]
}
```

#### 4.4 更新试卷

- **方法**: `PUT`
- **路径**: `/api/papers/:id`
- **认证**: 需要
- **权限**: 所有登录用户

**请求体**（均为可选）: 同创建试卷

#### 4.5 删除试卷

- **方法**: `DELETE`
- **路径**: `/api/papers/:id`
- **认证**: 需要
- **权限**: 所有登录用户

#### 4.6 自动生成试卷

- **方法**: `POST`
- **路径**: `/api/papers/auto-generate`
- **认证**: 需要
- **权限**: 所有登录用户

**请求体**:
```json
{
  "subject": "计算机科学",
  "questionTypes": ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE"],
  "totalScore": 100,
  "difficulty": "MEDIUM",
  "title": "自动生成试卷",
  "duration": 60
}
```

**参数说明**:
- `subject` - 科目（必填）
- `questionTypes` - 题型数组（必填）
- `totalScore` - 总分（必填）
- `difficulty` - 难度（可选）
- `title` - 试卷标题（可选）
- `duration` - 考试时长（分钟，可选）

#### 4.7 为已有试卷自动重新生成题目

- **方法**: `POST`
- **路径**: `/api/papers/:id/auto-generate`
- **认证**: 需要
- **权限**: 所有登录用户

**请求体**: 同自动生成试卷（subject, questionTypes, totalScore, difficulty）

---

### 5. 考试管理

#### 5.1 获取考试列表

- **方法**: `GET`
- **路径**: `/api/exams`
- **认证**: 需要
- **权限**: 所有登录用户
  - 学生：只能看到已发布的考试
  - 教师/管理员：可看到所有考试

**查询参数**:
| 参数 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| `page` | number | 页码 | 1 |
| `pageSize` | number | 每页数量 | 10 |
| `status` | string | 状态筛选：DRAFT/PUBLISHED/ENDED | - |

#### 5.2 获取考试详情

- **方法**: `GET`
- **路径**: `/api/exams/:id`
- **认证**: 需要
- **权限**: 所有登录用户
  - 学生：看不到题目答案和解析

#### 5.3 创建考试

- **方法**: `POST`
- **路径**: `/api/exams`
- **认证**: 需要
- **权限**: ADMIN, TEACHER

**请求体**:
```json
{
  "title": "期末考试",
  "paperId": 1,
  "startTime": "2024-06-01T09:00:00.000Z",
  "endTime": "2024-06-01T11:00:00.000Z",
  "status": "PUBLISHED"
}
```

**状态说明**:
- `DRAFT` - 草稿（学生不可见）
- `PUBLISHED` - 已发布
- `ENDED` - 已结束

#### 5.4 更新考试

- **方法**: `PUT`
- **路径**: `/api/exams/:id`
- **认证**: 需要
- **权限**: ADMIN, TEACHER

**请求体**（均为可选）: 同创建考试

#### 5.5 删除考试

- **方法**: `DELETE`
- **路径**: `/api/exams/:id`
- **认证**: 需要
- **权限**: ADMIN, TEACHER

#### 5.6 开始考试

- **方法**: `POST`
- **路径**: `/api/exams/:id/start`
- **认证**: 需要
- **权限**: 所有登录用户

**说明**:
- 只有已发布且在考试时间范围内的考试可以开始
- 第一次进入会创建考试记录
- 已提交的考试不能再次开始

#### 5.7 提交考试

- **方法**: `POST`
- **路径**: `/api/exams/:id/submit`
- **认证**: 需要
- **权限**: 所有登录用户

**请求体**:
```json
{
  "answers": {
    "1": "A",
    "2": "A,B,C",
    "3": "正确",
    "4": "1024"
  }
}
```

**说明**:
- answers 的 key 为题目 ID，value 为用户答案
- 客观题（单选、多选、判断、填空）自动评分
- 简答题需人工评分

#### 5.8 查看考试成绩

- **方法**: `GET`
- **路径**: `/api/exams/:id/result`
- **认证**: 需要
- **权限**: 所有登录用户（查看自己的成绩）

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "id": 1,
    "status": "SUBMITTED",
    "startTime": "2024-06-01T09:00:00.000Z",
    "submitTime": "2024-06-01T10:30:00.000Z",
    "totalScore": 85,
    "paperTitle": "期末考试",
    "totalQuestions": 20,
    "totalPossibleScore": 100,
    "paper": { ... },
    "answers": { ... }
  }
}
```

#### 5.9 查看考试记录列表

- **方法**: `GET`
- **路径**: `/api/exams/:id/records`
- **认证**: 需要
- **权限**: ADMIN, TEACHER

**说明**: 教师和管理员可以查看某场考试所有学生的答题记录

---

### 6. 健康检查

- **方法**: `GET`
- **路径**: `/api/health`
- **认证**: 无需
- **权限**: 公开

**响应**:
```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "ok",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "uptime": 1234.56
  }
}
```

## 错误码说明

| HTTP 状态码 | code | 说明 |
|-------------|------|------|
| 200 | 0 | 请求成功 |
| 400 | -1 | 请求参数错误 |
| 401 | -1 | 未认证或认证失败 |
| 403 | -1 | 权限不足 |
| 404 | -1 | 资源不存在 |
| 500 | -1 | 服务器内部错误 |

## 部署指南

### Docker 部署

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f backend

# 停止服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v
```

### 生产环境部署建议

1. **安全配置**
   - 修改默认 JWT_SECRET 为强随机密钥
   - 配置 CORS_ORIGIN 限制允许的域名
   - 使用 HTTPS 协议
   - 定期更换数据库密码

2. **数据库**
   - 启用数据库备份
   - 配置数据库连接池
   - 监控数据库性能

3. **服务监控**
   - 配置日志收集
   - 设置健康检查告警
   - 监控 API 响应时间

4. **性能优化**
   - 使用 PM2 管理 Node.js 进程
   - 配置合适的 Node.js 内存限制
   - 启用 gzip 压缩

### 数据库迁移

```bash
# 执行生产环境迁移
npx prisma migrate deploy

# 开发环境创建迁移
npx prisma migrate dev --name migration_name

# 重置数据库
npx prisma migrate reset
```

## 开发指南

### 添加新的 API 接口

1. 在 `src/routes/` 中创建或修改路由文件
2. 在 `src/services/` 中添加业务逻辑（如需要）
3. 在 `src/types/` 中添加相关类型定义
4. 在 `src/index.ts` 中注册路由

### 数据库模型变更

1. 修改 `prisma/schema.prisma`
2. 运行 `npx prisma migrate dev --name <name>` 创建迁移
3. 运行 `npx prisma generate` 更新 Prisma Client

## License

MIT
