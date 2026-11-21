# DriveVR Theater

Google Drive에 저장된 VR 360° / 180° 및 3D 입체(SBS, OU/TB) 영상을 별도 다운로드 없이 브라우저와 WebXR 헤드셋(Meta Quest, Apple Vision Pro 등)에서 바로 스트리밍 재생하는 서버리스 웹 애플리케이션입니다.

## 주요 기능

- **Google Drive API v3 서버리스 연동**: 백엔드 서버 없이 브라우저에서 Google OAuth 2.0 읽기 전용(`drive.readonly`) 인증을 통해 영상 및 폴더 목록을 조회합니다.
- **Service Worker 스트리밍 프록시 (`public/sw.js`)**: `/drive-stream/:fileId` 요청을 가로채어 `Authorization: Bearer <token>` 헤더와 `Range` 바이트 범위 헤더를 함께 전달하므로, 수 GB 대용량 VR 영상도 탐색(Seeking) 지연 없이 스트리밍됩니다.
- **VR / 3D 포맷 자동 분류**: 파일명의 키워드(`360`, `180`, `SBS`, `LR`, `OU`, `TB` 등)를 분석해 `360_SBS`, `360_OU`, `180_SBS`, `360_2D`, `FLAT_SBS`, `FLAT_OU`, `FLAT_2D` 중 하나로 자동 매핑합니다.
- **Three.js + WebXR 플레이어**:
  - 구형(`360°`), 반구형(`180°`), 평면(`2D/3D`) 지오메트리 및 SBS/OU UV 셰이더 매핑
  - 일반 화면에서 좌안 크롭 뷰 및 적청(Anaglyph) 3D 입체 모드 토글 지원
  - WebXR(`immersive-vr`) 진입 시 좌안(`layers 1`)·우안(`layers 2`) 독립 렌더링
  - 마우스 드래그 시점 회전, 휠 FOV 줌(`30° ~ 110°`), 모바일 자이로스코프 연동

---

## 시작하기

### 1. Google Cloud Console OAuth 2.0 클라이언트 ID 발급

1. [Google Cloud Console](https://console.cloud.google.com/)에 접속해 새 프로젝트를 생성하거나 기존 프로젝트를 선택합니다.
2. **API 및 서비스 > 라이브러리**에서 **Google Drive API**를 검색해 **사용(Enable)**을 클릭합니다.
3. **API 및 서비스 > OAuth 동의 화면**으로 이동합니다.
   - 사용자 유형: **외부(External)** 선택 후 생성
   - 앱 이름, 사용자 지원 이메일, 개발자 연락처 입력
   - **범위(Scopes)** 단계에서 `https://www.googleapis.com/auth/drive.readonly` 추가
   - **테스트 사용자(Test users)** 단계에서 본인 Google 계정 이메일을 추가합니다. (앱 게시 전 테스트 단계에서 필수)
4. **API 및 서비스 > 사용자 인증 정보**에서 **+ 사용자 인증 정보 만들기 > OAuth 클라이언트 ID**를 선택합니다.
   - 애플리케이션 유형: **웹 애플리케이션**
   - **승인된 자바스크립트 원본(Authorized JavaScript origins)**에 개발/배포 URL을 등록합니다:
     - 로컬 개발: `http://localhost:5173`
     - 배포 시: 실제 HTTPS 도메인 (WebXR 및 Service Worker는 HTTPS 또는 `localhost`에서만 동작합니다)
5. 생성된 **클라이언트 ID**(`xxxx.apps.googleusercontent.com`)를 복사합니다.

### 2. 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성하고 복사한 클라이언트 ID를 입력합니다.

```bash
cp .env.example .env
```

`.env` 파일 내용:

```env
VITE_GOOGLE_CLIENT_ID=여기에_발급받은_클라이언트_ID_입력
```

### 3. 설치 및 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.

### 4. 프로덕션 빌드

```bash
npm run build
npm run preview
```

---

## 파일명 자동 감지 규칙

| 파일명 포함 키워드 (대소문자 무관) | 감지 포맷 |
| :--- | :--- |
| `360` + `SBS` / `LR` / `3D_LR` | `360_SBS` |
| `360` + `OU` / `TB` / `3D_TB` | `360_OU` |
| `180` + `SBS` / `LR` (또는 `180` 단독) | `180_SBS` |
| `360` (단독) | `360_2D` |
| `SBS` / `3D_LR` (단독) | `FLAT_SBS` |
| `OU` / `TB` / `3D_TB` (단독) | `FLAT_OU` |
| 키워드 없음 | `FLAT_2D` |

플레이어 하단 컨트롤 바의 포맷 드롭다운에서 재생 중 언제든 수동으로 포맷을 변경할 수 있습니다.
