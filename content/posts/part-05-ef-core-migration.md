+++
title = "Часть 5. Entity Framework Core: ORM, DbContext и первая миграция"

series = "bystriy-start-aspnet-core-web-api-ef"

date = "2026-06-03"

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

До сих пор персонажи хранились в памяти — при каждом перезапуске приложения они исчезали. Пришло время подключить настоящую базу данных. В этой части разберемся с тем, что такое ORM, как работает Code First Migration и как создать первую таблицу в базе данных через Entity Framework Core.

---

## Что такое ORM и зачем он нужен

**ORM** (Object-Relational Mapping, объектно-реляционное отображение) — это технология, которая связывает объекты в коде с таблицами в базе данных.

Реляционные базы данных (SQL Server, SQLite, PostgreSQL и другие) хранят данные в **таблицах**. Строки таблицы — это записи, столбцы — поля. В коде мы работаем с **объектами** — классами и их свойствами. На первый взгляд это разные миры.

ORM берёт наши классы (модели) и автоматически создаёт из них таблицы в базе данных. Если модель изменится — ORM обновит таблицу. Нам не нужно писать SQL вручную для создания структуры базы — только описываем модели на C#.

```txt
Код (C#)                    База данных (SQL Server)
──────────────────          ──────────────────────────
class Character             таблица Characters
{                           ┌────┬──────┬──────────┐
  int Id          →         │ Id │ Name │ HitPoints│
  string Name     →         ├────┼──────┼──────────┤
  int HitPoints   →         │  1 │Frodo │   100    │
}                           └────┴──────┴──────────┘
```

**Code First Migration** — это подход, при котором мы сначала пишем код (модели), а Entity Framework потом создаёт базу данных по ним. Альтернатива — сначала спроектировать таблицы в БД, а потом генерировать модели. Первый способ удобнее: весь код живёт в одном месте, под контролем версий.

---

## Устанавливаем пакеты

Открываем терминал VS Code и устанавливаем три вещи.

**Пакет EF Core для SQL Server:**

```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer
```

Как еще один вариант, если надо точно указать версию:

```bash
dotnet add package Microsoft.EntityFrameworkCore.SqlServer --version 9.0.0
```

**Пакет для Design-time операций** (нужен для миграций):

```bash
dotnet add package Microsoft.EntityFrameworkCore.Design
```

Как еще один вариант, если надо точно указать версию:

```bash
dotnet add package Microsoft.EntityFrameworkCore.Design --version 9.0.0
```

**Глобальный инструмент EF Core** (устанавливается один раз на всю систему):

```bash
dotnet tool install --global dotnet-ef
```

> 💡 Если `dotnet-ef` уже установлен, команда выдаст ошибку. Обновить до последней версии можно через `dotnet tool update --global dotnet-ef`.

После установки в `.csproj` появятся новые строки:

```xml
<PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" Version="9.x.x" />
<PackageReference Include="Microsoft.EntityFrameworkCore.Design" Version="9.x.x" />
```

![](https://i.postimg.cc/4xQsWxQP/gb019.png)

---

## Устанавливаем SQL Server Express

Нам нужна сама база данных. Использую **SQL Server Express** — бесплатная версия SQL Server от Microsoft.

Скачать можно с официального сайта: [microsoft.com/sql-server/sql-server-downloads](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) — выбираю **Express**, запускаю установщик, выбираю **Basic**.

![](https://i.postimg.cc/VkWmKkWF/gb020.png)

После установки появится экран с **connection string** — строкой подключения. Она понадобится чуть позже. Можно скопировать и сохранить в текстовый файл.

### SQL Server Management Studio (опционально)

В том же окне установщика есть кнопка **Install SSMS** — это визуальный инструмент для работы с базой данных. Устанавливать не обязательно, но удобно: можно смотреть на таблицы, строки, делать запросы вручную.

![](https://i.postimg.cc/wjQgwjQf/gb024.png)

---

## Создаем DataContext

`DataContext` — это главный класс Entity Framework в нашем приложении. Он представляет **сессию с базой данных**: через него мы читаем данные, добавляем, обновляем и удаляем.

В VS Code создаю папку `Data` и в ней файл `DataContext.cs`:

```csharp
using dotnet_rpg.Models;
using Microsoft.EntityFrameworkCore;

namespace dotnet_rpg.Data;

public class DataContext : DbContext
{
    public DataContext(DbContextOptions<DataContext> options) : base(options) { }

    public DbSet<Character> Characters { get; set; }
}
```

Разбираю по частям.

**`: DbContext`** — наследуемся от базового класса Entity Framework. Он и содержит всю магию работы с базой данных.

**Конструктор с `DbContextOptions`** — принимает настройки подключения к базе данных (строка подключения, провайдер и т.д.) и передаёт их в базовый класс через `base(options)`. Это стандартный шаблон для любого DataContext.

**`DbSet<Character> Characters`** — это и есть связь между нашей моделью и таблицей в базе. `DbSet<T>` позволяет делать запросы к соответствующей таблице: получать, добавлять, обновлять, удалять записи. Имя свойства (`Characters`) станет именем таблицы в базе данных. По соглашению — во множественном числе.

> 💡 Каждая модель, которую мы хотим хранить в базе, должна иметь свой `DbSet` в `DataContext`. Позже добавим сюда `Users`, `Skills` и другие.

---

## Строка подключения в appsettings.json

Открывааем `appsettings.json` и добавляем секцию `ConnectionStrings`:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost\\SQLEXPRESS;Database=dotnet-rpg;Trusted_Connection=true;TrustServerCertificate=true;"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

Имя секции `ConnectionStrings` — это соглашение, которое позволяет использовать удобный метод `GetConnectionString()` при регистрации контекста.

Разберем саму строку подключения:

- `Server=localhost\\SQLEXPRESS` — адрес сервера. Двойной обратный слеш нужен для экранирования в JSON. Имя экземпляра SQL Server может быть другим — посмотри в SSMS или в строке, которую показал установщик.
- `Database=dotnet-rpg` — имя базы данных. Если её нет, Entity Framework создаст её сам при первой миграции.
- `Trusted_Connection=true` — использовать Windows-аутентификацию (текущий пользователь Windows).
- `TrustServerCertificate=true` — обязательно для .NET 9, иначе будет ошибка сертификата при локальной разработке.

> ⚠️ Строка подключения зависит от имени твоего SQL Server. Если установщик показал другое имя — используй его. Можно проверить в SSMS в поле **Server name** при подключении.

![](https://i.postimg.cc/Z5x4w5xc/gb021.png)
---

## Регистрируем DataContext в Program.cs

Открываем `Program.cs` и добавляем регистрацию контекста:

```csharp
using dotnet_rpg;
using dotnet_rpg.Data;
using dotnet_rpg.Services.CharacterService;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers()
    .AddJsonOptions(options =>
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter()));

builder.Services.AddAutoMapper(cfg => cfg.AddProfile<AutoMapperProfile>());
builder.Services.AddDbContext<DataContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<ICharacterService, CharacterService>();

builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
```

`AddDbContext<DataContext>(...)` — регистрирует наш `DataContext` в DI-контейнере. Теперь его можно внедрять в любой сервис через конструктор, как мы делали с `ICharacterService`.

`options.UseSqlServer(...)` — указывает, что используем SQL Server как провайдер базы данных. Сюда передаётся строка подключения.

`builder.Configuration.GetConnectionString("DefaultConnection")` — читает строку `DefaultConnection` из секции `ConnectionStrings` в `appsettings.json`.

---

## Первая миграция

Миграция — это способ синхронизировать код (модели) с базой данных. Каждый раз когда модели меняются, мы создаём новую миграцию — и EF знает, как обновить структуру таблиц.

> ⚠️ **Важно:** перед запуском команд миграции нужно **остановить приложение** (`Ctrl+C` в терминале). Если приложение запущено, команды миграции могут завершиться с ошибкой `Build failed`.

Создаем первую миграцию:

```bash
dotnet ef migrations add InitialCreate
```

`InitialCreate` — произвольное имя миграции. Принято называть первую миграцию так.

После выполнения в проекте появится папка `Migrations` с тремя файлами:

```txt
Migrations/
├── 20240101000000_InitialCreate.cs        ← сама миграция
├── 20240101000000_InitialCreate.Designer.cs
└── DataContextModelSnapshot.cs
```

![](https://i.postimg.cc/4xQsWxQB/gb022.png)

Открываем основной файл миграции — там два метода:

```csharp
protected override void Up(MigrationBuilder migrationBuilder)
{
    migrationBuilder.CreateTable(
        name: "Characters",
        columns: table => new
        {
            Id = table.Column<int>(nullable: false)
                .Annotation("SqlServer:Identity", "1, 1"),
            Name = table.Column<string>(nullable: true),
            HitPoints = table.Column<int>(nullable: false),
            // ... остальные поля
        },
        constraints: table =>
        {
            table.PrimaryKey("PK_Characters", x => x.Id);
        });
}

protected override void Down(MigrationBuilder migrationBuilder)
{
    migrationBuilder.DropTable(name: "Characters");
}
```

**`Up()`** — что сделать при применении миграции. Здесь: создать таблицу `Characters` со всеми столбцами. `SqlServer:Identity, "1, 1"` означает, что Id будет автоинкрементным — каждая новая запись получит Id на единицу больше предыдущей. Нам не нужно задавать Id вручную.

**`Down()`** — что сделать при откате миграции. Здесь: удалить таблицу. Это позволяет «отменить» миграцию, если что-то пошло не так.

Применяю миграцию — создаю таблицу в базе данных:

```bash
dotnet ef database update
```

EF подключится к SQL Server, создаст базу данных `dotnet-rpg` (если её не было) и выполнит таблицу `Characters`.

![](https://i.postimg.cc/DwPnxwPC/gb023.png)

Если открыть SSMS и обновить Object Explorer — появится база `dotnet-rpg` с таблицей `Characters`. Таблица пока пустая — персонажей мы добавим в следующей части уже через API.

---

## Как работают миграции дальше

Миграции — это история изменений структуры базы данных. Каждый раз, когда мы меняем модель, нужно:

1. Изменить модель в коде
2. `dotnet ef migrations add ИмяМиграции` — создать новую миграцию
3. `dotnet ef database update` — применить её к базе

Entity Framework сам разберётся, какие именно изменения нужно внести: добавить столбец, переименовать, изменить тип и т.д.

---

## Итог

Разобрался с тем, что такое ORM и Code First Migration. Установил SQL Server Express и необходимые пакеты EF Core. Создал `DataContext` — главный класс для работы с базой. Прописал строку подключения и зарегистрировал контекст в `Program.cs`. Создал первую миграцию и применил её — теперь в базе данных есть таблица `Characters`.

В следующей части: подключу сервис к базе данных и переведу все CRUD-операции на EF Core.

---

[*Следующая часть: Полный CRUD через Entity Framework Core — GET, POST, PUT, DELETE с настоящей базой данных.*](https://ghostbasenji.github.io/posts/part-06-ef-core-crud/)
