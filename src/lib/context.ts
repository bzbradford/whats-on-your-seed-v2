import { getContext, setContext } from 'svelte';
import type { AppState } from './app-state.svelte';

const KEY = Symbol('app');

export function setApp(app: AppState): AppState {
  return setContext(KEY, app);
}

export function getApp(): AppState {
  return getContext<AppState>(KEY);
}
