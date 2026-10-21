import sys
from PIL import Image
from rembg import remove, new_session
src, out, model = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert('RGB')
res = remove(im, session=new_session(model), only_mask=True)
res.save(out)
print(out, res.size)
