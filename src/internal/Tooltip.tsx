import type { PixelTheme } from '../types'

export interface TipRow {
  color: string
  label: string
  value: string
}

export interface TipData {
  /** Anchor in CSS px relative to the chart container. */
  x: number
  y: number
  title?: string
  rows: TipRow[]
}

export function Tooltip(props: { tip: TipData; theme: PixelTheme; containerW: number }) {
  const { tip, theme, containerW } = props
  const below = tip.y < 70
  const x = Math.max(70, Math.min(containerW - 70, tip.x))
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: below ? tip.y + 18 : tip.y - 10,
        transform: below ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
        background: theme.tooltipBg,
        border: `1px solid ${theme.tooltipBorder}`,
        borderRadius: 6,
        padding: '6px 9px',
        minWidth: 112,
        pointerEvents: 'none',
        fontFamily: theme.font,
        fontSize: theme.fontSize,
        lineHeight: 1.15,
        zIndex: 10,
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      {tip.title !== undefined && (
        <div style={{ color: theme.tooltipTitle, marginBottom: tip.rows.length ? 6 : 0 }}>
          {tip.title}
        </div>
      )}
      {tip.rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: i > 0 ? 4 : 0,
          }}
        >
          <span style={{ width: 8, height: 8, background: r.color, flex: 'none' }} />
          <span style={{ color: theme.tooltipTitle }}>{r.label}</span>
          <span style={{ color: theme.tooltipText, marginLeft: 'auto', fontWeight: 700 }}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  )
}
