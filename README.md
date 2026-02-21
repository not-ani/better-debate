# Better Debate

A set of software built for debaters by debaters.

## Core Thesis

Debate software should work for debaters, not against them. The tools we use shape how we prep, how we think, and how we perform in round. Yet most debaters are still stuck with clunky, inflexible workflows that eat time and mental energy. We're building software to solve those problems. This repository will contain a set of to solve various problems we've had with our debate workflow. Note everything listed in this readme file is built out yet and many things are in beta (and definitely not ready for mass adaptation).

## 1. Tex

Verbatim by Paperless Debate has been the consensus software for policy debaters. While Verbatim is an amazing tool, we believe it is held back because (1) it builds on top of Word and is not flexible enough, and (2) it requires too much effort from debaters to use.

Many debaters just want to debate, not install macros, install custom macros, etc. Tex is supposed to be a drop in word/verbatim solution that is easy to use and easy to adapt. It will be fully compatible with verbatim to ensure that standards that the debate are preserved.

## 2. Block Vault

We've had tools like Logos, Debatify, and Buckets. These all fall short in one way or another. For the first two, you're stuck with clunky copy-paste flows, not to mention that they can't search your internal documents. For Buckets the setup is a hassle and most people don't use it. Block Vault lets you go through every single one of your cards and blocks and assemble speech docs in seconds.

It's built with a high performance search engine in Rust and a frontend with SolidJS.

# Install Instructions

1. go to releases and download the latest release

# Monorepo

Monorepo using Bun workspaces with:

- `apps/desktop` (Electrobun desktop app)
- `packages/core` (Rust cdylib + Bun FFI for ultra fast native calls)
- `packages/ui-solid` (Solid + Vite view)

Commands:

```bash
bun install
bun run dev
bun run build
bun run clean
```
