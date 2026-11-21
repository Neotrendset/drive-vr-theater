# 프로젝트 기획서 (PRD): Google Drive 기반 VR 360° / 3D 미디어 허브 웹앱

## 1. 프로젝트 개요
* **프로젝트명**: DriveVR Theater (가칭)
* **목적**: Google Drive에 분산 저장된 VR 360도 영상 및 3D 입체 영상(SBS, OU/TB 등)을 한 화면의 직관적인 갤러리 UI로 통합 조회하고, 별도 다운로드 없이 브라우저 및 WebXR 헤드셋(Meta Quest, Apple Vision Pro 등)에서 즉각 스트리밍 재생하는 SPA(Single Page Application) 구축.
* **개발 환경 및 대상 도구**: Antigravity / Codex 에이전트 기반 바이브 코딩 (Vite + React + TypeScript)

---

## 2. 기술 스택 (Tech Stack)
* **Core Framework**: Vite, React 18+, TypeScript
* **Styling & UI**: Tailwind CSS, Lucide React (아이콘)
* **3D / VR Rendering Engine**: Three.js (`three`, `@types/three`) 또는 `@react-three/fiber` + WebXR Device API
* **Google API & Auth**: Google Identity Services (GIS - OAuth 2.0 Implicit/Token Flow), Google Drive API v3
* **Streaming Proxy**: Service Worker (`public/sw.js`) — HTML5 `<video>` 스트리밍 시 OAuth Bearer 토큰 자동 주입 및 HTTP `Range` 요청(탐색 바 이동) 무중단 지원

---

## 3. 시스템 아키텍처 및 핵심 기술 해결 방안

### 3.1. Google Drive 인증 및 API 연동 (서버리스 구조)
* 별도의 백엔드 서버 없이 클라이언트(브라우저)에서 직접 Google OAuth 2.0 인증을 수행하여 `access_token`을 발급받는다.
* **필요 권한 (Scope)**: `https://www.googleapis.com/auth/drive.readonly`
* **파일 목록 조회 쿼리 (`files.list`)**:
  * 기본 필터: `mimeType contains 'video/' and trashed = false`
  * 선택적 폴더 필터: 특정 폴더 ID 지정 시 `'TARGET_FOLDER_ID' in parents` 조건 결합
  * 요청 필드(`fields`): `files(id, name, mimeType, size, thumbnailLink, videoMediaMetadata, createdTime, parents)`

### 3.2. CORS 우회 및 대용량 영상 무중단 스트리밍 (Service Worker Proxy)
* **문제점**: Google Drive의 일반 웹 공유 링크는 CORS 정책과 인증 헤더 누락으로 인해 WebGL `<video>` 텍스처로 직접 바인딩할 수 없으며, `Blob`으로 전체 파일을 내려받으면 수 GB에 달하는 VR 영상 로딩 시 메모리 초과 및 긴 대기 시간이 발생한다.
* **해결책 (Service Worker Intercept)**:
  1. 앱 초기화 시 `navigator.serviceWorker.register('/sw.js')`를 등록하고, 로그인 후 획득한 `access_token`을 `postMessage`로 Service Worker에 전달한다.
  2. 플레이어는 `<video src="/drive-stream/${fileId}" crossOrigin="anonymous">` 형태로 소스를 호출한다.
  3. `sw.js`가 `/drive-stream/` 경로의 `fetch` 이벤트를 가로채어 실제 엔드포인트(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)로 변환한다.
  4. 이때 원본 요청의 `Range` 헤더(영상 탐색 위치)를 유지한 채 `Authorization: Bearer ${accessToken}` 헤더를 추가하여 Google 서버로 전달하고 스트림 응답을 그대로 반환한다.

### 3.3. 영상 포맷 자동 분류 및 렌더링 파이프라인
파일명(또는 Drive 메타데이터)의 키워드를 정규표현식으로 분석해 재생 모드를 자동 지정하며, 플레이어 UI에서 사용자가 수동으로 변경할 수 있도록 한다.

| 감지 키워드 (대소문자 무관) | 포맷 코드 | 설명 및 Three.js 렌더링 방식 |
| :--- | :--- | :--- |
| `360` + (`SBS` / `LR` / `3D_LR`) | `360_SBS` | 360° 구형(Sphere) 메시 내부 매핑 + 좌/우 반분할 UV 셰이더 (WebXR 양안 분리 지원) |
| `360` + (`OU` / `TB` / `3D_TB`) | `360_OU` | 360° 구형(Sphere) 메시 내부 매핑 + 상/하 반분할 UV 셰이더 (WebXR 양안 분리 지원) |
| `180` + (`SBS` / `LR`) | `180_SBS` | 180° 반구(Hemisphere) 메시 내부 매핑 + 좌/우 반분할 UV 셰이더 |
| `360` (단독) | `360_2D` | 360° 구형(Sphere) 메시 내부 전체 UV 매핑 (단안 파노라마) |
| `SBS` / `3D_LR` (단독) | `FLAT_SBS` | 평면(Plane) 스크린 메시 + 좌/우 3D 입체 렌더링 (애너글리프 또는 VR 가상 극장 모드) |
| `OU` / `TB` / `3D_TB` (단독) | `FLAT_OU` | 평면(Plane) 스크린 메시 + 상/하 3D 입체 렌더링 |
| 키워드 없음 | `FLAT_2D` | 일반 2D 시네마 평면 스크린 모드 |

---

## 4. 디렉토리 구조 설계

```text
drive-vr-theater/
├── public/
│   └── sw.js                      # Drive API 스트리밍 프록시 Service Worker
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   │   └── GoogleLoginBtn.tsx # Google OAuth 2.0 로그인 및 토큰 갱신 관리
│   │   ├── Gallery/
│   │   │   ├── HeaderBar.tsx      # 검색창, 포맷 필터 탭, 폴더 선택 드롭다운, 로그아웃
│   │   │   ├── MediaGrid.tsx      # 반응형 카드 그리드 레이아웃
│   │   │   └── MediaCard.tsx      # 썸네일, 해상도/포맷 뱃지, 용량, 재생 트리거
│   │   └── Player/
│   │       ├── VRPlayerModal.tsx  # 전체화면 플레이어 모달 컨테이너
│   │       ├── ThreeCanvas.tsx    # Three.js 360°/180°/3D UV 셰이더 및 카메라 컨트롤러
│   │       └── PlayerControls.tsx # 재생/일시정지, 시크바, FOV 줌, 포맷 수동 전환, WebXR 버튼
│   ├── hooks/
│   │   ├── useGoogleDrive.ts      # Drive API v3 목록 조회, 폴더 탐색, 페이지네이션
│   │   └── useServiceWorker.ts    # SW 등록 및 Access Token 동기화
│   ├── utils/
│   │   ├── formatDetector.ts      # 파일명 기반 VR/3D 포맷 자동 판별 유틸리티
│   │   └── formatters.ts          # 파일 용량(GB/MB), 재생 시간(HH:MM:SS) 포맷터
│   ├── types/
│   │   └── media.ts               # DriveFile, VideoFormatType 등 TypeScript 인터페이스
│   ├── App.tsx
│   └── main.tsx
├── .env.example                   # VITE_GOOGLE_CLIENT_ID 템플릿
├── package.json
└── README.md                      # Google Cloud Console 설정 및 배포 가이드
```

---

## 5. 상세 기능 명세 (Functional Requirements)

### 5.1. 메인 갤러리 화면 (One-Screen Dashboard)
1. **다크 시네마 UI**: 눈의 피로를 줄이고 영상 썸네일이 돋보이도록 깊은 다크 그레이(`#0B0F19`) 배경과 글래스모피즘 상단 바를 적용한다.
2. **상단 통합 필터 및 검색**:
   * **포맷별 빠른 필터 탭**: `전체` | `360° VR` | `180° VR` | `3D (SBS/OU)` | `일반 2D`
   * **폴더 탐색기**: 드라이브 내 특정 폴더(예: `VR_Archive`)를 선택해 해당 폴더 내부 영상만 필터링하는 드롭다운 제공.
   * **실시간 검색**: 파일명 키워드 실시간 필터링.
3. **미디어 카드 구성**:
   * 고해상도 썸네일 (`thumbnailLink`의 `=s220` 파라미터를 `=s640`으로 치환하여 선명도 개선).
   * 우측 상단 포맷 뱃지 (예: `360° 3D SBS`, `360°`, `3D OU` 색상 구분 표시).
   * 하단 메타데이터: 파일명, 해상도(예: `3840×1920`), 파일 용량(예: `2.4 GB`).

### 5.2. VR / 3D 통합 웹 플레이어
1. **Three.js 셰이더 및 지오메트리**:
   * 구형(SphereGeometry)의 안쪽 면(`THREE.BackSide`)에 `THREE.VideoTexture`를 매핑하고, X축 스케일을 `-1`로 반전시켜 좌우 거울 현상을 방지한다.
   * 3D 포맷(`SBS`, `OU`)의 경우 Custom `ShaderMaterial` 또는 UV 오프셋(`texture.offset`, `texture.repeat`)을 조절하여:
     * **일반 PC/모바일 화면**: 왼쪽 눈(Left Eye) 영역만 크롭하여 왜곡 없는 2D 시점으로 보여주거나, 적청(Anaglyph) 3D 입체 모드로 전환 가능.
     * **WebXR 헤드셋 모드 (`navigator.xr`)**: 좌안 카메라(`layers.set(1)`)에는 영상의 좌측/상단 절반을, 우안 카메라(`layers.set(2)`)에는 영상의 우측/하단 절반을 독립 렌더링하여 완벽한 3D 입체감을 구현한다.
2. **인터랙션 및 카메라 조작**:
   * **PC**: 마우스 드래그로 상하좌우 360° 시점 회전, 마우스 휠로 시야각(FOV `30° ~ 110°`) 줌 인/아웃.
   * **모바일**: 터치 드래그 및 기기 자이로스코프(`DeviceOrientationControls`) 연동 토글.
   * **VR 헤드셋**: 우측 하단 `[Enter VR]` 버튼 클릭 시 WebXR 세션 진입.
3. **하단 컨트롤 HUD (일정 시간 미조작 시 자동 숨김)**:
   * 재생/일시정지, 10초 전/후 이동, 타임라인 프로그레스 바(버퍼링 상태 표시 포함), 볼륨/음소거.
   * **포맷 즉시 전환 셀렉터**: 자동 감지가 부정확할 경우 사용자가 즉시 `[2D]`, `[360°]`, `[360° SBS]`, `[360° OU]`, `[180° SBS]`, `[3D SBS]`, `[3D OU]` 중 선택 가능.

---

## 6. 단계별 개발 로드맵 (Antigravity / Codex 작업 순서)

* **Phase 1: 프로젝트 초기 세팅 및 OAuth 인증 연동**
  * Vite + React + TS + Tailwind 프로젝트 생성 및 `three`, `@types/three`, `lucide-react` 설치.
  * Google Identity Services 스크립트 연동 및 `drive.readonly` 토큰 획득 플로우 구현.
* **Phase 2: Service Worker 스트리밍 프록시 구축**
  * `public/sw.js` 작성 (`/drive-stream/:fileId` 인터셉트, `Authorization` 및 `Range` 헤더 포워딩 처리).
  * 토큰 만료 시 자동 갱신 및 SW 재동기화 로직 추가.
* **Phase 3: Google Drive 갤러리 대시보드 구현**
  * `useGoogleDrive` 훅으로 비디오 파일 목록 및 폴더 트리 조회.
  * `formatDetector.ts` 구현 및 필터링/검색 기능이 포함된 반응형 그리드 UI 완성.
* **Phase 4: Three.js 360° / 3D / WebXR 플레이어 구현**
  * `ThreeCanvas.tsx`에서 구형/반구형/평면 지오메트리 및 SBS/OU UV 매핑 로직 구현.
  * WebXR 양안 레이어 분리(`camera.layers`) 및 플레이어 컨트롤 HUD 통합.
* **Phase 5: 예외 처리 및 최적화**
  * 썸네일 로드 실패 시 기본 플레이스홀더 SVG 처리, 스트리밍 네트워크 오류 안내, 모바일 반응형 및 VR 브라우저 테스트.

---

## 7. Antigravity / Codex 실행용 마스터 프롬프트

아래 프롬프트를 복사하여 작업 지시창에 입력하면 위 기획서 구조대로 전체 코드베이스를 생성할 수 있습니다.

```text
첨부된 기획서(DriveVR Theater PRD)를 바탕으로 Vite + React + TypeScript + Tailwind CSS 기반의 Google Drive VR 360° / 3D 미디어 허브 웹 애플리케이션을 구축해줘.

[구현 지침]
1. 디렉토리 구조는 기획서의 4번 항목(public/sw.js, src/components/Auth, Gallery, Player, src/hooks, src/utils, src/types)을 정확히 따라 생성할 것.
2. public/sw.js에는 '/drive-stream/:fileId' 요청을 가로채어 Google Drive API('https://www.googleapis.com/drive/v3/files/:fileId?alt=media')로 프록시하는 Service Worker를 작성하되, HTML5 video의 탐색(seeking)이 원활하도록 요청의 'Range' 헤더를 보존하고 'Authorization: Bearer <token>' 헤더를 주입할 것.
3. src/utils/formatDetector.ts에는 파일명을 분석해 '360_SBS', '360_OU', '180_SBS', '360_2D', 'FLAT_SBS', 'FLAT_OU', 'FLAT_2D' 중 하나로 자동 분류하는 함수를 작성할 것.
4. src/components/Player/ThreeCanvas.tsx는 Three.js를 사용하여 구형(SphereGeometry), 반구형(SphereGeometry phiLength=Math.PI), 평면(PlaneGeometry) 지오메트리를 전환하고, SBS(좌우 분할) 및 OU(상하 분할) 영상의 UV 매핑과 WebXR 양안 렌더링(layers 1, 2 분리)을 지원하도록 구현할 것.
5. 마우스 드래그 시점 회전, 휠 FOV 줌, 하단 컨트롤 HUD(자동 숨김, 타임라인 스크러버, 포맷 수동 전환 드롭다운, Enter VR 버튼)를 포함할 것.
6. .env.example 파일과 Google Cloud Console OAuth 2.0 클라이언트 ID 발급 방법이 상세히 적힌 README.md를 함께 생성할 것.
```
