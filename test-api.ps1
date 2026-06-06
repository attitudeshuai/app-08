$BASE_URL = "http://localhost:3008"
$ADMIN_TOKEN = ""
$TEACHER_TOKEN = ""
$STUDENT_TOKEN = ""
$TEST_RESULTS = @()

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Path,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [string]$ExpectedStatus = "200",
        [string]$ExpectedCode = "0"
    )

    try {
        $url = "$BASE_URL$Path"
        $params = @{
            Method = $Method
            Uri = $url
            Headers = $Headers
            UseBasicParsing = $true
        }

        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }

        $response = Invoke-WebRequest @params -ErrorAction Stop
        $statusCode = $response.StatusCode
        $content = $response.Content | ConvertFrom-Json

        $passed = ($statusCode -eq [int]$ExpectedStatus) -and ($content.code -eq [int]$ExpectedCode)
        $result = @{
            Name = $Name
            Method = $Method
            Path = $Path
            StatusCode = $statusCode
            Code = $content.code
            Message = $content.message
            Passed = $passed
        }

        $TEST_RESULTS += [PSCustomObject]$result

        $status = if ($passed) { "PASS" } else { "FAIL" }
        Write-Host "[$status] $Name ($Method $Path)" -ForegroundColor $(if ($passed) { "Green" } else { "Red" })
        if (-not $passed) {
            Write-Host "  Expected: HTTP $ExpectedStatus, code $ExpectedCode" -ForegroundColor Yellow
            Write-Host "  Got: HTTP $statusCode, code $($content.code) - $($content.message)" -ForegroundColor Yellow
        }

        return $content
    }
    catch {
        $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
        $errorMessage = $_.Exception.Message

        $result = @{
            Name = $Name
            Method = $Method
            Path = $Path
            StatusCode = $statusCode
            Code = -999
            Message = $errorMessage
            Passed = $false
        }

        $TEST_RESULTS += [PSCustomObject]$result

        Write-Host "[FAIL] $Name ($Method $Path)" -ForegroundColor Red
        Write-Host "  Error: $errorMessage" -ForegroundColor Yellow

        return $null
    }
}

function Get-AuthHeader {
    param([string]$Token)
    return @{ "Authorization" = "Bearer $Token" }
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  在线考试系统 API 测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL"
Write-Host ""

Write-Host "--- 1. 健康检查 ---" -ForegroundColor Cyan
Test-Endpoint -Name "健康检查" -Method "GET" -Path "/api/health"

Write-Host ""
Write-Host "--- 2. 认证模块 ---" -ForegroundColor Cyan

$loginBody = @{ username = "admin"; password = "123456" } | ConvertTo-Json
$result = Test-Endpoint -Name "管理员登录" -Method "POST" -Path "/api/auth/login" -Body $loginBody
if ($result -and $result.data -and $result.data.token) {
    $ADMIN_TOKEN = $result.data.token
    Write-Host "  Admin Token 已获取" -ForegroundColor Green
}

$loginBody2 = @{ username = "teacher1"; password = "123456" } | ConvertTo-Json
$result = Test-Endpoint -Name "教师登录" -Method "POST" -Path "/api/auth/login" -Body $loginBody2
if ($result -and $result.data -and $result.data.token) {
    $TEACHER_TOKEN = $result.data.token
    Write-Host "  Teacher Token 已获取" -ForegroundColor Green
}

$loginBody3 = @{ username = "student1"; password = "123456" } | ConvertTo-Json
$result = Test-Endpoint -Name "学生登录" -Method "POST" -Path "/api/auth/login" -Body $loginBody3
if ($result -and $result.data -and $result.data.token) {
    $STUDENT_TOKEN = $result.data.token
    Write-Host "  Student Token 已获取" -ForegroundColor Green
}

Test-Endpoint -Name "登录失败-错误密码" -Method "POST" -Path "/api/auth/login" -Body (@{ username = "admin"; password = "wrong" } | ConvertTo-Json) -ExpectedCode "-1"

Test-Endpoint -Name "获取当前用户信息" -Method "GET" -Path "/api/auth/profile" -Headers (Get-AuthHeader $ADMIN_TOKEN)

Test-Endpoint -Name "无Token访问Profile" -Method "GET" -Path "/api/auth/profile" -ExpectedStatus "401" -ExpectedCode "-1"

Write-Host ""
Write-Host "--- 3. 用户管理 ---" -ForegroundColor Cyan

Test-Endpoint -Name "获取用户列表(管理员)" -Method "GET" -Path "/api/users?page=1&pageSize=5" -Headers (Get-AuthHeader $ADMIN_TOKEN)

Test-Endpoint -Name "获取用户列表(教师)" -Method "GET" -Path "/api/users?page=1&pageSize=5" -Headers (Get-AuthHeader $TEACHER_TOKEN)

Test-Endpoint -Name "学生获取用户列表(应被拒绝)" -Method "GET" -Path "/api/users" -Headers (Get-AuthHeader $STUDENT_TOKEN) -ExpectedStatus "403" -ExpectedCode "-1"

$newUser = @{
    username = "testuser"
    password = "test123"
    role = "STUDENT"
    name = "测试用户"
} | ConvertTo-Json
$createUserResult = Test-Endpoint -Name "创建用户" -Method "POST" -Path "/api/users" -Headers (Get-AuthHeader $ADMIN_TOKEN) -Body $newUser

if ($createUserResult -and $createUserResult.data -and $createUserResult.data.id) {
    $userId = $createUserResult.data.id
    $updateUser = @{ name = "测试用户更新" } | ConvertTo-Json
    Test-Endpoint -Name "更新用户" -Method "PUT" -Path "/api/users/$userId" -Headers (Get-AuthHeader $ADMIN_TOKEN) -Body $updateUser

    Test-Endpoint -Name "删除用户" -Method "DELETE" -Path "/api/users/$userId" -Headers (Get-AuthHeader $ADMIN_TOKEN)
}

Write-Host ""
Write-Host "--- 4. 题库管理 ---" -ForegroundColor Cyan

Test-Endpoint -Name "获取题目列表(公开)" -Method "GET" -Path "/api/questions?page=1&pageSize=5"

Test-Endpoint -Name "按类型筛选题目" -Method "GET" -Path "/api/questions?type=SINGLE_CHOICE&pageSize=3"

Test-Endpoint -Name "按难度筛选题目" -Method "GET" -Path "/api/questions?difficulty=EASY&pageSize=3"

Test-Endpoint -Name "关键词搜索题目" -Method "GET" -Path "/api/questions?keyword=TCP&pageSize=3"

$result = Test-Endpoint -Name "获取题目详情" -Method "GET" -Path "/api/questions/1"

$newQuestion = @{
    type = "SINGLE_CHOICE"
    content = "测试题目：1+1等于几？"
    options = @("1", "2", "3", "4")
    answer = "B"
    score = 2
    analysis = "1+1=2"
    subject = "数学"
    difficulty = "EASY"
} | ConvertTo-Json
$createQResult = Test-Endpoint -Name "创建题目" -Method "POST" -Path "/api/questions" -Headers (Get-AuthHeader $TEACHER_TOKEN) -Body $newQuestion

if ($createQResult -and $createQResult.data -and $createQResult.data.id) {
    $qId = $createQResult.data.id

    $updateQuestion = @{ content = "测试题目更新：2+2等于几？"; answer = "C" } | ConvertTo-Json
    Test-Endpoint -Name "更新题目" -Method "PUT" -Path "/api/questions/$qId" -Headers (Get-AuthHeader $TEACHER_TOKEN) -Body $updateQuestion

    Test-Endpoint -Name "删除题目" -Method "DELETE" -Path "/api/questions/$qId" -Headers (Get-AuthHeader $TEACHER_TOKEN)
}

Test-Endpoint -Name "无Token创建题目(应被拒绝)" -Method "POST" -Path "/api/questions" -Body $newQuestion -ExpectedStatus "401" -ExpectedCode "-1"

Write-Host ""
Write-Host "--- 5. 试卷管理 ---" -ForegroundColor Cyan

Test-Endpoint -Name "获取试卷列表(公开)" -Method "GET" -Path "/api/papers?page=1&pageSize=5"

Test-Endpoint -Name "获取试卷详情" -Method "GET" -Path "/api/papers/1"

$questionsForPaper = @()
$result = Test-Endpoint -Name "获取题目用于组卷" -Method "GET" -Path "/api/questions?pageSize=3"
if ($result -and $result.data -and $result.data.list) {
    $questionsForPaper = $result.data.list
}

if ($questionsForPaper.Count -gt 0) {
    $items = @()
    for ($i = 0; $i -lt [Math]::Min(3, $questionsForPaper.Count); $i++) {
        $items += @{
            questionId = $questionsForPaper[$i].id
            score = 2
            sortOrder = $i + 1
        }
    }

    $newPaper = @{
        title = "测试试卷"
        description = "这是一个测试试卷"
        duration = 30
        items = $items
    } | ConvertTo-Json -Depth 10

    $createPaperResult = Test-Endpoint -Name "创建试卷(手动组卷)" -Method "POST" -Path "/api/papers" -Headers (Get-AuthHeader $TEACHER_TOKEN) -Body $newPaper

    if ($createPaperResult -and $createPaperResult.data -and $createPaperResult.data.id) {
        $paperId = $createPaperResult.data.id

        $updatePaper = @{ title = "测试试卷更新" } | ConvertTo-Json
        Test-Endpoint -Name "更新试卷" -Method "PUT" -Path "/api/papers/$paperId" -Headers (Get-AuthHeader $TEACHER_TOKEN) -Body $updatePaper

        Test-Endpoint -Name "删除试卷" -Method "DELETE" -Path "/api/papers/$paperId" -Headers (Get-AuthHeader $TEACHER_TOKEN)
    }
}

$autoGenPaper = @{
    subject = "计算机科学"
    questionTypes = @("SINGLE_CHOICE", "TRUE_FALSE")
    totalScore = 10
    difficulty = "EASY"
    title = "自动生成测试卷"
} | ConvertTo-Json
$autoPaperResult = Test-Endpoint -Name "自动生成试卷" -Method "POST" -Path "/api/papers/auto-generate" -Headers (Get-AuthHeader $TEACHER_TOKEN) -Body $autoGenPaper

if ($autoPaperResult -and $autoPaperResult.data -and $autoPaperResult.data.id) {
    $autoPaperId = $autoPaperResult.data.id
    Test-Endpoint -Name "删除自动生成的试卷" -Method "DELETE" -Path "/api/papers/$autoPaperId" -Headers (Get-AuthHeader $TEACHER_TOKEN)
}

Write-Host ""
Write-Host "--- 6. 考试管理 ---" -ForegroundColor Cyan

Test-Endpoint -Name "获取考试列表(管理员)" -Method "GET" -Path "/api/exams?page=1&pageSize=5" -Headers (Get-AuthHeader $ADMIN_TOKEN)

Test-Endpoint -Name "获取考试列表(学生)" -Method "GET" -Path "/api/exams?page=1&pageSize=5" -Headers (Get-AuthHeader $STUDENT_TOKEN)

Test-Endpoint -Name "获取考试详情" -Method "GET" -Path "/api/exams/1" -Headers (Get-AuthHeader $ADMIN_TOKEN)

$paperForExam = $null
$result = Test-Endpoint -Name "获取试卷用于创建考试" -Method "GET" -Path "/api/papers?pageSize=1"
if ($result -and $result.data -and $result.data.list -and $result.data.list.Count -gt 0) {
    $paperForExam = $result.data.list[0]
}

if ($paperForExam) {
    $startTime = (Get-Date).AddHours(-1).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")
    $endTime = (Get-Date).AddHours(23).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

    $newExam = @{
        title = "测试考试"
        paperId = $paperForExam.id
        startTime = $startTime
        endTime = $endTime
        status = "PUBLISHED"
    } | ConvertTo-Json

    $createExamResult = Test-Endpoint -Name "创建考试" -Method "POST" -Path "/api/exams" -Headers (Get-AuthHeader $TEACHER_TOKEN) -Body $newExam

    if ($createExamResult -and $createExamResult.data -and $createExamResult.data.id) {
        $examId = $createExamResult.data.id

        $updateExam = @{ title = "测试考试更新" } | ConvertTo-Json
        Test-Endpoint -Name "更新考试" -Method "PUT" -Path "/api/exams/$examId" -Headers (Get-AuthHeader $TEACHER_TOKEN) -Body $updateExam

        Test-Endpoint -Name "学生开始考试" -Method "POST" -Path "/api/exams/$examId/start" -Headers (Get-AuthHeader $STUDENT_TOKEN)

        $submitAnswers = @{ answers = @{ "1" = "C"; "2" = "B" } } | ConvertTo-Json -Depth 10
        Test-Endpoint -Name "学生提交考试" -Method "POST" -Path "/api/exams/$examId/submit" -Headers (Get-AuthHeader $STUDENT_TOKEN) -Body $submitAnswers

        Test-Endpoint -Name "查看考试成绩" -Method "GET" -Path "/api/exams/$examId/result" -Headers (Get-AuthHeader $STUDENT_TOKEN)

        Test-Endpoint -Name "查看考试记录(教师)" -Method "GET" -Path "/api/exams/$examId/records" -Headers (Get-AuthHeader $TEACHER_TOKEN)

        Test-Endpoint -Name "学生查看考试记录(应被拒绝)" -Method "GET" -Path "/api/exams/$examId/records" -Headers (Get-AuthHeader $STUDENT_TOKEN) -ExpectedStatus "403" -ExpectedCode "-1"

        Test-Endpoint -Name "删除考试" -Method "DELETE" -Path "/api/exams/$examId" -Headers (Get-AuthHeader $TEACHER_TOKEN)
    }
}

Test-Endpoint -Name "学生创建考试(应被拒绝)" -Method "POST" -Path "/api/exams" -Headers (Get-AuthHeader $STUDENT_TOKEN) -Body (@{} | ConvertTo-Json) -ExpectedStatus "403" -ExpectedCode "-1"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  测试结果汇总" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$passed = ($TEST_RESULTS | Where-Object { $_.Passed -eq $true }).Count
$failed = ($TEST_RESULTS | Where-Object { $_.Passed -eq $false }).Count
$total = $TEST_RESULTS.Count

Write-Host ""
Write-Host "总计: $total 个测试" -ForegroundColor White
Write-Host "通过: $passed 个" -ForegroundColor Green
Write-Host "失败: $failed 个" -ForegroundColor Red

if ($failed -gt 0) {
    Write-Host ""
    Write-Host "--- 失败的测试 ---" -ForegroundColor Red
    $TEST_RESULTS | Where-Object { $_.Passed -eq $false } | ForEach-Object {
        Write-Host "  - $($_.Name) ($($_.Method) $($_.Path))" -ForegroundColor Red
        Write-Host "    HTTP $($_.StatusCode): $($_.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host "所有测试通过！" -ForegroundColor Green
} else {
    Write-Host "有 $failed 个测试失败，请检查。" -ForegroundColor Red
}
