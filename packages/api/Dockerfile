# ── shared 빌드 ──
FROM node:20-alpine AS shared-build
WORKDIR /app
COPY packages/shared/ ./packages/shared/
RUN cd packages/shared && npm install && npm run build

# ── API 빌드 ──
FROM node:20-alpine AS api-build
WORKDIR /app

# shared 빌드 결과 복사
COPY --from=shared-build /app/packages/shared ./packages/shared

# API 의존성 설치 (file:../shared 해결을 위해 shared가 먼저 있어야 함)
COPY packages/api/package.json packages/api/package-lock.json* ./packages/api/
RUN cd packages/api && npm install

# Prisma 생성
COPY packages/api/prisma ./packages/api/prisma
RUN cd packages/api && npx prisma generate

# API 소스 빌드
COPY packages/api/tsconfig.json packages/api/nest-cli.json ./packages/api/
COPY packages/api/src ./packages/api/src
RUN cd packages/api && npm run build

# ── 프로덕션 런타임 ──
FROM node:20-alpine AS runner
WORKDIR /app

# shared dist만 복사
COPY --from=api-build /app/packages/shared/package.json ./packages/shared/
COPY --from=api-build /app/packages/shared/dist ./packages/shared/dist

# API dist + node_modules + prisma 복사
COPY --from=api-build /app/packages/api/package.json ./packages/api/
COPY --from=api-build /app/packages/api/dist ./packages/api/dist
COPY --from=api-build /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=api-build /app/packages/api/prisma ./packages/api/prisma

# 파일 저장 디렉토리
RUN mkdir -p /app/storage/originals

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "packages/api/dist/main.js"]
