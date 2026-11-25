+++
title = "Часть 14. Ролевая авторизация — Admin и Player"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-28"

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

В части 8 мы добавили аутентификацию через JWT — теперь система знает, кто ты. Но она не знает, что тебе позволено. Это уже **авторизация**. Сейчас добавлю роли: обычный `Player` видит только своих персонажей, а `Admin` — всех.
<!--more-->

> 💡 **Аутентификация vs авторизация:** аутентификация — это «кто ты» (проверка личности через токен). Авторизация — это «что тебе можно» (проверка прав доступа). JWT отвечает за оба: он удостоверяет личность и несёт информацию о роли.

## Добавляю поле Role в модель User

Открываю `Models/User.cs` и добавляю новое свойство:

```csharp
using System.ComponentModel.DataAnnotations;

namespace dotnet_rpg.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public byte[] PasswordHash { get; set; } = [];
    public byte[] PasswordSalt { get; set; } = [];
    public List<Character> Characters { get; set; } = [];
    [Required]
    public string Role { get; set; } = string.Empty;
}
```

**`[Required]`** — атрибут из `System.ComponentModel.DataAnnotations`. Говорит EF Core: это поле не может быть `null` в базе данных (`NOT NULL` в SQL).

Но мы хотим, чтобы каждый новый пользователь автоматически получал роль `"Player"` — без необходимости указывать её при регистрации. Для этого задаём значение по умолчанию через Fluent API в `DataContext.cs`:

```csharp
protected override void OnModelCreating(ModelBuilder modelBuilder)
{
    modelBuilder.Entity<CharacterSkill>()
        .HasKey(cs => new { cs.CharacterId, cs.SkillId });

    modelBuilder.Entity<User>()
        .Property(u => u.Role)
        .HasDefaultValue("Player");
}
```

**`HasDefaultValue("Player")`** — говорит SQL Server: если при вставке строки значение `Role` не указано, подставить `"Player"`. Это значение по умолчанию на уровне базы данных, а не только в C#-коде.

## Миграция

```bash
dotnet ef migrations add UserRole
dotnet ef database update
```

В файле миграции видно:

```csharp
migrationBuilder.AddColumn<string>(
    name: "Role",
    table: "Users",
    nullable: false,
    defaultValue: "Player");
```

Все существующие пользователи автоматически получат роль `"Player"` — потому что именно так работает `defaultValue` при добавлении столбца к существующим строкам. Новые пользователи тоже будут получать её при регистрации.

![gb054.png](https://i.postimg.cc/gcsQ95Xn/gb054.png)

## Добавляю роль в JWT-токен

Открываю `Data/AuthRepository.cs` и расширяю список claims в методе `CreateToken`:

```csharp
private string CreateToken(User user)
{
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.Username),
        new Claim(ClaimTypes.Role, user.Role)  // ← новый claim
    };

    // остальной код без изменений
}
```

`ClaimTypes.Role` — стандартный тип claim для роли. ASP.NET автоматически читает его при проверке `[Authorize(Roles = "...")]` — не нужно ничего дополнительно настраивать.

Теперь можно проверить: входим в систему, копируем токен и вставляем на [jwt.io](https://jwt.io). В секции Payload должен появиться новый claim:

```json
{
  "nameid": "1",
  "unique_name": "alice",
  "role": "Player",
  ...
}
```

![gb055.png](https://i.postimg.cc/8k4983JJ/gb055.png)

> ⚠️ После добавления нового claim нужно **заново войти** — старый токен роли не содержит. Токен создаётся один раз при логине и не обновляется автоматически.

## Ограничиваю доступ по роли

В `CharacterController` атрибут `[Authorize]` уже есть. Теперь можно уточнить, каким ролям разрешён доступ:

```csharp
[Authorize(Roles = "Player,Admin")]
[ApiController]
[Route("[controller]")]
public class CharacterController : ControllerBase
```

`Roles = "Player,Admin"` — через запятую указываем несколько ролей. Пользователь с любой из них пройдёт проверку. Сейчас это не меняет поведение, но нагляднее показывает намерение: этот контроллер для игроков и администраторов.

Чтобы убедиться что ограничение работает — временно меняем роль тестового пользователя на `"Admin"` прямо в SSMS:

![gb056.png](https://i.postimg.cc/05nFg3Mr/gb056.png)

Входим под ним, получаем новый токен. Пробуем `GET /character/GetAll` с этим токеном — запрос проходит. Теперь убираем роль `Admin` из атрибута, оставляем только `Player`:

```csharp
[Authorize(Roles = "Player")]
```

Повторяем запрос — получаем `403 Forbidden`. Токен есть, пользователь аутентифицирован — но нужной роли нет.

![gb057.png](https://i.postimg.cc/KcfwXVk1/gb057.png)

Это и есть разница между `401 Unauthorized` (нет токена) и `403 Forbidden` (токен есть, но прав недостаточно).

Возвращаем `"Player,Admin"` обратно.

## Меняю поведение GetAllCharacters для Admin

Сейчас все пользователи видят только своих персонажей. Добавлю логику: если роль `Admin` — показываем всех персонажей из базы.

В `CharacterService.cs` добавляю метод-помощник рядом с `GetUserId()`:

```csharp
private string GetUserRole() =>
    _httpContextAccessor.HttpContext!.User
        .FindFirstValue(ClaimTypes.Role)!;
```

И обновляю `GetAllCharacters`:

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters()
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    var dbCharacters = GetUserRole().Equals("Admin")
        ? await _context.Characters
            .Include(c => c.Weapon)
            .Include(c => c.CharacterSkills).ThenInclude(cs => cs.Skill)
            .ToListAsync()
        : await _context.Characters
            .Where(c => c.User!.Id == GetUserId())
            .Include(c => c.Weapon)
            .Include(c => c.CharacterSkills).ThenInclude(cs => cs.Skill)
            .ToListAsync();

    serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(dbCharacters);
    return serviceResponse;
}
```

**Тернарный оператор `? :`** — краткая форма условия:

```txt
условие ? выражение_если_true : выражение_если_false
```

Если роль `Admin` — берём всех персонажей без фильтра. Если нет — фильтруем по `UserId` как раньше.


## Тестирую в Bruno

**Шаг 1:** даю пользователю `alice` роль `Admin` в SSMS.

**Шаг 2:** вхожу под `alice`, получаю новый токен с ролью Admin.

**Шаг 3:** `GET /character/GetAll` — в ответе все персонажи всех пользователей.

![gb058.png](https://i.postimg.cc/wTBP9VL6/gb058.png)

**Шаг 4:** вхожу под `testuser` (роль Player), делаю тот же запрос — только его персонажи.

![gb059.png](https://i.postimg.cc/rFpbqJxV/gb059.png)]


## Итог

Добавил ролевую авторизацию. Разобрался в разнице между аутентификацией (кто ты) и авторизацией (что тебе можно). Добавил роль `Player` по умолчанию через `HasDefaultValue` в Fluent API — все пользователи получают её автоматически. Расширил JWT-токен claim'ом роли и научился читать его в сервисе. Использовал `[Authorize(Roles = "...")]` для ограничения доступа и увидел разницу между `401` и `403`. Реализовал разное поведение `GetAllCharacters` в зависимости от роли.

В следующей части — финальной: перейдём с SQL Server на SQLite (легче для разработки) и добавим Data Seeding — автоматическое заполнение базы начальными данными при запуске.

---

*Следующая часть: SQLite и Data Seeding — финальная часть серии.*
