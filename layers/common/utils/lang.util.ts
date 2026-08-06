export function getLocale(locale: string): 'en' | 'ja' | 'it' | 'es' {
  if (locale === 'ja') {
    return 'ja';
  }
  if (locale === 'it') {
    return 'it';
  }
  if (locale === 'es') {
    return 'es';
  }
  return 'en';
}
