import * as scoring from './engine.ts';

declare global {
  interface Window {
    TendScoring: typeof scoring;
  }
}

window.TendScoring = scoring;
