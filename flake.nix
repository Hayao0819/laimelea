{
  description = "Laimelea - Custom cycle clock app";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    android-nixpkgs = {
      url = "github:tadfisher/android-nixpkgs/stable";
      inputs.nixpkgs.follows = "nixpkgs";
    };
    treefmt-nix = {
      url = "github:numtide/treefmt-nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      android-nixpkgs,
      treefmt-nix,
    }:
    let
      supportedSystems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
      ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;
      treefmtEval = forAllSystems (
        system: treefmt-nix.lib.evalModule nixpkgs.legacyPackages.${system} ./treefmt.nix
      );

      # Build Android SDK from android-nixpkgs source with a fix for the
      # deprecated `hostPlatform` warning. Upstream default.nix uses
      # `hostPlatform` (via `with pkgs;`) which nixpkgs renamed to
      # `stdenv.hostPlatform`. We import default.nix from a patched copy.
      androidSdkFor =
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfree = true;
          };
          patched = pkgs.applyPatches {
            name = "android-nixpkgs-patched";
            src = android-nixpkgs;
            postPatch = ''
              substituteInPlace default.nix \
                --replace-fail "lib.meta.availableOn hostPlatform pkg" \
                               "lib.meta.availableOn stdenv.hostPlatform pkg"
            '';
          };
          sdkPkgs = import "${patched}/default.nix" {
            inherit pkgs;
            channel = builtins.readFile "${android-nixpkgs}/channel";
          };
        in
        sdkPkgs.sdk;
    in
    {
      formatter = forAllSystems (system: treefmtEval.${system}.config.build.wrapper);

      checks = forAllSystems (system: {
        formatting = treefmtEval.${system}.config.build.check self;
      });

      devShells = forAllSystems (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfree = true;
          };

          terraform = pkgs.terraform.withPlugins (p: [
            p.hashicorp_google
            p.hashicorp_google-beta
            p.hashicorp_null
            p.hashicorp_local
          ]);

          commonPackages = with pkgs; [
            nodejs_22
            pnpm
            watchman
            treefmtEval.${system}.config.build.wrapper
            terraform
            google-cloud-sdk
          ];

          hasAndroidSdk = builtins.hasAttr system android-nixpkgs.sdk;

          # Linux + Android SDK: full Android development shell
          androidShell =
            let
              androidSdk = androidSdkFor system (
                sdkPkgs: with sdkPkgs; [
                  cmdline-tools-latest
                  platform-tools
                  build-tools-36-0-0
                  build-tools-35-0-0 # required by @notifee/react-native
                  platforms-android-36
                  ndk-27-1-12297006
                  cmake-3-22-1 # required by react-native-worklets
                  emulator
                  system-images-android-36-default-x86-64
                ]
              );

              androidHome = "${androidSdk}/share/android-sdk";

              # Emulator wrapper: bridges host GPU drivers through Nix isolation.
              # Named "emulator" so it transparently replaces the SDK binary.
              # The real binary is called by absolute path to avoid recursion.
              # The emulator's qemu uses DT_RUNPATH (searched AFTER LD_LIBRARY_PATH),
              # so we prepend emulator's own lib paths for Nix-patched deps, then
              # append /usr/lib as fallback for GL/Vulkan libs Nix doesn't provide.
              realEmulator = "${androidHome}/emulator/emulator";
              emulatorWrapper = pkgs.writeShellScriptBin "emulator" ''
                emu_lib="${androidHome}/emulator/lib64"

                # Auto-detect host Vulkan ICDs
                vk_icds=""
                for f in /usr/share/vulkan/icd.d/*.json; do
                  [ -f "$f" ] && vk_icds="''${vk_icds:+''${vk_icds}:}$f"
                done
                export VK_ICD_FILENAMES="''${vk_icds}"
                export VK_DRIVER_FILES="''${vk_icds}"

                export LD_LIBRARY_PATH="''${emu_lib}:''${emu_lib}/qt/lib:''${LD_LIBRARY_PATH:+''${LD_LIBRARY_PATH}:}/usr/lib"
                export LIBGL_DRIVERS_PATH="/usr/lib/dri"

                exec "${realEmulator}" "$@"
              '';
            in
            pkgs.mkShell {
              buildInputs =
                commonPackages
                ++ (with pkgs; [
                  jdk17
                  androidSdk
                  emulatorWrapper
                ]);

              env = {
                ANDROID_HOME = androidHome;
                ANDROID_SDK_ROOT = androidHome;
                ANDROID_NDK_ROOT = "${androidHome}/ndk/27.1.12297006";
                JAVA_HOME = pkgs.jdk17.home;
                GRADLE_OPTS = "-Dorg.gradle.project.android.aapt2FromMavenOverride=${androidHome}/build-tools/36.0.0/aapt2";
              };

              shellHook = ''
                export ANDROID_USER_HOME="''${XDG_CONFIG_HOME:=$HOME/.config}/.android"
                export ANDROID_AVD_HOME="$ANDROID_USER_HOME/avd"
                export PATH="${emulatorWrapper}/bin:${androidHome}/platform-tools:$PATH"

                echo "Laimelea dev environment loaded (Linux/Android)"
                echo "  Node.js: $(node --version)"
                echo "  pnpm:    $(pnpm --version)"
                echo "  Java:    $(java -version 2>&1 | head -1)"
                echo "  Terraform: $(terraform version | head -1 | awk '{print $2}')"
                echo "  gcloud: $(gcloud version 2>/dev/null | head -1 | awk '{print $NF}')"
                echo "  ANDROID_HOME: $ANDROID_HOME"
              '';
            };

          # macOS: iOS development shell
          # Uses mkShellNoCC to avoid Nix clang conflicting with Xcode's toolchain.
          # Xcode, xcodebuild, xcrun, and CocoaPods come from the host system.
          darwinShell = pkgs.mkShellNoCC {
            packages = commonPackages;

            shellHook = ''
              echo "Laimelea dev environment loaded (macOS/iOS)"
              echo "  Node.js: $(node --version)"
              echo "  pnpm:    $(pnpm --version)"
              echo "  Terraform: $(terraform version | head -1 | awk '{print $2}')"
              echo "  gcloud: $(gcloud version 2>/dev/null | head -1 | awk '{print $NF}')"
            '';
          };
        in
        {
          default =
            if pkgs.stdenv.isDarwin then
              darwinShell
            else if hasAndroidSdk then
              androidShell
            else
              # Fallback for Linux without Android SDK (e.g. aarch64-linux)
              pkgs.mkShell {
                packages = commonPackages;

                shellHook = ''
                  echo "Laimelea dev environment loaded (Linux, no Android SDK)"
                  echo "  Node.js: $(node --version)"
                  echo "  pnpm:    $(pnpm --version)"
                  echo "  Terraform: $(terraform version | head -1 | awk '{print $2}')"
                  echo "  gcloud: $(gcloud version 2>/dev/null | head -1 | awk '{print $NF}')"
                '';
              };
        }
      );
    };
}
