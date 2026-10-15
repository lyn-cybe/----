"""从保留的原视频生成 H.264/AAC 网页版。需要 Python 3 和 FFmpeg。"""
import concurrent.futures
import json
from pathlib import Path
import shutil
import struct
import subprocess

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / '对应视频'
DEST = ROOT / '网页视频'


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_streams', '-show_format',
        '-of', 'json', str(path)], text=True))


def verify(path, original):
    info = probe(path)
    video = next(s for s in info['streams'] if s['codec_type'] == 'video')
    assert video['codec_name'] == 'h264', path
    assert video['pix_fmt'] == 'yuv420p', path
    assert all(s['codec_name'] == 'aac' for s in info['streams']
               if s['codec_type'] == 'audio'), path
    original_info = probe(original)
    original_video = next(s for s in original_info['streams'] if s['codec_type'] == 'video')
    assert (video['width'], video['height']) == (original_video['width'], original_video['height'])
    assert sum(s['codec_type'] == 'audio' for s in info['streams']) == sum(
        s['codec_type'] == 'audio' for s in original_info['streams'])
    assert abs(float(info['format']['duration']) - float(original_info['format']['duration'])) < 0.15
    # Verify MP4's index precedes media data, enabling progressive playback.
    atoms = []
    with path.open('rb') as f:
        while header := f.read(8):
            size, kind = struct.unpack('>I4s', header)
            head_size = 8
            if size == 1:
                size = struct.unpack('>Q', f.read(8))[0]
                head_size = 16
            atoms.append(kind)
            if size == 0:
                break
            assert size >= head_size
            f.seek(size - head_size, 1)
    assert atoms.index(b'moov') < atoms.index(b'mdat')
    # Decode every frame and the audio stream; fail on decoding errors.
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(path),
                    '-f', 'null', '-'], check=True)
    return dict(file=path.name, codec=video['codec_name'], pixel_format=video['pix_fmt'],
                width=video['width'], height=video['height'],
                duration=float(info['format']['duration']), bytes=path.stat().st_size,
                full_decode='passed', faststart=True)


def convert(source):
    target = DEST / source.name
    if target.exists():
        result = verify(target, source)
        print('Validated existing:', target.name, flush=True)
        return result
    temp = DEST / (source.stem + '.tmp.mp4')
    subprocess.run([
        'ffmpeg', '-nostdin', '-hide_banner', '-loglevel', 'error', '-n',
        '-i', str(source), '-map', '0:v:0', '-map', '0:a:0?',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
        '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-threads', '2',
        '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(temp)], check=True)
    result = verify(temp, source)
    temp.rename(target)
    result['file'] = target.name
    print('Converted and decoded:', target.name, flush=True)
    return result


if __name__ == '__main__':
    for executable in ['ffmpeg', 'ffprobe']:
        if not shutil.which(executable):
            raise SystemExit(f'请先安装 {executable}，并添加到 PATH。')
    sources = sorted(SOURCE.glob('*.mp4'))
    if not sources:
        raise SystemExit(f'未找到原视频：{SOURCE}')
    DEST.mkdir(exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(convert, sources))
    (ROOT / '素材说明' / '网页视频验证报告.json').write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'PASS: {len(results)} videos. Originals retained. Output: {DEST}', flush=True)
