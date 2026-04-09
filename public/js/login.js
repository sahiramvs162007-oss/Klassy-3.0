const slides = document.querySelectorAll(".slide");
let index = 0;

setInterval(() => {
  slides[index].classList.remove("active");

  index = (index + 1) % slides.length;

  slides[index].classList.add("active");
}, 4000);


/* ═══════════════════════════════════════════════════
       Animación del borde — JS puro con requestAnimationFrame
       Técnica: stroke-dasharray = perímetro del rect,
       se anima strokeDashoffset de 0 a -perímetro en bucle
       ═══════════════════════════════════════════════════ */
    (function () {
      var rect       = document.getElementById('borderRect');
      var svg        = document.getElementById('borderSvg');
      var wrapper    = document.getElementById('cardWrapper');
      var perimeter  = 0;
      var offset     = 0;
      var speed      = 0.8;   // px por frame — ajusta para velocidad
      var raf;

      function setup() {
        var W = wrapper.offsetWidth;
        var H = wrapper.offsetHeight;

        // Tamaño del SVG
        svg.setAttribute('width',  W + 6);
        svg.setAttribute('height', H + 6);
        svg.setAttribute('viewBox', '0 0 ' + (W + 6) + ' ' + (H + 6));

        // Dimensiones del rect (margen de 3px)
        rect.setAttribute('width',  W);
        rect.setAttribute('height', H);

        // Perímetro real
        perimeter = 2 * (W + H);

        // Configurar stroke-dasharray con el perímetro completo
        // Solo una porción del trazo es visible (dash visible ≈ 35% del perímetro)
        var dashLen = Math.round(perimeter * 0.35);
        var gapLen  = perimeter - dashLen;
        rect.style.strokeDasharray  = dashLen + ' ' + gapLen;
        rect.style.strokeDashoffset = 0;
        rect.style.strokeWidth      = '3';
        rect.style.fill             = 'none';
        rect.style.stroke           = 'url(#borderGradient)';
        rect.style.filter           = 'drop-shadow(0 0 5px rgba(74,141,248,0.8)) drop-shadow(0 0 10px rgba(74,141,248,0.4))';

        offset = 0;
      }

      function animate() {
        offset -= speed;
        if (Math.abs(offset) >= perimeter) offset = 0;
        rect.style.strokeDashoffset = offset;
        raf = requestAnimationFrame(animate);
      }

      function init() {
        if (raf) cancelAnimationFrame(raf);
        setup();
        animate();
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }

      window.addEventListener('resize', init);
    })();