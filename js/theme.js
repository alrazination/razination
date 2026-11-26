/* Light/dark switch. Dark is the default; the choice is remembered on this device. */
(function () {
  var root = document.documentElement;
  function label(b) {
    var light = root.getAttribute('data-theme') === 'light';
    b.setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme');
    b.setAttribute('aria-pressed', String(light));
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-theme-toggle]'), function (b) {
    label(b);
    b.addEventListener('click', function () {
      var light = root.getAttribute('data-theme') !== 'light';
      root.setAttribute('data-theme', light ? 'light' : 'dark');
      try { localStorage.setItem('raz-theme', light ? 'light' : 'dark'); } catch (e) {}
      label(b);
    });
  });
})();
