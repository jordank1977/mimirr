const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
];

const inputPath = path.join(__dirname, '..', 'public', 'logo.png');
const outputDir = path.join(__dirname, '..', 'public');

async function generateIcons() {
  for (const { size, name } of sizes) {
    const outputPath = path.join(outputDir, name);

    await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 10, g: 10, b: 10, alpha: 1 }
      })
      .png()
      .toFile(outputPath);

    console.log(`✓ Generated ${name} (${size}x${size})`);
  }

  console.log('\n✓ All PWA icons generated successfully!');
}

generateIcons().catch(console.error);
