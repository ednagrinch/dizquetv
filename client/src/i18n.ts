import i18n from 'i18next'
import HttpBackend from 'i18next-http-backend'
import { initReactI18next } from 'react-i18next'

// Reuses the same locale files the old AngularJS UI shipped
// (web/public/locales/{{lng}}/{{ns}}.json) — no translation-file changes needed.
i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['main'],
    defaultNS: 'main',
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
