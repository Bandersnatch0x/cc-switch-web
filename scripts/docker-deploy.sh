#!/usr/bin/env bash
# cc-switch-web Docker 一键部署脚本
# 镜像：ghcr.io/laliet/cc-switch-web
# 选项：
#   -p, --port      指定端口（默认 3000）
#   -d, --detach    后台运行
#   -v, --version   指定版本标签（默认 latest）
#   --data-dir      数据目录挂载到容器 /home/ccswitch/.cc-switch（可选）
#   -h, --help      显示帮助

set -euo pipefail

IMAGE="ghcr.io/laliet/cc-switch-web"
CONTAINER_NAME="cc-switch-web"

PORT=3000
DETACH=0
VERSION="latest"
DATA_DIR=""

usage() {
  cat <<'EOF'
用法: docker-deploy.sh [选项]

快速部署 cc-switch-web Docker 容器：
  -p, --port <端口>     指定端口（默认 3000）
  -d, --detach          后台运行（默认前台）
  -v, --version <版本>  指定镜像标签（默认 latest）
  --data-dir <目录>     挂载数据目录到 /home/ccswitch/.cc-switch
  -h, --help            显示本帮助

示例：
  ./docker-deploy.sh -p 8080 --data-dir /opt/cc-switch-data -d
EOF
}

log() { printf '\033[1;34m[cc-switch]\033[0m %s\n' "$*"; }
error() { printf '\033[1;31m[cc-switch]\033[0m %s\n' "$*" >&2; }

# 参数解析
while [[ $# -gt 0 ]]; do
  case "$1" in
    -p|--port)
      PORT="${2:-}"
      shift 2
      ;;
    -d|--detach)
      DETACH=1
      shift
      ;;
    -v|--version)
      VERSION="${2:-}"
      shift 2
      ;;
    --data-dir)
      DATA_DIR="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

# 基础校验
if ! command -v docker >/dev/null 2>&1; then
  error "未检测到 Docker，请先安装 Docker 后重试。"
  exit 1
fi

if [[ -z "$PORT" || ! "$PORT" =~ ^[0-9]+$ || "$PORT" -le 0 || "$PORT" -gt 65535 ]]; then
  error "端口无效：$PORT"
  exit 1
fi

if [[ -n "$DATA_DIR" ]]; then
  # 挂载目录用于持久化 ~/.cc-switch
  mkdir -p "$DATA_DIR"
fi

log "准备拉取镜像：${IMAGE}:${VERSION} ..."
docker pull "${IMAGE}:${VERSION}"

# 清理旧容器
if docker ps -a --format '{{.Names}}' | grep -Eq "^${CONTAINER_NAME}$"; then
  log "检测到已存在容器，正在停止并删除旧容器..."
  docker stop "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker rm "$CONTAINER_NAME" >/dev/null 2>&1 || true
fi

run_opts=(
  --name "$CONTAINER_NAME"
  -p "${PORT}:${PORT}"
  -e "PORT=${PORT}"
  -e "HOST=0.0.0.0"
  --restart unless-stopped
)

if [[ "$DETACH" -eq 1 ]]; then
  run_opts+=("-d")
fi

if [[ -n "$DATA_DIR" ]]; then
  run_opts+=("-v" "${DATA_DIR}:/home/ccswitch/.cc-switch")
  log "挂载数据目录：$DATA_DIR -> /home/ccswitch/.cc-switch"
fi

log "启动 cc-switch-web 容器..."
docker run "${run_opts[@]}" "${IMAGE}:${VERSION}"

log "部署完成！容器名称：${CONTAINER_NAME}，访问端口：${PORT}"
