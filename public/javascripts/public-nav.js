(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".navbar-toggle");
  var nav = document.getElementById("primary-navigation");
  if (!header || !toggle || !nav) return;

  function setMenuOpen(open) {
    header.classList.toggle("menu-open", open);
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  }

  toggle.addEventListener("click", function () {
    setMenuOpen(toggle.getAttribute("aria-expanded") !== "true");
  });
  nav.addEventListener("click", function (event) {
    if (event.target.closest("a")) setMenuOpen(false);
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenuOpen(false);
  });
  window.addEventListener("resize", function () {
    if (window.matchMedia("(min-width: 901px)").matches) setMenuOpen(false);
  });
}());
