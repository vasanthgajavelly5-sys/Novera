import os
from PIL import Image, ImageDraw

def create_icon():
    os.makedirs('assets', exist_ok=True)
    size = 512
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Bookmark silhouette inspired by the supplied reference, using the existing icon files.
    margin = 52
    draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=104,
                           fill=(13, 17, 31, 255), outline=(119, 129, 160, 130), width=5)
    draw.rounded_rectangle([148, 92, 374, 392], radius=28,
                           fill=(40, 53, 92, 255), outline=(206, 214, 236, 180), width=5)
    draw.polygon([(118, 104), (300, 104), (300, 360), (209, 316), (118, 360)],
                 fill=(28, 39, 77, 255), outline=(141, 153, 190, 210))
    draw.polygon([(238, 104), (300, 104), (300, 360), (269, 345), (238, 360)],
                 fill=(113, 64, 210, 255))
    draw.line([(158, 158), (250, 158)], fill=(218, 224, 241, 210), width=7)
    draw.line([(158, 194), (250, 194)], fill=(173, 184, 213, 170), width=6)
    draw.line([(158, 230), (222, 230)], fill=(173, 184, 213, 130), width=6)

    # Save PNG
    png_path = os.path.join('assets', 'icon.png')
    img.save(png_path, 'PNG')
    print(f"Saved PNG to {png_path}")

    # Generate multi-size ICO
    ico_path = os.path.join('assets', 'icon.ico')
    sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ico_path, format='ICO', sizes=sizes)
    print(f"Saved multi-resolution ICO to {ico_path}")

if __name__ == '__main__':
    create_icon()
