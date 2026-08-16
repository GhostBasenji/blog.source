(function () {
  var input = document.getElementById('site-search-input');
  var resultsBox = document.getElementById('site-search-results');
  if (!input || !resultsBox) return;

  var indexData = null;
  var indexLoaded = false;

  function loadIndex() {
    if (indexLoaded) return Promise.resolve(indexData);
    return fetch('/index.json')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        indexData = data;
        indexLoaded = true;
        return data;
      });
  }

  function render(items, query) {
    if (!query) {
      resultsBox.innerHTML = '';
      resultsBox.classList.remove('is-open');
      return;
    }
    if (!items.length) {
      resultsBox.innerHTML = '<p class="search-empty">Ничего не найдено</p>';
      resultsBox.classList.add('is-open');
      return;
    }
    var html = items.slice(0, 8).map(function (item) {
      return '<a class="search-result" href="' + item.permalink + '">' +
        '<span class="search-result-title">' + item.title + '</span>' +
        '<span class="search-result-summary">' + (item.summary || '').slice(0, 90) + '…</span>' +
        '</a>';
    }).join('');
    resultsBox.innerHTML = html;
    resultsBox.classList.add('is-open');
  }

  function search(query) {
    var q = query.trim().toLowerCase();
    if (!q) { render([], ''); return; }
    loadIndex().then(function (data) {
      var found = data.filter(function (item) {
        var haystack = (
          item.title + ' ' +
          (item.summary || '') + ' ' +
          (item.tags || []).join(' ') + ' ' +
          (item.categories || []).join(' ')
        ).toLowerCase();
        return haystack.indexOf(q) !== -1;
      });
      render(found, q);
    });
  }

  var debounceTimer;
  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    var value = input.value;
    debounceTimer = setTimeout(function () { search(value); }, 150);
  });

  input.addEventListener('focus', loadIndex);
})();