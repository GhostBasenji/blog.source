+++
title = "Отображение и обработка изображений в WPF (XAML + C#)"
date = "2026-05-17"
categories = ["wpf"]
tags = ["wpf", "csharp", "xaml", "dotnet"]
+++

---

## Введение

В этой статье рассмотрим простой WPF‑проект **ImageViewer**, который демонстрирует базовую работу с изображениями: загрузку, отображение и простую обработку без использования сторонних библиотек.

Несмотря на кажущуюся простоту задачи, работа с изображениями в WPF построена на отдельной графической модели. Поэтому важно понимать не только *как* загрузить картинку, но и *что именно происходит внутри WPF*.

Поддерживаемые форматы:

- BMP
- GIF
- ICO
- JPG / JPEG
- PNG
- TIFF
- WDP

В статье реализуем:

- загрузку изображения;
- отображение в интерфейсе;
- поворот;
- масштабирование;
- преобразование в оттенки серого;
- обрезку изображения.

Кроме того, разберём, зачем в WPF используется `BitmapImage` и почему без него нельзя просто взять и отобразить файл.

---

## Базовый элемент `Image` в WPF

В WPF элемент `Image` используется для отображения графики в интерфейсе.

Однако здесь есть важный нюанс:

> WPF не работает с файлами изображений напрямую.

На первый взгляд кажется, что изображение — это просто файл (`.jpg`, `.png`). Но WPF работает не с файлами, а с объектами изображений (`ImageSource`), содержащими уже декодированные пиксели.

Упрощённая модель выглядит так:

```text
Файл изображения
      ↓
BitmapImage (декодирование)
      ↓
BitmapSource (пиксели)
      ↓
Image.Source (отображение)
```

## Что такое `BitmapImage`

`BitmapImage` — это специальный класс WPF для загрузки изображения из файла, URI или потока.

Проще говоря:

> `BitmapImage` — это загрузчик и декодер изображений для WPF.

Он:

- читает файл;
- декодирует формат изображения;
- преобразует данные в пиксели;
- делает изображение пригодным для отображения в интерфейсе.

Важно понимать:

> `Image` сам по себе ничего не знает о файлах на диске.

Он умеет только отображать `ImageSource`, а `BitmapImage` помогает создать такой объект.

Внутри `BitmapImage` используется системный механизм Windows — **Windows Imaging Component (WIC)**, отвечающий за декодирование популярных графических форматов.

---

## Интерфейс приложения (XAML)

Ниже приведён базовый интерфейс приложения.

```xml
<Window x:Class="ImageViewer.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="Image Viewer"
        Height="450"
        Width="800">

    <Grid Margin="10">

        <!-- Выбор файла -->
        <Button x:Name="BrowseButton"
                Content="Обзор"
                Width="120"
                Height="30"
                HorizontalAlignment="Left"
                VerticalAlignment="Top"
                Click="BrowseButton_Click"/>

        <!-- Отображение пути -->
        <Label x:Name="FileNameLabel"
               Content="Файл не выбран"
               Margin="130,0,0,0"
               Height="30"
               VerticalAlignment="Top"/>

        <!-- Отображение изображения -->
        <Image x:Name="ImageViewer"
               Margin="0,40,0,0"
               Stretch="Uniform"
               StretchDirection="Both"/>

    </Grid>
</Window>
```

## Загрузка изображения

Для выбора файла используется `OpenFileDialog`, а для загрузки — `BitmapImage`.

```csharp
private void BrowseButton_Click(object sender, RoutedEventArgs e)
{
    var dlg = new OpenFileDialog
    {
        InitialDirectory = @"C:\",
        Filter = "Images|*.jpg;*.jpeg;*.png;*.bmp;*.gif;*.tiff;*.ico",
        RestoreDirectory = true
    };

    if (dlg.ShowDialog() != true)
        return;

    _selectedFilePath = dlg.FileName;

    FileNameLabel.Content = _selectedFilePath;

    // Создаём BitmapImage
    var bitmap = new BitmapImage();

    bitmap.BeginInit();

    // Указываем путь к изображению
    bitmap.UriSource =
        new Uri(_selectedFilePath,
                UriKind.Absolute);

    // Загружаем изображение в память
    bitmap.CacheOption =
        BitmapCacheOption.OnLoad;

    bitmap.EndInit();

    // Оптимизация WPF
    bitmap.Freeze();

    ImageViewer.Source = bitmap;
}
```

## Поворот изображения

WPF поддерживает поворот через свойство `BitmapImage.Rotation`.

```csharp
private void RotateButton_Click(object sender, RoutedEventArgs e)
{
    if (string.IsNullOrEmpty(_selectedFilePath))
        return;

    Rotation[] rotations =
    {
        Rotation.Rotate0,
        Rotation.Rotate90,
        Rotation.Rotate180,
        Rotation.Rotate270
    };

    int index = RotationComboBox.SelectedIndex;

    var bitmap = new BitmapImage();

    bitmap.BeginInit();
    bitmap.UriSource =
        new Uri(_selectedFilePath,
                UriKind.Absolute);

    bitmap.CacheOption =
        BitmapCacheOption.OnLoad;

    // Применяем выбранный угол
    bitmap.Rotation = rotations[index];

    bitmap.EndInit();
    bitmap.Freeze();

    ImageViewer.Source = bitmap;
}
```

## Масштабирование изображения (`Stretch`)

WPF позволяет управлять отображением изображения без изменения его исходных данных.

```xml
<Image x:Name="ImageViewer"
       Stretch="Uniform"
       StretchDirection="Both"/>
```

Основные режимы:

- `Uniform` — сохраняет пропорции;
- `Fill` — растягивает изображение;
- `UniformToFill` — заполняет область с возможной обрезкой.

В большинстве случаев рекомендуется использовать `Uniform`, чтобы избежать искажений.

## Оттенки серого (Grayscale)

Для преобразования используется `FormatConvertedBitmap`.

```csharp
private void GrayscaleButton_Click(object sender, RoutedEventArgs e)
{
    if (string.IsNullOrEmpty(_selectedFilePath))
        return;

    var source = new BitmapImage(
        new Uri(_selectedFilePath,
                UriKind.Absolute));

    var gray =
        new FormatConvertedBitmap();

    gray.BeginInit();

    // Исходное изображение
    gray.Source = source;

    // Преобразование в grayscale
    gray.DestinationFormat =
        System.Windows.Media
            .PixelFormats.Gray32Float;

    gray.EndInit();
    gray.Freeze();

    ImageViewer.Source = gray;
}
```

## Обрезка изображения

Для обрезки используется `CroppedBitmap`.

```csharp
private void CropButton_Click(object sender, RoutedEventArgs e)
{
    if (string.IsNullOrEmpty(_selectedFilePath))
        return;

    var bitmap = new BitmapImage();

    bitmap.BeginInit();
    bitmap.UriSource =
        new Uri(_selectedFilePath,
                UriKind.Absolute);

    bitmap.CacheOption =
        BitmapCacheOption.OnLoad;

    bitmap.EndInit();
    bitmap.Freeze();

    // Область обрезки
    var rect =
        new Int32Rect(50, 50, 200, 200);

    var cropped =
        new CroppedBitmap(bitmap, rect);

    cropped.Freeze();

    ImageViewer.Source = cropped;
}
```

`Int32Rect` задаёт прямоугольную область:

```text
X, Y, Width, Height
```

## Архитектурная модель обработки изображений в WPF

Практически все операции строятся вокруг одной идеи:

```text
BitmapSource
      ↓
трансформация
      ↓
новый BitmapSource
```

Это означает:

- исходное изображение не изменяется;
- каждая операция создаёт новый объект;
- цепочки преобразований легко комбинируются.

## Итог

WPF предоставляет встроенные инструменты для обработки изображений:

- `BitmapImage`;
- `Rotation`;
- `Stretch`;
- `FormatConvertedBitmap`;
- `CroppedBitmap`.

Этого достаточно для создания простого image viewer или основы будущего редактора изображений.

