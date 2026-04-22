/**
 * BuildingScene — tematická hero animácia.
 *
 * Minimalistická večerná scéna mesta:
 *   - Tmavá vrstva v pozadí: silueta okolitých budov (parallax depth)
 *   - Stredná vrstva: hlavný bytový dom + nižšia susedná budova
 *   - 20 okien v hlavnej budove + 8 okien v susednej — náhodne sa zapaľujú
 *   - Obloha: day→night cyklus (~45s), vtáčik pomaly preletí raz za 30s
 *
 * Všetko CSS-only animácie, respektuje prefers-reduced-motion.
 */

export function BuildingScene() {
  // 5 poschodí × 4 okná = 20 cells
  const windows: Array<{ col: number; row: number; delay: number; dur: number }> = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 4; col++) {
      windows.push({
        col, row,
        delay: ((row * 4 + col) * 0.37) % 7,
        dur: 6 + ((row + col) % 4),
      });
    }
  }

  const W_SIZE = 22;
  const W_GAP = 10;
  const PAD_X = 24;
  const PAD_TOP = 30;
  const PAD_BOTTOM = 28;
  const BLD_W = PAD_X * 2 + 4 * W_SIZE + 3 * W_GAP;
  const BLD_H = PAD_TOP + 5 * W_SIZE + 4 * W_GAP + PAD_BOTTOM;
  const SCENE_W = BLD_W + 80;
  const SCENE_H = BLD_H + 40;

  return (
    <div className="building-scene" aria-hidden="true">
      {/* Obloha s day-night cyklom */}
      <div className="sky-cycle" />

      {/* Vtáčik — absolútny element letiaci naprieč */}
      <div className="bird" aria-hidden="true">
        <svg viewBox="0 0 24 12" width="20" height="10">
          <path
            d="M0 8 Q 4 2 8 6 Q 10 2 12 6 Q 16 2 20 8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Hlavná budova + susedná + pozadie */}
      <svg
        className="building-svg"
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMax meet"
      >
        {/* Vzdialené mesto — tmavá paralax vrstva (bez okien, len siluety) */}
        <g className="city-far">
          <rect x="-20" y={BLD_H - 90} width="55" height="135" rx="1" />
          <rect x="38" y={BLD_H - 60} width="30" height="105" rx="1" />
          <rect x={SCENE_W - 120} y={BLD_H - 75} width="35" height="120" rx="1" />
          <rect x={SCENE_W - 80} y={BLD_H - 100} width="40" height="145" rx="1" />
          <rect x={SCENE_W - 35} y={BLD_H - 55} width="25" height="100" rx="1" />
          {/* Antény */}
          <line x1={SCENE_W - 60} y1={BLD_H - 100} x2={SCENE_W - 60} y2={BLD_H - 115} className="city-antenna" />
          <line x1={15} y1={BLD_H - 90} x2={15} y2={BLD_H - 102} className="city-antenna" />
        </g>

        {/* Susedná nižšia budova (stredná vrstva) */}
        <g className="bld-side">
          <rect x="0" y="80" width="70" height={BLD_H - 80 + 40} rx="2" />
          {[0, 1, 2, 3].map((r) =>
            [0, 1].map((c) => (
              <rect
                key={`side-${r}-${c}`}
                x={10 + c * 24}
                y={96 + r * 24}
                width="14"
                height="14"
                className="bld-side-window"
                style={{ animationDelay: `${(r + c) * 0.9}s` }}
              />
            ))
          )}
        </g>

        {/* Hlavný bytový dom */}
        <g transform={`translate(80, 20)`}>
          <path
            d={`M 0 15 L 10 0 L ${BLD_W - 10} 0 L ${BLD_W} 15 L ${BLD_W} ${BLD_H + 20} L 0 ${BLD_H + 20} Z`}
            className="bld-body"
          />
          <line x1="8" y1="20" x2={BLD_W - 8} y2="20" className="bld-line" />
          <line x1="8" y1={BLD_H + 14} x2={BLD_W - 8} y2={BLD_H + 14} className="bld-line" />

          {windows.map((w, i) => {
            const x = PAD_X + w.col * (W_SIZE + W_GAP);
            const y = PAD_TOP + w.row * (W_SIZE + W_GAP);
            return (
              <g key={i}>
                <rect
                  x={x} y={y} width={W_SIZE} height={W_SIZE}
                  className="bld-window"
                  style={{ animationDelay: `${w.delay}s`, animationDuration: `${w.dur}s` }}
                />
                <line x1={x + W_SIZE / 2} y1={y} x2={x + W_SIZE / 2} y2={y + W_SIZE} className="bld-crossing" />
                <line x1={x} y1={y + W_SIZE / 2} x2={x + W_SIZE} y2={y + W_SIZE / 2} className="bld-crossing" />
              </g>
            );
          })}

          <rect x={BLD_W / 2 - 18} y={BLD_H - 8} width="36" height="28" className="bld-door" />
          <circle cx={BLD_W / 2 + 10} cy={BLD_H + 6} r="1.5" className="bld-handle" />
        </g>

        {/* Zem / chodník */}
        <line x1="0" y1={SCENE_H - 1} x2={SCENE_W} y2={SCENE_H - 1} className="bld-ground" />
      </svg>
    </div>
  );
}
