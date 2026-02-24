# 앱 검수 관리 시스템

개발항목 관리 · 오류 추적 · Google Chat 알림

## 시작하기

### 1. Supabase 프로젝트 생성
- supabase.com에서 새 프로젝트 생성
- SQL Editor에서 `supabase-schema.sql` 전체 실행

### 2. Google OAuth 설정
- Supabase Dashboard > Auth > Providers > Google 활성화
- Google Cloud Console에서 OAuth Client ID 생성
- Redirect URI: `https://YOUR_PROJECT.supabase.co/auth/v1/callback`

### 3. 환경변수
```bash
cp .env.local.example .env.local
# 값 수정 후 npm run dev
```

### 4. Netlify 배포
- GitHub 연결 후 자동 배포 (netlify.toml 포함)
