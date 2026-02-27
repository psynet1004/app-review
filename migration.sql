-- bug_items 테이블에 review_status 추가
ALTER TABLE bug_items ADD COLUMN IF NOT EXISTS review_status text DEFAULT '검수전';

-- common_bugs 테이블에 review_status 추가
ALTER TABLE common_bugs ADD COLUMN IF NOT EXISTS review_status text DEFAULT '검수전';

-- server_bugs 테이블에 review_status 추가
ALTER TABLE server_bugs ADD COLUMN IF NOT EXISTS review_status text DEFAULT '검수전';
