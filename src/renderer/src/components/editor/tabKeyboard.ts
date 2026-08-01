export function shouldStopTabKeyPropagation(event: KeyboardEvent): boolean {
  if (event.key === 'Enter' || event.key === ' ') return true
  if (event.key === 'Delete' || event.key === 'Backspace') return true
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'Home' || event.key === 'End') return true
  return false
}
