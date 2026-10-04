"""
Cut each tagged player out of their photo for the Live PvP cards.

    pip install rembg onnxruntime opencv-python-headless pillow
    python scripts/players/cutouts.py

Reads public/assets/players/Cricket-players.zip and scripts/players/photo-map.json
(written by `npm run cards:build`), and writes one transparent, face-aligned
480 x 720 WebP per player to public/assets/players/cards/<id>.webp: the face
centred, its top at 17% and its height 20% of the image, so every card frames
its player the same way.

Face detection uses OpenCV's YuNet model: put face_detection_yunet_2023mar.onnx
(from the opencv_zoo repository) next to this script, or point FACE_MODEL at it.
"""
import io, json, os, sys, zipfile
import cv2, numpy as np
from PIL import Image, ImageOps
from rembg import remove, new_session

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
ZIP = os.path.join(ROOT, 'public/assets/players/Cricket-players.zip')
OUT = os.path.join(ROOT, 'public/assets/players/cards')
OW, OH = 480, 720
FACE_H, FACE_TOP = 0.20 * OH, 0.17 * OH

def photos(wanted):
    with zipfile.ZipFile(ZIP) as z:
        for n in z.namelist():
            if n in wanted:
                yield n, ImageOps.exif_transpose(Image.open(io.BytesIO(z.read(n)))).convert('RGB')

def main():
    wanted = json.load(open(os.path.join(HERE, 'photo-map.json')))
    by_photo = {v: k for k, v in wanted.items()}
    only = set(sys.argv[1:])
    os.makedirs(OUT, exist_ok=True)
    session = new_session('u2net_human_seg')
    model = os.environ.get('FACE_MODEL') or os.path.join(HERE, 'face_detection_yunet_2023mar.onnx')
    for name, im in photos(by_photo):
        pid = by_photo[name]
        if only and pid not in only:
            continue
        bgr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
        det = cv2.FaceDetectorYN.create(model, '', (im.width, im.height), 0.6, 0.3, 5000)
        _, faces = det.detect(bgr)
        cut = remove(im, session=session, post_process_mask=True)
        alpha = np.asarray(cut)[..., 3] / 255.0
        best = None
        for f in ([] if faces is None else faces):
            x, y, w, h, score = float(f[0]), float(f[1]), float(f[2]), float(f[3]), float(f[-1])
            x0, y0, x1, y1 = max(int(x), 0), max(int(y), 0), min(int(x + w), im.width), min(int(y + h), im.height)
            cover = alpha[y0:y1, x0:x1].mean() if x1 > x0 and y1 > y0 else 0
            if cover > 0.35 and (best is None or cover * w * h * score > best[0]):
                best = (cover * w * h * score, (x, y, w, h))
        if best is None and faces is not None and len(faces):
            # The cut-out missed the face; trust the detector's best face instead.
            f = max(faces, key=lambda f: float(f[-1]))
            best = (0, (float(f[0]), float(f[1]), float(f[2]), float(f[3])))
        if best is None:
            print(f'{name} ({pid}): no face found, skipped', file=sys.stderr)
            continue
        x, y, w, h = best[1]
        k = FACE_H / h
        big = cut.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
        ox, oy = round(OW / 2 - (x + w / 2) * k), round(FACE_TOP - y * k)
        out = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
        out.alpha_composite(big, (max(ox, 0), max(oy, 0)), (max(-ox, 0), max(-oy, 0)))
        out.save(os.path.join(OUT, f'{pid}.webp'), quality=82, method=6)

if __name__ == '__main__':
    main()
