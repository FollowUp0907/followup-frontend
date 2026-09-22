/** @type {import('tailwindcss').Config} */
// Cal.com 디자인 시스템 토큰을 그대로 옮겨 담은 설정.
// 컴포넌트에서는 hex 를 직접 쓰지 않고 여기 정의된 토큰만 사용한다.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#111111',
          active: '#242424',
        },
        brand: { accent: '#3b82f6' },
        badge: {
          orange: '#fb923c',
          pink: '#ec4899',
          violet: '#8b5cf6',
          emerald: '#34d399',
        },
        canvas: '#ffffff',
        surface: {
          soft: '#f8f9fa',
          card: '#f5f5f5',
          strong: '#e5e7eb',
          dark: '#101010',
          'dark-elevated': '#1a1a1a',
        },
        hairline: {
          DEFAULT: '#e5e7eb',
          soft: '#f3f4f6',
        },
        ink: '#111111',
        body: '#374151',
        muted: {
          DEFAULT: '#6b7280',
          soft: '#898989',
        },
        'on-primary': '#ffffff',
        'on-dark': '#ffffff',
        'on-dark-soft': '#a1a1aa',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      },
      fontFamily: {
        // Cal Sans 는 비공개 폰트이므로 Inter 600 + 음수 자간으로 대체한다.
        display: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'display-xl': ['64px', { lineHeight: '1.05', letterSpacing: '-2px', fontWeight: '600' }],
        'display-lg': ['48px', { lineHeight: '1.1', letterSpacing: '-1.5px', fontWeight: '600' }],
        'display-md': ['36px', { lineHeight: '1.15', letterSpacing: '-1px', fontWeight: '600' }],
        'display-sm': ['28px', { lineHeight: '1.2', letterSpacing: '-0.5px', fontWeight: '600' }],
        'title-lg': ['22px', { lineHeight: '1.3', letterSpacing: '-0.3px', fontWeight: '600' }],
        'title-md': ['18px', { lineHeight: '1.4', fontWeight: '600' }],
        'title-sm': ['16px', { lineHeight: '1.4', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '1.5' }],
        'body-sm': ['14px', { lineHeight: '1.5' }],
        caption: ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        button: ['14px', { lineHeight: '1', fontWeight: '600' }],
        'nav-link': ['14px', { lineHeight: '1.4', fontWeight: '500' }],
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '96px',
      },
      borderRadius: {
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '9999px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.05)',
        card: '0 4px 12px rgba(0,0,0,0.08)',
        pill: '0 1px 2px rgba(0,0,0,0.06)',
      },
      maxWidth: {
        content: '1200px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'page-in': {
          from: { opacity: '0', transform: 'translateX(10px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        // 탭 전환 — 목록 페이지네이션(page-in)보다 조금 느리고 위로 올라온다.
        'tab-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /*
         * 대시보드에서 상태 칸을 눌러 들어왔을 때 그 목록을 한 번 짚어 준다.
         * 색은 쓰지 않는다 — 살짝 떠올랐다 제자리로 가라앉으며 그림자만 남긴다.
         */
        'float-settle': {
          '0%': { transform: 'translateY(0)', boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
          // 천천히 올라가 잠깐 머물고, 다시 천천히 내려온다. 튀지 않도록 정점을 낮게 잡았다.
          '38%': { transform: 'translateY(-5px)', boxShadow: '0 14px 28px -12px rgba(0,0,0,0.16)' },
          '58%': { transform: 'translateY(-5px)', boxShadow: '0 14px 28px -12px rgba(0,0,0,0.16)' },
          '100%': { transform: 'translateY(0)', boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
        },
        'slot-in': {
          from: { opacity: '0', transform: 'scaleY(0.6)' },
          to: { opacity: '1', transform: 'scaleY(1)' },
        },
        // 오른쪽에서 밀려 들어오는 상세 패널
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-out-right': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(100%)' },
        },
        'veil-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'veil-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'scale-in': 'scale-in 140ms ease-out',
        'slot-in': 'slot-in 120ms ease-out',
        'page-in': 'page-in 180ms ease-out',
        'tab-in': 'tab-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
        'float-settle': 'float-settle 1200ms cubic-bezier(0.4, 0, 0.2, 1)',
        // 들어올 때는 감속, 나갈 때는 가속 — 미는 손을 놓은 것처럼 느껴진다.
        'slide-in-right': 'slide-in-right 260ms cubic-bezier(0.32, 0.72, 0, 1) both',
        'slide-out-right': 'slide-out-right 200ms cubic-bezier(0.4, 0, 1, 1) both',
        'veil-in': 'veil-in 260ms ease-out both',
        'veil-out': 'veil-out 200ms ease-in both',
      },
    },
  },
  plugins: [],
}
