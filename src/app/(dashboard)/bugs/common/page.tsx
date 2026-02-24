'use client';
export default function CommonBugsPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">공통 오류사항 (누락 방지)</h1>
      <p className="text-gray-500 text-sm">앱 오류사항과 동일한 구조이며, 전송 시 AOS + iOS 양쪽 스페이스로 전송됩니다.</p>
      <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
        이 페이지는 /bugs 페이지와 동일한 구조로 구현됩니다. 공통 오류 전용 테이블(common_bugs)을 사용합니다.
      </div>
    </div>
  );
}
