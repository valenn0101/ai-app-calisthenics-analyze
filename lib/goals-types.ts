// Client-safe goals types (no fs imports)

export type GoalCategory = 'skill' | 'strength' | 'endurance' | 'body' | 'other';

export const GOAL_CATEGORY_LABELS: Record<GoalCategory, string> = {
  skill: 'Habilidad',
  strength: 'Fuerza',
  endurance: 'Resistencia',
  body: 'Composición',
  other: 'General',
};

export interface Goal {
  id: string;
  text: string;
  category: GoalCategory;
  targetDate?: string;
  achieved: boolean;
  achievedDate?: string;
  createdAt: string;
}
