(function () {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("mobileMenu");
  const overlay = document.getElementById("sidebarOverlay");
  if (!sidebar || !toggle || !overlay) return;

  function setOpen(open) {
    sidebar.classList.toggle("open", open);
    overlay.classList.toggle("visible", open);
    toggle.setAttribute("aria-expanded", String(open));
  }

  toggle.addEventListener("click", function () {
    setOpen(!sidebar.classList.contains("open"));
  });
  overlay.addEventListener("click", function () { setOpen(false); });
}());
