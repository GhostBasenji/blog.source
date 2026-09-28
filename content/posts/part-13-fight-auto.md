+++
title = "Часть 13. Автоматический бой и таблица лидеров"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-24"

categories = [
    "backend"
    ]

tags = [
  "dotnet",
  "aspnet-core",
  "csharp",
  "ef-core"
]
+++

В прошлой части персонажи атаковали друг друга вручную — один запрос, одна атака. Сейчас сделаю автоматический бой: передаю список персонажей, они сражаются сами по очереди до победного конца. А в конце — таблица лидеров, отсортированная по победам.
<!--more-->

## Подготовка третьего персонажа

Чтобы бой был интереснее — deathmatch с тремя участниками — добавляю данные прямо в SSMS. У Сэма пока нет оружия и умений.

В таблице `Weapons` добавляю новую строку:

| Id | Name | Damage | CharacterId |
|----|------|--------|-------------|
| 3 | Жало | 10 | 2 |

В таблице `Skills` добавляю новое умение:

| Id | Name | Damage |
|----|------|--------|
| 4 | Ледяной шар | 15 |

В таблице `CharacterSkills` добавляю Сэму умения Frenzy и Ледяной шар:

| CharacterId | SkillId |
|-------------|---------|
| 2 | 2 |
| 2 | 4 |

Убеждаемся что у всех участников `HitPoints = 100`.

![gb051.png](https://i.postimg.cc/MTRL7QWw/gb051.png)


## DTO для автоматического боя

Создаю два новых файла в папке `Dtos/Fight`.

**`FightRequestDto.cs`** — запрос с Id участников:

```csharp
namespace dotnet_rpg.Dtos.Fight;

public class FightRequestDto
{
    public List<int> CharacterIds { get; set; } = [];
}
```

Список Id — не только два персонажа. Можно передать трёх, пятерых, сколько угодно — это и есть deathmatch.

**`FightResultDto.cs`** — результат в виде лога:

```csharp
namespace dotnet_rpg.Dtos.Fight;

public class FightResultDto
{
    public List<string> Log { get; set; } = [];
}
```

Вместо числовых данных — список строк. Каждая строка описывает одно событие боя: кто атаковал, чем, сколько урона нанёс. Читается как летопись сражения.


## Метод Fight в IFightService

Добавляю новый метод в интерфейс:

```csharp
Task<ServiceResponse<FightResultDto>> Fight(FightRequestDto request);
```

И в контроллер:

```csharp
[HttpPost]
public async Task<IActionResult> Fight(FightRequestDto request)
{
    return Ok(await _fightService.Fight(request));
}
```

`[HttpPost]` без маршрута — это дефолтный POST для контроллера, то есть `POST /fight`.


## Реализация автоматического боя

```csharp
public async Task<ServiceResponse<FightResultDto>> Fight(FightRequestDto request)
{
    var response = new ServiceResponse<FightResultDto>
    {
        Data = new FightResultDto()
    };

    try
    {
        var characters = await _context.Characters
            .Include(c => c.Weapon)
            .Include(c => c.CharacterSkills).ThenInclude(cs => cs.Skill)
            .Where(c => request.CharacterIds.Contains(c.Id))
            .ToListAsync();

        bool defeated = false;
        while (!defeated)
        {
            foreach (var attacker in characters)
            {
                var opponents = characters.Where(c => c.Id != attacker.Id).ToList();
                var opponent = opponents[new Random().Next(opponents.Count)];

                int damage = 0;
                string attackUsed;

                bool useWeapon = new Random().Next(2) == 0;
                if (useWeapon && attacker.Weapon is not null)
                {
                    attackUsed = attacker.Weapon.Name;
                    damage = DoWeaponAttack(attacker, opponent);
                }
                else if (attacker.CharacterSkills.Count > 0)
                {
                    int randomSkill = new Random().Next(attacker.CharacterSkills.Count);
                    int skillId = attacker.CharacterSkills[randomSkill].Skill.Id;
                    damage = DoSkillAttack(attacker, opponent, skillId, out string usedSkillName);
                    attackUsed = usedSkillName;
                }
                else
                {
                    attackUsed = "кулаками";
                    damage = new Random().Next(5);
                    if (damage > 0) opponent.HitPoints -= damage;
                }

                response.Data.Log.Add(
                    $"{attacker.Name} атакует {opponent.Name} используя {attackUsed} и наносит {(damage >= 0 ? damage : 0)} урона.");

                if (opponent.HitPoints <= 0)
                {
                    defeated = true;
                    attacker.Victories++;
                    opponent.Defeats++;
                    response.Data.Log.Add($"{opponent.Name} повержен!");
                    response.Data.Log.Add($"{attacker.Name} побеждает с {attacker.HitPoints} HP!");
                    break;
                }
            }
        }

        characters.ForEach(c =>
        {
            c.Fight++;
            c.HitPoints = 100;
        });

        _context.Characters.UpdateRange(characters);
        await _context.SaveChangesAsync();
    }
    catch (Exception ex)
    {
        response.Success = false;
        response.Message = ex.Message;
    }

    return response;
}
```

Разберем новые концепции по порядку.

**`.Where(c => request.CharacterIds.Contains(c.Id))`** — LINQ-метод `Contains` проверяет, есть ли Id персонажа в переданном списке. Это аналог SQL `WHERE Id IN (1, 2, 3)`. Одним запросом получаем всех участников боя.

**`bool defeated = false; while (!defeated)`** — цикл продолжается, пока никто не побеждён. `!defeated` — это «пока `defeated` равен `false`». Как только один персонаж будет повержен, `defeated` становится `true` — и цикл останавливается.

**`foreach (var attacker in characters)`** — каждый персонаж атакует по очереди. Если кто-то побеждён внутри `foreach`, выходим из него через `break`. `while` увидит `defeated = true` и тоже остановится.

**`new Random().Next(2) == 0`** — бросаем монету: 0 или 1. Если 0 — атака оружием, если 1 — умением. Это делает каждый бой непредсказуемым.

**`DoSkillAttack(attacker, opponent, skillId, out string usedSkillName)`** — вызываем с новой сигнатурой из части 12: передаём `skillId` и получаем название умения через `out string usedSkillName`. Переменная `usedSkillName` объявляется прямо здесь в вызове — это особенность `out`-параметров в C#. После вызова записываем её в `attackUsed`, чтобы включить в лог боя.

**Защита от персонажа без оружия и умений** — добавил ветку `else`: если у персонажа нет ни того ни другого, он атакует кулаками со случайным уроном до 5. В оригинале этой защиты нет, и бой мог бы упасть с `NullReferenceException`.

**`characters.ForEach(c => { c.Fights++; c.HitPoints = 100; })`** — после боя увеличиваем счётчик боёв у всех участников и восстанавливаем `HitPoints`. Иначе при следующем бое побеждённый начнёт с 0 HP.

**`_context.Characters.UpdateRange(characters)`** — в отличие от обычного `Update`, `UpdateRange` обновляет сразу несколько объектов одним вызовом. EF построит несколько `UPDATE`-запросов и выполнит их в одной транзакции при `SaveChangesAsync`.

---

## Тестирую в Bruno

`POST /fight`:

```json
{
    "characterIds": [1, 2, 3]
}
```

![gb052.png](https://i.postimg.cc/ZR3Q8dTJ/gb052.png)

Пример ответа:

```json
{
    "data": {
        "log": [
            "Frodo атакует Sam используя Меч судьбы и наносит 19 урона.",
            "Sam атакует Raistlin используя Жало и наносит 12 урона.",
            "Raistlin атакует Frodo используя Fireball и наносит 33 урона.",
            "Frodo атакует Sam используя Frenzy и наносит 22 урона.",
            "Sam атакует Frodo используя Ледяной шар и наносит 18 урона.",
            "Raistlin атакует Frodo используя Blizzard и наносит 41 урона.",
            "Frodo повержен!",
            "Raistlin побеждает с 88 HP!"
        ]
    },
    "success": true,
    "message": ""
}
```

Запускаю несколько боёв подряд — у персонажей накапливается статистика.

## Таблица лидеров — GetHighscore

### DTO

Создаю `Dtos/Fight/HighscoreDto.cs`:

```csharp
namespace dotnet_rpg.Dtos.Fight;

public class HighscoreDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Fights { get; set; }
    public int Victories { get; set; }
    public int Defeats { get; set; }
}
```

Добавляю маппинг в `AutoMapperProfile.cs`:

```csharp
CreateMap<Character, HighscoreDto>();
```

### Метод в интерфейсе

```csharp
Task<ServiceResponse<List<HighscoreDto>>> GetHighscore();
```

### Реализация в FightService

Добавляю `IMapper` в конструктор:

```csharp
private readonly DataContext _context;
private readonly IMapper _mapper;

public FightService(DataContext context, IMapper mapper)
{
    _context = context;
    _mapper = mapper;
}
```

Сам метод:

```csharp
public async Task<ServiceResponse<List<HighscoreDto>>> GetHighscore()
{
    var characters = await _context.Characters
        .Where(c => c.Fights > 0)
        .OrderByDescending(c => c.Victories)
        .ThenBy(c => c.Defeats)
        .ToListAsync();

    return new ServiceResponse<List<HighscoreDto>>
    {
        Data = characters.Select(c => _mapper.Map<HighscoreDto>(c)).ToList()
    };
}
```

**`.Where(c => c.Fights > 0)`** — показываем только тех, кто хоть раз сражался. Новые персонажи без боёв в таблицу не попадут.

**`.OrderByDescending(c => c.Victories)`** — сортировка по убыванию побед: больше побед — выше в таблице.

**`.ThenBy(c => c.Defeats)`** — если побед поровну, сортируем по возрастанию поражений: меньше поражений — выше.

**`characters.Select(c => _mapper.Map<HighscoreDto>(c)).ToList()`** — LINQ `Select` — это трансформация: берём каждый элемент и применяем к нему функцию. Результат — новый список `HighscoreDto`. Аналог `map` в других языках.

### Контроллер

```csharp
[HttpGet]
public async Task<IActionResult> GetHighscore()
{
    return Ok(await _fightService.GetHighscore());
}
```

`[HttpGet]` без маршрута — дефолтный GET для контроллера: `GET /fight`.

## Тестирую таблицу лидеров в Bruno

`GET /fight` — без тела, без токена:

![gb053.png](https://i.postimg.cc/RFfY7HM4/gb053.png)

```json
{
    "data": [
        {
            "id": 3,
            "name": "Raistlin",
            "fights": 10,
            "victories": 5,
            "defeats": 3
        },
        {
            "id": 1,
            "name": "Frodo",
            "fights": 10,
            "victories": 4,
            "defeats": 4
        },
        {
            "id": 2,
            "name": "Sam",
            "fights": 10,
            "victories": 1,
            "defeats": 3
        }
    ],
    "success": true,
    "message": ""
}
```

## Итог

Реализовал автоматический deathmatch — персонажи сражаются сами по очереди до победителя. Разобрался с `while` + `foreach` как паттерном для пошаговых игровых циклов. Познакомился с `Contains` в LINQ, `UpdateRange` для массовых обновлений, и `OrderByDescending` + `ThenBy` для многоуровневой сортировки. Добавил таблицу лидеров — она сама формируется из накопленной статистики боёв.

В следующей части: ролевая авторизация — добавим роль `Admin`, которая видит персонажей всех пользователей, а обычные `Player` видят только своих.

*Следующая часть: Ролевая авторизация — Admin и Player.*
