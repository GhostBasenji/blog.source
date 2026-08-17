+++
title = "Часть 11. Связь многие-ко-многим: умения персонажей и ThenInclude"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-18"

categories = [
    "backend",
    "csharp-development"
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

Мы уже разобрали два вида связей: один-ко-многим (пользователь → персонажи) и один-к-одному (персонаж → оружие). Остался третий и самый интересный — **многие-ко-многим**. Один персонаж может знать несколько умений, и одно умение может быть у нескольких персонажей. Добавим к нашим персонажам пул умений — Fireball, Frenzy, Blizzard.
<!--more-->


## Почему многие-ко-многим — особый случай

При связи один-ко-многим внешний ключ живёт в таблице «многих» (`UserId` в `Characters`). При один-к-одному — в зависимой таблице (`CharacterId` в `Weapons`).

Но как хранить связь многие-ко-многим? У одного персонажа несколько умений, у одного умения несколько персонажей — ни в одну из таблиц не добавить простой внешний ключ. Нужна **промежуточная таблица** — она хранит пары `CharacterId + SkillId`.

```txt
Characters           CharacterSkills               Skills
┌────┬───────┐      ┌─────────────┬────────┐      ┌────┬──────────┬────────┐
│ Id │ Name  │      │ CharacterId │SkillId │      │ Id │   Name   │ Damage │
├────┼───────┤      ├─────────────┼────────┤      ├────┼──────────┼────────┤
│  1 │ Frodo │ ─┐   │      1      │   1    │ ─┐   │  1 │ Fireball │   30   │
│  2 │  Sam  │  ├─► │      1      │   2    │  ├─► │  2 │  Frenzy  │   20   │
└────┴───────┘  └─► │      2      │   1    │  └─► │  3 │ Blizzard │   25   │
                    └─────────────┴────────┘      └────┴──────────┴────────┘
```

Фродо знает Fireball и Frenzy. Сэм знает только Fireball. Fireball знают оба.

> 💡 **EF Core 5+ поддерживает многие-ко-многим без промежуточного класса** — достаточно добавить `List<Skill>` в `Character` и `List<Character>` в `Skill`, и EF создаст промежуточную таблицу автоматически. Но в нашем проекте мы создаём промежуточный класс явно — это даёт больше контроля и лучше объясняет, что происходит в базе данных.


## Модель Skill

Создаю `Models/Skill.cs`:

```csharp
namespace dotnet_rpg.Models;

public class Skill
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Damage { get; set; }
    public List<CharacterSkill> CharacterSkills { get; set; } = [];
}
```

Обращаем внимание: здесь нет `List<Character>` — вместо этого `List<CharacterSkill>`. Именно через промежуточный класс EF Core узнает о связи.


## Промежуточная модель CharacterSkill

Создаю `Models/CharacterSkill.cs`:

```csharp
namespace dotnet_rpg.Models;

public class CharacterSkill
{
    public int CharacterId { get; set; }
    public Character Character { get; set; } = null!;
    public int SkillId { get; set; }
    public Skill Skill { get; set; } = null!;
}
```

Этот класс — не сущность в привычном смысле, а именно промежуточная таблица. У неё нет собственного `Id` — первичным ключом будет **составной ключ** из `CharacterId` и `SkillId`. Пару можно считать уникальной: один персонаж не может изучить одно умение дважды.

`= null!` — инициализация навигационных свойств. `null!` означает «я знаю, что это null сейчас, но обещаю что при работе с БД оно будет заполнено». Это подавляет предупреждение nullable без лишних `?`.

Добавляю `List<CharacterSkill>` в `Character.cs`:

```csharp
public List<CharacterSkill> CharacterSkills { get; set; } = [];
```


## DataContext — составной ключ через Fluent API

Добавляю два новых `DbSet` в `DataContext.cs`:

```csharp
public DbSet<Skill> Skills { get; set; }
public DbSet<CharacterSkill> CharacterSkills { get; set; }
```

EF Core не может угадать составной ключ самостоятельно — нужно указать явно. Для этого переопределяю метод `OnModelCreating` в `DataContext`:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<CharacterSkill>()
        .HasKey(cs => new { cs.CharacterId, cs.SkillId });
}
```

**`OnModelCreating`** — метод, который вызывается при старте приложения и конфигурирует модель базы данных через **Fluent API**. Fluent API — это альтернативный способ настроить поведение EF Core вместо атрибутов (`[Key]`, `[ForeignKey]` и т.д.) прямо в моделях.

**`HasKey(cs => new { cs.CharacterId, cs.SkillId })`** — говорим EF Core: «первичный ключ таблицы `CharacterSkills` — это комбинация двух полей». Анонимный объект `new { ... }` — синтаксис для передачи нескольких свойств сразу. Благодаря соглашениям об именовании (`CharacterId`, `SkillId`) EF сам поймёт, что это внешние ключи к `Characters` и `Skills`.


## Миграция

```bash
dotnet ef migrations add Skill
dotnet ef database update
```

В созданном файле миграции будут две новые таблицы. Самое интересное — в design-файле:

```csharp
modelBuilder.Entity("dotnet_rpg.Models.CharacterSkill", b =>
{
    b.HasOne("dotnet_rpg.Models.Character", "Character")
        .WithMany("CharacterSkills")
        .HasForeignKey("CharacterId")
        .OnDelete(DeleteBehavior.Cascade)
        .IsRequired();

    b.HasOne("dotnet_rpg.Models.Skill", "Skill")
        .WithMany("CharacterSkills")
        .HasForeignKey("SkillId")
        .OnDelete(DeleteBehavior.Cascade)
        .IsRequired();
});
```

EF сгенерировал конфигурацию автоматически: `CharacterSkill` связан с `Character` через `HasOne...WithMany`, и то же самое для `Skill`. `OnDelete(DeleteBehavior.Cascade)` — если удалить персонажа, все его записи в `CharacterSkills` тоже удалятся.

![gb043.png](https://i.postimg.cc/cHfQVshs/gb043.png)


## Добавляю умения в базу вручную через SSMS

Умения — это общий пул, они не принадлежат никакому конкретному персонажу. Поэтому добавлю их напрямую в БД через SSMS, не создавая отдельный сервис.

В SSMS: правый клик на таблице `Skills` → **Edit Top 200 Rows**. Добавляю три умения:

```txt

|  Id |    Name   | Damage |
|-----|-----------|--------|
|  1  | Fireball  |   30   |
|  2  | Frenzy    |   20   |
|  3  | Blizzard  |   25   |
```

![gb044.png](https://i.postimg.cc/cHfQVshd/gb044.png)


## DTO

Создаю `Dtos/Skill/GetSkillDto.cs`:

```csharp
namespace dotnet_rpg.Dtos.Skill;

public class GetSkillDto
{
    public string Name { get; set; } = string.Empty;
    public int Damage { get; set; }
}
```

Создаю `Dtos/CharacterSkill/AddCharacterSkillDto.cs`:

```csharp
namespace dotnet_rpg.Dtos.CharacterSkill;

public class AddCharacterSkillDto
{
    public int CharacterId { get; set; }
    public int SkillId { get; set; }
}
```

Добавляю `Skills` в `GetCharacterDto.cs`:

```csharp
public List<GetSkillDto> Skills { get; set; } = [];
```

Обратите внимание: здесь `List<GetSkillDto>`, а не `List<GetCharacterSkillDto>`. Клиент получает умения напрямую, минуя промежуточную сущность. Как именно это работает — покажу ниже в AutoMapper.


## CharacterSkillService

Создаю `Services/CharacterSkillService/ICharacterSkillService.cs`:

```csharp
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Dtos.CharacterSkill;
using dotnet_rpg.Models;

namespace dotnet_rpg.Services.CharacterSkillService;

public interface ICharacterSkillService
{
    Task<ServiceResponse<GetCharacterDto>> AddCharacterSkill(AddCharacterSkillDto newCharacterSkill);
}
```

Создаю `Services/CharacterSkillService/CharacterSkillService.cs`:

```csharp
using System.Security.Claims;
using AutoMapper;
using dotnet_rpg.Data;
using dotnet_rpg.Dtos.Character;
using dotnet_rpg.Dtos.CharacterSkill;
using dotnet_rpg.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace dotnet_rpg.Services.CharacterSkillService;

public class CharacterSkillService : ICharacterSkillService
{
    private readonly DataContext _context;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly IMapper _mapper;

    public CharacterSkillService(DataContext context, IHttpContextAccessor httpContextAccessor, IMapper mapper)
    {
        _context = context;
        _httpContextAccessor = httpContextAccessor;
        _mapper = mapper;
    }

    public async Task<ServiceResponse<GetCharacterDto>> AddCharacterSkill(AddCharacterSkillDto newCharacterSkill)
    {
        var response = new ServiceResponse<GetCharacterDto>();
        try
        {
            var userId = int.Parse(_httpContextAccessor.HttpContext!.User
                .FindFirstValue(ClaimTypes.NameIdentifier)!);

            var character = await _context.Characters
                .Include(c => c.Weapon)
                .Include(c => c.CharacterSkills).ThenInclude(cs => cs.Skill)
                .FirstOrDefaultAsync(c => c.Id == newCharacterSkill.CharacterId
                    && c.User!.Id == userId)
                ?? throw new Exception("Персонаж не найден.");

            var skill = await _context.Skills
                .FirstOrDefaultAsync(s => s.Id == newCharacterSkill.SkillId)
                ?? throw new Exception("Умение не найдено.");

            var characterSkill = new CharacterSkill
            {
                Character = character,
                Skill = skill
            };

            _context.CharacterSkills.Add(characterSkill);
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

Самое интересное здесь — цепочка `Include` и `ThenInclude`.

**`.Include(c => c.Weapon)`** — подгружаем оружие, как делали раньше.

**`.Include(c => c.CharacterSkills).ThenInclude(cs => cs.Skill)`** — двухуровневый Include. Сначала подгружаем список `CharacterSkills` (промежуточную таблицу), а затем для каждой записи `CharacterSkill` подгружаем связанный `Skill`. Если написать только `.Include(c => c.CharacterSkills)`, то `cs.Skill` внутри каждого элемента будет `null`. `ThenInclude` — это продолжение цепочки для вложенных свойств.

```txt
Character
  └── CharacterSkills (Include)
        └── Skill (ThenInclude)  ← без этого Skill = null
```

## CharacterSkillController

Создаю `Controllers/CharacterSkillController.cs`:

```csharp
using dotnet_rpg.Dtos.CharacterSkill;
using dotnet_rpg.Services.CharacterSkillService;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace dotnet_rpg.Controllers;

[Authorize]
[ApiController]
[Route("[controller]")]
public class CharacterSkillController : ControllerBase
{
    private readonly ICharacterSkillService _characterSkillService;

    public CharacterSkillController(ICharacterSkillService characterSkillService)
    {
        _characterSkillService = characterSkillService;
    }

    [HttpPost]
    public async Task<IActionResult> AddCharacterSkill(AddCharacterSkillDto newCharacterSkill)
    {
        return Ok(await _characterSkillService.AddCharacterSkill(newCharacterSkill));
    }
}
```

Регистрирую сервис в `Program.cs`:

```csharp
builder.Services.AddScoped<ICharacterSkillService, CharacterSkillService>();
```


## AutoMapper — прыжок через промежуточную таблицу

Теперь нужно решить задачу: как AutoMapper должен маппировать `Character` в `GetCharacterDto`, если `Character.CharacterSkills` — это `List<CharacterSkill>`, а `GetCharacterDto.Skills` — это `List<GetSkillDto>`? Типы не совпадают.

Открываю `AutoMapperProfile.cs` и добавляю маппинг для `GetSkillDto`:

```csharp
CreateMap<Skill, GetSkillDto>();
```

А маппинг `Character → GetCharacterDto` нужно расширить кастомным правилом:

```csharp
CreateMap<Character, GetCharacterDto>()
    .ForMember(dto => dto.Skills,
        opt => opt.MapFrom(c => c.CharacterSkills.Select(cs => cs.Skill)));
```

**`ForMember`** — указывает особое правило маппинга для конкретного поля DTO. Первый аргумент — целевое поле (`dto.Skills`). Второй — как его заполнить.

**`MapFrom(c => c.CharacterSkills.Select(cs => cs.Skill))`** — берём список `CharacterSkills` и через LINQ `Select` вытаскиваем из каждого элемента только `Skill`. Результат — `IEnumerable<Skill>`, который AutoMapper автоматически маппирует в `List<GetSkillDto>` благодаря зарегистрированному `CreateMap<Skill, GetSkillDto>()`.

Так мы «перепрыгиваем» промежуточную сущность в ответе клиенту — он получает умения напрямую, не зная ничего о `CharacterSkill`.

Также обновляю `GetAllCharacters` и `GetCharacterById` в `CharacterService` — добавляю `ThenInclude` для умений:

```csharp
var dbCharacters = await _context.Characters
    .Where(c => c.User!.Id == GetUserId())
    .Include(c => c.Weapon)
    .Include(c => c.CharacterSkills).ThenInclude(cs => cs.Skill)
    .ToListAsync();
```

## Тестирую в Bruno

`POST /characterskill` с Bearer-токеном:

```json
{
    "characterId": 3,
    "skillId": 1
}
```

![gb045.png](https://i.postimg.cc/xCLKW05j/gb045.png)

Добавляю второе умение — `skillId: 2`:

```json
{
    "characterId": 3,
    "skillId": 2
}
```

![gb046.png](https://i.postimg.cc/SscWwydS/gb046.png)

В SSMS таблица `CharacterSkills` теперь содержит две строки — `(1, 1)` и `(1, 2)`.

## Итог

Разобрался со всеми тремя видами связей в EF Core. Реализовал связь многие-ко-многим через промежуточный класс `CharacterSkill` и составной первичный ключ через Fluent API. Познакомился с `ThenInclude` для загрузки вложенных связанных объектов. Научился делать кастомные маппинги в AutoMapper с `ForMember` и `Select` — чтобы «перепрыгивать» промежуточные сущности и отдавать клиенту чистые данные.

Финальная структура проекта теперь выглядит так:

```txt
dotnet-rpg/
├── Controllers/
│   ├── AuthController.cs
│   ├── CharacterController.cs
│   ├── CharacterSkillController.cs
│   └── WeaponController.cs
├── Data/
│   ├── AuthRepository.cs
│   ├── DataContext.cs
│   └── IAuthRepository.cs
├── Dtos/
│   ├── Character/  (Add, Get, Update)
│   ├── CharacterSkill/ (Add)
│   ├── Skill/ (Get)
│   ├── User/ (Login, Register)
│   └── Weapon/ (Add, Get)
├── Models/
│   ├── Character.cs
│   ├── CharacterSkill.cs
│   ├── RpgClass.cs
│   ├── ServiceResponse.cs
│   ├── Skill.cs
│   ├── User.cs
│   └── Weapon.cs
├── Services/
│   ├── CharacterService/
│   ├── CharacterSkillService/
│   └── WeaponService/
├── AutoMapperProfile.cs
└── Program.cs
```

В следующей части: выйдем за рамки CRUD и реализуем боевую систему — персонажи будут атаковать друг друга, использовать умения и оружие.

---

*Следующая часть: Боевая система — больше чем просто CRUD.*