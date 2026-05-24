+++
title = "Часть 1. Подготовка структуры проекта ASP.NET Core Web API (.NET 8)"

series = "praktika-s-aspnet-core-web-api-dotnet-8"

date = "2026-05-25"

categories = [
    "backend"
    ]

tags = [
  "aspnet-core",
  "dotnet-backend",
  "web-api"
]
+++

В прошлой части мы создали проект **TaskHub API**, удалили шаблонный код и подготовили чистую основу. Теперь сделаем следующий шаг — начнём формировать структуру проекта и создадим первый API endpoint.

Пока не будем усложнять архитектуру и добавлять лишние сущности. Наша цель — сохранить проект чистым, понятным и готовым к дальнейшему развитию.

## Что мы сделаем

- подготовим базовую структуру проекта;
- создадим папку `Models`;
- создадим первый controller;
- добавим endpoint для проверки работы API;
- убедимся, что Swagger отображает endpoint.

---

## Основная часть

### Создаём папку Models

Для начала подготовим место, где позже будут находиться модели нашего приложения.

В **Visual Studio**:

1. Нажмите правой кнопкой мыши на проект `TaskHub.Api`
2. Выберите:

```txt
Add → New Folder
```

3. Назовите папку:

```txt
Models
```

Пока она будет пустой — это нормально.

**Скриншот №1**   (0004)
Solution Explorer после создания папки `Models`.

---

### Создаём первый controller

Теперь создадим первый API controller.

В **Visual Studio**:

1. Нажмите правой кнопкой по папке `Controllers`
2. Выберите:

```txt
Add → Controller
```

3. Выберите:

```txt
API Controller - Empty
```

4. Нажмите **Add**
5. Назовите controller:

```txt
SystemController
```

Visual Studio создаст файл:

```txt
SystemController.cs
```

**Скриншот №2**  (0005)
Окно выбора controller template.

**Скриншот №3**  (0006)
`SystemController.cs` в Solution Explorer.

---

### Добавляем первый endpoint

Откройте `SystemController.cs` и замените содержимое файла на:

```csharp
using Microsoft.AspNetCore.Mvc;

namespace TaskHub.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SystemController : ControllerBase
{
    [HttpGet("ping")]
    public IActionResult Ping()
    {
        return Ok("TaskHub API is running");
    }
}
```

Кратко разберём, что здесь происходит.

### `[ApiController]`

Сообщает ASP.NET Core, что это API controller.

### `[Route("api/[controller]")]`

Определяет маршрут controller.

В нашем случае:

```txt
api/system
```

### `[HttpGet("ping")]`

Создаёт GET endpoint:

```txt
GET /api/system/ping
```

### `Ok()`

Возвращает HTTP-ответ со статусом:

```txt
200 OK
```

---

### Запускаем проект

Теперь запускаем приложение.

В **Visual Studio** нажмите:

```txt
F5
```

или кнопку:

```txt
▶ HTTPS
```

После запуска откройте Swagger.

Должен появиться новый endpoint:

```txt
GET /api/system/ping
```

**Скриншот №4**  (0007)
Swagger с endpoint `GET /api/system/ping`.

Нажмите:

```txt
Try it out
```

Затем:

```txt
Execute
```

В ответе должно появиться:

```txt
TaskHub API is running
```

**Скриншот №5**  (0008)
Успешный ответ endpoint.

---

### Текущая структура проекта

Теперь проект выглядит так:

```txt
TaskHub/
│── src/
│   └── TaskHub.Api/
│       │── Controllers/
│       │   └── SystemController.cs
│       │
│       │── Models/
│       │
│       │── Properties/
│       │── appsettings.json
│       │── appsettings.Development.json
│       │── Program.cs
│
│── TaskHub.sln
```

Пока структура остаётся простой — и это хорошо.

Мы не создаём папки «на будущее», которые пока не используются. По мере развития проекта постепенно добавим:

```txt
Data/
DTOs/
Services/
```

ровно тогда, когда они действительно понадобятся.

---

## Что важно понимать

- Мы начали формировать структуру проекта постепенно.
- `Models` будет содержать сущности приложения.
- Первый controller помогает проверить, что API работает корректно.
- Swagger автоматически отображает новые endpoints.
- Проект по-прежнему остаётся простым и полностью рабочим.

---

## Результат

После этой статьи у нас:

✅ Подготовлена базовая структура проекта

✅ Добавлена папка `Models`

✅ Создан первый controller

✅ Работает endpoint:

```txt
GET /api/system/ping
```

✅ Swagger отображает endpoint

✅ Проект остаётся чистым и готовым к развитию

---

## Вопросы для самопроверки

1. Для чего используется папка `Models`?
2. Что делает атрибут `[ApiController]`?
3. Как работает `[Route("api/[controller]")]`?
4. Что делает `Ok()`?
5. Какой endpoint мы создали в этой части?

---

## Что дальше

В следующей части начнём создавать первые модели для нашего TaskHub API и постепенно подготовимся к работе с базой данных.

---

Ссылка на [репозиторий проекта TaskHub](https://github.com/GhostBasenji/TaskHub)