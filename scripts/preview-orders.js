require('dotenv').config();
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

async function initSheets() {
	const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
	if (!fs.existsSync(serviceAccountPath)) {
		throw new Error('Missing service-account.json in project root');
	}
	const auth = new google.auth.GoogleAuth({
		keyFile: serviceAccountPath,
		scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
	});
	return google.sheets({ version: 'v4', auth });
}

function makeSheetConfigs() {
	return [
		{
			id: process.env.GOOGLE_SHEET_ID,
			name: 'Orders',
			description: 'Main Orders (All Types)'
		}
	].filter(c => !!c.id);
}

async function tryRanges(sheets, spreadsheetId, sheetName) {
	const ranges = [
		`${sheetName}!A:Z`,
		'Sheet1!A:Z',
		'Orders!A:Z',
		'Data!A:Z'
	];
		for (const range of ranges) {
			try {
			const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
			const rows = res.data.values || [];
			if (rows.length > 0) {
				return { rows, range };
			}
			} catch {
			// try next range
		}
	}
	return { rows: [], range: null };
}

async function main() {
	try {
		const sheets = await initSheets();
		const configs = makeSheetConfigs();

		if (configs.length === 0) {
			console.log('No Google Sheet IDs configured in .env');
			process.exit(1);
		}

		console.log('Previewing Google Sheets data...');
		for (const cfg of configs) {
			console.log(`\n▶ ${cfg.description}: ${cfg.id}`);
			const { rows, range } = await tryRanges(sheets, cfg.id, cfg.name);
			if (!range) {
				console.log('  ⚠ No data found or invalid permissions/ranges');
				continue;
			}
			console.log(`  ✓ Range used: ${range}`);
			console.log(`  ✓ Rows (including header): ${rows.length}`);
			if (rows.length > 1) {
				const headers = rows[0];
				const first = rows[1];
				const sample = {};
				headers.forEach((h, i) => { if (h) sample[h] = first[i] || ''; });
				// Show key columns if present
				const phone = sample['Phone'] || sample['Phone Number'] || sample['Contact Info'] || sample['Contact Number'] || sample['phone'] || '';
				const orderId = sample['Order ID'] || sample['Master Order ID'] || sample['order_id'] || sample['orderId'] || '';
				const status = (sample['Delivery Status'] || sample['Status'] || sample['status'] || '').toString();
				console.log('  ✓ Headers:', headers.filter(Boolean).slice(0, 12).join(', '));
				console.log('  ✓ Sample row key fields:', { orderId, phone, status });
			}
		}
	} catch (err) {
		console.error('Preview failed:', err.message);
		process.exit(1);
	}
}

if (require.main === module) {
	main();
}

