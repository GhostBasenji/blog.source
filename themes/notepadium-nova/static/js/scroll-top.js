// scroll-top.js

const scrollBtn = document.getElementById("scrollTopBtn");

// Показать кнопку после 200px прокрутки
window.addEventListener("scroll", () => {
  if (window.scrollY > 400) {
    scrollBtn.style.display = "block";
  } else {
    scrollBtn.style.display = "none";
  }
});

// Плавный скролл наверх при клике
scrollBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});
