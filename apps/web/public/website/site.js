/* Brewistan public website. No analytics, cookies, storage, SDKs or account writes. */
(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const demo = byId('hero-card');
  const add = byId('add-stamp');
  const reset = byId('reset-demo');
  let stamps = 5;
  document.querySelector('.demo-controls')?.removeAttribute('hidden');

  function updateDemo(announce = true) {
    if (!demo || !add) return;
    demo.querySelectorAll('[data-stamp]').forEach((element, index) => {
      element.classList.toggle('is-earned', index < stamps);
    });
    const complete = stamps === 8;
    byId('hero-count').textContent = `${stamps} / 8`;
    byId('hero-remaining').textContent = complete ? 'Your coffee reward is ready' : `${8 - stamps} more stamps to your reward`;
    byId('hero-reward').textContent = complete ? 'Your next coffee is on us.' : 'Your 9th coffee is on us.';
    byId('toast-title').textContent = complete ? 'A little thank-you, earned.' : 'Another visit. Another little reward.';
    byId('toast-body').textContent = complete ? 'Demo reward ready. No real stamps were added.' : `Demo stamp added. ${stamps} of 8 collected.`;
    demo.setAttribute('aria-label', `Sample Sora Coffee loyalty card, ${stamps} of 8 stamps${complete ? ', reward ready' : ''}`);
    add.querySelector('span').textContent = complete ? 'Start a new demo card' : 'Try a demo stamp';
    if (announce) byId('demo-announcement').textContent = complete
      ? 'Demo: eight stamps collected. Your reward is ready. No real loyalty account was changed.'
      : `Demo: ${stamps} of eight stamps collected. ${8 - stamps} more to a reward.`;
  }
  add?.addEventListener('click', () => { stamps = stamps === 8 ? 0 : stamps + 1; updateDemo(); });
  reset?.addEventListener('click', () => { stamps = 5; updateDemo(false); byId('demo-announcement').textContent = 'Demo reset to five of eight stamps.'; byId('toast-title').textContent = 'Demo reset. Ready for another visit.'; byId('toast-body').textContent = 'Five sample stamps. No account changes.'; });

  const styles = {
    classic: { caption: 'Classic \u00b7 warm metallic character', label: 'CLASSIC' },
    signature: { caption: 'Signature \u00b7 your brand, beautifully expressed', label: 'SIGNATURE' },
    bespoke: { caption: 'Bespoke \u00b7 a more individual expression', label: 'BESPOKE' },
  };
  document.querySelectorAll('[data-design]').forEach((button) => {
    button.disabled = false;
    button.addEventListener('click', () => {
      const design = button.dataset.design;
      const style = styles[design];
      const preview = byId('design-card');
      if (!style || !preview) return;
      document.querySelectorAll('[data-design]').forEach((other) => {
        const selected = other === button;
        other.setAttribute('aria-pressed', String(selected));
        other.classList.toggle('is-selected', selected);
      });
      preview.classList.remove('card-classic', 'card-signature', 'card-bespoke');
      preview.classList.add(`card-${design}`);
      // Keep the member-number span. Only the edition's text node changes.
      byId('design-edition').firstChild.textContent = style.label;
      byId('design-caption').textContent = style.caption;
      byId('design-announcement').textContent = `${style.label} concept selected. Illustrative style, not a live card editor. Actual options follow your package. Native wallet layouts will follow each platform's rules.`;
    });
  });

  const menu = byId('mobile-menu');
  const summary = menu?.querySelector('summary');
  menu?.querySelectorAll('a').forEach((anchor) => anchor.addEventListener('click', () => { menu.open = false; }));
  menu?.addEventListener('toggle', () => summary?.setAttribute('aria-label', menu.open ? 'Close navigation menu' : 'Open navigation menu'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu?.open) { menu.open = false; summary?.focus(); }
  });
  document.addEventListener('click', (event) => {
    if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  });
  // Native details/summary elements keep navigation and FAQs usable without JS.
})();
