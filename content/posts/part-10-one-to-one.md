+++
title = "Часть 10. Связь один-к-одному: добавляем оружие персонажу"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-15"

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

В девятой части построил связь один-ко-многим между пользователями и персонажами. Теперь построю связь **один-к-одному**: у каждого персонажа может быть ровно одно оружие, и у каждого оружия — ровно один владелец. Также наткнусь на ту же ловушку с `Include`, что и в прошлый раз, но в новом контексте.

---

## Модель Weapon

Создаю `Models/Weapon.cs`:

```csharp
namespace dotnet_rpg.Models;

public class Weapon
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Damage { get; set; }
    public int CharacterId { get; set; }
    public Character? Character { get; set; }
}
```

Добавляю обратную ссылку в `Character.cs`:

```csharp
public Weapon? Weapon { get; set; }
```

Обратите внимание на `Character? Weapon` и `Weapon? Character` — оба свойства nullable. Это логично: персонаж может существовать без оружия, оружие не может существовать без персонажа (но пока EF об этом не знает).

Добавляю `DbSet` в `DataContext.cs`:

```csharp
public DbSet<Weapon> Weapons { get; set; }
```

---

## Первая попытка миграции — и ошибка

Запускаю:

```bash
dotnet ef migrations add Weapon
```

Получаю ошибку:

```bash
The child/dependent side could not be determined for the one-to-one
relationship between 'Character.Weapon' and 'Weapon.Character'. To
identify the child/dependent side of the relationship, configure the
foreign key property.
```

Смысл ошибки: EF Core видит, что `Character` ссылается на `Weapon`, а `Weapon` ссылается на `Character` — но не понимает, **в какой из двух таблиц должен быть внешний ключ**. При связи один-ко-многим это было очевидно (много персонажей → один `UserId` у каждого), а для один-к-одному обе стороны выглядят симметрично.

Нужно явно указать, какая сторона — **зависимая** (там будет внешний ключ), а какая — **главная**.

В нашем случае логично, что `Weapon` зависит от `Character`: оружие не может существовать без владельца. Указываю это, добавив явное поле внешнего ключа в `Weapon.cs`:

```csharp
public int CharacterId { get; set; }
```

> 💡 Это поле я уже добавил выше — обратите внимание, что без него ошибка повторится. По соглашению об именовании EF Core: `<ИмяСвязанногоКласса>Id` (`CharacterId`) автоматически распознаётся как внешний ключ к свойству `Character`. Эта же конвенция работала и в прошлой части с `UserId` в `Character`.

Запускаю миграцию снова:

```bash
dotnet ef migrations add Weapon
dotnet ef database update
```

Теперь всё проходит успешно.

---

## Что отличает один-к-одному от один-ко-многим в базе

Заглянем в файл миграции — там есть интересная деталь:

```csharp
migrationBuilder.CreateIndex(
    name: "IX_Weapons_CharacterId",
    table: "Weapons",
    column: "CharacterId",
    unique: true);  // ← вот это и есть один-к-одному
```

`unique: true` — это и есть техническая разница между связями. При один-ко-многим индекс на `UserId` в таблице `Characters` **не уникальный** — много персонажей могут иметь один и тот же `UserId`. При один-к-одному индекс на `CharacterId` в `Weapons` **уникальный** — у одного персонажа не может быть двух записей оружия.

```txt
One-to-Many (Users → Characters)        One-to-One (Characters → Weapon)
┌────┬──────────┐                       ┌────┬─────────────┬──────────┐
│ Id │ UserId   │  ← НЕ уникальный      │ Id │CharacterId  │  Name    │← уникальный
├────┼──────────┤                       ├────┼─────────────┼──────────┤
│  1 │    1     │                       │  1 │    5        │   Sword  │
│  2 │    1     │  ← оба персонажа      │  2 │    6        │   Axe    │
│  3 │    2     │   юзера 1             └────┴─────────────┴──────────┘
└────┴──────────┘                       Попытка вставить вторую запись
                                         с CharacterId=5 → ошибка БД
```

[![gb039.png](https://i.postimg.cc/zvN6c1mt/gb039.png)](https://postimg.cc/mzdmPJgC)

---

## WeaponService

Создаю папку `Services/WeaponService` и файл `IWeaponService.cs`:

```csharp
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Dtos.Weapon;

namespace dotnet_rpg.Services.WeaponService;

public interface IWeaponService
{
    Task<ServiceResponse<GetCharacterDto>> AddWeapon(AddWeaponDto newWeapon);
}
```

Интересно, что метод возвращает `GetCharacterDto`, а не `GetWeaponDto` — после добавления оружия нам удобнее получить обратно весь персонаж с этим оружием, чем только запись о самом оружии.

### DTO для оружия

`Dtos/Weapon/AddWeaponDto.cs`:

```csharp
namespace dotnet_rpg.Dtos.Weapon;

public class AddWeaponDto
{
    public string Name { get; set; } = string.Empty;
    public int Damage { get; set; }
    public int CharacterId { get; set; }
}
```

### Реализация WeaponService

```csharp
using System.Security.Claims;
using AutoMapper;
using dotnet_rpg.Data;
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Dtos.Weapon;
using dotnet_rpg.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace dotnet_rpg.Services.WeaponService;

public class WeaponService : IWeaponService
{
    private readonly DataContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IMapper _mapper;

    public WeaponService(DataContext context, IHttpContextAccessor httpContextAccessor, IMapper mapper)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
        _mapper = mapper;
    }

    public async Task<ServiceResponse<GetCharacterDto>> AddWeapon(AddWeaponDto newWeapon)
    {
        var response = new ServiceResponse<GetCharacterDto>();
        try
        {
            var userId = int.Parse(_httpContextAccessor.HttpContext!.User
                .FindFirstValue(ClaimTypes.NameIdentifier)!);

            var character = await _context.Characters
                .FirstOrDefaultAsync(c => c.Id == newWeapon.CharacterId && c.User!.Id == userId)
                ?? throw new Exception("Персонаж не найден.");

            var weapon = new Weapon
            {
                Name = newWeapon.Name,
                Damage = newWeapon.Damage,
                Character = character
            };

            _context.Weapons.Add(weapon);
            await _context.SaveChangesAsync();

            response.Data = _mapper.Map<GetCharacterDto>(character);
        }
        catch (Exception ex)
        {
            response.Success = false;
            response.Message = ex.Message;
        }
        return response;
    }
}
```

Несколько моментов.

**Проверка владельца** — находим персонажа сразу с условием `c.User!.Id == userId`. Это та же логика безопасности, что и в прошлой части: нельзя добавить оружие чужому персонажу.

**`weapon.Character = character`** — присваиваем сам объект персонажа, не Id. EF Core увидит эту связь и сам заполнит `CharacterId` при сохранении. Мы могли бы вместо этого написать `weapon.CharacterId = character.Id` — результат был бы тот же, но через объект нагляднее.

**`_context.Weapons.Add(weapon)`**, затем **`SaveChangesAsync()`** — стандартный паттерн, который мы уже видели много раз.

### WeaponController

```csharp
using dotnet_rpg.Dtos.Weapon;
using dotnet_rpg.Services.WeaponService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace dotnet_rpg.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class WeaponController : ControllerBase
{
    private readonly IWeaponService _weaponService;

    public WeaponController(IWeaponService weaponService)
    {
        _weaponService = weaponService;
    }

    [HttpPost]
    public async Task<IActionResult> AddWeapon(AddWeaponDto newWeapon)
    {
        return Ok(await _weaponService.AddWeapon(newWeapon));
    }
}
```

Отдельный контроллер для оружия — логично, поскольку это самостоятельная сущность со своим жизненным циклом, хоть и тесно связанная с персонажем.

> 💡 Альтернативный подход — добавить метод прямо в `CharacterController` с маршрутом вида `[HttpPost("{id}/weapon")]`, без отдельного `WeaponController`. Оба варианта рабочие; отдельный контроллер чище разделяет ответственность, но добавляет на один файл больше.

### Регистрация службы

```csharp
builder.Services.AddScoped<IWeaponService, WeaponService>();
```

---

## Тестирую в Bruno

Вхожу, получаю токен, и отправляю `POST /weapon` с заголовком `Authorization: Bearer ...`:

```json
{
    "name": "Меч судьбы",
    "damage": 15,
    "characterId": 3
}
```

[![gb040.png](https://i.postimg.cc/3NhVcHMc/gb040.png)](https://postimg.cc/zbdxy6GC)

В SSMS можно увидеть новую запись в таблице `Weapons` с правильным `CharacterId`.

Пробую добавить второе оружие тому же персонажу — `characterId: 3`:

```json
{
    "data": null,
    "success": false,
    "message": "An error occurred while saving the entity changes. See the inner exception for details."
}
```

[![gb041.png](https://i.postimg.cc/1XS2jZxb/gb041.png)](https://postimg.cc/62HM8gph)

Сообщение не самое информативное, но в логах VS Code будет точная причина:

```bash
Cannot insert duplicate key row in object 'dbo.Weapons' with unique index 'IX_Weapons_CharacterId'.
```

Это и есть работа уникального индекса — база данных физически не позволяет создать вторую запись с тем же `CharacterId`. Связь один-к-одному соблюдается на уровне СУБД, а не только в коде приложения.

---

## Почему оружие не отображается у персонажа — снова Include

Если сейчас вызвать `GET /character/GetAll`, оружие в ответе не появится — поле `Weapon` будет `null`, даже если оружие есть в базе.

Причина та же, что и в прошлой части: связанные объекты не подгружаются автоматически.

Сначала добавляю `GetWeaponDto` — отдельный DTO для оружия в ответе, без `Id` и без обратной ссылки на персонажа (чтобы не создавать циклическую структуру в JSON):

`Dtos/Weapon/GetWeaponDto.cs`:

```csharp
namespace dotnet_rpg.Dtos.Weapon;

public class GetWeaponDto
{
    public string Name { get; set; } = string.Empty;
    public int Damage { get; set; }
}
```

Добавляю свойство `Weapon` в `GetCharacterDto`:

```csharp
public class GetCharacterDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "Frodo";
    public int HitPoints { get; set; } = 100;
    public int Strength { get; set; } = 10;
    public int Defense { get; set; } = 10;
    public int Intelligence { get; set; } = 10;
    public RpgClass Class { get; set; } = RpgClass.Knight;
    public GetWeaponDto? Weapon { get; set; }
}
```

Регистрирую маппинг в `AutoMapperProfile.cs`:

```csharp
CreateMap<Weapon, GetWeaponDto>();
```

И теперь добавляю `Include(c => c.Weapon)` во все методы `CharacterService`, которые возвращают персонажей. Например, в `GetAllCharacters`:

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters()
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    var dbCharacters = await _context.Characters
        .Where(c => c.User!.Id == GetUserId())
        .Include(c => c.Weapon)
        .ToListAsync();
    serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(dbCharacters);
    return serviceResponse;
}
```

Аналогично добавляю `.Include(c => c.Weapon)` в `GetCharacterById`, `AddCharacter` (в финальном запросе на возврат списка) и `UpdateCharacter`.

Теперь ответ выглядит так:

```json
{
    "data": {
        "id": 1,
        "name": "Frodo",
        "hitPoints": 200,
        "strength": 10,
        "defense": 10,
        "intelligence": 10,
        "class": "Knight",
        "weapon": {
            "name": "Меч судьбы",
            "damage": 15
        }
    },
    "success": true,
    "message": ""
}
```

[![gb042.png](https://i.postimg.cc/vTykNdRj/gb042.png)](https://postimg.cc/ZBfwW25F)

> 💡 Это полезное правило для запоминания: **каждый раз, когда DTO ответа включает связанную сущность, в запросе должен быть соответствующий `Include`**. Если добавили новое связанное поле в DTO, но забыли `Include` — получите `null` вместо ошибки, что может остаться незамеченным.

---

## Итог

Построил связь один-к-одному между персонажем и оружием. Разобрался, чем она отличается от один-ко-многим на уровне базы данных — уникальным индексом на внешнем ключе. Узнал, как явно указать зависимую сторону связи через свойство внешнего ключа, когда EF Core не может определить это автоматически. Снова столкнулся с необходимостью `Include` — теперь для нового связанного поля в DTO.

В следующей части: связь многие-ко-многим — добавим умения (skills), которые может изучить несколько персонажей, и каждый персонаж может знать несколько умений.

---

*Следующая часть: Связь многие-ко-многим — умения персонажей.*
