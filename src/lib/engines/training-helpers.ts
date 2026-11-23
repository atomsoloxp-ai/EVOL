// Helper bridge for training-engine to avoid circular imports

import { resolveSafeExercise, findCatalogExercise } from './body-intelligence';
import { getLocalDateString } from './streak-engine';

export { resolveSafeExercise, findCatalogExercise };

export function getLocalDateKeyFromTimestamp(timestampMs: number): string {
  return getLocalDateString(new Date(timestampMs));
}
