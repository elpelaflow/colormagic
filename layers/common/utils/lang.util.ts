export function getLocale(locale: string): 'en' | 'ja' | 'it' | 'es' | 'fr' {
  if (locale === 'ja') {
    return 'ja';
  }
  if (locale === 'it') {
    return 'it';
  }
  if (locale === 'es') {
    return 'es';
  }
  if (locale === 'fr') {
    return 'fr';
  }
  return 'en';
}
