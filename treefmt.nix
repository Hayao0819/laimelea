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
}
