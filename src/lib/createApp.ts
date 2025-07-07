import { mount } from 'svelte';
import type { ComponentType } from 'svelte';

export function createApp(component: ComponentType) {
  const target = document.getElementById('app');
  if (!target) {
    throw new Error('Could not find app container');
  }
  
  return mount(component, { target });
}