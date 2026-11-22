#!/usr/bin/env python3
"""批量生成《料理之神》美术素材。

用法：
  python3 scripts/art/generate.py            # 生成所有缺失的图
  python3 scripts/art/generate.py tools/knife # 只生成（或重新生成）指定条目
  python3 scripts/art/generate.py --convert   # 只把 raw PNG 转成 public/art 下的 webp

生成走 ~/.claude/skills/image-gen/scripts/gen_image.py，provider 用 magpie，
模型 gpt-image-2.6-sunburst。原图存 scripts/art/raw/（不进仓库），
游戏使用的是压缩后的 public/art/**/*.webp。
"""
import json, os, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.abspath(os.path.join(ROOT, '..', '..'))
RAW = os.path.join(ROOT, 'raw')
OUT = os.path.join(PROJECT, 'public', 'art')
GEN = os.path.expanduser('~/.claude/skills/image-gen/scripts/gen_image.py')
MODEL = 'gpt-image-2.6-sunburst'
PROVIDER = 'magpie'
CONCURRENCY = 4

manifest = json.load(open(os.path.join(ROOT, 'manifest.json')))
styles = manifest['styles']


def prompt_for(item):
    style = item['style']
    if style == 'scene':
        return styles['base'] + item['desc']
    body = styles[style].format(desc=item['desc'], mood=item.get('mood', 'smiling'))
    return styles['base'] + body + styles['isolated']


def size_for(item):
    return item.get('size', '1024x1024')


def convert(item):
    raw = os.path.join(RAW, item['out'] + '.png')
    if not os.path.exists(raw):
        return False
    dst = os.path.join(OUT, item['out'] + '.webp')
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    width = 1600 if item['style'] == 'scene' else (512 if item['out'].startswith(('bosses', 'scene', 'dishes')) else 320)
    subprocess.run(['cwebp', '-quiet', '-q', '82', '-alpha_q', '90', '-resize', str(width), '0', raw, '-o', dst], check=True)
    return True


def generate(item, force=False):
    raw = os.path.join(RAW, item['out'] + '.png')
    if os.path.exists(raw) and not force:
        convert(item)
        return item['out'], 'skip'
    os.makedirs(os.path.dirname(raw), exist_ok=True)
    prompt = prompt_for(item)
    pfile = raw[:-4] + '.txt'
    open(pfile, 'w').write(prompt)
    cmd = ['python3', GEN, '--provider', PROVIDER, '--model', MODEL, '--prompt-file', pfile,
           '--out', raw, '--size', size_for(item), '--quality', 'medium']
    if not item.get('opaque'):
        cmd += ['--background', 'transparent']
    for attempt in range(2):
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if r.returncode == 0 and os.path.exists(raw):
            convert(item)
            return item['out'], 'ok'
    return item['out'], 'FAIL ' + (r.stderr or r.stdout)[-300:]


def main():
    args = sys.argv[1:]
    if args == ['--convert']:
        for it in manifest['items']:
            convert(it)
        return
    items = manifest['items']
    force = False
    if args:
        items = [it for it in items if it['out'] in args]
        force = True
    with ThreadPoolExecutor(CONCURRENCY) as ex:
        for out, status in ex.map(lambda it: generate(it, force), items):
            print(f'{status:5} {out}', flush=True)


if __name__ == '__main__':
    main()
