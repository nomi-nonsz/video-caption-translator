APP_NAME = video-caption-translator
APP_VERSION = 1.2.0

install:
	bun install

build-docker:
	docker build . \
		-t ghcr.io/nomi-nonsz/$(APP_NAME):latest \
		-t ghcr.io/nomi-nonsz/$(APP_NAME):$(APP_VERSION)

build:
	bun run build linux
	bun run build linux-arm64
	bun run build macos

clean:
	rm -rf ./dist