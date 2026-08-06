# video-caption-translator

A command-based AI-powered tool for translating video subtitles.

## Overview

`video-caption-translator` is a command-line tool build with bun and typescript. Uses Ollama backend to translate video subtitles. It reads subtitles from a video and translating the cues, and can output translated captions as standalone subtitle files or embed soft subtitles back into the video.

Currently it uses ollama as a backends for testing because we broke af

# Installation:

| IMPORTANT NOTE: This project depends on `ffmpeg` and `ffprobe`. It is **HIGHLY RECOMMENDED** that you install these tools first.

For installation, go to [releases page](https://github.com/nomi-nonsz/video-caption-translator/releases) and download the executable binary based on your operating system.

# Usage

```bash
video-caption-translator --lang en --type video mycontent.mkv -o mycontent-translated.mkv
```

Specify the options

```bash
video-caption-translator -l sp -t srt -s 20 -m gemma4 --tone casual mycontent.mkv -o mycontent-translated.srt
```

List connected models

```bash
video-caption-translator --list-models
```

## Ollama Cloud

If you using ollama cloud

```bash
export OLLAMA_API_KEY=<your-api-key>
```

or

```bash
OLLAMA_API_KEY=<your-api-key> video-caption-translator --type video -o mycontent-translated.mkv mycontent.mkv
```

## Available languages
- English (`en`)
- Arabic (`ar`)
- Chinese (`zh`)
- Dutch (`nl`)
- Finnish (`fi`)
- French (`fr`)
- German (`de`)
- Hindi (`hi`)
- Hungarian (`hu`)
- Indonesian (`id`)
- Japanese (`ja`)
- Korean (`ko`)
- Polish (`pl`)
- Portuguese (`pt`)
- Russian (`ru`)
- Spanish (`es`)
- Thai (`th`)
- Turkish (`tr`)
- Ukrainian (`uk`)
- Urdu (`ur`)
- Vietnamese (`vi`)

## Supported Formats

Video:
- Matroska `mkv`
- WebM `webm`
- MP4 `mp4` (limited)

Subtitles
- Subrip `srt`
- WebVTT `vtt`

## Contributing

Contributions, issues, and feature requests are welcome. Feel free to open a pull request or issue.

## License

This project is open source. Add your preferred license here.

