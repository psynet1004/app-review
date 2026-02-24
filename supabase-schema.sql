-- =============================================
-- 앱 검수 관리 시스템 - Supabase DB 스키마
-- Supabase Dashboard > SQL Editor에서 실행하세요
-- =============================================

-- 1. 개발자 관리
CREATE TABLE developers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('AOS', 'iOS', 'SERVER', 'COMMON')),
  role TEXT DEFAULT '개발',
  department TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Webhook 설정
CREATE TABLE webhook_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  space_name TEXT NOT NULL,
  target_platform TEXT NOT NULL CHECK (target_platform IN ('AOS', 'iOS', 'SERVER', 'QA_ALL')),
  webhook_url TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. 앱 버전 관리
CREATE TABLE app_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('AOS', 'iOS')),
  version TEXT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. 개발항목 (AOS/iOS 공용)
CREATE TABLE dev_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('AOS', 'iOS')),
  version TEXT NOT NULL DEFAULT '',
  menu_item TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_required BOOLEAN NOT NULL DEFAULT false,
  department TEXT DEFAULT '',
  requester TEXT DEFAULT '',
  developer_id UUID REFERENCES developers(id) ON DELETE SET NULL,
  dev_status TEXT NOT NULL DEFAULT '대기' CHECK (dev_status IN ('대기', '개발중', '개발완료', '검수요청', '보류')),
  review_request_date DATE,
  review_results JSONB DEFAULT '{}',
  planning_link TEXT DEFAULT '',
  send_status TEXT NOT NULL DEFAULT '미전송' CHECK (send_status IN ('미전송', '전송완료', '재전송')),
  note TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. 앱 오류사항
CREATE TABLE bug_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('AOS', 'iOS', 'COMMON')),
  version TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '보통' CHECK (priority IN ('긴급', '높음', '보통', '낮음')),
  department TEXT DEFAULT '',
  reporter TEXT NOT NULL DEFAULT '',
  developer_id UUID REFERENCES developers(id) ON DELETE SET NULL,
  fix_status TEXT NOT NULL DEFAULT '미수정' CHECK (fix_status IN ('미수정', '수정중', '수정완료', '보류')),
  review_results JSONB DEFAULT '{}',
  send_status TEXT NOT NULL DEFAULT '미전송' CHECK (send_status IN ('미전송', '전송완료')),
  note TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. 공통 오류사항
CREATE TABLE common_bugs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '보통' CHECK (priority IN ('긴급', '높음', '보통', '낮음')),
  department TEXT DEFAULT '',
  reporter TEXT NOT NULL DEFAULT '',
  developer_id UUID REFERENCES developers(id) ON DELETE SET NULL,
  fix_status TEXT NOT NULL DEFAULT '미수정' CHECK (fix_status IN ('미수정', '수정중', '수정완료', '보류')),
  review_results JSONB DEFAULT '{}',
  send_status TEXT NOT NULL DEFAULT '미전송' CHECK (send_status IN ('미전송', '전송완료')),
  note TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. 서버/데이터 오류사항
CREATE TABLE server_bugs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT '보통' CHECK (priority IN ('긴급', '높음', '보통', '낮음')),
  department TEXT DEFAULT '',
  reporter TEXT NOT NULL DEFAULT '',
  developer_id UUID REFERENCES developers(id) ON DELETE SET NULL,
  fix_status TEXT NOT NULL DEFAULT '미수정' CHECK (fix_status IN ('미수정', '수정중', '수정완료', '보류')),
  review_results JSONB DEFAULT '{}',
  send_status TEXT NOT NULL DEFAULT '미전송' CHECK (send_status IN ('미전송', '전송완료')),
  note TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. 전송 이력 로그
CREATE TABLE send_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_email TEXT DEFAULT '',
  send_type TEXT NOT NULL CHECK (send_type IN ('개발항목', '앱오류', '공통오류', '서버오류')),
  target_platform TEXT DEFAULT '',
  target_space TEXT DEFAULT '',
  item_count INTEGER NOT NULL DEFAULT 0,
  item_summary TEXT DEFAULT '',
  result TEXT NOT NULL CHECK (result IN ('성공', '실패')),
  error_message TEXT
);

-- =============================================
-- RLS (Row Level Security) 정책
-- =============================================

ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dev_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE send_logs ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 모든 작업 가능 (팀 내부 도구)
CREATE POLICY "Authenticated users full access" ON developers FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON webhook_configs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON app_versions FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON dev_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON bug_items FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON common_bugs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON server_bugs FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users full access" ON send_logs FOR ALL USING (auth.uid() IS NOT NULL);

-- =============================================
-- Realtime 활성화
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE dev_items;
ALTER PUBLICATION supabase_realtime ADD TABLE bug_items;
ALTER PUBLICATION supabase_realtime ADD TABLE common_bugs;
ALTER PUBLICATION supabase_realtime ADD TABLE server_bugs;

-- =============================================
-- updated_at 자동 업데이트 트리거
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER dev_items_updated_at BEFORE UPDATE ON dev_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER bug_items_updated_at BEFORE UPDATE ON bug_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER common_bugs_updated_at BEFORE UPDATE ON common_bugs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER server_bugs_updated_at BEFORE UPDATE ON server_bugs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================
-- 샘플 데이터 (선택사항)
-- =============================================

INSERT INTO developers (name, platform, role, department) VALUES
  ('구광일', 'AOS', '개발책임자', '개발팀'),
  ('김세영', 'iOS', '개발책임자', '개발팀'),
  ('박현남', 'SERVER', '서버개발', '개발팀'),
  ('김재연', 'AOS', '개발', '개발팀'),
  ('신진호', 'iOS', '개발', '개발팀');

INSERT INTO app_versions (platform, version, is_current) VALUES
  ('AOS', 'V51.0.3', true),
  ('iOS', 'V40.2', true);
