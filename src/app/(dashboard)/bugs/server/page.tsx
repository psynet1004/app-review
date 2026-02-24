'use client';
export default function ServerBugsPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-gray-900 mb-4">서버/데이터 오류사항</h1>
      <p className="text-gray-500 text-sm">서버 및 데이터 관련 오류를 관리합니다. 전송 시 서버 개발방 스페이스로 전송됩니다.</p>
      <div className="mt-4 bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-700">
        이 페이지는 /bugs 페이지와 동일한 구조로 구현됩니다. 서버 오류 전용 테이블(server_bugs)을 사용합니다.
      </div>
    </div>
  );
}
