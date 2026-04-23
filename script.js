const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');

if (menuToggle && mobileMenu) {
  menuToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('open');
    document.body.classList.toggle('menu-open');
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      document.body.classList.remove('menu-open');
    });
  });
}

const cards = document.querySelectorAll('.loyalty-card');
const indicators = document.querySelectorAll('.carousel-indicators button');
let activeIndex = 0;
let intervalId;

function showCard(index) {
  cards.forEach((card, i) => card.classList.toggle('active', i === index));
  indicators.forEach((dot, i) => dot.classList.toggle('active', i === index));
  activeIndex = index;
}

function startCarousel() {
  intervalId = setInterval(() => {
    const nextIndex = (activeIndex + 1) % cards.length;
    showCard(nextIndex);
  }, 3000);
}

function resetCarousel() {
  clearInterval(intervalId);
  startCarousel();
}

indicators.forEach((dot, index) => {
  dot.addEventListener('click', () => {
    showCard(index);
    resetCarousel();
  });
});

showCard(0);
startCarousel();
