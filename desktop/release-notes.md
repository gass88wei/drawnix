Drawnix @VERSION@ Linux 桌面版（社区封装）

## 这是什么

上游 plait-board/drawnix 是纯 Web 的开源白板（思维导图 / 流程图 / 自由画 / 无限画布）。
这个包用 Electron 把它封装成离线桌面应用：不联网也能画，数据留在本地。

## 相对上游改了什么

- 新增 `desktop/`：Electron 主进程 + electron-builder 配置，AppImage / deb 双产物
- 前端资源通过自定义协议 `app://drawnix/` 提供，保证 IndexedDB 自动保存跨启动有效
- 去掉内置菜单；外链交给系统浏览器；单实例运行；屏蔽上游网页统计脚本
- 上游前端源码零改动

## 安装

deb（推荐，走包管理）：

```
sudo dpkg -i Drawnix-@VERSION@-x86_64.deb
sudo apt-get -f install   # 仅当提示缺依赖时
```

AppImage（免安装试用）：

```
chmod +x Drawnix-@VERSION@-x86_64.AppImage
./Drawnix-@VERSION@-x86_64.AppImage    # 需要 libfuse2
```

## 数据位置

- 自动保存：本地 IndexedDB，应用数据目录 `~/.config/Drawnix`
- 导入 / 导出：系统文件对话框（.drawnix / .json / PNG / SVG 等）

## 已知限制

- 只出 linux x64
- 桌面端没有 File System Access API，所以「保存」走系统保存对话框，不会原地覆盖上一份文件
- 本包是社区封装，不是上游官方产物

## 校验和

```
@CHECKSUMS@
```
