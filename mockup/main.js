/* Only progressive controls. Content, navigation and native details need no JS. */
(function () {
  'use strict';
  const buttons = document.querySelectorAll('.lang-btn');
  function reflectLanguage() {
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.lang === document.documentElement.lang));
    }
  }
  reflectLanguage();
  new MutationObserver(reflectLanguage).observe(document.documentElement, {
    attributes: true, attributeFilter: ['lang']
  });
})();
