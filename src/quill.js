// The Floating Quill — Quillpad's mark.
// A bold stylized Q: a thick ink ring (the Q bowl) with the quill shaft
// crossing through as the Q's tail. Three strokes total, gentle turbulence —
// designed to read clearly at 28-32px, where the detailed feather variant
// turned to mush. quillMarkFull() keeps the original feathered quill for
// large renders (cover page, exports).

export function quillMark(id = 'qpQ', accent = '#BC5A32') {
  return `
<svg viewBox="0 0 512 512" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-label="Quillpad">
  <defs>
    <filter id="${id}">
      <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="1" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="4"/>
    </filter>
  </defs>
  <!-- the Q bowl: a thick, slightly imperfect ink ring -->
  <circle cx="256" cy="230" r="150" fill="none" stroke="currentColor"
    stroke-width="58" filter="url(#${id})"/>
  <!-- the quill shaft: enters from upper right, crosses the ring's bottom
       right and flicks out — reads as both a quill at writing angle and
       the Q's tail -->
  <path d="M 452 84 C 368 168 322 300 334 388" fill="none" stroke="currentColor"
    stroke-width="54" stroke-linecap="round" filter="url(#${id})"/>
  <!-- one bold barb on the shaft's upper edge, suggesting the feather -->
  <path d="M 414 130 C 388 118 366 118 350 126" fill="none" stroke="currentColor"
    stroke-width="30" stroke-linecap="round" filter="url(#${id})"/>
  <!-- ink tail flick off the bottom of the ring — the nib's mark -->
  <path d="M 300 392 C 316 434 348 456 386 462" fill="none" stroke="${accent}"
    stroke-width="40" stroke-linecap="round" filter="url(#${id})"/>
</svg>`;
}

export function quillMarkFull(id = 'qpRough') {
  return `
<svg viewBox="0 0 1024 1024" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-label="Quillpad">
  <defs>
    <filter id="${id}">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="1" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="10"/>
    </filter>
  </defs>
  <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <path filter="url(#${id})" d="M 700 200 Q 620 480 330 580" stroke-width="54"/>
    <path filter="url(#${id})" d="M 330 580 A 120 120 0 1 1 226 640" stroke-width="46"/>
    <path filter="url(#${id})" d="M 226 640 Q 185 690 245 748" stroke-width="40"/>
    <path filter="url(#${id})" d="M 647 336 Q 557 196 462 181" stroke-width="34"/>
    <path filter="url(#${id})" d="M 618 389 Q 528 249 433 234" stroke-width="30"/>
    <path filter="url(#${id})" d="M 585 440 Q 495 300 400 285" stroke-width="26"/>
  </g>
  <path filter="url(#${id})" d="M 415 785 Q 500 815 585 815" fill="none"
    stroke="#BC5A32" stroke-width="42" stroke-linecap="round"/>
</svg>`;
}
