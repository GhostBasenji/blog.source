+++
title = "Часть 2. Структура проекта и подготовка архитектуры проекта ASP.NET Core Web API (.NET 8)"

series = "praktika-s-aspnet-core-web-api-dotnet-8"

date = "2026-05-25"

categories = [
    "backend"
    ]

tags = [
  "aspnet-core",
  "dotnet-backend",
  "web-api",
  "csharp"
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

![](https://i.postimg.cc/d01dd8g0/0004.png)

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

![](https://i.postimg.cc/0NQmmphQ/0005.png)

Visual Studio создаст файл:

```txt
SystemController.cs
```

![](https://i.postimg.cc/Bv6DDxRt/0006.png)

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

![](https://i.postimg.cc/QMt55pvF/0007.png)

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

![](https://i.postimg.cc/Bv6DDxRL/0008.png)

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
