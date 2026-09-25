/** Turn camelCase attribute keys into "Technique", "Match Awareness", ... */
export function attributeLabel(key: string): string {
  const spaced = key.replace(/([A-Z])/g, ' $1').trim();
  const label = spaced.charAt(0).toUpperCase() + spaced.slice(1);
  return label.replace(/^Vs /, 'Vs ');
}
