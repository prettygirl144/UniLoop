from PIL import Image, ImageDraw, ImageFont
import os

# Create 192x192 icon
img = Image.new('RGB', (192, 192), '#1565C0')
draw = ImageDraw.Draw(img)

# Add white circle and text
draw.ellipse([64, 32, 128, 96], fill='white')
draw.rectangle([72, 108, 120, 156], fill='white')

try:
    # Try to use a basic font, fallback to default if not available
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 16)
except:
    font = ImageFont.load_default()

draw.text((96, 170), 'CC', fill='white', anchor='mm', font=font)
img.save('192.png')

# Create 144x144 icon (scaled version)
img_144 = img.resize((144, 144), Image.LANCZOS)
img_144.save('144.png')

# Create 512x512 icon (scaled version)
img_large = img.resize((512, 512), Image.LANCZOS)
img_large.save('512.png')

print("Icons created successfully")
