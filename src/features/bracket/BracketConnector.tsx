export function BracketConnector({
  width,
  height,
  paths,
}: {
  width: number
  height: number
  paths: Array<{ d: string; lit: boolean }>
}) {
  return (
    <svg
      className="pointer-events-none absolute top-0 left-0"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
    >
      {paths.map((path, index) => (
        <path
          key={index}
          d={path.d}
          stroke={path.lit ? 'var(--color-primary)' : 'var(--color-border)'}
          strokeWidth={path.lit ? 1.5 : 1.25}
          strokeOpacity={path.lit ? 0.55 : 1}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}
