<div align="center">

# Laimelea

[![Android](https://img.shields.io/badge/Android-8.0+-3DDC84?style=flat-square&logo=android&logoColor=white)](https://developer.android.com)
[![React Native](https://img.shields.io/badge/React_Native-0.84-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Material 3](https://img.shields.io/badge/Material_3-Paper_v5-6750A4?style=flat-square&logo=materialdesign&logoColor=white)](https://callstack.github.io/react-native-paper/)
[![License](https://img.shields.io/github/license/Hayao0819/laimelea?style=flat-square)](LICENSE)

---

あなたの体内時計に合わせて動く時計アプリ

</div>

## Why Laimelea?

- 24時間サイクルに縛られない時計
- 起きられない人のための最強のアラーム

## Features

<table>
<tr>
<td width="50%">

### :clock1: カスタム時計

任意の時間周期に対応したアナログ＆デジタル時計。フルスクリーンのデスククロックモードも搭載。

</td>
<td width="50%">

### :alarm_clock: スマートアラーム

カスタム時間でのアラーム設定、一括作成、Googleカレンダー予定との自動連動。シェイク・数学問題など多彩な解除方法。

</td>
</tr>
<tr>
<td width="50%">

### :calendar: カレンダー連携

Googleカレンダーとの双方向同期。月/週/アジェンダビューでカスタム時間軸上に予定を表示。

</td>
<td width="50%">

### :zzz: 睡眠トラッキング

Health Connect連携による自動記録と手動入力。睡眠周期の回帰分析で生活リズムを可視化。

</td>
</tr>
<tr>
<td width="50%">

### :hourglass_flowing_sand: タイマー

カウントダウンタイマーとストップウォッチ。カスタム時間表示に対応。

</td>
<td width="50%">

### :cloud: バックアップ

Google Drive経由のクラウドバックアップ。設定、アラーム、睡眠ログを安全に保存・復元。

</td>
</tr>
</table>

### GMS不要設計

Laimelea は **Google Mobile Services (GMS) がなくても完全に動作**します。AOSP AlarmManager、OAuth2 PKCE (Chrome Custom Tabs)、CalendarContract による GMS 非依存アーキテクチャを採用。GMS 搭載端末では追加機能（Google Sign-In、Health Connect、Google Drive バックアップ）が利用可能です。

## Getting Started

### 必要なもの

- [Nix](https://nixos.org/download/) (flakes 有効)
- Android 8.0+ デバイスまたはエミュレータ

### インストール

```bash
git clone https://github.com/Hayao0819/laimelea.git
cd laimelea
nix develop
pnpm install
pnpm android
```

詳しい開発環境の構築手順は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## Architecture

```text
src/
├── features/          9つの機能モジュール
│   ├── clock/         カスタム時計 & デスククロック
│   ├── alarm/         アラーム管理 & 自動連動
│   ├── calendar/      カレンダー同期 & 表示
│   ├── timer/         タイマー & ストップウォッチ
│   ├── sleep/         睡眠トラッキング
│   ├── settings/      設定 (7つのサブ画面)
│   ├── widget/        ホーム画面ウィジェット
│   ├── setup/         初期セットアップ
│   └── game2048/      🎮
├── core/              時間計算, プラットフォーム抽象化, i18n
├── atoms/             Jotai グローバル状態
└── hooks/             カスタム React hooks
```

設計の詳細は [Architecture Document](docs/architecture.md) を参照してください。

## Contributing

[CONTRIBUTING.md](CONTRIBUTING.md) にビルド手順、テスト、コーディング規約をまとめています。

## License

[MIT License](LICENSE)
