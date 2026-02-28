# Android Emulator Setup

`nix develop` でエミュレータ実行に必要なコンポーネントはすべて揃う。追加のインストールは不要。android-nixpkgs がエミュレータバイナリの全依存ライブラリを Nix store 内で解決するため、NixOS だけでなく Arch Linux 等の非 NixOS ディストリビューションでもそのまま動作する。

## 前提条件: KVM

Linux ではハードウェアアクセラレーション (KVM) が必須。KVM なしではエミュレータが極端に遅いか起動しない。

```bash
# KVM が使えるか確認
ls /dev/kvm
```

`/dev/kvm` が存在しない場合:

```bash
# カーネルモジュールをロード (Intel)
sudo modprobe kvm_intel

# カーネルモジュールをロード (AMD)
sudo modprobe kvm_amd

# 現在のユーザーを kvm グループに追加
sudo usermod -aG kvm $USER
# ログアウト→ログインで反映
```

Arch Linux の場合:

```bash
# kvm モジュールは linux カーネルに組み込み済み (別途インストール不要)
# kvm グループへの追加のみ必要
sudo usermod -aG kvm $USER
# ログアウト→ログインで反映
```

NixOS の場合は `configuration.nix` に以下を追加:

```nix
virtualisation.libvirtd.enable = true;
users.users.<your-user>.extraGroups = [ "kvm" ];
```

## AVD の作成

`nix develop` に入った状態で実行する。

```bash
# 1. 利用可能なシステムイメージを確認
sdkmanager --list 2>/dev/null | grep "system-images;android-36"
```

flake.nix に `system-images-android-36-default-x86-64` が含まれているため、以下のイメージが使える:

```text
system-images;android-36;default;x86_64
```

```bash
# 2. AVD を作成
avdmanager create avd \
  --name Pixel_API_36 \
  --package 'system-images;android-36;default;x86_64' \
  --device 'pixel_8'
```

`--device` に指定できるデバイス一覧:

```bash
avdmanager list device | grep 'id:'
```

> **Note**: `google_apis` 版が必要な場合は、`flake.nix` の `androidSdk` に `system-images-android-36-google-apis-x86-64` を追加して `nix develop` を再起動する。

## エミュレータの起動

```bash
# AVD 一覧を確認
emulator -list-avds

# 起動
emulator -avd Pixel_API_36
```

### 起動オプション

| オプション                  | 説明                                                    |
| --------------------------- | ------------------------------------------------------- |
| `-no-snapshot-load`         | スナップショットを使わずコールドブート                  |
| `-wipe-data`                | ユーザーデータを初期化して起動                          |
| `-no-window`                | ヘッドレス (CI 向け)                                    |
| `-gpu swiftshader_indirect` | ソフトウェアレンダリング (GPU パススルーが使えない環境) |
| `-memory 4096`              | RAM を 4096 MB に指定                                   |

### バックグラウンドで起動

```bash
emulator -avd Pixel_API_36 &>/dev/null &
# ブートが完了するまで待つ
adb wait-for-device
adb shell getprop sys.boot_completed  # "1" が返れば起動完了
```

## アプリのビルドと実行

エミュレータが起動した状態で:

```bash
# デバイスが認識されているか確認
adb devices

# アプリをビルドしてエミュレータにインストール
pnpm react-native run-android
```

## AVD の管理

```bash
# AVD 一覧
avdmanager list avd

# AVD を削除
avdmanager delete avd --name Pixel_API_36
```

AVD のデータは `~/.android/avd/` に保存される。

## トラブルシューティング

### `emulator: command not found`

`nix develop` の中にいるか確認する。shellHook が `$ANDROID_HOME/emulator` を PATH に追加する。

```bash
which emulator
# → /nix/store/.../share/android-sdk/emulator/emulator
```

### `KVM permission denied`

```bash
# /dev/kvm のパーミッションを確認
ls -la /dev/kvm

# kvm グループに入っているか確認
groups | grep kvm
```

ユーザーが `kvm` グループに入っていない場合は「前提条件: KVM」セクションを参照。

### `ANDROID_AVD_HOME` 関連エラー

Nix 環境では `$HOME/.android/avd` がデフォルトの AVD 保存先。環境変数で変更可能:

```bash
export ANDROID_AVD_HOME="$HOME/.android/avd"
```

### GPU レンダリングエラー

エミュレータは SwiftShader（ソフトウェアレンダラー）を内蔵しており、ホストの GPU ドライバに依存せず動作する。ハードウェアアクセラレーションを試す場合は `-gpu host` を指定する。

```bash
# ハードウェアアクセラレーション (ホストの GPU ドライバが必要)
emulator -avd Pixel_API_36 -gpu host

# ソフトウェアレンダリング (確実に動作する)
emulator -avd Pixel_API_36 -gpu swiftshader_indirect
```

Wayland 環境では `QT_QPA_PLATFORM=xcb` が Nix ラッパーにより自動設定される。XWayland 経由で動作するため追加設定は不要。

### エミュレータがフリーズ・クラッシュする

```bash
# コールドブートで再起動
emulator -avd Pixel_API_36 -no-snapshot-load

# それでもダメなら AVD のデータをリセット
emulator -avd Pixel_API_36 -wipe-data
```
