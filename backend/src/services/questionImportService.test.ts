import * as XLSX from 'xlsx';
import { _testHelpers, getImportTemplate, generateTemplateBuffer, importQuestionsFromFile } from './questionImportService';
import prisma from '../lib/prisma';

const {
  parseOptions,
  calculateSimilarity,
  levenshteinDistance,
  validateQuestion,
  typeMapping,
  difficultyMapping,
} = _testHelpers;

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    question: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

describe('questionImportService - typeMapping', () => {
  test('支持中文题型名称映射', () => {
    expect(typeMapping['单选题']).toBe('SINGLE_CHOICE');
    expect(typeMapping['多选题']).toBe('MULTIPLE_CHOICE');
    expect(typeMapping['判断题']).toBe('TRUE_FALSE');
    expect(typeMapping['填空题']).toBe('FILL_BLANK');
    expect(typeMapping['简答题']).toBe('SHORT_ANSWER');
  });

  test('支持英文题型名称映射', () => {
    expect(typeMapping['single_choice']).toBe('SINGLE_CHOICE');
    expect(typeMapping['SINGLE_CHOICE']).toBe('SINGLE_CHOICE');
    expect(typeMapping['multiple_choice']).toBe('MULTIPLE_CHOICE');
    expect(typeMapping['MULTIPLE_CHOICE']).toBe('MULTIPLE_CHOICE');
  });
});

describe('questionImportService - difficultyMapping', () => {
  test('支持中文难度映射', () => {
    expect(difficultyMapping['简单']).toBe('EASY');
    expect(difficultyMapping['中等']).toBe('MEDIUM');
    expect(difficultyMapping['困难']).toBe('HARD');
  });

  test('支持英文难度映射', () => {
    expect(difficultyMapping['easy']).toBe('EASY');
    expect(difficultyMapping['EASY']).toBe('EASY');
    expect(difficultyMapping['medium']).toBe('MEDIUM');
    expect(difficultyMapping['MEDIUM']).toBe('MEDIUM');
    expect(difficultyMapping['hard']).toBe('HARD');
    expect(difficultyMapping['HARD']).toBe('HARD');
  });
});

describe('questionImportService - parseOptions', () => {
  test('空字符串返回 null', () => {
    expect(parseOptions('')).toBeNull();
    expect(parseOptions('   ')).toBeNull();
  });

  test('解析 A. 标号的选项', () => {
    const result = parseOptions('A.选项A B.选项B C.选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('解析 A、 标号的选项', () => {
    const result = parseOptions('A、选项A B、选项B C、选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('解析 A) 标号的选项', () => {
    const result = parseOptions('A)选项A B)选项B C)选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('解析 1. 数字标号的选项', () => {
    const result = parseOptions('1.选项一 2.选项二 3.选项三');
    expect(result).toEqual(['选项一', '选项二', '选项三']);
  });

  test('同时存在标号和分号的情况 - 英文分号', () => {
    const result = parseOptions('A.选项A;B.选项B;C.选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('同时存在标号和分号的情况 - 中文分号', () => {
    const result = parseOptions('A.选项A；B.选项B；C.选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('同时存在标号和分号，分号不会残留在选项中', () => {
    const result = parseOptions('A.选项A;B.选项B;');
    expect(result).toEqual(['选项A', '选项B']);
    expect(result!.every(opt => !opt.endsWith(';'))).toBe(true);
    expect(result!.every(opt => !opt.startsWith(';'))).toBe(true);
  });

  test('标号+换行+分号混合格式', () => {
    const result = parseOptions('A.选项A\nB.选项B;C.选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('纯分号分隔（无标号）', () => {
    const result = parseOptions('选项A;选项B;选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('中文分号分隔（无标号）', () => {
    const result = parseOptions('选项A；选项B；选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('换行分隔（无标号）', () => {
    const result = parseOptions('选项A\n选项B\n选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });

  test('单个选项返回单元素数组', () => {
    const result = parseOptions('只有一个选项');
    expect(result).toEqual(['只有一个选项']);
  });

  test('选项前后空格会被去除', () => {
    const result = parseOptions('A.  选项 A  ;B.  选项 B  ');
    expect(result).toEqual(['选项 A', '选项 B']);
  });

  test('连续多个分号只算一个分隔符', () => {
    const result = parseOptions('A.选项A;;B.选项B;;;C.选项C');
    expect(result).toEqual(['选项A', '选项B', '选项C']);
  });
});

describe('questionImportService - levenshteinDistance', () => {
  test('两个相同字符串的编辑距离为 0', () => {
    expect(levenshteinDistance('abc', 'abc')).toBe(0);
    expect(levenshteinDistance('', '')).toBe(0);
  });

  test('空字符串与非空字符串的距离等于非空字符串长度', () => {
    expect(levenshteinDistance('', 'abc')).toBe(3);
    expect(levenshteinDistance('abc', '')).toBe(3);
  });

  test('单个字符差异的距离为 1', () => {
    expect(levenshteinDistance('abc', 'adc')).toBe(1);
    expect(levenshteinDistance('abc', 'ab')).toBe(1);
    expect(levenshteinDistance('abc', 'abcd')).toBe(1);
  });

  test('完全不同的字符串距离等于较长字符串长度', () => {
    expect(levenshteinDistance('abc', 'xyz')).toBe(3);
  });

  test('经典测试用例: kitten -> sitting', () => {
    expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
  });

  test('经典测试用例: Saturday -> Sunday', () => {
    expect(levenshteinDistance('Saturday', 'Sunday')).toBe(3);
  });
});

describe('questionImportService - calculateSimilarity', () => {
  test('完全相同的字符串相似度为 1', () => {
    expect(calculateSimilarity('Hello World', 'Hello World')).toBe(1);
  });

  test('忽略大小写和空格', () => {
    expect(calculateSimilarity('Hello World', 'helloworld')).toBe(1);
    expect(calculateSimilarity('Hello   World', 'hello world')).toBe(1);
  });

  test('完全不同的字符串相似度为 0', () => {
    expect(calculateSimilarity('abc', 'xyz')).toBe(0);
  });

  test('相似度范围在 0 到 1 之间', () => {
    const sim1 = calculateSimilarity('abcdef', 'abcdeg');
    expect(sim1).toBeGreaterThan(0);
    expect(sim1).toBeLessThan(1);

    const sim2 = calculateSimilarity('这是一道数学题', '这是一道物理题');
    expect(sim2).toBeGreaterThan(0);
    expect(sim2).toBeLessThan(1);
  });

  test('高度相似的字符串相似度 >= 0.85', () => {
    const original = '下列关于JavaScript的数据类型描述正确的是';
    const similar = '下列关于JavaScript的数据类型描述正确的是?';
    const similarity = calculateSimilarity(original, similar);
    expect(similarity).toBeGreaterThanOrEqual(0.85);
  });

  test('差异较大的字符串相似度 < 0.5', () => {
    const s1 = '什么是JavaScript的闭包？请举例说明。';
    const s2 = '请简述HTTP和HTTPS的主要区别。';
    const similarity = calculateSimilarity(s1, s2);
    expect(similarity).toBeLessThan(0.5);
  });

  test('中文文本相似度计算准确', () => {
    const s1 = '以下哪个不是Python的内置数据类型？';
    const s2 = '以下哪个不是Python的内置数据结构？';
    const similarity = calculateSimilarity(s1, s2);
    expect(similarity).toBeGreaterThan(0.7);
    expect(similarity).toBeLessThan(1);
  });
});

describe('questionImportService - validateQuestion', () => {
  const validData = {
    type: '单选题',
    content: '以下哪个是JavaScript的数据类型？',
    options: 'A.String\nB.Number\nC.Boolean\nD.Object',
    answer: 'A',
    score: '2',
    analysis: 'String是字符串类型',
    subject: '计算机基础',
    difficulty: '简单',
  };

  test('合法的单选题数据验证通过', () => {
    const result = validateQuestion(validData, 2);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.normalized.type).toBe('SINGLE_CHOICE');
    expect(result.normalized.difficulty).toBe('EASY');
    expect(result.normalized.options).toEqual(['String', 'Number', 'Boolean', 'Object']);
    expect(result.normalized.score).toBe(2);
  });

  test('缺少题目类型验证失败', () => {
    const data = { ...validData, type: '' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('题目类型不能为空');
  });

  test('无效的题目类型验证失败', () => {
    const data = { ...validData, type: '作文题' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('无效的题目类型'))).toBe(true);
  });

  test('缺少题目内容验证失败', () => {
    const data = { ...validData, content: '' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('题目内容不能为空');
  });

  test('缺少答案验证失败', () => {
    const data = { ...validData, answer: '' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('答案不能为空');
  });

  test('缺少科目验证失败', () => {
    const data = { ...validData, subject: '' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('科目不能为空');
  });

  test('无效的难度级别验证失败', () => {
    const data = { ...validData, difficulty: '地狱' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('无效的难度级别'))).toBe(true);
  });

  test('无效的分值验证失败', () => {
    const data = { ...validData, score: 'abc' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('无效的分值'))).toBe(true);
  });

  test('分值为负数验证失败', () => {
    const data = { ...validData, score: '-5' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('无效的分值'))).toBe(true);
  });

  test('选择题缺少选项验证失败', () => {
    const data = { ...validData, options: '' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('选择题必须提供至少2个选项'))).toBe(true);
  });

  test('选择题只有1个选项验证失败', () => {
    const data = { ...validData, options: 'A.只有一个选项' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('选择题必须提供至少2个选项'))).toBe(true);
  });

  test('判断题 - 对/错格式验证通过', () => {
    const data = {
      type: '判断题',
      content: 'HTML是一种编程语言。',
      answer: '错',
      subject: '计算机基础',
    };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(true);
    expect(result.normalized.type).toBe('TRUE_FALSE');
    expect(result.normalized.answer).toBe('FALSE');
  });

  test('判断题 - TRUE/FALSE 格式验证通过', () => {
    const data = {
      type: '判断题',
      content: 'JavaScript是解释型语言。',
      answer: 'TRUE',
      subject: '计算机基础',
    };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(true);
    expect(result.normalized.answer).toBe('TRUE');
  });

  test('判断题 - 无效答案验证失败', () => {
    const data = {
      type: '判断题',
      content: '测试题',
      answer: '也许',
      subject: '测试',
    };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('判断题答案必须是'))).toBe(true);
  });

  test('填空题不需要选项验证通过', () => {
    const data = {
      type: '填空题',
      content: 'CSS的全称是______。',
      answer: 'Cascading Style Sheets',
      subject: '前端开发',
    };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(true);
    expect(result.normalized.type).toBe('FILL_BLANK');
  });

  test('简答题不需要选项验证通过', () => {
    const data = {
      type: '简答题',
      content: '请简述HTTP和HTTPS的区别。',
      answer: 'HTTPS比HTTP多了SSL/TLS加密层',
      subject: '计算机网络',
    };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(true);
    expect(result.normalized.type).toBe('SHORT_ANSWER');
  });

  test('难度默认为 MEDIUM', () => {
    const data = { ...validData, difficulty: '' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(true);
    expect(result.normalized.difficulty).toBe('MEDIUM');
  });

  test('分值默认为 2', () => {
    const data = { ...validData, score: '' };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(true);
    expect(result.normalized.score).toBe(2);
  });

  test('可以同时有多个错误', () => {
    const data = {
      type: '',
      content: '',
      answer: '',
      subject: '',
    };
    const result = validateQuestion(data, 2);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('questionImportService - getImportTemplate', () => {
  test('返回表头和示例数据', () => {
    const template = getImportTemplate();
    expect(template.headers).toBeDefined();
    expect(template.headers.length).toBeGreaterThan(0);
    expect(template.sampleRows).toBeDefined();
    expect(template.sampleRows.length).toBeGreaterThan(0);
  });

  test('表头包含必要字段', () => {
    const { headers } = getImportTemplate();
    expect(headers).toContain('题目类型');
    expect(headers).toContain('题目内容');
    expect(headers).toContain('选项');
    expect(headers).toContain('答案');
    expect(headers).toContain('科目');
  });

  test('示例数据包含各种题型', () => {
    const { sampleRows } = getImportTemplate();
    const types = sampleRows.map(row => row[0]);
    expect(types).toContain('单选题');
    expect(types).toContain('多选题');
    expect(types).toContain('判断题');
    expect(types).toContain('填空题');
    expect(types).toContain('简答题');
  });
});

describe('questionImportService - generateTemplateBuffer', () => {
  test('生成有效的 Excel buffer', () => {
    const buffer = generateTemplateBuffer();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    expect(workbook.SheetNames.length).toBeGreaterThan(0);
  });

  test('生成的 Excel 包含表头和示例数据', () => {
    const buffer = generateTemplateBuffer();
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(firstSheet);
    expect(data.length).toBeGreaterThan(0);
  });
});

describe('questionImportService - importQuestionsFromFile', () => {
  function createExcelBuffer(rows: any[][]): Buffer {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  }

  const headers = ['题目类型', '题目内容', '选项', '答案', '分值', '解析', '科目', '难度'];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('空文件返回零结果', async () => {
    const buffer = createExcelBuffer([headers]);
    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]);

    const result = await importQuestionsFromFile(buffer, 1, false);
    expect(result.totalCount).toBe(0);
    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(0);
  });

  test('成功导入合法的题目', async () => {
    const rows = [
      headers,
      ['单选题', '1+1等于几？', 'A.1;B.2;C.3;D.4', 'B', 2, '', '数学', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.question.create as jest.Mock).mockResolvedValue({
      id: 1,
      type: 'SINGLE_CHOICE',
      content: '1+1等于几？',
      subject: '数学',
    });

    const result = await importQuestionsFromFile(buffer, 1, false);
    expect(result.totalCount).toBe(1);
    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(0);
    expect(result.successItems[0].id).toBe(1);
    expect(prisma.question.create).toHaveBeenCalledTimes(1);
  });

  test('验证失败的题目返回错误信息，不丢弃原始数据', async () => {
    const rows = [
      headers,
      ['', '有内容但没类型', '', 'A', 2, '', '数学', '简单'],
      ['单选题', '', '', 'B', 2, '', '数学', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]);

    const result = await importQuestionsFromFile(buffer, 1, false);
    expect(result.totalCount).toBe(2);
    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(2);

    expect(result.errorItems[0].rowIndex).toBe(2);
    expect(result.errorItems[0].errors.length).toBeGreaterThan(0);
    expect(result.errorItems[0].rowData).toBeDefined();
    expect((result.errorItems[0].rowData as any).content).toBe('有内容但没类型');

    expect(result.errorItems[1].rowIndex).toBe(3);
    expect(result.errorItems[1].errors.length).toBeGreaterThan(0);
  });

  test('部分成功部分失败的混合情况', async () => {
    const rows = [
      headers,
      ['单选题', '好题', 'A.对;B.错', 'A', 2, '', '数学', '简单'],
      ['单选题', '', '', 'B', 2, '', '数学', '简单'],
      ['多选题', '也是好题', 'A.一;B.二;C.三', 'AB', 3, '', '数学', '中等'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.question.create as jest.Mock)
      .mockResolvedValueOnce({ id: 1, type: 'SINGLE_CHOICE', content: '好题', subject: '数学' })
      .mockResolvedValueOnce({ id: 2, type: 'MULTIPLE_CHOICE', content: '也是好题', subject: '数学' });

    const result = await importQuestionsFromFile(buffer, 1, false);
    expect(result.totalCount).toBe(3);
    expect(result.successCount).toBe(2);
    expect(result.failCount).toBe(1);
    expect(prisma.question.create).toHaveBeenCalledTimes(2);
  });

  test('检测到完全重复的题目会被拦截', async () => {
    const rows = [
      headers,
      ['单选题', '重复题', 'A.是;B.否', 'A', 2, '', '数学', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.findFirst as jest.Mock).mockResolvedValue({ id: 99 });
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]);

    const result = await importQuestionsFromFile(buffer, 1, true);
    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.errorItems[0].errors.some(e => e.includes('完全重复'))).toBe(true);
    expect(prisma.question.create).not.toHaveBeenCalled();
  });

  test('关闭重复检测时，重复题目也会导入', async () => {
    const rows = [
      headers,
      ['单选题', '重复题', 'A.是;B.否', 'A', 2, '', '数学', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.create as jest.Mock).mockResolvedValue({
      id: 1,
      type: 'SINGLE_CHOICE',
      content: '重复题',
      subject: '数学',
    });

    const result = await importQuestionsFromFile(buffer, 1, false);
    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(0);
    expect(prisma.question.findFirst).not.toHaveBeenCalled();
    expect(prisma.question.create).toHaveBeenCalledTimes(1);
  });

  test('相似度检测：高度相似的题目会被拦截', async () => {
    const rows = [
      headers,
      ['单选题', '下列哪个是JavaScript的数据类型？', 'A.String;B.Int;C.Float;D.Char', 'A', 2, '', '计算机', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([
      { id: 42, content: '下列哪个是JavaScript的数据类型？' },
    ]);

    const result = await importQuestionsFromFile(buffer, 1, true);
    expect(result.successCount).toBe(0);
    expect(result.failCount).toBe(1);
    expect(result.errorItems[0].errors.some(e => e.includes('高度相似'))).toBe(true);
    expect(result.errorItems[0].errors.some(e => e.includes('#42'))).toBe(true);
  });

  test('分批查询：大量题目时分批加载，不一次性加载全部', async () => {
    const rows = [
      headers,
      ['单选题', '新题', 'A.对;B.错', 'A', 2, '', '大数据科目', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    const mockBatch1 = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      content: `不相关的题目 ${i + 1}`,
    }));
    const mockBatch2 = Array.from({ length: 50 }, (_, i) => ({
      id: i + 101,
      content: `另一些不相关的题目 ${i + 101}`,
    }));

    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock)
      .mockResolvedValueOnce(mockBatch1)
      .mockResolvedValueOnce(mockBatch2)
      .mockResolvedValueOnce([]);

    (prisma.question.create as jest.Mock).mockResolvedValue({
      id: 200,
      type: 'SINGLE_CHOICE',
      content: '新题',
      subject: '大数据科目',
    });

    const result = await importQuestionsFromFile(buffer, 1, true);
    expect(result.successCount).toBe(1);
    expect(prisma.question.findMany).toHaveBeenCalledTimes(2);

    const firstCallArgs = (prisma.question.findMany as jest.Mock).mock.calls[0][0];
    expect(firstCallArgs.take).toBe(100);
    expect(firstCallArgs.select).toEqual({ id: true, content: true });
  });

  test('数据库错误时，返回错误信息但不影响其他题目', async () => {
    const rows = [
      headers,
      ['单选题', '好题1', 'A.对;B.错', 'A', 2, '', '数学', '简单'],
      ['单选题', '好题2', 'A.对;B.错', 'B', 2, '', '数学', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.question.create as jest.Mock)
      .mockResolvedValueOnce({ id: 1, type: 'SINGLE_CHOICE', content: '好题1', subject: '数学' })
      .mockRejectedValueOnce(new Error('数据库连接失败'));

    const result = await importQuestionsFromFile(buffer, 1, false);
    expect(result.totalCount).toBe(2);
    expect(result.successCount).toBe(1);
    expect(result.failCount).toBe(1);
    expect(result.errorItems[0].errors.some(e => e.includes('数据库错误'))).toBe(true);
    expect(result.errorItems[0].errors.some(e => e.includes('数据库连接失败'))).toBe(true);
  });

  test('支持多种列名（英文列名）', async () => {
    const rows = [
      ['type', 'content', 'options', 'answer', 'score', 'analysis', 'subject', 'difficulty'],
      ['单选题', '测试题', 'A.是;B.否', 'A', 2, '', '数学', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.question.create as jest.Mock).mockResolvedValue({
      id: 1,
      type: 'SINGLE_CHOICE',
      content: '测试题',
      subject: '数学',
    });

    const result = await importQuestionsFromFile(buffer, 1, false);
    expect(result.successCount).toBe(1);
  });

  test('判断题答案归一化为 TRUE/FALSE', async () => {
    const rows = [
      headers,
      ['判断题', '1+1=2', '', '对', 2, '', '数学', '简单'],
      ['判断题', '2+2=5', '', '错', 2, '', '数学', '简单'],
      ['判断题', '3+3=6', '', 'T', 2, '', '数学', '简单'],
      ['判断题', '4+4=9', '', 'FALSE', 2, '', '数学', '简单'],
    ];
    const buffer = createExcelBuffer(rows);

    (prisma.question.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.question.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.question.create as jest.Mock)
      .mockResolvedValueOnce({ id: 1, type: 'TRUE_FALSE', content: '1+1=2', subject: '数学' })
      .mockResolvedValueOnce({ id: 2, type: 'TRUE_FALSE', content: '2+2=5', subject: '数学' })
      .mockResolvedValueOnce({ id: 3, type: 'TRUE_FALSE', content: '3+3=6', subject: '数学' })
      .mockResolvedValueOnce({ id: 4, type: 'TRUE_FALSE', content: '4+4=9', subject: '数学' });

    const result = await importQuestionsFromFile(buffer, 1, false);
    expect(result.successCount).toBe(4);

    const createCalls = (prisma.question.create as jest.Mock).mock.calls;
    expect(createCalls[0][0].data.answer).toBe('TRUE');
    expect(createCalls[1][0].data.answer).toBe('FALSE');
    expect(createCalls[2][0].data.answer).toBe('TRUE');
    expect(createCalls[3][0].data.answer).toBe('FALSE');
  });
});
