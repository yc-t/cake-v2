import React, { createContext, useContext, useState } from 'react'

export type Locale = 'zh-TW' | 'en'

const translations: Record<Locale, Record<string, string>> = {
  'zh-TW': {
    'feedback.button': '回饋',
    'feedback.title': '告訴我們你的想法',
    'feedback.q1': '這次整體流程，你覺得是否容易理解？',
    'feedback.q1.min': '非常困難',
    'feedback.q1.max': '非常容易',
    'feedback.q2': '哪些部分讓你覺得比較困難或模糊？（可選多個）',
    'feedback.q3': '如果能改善一個地方，你會選哪一項？（單選）',
    'feedback.q3.other.placeholder': '請說明...',
    'feedback.q4': '還有什麼想跟我們分享嗎？功能、畫面、體驗，任何想法都可以。',
    'feedback.q4.placeholder': '在這裡輸入...',
    'feedback.submit': '送出',
    'feedback.thanks': '謝謝你的回饋！',
    'screen1.title': '選擇花色',
    'screen1.hint': '把顏色拖到花上',
    'screen1.start': '開始',
    'flower.rose': '玫瑰',
    'flower.hydrangea': '繡球花',
    'flower.peony': '芍藥',
    'flower.fivepetal': '五瓣花',
    'btn.screenshot': '儲存截圖',
    'btn.reset': '重置',
    'credits.label': 'Credits',
    'credits.3dmodels': '3D 模型',
    'color.peach': '桃粉',
    'color.coralPeach': '珊瑚桃',
    'color.creamYellow': '奶油黃',
    'color.lavender': '薰衣草紫',
    'color.gardenBlue': '花園藍',
    'color.wine': '酒紅',
    'color.warmWhite': '暖白',
    'lang.zh': '繁體中文',
    'lang.en': 'English',
  },
  'en': {
    'feedback.button': 'Feedback',
    'feedback.title': 'Share Your Thoughts',
    'feedback.q1': 'How easy was the overall experience to understand?',
    'feedback.q1.min': 'Very Difficult',
    'feedback.q1.max': 'Very Easy',
    'feedback.q2': 'Which parts felt difficult or unclear? (Select all that apply)',
    'feedback.q3': 'If you could improve one thing, what would it be?',
    'feedback.q3.other.placeholder': 'Please specify...',
    'feedback.q4': "Anything else you'd like to share? Features, visuals, experience — all welcome.",
    'feedback.q4.placeholder': 'Type here...',
    'feedback.submit': 'Submit',
    'feedback.thanks': 'Thanks for your feedback!',
    'screen1.title': 'Choose Flower Colors',
    'screen1.hint': 'Drag colors onto flowers',
    'screen1.start': 'Start',
    'flower.rose': 'Rose',
    'flower.hydrangea': 'Hydrangea',
    'flower.peony': 'Peony',
    'flower.fivepetal': 'Five Petal',
    'btn.screenshot': 'Save',
    'btn.reset': 'Reset',
    'credits.label': 'Credits',
    'credits.3dmodels': '3D Models',
    'color.peach': 'Peach',
    'color.coralPeach': 'Coral Peach',
    'color.creamYellow': 'Cream Yellow',
    'color.lavender': 'Lavender',
    'color.gardenBlue': 'Garden Blue',
    'color.wine': 'Wine Red',
    'color.warmWhite': 'Warm White',
    'lang.zh': '繁體中文',
    'lang.en': 'English',
  },
}

interface LanguageContextType {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'zh-TW',
  setLocale: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<Locale>('zh-TW')
  const t = (key: string) => translations[locale][key] ?? key
  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
