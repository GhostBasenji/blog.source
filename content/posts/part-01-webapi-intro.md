+++
title = "Часть 1. Создаём проект и первый контроллер в ASP.NET Core Web API (.NET 9)"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-05-24"

categories = [
    "backend"
    ]

tags = [
  "aspnet-core",
  "dotnet-backend",
  "web-api",
  "vs-code"
]
+++

Это мой конспект по освоению ASP.NET Core Web API. Начинаю с нуля — буду фиксировать всё, что кажется важным или неочевидным.

Цель серии "Быстрый старт: ASP.NET Web API + Entity Framework" — построить небольшой бэкенд для текстовой RPG: персонажи, боёвка, аутентификация, база данных. Небольшой, но достаточно реальный, чтобы разобраться со стеком.

---

## Что такое Web API и зачем это нужно

Прежде чем запускать VS Code, нужно понять, что именно мы строим и как оно работает.

**Web API** — это программа, которая живёт на сервере и отвечает на запросы по сети. Клиент (браузер, мобильное приложение, Postman) отправляет запрос — сервер отвечает данными, обычно в формате JSON.

Представим это так: клиент задаёт вопрос, сервер отвечает.

```txt
Клиент                          Сервер (наш Web API)
  |                                      |
  |  GET /character/1                    |
  |  "дай мне персонажа с Id=1"          |
  | -----------------------------------> |
  |                                      |  ищет персонажа
  |                                      |  в базе данных
  |  { "name": "Frodo", "class": 1 }     |
  | <----------------------------------- |
```

На этом принципе работает большинство современных приложений: фронтенд (то, что видит пользователь) общается с бэкендом (наш Web API) через такие запросы. Бэкенд хранит данные, обрабатывает логику и отвечает клиенту.

---

## Что понадобится

Всё это бесплатно и работает на Windows, macOS и Linux.

- [.NET 9 SDK](https://dotnet.microsoft.com/download) — сам фреймворк. Проверить установку: `dotnet --version`
- [VS Code](https://code.visualstudio.com/) — редактор кода
- Расширение [C# Dev Kit](https://marketplace.visualstudio.com/items?itemName=ms-dotnettools.csdevkit) для VS Code — подсветка синтаксиса, автодополнение, навигация по коду
- [Bruno](https://www.usebruno.com/) — программа для отправки HTTP-запросов к нашему API

![](https://i.postimg.cc/15fZLbGh/gb001.png)

---

## Создаём проект

Запускаем VS Code. Встроенный терминал открывается через меню **Terminal → New Terminal** или сочетанием клавиш `` Ctrl+` ``.

В терминале:

```bash
mkdir dotnet-rpg
cd dotnet-rpg
dotnet new webapi
```

Команда `dotnet new webapi` создаёт новый проект по шаблону Web API. После выполнения VS Code, скорее всего, предложит открыть папку — соглашаемся. Также появится уведомление с предложением добавить файлы для отладки — тоже соглашаемся, это создаст папку `.vscode` с нужными настройками.

![](https://i.postimg.cc/Nf5wWZ1W/gb002.png)

---

## Структура проекта

После создания проекта в боковой панели VS Code (Explorer) вижу такой набор файлов:

```txt
dotnet-rpg/
├── .vscode/               ← настройки отладки для VS Code
├── Controllers/
│   └── WeatherForecastController.cs   ← демо-контроллер из шаблона (который может и не быть)
├── Properties/
│   └── launchSettings.json   ← настройки запуска
├── appsettings.json           ← конфигурация приложения
├── appsettings.Development.json
├── dotnet-rpg.csproj         ← файл проекта
├── Program.cs                ← точка входа приложения
└── WeatherForecast.cs        ← демо-модель из шаблона (которая может и не быть)
```

Разберу самые важные файлы.

### `Program.cs` — точка входа

Это главный файл приложения. Именно отсюда всё начинается при запуске.

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

Файл делится на две логические части:

**До `builder.Build()`** — здесь мы регистрируем **сервисы**. Сервис — это любой класс, который выполняет какую-то работу и который мы хотим переиспользовать в разных частях приложения. По мере развития проекта сюда добавятся Entity Framework, JWT-аутентификация, AutoMapper и другое.

**После `builder.Build()`** — здесь настраивается **конвейер запросов** (middleware pipeline). Каждый входящий HTTP-запрос проходит через цепочку обработчиков по порядку. `UseHttpsRedirection`, `UseAuthorization`, `MapControllers` — это и есть такие обработчики. Цепочку можно представить так:

```txt
HTTP-запрос
     ↓
UseHttpsRedirection   ← перенаправляет http → https
     ↓
UseAuthorization      ← проверяет права доступа
     ↓
MapControllers        ← передаёт запрос нужному контроллеру
     ↓
HTTP-ответ
```

### `dotnet-rpg.csproj` — файл проекта

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net9.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
```

Две важные настройки:

`<Nullable>enable</Nullable>` — компилятор будет следить за тем, чтобы мы явно обрабатывали возможность `null`. Например, если метод может вернуть «ничего», нужно явно это указать через `?`. Это дисциплинирует и помогает избежать целого класса ошибок.

`<ImplicitUsings>enable</ImplicitUsings>` — стандартные пространства имён подключаются автоматически. Не нужно в каждом файле вручную писать `using System;`, `using System.Collections.Generic;` и т.д.

### `Properties/launchSettings.json` — настройки запуска

Здесь указаны профили запуска и порты. По умолчанию есть профиль `http` и `https`. На этапе разработки буду использовать `http` — не нужно возиться с сертификатами:

```bash
dotnet run --launch-profile http
```

### `appsettings.json`

Конфигурация приложения. Позже сюда пойдут строка подключения к базе данных и секрет для JWT-токенов.

---

## Паттерн MVC

ASP.NET Web API построен на паттерне **MVC** — Model, View, Controller. Это способ организовать код так, чтобы каждая часть отвечала за своё.

```txt
                    HTTP-запрос
                         ↓
              ┌─────────────────────┐
              │     Controller      │  принимает запрос,
              │  CharacterController│  вызывает логику,
              └─────────┬───────────┘  возвращает ответ
                        │
              ┌─────────▼───────────┐
              │        Model        │  данные: имя, здоровье,
              │      Character      │  класс персонажа
              └─────────┬───────────┘
                        │
              ┌─────────▼───────────┐
              │        View         │  в Web API — это JSON,
              │   { "name": ... }   │  который уходит клиенту
              └─────────────────────┘
```

- **Model** — данные. В нашем случае — персонаж RPG с именем, здоровьем и классом.
- **View** — в случае API это не HTML-страница, а JSON-ответ, который получает клиент.
- **Controller** — обрабатывает входящий HTTP-запрос, обращается к данным и возвращает ответ.

В этой серии View как такового нет — вместо него Bruno, который будет показывать JSON-ответы. Основная работа будет с моделями и контроллерами.

---

## Создаю модели

В боковой панели VS Code (Explorer) создаю папку `Models` — правый клик на корне проекта → **New Folder**.

![](https://i.postimg.cc/hPfqHNLF/gb003.png)

### `Models/RpgClass.cs`

Правый клик на папке `Models` → выбираем **New C#** → выбираем **Enum** и задаем имя `RpgClass.cs`.

```csharp
namespace dotnet_rpg.Models;

public enum RpgClass
{
    Knight = 1,
    Mage = 2,
    Cleric = 3
}
```

`enum` — это перечисление, фиксированный набор именованных значений. Вместо того чтобы везде писать число `1` и помнить, что это рыцарь, я пишу `RpgClass.Knight` — и сразу понятно.

Числа присвоены явно, начиная с `1` — чтобы `0` не означал ни один из классов. Это пригодится позже при работе с базой данных.

### `Models/Character.cs`

```csharp
namespace dotnet_rpg.Models;

public class Character
{
    public int Id { get; set; }
    public string Name { get; set; } = "Frodo";
    public int HitPoints { get; set; } = 100;
    public int Strength { get; set; } = 10;
    public int Defense { get; set; } = 10;
    public int Intelligence { get; set; } = 10;
    public RpgClass Class { get; set; } = RpgClass.Knight;
}
```

Несколько вещей, которые стоит отметить:

**`{ get; set; }`** — это автосвойство в C#. Оно позволяет читать и записывать значение поля. Это стандартный способ объявить свойства модели.

**Значения по умолчанию** (`= "Frodo"`, `= 100` и т.д.) — удобны для тестов: не нужно каждый раз заполнять объект вручную. Любое поле, которое не указано при создании, получит эти значения.

**`= "Frodo"` для строки** — это не просто пример. Поскольку в проекте включён `<Nullable>enable</Nullable>`, компилятор знает: `string Name` без `?` — это строка, которая никогда не должна быть `null`. Если не присвоить начальное значение, компилятор выдаст предупреждение. Именно поэтому пишу `= "Frodo"`.

---

## Создаю контроллер

Правый клик на папке `Controllers` → **New C#** → → выбираем **Api Controller** и задаем имя `CharacterController.cs`.

```csharp
using dotnet_rpg.Models;
using Microsoft.AspNetCore.Mvc;

namespace dotnet_rpg.Controllers;

[ApiController]
[Route("[controller]")]
public class CharacterController : ControllerBase
{
    private static Character knight = new Character();

    [HttpGet]
    public IActionResult Get()
    {
        return Ok(knight);
    }
}
```

Разберемся по частям.

**`[ApiController]`** — атрибут, который говорит ASP.NET: «этот класс — API-контроллер». Он включает несколько удобных вещей: автоматическую валидацию входящих данных, понятные сообщения об ошибках при некорректном теле запроса, и обязательное использование атрибутного роутинга.

**`[Route("[controller]")]`** — определяет базовый URL этого контроллера. `[controller]` — специальный плейсхолдер, который заменяется на имя класса без слова `Controller`. Наш класс называется `CharacterController`, значит он будет доступен по адресу `/character`.

**`: ControllerBase`** — наш контроллер наследует базовый класс `ControllerBase`. Именно он даёт нам вспомогательные методы: `Ok()`, `NotFound()`, `BadRequest()` и другие — те самые, которые формируют HTTP-ответ.

**`IActionResult`** — тип возвращаемого значения. Он позволяет вернуть HTTP-ответ с любым нужным статус-кодом и телом. `Ok(knight)` — это `200 OK` с объектом `knight`, сериализованным в JSON.

**`[HttpGet]`** — атрибут, который указывает: этот метод отвечает на GET-запросы.

---

## Запускаю и проверяю

В терминале VS Code:

```bash
dotnet run --launch-profile http
```

В консоли появится адрес, например:

```
Now listening on: http://localhost:5000
```

Открываю Bruno. Создаю новый запрос:
- Метод: `GET`
- URL: `http://localhost:5084/character`
- Нажимаю **Send**

![](https://i.postimg.cc/Dy8KtRq9/gb004.png)

Ответ:

```json
{
    "id": 0,
    "name": "Frodo",
    "hitPoints": 100,
    "strength": 10,
    "defense": 10,
    "intelligence": 10,
    "class": 1
}
```

![](https://i.postimg.cc/65yNDFrN/gb005.png)

Работает. Но обращаем внимание: `"class": 1` — возвращается число, а не строка `"Knight"`. Это поведение по умолчанию. Исправить просто — добавляю в `Program.cs`:

```csharp
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));
```

После этого `"class"` будет возвращаться как `"Knight"` — читать ответы сразу приятнее.

---

## Итог

Создал Web API проект на .NET 9, разобрался со структурой `Program.cs` и паттерном MVC, написал первую модель `Character` и контроллер с одним GET-методом, получил первый JSON-ответ через Bruno.

В следующей части: разберу атрибутный роутинг, добавлю несколько HTTP-методов, познакомлюсь с LINQ и вынесу логику в отдельный сервис через dependency injection.

---

*Следующая часть: Атрибутный роутинг, HTTP-методы и сервисный слой.*
