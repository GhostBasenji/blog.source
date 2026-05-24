+++
title = "Создание проекта ASP.NET Core Web API (.NET 8)"

series = "praktika-s-aspnet-core-web-api-dotnet-8"

date = "2026-05-24"

categories = [
    "backend"
    ]

tags = [
  "aspnet-core",
  "dotnet-backend",
  "web-api"
]
+++

## Создание проекта

В этой статье мы создадим основу для нашего проекта **TaskHub API** на .NET 8. Подготовим чистую структуру проекта, удалим шаблонный код, познакомимся с основными файлами и убедимся, что API готово к дальнейшей разработке.

### Что мы сделаем

- создадим ASP.NET Core Web API проект;
- подготовим правильную структуру solution;
- удалим шаблонный код;
- запустим Swagger;
- подготовим проект к следующим частям серии.

---

## Основная часть

### Создаём solution

Для начала создадим solution.

Откройте терминал и выполните команду:

```bash
mkdir TaskHub
cd TaskHub

dotnet new sln -n TaskHub
```

После этого создастся solution:

```txt
TaskHub.sln
```

---

### Создаём структуру проекта

Сразу будем придерживаться структуры, близкой к реальным проектам.

Создадим папку `src`:

```bash
mkdir src
cd src
```

Теперь создадим Web API проект:

```bash
dotnet new webapi -n TaskHub.Api
```

Переходим обратно в корень solution:

```bash
cd ..
```

Добавляем проект в solution:

```bash
dotnet sln add ./src/TaskHub.Api/TaskHub.Api.csproj
```

Структура проекта теперь выглядит так:

```txt
TaskHub/
│── src/
│   └── TaskHub.Api/
│
└── TaskHub.sln
```

Почему именно так?

Такая структура помогает масштабировать проект. Позже мы сможем без проблем добавить:

```txt
src/TaskHub.Application
src/TaskHub.Infrastructure
tests/TaskHub.Api.Tests
```

без необходимости болезненного рефакторинга.

---

### Первый запуск проекта

Запускаем API:

```bash
cd src/TaskHub.Api

dotnet run
```

После запуска в терминале появится адрес приложения.

Откройте браузер:

```txt
https://localhost:xxxx/swagger
```

Должен открыться Swagger UI.

![](https://i.postimg.cc/sDyV9c0n/0002.png)

Swagger позволяет тестировать API прямо в браузере и автоматически показывает доступные endpoints.

Пока ничего настраивать не будем — используем стандартную конфигурацию.

---

### Удаляем шаблонный код

По умолчанию ASP.NET Core Web API создаёт демонстрационный код, который нам не нужен.

Удаляем:

- `WeatherForecast.cs`
- демонстрационный endpoint
- `WeatherForecastController.cs` (если используется шаблон с Controllers)

После очистки откроем `Program.cs`.

Оставим минимальную рабочую конфигурацию:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.Run();
```

Коротко разберём, что здесь важно:

- `builder.Services` — регистрация сервисов в Dependency Injection;
- `AddControllers()` — подключает API-контроллеры;
- `AddSwaggerGen()` — включает Swagger/OpenAPI;
- `MapControllers()` — сообщает приложению, что нужно использовать controllers;
- Swagger работает только в режиме `Development`.

После очистки снова запустите проект:

```bash
dotnet run
```

Swagger должен открыться, но endpoints уже будут пустыми — это нормально.

![](https://i.postimg.cc/X73Vc8Ds/0003.png)

---

### Разбираем структуру проекта

Теперь кратко посмотрим на основные файлы.

```txt
TaskHub.Api/
│── Controllers/
│── Properties/
│── appsettings.json
│── appsettings.Development.json
│── Program.cs
```

### Controllers/

Здесь будут находиться API-контроллеры.

Например:

```txt
ProjectsController
TasksController
UsersController
CommentsController
```

### Properties/

Содержит служебные настройки запуска.

### appsettings.json

Основной конфигурационный файл приложения.

Позже здесь будут:

- connection strings;
- JWT settings;
- logging;
- application settings.

### appsettings.Development.json

Конфигурация только для режима разработки.

### Program.cs

Главный файл конфигурации приложения в .NET 8.

Здесь настраивается:

- Dependency Injection;
- middleware pipeline;
- Swagger;
- authentication;
- database services.

---

## Что важно понимать

- Мы специально удалили шаблонный код — реальные API лучше начинать с чистой структуры.
- `TaskHub.Api` — это только API слой. Позже структура станет больше.
- Swagger помогает быстро тестировать endpoints.
- `Program.cs` — основной файл конфигурации приложения.
- После первой статьи проект уже находится в рабочем состоянии.

---

## Результат

После этой статьи у нас:

✅ Создан solution `TaskHub`

✅ Создан Web API проект `TaskHub.Api`

✅ Настроена правильная структура проекта

✅ Работает Swagger

✅ Удалён шаблонный код

✅ Подготовлена база для следующих частей серии

---

## Вопросы для самопроверки

1. Почему мы используем `src/` в структуре проекта?
2. Для чего нужен Swagger?
3. Почему мы удалили `WeatherForecast`?
4. Что делает `MapControllers()`?
5. Почему Swagger включён только в режиме `Development`?

---

## Что дальше

В следующей части подготовим структуру проекта для дальнейшего роста: создадим папки, определим соглашения по именованию и заложим основу архитектуры TaskHub API.

Ссылка на репозиторий: [TaskHub](https://github.com/GhostBasenji/TaskHub)
