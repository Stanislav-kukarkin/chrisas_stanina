#!/usr/bin/env node
/**
 * Utility for generating remote app boilerplate.
 * Remotes are committed directly; this script is for future apps.
 */

export const REMOTE_APPS = [
  { name: 'tasks', port: 5001, title: 'Задачи' },
  { name: 'shopping', port: 5002, title: 'Список покупок' },
  { name: 'recipes', port: 5003, title: 'Рецепты' },
  { name: 'budget', port: 5004, title: 'Бюджет' },
  { name: 'cashback', port: 5005, title: 'Кэшбеки', note: 'Expo Web migration planned' },
];
