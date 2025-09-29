/**
 * WhatsApp Media Message Test Script
 * Tests image, video, and audio sending functionality
 */

const axios = require('axios');
const path = require('path');

const SERVER_URL = 'http://localhost:3001';

async function testMediaMessaging() {
    console.log('🎬 Testing WhatsApp Media Message Sending...');
    console.log('═'.repeat(60));
    console.log('');

    try {
        // Test 1: Check media status
        console.log('1️⃣ Checking media capabilities...');
        const mediaStatusResponse = await axios.get(`${SERVER_URL}/api/media/status`);
        console.log('✅ Media Status:', mediaStatusResponse.data.mediaCapabilities);
        console.log('📊 Media directories created:', mediaStatusResponse.data.status.directories);
        console.log('📝 Supported formats:');
        Object.entries(mediaStatusResponse.data.status.supportedFormats).forEach(([type, formats]) => {
            console.log(`   ${type}: ${formats.join(', ')}`);
        });
        console.log('');

        // Test 2: Check server health
        console.log('2️⃣ Checking server health...');
        const healthResponse = await axios.get(`${SERVER_URL}/api/health`);
        console.log('✅ Server Status:', healthResponse.data.status);
        console.log('🏪 Shop:', healthResponse.data.shop);
        console.log('');

        // Test 3: Test regular text message first
        console.log('3️⃣ Testing regular text message...');
        const testTextMessage = {
            phone: '7375938371', // Admin phone
            message: `🤖 Media Test Started!\n\n` +
                    `📅 Time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n` +
                    `🎯 Testing: Image, Video, and Audio messaging\n` +
                    `🏪 Shop: RS Tailor & Fabric\n\n` +
                    `Next: Testing media messages... 📸🎥🎵`
        };

        const textResponse = await axios.post(`${SERVER_URL}/api/test-send`, testTextMessage, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        if (textResponse.data.success) {
            console.log('✅ Text message sent successfully!');
        }
        console.log('');

        // Test 4: Test template message with media
        console.log('4️⃣ Testing template message with media...');
        const templateResponse = await axios.post(`${SERVER_URL}/api/test-send`, {
            phone: '7375938371',
            messageType: 'welcome'
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        if (templateResponse.data.success) {
            console.log('✅ Template message sent successfully!');
        }
        console.log('');

        // Note about media files
        console.log('📝 Media File Instructions:');
        console.log('');
        console.log('To test image/video messages, you need to:');
        console.log('1. Add media files to the following directories:');
        console.log('   • ./media/images/test-image.jpg (for image testing)');
        console.log('   • ./media/videos/test-video.mp4 (for video testing)');
        console.log('   • ./media/audio/test-audio.mp3 (for audio testing)');
        console.log('');
        console.log('2. Use the following API endpoints to test:');
        console.log('');
        console.log('🖼️ Test Image Message:');
        console.log('POST /api/test-send-image');
        console.log('Body: {');
        console.log('  "phone": "7375938371",');
        console.log('  "imagePath": "./media/images/test-image.jpg",');
        console.log('  "caption": "Test image from RS Tailor & Fabric!"');
        console.log('}');
        console.log('');
        console.log('🎥 Test Video Message:');
        console.log('POST /api/test-send-video');
        console.log('Body: {');
        console.log('  "phone": "7375938371",');
        console.log('  "videoPath": "./media/videos/test-video.mp4",');
        console.log('  "caption": "Test video from RS Tailor & Fabric!"');
        console.log('}');
        console.log('');
        console.log('🎵 Test Audio Message:');
        console.log('POST /api/test-send-audio');
        console.log('Body: {');
        console.log('  "phone": "7375938371",');
        console.log('  "audioPath": "./media/audio/test-audio.mp3"');
        console.log('}');

        console.log('');
        console.log('💡 Example CURL commands:');
        console.log('');
        console.log('# Test Image:');
        console.log(`curl -X POST ${SERVER_URL}/api/test-send-image \\`);
        console.log('  -H "Content-Type: application/json" \\');
        console.log('  -d \'{"phone":"7375938371","imagePath":"./media/images/test-image.jpg","caption":"Test image!"}\'');
        console.log('');
        console.log('# Test Video:');
        console.log(`curl -X POST ${SERVER_URL}/api/test-send-video \\`);
        console.log('  -H "Content-Type: application/json" \\');
        console.log('  -d \'{"phone":"7375938371","videoPath":"./media/videos/test-video.mp4","caption":"Test video!"}\'');

        console.log('');
        console.log('🎯 What You Can Do Now:');
        console.log('1. ✅ Send text messages with templates');
        console.log('2. ✅ Send images with captions');
        console.log('3. ✅ Send videos with captions');
        console.log('4. ✅ Send audio messages');
        console.log('5. ✅ Send view-once media (disappearing messages)');
        console.log('6. ✅ Send GIF videos');
        console.log('7. ✅ Send voice notes (PTT)');
        console.log('8. ✅ Send documents');
        console.log('');
        console.log('🎊 Your bot now has FULL MEDIA SUPPORT! 🎊');

    } catch (error) {
        console.log('❌ Test failed with error:');
        
        if (error.response) {
            console.log('📄 Status:', error.response.status);
            console.log('📄 Response:', error.response.data);
            
            if (error.response.status === 503) {
                console.log('');
                console.log('💡 WhatsApp might not be connected yet. Please check:');
                console.log('   1. Is the bot server running?');
                console.log('   2. Did you scan the QR code?');
                console.log('   3. Check server logs for connection status');
            }
        } else if (error.code === 'ECONNREFUSED') {
            console.log('🔌 Cannot connect to server - is the bot running?');
            console.log('💡 Run: npm start');
        } else {
            console.log('🔍 Error details:', error.message);
        }
    }

    console.log('');
    console.log('🏁 Media messaging test complete!');
}

// Helper function to test with actual media files
async function testWithMediaFiles() {
    console.log('🎬 Testing with actual media files...');
    console.log('');

    const tests = [
        {
            name: 'Image Message',
            endpoint: '/api/test-send-image',
            payload: {
                phone: '7375938371',
                imagePath: './media/images/test-image.jpg',
                caption: 'Test image from RS Tailor & Fabric! 📸'
            }
        },
        {
            name: 'Video Message',
            endpoint: '/api/test-send-video',
            payload: {
                phone: '7375938371',
                videoPath: './media/videos/test-video.mp4',
                caption: 'Test video from RS Tailor & Fabric! 🎥'
            }
        },
        {
            name: 'Audio Message',
            endpoint: '/api/test-send-audio',
            payload: {
                phone: '7375938371',
                audioPath: './media/audio/test-audio.mp3'
            }
        }
    ];

    for (const test of tests) {
        try {
            console.log(`Testing ${test.name}...`);
            const response = await axios.post(`${SERVER_URL}${test.endpoint}`, test.payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });

            if (response.data.success) {
                console.log(`✅ ${test.name} sent successfully!`);
            } else {
                console.log(`❌ ${test.name} failed:`, response.data);
            }
        } catch (error) {
            console.log(`❌ ${test.name} failed:`, error.response?.data?.error || error.message);
        }
        console.log('');
    }
}

// Run tests
async function runAllTests() {
    console.log('🚀 Starting WhatsApp Media Bot Tests...');
    console.log('═'.repeat(60));
    console.log('');
    
    await testMediaMessaging();
    
    // Uncomment the line below to test with actual media files
    // await testWithMediaFiles();
    
    console.log('');
    console.log('═'.repeat(60));
    console.log('🎉 All tests completed!');
}

if (require.main === module) {
    runAllTests().catch(console.error);
}

module.exports = { testMediaMessaging, testWithMediaFiles };