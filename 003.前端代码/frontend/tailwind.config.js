/**
 * Design Token —— 全站唯一的视觉语言定义处。
 *
 * 取值来源：
 *  1. PRD v1.2 §3.3.2「视觉配色」（品牌橙 / 品牌红 / 主文字 / 次文字 / 页面背景）
 *  2. 002.产品UI原型/1比1原型图 的 Stitch 视觉稿（Material 化色板 + 字体排版）
 *
 * 命名沿用原型稿的 Material 语义色命名（surface-container-* / on-surface / primary-container），
 * 这样原型稿里的 class 可以平移到 Vue 组件，同时把主色对齐到 PRD 的 #FF7A00。
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js}'],
  theme: {
    extend: {
      colors: {
        // —— 品牌（PRD §3.3.2）——
        primary: '#994700', // 深橙：浅底上的品牌文字/图标
        'primary-container': '#FF7A00', // 品牌橙：主按钮、进度、训练进行中
        'secondary-container': '#FF9F43', // 活力橙：渐变次端、热身状态
        secondary: '#8F4E00',
        'primary-fixed': '#FFF3E8', // 浅橙背景
        'on-primary-fixed': '#7A3C00',
        'on-primary': '#FFFFFF',
        'on-primary-container': '#FFFFFF',
        // —— 风险（PRD §3.3.2）——
        error: '#E53935', // 品牌红：风险、疼痛、停止训练
        'on-error': '#FFFFFF',
        'error-container': '#FFEBEE', // 浅红背景
        'on-error-container': '#7F1D1D',
        tertiary: '#B71C1C', // 深红：强制停止
        'on-tertiary': '#FFFFFF',
        'tertiary-container': '#FF766B',
        // —— 中性（PRD §3.3.2）——
        surface: '#F8F9FF', // 页面背景（与 002 原型一致）
        'surface-container-lowest': '#FFFFFF',
        'surface-container-low': '#F2F4F8',
        'surface-container': '#E9EDF4',
        'surface-container-high': '#DFE4EE',
        'surface-container-highest': '#CDD5E2',
        'on-surface': '#1F2937', // 主文字
        'on-surface-variant': '#6B7280', // 次文字
        outline: '#9AA3B2',
        'outline-variant': '#E2E7F0',
        'inverse-surface': '#1F2937',
        'inverse-on-surface': '#F8F9FB',
        // —— 语义辅助色 ——
        success: '#10B981',
        'success-container': '#D1FAE5',
        'on-success-container': '#065F46',
        info: '#2563EB',
        'info-container': '#DBEAFE',
      },
      borderRadius: {
        DEFAULT: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
      spacing: {
        gutter: '1rem',
        margin: '1rem',
        'space-xs': '0.25rem',
        'space-sm': '0.5rem',
        'space-md': '0.75rem',
        'space-lg': '1rem',
        'space-xl': '1.5rem',
        'space-2xl': '2rem',
      },
      /**
       * 与 002 产品 UI 原型保持一致：标题/数字使用 Space Grotesk，正文使用 Hanken Grotesk。
       */
      fontFamily: {
        display: ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        body: ['Hanken Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'metric-huge': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'metric-huge-mobile': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'display-hero': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'display-hero-mobile': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'headline-lg': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'headline-md': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'headline-sm': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'label-caps': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'label-data': ['Space Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'body-lg': ['Hanken Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'body-md': ['Hanken Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
        'body-sm': ['Hanken Grotesk', 'Arial', 'Microsoft YaHei', 'sans-serif'],
      },
      fontSize: {
        'metric-huge': ['40px', { lineHeight: '44px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'metric-huge-mobile': ['34px', { lineHeight: '38px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'display-hero-mobile': ['48px', { lineHeight: '52px', letterSpacing: '-0.03em', fontWeight: '700' }],
        'display-hero': ['64px', { lineHeight: '68px', letterSpacing: '-0.04em', fontWeight: '700' }],
        'headline-lg': ['28px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '700' }],
        'headline-md': ['22px', { lineHeight: '28px', letterSpacing: '-0.01em', fontWeight: '600' }],
        'headline-sm': ['18px', { lineHeight: '24px', letterSpacing: '0em', fontWeight: '600' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '400' }],
        'label-caps': ['10px', { lineHeight: '12px', letterSpacing: '0.12em', fontWeight: '700' }],
        'label-data': ['11px', { lineHeight: '14px', letterSpacing: '0.08em', fontWeight: '600' }],
      },
      boxShadow: {
        card: '0 4px 16px -2px rgba(31, 41, 55, 0.06)',
        'card-lg': '0 12px 32px -8px rgba(31, 41, 55, 0.16)',
        'brand': '0 8px 24px -4px rgba(255, 122, 0, 0.38)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'slide-up': {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'pop-in': {
          from: { opacity: 0, transform: 'scale(0.96)' },
          to: { opacity: 1, transform: 'scale(1)' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-6px)' },
          '40%,80%': { transform: 'translateX(6px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out both',
        'slide-up': 'slide-up 0.28s cubic-bezier(0.4,0,0.2,1) both',
        'pop-in': 'pop-in 0.2s cubic-bezier(0.4,0,0.2,1) both',
        shake: 'shake 0.35s ease-in-out',
      },
    },
  },
  plugins: [],
}
