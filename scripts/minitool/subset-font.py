"""把 ZCOOL KuaiLe 裁成只含游戏里用到的字，供小工具包使用。

用法（需要 fonttools 和 brotli：pip install fonttools brotli）：
    python3 scripts/minitool/subset-font.py <ZCOOLKuaiLe-Regular.ttf>
字体原文件：https://github.com/google/fonts/raw/main/ofl/zcoolkuaile/ZCOOLKuaiLe-Regular.ttf（OFL 授权）
改了界面文案后重新运行一次，再重新打小工具包。
"""
import pathlib
import sys

from fontTools import subset

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "minitool" / "fonts" / "zcool-kuaile-subset.woff2"


def collect_text() -> str:
    chars = set(chr(c) for c in range(0x20, 0x7F))  # ASCII：数字、字母、标点
    chars.update("，。、：；！？“”‘’（）《》【】…—·～￥×÷±→←↑↓➜⇅↔▶⏭✔✖")
    for path in list((ROOT / "src").rglob("*")) + [ROOT / "index.html", ROOT / "minitool" / "shell.html"]:
        if path.is_file() and path.suffix in {".ts", ".tsx", ".css", ".html"}:
            chars.update(path.read_text(encoding="utf-8"))
    return "".join(sorted(c for c in chars if c.isprintable() and not c.isspace() or c == " "))


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    text = collect_text()
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.notdef_outline = True
    font = subset.load_font(sys.argv[1], options)
    subsetter = subset.Subsetter(options)
    subsetter.populate(text=text)
    subsetter.subset(font)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    subset.save_font(font, str(OUT), options)
    print(f"{len(text)} chars -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KiB)")


if __name__ == "__main__":
    main()
