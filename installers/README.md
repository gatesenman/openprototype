# OpenPrototype 全平台安装程序 (v0.1.0)

安装包已从仓库目录移到 GitHub Release（预发布）：

https://github.com/gatesenman/openprototype/releases/tag/v0.1.0

| 平台 | 文件 | 说明 |
|------|------|------|
| Linux (Debian/Ubuntu) | [OpenPrototype_0.1.0_amd64.deb](https://github.com/gatesenman/openprototype/releases/download/v0.1.0/OpenPrototype_0.1.0_amd64.deb) | `sudo dpkg -i` 安装 |
| Linux (Fedora/RHEL) | [OpenPrototype-0.1.0-1.x86_64.rpm](https://github.com/gatesenman/openprototype/releases/download/v0.1.0/OpenPrototype-0.1.0-1.x86_64.rpm) | `sudo rpm -i` 安装 |
| Linux (通用) | [OpenPrototype_0.1.0_amd64.AppImage](https://github.com/gatesenman/openprototype/releases/download/v0.1.0/OpenPrototype_0.1.0_amd64.AppImage) | `chmod +x` 后直接运行，免安装 |
| Windows | [OpenPrototype_0.1.0_x64-setup.exe](https://github.com/gatesenman/openprototype/releases/download/v0.1.0/OpenPrototype_0.1.0_x64-setup.exe) | NSIS 安装包 |
| Windows | [OpenPrototype-0.1.0-portable-x64.exe](https://github.com/gatesenman/openprototype/releases/download/v0.1.0/OpenPrototype-0.1.0-portable-x64.exe) | 便携版，免安装直接运行 |

完整性校验见同目录或 Release 附件中的 `SHA256SUMS.txt`：

```bash
curl -fsSL -O https://github.com/gatesenman/openprototype/releases/download/v0.1.0/SHA256SUMS.txt
curl -fsSL -O https://github.com/gatesenman/openprototype/releases/download/v0.1.0/OpenPrototype_0.1.0_amd64.AppImage
# 对其余安装包同样下载后：
sha256sum -c SHA256SUMS.txt
```

仓库内仍保留一份 `SHA256SUMS.txt`，便于对照。

## 说明
- Linux 包为本机原生构建；Windows 包为 cargo-xwin 交叉编译（合法 PE，未做代码签名，首次运行可能提示「未知发布者」）。
- **macOS (.app/.dmg)** 无法在 Linux 上交叉编译，请用 CI：推送 `v*` tag 触发 `.github/workflows/desktop-release.yml`，在 `macos-latest` runner 上产出。
