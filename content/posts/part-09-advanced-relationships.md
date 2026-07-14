+++
title = "Часть 9. Привязка персонажей к пользователям и Include в EF Core"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-12"

categories = [
    "backend"
    ]

tags = [
  "aspnet-core",
  "csharp",
  "dotnet-backend",
  "web-api",
  "vs-code",
  "entityframework",
  "ef-core"
]
+++

В прошлой части настроил JWT и фильтрацию персонажей по `userId`, который передавался параметром в каждый метод сервиса. Это работает, но неудобно — параметр приходится тащить через весь стек вызовов. Сейчас уберу его и получу текущего пользователя прямо внутри сервиса. Также свяжу создаваемых персонажей с их владельцем и разберусь с важной особенностью EF Core — почему связанные данные иногда не подгружаются.

---

## Проблема: userId передаётся повсюду

Сейчас в `GetAllCharacters(int userId)` параметр прилетает из контроллера, который вычисляет его из Claims токена. Но, а что, если мне нужен `userId` и в `AddCharacter`, и в `UpdateCharacter`, и в `DeleteCharacter`? Придётся в контроллере вычислять его четыре раза и передавать в каждый метод.

Более удобный способ — получать текущего пользователя прямо внутри сервиса через `IHttpContextAccessor`.

---

## IHttpContextAccessor — доступ к текущему запросу из любого сервиса

**`IHttpContextAccessor`** — это сервис ASP.NET, который даёт доступ к данным текущего HTTP-запроса (включая аутентифицированного пользователя) из любого места в коде, а не только из контроллера.

Регистрирую в `Program.cs`:

```csharp
builder.Services.AddHttpContextAccessor();
```

> 💡 В .NET 9 это просто метод-расширение `AddHttpContextAccessor()` — он сам регистрирует нужный сервис как singleton под капотом. В .NET Core 3.1 это приходилось делать вручную через `AddSingleton<IHttpContextAccessor, HttpContextAccessor>()`.

Singleton здесь оправдан: сам accessor — это обёртка, которая каждый раз обращается к текущему контексту через специальный механизм (`AsyncLocal`). Создавать новый экземпляр на каждый запрос смысла не имеет.

---

## Внедрение IHttpContextAccessor в CharacterService

Открываю `CharacterService.cs` и добавляю в конструктор:

```csharp
using System.Security.Claims;
using Microsoft.AspNetCore.Http;

private readonly IMapper _mapper;
private readonly DataContext _context;
private readonly IHttpContextAccessor _httpContextAccessor;

public CharacterService(IMapper mapper, DataContext context, IHttpContextAccessor httpContextAccessor)
{
    _mapper = mapper;
    _context = context;
    _httpContextAccessor = httpContextAccessor;
}
```

Добавляю приватный метод-помощник:

```csharp
private int GetUserId() =>
    int.Parse(_httpContextAccessor.HttpContext!.User
        .FindFirstValue(ClaimTypes.NameIdentifier)!);
```

Что он делает? Читает Id текущего пользователя из JWT-токена. Вместо того чтобы писать эту длинную строку в каждом методе — вынесли её один раз сюда, и теперь везде просто пишем GetUserId().

`_httpContextAccessor.HttpContext` — текущий HTTP-контекст. `.User` — тот же `ClaimsPrincipal`, что мы видели в контроллере. `FindFirstValue(...)` — удобный метод-расширение, который находит первый claim нужного типа и сразу возвращает строковое значение (без обёртки `Claim`, как было с `.FirstOrDefault(...).Value`).

`!` после `HttpContext` и после результата `FindFirstValue` — подавляем предупреждения nullable. Мы уверены, что внутри защищённого `[Authorize]`-метода контекст и claim точно есть.

Теперь убираю параметр `userId` из интерфейса и реализации:

```csharp
public interface ICharacterService
{
    Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters();
    // остальные методы без изменений
}
```

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters()
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    var dbCharacters = await _context.Characters
        .Where(c => c.User!.Id == GetUserId())
        .ToListAsync();
    serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(dbCharacters);
    return serviceResponse;
}
```

И упрощаю контроллер — он больше не вычисляет `userId`:

```csharp
[HttpGet("GetAll")]
public async Task<IActionResult> Get()
{
    return Ok(await _characterService.GetAllCharacters());
}
```

Логика переехала туда, где она реально нужна — в сервис. Контроллер снова стал тонким.

---

## Привязка персонажа к пользователю при создании

Сейчас при создании персонажа поле `User` остаётся `null`. Исправляю `AddCharacter`:

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> AddCharacter(AddCharacterDto newCharacter)
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    var character = _mapper.Map<Character>(newCharacter);
    character.User = await _context.Users.FirstOrDefaultAsync(u => u.Id == GetUserId());

    _context.Characters.Add(character);
    await _context.SaveChangesAsync();

    serviceResponse.Data = await _context.Characters
        .Where(c => c.User!.Id == GetUserId())
        .Select(c => _mapper.Map<GetCharacterDto>(c))
        .ToListAsync();
    return serviceResponse;
}
```

Два изменения. Во-первых, явно находим пользователя по Id из токена и присваиваем его персонажу — EF Core увидит эту связь и заполнит `UserId` при сохранении.

Во-вторых, в конце возвращаю не всех персонажей, а только тех, что принадлежат текущему пользователю — иначе после создания клиент увидит персонажей чужих пользователей, что и небезопасно, и просто неверно с точки зрения логики приложения.

Тестирую в Bruno — `POST /character`:

```json
{
    "name": "Raistlin",
    "class": "Mage",
    "intelligence": 20,
    "strength": 5,
    "defense": 5
}
```

![](https://i.postimg.cc/zX83bNsL/gb036.png)

---

## Фильтруем GetCharacterById и DeleteCharacter по пользователю

Дополняю условие лямбды второй проверкой — Id персонажа **и** принадлежность текущему пользователю:

```csharp
public async Task<ServiceResponse<GetCharacterDto>> GetCharacterById(int id)
{
    var serviceResponse = new ServiceResponse<GetCharacterDto>();
    var dbCharacter = await _context.Characters
        .FirstOrDefaultAsync(c => c.Id == id && c.User!.Id == GetUserId());
    serviceResponse.Data = _mapper.Map<GetCharacterDto>(dbCharacter);
    return serviceResponse;
}
```

Если персонаж с таким Id принадлежит другому пользователю — условие не сработает, `FirstOrDefaultAsync` вернёт `null`, и клиент получит пустой ответ. Чужой персонаж как бы не существует для этого пользователя — и это правильное поведение с точки зрения безопасности.

То же самое в `DeleteCharacter`:

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> DeleteCharacter(int id)
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    try
    {
        var character = await _context.Characters
            .FirstOrDefaultAsync(c => c.Id == id && c.User!.Id == GetUserId())
            ?? throw new Exception($"Персонаж с Id '{id}' не найден.");

        _context.Characters.Remove(character);
        await _context.SaveChangesAsync();

        serviceResponse.Data = await _context.Characters
            .Where(c => c.User!.Id == GetUserId())
            .Select(c => _mapper.Map<GetCharacterDto>(c))
            .ToListAsync();
    }
    catch (Exception ex)
    {
        serviceResponse.Success = false;
        serviceResponse.Message = ex.Message;
    }
    return serviceResponse;
}
```

Попытка удалить чужого персонажа приведёт к тому, что `FirstOrDefaultAsync` не найдёт его (условие `User.Id == GetUserId()` не выполнится) — и сработает та же ветка `?? throw`, что и для несуществующего Id. С точки зрения пользователя оба случая выглядят одинаково: «персонаж не найден» — и это нормально, мы не хотим намекать атакующему, что персонаж существует, но принадлежит кому-то другому.

---

## Include — почему связанные данные иногда не подгружаются

Обновляю `UpdateCharacter`. На первый взгляд можно просто проверить владельца после получения персонажа:

```csharp
var character = await _context.Characters
    .FirstOrDefaultAsync(c => c.Id == updatedCharacter.Id)
    ?? throw new Exception($"Персонаж с Id '{updatedCharacter.Id}' не найден.");

if (character.User!.Id != GetUserId())
{
    throw new Exception("Персонаж не найден.");
}
```

Но если запустить это — получим `NullReferenceException` на строке с `character.User!.Id`. Несмотря на то, что у персонажа точно есть `UserId` в базе данных, свойство `character.User` оказывается `null`.

Дело в особенности Entity Framework: когда мы делаем `_context.Characters.FirstOrDefaultAsync(...)`, EF подгружает **только сами поля таблицы Characters**. Связанные данные (объект `User`) по умолчанию **не загружаются** — это называется **lazy loading не включён по умолчанию** (если точнее — в EF Core это называется явная загрузка через `Include`, в отличие от автоматической ленивой загрузки в некоторых других ORM).

Если связанный объект нужен — его нужно запросить явно через метод `Include`:

```csharp
var character = await _context.Characters
    .Include(c => c.User)
    .FirstOrDefaultAsync(c => c.Id == updatedCharacter.Id)
    ?? throw new Exception($"Персонаж с Id '{updatedCharacter.Id}' не найден.");
```

`Include(c => c.User)` — говорит EF Core: «выполни JOIN с таблицей Users и заполни свойство `User` целиком». Теперь `character.User` будет реальным объектом, а не `null`.

> 💡 Эта особенность EF Core ловит почти всех новичков хотя бы раз. Запомнить просто: если в запросе нужно обратиться к свойству, которое представляет связанную таблицу (а не простое поле вроде `int` или `string`), — добавляй `Include`.

Полный метод обновления:

```csharp
public async Task<ServiceResponse<GetCharacterDto>> UpdateCharacter(UpdateCharacterDto updatedCharacter)
{
    var serviceResponse = new ServiceResponse<GetCharacterDto>();
    try
    {
        var character = await _context.Characters
            .Include(c => c.User)
            .FirstOrDefaultAsync(c => c.Id == updatedCharacter.Id)
            ?? throw new Exception($"Персонаж с Id '{updatedCharacter.Id}' не найден.");

        if (character.User!.Id != GetUserId())
        {
            throw new Exception($"Персонаж с Id '{updatedCharacter.Id}' не найден.");
        }

        _mapper.Map(updatedCharacter, character);
        await _context.SaveChangesAsync();
        serviceResponse.Data = _mapper.Map<GetCharacterDto>(character);
    }
    catch (Exception ex)
    {
        serviceResponse.Success = false;
        serviceResponse.Message = ex.Message;
    }
    return serviceResponse;
}
```

Сообщение об ошибке одинаковое и для «персонаж не найден», и для «персонаж принадлежит другому» — по той же причине, что и в `DeleteCharacter`.

---

## Тестирую разделение между пользователями

Регистрирую второго пользователя — `POST /auth/register`:

```json
{
    "username": "testuser",
    "password": "123456"
}
```

Вхожу под ним, создаю персонажа с пустым телом запроса (получится дефолтный Фродо), и проверяю `GetAll` — должен вернуться только этот один персонаж, а не персонажи первого пользователя.

![](https://i.postimg.cc/BQ4tL3rL/gb037.png)

Пробую обновить или удалить персонажа первого пользователя, будучи вошедшим как второй — должен прийти ответ «персонаж не найден».

![gb038.png](https://i.postimg.cc/15BXDTSy/gb038.png)

---

## Итог

Перенёс получение текущего пользователя из контроллера прямо в сервис через `IHttpContextAccessor` — это убрало повторяющийся код передачи `userId`. Привязал создаваемых персонажей к их владельцу. Все CRUD-операции теперь учитывают, кому принадлежит персонаж — пользователь не может видеть, обновлять или удалять чужих персонажей. Разобрался с одной из самых частых ловушек EF Core: связанные объекты не загружаются автоматически, для этого нужен `Include`.

В следующей части: добавим оружие персонажу — это будет связь один-к-одному, и разберём, чем она отличается от один-ко-многим, которую мы только что построили.

---

*Следующая часть: Связь один-к-одному — добавляем оружие персонажу.*
