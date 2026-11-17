import { describe, expect, it } from 'vitest';
import { parseIngredientLine, parseReaderRecipe, parseRecipeText } from './recipe-parser';

describe('recipe parser', () => {
  it('parses fractions and spoon units', () => {
    expect(parseIngredientLine('½ ч. л. соли')!).toMatchObject({ name: 'соли', quantity: 0.5, unit: 'ч. л.' });
  });

  it('uses the upper edge of a range', () => {
    expect(parseIngredientLine('2–3 зубчика чеснока')!).toMatchObject({ name: 'чеснока', quantity: 3, unit: 'зубчик', note: '2–3' });
  });

  it('parses quantities written after ingredient names', () => {
    expect(parseIngredientLine('Сыр пармезан – 100-150 г')!).toMatchObject({
      name: 'Сыр пармезан', quantity: 150, unit: 'г', note: '100–150',
    });
  });

  it('splits a full recipe into fields', () => {
    const result = parseRecipeText('Блины\n\nИнгредиенты:\n500 г муки\n2 шт яйца\n\nПриготовление:\n1. Смешать\n2. Обжарить');
    expect(result.title).toBe('Блины');
    expect(result.ingredients).toHaveLength(2);
    expect(result.steps).toEqual(['Смешать', 'Обжарить']);
  });

  it('extracts a recipe from reader markdown', () => {
    const result = parseReaderRecipe(`Title: Карбонара рецепт

Markdown Content:
## Спагетти карбонара от Антонио

Что надо:
* Макароны – 400 г
* Сливки – 200 мл

Что делать:
Отварить макароны.
Смешать с соусом.

![Image](https://example.com/image.jpg)
АВТОР:
Этот текст не должен стать шагом.`, 'https://example.com/carbonara');
    expect(result.title).toBe('Спагетти карбонара от Антонио');
    expect(result.ingredients).toHaveLength(2);
    expect(result.ingredients[0]).toMatchObject({ name: 'Макароны', quantity: 400, unit: 'г' });
    expect(result.steps).toEqual(['Отварить макароны.', 'Смешать с соусом.']);
    expect(result.sourceUrl).toBe('https://example.com/carbonara');
  });
});
