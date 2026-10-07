# Coinfolio

개인 코인 포트폴리오 대시보드. 한국어·영어 전환, 모바일 하단 탐색, SVG 3D 도넛 차트, USDT 평가액, 일별 스냅샷과 입출금 조정 수익률을 제공합니다. 언어 선택만 브라우저에 저장합니다. 코인 로고는 CoinMarketCap 공식 페이지에서 확인해 로컬 파일로 제공하며 출처는 `public/coins/sources.json`에 기록합니다.

공개 GitHub 소스: `https://github.com/noh0249/token-portfolio`

실제 API 키, 지갑 정보, 저장소 데이터 및 운영 사이트 식별자는 포함하지 않습니다. 커밋 작성자에는 GitHub 비공개 이메일을 사용합니다.

## 시작하기

Node.js 22.13 이상이 필요합니다.

```powershell
git clone https://github.com/noh0249/token-portfolio.git
cd token-portfolio
npm install
npm run dev
```

표시되는 localhost 주소를 열고 **ChatGPT로 로그인**을 누르세요. 로컬에서만 테스트 계정으로 로그인됩니다. 배포 환경은 실제 ChatGPT 인증과 소유자 전용 접근을 사용합니다.

**연결 설정 → 연결 추가**에서 거래소 API 키 또는 이더리움 주소를 저장하고 **새로고침**을 누르세요. 연결이 없는 첫 방문은 DEMO로 표시되며, 예시 자산이나 예시 기록은 데이터베이스에 저장되지 않습니다. 실제 데이터의 과거 기록은 연결 전 날짜로 소급 생성하지 않습니다.

## 지원 연결과 범위

| 연결 | 자동 조회 범위 |
|---|---|
| Binance | 현물 계정 free + locked 잔고. HMAC API 키 지원 |
| Upbit | 대한민국 API의 잔고와 주문에 묶인 잔고, KRW 포함 |
| Ethereum | 메인넷 ETH, USDT, USDC, DAI, WBTC, LINK |

Binance 선물·Earn 계정, 다른 체인, NFT, DeFi 예치 자산은 현재 조회 범위에 포함되지 않습니다. 가격을 조회할 수 없는 코인은 보유량을 표시하고 평가액·비중에서 제외합니다. 일부 연결이나 시세 조회가 실패하면 이전 잔고를 표시하며 **일별 스냅샷은 저장하지 않습니다**.

거래소 API는 잔고 조회 권한만 발급하세요. 앱은 주문·출금 API를 호출하지 않습니다. API 키와 지갑 주소는 AES-GCM으로 암호화해 서버 D1에 저장하며, 사용자 ID를 암호화의 추가 인증 데이터로 사용합니다. 저장된 주소와 키는 조회 API 응답, HTML, 클라이언트 번들에 반환하지 않습니다. 연결 화면에는 별칭과 연결 종류만 표시합니다. 기존 평문 지갑 주소는 인증된 조회 또는 동기화 시 암호화하고 평문 열을 비웁니다. 공개 지갑 주소는 서버에서 RPC 제공자에게 잔고 조회를 위해 전달됩니다.

주소·API 키를 처음 등록할 때 입력값은 본인의 브라우저에서 서버로 전송되므로 그 요청은 본인의 개발자 도구에서 확인할 수 있습니다. 화면에 표시하는 잔고·수익률도 인증된 본인 브라우저가 받아야 합니다. 이 값까지 개발자 도구에서 감추는 기능은 아닙니다. 타인의 접근은 소유자 전용 로그인과 사용자별 조회 조건으로 차단합니다. 민감한 연결 값을 브라우저 저장소에 기록하지 않으며 예상치 못한 서버 오류의 원문도 응답에 노출하지 않습니다.

거래소의 허용 IP와 지역 제한을 확인하세요. 특히 Upbit는 허용 IP 설정이 필요하며 Cloudflare Worker의 송신 IP는 고정 IP가 아닙니다. 대한민국에서 고정 IP로 실행하는 서버나 로컬 환경이 필요할 수 있습니다. 권한·IP·지역 제한이 있으면 사이트에 연결 오류가 표시됩니다. 실제 사용자 API 키를 받지 않아 인증된 거래소 연결 성공은 아직 확인하지 않았습니다.

## 일별 기록과 수익률

첫 동기화가 완전히 성공하면 기준 스냅샷을 저장합니다. 이후 일별 작업이 매일 09:00 Asia/Seoul에 조회 시점의 평가액을 저장합니다. 같은 날짜의 재시도는 한 개의 스냅샷을 갱신합니다. 일반 새로고침은 화면의 최신 평가액만 갱신하고, 기준일 이후에는 당일 일별 기록을 덮어쓰지 않습니다.

수익률 지수는 첫 기록을 100으로 정하고 다음 식을 누적합니다.

`오늘 지수 = 이전 지수 × (오늘 평가액 − 해당 기간 순입출금) ÷ 이전 평가액`

입출금은 **수익률 기록 → 입출금 반영**에서 날짜별 USDT 순금액을 입력하세요. 동일 날짜를 다시 입력하면 이전 금액을 대체하며 0을 입력해 취소할 수 있습니다. 누락된 기록 사이의 입출금도 합산합니다. 첫 기준일의 자산은 최초 투자 기준이므로, 입출금 보정은 다음 날부터 가능합니다. 이는 일말 입출금 기준으로 계산한 근사 수익률이며 정확한 시각별 TWR/IRR는 아닙니다.

앱에서 추적하는 계정 밖의 입금·출금만 기록하세요. 연결 추가·제거로 추적 범위가 바뀌면 그 평가액 변화도 입출금에 반영해야 합니다. 추적 계정 간 이동은 중복으로 입력하지 마세요. 수동 기록이 없으면 평가액 증가율이 투자 수익률과 달라질 수 있습니다.

추천 비중은 현금 확보형·균형형·성장 추구형의 **예시 목표 모델**입니다. 개인 재무 상황을 분석한 투자 권유나 최적 비중 계산이 아닙니다. 이더리움은 도표에서 별도 표시하지만 알트코인 합계에는 포함됩니다. 현금성 분류에는 KRW와 스테이블코인이 포함되며, 스테이블코인은 무위험 현금이 아닙니다.

## 로컬 저장소와 환경변수

실제 Worker 환경변수는 사용하는 호스팅 플랫폼의 비밀 설정에 등록하세요. 로컬 환경은 Git에서 제외된 `.dev.vars` 파일을 읽습니다. `.env.example`에는 변수 이름과 자리표시자만 들어 있습니다. 개발·빌드 명령은 `.openai/hosting.example.json`을 로컬 `.openai/hosting.json`으로 준비하며, 운영 프로젝트 ID는 이 로컬 파일에만 설정하세요. 새로운 체크아웃에서 `.env.example`에 나온 키 이름을 사용해 `.dev.vars`를 준비하세요.

`KEY_ENCRYPTION_SECRET`은 32자 이상의 무작위 값이며 암호화 키입니다. 임의로 변경하면 이전에 저장한 API 키를 복호화할 수 없습니다. `.dev.vars`, `.env`, 데이터베이스 파일은 Git에 커밋하지 않습니다. `COINGECKO_API_KEY`는 선택적 fallback 시세 조회용입니다.

새 로컬 체크아웃은 마이그레이션을 적용해야 합니다.

```powershell
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_legal_post.sql
```

이미 적용한 로컬 SQL을 다시 실행하지 마세요. 운영 환경에는 게시 과정에서 마이그레이션이 자동 적용됩니다.

## 매일 자동 업데이트를 실행하는 클라우드 작업

이 사이트는 **소유자 전용 비공개 접근**을 유지해야 합니다. 외부 호출용 `/api/snapshot/update`와 `/api/snapshot/status`는 Sites dispatcher의 비공개 접근 경계를 사용하며 개인 자산이나 API 키를 반환하지 않습니다. 공개 또는 공유 사이트로 바꾸려면 이 두 엔드포인트에 별도의 서비스 인증을 추가해야 합니다.

연결된 클라우드 작업은 매 실행 시 Sites `get_site`로 동일 Site의 상태와 기존 `siwc_bypass_bearer_token`을 읽습니다. 기존 토큰이 없으면 회전·생성하지 않고 실패를 보고해야 합니다. `current_live_url`의 `/api/snapshot/update`에 POST하며 그 Site에만 `OAI-Sites-Authorization: Bearer <existing token>`을 전송합니다. 이어 `/api/snapshot/status`를 같은 인증으로 조회하고 `finishedAt`, `status`, `updated`, `failed`를 확인합니다. 토큰과 자산 값은 보고나 로그에 포함하지 않습니다.

일별 쓰기는 서버에 암호화 저장한 API 키나 지갑 주소를 사용하므로 방문자의 브라우저나 열린 세션에 의존하지 않습니다. 연결이 없으면 `waiting-for-connection`을 기록합니다. 네트워크·조회·시세 실패는 `partial-failure`로 보고하고 불완전한 평가액은 저장하지 않습니다. 같은 날짜의 재시도는 동일 기록을 갱신하며 요청 충돌은 2분 lease로 제한됩니다. 기존 스케줄을 유지하고 중복 작업을 만들지 마세요.

## Git와 검증

사이트 소스는 Git 저장소로 관리됩니다. 공개용 소스는 새로운 초기 커밋부터 시작합니다. 기존 배포용 저장소의 개인 이메일과 운영 배포 식별자를 포함한 이력은 가져오지 않습니다. 실제 환경 파일, 로컬 DB, 개인키와 빌드 결과는 `.gitignore`로 제외합니다.

```powershell
git status
git push origin main
node --test tests/*.test.mjs
npx tsc --noEmit --incremental false
```

프런트엔드: React 19, Vinext, TypeScript. 서버: Cloudflare Worker. 영구 저장: D1(SQLite), Drizzle 스키마와 마이그레이션. 3D 차트는 접근 가능한 SVG 기반이며 WebGL이 필요하지 않습니다.

## 참고한 공식 API와 자산 배분 문서

- [Binance account API](https://developers.binance.com/en/docs/catalog/core-trading-spot-trading/api/rest-api/account)
- [Upbit 인증과 API 권한](https://global-docs.upbit.com/reference/auth)
- [CoinGecko simple price](https://docs.coingecko.com/demo/reference/simple-price)
- [Ethereum JSON-RPC](https://ethereum.org/developers/docs/apis/json-rpc/)
- [Investor.gov 자산 배분과 위험 감수 수준](https://www.investor.gov/introduction-investing/getting-started/asset-allocation)

- [Coinbase 공개 환율 API](https://api.coinbase.com/v2/exchange-rates?currency=USDT)
