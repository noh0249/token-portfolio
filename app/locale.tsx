'use client';
import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import { Locale, translate } from '../lib/translations';

const LocaleContext = createContext<{
  locale: Locale; setLocale: (locale: Locale) => void;
  t: (text: string, values?: Record<string, string | number>) => string;
}>({ locale: 'ko', setLocale: () => {}, t: text => text });

let currentLocale: Locale | null = null;
function readLanguage(): Locale {
  if (currentLocale === null) {
    currentLocale = 'ko';
    try { if (localStorage.getItem('coinfolio.language') === 'en') currentLocale = 'en'; } catch {}
  }
  return currentLocale;
}
function subscribeLanguage(changed: () => void) {
  const storageChanged = (event: StorageEvent) => { if (event.key === 'coinfolio.language') { currentLocale = null; changed(); } };
  window.addEventListener('coinfolio:language', changed);
  window.addEventListener('storage', storageChanged);
  return () => { window.removeEventListener('coinfolio:language', changed); window.removeEventListener('storage', storageChanged); };
}
function saveLanguage(next: Locale) {
  currentLocale = next;
  try { localStorage.setItem('coinfolio.language', next); } catch {}
  window.dispatchEvent(new Event('coinfolio:language'));
}

export function LocaleProvider({children}: {children: React.ReactNode}) {
  const locale = useSyncExternalStore(subscribeLanguage, readLanguage, () => 'ko' as Locale);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = locale === 'ko' ? 'Coinfolio | 나의 코인 포트폴리오' : 'Coinfolio | My crypto portfolio';
  }, [locale]);
  const value = useMemo(() => ({
    locale,
    setLocale: saveLanguage,
    t: (text: string, values?: Record<string, string | number>) => translate(text, locale, values),
  }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
export function LanguageSwitch() {
  const {locale, setLocale} = useLocale();
  return <div className="language-switch" role="group" aria-label="언어 / Language">
    <button lang="ko" aria-pressed={locale === 'ko'} onClick={() => setLocale('ko')}>한국어</button>
    <button lang="en" aria-pressed={locale === 'en'} onClick={() => setLocale('en')}>EN</button>
  </div>;
}
