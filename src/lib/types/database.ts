export type Platform = 'AOS' | 'iOS' | 'SERVER' | 'COMMON';
export type DevStatus = '대기' | '개발중' | '개발완료' | '검수요청' | '보류';
export type FixStatus = '미수정' | '수정중' | '수정완료' | '보류';
export type ReviewStatus = '검수전' | '검수중' | '검수완료';
export type Priority = '긴급' | '높음' | '보통' | '낮음';
export type SendStatus = '미전송' | '전송완료' | '재전송';
export type SendType = '개발항목' | '앱오류' | '공통오류' | '서버오류';

export interface Developer {
  id: string;
  name: string;
  platform: Platform;
  role: string;
  department: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface WebhookConfig {
  id: string;
  space_name: string;
  target_platform: string;
  webhook_url: string;
  is_active: boolean;
}

export interface DevItem {
  id: string;
  platform: 'AOS' | 'iOS';
  version: string;
  menu_item: string;
  description: string;
  is_required: boolean;
  department: string;
  requester: string;
  developer_id: string | null;
  dev_status: DevStatus;
  review_request_date: string | null;
  review_results: Record<string, boolean>;
  planning_link: string;
  send_status: SendStatus;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  developers?: Developer;
}

export interface BugItem {
  id: string;
  platform: 'AOS' | 'iOS' | 'COMMON';
  version: string;
  location: string;
  description: string;
  priority: Priority;
  department: string;
  reporter: string;
  developer_id: string | null;
  fix_status: FixStatus;
  review_status: ReviewStatus;
  review_results: Record<string, boolean>;
  send_status: SendStatus;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  developers?: Developer;
}

export interface CommonBug {
  id: string;
  version: string;
  location: string;
  description: string;
  priority: Priority;
  department: string;
  reporter: string;
  developer_id: string | null;
  fix_status: FixStatus;
  review_status: ReviewStatus;
  review_results: Record<string, boolean>;
  send_status: SendStatus;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  developers?: Developer;
}

export interface ServerBug {
  id: string;
  version: string;
  location: string;
  description: string;
  priority: Priority;
  department: string;
  reporter: string;
  developer_id: string | null;
  fix_status: FixStatus;
  review_status: ReviewStatus;
  review_results: Record<string, boolean>;
  send_status: SendStatus;
  note: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  developers?: Developer;
}

export interface SendLog {
  id: string;
  sent_at: string;
  sent_by: string;
  sent_by_email: string;
  send_type: SendType;
  target_platform: string;
  target_space: string;
  item_count: number;
  item_summary: string;
  result: '성공' | '실패';
  error_message: string | null;
}

export interface AppVersion {
  id: string;
  platform: 'AOS' | 'iOS';
  version: string;
  is_current: boolean;
}
