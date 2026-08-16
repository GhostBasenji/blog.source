+++
title = "EduTest: проектирование и архитектура проекта"

description = ""

date = 2025-12-01T04:00:00

draft = false

categories = [
    "csharp-development",
    "Pet Projects",
    "Blazor",
    "Educational Platforms",
    "EduTest",
    "C#",
    "MSSQL",
    "Архитектура",
    ".NET Backend",
    "ASP.NET Core",
    "Node.js"
    ]

tags = [
  "Blazor Server",
  "csharp",
  "MSSQL",
  "EF Core",
  "pet-проект",
  "Git workflow",
  "Тестирование знаний",
  "Разработка ПО",
  "Архитектура приложений",
      ".NET Backend",
    "ASP.NET Core",
    "Node.js"
]
+++

В этой статье мы подробно рассмотрим **архитектуру проекта**, **структуру базы данных**, **организацию Blazor-проекта** и **подход к работе с Git**, чтобы читатель понял, как проектировать и развивать подобные системы.

Современные образовательные системы всё чаще используют цифровые платформы для тестирования знаний учащихся. **EduTest** — учебный проект на стеке **C#**+**Blazor Server**+**MSSQL**, который позволяет:
* создавать и проходить тесты с разными уровнями сложности,
* прикреплять к вопросам изображения и видео,
* назначать тесты ученикам и группам,
* вести аудит действий пользователей,
* гибко управлять ролями: администратор, учитель и ученик.

Система построена так, что после единого окна входа каждый пользователь видит интерфейс своей роли. Администратор управляет всей платформой, учитель создаёт тесты и следит за результатами, а ученик получает доступ к заданиям и статистике своих попыток.

--- 
## Архитектура системы
Проект построен по слоистой архитектуре:

```
┌──────────────────────┐
│        Pages         │  ← UI: Razor Components
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│       Services       │  ← бизнес-логика приложения
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│         Data         │  ← EF Core, DbContext, сущности
└──────────┬───────────┘
           │
┌──────────▼───────────┐
│       MSSQL DB       │  ← хранилище данных
└──────────────────────┘
```
Такое разделение позволяет:
* легко масштабировать проект,
* расширять функциональность,
* добавлять новые поля и таблицы без нарушения логики.

---

### Роли пользователей
🛠 **Администратор**
* Управляет пользователями (учителя, ученики)
* Настраивает глобальные параметры системы
* Управляет предметами, категориями, сложностями
* Полный доступ к данным и функционалу
* Может добавлять новые таблицы и поля
* Просматривает аудит-логи

📘 **Учитель**
* Создаёт и редактирует тесты
* Загружает изображения и видео к вопросам/ответам
* Управляет предметами и учебными группами
* Назначает тесты ученикам
* Включает таймер (экзаменационный режим), рандомизацию и уровни сложности
* Просматривает результаты учеников

👨‍🎓 **Ученик**
* Проходит тесты, доступные в системе
* Может завершить тест досрочно
* Получает результаты и статистику
* Видит историю попыток
* При желании видит свои ошибки (по настройкам учителя)

---

## Структура базы данных MSSQL

### Таблица Users

| Поле         | Тип             | Описание                  |
| ------------ | --------------- | ------------------------- |
| UserId       | INT PK IDENTITY | Пользователь              |
| Username     | NVARCHAR(100)   | Логин                     |
| PasswordHash | VARBINARY(256)  | Хеш пароля                |
| Role         | NVARCHAR(20)    | Admin / Teacher / Student |
| CreatedAt    | DATETIME2       | Дата создания             |

---

### Таблицы Teachers и Students

***Teachers***

| Поле           | Тип    |
| -------------- | ------ |
| TeacherId      | INT PK |
| UserId         | INT FK |
| SubjectId      | INT FK |
| IsClassTeacher | BIT    |


***Students***
| Поле      | Тип          |
| --------- | ------------ |
| StudentId | INT PK       |
| UserId    | INT FK       |
| ClassName | NVARCHAR(50) |

---

### Таблица Subjects и Categories

| Таблица    | Поля             |
| ---------- | ---------------- |
| Subjects   | SubjectId, Name  |
| Categories | CategoryId, Name |

--- 

### Таблицы Questions и Answers

***Questions***
| Поле       | Тип                |
| ---------- | ------------------ |
| QuestionId | INT PK             |
| TestId     | INT FK             |
| Text       | NVARCHAR(MAX)      |
| ImagePath  | NVARCHAR(300) NULL |
| Difficulty | INT                |
| CategoryId | INT FK             |

***Answers***
| Поле       | Тип                |
| ---------- | ------------------ |
| AnswerId   | INT PK             |
| QuestionId | INT FK             |
| Text       | NVARCHAR(MAX)      |
| ImagePath  | NVARCHAR(300) NULL |
| IsCorrect  | BIT                |

---

### Таблица Tests

| Поле                | Тип              |
| ------------------- | ---------------- |
| TestId              | INT PK           |
| TeacherId           | INT FK           |
| SubjectId           | INT FK           |
| Title               | NVARCHAR(200)    |
| Description         | NVARCHAR(MAX)    |
| QuestionCount       | INT              |
| PassingScore        | INT              |
| IsExam              | BIT              |
| EnableTimeLimit     | BIT              |
| TimeLimitMinutes    | INT NULL (30–60) |
| EnableRandomization | BIT              |
| EnableDifficulty    | BIT              |
| CreatedAt           | DATETIME2        |
| UpdatedAt           | DATETIME2        |

---

### Таблица TestAssignments

| Поле         | Тип       |
| ------------ | --------- |
| AssignmentId | INT PK    |
| TestId       | INT FK    |
| GroupId      | INT FK    |
| AssignedAt   | DATETIME2 |

---

### Таблица TestAttempts

| Поле             | Тип       |
| ---------------- | --------- |
| AttemptId        | INT PK    |
| AssignmentId     | INT FK    |
| StudentId        | INT FK    |
| StartedAt        | DATETIME2 |
| FinishedAt       | DATETIME2 |
| FinishedEarly    | BIT       |
| RemainingSeconds | INT NULL  |
| Score            | INT       |
| CorrectAnswers   | INT       |
| WrongAnswers     | INT       |

---

### Таблица AuditLog

| Поле      | Тип           |
| --------- | ------------- |
| LogId     | INT PK        |
| UserId    | INT FK        |
| Action    | NVARCHAR(300) |
| Entity    | NVARCHAR(100) |
| Timestamp | DATETIME2     |

---

# 💻 Структура проекта Blazor (EduTest)

```
EduTest/
│
├── Data/
│   ├── EduTestDbContext.cs
│   ├── Entities/
│   └── Migrations/
│
├── Services/
│   ├── AuthService.cs
│   ├── UserService.cs
│   ├── TestService.cs
│   ├── QuestionService.cs
│   ├── AssignmentService.cs
│   ├── StudentService.cs
│   └── AuditLogService.cs
│
├── Pages/
│   ├── Login.razor
│   ├── Admin/
│   ├── Teacher/
│   └── Student/
│
├── Components/
│   ├── TimerComponent.razor
│   ├── QuestionCard.razor
│   ├── AnswerOption.razor
│   └── LoadingIndicator.razor
│
├── wwwroot/
│   ├── uploads/
│   ├── css/
│   ├── js/
│   └── images/
│
├── App.razor
├── Program.cs
└── appsettings.json
```

### Схема интерфейса ролей
```
Login.razor
      │
      ├── Admin/     → управление системой
      ├── Teacher/   → тесты, вопросы, группы
      └── Student/   → прохождение тестов
```
---

## Работа с Git и ветками
### Основные ветки
```
master        → стабильные релизы
dev           → основная ветка разработки
feature/*     → новые фичи (feature/auth, feature/tests)
hotfix/*      → экстренные исправления
release/*     → подготовка релизов
```
---

### Пример рабочего процесса

**1. Разработка новой функции**
```bash
git checkout dev
git checkout -b feature/tests
```

Разработка → коммит:
```
git add .
git commit -m "Added basic test editor"
```

**2. Завершение работы над функцией**
```
git checkout dev
git merge feature/tests
```

**3. Подготовка релиза**
```
git checkout -b release/v1.0
```

**4. Выпуск стабильной версии**
```
git checkout master
git merge release/v1.0
git tag v1.0
```

**5. Экстренный hotfix**
```
git checkout master
git checkout -b hotfix/login-bug
git add .
git commit -m "Fix NullReferenceException"
git checkout master
git merge hotfix/login-bug
git checkout dev
git merge hotfix/login-bug
```
---

## Заключение

EduTest — современная система тестирования знаний с:
* продуманной архитектурой,
* разграничением ролей,
* расширяемой базой данных,
* гибким Git-workflow,
* единым окном входа.

Проект подходит как учебный пет-проект и фундамент для реальных образовательных платформ.

---

### Серия постов
* [EduTest: создаём систему тестирования на Blazor + C# + MSSQL (вводная статья)](https://ghostbasenji.github.io/post/edutest-intro/)
* [EduTest: проектирование и архитектура проекта](https://ghostbasenji.github.io/post/edutest-theory/)