/**
 * Generates a random hexadecimal color string.
 * @returns A string representing a random hex color (e.g., '#RRGGBB').
 */
export function getRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
