const fs = require('fs');
const path = require('path');

const src = 'C:/Users/Admin/.gemini/antigravity-ide/brain/33b42536-8276-4f18-b87a-941e5909603e/scooter_icon_screen_1788938922203.png';
const dst = path.join(__dirname, 'app/assets/tongquan_scooter.png');

try {
    fs.copyFileSync(src, dst);
    console.log('✅ Copied to:', dst);
    console.log('\nNow update Navbar.jsx line:');
    console.log("  import tongquan from '../../assets/tongquan.png';");
    console.log('to:');
    console.log("  import tongquan from '../../assets/tongquan_scooter.png';");
} catch (e) {
    console.error('❌', e.message);
}
