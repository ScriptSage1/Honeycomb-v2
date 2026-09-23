# Agent Note: Gemini 函数调用 thought signature

Status: implemented

[English](2026-09-23-gemini-function-call-thought-signature.md) | 中文

## Problem

Gemini 3 接受一次函数调用，工具执行，文件也已写入。下一个请求把这次调用发回去时没有 `thoughtSignature`。Gemini 以 HTTP 400 拒绝，聊天在写入已经成功之后显示该错误。

## Decision

`withGeminiFunctionCallSignature` 在 Google 请求载荷上运行。对 Gemini 3 模型，每一段内容里第一个没有 thought signature 的函数调用会带上 `skip_thought_signature_validator` 发送。已存储的签名保持不变。同一段里更后的函数调用保持不带签名。Gemini 2 与其他 API 不变。

## Alternatives considered

- **让后续请求继续失败。** 工具结果已经持久，但聊天停在 400，模型无法从刚写好的文件继续。
- **给每个没有签名的函数调用都填 skip 值。** Gemini 只把签名放在并行步骤的第一个函数调用上。给后面的调用补签名会改动 API 期望保持不带签名的部分。
- **修改已安装的 pi-ai 包。** 签名在已存储的回放里就不存在，而且 `node_modules` 里的修改撑不过下一次安装。

## Consequences

已存储调用没有签名时，Gemini 3 的后续请求可以继续。这次继续不携带该调用原来的推理签名，所以下一条回复可能不如回传真实签名时一致。已经带有签名的调用保持不变。
