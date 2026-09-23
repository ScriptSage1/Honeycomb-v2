# Agent Note: Gemini function-call thought signature

Status: implemented

English | [中文](2026-09-23-gemini-function-call-thought-signature.zh.md)

## Problem

Gemini 3 accepts a function call, the tool runs, and the file is written. The next request sends that call back without a `thoughtSignature`. Gemini rejects it with HTTP 400, and the chat shows the error after the write has already succeeded.

## Decision

`withGeminiFunctionCallSignature` runs on the Google request payload. For a Gemini 3 model, the first function call in each content turn that has no thought signature is sent with `skip_thought_signature_validator`. A stored signature stays. A later function call in that same turn stays unsigned. Gemini 2 and other APIs are unchanged.

## Alternatives considered

- **Leave the follow-up failing.** The tool result is already durable, but the chat stops on the 400 and the model cannot continue from the file it just wrote.
- **Put the skip value on every unsigned function call.** Gemini attaches a signature only to the first function call of a parallel step. Filling the later calls would change parts the API expects to stay unsigned.
- **Patch the installed pi-ai package.** The signature is absent from the stored replay, and a `node_modules` edit does not survive the next install.

## Consequences

A Gemini 3 follow-up can continue when the stored call has no signature. That continuation does not carry the model's original reasoning signature for the call, so the next reply can be less consistent than one that echoes a real signature. Calls that already have a signature are unchanged.
