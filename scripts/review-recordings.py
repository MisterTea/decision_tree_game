"""Convert every Playwright recording to MP4 and extract timestamped review frames.

Usage: python scripts/review-recordings.py qa/baseline
Requires ffmpeg, ffprobe, and Pillow. Original recordings are preserved.
"""
import json
import math
import html
import re
import subprocess
import sys
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(sys.argv[1] if len(sys.argv) > 1 else 'qa/final').resolve()
root.mkdir(parents=True, exist_ok=True)
manifest = []
for source in sorted(root.rglob('video.webm')):
    output = source.with_suffix('.mp4')
    command = ['ffmpeg', '-y', '-loglevel', 'error', '-i', str(source)]
    audio = source.parent / 'audio.webm'
    if audio.exists():
        audio_info = json.loads((source.parent / 'audio.json').read_text())
        command += ['-itsoffset', str(audio_info['offset']), '-i', str(audio), '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-af', 'apad', '-shortest']
    command += ['-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-crf', '20', '-preset', 'fast', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(output)]
    inputs = [source, *([audio, source.parent / 'audio.json'] if audio.exists() else [])]
    encode = not output.exists() or output.stat().st_mtime < max(path.stat().st_mtime for path in inputs)
    if encode:
        subprocess.run(command, check=True)
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(output)]))
    duration = float(info['format']['duration'])
    frames = source.parent / 'frames'
    frames.mkdir(exist_ok=True)
    # Inspect actual MP4 frames, not separate screenshots; 2 fps includes transitions.
    if encode or not any(frames.glob('*.png')):
        assert frames.resolve().is_relative_to(root)
        for old in frames.glob('*.png'):
            old.unlink()
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', str(output), '-vf', 'fps=2', str(frames / '%04d.png')], check=True)
    paths = sorted(frames.glob('*.png'))
    first = Image.open(paths[0])
    thumb_w = 256 if first.width > first.height else 180
    thumb_h = round(first.height / first.width * thumb_w)
    for batch in range(math.ceil(len(paths) / 24)):
        selected = paths[batch * 24:(batch + 1) * 24]
        columns = min(4, len(selected))
        sheet = Image.new('RGB', (columns * (thumb_w + 10), math.ceil(len(selected) / columns) * (thumb_h + 30)), '#deded7')
        draw = ImageDraw.Draw(sheet)
        for i, path in enumerate(selected):
            img = Image.open(path).convert('RGB'); img.thumbnail((thumb_w, thumb_h))
            x = (i % columns) * (thumb_w + 10); y = (i // columns) * (thumb_h + 30)
            sheet.paste(img, (x, y + 20)); draw.text((x + 4, y + 3), f'{(batch * 24 + i) / 2:.1f}s', fill='#23352c')
        sheet.save(source.parent / f'review-{batch + 1:02d}.jpg', quality=92)
    scenario_file = source.parent / 'scenario.json'
    scenario = json.loads(scenario_file.read_text()) if scenario_file.exists() else {}
    audio_peak = None
    if audio.exists():
        measurement = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(output), '-vn', '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True)
        peak = re.search(r'max_volume: ([-\d.]+) dB', measurement.stderr)
        audio_peak = float(peak.group(1)) if peak else None
    manifest.append({'test': source.parent.name, **scenario, 'mp4': str(output), 'duration': duration, 'frames': len(paths), 'sheets': math.ceil(len(paths) / 24), 'hasAudio': audio.exists(), 'audioPeakDb': audio_peak})
(root / 'recordings.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
cards = []
for item in manifest:
    folder = html.escape(item['test'], quote=True)
    title = html.escape(item.get('title', item['test']))
    project = html.escape(item.get('project', ''))
    status = html.escape(item.get('status', 'recorded'))
    cards.append(f'<article><h2>{title}</h2><p>{project} · {status} · {item["duration"]:.1f}s · {"with sound" if item["hasAudio"] else "video only"}</p><video controls preload="metadata" src="{folder}/video.mp4"></video><p><a href="{folder}/video.mp4">Open MP4</a> · <a href="{folder}/review-01.jpg">Review contact sheet</a></p></article>')
index = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Branch & Bloom — recorded QA</title><style>body{font:15px system-ui;background:#f6f5f0;color:#30483b;margin:32px auto;padding:0 24px;max-width:1300px}h1{font-size:30px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}article{padding:20px;border:1px solid #dce1d2;border-radius:12px;background:#fffefa}h2{font-size:17px;line-height:1.5}p{color:#6a795f;line-height:1.7}video{width:100%;max-height:550px;background:#e9eddf;border-radius:6px}a{color:#557349}</style><h1>Branch & Bloom: recorded playthroughs</h1><p>Each scenario has its own MP4. Review sheets come from the encoded MP4 at two frames per second. Audio is the captured browser output; its offset is aligned approximately to the start of recording.</p><main>' + ''.join(cards) + '</main></html>'
(root / 'index.html').write_text(index, encoding='utf-8')
print(json.dumps(manifest, indent=2))
