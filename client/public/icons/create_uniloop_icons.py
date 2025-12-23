#!/usr/bin/env python3
from PIL import Image, ImageDraw, ImageOps, ImageFilter
import os

def create_uniloop_icons():
    """
    Create PWA icons for UniLoop with black background, white logo, and proper padding
    """
    
    # Check if source logo exists
    source_logo_path = "uniloop-logo-source.png"
    if not os.path.exists(source_logo_path):
        print("❌ Source logo not found. Please ensure uniloop-logo-source.png exists in the icons directory.")
        return False
    
    try:
        # Load the source logo
        logo = Image.open(source_logo_path)
        print(f"✅ Loaded source logo: {logo.size}")
        
        # Convert to RGBA if not already
        if logo.mode != 'RGBA':
            logo = logo.convert('RGBA')
        
        # Icon sizes to generate
        sizes = [144, 192, 512]
        
        for size in sizes:
            # Create black background
            icon = Image.new('RGBA', (size, size), (0, 0, 0, 255))  # Black background
            
            # Calculate logo size with padding (use 70% of icon size for logo, 30% for padding)
            logo_size = int(size * 0.7)
            padding = (size - logo_size) // 2
            
            # Resize logo while maintaining aspect ratio
            logo_resized = logo.copy()
            logo_resized.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)
            
            # Convert logo to white (invert if needed and make white)
            # Create a white version of the logo
            logo_white = Image.new('RGBA', logo_resized.size, (255, 255, 255, 0))
            
            # Extract alpha channel from original logo
            alpha = logo_resized.split()[-1]  # Get alpha channel
            
            # Create white logo with same transparency
            logo_white = Image.new('RGBA', logo_resized.size, (255, 255, 255, 255))
            logo_white.putalpha(alpha)
            
            # Calculate position to center the logo
            logo_x = (size - logo_white.width) // 2
            logo_y = (size - logo_white.height) // 2
            
            # Paste the white logo onto black background
            icon.paste(logo_white, (logo_x, logo_y), logo_white)
            
            # Save the icon
            filename = f"{size}.png"
            icon.save(filename, "PNG", optimize=True)
            print(f"✅ Created {filename} ({size}x{size})")
        
        print("\n🎉 All UniLoop PWA icons created successfully!")
        print("Icons now have:")
        print("• Black background")
        print("• White logo")
        print("• 30% padding around the logo")
        return True
        
    except Exception as e:
        print(f"❌ Error creating icons: {e}")
        return False

if __name__ == "__main__":
    create_uniloop_icons()