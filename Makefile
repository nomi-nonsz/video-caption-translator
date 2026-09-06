APP_NAME = video-caption-translator
APP_VERSION = 1.2.0
BUILD_DIR = dist

install:
	bun install

build:
	mkdir -p $(BUILD_DIR)
	bun build --compile --target bun-linux-x64 --minify ./src/index.ts --outfile $(BUILD_DIR)/$(APP_NAME)-linux-amd64
	bun build --compile --target bun-linux-arm64 --minify ./src/index.ts --outfile $(BUILD_DIR)/$(APP_NAME)-linux-arm64
	bun build --compile --target bun-macos-x64 --minify ./src/index.ts --outfile $(BUILD_DIR)/$(APP_NAME)-macos-x86_64
	bun build --compile --target bun-windows-x64 --minify ./src/index.ts --outfile $(BUILD_DIR)/$(APP_NAME)-windows-amd64.exe

	docker build . \
		-t ghcr.io/nomi-nonsz/$(APP_NAME):latest \
		-t ghcr.io/nomi-nonsz/$(APP_NAME):$(APP_VERSION)

push:
	docker push ghcr.io/nomi-nonsz/$(APP_NAME):latest
	docker push ghcr.io/nomi-nonsz/$(APP_NAME):$(APP_VERSION)

clean:
	rm -rf ./$(BUILD_DIR)