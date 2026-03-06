export interface ScoringItem {
  id: string
  weight: number
  completed: boolean
}

export function calculateScore(items: ScoringItem[]): number {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight === 0) return 0
  const earnedWeight = items.reduce(
    (sum, item) => sum + (item.completed ? item.weight : 0),
    0
  )
  return (earnedWeight / totalWeight) * 100
}

export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-emerald-600'
  if (score >= 70) return 'text-green-600'
  if (score >= 40) return 'text-yellow-600'
  return 'text-red-600'
}

export function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-emerald-500'
  if (score >= 70) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excelente'
  if (score >= 70) return 'Bueno'
  if (score >= 40) return 'Necesita mejorar'
  return 'Deficiente'
}
