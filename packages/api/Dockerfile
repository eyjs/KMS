FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

# 의존성 설치
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.json ./
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/
COPY packages/api/package.json packages/api/tsconfig.json packages/api/nest-cli.json ./packages/api/
RUN pnpm install --frozen-lockfile

# shared 빌드
FROM deps AS shared-build
COPY packages/shared/src ./packages/shared/src
RUN pnpm --filter @kms/shared build

# Prisma 생성 + API 빌드
FROM shared-build AS api-build
COPY packages/api/prisma ./packages/api/prisma
RUN pnpm --filter @kms/api exec prisma generate
COPY packages/api/src ./packages/api/src
RUN pnpm --filter @kms/api build

# 프로덕션 런타임
FROM node:20-alpine AS runner
RUN corepack enable && corepack prepare pnpm@9 --activate
WORKDIR /app

COPY --from=api-build /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/package.json ./
COPY --from=api-build /app/packages/shared/package.json ./packages/shared/
COPY --from=api-build /app/packages/shared/dist ./packages/shared/dist
COPY --from=api-build /app/packages/api/package.json ./packages/api/
COPY --from=api-build /app/packages/api/dist ./packages/api/dist
COPY --from=api-build /app/packages/api/prisma ./packages/api/prisma
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=api-build /app/packages/shared/node_modules ./packages/shared/node_modules

# 파일 저장 디렉토리
RUN mkdir -p /app/storage/originals

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "packages/api/dist/main.js"]
