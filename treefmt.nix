{ pkgs, ... }:
{
  projectRootFile = "flake.nix";

  programs.nixfmt.enable = true;

  programs.prettier = {
    enable = true;
    excludes = [
      "node_modules/**"
      "android/**"
      "infra/**"
      "pnpm-lock.yaml"
    ];
  };

  settings.formatter.markdownlint = {
    command = "${pkgs.markdownlint-cli2}/bin/markdownlint-cli2";
    options = [ "--fix" ];
    includes = [ "*.md" ];
    excludes = [
      "node_modules/**"
      "android/**"
    ];
    priority = 1; # run after prettier (default priority = 0)
  };
}
