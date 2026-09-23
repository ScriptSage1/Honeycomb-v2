# DSH

English | [中文](README.zh.md)

DSH is the web workspace in this folder. Choose a workspace in the app, then ask it to read, create, and edit files there.

Review the [safety notice](SAFETY.md) before running it.

## Run

Node.js 22.19 or newer and pnpm are required. Open a terminal in this folder and run:

```sh
pnpm dsh web --patch local-files.patch.yml --port 4174 --no-open
```

The server prints a local address that includes `?token=`. Open that full address in a browser. Each start prints a new token, so an old tab does not reconnect.

Start Ollama first when the selected model is local. In the app, select the workspace and the model, then send the task. Leave the terminal open. Ctrl+C stops the server.

### Run from source

Install dependencies and build once from this folder:

```sh
pnpm install
pnpm run build
pnpm dsh web --patch local-files.patch.yml --port 4174 --no-open
```

`pnpm run build` prepares the artifacts the web server loads. Later starts can use the command under [Run](#run).

## Development

Start with the [development guide](docs/development.md) and [architecture documentation](docs/architecture.md).

For agents, follow [AGENTS.md](AGENTS.md).

## License

[MIT](LICENSE)

Third-party dependencies and their licenses are disclosed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
