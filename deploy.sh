#!/bin/bash

# KRWX Stablecoin 운영 환경 배포 스크립트
# Usage: ./deploy.sh [production|staging]

set -e

ENVIRONMENT=${1:-staging}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🚀 KRWX Stablecoin 배포 시작 - 환경: $ENVIRONMENT"

# 환경 변수 체크
if [ "$ENVIRONMENT" = "production" ]; then
    echo "⚠️  프로덕션 환경 배포를 시작합니다."
    read -p "계속하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "배포가 취소되었습니다."
        exit 1
    fi
fi

# 1. 코드 품질 검사
echo "🔍 코드 품질 검사 실행 중..."
cd "$SCRIPT_DIR/backend"
npm run lint
npm run test
cd "$SCRIPT_DIR/frontend"
npm run lint
npm run build

# 2. Docker 이미지 빌드
echo "🐳 Docker 이미지 빌드 중..."
cd "$SCRIPT_DIR"

# 백엔드 이미지 빌드
docker build -t krwx-backend:latest ./backend

# 프론트엔드 이미지 빌드
docker build -t krwx-frontend:latest ./frontend

# 3. 스마트컨트랙트 배포 (스테이징 환경에서만)
if [ "$ENVIRONMENT" = "staging" ]; then
    echo "📋 스마트컨트랙트 배포 중..."
    cd "$SCRIPT_DIR/backend/contracts"
    npm run deploy:sepolia
fi

# 4. 인프라 배포
echo "☁️  AWS 인프라 배포 중..."
cd "$SCRIPT_DIR/infrastructure"
pulumi up --stack $ENVIRONMENT --yes

# 5. 애플리케이션 배포
echo "🚀 애플리케이션 배포 중..."

# Docker Compose로 서비스 시작
if [ "$ENVIRONMENT" = "production" ]; then
    docker-compose -f docker-compose.prod.yml up -d
else
    docker-compose -f docker-compose.staging.yml up -d
fi

# 6. 헬스체크
echo "🏥 헬스체크 실행 중..."
sleep 30

# 백엔드 헬스체크
BACKEND_URL="http://localhost:3000"
if [ "$ENVIRONMENT" = "production" ]; then
    BACKEND_URL="https://api.krwx.com"
elif [ "$ENVIRONMENT" = "staging" ]; then
    BACKEND_URL="https://api-staging.krwx.com"
fi

if curl -f "$BACKEND_URL/health" > /dev/null 2>&1; then
    echo "✅ 백엔드 헬스체크 성공"
else
    echo "❌ 백엔드 헬스체크 실패"
    exit 1
fi

# 프론트엔드 헬스체크
FRONTEND_URL="http://localhost:3001"
if [ "$ENVIRONMENT" = "production" ]; then
    FRONTEND_URL="https://krwx.com"
elif [ "$ENVIRONMENT" = "staging" ]; then
    FRONTEND_URL="https://staging.krwx.com"
fi

if curl -f "$FRONTEND_URL" > /dev/null 2>&1; then
    echo "✅ 프론트엔드 헬스체크 성공"
else
    echo "❌ 프론트엔드 헬스체크 실패"
    exit 1
fi

# 7. 모니터링 확인
echo "📊 모니터링 시스템 확인 중..."
# Grafana 대시보드 URL 출력
if [ "$ENVIRONMENT" = "production" ]; then
    echo "📈 Grafana 대시보드: https://monitoring.krwx.com"
    echo "📋 로그 조회: https://logs.krwx.com"
else
    echo "📈 Grafana 대시보드: https://monitoring-staging.krwx.com"
    echo "📋 로그 조회: https://logs-staging.krwx.com"
fi

echo "🎉 배포 완료!"
echo ""
echo "📋 배포 정보:"
echo "  환경: $ENVIRONMENT"
echo "  시간: $(date)"
echo "  버전: $(git rev-parse --short HEAD)"
echo ""
echo "🔗 서비스 URL:"
echo "  프론트엔드: $FRONTEND_URL"
echo "  백엔드: $BACKEND_URL"
echo "  API 문서: $BACKEND_URL/api"
echo ""
echo "📞 문제 발생 시 연락처:"
echo "  개발팀: dev@krwx.com"
echo "  운영팀: ops@krwx.com"

# 8. 배포 완료 알림 (Slack/Discord 등)
if [ ! -z "$SLACK_WEBHOOK_URL" ]; then
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"🚀 KRWX Stablecoin $ENVIRONMENT 환경 배포 완료\\n버전: $(git rev-parse --short HEAD)\\n시간: $(date)\"}" \
        "$SLACK_WEBHOOK_URL"
fi 