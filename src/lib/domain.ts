export type PlanType = "base-building" | "marathon-16-week";

export type WorkoutType =
  | "easy-run"
  | "long-run"
  | "tempo"
  | "interval"
  | "recovery"
  | "strength"
  | "mobility"
  | "rest";

export interface Workout {
  id: string;
  date: string; // ISO date format: YYYY-MM-DD
  title: string;
  type: WorkoutType;
  description?: string;
  distanceKm?: number;
  durationMin?: number;
}

export interface TrainingPlan {
  id: string;
  athleteId: string;
  name: string;
  type: PlanType;
  startDate: string; // ISO date format: YYYY-MM-DD
  endDate: string; // ISO date format: YYYY-MM-DD
  workouts: Workout[];
}
