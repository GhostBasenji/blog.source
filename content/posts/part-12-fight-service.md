+++
title = "Часть 12. Боевая система - атака оружием и умениями"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-21"

categories = [
    "backend"
    ]

tags = [
  "dotnet",
  "aspnet-core",
  "csharp",
  "web-api",
  "ef-core"
]
+++

Мы построили всю необходимую структуру: персонажи, оружие, умения, пользователи. Пришло время выйти за рамки CRUD и реализовать что-то настоящее — боевую систему. Персонажи будут атаковать друг друга оружием и умениями, получать урон, и в конце кто-то будет повержен.
<!--more-->

## Добавляем статистику боёв в модель

Чтобы считать бои, победы и поражения, добавляю три новых поля в `Models/Character.cs`:

```csharp
public int Fights { get; set; }
public int Victories { get; set; }
public int Defeats { get; set; }
```

И те же поля в `Dtos/Character/GetCharacterDto.cs`:

```csharp
public int Fights { get; set; }
public int Victories { get; set; }
public int Defeats { get; set; }
```

Создаю миграцию:

```bash
dotnet ef migrations add FightProperties
dotnet ef database update
```

В файле миграции видно, что EF просто добавит три новых столбца в таблицу `Characters` со значением по умолчанию `0` — существующие записи не пострадают. В этом и состоит смысл миграций: они описывают именно **изменение**, а не пересоздание базы с нуля.

![gb047.png](https://i.postimg.cc/bJNJc5BL/gb047.png)

## Создаю FightService

Создаю папку `Services/FightService` с двумя файлами.

**`IFightService.cs`:**

```csharp
using dotnet_rpg.Dtos.Fight;
using dotnet_rpg.Models;

namespace dotnet_rpg.Services.FightService;

public interface IFightService
{
    Task<ServiceResponse<AttackResultDto>> WeaponAttack(WeaponAttackDto request);
    Task<ServiceResponse<AttackResultDto>> SkillAttack(SkillAttackDto request);
}
```

**`FightService.cs`** — начальная структура:

```csharp
using dotnet_rpg.Data;
using dotnet_rpg.Dtos.Fight;
using dotnet_rpg.Models;
using Microsoft.EntityFrameworkCore;

namespace dotnet_rpg.Services.FightService;

public class FightService : IFightService
{
    private readonly DataContext _context;

    public FightService(DataContext context)
    {
        _context = context;
    }

    // методы — ниже
}
```

Здесь только `DataContext` — без `IHttpContextAccessor`. Боёвка не требует проверки владельца: любой персонаж может атаковать любого. В реальном проекте это стоило бы пересмотреть, но для учебного примера так проще.

## DTO для атак

Создаю папку `Dtos/Fight`.

**`WeaponAttackDto.cs`** — атака оружием:

```csharp
namespace dotnet_rpg.Dtos.Fight;

public class WeaponAttackDto
{
    public int AttackerId { get; set; }
    public int OpponentId { get; set; }
}
```

У персонажа только одно оружие, поэтому не нужно указывать его Id — берётся автоматически.

**`SkillAttackDto.cs`** — атака умением:

```csharp
namespace dotnet_rpg.Dtos.Fight;

public class SkillAttackDto
{
    public int AttackerId { get; set; }
    public int OpponentId { get; set; }
    public int SkillId { get; set; }
}
```

Умений может быть несколько, поэтому нужно явно указать, какое применять.

**`AttackResultDto.cs`** — результат атаки. Добавляю поле `AttackUsed` — название оружия или умения, которое было применено:

```csharp
namespace dotnet_rpg.Dtos.Fight;

public class AttackResultDto
{
    public string Attacker { get; set; } = string.Empty;
    public string Opponent { get; set; } = string.Empty;
    public int AttackerHP { get; set; }
    public int OpponentHP { get; set; }
    public int Damage { get; set; }
    public string AttackUsed { get; set; } = string.Empty;
}
```

`AttackUsed` — строка с названием того, чем атаковали: `"Меч судьбы"` для оружия или `"Fireball"` для умения. Без этого поля из ответа было непонятно, какой именно вид атаки был применён.

## FightController

```csharp
using dotnet_rpg.Dtos.Fight;
using dotnet_rpg.Services.FightService;
using Microsoft.AspNetCore.Mvc;

namespace dotnet_rpg.Controllers;

[ApiController]
[Route("[controller]")]
public class FightController : ControllerBase
{
    private readonly IFightService _fightService;

    public FightController(IFightService fightService)
    {
        _fightService = fightService;
    }

    [HttpPost("Weapon")]
    public async Task<IActionResult> WeaponAttack(WeaponAttackDto request)
    {
        return Ok(await _fightService.WeaponAttack(request));
    }

    [HttpPost("Skill")]
    public async Task<IActionResult> SkillAttack(SkillAttackDto request)
    {
        return Ok(await _fightService.SkillAttack(request));
    }
}
```

Контроллер без `[Authorize]` — атаки доступны без аутентификации. Маршруты: `POST /fight/weapon` и `POST /fight/skill`.

Регистрирую сервис в `Program.cs`:

```csharp
builder.Services.AddScoped<IFightService, FightService>();
```

## Атака оружием — WeaponAttack

```csharp
public async Task<ServiceResponse<AttackResultDto>> WeaponAttack(WeaponAttackDto request)
{
    var response = new ServiceResponse<AttackResultDto>();
    try
    {
        var attacker = await _context.Characters
            .Include(c => c.Weapon)
            .FirstOrDefaultAsync(c => c.Id == request.AttackerId)
            ?? throw new Exception("Атакующий персонаж не найден.");

        var opponent = await _context.Characters
            .FirstOrDefaultAsync(c => c.Id == request.OpponentId)
            ?? throw new Exception("Персонаж-противник не найден.");

        int damage = DoWeaponAttack(attacker, opponent);

        if (opponent.HitPoints <= 0)
            response.Message = $"{opponent.Name} повержен!";

        await _context.SaveChangesAsync();

        response.Data = new AttackResultDto
        {
            Attacker = attacker.Name,
            AttackerHP = attacker.HitPoints,
            Opponent = opponent.Name,
            OpponentHP = opponent.HitPoints,
            Damage = damage,
            AttackUsed = attacker.Weapon!.Name
        };
    }
    catch (Exception ex)
    {
        response.Success = false;
        response.Message = ex.Message;
    }
    return response;
}

private static int DoWeaponAttack(Character attacker, Character opponent)
{
    if (attacker.Weapon is null)
        throw new Exception($"У {attacker.Name} нет оружия!");

    int damage = attacker.Weapon.Damage + new Random().Next(attacker.Strength);
    damage -= new Random().Next(opponent.Defense);

    if (damage > 0)
        opponent.HitPoints -= damage;

    return damage;
}
```

**`AttackUsed = attacker.Weapon!.Name`** — берём название оружия прямо из объекта атакующего. Восклицательный знак `!` подавляет предупреждение nullable: мы уже проверили внутри `DoWeaponAttack` что `Weapon` не `null`, и если бы было — метод выбросил бы исключение раньше.

**Формула урона:**

```txt
урон = урон_оружия + случайное(0..Strength) - случайное(0..Defense)
```

`new Random().Next(n)` возвращает случайное целое число от `0` до `n - 1`. Прибавляем случайную часть силы атакующего и вычитаем случайную часть защиты противника. Если урон отрицательный (противник очень хорошо защищён), ничего не происходит — поэтому проверяем `if (damage > 0)`.

> 💡 `_context.Characters.Update(opponent)` здесь не нужен явно — EF Core отслеживает объект `opponent`, полученный из базы через `_context`. После изменения `HitPoints` достаточно вызвать `SaveChangesAsync()`.

## Атака умением — SkillAttack

```csharp
public async Task<ServiceResponse<AttackResultDto>> SkillAttack(SkillAttackDto request)
{
    var response = new ServiceResponse<AttackResultDto>();
    try
    {
        var attacker = await _context.Characters
            .Include(c => c.CharacterSkills).ThenInclude(cs => cs.Skill)
            .FirstOrDefaultAsync(c => c.Id == request.AttackerId)
            ?? throw new Exception("Атакующий персонаж не найден.");

        var opponent = await _context.Characters
            .FirstOrDefaultAsync(c => c.Id == request.OpponentId)
            ?? throw new Exception("Персонаж-противник не найден.");

        int damage = DoSkillAttack(attacker, opponent, request.SkillId, out string skillName);

        if (opponent.HitPoints <= 0)
            response.Message = $"{opponent.Name} повержен!";

        await _context.SaveChangesAsync();

        response.Data = new AttackResultDto
        {
            Attacker = attacker.Name,
            AttackerHP = attacker.HitPoints,
            Opponent = opponent.Name,
            OpponentHP = opponent.HitPoints,
            Damage = damage,
            AttackUsed = skillName
        };
    }
    catch (Exception ex)
    {
        response.Success = false;
        response.Message = ex.Message;
    }
    return response;
}

private static int DoSkillAttack(Character attacker, Character opponent, int skillId, out string skillName)
{
    var characterSkill = attacker.CharacterSkills
        .FirstOrDefault(cs => cs.Skill.Id == skillId)
        ?? throw new Exception($"{attacker.Name} не знает это умение.");

    skillName = characterSkill.Skill.Name;

    int damage = characterSkill.Skill.Damage + new Random().Next(attacker.Intelligence);
    damage -= new Random().Next(opponent.Defense);

    if (damage > 0)
        opponent.HitPoints -= damage;

    return damage;
}
```

Несколько важных моментов.

**`out string skillName`** — четвёртый параметр метода `DoSkillAttack`. Ключевое слово `out` позволяет методу «вернуть» дополнительное значение помимо основного результата через `return`. В вызывающем коде пишем `out string skillName` — переменная объявляется прямо здесь, в месте вызова. После выполнения метода `skillName` будет содержать название умения.

**`skillName = characterSkill.Skill.Name`** — внутри метода обязательно нужно присвоить значение `out`-параметру до выхода из метода. Компилятор проследит за этим: если забыть — будет ошибка.

**`AttackUsed = skillName`** — передаём название умения в DTO ответа. Теперь клиент видит не только урон, но и чем именно атаковали.

**Включаем умения через `ThenInclude`** — нужна вся цепочка `CharacterSkills → Skill`, как разбирали в части 11.

**Ищем умение у атакующего** — умение берётся не из базы напрямую, а из `attacker.CharacterSkills`. Это важно: мы проверяем, что атакующий **действительно знает** это умение, а не просто передаёт любой `SkillId`.

**Формула урона на умение:**

```txt
урон = урон_умения + случайное(0..Intelligence) - случайное(0..Defense)
```

Вместо `Strength` используется `Intelligence` — умения требуют не физической силы, а магических способностей.

## Готовим персонажей к бою

Перед тестированием убеждаюсь, что у персонажей есть оружие и умения (из прошлых частей). Если `HitPoints` уже снижены с прошлых тестов — сбрасываю их вручную через SSMS.

![gb048.png](https://i.postimg.cc/Jn4nVF2p/gb048.png)

## Тестирую в Bruno

**Атака оружием** — `POST /fight/weapon`:

```json
{
    "attackerId": 3,
    "opponentId": 2,
    "skillId": 2
}
```

![gb049.png](https://i.postimg.cc/KzvzSWHN/gb049.png)

Пример ответа:

```json
{
    "data": {
        "attacker": "Frodo",
        "opponent": "Raistlin",
        "attackerHP": 100,
        "opponentHP": 71,
        "damage": 29,
        "attackUsed": "Frenzy"
    },
    "success": true,
    "message": ""
}
```

Теперь в ответе видно не только урон, но и чем именно атаковали — `"attackUsed": "Frenzy"`. Урон каждый раз разный — потому что `Random`. Если атаковать несколько раз подряд, `HitPoints` у противника снизятся до нуля и придёт сообщение:

```json
{
    "message": "Raistlin повержен!"
}
```

**Атака умением** — `POST /fight/skill`:

```json
{
    "attackerId": 3,
    "opponentId": 2,
    "skillId": 1
}
```

![gb050.png](https://i.postimg.cc/QtxtGzym/gb050.png)

Пример ответа:

```json
{
    "data": {
        "attacker": "Raistlin",
        "opponent": "Frodo",
        "attackerHP": 100,
        "opponentHP": 83,
        "damage": 17,
        "attackUsed": "Fireball"
    },
    "success": true,
    "message": ""
}
```

Теперь сразу видно что был применён `"Fireball"` — `skillId: 1`.

Если передать умение, которого у персонажа нет:

```json
{
    "data": null,
    "success": false,
    "message": "Raistlin не знает это умение."
}
```

## Почему статические приватные методы?

`DoWeaponAttack` и `DoSkillAttack` — статические (`static`). Статический метод не зависит от состояния объекта — у него нет доступа к `_context` или `_mapper`. Это сделано намеренно: вся логика расчёта урона — это чистая функция, которая принимает параметры и возвращает результат. Её легко вынести, переиспользовать и в будущем протестировать.

В следующей части эти же методы будут вызываться из автоматического боя — и именно поэтому я вынес их отдельно.

## Итог

Вышли за рамки CRUD и реализовали первую бизнес-логику — боевую систему. Добавил статистику боёв в модель и обновил базу через новую миграцию. Разобрался с формулой урона на основе `Random` и характеристик персонажей. Научился отличать атаку оружием от атаки умением — разные характеристики, разный тип Include. Добавил поле `AttackUsed` в ответ — теперь видно чем именно была произведена атака. Познакомился с `out`-параметрами — способом вернуть из метода несколько значений одновременно.

В следующей части: реализуем автоматический бой, где персонажи атакуют друг друга по очереди до победного конца, а также таблицу лидеров.

*Следующая часть: Автоматический бой и таблица лидеров.*