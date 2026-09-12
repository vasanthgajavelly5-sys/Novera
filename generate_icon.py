import os
from PIL import Image, ImageDraw

def create_icon():
    os.makedirs('assets', exist_ok=True)
    size = 512
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Outer rounded square with deep luxury background
    # Colors: #13111C gradient to #2E1065
    margin = 32
    rect = [margin, margin, size - margin, size - margin]
    radius = 100

    # Draw rounded background
    draw.rounded_rectangle(rect, radius=radius, fill=(19, 17, 28, 255), outline=(139, 92, 246, 120), width=4)

    # Book back cover
    b_margin = 110
    draw.rounded_rectangle([b_margin + 20, b_margin - 10, size - b_margin + 20, size - b_margin - 10], 
                           radius=24, fill=(76, 29, 149, 180))

    # Main Book cover (Rich violet gradient)
    draw.rounded_rectangle([b_margin, b_margin, size - b_margin, size - b_margin], 
                           radius=24, fill=(124, 58, 237, 255), outline=(196, 181, 253, 180), width=4)

    # Spine highlight
    draw.rounded_rectangle([b_margin + 6, b_margin + 6, b_margin + 36, size - b_margin - 6],
                           radius=12, fill=(91, 33, 182, 255))
    draw.line([b_margin + 42, b_margin + 12, b_margin + 42, size - b_margin - 12], fill=(196, 181, 253, 90), width=3)

    # Pages lines inside book
    line_x_start = b_margin + 70
    line_x_end = size - b_margin - 40
    for y_offset in [70, 110, 150, 190]:
        y = b_margin + y_offset
        w = 4 if y_offset == 70 else 3
        opacity = 200 if y_offset < 150 else 140
        draw.line([line_x_start, y, line_x_end - (30 if y_offset == 190 else 0), y], 
                  fill=(255, 255, 255, opacity), width=w)

    # Bookmark ribbon hanging down
    ribbon_x = size - b_margin - 80
    draw.polygon([
        (ribbon_x, b_margin),
        (ribbon_x + 36, b_margin),
        (ribbon_x + 36, size - b_margin + 50),
        (ribbon_x + 18, size - b_margin + 32),
        (ribbon_x, size - b_margin + 50)
    ], fill=(245, 158, 11, 255))

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
