-- Supabase SQL Editor에서 실행
-- 구광완, 김주성을 developers 테이블에서 삭제

-- 1. 먼저 해당 개발자가 담당하고 있는 항목의 developer_id를 NULL로 변경
UPDATE dev_items SET developer_id = NULL
WHERE developer_id IN (SELECT id FROM developers WHERE name IN ('구광완', '김주성'));

UPDATE bug_items SET developer_id = NULL
WHERE developer_id IN (SELECT id FROM developers WHERE name IN ('구광완', '김주성'));

UPDATE common_bugs SET developer_id = NULL
WHERE developer_id IN (SELECT id FROM developers WHERE name IN ('구광완', '김주성'));

UPDATE server_bugs SET developer_id = NULL
WHERE developer_id IN (SELECT id FROM developers WHERE name IN ('구광완', '김주성'));

-- 2. 개발자 삭제
DELETE FROM developers WHERE name IN ('구광완', '김주성');
