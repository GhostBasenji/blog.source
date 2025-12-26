+++
title = "Avalonia UI в Ubuntu. Взаимодействие с элементами управления"
date = "2025-09-17"
categories = ["Avalonia", "Ubuntu"]
tags = ["Avalonia", "dotnet", "UI", "C#"]
+++

Итак, вышел второй пост из серии “Avalonia UI в Ubuntu”. В этом посте узнаем, как взаимодействовать с элементами управления (Controls), продолжая использовать наше приложение, созданное в [предыдущем посте](https://ghostbasenji.github.io/post/avalonia-v-ubuntu-nachalo/).

<!--more-->

### Добавление элементов управления

Первым делом открываем файл MainWindow.xaml проекта MyApp. В нем находим и удаляем текст “Welcome to Avalonia!”. А потом напишем следующий код:

```xml
<StackPanel Orientation="Vertical">
</StackPanel>
```

Вышеприведенный код создает **StackPanel** (отвечает за разметку) с вертикальной ориентацией. А это приведет к тому, что элементы управления будут располагаться один за другим, так что на данный момент можем не беспокоиться об их расположении.
Далее добавляем в StackPanel следующие элементы управления: **TextBlock** с именем *NameLabel*, **TextBox** с *NameTextBox*, **Button** c *GreetButton* и еще один **TextBlock** с *MessageLabel*.

```xml
<TextBlock Name="NameLabel">What is your name?</TextBlock>
<TextBox Name="NameTextBox"></TextBox>
<Button Name="GreetButton">Say Hello!</Button>
<TextBlock Name="MessageLabel"></TextBlock>
```
Если запустим проект с помощью команды **dotnet run**, то увидим следующее:

[005]

В данный момент окно слишком большое, но его размеры можно изменить, задав значения размеров по умолчанию. Изменение свойств окна **Window** будем рассматривать в следующих уроках.

### Управление событием клика

Чтобы работать с событием клика, нам нужно сначала добавить обработчик события со следующей сигнатурой внутри класса из файла ***MainWindow.axaml.cs***.

```cs
public void GreetButton_Click(object sender, RoutedEventArgs e)
{
    // Здесь пишем логику обработчика события
}
```

После чего добавляем строку **using Avalonia.Interactivity;** в этот же файл. Затем изменяем тег Button в XAML, добавив свойство ***Click*** с именем метода в качестве значения:

```xml
<Button Name="GreetButton" Click="GreetButton_Click">Say Hello!</Button>
```

### Доступ к элементам управления

Учитывая, что наш проект использует базовый шаблон Avalonia, нам нужно получить доступ к элементам управления вручную из исходного кода. Внутри метода **GreetButton_Click** напишем следующее:

```cs
public void GreetButton_Click(object sender, RoutedEventArgs e)
{
    var nameControl = this.FindControl<TextBox>("NameTextBox");
    var messageControl = this.FindControl<TextBlock>("MessageLabel");

    messageControl.Text = $"Hello {nameControl.Text} !";
}
```

Метод **FindControl<T>** позволяет извлекать ссылки на элементы управления из окна.

В этом примере используем свойство Text для считывания значения из текстового поля и передачи его в Message Label.

```cs
messageControl.Text = $"Hello {nameControl.Text} !";
```

Далее запускаем приложение, введём свое имя и кликаем по кнопке. Появится надпись с приветственным сообщением.

[006]