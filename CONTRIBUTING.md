# Contributing to Laimelea

開発に参加いただきありがとうございます。このドキュメントでは開発環境のセットアップからビルド、テスト、コード品質管理までの手順を説明します。

## 前提条件

- [Nix](https://nixos.org/download/) (flakes 有効)
- Android 実機またはエミュレータ

## 開発環境セットアップ

Nix flake で Node.js 22, pnpm, JDK 17, Android SDK 36 が全て揃います。

```bash
nix develop   # or: direnv allow
pnpm install
```

詳細なセットアップ手順は [Nix Environment Guide](docs/setup/nix-environment.md) を参照してください。

## ビルド・実行

```bash
pnpm start          # Metro bundler
pnpm android        # ビルド+インストール+起動
```

Gradle を直接叩く場合:

```bash
cd android && ./gradlew assembleDebug
cd android && ./gradlew assembleRelease
cd android && ./gradlew clean
```

## テスト

```bash
pnpm jest                                          # 全テスト
pnpm jest __tests__/core/time/conversions.test.ts  # 単体
pnpm jest --watch                                  # Watch
pnpm jest --coverage                               # カバレッジ
```

## フォーマット

[treefmt](https://github.com/numtide/treefmt) で Prettier (JS/TS/JSON/MD/YAML) と nixfmt (Nix) を一括実行します。設定は `treefmt.nix` ([treefmt-nix](https://github.com/numtide/treefmt-nix)) で管理しています。

```bash
treefmt               # devShell 内
nix fmt               # devShell 外からも実行可
nix flake check       # フォーマット検証 (CI 向け)
```

## リント

ESLint はフォーマッタではなくリンターとして treefmt とは別に実行します。

```bash
pnpm eslint .         # リント
pnpm eslint . --fix   # 自動修正
pnpm tsc --noEmit     # 型チェック
```

## Nix

`.nix` ファイルを変更したら必ず検証してください:

```bash
nix flake check
```

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/) 形式を使用します。

- **形式**: `type: 簡潔な説明` （英語、小文字始まり）
- **type**: `feat`, `fix`, `test`, `docs`, `chore`, `ci`, `refactor` など

## ドキュメント

- [Architecture](docs/architecture.md) — 設計ドキュメント
- [Nix Environment](docs/setup/nix-environment.md) — 開発環境セットアップ
- [Emulator Setup](docs/setup/emulator.md) — エミュレータ設定
- [GCP Setup](docs/setup/gcp-setup.md) — Google Cloud Platform 設定
- [Release Publishing](docs/guides/release-publishing.md) — リリース手順
