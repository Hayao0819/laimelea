# Laimelea

カスタム日周期(例: 26時間)に対応した Android 時計アプリ。

React Native 0.84 (New Architecture) / TypeScript / react-native-paper v5

## セットアップ

[Nix](https://nixos.org/download/) (flakes 有効) が必要。

```bash
nix develop   # or: direnv allow
pnpm install
```

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

[treefmt](https://github.com/numtide/treefmt) で Prettier (JS/TS/JSON/MD/YAML) と nixfmt (Nix) を一括実行する。設定は `treefmt.nix` ([treefmt-nix](https://github.com/numtide/treefmt-nix)) で管理。

```bash
treefmt               # devShell 内
nix fmt               # devShell 外からも実行可
nix flake check       # フォーマット検証 (CI 向け)
```

## リント

ESLint はフォーマッタではなくリンターとして treefmt とは別に実行する。

```bash
pnpm eslint .         # リント
pnpm eslint . --fix   # 自動修正
pnpm tsc --noEmit     # 型チェック
```

## Nix

`.nix` ファイルを変更したら:

```bash
nix flake check
```

## License

TBD
