import os
from PIL import Image, ImageDraw

def create_icon():
    os.makedirs('assets', exist_ok=True)
    size = 512
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Minimal glass book mark with Lirune's fixed lavender-white brand accent.
    margin = 52
    draw.rounded_rectangle([margin, margin, size - margin, size - margin], radius=104,
                           fill=(27, 25, 38, 255), outline=(238, 236, 248, 110), width=5)
    draw.rounded_rectangle([122, 96, 390, 394], radius=32,
                           fill=(47, 44, 62, 255), outline=(238, 236, 248, 180), width=6)
    draw.polygon([(104, 116), (294, 116), (294, 372), (199, 326), (104, 372)],
                 fill=(35, 32, 49, 255), outline=(238, 236, 248, 220))
    draw.polygon([(244, 116), (294, 116), (294, 372), (269, 359), (244, 372)],
                 fill=(238, 236, 248, 255))
    draw.line([(148, 170), (246, 170)], fill=(238, 236, 248, 230), width=8)
    draw.line([(148, 210), (246, 210)], fill=(213, 210, 228, 210), width=7)
    draw.line([(148, 250), (220, 250)], fill=(188, 184, 206, 190), width=7)

    # Save PNG
    png_path = os.path.join('assets', 'icon.png')
    img.save(png_path, 'PNG')
    print(f"Saved PNG to {png_path}")

    # Generate multi-size ICO
    ico_path = os.path.join('assets', 'icon.ico')
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256), (512, 512)]
    img.save(ico_path, format='ICO', sizes=sizes)
    print(f"Saved multi-resolution ICO to {ico_path}")

if __name__ == '__main__':
    create_icon()
