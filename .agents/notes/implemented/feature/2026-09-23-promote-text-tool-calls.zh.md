# Agent Note: 提升文本工具调用

Status: implemented

[English](2026-09-23-promote-text-tool-calls.md) | 中文

## Problem

本地模型可能用助手文本里的 `{ name, arguments }` 回答文件请求，并接着把文件说成已经创建。循环只执行工具调用块，所以这样的回复什么也不会创建。

## Decision

`dsh-llm-pi-ai` 提供方路由上的 `promoteTextToolCalls` 会保留已结束的回复；当回复没有提供方工具调用时，把恰好一个 `{ name, arguments }` 对象提升为 harness 工具调用。该对象可以是裸 JSON，也可以在一个围栏代码块里，`arguments` 可以是对象或 JSON 字符串。缺少 `name` 时，字符串 `function` 字段是工具名。`name` 必须是该请求上的工具，`arguments` 必须符合该工具的 schema。没有真实 `sandbox_permissions` 值的 justification，以及没有 justification 的权限，会在该检查前移除；完整的一对会保留。对象会从文本中移除，推理块保留，finish 原因为 `tool-calls`，这一轮省略提供方回放状态。零个匹配、多个匹配、未知名称、参数超出 schema，或 schema 使用 `oneOf`、`anyOf`、`allOf`、`$ref`、`not` 或 `patternProperties` 时，回复保持不变。该开关默认关闭。

## Alternatives considered

- **只靠提示词。** 系统提示已经要求模型调用工具并等待结果。`qwen2.5-coder:7b` 仍然把调用打印成文本并报告成功。
- **提升回复中的每一个 JSON 对象。** 展示示例的回复，或包含两次调用的回复，会执行模型没有唯一要求的操作。
- **修改 agent loop。** 适配器已经拥有提供方回复。在循环看到分片之前提升，沙箱、审批和工具执行仍走原有路径。

## Consequences

启用该开关的路由不会流式发送 token 增量；回复在提供方结束后才发出。被提升的调用是普通工具调用，因此工作区权限和工具内部的参数检查仍然适用。下一次请求按内容转换这一轮，因为提供方回放状态已不再匹配。未开启该开关的路由保持不变。
