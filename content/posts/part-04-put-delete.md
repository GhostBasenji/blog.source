+++
title = "Часть 4. Обновление и удаление персонажей — PUT, DELETE и обработка ошибок"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-05-31"

categories = [
    "backend"
    ]

tags = [
  "aspnet-core",
  "csharp",
  "dotnet-backend",
  "web-api",
  "vs-code"
]
+++

В предыдущих частях мы научились создавать и получать персонажей. Теперь добавим оставшиеся две операции — обновление (PUT) и удаление (DELETE). Заодно разберемся с тем, как правильно обрабатывать ошибки и возвращать осмысленные HTTP-статусы.

---

## ServiceResponse — единый формат ответа

Пока что из сервиса возвращаются просто данные: `List<GetCharacterDto>`, `GetCharacterDto?`. Это работает, но у такого подхода есть слабое место — если что-то пошло не так (персонаж не найден, ошибка), у нас нет стандартного способа передать эту информацию контроллеру.

Введём обёртку — **`ServiceResponse<T>`**. Это универсальный класс, который будет возвращаться из любого метода сервиса. Он несёт в себе и данные, и статус операции, и сообщение об ошибке.

Создаю файл `Models/ServiceResponse.cs`:

```csharp
namespace dotnet_rpg.Models;

public class ServiceResponse<T>
{
    public T? Data { get; set; }
    public bool Success { get; set; } = true;
    public string Message { get; set; } = string.Empty;
}
```

`T` — это **generic-параметр** (обобщённый тип). Он позволяет использовать один класс для разных типов данных. `ServiceResponse<List<GetCharacterDto>>` — обёртка вокруг списка. `ServiceResponse<GetCharacterDto>` — обёртка вокруг одного персонажа. Сам класс один, а тип данных внутри меняется.

`Data` — полезная нагрузка, сами данные.
`Success` — флаг успеха, по умолчанию `true`.
`Message` — сообщение об ошибке или любой другой текст.

Теперь обновляем интерфейс сервиса, чтобы все методы возвращали `ServiceResponse<T>`.

---

## Обновление интерфейса и существующих методов

**`ICharacterService.cs`:**

```csharp
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Models;

namespace dotnet_rpg.Services.CharacterService;

public interface ICharacterService
{
    Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters();
    Task<ServiceResponse<GetCharacterDto>> GetCharacterById(int id);
    Task<ServiceResponse<List<GetCharacterDto>>> AddCharacter(AddCharacterDto newCharacter);
    Task<ServiceResponse<GetCharacterDto>> UpdateCharacter(UpdateCharacterDto updatedCharacter);
    Task<ServiceResponse<List<GetCharacterDto>>> DeleteCharacter(int id);
}
```

Методы `UpdateCharacter` и `DeleteCharacter` добавлю чуть ниже — сначала разберём новый DTO.

Обновляем существующие методы в **`CharacterService.cs`**, оборачивая результаты в `ServiceResponse`:

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters()
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(characters);
    return serviceResponse;
}

public async Task<ServiceResponse<GetCharacterDto>> GetCharacterById(int id)
{
    var serviceResponse = new ServiceResponse<GetCharacterDto>();
    var character = characters.FirstOrDefault(c => c.Id == id);
    serviceResponse.Data = _mapper.Map<GetCharacterDto>(character);
    return serviceResponse;
}

public async Task<ServiceResponse<List<GetCharacterDto>>> AddCharacter(AddCharacterDto newCharacter)
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    characters.Add(_mapper.Map<Character>(newCharacter));
    serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(characters);
    return serviceResponse;
}
```

Контроллер теперь будет получать `ServiceResponse<T>` и возвращать `response.Data` клиенту:

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
public async Task<IActionResult> AddCharacter(AddCharacterDto newCharacter)
{
    return Ok(await _characterService.AddCharacter(newCharacter));
}
```

Теперь ответ выглядит так:

```json
{
    "data": [ ... ],
    "success": true,
    "message": ""
}
```

Клиент всегда знает: есть ли данные, успешна ли операция, и если нет — почему.

---

## UpdateCharacterDto — DTO для обновления

Для обновления персонажа нужен ещё один DTO. В отличие от `AddCharacterDto`, здесь есть поле `Id` — нам нужно знать, какого именно персонажа обновлять.

Создаем `Dtos/Character/UpdateCharacterDto.cs`:

```csharp
namespace dotnet_rpg.Dtos.Character;

public class UpdateCharacterDto
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

Структура похожа на `GetCharacterDto`, но семантика другая: это данные, которые клиент присылает для изменения. Разные DTO — разная ответственность.

Добавляем маппинг в `AutoMapperProfile.cs`:

```csharp
CreateMap<Character, GetCharacterDto>();
CreateMap<AddCharacterDto, Character>();
CreateMap<UpdateCharacterDto, Character>();
```

---

## PUT — обновляем персонаж

### Реализация в сервисе

```csharp
public async Task<ServiceResponse<GetCharacterDto>> UpdateCharacter(UpdateCharacterDto updatedCharacter)
{
    var serviceResponse = new ServiceResponse<GetCharacterDto>();
    try
    {
        var character = characters.FirstOrDefault(c => c.Id == updatedCharacter.Id)
            ?? throw new Exception($"Персонаж с Id '{updatedCharacter.Id}' не найден.");

        _mapper.Map(updatedCharacter, character);

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

Здесь несколько интересных моментов.

**`?? throw new Exception(...)`** — оператор `??` называется null-coalescing. Он читается так: «если левая часть равна `null` — выполни правую». Если `FirstOrDefault` вернул `null` (персонаж не найден), сразу бросаем исключение с понятным сообщением. Это элегантнее, чем отдельная проверка через `if`.

**`_mapper.Map(updatedCharacter, character)`** — это перегрузка AutoMapper, которая копирует данные из `updatedCharacter` в уже существующий объект `character`, не создавая нового. Эффективнее и чище, чем копировать каждое поле вручную. Для этого нужно зарегистрировать маппинг `CreateMap<UpdateCharacterDto, Character>()` — я его уже добавил выше.

**`try/catch`** — блок для перехвата исключений. Код внутри `try` выполняется как обычно. Если где-то бросается исключение, управление переходит в `catch`. Там я записываю информацию об ошибке в `ServiceResponse` и возвращаю его — вместо того чтобы приложение падало с `500 Internal Server Error`.

### Метод в контроллере

```csharp
[HttpPut]
public async Task<IActionResult> UpdateCharacter(UpdateCharacterDto updatedCharacter)
{
    var response = await _characterService.UpdateCharacter(updatedCharacter);
    if (response.Data is null)
    {
        return NotFound(response);
    }
    return Ok(response);
}
```

Контроллер проверяет `response.Data`: если данных нет — значит что-то пошло не так, возвращаем `404 Not Found` с подробностями. Если всё хорошо — `200 OK`.

Важно понимать разницу между статус-кодами:
- `200 OK` — запрос выполнен успешно
- `404 Not Found` — ресурс не найден
- `400 Bad Request` — некорректные входные данные
- `500 Internal Server Error` — что-то сломалось на сервере

Возвращать `200 OK`, когда персонаж не найден — это вводить клиента в заблуждение. Правильный код помогает клиенту понять, что именно произошло.

### Проверяем в Bruno

![](https://i.postimg.cc/9FJt5H6T/gb015.png)

Создаем в Bruno новый запрос:
- Метод: `PUT`
- URL: `http://localhost:5000/character`
- Body → JSON:

```json
{
    "id": 1,
    "name": "Percival",
    "hitPoints": 200,
    "class": 2
}
```

![](https://i.postimg.cc/02cdR1TD/gb016.png)

Ответ:

```json
{
    "data": {
        "id": 1,
        "name": "Percival",
        "hitPoints": 200,
        "strength": 10,
        "defense": 10,
        "intelligence": 10,
        "class": "Mage"
    },
    "success": true,
    "message": ""
}
```

> ⚠️ Обраащаем внимание: мы передали только `name`, `hitPoints` и `class`, но не `strength`, `defense` и `intelligence`. PUT обновляет объект целиком — незаполненные поля получат значения по умолчанию из DTO (`= 10`). Если фронтенд не пришлёт текущие значения, они будут перезаписаны дефолтными. Это нужно учитывать при проектировании клиента.

Теперь пробую обновить несуществующего персонажа — передаю `"id": 99`:

![](https://i.postimg.cc/HsB4D1qQ/gb017.png)

```json
{
    "data": null,
    "success": false,
    "message": "Персонаж с Id '99' не найден."
}
```

Статус `404 Not Found`, тело содержит понятное сообщение. 

---

## DELETE — удаляем персонаж

### Реализация в сервисе

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> DeleteCharacter(int id)
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    try
    {
        var character = characters.First(c => c.Id == id);
        characters.Remove(character);
        serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(characters);
    }
    catch (Exception ex)
    {
        serviceResponse.Success = false;
        serviceResponse.Message = ex.Message;
    }
    return serviceResponse;
}
```

Здесь используется `First` вместо `FirstOrDefault`. Разница принципиальная:

```txt

|        Метод       |   Если не найдено   |
|--------------------|---------------------|
| `FirstOrDefault`   | Возвращает `null`   |
| `First`            | Бросает исключение  |
```

В данном случае `First` удобнее — если персонаж не найден, исключение автоматически попадёт в `catch`, и я запишу ошибку в `ServiceResponse`. Не нужно писать дополнительную проверку.

После удаления возвращаю оставшийся список персонажей — клиент сразу видит актуальное состояние.

### Метод в контроллере

```csharp
[HttpDelete("{id}")]
public async Task<IActionResult> Delete(int id)
{
    var response = await _characterService.DeleteCharacter(id);
    if (response.Data is null)
    {
        return NotFound(response);
    }
    return Ok(response);
}
```

`[HttpDelete("{id}")]` — Id передаётся прямо в URL, как в `GetSingle`. Тело запроса не нужно.

### Тестируем в Bruno

Создаем новый запрос в Bruno:
- Метод: `DELETE`
- URL: `http://localhost:5000/character/1`

![](https://i.postimg.cc/tC2tQGKF/gb018.png)
В ответе — только Фродо, Сэм удалён.

---

## Итог

Теперь у нас есть полный CRUD — Create (POST), Read (GET), Update (PUT), Delete (DELETE). Все операции работают через единый `ServiceResponse<T>`, который несёт данные, статус и сообщение. Контроллер проверяет результат и возвращает правильный HTTP-статус: `200 OK` при успехе, `404 Not Found` когда данные не найдены.

Финальный вид структуры проекта:

```txt
dotnet-rpg/
├── Controllers/
│   └── CharacterController.cs
├── Dtos/
│   └── Character/
│       ├── AddCharacterDto.cs
│       ├── GetCharacterDto.cs
│       └── UpdateCharacterDto.cs
├── Models/
│   ├── Character.cs
│   ├── RpgClass.cs
│   └── ServiceResponse.cs
├── Services/
│   └── CharacterService/
│       ├── ICharacterService.cs
│       └── CharacterService.cs
├── AutoMapperProfile.cs
└── Program.cs
```

В следующей части переходим к Entity Framework Core — подключим настоящую базу данных, уберём хранение данных в памяти и научимся делать Code First Migration.

---

*Следующая часть: Entity Framework Core, Code First Migration и подключение базы данных.*
