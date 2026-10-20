export function openPublicBoard(tournamentId: string) {
  const url = `${window.location.pathname}?pantalla=${encodeURIComponent(tournamentId)}`
  const opened = window.open(url, `padel-pantalla-${tournamentId}`)
  if (!opened) window.location.assign(url)
}
