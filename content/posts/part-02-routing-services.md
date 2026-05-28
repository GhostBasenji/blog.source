+++
title = "Часть 2. Атрибутный роутинг, HTTP-методы и сервисный слой"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-05-28"

categories = [
    "backend"
    ]

tags = [
  "aspnet-core",
  "csharp",
  "dotnet-backend",
  "web-api",
  "vs-code",
  "net9"
]
+++

В прошлой части мы создал проект и получили первый JSON-ответ. Сейчас разберемся с тем, как правильно строить маршруты, как работают HTTP-методы и зачем выносить логику из контроллера в отдельный сервис.

---

## Добавление список персонажей

До сих пор в контроллере был один-единственный персонаж. Заменяем его на список — это нужно, чтобы было удобно демонстрировать разные методы.

Открываем `Controllers/CharacterController.cs` в VS Code и меняем поле `knight` на:

```csharp
private static List<Character> characters =
[
    new Character(),
    new Character { Id = 1, Name = "Sam" }
];
```

`List<Character>` — типизированный список. Он хранит только объекты типа `Character` и не даст добавить туда что-то другое. Компилятор проверит это за нас.

`[...]` — новый краткий синтаксис инициализации коллекций в C# 12. Раньше писали `new List<Character> { ... }`, теперь просто `[...]`. Результат одинаковый.

Обновляем метод `Get()`, чтобы он возвращал весь список:

```csharp
[HttpGet]
public IActionResult Get()
{
    return Ok(characters);
}
```

Проверяем в Bruno — `GET /character` теперь возвращает массив из двух персонажей.

![](https://i.postimg.cc/vB2RcVKx/gb006.png)

---

## Первая ошибка роутинга

А теперь добавим второй метод — для получения одного конкретного персонажа:

```csharp
public IActionResult GetSingle()
{
    return Ok(characters[0]);
}
```

Запускаю, делаю запрос — и получаю ошибку:

```
AmbiguousMatchException: The request matched multiple endpoints.
```

ASP.NET не знает, какой из двух GET-методов вызвать: оба не имеют параметров и оба отвечают на GET. Это и называется **неоднозначным совпадением маршрутов**.

Решение — явно указать разные маршруты через **атрибутный роутинг**. Добавляю строку в атрибут первого метода:

```csharp
[HttpGet("GetAll")]
public IActionResult Get()
{
    return Ok(characters);
}
```

Теперь:
- `GET /character` → первый персонаж (метод `GetSingle`)
- `GET /character/GetAll` → весь список (метод `Get`)

Строка `"GetAll"` внутри `[HttpGet(...)]` — это суффикс, добавляемый к базовому маршруту контроллера `/character`. Я могу написать там любую строку, вложенный путь, или — как увидим дальше — параметр.

![](https://i.postimg.cc/sXHFvhLB/gb007.png)

---

## Роутинг с параметрами — получение персонажа по Id

Хочу передавать Id прямо в URL: `GET /character/1` → персонаж с Id = 1. Для этого добавляю параметр в фигурных скобках в маршрут:

```csharp
[HttpGet("{id}")]
public IActionResult GetSingle(int id)
{
    return Ok(characters.FirstOrDefault(c => c.Id == id));
}
```

Здесь сразу несколько новых вещей.

**`{id}` в маршруте** — плейсхолдер. Когда приходит запрос `GET /character/1`, ASP.NET видит, что `1` соответствует `{id}`, и автоматически передаёт это значение в параметр метода `int id`. Имя в фигурных скобках **обязательно должно совпадать** с именем аргумента метода — иначе значение не передастся.

**`FirstOrDefault`** — метод из **LINQ** (Language Integrated Query). LINQ — это встроенный в C# механизм для работы с коллекциями: поиск, фильтрация, сортировка, трансформация. Примерно как SQL, только прямо в коде на C#. `FirstOrDefault` возвращает первый элемент, удовлетворяющий условию, или `null`, если ни один не подошёл.

**`c => c.Id == id`** — лямбда-выражение, условие для `FirstOrDefault`. Читается так: «для каждого элемента `c` проверь, равен ли `c.Id` переданному `id`». `c` — это каждый элемент списка по очереди, имя произвольное. Лямбда — это маленькая анонимная функция, написанная прямо внутри вызова метода.

Проверяю:
- `GET /character/1` → Сэм
- `GET /character/0` → Фродо

![](https://i.postimg.cc/JnYwGkFD/gb008.png)

> 💡 Если передать несуществующий Id, `FirstOrDefault` вернёт `null`, и мы отдадим `200 OK` с пустым телом. Это неправильно — нужно возвращать `404 Not Found`. Исправим позже, когда будем добавлять правильную обработку ошибок.

---

## HTTP-методы и CRUD

Прежде чем писать POST — разберу четыре основных HTTP-метода, которые буду использовать в этой серии.

**HTTP** (HyperText Transfer Protocol) — протокол, по которому клиенты и серверы обмениваются данными в интернете. В нём определены **методы запроса** — они указывают серверу, что именно хочет сделать клиент.

Четыре основных метода соответствуют четырём базовым операциям с данными — **CRUD**:

```txt

| HTTP-метод |            Что делает        | CRUD-операция | Где передаются данные |
|------------|------------------------------|---------------|-----------------------|
| `GET`      | Получить данные              |   Read        |       В URL           |
| `POST`     | Создать новый объект         |   Create      | В теле запроса (JSON) |
| `PUT`      | Обновить существующий объект |   Update      | В теле запроса (JSON) |
| `DELETE`   | Удалить объект               |   Delete      |       В URL           |
```

**GET** — только чтение. Данные передаются через URL: либо как часть пути (`/character/1`), либо как query-параметры (`/character?name=Frodo`). Тело запроса не используется.

**POST** — создание. Клиент отправляет новый объект в теле запроса в формате JSON. Сервер его получает и сохраняет (в памяти или в базе данных).

**PUT** — обновление. Клиент отправляет изменённый объект целиком, сервер заменяет старую запись. Если, например, нужно только поменять имя персонажа — всё равно отправляется весь объект.

**DELETE** — удаление. Достаточно передать Id через URL — тело не нужно.

Важный момент: **фреймворк ничего не делает автоматически**. Я сам пишу, что происходит внутри каждого метода. Можно написать GET, который удаляет данные — никто не запретит. Но это нарушение общепринятых соглашений REST: клиенты ожидают предсказуемого поведения, и нарушать эти ожидания — плохая практика.

---

## POST — добавляем персонаж

```csharp
[HttpPost]
public IActionResult AddCharacter(Character newCharacter)
{
    characters.Add(newCharacter);
    return Ok(characters);
}
```

Параметр `Character newCharacter` — ASP.NET автоматически берёт тело запроса (JSON) и **десериализует** его в объект `Character`. Десериализация — это преобразование из JSON-текста в C#-объект. Всё происходит автоматически благодаря атрибуту `[ApiController]`.

Тестирую в Bruno:
- Метод: `POST`
- URL: `http://localhost:5084/character`
- Вкладка **Body** → **raw** → тип **JSON**

```json
{
    "id": 3,
    "name": "Percival"
}
```

![](https://i.postimg.cc/zB2mVgQR/gb009.png)

Нажимаю Send — в ответе получаю весь список с добавленным Персивалем. Поля, которые я не указал в JSON (`hitPoints`, `strength` и т.д.), получат значения по умолчанию из модели.

> ⚠️ Данные хранятся только в памяти. После перезапуска приложения список сбрасывается к исходным двум персонажам. Постоянное хранение — в следующих частях, когда подключим базу данных.

---

## Зачем нужен сервисный слой

Сейчас вся логика живёт прямо в контроллере — и список персонажей, и поиск, и добавление. Для трёх методов это терпимо. Но в реальном приложении контроллер быстро разрастётся, а одну и ту же логику придётся копировать в разные места.

Правильный подход — разделить ответственности:

- **Контроллер** принимает запрос и возвращает ответ. Больше ничего.
- **Сервис** делает всю реальную работу: ищет данные, обращается к базе, считает что-то нужное.

Для связи контроллера с сервисом используется **Dependency Injection** (DI, внедрение зависимостей). Контроллер не создаёт сервис сам через `new CharacterService()` — он просто объявляет: «мне нужен сервис такого-то типа». Фреймворк сам создаёт нужный объект и передаёт его в контроллер. Это называется **инверсией управления**: не класс управляет своими зависимостями, а фреймворк управляет за него.

Польза очевидна: если завтра нужно сменить реализацию сервиса (например, перейти с хранения в памяти на базу данных), меняется **одна строка** в конфигурации — контроллер об этом даже не узнает.

Ещё стоит упомянуть **DTO (Data Transfer Object)** — объекты для передачи данных. Сейчас я использую модель `Character` напрямую и для приёма данных от клиента, и для отдачи. В реальных проектах это разделяют: модель отражает структуру таблицы в БД, а DTO — то, что мы реально хотим принять или отдать. Например, поле `DateCreated` нужно хранить в базе, но показывать клиенту его незачем — DTO это контролирует. Подробно разберём в следующей части.

---

## Создаю сервис

### Структура папок

В VS Code создаю: папку `Services`, а внутри неё — `CharacterService`.

![](https://i.postimg.cc/hjZFfdYx/gb010.png)

### Интерфейс `ICharacterService.cs`

Правый клик на папке `CharacterService` → **New File** → `ICharacterService.cs`.

```csharp
namespace dotnet_rpg.Services.CharacterService;

public interface ICharacterService
{
    List<Character> GetAllCharacters();
    Character? GetCharacterById(int id);
    List<Character> AddCharacter(Character newCharacter);
}
```

**Интерфейс** — это контракт. Он описывает, какие методы должны быть у любого класса, который его реализует. Сам по себе интерфейс ничего не делает — в нём нет реализации, только сигнатуры методов.

Зачем интерфейс, а не сразу класс? Контроллер будет зависеть от интерфейса, а не от конкретного класса. Это значит, что реализацию можно поменять в любой момент — контроллер не заметит разницы.

`Character?` — знак вопроса означает, что метод может вернуть `null`. При включённом `<Nullable>enable</Nullable>` это нужно указывать явно.

> 💡 Если VS Code подчёркивает `Character` как неизвестный тип — нужно добавить `using dotnet_rpg.Models;`. Наведите на ошибку, нажмите на лампочку 💡 или `Ctrl+.` и выберите нужный `using` из предложений.

### Реализация `CharacterService.cs`

```csharp
using dotnet_rpg.Models;

namespace dotnet_rpg.Services.CharacterService;

public class CharacterService : ICharacterService
{
    private static List<Character> characters =
    [
        new Character(),
        new Character { Id = 1, Name = "Sam" }
    ];

    public List<Character> GetAllCharacters()
    {
        return characters;
    }

    public Character? GetCharacterById(int id)
    {
        return characters.FirstOrDefault(c => c.Id == id);
    }

    public List<Character> AddCharacter(Character newCharacter)
    {
        characters.Add(newCharacter);
        return characters;
    }
}
```

`CharacterService : ICharacterService` — класс реализует интерфейс. Если в классе не хватает какого-то метода из интерфейса, VS Code сразу покажет ошибку.

> 💡 Можно навести на название класса, нажать `Ctrl+.` и выбрать **Implement interface** — редактор автоматически создаст заглушки всех методов.

---

## Регистрируем сервис в Program.cs

Открываю `Program.cs` и добавляю одну строку после `AddControllers()`:

```csharp
using dotnet_rpg.Services.CharacterService;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));

builder.Services.AddScoped<ICharacterService, CharacterService>();

// ... остальное без изменений
```

`AddScoped<ICharacterService, CharacterService>()` говорит DI-контейнеру: «когда кто-то просит `ICharacterService` — дай ему `CharacterService`».

`AddScoped` — означает, что новый экземпляр сервиса создаётся для каждого HTTP-запроса. Есть ещё два варианта:

```txt
| Метод          |  Когда создаётся экземпляр               |
|----------------|------------------------------------------|
| `AddScoped`    | Один раз на HTTP-запрос                  |
| `AddTransient` | Каждый раз при обращении к DI-контейнеру |
| `AddSingleton` | Один раз на всё время жизни приложения   |
```
Для большинства сервисов `AddScoped` — правильный выбор.

---

## Обновляем контроллер

Убираю из контроллера всю логику и список персонажей — они теперь живут в сервисе. Контроллер получает сервис через конструктор:

```csharp
using dotnet_rpg.Models;
using dotnet_rpg.Services.CharacterService;
using Microsoft.AspNetCore.Mvc;

namespace dotnet_rpg.Controllers;

[ApiController]
[Route("[controller]")]
public class CharacterController : ControllerBase
{
    private readonly ICharacterService _characterService;

    public CharacterController(ICharacterService characterService)
    {
        _characterService = characterService;
    }

    [HttpGet("GetAll")]
    public IActionResult Get()
    {
        return Ok(_characterService.GetAllCharacters());
    }

    [HttpGet("{id}")]
    public IActionResult GetSingle(int id)
    {
        return Ok(_characterService.GetCharacterById(id));
    }

    [HttpPost]
    public IActionResult AddCharacter(Character newCharacter)
    {
        return Ok(_characterService.AddCharacter(newCharacter));
    }
}
```

**Конструктор** `CharacterController(ICharacterService characterService)` — ASP.NET видит, что контроллеру нужен `ICharacterService`, находит зарегистрированный `CharacterService` в DI-контейнере, создаёт его и передаёт сюда. Всё автоматически.

**`private readonly ICharacterService _characterService`** — поле для хранения ссылки на сервис. `readonly` означает: после конструктора это поле нельзя переприсвоить — защита от случайных ошибок. Подчёркивание `_` перед именем — принятое соглашение для приватных полей в C#.

Запускаю приложение и проверяю в Bruno все три маршрута:

- `GET /character/GetAll` → список персонажей ✓
- `GET /character/1` → Сэм ✓
- `POST /character` с JSON-телом → добавление персонажа ✓

Всё работает так же, как раньше — но код теперь правильно организован.

---

## Итог

Разобрался с атрибутным роутингом: как задавать суффиксы маршрутов и передавать параметры через URL. Изучил четыре основных HTTP-метода и их связь с CRUD-операциями. Добавил POST для создания персонажа. Познакомился с LINQ и лямбда-выражениями. Вынес логику в отдельный сервис через dependency injection и интерфейс.

В следующей части: переведём все методы на `async/await`, разберём DTO и зачем они нужны, добавим AutoMapper, PUT и DELETE.

---

*Следующая часть: Асинхронные вызовы, Data Transfer Objects и AutoMapper.*
