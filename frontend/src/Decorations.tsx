// Декор векторный: не требует внешних шрифтов, изображений или сети.
export function FlowerSprig({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 180 220" fill="none" aria-hidden="true">
    <g stroke="#87906e" strokeWidth="2.2" strokeLinecap="round">
      <path d="M87 205C94 158 111 102 129 42M88 202C78 151 61 116 45 83M95 173C115 146 140 133 153 104" />
      <path d="M92 177C59 172 54 154 55 144C72 146 86 157 92 177ZM105 134C110 109 123 97 134 97C131 114 120 127 105 134ZM78 151C56 142 51 129 55 120C67 125 74 137 78 151ZM114 150C133 148 145 139 147 129C131 131 120 137 114 150Z" fill="#a3aa83" />
    </g>
    {[[129, 40, -16], [44, 79, -32], [155, 101, 20]].map(([x, y, rotation], i) => <g key={i} transform={`translate(${x} ${y}) rotate(${rotation})`}>
      <g fill={i === 1 ? '#e8b1a4' : '#dca3ad'} stroke="#b97782" strokeWidth="1.2">
        <ellipse cy="-12" rx="7" ry="13" /><ellipse cx="11" cy="-4" rx="7" ry="13" transform="rotate(65 11 -4)" /><ellipse cx="7" cy="9" rx="7" ry="12" transform="rotate(140 7 9)" /><ellipse cx="-8" cy="8" rx="7" ry="12" transform="rotate(215 -8 8)" /><ellipse cx="-12" cy="-5" rx="7" ry="12" transform="rotate(285 -12 -5)" />
      </g><circle r="4" fill="#bd885e" />
    </g>)}
  </svg>;
}

export function BloomMark() {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true"><g stroke="currentColor" strokeWidth="1.5">
    {[0, 60, 120, 180, 240, 300].map(angle => <ellipse key={angle} cx="24" cy="14" rx="5.5" ry="10" transform={`rotate(${angle} 24 24)`} />)}
    <circle cx="24" cy="24" r="3" />
  </g></svg>;
}
