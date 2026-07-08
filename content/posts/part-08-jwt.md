+++
title = "Часть 8. JWT-аутентификация — токены, Authorize и Claims"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-10"

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
  "jwt"
]
+++

В прошлой части реализовал регистрацию и вход, но после входа возвращался просто Id пользователя. Это не защищает API — любой может обращаться к нашим эндпоинтам. Сейчас добавим JSON Web Tokens: при входе пользователь получит токен, и только с этим токеном сможет обращаться к защищённым методам.

---

## Что такое JWT и зачем он нужен

После того как пользователь вошёл, серверу нужно как-то «помнить» его при каждом следующем запросе. HTTP — протокол без состояния (stateless): каждый запрос независим, сервер не знает, кто его отправил.

Один из способов решить это — **токен**. При входе сервер генерирует токен — длинную строку, которая содержит информацию о пользователе. Клиент сохраняет токен и прикладывает его к каждому запросу в заголовке. Сервер проверяет токен и узнаёт, кто делает запрос.

**JWT (JSON Web Token)** — стандартный формат такого токена. Он состоит из трёх частей, разделённых точками:

```txt
eyJhbGciOiJIUzUxMiJ9   ← Header (алгоритм)
.
eyJuYW1laWQiOiIxIn0    ← Payload (данные, Claims)
.
SflKxwRJSMeKKF2QT4fwpM ← Signature (подпись)
```

**Header** — алгоритм подписи (`HS512`).
**Payload** — данные (claims): Id пользователя, имя, роль, срок действия. Это **не зашифровано** — base64 можно раскодировать. Поэтому не кладём сюда пароли.
**Signature** — подпись, созданная секретным ключом сервера. Благодаря ней нельзя подделать токен — без знания ключа подпись не сойдётся.

```txt
Сервер знает секрет                        Клиент хранит токен
──────────────────                         ──────────────────
"my-secret-key"    →   создаёт токен   →     eyJhbG...SflKx
                              
                   ←   получает токен  ←     присылает при каждом запросе
                       проверяет подпись      
                       читает claims                         
```

Посмотреть содержимое любого JWT можно на [jwt.io](https://jwt.io).

---

## Устанавливаем пакет

В .NET 9 JWT-аутентификация доступна через один пакет:

```bash
dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer
```

![](https://i.postimg.cc/Hnn4J2kK/gb032.png)

---

## Секретный ключ в appsettings.json

Добавляем секцию в `appsettings.json`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "..."
  },
  "AppSettings": {
    "Token": "my-super-secret-key-that-is-at-least-64-characters-long-for-hs512!!"
  },
  ...
}
```

> ⚠️ Для алгоритма HmacSha512 ключ должен быть **не менее 64 символов**. Более короткий ключ вызовет исключение при запуске.

В реальном проекте этот ключ хранится в переменных окружения или в секретном хранилище — не в `appsettings.json`, который попадает в репозиторий. Но для учебного проекта так сойдёт.

---

## Генерация JWT-токена в AuthRepository

Открываю `Data/AuthRepository.cs`. Добавляю `IConfiguration` в конструктор — нужен для чтения секрета из `appsettings.json`:

```csharp
private readonly DataContext _context;
private readonly IConfiguration _configuration;

public AuthRepository(DataContext context, IConfiguration configuration)
{
    _context = context;
    _configuration = configuration;
}
```

Добавляю приватный метод `CreateToken`:

```csharp
private string CreateToken(User user)
{
    var claims = new List<Claim>
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Name, user.Username)
    };

    var key = new SymmetricSecurityKey(
        Encoding.UTF8.GetBytes(_configuration["AppSettings:Token"]!));

    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha512Signature);

    var tokenDescriptor = new SecurityTokenDescriptor
    {
        Subject = new ClaimsIdentity(claims),
        Expires = DateTime.UtcNow.AddDays(1),
        SigningCredentials = creds
    };

    var tokenHandler = new JwtSecurityTokenHandler();
    var token = tokenHandler.CreateToken(tokenDescriptor);

    return tokenHandler.WriteToken(token);
}
```

Нужные `using`:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
```

Разбираю шаги:

**Claims** — это утверждения о пользователе, которые войдут в токен. `ClaimTypes.NameIdentifier` — Id, `ClaimTypes.Name` — имя. Клиент не должен это знать: наш сервер сам прочитает эти claims при следующем запросе.

**`SymmetricSecurityKey`** — создаём ключ из секрета в `appsettings.json`. Один и тот же ключ используется и для подписи, и для проверки (поэтому symmetric).

**`SigningCredentials`** — связываем ключ с алгоритмом `HmacSha512Signature`.

**`SecurityTokenDescriptor`** — описание токена: claims, срок действия (`Expires`), подпись. `DateTime.UtcNow` вместо `DateTime.Now` — хорошая практика для токенов, чтобы не было проблем с часовыми поясами.

**`JwtSecurityTokenHandler`** — создаёт и сериализует токен в строку.

Теперь обновляю метод `Login` — возвращаем токен вместо Id:

```csharp
else
{
    response.Data = CreateToken(user);
}
```

---

## Настраиваю JWT-аутентификацию в Program.cs

Открываю `Program.cs` и добавляю конфигурацию аутентификации:

```csharp
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

// ... остальные using

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["AppSettings:Token"]!)),
            ValidateIssuer = false,
            ValidateAudience = false
        };
    });
```

**`ValidateIssuerSigningKey = true`** — проверять подпись токена. Без этого кто угодно мог бы подделать токен.

**`IssuerSigningKey`** — тот же ключ, которым подписывали. Сервер проверит подпись и поймёт, что токен настоящий.

**`ValidateIssuer = false`**, **`ValidateAudience = false`** — для простоты не проверяем, кто выдал токен и кому он предназначен.

И добавляю middleware в конвейер — **обязательно до `UseAuthorization`**:

```csharp
app.UseAuthentication(); // ← добавить
app.UseAuthorization();
```

Порядок важен: сначала ASP.NET должен опознать пользователя (Authentication), и только потом проверить его права (Authorization).

---

## Защита контроллера атрибутом [Authorize]

Открываю `Controllers/CharacterController.cs` и добавляю атрибут над классом:

```csharp
[Authorize]
[ApiController]
[Route("[controller]")]
public class CharacterController : ControllerBase
```

Теперь все методы контроллера требуют аутентификации. Попытка обратиться без токена вернёт `401 Unauthorized`.

![](https://i.postimg.cc/4NbVJqPn/gb035.png)

---

## Тестирую в Bruno

**Шаг 1.** Вхожу — `POST /auth/login`:

```json
{
    "username": "alice",
    "password": "securepass123"
}
```

В ответе получаю токен:

```json
{
    "data": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...",
    "success": true,
    "message": ""
}
```

![](https://i.postimg.cc/T11qy9P8/gb033.png)

**Шаг 2.** Копирую токен. В Bruno открываю запрос `GET /character/GetAll`, вкладка **Headers**, добавляю:

- Key: `Authorization`
- Value: `Bearer eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...`

Слово `Bearer` и пробел перед токеном — обязательны.

![](https://i.postimg.cc/L55BqT8c/gb034.png)

Теперь запрос проходит и возвращает данные.

> 💡 В Bruno можно настроить переменные окружения, чтобы не копировать токен вручную. В разделе **Environments** создать переменную `token`, и в заголовке использовать `Bearer {{token}}`. Удобно для разработки.

---

## Читаю Claims — возвращаю только персонажей текущего пользователя

Сейчас `GetAll` возвращает всех персонажей из базы — независимо от того, кто вошёл. Это неправильно: каждый пользователь должен видеть только своих.

Claims из токена доступны в контроллере через свойство `User` (оно пришло от `ControllerBase`). Это не наша модель `User` — это объект `ClaimsPrincipal`, который ASP.NET заполняет при проверке токена.

Обновляю метод `Get` в `CharacterController`:

```csharp
[HttpGet("GetAll")]
public async Task<IActionResult> Get()
{
    var userId = int.Parse(User.Claims
        .First(c => c.Type == ClaimTypes.NameIdentifier).Value);
    return Ok(await _characterService.GetAllCharacters(userId));
}
```

`User.Claims` — коллекция всех claims из токена. Ищем claim с типом `NameIdentifier` — это Id пользователя, который мы положили при создании токена.

Обновляю интерфейс сервиса:

```csharp
Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters(int userId);
```

И реализацию в `CharacterService`:

```csharp
public async Task<ServiceResponse<List<GetCharacterDto>>> GetAllCharacters(int userId)
{
    var serviceResponse = new ServiceResponse<List<GetCharacterDto>>();
    var dbCharacters = await _context.Characters
        .Where(c => c.User!.Id == userId)
        .ToListAsync();
    serviceResponse.Data = _mapper.Map<List<GetCharacterDto>>(dbCharacters);
    return serviceResponse;
}
```

`Where(c => c.User!.Id == userId)` — EF Core сделает JOIN с таблицей Users и вернёт только персонажей этого пользователя. `!` после `User` — подавляем предупреждение nullable (мы уверены, что у персонажа есть пользователь).

---
> 💡 **Если вернулся к проекту через день и больше:** JWT-токен, который мы настроили, живёт **1 день** (`DateTime.UtcNow.AddDays(1)` в методе `CreateToken`). После истечения все защищённые запросы будут возвращать `401 Unauthorized` — это нормально, токен просто устарел.
>
> Что делать: отправь `POST /auth/login` с логином и паролем, скопируй новый токен из поля `data` и обнови переменную окружения `token` в Bruno. Все запросы с `Bearer {{token}}` подхватят его автоматически.
>
> Для разработки можно увеличить срок жизни токена — например, до 7 дней: замени `AddDays(1)` на `AddDays(7)` в `AuthRepository.cs`. В продакшене так делать не стоит, но для учёбы удобно.

## Итог

Теперь приложение умеет создавать JWT-токены при входе и проверять их при каждом запросе. Защищённые эндпоинты возвращают `401 Unauthorized` без токена. После входа каждый пользователь видит только своих персонажей — через Claims из токена.

В следующей части: добавим связь между пользователем и создаваемыми персонажами — когда пользователь создаёт персонажа через POST, тот автоматически привязывается к нему.

---

*Следующая часть: Связи в EF Core — привязываем персонажей к пользователям, связи один-к-одному.*
