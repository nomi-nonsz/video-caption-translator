FROM oven/bun:alpine AS build

WORKDIR /app

COPY . .

RUN bun ci
RUN bun build --compile --target bun-linux-x64 --minify --sourcemap --bytecode ./src/index.ts --outfile /build/video-caption-translator

FROM alpine:latest

RUN apk add ffmpeg
RUN ffmpeg -version && ffprobe -version

COPY --from=build /build/video-caption-translator /usr/local/bin/video-caption-translator

WORKDIR /root

ENTRYPOINT [ "video-caption-translator" ]