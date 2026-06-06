# OpenPrototype 全平台安装程序 (v0.1.0)

| 平台 | 文件 | 说明 |
|------|------|------|
| Linux (Debian/Ubuntu) | `OpenPrototype_0.1.0_amd64.deb` | `sudo dpkg -i` 安装 |
| Linux (Fedora/RHEL) | `OpenPrototype-0.1.0-1.x86_64.rpm` | `sudo rpm -i` 安装 |
| Linux (通用) | `OpenPrototype_0.1.0_amd64.AppImage` | `chmod +x` 后直接运行，免安装 |
| Windows | `OpenPrototype_0.1.0_x64-setup.exe` | NSIS 安装包 |
| Windows | `OpenPrototype-0.1.0-portable-x64.exe` | 便携版，免安装直接运行 |

完整性校验见 `SHA256SUMS.txt`：`sha256sum -c SHA256SUMS.txt`

## 说明
- Linux 包为本机原生构建；Windows 包为 cargo-xwin 交叉编译（合法 PE，未做代码签名，首次运行可能提示「未知发布者」）。
- **macOS (.app/.dmg)** 无法在 Linux 上交叉编译，请用 CI：推送 `v*` tag 触发 `.github/workflows/desktop-release.yml`，在 `macos-latest` runner 上产出。
