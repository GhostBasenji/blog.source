+++
title = "Часть 7. Регистрация и вход пользователей — хэширование паролей и связи в БД"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-08"

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

До сих пор любой мог обращаться к нашему API и видеть всех персонажей. Настало время добавить пользователей — чтобы каждый видел только своих персонажей. В этой части создадим модель `User`, добавим первую связь между таблицами и реализуем регистрацию с безопасным хранением пароля.

---

## Модель User

Создаю `Models/User.cs`:

```csharp
namespace dotnet_rpg.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public byte[] PasswordHash { get; set; } = [];
    public byte[] PasswordSalt { get; set; } = [];
    public List<Character> Characters { get; set; } = [];
}
```

Пароль не хранится в открытом виде — только `PasswordHash` и `PasswordSalt` в виде байтовых массивов. Зачем это нужно — объясню ниже.

`List<Character> Characters` — это уже будущая связь с персонажами. Один пользователь может иметь много персонажей.

Также добавляю обратную ссылку в `Character.cs`:

```csharp
public User? User { get; set; }
```

Теперь от персонажа можно добраться до его владельца.

---

## Три вида связей в реляционных базах данных

Прежде чем запускать миграцию, коротко о том, что мы только что сделали на уровне данных.

В реляционных базах есть три вида связей:

**Один-к-одному (one-to-one)** — один пользователь имеет ровно один профиль, и этот профиль принадлежит только ему.

**Один-ко-многим (one-to-many)** — один пользователь имеет несколько персонажей, но каждый персонаж принадлежит только одному пользователю. Это именно то, что мы строим.

**Многие-ко-многим (many-to-many)** — несколько персонажей могут иметь несколько умений, и одно умение может быть у нескольких персонажей. Это мы разберём позже.

```txt
Users (один)                Characters (многие)
┌────┬──────────┐          ┌────┬────────┬────────┐
│ Id │ Username │          │ Id │  Name  │ UserId │
├────┼──────────┤          ├────┼────────┼────────┤
│  1 │  alice   │ ──┬──►   │  1 │ Frodo  │   1    │
│  2 │  bob     │   │      │  2 │  Sam   │   1    │
└────┴──────────┘   └────► │  3 │ Gandalf│   2    │
                           └────┴────────┴────────┘
```

EF Core понимает эту связь из нашего кода: `User` имеет `List<Character>`, а `Character` имеет свойство `User`. По этой паре EF добавит внешний ключ `UserId` в таблицу `Characters` автоматически.

---

## Добавляем DbSet и запускаем миграции

Открываю `Data/DataContext.cs` и добавляю `DbSet` для пользователей:

```csharp
public DbSet<User> Users { get; set; }
```

Останавливаю приложение и запускаю миграции:

```bash
dotnet ef migrations add AddUser
dotnet ef database update
```

После `database update` в базе данных появятся таблица `Users` и новый столбец `UserId` в таблице `Characters`.

![](https://i.postimg.cc/0jhbWXGP/gb029.png)

---

## Зачем хэшировать пароль

Хранить пароль в открытом виде нельзя. Даже если база данных утечёт — злоумышленник не должен получить пароли пользователей.

**Хэш** — это результат одностороннего преобразования. Из хэша нельзя получить исходный пароль. При входе мы хэшируем введённый пароль и сравниваем с хранимым хэшем.

Но и простого хэша недостаточно. Алгоритм всегда даёт одинаковый результат для одинакового пароля. Если два пользователя выбрали `123456`, их хэши будут одинаковы — это утечка информации. Плюс существуют заранее вычисленные таблицы хэшей (rainbow tables) для взлома.

**Соль (salt)** — это случайная последовательность байт, которая добавляется к паролю перед хэшированием. Соль уникальна для каждого пользователя, поэтому одинаковые пароли дадут разные хэши. Соль хранится в базе — она не секретная, её задача только сделать хэши уникальными.

```txt
Пароль: "123456"
Соль пользователя 1: [случайные байты A]  →  хэш: X9kL2...
Соль пользователя 2: [случайные байты B]  →  хэш: mP7vQ...
```

Мы используем алгоритм **HMACSHA512** — он принимает данные и ключ (соль), возвращает хэш. Создание нового экземпляра `HMACSHA512` автоматически генерирует случайный ключ — это и будет наша соль.

---

## AuthRepository — репозиторий аутентификации

Создаю папку (она уже есть) `Data` и в ней два файла.

**`Data/IAuthRepository.cs`:**

```csharp
using dotnet_rpg.Models;

namespace dotnet_rpg.Data;

public interface IAuthRepository
{
    Task<ServiceResponse<int>> Register(User user, string password);
    Task<ServiceResponse<string>> Login(string username, string password);
    Task<bool> UserExists(string username);
}
```

`Register` возвращает `Id` нового пользователя. `Login` пока возвращает `string` — в следующей части это будет JWT-токен. `UserExists` — проверка на дубликаты, без `ServiceResponse`, потому что простой `bool` здесь достаточен.

**`Data/AuthRepository.cs`:**

```csharp
using dotnet_rpg.Models;
using Microsoft.EntityFrameworkCore;

namespace dotnet_rpg.Data;

public class AuthRepository : IAuthRepository
{
    private readonly DataContext _context;

    public AuthRepository(DataContext context)
    {
        _context = context;
    }

    public async Task<ServiceResponse<int>> Register(User user, string password)
    {
        var response = new ServiceResponse<int>();

        if (await UserExists(user.Username))
        {
            response.Success = false;
            response.Message = "Пользователь с таким именем уже существует.";
            return response;
        }

        CreatePasswordHash(password, out byte[] passwordHash, out byte[] passwordSalt);
        user.PasswordHash = passwordHash;
        user.PasswordSalt = passwordSalt;

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        response.Data = user.Id;
        return response;
    }

    public async Task<ServiceResponse<string>> Login(string username, string password)
    {
        var response = new ServiceResponse<string>();
        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.Username.ToLower() == username.ToLower());

        if (user is null)
        {
            response.Success = false;
            response.Message = "Пользователь не найден.";
        }
        else if (!VerifyPasswordHash(password, user.PasswordHash, user.PasswordSalt))
        {
            response.Success = false;
            response.Message = "Неверный пароль.";
        }
        else
        {
            response.Data = user.Id.ToString(); // позже здесь будет JWT-токен
        }

        return response;
    }

    public async Task<bool> UserExists(string username)
    {
        return await _context.Users
            .AnyAsync(x => x.Username.ToLower() == username.ToLower());
    }

    private void CreatePasswordHash(string password, out byte[] passwordHash, out byte[] passwordSalt)
    {
        using var hmac = new System.Security.Cryptography.HMACSHA512();
        passwordSalt = hmac.Key;
        passwordHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
    }

    private bool VerifyPasswordHash(string password, byte[] passwordHash, byte[] passwordSalt)
    {
        using var hmac = new System.Security.Cryptography.HMACSHA512(passwordSalt);
        var computedHash = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
        return computedHash.SequenceEqual(passwordHash);
    }
}
```

Несколько важных моментов.

**`out` параметры** в `CreatePasswordHash` — ключевое слово `out` означает, что метод не возвращает значение через `return`, а записывает его прямо в переданные переменные. Удобно когда нужно вернуть несколько значений сразу.

**`using var hmac`** — `HMACSHA512` реализует `IDisposable`, то есть использует неуправляемые ресурсы. `using` гарантирует, что они освободятся после блока. Это важно для криптографических объектов.

**`CreatePasswordHash`:** создаём `HMACSHA512` без аргументов — он сам генерирует случайный ключ. Этот ключ (`hmac.Key`) и есть наша соль. Затем хэшируем пароль в байтах.

**`VerifyPasswordHash`:** создаём `HMACSHA512` с сохранённой солью (`passwordSalt`) как ключом — это воспроизводит точно тот же алгоритм. Хэшируем введённый пароль и сравниваем с хранимым через `SequenceEqual` — сравнение байтовых массивов поэлементно.

> 💡 `.SequenceEqual()` — это LINQ-метод для сравнения коллекций. Обычный `==` для массивов сравнивает ссылки, а не содержимое.

---

## DTO для регистрации и входа

Создаю папку `Dtos/User` с двумя файлами.

**`Dtos/User/UserRegisterDto.cs`:**

```csharp
namespace dotnet_rpg.Dtos.User;

public class UserRegisterDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
```

**`Dtos/User/UserLoginDto.cs`:**

```csharp
namespace dotnet_rpg.Dtos.User;

public class UserLoginDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
```

Сейчас они одинаковые — но при регистрации позже могут появиться дополнительные поля (email, имя и т.д.), поэтому лучше разделить сразу.

---

## AuthController

Создаю `Controllers/AuthController.cs`:

```csharp
using dotnet_rpg.Data;
using dotnet_rpg.Dtos.User;
using dotnet_rpg.Models;
using Microsoft.AspNetCore.Mvc;

namespace dotnet_rpg.Controllers;

[ApiController]
[Route("[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthRepository _authRepo;

    public AuthController(IAuthRepository authRepository)
    {
        _authRepo = authRepository;
    }

    [HttpPost("Register")]
    public async Task<IActionResult> Register(UserRegisterDto request)
    {
        var response = await _authRepo.Register(
            new User { Username = request.Username },
            request.Password);

        if (!response.Success)
            return BadRequest(response);

        return Ok(response);
    }

    [HttpPost("Login")]
    public async Task<IActionResult> Login(UserLoginDto request)
    {
        var response = await _authRepo.Login(request.Username, request.Password);

        if (!response.Success)
            return BadRequest(response);

        return Ok(response);
    }
}
```

При успешной регистрации возвращаем `200 OK` с Id пользователя. При ошибке (пользователь уже существует) — `400 Bad Request` с сообщением.

---

## Регистрируем AuthRepository в Program.cs

```csharp
builder.Services.AddScoped<IAuthRepository, AuthRepository>();
```

Добавляю рядом с регистрацией `ICharacterService`.

---

## Тестируем в Bruno

Регистрация — `POST /auth/register`:

```json
{
    "username": "alice",
    "password": "securepass123"
}
```

![](https://i.postimg.cc/ZnXC7sPJ/gb030.png)

Ответ:

```json
{
    "data": 1,
    "success": true,
    "message": ""
}
```

При попытке зарегистрироваться повторно выдаст вот такое сообщение:

```json
{
    "data": 0,
    "success": false,
    "message": "Пользователь с таким именем уже существует."
}
```

Вход — `POST /auth/login`:

```json
{
    "username": "alice",
    "password": "securepass123"
}
```

![](https://i.postimg.cc/2ygVc9dz/gb031.png)

Пока возвращается Id пользователя. В следующей части здесь будет JWT-токен.

---

## Итог

Добавил модель `User` с безопасным хранением пароля через HMACSHA512, соль и хэш. Создал первую связь один-ко-многим между пользователями и персонажами. Реализовал регистрацию с проверкой дубликатов и вход с проверкой пароля.

В следующей части: заменю Id на JWT-токен в ответе на вход и защищу контроллер персонажей атрибутом `[Authorize]`.

---

*Следующая часть: JSON Web Tokens — генерируем токен, защищаем эндпоинты, читаем Claims.*
