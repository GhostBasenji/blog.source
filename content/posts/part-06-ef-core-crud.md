+++
title = "Часть 6. Полный CRUD через Entity Framework Core"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-05"

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
  "ef-core",
  "mssql"
]
+++

В прошлой части я подключил базу данных и создал таблицу `Characters` через миграцию. Теперь обновляю сервис — вместо хранения данных в памяти все операции будут идти через Entity Framework в настоящую базу данных.

---

## Внедряем DataContext в сервис

Открываю `Services/CharacterService/CharacterService.cs`. Сейчас там статический список `characters` — его нужно убрать и вместо него использовать `DataContext`.

Внедряю `DataContext` через конструктор:

```csharp
using AutoMapper;
using dotnet_rpg.Data;
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Models;
using Microsoft.EntityFrameworkCore;

namespace dotnet_rpg.Services.CharacterService;

public class CharacterService : ICharacterService
{
    private readonly IMapper _mapper;
    private readonly DataContext _context;

    public CharacterService(IMapper mapper, DataContext context)
    {
        _mapper = mapper;
        _context = context;
    }
    
    // методы будем обновлять дальше
}
```

Теперь `_context` доступен во всех методах сервиса. Статический список `characters` удаляю — он больше не нужен.

---

## GET — получаем всех персонажей из базы

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters()
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    var dbCharacters = await _context.Characters.ToListAsync();
    serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(dbCharacters);
    return serviceResponse;
}
```

`_context.Characters` — это `DbSet<Character>`, то самое свойство из `DataContext`. Обращение к нему — это как SQL-запрос `SELECT * FROM Characters`.

`ToListAsync()` — асинхронно выполняет запрос и возвращает список. Именно здесь наконец появляется настоящий `await` — потому что идёт реальное обращение к базе данных по сети. Предупреждения компилятора про `async без await` теперь исчезнут.

Запускаю приложение и проверяю в Bruno — `GET /character/GetAll` возвращает пустой список, потому что таблица ещё пустая. Это нормально — данных мы ещё не добавляли.

![](https://i.postimg.cc/rFNhrtC6/gb025.png)

---

## GET — получаем одного персонажа

```csharp
public async Task<ServiceResponse<GetCharacterDto>> GetCharacterById(int id)
{
    var serviceResponse = new ServiceResponse<GetCharacterDto>();
    var dbCharacter = await _context.Characters.FirstOrDefaultAsync(c => c.Id == id);
    serviceResponse.Data = _mapper.Map<GetCharacterDto>(dbCharacter);
    return serviceResponse;
}
```

`FirstOrDefaultAsync` — асинхронная версия `FirstOrDefault`. Выполняет SQL-запрос `SELECT TOP 1 * FROM Characters WHERE Id = @id`. Entity Framework сам строит SQL из нашей лямбды — это и есть LINQ to Entities.

---

## POST — добавляем персонажа в базу

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> AddCharacter(AddCharacterDto newCharacter)
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    var character = _mapper.Map<Character>(newCharacter);
    _context.Characters.Add(character);
    await _context.SaveChangesAsync();
    serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(
        await _context.Characters.ToListAsync());
    return serviceResponse;
}
```

Здесь два важных шага, которых раньше не было.

**`_context.Characters.Add(character)`** — добавляет объект в **трекер изменений** Entity Framework. Это ещё не запись в базу — EF просто запоминает, что этот объект нужно будет вставить. Сам по себе `Add` синхронный — нет смысла в `AddAsync` для обычных случаев.

**`await _context.SaveChangesAsync()`** — вот здесь происходит реальная запись в базу данных. EF смотрит на всё, что накопилось в трекере изменений, строит нужные SQL-запросы (`INSERT`, `UPDATE`, `DELETE`) и выполняет их. Этот вызов — критически важный: без него изменения не сохранятся.

> ⚠️ `SaveChangesAsync` нужно вызывать после **каждой** операции изменения данных (добавление, обновление, удаление). Если забыть — данные не сохранятся, но ошибки не будет.

После сохранения Id у персонажа будет автоматически заполнен SQL Server — Entity Framework прочитает его и запишет обратно в объект.

Тестируем в Bruno — `POST /character`:

```json
{
    "name": "Frodo",
    "hitPoints": 100,
    "class": "Knight"
}
```

![](https://i.postimg.cc/GhxMysPW/gb026.png)

В ответе Фродо получил Id = 1 — SQL Server сам его назначил.

---

## PUT — обновляем персонажа в базе

```csharp
public async Task<ServiceResponse<GetCharacterDto>> UpdateCharacter(UpdateCharacterDto updatedCharacter)
{
    var serviceResponse = new ServiceResponse<GetCharacterDto>();
    try
    {
        var character = await _context.Characters
            .FirstOrDefaultAsync(c => c.Id == updatedCharacter.Id)
            ?? throw new Exception($"Персонаж с Id '{updatedCharacter.Id}' не найден.");

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

Entity Framework **отслеживает** объекты, которые были получены из базы через `_context`. Когда мы вызвали `FirstOrDefaultAsync`, EF запомнил этот объект. После того как мы изменили его через AutoMapper, EF знает что он изменился. Достаточно вызвать `SaveChangesAsync()` — и EF сам построит нужный `UPDATE`-запрос.

Нам не нужно явно вызывать `_context.Characters.Update(character)` — хотя можно. EF и без этого увидит изменения через трекер. Но если объект был получен не через EF (например, создан вручную через `new`), то `Update` нужен явно.

Тестирую в Bruno — `PUT /character`:

```json
{
    "id": 1,
    "name": "Frodo Baggins",
    "hitPoints": 120,
    "strength": 8,
    "defense": 12,
    "intelligence": 15,
    "class": "Knight"
}
```

![](https://i.postimg.cc/QxJ6TWkG/gb027.png)

---

## DELETE — удаляем персонажа из базы

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> DeleteCharacter(int id)
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    try
    {
        var character = await _context.Characters.FirstOrDefaultAsync(c => c.Id == id)
            ?? throw new Exception($"Персонаж с Id '{id}' не найден.");

        _context.Characters.Remove(character);
        await _context.SaveChangesAsync();

        serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(
            await _context.Characters.ToListAsync());
    }
    catch (Exception ex)
    {
        serviceResponse.Success = false;
        serviceResponse.Message = ex.Message;
    }
    return serviceResponse;
}
```

`_context.Characters.Remove(character)` — помечает объект для удаления в трекере изменений. `SaveChangesAsync()` — выполняет `DELETE FROM Characters WHERE Id = @id`.

Тестирую в Bruno — `DELETE /character/1`:

![](https://i.postimg.cc/PrQ6w8bB/gb028.png)

---

## Полный код CharacterService

Для удобства — весь файл целиком после всех изменений:

```csharp
using AutoMapper;
using dotnet_rpg.Data;
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Models;
using Microsoft.EntityFrameworkCore;

namespace dotnet_rpg.Services.CharacterService;

public class CharacterService : ICharacterService
{
    private readonly IMapper _mapper;
    private readonly DataContext _context;

    public CharacterService(IMapper mapper, DataContext context)
    {
        _mapper = mapper;
        _context = context;
    }

    public async Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters()
    {
        var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
        var dbCharacters = await _context.Characters.ToListAsync();
        serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(dbCharacters);
        return serviceResponse;
    }

    public async Task<ServiceResponse<GetCharacterDto>> GetCharacterById(int id)
    {
        var serviceResponse = new ServiceResponse<GetCharacterDto>();
        var dbCharacter = await _context.Characters.FirstOrDefaultAsync(c => c.Id == id);
        serviceResponse.Data = _mapper.Map<GetCharacterDto>(dbCharacter);
        return serviceResponse;
    }

    public async Task<ServiceResponse<List<GetCharacterDto>>> AddCharacter(AddCharacterDto newCharacter)
    {
        var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
        var character = _mapper.Map<Character>(newCharacter);
        _context.Characters.Add(character);
        await _context.SaveChangesAsync();
        serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(
            await _context.Characters.ToListAsync());
        return serviceResponse;
    }

    public async Task<ServiceResponse<GetCharacterDto>> UpdateCharacter(UpdateCharacterDto updatedCharacter)
    {
        var serviceResponse = new ServiceResponse<GetCharacterDto>();
        try
        {
            var character = await _context.Characters
                .FirstOrDefaultAsync(c => c.Id == updatedCharacter.Id)
                ?? throw new Exception($"Персонаж с Id '{updatedCharacter.Id}' не найден.");

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

    public async Task<ServiceResponse<List<GetCharacterDto>>> DeleteCharacter(int id)
    {
        var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
        try
        {
            var character = await _context.Characters.FirstOrDefaultAsync(c => c.Id == id)
                ?? throw new Exception($"Персонаж с Id '{id}' не найден.");

            _context.Characters.Remove(character);
            await _context.SaveChangesAsync();
            serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(
                await _context.Characters.ToListAsync());
        }
        catch (Exception ex)
        {
            serviceResponse.Success = false;
            serviceResponse.Message = ex.Message;
        }
        return serviceResponse;
    }
}
```

---

## Итог

Теперь все данные хранятся в настоящей базе данных. Персонажи не исчезают после перезапуска приложения. Разобрался с трекером изменений EF — почему `Add` и `Remove` нужно всегда завершать `SaveChangesAsync()`. Предупреждения компилятора про `async без await` исчезли — теперь есть настоящие асинхронные вызовы к базе данных.

Так выглядит полный путь данных сейчас:

```txt
Bruno (HTTP-запрос)
  |
  ↓
CharacterController
  |
  | DTO
  ↓ 
CharacterService
  |
  | Entity Framework Core
  ↓ 
DataContext → SQL Server (таблица Characters)
  ↑
  | данные из БД
  ↓ 
CharacterService
  | 
  | AutoMapper → DTO
  ↓ 
CharacterController
  |
  | JSON
  ↓ 
Bruno (HTTP-ответ)
```

В следующей части добавим **пользователей** и реализуем **аутентификацию** — регистрацию и вход через логин/пароль.

---

*Следующая часть: Аутентификация пользователей — регистрация, хэширование пароля и первая связь между таблицами.*
