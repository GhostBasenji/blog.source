const toggleBtn = document.getElementById('theme-toggle');
if (toggleBtn) { // проверяем, есть ли кнопка
  const darkLinkId = 'dark-theme';

  function enableDark() {
    if (!document.getElementById(darkLinkId)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.id = darkLinkId;
      link.href = '/css/dark.css';
      document.head.appendChild(link);
    }
    localStorage.setItem('theme', 'dark');
    toggleBtn.textContent = '☀️';
  }

  function disableDark() {
    const link = document.getElementById(darkLinkId);
    if (link) link.remove();
    localStorage.setItem('theme', 'light');
    toggleBtn.textContent = '🌙';
  }

  // Применяем тему при загрузке
  if (localStorage.getItem('theme') === 'dark') {
    enableDark();
  }

  // Переключение по клику
  toggleBtn.addEventListener('click', () => {
    if (localStorage.getItem('theme') === 'dark') {
      disableDark();
    } else {
      enableDark();
    }
  });
}
