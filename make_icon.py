"""Generate icon.png — D-letter with suspension bridge, neon cyan on dark navy."""
import cairosvg, os

# Viewbox 480x480 for precision, output scaled to target sizes
SVG = """
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 480" width="480" height="480">
  <defs>
    <!-- Background radial gradient -->
    <radialGradient id="bg" cx="46%" cy="44%" r="52%">
      <stop offset="0%"   stop-color="#132245"/>
      <stop offset="55%"  stop-color="#08152e"/>
      <stop offset="100%" stop-color="#030c1d"/>
    </radialGradient>

    <!-- Outer rim gradient -->
    <radialGradient id="rim" cx="50%" cy="50%" r="50%">
      <stop offset="88%" stop-color="transparent"/>
      <stop offset="95%" stop-color="#0a1f45" stop-opacity="0.8"/>
      <stop offset="100%" stop-color="#030c1d"/>
    </radialGradient>

    <!-- Cyan neon glow — heavy -->
    <filter id="glow-heavy" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="b1"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="b2"/>
      <feMerge>
        <feMergeNode in="b1"/>
        <feMergeNode in="b2"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <!-- Cyan neon glow — light -->
    <filter id="glow-light" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="b1"/>
      <feMerge>
        <feMergeNode in="b1"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>

    <clipPath id="circle-clip">
      <circle cx="240" cy="240" r="236"/>
    </clipPath>
  </defs>

  <!-- Background -->
  <circle cx="240" cy="240" r="240" fill="url(#bg)"/>

  <!-- Content clipped to circle -->
  <g clip-path="url(#circle-clip)">

    <!-- ====================================================
         LETTER D  (hollow thick-walled letter)
         Left bar: x 118–148, y 84–396
         Outer right arc: x 148→ out to ~370 @ y=240 → back to 148,396
         Inner right arc: x 148→ out to ~338 @ y=240 → back to 148,368
    ==================================================== -->
    <g filter="url(#glow-heavy)">

      <!-- D fill path using even-odd rule to hollow it -->
      <path fill-rule="evenodd" fill="#00d8c2"
        d="
          M 118,84
          L 148,84
          C 248,84 376,142 376,240
          C 376,338 248,396 148,396
          L 118,396
          Z

          M 148,112
          C 234,112 346,160 346,240
          C 346,320 234,368 148,368
          L 148,112
          Z
        "
      />

    </g>

    <!-- ====================================================
         SUSPENSION BRIDGE
         Deck at y≈268, spans from x≈122 to x≈360
         Two pylons at x≈200 and x≈290, height 76px above deck (y 192–268)
         Suspension cables arc from pylon tops outward
         Hangers drop from cables to deck
         Windows below deck
    ==================================================== -->
    <g filter="url(#glow-light)">

      <!-- Bridge deck (road) — two parallel lines for thickness -->
      <rect x="122" y="263" width="238" height="10" rx="3" fill="#00d8c2"/>
      <rect x="122" y="276" width="238" height="4"  rx="2" fill="#00d8c2" opacity="0.5"/>

      <!-- Left pylon -->
      <rect x="194" y="190" width="14" height="78" rx="3" fill="#00d8c2"/>
      <!-- Right pylon -->
      <rect x="274" y="190" width="14" height="78" rx="3" fill="#00d8c2"/>
      <!-- Pylon caps -->
      <rect x="190" y="184" width="22" height="10" rx="3" fill="#00d8c2"/>
      <rect x="270" y="184" width="22" height="10" rx="3" fill="#00d8c2"/>

      <!-- Suspension cables:
           Left pylon top (201,184) → far left of deck (122,263)
           Left pylon top (201,184) → right pylon top (281,184) -->
      <path d="M 201,184 Q 155,215 122,263" fill="none" stroke="#00d8c2" stroke-width="5" stroke-linecap="round"/>
      <path d="M 281,184 Q 330,215 360,263" fill="none" stroke="#00d8c2" stroke-width="5" stroke-linecap="round"/>
      <!-- Cable between pylons (catenary) -->
      <path d="M 201,184 Q 241,200 281,184" fill="none" stroke="#00d8c2" stroke-width="5" stroke-linecap="round"/>

      <!-- Vertical hangers — left side -->
      <line x1="147" y1="240" x2="147" y2="263" stroke="#00d8c2" stroke-width="3.5"/>
      <line x1="165" y1="228" x2="165" y2="263" stroke="#00d8c2" stroke-width="3.5"/>
      <line x1="183" y1="218" x2="183" y2="263" stroke="#00d8c2" stroke-width="3.5"/>
      <!-- Vertical hangers — right side -->
      <line x1="335" y1="240" x2="335" y2="263" stroke="#00d8c2" stroke-width="3.5"/>
      <line x1="317" y1="228" x2="317" y2="263" stroke="#00d8c2" stroke-width="3.5"/>
      <line x1="299" y1="218" x2="299" y2="263" stroke="#00d8c2" stroke-width="3.5"/>

      <!-- Bridge span windows below deck -->
      <rect x="130" y="283" width="26" height="16" rx="2" fill="none" stroke="#00d8c2" stroke-width="3"/>
      <rect x="163" y="283" width="26" height="16" rx="2" fill="none" stroke="#00d8c2" stroke-width="3"/>
      <rect x="196" y="283" width="26" height="16" rx="2" fill="none" stroke="#00d8c2" stroke-width="3"/>
      <rect x="229" y="283" width="26" height="16" rx="2" fill="none" stroke="#00d8c2" stroke-width="3"/>
      <rect x="262" y="283" width="26" height="16" rx="2" fill="none" stroke="#00d8c2" stroke-width="3"/>
      <rect x="295" y="283" width="26" height="16" rx="2" fill="none" stroke="#00d8c2" stroke-width="3"/>
      <rect x="328" y="283" width="24" height="16" rx="2" fill="none" stroke="#00d8c2" stroke-width="3"/>

    </g>

  </g>

  <!-- Outer rim overlay -->
  <circle cx="240" cy="240" r="240" fill="url(#rim)"/>
  <circle cx="240" cy="240" r="236" fill="none" stroke="#07203a" stroke-width="5"/>
</svg>
"""

os.makedirs("/home/user/DEVICE-APP/assets/466x466", exist_ok=True)

# icon.png at root (240×240 — standard app icon size)
cairosvg.svg2png(bytestring=SVG.encode(),
                 write_to="/home/user/DEVICE-APP/icon.png",
                 output_width=240, output_height=240)

# Large version for 466x466 device assets
cairosvg.svg2png(bytestring=SVG.encode(),
                 write_to="/home/user/DEVICE-APP/assets/466x466/icon.png",
                 output_width=466, output_height=466)

print("Done.")
print("  icon.png:", os.path.getsize("/home/user/DEVICE-APP/icon.png"), "bytes")
print("  assets icon:", os.path.getsize("/home/user/DEVICE-APP/assets/466x466/icon.png"), "bytes")
