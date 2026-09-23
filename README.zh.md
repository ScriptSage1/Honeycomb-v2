# DSH

[English](README.md) | 中文

DSH 是本文件夹中的 Web 工作区。在应用里选择一个工作区，然后让它读取、创建和编辑其中的文件。

运行前请阅读[安全说明](SAFETY.zh.md)。

<a id="run"></a>

## 运行

需要 Node.js 22.19 或更高版本，以及 pnpm。在本文件夹打开终端并运行：

```sh
pnpm dsh web --patch local-files.patch.yml --port 4174 --no-open
```

服务器会打印一个带 `?token=` 的本地地址。在浏览器中打开完整地址。每次启动都会打印新的 token，旧标签页无法重新连接。

所选模型是本地模型时，请先启动 Ollama。在应用中选择工作区和模型，然后发送任务。保持终端打开。Ctrl+C 会停止服务器。

<a id="run-from-source"></a>

### 从源码运行

在本文件夹安装依赖并构建一次：

```sh
pnpm install
pnpm run build
pnpm dsh web --patch local-files.patch.yml --port 4174 --no-open
```

`pnpm run build` 会准备 Web 服务器加载的产物。之后的启动可以使用[运行](#run)中的命令。

## 开发

请先阅读[开发指南](docs/development.zh.md)与[架构文档](docs/architecture.zh.md)。

面向 agent：请遵循 [AGENTS.md](AGENTS.md)。

## 许可证

[MIT](LICENSE)

第三方依赖及其许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
