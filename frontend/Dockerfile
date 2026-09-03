# ============================================================
# Nuxt3 前端镜像（Node 22 + better-sqlite3 原生模块）
# 多阶段构建：构建产物 + 运行时依赖
# 构建上下文：项目根目录
# ============================================================

# ---------- 构建阶段 ----------
FROM node:22-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 原生模块需要编译工具链（预编译下载失败时兜底源码编译）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# 先装依赖（利用层缓存）
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

# 拷贝源码并构建
COPY frontend/ ./
RUN npm run build

# 移除开发依赖，减小运行镜像体积（保留 better-sqlite3 等运行时依赖）
RUN npm prune --omit=dev

# ---------- 运行阶段 ----------
FROM node:22-bookworm-slim
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# 构建产物（含 server/api 等全部 Nitro 服务端代码）
COPY --from=build /app/.output ./.output
# better-sqlite3 为原生模块，运行时需从 node_modules 加载
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# 首次启动种子数据（initStore 从当前工作目录读取）
COPY real_substation_data_cleaned.json ./real_substation_data_cleaned.json

# SQLite 数据目录（由 docker-compose 挂载 volume 持久化）
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
