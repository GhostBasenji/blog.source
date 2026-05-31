+++
title = "Часть 3. Асинхронные вызовы, DTO и AutoMapper"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-05-29"

categories = [
    "backend"
    ]

tags = [
  "aspnet-core",
  "csharp",
  "dotnet-backend",
  "web-api",
  "vs-code",
  "ef-core"  
]
+++

В прошлой части я вынес логику в сервис и научился работать с несколькими HTTP-методами. Сейчас разберу три важные темы: почему методы должны быть асинхронными, что такое DTO и зачем нужен AutoMapper.

---

## Зачем нужен async/await

Пока что все мои методы работают синхронно. Это значит: пришёл запрос — поток (thread) занят, обрабатывает его, и всё это время не может взять другой запрос. Пока данных мало и всё хранится в памяти, это незаметно. Но как только появится база данных, картина изменится.

Обращение к базе данных — это медленная операция: нужно отправить запрос, подождать ответа по сети, получить данные. Во время этого ожидания поток просто стоит и ничего не делает. Если одновременно придут сто таких запросов — сто потоков будут стоять и ждать.

Асинхронность решает эту проблему: поток не ждёт, а «отпускается» — идёт брать другой запрос. Когда данные из базы готовы, поток возвращается и продолжает работу.

```txt
Синхронный:                          Асинхронный:
                                   
Запрос 1 → [поток занят⏳]           Запрос 1 → поток ушёл в БД
Запрос 2 → [ждёт...]                 Запрос 2 → тот же поток берёт второй
Запрос 3 → [ждёт...]                 Запрос 3 → и третий
                                     БД ответила → поток завершает запрос 1
```

В C# асинхронность строится на двух ключевых словах: `async` и `await`.

- **`async`** — помечает метод как асинхронный. Такой метод может «приостанавливаться» в ожидании чего-то.
- **`await`** — говорит: «подожди здесь результата, но не блокируй поток — отпусти его». Выполнение метода продолжится, когда результат будет готов.
- **`Task<T>`** — это тип возвращаемого значения асинхронного метода. `Task<List<Character>>` означает: «обещаю вернуть список персонажей, но не прямо сейчас — чуть позже».

Важно: прямо сейчас, пока данные хранятся в памяти, `await` нам особо не нужен — мы ничего не ждём. Но перепишем код заранее, чтобы потом не переделывать, когда подключим базу данных.

---

## Переписываем интерфейс на async

Открываю `Services/CharacterService/ICharacterService.cs` и меняем все возвращаемые типы:

```csharp
namespace dotnet_rpg.Services.CharacterService;

public interface ICharacterService
{
    Task<List<Character>> GetAllCharacters();
    Task<Character?> GetCharacterById(int id);
    Task<List<Character>> AddCharacter(Character newCharacter);
}
```

Каждый метод теперь возвращает `Task<...>` вместо просто `...`. Это означает: метод асинхронный, результат придёт позже.

### Реализация в `CharacterService.cs`

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

    public async Task<List<Character>> GetAllCharacters()
    {
        return characters;
    }

    public async Task<Character?> GetCharacterById(int id)
    {
        return characters.FirstOrDefault(c => c.Id == id);
    }

    public async Task<List<Character>> AddCharacter(Character newCharacter)
    {
        characters.Add(newCharacter);
        return characters;
    }
}
```

VS Code, скорее всего, покажет предупреждение: «асинхронный метод не содержит `await` — он выполнится синхронно». Это нормально — пока мы работаем с данными в памяти, `await` действительно не нужен. Когда добавим Entity Framework, там появятся настоящие асинхронные вызовы и предупреждение исчезнет.

### Обновляем контроллер

```csharp
[HttpGet("GetAll")]
public async Task<IActionResult> Get()
{
    return Ok(await _characterService.GetAllCharacters());
}

[HttpGet("{id}")]
public async Task<IActionResult> GetSingle(int id)
{
    return Ok(await _characterService.GetCharacterById(id));
}

[HttpPost]
public async Task<IActionResult> AddCharacter(Character newCharacter)
{
    return Ok(await _characterService.AddCharacter(newCharacter));
}
```

Каждый метод теперь помечен `async`, возвращает `Task<IActionResult>`, и использует `await` при вызове сервиса. Паттерн простой: где раньше был просто вызов метода, теперь `await` перед ним.

Проверяем — всё работает как раньше. Внешне ничего не изменилось: те же маршруты, те же ответы. Изменилось внутреннее устройство.

![](https://i.postimg.cc/fyqF4dDk/gb011.png)


## Что такое DTO и зачем они нужны

Сейчас я использую класс `Character` напрямую и для приёма данных от клиента, и для отправки ответа. Это удобно, пока модель простая. Но со временем это становится проблемой.

Представим ситуацию: в модели `Character` появилось поле `UserId` — ссылка на пользователя, которому принадлежит персонаж. Это поле нужно хранить в базе, но показывать клиенту его не нужно и даже вредно (это внутренняя информация). Или другой сценарий: при создании персонажа клиент не должен задавать `Id` — его назначает сервер. Но если принимать `Character` напрямую, клиент может передать любой `Id` и переписать чужие данные.

**DTO (Data Transfer Object)** — это отдельный класс, который описывает именно то, что нужно принять или отдать. Не всю модель целиком, а только нужные поля.

```txt
Клиент                    API                     База данных
  |                        |                           |
  |  { name, class }  →    |  AddCharacterDto          |
  |                        |       ↓                   |
  |                        |  Character (полная модель)|
  |                        |                    →      |
  |  { id, name, ... }  ←  |  GetCharacterDto          |
  |                        |                           |
```

Так контроль над входными и выходными данными оказывается в наших руках.

### Создаем DTO

В VS Code создаем папку `Dtos`, а внутри — `Character`. В папке `Dtos/Character` создаем два файла.

**`Dtos/Character/GetCharacterDto.cs`** — DTO для ответа:

```csharp
namespace dotnet_rpg.Dtos.Character;

public class GetCharacterDto
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

**`Dtos/Character/AddCharacterDto.cs`** — DTO для создания:

```csharp
namespace dotnet_rpg.Dtos.Character;

public class AddCharacterDto
{
    public string Name { get; set; } = "Frodo";
    public int HitPoints { get; set; } = 100;
    public int Strength { get; set; } = 10;
    public int Defense { get; set; } = 10;
    public int Intelligence { get; set; } = 10;
    public RpgClass Class { get; set; } = RpgClass.Knight;
}
```

Обращаем внимание: в `AddCharacterDto` нет поля `Id`. Клиент не должен его задавать — идентификатор назначит сервер (позже — база данных).

![](https://i.postimg.cc/QCYPL7ht/gb012.png)

## AutoMapper — автоматический маппинг между классами

Теперь у нас есть `AddCharacterDto` для входящих данных и `GetCharacterDto` для ответа. Но сервис работает с `Character`. Значит, нам нужно конвертировать данные:

- Входящий `AddCharacterDto` → создать `Character` и сохранить
- `Character` из базы → преобразовать в `GetCharacterDto` и отдать клиенту

Это называется **маппингом**. Можно делать вручную: создать новый объект и скопировать поля одно за другим. Но это скучно и легко допустить ошибку. **AutoMapper** делает это автоматически — по совпадению имён полей.

### Устанавливаем AutoMapper

В терминале VS Code:

```bash
dotnet add package AutoMapper
```

![](https://i.postimg.cc/GtgN0Ddt/gb013.png)

> 💡 Пакет добавится в файл `.csproj`. Можно открыть его и убедиться, что появилась строчка `<PackageReference Include="AutoMapper" .../>`.

### Создаем профиль маппинга

AutoMapper использует **профили** — классы, в которых описано, как маппировать один тип в другой. Создаем файл `AutoMapperProfile.cs` в корне проекта:

```csharp
using AutoMapper;
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Models;

namespace dotnet_rpg;

public class AutoMapperProfile : Profile
{
    public AutoMapperProfile()
    {
        CreateMap<Character, GetCharacterDto>();
        CreateMap<AddCharacterDto, Character>();
    }
}
```

`CreateMap<A, B>()` — говорит AutoMapper: «умей конвертировать объект типа `A` в тип `B`». AutoMapper сам сопоставляет поля по имени. Если поля называются одинаково — они маппируются автоматически, без дополнительной настройки.

### Регистрируем AutoMapper в Program.cs

```csharp
builder.Services.AddAutoMapper(cfg => cfg.AddProfile<AutoMapperProfile>());
```

`AddAutoMapper` принимает лямбду с объектом конфигурации `cfg`. Через `cfg.AddProfile<AutoMapperProfile>()` мы явно указываем, какой профиль использовать — тот самый класс, где прописаны все правила маппинга через `CreateMap<A, B>()`.
 
Добавляем в `Program.cs` рядом с остальными сервисами:

```csharp
using dotnet_rpg;
using dotnet_rpg.Services.CharacterService;
 
var builder = WebApplication.CreateBuilder(args);
 
builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));
 
builder.Services.AddAutoMapper(cfg => cfg.AddProfile<AutoMapperProfile>());
builder.Services.AddScoped<ICharacterService, CharacterService>();
```

### Обновляем интерфейс сервиса

Возвращаемые типы и параметры теперь используют DTO:

```csharp
using dotnet_rpg.Dtos.Character;

namespace dotnet_rpg.Services.CharacterService;

public interface ICharacterService
{
    Task<List<GetCharacterDto>> GetAllCharacters();
    Task<GetCharacterDto?> GetCharacterById(int id);
    Task<List<GetCharacterDto>> AddCharacter(AddCharacterDto newCharacter);
}
```

### Обновляем реализацию сервиса

Внедряем `IMapper` через конструктор и используем его для маппинга:

```csharp
using AutoMapper;
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Models;

namespace dotnet_rpg.Services.CharacterService;

public class CharacterService : ICharacterService
{
    private static List<Character> characters =
    [
        new Character(),
        new Character { Id = 1, Name = "Sam" }
    ];

    private readonly IMapper _mapper;

    public CharacterService(IMapper mapper)
    {
        _mapper = mapper;
    }

    public async Task<List<GetCharacterDto>> GetAllCharacters()
    {
        return _mapper.Map<List<GetCharacterDto>>(characters);
    }

    public async Task<GetCharacterDto?> GetCharacterById(int id)
    {
        var character = characters.FirstOrDefault(c => c.Id == id);
        return _mapper.Map<GetCharacterDto>(character);
    }

    public async Task<List<GetCharacterDto>> AddCharacter(AddCharacterDto newCharacter)
    {
        characters.Add(_mapper.Map<Character>(newCharacter));
        return _mapper.Map<List<GetCharacterDto>>(characters);
    }
}
```

`IMapper` — это интерфейс AutoMapper. Внедряется точно так же, как раньше `ICharacterService` во контроллер — через DI.

`_mapper.Map<TargetType>(sourceObject)` — конвертирует объект в нужный тип. AutoMapper видит, что в профиле зарегистрирован маппинг `Character → GetCharacterDto`, и автоматически копирует все совпадающие поля.

`_mapper.Map<List<GetCharacterDto>>(characters)` — AutoMapper умеет маппировать и коллекции целиком. Не нужно делать цикл вручную.

### Обновляем контроллер

Контроллер почти не меняется — только в `AddCharacter` параметр становится `AddCharacterDto`:

```csharp
using dotnet_rpg.Dtos.Character;
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
    public async Task<IActionResult> Get()
    {
        return Ok(await _characterService.GetAllCharacters());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetSingle(int id)
    {
        return Ok(await _characterService.GetCharacterById(id));
    }

    [HttpPost]
    public async Task<IActionResult> AddCharacter(AddCharacterDto newCharacter)
    {
        return Ok(await _characterService.AddCharacter(newCharacter));
    }
}
```

Запускаю и проверяю в Bruno. POST-запрос теперь не принимает `Id` — даже если его передать, он будет проигнорирован (в `AddCharacterDto` такого поля нет). GET-запросы возвращают те же данные, что и раньше.

![](https://i.postimg.cc/C5rty8SR/gb014.png)

## Итог

Разобрался с тремя важными концепциями. Асинхронность через `async/await` и `Task<T>` — почему это важно при работе с базами данных и как правильно писать код заранее. DTO — как разделить внутреннюю модель данных и то, что видит клиент. AutoMapper — как автоматически маппировать поля между классами, не копируя их вручную.

Теперь архитектура проекта выглядит так:

```txt
Клиент
  |
  | - AddCharacterDto (POST body)
  ↓ 
Controller
  |
  | - AddCharacterDto
  ↓ 
Service
  |
  | - маппинг через AutoMapper
  ↓ 
Character (внутренняя модель / позже — БД)
  |
  | - маппинг через AutoMapper
  ↓ 
GetCharacterDto
  | 
  ↓
Controller
  |
  | - JSON
  ↓ 
Клиент
```

В следующей части: будем добавлять методы PUT и DELETE, научимся правильно возвращать `404 Not Found` и обработаем ошибки.

---

*Следующая часть: Обновление и удаление персонажей — PUT, DELETE и обработка ошибок.*
