import { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  AreaChart,
  BarChart,
  LineChart,
  DonutChart,
  RadarChart,
  StatCard,
  type PixelChartHandle,
  type Datum,
} from '../src'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']

function makeData(seedShift = 0): Datum[] {
  return MONTHS.map((m, i) => ({
    label: m,
    desktop: Math.round(120 + 120 * Math.sin((i + seedShift) / 2.2) + 20 * Math.cos(i * 1.7 + seedShift)),
    mobile: Math.round(95 + 45 * Math.cos((i + seedShift) / 1.8) + 10 * Math.sin(i * 2.1)),
  })).map((d) => ({
    ...d,
    desktop: Math.max(20, Number(d.desktop)),
    mobile: Math.max(15, Number(d.mobile)),
  }))
}

const SERIES = [
  { key: 'desktop', label: 'Desktop', color: '#4f8ff7' },
  { key: 'mobile', label: 'Mobile', color: '#8b5cf6', fill: 'hatch' as const },
]

function singleData(kind: 'green' | 'orange' | 'pink'): Datum[] {
  const fns = {
    green: (i: number) => 130 + 60 * Math.sin(i / 1.4) - i * 3,
    orange: (i: number) => 140 - 55 * Math.sin(i / 2.1) + i * 6,
    pink: (i: number) => 90 + 40 * Math.sin(i / 1.1 - 2) + i * 8,
  }
  return MONTHS.map((m, i) => ({ label: m, v: Math.max(15, Math.round(fns[kind](i))) }))
}

const BROWSERS = [
  { label: 'Chrome', value: 412, color: '#4f8ff7' },
  { label: 'Safari', value: 218, color: '#2fd66c' },
  { label: 'Firefox', value: 187, color: '#f08c2e' },
  { label: 'Edge', value: 91, color: '#8b5cf6' },
  { label: 'Other', value: 133, color: '#8a8f98' },
]

const SPARK_RAMP = Array.from({ length: 28 }, (_, i) =>
  Math.max(2, 3 + i * 1.5 + 6 * Math.sin(i / 2.4) + 3 * Math.cos(i * 1.9)),
)
const SPARK_BUMPY = Array.from({ length: 22 }, (_, i) =>
  Math.max(6, 24 + 13 * Math.sin(i / 1.9) + 7 * Math.sin(i * 1.1 + 2)),
)
const SPARK_JAGGED = Array.from({ length: 22 }, (_, i) =>
  Math.max(8, 26 + 9 * Math.sin(i / 1.3) + 6 * Math.cos(i * 1.7 + 1)),
)

const RADAR = [
  { label: 'Speed', desktop: 88, mobile: 62 },
  { label: 'Power', desktop: 92, mobile: 48 },
  { label: 'Range', desktop: 60, mobile: 55 },
  { label: 'Defense', desktop: 82, mobile: 70 },
  { label: 'Magic', desktop: 45, mobile: 60 },
  { label: 'Luck', desktop: 70, mobile: 52 },
]

function Section(props: {
  title: string
  children: React.ReactNode
  onReplay?: () => void
  extra?: React.ReactNode
}) {
  return (
    <>
      <div className="row">
        <h2>{props.title}</h2>
        <div className="row" style={{ marginTop: 40 }}>
          {props.extra}
          {props.onReplay && (
            <button onClick={props.onReplay}>&#x21bb; replay</button>
          )}
        </div>
      </div>
      {props.children}
    </>
  )
}

function App() {
  const [data, setData] = useState(() => makeData())
  const [shift, setShift] = useState(0)
  const [stacked, setStacked] = useState(true)
  const areaRef = useRef<PixelChartHandle>(null)
  const singleRefs = [useRef<PixelChartHandle>(null), useRef<PixelChartHandle>(null), useRef<PixelChartHandle>(null)]
  const barRef = useRef<PixelChartHandle>(null)
  const cardRefs = [useRef<PixelChartHandle>(null), useRef<PixelChartHandle>(null), useRef<PixelChartHandle>(null)]
  const lineRef = useRef<PixelChartHandle>(null)
  const donutRef = useRef<PixelChartHandle>(null)
  const radarRef = useRef<PixelChartHandle>(null)

  const shuffle = () => {
    const s = shift + 1.7
    setShift(s)
    setData(makeData(s))
  }

  return (
    <>
      <div className="row">
        <h1>Evil dither charts — Area</h1>
        <div className="row">
          <button onClick={shuffle}>&#x2928; shuffle data</button>
          <button className={stacked ? 'on' : ''} onClick={() => setStacked(!stacked)}>
            stacked
          </button>
          <button onClick={() => areaRef.current?.replay()}>&#x21bb; replay</button>
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <AreaChart ref={areaRef} data={data} series={SERIES} stacked={stacked} height={320} />
      </div>
      <p className="hint">
        Hover to scrub &middot; click a series or legend entry to select &middot; toggle stacked
        &middot; shuffle to see the shape ease.
      </p>

      <Section
        title="Single series"
        onReplay={() => singleRefs.forEach((r) => r.current?.replay())}
      >
        <div className="grid3" style={{ marginTop: 16 }}>
          <AreaChart
            ref={singleRefs[0]}
            data={singleData('green')}
            series={[{ key: 'v', label: 'green', color: '#2fd66c' }]}
            height={180}
            showLegend={false}
            showAxes
          />
          <AreaChart
            ref={singleRefs[1]}
            data={singleData('orange')}
            series={[{ key: 'v', label: 'orange', color: '#f08c2e' }]}
            height={180}
            showLegend={false}
          />
          <AreaChart
            ref={singleRefs[2]}
            data={singleData('pink')}
            series={[{ key: 'v', label: 'pink', color: '#ee4d97' }]}
            height={180}
            showLegend={false}
          />
        </div>
      </Section>

      <Section
        title="Stat cards — KPI + pixel sparkline"
        onReplay={() => cardRefs.forEach((r) => r.current?.replay())}
      >
        <div className="grid3" style={{ marginTop: 16 }}>
          <StatCard
            ref={cardRefs[0]}
            title="Resolved today"
            value={38}
            delta={12}
            data={SPARK_RAMP}
            color="#4f8ff7"
          />
          <StatCard
            ref={cardRefs[1]}
            title="Automod · 24h"
            value={126}
            delta={-8}
            deltaGood="down"
            data={SPARK_BUMPY}
            color="#8b5cf6"
            curve="linear"
          />
          <StatCard
            ref={cardRefs[2]}
            title="Reports · 7d"
            value={54}
            delta={-3}
            data={SPARK_JAGGED}
            color="#e5484d"
            curve="linear"
          />
        </div>
      </Section>

      <Section
        title="Bar — grouped &amp; stacked share the stacked toggle"
        onReplay={() => barRef.current?.replay()}
      >
        <div style={{ marginTop: 16 }}>
          <BarChart ref={barRef} data={data} series={SERIES} stacked={stacked} height={300} />
        </div>
      </Section>

      <Section
        title="Line — bright line with a dither glow"
        onReplay={() => lineRef.current?.replay()}
      >
        <div style={{ marginTop: 16 }}>
          <LineChart ref={lineRef} data={data} series={SERIES} height={280} />
        </div>
      </Section>

      <h2>Pie / donut &amp; Radar — polar dither</h2>
      <div className="grid2" style={{ marginTop: 16 }}>
        <div>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            <button onClick={() => donutRef.current?.replay()}>&#x21bb; replay</button>
          </div>
          <DonutChart ref={donutRef} data={BROWSERS} height={300} />
        </div>
        <div>
          <div className="row" style={{ justifyContent: 'center', marginBottom: 8 }}>
            <button onClick={() => radarRef.current?.replay()}>&#x21bb; replay</button>
          </div>
          <RadarChart
            ref={radarRef}
            data={RADAR}
            series={[
              { key: 'desktop', label: 'Desktop', color: '#4f8ff7' },
              { key: 'mobile', label: 'Mobile', color: '#8b5cf6' },
            ]}
            height={300}
            max={100}
          />
        </div>
      </div>
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
